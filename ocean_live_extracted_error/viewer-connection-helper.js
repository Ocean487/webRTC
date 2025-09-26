// 觀眾連接輔助工具
// 提供手動重連和連接狀態監控功能

(function() {
    'use strict';
    
    console.log('🔧 觀眾連接輔助工具啟動...');
    
    let statusElement = null;
    let retryButton = null;
    let connectionInfo = null;
    
    // 等待頁面載入
    function waitForPageReady() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
    }
    
    // 創建連接狀態顯示器
    function createConnectionStatusDisplay() {
        // 移除已存在的狀態顯示器
        const existing = document.getElementById('viewer-connection-status');
        if (existing) existing.remove();
        
        // 創建狀態容器
        const container = document.createElement('div');
        container.id = 'viewer-connection-status';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px;
            border-radius: 10px;
            font-size: 14px;
            z-index: 1001;
            min-width: 200px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        `;
        
        // 狀態文字
        statusElement = document.createElement('div');
        statusElement.style.cssText = `
            margin-bottom: 10px;
            font-weight: 600;
        `;
        
        // 連接信息
        connectionInfo = document.createElement('div');
        connectionInfo.style.cssText = `
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 10px;
            line-height: 1.4;
        `;
        
        // 重試按鈕
        retryButton = document.createElement('button');
        retryButton.textContent = '🔄 重新連接';
        retryButton.style.cssText = `
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            width: 100%;
            transition: background 0.3s;
        `;
        
        retryButton.onmouseover = () => retryButton.style.background = '#5a67d8';
        retryButton.onmouseout = () => retryButton.style.background = '#667eea';
        
        retryButton.onclick = () => {
            console.log('🔄 手動重新連接');
            updateStatus('reconnecting', '正在重新連接...');
            retryButton.disabled = true;
            retryButton.textContent = '重連中...';
            
            // 呼叫重連函數
            if (typeof window.connectWebSocket === 'function') {
                window.connectWebSocket();
            }
            
            // 3秒後重新啟用按鈕
            setTimeout(() => {
                retryButton.disabled = false;
                retryButton.textContent = '🔄 重新連接';
            }, 3000);
        };
        
        // 組裝元素
        container.appendChild(statusElement);
        container.appendChild(connectionInfo);
        container.appendChild(retryButton);
        
        document.body.appendChild(container);
        
        console.log('✅ 連接狀態顯示器已創建');
    }
    
    // 更新連接狀態
    function updateStatus(status, message, details = {}) {
        if (!statusElement) return;
        
        const statusColors = {
            connecting: '#ffa500',
            connected: '#4CAF50',
            disconnected: '#f44336',
            error: '#f44336',
            reconnecting: '#2196F3'
        };
        
        const statusIcons = {
            connecting: '🔄',
            connected: '✅',
            disconnected: '❌',
            error: '⚠️',
            reconnecting: '🔄'
        };
        
        statusElement.style.color = statusColors[status] || '#fff';
        statusElement.textContent = `${statusIcons[status] || '?'} ${message}`;
        
        // 更新連接信息
        if (connectionInfo) {
            const socket = window.socket;
            const isConnected = window.isConnected;
            const viewerId = window.viewerId;
            const targetStreamerId = window.targetStreamerId;
            
            connectionInfo.innerHTML = `
                觀眾ID: ${viewerId ? viewerId.substr(-6) : 'N/A'}<br>
                主播ID: ${targetStreamerId || 'default'}<br>
                WebSocket: ${socket ? getSocketStateText(socket.readyState) : '未創建'}<br>
                連接狀態: ${isConnected ? '已連接' : '未連接'}<br>
                ${details.extra ? details.extra + '<br>' : ''}
                時間: ${new Date().toLocaleTimeString()}
            `;
        }
        
        // 根據狀態控制按鈕顯示
        if (retryButton) {
            if (status === 'connected') {
                retryButton.style.display = 'none';
            } else {
                retryButton.style.display = 'block';
            }
        }
    }
    
    // 獲取Socket狀態文字
    function getSocketStateText(state) {
        const states = {
            [WebSocket.CONNECTING]: '連接中',
            [WebSocket.OPEN]: '已開啟',
            [WebSocket.CLOSING]: '關閉中',
            [WebSocket.CLOSED]: '已關閉'
        };
        return states[state] || '未知';
    }
    
    // 監聽全局變數變化
    function setupGlobalListeners() {
        // 監聽連接狀態變化
        let lastIsConnected = null;
        let lastSocketState = null;
        
        setInterval(() => {
            const isConnected = window.isConnected;
            const socket = window.socket;
            const socketState = socket ? socket.readyState : null;
            
            // 檢查連接狀態變化
            if (isConnected !== lastIsConnected || socketState !== lastSocketState) {
                if (isConnected && socketState === WebSocket.OPEN) {
                    updateStatus('connected', '已連接到直播間');
                } else if (socketState === WebSocket.CONNECTING) {
                    updateStatus('connecting', '正在連接...');
                } else if (socketState === WebSocket.CLOSED || socketState === null) {
                    updateStatus('disconnected', '連接已斷開');
                } else {
                    updateStatus('error', '連接異常');
                }
                
                lastIsConnected = isConnected;
                lastSocketState = socketState;
            }
        }, 1000);
    }
    
    // 添加鍵盤快捷鍵
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl + R: 重新連接
            if (event.ctrlKey && event.key === 'r') {
                event.preventDefault();
                console.log('⌨️ 鍵盤快捷鍵觸發重連');
                if (retryButton && !retryButton.disabled) {
                    retryButton.click();
                }
            }
            
            // Ctrl + D: 運行診斷
            if (event.ctrlKey && event.key === 'd') {
                event.preventDefault();
                console.log('⌨️ 鍵盤快捷鍵觸發診斷');
                if (typeof window.runViewerDiagnostic === 'function') {
                    window.runViewerDiagnostic();
                }
            }
        });
        
        console.log('⌨️ 鍵盤快捷鍵已設置: Ctrl+R 重連, Ctrl+D 診斷');
    }
    
    // 添加自動診斷
    function setupAutoDiagnostic() {
        // 如果5秒後還沒連接成功，自動運行診斷
        setTimeout(() => {
            if (!window.isConnected && typeof window.runViewerDiagnostic === 'function') {
                console.log('🔍 自動觸發連接診斷...');
                window.runViewerDiagnostic();
            }
        }, 5000);
    }
    
    // 主初始化函數
    async function init() {
        // 禁用連接狀態顯示器
        console.log('🚫 連接狀態顯示器已禁用');
        return;
        
        // 只在觀眾頁面運行
        if (!window.location.pathname.includes('viewer')) {
            return;
        }
        
        await waitForPageReady();
        
        createConnectionStatusDisplay();
        setupGlobalListeners();
        setupKeyboardShortcuts();
        setupAutoDiagnostic();
        
        // 初始狀態
        updateStatus('connecting', '初始化中...');
        
        console.log('✅ 觀眾連接輔助工具初始化完成');
    }
    
    // 提供外部接口
    window.updateViewerConnectionStatus = updateStatus;
    window.hideConnectionStatus = () => {
        const element = document.getElementById('viewer-connection-status');
        if (element) element.style.display = 'none';
    };
    window.showConnectionStatus = () => {
        const element = document.getElementById('viewer-connection-status');
        if (element) element.style.display = 'block';
    };
    
    // 啟動
    init();
    
    console.log('✅ 觀眾連接輔助工具已載入');
    
})();

console.log('🔧 觀眾連接輔助工具已載入');
