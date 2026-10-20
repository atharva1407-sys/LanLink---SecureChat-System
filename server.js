/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http');
const https = require('https');
const fs = require('fs');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const config = require('./server/config');
const auth = require('./server/auth');
const filesUtil = require('./server/files');
const { handleApiRoutes } = require('./server/routes');
const { createFtpServer } = require('./server/ftp');
const { stmts } = require('./server/db');


function getInitials(name) {
  if (!name) return 'U';
  const parts = name.replace(/[-_.]/g, ' ').trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const dev = config.dev;
const hostname = config.host;
const port = config.port;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Start embedded FTPS server
  try {
    const ftpServer = createFtpServer();
    ftpServer.listen().then(() => {
      console.log(`> [FTPS] Server listening on LAN port ${config.ftpPort} (Passive ports ${config.ftpPasvMin}-${config.ftpPasvMax})`);
    }).catch(err => {
      console.error('> [FTPS ERROR] Failed to start FTP server:', err.message);
    });
  } catch (err) {
    console.error('> [FTPS ERROR] Initializing FTP server failed:', err.message);
  }

  // Periodic cleanup of files older than 7 days (every 12 hours)
  setInterval(() => {
    filesUtil.cleanupOldFiles(7);
  }, 12 * 60 * 60 * 1000);

  // Create HTTP or HTTPS server
  const requestListener = async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);

      // Let Socket.IO handle its own requests
      if (parsedUrl.pathname.startsWith('/socket.io/')) {
        return;
      }

      // Handle custom API routes (Auth, Files, etc.)
      const handled = await handleApiRoutes(req, res, io);
      if (handled !== false) {
        return;
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  };

  let server;
  const protocol = config.enableHttps ? 'https' : 'http';

  if (config.enableHttps && fs.existsSync(config.sslCertPath) && fs.existsSync(config.sslKeyPath)) {
    server = https.createServer({
      cert: fs.readFileSync(config.sslCertPath),
      key: fs.readFileSync(config.sslKeyPath),
    }, requestListener);
    console.log('> Transport security: HTTPS/WSS enabled.');
  } else {
    server = http.createServer(requestListener);
    if (config.enableHttps) {
      console.warn('> [WARNING] ENABLE_HTTPS is true but certificates were not found. Defaulting to plain HTTP.');
    }
  }

  const io = new Server(server, {
    maxHttpBufferSize: 1e8, // Allow up to 100 MB payloads
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    }
  });

  // --- Socket.IO Authentication Middleware ---
  // Reject unauthenticated connections. Derive user identity strictly from authenticated session.
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const cookies = auth.parseCookies(cookieHeader);
      const token = cookies.lanlink_session;

      if (!token) {
        console.warn(`[SOCKET REJECTED] Unauthenticated connection attempt from ${socket.handshake.address}`);
        return next(new Error('Authentication required. No session cookie found.'));
      }

      const session = auth.verifyToken(token);
      if (!session || !session.userId) {
        console.warn(`[SOCKET REJECTED] Invalid/expired session from ${socket.handshake.address}`);
        return next(new Error('Invalid or expired session. Please log in again.'));
      }

      if (config.requireRoomPassword && !session.roomVerified) {
        console.warn(`[SOCKET REJECTED] Room password unverified for ${session.username}`);
        return next(new Error('Room password required.'));
      }

      // Attach verified identity to the socket
      socket.user = {
        id: session.userId,
        username: session.username,
      };

      next();
    } catch (err) {
      console.error('[SOCKET AUTH ERROR]', err);
      next(new Error('Authentication failed'));
    }
  });

  let users = {};

  io.on('connection', (socket) => {
    console.log(`[SOCKET CONNECTED] User "${socket.user.username}" (${socket.user.id}) on socket ${socket.id} from ${socket.handshake.address}`);

    users[socket.id] = {
      id: socket.id,
      userId: socket.user.id,
      name: socket.user.username,
      initials: getInitials(socket.user.username),
      ip: socket.handshake.address,
      isOnline: true,
    };

    // Broadcast updated users list
    io.emit('users_update', Object.values(users));

    // Tell the connected user who they are
    socket.emit('current_user', users[socket.id]);

    // Send the server LAN IP addresses to the client
    const serverIps = config.getLocalIPs();
    socket.emit('server_ips', serverIps);

    // Send current active groups to connected client
    try {
      const allGroups = stmts.getAllGroups.all();
      socket.emit('groups_update', allGroups);
    } catch (e) {
      console.warn('Failed to emit groups on connection:', e.message);
    }

    // Direct messaging handler: sender identity derived strictly from authenticated session
    socket.on('send_message', (msg) => {
      // Disallow self-chatting completely
      if (!msg.receiverId || msg.receiverId === socket.id) {
        return;
      }

      const cleanText = msg.text ? auth.sanitizeText(msg.text) : undefined;

      const messageObj = {
        id: `m${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        senderId: socket.id,
        senderName: socket.user.username,
        receiverId: msg.receiverId,
        text: cleanText,
        fileAttachment: msg.fileAttachment,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        isDelivered: true,
      };

      if (users[msg.receiverId]) {
        // Direct message to receiver
        io.to(msg.receiverId).emit('receive_message', messageObj);
      }
      // Send back to sender for their own UI
      socket.emit('receive_message', messageObj);
    });

    // Group chat socket handlers
    socket.on('join_group', (groupId) => {
      if (!groupId) return;
      socket.join(`group:${groupId}`);
      console.log(`[GROUP JOIN] User "${socket.user.username}" joined group room "group:${groupId}"`);
    });

    socket.on('leave_group', (groupId) => {
      if (!groupId) return;
      socket.leave(`group:${groupId}`);
      console.log(`[GROUP LEAVE] User "${socket.user.username}" left group room "group:${groupId}"`);
    });

    socket.on('send_group_message', (msg) => {
      if (!msg || !msg.groupId) return;

      const cleanText = msg.text ? auth.sanitizeText(msg.text) : undefined;
      const messageId = `gm${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      // Save group message to SQLite
      const fileAttachmentStr = msg.fileAttachment ? JSON.stringify(msg.fileAttachment) : null;
      try {
        stmts.createGroupMessage.run(
          messageId,
          msg.groupId,
          socket.user.id,
          socket.user.username,
          cleanText || null,
          fileAttachmentStr,
          timestamp,
          date,
          Date.now()
        );
      } catch (err) {
        console.error('[GROUP MESSAGE DB ERROR]', err);
      }

      const messageObj = {
        id: messageId,
        groupId: msg.groupId,
        senderId: socket.id,
        senderUserId: socket.user.id,
        senderName: socket.user.username,
        text: cleanText,
        fileAttachment: msg.fileAttachment,
        timestamp,
        date,
      };

      // Broadcast to all members of the group room
      io.to(`group:${msg.groupId}`).emit('group_message', messageObj);
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET DISCONNECTED] User "${socket.user.username}" (${socket.id})`);
      delete users[socket.id];
      io.emit('users_update', Object.values(users));
    });
  });

  server
    .once('error', (err) => {
      console.error('Server listen error:', err);
      process.exit(1);
    })
    .listen(port, '0.0.0.0', () => {
      console.log(`> Ready on ${protocol}://localhost:${port} and LAN (0.0.0.0)`);
    });
});
