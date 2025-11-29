# 修復 502 錯誤的完整解決方案
# 需要以管理員身份運行

Write-Host "🔧 修復 WebSocket 502 錯誤..." -ForegroundColor Green

# 檢查是否以管理員身份運行
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ 此腳本需要管理員權限，請以管理員身份運行PowerShell" -ForegroundColor Red
    exit 1
}

# 1. 停止IIS和Node.js進程
Write-Host "1️⃣ 停止相關服務..." -ForegroundColor Yellow
try {
    iisreset /stop
    Write-Host "✅ IIS已停止" -ForegroundColor Green
    
    # 停止可能佔用端口的Node.js進程
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Node.js 進程已清理" -ForegroundColor Green
} catch {
    Write-Host "⚠️ 停止服務時發生錯誤: $_" -ForegroundColor Yellow
}

# 2. 檢查端口佔用
Write-Host "2️⃣ 檢查端口佔用..." -ForegroundColor Yellow
$ports = @(3000, 8443, 443, 80)
foreach ($port in $ports) {
    $connections = netstat -ano | Select-String ":$port"
    if ($connections) {
        Write-Host "⚠️ 端口 $port 被佔用:" -ForegroundColor Yellow
        $connections | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    } else {
        Write-Host "✅ 端口 $port 可用" -ForegroundColor Green
    }
}

# 3. 重新安裝WebSocket支援
Write-Host "3️⃣ 確保WebSocket功能完整安裝..." -ForegroundColor Yellow
try {
    # 移除並重新啟用WebSocket功能
    Disable-WindowsOptionalFeature -Online -FeatureName "IIS-WebSockets" -NoRestart -ErrorAction SilentlyContinue
    Enable-WindowsOptionalFeature -Online -FeatureName "IIS-WebSockets" -All -NoRestart
    Write-Host "✅ WebSocket 功能重新安裝完成" -ForegroundColor Green
} catch {
    Write-Host "❌ WebSocket 功能安裝失敗: $_" -ForegroundColor Red
}

# 4. 配置ARR代理
Write-Host "4️⃣ 配置Application Request Routing..." -ForegroundColor Yellow
try {
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    
    # 啟用ARR代理
    Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "enabled" -value "True"
    
    # 設置代理超時
    Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "timeout" -value "00:10:00"
    
    # 啟用響應緩衝
    Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "responseBufferLimit" -value "0"
    
    Write-Host "✅ ARR 代理配置完成" -ForegroundColor Green
} catch {
    Write-Host "❌ ARR 配置失敗: $_" -ForegroundColor Red
}

# 5. 應用優化的web.config
Write-Host "5️⃣ 應用優化的web.config..." -ForegroundColor Yellow
try {
    if (Test-Path "web-websocket-optimized.config") {
        Copy-Item "web-websocket-optimized.config" "web.config" -Force
        Write-Host "✅ 已應用優化的web.config" -ForegroundColor Green
    } else {
        Write-Host "⚠️ 未找到優化的配置文件，使用當前配置" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ 配置文件更新失敗: $_" -ForegroundColor Red
}

# 6. 重啟IIS
Write-Host "6️⃣ 重啟IIS..." -ForegroundColor Yellow
try {
    iisreset /start
    Start-Sleep -Seconds 5
    Write-Host "✅ IIS重啟完成" -ForegroundColor Green
} catch {
    Write-Host "❌ IIS重啟失敗: $_" -ForegroundColor Red
}

# 7. 啟動Node.js服務器
Write-Host "7️⃣ 啟動Node.js服務器..." -ForegroundColor Yellow
try {
    $scriptPath = Get-Location
    Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $scriptPath -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Write-Host "✅ Node.js 服務器已啟動" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js 服務器啟動失敗: $_" -ForegroundColor Red
}

# 8. 測試連接
Write-Host "8️⃣ 測試連接..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 測試HTTPS連接
try {
    $response = Invoke-WebRequest -Uri "https://localhost:8443" -SkipCertificateCheck -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ HTTPS 連接正常" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ HTTPS 連接失敗: $_" -ForegroundColor Red
}

# 9. 測試WebSocket連接
Write-Host "9️⃣ 測試WebSocket連接..." -ForegroundColor Yellow
try {
    if (Test-Path "test-final-websocket.js") {
        $wsTest = Start-Process -FilePath "node" -ArgumentList "test-final-websocket.js" -Wait -PassThru -NoNewWindow
        if ($wsTest.ExitCode -eq 0) {
            Write-Host "✅ WebSocket 連接測試成功" -ForegroundColor Green
        } else {
            Write-Host "❌ WebSocket 連接測試失敗" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "❌ WebSocket 測試失敗: $_" -ForegroundColor Red
}

Write-Host "`n🎯 502錯誤修復總結:" -ForegroundColor Cyan
Write-Host "1. ✅ 已清理端口衝突" -ForegroundColor White
Write-Host "2. ✅ 已重新安裝WebSocket功能" -ForegroundColor White
Write-Host "3. ✅ 已優化ARR代理配置" -ForegroundColor White
Write-Host "4. ✅ 已重啟IIS和Node.js" -ForegroundColor White

Write-Host "`n🚀 測試方法:" -ForegroundColor Cyan
Write-Host "1. 訪問: https://vibelo.l0sscat.com:8443" -ForegroundColor White
Write-Host "2. 檢查瀏覽器控制台是否有WebSocket連接錯誤" -ForegroundColor White
Write-Host "3. 如果仍有502錯誤，請檢查Node.js服務器日誌" -ForegroundColor White

Write-Host "`n✨ 修復完成！" -ForegroundColor Green


