// 網路連接監控和自動重連機制
// 針對 WebRTC 在複雜網路環境下的連接優化

class NetworkMonitor {
    constructor() {
        this.isOnline = navigator.onLine;
        this.connectionQuality = 'unknown';
        this.lastConnectionTest = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000; // 起始重連延遲
        this.webrtcConnections = new Map(); // 追蹤 WebRTC 連接
        
        this.init();
    }
    
    init() {
        console.log('🌐 網路監控初始化...');
        
        // 監聽網路狀態變化
        window.addEventListener('online', () => this.handleOnlineEvent());
        window.addEventListener('offline', () => this.handleOfflineEvent());
        
        // 監聽 WebRTC 連接狀態
        this.setupWebRTCMonitoring();
        
        // 定期網路品質檢測
        this.startQualityMonitoring();
        
        // 頁面可見性變化監聽（用戶切換標籤頁）
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        
        console.log('✅ 網路監控已啟動');
    }
    
    // 處理上線事件
    handleOnlineEvent() {
        console.log('🌐 網路已連接');
        this.isOnline = true;
        this.displayNetworkMessage('🌐 網路已恢復連接', 'success');
        
        // 重置重連計數器
        this.reconnectAttempts = 0;
        
        // 嘗試恢復 WebSocket 和 WebRTC 連接
        this.attemptReconnection();
        
        // 重新開始品質監測
        this.startQualityMonitoring();
    }
    
    // 處理離線事件
    handleOfflineEvent() {
        console.log('❌ 網路已斷開');
        this.isOnline = false;
        this.connectionQuality = 'offline';
        this.displayNetworkMessage('❌ 網路連接已斷開，正在嘗試重新連接...', 'error');
        
        // 停止品質監測
        this.stopQualityMonitoring();
    }
    
