// 🎵 觀眾重整音訊重連修復腳本
// 專門解決觀眾重整頁面後聽不到主播分享音樂的問題
// ===============================================

class ViewerAudioReconnectManager {
    constructor() {
        this.isInitialized = false;
        this.audioReconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = null;
        
        console.log('🎵 觀眾音訊重連管理器已初始化');
    }

    // 初始化觀眾音訊重連功能
    initialize(socket, viewerId) {
        this.socket = socket;
        this.viewerId = viewerId;
        this.isInitialized = true;
        
        console.log('🎵 觀眾音訊重連管理器已啟用', {
            viewerId: viewerId,
            socketConnected: socket ? socket.readyState === WebSocket.OPEN : false
        });
        
        // 頁面載入後立即請求音訊狀態
        setTimeout(() => {
            this.requestAudioStreamStatus();
        }, 1000);
        
        // 設置定期檢查
        this.startPeriodicAudioCheck();
        
        // 監聽頁面重整事件
        this.setupPageRefreshHandler();
    }

    // 請求完整的音訊流狀態
    requestAudioStreamStatus() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.log('⚠️ WebSocket未連接，無法請求音訊狀態');
            return;
        }

        console.log('🔍 請求音訊流狀態...');
        this.socket.send(JSON.stringify({
            type: 'request_audio_stream_status',
            viewerId: this.viewerId,
            timestamp: Date.now()
        }));
    }

    // 處理音訊流狀態響應
    handleAudioStreamStatus(data) {
        console.log('🎵 收到音訊流狀態響應:', data);
        
        if (data.musicStream && data.musicStream.isPlaying) {
            console.log('🎵 檢測到音樂正在播放:', data.musicStream.currentVideoId);
            this.handleMusicDetected(data.musicStream);
        }
        
        if (data.tabAudioStream && data.tabAudioStream.enabled) {
            console.log('🎵 檢測到分頁音訊已啟用');
            this.handleTabAudioDetected(data.tabAudioStream);
        }
        
        // 顯示音訊狀態給觀眾
        this.displayAudioStatus(data);
        
        // 重置重連嘗試計數器
        this.audioReconnectAttempts = 0;
    }

    // 處理檢測到音樂的情況
    handleMusicDetected(musicStream) {
        console.log('🎵 音樂檢測 - 準備重連音樂播放');
        
        // 顯示音樂狀態消息
        if (window.displaySystemMessage) {
            window.displaySystemMessage(`🎵 檢測到音樂播放：重新同步中...`);
        }
        
        // 如果有 YouTube 播放器，嘗試重新載入音樂
        if (window.youtubePlayer && musicStream.currentVideoId) {
            try {
                window.youtubePlayer.loadVideoById(musicStream.currentVideoId);
                setTimeout(() => {
                    window.youtubePlayer.setVolume(musicStream.volume || 80);
                    if (!musicStream.isMuted) {
                        window.youtubePlayer.playVideo();
                    }
                }, 1000);
                
                console.log('✅ YouTube 音樂已重新載入');
            } catch (error) {
                console.error('❌ YouTube 音樂重連失敗:', error);
            }
        }
    }

    // 處理檢測到分頁音訊的情況
    handleTabAudioDetected(tabAudioStream) {
        console.log('🎵 分頁音訊檢測 - WebRTC 音訊軌道已啟用');
        
        // 顯示分頁音訊狀態消息
        if (window.displaySystemMessage) {
            window.displaySystemMessage(`🎵 背景音樂分享已啟用：WebRTC 音訊軌道重新同步`);
        }
        
        // 檢查 WebRTC 連接狀態
        if (window.peerConnection) {
            console.log('🔍 WebRTC 連接狀態:', window.peerConnection.connectionState);
            
            // 如果 WebRTC 已連接，音訊軌道應該已經包含在媒體流中
            if (window.peerConnection.connectionState === 'connected') {
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteVideo && remoteVideo.srcObject) {
                    const audioTracks = remoteVideo.srcObject.getAudioTracks();
                    console.log('🎵 當前音訊軌道數量:', audioTracks.length);
                    
                    if (audioTracks.length > 0) {
                        console.log('✅ WebRTC 音訊軌道已就緒');
                        audioTracks.forEach((track, index) => {
                            console.log(`  軌道 ${index}:`, {
                                enabled: track.enabled,
                                muted: track.muted,
                                readyState: track.readyState,
                                label: track.label
                            });
                        });
                    } else {
                        console.warn('⚠️ 沒有檢測到 WebRTC 音訊軌道');
                        this.requestAudioTrackUpdate();
                    }
                }
            } else {
                console.log('🔗 WebRTC 未連接，嘗試重新建立連接');
                this.requestWebRTCReconnection();
            }
        }
    }

    // 請求音訊軌道更新
    requestAudioTrackUpdate() {
        console.log('🔍 請求音訊軌道更新...');
        
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'request_audio_track_update',
                viewerId: this.viewerId,
                timestamp: Date.now()
            }));
        }
    }

    // 請求 WebRTC 重新連接
    requestWebRTCReconnection() {
        console.log('🔗 請求 WebRTC 重新連接...');
        
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            // 發送重新加入請求
            this.socket.send(JSON.stringify({
                type: 'viewer_join',
                viewerId: this.viewerId,
                streamerId: window.targetStreamerId || 'default',
                userInfo: window.currentUser || { 
                    displayName: `觀眾${this.viewerId.substr(-3)}`, 
                    avatarUrl: null 
                },
                audioReconnect: true,
                timestamp: Date.now()
            }));
            
            console.log('📡 已發送 WebRTC 重新連接請求');
        }
    }

    // 顯示音訊狀態
    displayAudioStatus(data) {
        const musicStatus = data.musicStream ? 
            (data.musicStream.isPlaying ? `音樂播放中 (${data.musicStream.currentVideoId})` : '音樂已停止') : 
            '無音樂';
        
        const tabAudioStatus = data.tabAudioStream ? 
            (data.tabAudioStream.enabled ? '分頁音訊啟用' : '分頁音訊停用') : 
            '無分頁音訊';
        
        const statusMessage = `🎵 音訊狀態：${musicStatus} | ${tabAudioStatus}`;
        
        console.log(statusMessage);
        
        if (window.displaySystemMessage) {
            window.displaySystemMessage(statusMessage);
        }
    }

    // 開始定期音訊檢查
    startPeriodicAudioCheck() {
        // 清除之前的檢查間隔
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
        }
        
        // 設置定期檢查（每30秒）
        this.reconnectInterval = setInterval(() => {
            if (this.isInitialized && this.socket && this.socket.readyState === WebSocket.OPEN) {
                console.log('🔍 定期音訊狀態檢查...');
                this.requestAudioStreamStatus();
            }
        }, 30000);
        
        console.log('✅ 定期音訊檢查已啟用');
    }

    // 設置頁面重整處理器
    setupPageRefreshHandler() {
        // 頁面卸載前保存狀態
        window.addEventListener('beforeunload', () => {
            console.log('💾 頁面卸載：保存音訊重連狀態');
            localStorage.setItem('viewerAudioReconnect', JSON.stringify({
                viewerId: this.viewerId,
                timestamp: Date.now(),
                reconnectEnabled: true
            }));
        });

        // 頁面載入後檢查重連狀態
        window.addEventListener('load', () => {
            setTimeout(() => {
                const saved = localStorage.getItem('viewerAudioReconnect');
                if (saved) {
                    const data = JSON.parse(saved);
                    console.log('🔄 檢測到頁面重整，進行音訊重連');
                    console.log('保存的狀態:', data);
                    
                    // 清除保存的狀態
                    localStorage.removeItem('viewerAudioReconnect');
                    
                    // 延遲請求音訊狀態以確保連接已建立
                    setTimeout(() => {
                        this.requestAudioStreamStatus();
                    }, 2000);
                }
            }, 1000);
        });
    }

    // 停用管理器
    disable() {
        this.isInitialized = false;
        
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
        
        console.log('🎵 觀眾音訊重連管理器已停用');
    }

    // 重置重連嘗試計數器
    resetAttempts() {
        this.audioReconnectAttempts = 0;
        console.log('🔄 音訊重連嘗試次數已重置');
    }
}

// 創建全域觀眾音訊重連管理器實例
window.viewerAudioReconnectManager = new ViewerAudioReconnectManager();

// 在觀眾端初始化時啟用音訊重連
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 觀眾音訊重連修復腳本已載入');
    
    // 等待 WebSocket 連接建立後初始化
    const initializeAudioReconnect = () => {
        if (window.socket && window.viewerId) {
            try {
                window.viewerAudioReconnectManager.initialize(window.socket, window.viewerId);
                console.log('✅ 觀眾音訊重連功能已啟用');
            } catch (error) {
                console.error('❌ 觀眾音訊重連初始化失敗:', error);
            }
        } else {
            // 如果尚未準備好，稍後重試
            setTimeout(initializeAudioReconnect, 1000);
        }
    };

    // 延遲初始化以避免與其他初始化衝突
    setTimeout(initializeAudioReconnect, 2000);
});

// 錯誤處理
window.addEventListener('error', function(e) {
    console.error('觀眾音訊重連修復錯誤:', e.message);
});

console.log('✅ 觀眾音訊重連修復腳本載入完成');
