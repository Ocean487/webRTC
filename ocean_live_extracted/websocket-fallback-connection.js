// 外網WebSocket連接臨時修復方案
// 當外網HTTPS WebSocket失敗時，自動降級到HTTP連接

function createWebSocketWithFallback(url, isHttps = false) {
    return new Promise((resolve, reject) => {
        console.log('🔧 嘗試WebSocket連接:', url);
        
        const ws = new WebSocket(url);
        
        ws.onopen = function() {
            console.log('✅ WebSocket連接成功:', url);
            resolve(ws);
        };
        
        ws.onerror = function(error) {
            console.log('❌ WebSocket連接失敗:', url);
            
            if (isHttps) {
                // HTTPS失敗，嘗試HTTP降級
                console.log('🔄 嘗試HTTP降級連接...');
                const httpUrl = url.replace('wss://', 'wss://').replace(':8443', ':8080');
                
                const fallbackWs = new WebSocket(httpUrl);
                
                fallbackWs.onopen = function() {
                    console.log('✅ HTTP降級連接成功:', httpUrl);
                    resolve(fallbackWs);
                };
                
                fallbackWs.onerror = function(fallbackError) {
                    console.log('❌ HTTP降級連接也失敗:', httpUrl);
                    reject(fallbackError);
                };
            } else {
                reject(error);
            }
        };
        
        ws.onclose = function(event) {
            if (event.code !== 1000) { // 非正常關閉
                console.log('❌ WebSocket連接關閉:', event.code, event.reason);
            }
        };
    });
}

// 修改script.js中的WebSocket連接
function connectToStreamingServer() {
    console.log('🔧 使用WebSocket降級連接方案');
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let wsUrl;
    
    if (isLocalhost) {
        // 內網：直接使用HTTP
        wsUrl = 'wss://localhost:8080';
    } else {
        // 外網：先嘗試HTTPS，失敗則降級到HTTP
        wsUrl = 'wss://' + window.location.host;
    }
    
    console.log('🔧 WebSocket連接URL:', wsUrl);
    console.log('🔧 訪問方式:', isLocalhost ? '內網' : '外網');
    
    createWebSocketWithFallback(wsUrl, !isLocalhost)
        .then(ws => {
            streamingSocket = ws;
            
            streamingSocket.onopen = function() {
                console.log('✅ 已連接到直播服務器');
                addMessage('系統', '🔗 已連接到直播服務器');
                
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
        })
        .catch(error => {
            console.error('❌ 所有WebSocket連接嘗試都失敗:', error);
            addMessage('系統', '❌ 無法連接到服務器');
        });
}

// 修改chat-system.js中的WebSocket連接
function connectWebSocket() {
    console.log('🔧 [ChatSystem] 使用WebSocket降級連接方案');
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let wsUrl;
    
    if (isLocalhost) {
        // 內網：直接使用HTTP
        wsUrl = 'wss://localhost:8080';
    } else {
        // 外網：先嘗試HTTPS，失敗則降級到HTTP
        wsUrl = 'wss://' + window.location.host;
    }
    
    console.log('[ChatSystem] WebSocket連接URL:', wsUrl);
    console.log('[ChatSystem] 訪問方式:', isLocalhost ? '內網' : '外網');
    
    createWebSocketWithFallback(wsUrl, !isLocalhost)
        .then(ws => {
            this.socket = ws;
            
            this.socket.onopen = (event) => {
                console.log('聊天室WebSocket連接已建立');
                this.isConnected = true;
                
                // 顯示連接訊息
                this.addSystemMessage('✅ 聊天室已連接');
                
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
                console.error('聊天室 WebSocket 錯誤:', error);
                this.isConnected = false;
                this.addSystemMessage('❌ 聊天室連接錯誤');
            };
            
            this.socket.onclose = (event) => {
                console.log('[ChatSystem] WebSocket連接已關閉');
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
        })
        .catch(error => {
            console.error('[ChatSystem] 所有WebSocket連接嘗試都失敗:', error);
            this.addSystemMessage('❌ 無法連接到聊天服務器');
        });
}

console.log('🔧 WebSocket降級連接方案已載入');
console.log('外網訪問: 先嘗試 wss://vibelo.l0sscat.com:8443，失敗則降級到 wss://vibelo.l0sscat.com:8080');
console.log('內網訪問: 直接使用 wss://localhost:8080');


