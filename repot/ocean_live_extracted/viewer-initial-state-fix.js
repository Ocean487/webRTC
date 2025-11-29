// 觀眾頁面初始狀態修復工具
// 解決直播前畫面異常顯示的問題

(function() {
    'use strict';
    
    console.log('🔧 觀眾頁面初始狀態修復啟動...');
    
    // 等待 DOM 載入完成
    function waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }
    
    // 修復初始狀態
    async function fixInitialState() {
        await waitForDOM();
        
        console.log('🎯 開始修復觀眾頁面初始狀態...');
        
        // 1. 確保 HTML 占位符完全隱藏
        const videoPlaceholder = document.getElementById('videoPlaceholder');
        const remoteVideo = document.getElementById('remoteVideo');
        const playPrompt = document.getElementById('playPrompt');
        
        if (videoPlaceholder) {
            // 強制隱藏 HTML 占位符，避免與 CSS 偽元素衝突
            videoPlaceholder.style.display = 'none';
            
            const h3 = videoPlaceholder.querySelector('h3');
            const p = videoPlaceholder.querySelector('p');
            
            if (h3) h3.style.display = 'none';
            if (p) p.style.display = 'none';
            
            console.log('✅ HTML 占位符已隱藏，使用 CSS 偽元素顯示等待文字');
        }
        
        // 2. 確保視頻元素正確隱藏
        if (remoteVideo) {
            remoteVideo.style.cssText = `
                display: none !important;
                width: 100% !important;
                height: auto !important;
                border-radius: 15px !important;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3) !important;
            `;
            
            // 清除任何可能的媒體流
            remoteVideo.srcObject = null;
            
            console.log('✅ 視頻元素已正確隱藏');
        }
        
        // 3. 隱藏播放提示
        if (playPrompt) {
            playPrompt.style.display = 'none';
            console.log('✅ 播放提示已隱藏');
        }
        
        // 4. 設置初始直播信息
        const streamerName = document.getElementById('streamerName');
        const streamTitle = document.getElementById('streamTitle');
        const statusText = document.getElementById('statusText');
        const liveIndicator = document.getElementById('liveIndicator');
        const viewerCount = document.getElementById('viewerCount');
        
        if (streamerName) {
            streamerName.textContent = '等待直播中...';
            streamerName.style.color = '#666';
        }
        
        if (streamTitle) {
            streamTitle.textContent = '主播尚未開始直播，請稍候...';
            streamTitle.style.color = '#999';
        }
        
        if (statusText) {
            statusText.textContent = '等待直播中';
            statusText.style.cssText = `
                color: #ffa500 !important;
                font-weight: 500 !important;
            `;
        }
        
        if (liveIndicator) {
            liveIndicator.style.display = 'none';
        }
        
        if (viewerCount) {
            viewerCount.textContent = '0';
        }
        
        console.log('✅ 直播信息已設置');
        
        // 5. 設置頁面標題
        document.title = '等待直播中 - VibeLo';
        
        // 6. 添加載入動畫
        addLoadingAnimation();
        
        console.log('✅ 觀眾頁面初始狀態修復完成');
    }
    
    // 添加連接狀態指示器
    function addConnectionStatus() {
        // 移除已存在的狀態指示器
        const existingStatus = document.getElementById('connection-status');
        if (existingStatus) existingStatus.remove();
        
        const statusDiv = document.createElement('div');
        statusDiv.id = 'connection-status';
        statusDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 15px;
            border-radius: 20px;
            font-size: 14px;
            z-index: 1000;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;
        
        statusDiv.innerHTML = `
            <i class="fas fa-circle" style="color: #ffa500; margin-right: 8px;"></i>
            準備中...
        `;
        
        document.body.appendChild(statusDiv);
        
        // 更新連接狀態的函數
        window.updateConnectionStatus = function(status, color, text) {
            const icon = statusDiv.querySelector('i');
            const textSpan = statusDiv.childNodes[1];
            
            if (icon) icon.style.color = color;
            if (textSpan) textSpan.textContent = text;
        };
        
        console.log('✅ 連接狀態指示器已添加');
    }
    
    // 添加載入動畫
    function addLoadingAnimation() {
        const videoPlaceholder = document.getElementById('videoPlaceholder');
        if (!videoPlaceholder) return;
        
        // 移除已存在的載入動畫
        const existingLoader = videoPlaceholder.querySelector('.loading-animation');
        if (existingLoader) existingLoader.remove();
        
        const loader = document.createElement('div');
        loader.className = 'loading-animation';
        loader.style.cssText = `
            margin-top: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        loader.innerHTML = `
            <div style="
                width: 40px;
                height: 40px;
                border: 3px solid rgba(255,255,255,0.3);
                border-top: 3px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
        `;
        
        // 添加旋轉動畫 CSS
        if (!document.getElementById('loading-animation-style')) {
            const style = document.createElement('style');
            style.id = 'loading-animation-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        videoPlaceholder.appendChild(loader);
        
        console.log('✅ 載入動畫已添加');
    }
    
    // 監聽直播開始事件
    function setupStreamStartListener() {
        // 監聽全局直播開始事件
        window.addEventListener('streamStarted', function() {
            console.log('🎬 檢測到直播開始');
            
            // 更新連接狀態
            if (window.updateConnectionStatus) {
                window.updateConnectionStatus('connected', '#4CAF50', '直播中');
            }
            
            // 更新頁面標題
            document.title = '觀看直播中 - VibeLo';
            
            // 移除載入動畫
            const loader = document.querySelector('.loading-animation');
            if (loader) loader.remove();
        });
        
        // 監聽連接狀態變化
        if (window.addEventListener) {
            window.addEventListener('webrtcStateChange', function(event) {
                const { state } = event.detail || {};
                
                if (window.updateConnectionStatus) {
                    switch (state) {
                        case 'connecting':
                            window.updateConnectionStatus('connecting', '#2196F3', '連接中...');
                            break;
                        case 'connected':
                            window.updateConnectionStatus('connected', '#4CAF50', '已連接');
                            break;
                        case 'disconnected':
                            window.updateConnectionStatus('disconnected', '#f44336', '連接中斷');
                            break;
                        case 'failed':
                            window.updateConnectionStatus('failed', '#f44336', '連接失敗');
                            break;
                        default:
                            window.updateConnectionStatus('unknown', '#ffa500', '準備中...');
                    }
                }
            });
        }
    }
    
    // 添加調試信息顯示
    function addDebugInfo() {
        // 在開發環境下顯示調試信息
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const debugDiv = document.createElement('div');
            debugDiv.id = 'debug-info';
            debugDiv.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: #00ff00;
                padding: 10px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 12px;
                z-index: 1000;
                max-width: 300px;
                backdrop-filter: blur(10px);
            `;
            
            debugDiv.innerHTML = `
                <div>頁面: 觀眾端</div>
                <div>狀態: 等待直播</div>
                <div>時間: ${new Date().toLocaleTimeString()}</div>
            `;
            
            document.body.appendChild(debugDiv);
            
            // 更新調試信息
            window.updateDebugInfo = function(info) {
                if (debugDiv) {
                    debugDiv.innerHTML = `
                        <div>頁面: 觀眾端</div>
                        <div>狀態: ${info.status || '等待直播'}</div>
                        <div>時間: ${new Date().toLocaleTimeString()}</div>
                        <div>WebSocket: ${info.websocket || '未連接'}</div>
                        <div>WebRTC: ${info.webrtc || '未建立'}</div>
                    `;
                }
            };
            
            console.log('✅ 調試信息已添加');
        }
    }
    
    // 檢查是否為觀眾頁面
    function isViewerPage() {
        return window.location.pathname.includes('viewer') || 
               window.location.search.includes('streamer=') ||
               document.getElementById('remoteVideo') !== null;
    }
    
    // 主函數
    async function init() {
        if (!isViewerPage()) {
            console.log('🚫 非觀眾頁面，跳過初始狀態修復');
            return;
        }
        
        await fixInitialState();
        setupStreamStartListener();
        
        // 定期檢查頁面狀態
        setInterval(() => {
            // 確保占位符在沒有直播時顯示
            const videoPlaceholder = document.getElementById('videoPlaceholder');
            const remoteVideo = document.getElementById('remoteVideo');
            
            if (videoPlaceholder && remoteVideo) {
                const hasStream = remoteVideo.srcObject && 
                                 remoteVideo.srcObject.getVideoTracks().length > 0;
                
                if (!hasStream) {
                    videoPlaceholder.style.display = 'flex';
                    remoteVideo.style.display = 'none';
                }
            }
        }, 2000);
        
        console.log('🎯 觀眾頁面初始狀態修復系統啟動完成');
    }
    
    // 啟動修復
    init().catch(error => {
        console.error('觀眾頁面初始狀態修復失敗:', error);
    });
    
})();

console.log('🔧 觀眾頁面初始狀態修復工具已載入');
