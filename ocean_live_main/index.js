        // 載入用戶資訊
        async function loadUserInfo() {
            try {
                const response = await fetch('/api/user');
                const data = await response.json();
                
                if (data.success && data.user) {
                    const userAvatar = document.getElementById('userAvatar');
                    if (userAvatar) {
                        userAvatar.innerHTML = data.user.displayName.charAt(0).toUpperCase();
                        userAvatar.title = data.user.displayName;
                    }
                }
            } catch (error) {
                console.error('載入用戶資訊失敗:', error);
            }
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
            
            // 獲取當前用戶名稱
            const userAvatar = document.getElementById('userAvatar');
            if (!userAvatar) {
                console.error('用戶頭像元素未找到');
                return;
            }
            
            const currentUserName = userAvatar.title || '用戶';
            
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
                    直播管理
                </a>
                <a href="viewer.html" class="menu-link">
                    <i class="fas fa-eye"></i>
                    觀看直播
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
            
            // 確保userAvatar是一個容器
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
            setTimeout(() => {
                document.addEventListener('click', function closeMenu(e) {
                    if (!menu.contains(e.target) && !userAvatar.contains(e.target)) {
                        menu.style.opacity = '0';
                        menu.style.transform = 'translateY(-10px)';
                        setTimeout(() => {
                            if (menu.parentNode) menu.remove();
                        }, 150);
                        document.removeEventListener('click', closeMenu);
                    }
                });
            }, 100);
        }

        // 登出功能
        async function logout() {
            try {
                await fetch('/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
            } catch (error) {
                console.error('登出請求失敗:', error);
            }
            
            localStorage.removeItem('currentUser');
            window.location.href = 'preview.html';
        }

        // 更新統計數據
        function updateStats() {
            // 模擬統計數據
            document.getElementById('totalStreams').textContent = Math.floor(Math.random() * 50) + 10;
            document.getElementById('totalViewers').textContent = Math.floor(Math.random() * 1000) + 500;
        }

        // 檢查認證狀態
        async function checkAuth() {
            try {
                const response = await fetch('/api/user');
                const data = await response.json();
                
                if (!data.success || !data.user) {
                    // 如果未登入，跳轉到預覽頁面
                    window.location.href = 'preview.html';
                    return;
                }
                
                // 同步本地存儲
                localStorage.setItem('currentUser', JSON.stringify(data.user));
            } catch (error) {
                console.error('檢查認證狀態失敗:', error);
                window.location.href = 'preview.html';
            }
        }

        // 頁面載入時執行
        document.addEventListener('DOMContentLoaded', () => {
            checkAuth();
            loadUserInfo();
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
            const currentUser = JSON.parse(localStorage.getItem('currentUser'));
            if (!currentUser) {
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
    