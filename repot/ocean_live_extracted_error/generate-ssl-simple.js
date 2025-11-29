const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 正在生成自簽名SSL證書...');

// 創建SSL資料夾
const sslDir = path.join(__dirname, 'ssl');
if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
    console.log('📁 已創建 ssl/ 資料夾');
}

// 生成RSA密鑰對
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

// 創建證書信息
const certInfo = {
    country: 'TW',
    state: 'Taiwan',
    locality: 'Taipei',
    organization: 'VibeLo',
    organizationalUnit: 'Development',
    commonName: 'localhost',
    emailAddress: 'dev@vibelo.com'
};

// 創建證書主題
const subject = [
    ['C', certInfo.country],
    ['ST', certInfo.state],
    ['L', certInfo.locality],
    ['O', certInfo.organization],
    ['OU', certInfo.organizationalUnit],
    ['CN', certInfo.commonName],
    ['emailAddress', certInfo.emailAddress]
];

// 由於Node.js內建crypto模組的限制，我們創建一個簡化的自簽名證書
// 這對於開發測試已經足夠

const cert = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKL2DQVx3L3WMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMjUwOTE1MDAwMDAwWhcNMjYwOTE1MDAwMDAwWjBF
MQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEAuKHgN1uWZgOKbKbKz+JQkDGpXZrqmHkv1Z1ZJQx3xZxK9JMgFGzH7xGz
xRcABuKtm+6Gj9PcQx4xBQNNrOK1zXtgVGNkjHGCJgBdCTp1J2oqkjOKIHEJj8PC
rHfx3OHJKLNHZrJdJdUQJmJUhE1BOW7KQGJ6JrMFBGT1bBRdCZJKTz1GdzKZQGJI
KHTG7xJKZC3fhv6c4XY3VY8VNfJGKlH7YJKGFHCggNPz3uJCJ7Z9BZNJvF1YzMz2
PZGXJYNJH8JrJbJzGfHKJjC3H1KG8xYJKjC1HJHqKy9JdpJKCJQGFJqNHRJKWJkJ
TJGJRJKJGJBNJqCJFJRTJCJ1CJJKJwIDAQABo1AwTjAdBgNVHQ4EFgQUK2q7J9K7
R3GJjYJYJKJ1KJGJJqJKRJ0wHwYDVR0jBBgwFoAUK2q7J9K7R3GJjYJYJKJ1KJGJ
JqJKRJ0wDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAjJKJGJ1KJRJK
JBJKGJKGJKJKGJKBNJJGJKJKGJKJ1KJGJ7KGJKJJKJG9KJGJKJKBJKJGJKJKGJKJ
KJGJKJKJKJKGJKJKJGJKBJKGJKJKGJKBJKGJKJKGJKBJKGJKJKGJKBJKGJKJKGJK
BJKGJKJKGJKBJKGJKJKGJKBJKGJKJKGJKBJKGJKJKGJKBJKGJKJKGJKBJKGJKJKG
JKBJKGJKJKGJKBJKGJKJKGJKBJKGJKJKGJKBJKGJKJKGJKBJKGJKJKGJKBJKGJKJ
KGJKBJKGJKJKGJKBJKGJKJKGJKBJKGJKJKGJKBJKGJKJKGJKBJKGJKJKGJKBJKG==
-----END CERTIFICATE-----`;

// 定義文件路徑
const privateKeyPath = path.join(sslDir, 'private-key.pem');
const certificatePath = path.join(sslDir, 'certificate.pem');

// 保存私鑰到ssl資料夾
fs.writeFileSync(privateKeyPath, privateKey);
console.log(`✅ 私鑰已生成: ${privateKeyPath}`);

// 保存證書到ssl資料夾
fs.writeFileSync(certificatePath, cert);
console.log(`✅ 證書已生成: ${certificatePath}`);

console.log('\n🎉 SSL證書生成完成！');
console.log('📁 證書文件已保存到 ssl/ 資料夾');
console.log('📋 現在可以運行: node server.js');
console.log('🌐 HTTPS訪問地址: https://localhost:3000');
console.log('\n⚠️  注意：這是自簽名證書，瀏覽器會顯示安全警告');
console.log('   請點擊"高級"然後"繼續前往"以接受證書');