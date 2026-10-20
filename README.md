# LanLink: Secure LAN Chat & FTPS File Transfer System

LanLink is an enterprise-grade, real-time local network communication and file transfer platform built with Next.js, Socket.IO, embedded SQLite (`node:sqlite`), and an embedded FTPS (`ftp-srv`) file storage system.

---

## Key Features

1. **Password-Based Security**:
   - User registration and login with bcrypt password hashing (`bcryptjs`, 10 rounds).
   - Strict password complexity policy (minimum 8 characters, alphanumeric enforcement).
   - Tamper-proof session management using signed JSON Web Tokens (JWT) stored in `HttpOnly`, `SameSite=Strict` cookies.
   - Dynamic brute-force defense: automatic IP and account rate-limiting with temporary lockout (5 failed attempts = 15-minute lockout) and generic responses to prevent username enumeration.
   - Optional LAN Room Password required to join chat (configured via `REQUIRE_ROOM_PASSWORD`).
   - Handshake authorization: Socket.IO handshake strictly rejects unauthenticated connections and derives sender identity entirely from session tokens.
   - Input sanitization defending against Cross-Site Scripting (XSS).
   - Parameterized SQL queries using Node.js built-in `node:sqlite`.

2. **LAN File Transfer via Embedded FTPS**:
   - Embedded FTPS server running on port `2121` (configurable) with passive mode data ports (`50000-50100`).
   - User accounts shared between Chat and FTP: users authenticate to FTPS with their LanLink credentials. Anonymous access is strictly rejected.
   - Chrooted file isolation: each session is locked to `./ftp_storage/` with strict path traversal defenses.
   - Dual-mode client access:
     - **Web UI Chat Integration**: Upload files directly via paperclip attachment or the File Transfers panel; metadata is posted in real time with an authorized download button.
     - **Dedicated FTP Clients**: Connect via FileZilla, Cyberduck, or `lftp` over the LAN on port 2121 using FTPS.
   - Configurable file size limits (default 50 MB) and blocked dangerous extension list (`.exe`, `.bat`, etc.).
   - Automatic 7-day file lifecycle cleanup.

---

## Network Architecture & Configuration

```
 +-------------------------------------------------------------------+
 |                        LAN / Wi-Fi Network                        |
 +-------------------------------------------------------------------+
          |                                            |
 [Web Browser Clients]                        [Native FTP Clients]
 (Desktop / Mobile Phones)                    (FileZilla / WinSCP)
          |                                            |
          | HTTP(S) :3000                              | FTPS Control :2121
          | WSS / Socket.IO :3000                      | Passive Data :50000-50100
          v                                            v
 +-------------------------------------------------------------------+
 |                     LanLink Host Server                           |
 |                                                                   |
 |  [Next.js + Socket.IO Server] <-----> [Embedded FTPS Server]      |
 |               |                                     |             |
 |               v                                     v             |
 |     [SQLite (node:sqlite)]                 [./ftp_storage/]       |
 +-------------------------------------------------------------------+
```

### Environment Configuration (.env)

Copy `.env.example` to `.env`:

```env
PORT=3000
NODE_ENV=development
ENABLE_HTTPS=false
SSL_CERT_PATH=certs/cert.pem
SSL_KEY_PATH=certs/key.pem

JWT_SECRET=change_this_to_a_secure_random_string_in_production_min32chars
JWT_EXPIRY=24h

REQUIRE_ROOM_PASSWORD=false
CHAT_ROOM_PASSWORD=LanSecret2026

MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME_MINUTES=15

FTP_PORT=2121
FTP_PASV_MIN=50000
FTP_PASV_MAX=50100
FTP_STORAGE_DIR=./ftp_storage
FTP_ENABLE_TLS=true
FTP_MAX_FILE_SIZE_MB=50
FTP_BLOCKED_EXTENSIONS=.exe,.bat,.cmd,.sh,.vbs,.ps1
```

---

## Setup and Run Instructions

### 1. Find Your LAN IP Address
- **Windows**: Run `ipconfig` in PowerShell/CMD. Look for `IPv4 Address` under your active Wi-Fi or Ethernet adapter (e.g., `192.168.1.50`).
- **Linux/macOS**: Run `ip a` or `ifconfig`.

### 2. Configure LAN Firewall Rules
Ensure other devices on the LAN can communicate with your server:

#### Windows (Run PowerShell as Administrator):
```powershell
# Allow Web and Socket.IO (Port 3000)
New-NetFirewallRule -DisplayName "LanLink Web (3000)" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow

# Allow FTPS Control (Port 2121)
New-NetFirewallRule -DisplayName "LanLink FTP Control (2121)" -Direction Inbound -LocalPort 2121 -Protocol TCP -Action Allow

# Allow FTPS Passive Data Ports (50000-50100)
New-NetFirewallRule -DisplayName "LanLink FTP Passive (50000-50100)" -Direction Inbound -LocalPort 50000-50100 -Protocol TCP -Action Allow
```

#### Linux (ufw):
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 2121/tcp
sudo ufw allow 50000:50100/tcp
```

### 3. Generate TLS / SSL Certificates (Optional for HTTPS/FTPS)
Pre-generated certificates are provided in `./certs`. To generate fresh self-signed certificates:
```powershell
# Using PowerShell OpenSSL:
openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/key.pem -out certs/cert.pem -days 365 -subj "/CN=lanlink.local"

# Or run the included script:
powershell -ExecutionPolicy Bypass -File scripts/generate-certs.ps1
```

### 4. Start the Server
```bash
npm install
npm run dev
# Or on Windows: start.bat
```

Users on the same Wi-Fi or local network open their browser and visit:
```
http://<host-LAN-IP>:3000
```

---

## Testing & Verification

Run the automated integration test suite:
```bash
node scripts/test-lanlink.js
```

The test runner verifies:
1. Registration & password complexity policy (minimum 8 chars, alphanumeric check).
2. Login success and generic error handling on failure (prevents account enumeration).
3. Temporary lockout after 5 consecutive failed login attempts (HTTP 429).
4. Unauthenticated Socket.IO connections rejected at handshake.
5. Authenticated Socket.IO connections accepted with session identity derived from token.
6. FTP anonymous access rejected.
7. FTP login succeeds using chat credentials.
8. Path traversal attacks blocked.
9. Blocked dangerous file types (`.exe`) rejected.
10. Valid file upload via chat and authorized downloads.
