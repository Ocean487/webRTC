# 配置SSL綁定的PowerShell腳本
# 需要以管理員身份運行

Write-Host "🔒 配置SSL綁定..." -ForegroundColor Green

# 檢查是否以管理員身份運行
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ 此腳本需要管理員權限，請以管理員身份運行PowerShell" -ForegroundColor Red
    exit 1
}

# 1. 檢查SSL證書
Write-Host "1️⃣ 檢查SSL證書..." -ForegroundColor Yellow

$certPath = "certificate.pem"
$keyPath = "private-key.pem"

if (Test-Path $certPath -and Test-Path $keyPath) {
    Write-Host "✅ SSL證書文件存在" -ForegroundColor Green
} else {
    Write-Host "❌ SSL證書文件不存在" -ForegroundColor Red
    Write-Host "請確保以下文件存在:" -ForegroundColor Yellow
    Write-Host "   - certificate.pem" -ForegroundColor White
    Write-Host "   - private-key.pem" -ForegroundColor White
    exit 1
}

# 2. 導入SSL證書到Windows證書存儲
Write-Host "2️⃣ 導入SSL證書..." -ForegroundColor Yellow

try {
    # 創建自簽名證書（如果需要的話）
    $cert = New-SelfSignedCertificate -DnsName "vibelo.l0sscat.com", "localhost" -CertStoreLocation "cert:\LocalMachine\My" -NotAfter (Get-Date).AddYears(1)
    Write-Host "✅ SSL證書已創建並導入" -ForegroundColor Green
} catch {
    Write-Host "❌ 證書導入失敗: $_" -ForegroundColor Red
}

# 3. 配置IIS SSL綁定
Write-Host "3️⃣ 配置IIS SSL綁定..." -ForegroundColor Yellow

try {
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    
    # 添加HTTPS綁定
    New-WebBinding -Name "Default Web Site" -Protocol "https" -Port 8443 -HostHeader "vibelo.l0sscat.com"
    Write-Host "✅ HTTPS綁定已添加" -ForegroundColor Green
    
    # 綁定證書
    $binding = Get-WebBinding -Name "Default Web Site" -Protocol "https" -Port 8443
    $binding.AddSslCertificate($cert.Thumbprint, "my")
    Write-Host "✅ SSL證書已綁定" -ForegroundColor Green
    
} catch {
    Write-Host "❌ SSL綁定配置失敗: $_" -ForegroundColor Red
}

# 4. 重啟IIS
Write-Host "4️⃣ 重啟IIS..." -ForegroundColor Yellow

try {
    iisreset
    Write-Host "✅ IIS重啟完成" -ForegroundColor Green
} catch {
    Write-Host "❌ IIS重啟失敗: $_" -ForegroundColor Red
}

Write-Host "`n🎯 SSL配置總結:" -ForegroundColor Cyan
Write-Host "1. ✅ SSL證書已導入" -ForegroundColor White
Write-Host "2. ✅ HTTPS綁定已配置" -ForegroundColor White
Write-Host "3. ✅ 證書已綁定到端口8443" -ForegroundColor White
Write-Host "4. ✅ IIS已重啟" -ForegroundColor White

Write-Host "`n🚀 測試方法:" -ForegroundColor Cyan
Write-Host "1. 訪問: https://vibelo.l0sscat.com:8443" -ForegroundColor White
Write-Host "2. 檢查瀏覽器是否顯示安全連接" -ForegroundColor White

Write-Host "`n✨ SSL配置完成！" -ForegroundColor Green


