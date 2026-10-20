const path = require('path');
const os = require('os');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: '0.0.0.0',
  dev: process.env.NODE_ENV !== 'production',
  
  // HTTPS / WSS
  enableHttps: process.env.ENABLE_HTTPS === 'true',
  sslCertPath: path.resolve(process.cwd(), process.env.SSL_CERT_PATH || 'certs/cert.pem'),
  sslKeyPath: path.resolve(process.cwd(), process.env.SSL_KEY_PATH || 'certs/key.pem'),
  
  // JWT & Session
  jwtSecret: process.env.JWT_SECRET || 'lanlink_fallback_dev_secret_key_32chars',
  jwtExpiry: process.env.JWT_EXPIRY || '24h',
  
  // Room Password
  requireRoomPassword: process.env.REQUIRE_ROOM_PASSWORD === 'true',
  chatRoomPassword: process.env.CHAT_ROOM_PASSWORD || '',
  
  // Rate Limiting & Lockout
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
  lockoutTimeMinutes: parseInt(process.env.LOCKOUT_TIME_MINUTES || '15', 10),
  
  // FTP / FTPS
  ftpPort: parseInt(process.env.FTP_PORT || '2121', 10),
  ftpPasvMin: parseInt(process.env.FTP_PASV_MIN || '50000', 10),
  ftpPasvMax: parseInt(process.env.FTP_PASV_MAX || '50100', 10),
  ftpStorageDir: path.resolve(process.cwd(), process.env.FTP_STORAGE_DIR || './ftp_storage'),
  ftpEnableTls: process.env.FTP_ENABLE_TLS !== 'false', // Default to true (FTPS)
  ftpMaxFileSizeMb: parseInt(process.env.FTP_MAX_FILE_SIZE_MB || '50', 10),
  ftpBlockedExtensions: (process.env.FTP_BLOCKED_EXTENSIONS || '.exe,.bat,.cmd,.sh,.vbs,.ps1')
    .split(',')
    .map(ext => ext.trim().toLowerCase())
    .filter(Boolean),
    
  getLocalIPs,
};

module.exports = config;
