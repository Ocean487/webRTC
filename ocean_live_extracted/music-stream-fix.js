// 音樂流重連修復 - 解決觀眾重整後聽不到音樂的問題
// =====================================================

class MusicStreamReconnectManager {
    constructor() {
        this.isEnabled = false;
        this.musicStreamState = {
            isPlaying: false,
            currentVideoId: null,
            volume: 100,
            isMuted: false
        };
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.socket = null;
        this.viewerId = null;
        
        console.log('🎵 音樂流重連管理器已初始化');
    }

    // 初始化音樂流重連功能
    initialize(socket, viewerId) {
        this.socket = socket;
        this.viewerId = viewerId;
        this.isEnabled = true;
        
        console.log('🎵 音樂流重連管理器已啟用，觀眾ID:', viewerId);
        
    // 發送音樂狀態查詢請求
    this.requestMusicStreamState();
    
    // 🎵 請求分頁音訊狀態
    this.requestTabAudioState();
    
    // 設置定期檢查音樂狀態
    this.startPeriodicCheck();
        
        // 監聽頁面重整事件
        this.setupPageRefreshHandler();
    }

    // 請求音樂流狀態
    requestMusicStreamState() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.log('⚠️ WebSocket未連接，無法請求音樂狀態');
            return;
        }

        console.log('🔍 請求音樂流狀態...');
        this.socket.send(JSON.stringify({
            type: 'request_music_stream_state',
            viewerId: this.viewerId,
            timestamp: Date.now()
        }));
    }

    // 🎵 請求分頁音訊狀態
    requestTabAudioState() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.log('⚠️ WebSocket未連接，無法請求分頁音訊狀態');
            return;
        }

        console.log('🔍 請求分頁音訊狀態...');
        this.socket.send(JSON.stringify({
            type: 'request_tab_audio_state',
            viewerId: this.viewerId,
            timestamp: Date.now()
        }));
    }

    // 🎵 請求音訊流狀態（整合音樂和分頁音訊）
    requestAudioStreamStatus() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.log('⚠️ WebSocket未連接，無法請求音訊流狀態');
            return;
        }

        console.log('🔍 請求完整音訊流狀態...');
        this.socket.send(JSON.stringify({
            type: 'request_audio_stream_status',
            viewerId: this.viewerId,
            timestamp: Date.now()
        }));
    }

    // 處理音訊流狀態響應
    handleAudioStreamStatus(data) {
        console.log('🎵 收到音訊流狀態:', data);
        
        // 處理音樂狀態
        if (data.musicStream) {
            this.handleMusicStreamState(data.musicStream);
        }
        
        // 處理分頁音訊狀態
        if (data.tabAudioStream) {
            this.handleTabAudioStatus(data.tabAudioStream);
        }
        
        // 顯示綜合狀態
        this.showAudioStreamStatus(data);
    }

    // 顯示音訊流狀態
    showAudioStreamStatus(data) {
        const musicStatus = data.musicStream ? (data.musicStream.isPlaying ? '音樂播放中' : '音樂已停止') : '無音樂';
        const tabAudioStatus = data.tabAudioStream ? (data.tabAudioStream.enabled ? '分頁音訊啟用' : '分頁音訊停用') : '無分頁音訊';
        
        const statusMessage = `🎵 音訊狀態：${musicStatus}，${tabAudioStatus}`;
        
        if (window.displaySystemMessage) {
            window.displaySystemMessage(statusMessage);
        } else {
            console.log(statusMessage);
        }
    }

    // 處理音樂流狀態響應
    handleMusicStreamState(data) {
        console.log('🎵 收到音樂流狀態:', data);
        
        this.musicStreamState = {
            isPlaying: data.isPlaying || false,
            currentVideoId: data.currentVideoId || null,
            volume: data.volume || 100,
            isMuted: data.isMuted || false
        };

        if (data.isPlaying && data.currentVideoId) {
            console.log('🎵 檢測到正在播放音樂，重新連接音樂流');
            this.reconnectMusicStream(data);
        } else {
            console.log('🎵 當前沒有音樂播放');
        }
    }

    // 重新連接音樂流
    async reconnectMusicStream(musicState) {
        try {
            console.log('🔄 開始重新連接音樂流...', musicState);
            
            // 檢查YouTube播放器是否可用
            if (typeof window.onYouTubeIframeAPIReady === 'undefined') {
                console.log('⚠️ YouTube API尚未載入，延遲重連');
                setTimeout(() => this.reconnectMusicStream(musicState), 2000);
                return;
            }

            // 使用全域音樂播放器重新載入音樂
            if (window.youtubePlayer && musicState.currentVideoId) {
                window.youtubePlayer.loadVideoById({
                    videoId: musicState.currentVideoId,
                    startSeconds: 0,
                    suggestedQuality: 'default'
                });

                // 設置音量和靜音狀態
                setTimeout(() => {
                    window.youtubePlayer.setVolume(musicState.volume);
                    if (musicState.isMuted) {
                        window.youtubePlayer.mute();
                    } else {
                        window.youtubePlayer.unMute();
                    }
                    
                    if (musicState.isPlaying) {
                        window.youtubePlayer.playVideo();
                        console.log('✅ 音樂流重新連接成功');
                        this.showReconnectMessage('✅ 背景音樂已重新連接');
                    }
                }, 1000);
            }

            this.reconnectAttempts = 0;
            
        } catch (error) {
            console.error('❌ 音樂流重連失敗:', error);
            this.handleReconnectFailure();
        }
    }

    // 處理重連失敗
    handleReconnectFailure() {
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log(`🔄 音樂流重連失敗，${3}秒後重試 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.requestMusicStreamState();
            }, 3000);
        } else {
            console.error('❌ 音樂流重連失敗次數過多');
            this.showReconnectMessage('❌ 音樂重連失敗，請手動載入音樂');
        }
    }

    // 顯示重連消息
    showReconnectMessage(message) {
        // 在聊天中顯示消息
        if (window.displaySystemMessage) {
            window.displaySystemMessage(message);
        } else {
            console.log('🎵 音樂重連消息:', message);
        }
    }

    // 開始定期檢查
    startPeriodicCheck() {
        setInterval(() => {
            if (this.isEnabled && this.socket && this.socket.readyState === WebSocket.OPEN) {
                // 每30秒檢查一次音樂狀態
                this.requestMusicStreamState();
            }
        }, 30000);
    }

    // 設置頁面重整處理器
    setupPageRefreshHandler() {
        // 在頁面卸載前保存音樂狀態
        window.addEventListener('beforeunload', () => {
            if (this.isEnabled && this.musicStreamState.isPlaying) {
                localStorage.setItem('musicStreamState', JSON.stringify(this.musicStreamState));
                console.log('💾 音樂狀態已保存到 localStorage');
            }
        });

    // 頁面載入後嘗試恢復音樂狀態
    window.addEventListener('load', () => {
        setTimeout(() => {
            this.restoreMusicStateFromStorage();
        }, 2000);
    });
    
    // 🎵 觀眾重整後的音訊狀態檢測
    this.requestAudioStreamStatus();
    }

    // 從本地存儲恢復音樂狀態
    async restoreMusicStateFromStorage() {
        try {
            const savedState = localStorage.getItem('musicStreamState');
            if (savedState) {
                const musicState = JSON.parse(savedState);
                console.log('🔍 檢測到保存的音樂狀態:', musicState);
                
                if (musicState.isPlaying && musicState.currentVideoId) {
                    console.log('🔄 嘗試恢復保存的音樂狀態');
                    await this.reconnectMusicStream(musicState);
                }
                
                // 清除保存的狀態
                localStorage.removeItem('musicStreamState');
            }
        } catch (error) {
            console.error('❌ 恢復音樂狀態失敗:', error);
        }
    }

    // 處理音樂流狀態變更
    handleMusicStreamChange(data) {
        console.log('🎵 音樂流狀態變更:', data);
        
        if (data.type === 'music_start' || (data.action === 'music_start')) {
            this.musicStreamState.isPlaying = true;
            this.musicStreamState.currentVideoId = data.currentVideoId || data.videoId;
            this.musicStreamState.volume = data.volume || data.data?.volume || this.musicStreamState.volume;
            this.musicStreamState.isMuted = data.isMuted || data.data?.isMuted || this.musicStreamState.isMuted;
        } else if (data.type === 'music_stop' || (data.action === 'music_stop')) {
            this.musicStreamState.isPlaying = false;
            this.musicStreamState.currentVideoId = null;
        } else if (data.type === 'music_pause' || (data.action === 'music_pause')) {
            this.musicStreamState.isPlaying = false;
        } else if (data.type === 'music_volume_change' || (data.action === 'music_volume_change')) {
            this.musicStreamState.volume = data.volume || data.data?.volume || this.musicStreamState.volume;
        } else if (data.type === 'music_mute_change' || (data.action === 'music_mute_change')) {
            this.musicStreamState.isMuted = data.isMuted || data.data?.isMuted || this.musicStreamState.isMuted;
        } else if (data.type === 'music_stream_state_update') {
            // 處理完整的音樂狀態更新
            this.musicStreamState = {
                isPlaying: data.isPlaying || false,
                currentVideoId: data.currentVideoId || null,
                volume: data.volume || this.musicStreamState.volume,
                isMuted: data.isMuted || this.musicStreamState.isMuted
            };
            
            // 如果目前正在播放音樂，確保觀眾端也同步
            if (this.musicStreamState.isPlaying && this.musicStreamState.currentVideoId) {
                this.reconnectMusicStream(this.musicStreamState);
            }
        }
    }

    // 發送音樂同步消息
    sendMusicSyncMessage(type, data) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }

        this.socket.send(JSON.stringify({
            type: `music_${type}`,
            viewerId: this.viewerId,
            data: data,
            timestamp: Date.now()
        }));
    }

    // 停用重連管理器
    disable() {
        this.isEnabled = false;
        console.log('🎵 音樂流重連管理器已停用');
    }

    // 重置重連嘗試次數
    resetAttempts() {
        this.reconnectAttempts = 0;
        console.log('🔄 重連嘗試次數已重置');
    }
}

// 創建全域音樂流重連管理器實例
window.musicStreamReconnectManager = new MusicStreamReconnectManager();

// 在觀眾端初始化時啟用音樂流重連
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 音樂流重連修復腳本已載入');
    
    // 等待WebSocket連接建立後初始化
    const initializeMusicReconnect = () => {
        if (window.socket && window.viewerId) {
            try {
                window.musicStreamReconnectManager.initialize(window.socket, window.viewerId);
                console.log('✅ 音樂流重連功能已啟用');
            } catch (error) {
                console.error('❌ 音樂流重連初始化失敗:', error);
            }
        } else {
            // 如果尚未準備好，稍後重試
            setTimeout(initializeMusicReconnect, 1000);
        }
    };

    // 延遲初始化以避免與其他初始化衝突
    setTimeout(initializeMusicReconnect, 2000);
});

// 導出管理器供其他模組使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MusicStreamReconnectManager;
}

// 🎵 分頁音訊狀態重連管理器
class TabAudioReconnectManager {
    constructor() {
        this.isEnabled = false;
        this.tabAudioEnabled = false;
        this.socket = null;
        this.broadcasterId = null;
        
        console.log('🎵 分頁音訊重連管理器已初始化');
    }

    // 初始化分頁音訊重連功能
    initialize(socket, broadcasterId) {
        this.socket = socket;
        this.broadcasterId = broadcasterId;
        this.isEnabled = true;
        
        console.log('🎵 分頁音訊重連管理器已啟用，主播ID:', broadcasterId);
    }

    // 分頁音訊狀態變更（由主播端調用）
    toggleTabAudio(enabled, audioType = 'tab') {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.log('⚠️ WebSocket未連接，無法發送分頁音訊狀態更新');
            return;
        }

        this.tabAudioEnabled = enabled;
        
        const message = {
            type: 'tab_audio_change',
            data: {
                enabled: enabled,
                audioType: audioType,
                broadcasterId: this.broadcasterId
            },
            timestamp: Date.now()
        };
        
        console.log('📤 發送分頁音訊狀態更新:', message);
        this.socket.send(JSON.stringify(message));
    }
    
    // 🎵 發送音樂狀態查詢請求（觀眾端）
    requestTabAudioState() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.log('⚠️ WebSocket未連接，無法請求分頁音訊狀態');
            return;
        }

        console.log('🔍 請求分頁音訊狀態...');
        this.socket.send(JSON.stringify({
            type: 'request_tab_audio_state',
            viewerId: this.viewerId || 'viewer',
            timestamp: Date.now()
        }));
    }

    // 處理分頁音訊狀態響應
    handleTabAudioState(data) {
        console.log('🎵 收到分頁音訊狀態:', data);
        
        if (data.enabled) {
            console.log('🔄 分頁音訊已啟用，嘗試重新連接...');
            this.showTabAudioStatus('✅ 背景音樂分享已啟用');
        } else {
            console.log('🔇 分頁音訊已停用');
            this.showTabAudioStatus('🔇 背景音樂分享已停用');
        }
    }

    // 顯示分頁音訊狀態
    showTabAudioStatus(message) {
        if (window.displaySystemMessage) {
            window.displaySystemMessage(message);
        } else {
            console.log('🎵 分頁音訊狀態:', message);
        }
    }
}

// 創建全域分頁音訊重連管理器實例
window.tabAudioReconnectManager = new TabAudioReconnectManager();

console.log('✅ 音樂流重連修復腳本載入完成（含分頁音訊支援）');
