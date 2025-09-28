@echo off
echo 🚀 快速WebSocket修復
echo ==================

echo 停止Node.js進程...
taskkill /f /im node.exe 2>nul

echo 重啟IIS...
iisreset

echo 等待5秒...
timeout /t 5 /nobreak >nul

echo 啟動服務器...
start "VibeLo Server" node server.js

echo 等待3秒...
timeout /t 3 /nobreak >nul

echo 測試連接...
node test-final-websocket.js

echo 完成！
pause


