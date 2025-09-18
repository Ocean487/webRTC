@echo off
echo 生成自簽名SSL證書用於本地HTTPS測試...
echo.
echo 注意：此證書僅供開發測試使用，不適用於生產環境

REM 檢查是否安裝了 OpenSSL
where openssl >nul 2>nul
if %errorlevel% neq 0 (
    echo 錯誤：未找到 OpenSSL
    echo.
    echo 請安裝 OpenSSL 或使用以下方法之一：
    echo 1. 下載 Git for Windows（包含 OpenSSL）
    echo 2. 下載 OpenSSL for Windows
    echo 3. 使用 Windows WSL
    echo.
    echo 或者使用線上工具生成證書後將文件保存為：
    echo - private-key.pem
    echo - certificate.pem
    pause
    exit /b 1
)

echo 生成私鑰...
openssl genrsa -out private-key.pem 2048

echo 生成證書...
openssl req -new -x509 -sha256 -key private-key.pem -out certificate.pem -days 365 -subj "/C=TW/ST=Taiwan/L=Taipei/O=VibeLo/OU=Development/CN=localhost"

echo.
echo ✅ SSL證書生成完成！
echo.
echo 文件已生成：
echo - private-key.pem （私鑰）
echo - certificate.pem （證書）
echo.
echo 現在可以使用以下命令啟動HTTPS服務器：
echo node server-https.js
echo.
echo 然後在手機瀏覽器中訪問：
echo https://你的電腦IP:3000
echo.
echo 注意：由於是自簽名證書，瀏覽器會顯示安全警告，
echo 請點擊「高級」然後「繼續前往」
echo.
pause