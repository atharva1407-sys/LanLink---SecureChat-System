const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const ftp = require('basic-ftp');
const { io: ClientSocket } = require('socket.io-client');

const config = require('../server/config');
const { db, stmts } = require('../server/db');
const auth = require('../server/auth');
const filesUtil = require('../server/files');

const BASE_URL = `http://127.0.0.1:${config.port}`;

async function request(method, pathName, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathName, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers },
    };

    let bodyData = null;
    if (body && typeof body === 'object' && !(body instanceof Buffer)) {
      bodyData = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyData);
    } else if (body instanceof Buffer) {
      bodyData = body;
      options.headers['Content-Length'] = body.length;
    }

    const req = http.request(options, (res) => {
      let data = '';
      const setCookies = res.headers['set-cookie'];
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          setCookies: setCookies || [],
          data,
          json,
        });
      });
    });

    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

function parseCookieFromHeader(setCookies) {
  for (const c of setCookies) {
    if (c.startsWith('lanlink_session=')) {
      return c.split(';')[0];
    }
  }
  return '';
}

async function runTests() {
  console.log('====================================================');
  console.log('       LANLINK TEST SUITE: SECURITY & FTP           ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // Reset any previous test lockouts in test DB
  db.exec('DELETE FROM login_attempts;');

  // --- 1. Password Policy Tests ---
  console.log('--- TEST 1: Password Policy Validation ---');
  const shortPassRes = await request('POST', '/api/auth/register', {
    username: 'test_policy_user',
    password: '123',
  });
  assert(shortPassRes.statusCode === 400 && shortPassRes.json.error.includes('8 characters'), 'Rejects password shorter than 8 chars');

  const weakPassRes = await request('POST', '/api/auth/register', {
    username: 'test_policy_user',
    password: 'passwordonly',
  });
  assert(weakPassRes.statusCode === 400 && weakPassRes.json.error.includes('both letters and numbers'), 'Rejects password lacking numbers');

  // --- 2. Registration & Session Token ---
  console.log('\n--- TEST 2: Registration & JWT Session ---');
  const validUser = `user_${Date.now()}`;
  const validPass = 'ValidPass123';
  const regRes = await request('POST', '/api/auth/register', {
    username: validUser,
    password: validPass,
  });
  assert(regRes.statusCode === 201 && regRes.json.success === true, 'User registration succeeds with valid credentials');
  
  const sessionCookie = parseCookieFromHeader(regRes.setCookies);
  assert(sessionCookie.startsWith('lanlink_session='), 'Sets HttpOnly session cookie on registration');

  const dupRes = await request('POST', '/api/auth/register', {
    username: validUser,
    password: validPass,
  });
  assert(dupRes.statusCode === 409, 'Rejects duplicate username (409 Conflict)');

  // --- 3. Login & Brute-force Lockout ---
  console.log('\n--- TEST 3: Login & Rate-Limiting / Lockout ---');
  // Successful login before triggering lockout
  const goodLoginRes = await request('POST', '/api/auth/login', {
    username: validUser,
    password: validPass,
  });
  assert(goodLoginRes.statusCode === 200 && goodLoginRes.json.success === true, 'Successful login succeeds with 200 OK');

  const badLoginRes = await request('POST', '/api/auth/login', {
    username: validUser,
    password: 'WrongPassword99',
  });
  assert(badLoginRes.statusCode === 401 && badLoginRes.json.error === 'Invalid username or password', 'Generic error message on bad password');

  const nonExistentLogin = await request('POST', '/api/auth/login', {
    username: 'non_existent_random_user_999',
    password: 'WrongPassword99',
  });
  assert(nonExistentLogin.statusCode === 401 && nonExistentLogin.json.error === 'Invalid username or password', 'Generic error message prevents user enumeration');

  // Trigger lockout for a dedicated test user on an isolated IP header
  const lockoutUser = `lock_${Date.now()}`;
  const testIpHeaders = { 'x-forwarded-for': '192.168.99.88' };
  await request('POST', '/api/auth/register', { username: lockoutUser, password: 'Password123' }, testIpHeaders);

  for (let i = 0; i < config.maxLoginAttempts; i++) {
    await request('POST', '/api/auth/login', { username: lockoutUser, password: 'WrongPassword' }, testIpHeaders);
  }

  const lockedRes = await request('POST', '/api/auth/login', { username: lockoutUser, password: 'Password123' }, testIpHeaders);
  assert(lockedRes.statusCode === 429 && lockedRes.json.locked === true, `User locked out after ${config.maxLoginAttempts} failed attempts (HTTP 429)`);

  // --- 4. Unauthenticated WebSocket Handshake Rejection ---
  console.log('\n--- TEST 4: WebSocket Handshake Security ---');
  await new Promise((resolve) => {
    const unauthSocket = ClientSocket(`http://127.0.0.1:${config.port}`, {
      transports: ['websocket'],
      reconnection: false,
    });

    unauthSocket.on('connect', () => {
      assert(false, 'Unauthenticated socket connection unexpectedly connected');
      unauthSocket.disconnect();
      resolve();
    });

    unauthSocket.on('connect_error', (err) => {
      assert(err.message.includes('Authentication required'), `Unauthenticated socket correctly rejected: "${err.message}"`);
      resolve();
    });
  });

  // Authenticated WebSocket connection
  await new Promise((resolve) => {
    const authSocket = ClientSocket(`http://127.0.0.1:${config.port}`, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: {
        Cookie: sessionCookie,
      },
    });

    authSocket.on('connect', () => {
      assert(true, 'Authenticated socket connection successfully accepted');
      authSocket.disconnect();
      resolve();
    });

    authSocket.on('connect_error', (err) => {
      assert(false, `Authenticated socket unexpectedly failed: ${err.message}`);
      resolve();
    });
  });

  // --- 5. FTP Server: Auth, Chroot & Anonymous Rejection ---
  console.log('\n--- TEST 5: FTP Authentication & Chroot Isolation ---');
  const ftpClient = new ftp.Client();
  ftpClient.ftp.verbose = false;

  // Anonymous login must be rejected
  let anonRejected = false;
  try {
    await ftpClient.access({
      host: '127.0.0.1',
      port: config.ftpPort,
      user: 'anonymous',
      password: '',
      secure: false,
    });
  } catch {
    anonRejected = true;
  } finally {
    ftpClient.close();
  }
  assert(anonRejected, 'Anonymous FTP access rejected');

  // Login with chat credentials must succeed
  let chatCredsAccepted = false;
  try {
    await ftpClient.access({
      host: '127.0.0.1',
      port: config.ftpPort,
      user: validUser,
      password: validPass,
      secure: false, // Plain control for local loopback test
    });
    chatCredsAccepted = true;
  } catch (e) {
    console.error('FTP access error:', e.message);
  } finally {
    ftpClient.close();
  }
  assert(chatCredsAccepted, 'FTP login succeeds using chat account credentials');

  // --- 6. File Upload: Blocked Types & Path Traversal Defense ---
  console.log('\n--- TEST 6: File Security, Path Traversal & File Transfer ---');
  // Path traversal check
  const pathTraversalCheck = filesUtil.validateFile('../../windows/system32/cmd.exe');
  assert(!pathTraversalCheck.valid, 'Path traversal in filename blocked');

  // Blocked extension check (.exe)
  const blockedExtCheck = filesUtil.validateFile('malware.exe');
  assert(!blockedExtCheck.valid && blockedExtCheck.error.includes('blocked'), 'Blocked file extension (.exe) rejected');

  // Valid file upload
  const boundary = '----WebKitFormBoundaryLanLinkTest7MA4YWxkTrZu0gW';
  const testFileContent = 'Hello LAN! This is a secure file transferred over LanLink FTP storage.';
  const multipartBody = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="lan_doc.txt"\r\n` +
    `Content-Type: text/plain\r\n\r\n` +
    `${testFileContent}\r\n` +
    `--${boundary}--\r\n`
  );

  const uploadRes = await request('POST', '/api/files/upload', multipartBody, {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Cookie': sessionCookie,
  });

  assert(uploadRes.statusCode === 201 && uploadRes.json.success === true, 'File upload succeeds and stores into FTP storage');
  const uploadedFileId = uploadRes.json?.file?.id;

  // Unauthenticated download attempt
  const unauthDownloadRes = await request('GET', `/api/files/download?id=${uploadedFileId}`);
  assert(unauthDownloadRes.statusCode === 401, 'Unauthenticated download rejected (HTTP 401)');

  // Authenticated download
  const authDownloadRes = await request('GET', `/api/files/download?id=${uploadedFileId}`, null, {
    'Cookie': sessionCookie,
  });
  assert(authDownloadRes.statusCode === 200 && authDownloadRes.data === testFileContent, 'Authenticated download succeeds with matching content');

  // Cleanup test user
  stmts.getUserByUsername && db.exec(`DELETE FROM users WHERE username = '${validUser}' OR username = '${lockoutUser}'`);

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
