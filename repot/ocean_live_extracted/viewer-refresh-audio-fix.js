// 🎵 觀眾重整音訊修復 - 簡化版本
// 專門解決觀眾重整後聽不到主播分享音樂的問題
// ================================================

console.log('🎵 觀眾重整音訊修復腳本載入中...');

// 檢測是否為頁面重整
function isPageRefresh() {
    // 如果 document.referrer 不為空且等於當前頁面 URL，則可能為重整
    return document.referrer && 
           document.referrer !== '' && 
           document.referrer.includes(window.location.hostname);
}

// 在頁面載入時檢測音訊狀態
function detectAndReconnectAudio() {
    console.log('🔍 開始檢測音訊狀態...');
    
    // 等待 WebSocket 連接建立
    setTimeout(() => {
        if (window.socket && window.socket.readyState === WebSocket.OPEN) {
            console.log('✅ WebSocket 已連接，請求音訊狀態');
            
            // 發送音訊狀態查詢
            const message = {
                type: 'request_audio_stream_status',
                viewerId: window.viewerId || 'unknown_viewer',
                refreshDetected: true,
                timestamp: Date.now()
            };
            
            window.socket.send(JSON.stringify(message));
            console.log('📡 已發送音訊狀態查詢', message);
        } else {
            console.log('⚠️ WebSocket 未連接，延遲重試');
            setTimeout(detectAndReconnectAudio, 2000);
        }
    }, 1500);
}

// 處理音訊狀態響應
function handleAudioStatusResponse(data) {
    console.log('🎵 收到音訊狀態響應:', data);
    
    let hasAudio = false;
    
    // 檢查音樂流
    if (data.musicStream && data.musicStream.isPlaying) {
        console.log('🎵 檢測到音樂流:', data.musicStream.currentVideoId);
        hasAudio = true;
        
        // 顯示音樂狀態
        if (window.displaySystemMessage) {
            window.displaySystemMessage('🎵 音樂已重新同步');
        }
    }
    
    // 檢查分頁音訊
    if (data.tabAudioStream && data.tabAudioStream.enabled) {
        console.log('🎵 檢測到分頁音訊已啟用');
        hasAudio = true;
        
        // 檢查 WebRTC 音訊軌道
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && remoteVideo.srcObject) {
            const audioTracks = remoteVideo.srcObject.getAudioTracks();
            console.log('🔊 WebRTC 音訊軌道數量:', audioTracks.length);
            
            if (audioTracks.length > 0) {
                console.log('✅ WebRTC 音訊軌道正常');
            } else {
                console.log('❌ WebRTC 音訊軌道異常');
            }
        }
        
        // 顯示分頁音訊狀態
        if (window.displaySystemMessage) {
            window.displaySystemMessage('🎵 背景音樂分享已重新同步');
        }
    }
    
    if (!hasAudio) {
        console.log('🔇 未檢測到任何音訊流');
        if (window.displaySystemMessage) {
            window.displaySystemMessage('🔇 當前無音訊播放');
        }
    }
}

// 強制音訊重連
function forceAudioReconnect() {
    console.log('🔄 強制音訊重連...');
    
    // 重新初始化 WebRTC（如果存在）
    if (typeof window.initializePeerConnection === 'function') {
        console.log('🔄 重新初始化 WebRTC...');
        window.initializePeerConnection();
    }
    
    // 重新請求音訊狀態
    setTimeout(() => {
        detectAndReconnectAudio();
    }, 1000);
}

// 頁面重整檢測和處理
function handlePageRefresh() {
    console.log('🔄 檢測到頁面重整');
    
    // 保存重整標記
    sessionStorage.setItem('pageRefreshed', 'true');
    sessionStorage.setItem('refreshTime', Date.now().toString());
    
    console.log('💾 已保存重整記錄');
}

// 初始化音訊修復
function initializeAudioFix() {
    console.log('🎵 初始化音訊修復功能...');
    
    // 檢測是否為重整
    const isRefresh = isPageRefresh() || 
                     sessionStorage.getItem('pageRefreshed') === 'true';
    
    console.log('📄 頁面類型:', isRefresh ? '重整' : '初次載入');
    
    if (isRefresh) {
        console.log('🔄 檢測到頁面重整，啟動音訊恢復流程');
        
        // 清除重整標記
        sessionStorage.removeItem('pageRefreshed');
        sessionStorage.removeItem('refreshTime');
        
        // 延遲檢測音訊狀態
        setTimeout(detectAndReconnectAudio, 2000);
    } else {
        // 初次載入，設置重整標記
        handlePageRefresh();
    }
    
    console.log('✅ 音訊修復功能已初始化');
}

// 等待頁面載入完成後初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAudioFix);
} else {
    initializeAudioFix();
}

// 在頁面卸載前設置重整標記
window.addEventListener('beforeunload', () => {
    console.log('📤 頁面即將卸載');
    sessionStorage.setItem('pageRefreshing', 'true');
});

// 全域函數供調試使用
window.detectAndReconnectAudio = detectAndReconnectAudio;
window.handleAudioStatusResponse = handleAudioStatusResponse;
window.forceAudioReconnect = forceAudioReconnect;

console.log('✅ 觀眾重整音訊修復腳本載入完成');
