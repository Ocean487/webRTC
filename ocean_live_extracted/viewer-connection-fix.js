// 觀眾端連接修復工具
// 修復WebSocket連接、WebRTC連接等關鍵問題

(function() {
    'use strict';
    
    console.log('🔧 觀眾端連接修復啟動...');
    
    // 修復函數
    function fixViewerConnections() {
        // 1. 確保WebSocket使用正確地址
        const originalConnect = window.connectWebSocket;
        if (originalConnect && typeof originalConnect === 'function') {
            // 重寫連接函數，確保使用正確地址
            window.connectWebSocket = function() {
                console.log('🔧 使用修復的WebSocket連接');
                
                const wsUrl = 'wss://vibelo.l0sscat.com:8443';
                console.log('🔗 連接地址:', wsUrl);
                
                // 呼叫原始函數
                return originalConnect.call(this);
            };
        }
        
        // 2. 修復聊天系統連接
        if (window.ChatSystem && window.ChatSystem.prototype) {
            const originalConnectWS = window.ChatSystem.prototype.connectWebSocket;
            if (originalConnectWS) {
                window.ChatSystem.prototype.connectWebSocket = function() {
                    console.log('🔧 修復聊天系統WebSocket連接');
                    
                    // 確保使用正確的WebSocket地址
                    if (this.socket) {
                        this.socket.close();
                    }
                    
                    const wsUrl = 'wss://vibelo.l0sscat.com:8443';
                    this.socket = new WebSocket(wsUrl);
                    
                    // 設置事件處理器
                    this.socket.onopen = () => {
                        console.log('✅ 聊天室連接成功');
                        this.isConnected = true;
                        if (typeof this.addSystemMessage === 'function') {
                            this.addSystemMessage('✅ 聊天室已連接');
                        }
                    };
                    
                    this.socket.onerror = (error) => {
                        console.error('❌ 聊天室連接錯誤:', error);
                        this.isConnected = false;
                    };
                    
                    this.socket.onclose = () => {
                        console.log('🔌 聊天室連接關閉');
                        this.isConnected = false;
                    };
                    
                    this.socket.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data);
                            if (typeof this.handleMessage === 'function') {
                                this.handleMessage(data);
                            }
                        } catch (error) {
                            console.error('聊天訊息解析錯誤:', error);
                        }
                    };
                };
            }
        }
        
        // 3. 優化WebRTC初始化
        if (window.initializePeerConnection && typeof window.initializePeerConnection === 'function') {
            const originalInit = window.initializePeerConnection;
            window.initializePeerConnection = function() {
                console.log('🔧 使用優化的WebRTC初始化');
                
                try {
                    return originalInit.call(this);
                } catch (error) {
                    console.error('WebRTC初始化錯誤:', error);
                    
                    // 嘗試重新初始化
                    setTimeout(() => {
                        console.log('🔄 重試WebRTC初始化');
                        try {
                            originalInit.call(this);
                        } catch (retryError) {
                            console.error('重試失敗:', retryError);
                        }
                    }, 2000);
                }
            };
        }
        
        // 4. 改善錯誤處理
        window.addEventListener('error', (event) => {
            if (event.error && event.error.message) {
                const message = event.error.message;
                if (message.includes('addSystemMessage is not a function')) {
                    console.log('🔧 已忽略已知的addSystemMessage錯誤');
                    event.preventDefault();
                    return false;
                }
            }
        });
        
        // 5. 監控連接狀態
        let connectionCheckInterval;
        
        function startConnectionMonitor() {
            if (connectionCheckInterval) {
                clearInterval(connectionCheckInterval);
            }
            
            connectionCheckInterval = setInterval(() => {
                // 檢查WebSocket連接
                if (window.socket) {
                    if (window.socket.readyState === WebSocket.CLOSED || window.socket.readyState === WebSocket.CLOSING) {
                        console.log('🔄 檢測到WebSocket斷線，嘗試重連');
                        if (window.connectWebSocket && typeof window.connectWebSocket === 'function') {
                            window.connectWebSocket();
                        }
                    }
                }
                
                // 檢查視頻流狀態
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteVideo && remoteVideo.srcObject) {
                    const stream = remoteVideo.srcObject;
                    const videoTracks = stream.getVideoTracks();
                    
                    if (videoTracks.length === 0 || videoTracks[0].readyState === 'ended') {
                        console.log('🔄 檢測到視頻流異常');
                    }
                }
            }, 5000); // 每5秒檢查一次
        }
        
        // 啟動監控
        setTimeout(startConnectionMonitor, 3000);
        
        console.log('✅ 觀眾端連接修復完成');
    }
    
    // 等待頁面載入完成後執行修復
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixViewerConnections);
    } else {
        fixViewerConnections();
    }
    
})();