/**
 * 純REST API聊天系統 - 無需WebSocket
 * 使用HTTP請求進行聊天通信
 */

class RestChatSystem {
    constructor(options = {}) {
        this.isStreamer = options.isStreamer || false;
        this.username = options.username || (this.isStreamer ? '主播' : '觀眾');
        this.chatContainer = null;
        this.messageInput = null;
        this.sendButton = null;
        this.polling = null;
        this.lastMessageId = 0;
        
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
        this.bindEvents();
        this.startPolling();
        this.addSystemMessage('✅ 聊天室已連接 (REST API)');
    }
    
    initDOM() {
        this.chatContainer = document.querySelector(this.selectors.chatContainer);
        this.messageInput = document.querySelector(this.selectors.messageInput);
        this.sendButton = document.querySelector(this.selectors.sendButton);
        
        if (!this.chatContainer) {
            console.error('找不到聊天容器:', this.selectors.chatContainer);
            return;
        }
        
        if (!this.messageInput) {
            console.error('找不到訊息輸入框:', this.selectors.messageInput);
            return;
        }
        
        console.log('✅ REST聊天系統DOM初始化完成');
    }
    
    bindEvents() {
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.sendMessage());
        }
        
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
    }
    
    async sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text) {
            console.log('[RestChat] 文本為空');
            return;
        }
        
        const message = {
            username: this.username,
            message: text,
            role: this.isStreamer ? 'broadcaster' : 'viewer',
            timestamp: new Date().toISOString()
        };
        
        try {
            const response = await fetch('/api/chat/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(message)
            });
            
            if (response.ok) {
                console.log('[RestChat] 訊息發送成功');
                this.messageInput.value = '';
                // 立即獲取新訊息
                this.fetchMessages();
            } else {
                console.error('[RestChat] 訊息發送失敗');
                this.addSystemMessage('❌ 訊息發送失敗');
            }
        } catch (error) {
            console.error('[RestChat] 發送錯誤:', error);
            this.addSystemMessage('❌ 網路錯誤，請重試');
        }
    }
    
    async fetchMessages() {
        try {
            const response = await fetch(`/api/chat/messages?since=${this.lastMessageId}`);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(msg => {
                        this.displayMessage(msg);
                        this.lastMessageId = Math.max(this.lastMessageId, msg.id || 0);
                    });
                }
            }
        } catch (error) {
            console.error('[RestChat] 獲取訊息錯誤:', error);
        }
    }
    
    startPolling() {
        // 每2秒獲取新訊息
        this.polling = setInterval(() => {
            this.fetchMessages();
        }, 2000);
        
        // 立即獲取一次
        this.fetchMessages();
    }
    
    stopPolling() {
        if (this.polling) {
            clearInterval(this.polling);
            this.polling = null;
        }
    }
    
    displayMessage(message) {
        if (!this.chatContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        
        const timeString = new Date(message.timestamp).toLocaleTimeString();
        const roleClass = message.role === 'broadcaster' ? 'broadcaster' : 'viewer';
        
        messageDiv.innerHTML = `
            <div class="message-content ${roleClass}">
                <span class="username">${message.username}:</span>
                <span class="text">${message.message}</span>
                <span class="time">${timeString}</span>
            </div>
        `;
        
        this.chatContainer.appendChild(messageDiv);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
    
    addSystemMessage(message) {
        if (!this.chatContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.innerHTML = `
            <div class="message-content system">
                <span class="text">${message}</span>
            </div>
        `;
        
        this.chatContainer.appendChild(messageDiv);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
}

// 全域函數，供其他腳本使用
window.RestChatSystem = RestChatSystem;







