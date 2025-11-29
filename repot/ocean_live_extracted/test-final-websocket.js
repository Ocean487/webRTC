const WebSocket = require('ws');

console.log('🎯 最終WebSocket測試...\n');

console.log('測試 wss://vibelo.l0sscat.com:8443/ 連接...');

const ws = new WebSocket('wss://vibelo.l0sscat.com:8443', {
    rejectUnauthorized: false
});

ws.on('open', () => {
    console.log('🎉 成功！wss://vibelo.l0sscat.com:8443/ 連接正常！');
    console.log('✨ IIS WebSocket代理已修復！');
    
    // 發送測試訊息
    ws.send(JSON.stringify({
        type: 'heartbeat',
        timestamp: Date.now()
    }));
    
    console.log('💓 已發送心跳訊息');
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data);
        console.log('📨 收到伺服器回應:', message);
        
        if (message.type === 'heartbeat_ack') {
            console.log('✅ 心跳回應正常');
            console.log('\n🚀 WebSocket完全正常工作！');
            console.log('現在可以正常使用聊天和直播功能了！');
        }
    } catch (e) {
        console.log('📨 收到數據:', data.toString());
    }
    
    ws.close();
    process.exit(0);
});

ws.on('error', (error) => {
    console.log('❌ WebSocket連接失敗:', error.message);
    console.log('\n🔧 請確保已執行以下步驟：');
    console.log('1. 以管理員身份運行PowerShell');
    console.log('2. 執行 .\\fix-websocket-iis.ps1');
    console.log('3. 安裝WebSocket Protocol功能');
    console.log('4. 安裝Application Request Routing');
    console.log('5. 應用優化配置: copy web-websocket-optimized.config web.config');
    console.log('6. 重啟IIS: iisreset');
    process.exit(1);
});

ws.on('close', (code, reason) => {
    if (code !== 1000) {
        console.log(`⚠️ 連接關閉: ${code} ${reason}`);
    }
});

// 10秒超時
setTimeout(() => {
    console.log('⏰ 連接超時');
    console.log('請檢查IIS配置和服務器狀態');
    ws.close();
    process.exit(1);
}, 10000);


