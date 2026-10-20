const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { stmts } = require('./db');

// --- Input Validation ---
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain both letters and numbers' };
  }
  return { valid: true };
}

function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 20) {
    return { valid: false, error: 'Username must be between 3 and 20 characters' };
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, hyphens, and underscores' };
  }
  return { valid: true, username: trimmed };
}

// --- Password Hashing ---
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// --- Brute Force & Rate Limiting ---
function checkLockout(ip, username) {
  const now = Date.now();
  const keys = [`ip:${ip}`];
  if (username) keys.push(`user:${username.toLowerCase()}`);

  for (const key of keys) {
    const attempt = stmts.getAttempt.get(key);
    if (attempt && attempt.locked_until > now) {
      const remainingMinutes = Math.ceil((attempt.locked_until - now) / 60000);
      return {
        locked: true,
        remainingMinutes: remainingMinutes || 1,
      };
    }
  }

  return { locked: false };
}

function recordFailedLogin(ip, username) {
  const now = Date.now();
  const keys = [`ip:${ip}`];
  if (username) keys.push(`user:${username.toLowerCase()}`);

  for (const key of keys) {
    const attempt = stmts.getAttempt.get(key);
    const count = (attempt ? attempt.failed_count : 0) + 1;
    let lockedUntil = 0;

    if (count >= config.maxLoginAttempts) {
      lockedUntil = now + config.lockoutTimeMinutes * 60 * 1000;
      console.warn(`[SECURITY LOCKOUT] ${key} exceeded maximum login attempts (${count}). Locked out for ${config.lockoutTimeMinutes} minutes.`);
    }

    stmts.upsertAttempt.run(key, count, lockedUntil, now);
  }
}

function recordSuccessfulLogin(ip, username) {
  if (ip) stmts.resetAttempt.run(`ip:${ip}`);
  if (username) stmts.resetAttempt.run(`user:${username.toLowerCase()}`);
}

// --- Room Password Check ---
function verifyRoomPassword(roomPassword) {
  if (!config.requireRoomPassword) {
    return true;
  }
  return roomPassword === config.chatRoomPassword;
}

// --- JWT & Session Cookie Management ---
function generateToken(user, roomVerified = false) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      roomVerified: !config.requireRoomPassword || roomVerified,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiry }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift().trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });

  return list;
}

function getSessionCookie(token) {
  const maxAgeSeconds = 24 * 60 * 60; // 24 hours
  const secure = config.enableHttps ? '; Secure' : '';
  return `lanlink_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}

function getClearSessionCookie() {
  return `lanlink_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// --- Input Safety / XSS Sanitization ---
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

module.exports = {
  validatePassword,
  validateUsername,
  hashPassword,
  verifyPassword,
  checkLockout,
  recordFailedLogin,
  recordSuccessfulLogin,
  verifyRoomPassword,
  generateToken,
  verifyToken,
  parseCookies,
  getSessionCookie,
  getClearSessionCookie,
  sanitizeText,
};
