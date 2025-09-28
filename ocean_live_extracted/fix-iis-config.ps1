# IIS配置修復腳本
Write-Host "🔧 IIS配置診斷和修復腳本" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# 檢查是否以管理員身份運行
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ 請以管理員身份運行此腳本" -ForegroundColor Red
    Write-Host "右鍵點擊PowerShell，選擇'以管理員身份運行'" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "✅ 管理員權限確認" -ForegroundColor Green

# 檢查IIS是否安裝
Write-Host "`n1️⃣ 檢查IIS安裝狀態..." -ForegroundColor Cyan
$iisFeature = Get-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole
if ($iisFeature.State -eq "Enabled") {
    Write-Host "✅ IIS已安裝" -ForegroundColor Green
} else {
    Write-Host "❌ IIS未安裝" -ForegroundColor Red
    Write-Host "請先安裝IIS功能" -ForegroundColor Yellow
    exit 1
}

# 檢查URL重寫模組
Write-Host "`n2️⃣ 檢查URL重寫模組..." -ForegroundColor Cyan
$rewriteModule = Get-WindowsOptionalFeature -Online -FeatureName IIS-HttpRedirect
if ($rewriteModule.State -eq "Enabled") {
    Write-Host "✅ URL重寫模組已安裝" -ForegroundColor Green
} else {
    Write-Host "⚠️  URL重寫模組未安裝，嘗試啟用..." -ForegroundColor Yellow
    try {
        Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpRedirect -All
        Write-Host "✅ URL重寫模組已啟用" -ForegroundColor Green
    } catch {
        Write-Host "❌ 無法啟用URL重寫模組: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 檢查Application Request Routing
Write-Host "`n3️⃣ 檢查Application Request Routing..." -ForegroundColor Cyan
$arrInstalled = $false
try {
    $arrConfig = Get-WebConfiguration -Filter "system.webServer/proxy" -PSPath "IIS:\"
    if ($arrConfig) {
        Write-Host "✅ Application Request Routing可能已安裝" -ForegroundColor Green
        $arrInstalled = $true
    }
} catch {
    Write-Host "❌ Application Request Routing未安裝或未配置" -ForegroundColor Red
    Write-Host "請手動安裝ARR模組: https://www.iis.net/downloads/microsoft/application-request-routing" -ForegroundColor Yellow
}

# 檢查IIS服務狀態
Write-Host "`n4️⃣ 檢查IIS服務狀態..." -ForegroundColor Cyan
$w3svc = Get-Service -Name "W3SVC" -ErrorAction SilentlyContinue
if ($w3svc) {
    if ($w3svc.Status -eq "Running") {
        Write-Host "✅ IIS服務正在運行" -ForegroundColor Green
    } else {
        Write-Host "⚠️  IIS服務未運行，嘗試啟動..." -ForegroundColor Yellow
        try {
            Start-Service -Name "W3SVC"
            Write-Host "✅ IIS服務已啟動" -ForegroundColor Green
        } catch {
            Write-Host "❌ 無法啟動IIS服務: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "❌ 找不到IIS服務" -ForegroundColor Red
}

# 檢查網站配置
Write-Host "`n5️⃣ 檢查網站配置..." -ForegroundColor Cyan
try {
    Import-Module WebAdministration -ErrorAction Stop
    
    # 檢查默認網站
    $defaultSite = Get-Website -Name "Default Web Site" -ErrorAction SilentlyContinue
    if ($defaultSite) {
        Write-Host "✅ 找到默認網站" -ForegroundColor Green
        Write-Host "   狀態: $($defaultSite.State)" -ForegroundColor White
        Write-Host "   路徑: $($defaultSite.PhysicalPath)" -ForegroundColor White
        
        # 檢查綁定
        $bindings = Get-WebBinding -Name "Default Web Site"
        Write-Host "   綁定:" -ForegroundColor White
        foreach ($binding in $bindings) {
            Write-Host "     $($binding.Protocol):$($binding.BindingInformation)" -ForegroundColor White
        }
        
        # 檢查是否有8443端口綁定
        $port8443 = $bindings | Where-Object { $_.BindingInformation -like "*:8443:*" }
        if (-not $port8443) {
            Write-Host "⚠️  未找到8443端口綁定，嘗試添加..." -ForegroundColor Yellow
            try {
                New-WebBinding -Name "Default Web Site" -Protocol "https" -Port 8443
                Write-Host "✅ 已添加8443端口HTTPS綁定" -ForegroundColor Green
            } catch {
                Write-Host "❌ 無法添加8443端口綁定: $($_.Exception.Message)" -ForegroundColor Red
            }
        } else {
            Write-Host "✅ 找到8443端口綁定" -ForegroundColor Green
        }
    } else {
        Write-Host "❌ 未找到默認網站" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ 無法檢查網站配置: $($_.Exception.Message)" -ForegroundColor Red
}

# 檢查防火牆規則
Write-Host "`n6️⃣ 檢查防火牆規則..." -ForegroundColor Cyan
try {
    $firewallRule = Get-NetFirewallRule -DisplayName "*8443*" -ErrorAction SilentlyContinue
    if ($firewallRule) {
        Write-Host "✅ 找到8443端口防火牆規則" -ForegroundColor Green
    } else {
        Write-Host "⚠️  未找到8443端口防火牆規則，嘗試添加..." -ForegroundColor Yellow
        try {
            New-NetFirewallRule -DisplayName "Allow Port 8443" -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow
            Write-Host "✅ 已添加8443端口防火牆規則" -ForegroundColor Green
        } catch {
            Write-Host "❌ 無法添加防火牆規則: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "❌ 無法檢查防火牆規則: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n📋 診斷完成！" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host "如果問題仍然存在，請檢查:" -ForegroundColor Yellow
Write-Host "1. web.config文件是否在正確位置" -ForegroundColor White
Write-Host "2. Application Request Routing是否正確安裝" -ForegroundColor White
Write-Host "3. IIS錯誤日誌 (通常在 C:\inetpub\logs\LogFiles\)" -ForegroundColor White
Write-Host "4. Windows事件查看器中的IIS相關錯誤" -ForegroundColor White

pause

