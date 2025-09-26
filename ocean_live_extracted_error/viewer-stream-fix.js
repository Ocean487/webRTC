// 觀眾端直播畫面修復工具
// 專門解決黑屏和無畫面問題

(function() {
    'use strict';
    
    console.log('🎬 直播畫面修復工具啟動...');
    
    let fixAttempts = 0;
    const maxFixAttempts = 5;
    let streamFixInterval;
    let lastStreamCheck = null;
    
    // 等待 DOM 和其他腳本載入
    function waitForInitialization() {
        return new Promise((resolve) => {
            const checkReady = () => {
                if (document.readyState === 'complete' && 
                    typeof window.peerConnection !== 'undefined') {
                    setTimeout(resolve, 1000); // 額外等待 1 秒
                } else {
                    setTimeout(checkReady, 500);
                }
            };
            checkReady();
        });
    }
    
    // 檢查和修復視頻顯示
    function checkAndFixVideoDisplay() {
        const videoPlaceholder = document.getElementById('videoPlaceholder');
        const remoteVideo = document.getElementById('remoteVideo');
        
        if (!remoteVideo) {
            console.error('❌ 找不到遠程視頻元素');
            return false;
        }
        
        console.log('🔍 檢查視頻狀態:', {
            srcObject: !!remoteVideo.srcObject,
            videoTracks: remoteVideo.srcObject ? remoteVideo.srcObject.getVideoTracks().length : 0,
            readyState: remoteVideo.readyState,
            videoWidth: remoteVideo.videoWidth,
            videoHeight: remoteVideo.videoHeight,
            currentTime: remoteVideo.currentTime,
            paused: remoteVideo.paused,
            muted: remoteVideo.muted
        });
        
        // 檢查是否有有效的視頻流
        if (remoteVideo.srcObject && remoteVideo.srcObject.getVideoTracks().length > 0) {
            const videoTrack = remoteVideo.srcObject.getVideoTracks()[0];
            console.log('📹 視頻軌道狀態:', {
                enabled: videoTrack.enabled,
                readyState: videoTrack.readyState,
                muted: videoTrack.muted,
                settings: videoTrack.getSettings()
            });
            
            // 如果有視頻流但沒有顯示
            if (videoTrack.readyState === 'live' && remoteVideo.videoWidth === 0) {
                console.log('🔧 視頻流存在但未顯示，嘗試修復...');
                fixVideoDisplay(remoteVideo, videoPlaceholder);
                return true;
            } else if (videoTrack.readyState === 'live' && remoteVideo.videoWidth > 0) {
                console.log('✅ 視頻流正常');
                showVideoStream(remoteVideo, videoPlaceholder);
                return true;
            }
        }
        
        return false;
    }
    
    // 修復視頻顯示
    function fixVideoDisplay(remoteVideo, videoPlaceholder) {
        console.log('🔧 開始修復視頻顯示...');
        
        try {
            // 方法 1: 強制重新載入
            const originalSrc = remoteVideo.srcObject;
            remoteVideo.srcObject = null;
            setTimeout(() => {
                remoteVideo.srcObject = originalSrc;
                forceVideoPlay(remoteVideo);
            }, 100);
            
            // 方法 2: 設置視頻屬性
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            remoteVideo.muted = false; // 嘗試取消靜音
            
            // 方法 3: 強制設置尺寸
            remoteVideo.style.width = '100%';
            remoteVideo.style.height = '400px';
            remoteVideo.style.objectFit = 'cover';
            
            // 方法 4: 添加事件監聽器
            setupVideoEventListeners(remoteVideo, videoPlaceholder);
            
            console.log('✅ 視頻修復嘗試完成');
            
        } catch (error) {
            console.error('❌ 視頻修復失敗:', error);
        }
    }
    
    // 強制視頻播放
    function forceVideoPlay(video) {
        console.log('▶️ 強制播放視頻...');
        
        // 嘗試多種播放方法
        const playAttempts = [
            () => video.play(),
            () => {
                video.muted = true;
                return video.play();
            },
            () => {
                video.load();
                return video.play();
            }
        ];
        
        function tryPlay(index = 0) {
            if (index >= playAttempts.length) {
                console.error('❌ 所有播放嘗試都失敗了');
                return;
            }
            
            playAttempts[index]().then(() => {
                console.log(`✅ 播放成功 (方法 ${index + 1})`);
            }).catch(error => {
                console.warn(`⚠️ 播放方法 ${index + 1} 失敗:`, error);
                setTimeout(() => tryPlay(index + 1), 500);
            });
        }
        
        tryPlay();
    }
    
        // 設置視頻事件監聽器
        function setupVideoEventListeners(remoteVideo, videoPlaceholder) {
            // 確保播放提示永遠不顯示
            const playPrompt = document.getElementById('playPrompt');
            if (playPrompt) {
                playPrompt.style.display = 'none';
                playPrompt.style.visibility = 'hidden';
                playPrompt.style.opacity = '0';
                playPrompt.style.pointerEvents = 'none';
            }
        // 當視頻元數據載入時
        remoteVideo.onloadedmetadata = function() {
            console.log('📊 視頻元數據已載入:', {
                width: this.videoWidth,
                height: this.videoHeight,
                duration: this.duration
            });
            
            if (this.videoWidth > 0 && this.videoHeight > 0) {
                showVideoStream(this, videoPlaceholder);
            }
        };
        
        // 當視頻數據載入時
        remoteVideo.onloadeddata = function() {
            console.log('📦 視頻數據已載入');
            forceVideoPlay(this);
        };
        
        // 當視頻可以播放時
        remoteVideo.oncanplay = function() {
            console.log('▶️ 視頻可以播放');
            showVideoStream(this, videoPlaceholder);
            forceVideoPlay(this);
        };
        
        // 當視頻開始播放時
        remoteVideo.onplay = function() {
            console.log('🎬 視頻開始播放');
            showVideoStream(this, videoPlaceholder);
            updateStreamStatus('playing');
        };
        
        // 當視頻暫停時
        remoteVideo.onpause = function() {
            console.log('⏸️ 視頻暫停');
        };
        
        // 當視頻等待數據時
        remoteVideo.onwaiting = function() {
            console.log('⏳ 視頻等待數據...');
        };
        
        // 當視頻停滯時
        remoteVideo.onstalled = function() {
            console.log('🔄 視頻停滯，嘗試修復...');
            setTimeout(() => {
                forceVideoPlay(this);
            }, 1000);
        };
        
        // 當視頻出錯時
        remoteVideo.onerror = function(error) {
            console.error('❌ 視頻錯誤:', error);
            setTimeout(() => {
                fixVideoDisplay(this, videoPlaceholder);
            }, 2000);
        };
        
        // 監聽視頻尺寸變化
        remoteVideo.onresize = function() {
            console.log('📏 視頻尺寸變化:', {
                width: this.videoWidth,
                height: this.videoHeight
            });
            
            if (this.videoWidth > 0) {
                showVideoStream(this, videoPlaceholder);
            }
        };
    }
    
    // 顯示視頻流
    function showVideoStream(remoteVideo, videoPlaceholder) {
        console.log('🎬 顯示視頻流，隱藏等待文字');
        
        // 顯示視頻
        remoteVideo.style.display = 'block';
        remoteVideo.style.opacity = '1';
        
        // 添加動畫效果
        remoteVideo.style.animation = 'fadeIn 0.5s ease-in';
        
        // 更新容器狀態 - 添加 live 類別來隱藏等待文字
        const streamVideo = remoteVideo.closest('.stream-video');
        if (streamVideo) {
            streamVideo.classList.add('live');
            console.log('✅ 已添加 live 類別，等待文字將隱藏');
        }
        
        // 觸發全局事件
        window.dispatchEvent(new CustomEvent('streamStarted'));
        
        // 更新頁面標題
        document.title = '觀看直播中 - VibeLo';
        
        console.log('✅ 視頻流顯示成功');
    }
    
    // 更新流狀態
    function updateStreamStatus(status) {
        const statusText = document.getElementById('statusText');
        const liveIndicator = document.getElementById('liveIndicator');
        
        switch (status) {
            case 'playing':
                if (statusText) {
                    statusText.textContent = '直播中';
                    statusText.style.color = '#4CAF50';
                }
                if (liveIndicator) {
                    liveIndicator.style.display = 'flex';
                    liveIndicator.classList.add('active');
                }
                break;
            case 'waiting':
                if (statusText) {
                    statusText.textContent = '等待直播中';
                    statusText.style.color = '#ff9500';
                }
                if (liveIndicator) {
                    liveIndicator.style.display = 'none';
                    liveIndicator.classList.remove('active');
                }
                break;
        }
    }
    
    // 監聽 WebRTC 連接狀態
    function monitorWebRTCConnection() {
        if (typeof window.peerConnection === 'undefined') {
            console.log('⏳ 等待 WebRTC 連接初始化...');
            setTimeout(monitorWebRTCConnection, 1000);
            return;
        }
        
        const pc = window.peerConnection;
        if (!pc) {
            console.log('❌ WebRTC 連接不存在');
            return;
        }
        
        console.log('🔍 監聽 WebRTC 連接狀態:', pc.connectionState);
        
        // 監聽連接狀態變化
        pc.addEventListener('connectionstatechange', function() {
            console.log('🔄 WebRTC 連接狀態變化:', this.connectionState);
            
            if (this.connectionState === 'connected') {
                console.log('✅ WebRTC 連接成功，檢查視頻流...');
                setTimeout(checkAndFixVideoDisplay, 1000);
            }
        });
        
        // 監聽軌道事件
        pc.addEventListener('track', function(event) {
            console.log('🎯 收到新的媒體軌道:', event.track.kind);
            
            if (event.track.kind === 'video') {
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteVideo) {
                    console.log('📹 設置視頻流到 video 元素');
                    remoteVideo.srcObject = event.streams[0];
                    
                    // 立即嘗試修復顯示
                    setTimeout(() => {
                        checkAndFixVideoDisplay();
                    }, 500);
                }
            }
        });
    }
    
    // 定期檢查和修復
    function startPeriodicCheck() {
        streamFixInterval = setInterval(() => {
            const remoteVideo = document.getElementById('remoteVideo');
            if (!remoteVideo) return;
            
            // 檢查流狀態
            const hasStream = remoteVideo.srcObject && 
                             remoteVideo.srcObject.getVideoTracks().length > 0;
            const isVisible = remoteVideo.style.display !== 'none' && 
                             remoteVideo.offsetWidth > 0;
            const hasVideo = remoteVideo.videoWidth > 0;
            
            const currentCheck = { hasStream, isVisible, hasVideo };
            
            // 如果狀態有變化或需要修復
            if (!lastStreamCheck || 
                JSON.stringify(currentCheck) !== JSON.stringify(lastStreamCheck) ||
                (hasStream && !isVisible) ||
                (hasStream && !hasVideo)) {
                
                console.log('🔍 流狀態檢查:', currentCheck);
                
                if (hasStream && (!isVisible || !hasVideo)) {
                    console.log('🔧 檢測到需要修復的情況');
                    checkAndFixVideoDisplay();
                }
            }
            
            lastStreamCheck = currentCheck;
            
        }, 3000); // 每3秒檢查一次
    }
    
    // 添加手動修復按鈕 (調試用)
    function addManualFixButton() {
        if (window.location.hostname !== 'localhost' && 
            window.location.hostname !== '127.0.0.1') {
            return; // 只在開發環境顯示
        }
        
        const button = document.createElement('button');
        button.innerHTML = '🔧 手動修復視頻';
        button.style.cssText = `
            position: fixed;
            top: 100px;
            right: 30px;
            z-index: 1001;
            background: #ff4444;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        `;
        
        button.onclick = () => {
            console.log('🔧 手動觸發視頻修復');
            fixAttempts = 0; // 重置嘗試次數
            checkAndFixVideoDisplay();
        };
        
        document.body.appendChild(button);
    }
    
    // 主初始化函數
    async function init() {
        try {
            console.log('🚀 初始化直播畫面修復工具...');
            
            await waitForInitialization();
            
            // 啟動監控和修復
            monitorWebRTCConnection();
            startPeriodicCheck();
            addManualFixButton();
            
            // 立即檢查一次
            setTimeout(checkAndFixVideoDisplay, 2000);
            
            console.log('✅ 直播畫面修復工具啟動完成');
            
        } catch (error) {
            console.error('❌ 直播畫面修復工具初始化失敗:', error);
        }
    }
    
    // 清理函數
    window.cleanupStreamFix = function() {
        if (streamFixInterval) {
            clearInterval(streamFixInterval);
            console.log('🧹 清理定期檢查');
        }
    };
    
    // 啟動
    init();
    
})();

console.log('🎬 直播畫面修復工具已載入');
