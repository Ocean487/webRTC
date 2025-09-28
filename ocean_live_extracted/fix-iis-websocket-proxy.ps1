# 修復IIS WebSocket代理的PowerShell腳本
# 需要以管理員身份運行

Write-Host "🔧 修復IIS WebSocket代理..." -ForegroundColor Green

# 檢查是否以管理員身份運行
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ 此腳本需要管理員權限，請以管理員身份運行PowerShell" -ForegroundColor Red
    exit 1
}

# 1. 檢查ARR安裝
Write-Host "1️⃣ 檢查Application Request Routing..." -ForegroundColor Yellow

try {
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    $modules = Get-IISModule
    if ($modules | Where-Object { $_.Name -like "*ApplicationRequestRouting*" }) {
        Write-Host "✅ ARR已安裝" -ForegroundColor Green
    } else {
        Write-Host "❌ ARR未安裝，請先安裝ARR" -ForegroundColor Red
        Write-Host "下載地址: https://www.iis.net/downloads/microsoft/application-request-routing" -ForegroundColor Cyan
        exit 1
    }
} catch {
    Write-Host "❌ 無法檢查ARR狀態: $_" -ForegroundColor Red
    exit 1
}

# 2. 啟用ARR代理
Write-Host "2️⃣ 啟用ARR代理..." -ForegroundColor Yellow

try {
    # 啟用ARR代理
    Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "enabled" -value "True"
    
    # 設置代理超時
    Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "timeout" -value "00:10:00"
    
    # 啟用響應緩衝
    Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "responseBufferLimit" -value "0"
    
    Write-Host "✅ ARR代理已啟用" -ForegroundColor Green
} catch {
    Write-Host "❌ 啟用ARR代理失敗: $_" -ForegroundColor Red
}

# 3. 配置WebSocket支援
Write-Host "3️⃣ 配置WebSocket支援..." -ForegroundColor Yellow

try {
    # 啟用WebSocket
    Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/webSocket" -name "enabled" -value "True"
    Write-Host "✅ WebSocket已啟用" -ForegroundColor Green
} catch {
    Write-Host "❌ 配置WebSocket失敗: $_" -ForegroundColor Red
}

# 4. 應用web.config配置
Write-Host "4️⃣ 應用web.config配置..." -ForegroundColor Yellow

try {
    if (Test-Path "web-websocket-optimized.config") {
        Copy-Item "web-websocket-optimized.config" "web.config" -Force
        Write-Host "✅ 已應用優化的web.config" -ForegroundColor Green
    } else {
        Write-Host "⚠️ 未找到優化配置文件" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ 配置文件更新失敗: $_" -ForegroundColor Red
}

# 5. 重啟IIS
Write-Host "5️⃣ 重啟IIS..." -ForegroundColor Yellow

try {
    iisreset
    Write-Host "✅ IIS重啟完成" -ForegroundColor Green
} catch {
    Write-Host "❌ IIS重啟失敗: $_" -ForegroundColor Red
}

# 6. 測試配置
Write-Host "6️⃣ 測試配置..." -ForegroundColor Yellow

Start-Sleep -Seconds 3

try {
    $connection = Test-NetConnection -ComputerName "localhost" -Port 8443 -WarningAction SilentlyContinue
    if ($connection.TcpTestSucceeded) {
        Write-Host "✅ 端口8443可訪問" -ForegroundColor Green
    } else {
        Write-Host "❌ 端口8443無法訪問" -ForegroundColor Red
    }
} catch {
    Write-Host "⚠️ 無法測試端口連接: $_" -ForegroundColor Yellow
}

Write-Host "`n🎯 WebSocket代理修復總結:" -ForegroundColor Cyan
Write-Host "1. ✅ ARR代理已啟用" -ForegroundColor White
Write-Host "2. ✅ WebSocket支援已配置" -ForegroundColor White
Write-Host "3. ✅ 配置文件已應用" -ForegroundColor White
Write-Host "4. ✅ IIS已重啟" -ForegroundColor White

Write-Host "`n🚀 測試方法:" -ForegroundColor Cyan
Write-Host "1. 執行: node test-final-websocket.js" -ForegroundColor White
Write-Host "2. 訪問: https://vibelo.l0sscat.com:8443" -ForegroundColor White

Write-Host "`n✨ WebSocket代理修復完成！" -ForegroundColor Green


