# Generate self-signed certificates for LAN use with OpenSSL
$certsDir = Join-Path $PSScriptRoot "..\certs"
if (!(Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir | Out-Null
}

$certFile = Join-Path $certsDir "cert.pem"
$keyFile = Join-Path $certsDir "key.pem"

Write-Host "Generating self-signed SSL/TLS certificates for LanLink LAN..." -ForegroundColor Cyan

# Check if openssl is installed
if (Get-Command openssl -ErrorAction SilentlyContinue) {
    openssl req -x509 -newkey rsa:2048 -nodes -keyout $keyFile -out $certFile -days 365 -subj "/CN=lanlink.local/O=LanLink/OU=LAN"
    Write-Host "Generated certificates successfully at $certsDir" -ForegroundColor Green
} elseif (Get-Command mkcert -ErrorAction SilentlyContinue) {
    mkcert -install
    mkcert -key-file $keyFile -cert-file $certFile localhost 127.0.0.1 ::1
    Write-Host "Generated trusted certificates via mkcert at $certsDir" -ForegroundColor Green
} else {
    Write-Host "OpenSSL or mkcert not detected in PATH. Using Node.js fallback or existing certs." -ForegroundColor Yellow
}
