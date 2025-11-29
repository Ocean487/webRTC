// 502錯誤修復測試工具
const WebSocket = require('ws');
const https = require('https');
const http = require('http');

console.log('🔧 502錯誤修復測試工具');
console.log('=====================');

// 測試配置
const testConfigs = [
    {
        name: '直接連接到Node.js服務器',
        url: 'wss://localhost:3000',
        description: '測試Node.js WebSocket服務器是否正常運行'
    },
    {
        name: '通過IIS代理連接',
        url: 'wss://vibelo.l0sscat.com:8443',
        description: '測試IIS代理是否正確轉發WebSocket請求'
    },
    {
        name: '本地IIS測試',
        url: 'wss://localhost:443',
        description: '測試本地IIS WebSocket代理'
    }
];

async function testWebSocketConnection(config) {
    return new Promise((resolve) => {
        console.log(`\n🔍 測試: ${config.name}`);
        console.log(`   URL: ${config.url}`);
        console.log(`   說明: ${config.description}`);
        
        const startTime = Date.now();
        
        try {
            const ws = new WebSocket(config.url, {
                rejectUnauthorized: false,
                timeout: 10000
            });
            
            ws.on('open', () => {
                const duration = Date.now() - startTime;
                console.log(`   ✅ 連接成功 (${duration}ms)`);
                
                // 發送測試訊息
                ws.send(JSON.stringify({
                    type: 'test',
                    message: '502錯誤修復測試',
                    timestamp: Date.now()
                }));
                
                setTimeout(() => {
                    ws.close();
                    resolve({
                        success: true,
                        duration: duration,
                        error: null
                    });
                }, 1000);
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log(`   📨 收到回應: ${message.type || 'unknown'}`);
                } catch (e) {
                    console.log(`   📨 收到數據: ${data.toString().substring(0, 50)}...`);
                }
            });
            
            ws.on('error', (error) => {
                const duration = Date.now() - startTime;
                console.log(`   ❌ 連接失敗 (${duration}ms): ${error.message}`);
                
                // 分析錯誤類型
                if (error.message.includes('502')) {
                    console.log(`   💡 502錯誤: IIS代理無法連接到後端服務器`);
                } else if (error.message.includes('ECONNREFUSED')) {
                    console.log(`   💡 連接拒絕: 後端服務器未運行`);
                } else if (error.message.includes('ENOTFOUND')) {
                    console.log(`   💡 域名解析失敗: 檢查DNS設置`);
                }
                
                resolve({
                    success: false,
                    duration: duration,
                    error: error.message
                });
            });
            
            ws.on('close', (code, reason) => {
                if (code !== 1000) {
                    console.log(`   ⚠️ 異常關閉: ${code} ${reason}`);
                }
            });
            
            // 超時處理
            setTimeout(() => {
                if (ws.readyState === WebSocket.CONNECTING) {
                    console.log(`   ⏰ 連接超時`);
                    ws.terminate();
                    resolve({
                        success: false,
                        duration: Date.now() - startTime,
                        error: 'Connection timeout'
                    });
                }
            }, 10000);
            
        } catch (error) {
            console.log(`   ❌ 創建連接失敗: ${error.message}`);
            resolve({
                success: false,
                duration: 0,
                error: error.message
            });
        }
    });
}

async function testHttpConnection(url) {
    return new Promise((resolve) => {
        console.log(`\n🌐 測試HTTP連接: ${url}`);
        
        const startTime = Date.now();
        const options = {
            rejectUnauthorized: false,
            timeout: 5000
        };
        
        const request = https.get(url, options, (response) => {
            const duration = Date.now() - startTime;
            console.log(`   ✅ HTTP連接成功 (${duration}ms) - 狀態碼: ${response.statusCode}`);
            resolve({
                success: true,
                statusCode: response.statusCode,
                duration: duration
            });
        });
        
        request.on('error', (error) => {
            const duration = Date.now() - startTime;
            console.log(`   ❌ HTTP連接失敗 (${duration}ms): ${error.message}`);
            resolve({
                success: false,
                error: error.message,
                duration: duration
            });
        });
        
        request.setTimeout(5000, () => {
            console.log(`   ⏰ HTTP連接超時`);
            request.destroy();
            resolve({
                success: false,
                error: 'Timeout',
                duration: 5000
            });
        });
    });
}

async function runTests() {
    console.log('開始502錯誤診斷測試...\n');
    
    // 1. 測試HTTP連接
    const httpResults = await testHttpConnection('https://localhost:3000');
    
    // 2. 測試WebSocket連接
    const results = [];
    for (const config of testConfigs) {
        const result = await testWebSocketConnection(config);
        results.push({
            name: config.name,
            ...result
        });
    }
    
    // 3. 生成測試報告
    console.log('\n📊 測試報告');
    console.log('===========');
    
    console.log('\nHTTP連接測試:');
    if (httpResults.success) {
        console.log('✅ HTTP服務器正常運行');
    } else {
        console.log('❌ HTTP服務器無法訪問');
    }
    
    console.log('\nWebSocket連接測試:');
    let successCount = 0;
    results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.name}: ${result.success ? '成功' : result.error}`);
        if (result.success) successCount++;
    });
    
    // 4. 提供建議
    console.log('\n💡 修復建議:');
    if (successCount === 0) {
        console.log('🔧 所有WebSocket連接都失敗，建議執行以下步驟：');
        console.log('   1. 檢查Node.js服務器是否運行: node server.js');
        console.log('   2. 執行修復腳本: .\\fix-502-error.ps1');
        console.log('   3. 應用修復配置: copy web-502-fix.config web.config');
        console.log('   4. 重啟IIS: iisreset');
    } else if (successCount === 1 && results[0].success) {
        console.log('🔧 Node.js服務器正常，但IIS代理有問題：');
        console.log('   1. 檢查web.config中的代理規則');
        console.log('   2. 確保ARR已安裝並啟用');
        console.log('   3. 重啟IIS: iisreset');
    } else if (successCount === testConfigs.length) {
        console.log('🎉 所有連接都正常！502錯誤已修復。');
    } else {
        console.log('🔧 部分連接成功，建議進一步診斷配置問題');
    }
    
    console.log('\n✨ 測試完成！');
}

// 執行測試
runTests().catch(error => {
    console.error('測試執行失敗:', error);
    process.exit(1);
});


