        // 全局變數
        let allStreams = [];
        let filteredStreams = [];
        let currentFilter = 'all';
        let currentView = 'grid';

        // 頁面載入時初始化
        document.addEventListener('DOMContentLoaded', function() {
            initializePage();
            setupEventListeners();
            loadStreams();
        });

        // 初始化頁面
        function initializePage() {
            console.log('🎬 直播瀏覽頁面初始化');
        }

        // 設置事件監聽器
        function setupEventListeners() {
            // 搜索功能
            const searchInput = document.getElementById('searchInput');
            searchInput.addEventListener('input', debounce(handleSearch, 300));

            // 篩選按鈕
            document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
                btn.addEventListener('click', function() {
                    setActiveFilter(this.dataset.filter);
                });
            });

            // 視圖切換
            document.querySelectorAll('.view-btn[data-view]').forEach(btn => {
                btn.addEventListener('click', function() {
                    setActiveView(this.dataset.view);
                });
            });

            // 定期更新直播列表
            setInterval(loadStreams, 30000); // 每30秒更新一次
        }

        // 載入直播列表
        async function loadStreams() {
            try {
                const response = await fetch('/api/live-streams');
                const data = await response.json();
                
                if (data.success) {
                    allStreams = data.streams || [];
                    updateStreamCount(allStreams.length);
                    applyFilters();
                } else {
                    showEmptyState('載入失敗', '無法載入直播列表，請檢查網路連線');
                }
            } catch (error) {
                console.error('載入直播列表失敗:', error);
                showEmptyState('載入失敗', '無法連接到服務器，請稍後再試');
            }
        }

        // 更新直播數量顯示
        function updateStreamCount(count) {
            const countElement = document.getElementById('streamCount');
            if (count === 0) {
                countElement.textContent = '目前沒有正在進行的直播';
            } else {
                countElement.textContent = `共 ${count} 個直播正在進行`;
            }
        }

        // 處理搜索
        function handleSearch(event) {
            const query = event.target.value.toLowerCase().trim();
            
            if (query === '') {
                filteredStreams = [...allStreams];
            } else {
                filteredStreams = allStreams.filter(stream => 
                    stream.username.toLowerCase().includes(query) ||
                    (stream.title && stream.title.toLowerCase().includes(query))
                );
            }
            
            renderStreams();
        }

        // 設置活躍篩選器
        function setActiveFilter(filter) {
            currentFilter = filter;
            
            // 更新按鈕狀態
            document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
            
            applyFilters();
        }

        // 設置活躍視圖
        function setActiveView(view) {
            currentView = view;
            
            // 更新按鈕狀態
            document.querySelectorAll('.view-btn[data-view]').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`[data-view="${view}"]`).classList.add('active');
            
            // 更新網格類名
            const grid = document.getElementById('streamsGrid');
            if (view === 'list') {
                grid.classList.add('list-view');
            } else {
                grid.classList.remove('list-view');
            }
        }

        // 應用篩選
        function applyFilters() {
            switch (currentFilter) {
                case 'popular':
                    filteredStreams = [...allStreams].sort((a, b) => (b.viewerCount || 0) - (a.viewerCount || 0));
                    break;
                case 'new':
                    filteredStreams = [...allStreams].sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
                    break;
                case 'followed':
                    // 這裡可以添加關注邏輯
                    filteredStreams = [...allStreams];
                    break;
                default:
                    filteredStreams = [...allStreams];
            }
            
            renderStreams();
        }

        // 渲染直播列表
        function renderStreams() {
            const grid = document.getElementById('streamsGrid');
            
            if (filteredStreams.length === 0) {
                if (allStreams.length === 0) {
                    showEmptyState('暫無直播', '目前沒有主播正在直播，稍後再來看看吧！');
                } else {
                    showEmptyState('無匹配結果', '沒有找到符合條件的直播，試試其他關鍵字吧');
                }
                return;
            }
            
            grid.innerHTML = filteredStreams.map(stream => createStreamCard(stream)).join('');
        }

        // 創建直播卡片
        function createStreamCard(stream) {
            const timeAgo = getTimeAgo(stream.startTime);
            const avatarText = stream.username.substring(0, 2).toUpperCase();
            
            return `
                <div class="stream-card" onclick="watchStream('${stream.userId}')">
                    <div class="stream-thumbnail">
                        <div class="live-indicator">
                            <div class="live-dot"></div>
                            LIVE
                        </div>
                        <div class="viewer-count">
                            <i class="fas fa-eye"></i>
                            ${stream.viewerCount || 0}
                        </div>
                        <i class="fas fa-video" style="font-size: 3rem; color: rgba(255,255,255,0.3);"></i>
                    </div>
                    <div class="stream-info">
                        <div class="streamer-profile">
                            <div class="streamer-avatar">${avatarText}</div>
                            <div class="streamer-details">
                                <h3>${stream.username}</h3>
                                <p>直播中 • ${timeAgo}</p>
                            </div>
                        </div>
                        <div class="stream-title">
                            ${stream.title || '精彩直播中...'}
                        </div>
                        <div class="stream-actions">
                            <a href="viewer.html?broadcasterId=${stream.userId}" class="action-btn watch-btn" onclick="event.stopPropagation()">
                                <i class="fas fa-play"></i> 觀看
                            </a>
                            <button class="action-btn share-btn" onclick="event.stopPropagation(); shareStream('${stream.userId}', '${stream.username}')">
                                <i class="fas fa-share"></i> 分享
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        // 顯示空狀態
        function showEmptyState(title, message) {
            const grid = document.getElementById('streamsGrid');
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-video-slash"></i>
                    <h3>${title}</h3>
                    <p>${message}</p>
                </div>
            `;
        }

        // 觀看直播
        function watchStream(userId) {
            window.location.href = `viewer.html?broadcasterId=${userId}`;
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
                navigator.clipboard.writeText(streamUrl).then(() => {
                    alert('直播連結已複製到剪貼板！');
                }).catch(() => {
                    prompt('複製直播連結:', streamUrl);
                });
            }
        }

        // 重新整理直播列表
        function refreshStreams() {
            const grid = document.getElementById('streamsGrid');
            grid.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner"></i>
                    <h3>正在重新載入...</h3>
                    <p>請稍候</p>
                </div>
            `;
            loadStreams();
        }

        // 獲取時間差
        function getTimeAgo(startTime) {
            const now = new Date();
            const start = new Date(startTime);
            const diffMs = now - start;
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins < 1) return '剛開始';
            if (diffMins < 60) return `${diffMins}分鐘前`;
            
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours}小時前`;
            
            const diffDays = Math.floor(diffHours / 24);
            return `${diffDays}天前`;
        }

        // 防抖函數
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    