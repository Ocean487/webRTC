# 修復IIS WebSocket支援的PowerShell腳本
# 需要以管理員身份運行

Write-Host "🔧 修復IIS WebSocket支援..." -ForegroundColor Green

# 檢查是否以管理員身份運行
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ 此腳本需要管理員權限，請以管理員身份運行PowerShell" -ForegroundColor Red
    exit 1
}

# 1. 安裝WebSocket Protocol功能
Write-Host "1️⃣ 檢查並安裝IIS WebSocket Protocol功能..." -ForegroundColor Yellow

try {
    $webSocketFeature = Get-WindowsOptionalFeature -Online -FeatureName "IIS-WebSockets"
    
    if ($webSocketFeature.State -eq "Enabled") {
        Write-Host "✅ WebSocket Protocol已安裝" -ForegroundColor Green
    } else {
        Write-Host "📦 正在安裝WebSocket Protocol..." -ForegroundColor Yellow
        Enable-WindowsOptionalFeature -Online -FeatureName "IIS-WebSockets" -All -NoRestart
        Write-Host "✅ WebSocket Protocol安裝完成" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ 安裝WebSocket Protocol失敗: $_" -ForegroundColor Red
}

# 2. 檢查Application Request Routing
Write-Host "2️⃣ 檢查Application Request Routing..." -ForegroundColor Yellow

$arrInstalled = $false
try {
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    $modules = Get-IISModule
    if ($modules | Where-Object { $_.Name -like "*ApplicationRequestRouting*" }) {
        Write-Host "✅ Application Request Routing已安裝" -ForegroundColor Green
        $arrInstalled = $true
    } else {
        Write-Host "⚠️ Application Request Routing未安裝" -ForegroundColor Yellow
        Write-Host "請從以下網址下載並安裝ARR:" -ForegroundColor Yellow
        Write-Host "https://www.iis.net/downloads/microsoft/application-request-routing" -ForegroundColor Cyan
    }
} catch {
    Write-Host "⚠️ 無法檢查ARR狀態: $_" -ForegroundColor Yellow
}

# 3. 啟用ARR代理功能
if ($arrInstalled) {
    Write-Host "3️⃣ 啟用ARR代理功能..." -ForegroundColor Yellow
    
    try {
        # 啟用ARR代理
        Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "enabled" -value "True"
        Write-Host "✅ ARR代理已啟用" -ForegroundColor Green
    } catch {
        Write-Host "❌ 啟用ARR代理失敗: $_" -ForegroundColor Red
    }
}

# 4. 配置WebSocket支援
Write-Host "4️⃣ 配置WebSocket支援..." -ForegroundColor Yellow

try {
    # 在應用程式級別啟用WebSocket
    $appPath = "C:\Users\s3734\Desktop\ocean\webRTC\ocean_live_extracted"
    if (Test-Path $appPath) {
        # 為應用程式啟用WebSocket
        Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -location 'Default Web Site' -filter "system.webServer/webSocket" -name "enabled" -value "True"
        Write-Host "✅ WebSocket已在網站級別啟用" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ 配置WebSocket失敗: $_" -ForegroundColor Red
}

# 5. 重啟IIS
Write-Host "5️⃣ 重啟IIS..." -ForegroundColor Yellow

try {
    iisreset
    Write-Host "✅ IIS重啟完成" -ForegroundColor Green
} catch {
    Write-Host "❌ IIS重啟失敗: $_" -ForegroundColor Red
}

# 6. 測試WebSocket連接
Write-Host "6️⃣ 測試WebSocket連接..." -ForegroundColor Yellow

Start-Sleep -Seconds 3

# 檢查端口8443是否開放
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

Write-Host "`n🎯 修復總結:" -ForegroundColor Cyan
Write-Host "1. 確保WebSocket Protocol已安裝" -ForegroundColor White
Write-Host "2. 確保Application Request Routing已安裝並啟用" -ForegroundColor White
Write-Host "3. 已啟用WebSocket支援" -ForegroundColor White
Write-Host "4. 已重啟IIS" -ForegroundColor White

Write-Host "`n🚀 下一步:" -ForegroundColor Cyan
Write-Host "1. 檢查web.config是否正確配置WebSocket重寫規則" -ForegroundColor White
Write-Host "2. 測試 wss://vibelo.l0sscat.com:8443/ 連接" -ForegroundColor White

Write-Host "`n✨ 修復完成！請測試WebSocket連接。" -ForegroundColor Green


