/**
 * WebSocket Fallback 機制
 * 當WebSocket連接失敗時自動切換到HTTP輪詢
 */

class WebSocketFallback {
    constructor(url, options = {}) {
        this.url = url;
        this.options = options;
        this.clientId = this.generateClientId();
        this.isConnected = false;
        this.usePolling = false;
        this.pollingInterval = null;
        this.pollingFrequency = options.pollingFrequency || 1000; // 1秒輪詢一次
        this.maxRetries = options.maxRetries || 3;
        this.retryCount = 0;
        
        // 事件處理器
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        
        // 訊息佇列
        this.messageQueue = [];
        
        this.connect();
    }
    
    generateClientId() {
        return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }
    
    connect() {
        console.log('🔌 嘗試WebSocket連接...');
        
        try {
            this.ws = new WebSocket(this.url);
            
            // 設置連接超時，3秒後如果還沒連接就切換到輪詢
            const connectTimeout = setTimeout(() => {
                if (this.ws.readyState !== WebSocket.OPEN && !this.usePolling) {
                    console.log('⏰ WebSocket連接超時，切換到HTTP輪詢...');
                    this.ws.close();
                    this.switchToPolling();
                }
            }, 3000);
            
            this.ws.onopen = (event) => {
                clearTimeout(connectTimeout);
                console.log('✅ WebSocket連接成功');
                this.isConnected = true;
                this.usePolling = false;
                this.retryCount = 0;
                
                // 處理佇列中的訊息
                this.flushMessageQueue();
                
                if (this.onopen) {
                    this.onopen(event);
                }
            };
            
            this.ws.onmessage = (event) => {
                if (this.onmessage) {
                    this.onmessage(event);
                }
            };
            
            this.ws.onerror = (error) => {
                console.log('❌ WebSocket錯誤，嘗試切換到HTTP輪詢...', error);
                if (!this.usePolling) {
                    this.switchToPolling();
                }
                if (this.onerror && !this.usePolling) {
                    this.onerror(error);
                }
            };
            
            this.ws.onclose = (event) => {
                console.log('🔌 WebSocket連接關閉');
                this.isConnected = false;
                
                if (!this.usePolling && this.retryCount < this.maxRetries) {
                    this.retryCount++;
                    console.log(`🔄 重試WebSocket連接 (${this.retryCount}/${this.maxRetries})...`);
                    setTimeout(() => this.connect(), 2000);
                } else if (!this.usePolling) {
                    console.log('🔄 WebSocket重試次數已達上限，切換到HTTP輪詢...');
                    this.switchToPolling();
                }
            };
            
        } catch (error) {
            console.log('❌ WebSocket創建失敗，切換到HTTP輪詢...');
            this.switchToPolling();
        }
    }
    
    async switchToPolling() {
        if (this.usePolling) return; // 已經在使用輪詢
        
        console.log('📡 切換到HTTP輪詢模式...');
        this.usePolling = true;
        this.isConnected = false;
        
        try {
            // 註冊輪詢客戶端 - 使用完整URL確保HTTPS請求正確
            const registerUrl = `${window.location.protocol}//${window.location.host}/api/polling/register`;
            console.log('🔗 註冊URL:', registerUrl);
            
            const response = await fetch(registerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    clientId: this.clientId,
                    clientType: 'viewer',
                    userInfo: this.options.userInfo || {}
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ HTTP輪詢註冊成功:', data);
                this.isConnected = true;
                this.startPolling();
                
                // 處理佇列中的訊息
                this.flushMessageQueue();
                
                // 觸發onopen事件
                if (this.onopen) {
                    this.onopen({ type: 'polling_connected' });
                }
            } else {
                const errorText = await response.text();
                console.error('❌ HTTP輪詢註冊失敗:', response.status, errorText);
                if (this.onerror) {
                    this.onerror(new Error(`HTTP輪詢註冊失敗: ${response.status} ${errorText}`));
                }
            }
        } catch (error) {
            console.error('❌ 切換到HTTP輪詢失敗:', error);
            if (this.onerror) {
                this.onerror(error);
            }
        }
    }
    
    startPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        
        this.pollingInterval = setInterval(async () => {
            try {
                const messagesUrl = `${window.location.protocol}//${window.location.host}/api/polling/messages/${this.clientId}`;
                const response = await fetch(messagesUrl);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.success && data.messages && data.messages.length > 0) {
                        // 處理收到的訊息
                        data.messages.forEach(message => {
                            if (this.onmessage) {
                                // 模擬WebSocket事件格式
                                const event = {
                                    data: JSON.stringify(message),
                                    type: 'message'
                                };
                                this.onmessage(event);
                            }
                        });
                    }
                } else {
                    console.error('❌ 輪詢獲取訊息失敗');
                }
            } catch (error) {
                console.error('❌ 輪詢錯誤:', error);
            }
        }, this.pollingFrequency);
    }
    
    send(data) {
        if (!this.isConnected) {
            // 如果未連接，將訊息加入佇列
            this.messageQueue.push(data);
            return;
        }
        
        if (this.usePolling) {
            // 使用HTTP輪詢發送
            this.sendViaPolling(data);
        } else {
            // 使用WebSocket發送
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(data);
            } else {
                this.messageQueue.push(data);
            }
        }
    }
    
    async sendViaPolling(data) {
        try {
            const message = typeof data === 'string' ? JSON.parse(data) : data;
            const sendUrl = `${window.location.protocol}//${window.location.host}/api/polling/send`;
            
            const response = await fetch(sendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    clientId: this.clientId,
                    message: message
                })
            });
            
            if (!response.ok) {
                console.error('❌ 輪詢發送訊息失敗');
            }
        } catch (error) {
            console.error('❌ 輪詢發送錯誤:', error);
        }
    }
    
    flushMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }
    
    close() {
        console.log('🔌 關閉連接...');
        this.isConnected = false;
        
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        
        if (this.ws) {
            this.ws.close();
        }
        
        if (this.onclose) {
            this.onclose({ type: 'connection_closed' });
        }
    }
    
    // 獲取連接狀態
    get readyState() {
        if (this.isConnected) {
            return this.usePolling ? 1 : (this.ws ? this.ws.readyState : 3);
        }
        return 3; // CLOSED
    }
    
    // 獲取連接類型
    getConnectionType() {
        return this.usePolling ? 'HTTP輪詢' : 'WebSocket';
    }
}

// 使用示例：
// const socket = new WebSocketFallback('wss://vibelo.l0sscat.com:8443/', {
//     pollingFrequency: 1000,
//     maxRetries: 3,
//     userInfo: { displayName: 'User123' }
// });
// 
// socket.onopen = (event) => {
//     console.log('連接已建立:', socket.getConnectionType());
// };
// 
// socket.onmessage = (event) => {
//     const message = JSON.parse(event.data);
//     console.log('收到訊息:', message);
// };
// 
// socket.send(JSON.stringify({ type: 'heartbeat' }));

// 導出類別
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketFallback;
} else {
    window.WebSocketFallback = WebSocketFallback;
}
