# 添加IIS 8443端口綁定
Write-Host "🔧 添加IIS 8443端口綁定..." -ForegroundColor Green

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
    
    # 檢查現有綁定
    Write-Host "檢查現有綁定..." -ForegroundColor Cyan
    $existingBindings = Get-WebBinding -Name "Default Web Site"
    
    Write-Host "現有綁定:" -ForegroundColor White
    foreach ($binding in $existingBindings) {
        Write-Host "  $($binding.Protocol):$($binding.BindingInformation)" -ForegroundColor White
    }
    
    # 檢查8443端口綁定是否已存在
    $port8443Binding = $existingBindings | Where-Object { $_.BindingInformation -like "*:8443:*" }
    
    if ($port8443Binding) {
        Write-Host "✅ 8443端口綁定已存在" -ForegroundColor Green
    } else {
        Write-Host "添加8443端口HTTPS綁定..." -ForegroundColor Yellow
        
        # 添加HTTPS綁定到8443端口
        New-WebBinding -Name "Default Web Site" -Protocol "https" -Port 8443 -ErrorAction Stop
        
        Write-Host "✅ 已成功添加8443端口HTTPS綁定" -ForegroundColor Green
    }
    
    # 檢查網站狀態
    $website = Get-Website -Name "Default Web Site"
    Write-Host "網站狀態: $($website.State)" -ForegroundColor White
    
    if ($website.State -ne "Started") {
        Write-Host "啟動網站..." -ForegroundColor Yellow
        Start-Website -Name "Default Web Site"
        Write-Host "✅ 網站已啟動" -ForegroundColor Green
    }
    
    # 重新檢查綁定
    Write-Host "`n更新後的綁定:" -ForegroundColor Cyan
    $updatedBindings = Get-WebBinding -Name "Default Web Site"
    foreach ($binding in $updatedBindings) {
        Write-Host "  $($binding.Protocol):$($binding.BindingInformation)" -ForegroundColor White
    }
    
    Write-Host "`n🎉 IIS配置完成！" -ForegroundColor Green
    Write-Host "現在可以測試: https://vibelo.l0sscat.com:8443" -ForegroundColor White
    
} catch {
    Write-Host "❌ 錯誤: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "請確保:" -ForegroundColor Yellow
    Write-Host "1. 以管理員身份運行" -ForegroundColor White
    Write-Host "2. IIS已正確安裝" -ForegroundColor White
    Write-Host "3. WebAdministration模組可用" -ForegroundColor White
}

pause