    // 處理頁面可見性變化
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            console.log('👁️ 頁面重新獲得焦點，檢查連接狀態...');
            // 頁面重新可見時，檢查並恢復連接
            setTimeout(() => {
                this.checkConnectionStatus();
            }, 1000);
        }
    }
    
    // 設置 WebRTC 連接監控
    setupWebRTCMonitoring() {
        // 定期檢查 WebRTC 連接狀態
        setInterval(() => {
            this.monitorWebRTCConnections();
        }, 5000);
    }
    
    // 監控 WebRTC 連接
    monitorWebRTCConnections() {
        // 檢查全局 peerConnection 變數（觀眾端）
        if (window.peerConnection) {
            this.checkWebRTCConnection('viewer', window.peerConnection);
        }
        
        // 檢查主播端的連接（如果存在）
        if (window.peerConnections) {
            window.peerConnections.forEach((connection, viewerId) => {
                this.checkWebRTCConnection(viewerId, connection);
            });
        }
    }
    
    // 檢查單個 WebRTC 連接
    checkWebRTCConnection(connectionId, peerConnection) {
        if (!peerConnection) return;
        
        const connectionState = peerConnection.connectionState;
        const iceConnectionState = peerConnection.iceConnectionState;
        
        // 記錄連接狀態變化
        const lastState = this.webrtcConnections.get(connectionId);
        if (lastState !== connectionState) {
            console.log(`📡 WebRTC 連接 ${connectionId} 狀態: ${connectionState} (ICE: ${iceConnectionState})`);
            this.webrtcConnections.set(connectionId, connectionState);
        }
        
        // 處理連接失敗或斷開
        if (connectionState === 'failed' || connectionState === 'disconnected') {
            console.warn(`⚠️ WebRTC 連接 ${connectionId} 出現問題: ${connectionState}`);
            this.handleWebRTCFailure(connectionId, peerConnection);
        }
        
        // 處理 ICE 連接失敗
        if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected') {
            console.warn(`🧊 ICE 連接 ${connectionId} 出現問題: ${iceConnectionState}`);
            this.handleICEFailure(connectionId, peerConnection);
        }
    }
    
    // 處理 WebRTC 連接失敗
    handleWebRTCFailure(connectionId, peerConnection) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`❌ WebRTC 連接 ${connectionId} 重連次數已達上限`);
            this.displayNetworkMessage('❌ 連接失敗，請刷新頁面重試', 'error');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指數退避
        
        console.log(`🔄 將在 ${delay}ms 後嘗試重連 WebRTC 連接 ${connectionId} (第 ${this.reconnectAttempts} 次)`);
        
        setTimeout(() => {
            this.attemptWebRTCReconnection(connectionId, peerConnection);
        }, delay);
    }
    
    // 處理 ICE 連接失敗
    handleICEFailure(connectionId, peerConnection) {
        console.log(`🔄 嘗試重啟 ICE 連接 ${connectionId}...`);
        
        try {
            // 重啟 ICE 收集過程
            peerConnection.restartIce();
            this.displayNetworkMessage('🔄 正在重新建立連接...', 'warning');
        } catch (error) {
            console.error('❌ ICE 重啟失敗:', error);
        }
    }
    
    // 嘗試 WebRTC 重連
    attemptWebRTCReconnection(connectionId, peerConnection) {
        console.log(`🔄 開始重連 WebRTC 連接 ${connectionId}...`);
        
        // 對於觀眾端，嘗試重新初始化連接
        if (connectionId === 'viewer' && window.initializePeerConnection) {
            try {
                // 關閉舊連接
                peerConnection.close();
                
                // 重新初始化
                window.initializePeerConnection();
                
                this.displayNetworkMessage('🔄 正在重新連接直播...', 'warning');
            } catch (error) {
                console.error('❌ 觀眾端重連失敗:', error);
            }
        }
        
        // 對於主播端，需要重新建立與觀眾的連接
        if (connectionId !== 'viewer' && window.handleViewerJoin) {
            try {
                // 這裡需要與服務器協調重新建立連接
                console.log(`🔄 嘗試重新建立與觀眾 ${connectionId} 的連接`);
            } catch (error) {
                console.error(`❌ 與觀眾 ${connectionId} 重連失敗:`, error);
            }
        }
    }
    
    // 嘗試重新連接
    attemptReconnection() {
        console.log('🔄 開始重新連接流程...');
        
        // 重連 WebSocket
        if (window.connectWebSocket && typeof window.connectWebSocket === 'function') {
            setTimeout(() => {
                try {
                    window.connectWebSocket();
                } catch (error) {
                    console.error('❌ WebSocket 重連失敗:', error);
                }
            }, 1000);
        }
        
        // 重連聊天系統
        if (window.chatSystem && window.chatSystem.reconnect) {
            setTimeout(() => {
                try {
                    window.chatSystem.reconnect();
                } catch (error) {
                    console.error('❌ 聊天系統重連失敗:', error);
                }
            }, 2000);
        }
    }
    
    // 開始網路品質監測
    startQualityMonitoring() {
        // 停止之前的監測
        this.stopQualityMonitoring();
        
        // 每 30 秒檢測一次網路品質
        this.qualityMonitorInterval = setInterval(() => {
            this.testNetworkQuality();
        }, 30000);
        
        // 立即執行一次
        this.testNetworkQuality();
    }
    
    // 停止網路品質監測
    stopQualityMonitoring() {
        if (this.qualityMonitorInterval) {
            clearInterval(this.qualityMonitorInterval);
            this.qualityMonitorInterval = null;
        }
    }
    
    // 測試網路品質
    async testNetworkQuality() {
        if (!this.isOnline) return;
        
        try {
            const startTime = performance.now();
            
            // 使用現有的用戶會話檢查端點
            const response = await fetch('/api/session/check', {
                method: 'GET',
                cache: 'no-cache'
            });
            
            const endTime = performance.now();
            const latency = endTime - startTime;
            
            if (response.ok) {
                this.updateConnectionQuality(latency);
                this.lastConnectionTest = new Date();
            } else {
                this.connectionQuality = 'poor';
                console.warn('⚠️ 服務器回應異常');
            }
        } catch (error) {
            console.warn('⚠️ 網路品質檢測失敗:', error);
            this.connectionQuality = 'poor';
            
            // 如果連續失敗，嘗試重連
            if (!this.lastConnectionTest || (Date.now() - this.lastConnectionTest.getTime()) > 60000) {
                this.attemptReconnection();
            }
        }
    }
    
    // 更新連接品質評估
    updateConnectionQuality(latency) {
        let quality;
        
        if (latency < 100) {
            quality = 'excellent';
        } else if (latency < 300) {
            quality = 'good';
        } else if (latency < 1000) {
            quality = 'fair';
        } else {
            quality = 'poor';
        }
        
        if (this.connectionQuality !== quality) {
            this.connectionQuality = quality;
            console.log(`📊 網路品質: ${quality} (延遲: ${Math.round(latency)}ms)`);
            
            // 根據網路品質調整 WebRTC 參數
            this.adjustWebRTCQuality(quality);
        }
    }
    
    // 根據網路品質調整 WebRTC 參數
    adjustWebRTCQuality(quality) {
        // 這裡可以實現根據網路品質動態調整視頻品質的邏輯
        console.log(`🎯 根據網路品質 ${quality} 調整連接參數`);
        
        if (quality === 'poor' && window.peerConnection) {
            // 網路品質差時，可以嘗試降低視頻品質或重啟連接
            console.log('📉 網路品質較差，建議降低視頻品質');
        }
    }
    
    // 檢查連接狀態
    checkConnectionStatus() {
        console.log('🔍 檢查所有連接狀態...');
        
        // 檢查基本網路連接
        if (!navigator.onLine) {
            this.handleOfflineEvent();
            return;
        }
        
        // 檢查 WebSocket 連接
        if (window.socket) {
            const wsState = window.socket.readyState;
            console.log(`📡 WebSocket 狀態: ${wsState}`);
            
            if (wsState !== WebSocket.OPEN) {
                console.log('🔄 WebSocket 未連接，嘗試重新連接...');
                this.attemptReconnection();
            }
        }
        
        // 檢查 WebRTC 連接
        this.monitorWebRTCConnections();
        
        // 執行網路品質測試
        this.testNetworkQuality();
    }
    
    // 顯示網路消息
    displayNetworkMessage(message, type = 'info') {
        console.log(`📢 ${message}`);
        
        // 如果存在聊天系統，使用聊天系統顯示消息
        if (window.displaySystemMessage && typeof window.displaySystemMessage === 'function') {
            window.displaySystemMessage(message);
        }
        
        // 創建臨時通知
        this.showNotification(message, type);
    }
    
    // 顯示通知
    showNotification(message, type) {
        // 移除舊通知
        const oldNotification = document.querySelector('.network-notification');
        if (oldNotification) {
            oldNotification.remove();
        }
        
        // 創建新通知
        const notification = document.createElement('div');
        notification.className = `network-notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        // 設置顏色
        switch (type) {
            case 'success':
                notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                break;
            case 'warning':
                notification.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
                break;
            case 'error':
                notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                break;
            default:
                notification.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // 顯示動畫
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // 自動隱藏
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 5000);
    }
    
    // 獲取網路狀態摘要
    getNetworkStatus() {
        return {
            isOnline: this.isOnline,
            quality: this.connectionQuality,
            lastTest: this.lastConnectionTest,
            reconnectAttempts: this.reconnectAttempts,
            webrtcConnections: Object.fromEntries(this.webrtcConnections)
        };
    }
    
    // 手動觸發重連
    manualReconnect() {
        console.log('🔄 手動觸發重連...');
        this.reconnectAttempts = 0; // 重置計數器
        this.attemptReconnection();
    }
    
    // 清理資源
    destroy() {
        this.stopQualityMonitoring();
        window.removeEventListener('online', this.handleOnlineEvent);
        window.removeEventListener('offline', this.handleOfflineEvent);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        
        console.log('🗑️ 網路監控已清理');
    }
}

// 全局初始化
window.networkMonitor = new NetworkMonitor();

// 為其他腳本提供接口
window.getNetworkStatus = () => window.networkMonitor.getNetworkStatus();
window.manualReconnect = () => window.networkMonitor.manualReconnect();

console.log('🌐 網路監控模組已載入');
