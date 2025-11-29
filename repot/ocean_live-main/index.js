// 更新統計數據
function updateStats() {
    // 模擬統計數據
    document.getElementById('totalStreams').textContent = Math.floor(Math.random() * 50) + 10;
    document.getElementById('totalViewers').textContent = Math.floor(Math.random() * 1000) + 500;
}

// 頁面載入時執行
document.addEventListener('DOMContentLoaded', async () => {
    await window.checkAuth(); // 使用 common.js 中的 checkAuth
    window.updateUserDisplay(window.currentUser); // 使用 common.js 中的 updateUserDisplay
    updateStats();
    loadLiveStreams();
    
    // 每30秒更新一次統計數據和直播狀態
    setInterval(() => {
        updateStats();
        loadLiveStreams();
    }, 30000);
});

// 載入直播列表
async function loadLiveStreams() {
    const grid = document.getElementById('liveStreamsGrid');
    
    // 顯示載入狀態
    grid.innerHTML = `
        <div class="loading-indicator">
            <i class="fas fa-spinner fa-spin"></i>
            <p>正在檢查直播狀態...</p>
        </div>
    `;
    
    try {
        const response = await fetch('/api/live-streams');
        const data = await response.json();
        
        if (data.success && data.streams && data.streams.length > 0) {
            // 顯示直播列表
            grid.innerHTML = data.streams.map(stream => `
                <div class="live-stream-item" onclick="watchStream('${stream.userId}')">
                    <div class="live-streamer-info">
                        <div class="live-avatar">${stream.username.substring(0, 2).toUpperCase()}</div>
                        <div class="live-details">
                            <h4>${stream.username}</h4>
                            <div class="live-status">
                                <div class="live-dot"></div>
                                <span>正在直播</span>
                                <span>・${stream.viewerCount || 0} 觀眾</span>
                            </div>
                        </div>
                    </div>
                    <div class="live-actions">
                        <button class="watch-btn" onclick="event.stopPropagation(); watchStream('${stream.userId}')">
                            <i class="fas fa-play"></i> 觀看
                        </button>
                        <button class="share-btn" onclick="event.stopPropagation(); shareStream('${stream.userId}', '${stream.username}')">
                            <i class="fas fa-share"></i> 分享
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            // 沒有直播時顯示提示
            grid.innerHTML = `
                <div class="no-streams-message">
                    <h3><i class="fas fa-video-slash"></i> 目前沒有直播</h3>
                    <p>沒有用戶正在直播，<a href="livestream_platform.html" style="color: #4ecdc4;">點擊這裡開始你的直播</a></p>
                </div>
            `;
        }
    } catch (error) {
        console.error('載入直播列表失敗:', error);
        grid.innerHTML = `
            <div class="no-streams-message">
                <h3><i class="fas fa-exclamation-triangle"></i> 載入失敗</h3>
                <p>無法載入直播列表，請檢查網路連線或稍後再試</p>
            </div>
        `;
    }
}

// 觀看直播
function watchStream(userId) {
    // 檢查登入狀態
    if (!window.currentUser) {
        alert('請先登入才能觀看直播');
        window.location.href = 'login.html';
        return;
    }
    
    // 跳轉到觀看頁面
    window.location.href = `viewer.html?streamer=${userId}`;
}

// 分享直播
function shareStream(userId, username) {
    const streamUrl = `${window.location.origin}/viewer.html?streamer=${userId}`;
    
    if (navigator.share) {
        navigator.share({
            title: `觀看 ${username} 的直播`,
            text: `${username} 正在 VibeLo 平台直播！`,
            url: streamUrl
        });
    } else {
        // 複製到剪貼板
        navigator.clipboard.writeText(streamUrl).then(() => {
            alert('直播連結已複製到剪貼板！');
        }).catch(() => {
            prompt('複製直播連結:', streamUrl);
        });
    }
}

// 重新整理直播列表
function refreshLiveStreams() {
    loadLiveStreams();
}
