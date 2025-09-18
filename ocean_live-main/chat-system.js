/**
 * 統一聊天室系統
 * 支援主播和觀眾的雙向聊天功能
 */

class ChatSystem {
    constructor(options = {}) {
        this.isStreamer = options.isStreamer || false;
        this.username = options.username || (this.isStreamer ? '主播' : '觀眾');
        this.socket = options.socket || null; // 允許傳入現有的 WebSocket
        this.chatContainer = null;
        this.messageInput = null;
        this.sendButton = null;
        this.isConnected = false;
        this.messageQueue = [];
        
        // DOM 選擇器
        this.selectors = {
            chatContainer: '#chatMessages',
            messageInput: '#messageInput',
            sendButton: '.btn-send',
            ...options.selectors
        };
        
        this.init();
    }
    
    init() {
        this.initDOM();
        
        // 如果有現成的 WebSocket，使用它；否則創建新的
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            console.log('使用現有的 WebSocket 連接');
            this.isConnected = true;
            this.setupWebSocketHandlers();
        } else {
            this.connectWebSocket();
        }
        
        this.bindEvents();
    }
    
    initDOM() {
        console.log('正在初始化聊天系統 DOM...');
        console.log('聊天容器選擇器:', this.selectors.chatContainer);
        console.log('輸入框選擇器:', this.selectors.messageInput);
        console.log('發送按鈕選擇器:', this.selectors.sendButton);
        
        this.chatContainer = document.querySelector(this.selectors.chatContainer);
        this.messageInput = document.querySelector(this.selectors.messageInput);
        this.sendButton = document.querySelector(this.selectors.sendButton);
        
        console.log('找到的聊天容器:', this.chatContainer);
        console.log('找到的輸入框:', this.messageInput);
        console.log('找到的發送按鈕:', this.sendButton);
        
        if (!this.chatContainer) {
            console.error('找不到聊天容器:', this.selectors.chatContainer);
            return;
        }
        
        if (!this.messageInput) {
            console.error('找不到輸入框:', this.selectors.messageInput);
        }
        
        if (!this.sendButton) {
            console.error('找不到發送按鈕:', this.selectors.sendButton);
        }
        
        // 清空現有訊息，不加入歡迎訊息
        this.chatContainer.innerHTML = '';
        console.log('聊天容器已清空');
    }
    
    connectWebSocket() {
        try {
            // 如果構造函數中已經傳入了 socket，使用傳入的 socket
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                console.log('[ChatSystem] 使用構造函數傳入的 WebSocket 連接');
                this.isConnected = true;
                this.setupWebSocketHandlers();
                return;
            }
            
            // 強制為所有用戶（包括主播）建立獨立的聊天WebSocket連接
            // 這樣可以避免與streaming WebSocket的衝突
            console.log('[ChatSystem] 為', this.isStreamer ? '主播' : '觀眾', '創建獨立的聊天 WebSocket 連接');
            
            // 根據當前協議選擇WebSocket協議
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            console.log('[ChatSystem] 創建新的 WebSocket 連接:', wsUrl);
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('聊天室 WebSocket 已連接');
                this.isConnected = true;
                // 不顯示連線訊息，保持聊天室乾淨
                
                // 發送身份識別
                this.sendIdentification();
                
                // 處理排隊的訊息
                this.processMessageQueue();
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('解析訊息失敗:', error);
                }
            };
            
            this.socket.onclose = () => {
                console.log('聊天室 WebSocket 已斷線');
                this.isConnected = false;
                // 不顯示斷線訊息，避免干擾
                
                // 3秒後重新連接
                setTimeout(() => this.connectWebSocket(), 3000);
            };
            
            this.socket.onerror = (error) => {
                console.error('聊天室 WebSocket 錯誤:', error);
                // 不顯示錯誤訊息，避免干擾
            };
            
        } catch (error) {
            console.error('建立 WebSocket 連接失敗:', error);
            // 不顯示錯誤訊息，避免干擾
        }
    }
    
    setupWebSocketHandlers() {
        if (!this.socket) {
            console.error('[ChatSystem] setupWebSocketHandlers: socket 為空');
            return;
        }
        
        console.log('[ChatSystem] 為現有 WebSocket 設置聊天處理器');
        console.log('[ChatSystem] WebSocket 狀態:', this.socket.readyState);
        console.log('[ChatSystem] 用戶角色:', this.isStreamer ? 'broadcaster' : 'viewer');
        console.log('[ChatSystem] 用戶名:', this.username);
        
        // 先移除舊的事件監聽器（如果存在），避免重複監聽
        if (this.messageHandler) {
            this.socket.removeEventListener('message', this.messageHandler);
            console.log('[ChatSystem] 已移除舊的 message 事件監聽器');
        }
        
        // 立即檢查連接狀態並設置
        if (this.socket.readyState === WebSocket.OPEN) {
            this.isConnected = true;
            console.log('[ChatSystem] WebSocket已連接，發送身份識別');
            this.sendIdentification();
        } else {
            console.log('[ChatSystem] WebSocket尚未連接，等待連接');
            this.socket.addEventListener('open', () => {
                console.log('[ChatSystem] WebSocket連接完成，發送身份識別');
                this.isConnected = true;
                this.sendIdentification();
                this.processMessageQueue();
            });
        }
        
        // 處理排隊的訊息
        this.processMessageQueue();
        
        // 監聽訊息 - 添加事件監聽器而不是替換
        const handleChatMessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[ChatSystem] WebSocket 收到原始訊息:', data);
                this.handleMessage(data);
            } catch (error) {
                console.error('[ChatSystem] 解析聊天訊息失敗:', error);
            }
        };
        
        // 儲存處理器以便稍後移除
        this.messageHandler = handleChatMessage;
        
        // 添加聊天訊息處理器（保持原有處理器）
        this.socket.addEventListener('message', handleChatMessage);
        console.log('[ChatSystem] 已添加新的 message 事件監聽器');
        
        // 設置一個標記，表示 ChatSystem 已經準備好處理消息
        this.isReady = true;
        console.log('[ChatSystem] 標記為已準備好');
    }
    
    sendIdentification() {
        if (!this.isConnected || !this.socket) {
            console.warn('[ChatSystem] 無法發送身份識別：未連接');
            return;
        }
        
        // 獲取最新的用戶名稱
        let actualUsername = this.username;
        if (this.isStreamer) {
            // 主播使用登入的真實姓名
            if (window.getCurrentUser && typeof window.getCurrentUser === 'function') {
                actualUsername = window.getCurrentUser();
            } else if (window.currentUser && window.currentUser.displayName) {
                actualUsername = window.currentUser.displayName;
            }
        } else {
            // 觀眾使用Ghost名稱或登入名稱
            if (window.assignedGhostName && !window.currentUser) {
                actualUsername = window.assignedGhostName;
                // 同時更新實例變數
                this.username = actualUsername;
            } else if (window.currentUser && window.currentUser.displayName) {
                actualUsername = window.currentUser.displayName;
                this.username = actualUsername;
            }
        }
        
        // 獲取broadcasterId
        let broadcasterId = 'global'; // 默認聊天室
        
        if (this.isStreamer) {
            // 主播使用自己的broadcaster ID
            if (typeof getBroadcasterId === 'function') {
                broadcasterId = getBroadcasterId();
            } else if (window.broadcasterId) {
                broadcasterId = window.broadcasterId;
            }
        } else {
            // 觀眾使用URL參數或全局變量中的broadcaster ID
            const urlParams = new URLSearchParams(window.location.search);
            broadcasterId = urlParams.get('broadcasterId') || 
                           urlParams.get('broadcaster') || 
                           window.currentBroadcasterId || 
                           'global';
        }
        
        const identMessage = {
            type: 'chat_join',
            role: this.isStreamer ? 'broadcaster' : 'viewer',
            username: actualUsername,
            broadcasterId: broadcasterId,
            timestamp: new Date().toISOString()
        };
        
        console.log('[ChatSystem] 發送身份識別:', identMessage);
        this.socket.send(JSON.stringify(identMessage));
    }
    
    bindEvents() {
        console.log('[ChatSystem] 開始綁定事件');
        console.log('[ChatSystem] messageInput:', this.messageInput);
        console.log('[ChatSystem] sendButton:', this.sendButton);
        
        if (this.messageInput) {
            // 移除可能存在的舊事件監聽器
            this.messageInput.onkeypress = null;
            
            const keyPressHandler = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    console.log('[ChatSystem] Enter鍵觸發sendMessage');
                    this.sendMessage();
                }
            };
            
            this.messageInput.addEventListener('keypress', keyPressHandler);
            console.log('[ChatSystem] 已綁定Enter鍵事件');
        } else {
            console.error('[ChatSystem] 無法綁定鍵盤事件：messageInput為空');
        }
        
        if (this.sendButton) {
            // 移除可能存在的舊事件監聽器
            this.sendButton.onclick = null;
            
            const clickHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[ChatSystem] 按鈕點擊觸發sendMessage');
                this.sendMessage();
            };
            
            this.sendButton.addEventListener('click', clickHandler);
            console.log('[ChatSystem] 已綁定按鈕點擊事件');
            
            // 同時設置onclick作為備用（防止其他代碼干擾）
            this.sendButton.onclick = clickHandler;
        } else {
            console.error('[ChatSystem] 無法綁定點擊事件：sendButton為空');
        }
        
        console.log('[ChatSystem] 事件綁定完成');
    }
    
    sendMessage() {
        console.log('[ChatSystem] sendMessage被調用');
        console.log('[ChatSystem] 當前用戶角色:', this.isStreamer ? 'broadcaster' : 'viewer');
        console.log('[ChatSystem] 當前用戶名:', this.username);
        console.log('[ChatSystem] 輸入框:', this.messageInput);
        console.log('[ChatSystem] 連接狀態:', this.isConnected);
        console.log('[ChatSystem] WebSocket狀態:', this.socket ? this.socket.readyState : 'null');
        
        if (!this.messageInput) {
            console.error('[ChatSystem] 沒有找到輸入框');
            return;
        }
        
        const text = this.messageInput.value.trim();
        console.log('[ChatSystem] 輸入文本:', text);
        
        if (!text) {
            console.warn('[ChatSystem] 文本為空');
            return;
        }
        
        // 獲取正確的用戶名稱
        let actualUsername = this.username;
        if (this.isStreamer) {
            // 主播使用登入的真實姓名
            if (window.getCurrentUser && typeof window.getCurrentUser === 'function') {
                actualUsername = window.getCurrentUser();
            } else if (window.currentUser && window.currentUser.displayName) {
                actualUsername = window.currentUser.displayName;
            }
        } else {
            // 觀眾使用Ghost名稱或登入名稱
            if (window.assignedGhostName && !window.currentUser) {
                actualUsername = window.assignedGhostName;
            } else if (window.currentUser && window.currentUser.displayName) {
                actualUsername = window.currentUser.displayName;
            }
        }
        
        // 獲取broadcasterId
        let broadcasterId = 'global'; // 默認聊天室
        
        if (this.isStreamer) {
            // 主播使用自己的broadcaster ID
            if (typeof getBroadcasterId === 'function') {
                broadcasterId = getBroadcasterId();
            } else if (window.broadcasterId) {
                broadcasterId = window.broadcasterId;
            }
        } else {
            // 觀眾使用URL參數或全局變量中的broadcaster ID
            const urlParams = new URLSearchParams(window.location.search);
            broadcasterId = urlParams.get('broadcasterId') || 
                           urlParams.get('broadcaster') || 
                           window.currentBroadcasterId || 
                           'global';
        }
        
        const message = {
            type: 'chat',
            role: this.isStreamer ? 'broadcaster' : 'viewer',
            username: actualUsername,
            message: text,
            broadcasterId: broadcasterId,
            timestamp: new Date().toISOString()
        };
        
        console.log('[ChatSystem] 準備發送消息:', message);
        
        if (this.isConnected && this.socket) {
            try {
                this.socket.send(JSON.stringify(message));
                console.log('[ChatSystem] 已成功發送訊息到WebSocket:', message);
                
                // 不立即顯示自己的訊息，等待服務器回傳統一處理
                // this.addMessage(message);
                
            } catch (error) {
                console.error('[ChatSystem] 發送訊息失敗:', error);
                this.addSystemMessage('發送失敗，訊息已加入待發送隊列');
                this.messageQueue.push(message);
            }
        } else {
            console.error('[ChatSystem] 無法發送，連接狀態異常');
            console.error('[ChatSystem] isConnected:', this.isConnected);
            console.error('[ChatSystem] socket:', this.socket);
            
            // 離線時加入隊列
            this.messageQueue.push(message);
            this.addSystemMessage('離線中，訊息將在連線後發送');
        }
        
        // 清空輸入框
        this.messageInput.value = '';
        console.log('[ChatSystem] 已清空輸入框');
    }
    
    handleMessage(data) {
        console.log('[ChatSystem] 收到訊息:', data);
        console.log('[ChatSystem] 當前用戶角色:', this.isStreamer ? 'broadcaster' : 'viewer');
        console.log('[ChatSystem] 當前用戶名:', this.username);
        
        switch (data.type) {
            case 'chat':
                console.log('[ChatSystem] 處理聊天訊息:', data);
                console.log('[ChatSystem] 訊息發送者:', data.username, '當前用戶:', this.username);
                console.log('[ChatSystem] 訊息角色:', data.role, '當前角色:', this.isStreamer ? 'broadcaster' : 'viewer');
                
                // 主播模式：顯示所有消息（包括自己的）
                // 觀眾模式：也顯示所有消息（包括自己的），移除重複檢查邏輯
                console.log('[ChatSystem] 顯示消息');
                this.addMessage(data);
                break;
                
            case 'chat_join_ack':
                // 靜默處理加入確認，不顯示系統訊息
                console.log('已加入聊天室:', data.role);
                break;
                
            case 'system':
                // 忽略系統訊息，保持聊天室乾淨
                break;
                
            case 'user_count':
                this.updateUserCount(data.count);
                break;
                
            default:
                console.log('[ChatSystem] 未處理的訊息類型:', data.type);
        }
    }
    
    addMessage(data) {
        console.log('[ChatSystem] addMessage 被呼叫，數據:', data);
        console.log('[ChatSystem] 聊天容器:', this.chatContainer);
        console.log('[ChatSystem] 訊息角色:', data.role, '當前用戶角色:', this.isStreamer ? 'broadcaster' : 'viewer');
        
        if (!this.chatContainer) {
            console.error('[ChatSystem] 聊天容器未找到！');
            return;
        }
        
        // 過濾掉連線相關的系統訊息
        if (data.role === 'system' && data.message) {
            const message = data.message.toLowerCase();
            if (message.includes('連接') || 
                message.includes('連線') || 
                message.includes('ice') ||
                message.includes('視訊') ||
                message.includes('回應已處理') ||
                message.includes('連接成功') ||
                message.includes('連接回應')) {
                console.log('[ChatSystem] 過濾連線系統訊息:', data.message);
                return; // 不顯示這些系統訊息
            }
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        
        // 設定訊息樣式
        if (data.role === 'system') {
            messageDiv.classList.add('system');
        } else if (data.role === 'broadcaster') {
            messageDiv.classList.add('broadcaster');
        } else {
            messageDiv.classList.add('viewer');
        }
        
        // 格式化時間
        const time = new Date(data.timestamp || Date.now()).toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // 建立訊息內容
        messageDiv.innerHTML = `
            <div class="message-avatar">
                ${this.getAvatarHTML(data.role, data.username)}
            </div>
            <div class="message-content-wrapper">
                <div class="message-bubble">
                    <div class="message-header">
                        <span class="username">${this.escapeHTML(data.username || '匿名')}</span>
                        <span class="timestamp">${time}</span>
                    </div>
                    <div class="message-content">${this.escapeHTML(data.message || '')}</div>
                </div>
            </div>
        `;
        
        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        console.log('已顯示訊息:', data.username, ':', data.message);
    }
    
    addSystemMessage(text) {
        this.addMessage({
            type: 'chat',
            role: 'system',
            username: '系統',
            message: text,
            timestamp: new Date().toISOString()
        });
    }
    
    getAvatarHTML(role, username) {
        switch (role) {
            case 'system':
                return '<i class="fas fa-cog"></i>';
            case 'broadcaster':
                return '<i class="fas fa-star"></i>';
            case 'viewer':
                return username ? username.charAt(0).toUpperCase() : 'V';
            default:
                return '<i class="fas fa-user"></i>';
        }
    }
    
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    scrollToBottom() {
        if (this.chatContainer) {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }
    }
    
    processMessageQueue() {
        if (!this.isConnected || !this.socket) return;
        
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            try {
                this.socket.send(JSON.stringify(message));
                console.log('已發送排隊訊息:', message);
                // 不要在這裡顯示訊息，等待伺服器回傳
            } catch (error) {
                console.error('發送排隊訊息失敗:', error);
                this.messageQueue.unshift(message); // 放回隊列前端
                break;
            }
        }
    }
    
    updateUserCount(count) {
        // 更新使用者數量顯示
        const elements = document.querySelectorAll('#viewerCount, #chatViewerCount');
        elements.forEach(el => {
            if (el) el.textContent = count;
        });
    }
    
    destroy() {
        // 移除事件監聽器（如果使用共享WebSocket）
        if (this.socket && this.messageHandler) {
            this.socket.removeEventListener('message', this.messageHandler);
        }
        
        // 如果是獨立的聊天WebSocket，則關閉它
        if (this.socket && !this.isStreamer) {
            this.socket.close();
        }
        
        this.socket = null;
        this.messageHandler = null;
        this.isConnected = false;
    }
}

