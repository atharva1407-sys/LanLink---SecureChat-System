const FtpSrv = require('ftp-srv');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { stmts } = require('./db');
const auth = require('./auth');

// Ensure FTP storage directory exists
if (!fs.existsSync(config.ftpStorageDir)) {
  fs.mkdirSync(config.ftpStorageDir, { recursive: true });
}

function getLanIp() {
  const ips = config.getLocalIPs();
  return ips.length > 0 ? ips[0] : '127.0.0.1';
}

function createFtpServer() {
  let tlsConfig = false;

  if (config.ftpEnableTls) {
    if (fs.existsSync(config.sslCertPath) && fs.existsSync(config.sslKeyPath)) {
      try {
        tlsConfig = {
          cert: fs.readFileSync(config.sslCertPath),
          key: fs.readFileSync(config.sslKeyPath),
        };
        console.log('[FTP] FTPS (Explicit TLS) enabled using certificates.');
      } catch (err) {
        console.error('[FTP ERROR] Failed to load SSL certificates for FTPS:', err.message);
      }
    } else {
      console.warn('[FTP WARNING] SSL certificates not found at specified paths. Falling back to plain FTP.');
    }
  } else {
    console.warn('[FTP SECURITY WARNING] Plain unencrypted FTP is explicitly enabled in config! Credentials will be sent in cleartext.');
  }

  const lanIp = getLanIp();
  const ftpServer = new FtpSrv({
    url: `ftp://0.0.0.0:${config.ftpPort}`,
    pasv_url: lanIp,
    pasv_min: config.ftpPasvMin,
    pasv_max: config.ftpPasvMax,
    anonymous: false, // Strict: no anonymous access allowed
    tls: tlsConfig,
  });

  // FTP Authentication Hook
  ftpServer.on('login', ({ connection, username, password }, resolve, reject) => {
    const clientIp = connection.ip || 'unknown';

    // Disallow anonymous
    if (!username || username.toLowerCase() === 'anonymous') {
      console.warn(`[FTP AUTH FAILED] Anonymous access attempted and rejected from ${clientIp}`);
      return reject(new Error('Anonymous access is strictly disabled. Authentication required.'));
    }

    // Check brute-force lockout for this IP and username
    const lockout = auth.checkLockout(clientIp, username);
    if (lockout.locked) {
      console.warn(`[FTP AUTH BLOCKED] Locked out login attempt for user "${username}" from ${clientIp}`);
      return reject(new Error(`Account temporarily locked due to failed attempts. Try again in ${lockout.remainingMinutes} min.`));
    }

    // Lookup user in SQLite database
    const user = stmts.getUserByUsername.get(username);
    if (!user || !auth.verifyPassword(password || '', user.password_hash)) {
      auth.recordFailedLogin(clientIp, username);
      console.warn(`[FTP AUTH FAILED] Invalid credentials for user "${username}" from ${clientIp}`);
      return reject(new Error('Invalid username or password'));
    }

    // Successful authentication
    auth.recordSuccessfulLogin(clientIp, user.username);
    console.log(`[FTP AUTH SUCCESS] User "${user.username}" authenticated on FTP from ${clientIp}`);

    // Return chroot filesystem strictly pointing to config.ftpStorageDir
    resolve({
      root: config.ftpStorageDir,
    });
  });

  ftpServer.on('client-error', ({ connection, context, error }) => {
    console.warn(`[FTP CLIENT ERROR] ${context || 'connection'}:`, error ? error.message : 'Unknown error');
  });

  return ftpServer;
}

module.exports = {
  createFtpServer,
  getLanIp,
};
