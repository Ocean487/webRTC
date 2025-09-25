// 立即修復觀眾無法看到畫面的問題
// 這個腳本會在頁面載入後立即執行修復措施

(function() {
    'use strict';
    
    console.log('🚀 立即修復腳本啟動...');
    
    // 等待頁面完全載入
    function waitForElements() {
        return new Promise((resolve) => {
            const checkElements = () => {
                const remoteVideo = document.getElementById('remoteVideo');
                const isViewerPage = window.location.pathname.includes('viewer') || window.location.search.includes('streamer=');
                
                if (remoteVideo && isViewerPage) {
                    resolve({ remoteVideo, isViewerPage });
                } else {
                    setTimeout(checkElements, 100);
                }
            };
            checkElements();
        });
    }
    
    // 修復視頻顯示問題
    function fixVideoDisplay() {
        waitForElements().then(({ remoteVideo }) => {
            console.log('🔧 開始修復視頻顯示...');
            
            // 強化視頻元素設置
            function enhanceVideoElement() {
                remoteVideo.style.cssText = `
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    width: 100% !important;
                    height: auto !important;
                    background: #000 !important;
                    object-fit: contain !important;
                `;
                
                // 設置視頻屬性
                remoteVideo.autoplay = true;
                remoteVideo.playsInline = true;
                remoteVideo.muted = false; // 允許聲音
                remoteVideo.controls = true; // 顯示控制項便於調試
                
                console.log('✅ 視頻元素樣式已強化');
            }
            
            // 監控 PeerConnection 的 ontrack 事件
            function monitorOnTrack() {
                const originalOnTrack = window.RTCPeerConnection.prototype.ontrack;
                
                // 攔截並增強所有 ontrack 事件
                Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
                    set: function(handler) {
                        this._originalOnTrack = handler;
                        this._ontrack = function(event) {
                            console.log('🎬 攔截到 ontrack 事件:', event);
                            
                            // 立即處理視頻流
                            if (event.streams && event.streams[0]) {
                                const stream = event.streams[0];
                                console.log('📺 立即設置視頻流:', stream.id);
                                
                                // 強制設置到視頻元素
                                setTimeout(() => {
                                    if (remoteVideo) {
                                        remoteVideo.srcObject = stream;
                                        enhanceVideoElement();
                                        
                                        // 強制播放
                                        const playPromise = remoteVideo.play();
                                        if (playPromise !== undefined) {
                                            playPromise.then(() => {
                                                console.log('✅ 強制播放成功');
                                            }).catch(err => {
                                                console.log('⚠️ 強制播放失敗，嘗試其他方法:', err);
                                                
                                                // 嘗試用戶互動後播放
                                                const playButton = document.createElement('button');
                                                playButton.textContent = '▶️ 點擊播放視頻';
                                                playButton.style.cssText = `
                                                    position: fixed;
                                                    top: 50%;
                                                    left: 50%;
                                                    transform: translate(-50%, -50%);
                                                    z-index: 10000;
                                                    padding: 20px;
                                                    font-size: 18px;
                                                    background: #4CAF50;
                                                    color: white;
                                                    border: none;
                                                    border-radius: 10px;
                                                    cursor: pointer;
                                                `;
                                                
                                                playButton.onclick = () => {
                                                    const userPlayPromise = remoteVideo.play();
                                                    if (userPlayPromise !== undefined) {
                                                        userPlayPromise.then(() => {
                                                            console.log('✅ 用戶觸發播放成功');
                                                            playButton.remove();
                                                        }).catch(e => console.error('用戶觸發播放也失敗:', e));
                                                    }
                                                };
                                                
                                                document.body.appendChild(playButton);
                                                
                                                // 5秒後自動移除按鈕
                                                setTimeout(() => {
                                                    if (playButton.parentNode) {
                                                        playButton.remove();
                                                    }
                                                }, 5000);
                                            });
                                    }
                                }, 100);
                            }
                            
                            // 呼叫原始處理器
                            if (this._originalOnTrack) {
                                this._originalOnTrack.call(this, event);
                            }
                        };
                    },
                    get: function() {
                        return this._ontrack;
                    }
                });
                
                console.log('✅ ontrack 事件監控已設置');
            }
            
            // 修復現有的視頻流（如果有）
            function fixExistingStream() {
                if (window.peerConnection) {
                    const pc = window.peerConnection;
                    const receivers = pc.getReceivers();
                    
                    receivers.forEach(receiver => {
                        if (receiver.track && receiver.track.kind === 'video') {
                            console.log('🔧 發現現有視頻軌道，嘗試修復...');
                            
                            // 創建新的媒體流
                            const stream = new MediaStream();
                            stream.addTrack(receiver.track);
                            
                            // 設置到視頻元素
                            remoteVideo.srcObject = stream;
                            enhanceVideoElement();
                            
                            console.log('✅ 現有視頻軌道已重新設置');
                        }
                    });
                }
            }
            
            // 定期檢查視頻狀態
            function periodicCheck() {
                setInterval(() => {
                    if (remoteVideo && remoteVideo.srcObject) {
                        const stream = remoteVideo.srcObject;
                        const videoTracks = stream.getVideoTracks();
                        
                        if (videoTracks.length > 0) {
                            const track = videoTracks[0];
                            
                            // 檢查軌道狀態
                            if (track.readyState === 'ended') {
                                console.warn('⚠️ 視頻軌道已結束，嘗試重新連接...');
                                
                                if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                                    window.socket.send(JSON.stringify({
                                        type: 'viewer_join',
                                        viewerId: window.viewerId,
                                        streamerId: window.targetStreamerId,
                                        userInfo: window.currentUser || { displayName: `觀眾${window.viewerId.substr(-3)}`, avatarUrl: null }
                                    }));
                                }
                            }
                            
                            // 檢查視頻尺寸
                            if (remoteVideo.videoWidth === 0 && track.readyState === 'live') {
                                console.warn('⚠️ 視頻軌道活躍但尺寸為 0，強制重新載入...');
                                const currentSrc = remoteVideo.srcObject;
                                remoteVideo.srcObject = null;
                                setTimeout(() => {
                                    remoteVideo.srcObject = currentSrc;
                                    remoteVideo.load();
                                }, 100);
                            }
                        }
                    }
                }, 5000); // 每5秒檢查一次
            }
            
            // 執行所有修復措施
            enhanceVideoElement();
            monitorOnTrack();
            fixExistingStream();
            periodicCheck();
            
            console.log('✅ 視頻顯示修復措施已全部執行');
            
            // 添加快捷鍵調試
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.key === 'V') {
                    console.log('🔧 手動觸發視頻診斷...');
                    if (window.diagnoseVideoDisplay) {
                        window.diagnoseVideoDisplay();
                    }
                }
                
                if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                    console.log('🔄 手動重置視頻...');
                    if (window.resetVideoDisplay) {
                        window.resetVideoDisplay();
                    }
                }
            });
            
            console.log('💡 調試快捷鍵已設置:');
            console.log('  Ctrl+Shift+V - 視頻診斷');
            console.log('  Ctrl+Shift+R - 重置視頻');
        });
    }
    
    // 開始修復
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixVideoDisplay);
    } else {
        fixVideoDisplay();
    }
    
})();

console.log('🛠️ 視頻顯示立即修復腳本已載入');
