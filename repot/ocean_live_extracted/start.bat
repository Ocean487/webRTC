@echo off
chcp 65001 >nul
echo ========================================
echo    WebRTC Live Streaming Platform
echo ========================================
echo.
echo Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js 14.0.0 or higher
    echo Download from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo OK: Node.js is installed
echo.
echo Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo OK: Dependencies installed successfully
echo.
echo Starting live streaming server...
echo.
echo ========================================
echo    Server URLs:
echo ========================================
echo Broadcaster: http://localhost:3000/livestream_platform.html
echo Viewer:      http://localhost:3000/viewer.html
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.
npm start