// 全域初始化函數
window.initChatSystem = function(options = {}) {
    console.log('=== ChatSystem 初始化開始 ===');
    console.log('傳入選項:', options);
    
    // 如果已經初始化過，先清理舊的實例
    if (window.chatSystem) {
        console.log('清理舊的聊天系統實例');
        if (window.chatSystem.destroy) {
            window.chatSystem.destroy();
        }
    }
    
    // 檢測是否為主播頁面
    const isStreamerPage = window.location.pathname.includes('livestream_platform') || 
                          document.title.includes('主播') ||
                          document.querySelector('.stream-controls');
    
    options.isStreamer = options.isStreamer !== undefined ? options.isStreamer : isStreamerPage;
    
    console.log('最終選項:', options);
    console.log('檢測到的頁面類型:', options.isStreamer ? '主播' : '觀眾');
    
    // 創建聊天系統實例
    window.chatSystem = new ChatSystem(options);
    
    console.log('ChatSystem實例已創建:', window.chatSystem);
    console.log('=== ChatSystem 初始化結束 ===');
    
    return window.chatSystem;
};

// 全局調試函數
window.debugChatSystem = function() {
    console.log('=== ChatSystem 調試信息 ===');
    console.log('chatSystem存在:', !!window.chatSystem);
    if (window.chatSystem) {
        console.log('isReady:', window.chatSystem.isReady);
        console.log('isConnected:', window.chatSystem.isConnected);
        console.log('isStreamer:', window.chatSystem.isStreamer);
        console.log('username:', window.chatSystem.username);
        console.log('messageInput:', !!window.chatSystem.messageInput);
        console.log('sendButton:', !!window.chatSystem.sendButton);
        console.log('chatContainer:', !!window.chatSystem.chatContainer);
        console.log('socket狀態:', window.chatSystem.socket ? window.chatSystem.socket.readyState : 'null');
    }
    console.log('=== 調試信息結束 ===');
};

// 全局測試發送函數
window.testSendMessage = function(text = '測試消息') {
    console.log('=== 測試發送消息 ===');
    if (window.chatSystem) {
        console.log('模擬發送消息:', text);
        if (window.chatSystem.messageInput) {
            window.chatSystem.messageInput.value = text;
            window.chatSystem.sendMessage();
        } else {
            console.error('messageInput不存在');
        }
    } else {
        console.error('ChatSystem不存在');
    }
};

// 注意：移除自動初始化，讓頁面手動控制初始化時機