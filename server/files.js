const fs = require('fs');
const path = require('path');
const config = require('./config');
const { stmts } = require('./db');

function getFileCategory(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (['.pdf'].includes(ext)) return 'pdf';
  if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'].includes(ext)) return 'image';
  if (['.js', '.ts', '.tsx', '.jsx', '.json', '.html', '.css', '.py', '.c', '.cpp', '.java', '.rs', '.go', '.sh', '.md'].includes(ext)) return 'code';
  if (['.zip', '.tar', '.gz', '.7z', '.rar'].includes(ext)) return 'zip';
  return 'other';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(filename, size = 0) {
  if (!filename || typeof filename !== 'string') {
    return { valid: false, error: 'Invalid filename' };
  }

  // Guard against path traversal
  const safeName = path.basename(filename);
  if (safeName !== filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: 'Path traversal detected in filename' };
  }

  // Check blocked extension list
  const ext = path.extname(safeName).toLowerCase();
  if (config.ftpBlockedExtensions.includes(ext)) {
    return { valid: false, error: `File type '${ext}' is blocked for LAN security policies.` };
  }

  // Check file size limit
  const maxBytes = config.ftpMaxFileSizeMb * 1024 * 1024;
  if (size > maxBytes) {
    return { valid: false, error: `File size exceeds the limit of ${config.ftpMaxFileSizeMb} MB.` };
  }

  return { valid: true, safeName };
}

function resolveSafeStoragePath(storedName) {
  const safeName = path.basename(storedName);
  const targetPath = path.resolve(config.ftpStorageDir, safeName);
  const normalizedStorage = path.resolve(config.ftpStorageDir);

  if (!targetPath.startsWith(normalizedStorage)) {
    throw new Error('Path traversal attempt detected');
  }

  return targetPath;
}

function cleanupOldFiles(maxAgeDays = 7) {
  try {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const allFiles = stmts.getAllFiles.all();

    let removed = 0;
    for (const file of allFiles) {
      if (file.uploaded_at < cutoff) {
        try {
          const filePath = resolveSafeStoragePath(file.stored_name);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          stmts.deleteFile.run(file.id);
          removed++;
        } catch (e) {
          console.warn('[CLEANUP WARNING] Failed to delete file:', file.stored_name, e.message);
        }
      }
    }
    if (removed > 0) {
      console.log(`[CLEANUP] Purged ${removed} expired shared files older than ${maxAgeDays} days.`);
    }
  } catch (err) {
    console.error('[CLEANUP ERROR]', err);
  }
}

module.exports = {
  getFileCategory,
  formatFileSize,
  validateFile,
  resolveSafeStoragePath,
  cleanupOldFiles,
};
