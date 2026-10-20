const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'lanlink.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode and busy timeout for high concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    key TEXT PRIMARY KEY,
    failed_count INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER DEFAULT 0,
    last_attempt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    size INTEGER NOT NULL,
    size_formatted TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_type TEXT NOT NULL,
    uploader_id TEXT NOT NULL,
    uploader_name TEXT NOT NULL,
    uploaded_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_passwords (
    chat_id TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_chat_passwords (
    user_id TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    plaintext_hint TEXT,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    host_id TEXT NOT NULL,
    host_name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS group_messages (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    text TEXT,
    file_attachment TEXT,
    timestamp TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

// Prepared statements with parameterized queries
const stmts = {
  // Users
  getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE'),
  getUserById: db.prepare('SELECT id, username, created_at FROM users WHERE id = ?'),
  createUser: db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)'),
  getAllUsers: db.prepare('SELECT id, username, created_at FROM users ORDER BY username ASC'),

  // Login Attempts (Rate Limiting)
  getAttempt: db.prepare('SELECT * FROM login_attempts WHERE key = ?'),
  upsertAttempt: db.prepare(`
    INSERT INTO login_attempts (key, failed_count, locked_until, last_attempt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      failed_count = excluded.failed_count,
      locked_until = excluded.locked_until,
      last_attempt = excluded.last_attempt
  `),
  resetAttempt: db.prepare('DELETE FROM login_attempts WHERE key = ?'),
  cleanExpiredAttempts: db.prepare('DELETE FROM login_attempts WHERE locked_until < ? AND last_attempt < ?'),

  // Files
  createFile: db.prepare(`
    INSERT INTO files (id, original_name, stored_name, size, size_formatted, mime_type, file_type, uploader_id, uploader_name, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getFileById: db.prepare('SELECT * FROM files WHERE id = ?'),
  getAllFiles: db.prepare('SELECT * FROM files ORDER BY uploaded_at DESC'),
  deleteFile: db.prepare('DELETE FROM files WHERE id = ?'),

  // Chat Passwords
  getChatPassword: db.prepare('SELECT * FROM chat_passwords WHERE chat_id = ?'),
  setChatPassword: db.prepare(`
    INSERT INTO chat_passwords (chat_id, password_hash, created_by, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET
      password_hash = excluded.password_hash,
      created_by = excluded.created_by,
      created_at = excluded.created_at
  `),
  deleteChatPassword: db.prepare('DELETE FROM chat_passwords WHERE chat_id = ?'),

  // Personal User Chat Access Passwords (Cross-verification)
  getUserChatPassword: db.prepare('SELECT * FROM user_chat_passwords WHERE user_id = ?'),
  setUserChatPassword: db.prepare(`
    INSERT INTO user_chat_passwords (user_id, password_hash, plaintext_hint, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      password_hash = excluded.password_hash,
      plaintext_hint = excluded.plaintext_hint,
      updated_at = excluded.updated_at
  `),

  // Groups
  createGroup: db.prepare('INSERT INTO groups (id, name, password_hash, host_id, host_name, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  getGroupById: db.prepare('SELECT id, name, host_id, host_name, created_at FROM groups WHERE id = ?'),
  getGroupWithSecret: db.prepare('SELECT * FROM groups WHERE id = ?'),
  getAllGroups: db.prepare('SELECT id, name, host_id, host_name, created_at FROM groups ORDER BY created_at DESC'),
  deleteGroup: db.prepare('DELETE FROM groups WHERE id = ?'),

  // Group Messages
  createGroupMessage: db.prepare('INSERT INTO group_messages (id, group_id, sender_id, sender_name, text, file_attachment, timestamp, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  getGroupMessages: db.prepare('SELECT * FROM group_messages WHERE group_id = ? ORDER BY created_at ASC'),
};

module.exports = {
  db,
  stmts,
};
