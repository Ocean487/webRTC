@echo off
echo 🧪 WebSocket連接測試
echo ==================

echo 測試本地WebSocket連接...
node test-final-websocket.js

echo.
echo 測試502錯誤修復...
node test-502-fix.js

echo.
echo 測試完成！
pause


