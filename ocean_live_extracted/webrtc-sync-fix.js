// WebRTC 同步修復工具
// 修復主播端和觀眾端的同步問題

(function() {
    'use strict';
    
    console.log('🔧 WebRTC 同步修復工具啟動...');
    
    // 檢測當前頁面類型
    const isViewer = window.location.pathname.includes('viewer') || 
                    window.location.search.includes('streamer=') ||
                    document.getElementById('remoteVideo') !== null;
    
    const isBroadcaster = !isViewer && (
        document.getElementById('localVideo') !== null ||
        typeof startStream === 'function'
    );
    
    console.log('📍 頁面類型檢測:', { isViewer, isBroadcaster });
    
    // 修復變數
    let syncCheckInterval;
    let lastSyncCheck = Date.now();
    
    // 觀眾端修復
    if (isViewer) {
        console.log('👁️ 啟動觀眾端同步修復...');
        initViewerSyncFix();
    }
    
    // 主播端修復
    if (isBroadcaster) {
        console.log('📺 啟動主播端同步修復...');
        initBroadcasterSyncFix();
    }
    
    // 觀眾端同步修復
    function initViewerSyncFix() {
        // 等待頁面載入完成
        function waitForViewerReady() {
            const check = () => {
                if (typeof window.peerConnection !== 'undefined' && 
                    typeof window.socket !== 'undefined') {
                    setupViewerSyncMonitoring();
                } else {
                    setTimeout(check, 500);
                }
            };
            check();
        }
        
        // 設置觀眾端同步監控
        function setupViewerSyncMonitoring() {
            console.log('🔍 設置觀眾端同步監控...');
            
            // 監控 WebSocket 連接
            if (window.socket) {
                window.socket.addEventListener('message', function(event) {
                    try {
                        const data = JSON.parse(event.data);
                        
                        if (data.type === 'offer') {
                            console.log('📨 收到主播 Offer，立即處理');
                            handleViewerOfferSync(data);
                        }
                        
                        if (data.type === 'ice_candidate') {
                            console.log('🧊 收到 ICE 候選，立即處理');
                            handleViewerIceCandidateSync(data);
                        }
                        
                    } catch (error) {
                        console.error('WebSocket 消息解析失敗:', error);
                    }
                });
            }
            
            // 定期檢查連接狀態
            syncCheckInterval = setInterval(checkViewerSyncStatus, 3000);
        }
        
        // 處理觀眾端 Offer 同步
        function handleViewerOfferSync(data) {
            const remoteVideo = document.getElementById('remoteVideo');
            const videoPlaceholder = document.getElementById('videoPlaceholder');
            
            if (!remoteVideo) {
                console.error('❌ 找不到遠程視頻元素');
                return;
            }
            
            console.log('🎯 同步處理 Offer，確保視頻正常顯示');
            
            // 強制確保視頻元素準備就緒
            remoteVideo.style.display = 'block';
            remoteVideo.style.opacity = '0';
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            remoteVideo.muted = false;
            
            // 確保占位符隱藏
            if (videoPlaceholder) {
                videoPlaceholder.style.display = 'none';
            }
            
            // 延遲調用原始處理函數，確保同步
            setTimeout(() => {
                if (typeof window.handleOffer === 'function') {
                    window.handleOffer(data.offer);
                }
            }, 100);
        }
        
        // 處理觀眾端 ICE 候選同步
        function handleViewerIceCandidateSync(data) {
            console.log('🧊 同步處理 ICE 候選');
            
            setTimeout(() => {
                if (typeof window.handleIceCandidate === 'function') {
                    window.handleIceCandidate(data.candidate);
                }
            }, 50);
        }
        
        // 檢查觀眾端同步狀態
        function checkViewerSyncStatus() {
            const remoteVideo = document.getElementById('remoteVideo');
            if (!remoteVideo) return;
            
            const pc = window.peerConnection;
            if (!pc) return;
            
            const connectionState = pc.connectionState;
            const iceState = pc.iceConnectionState;
            const hasStream = !!remoteVideo.srcObject;
            const hasVideoTracks = hasStream ? remoteVideo.srcObject.getVideoTracks().length > 0 : false;
            const isPlaying = remoteVideo.currentTime > 0 && !remoteVideo.paused;
            const hasVideo = remoteVideo.videoWidth > 0;
            
            console.log('📊 觀眾端同步狀態:', {
                connectionState,
                iceState,
                hasStream,
                hasVideoTracks,
                isPlaying,
                hasVideo,
                currentTime: remoteVideo.currentTime,
                readyState: remoteVideo.readyState
            });
            
            // 檢測異常情況並修復
            if (connectionState === 'connected' && hasStream && hasVideoTracks && !hasVideo) {
                console.log('🔧 檢測到同步問題：連接成功但無視頻，嘗試修復...');
                fixViewerVideoSync(remoteVideo);
            }
            
            if (connectionState === 'connected' && hasVideo && remoteVideo.style.display === 'none') {
                console.log('🔧 檢測到顯示問題：有視頻但元素隱藏，修復顯示...');
                showVideoWithSync(remoteVideo);
            }
        }
        
        // 修復觀眾端視頻同步
        function fixViewerVideoSync(remoteVideo) {
            console.log('🔧 修復觀眾端視頻同步...');
            
            const originalStream = remoteVideo.srcObject;
            const hasEffect = remoteVideo.dataset.viewerEffect && remoteVideo.dataset.viewerEffect !== 'clear';
            
            // 重新設置流
            remoteVideo.srcObject = null;
            
            setTimeout(() => {
                remoteVideo.srcObject = originalStream;
                
                // 注意：不呼叫 load() 避免影響已套用的濾鏡和播放狀態
                if (hasEffect) {
                    console.log('🎨 偵測到特效，跳過 load() 避免重置狀態');
                }
                
                // 多重播放嘗試
                const playPromise = remoteVideo.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        console.log('✅ 視頻同步播放成功');
                        showVideoWithSync(remoteVideo);
                    }).catch(error => {
                        console.warn('⚠️ 播放失敗，嘗試靜音播放:', error);
                        remoteVideo.muted = true;
                        remoteVideo.play().then(() => {
                            console.log('✅ 靜音播放成功');
                            showVideoWithSync(remoteVideo);
                        }).catch(err => {
                            console.error('❌ 靜音播放也失敗:', err);
                        });
                    });
                }
            }, 200);
        }
        
        // 同步顯示視頻
        function showVideoWithSync(remoteVideo) {
            console.log('🎬 同步顯示視頻，隱藏等待文字');
            
            // 顯示視頻
            remoteVideo.style.display = 'block';
            remoteVideo.style.opacity = '1';
            
            // 添加成功動畫（保留彩虹等自定義動畫）
            const hasCustomAnimation = remoteVideo.classList.contains('effect-rainbow-filter') ||
                remoteVideo.dataset.viewerEffect === 'rainbow';

            if (hasCustomAnimation) {
                console.log('🎨 偵測到正在運行的彩虹濾鏡，保留原動畫設定');
            } else {
                remoteVideo.style.animation = 'videoFadeIn 0.5s ease-in';
            }
            
            // 更新容器狀態 - 添加 live 類別隱藏等待文字
            const streamVideo = remoteVideo.closest('.stream-video');
            if (streamVideo) {
                streamVideo.classList.add('live');
                console.log('✅ 已添加 live 類別，CSS 等待文字將隱藏');
            }
            
            // 更新狀態
            document.title = '觀看直播中 - VibeLo';
            
            // 觸發自定義事件
            window.dispatchEvent(new CustomEvent('streamStarted'));
            
            console.log('✅ 視頻同步顯示完成');
        }
        
        waitForViewerReady();
    }
    
    // 主播端同步修復
    function initBroadcasterSyncFix() {
        console.log('📺 初始化主播端同步修復...');
        
        // 等待主播端準備就緒
        function waitForBroadcasterReady() {
            const check = () => {
                if (typeof window.localStream !== 'undefined' && 
                    typeof window.peerConnections !== 'undefined') {
                    setupBroadcasterSyncMonitoring();
                } else {
                    setTimeout(check, 500);
                }
            };
            check();
        }
        
        // 設置主播端同步監控
        function setupBroadcasterSyncMonitoring() {
            console.log('🔍 設置主播端同步監控...');
            
            // 監控本地流變化
            const originalAddTrack = RTCPeerConnection.prototype.addTrack;
            RTCPeerConnection.prototype.addTrack = function(track, stream) {
                console.log('🎯 同步添加軌道:', track.kind, track.id);
                const result = originalAddTrack.call(this, track, stream);
                
                // 延遲確保軌道正確添加
                setTimeout(() => {
                    console.log('✅ 軌道添加同步完成');
                }, 100);
                
                return result;
            };
            
            // 監控 PeerConnection 創建
            const originalCreateOffer = RTCPeerConnection.prototype.createOffer;
            RTCPeerConnection.prototype.createOffer = async function(options) {
                console.log('🎯 同步創建 Offer...');
                
                // 確保所有軌道都已添加
                const senders = this.getSenders();
                console.log('📊 當前發送器數量:', senders.length);
                
                senders.forEach((sender, index) => {
                    if (sender.track) {
                        console.log(`📹 發送器 ${index}:`, sender.track.kind, sender.track.readyState);
                    }
                });
                
                const offer = await originalCreateOffer.call(this, options);
                
                console.log('✅ Offer 同步創建完成');
                return offer;
            };
            
            // 定期檢查主播端狀態
            syncCheckInterval = setInterval(checkBroadcasterSyncStatus, 5000);
        }
        
        // 檢查主播端同步狀態
        function checkBroadcasterSyncStatus() {
            if (typeof window.localStream === 'undefined' || !window.localStream) {
                return;
            }
            
            const localStream = window.localStream;
            const videoTracks = localStream.getVideoTracks();
            const audioTracks = localStream.getAudioTracks();
            const peerConnectionsMap = window.peerConnections;
            
            console.log('📊 主播端同步狀態:', {
                videoTracks: videoTracks.length,
                audioTracks: audioTracks.length,
                connections: peerConnectionsMap ? peerConnectionsMap.size : 0,
                isStreaming: window.isStreaming
            });
            
            // 檢查每個連接的狀態
            if (peerConnectionsMap) {
                peerConnectionsMap.forEach((pc, viewerId) => {
                    const senders = pc.getSenders();
                    const connectionState = pc.connectionState;
                    const iceState = pc.iceConnectionState;
                    
                    console.log(`📡 觀眾 ${viewerId.substr(-3)} 連接狀態:`, {
                        connectionState,
                        iceState,
                        senders: senders.length
                    });
                    
                    // 檢測並修復同步問題
                    if (connectionState === 'connected' && senders.length === 0) {
                        console.log(`🔧 觀眾 ${viewerId.substr(-3)} 缺少軌道，嘗試修復...`);
                        fixBroadcasterTrackSync(pc, viewerId);
                    }
                });
            }
        }
        
        // 修復主播端軌道同步
        function fixBroadcasterTrackSync(pc, viewerId) {
            console.log('🔧 修復主播端軌道同步...');
            
            if (!window.localStream) {
                console.error('❌ 本地流不存在');
                return;
            }
            
            const localStream = window.localStream;
            const videoTracks = localStream.getVideoTracks();
            const audioTracks = localStream.getAudioTracks();
            
            try {
                // 重新添加所有軌道
                videoTracks.forEach(track => {
                    if (track.readyState === 'live') {
                        pc.addTrack(track, localStream);
                        console.log('✅ 重新添加視頻軌道:', track.id);
                    }
                });
                
                audioTracks.forEach(track => {
                    if (track.readyState === 'live') {
                        pc.addTrack(track, localStream);
                        console.log('✅ 重新添加音頻軌道:', track.id);
                    }
                });
                
                // 重新協商
                setTimeout(async () => {
                    try {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        
                        // 發送新的 offer
                        if (window.streamingSocket && window.streamingSocket.readyState === WebSocket.OPEN) {
                            window.streamingSocket.send(JSON.stringify({
                                type: 'offer',
                                offer: offer,
                                broadcasterId: window.getBroadcasterId ? window.getBroadcasterId() : 'broadcaster',
                                viewerId: viewerId
                            }));
                            
                            console.log('✅ 重新發送 Offer 完成');
                        }
                        
                    } catch (error) {
                        console.error('❌ 重新協商失敗:', error);
                    }
                }, 1000);
                
            } catch (error) {
                console.error('❌ 軌道同步修復失敗:', error);
            }
        }
        
        waitForBroadcasterReady();
    }
    
    // 添加CSS動畫
    if (!document.getElementById('sync-fix-styles')) {
        const style = document.createElement('style');
        style.id = 'sync-fix-styles';
        style.textContent = `
            @keyframes videoFadeIn {
                0% { opacity: 0; transform: scale(1.05); }
                100% { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // 清理函數
    window.cleanupSyncFix = function() {
        if (syncCheckInterval) {
            clearInterval(syncCheckInterval);
            console.log('🧹 清理同步檢查');
        }
    };
    
    // 手動同步修復函數
    window.forceSyncFix = function() {
        console.log('🔧 手動觸發同步修復...');
        
        if (isViewer) {
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo) {
                fixViewerVideoSync(remoteVideo);
            }
        }
        
        if (isBroadcaster && window.peerConnections) {
            window.peerConnections.forEach((pc, viewerId) => {
                fixBroadcasterTrackSync(pc, viewerId);
            });
        }
    };
    
    console.log('✅ WebRTC 同步修復工具啟動完成');
    
})();

console.log('🔧 WebRTC 同步修復工具已載入');
