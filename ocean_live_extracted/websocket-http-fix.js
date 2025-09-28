// 臨時修復：使用WSS WebSocket連接 (wss://) 而不是HTTP (ws://)
// 統一使用加密連接

// 修改script.js中的WebSocket連接
function connectToStreamingServer() {
    console.log('🔧 使用HTTP WebSocket連接 (避免SSL證書問題)');
    
    // 使用WSS WebSocket連接
    const wsUrl = 'wss://localhost:8080';
    
    console.log('嘗試連接到本地 WSS WebSocket 服務器:', wsUrl);
    
    // 直接使用WebSocket連接
    streamingSocket = new WebSocket(wsUrl);
    
    streamingSocket.onopen = function() {
        console.log('✅ 已連接到本地HTTP直播服務器');
        addMessage('系統', '🔗 已連接到本地HTTP直播服務器');
        
        // 獲取主播用戶信息
        const userInfo = getCurrentUserInfo();
        console.log('🔍 [DEBUG] WebSocket 連線時獲取的 userInfo:', userInfo);
        
        if (!userInfo) {
            console.log('❌ 無法獲取用戶信息，斷開連接');
            streamingSocket.close();
            return;
        }
        
        // 發送主播加入訊息
        const broadcasterMessage = {
            type: 'broadcaster_join',
            broadcasterId: userInfo.id || 'broadcaster_' + Date.now(),
            userInfo: userInfo
        };
        
        console.log('發送主播加入訊息:', broadcasterMessage);
        streamingSocket.send(JSON.stringify(broadcasterMessage));
    };
    
    streamingSocket.onmessage = function(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('收到服務器訊息:', message);
            
            switch (message.type) {
                case 'broadcaster_joined':
                    console.log('✅ 主播已成功加入');
                    addMessage('系統', '✅ 主播已成功加入直播間');
                    break;
                    
                case 'viewer_join':
                    console.log('觀眾加入:', message.viewerId);
                    addMessage('系統', `👥 觀眾 ${message.viewerId} 已加入`);
                    break;
                    
                case 'online_viewers':
                    console.log('在線觀眾:', message.viewers);
                    updateViewerCount(message.count);
                    break;
                    
                case 'chat':
                    console.log('收到聊天訊息:', message);
                    addMessage(message.username, message.text);
                    break;
                    
                default:
                    console.log('未知訊息類型:', message.type);
            }
        } catch (error) {
            console.error('解析訊息失敗:', error);
        }
    };
    
    streamingSocket.onerror = function(error) {
        console.error('❌ WebSocket 錯誤:', error);
        console.log('❌ WebSocket 狀態:', streamingSocket.readyState);
        addMessage('系統', '❌ WebSocket連接錯誤');
    };
    
    streamingSocket.onclose = function(event) {
        console.log('❌ 連接被關閉，可能是伺服器未啟動');
        addMessage('系統', '❌ 連接被關閉，可能是伺服器未啟動');
        streamingSocket = null;
    };
}

// 修改chat-system.js中的WebSocket連接
function connectWebSocket() {
    console.log('🔧 [ChatSystem] 使用HTTP WebSocket連接 (避免SSL證書問題)');
    
    // 使用WSS WebSocket連接
    const wsUrl = 'wss://localhost:8080';
    
    console.log('[ChatSystem] 創建新的 WSS WebSocket 連接:', wsUrl);
    
    // 直接使用WebSocket連接
    this.socket = new WebSocket(wsUrl);
    
    this.socket.onopen = (event) => {
        console.log('聊天室HTTP WebSocket連接已建立');
        this.isConnected = true;
        
        // 顯示連接訊息
        this.addSystemMessage('✅ 聊天室已連接 (HTTP)');
        
        // 發送身份識別
        this.sendIdentification();
        
        // 處理排隊的訊息
        this.processMessageQueue();
    };
    
    this.socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log('[ChatSystem] 收到訊息:', message);
            
            switch (message.type) {
                case 'chat':
                    this.handleChatMessage(message);
                    break;
                case 'chat_join_ack':
                    console.log('[ChatSystem] 聊天加入確認');
                    break;
                case 'ack':
                    this.handleAckMessage(message);
                    break;
                default:
                    console.log('[ChatSystem] 未知訊息類型:', message.type);
            }
        } catch (error) {
            console.error('[ChatSystem] 解析訊息失敗:', error);
        }
    };
    
    this.socket.onerror = (error) => {
        console.error('聊天室 HTTP WebSocket 錯誤:', error);
        this.isConnected = false;
        this.addSystemMessage('❌ 聊天室連接錯誤');
    };
    
    this.socket.onclose = (event) => {
        console.log('[ChatSystem] HTTP WebSocket連接已關閉');
        this.isConnected = false;
        this.addSystemMessage('❌ 聊天室連接已關閉');
        
        // 嘗試重新連接
        setTimeout(() => {
            if (!this.isConnected) {
                console.log('[ChatSystem] 嘗試重新連接...');
                this.connectWebSocket();
            }
        }, 5000);
    };
}

console.log('🔧 WebSocket WSS修復腳本已載入');
console.log('現在將連接到本地WSS WebSocket服務器 (wss://localhost:8080)');
console.log('✅ 注意: 這將使用WSS加密連接，支援WebRTC');


