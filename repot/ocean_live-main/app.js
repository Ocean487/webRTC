// 全局狀態
let streams = [];
let currentStream = null;
let viewMode = 'grid'; // 'grid' or 'list'
let currentFilter = 'hot'; // 'hot', 'new', 'explore'

// 初始化應用
document.addEventListener('DOMContentLoaded', async () => {
    // 如果是預覽頁面，不需要檢查登入
    if (!window.location.pathname.includes('preview.html')) {
        const isAuthenticated = await window.checkAuth(); // 使用 common.js 中的 checkAuth
        if (!isAuthenticated) return;
    }
    
    // 載入直播列表
    loadStreams();
    
    // 初始化用戶介面
    initializeUI();
    
    // 設置事件監聽器
    setupEventListeners();
});

// 載入直播列表
async function loadStreams() {
    // 模擬從服務器獲取直播列表
    streams = [
        {
            id: '1',
            title: '實況遊戲直播中！',
            streamer: 'GamerPro',
            streamerAvatar: 'default-avatar.png',
            thumbnail: 'default-thumbnail.jpg',
            viewers: 1234,
            duration: '02:30:45',
            category: '遊戲',
            tags: ['RPG', '冒險', '實況']
        },
        {
            id: '2',
            title: '音樂創作分享',
            streamer: 'MusicLover',
            streamerAvatar: 'default-avatar.png',
            thumbnail: 'default-thumbnail.jpg',
            viewers: 567,
            duration: '01:15:20',
            category: '音樂',
            tags: ['原創', '演奏', 'Cover']
        }
    ];
    
    renderStreams();
}

// 渲染直播列表
function renderStreams() {
    const streamsContainer = document.querySelector('.live-streams');
    if (!streamsContainer) return;
    
    streamsContainer.innerHTML = streams.map(stream => `
        <div class="stream-card glass-effect" onclick="watchStream('${stream.id}')">
            <div class="thumbnail-container">
                <img class="stream-thumbnail" src="${stream.thumbnail}" alt="${stream.title}">
                <div class="stream-info-overlay">
                    <span class="viewer-count">
                        <i class="fas fa-eye"></i>
                        <span class="count">${stream.viewers}</span>
                    </span>
                    <span class="stream-duration">
                        <i class="fas fa-clock"></i>
                        <span class="time">${stream.duration}</span>
                    </span>
                </div>
            </div>
            <div class="stream-details">
                <img class="streamer-avatar" src="${stream.streamerAvatar}" alt="${stream.streamer}">
                <div class="stream-text">
                    <h4 class="stream-title">${stream.title}</h4>
                    <p class="streamer-name">${stream.streamer}</p>
                    <div class="stream-tags">
                        ${stream.tags.map(tag => `<span class="stream-tag">${tag}</span>`).join('')}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// 初始化用戶介面
function initializeUI() {
    // 更新用戶頭像和名稱
    const userMenu = document.getElementById('userMenu');
    if (userMenu && window.currentUser) {
        const userAvatar = userMenu.querySelector('#userAvatar');
        const userName = userMenu.querySelector('#userName');
        if (userAvatar) userAvatar.src = window.currentUser.avatar || 'default-avatar.png';
        if (userName) userName.textContent = window.currentUser.username;
    }

    // 初始化篩選器和檢視模式
    updateFilterButtons();
    updateViewButtons();
}

// 設置事件監聽器
function setupEventListeners() {
    // 用戶選單切換
    const userMenu = document.getElementById('userMenu');
    const userDropdown = document.getElementById('userDropdown');
    if (userMenu && userDropdown) {
        userMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            userDropdown.classList.remove('show');
        });
    }

    // 篩選按鈕
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.getAttribute('data-filter') || 'hot';
            updateFilterButtons();
            loadStreams(); // 重新載入並篩選直播列表
        });
    });

    // 檢視模式按鈕
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            viewMode = btn.getAttribute('data-view') || 'grid';
            updateViewButtons();
            updateStreamListView();
        });
    });
}

// 更新篩選按鈕狀態
function updateFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        if (btn.getAttribute('data-filter') === currentFilter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// 更新檢視模式按鈕狀態
function updateViewButtons() {
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(btn => {
        if (btn.getAttribute('data-view') === viewMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// 更新直播列表檢視模式
function updateStreamListView() {
    const container = document.querySelector('.live-streams');
    if (container) {
        container.className = `live-streams ${viewMode}-view`;
    }
}

// 開始直播
function startStreaming() {
    window.location.href = 'stream.html';
}

// 觀看直播
function watchStream(streamId) {
    window.location.href = `stream.html?id=${streamId}`;
}

// 前往個人檔案
function goToProfile() {
    // TODO: 實現個人檔案頁面
    alert('個人檔案功能開發中');
}

// 前往設定
function goToSettings() {
    // TODO: 實現設定頁面
    alert('設定功能開發中');
}