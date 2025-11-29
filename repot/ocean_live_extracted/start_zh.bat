@echo off
chcp 65001 >nul
title VibeLo Live Stream Server

echo ========================================
echo    VibeLo WebRTC Live Stream Server
echo ========================================
echo.

echo Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not installed!
    echo Please install Node.js 14.0.0 or higher
    echo Download: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo SUCCESS: Node.js is installed
node --version

echo.
echo Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo SUCCESS: Dependencies installed
) else (
    echo Dependencies already exist
)

echo.
echo Checking port 3000...
netstat -an | findstr ":3000" >nul
if %errorlevel% equ 0 (
    echo WARNING: Port 3000 is in use
    echo Stopping existing Node.js processes...
    taskkill /F /IM node.exe >nul 2>&1
    timeout /t 2 /nobreak >nul
)

echo.
echo Starting live stream server...
echo.
echo ========================================
echo    Server URLs
echo ========================================
echo Broadcaster: https://localhost:3000/livestream_platform.html
echo Viewer: https://localhost:3000/viewer.html
echo External: https://vibelo.l0sscat.com:8443
echo Test Accounts: https://localhost:3000/test-accounts.html
echo ========================================
echo.
echo Press Ctrl+C to stop server
echo Server starting...
echo.

node server.js

echo.
echo ========================================
echo Server stopped
echo ========================================
echo If you see this message, the server has shut down normally
echo If the server stopped unexpectedly, please check error messages
echo.
pause
