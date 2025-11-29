# 配置IIS全局設置以支持反向代理
Write-Host "🔧 配置IIS全局設置..." -ForegroundColor Green

# 檢查是否以管理員身份運行
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ 請以管理員身份運行此腳本" -ForegroundColor Red
    Write-Host "右鍵點擊PowerShell，選擇'以管理員身份運行'" -ForegroundColor Yellow
    pause
    exit 1
}

try {
    # 導入WebAdministration模組
    Import-Module WebAdministration -ErrorAction Stop
    Write-Host "✅ WebAdministration模組已載入" -ForegroundColor Green
    
    # 1. 配置允許的服務器變量（全局級別）
    Write-Host "配置允許的服務器變量..." -ForegroundColor Cyan
    
    $serverVars = @(
        "HTTP_X_FORWARDED_PROTO",
        "HTTP_X_FORWARDED_FOR", 
        "HTTP_X_FORWARDED_HOST",
        "HTTP_HOST"
    )
    
    foreach ($var in $serverVars) {
        try {
            # 檢查變量是否已存在
            $existing = Get-WebConfiguration -Filter "system.webServer/rewrite/allowedServerVariables/add[@name='$var']" -PSPath "IIS:\"
            if (-not $existing) {
                Add-WebConfiguration -Filter "system.webServer/rewrite/allowedServerVariables" -Value @{name=$var} -PSPath "IIS:\"
                Write-Host "  ✅ 已添加服務器變量: $var" -ForegroundColor Green
            } else {
                Write-Host "  ✅ 服務器變量已存在: $var" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  ⚠️  無法添加服務器變量 $var : $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    
    # 2. 檢查和添加8443端口綁定
    Write-Host "`n檢查IIS網站綁定..." -ForegroundColor Cyan
    
    $existingBindings = Get-WebBinding -Name "Default Web Site"
    Write-Host "現有綁定:" -ForegroundColor White
    foreach ($binding in $existingBindings) {
        Write-Host "  $($binding.Protocol):$($binding.BindingInformation)" -ForegroundColor White
    }
    
    # 檢查8443端口綁定
    $port8443Binding = $existingBindings | Where-Object { $_.BindingInformation -like "*:8443:*" }
    
    if (-not $port8443Binding) {
        Write-Host "添加8443端口HTTPS綁定..." -ForegroundColor Yellow
        try {
            New-WebBinding -Name "Default Web Site" -Protocol "https" -Port 8443 -ErrorAction Stop
            Write-Host "✅ 已成功添加8443端口HTTPS綁定" -ForegroundColor Green
        } catch {
            Write-Host "❌ 無法添加8443端口綁定: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "請手動在IIS管理器中添加8443端口綁定" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✅ 8443端口綁定已存在" -ForegroundColor Green
    }
    
    # 3. 確保網站運行
    $website = Get-Website -Name "Default Web Site"
    Write-Host "`n網站狀態: $($website.State)" -ForegroundColor White
    
    if ($website.State -ne "Started") {
        Write-Host "啟動網站..." -ForegroundColor Yellow
        Start-Website -Name "Default Web Site"
        Write-Host "✅ 網站已啟動" -ForegroundColor Green
    }
    
    # 4. 重啟應用程序池以應用更改
    Write-Host "`n重啟應用程序池..." -ForegroundColor Cyan
    $appPool = Get-IISAppPool -Name "DefaultAppPool"
    if ($appPool.State -eq "Started") {
        Restart-WebAppPool -Name "DefaultAppPool"
        Write-Host "✅ 應用程序池已重啟" -ForegroundColor Green
    }
    
    # 5. 顯示最終配置
    Write-Host "`n最終綁定配置:" -ForegroundColor Cyan
    $finalBindings = Get-WebBinding -Name "Default Web Site"
    foreach ($binding in $finalBindings) {
        Write-Host "  $($binding.Protocol):$($binding.BindingInformation)" -ForegroundColor White
    }
    
    Write-Host "`n🎉 IIS配置完成！" -ForegroundColor Green
    Write-Host "現在可以測試: https://vibelo.l0sscat.com:8443" -ForegroundColor White
    Write-Host "如果仍有問題，請檢查防火牆和Cloudflare設置" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ 配置過程中發生錯誤: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n可能的解決方案:" -ForegroundColor Yellow
    Write-Host "1. 確保以管理員身份運行" -ForegroundColor White
    Write-Host "2. 確保IIS和URL重寫模組已正確安裝" -ForegroundColor White
    Write-Host "3. 確保Application Request Routing已安裝" -ForegroundColor White
    Write-Host "4. 手動在IIS管理器中配置" -ForegroundColor White
}

pause

