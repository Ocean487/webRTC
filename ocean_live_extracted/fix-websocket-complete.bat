@echo off
echo 🔧 完整WebSocket修復腳本
echo ========================

echo 1️⃣ 停止Node.js進程...
taskkill /f /im node.exe 2>nul
if %errorlevel% equ 0 (
    echo ✅ Node.js進程已停止
) else (
    echo ⚠️ 沒有找到Node.js進程
)

echo.
echo 2️⃣ 重啟IIS...
iisreset
if %errorlevel% equ 0 (
    echo ✅ IIS重啟完成
) else (
    echo ❌ IIS重啟失敗
)

echo.
echo 3️⃣ 等待服務啟動...
timeout /t 5 /nobreak >nul

echo.
echo 4️⃣ 啟動Node.js服務器...
start "VibeLo Server" node server.js

echo.
echo 5️⃣ 等待服務器啟動...
timeout /t 3 /nobreak >nul

echo.
echo 6️⃣ 測試WebSocket連接...
node test-final-websocket.js

echo.
echo ✨ 修復完成！
pause


