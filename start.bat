@echo off
title LanLink - Secure LAN Chat and FTPS Server
cd /d "%~dp0"

echo ========================================================
echo                 Starting LanLink Server                 
echo ========================================================
echo.

:: 1. Ensure dependencies are installed
if not exist "node_modules\" (
    echo [INFO] First-time setup: installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

:: 2. Ensure .env exists
if not exist ".env" (
    echo [INFO] Creating .env from .env.example...
    copy ".env.example" ".env" >nul
)

:: 3. Launch the server
echo [INFO] Launching server with Node.js and embedded FTPS...
echo [INFO] Web URL:   http://localhost:3000 (or http://^<LAN-IP^>:3000)
echo [INFO] FTPS Port: 2121
echo.
npm run dev
pause
