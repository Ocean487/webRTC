@echo off
chcp 65001 >nul
echo ========================================
echo    WebRTC 直播平台啟動器
echo ========================================
echo.
echo 正在檢查 Node.js 安裝...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 錯誤：未安裝 Node.js！
    echo 請先安裝 Node.js 14.0.0 或以上版本
    echo 下載地址：https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo 成功：Node.js 已安裝
echo.
echo 正在安裝依賴套件...
npm install

if %errorlevel% neq 0 (
    echo 錯誤：安裝依賴失敗
    pause
    exit /b 1
)

echo 成功：依賴套件安裝完成
echo.
echo 正在啟動直播服務器...
echo.
echo ========================================
echo    服務器網址：
echo ========================================
echo 主播端：http://localhost:3000/livestream_platform.html
echo 觀眾端：http://localhost:3000/viewer.html
echo ========================================
echo.
echo 按 Ctrl+C 停止服務器
echo.
npm start
