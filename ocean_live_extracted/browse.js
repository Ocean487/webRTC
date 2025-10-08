// 瀏覽直播頁面 JavaScript

let currentUser = null;
let streamers = [];
let filteredStreamers = [];
let currentFilter = 'all';
let selectedStreamer = null;

// 更新用戶頭像顯示
function updateUserAvatar() {
    const userAvatar = document.getElementById('userAvatar');
    if (!userAvatar) return;
    
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (currentUser && currentUser.displayName) {
            userAvatar.title = currentUser.displayName;
            // 如果有頭像URL，可以設置頭像圖片
            if (currentUser.avatarUrl) {
                userAvatar.innerHTML = `<img src="${currentUser.avatarUrl}" alt="${currentUser.displayName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
                userAvatar.innerHTML = `<i class="fas fa-user"></i>`;
            }
        }
    } catch (error) {
        console.log('無法更新用戶頭像信息');
    }
}

// 頁面載入時初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== 瀏覽直播頁面初始化 ===');
    
    // 載入用戶信息
    loadCurrentUser();
    
    // 更新用戶頭像
    updateUserAvatar();
    
    // 設置事件監聽器
    setupEventListeners();
    
    // 載入主播列表
    loadStreamers();
    
    // 設置自動刷新
    setInterval(loadStreamers, 30000); // 每30秒刷新一次
});

// 載入當前用戶
async function loadCurrentUser() {
    try {
        const response = await fetch('/api/user/current');
        const data = await response.json();
        
        if (data.success && data.user) {
            currentUser = data.user;
            updateUserDisplay(currentUser);
            console.log('✅ 用戶已登入:', currentUser.displayName);
        } else {
            console.log('⚠️ 用戶未登入，使用訪客模式');
            currentUser = null;
            updateUserDisplay(null);
        }
    } catch (error) {
        console.error('載入用戶信息失敗:', error);
        currentUser = null;
        updateUserDisplay(null);
    }
}

// 更新用戶顯示
function updateUserDisplay(user) {
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    
    if (user && userAvatar) {
        if (user.avatarUrl) {
            userAvatar.innerHTML = `<img src="${user.avatarUrl}" alt="${user.displayName}">`;
        } else {
            const initial = user.displayName.charAt(0).toUpperCase();
            userAvatar.innerHTML = initial;
        }
        
        if (userName) {
            userName.textContent = user.displayName;
        }
    } else if (userAvatar) {
        userAvatar.innerHTML = '<i class="fas fa-user"></i>';
        if (userName) {
            userName.textContent = '訪客';
        }
    }
}

// 設置事件監聽器
function setupEventListeners() {
    // 搜索功能
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    
    // 篩選按鈕
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // 移除所有active類
            filterButtons.forEach(b => b.classList.remove('active'));
            // 添加active類到當前按鈕
            this.classList.add('active');
            
            currentFilter = this.dataset.filter;
            applyFilters();
        });
    });
    
    // 模態框關閉
    const modal = document.getElementById('streamerModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeStreamerModal();
            }
        });
    }
    
    // ESC鍵關閉模態框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeStreamerModal();
        }
    });
}

// 載入主播列表
async function loadStreamers() {
    try {
        console.log('🔄 載入主播列表...');
        showLoadingState();
        
        const response = await fetch('/api/live-streams');
        const data = await response.json();
        
        if (data.success) {
            streamers = data.streams || [];
            console.log('✅ 載入主播列表成功:', streamers.length, '個主播');
            
            // 更新統計信息
            updateStats(data);
            
            // 應用篩選和搜索
            applyFilters();
            
            hideLoadingState();
        } else {
            console.error('❌ 載入主播列表失敗:', data.message);
            showEmptyState();
        }
    } catch (error) {
        console.error('❌ 載入主播列表錯誤:', error);
        showEmptyState();
    }
}

// 更新統計信息
function updateStats(data) {
    const totalViewers = document.getElementById('totalViewers');
    const totalBroadcasters = document.getElementById('totalBroadcasters');
    const liveStreams = document.getElementById('liveStreams');
    
    if (totalViewers) {
        totalViewers.textContent = data.totalViewers || 0;
    }
    
    if (totalBroadcasters) {
        totalBroadcasters.textContent = data.totalBroadcasters || 0;
    }
    
    if (liveStreams) {
        const liveCount = streamers.filter(s => s.isStreaming).length;
        liveStreams.textContent = liveCount;
    }
}

// 顯示加載狀態
function showLoadingState() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const streamersGrid = document.getElementById('streamersGrid');
    
    if (loadingState) loadingState.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    if (streamersGrid) streamersGrid.style.display = 'none';
}

// 隱藏加載狀態
function hideLoadingState() {
    const loadingState = document.getElementById('loadingState');
    
    if (loadingState) loadingState.style.display = 'none';
}

// 顯示空狀態
function showEmptyState() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const streamersGrid = document.getElementById('streamersGrid');
    
    if (loadingState) loadingState.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    if (streamersGrid) streamersGrid.style.display = 'none';
}

// 處理搜索
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    // 實時搜索
    applyFilters();
}

// 應用篩選和搜索
function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    // 根據篩選條件過濾
    filteredStreamers = streamers.filter(streamer => {
        // 狀態篩選
        if (currentFilter === 'live') {
            if (!streamer.isStreaming) return false;
        } else if (currentFilter === 'online') {
            if (streamer.isStreaming) return false;
        }
        // 'all' 不進行狀態篩選
        
        // 搜索篩選
        if (searchTerm) {
            const nameMatch = streamer.displayName.toLowerCase().includes(searchTerm);
            const titleMatch = streamer.streamTitle.toLowerCase().includes(searchTerm);
            return nameMatch || titleMatch;
        }
        
        return true;
    });
    
    renderStreamers();
}

// 渲染主播列表
function renderStreamers() {
    const streamersGrid = document.getElementById('streamersGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (!streamersGrid) return;
    
    if (filteredStreamers.length === 0) {
        streamersGrid.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
            const emptyMessage = emptyState.querySelector('h3');
            const emptyDesc = emptyState.querySelector('p');
            
            if (currentFilter === 'live') {
                emptyMessage.textContent = '暫無主播正在直播';
                emptyDesc.textContent = '目前沒有主播正在直播，請稍後再來查看';
            } else if (currentFilter === 'online') {
                emptyMessage.textContent = '暫無主播在線';
                emptyDesc.textContent = '目前沒有主播在線，請稍後再來查看';
            } else {
                emptyMessage.textContent = '暫無主播在線';
                emptyDesc.textContent = '目前沒有主播在線，請稍後再來查看';
            }
        }
    } else {
        streamersGrid.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';
        
        streamersGrid.innerHTML = filteredStreamers.map(streamer => createStreamerCard(streamer)).join('');
    }
}

// 創建主播卡片
function createStreamerCard(streamer) {
    const statusClass = streamer.isStreaming ? 'live' : 'online';
    const statusText = streamer.isStreaming ? '直播中' : '在線';
    const statusIcon = streamer.isStreaming ? 'fas fa-play-circle' : 'fas fa-circle';
    
    const avatarHtml = streamer.avatarUrl ? 
        `<img src="${streamer.avatarUrl}" alt="${streamer.displayName}">` :
        `<img src="images/cute-dog-avatar.png" alt="可愛狗狗頭像">`;
    
    const startTime = streamer.startTime ? 
        formatTimeAgo(new Date(streamer.startTime)) : '--';
    
    const titleHtml = streamer.streamTitle ? 
        `<div class="streamer-title">${streamer.streamTitle}</div>` : '';
    
    const titleText = streamer.streamTitle || '暫無直播標題';
    const statusMessage = streamer.isStreaming ? 
        '正在直播中，立即觀看！' : 
        '主播在線，等待開始直播';
    
    return `
        <div class="streamer-card" onclick="openStreamerModal('${streamer.broadcasterId}')">
            <div class="streamer-card-content">
                <div class="streamer-header">
                    <div class="streamer-avatar-container">
                        <div class="streamer-avatar">
                            ${avatarHtml}
                        </div>
                    </div>
                    <div class="streamer-status-indicator ${statusClass}">
                        <i class="${statusIcon}"></i>
                        ${statusText}
                    </div>
                </div>
                <div class="streamer-name">${streamer.displayName}</div>
                <div class="streamer-stats">
                    <span>
                        <i class="fas fa-eye"></i>
                        ${streamer.viewerCount} 觀看
                    </span>
                    <span>
                        <i class="fas fa-clock"></i>
                        ${startTime}
                    </span>
                </div>
                <div class="streamer-title">${titleText}</div>
            </div>
            <div class="streamer-card-footer">
                <div class="streamer-status-message">${statusMessage}</div>
            </div>
        </div>
    `;
}

// 格式化時間
function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}天前`;
    } else if (hours > 0) {
        return `${hours}小時前`;
    } else if (minutes > 0) {
        return `${minutes}分鐘前`;
    } else {
        return '剛剛';
    }
}

// 打開主播詳情模態框
function openStreamerModal(broadcasterId) {
    const streamer = streamers.find(s => s.broadcasterId === broadcasterId);
    if (!streamer) {
        console.error('找不到主播:', broadcasterId);
        return;
    }
    
    selectedStreamer = streamer;
    
    // 更新模態框內容
    const modal = document.getElementById('streamerModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalAvatar = document.getElementById('modalAvatar');
    const modalStreamerName = document.getElementById('modalStreamerName');
    const modalViewerCount = document.getElementById('modalViewerCount');
    const modalStartTime = document.getElementById('modalStartTime');
    const modalStreamTitle = document.getElementById('modalStreamTitle');
    const modalStatus = document.getElementById('modalStatus');
    const watchStreamBtn = document.getElementById('watchStreamBtn');
    
    if (modalTitle) modalTitle.textContent = `${streamer.displayName} 的直播間`;
    
    if (modalAvatar) {
        if (streamer.avatarUrl) {
            modalAvatar.src = streamer.avatarUrl;
            modalAvatar.alt = streamer.displayName;
        } else {
            modalAvatar.src = 'images/cute-dog-avatar.png';
            modalAvatar.alt = '可愛狗狗頭像';
        }
        modalAvatar.style.display = 'block';
    }
    
    if (modalStreamerName) modalStreamerName.textContent = streamer.displayName;
    if (modalViewerCount) modalViewerCount.textContent = streamer.viewerCount;
    if (modalStartTime) modalStartTime.textContent = streamer.startTime ? formatTimeAgo(new Date(streamer.startTime)) : '--';
    
    if (modalStreamTitle) {
        modalStreamTitle.innerHTML = streamer.streamTitle || '暫無直播標題';
    }
    
    if (modalStatus) {
        const statusClass = streamer.isStreaming ? 'live' : 'online';
        const statusText = streamer.isStreaming ? '正在直播' : '在線';
        modalStatus.className = `streamer-status ${statusClass}`;
        modalStatus.textContent = statusText;
    }
    
    if (watchStreamBtn) {
        watchStreamBtn.innerHTML = streamer.isStreaming ? 
            '<i class="fas fa-play"></i> 觀看直播' : 
            '<i class="fas fa-eye"></i> 進入直播間';
    }
    
    // 顯示模態框
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// 關閉主播詳情模態框
function closeStreamerModal() {
    const modal = document.getElementById('streamerModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
        selectedStreamer = null;
    }
}

// 觀看直播
function watchStream() {
    if (!selectedStreamer) {
        console.error('沒有選中的主播');
        return;
    }
    
    console.log('觀看直播:', selectedStreamer.broadcasterId);
    
    // 構建觀看URL
    const viewerUrl = `viewer.html?broadcaster=${selectedStreamer.broadcasterId}`;
    
    // 關閉模態框
    closeStreamerModal();
    
    // 跳轉到觀看頁面
    window.location.href = viewerUrl;
}

// 重新整理主播列表
function refreshStreamers() {
    console.log('🔄 手動重新整理主播列表');
    loadStreamers();
}

// 切換用戶選單
function toggleUserMenu() {
    // 移除現有選單
    const existingMenu = document.querySelector('.user-dropdown');
    if (existingMenu) {
        existingMenu.style.opacity = '0';
        existingMenu.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            if (existingMenu.parentNode) {
                existingMenu.remove();
            }
        }, 150);
        return;
    }
    
    // 獲取用戶頭像元素
    const userAvatar = document.getElementById('userAvatar');
    if (!userAvatar) {
        console.error('用戶頭像元素未找到');
        return;
    }
    
    // 嘗試從localStorage獲取用戶信息
    let currentUserName = '用戶';
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (currentUser && currentUser.displayName) {
            currentUserName = currentUser.displayName;
        } else if (userAvatar.title) {
            currentUserName = userAvatar.title;
        }
    } catch (error) {
        console.log('無法獲取用戶信息，使用默認名稱');
    }
    
    // 創建下拉選單
    const menu = document.createElement('div');
    menu.className = 'user-dropdown';
    menu.style.opacity = '0';
    menu.style.transform = 'translateY(-10px)';
    menu.style.transition = 'all 0.15s ease-out';
    
    menu.innerHTML = `
        <div class="menu-user-info">
            <div class="menu-user-name">${currentUserName}</div>
        </div>
        <a href="livestream_platform.html" class="menu-link">
            <i class="fas fa-video"></i>
            開始直播
        </a>
        <a href="browse.html" class="menu-link">
            <i class="fas fa-eye"></i>
            瀏覽直播
        </a>
        <a href="about.html" class="menu-link">
            <i class="fas fa-info-circle"></i>
            關於平台
        </a>
        <a href="#" onclick="logout(); event.preventDefault();" class="menu-link logout">
            <i class="fas fa-sign-out-alt"></i>
            登出
        </a>
    `;
    
    // 確保userAvatar是一個相對定位的容器
    if (userAvatar.style.position !== 'relative') {
        userAvatar.style.position = 'relative';
    }
    
    userAvatar.appendChild(menu);
    
    // 顯示動畫
    setTimeout(() => {
        menu.style.opacity = '1';
        menu.style.transform = 'translateY(0)';
    }, 10);
    
    // 點擊其他地方關閉選單
    setTimeout(() => {
        function closeMenu(e) {
            if (!menu.contains(e.target) && !userAvatar.contains(e.target)) {
                menu.style.opacity = '0';
                menu.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    if (menu.parentNode) {
                        menu.remove();
                    }
                }, 150);
                document.removeEventListener('click', closeMenu);
            }
        }
        document.addEventListener('click', closeMenu);
    }, 100);
}

// 登出功能
async function logout() {
    try {
        const response = await fetch('/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = '/index.html';
        } else {
            console.error('登出失敗:', data.message);
            alert('登出失敗，請稍後再試');
        }
    } catch (error) {
        console.error('登出錯誤:', error);
        alert('登出失敗，請檢查網路連接');
    }
}

// 移除不再需要的移動端菜單函數

// 導出函數供HTML調用
window.toggleUserMenu = toggleUserMenu;
window.logout = logout;
window.openStreamerModal = openStreamerModal;
window.closeStreamerModal = closeStreamerModal;
window.watchStream = watchStream;
window.refreshStreamers = refreshStreamers;

console.log('✅ 瀏覽直播頁面腳本載入完成');
