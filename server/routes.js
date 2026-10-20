const { parse } = require('url');
const fs = require('fs');
const path = require('path');
const Busboy = require('busboy');
const config = require('./config');
const { stmts } = require('./db');
const auth = require('./auth');
const filesUtil = require('./files');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1 MB limit for JSON body
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data, headers = {}) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  for (const [key, val] of Object.entries(headers)) {
    res.setHeader(key, val);
  }
  res.end(JSON.stringify(data));
}

function getAuthenticatedUser(req) {
  const cookies = auth.parseCookies(req.headers.cookie);
  const token = cookies.lanlink_session;
  if (!token) return null;
  const session = auth.verifyToken(token);
  if (!session || !session.userId) return null;
  return session;
}

async function handleApiRoutes(req, res, io) {
  const parsedUrl = parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;
  const clientIp = getClientIp(req);

  // --- Auth: Current User Status ---
  if (pathname === '/api/auth/me' && method === 'GET') {
    const session = getAuthenticatedUser(req);
    if (session) {
      const user = stmts.getUserById.get(session.userId);
      if (user) {
        return sendJson(res, 200, {
          authenticated: true,
          user: {
            id: user.id,
            username: user.username,
          },
          roomVerified: session.roomVerified,
          roomRequired: config.requireRoomPassword,
        });
      }
    }

    return sendJson(res, 200, {
      authenticated: false,
      roomRequired: config.requireRoomPassword,
    });
  }

  // --- Auth: Register ---
  if (pathname === '/api/auth/register' && method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { username, password, roomPassword } = body;

      // Validate room password if required
      if (config.requireRoomPassword && !auth.verifyRoomPassword(roomPassword)) {
        return sendJson(res, 403, { error: 'Incorrect room password' });
      }

      // Validate username
      const usernameCheck = auth.validateUsername(username);
      if (!usernameCheck.valid) {
        return sendJson(res, 400, { error: usernameCheck.error });
      }

      // Validate password policy
      const passwordCheck = auth.validatePassword(password);
      if (!passwordCheck.valid) {
        return sendJson(res, 400, { error: passwordCheck.error });
      }

      // Check if username already exists (case-insensitive)
      const existingUser = stmts.getUserByUsername.get(usernameCheck.username);
      if (existingUser) {
        return sendJson(res, 409, { error: 'Username is already taken' });
      }

      // Create user
      const userId = `u_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const passwordHash = auth.hashPassword(password);
      const createdAt = Date.now();

      stmts.createUser.run(userId, usernameCheck.username, passwordHash, createdAt);
      console.log(`[AUTH] Registered new user: ${usernameCheck.username} (${userId}) from ${clientIp}`);

      // Issue session token
      const token = auth.generateToken({ id: userId, username: usernameCheck.username }, true);
      const cookieHeader = auth.getSessionCookie(token);

      return sendJson(res, 201, {
        success: true,
        user: { id: userId, username: usernameCheck.username },
      }, { 'Set-Cookie': cookieHeader });

    } catch (err) {
      console.error('[AUTH ERROR] Registration failed:', err);
      return sendJson(res, 500, { error: 'Registration failed due to server error' });
    }
  }

  // --- Auth: Login ---
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { username, password, roomPassword } = body;

      const trimmedUsername = (username || '').trim();

      // Check brute-force lockout
      const lockout = auth.checkLockout(clientIp, trimmedUsername);
      if (lockout.locked) {
        return sendJson(res, 429, {
          error: `Account temporarily locked due to multiple failed attempts. Try again in ${lockout.remainingMinutes} minute(s).`,
          locked: true,
          remainingMinutes: lockout.remainingMinutes,
        });
      }

      // Check room password if required
      if (config.requireRoomPassword && !auth.verifyRoomPassword(roomPassword)) {
        auth.recordFailedLogin(clientIp, trimmedUsername);
        return sendJson(res, 403, { error: 'Incorrect room password' });
      }

      // Lookup user
      const user = trimmedUsername ? stmts.getUserByUsername.get(trimmedUsername) : null;
      if (!user || !auth.verifyPassword(password || '', user.password_hash)) {
        auth.recordFailedLogin(clientIp, trimmedUsername);
        console.warn(`[AUTH FAILED] Failed login attempt for "${trimmedUsername}" from ${clientIp}`);
        return sendJson(res, 401, { error: 'Invalid username or password' });
      }

      // Successful login
      auth.recordSuccessfulLogin(clientIp, user.username);
      console.log(`[AUTH SUCCESS] User logged in: ${user.username} (${user.id}) from ${clientIp}`);

      // Issue JWT session token
      const token = auth.generateToken(user, true);
      const cookieHeader = auth.getSessionCookie(token);

      return sendJson(res, 200, {
        success: true,
        user: { id: user.id, username: user.username },
      }, { 'Set-Cookie': cookieHeader });

    } catch (err) {
      console.error('[AUTH ERROR] Login failed:', err);
      return sendJson(res, 500, { error: 'Login failed due to server error' });
    }
  }

  // --- Auth: Logout ---
  if (pathname === '/api/auth/logout' && (method === 'POST' || method === 'GET')) {
    const clearCookie = auth.getClearSessionCookie();
    return sendJson(res, 200, { success: true }, { 'Set-Cookie': clearCookie });
  }

  // --- Chat Security: Status of Conversation Password ---
  if (pathname === '/api/chats/status' && method === 'GET') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    const partnerId = parsedUrl.query.partnerId;
    if (!partnerId) {
      return sendJson(res, 400, { error: 'partnerId is required' });
    }

    const chatId = [session.userId, partnerId].sort().join(':');
    const record = stmts.getChatPassword.get(chatId);

    return sendJson(res, 200, {
      hasPassword: !!record,
      createdBy: record ? record.created_by : null,
    });
  }

  // --- Chat Security: Verify Chat Password ---
  if (pathname === '/api/chats/verify' && method === 'POST') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    try {
      const body = await parseJsonBody(req);
      const { partnerId, password } = body;

      if (!partnerId || !password) {
        return sendJson(res, 400, { error: 'partnerId and password are required' });
      }

      const chatId = [session.userId, partnerId].sort().join(':');
      const record = stmts.getChatPassword.get(chatId);

      if (!record) {
        return sendJson(res, 404, { error: 'No password has been set for this chat yet.' });
      }

      if (!auth.verifyPassword(password, record.password_hash)) {
        return sendJson(res, 401, { error: 'Incorrect chat password. Access denied.' });
      }

      return sendJson(res, 200, { success: true, verified: true });
    } catch (err) {
      console.error('[CHAT VERIFY ERROR]', err);
      return sendJson(res, 500, { error: 'Verification failed' });
    }
  }

  // --- Chat Security: Set or Update Chat Password ---
  if (pathname === '/api/chats/set-password' && method === 'POST') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    try {
      const body = await parseJsonBody(req);
      const { partnerId, password, oldPassword } = body;

      if (!partnerId || !password) {
        return sendJson(res, 400, { error: 'partnerId and password are required' });
      }

      if (password.length < 4) {
        return sendJson(res, 400, { error: 'Chat password must be at least 4 characters long' });
      }

      const chatId = [session.userId, partnerId].sort().join(':');
      const existing = stmts.getChatPassword.get(chatId);

      if (existing && existing.password_hash) {
        if (!oldPassword || !auth.verifyPassword(oldPassword, existing.password_hash)) {
          return sendJson(res, 403, { error: 'Current chat password is required to change it' });
        }
      }

      const hash = auth.hashPassword(password);
      stmts.setChatPassword.run(chatId, hash, session.userId, Date.now());
      console.log(`[CHAT PASSWORD SET] User "${session.username}" configured password for chat "${chatId}"`);

      return sendJson(res, 200, { success: true });
    } catch (err) {
      console.error('[CHAT SET PASSWORD ERROR]', err);
      return sendJson(res, 500, { error: 'Failed to set chat password' });
    }
  }

  // --- Cross-Verification: User's Own Chat Access Password ---
  if (pathname === '/api/users/my-chat-password' && method === 'GET') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    let record = stmts.getUserChatPassword.get(session.userId);
    // If user has not set a custom chat password yet, initialize default
    if (!record) {
      const defaultPass = `${session.username}123`;
      const hash = auth.hashPassword(defaultPass);
      stmts.setUserChatPassword.run(session.userId, hash, defaultPass, Date.now());
      record = { plaintext_hint: defaultPass };
    }

    return sendJson(res, 200, {
      chatPassword: record.plaintext_hint || '',
    });
  }

  if (pathname === '/api/users/my-chat-password' && method === 'POST') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    try {
      const body = await parseJsonBody(req);
      const { password } = body;

      if (!password || password.trim().length < 4) {
        return sendJson(res, 400, { error: 'Chat password must be at least 4 characters long' });
      }

      const cleanPass = password.trim();
      const hash = auth.hashPassword(cleanPass);
      stmts.setUserChatPassword.run(session.userId, hash, cleanPass, Date.now());
      console.log(`[USER CHAT PASSWORD UPDATED] User "${session.username}" updated their personal chat password`);

      return sendJson(res, 200, { success: true, chatPassword: cleanPass });
    } catch (err) {
      console.error('[USER CHAT PASSWORD ERROR]', err);
      return sendJson(res, 500, { error: 'Failed to update chat password' });
    }
  }

  // --- Cross-Verification: Verify Target User's Chat Password ---
  if (pathname === '/api/chats/user-status' && method === 'GET') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    const targetUserId = parsedUrl.query.targetUserId;
    if (!targetUserId) {
      return sendJson(res, 400, { error: 'targetUserId is required' });
    }

    let record = stmts.getUserChatPassword.get(targetUserId);
    // If target user doesn't have an explicit entry yet, look up their username
    if (!record) {
      const targetUser = stmts.getUserById.get(targetUserId);
      if (targetUser) {
        const defaultPass = `${targetUser.username}123`;
        const hash = auth.hashPassword(defaultPass);
        stmts.setUserChatPassword.run(targetUserId, hash, defaultPass, Date.now());
        record = { password_hash: hash };
      }
    }

    return sendJson(res, 200, {
      hasPassword: !!record,
    });
  }

  if (pathname === '/api/chats/verify-user-password' && method === 'POST') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    try {
      const body = await parseJsonBody(req);
      const { targetUserId, password } = body;

      if (!targetUserId || !password) {
        return sendJson(res, 400, { error: 'Target user ID and password are required' });
      }

      let record = stmts.getUserChatPassword.get(targetUserId);
      if (!record) {
        const targetUser = stmts.getUserById.get(targetUserId);
        if (targetUser) {
          const defaultPass = `${targetUser.username}123`;
          const hash = auth.hashPassword(defaultPass);
          stmts.setUserChatPassword.run(targetUserId, hash, defaultPass, Date.now());
          record = { password_hash: hash };
        }
      }

      if (!record || !auth.verifyPassword(password, record.password_hash)) {
        return sendJson(res, 401, { error: 'Incorrect chat password for this user. Access denied.' });
      }

      return sendJson(res, 200, { success: true, verified: true });
    } catch (err) {
      console.error('[VERIFY USER CHAT PASSWORD ERROR]', err);
      return sendJson(res, 500, { error: 'Verification failed' });
    }
  }

  // --- Group Chat Endpoints ---
  if (pathname === '/api/groups/list' && method === 'GET') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    const groups = stmts.getAllGroups.all();
    return sendJson(res, 200, { groups });
  }

  if (pathname === '/api/groups/create' && method === 'POST') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    try {
      const body = await parseJsonBody(req);
      const { name, password } = body;

      if (!name || name.trim().length < 2) {
        return sendJson(res, 400, { error: 'Group name must be at least 2 characters long' });
      }
      if (!password || password.length < 4) {
        return sendJson(res, 400, { error: 'Group password must be at least 4 characters long' });
      }

      const groupId = `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const cleanName = name.trim();
      const hash = auth.hashPassword(password);
      const createdAt = Date.now();

      stmts.createGroup.run(groupId, cleanName, hash, session.userId, session.username, createdAt);
      console.log(`[GROUP CREATED] Host "${session.username}" created group "${cleanName}" (${groupId})`);

      const allGroups = stmts.getAllGroups.all();
      if (io) {
        io.emit('groups_update', allGroups);
      }

      return sendJson(res, 201, {
        success: true,
        group: { id: groupId, name: cleanName, hostId: session.userId, hostName: session.username, createdAt },
      });
    } catch (err) {
      console.error('[CREATE GROUP ERROR]', err);
      return sendJson(res, 500, { error: 'Failed to create group: ' + err.message });
    }
  }

  if (pathname === '/api/groups/verify' && method === 'POST') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    try {
      const body = await parseJsonBody(req);
      const { groupId, password } = body;

      if (!groupId || !password) {
        return sendJson(res, 400, { error: 'Group ID and password are required' });
      }

      const group = stmts.getGroupWithSecret.get(groupId);
      if (!group) {
        return sendJson(res, 404, { error: 'Group chat not found' });
      }

      if (!auth.verifyPassword(password, group.password_hash)) {
        return sendJson(res, 401, { error: 'Incorrect group password set by host. Access denied.' });
      }

      return sendJson(res, 200, { success: true, verified: true });
    } catch (err) {
      console.error('[VERIFY GROUP ERROR]', err);
      return sendJson(res, 500, { error: 'Verification failed' });
    }
  }

  if (pathname === '/api/groups/messages' && method === 'GET') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    const groupId = parsedUrl.query.groupId;
    if (!groupId) {
      return sendJson(res, 400, { error: 'groupId is required' });
    }

    const rawMessages = stmts.getGroupMessages.all(groupId);
    const messages = rawMessages.map(m => ({
      id: m.id,
      groupId: m.group_id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      text: m.text,
      fileAttachment: m.file_attachment ? JSON.parse(m.file_attachment) : null,
      timestamp: m.timestamp,
      date: m.date,
    }));

    return sendJson(res, 200, { messages });
  }

  if (pathname === '/api/groups/delete' && method === 'POST') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    try {
      const body = await parseJsonBody(req);
      const { groupId } = body;

      const group = stmts.getGroupById.get(groupId);
      if (!group) {
        return sendJson(res, 404, { error: 'Group not found' });
      }

      if (group.host_id !== session.userId) {
        return sendJson(res, 403, { error: 'Only the host who created this group can delete it.' });
      }

      stmts.deleteGroup.run(groupId);
      require('./db').db.exec(`DELETE FROM group_messages WHERE group_id = '${groupId}'`);

      const allGroups = stmts.getAllGroups.all();
      if (io) {
        io.emit('groups_update', allGroups);
      }

      return sendJson(res, 200, { success: true });
    } catch (err) {
      console.error('[DELETE GROUP ERROR]', err);
      return sendJson(res, 500, { error: 'Failed to delete group' });
    }
  }

  // --- Files: List Shared Files ---
  if (pathname === '/api/files/list' && method === 'GET') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    const files = stmts.getAllFiles.all().map(f => ({
      id: f.id,
      name: f.original_name,
      size: f.size_formatted,
      type: f.file_type,
      uploaderName: f.uploader_name,
      uploadedAt: f.uploaded_at,
      downloadUrl: `/api/files/download?id=${encodeURIComponent(f.id)}`,
    }));

    return sendJson(res, 200, { files });
  }

  // --- Files: Authorized Download ---
  if (pathname === '/api/files/download' && method === 'GET') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required to download files.' });
    }

    const fileId = parsedUrl.query.id;
    if (!fileId) {
      return sendJson(res, 400, { error: 'File ID is required' });
    }

    const file = stmts.getFileById.get(fileId);
    if (!file) {
      return sendJson(res, 404, { error: 'File not found' });
    }

    try {
      const filePath = filesUtil.resolveSafeStoragePath(file.stored_name);
      if (!fs.existsSync(filePath)) {
        return sendJson(res, 404, { error: 'File data missing on storage server' });
      }

      const stat = fs.statSync(filePath);
      console.log(`[FILE DOWNLOAD] User "${session.username}" downloading "${file.original_name}" (${file.size_formatted})`);

      res.statusCode = 200;
      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);

      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
      return true;
    } catch (err) {
      console.error('[DOWNLOAD ERROR]', err);
      return sendJson(res, 400, { error: 'Access denied: ' + err.message });
    }
  }

  // --- Files: Clear All Shared Files ---
  if ((pathname === '/api/files/clear' || pathname === '/api/files/reset') && (method === 'POST' || method === 'DELETE')) {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    try {
      const allFiles = stmts.getAllFiles.all();
      for (const file of allFiles) {
        try {
          const filePath = filesUtil.resolveSafeStoragePath(file.stored_name);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {
          console.warn('[CLEAR FILE WARNING]', e.message);
        }
      }
      stmts.deleteAllFiles ? stmts.deleteAllFiles.run() : stmts.createFile && stmts.getFileById && require('./db').db.exec('DELETE FROM files;');
      console.log(`[FILES CLEARED] User "${session.username}" cleared all shared files.`);
      return sendJson(res, 200, { success: true, count: allFiles.length });
    } catch (err) {
      console.error('[CLEAR FILES ERROR]', err);
      return sendJson(res, 500, { error: 'Failed to clear files: ' + err.message });
    }
  }

  // --- Files: Delete Single File ---
  if (pathname === '/api/files/delete' && (method === 'POST' || method === 'DELETE')) {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    const fileId = parsedUrl.query.id;
    if (!fileId) {
      return sendJson(res, 400, { error: 'File ID is required' });
    }

    const file = stmts.getFileById.get(fileId);
    if (file) {
      try {
        const filePath = filesUtil.resolveSafeStoragePath(file.stored_name);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.warn('[DELETE FILE WARNING]', e.message);
      }
      stmts.deleteFile.run(fileId);
      console.log(`[FILE DELETED] User "${session.username}" deleted file ${file.original_name} (${fileId})`);
    }

    return sendJson(res, 200, { success: true });
  }

  // --- Files: Upload (via Browser HTTP to FTP Storage) ---
  if (pathname === '/api/files/upload' && method === 'POST') {
    const session = getAuthenticatedUser(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Authentication required to upload files.' });
    }

    try {
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        return sendJson(res, 400, { error: 'Invalid content type. Expected multipart/form-data.' });
      }

      const busboy = Busboy({
        headers: req.headers,
        limits: {
          fileSize: config.ftpMaxFileSizeMb * 1024 * 1024,
          files: 1,
        },
      });

      const filePromises = [];
      let uploadResult = null;
      let uploadError = null;

      busboy.on('file', (name, fileStream, info) => {
        const { filename, mimeType } = info;

        // Path traversal and extension validation
        const validation = filesUtil.validateFile(filename);
        if (!validation.valid) {
          uploadError = validation.error;
          fileStream.resume(); // Drain stream
          return;
        }

        // Generate unique stored filename in FTP root
        const fileId = `f_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const safeExt = path.extname(validation.safeName);
        const storedName = `${fileId}${safeExt}`;
        const targetPath = filesUtil.resolveSafeStoragePath(storedName);

        const writeStream = fs.createWriteStream(targetPath);
        let byteCount = 0;
        let limitExceeded = false;

        const filePromise = new Promise((resolve) => {
          fileStream.on('data', chunk => {
            byteCount += chunk.length;
            if (byteCount > config.ftpMaxFileSizeMb * 1024 * 1024) {
              limitExceeded = true;
              uploadError = `File size exceeded limit of ${config.ftpMaxFileSizeMb} MB`;
              writeStream.destroy();
              fileStream.resume();
              if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
              }
            }
          });

          fileStream.on('error', err => {
            uploadError = err.message;
            resolve();
          });

          fileStream.pipe(writeStream);

          writeStream.on('finish', () => {
            try {
              if (!limitExceeded && !uploadError) {
                const formattedSize = filesUtil.formatFileSize(byteCount);
                const category = filesUtil.getFileCategory(validation.safeName);

                stmts.createFile.run(
                  fileId,
                  validation.safeName,
                  storedName,
                  byteCount,
                  formattedSize,
                  mimeType || 'application/octet-stream',
                  category,
                  session.userId,
                  session.username,
                  Date.now()
                );

                uploadResult = {
                  id: fileId,
                  name: validation.safeName,
                  size: formattedSize,
                  type: category,
                  uploaderId: session.userId,
                  uploaderName: session.username,
                  downloadUrl: `/api/files/download?id=${fileId}`,
                };

                console.log(`[FILE UPLOAD] User "${session.username}" uploaded "${validation.safeName}" (${formattedSize}) to FTP storage`);
              }
            } catch (err) {
              console.error('[FILE SAVE ERROR]', err);
              uploadError = err.message;
            }
            resolve();
          });

          writeStream.on('error', err => {
            uploadError = err.message;
            resolve();
          });
        });

        filePromises.push(filePromise);
      });

      busboy.on('error', err => {
        uploadError = err.message;
      });

      busboy.on('finish', async () => {
        await Promise.all(filePromises);
        if (uploadError) {
          return sendJson(res, 400, { error: uploadError });
        }
        if (!uploadResult) {
          return sendJson(res, 400, { error: 'No file uploaded or file was rejected.' });
        }
        return sendJson(res, 201, {
          success: true,
          file: uploadResult,
        });
      });

      req.pipe(busboy);
      return true;

    } catch (err) {
      console.error('[UPLOAD ERROR]', err);
      return sendJson(res, 500, { error: 'Upload failed: ' + err.message });
    }
  }

  return false; // Route not handled, delegate to Next.js
}

module.exports = {
  handleApiRoutes,
};
