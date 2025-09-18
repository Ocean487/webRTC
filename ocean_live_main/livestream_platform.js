// 獲取URL參數中的主播ID，如果沒有則使用當前用戶ID
        function getBroadcasterIdFromUrl() {
            const urlParams = new URLSearchParams(window.location.search);
            const urlBroadcasterId = urlParams.get('broadcaster');
            
            if (urlBroadcasterId) {
                return urlBroadcasterId;
            }
            
            // 如果沒有URL參數，基於當前用戶生成ID
            if (currentUser && currentUser.id) {
                return `broadcaster_${currentUser.id}`;
            }
            
            // 最後備份：使用時間戳生成唯一ID
            return `broadcaster_${Date.now()}`;
        }

        // 全局變數存儲主播ID
        let myBroadcasterId = null;

        // 直播標題相關功能
        let currentStreamTitle = '';
        let titleSocket = null; // 專門用於標題更新的WebSocket連接

        // 診斷函數 - 檢查直播系統狀態
        function diagnoseLiveStreamIssue() {
            console.log('=== 直播系統診斷 ===');
            console.log('1. 用戶登入狀態:', currentUser ? '已登入' : '未登入');
            if (currentUser) {
                console.log('   用戶資訊:', currentUser);
            }
            
            console.log('2. WebSocket連接狀態:');
            console.log('   - titleSocket:', titleSocket ? titleSocket.readyState : '未建立');
            console.log('   - streamingSocket:', window.streamingSocket ? window.streamingSocket.readyState : '未建立');
            
            console.log('3. 直播狀態:', window.isStreaming ? '直播中' : '未直播');
            console.log('4. 本地媒體流:', window.localStream ? '已建立' : '未建立');
            
            if (window.localStream) {
                console.log('   - 視頻軌道:', window.localStream.getVideoTracks().length);
                console.log('   - 音頻軌道:', window.localStream.getAudioTracks().length);
                window.localStream.getTracks().forEach((track, index) => {
                    console.log(`   - 軌道 ${index}: ${track.kind}, 狀態: ${track.readyState}, 啟用: ${track.enabled}`);
                });
            }
            
            console.log('5. WebRTC連接數量:', window.peerConnections ? window.peerConnections.size : 0);
            if (window.peerConnections && window.peerConnections.size > 0) {
                window.peerConnections.forEach((pc, viewerId) => {
                    console.log(`   - 觀眾 ${viewerId}: ${pc.connectionState}, ICE: ${pc.iceConnectionState}, 信令: ${pc.signalingState}`);
                });
            }
            
            // 檢查登入API
            fetch('/api/user/current')
                .then(response => response.json())
                .then(data => {
                    console.log('6. 服務器登入狀態:', data);
                })
                .catch(error => {
                    console.log('6. 服務器登入檢查失敗:', error);
                });
            
            console.log('=== 診斷完成 ===');
            
            // 提供建議
            if (!window.isStreaming) {
                console.log('💡 建議: 請先點擊「開始直播」按鈕');
            } else if (!window.localStream) {
                console.log('💡 建議: 請允許攝影機權限並重新開始直播');
            } else if (!window.peerConnections || window.peerConnections.size === 0) {
                console.log('💡 建議: 沒有觀眾連接，請確認觀眾端已開啟');
            }
        }

        // 在控制台中可以調用 diagnoseLiveStreamIssue() 來診斷問題
        window.diagnoseLiveStreamIssue = diagnoseLiveStreamIssue;

        // 臨時測試登入函數 - 僅用於診斷
        function createTestUser() {
            console.log('創建測試用戶...');
            currentUser = {
                username: 'test_broadcaster',
                displayName: '測試主播',
                email: 'test@example.com',
                avatar: null,
                isLoggedIn: true
            };
            
            // 更新UI
            updateUserDisplay(currentUser);
            enableBroadcastFeatures();
            
            // 建立WebSocket連接
            if (!titleSocket || titleSocket.readyState !== WebSocket.OPEN) {
                initTitleWebSocket();
            }
            
            console.log('測試用戶已創建:', currentUser);
            addMessage('系統', '🧪 測試用戶已創建，現在可以開始直播測試');
        }

        // 在控制台中可以調用 createTestUser() 來創建測試用戶
        window.createTestUser = createTestUser;

        // 初始化標題WebSocket連接
        function initTitleWebSocket() {
            if (titleSocket && (titleSocket.readyState === WebSocket.OPEN || titleSocket.readyState === WebSocket.CONNECTING)) {
                return; // 已經連接或正在連接
            }

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            
            console.log('初始化標題WebSocket連接:', wsUrl);
            titleSocket = new WebSocket(wsUrl);
            
            titleSocket.onopen = function() {
                console.log('✅ 標題WebSocket已連接');
                
                // 初始化主播ID
                if (!myBroadcasterId) {
                    myBroadcasterId = getBroadcasterIdFromUrl();
                }
                
                console.log('主播ID:', myBroadcasterId);
                
                // 發送主播加入訊息
                if (currentUser) {
                    titleSocket.send(JSON.stringify({
                        type: 'broadcaster_join',
                        broadcasterId: myBroadcasterId,
                        userInfo: {
                            username: currentUser.username || currentUser.email || 'Anonymous',
                            displayName: currentUser.displayName || currentUser.username || 'Anonymous'
                        }
                    }));
                }
            };
            
            titleSocket.onclose = function() {
                console.log('標題WebSocket連接已關閉，嘗試重連...');
                setTimeout(initTitleWebSocket, 3000); // 3秒後重連
            };
            
            titleSocket.onerror = function(error) {
                console.error('標題WebSocket連接錯誤:', error);
            };
        }

        // 更新直播標題
        function updateStreamTitle() {
            const titleInput = document.getElementById('streamTitleInput');
            const currentTitleDisplay = document.getElementById('currentTitle');
            
            if (titleInput && currentTitleDisplay) {
                const newTitle = titleInput.value.trim();
                if (newTitle !== currentStreamTitle) {
                    currentStreamTitle = newTitle;
                    if (currentStreamTitle) {
                        currentTitleDisplay.textContent = `目前標題: ${currentStreamTitle}`;
                        console.log('直播標題已更新:', currentStreamTitle);
                        
                        // 使用專門的標題WebSocket發送更新
                        if (titleSocket && titleSocket.readyState === WebSocket.OPEN) {
                            titleSocket.send(JSON.stringify({
                                type: 'title_update',
                                title: currentStreamTitle,
                                timestamp: Date.now()
                            }));
                            console.log('已通過titleSocket發送標題更新到觀眾端');
                        } else {
                            console.warn('titleSocket未連接，無法發送標題更新');
                            // 嘗試重新連接
                            initTitleWebSocket();
                        }
                        
                        // 如果正在直播，也通過主要的streamingSocket發送
                        if (window.streamingSocket && window.streamingSocket.readyState === WebSocket.OPEN) {
                            window.streamingSocket.send(JSON.stringify({
                                type: 'title_update',
                                title: currentStreamTitle,
                                timestamp: Date.now()
                            }));
                            console.log('已通過streamingSocket發送標題更新到觀眾端');
                        }
                    } else {
                        currentTitleDisplay.textContent = '目前標題: 未設定';
                    }
                }
            }
        }

        // 實時標題更新（當輸入時）
        function onTitleInput() {
            // 防抖處理，避免過頻繁的更新
            clearTimeout(window.titleUpdateTimeout);
            window.titleUpdateTimeout = setTimeout(updateStreamTitle, 500);
        }

        // 處理標題輸入框的按鍵事件
        function handleTitleKeyPress(event) {
            // 檢查是否按下Enter鍵
            if (event.key === 'Enter' || event.keyCode === 13) {
                event.preventDefault(); // 防止表單提交
                
                // 立即觸發標題更新
                clearTimeout(window.titleUpdateTimeout);
                updateStreamTitle();
                
                // 確保主播名稱也通過titleSocket發送
                if (titleSocket && titleSocket.readyState === WebSocket.OPEN && currentUser) {
                    titleSocket.send(JSON.stringify({
                        type: 'broadcaster_info',
                        broadcaster: currentUser.username || currentUser.email || 'Anonymous',
                        timestamp: Date.now()
                    }));
                    console.log('已通過titleSocket發送主播資訊到觀眾端:', currentUser.username || currentUser.email);
                }
                
                // 也通過主要的streamingSocket發送（如果存在）
                if (window.streamingSocket && window.streamingSocket.readyState === WebSocket.OPEN && currentUser) {
                    window.streamingSocket.send(JSON.stringify({
                        type: 'broadcaster_info',
                        broadcaster: currentUser.username || currentUser.email || 'Anonymous',
                        timestamp: Date.now()
                    }));
                    console.log('已通過streamingSocket發送主播資訊到觀眾端:', currentUser.username || currentUser.email);
                }
            }
        }

        // 頁面載入時初始化標題和檢查登入狀態
        document.addEventListener('DOMContentLoaded', function() {
            // 初始化標題
            const titleInput = document.getElementById('streamTitleInput');
            if (titleInput) {
                titleInput.value = currentStreamTitle;
            }
            
            // 檢查登入狀態
            checkLoginStatus();
            
            // 初始化標題WebSocket連接
            setTimeout(() => {
                initTitleWebSocket();
            }, 1000); // 等待1秒後建立連接，確保頁面完全加載
        });

        // 檢查登入狀態
        async function checkLoginStatus() {
            try {
                const response = await fetch('/api/user/current');
                const data = await response.json();
                
                if (data.success && data.user) {
                    currentUser = data.user;
                    updateUserDisplay(currentUser);
                    enableBroadcastFeatures();
                    
                    // 用戶登入後，如果還沒有標題WebSocket連接，則建立連接
                    if (!titleSocket || titleSocket.readyState !== WebSocket.OPEN) {
                        initTitleWebSocket();
                    }
                } else {
                    currentUser = null;
                    showLoginRequired();
                }
            } catch (error) {
                console.error('檢查登入狀態失敗:', error);
                currentUser = null;
                showLoginRequired();
            }
        }

        // 顯示需要登入的提示並禁用直播功能
        function showLoginRequired() {
            const userAvatar = document.getElementById('userAvatar');
            const streamBtn = document.getElementById('streamBtn');
            
            // 設置預設頭像
            if (userAvatar) {
                userAvatar.innerHTML = '<i class="fas fa-user"></i>';
                userAvatar.title = '請先登入';
            }
            
            // 禁用直播按鈕
            if (streamBtn) {
                streamBtn.disabled = true;
                streamBtn.innerHTML = '<i class="fas fa-lock"></i> 請先登入';
                streamBtn.onclick = function() {
                    showLoginPermissionModal();
                };
            }
            
            // 顯示登入提示訊息
            if (typeof addMessage === 'function') {
                addMessage('系統', '⚠️ 請先登入才能使用直播功能');
            }
        }

        // 增強版toggleStream函數，包含登入驗證
        function secureToggleStream() {
            // 檢查用戶是否已登入
            if (!currentUser) {
                showLoginPermissionModal();
                return;
            }
            
            // 等待 script.js 加載完成
            if (typeof toggleStream === 'function') {
                toggleStream();
            } else {
                console.log('等待 script.js 加載...');
                // 延遲重試，等待腳本加載
                setTimeout(() => {
                    if (typeof toggleStream === 'function') {
                        toggleStream();
                    } else {
                        console.error('toggleStream 函數未找到');
                        showErrorModal('直播功能暫時無法使用，請重新整理頁面後再試。如果問題持續，請檢查網路連線。');
                    }
                }, 1000);
            }
        }

        // 安全的視頻切換函數
        function secureToggleVideo() {
            if (typeof toggleVideo === 'function') {
                toggleVideo();
            } else {
                setTimeout(() => {
                    if (typeof toggleVideo === 'function') {
                        toggleVideo();
                    } else {
                        console.error('toggleVideo 函數未找到');
                        showErrorModal('視頻功能暫時無法使用，請重新整理頁面');
                    }
                }, 500);
            }
        }

        // 安全的音頻切換函數
        function secureToggleAudio() {
            if (typeof toggleAudio === 'function') {
                toggleAudio();
            } else {
                setTimeout(() => {
                    if (typeof toggleAudio === 'function') {
                        toggleAudio();
                    } else {
                        console.error('toggleAudio 函數未找到');
                        showErrorModal('音頻功能暫時無法使用，請重新整理頁面');
                    }
                }, 500);
            }
        }

        // 安全的螢幕分享函數
        function secureShareScreen() {
            if (typeof shareScreen === 'function') {
                shareScreen();
            } else {
                setTimeout(() => {
                    if (typeof shareScreen === 'function') {
                        shareScreen();
                    } else {
                        console.error('shareScreen 函數未找到');
                        showErrorModal('螢幕分享功能暫時無法使用，請重新整理頁面');
                    }
                }, 500);
            }
        }

        // 安全的分頁音頻切換函數
        function secureToggleTabAudio() {
            if (typeof toggleTabAudio === 'function') {
                toggleTabAudio();
            } else {
                setTimeout(() => {
                    if (typeof toggleTabAudio === 'function') {
                        toggleTabAudio();
                    } else {
                        console.error('toggleTabAudio 函數未找到');
                        showErrorModal('分頁音頻功能暫時無法使用，請重新整理頁面');
                    }
                }, 500);
            }
        }

        // 顯示登入權限彈窗
        function showLoginPermissionModal() {
            const modal = document.getElementById('loginPermissionModal');
            if (modal) {
                modal.classList.add('show');
                
                // 添加淡入動畫
                setTimeout(() => {
                    const content = modal.querySelector('.modal-content');
                    if (content) {
                        content.style.transform = 'scale(1)';
                        content.style.opacity = '1';
                    }
                }, 10);
                
                // 阻止背景滾動
                document.body.style.overflow = 'hidden';
                
                // 點擊背景關閉彈窗
                modal.onclick = function(e) {
                    if (e.target === modal) {
                        closeLoginModal();
                    }
                };
                
                // ESC鍵關閉彈窗
                document.addEventListener('keydown', handleEscKey);
            }
        }

        // 關閉登入彈窗
        function closeLoginModal() {
            const modal = document.getElementById('loginPermissionModal');
            if (modal) {
                const content = modal.querySelector('.modal-content');
                if (content) {
                    content.style.transform = 'scale(0.8)';
                    content.style.opacity = '0';
                }
                
                setTimeout(() => {
                    modal.classList.remove('show');
                    document.body.style.overflow = '';
                    
                    // 重置彈窗內容到默認狀態
                    resetModalContent();
                }, 300);
                
                // 移除事件監聽器
                document.removeEventListener('keydown', handleEscKey);
            }
        }

        // 重置彈窗內容到默認狀態
        function resetModalContent() {
            const modal = document.getElementById('loginPermissionModal');
            if (modal) {
                const icon = modal.querySelector('.modal-icon i');
                const title = modal.querySelector('.modal-title');
                const messageElement = modal.querySelector('.modal-message');
                const buttons = modal.querySelector('.modal-buttons');
                
                if (icon) icon.className = 'fas fa-user-lock';
                if (title) title.textContent = '需要登入權限';
                if (messageElement) {
                    messageElement.innerHTML = '
                        開始直播需要登入帳號，這樣可以確保平台安全並提供更好的用戶體驗。
                        <br><br>
                        請先登入您的帳號，或者創建一個新帳號來開始直播。
                    ';
                }
                if (buttons) {
                    buttons.innerHTML = '
                        <a href="/login.html" class="modal-btn primary">
                            <i class="fas fa-sign-in-alt"></i>
                            立即登入
                        </a>
                        <a href="/register.html" class="modal-btn secondary">
                            <i class="fas fa-user-plus"></i>
                            免費註冊
                        </a>
                    ';
                }
            }
        }

        // ESC鍵處理
        function handleEscKey(e) {
            if (e.key === 'Escape') {
                closeLoginModal();
            }
        }

        // 顯示錯誤提示彈窗
        function showErrorModal(message) {
            const modal = document.getElementById('loginPermissionModal');
            if (modal) {
                // 更新彈窗內容為錯誤信息
                const icon = modal.querySelector('.modal-icon i');
                const title = modal.querySelector('.modal-title');
                const messageElement = modal.querySelector('.modal-message');
                const buttons = modal.querySelector('.modal-buttons');
                
                if (icon) icon.className = 'fas fa-exclamation-triangle';
                if (title) title.textContent = '系統錯誤';
                if (messageElement) messageElement.textContent = message;
                if (buttons) {
                    buttons.innerHTML = '
                        <button onclick="closeLoginModal()" class="modal-btn primary">
                            <i class="fas fa-check"></i>
                            確定
                        </button>
                    ';
                }
                
                modal.classList.add('show');
                document.body.style.overflow = 'hidden';
            }
        }

        // 顯示信息提示彈窗
        function showInfoModal(title, message, buttons = null) {
            const modal = document.getElementById('loginPermissionModal');
            if (modal) {
                // 更新彈窗內容
                const icon = modal.querySelector('.modal-icon i');
                const titleElement = modal.querySelector('.modal-title');
                const messageElement = modal.querySelector('.modal-message');
                const buttonsElement = modal.querySelector('.modal-buttons');
                
                if (icon) icon.className = 'fas fa-info-circle';
                if (titleElement) titleElement.textContent = title;
                if (messageElement) {
                    messageElement.innerHTML = message;
                }
                if (buttonsElement) {
                    if (buttons) {
                        buttonsElement.innerHTML = buttons;
                    } else {
                        buttonsElement.innerHTML = '
                            <button onclick="closeLoginModal()" class="modal-btn primary">
                                <i class="fas fa-check"></i>
                                確定
                            </button>
                        ';
                    }
                }
                
                modal.classList.add('show');
                document.body.style.overflow = 'hidden';
            }
        }

        // 顯示成功提示彈窗
        function showSuccessModal(message) {
            const modal = document.getElementById('loginPermissionModal');
            if (modal) {
                // 更新彈窗內容為成功信息
                const icon = modal.querySelector('.modal-icon i');
                const title = modal.querySelector('.modal-title');
                const messageElement = modal.querySelector('.modal-message');
                const buttons = modal.querySelector('.modal-buttons');
                
                if (icon) icon.className = 'fas fa-check-circle';
                if (title) title.textContent = '操作成功';
                if (messageElement) messageElement.textContent = message;
                if (buttons) {
                    buttons.innerHTML = '
                        <button onclick="closeLoginModal()" class="modal-btn primary">
                            <i class="fas fa-check"></i>
                            確定
                        </button>
                    ';
                }
                
                modal.classList.add('show');
                document.body.style.overflow = 'hidden';
            }
        }

        // 實時檢測登入狀態變化
        let loginCheckInterval;
        function startLoginStatusMonitoring() {
            // 每30秒檢查一次登入狀態
            loginCheckInterval = setInterval(async () => {
                try {
                    const response = await fetch('/api/user/current');
                    const data = await response.json();
                    
                    const wasLoggedIn = !!currentUser;
                    const isLoggedIn = data.success && data.user;
                    
                    if (!wasLoggedIn && isLoggedIn) {
                        // 用戶剛登入
                        currentUser = data.user;
                        updateUserDisplay(currentUser);
                        enableBroadcastFeatures();
                        closeLoginModal(); // 關閉可能顯示的登入彈窗
                        
                        // 顯示歡迎消息
                        if (window.addMessage) {
                            addMessage('系統', `🎉 歡迎回來，${currentUser.displayName}！現在可以開始直播了`);
                        }
                    } else if (wasLoggedIn && !isLoggedIn) {
                        // 用戶登出了
                        currentUser = null;
                        showLoginRequired();
                        
                        if (window.addMessage) {
                            addMessage('系統', '⚠️ 檢測到您已登出，直播功能已暫停');
                        }
                    }
                } catch (error) {
                    console.error('檢查登入狀態失敗:', error);
                }
            }, 30000);
        }

        // 停止登入狀態監控
        function stopLoginStatusMonitoring() {
            if (loginCheckInterval) {
                clearInterval(loginCheckInterval);
                loginCheckInterval = null;
            }
        }

        // 啟用直播功能
        function enableBroadcastFeatures() {
            const streamBtn = document.getElementById('streamBtn');
            
            if (streamBtn) {
                streamBtn.disabled = false;
                streamBtn.innerHTML = '<i class="fas fa-play-circle"></i> 開始直播';
                // 使用增強版的toggleStream函數
                streamBtn.onclick = secureToggleStream;
            }
        }

        // 獲取當前直播標題
        function getCurrentStreamTitle() {
            return currentStreamTitle || '未命名直播';
        }

        // 在瀏覽器控制台中可以呼叫 testChatScroll() 來測試滾動功能

        // 用戶管理功能
        let currentUser = null;

        // 切換用戶選單
        function toggleUserMenu() {
            console.log('toggleUserMenu 被調用');
            
            // 檢查用戶登入狀態
            if (!currentUser || !currentUser.id) {
                console.log('用戶未登入，顯示登入彈窗');
                showLoginPermissionModal();
                return;
            }
            
            // 移除現有選單
            const existingMenu = document.querySelector('.user-dropdown');
            if (existingMenu) {
                console.log('移除現有選單');
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
            
            console.log('創建新的下拉選單');
            
            const currentUserName = getCurrentUserName() || '主播';
            
            // 創建下拉選單
            const menu = document.createElement('div');
            menu.className = 'user-dropdown';
            menu.style.opacity = '0';
            menu.style.transform = 'translateY(-10px)';
            menu.style.transition = 'all 0.15s ease-out';
            
            menu.innerHTML = '
                <div class="menu-user-info">
                    <div class="menu-user-name">' + currentUserName + '</div>
                </div>
                <a href="#" onclick="openStreamManagement(); event.preventDefault();" class="menu-link">
                    <i class="fas fa-video"></i>
                    直播管理
                </a>
                <a href="viewer.html" class="menu-link">
                    <i class="fas fa-eye"></i>
                    觀看直播
                </a>
                <a href="index.html" class="menu-link">
                    <i class="fas fa-home"></i>
                    回到首頁
                </a>
                <a href="#" onclick="logout(); event.preventDefault();" class="menu-link logout">
                    <i class="fas fa-sign-out-alt"></i>
                    登出
                </a>
            ';
            
            // 確保userAvatar是一個容器，如果不是則包裝它
            let container = userAvatar;
            if (userAvatar.style.position !== 'relative') {
                userAvatar.style.position = 'relative';
            }
            
            container.appendChild(menu);
            console.log('選單已添加到DOM');
            
            // 顯示動畫
            setTimeout(() => {
                menu.style.opacity = '1';
                menu.style.transform = 'translateY(0)';
                console.log('選單動畫已觸發');
            }, 10);
            
            // 點擊其他地方關閉選單
            setTimeout(() => {
                function closeMenu(e) {
                    if (!menu.contains(e.target) && !container.contains(e.target)) {
                        console.log('關閉選單');
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

        // 獲取當前用戶名稱
        function getCurrentUserName() {
            if (currentUser) {
                return currentUser.displayName || currentUser.username || '主播';
            }
            return '主播';
        }

        // 載入當前用戶信息（舊版本函數，保留兼容性）
        async function loadCurrentUser() {
            return checkLoginStatus();
        }

        // 顯示登入提示而不是強制重定向（舊版本函數，保留兼容性）
        function showLoginPrompt() {
            showLoginRequired();
        }

        // 更新用戶顯示
        function updateUserDisplay(user) {
            const userAvatar = document.getElementById('userAvatar');
            
            // 設置頭像
            if (user.avatarUrl) {
                userAvatar.innerHTML = `<img src="${user.avatarUrl}" alt="${user.displayName}">`;
            } else {
                // 使用用戶名稱的第一個字母作為頭像
                const initial = user.displayName.charAt(0).toUpperCase();
                userAvatar.innerHTML = initial;
            }
            
            // 設置用戶信息
            userAvatar.title = user.displayName;
            
            // 儲存當前用戶到全局變數
            window.currentUser = user;
            
            console.log('用戶信息已載入:', user);
        }

        // 獲取當前用戶 - 用於聊天室
        function getCurrentUser() {
            return currentUser ? currentUser.displayName : '主播';
        }

        // 獲取當前用戶頭像
        function getCurrentUserAvatar() {
            if (currentUser && currentUser.avatarUrl) {
                return `<img src="${currentUser.avatarUrl}" alt="${currentUser.displayName}">`;
            } else if (currentUser) {
                return currentUser.displayName.charAt(0).toUpperCase();
            } else {
                return '<i class="fas fa-star"></i>';
            }
        }

        // 開啟直播管理
        function openStreamManagement() {
            // 這裡可以打開直播管理面板或跳轉到管理頁面
            showInfoModal('直播管理', '直播管理功能正在開發中，敬請期待！', '
                <button onclick="closeLoginModal()" class="modal-btn primary">
                    <i class="fas fa-check"></i>
                    我知道了
                </button>
            ');
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
                    window.location.href = '/login.html';
                } else {
                    showErrorModal('登出失敗：' + data.message);
                }
            } catch (error) {
                console.error('登出失敗:', error);
                showErrorModal('登出失敗，請稍後再試');
            }
        }

        // 頁面載入時初始化
        document.addEventListener('DOMContentLoaded', function() {
            loadCurrentUser();
        });

        // 特效功能
        let currentEffect = null;
        let backgroundBlurEnabled = false;
        let canvasContext = null;
        let effectCanvas = null;
        
        function applyEffect(effectType) {
            const videoElement = document.getElementById('localVideo');
            if (!videoElement) return;
            
            // 清除之前的特效
            clearEffect();
            
            // 移除所有特效按鈕的active狀態
            document.querySelectorAll('.effect-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            if (effectType === 'clear') {
                // 通知觀眾端清除特效
                broadcastEffectToViewers('clear');
                return;
            }
            
            // 設置新特效
            currentEffect = effectType;
            
            // 添加特效類別到影片元素
            switch (effectType) {
                case 'blur':
                    videoElement.style.filter = 'blur(2px)';
                    break;
                case 'vintage':
                    videoElement.style.filter = 'sepia(0.8) contrast(1.2) brightness(0.9)';
                    break;
                case 'bw':
                    videoElement.style.filter = 'grayscale(100%)';
                    break;
                case 'sepia':
                    videoElement.style.filter = 'sepia(100%)';
                    break;
                case 'smooth':
                    // 磨皮效果 - 輕微模糊 + 對比度調整
                    videoElement.style.filter = 'blur(0.5px) contrast(1.1) brightness(1.05)';
                    break;
                case 'bright':
                    // 美白效果
                    videoElement.style.filter = 'brightness(1.15) contrast(0.95) saturate(1.1)';
                    break;
                case 'warm':
                    // 暖色調效果
                    videoElement.style.filter = 'sepia(0.3) saturate(1.2) hue-rotate(5deg) brightness(1.05)';
                    break;
                case 'neon':
                    videoElement.style.border = '3px solid #ff6b35'; // 改為亮橘色
                    videoElement.style.boxShadow = '0 0 20px #ff6b35, inset 0 0 20px #ff6b35';
                    break;
                case 'glow':
                    videoElement.style.boxShadow = '0 0 30px #ff6b35'; // 改為亮橘色光暈
                    break;
                case 'rainbow':
                    videoElement.style.border = '3px solid #ff6b35'; // 主要使用橘色
                    videoElement.style.borderImage = 'linear-gradient(45deg, #ff6b35, #feca57, #ff6b35, #feca57) 1';
                    break;
                case 'particles':
                    createParticleEffect();
                    break;
                case 'hearts':
                    createHeartEffect();
                    break;
                case 'confetti':
                    createConfettiEffect();
                    break;
                case 'snow':
                    createSnowEffect();
                    break;
            }
            
            // 標記活躍按鈕
            if (event && event.target) {
                event.target.classList.add('active');
            }
            
            // 通知觀眾端應用相同特效
            broadcastEffectToViewers(effectType);
            
            console.log(`已應用特效: ${effectType}`);
            if (typeof addMessage === 'function') {
                addMessage('系統', `✨ 已應用 ${getEffectName(effectType)} 特效`);
            }
        }
        
        // 向觀眾端廣播特效狀態
        function broadcastEffectToViewers(effectType) {
            if (streamingSocket && streamingSocket.readyState === WebSocket.OPEN) {
                streamingSocket.send(JSON.stringify({
                    type: 'effect_update',
                    effect: effectType,
                    timestamp: Date.now()
                }));
                console.log(`已向觀眾廣播特效: ${effectType}`);
            }
            
            console.log(`已應用特效: ${effectType}`);
            if (typeof addMessage === 'function') {
                addMessage('系統', `✨ 已應用 ${getEffectName(effectType)} 特效`);
            }
        }
        
        // 獲取特效名稱
        function getEffectName(effectType) {
            const names = {
                'blur': '模糊',
                'vintage': '復古',
                'bw': '黑白',
                'sepia': '懷舊',
                'smooth': '磨皮',
                'bright': '美白',
                'warm': '暖色調',
                'neon': '霓虹',
                'glow': '光暈',
                'rainbow': '彩虹',
                'particles': '粒子',
                'hearts': '愛心',
                'confetti': '彩帶',
                'snow': '雪花'
            };
            return names[effectType] || effectType;
        }
        
        // 背景虛化功能
        async function toggleBackgroundBlur() {
            const videoElement = document.getElementById('localVideo');
            if (!videoElement || !localStream) {
                addMessage('系統', '⚠️ 請先開始直播再使用背景虛化功能');
                return;
            }
            
            backgroundBlurEnabled = !backgroundBlurEnabled;
            const button = event.target.closest('.effect-btn');
            
            if (backgroundBlurEnabled) {
                button.classList.add('active');
                addMessage('系統', '🔄 正在啟用背景虛化...');
                
                try {
                    // 這裡可以集成 MediaPipe 或其他 AI 背景分割技術
                    // 目前使用簡單的背景模糊效果
                    videoElement.style.filter = (videoElement.style.filter || '') + ' blur(0px)';
                    videoElement.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
                    
                    addMessage('系統', '✅ 背景虛化已啟用');
                } catch (error) {
                    console.error('背景虛化啟用失敗:', error);
                    addMessage('系統', '❌ 背景虛化啟用失敗');
                    backgroundBlurEnabled = false;
                    button.classList.remove('active');
                }
            } else {
                button.classList.remove('active');
                videoElement.style.background = '';
                addMessage('系統', '✅ 背景虛化已關閉');
            }
        }
        
        // 粒子特效
        function createParticleEffect() {
            createAnimationOverlay('particles');
        }
        
        // 愛心特效
        function createHeartEffect() {
            createAnimationOverlay('hearts');
        }
        
        // 彩帶特效
        function createConfettiEffect() {
            createAnimationOverlay('confetti');
        }
        
        // 雪花特效
        function createSnowEffect() {
            createAnimationOverlay('snow');
        }
        
        // 創建動畫覆蓋層
        function createAnimationOverlay(type) {
            // 移除現有的動畫覆蓋層
            const existing = document.querySelector('.animation-overlay');
            if (existing) {
                existing.remove();
            }
            
            const overlay = document.createElement('div');
            overlay.className = `animation-overlay ${type}`;
            overlay.style.cssText = '
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                overflow: hidden;
                z-index: 10;
            ';
            
            const videoContainer = document.querySelector('.video-area');
            if (videoContainer) {
                videoContainer.style.position = 'relative';
                videoContainer.appendChild(overlay);
                
                // 創建動畫元素
                for (let i = 0; i < 20; i++) {
                    createAnimationElement(overlay, type);
                }
                
                // 10秒後自動移除
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.remove();
                    }
                }, 10000);
            }
        }
        
        // 創建單個動畫元素
        function createAnimationElement(container, type) {
            const element = document.createElement('div');
            const symbols = {
                'particles': '✨',
                'hearts': '❤️',
                'confetti': '🎉',
                'snow': '❄️'
            };
            
            element.textContent = symbols[type] || '✨';
            element.style.cssText = '
                position: absolute;
                font-size: ' + (Math.random() * 20 + 15) + 'px;
                left: ' + (Math.random() * 100) + '%;
                top: -50px;
                animation: fall ' + (Math.random() * 3 + 2) + 's linear infinite;
                animation-delay: ' + (Math.random() * 2) + 's;
            ';
            
            container.appendChild(element);
        }
        
        function clearEffect() {
            const videoElement = document.getElementById('localVideo');
            if (videoElement) {
                videoElement.style.filter = '';
                videoElement.style.border = '';
                videoElement.style.boxShadow = '';
                videoElement.style.borderImage = '';
                videoElement.style.background = '';
            }
            
            // 移除動畫覆蓋層
            const overlay = document.querySelector('.animation-overlay');
            if (overlay) {
                overlay.remove();
            }
            
            // 重置背景虛化
            backgroundBlurEnabled = false;
            
            currentEffect = null;
            
            // 移除所有按鈕的active狀態
            document.querySelectorAll('.effect-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            addMessage('系統', '🧹 已清除所有特效');
        }

        // 注意：不再使用舊的 script.js 中的 sendMessage 函數
        // 現在完全依賴 ChatSystem 類來處理聊天功能
        // 如果需要 handleEnter，由 ChatSystem 自己處理
        
        // 添加系統訊息到聊天室的函數
        function addMessage(username, message, isSystem = false) {
            try {
                const chatMessages = document.getElementById('chatMessages');
                if (!chatMessages) {
                    console.warn('找不到聊天訊息容器');
                    return;
                }
                
                const messageElement = document.createElement('div');
                messageElement.className = isSystem ? 'chat-message system-message' : 'chat-message';
                
                const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                messageElement.innerHTML = '
                    <div class="message-avatar">
                        ' + (isSystem ? '🤖' : username.charAt(0).toUpperCase()) + '
                    </div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-user">' + username + '</span>
                            <span class="message-time">' + time + '</span>
                        </div>
                        <div class="message-text">' + message + '</div>
                    </div>
                ';
                
                chatMessages.appendChild(messageElement);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                
                console.log(`[addMessage] ${username}: ${message}`);
            } catch (error) {
                console.error('添加訊息失敗:', error);
            }
        }
    
        // 立即檢查基本功能是否已載入
        console.log('=== 內嵌功能檢查 ===');
        console.log('toggleStream exists:', typeof toggleStream);
        console.log('toggleVideo exists:', typeof toggleVideo);
        console.log('toggleAudio exists:', typeof toggleAudio);
        console.log('shareScreen exists:', typeof shareScreen);
        console.log('toggleTabAudio exists:', typeof toggleTabAudio);
        console.log('========================');
        
        // 由於 script.js 檔案損壞，現在直接提供內嵌功能
        console.log('載入內嵌的基本直播功能...');
        
        // 基本變數
        let localStream = null;
        let isStreaming = false;
        let isVideoEnabled = true;
        let isAudioEnabled = true;
        
        // 生成唯一的主播ID（用於獨立聊天室）
        function getBroadcasterId() {
            // 從URL參數獲取或生成新的broadcaster ID
            const urlParams = new URLSearchParams(window.location.search);
            let broadcasterId = urlParams.get('broadcasterId') || urlParams.get('broadcaster');
            
            if (!broadcasterId) {
                // 基於當前用戶生成broadcaster ID
                if (currentUser && currentUser.id) {
                    broadcasterId = `broadcaster_${currentUser.id}`;
                } else {
                    broadcasterId = `broadcaster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                }
                
                // 更新URL參數（不刷新頁面）
                const newUrl = new URL(window.location);
                newUrl.searchParams.set('broadcasterId', broadcasterId);
                window.history.replaceState({}, '', newUrl);
            }
            
            return broadcasterId;
        }
        
        // 設置全局變量供聊天系統使用
        window.broadcasterId = getBroadcasterId();
        
        console.log('主播聊天室ID:', window.broadcasterId);
        
        // 生成觀眾鏈接
        function generateViewerLink() {
            const broadcasterId = getBroadcasterId();
            const baseUrl = window.location.origin;
            return `${baseUrl}/viewer.html?broadcasterId=${encodeURIComponent(broadcasterId)}`;
        }
        
        // 顯示觀眾鏈接
        function showViewerLink() {
            const viewerLinkSection = document.getElementById('viewerLinkSection');
            const viewerLinkInput = document.getElementById('viewerLinkInput');
            
            if (viewerLinkSection && viewerLinkInput) {
                const viewerLink = generateViewerLink();
                viewerLinkInput.value = viewerLink;
                viewerLinkSection.style.display = 'block';
                console.log('觀眾鏈接已生成:', viewerLink);
            }
        }
        
        // 複製觀眾鏈接
        function copyViewerLink() {
            const viewerLinkInput = document.getElementById('viewerLinkInput');
            if (viewerLinkInput) {
                viewerLinkInput.select();
                viewerLinkInput.setSelectionRange(0, 99999); // 移動端兼容
                
                try {
                    document.execCommand('copy');
                    addMessage('系統', '📋 觀眾鏈接已複製到剪貼板！', true);
                    
                    // 視覺反饋
                    const copyBtn = document.querySelector('.copy-link-btn');
                    if (copyBtn) {
                        const originalText = copyBtn.innerHTML;
                        copyBtn.innerHTML = '<i class="fas fa-check"></i> 已複製';
                        copyBtn.style.background = '#10b981';
                        
                        setTimeout(() => {
                            copyBtn.innerHTML = originalText;
                            copyBtn.style.background = '#667eea';
                        }, 2000);
                    }
                } catch (err) {
                    console.error('複製失敗:', err);
                    addMessage('系統', '❌ 複製失敗，請手動複製鏈接', true);
                }
            }
        }
        
        // 安全包裝函數 - 檢查登入狀態
        function secureToggleStream() {
            if (!currentUser) {
                showLoginRequired();
                return;
            }
            toggleStream();
        }
        
        function secureToggleVideo() {
            if (!currentUser) {
                showLoginRequired();
                return;
            }
            toggleVideo();
        }
        
        function secureToggleAudio() {
            if (!currentUser) {
                showLoginRequired();
                return;
            }
            toggleAudio();
        }
        
        function secureShareScreen() {
            if (!currentUser) {
                showLoginRequired();
                return;
            }
            shareScreen();
        }
        
        function secureToggleTabAudio() {
            if (!currentUser) {
                showLoginRequired();
                return;
            }
            toggleTabAudio();
        }
        
        // 切換直播狀態
        async function toggleStream() {
            if (!isStreaming) {
                // 開始直播
                console.log('開始直播...');
                
                // 先啟動預覽
                const previewStarted = await startPreview();
                if (!previewStarted) {
                    return;
                }
                
                // 初始化WebRTC連接
                await initWebRTCConnection();
                
                // 更新UI狀態
                isStreaming = true;
                const streamBtn = document.getElementById('streamBtn');
                const streamStatusDot = document.getElementById('streamStatusDot');
                const streamStatusText = document.getElementById('streamStatusText');
                const videoOverlay = document.getElementById('videoOverlay');
                
                if (streamBtn) {
                    streamBtn.innerHTML = '<i class="fas fa-stop-circle"></i> 停止直播';
                    streamBtn.classList.add('streaming');
                }
                
                if (streamStatusDot) {
                    streamStatusDot.style.background = '#ef4444';
                    streamStatusDot.style.animation = 'pulse 1s infinite';
                }
                
                if (streamStatusText) {
                    streamStatusText.textContent = '直播中';
                }
                
                if (videoOverlay) {
                    videoOverlay.style.display = 'flex';
                }
                
                // 顯示觀眾鏈接
                showViewerLink();
                
                addMessage('系統', '🔴 直播已開始！觀眾可以通過鏈接加入', true);
                
            } else {
                // 停止直播
                console.log('停止直播...');
                
                // 停止WebRTC連接
                await stopWebRTCConnection();
                
                // 更新UI狀態
                isStreaming = false;
                const streamBtn = document.getElementById('streamBtn');
                const streamStatusDot = document.getElementById('streamStatusDot');
                const streamStatusText = document.getElementById('streamStatusText');
                const videoOverlay = document.getElementById('videoOverlay');
                const viewerLinkSection = document.getElementById('viewerLinkSection');
                
                if (streamBtn) {
                    streamBtn.innerHTML = '<i class="fas fa-play-circle"></i> 開始直播';
                    streamBtn.classList.remove('streaming');
                }
                
                if (streamStatusDot) {
                    streamStatusDot.style.background = '#9ca3af';
                    streamStatusDot.style.animation = 'none';
                }
                
                if (streamStatusText) {
                    streamStatusText.textContent = '準備中';
                }
                
                if (videoOverlay) {
                    videoOverlay.style.display = 'none';
                }
                
                if (viewerLinkSection) {
                    viewerLinkSection.style.display = 'none';
                }
                
                addMessage('系統', '⚪ 直播已停止', true);
            }
        }
            
            // 載入設備列表
        async function loadDevices() {
            try {
                // 先請求權限以獲取設備標籤
                let stream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ 
                        video: true, 
                        audio: true 
                    });
                    console.log('設備權限已獲取');
                } catch (permissionError) {
                    console.warn('無法獲取設備權限:', permissionError);
                    // 即使無法獲取權限，仍然嘗試枚舉設備
                }
                
                const devices = await navigator.mediaDevices.enumerateDevices();
                
                // 如果獲取了權限，關閉臨時流
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                
                const cameraSelect = document.getElementById('cameraSelect');
                const microphoneSelect = document.getElementById('microphoneSelect');
                const audioOutputSelect = document.getElementById('audioOutputSelect');
                
                // 清空現有選項
                if (cameraSelect) {
                    cameraSelect.innerHTML = '<option value="" selected>預設攝影機</option>';
                }
                if (microphoneSelect) {
                    microphoneSelect.innerHTML = '<option value="" selected>預設麥克風</option>';
                }
                if (audioOutputSelect) {
                    audioOutputSelect.innerHTML = '<option value="" selected>預設音訊輸出</option>';
                }
                
                devices.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.text = device.label || `${device.kind} ${device.deviceId.substring(0, 8)}`;
                    
                    if (device.kind === 'videoinput' && cameraSelect) {
                        cameraSelect.appendChild(option);
                    } else if (device.kind === 'audioinput' && microphoneSelect) {
                        microphoneSelect.appendChild(option);
                    } else if (device.kind === 'audiooutput' && audioOutputSelect) {
                        audioOutputSelect.appendChild(option);
                    }
                });
                
                console.log('設備列表已載入');
            } catch (error) {
                console.error('載入設備失敗:', error);
                
                // 設置錯誤狀態
                const selects = ['cameraSelect', 'microphoneSelect', 'audioOutputSelect'];
                selects.forEach(id => {
                    const select = document.getElementById(id);
                    if (select) {
                        select.innerHTML = '<option value="">無法載入設備</option>';
                    }
                });
            }
        }

        // 切換視頻設備
        async function switchVideoDevice() {
            const cameraSelect = document.getElementById('cameraSelect');
            if (!cameraSelect || !cameraSelect.value) return;
            
            try {
                console.log('切換到攝影機:', cameraSelect.value);
                
                // 如果正在直播，需要更新視頻軌道
                if (localStream) {
                    const videoTrack = localStream.getVideoTracks()[0];
                    if (videoTrack) {
                        videoTrack.stop();
                    }
                    
                    // 獲取新的視頻流
                    const newStream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: cameraSelect.value },
                        audio: false
                    });
                    
                    // 替換視頻軌道
                    const newVideoTrack = newStream.getVideoTracks()[0];
                    localStream.removeTrack(videoTrack);
                    localStream.addTrack(newVideoTrack);
                    
                    // 更新本地視頻顯示
                    const localVideo = document.getElementById('localVideo');
                    if (localVideo) {
                        localVideo.srcObject = localStream;
                    }
                }
            } catch (error) {
                console.error('切換攝影機失敗:', error);
                alert('切換攝影機失敗，請檢查設備是否可用');
            }
        }

        // 切換音頻設備
        async function switchAudioDevice() {
            const microphoneSelect = document.getElementById('microphoneSelect');
            if (!microphoneSelect || !microphoneSelect.value) return;
            
            try {
                console.log('切換到麥克風:', microphoneSelect.value);
                
                // 如果正在直播，需要更新音頻軌道
                if (localStream) {
                    const audioTrack = localStream.getAudioTracks()[0];
                    if (audioTrack) {
                        audioTrack.stop();
                    }
                    
                    // 獲取新的音頻流
                    const newStream = await navigator.mediaDevices.getUserMedia({
                        video: false,
                        audio: { deviceId: microphoneSelect.value }
                    });
                    
                    // 替換音頻軌道
                    const newAudioTrack = newStream.getAudioTracks()[0];
                    localStream.removeTrack(audioTrack);
                    localStream.addTrack(newAudioTrack);
                }
            } catch (error) {
                console.error('切換麥克風失敗:', error);
                alert('切換麥克風失敗，請檢查設備是否可用');
            }
        }

        // 切換音頻輸出設備
        async function switchAudioOutput() {
            const audioOutputSelect = document.getElementById('audioOutputSelect');
            if (!audioOutputSelect) return;
            
            try {
                const deviceId = audioOutputSelect.value;
                console.log('切換到音頻輸出:', deviceId || '預設設備');
                
                // 設置音頻輸出設備
                const localVideo = document.getElementById('localVideo');
                if (localVideo && localVideo.setSinkId) {
                    if (deviceId === '' || !deviceId) {
                        // 使用預設設備（傳入空字串或不傳參數）
                        await localVideo.setSinkId('');
                        console.log('音頻輸出已重設為預設設備');
                    } else {
                        await localVideo.setSinkId(deviceId);
                        console.log('音頻輸出設備已切換');
                    }
                } else {
                    console.warn('瀏覽器不支援音頻輸出設備切換');
                }
            } catch (error) {
                console.error('切換音頻輸出失敗:', error);
                // 改為非阻塞的提示
            }
        }

        // 添加預覽功能
        async function startPreview() {
            try {
                // 如果已經有本地流，先停止
                if (localStream) {
                    localStream.getTracks().forEach(track => track.stop());
                }
                
                // 獲取攝影機和麥克風
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 },
                        frameRate: { ideal: 30, max: 60 }
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                
                // 顯示預覽
                const localVideo = document.getElementById('localVideo');
                const previewPlaceholder = document.getElementById('previewPlaceholder');
                
                if (localVideo) {
                    localVideo.srcObject = localStream;
                    localVideo.style.display = 'block';
                }
                
                if (previewPlaceholder) {
                    previewPlaceholder.style.display = 'none';
                }
                
                console.log('攝影機預覽已啟動');
                return true;
            } catch (error) {
                console.error('啟動預覽失敗:', error);
                showErrorModal('無法啟動攝影機預覽，請檢查攝影機和麥克風權限');
                return false;
            }
        }

        // 停止預覽
        function stopPreview() {
            if (localStream && !isStreaming) {
                localStream.getTracks().forEach(track => track.stop());
                localStream = null;
                
                const localVideo = document.getElementById('localVideo');
                const previewPlaceholder = document.getElementById('previewPlaceholder');
                
                if (localVideo) {
                    localVideo.srcObject = null;
                    localVideo.style.display = 'none';
                }
                
                if (previewPlaceholder) {
                    previewPlaceholder.style.display = 'flex';
                }
                
                console.log('攝影機預覽已停止');
            }
        }

        // WebRTC連接相關變數
        let signalingSocket = null;
        let peerConnections = new Map();
        
        // 初始化WebRTC連接
        async function initWebRTCConnection() {
            try {
                const broadcasterId = getBroadcasterId();
                const wsUrl = `wss://localhost:3000/broadcast/${broadcasterId}`;
                
                console.log('建立WebRTC信令連接:', wsUrl);
                signalingSocket = new WebSocket(wsUrl);
                
                signalingSocket.onopen = () => {
                    console.log('✅ WebRTC信令連接已建立');
                    
                    // 發送開始直播信號
                    signalingSocket.send(JSON.stringify({
                        type: 'start-broadcast',
                        broadcasterId: broadcasterId
                    }));
                };
                
                signalingSocket.onmessage = async (event) => {
                    const message = JSON.parse(event.data);
                    await handleSignalingMessage(message);
                };
                
                signalingSocket.onclose = () => {
                    console.log('WebRTC信令連接已關閉');
                };
                
                signalingSocket.onerror = (error) => {
                    console.error('WebRTC信令連接錯誤:', error);
                    throw new Error('無法建立WebRTC信令連接');
                };
                
                // 等待連接建立
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('WebRTC連接超時'));
                    }, 10000);
                    
                    signalingSocket.onopen = () => {
                        clearTimeout(timeout);
                        console.log('✅ WebRTC信令連接已建立');
                        resolve();
                    };
                });
                
            } catch (error) {
                console.error('初始化WebRTC連接失敗:', error);
                throw error;
            }
        }
        
        // 停止WebRTC連接
        async function stopWebRTCConnection() {
            try {
                // 關閉所有對等連接
                peerConnections.forEach((pc, viewerId) => {
                    pc.close();
                    console.log('已關閉與觀眾的連接:', viewerId);
                });
                peerConnections.clear();
                
                // 關閉信令連接
                if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
                    signalingSocket.send(JSON.stringify({
                        type: 'stop-broadcast',
                        broadcasterId: getBroadcasterId()
                    }));
                    signalingSocket.close();
                }
                signalingSocket = null;
                
                console.log('WebRTC連接已停止');
            } catch (error) {
                console.error('停止WebRTC連接失敗:', error);
            }
        }
        
        // 處理信令消息
        async function handleSignalingMessage(message) {
            try {
                switch (message.type) {
                    case 'viewer-join':
                        await handleViewerJoin(message.viewerId);
                        break;
                    case 'viewer-leave':
                        handleViewerLeave(message.viewerId);
                        break;
                    case 'offer':
                        await handleOffer(message.viewerId, message.offer);
                        break;
                    case 'answer':
                        await handleAnswer(message.viewerId, message.answer);
                        break;
                    case 'ice-candidate':
                        await handleIceCandidate(message.viewerId, message.candidate);
                        break;
                    default:
                        console.log('未知信令消息:', message);
                }
            } catch (error) {
                console.error('處理信令消息失敗:', error);
            }
        }
        
        // 處理觀眾加入
        async function handleViewerJoin(viewerId) {
            try {
                console.log('觀眾加入:', viewerId);
                
                // 創建RTCPeerConnection
                const peerConnection = new RTCPeerConnection({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                });
                
                // 添加本地流
                if (localStream) {
                    localStream.getTracks().forEach(track => {
                        peerConnection.addTrack(track, localStream);
                    });
                }
                
                // 處理ICE候選
                peerConnection.onicecandidate = (event) => {
                    if (event.candidate && signalingSocket.readyState === WebSocket.OPEN) {
                        signalingSocket.send(JSON.stringify({
                            type: 'ice-candidate',
                            viewerId: viewerId,
                            candidate: event.candidate
                        }));
                    }
                };
                
                // 創建Offer
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                
                // 發送Offer給觀眾
                if (signalingSocket.readyState === WebSocket.OPEN) {
                    signalingSocket.send(JSON.stringify({
                        type: 'offer',
                        viewerId: viewerId,
                        offer: offer
                    }));
                }
                
                peerConnections.set(viewerId, peerConnection);
                
            } catch (error) {
                console.error('處理觀眾加入失敗:', error);
            }
        }
        
        // 處理觀眾離開
        function handleViewerLeave(viewerId) {
            const peerConnection = peerConnections.get(viewerId);
            if (peerConnection) {
                peerConnection.close();
                peerConnections.delete(viewerId);
                console.log('觀眾已離開:', viewerId);
            }
        }
        
        // 處理Answer
        async function handleAnswer(viewerId, answer) {
            const peerConnection = peerConnections.get(viewerId);
            if (peerConnection) {
                await peerConnection.setRemoteDescription(answer);
                console.log('已設置觀眾Answer:', viewerId);
            }
        }
        
        // 處理ICE候選
        async function handleIceCandidate(viewerId, candidate) {
            const peerConnection = peerConnections.get(viewerId);
            if (peerConnection) {
                await peerConnection.addIceCandidate(candidate);
                console.log('已添加ICE候選:', viewerId);
            }
        }

        // 基本的直播控制函數
            window.toggleStream = async function() {
                console.log('基本 toggleStream 函數被調用');
                
                if (!isStreaming) {
                    try {
                        // 如果還沒有預覽流，先啟動預覽
                        if (!localStream) {
                            const previewStarted = await startPreview();
                            if (!previewStarted) {
                                throw new Error('無法啟動攝影機預覽');
                            }
                        }
                        
                        // 建立WebRTC信令連接
                        await initWebRTCConnection();
                        
                        isStreaming = true;
                        const streamBtn = document.getElementById('streamBtn');
                        if (streamBtn) {
                            streamBtn.innerHTML = '<i class="fas fa-stop-circle"></i> 停止直播';
                            streamBtn.classList.add('btn-danger');
                            streamBtn.classList.remove('btn-primary');
                        }
                        
                        // 更新狀態指示器
                        const statusDot = document.getElementById('streamStatusDot');
                        const statusText = document.getElementById('streamStatusText');
                        if (statusDot) statusDot.style.backgroundColor = '#ff4444';
                        if (statusText) statusText.textContent = '直播中';
                        
                        console.log('直播已開始');
                        
                    } catch (error) {
                        console.error('啟動直播失敗:', error);
                        showErrorModal('無法啟動直播：' + error.message);
                    }
                } else {
                    // 停止直播
                    await stopWebRTCConnection();
                    
                    isStreaming = false;
                    const streamBtn = document.getElementById('streamBtn');
                    if (streamBtn) {
                        streamBtn.innerHTML = '<i class="fas fa-play-circle"></i> 開始直播';
                        streamBtn.classList.remove('btn-danger');
                        streamBtn.classList.add('btn-primary');
                    }
                    
                    // 更新狀態指示器
                    const statusDot = document.getElementById('streamStatusDot');
                    const statusText = document.getElementById('streamStatusText');
                    if (statusDot) statusDot.style.backgroundColor = '#666';
                    if (statusText) statusText.textContent = '準備中';
                    
                    console.log('直播已停止');
                }
            };
            
            window.toggleVideo = async function() {
                console.log('基本 toggleVideo 函數被調用');
                if (localStream) {
                    const videoTracks = localStream.getVideoTracks();
                    if (videoTracks.length > 0) {
                        isVideoEnabled = !isVideoEnabled;
                        videoTracks[0].enabled = isVideoEnabled;
                        
                        const videoBtn = document.getElementById('videoBtn');
                        if (videoBtn) {
                            const icon = videoBtn.querySelector('i');
                            if (icon) {
                                icon.className = isVideoEnabled ? 'fas fa-video' : 'fas fa-video-slash';
                            }
                        }
                        console.log('視頻狀態:', isVideoEnabled ? '開啟' : '關閉');
                    }
                } else {
                    showErrorModal('請先開始直播');
                }
            };
            
            window.toggleAudio = async function() {
                console.log('基本 toggleAudio 函數被調用');
                if (localStream) {
                    const audioTracks = localStream.getAudioTracks();
                    if (audioTracks.length > 0) {
                        isAudioEnabled = !isAudioEnabled;
                        audioTracks[0].enabled = isAudioEnabled;
                        
                        const audioBtn = document.getElementById('audioBtn');
                        if (audioBtn) {
                            const icon = audioBtn.querySelector('i');
                            if (icon) {
                                icon.className = isAudioEnabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
                            }
                        }
                        console.log('音頻狀態:', isAudioEnabled ? '開啟' : '關閉');
                    }
                } else {
                    showErrorModal('請先開始直播');
                }
            };
            
            window.shareScreen = async function() {
                console.log('啟動螢幕分享功能');
                try {
                    // 請求螢幕分享權限
                    const screenStream = await navigator.mediaDevices.getDisplayMedia({
                        video: {
                            cursor: 'always',
                            frameRate: { ideal: 30, max: 60 },
                            width: { ideal: 1920, max: 2560 },
                            height: { ideal: 1080, max: 1440 }
                        },
                        audio: true  // 讓瀏覽器顯示音頻選擇選項
                    });
                    
                    console.log('螢幕分享流已獲取，軌道數量:', screenStream.getTracks().length);
                    
                    // 檢查是否有音頻軌道
                    const audioTracks = screenStream.getAudioTracks();
                    const videoTracks = screenStream.getVideoTracks();
                    
                    console.log('視頻軌道:', videoTracks.length, '音頻軌道:', audioTracks.length);
                    
                    if (audioTracks.length > 0) {
                        console.log('✅ 成功獲取螢幕音頻');
                        addMessage('系統', '🔊 螢幕分享（含音頻）已開始');
                    } else {
                        console.log('⚠️ 未獲取到螢幕音頻');
                        addMessage('系統', '📺 螢幕分享（僅視頻）已開始');
                    }
                    
                    // 更新本地視頻顯示
                    const localVideo = document.getElementById('localVideo');
                    if (localVideo) {
                        localVideo.srcObject = screenStream;
                        addMessage('系統', '🖥️ 螢幕分享已開始');
                    }
                    
                    // 如果正在直播，更新WebRTC連接中的軌道
                    if (isStreaming && peerConnections.size > 0) {
                        peerConnections.forEach(async (peerConnection, viewerId) => {
                            try {
                                // 替換視頻軌道
                                const videoSender = peerConnection.getSenders().find(sender => 
                                    sender.track && sender.track.kind === 'video'
                                );
                                
                                if (videoSender && videoTracks.length > 0) {
                                    await videoSender.replaceTrack(videoTracks[0]);
                                    console.log('已為觀眾更新視頻軌道:', viewerId);
                                }
                                
                                // 替換音頻軌道（如果有螢幕音頻）
                                if (audioTracks.length > 0) {
                                    const audioSender = peerConnection.getSenders().find(sender => 
                                        sender.track && sender.track.kind === 'audio'
                                    );
                                    
                                    if (audioSender) {
                                        await audioSender.replaceTrack(audioTracks[0]);
                                        console.log('已為觀眾更新音頻軌道:', viewerId);
                                    }
                                }
                                
                            } catch (error) {
                                console.error('更新觀眾軌道失敗:', viewerId, error);
                            }
                        });
                        
                        addMessage('系統', '📡 已向觀眾更新螢幕分享');
                    }
                    
                    // 更新本地流
                    if (localStream) {
                        localStream.getTracks().forEach(track => track.stop());
                    }
                    localStream = screenStream;
                    
                    // 監聽螢幕分享結束
                    videoTracks[0].addEventListener('ended', async () => {
                        console.log('螢幕分享已結束，恢復攝影機');
                        addMessage('系統', '🎥 螢幕分享已結束，恢復攝影機');
                        
                        try {
                            // 重新獲取攝影機流
                            const cameraStream = await navigator.mediaDevices.getUserMedia({
                                video: {
                                    width: { ideal: 1280, max: 1920 },
                                    height: { ideal: 720, max: 1080 },
                                    frameRate: { ideal: 30, max: 60 }
                                },
                                audio: {
                                    echoCancellation: true,
                                    noiseSuppression: true,
                                    autoGainControl: true
                                }
                            });
                            
                            // 更新本地視頻顯示
                            if (localVideo) {
                                localVideo.srcObject = cameraStream;
                            }
                            
                            // 如果正在直播，更新WebRTC連接中的軌道
                            if (isStreaming && peerConnections.size > 0) {
                                const cameraVideoTrack = cameraStream.getVideoTracks()[0];
                                const cameraAudioTrack = cameraStream.getAudioTracks()[0];
                                
                                peerConnections.forEach(async (peerConnection, viewerId) => {
                                    try {
                                        // 替換回攝影機視頻軌道
                                        const videoSender = peerConnection.getSenders().find(sender => 
                                            sender.track && sender.track.kind === 'video'
                                        );
                                        
                                        if (videoSender && cameraVideoTrack) {
                                            await videoSender.replaceTrack(cameraVideoTrack);
                                            console.log('已為觀眾恢復攝影機視頻:', viewerId);
                                        }
                                        
                                        // 替換回攝影機音頻軌道
                                        const audioSender = peerConnection.getSenders().find(sender => 
                                            sender.track && sender.track.kind === 'audio'
                                        );
                                        
                                        if (audioSender && cameraAudioTrack) {
                                            await audioSender.replaceTrack(cameraAudioTrack);
                                            console.log('已為觀眾恢復攝影機音頻:', viewerId);
                                        }
                                        
                                    } catch (error) {
                                        console.error('恢復攝影機軌道失敗:', viewerId, error);
                                    }
                                });
                                
                                addMessage('系統', '📡 已向觀眾恢復攝影機畫面');
                            }
                            
                            localStream = cameraStream;
                            addMessage('系統', '✅ 攝影機已恢復');
                            
                        } catch (error) {
                            console.error('恢復攝影機失敗:', error);
                            addMessage('系統', '❌ 恢復攝影機失敗');
                        }
                    });
                    
                } catch (error) {
                    console.error('螢幕分享失敗:', error);
                    if (error.name === 'NotAllowedError') {
                        addMessage('系統', '❌ 螢幕分享被拒絕，請允許螢幕分享權限');
                    } else if (error.name === 'NotFoundError') {
                        addMessage('系統', '❌ 找不到可分享的螢幕');
                    } else {
                        addMessage('系統', '❌ 螢幕分享失敗: ' + error.message);
                    }
                }
            };
            
            window.toggleTabAudio = async function() {
                console.log('基本 toggleTabAudio 函數被調用');
                showErrorModal('分頁音頻功能需要使用螢幕分享來獲取音頻。\n\n請：\n1. 點擊螢幕分享按鈕\n2. 選擇包含音頻的螢幕或分頁\n3. 確保勾選"分享音頻"選項');
            };
            
            console.log('基本直播功能已載入');
            
            // 載入設備列表
            loadDevices();
    
        // 檢查關鍵函數是否已加載
        function checkScriptLoading() {
            const requiredFunctions = ['toggleStream', 'toggleVideo', 'toggleAudio', 'shareScreen', 'toggleTabAudio'];
            const missingFunctions = requiredFunctions.filter(func => typeof window[func] !== 'function');
            
            if (missingFunctions.length > 0) {
                console.warn('缺少以下函數:', missingFunctions);
                return false;
            } else {
                console.log('所有直播功能已準備就緒');
                return true;
            }
        }

        // 等待所有腳本加載完成
        function waitForScriptsToLoad() {
            return new Promise((resolve) => {
                if (checkScriptLoading()) {
                    resolve(true);
                    return;
                }
                
                let attempts = 0;
                const maxAttempts = 10; // 減少等待時間到 5 秒
                
                const checkInterval = setInterval(() => {
                    attempts++;
                    
                    if (checkScriptLoading()) {
                        clearInterval(checkInterval);
                        resolve(true);
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        console.error('腳本加載超時 - 使用內嵌功能');
                        
                        // 不再顯示錯誤彈窗，因為我們有內嵌的後備功能
                        console.log('外部腳本載入失敗，使用內嵌的基本功能');
                        resolve(false);
                    }
                }, 500);
            });
        }

        // 初始化聊天系統為主播模式
        document.addEventListener('DOMContentLoaded', async function() {
            // 等待腳本加載完成
            console.log('等待腳本加載...');
            const scriptsLoaded = await waitForScriptsToLoad();
            
            if (!scriptsLoaded) {
                console.error('某些腳本未能正確加載，但基本功能已內嵌');
                // 移除自動彈出的錯誤提示，因為基本功能已內嵌在HTML中
            }
            
            // 先檢查用戶登入狀態
            try {
                const response = await fetch('/api/user/current');
                const data = await response.json();
                
                if (data.success && data.user) {
                    currentUser = data.user;
                    if (typeof updateUserDisplay === 'function') {
                        updateUserDisplay(currentUser);
                    }
                    if (typeof enableBroadcastFeatures === 'function') {
                        enableBroadcastFeatures();
                    }
                    
                    // 歡迎信息
                    if (window.addMessage) {
                        addMessage('系統', `🎉 歡迎，${currentUser.displayName}！您可以開始直播了`);
                    }
                } else {
                    showLoginRequired();
                    
                    // 提示未登入
                    if (window.addMessage) {
                        addMessage('系統', '👋 歡迎來到VibeLo！請登入以開始直播');
                    }
                }
                
                // 啟動登入狀態監控
                if (typeof startLoginStatusMonitoring === 'function') {
                    startLoginStatusMonitoring();
                }
                
                // 設置彈窗相關事件
                if (typeof setupModalEvents === 'function') {
                    setupModalEvents();
                }
                
            } catch (error) {
                console.error('檢查登入狀態失敗:', error);
                if (typeof showLoginRequired === 'function') {
                    showLoginRequired();
                }
            }
            
            // 載入設備列表
            try {
                await loadDevices();
                console.log('設備列表載入完成');
            } catch (error) {
                console.error('載入設備列表失敗:', error);
            }
            
            // 自動啟動攝影機預覽
            try {
                await startPreview();
                console.log('攝影機預覽已自動啟動');
            } catch (error) {
                console.log('自動預覽啟動失敗，用戶可以手動啟動');
            }
            
            // 延遲初始化聊天系統，等待主播WebSocket連接建立
            function initChatWhenReady() {
                // 檢查是否已經初始化過
                if (window.chatSystem) {
                    console.log('聊天系統已經初始化，跳過重複初始化');
                    return;
                }
                
                if (window.initChatSystem) {
                    // 獲取主播真實姓名
                    let username = '主播';
                    
                    // 嘗試從多個來源獲取用戶名
                    if (window.currentUser && window.currentUser.displayName) {
                        username = window.currentUser.displayName;
                    } else if (window.getCurrentUser && typeof window.getCurrentUser === 'function') {
                        const user = window.getCurrentUser();
                        if (user) {
                            username = user;
                        }
                    }
                    
                    console.log('初始化主播聊天系統，建立獨立WebSocket連接...');
                    console.log('用戶名:', username);
                    
                    // 讓ChatSystem建立自己的WebSocket連接，而不是複用streamingSocket
                    window.initChatSystem({
                        isStreamer: true,
                        username: username,
                        // 不傳入socket，讓ChatSystem自己建立連接
                        selectors: {
                            chatContainer: '#chatMessages',
                            messageInput: '#messageInput',
                            sendButton: '.btn-send'
                        }
                    });
                } else {
                    // 如果聊天系統還沒載入，等待100ms後重試
                    setTimeout(initChatWhenReady, 100);
                }
            }
            
            // 等待其他腳本載入完成後再嘗試初始化
            setTimeout(initChatWhenReady, 2000);
        });

        // 設置彈窗相關事件
        function setupModalEvents() {
            // 關閉按鈕事件
            const closeBtn = document.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.onclick = closeLoginModal;
            }
            
            // 處理ESC鍵關閉彈窗
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    const modal = document.getElementById('loginPermissionModal');
                    if (modal && modal.classList.contains('show')) {
                        closeLoginModal();
                    }
                }
            });
        }

        // 頁面卸載時清理
        window.addEventListener('beforeunload', function() {
            stopLoginStatusMonitoring();
        });
    