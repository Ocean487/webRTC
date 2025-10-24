// 獲取URL參數中的主播ID，如果沒有則使用當前用戶ID
function getBroadcasterIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlBroadcasterId = urlParams.get('broadcaster');
    
    if (urlBroadcasterId) {
        return urlBroadcasterId;
    }
    
    // 如果沒有URL參數，基於當前用戶生成ID
    if (currentUser && currentUser.id) {
        return currentUser.id.toString(); // 直接使用用戶ID，不加前綴
    }
    
    // 最後備份：使用時間戳生成唯一ID
    return Date.now().toString();
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

// 多主播相關功能
let otherBroadcasters = []; // 其他主播列表

// 載入其他主播列表
async function loadOtherBroadcasters() {
    try {
        console.log('🔄 載入其他主播列表...');
        const response = await fetch('/api/live-streams');
        const data = await response.json();
        
        if (data.success) {
            // 過濾掉自己
            otherBroadcasters = data.streams.filter(b => b.broadcasterId !== myBroadcasterId);
            console.log('✅ 載入其他主播列表成功:', otherBroadcasters.length, '個主播');
            updateOtherBroadcastersDisplay();
        } else {
            console.error('❌ 載入其他主播列表失敗:', data.message);
        }
    } catch (error) {
        console.error('❌ 載入其他主播列表錯誤:', error);
    }
}

// 更新其他主播顯示
function updateOtherBroadcastersDisplay() {
    const broadcasterList = document.getElementById('otherBroadcastersList');
    if (!broadcasterList) return;
    
    if (otherBroadcasters.length === 0) {
        broadcasterList.innerHTML = '<div class="no-broadcasters">暫無其他主播在線</div>';
        return;
    }
    
    broadcasterList.innerHTML = otherBroadcasters.map(broadcaster => {
        const statusClass = broadcaster.isStreaming ? 'live' : 'online';
        const statusText = broadcaster.isStreaming ? '直播中' : '在線';
        const viewerCount = broadcaster.viewerCount || 0;
        
        const avatarHtml = broadcaster.avatarUrl ? 
            `<img src="${broadcaster.avatarUrl}" alt="${broadcaster.displayName}">` :
            `<i class="fas fa-user"></i>`;
        
        return `
            <div class="broadcaster-item">
                <div class="broadcaster-avatar">
                    ${avatarHtml}
                </div>
                <div class="broadcaster-info">
                    <div class="broadcaster-name">${broadcaster.displayName}</div>
                    <div class="broadcaster-stats">
                        ${viewerCount} 觀看中
                        ${broadcaster.streamTitle ? ' • ' + broadcaster.streamTitle : ''}
                    </div>
                </div>
                <div class="broadcaster-status ${statusClass}">
                    ${statusText}
                </div>
            </div>
        `;
    }).join('');
}

// 處理WebSocket消息中的多主播相關事件
function handleMultiBroadcasterMessage(data) {
    switch (data.type) {
        case 'broadcaster_online':
            console.log('📢 新主播上線:', data.broadcasterId);
            // 重新載入主播列表
            setTimeout(() => {
                loadOtherBroadcasters();
            }, 1000);
            break;
            
        case 'broadcaster_offline':
            console.log('📢 主播離線:', data.broadcasterId);
            // 重新載入主播列表
            setTimeout(() => {
                loadOtherBroadcasters();
            }, 1000);
            break;
            
        case 'broadcaster_stream_started':
            console.log('📢 其他主播開始直播:', data.broadcasterId);
            // 重新載入主播列表
            setTimeout(() => {
                loadOtherBroadcasters();
            }, 1000);
            break;
            
        case 'broadcaster_stream_ended':
            console.log('📢 其他主播結束直播:', data.broadcasterId);
            // 重新載入主播列表
            setTimeout(() => {
                loadOtherBroadcasters();
            }, 1000);
            break;
    }
}


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
                        broadcasterId: myBroadcasterId,
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
                        broadcasterId: myBroadcasterId,
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
// 標題和連接初始化已移至 script.js 的 initializeBroadcaster() 統一處理
// 避免多重初始化衝突
// document.addEventListener('DOMContentLoaded', function() { ... });

// 檢查登入狀態
async function checkLoginStatus() {
    try {
        // 檢查服務器登入狀態
        const response = await fetch('/api/user/current');
        const data = await response.json();
        
        if (data.success && data.user) {
            currentUser = data.user;
            isTestMode = false;
            updateUserDisplay(currentUser);
            enableBroadcastFeatures();
            
            // 用戶登入後，如果還沒有標題WebSocket連接，則建立連接
            if (!titleSocket || titleSocket.readyState !== WebSocket.OPEN) {
                initTitleWebSocket();
            }
        } else {
            currentUser = null;
            isTestMode = false;
            // 強制跳轉到登入頁面
            forceLoginRedirect();
        }
    } catch (error) {
        console.error('檢查登入狀態失敗:', error);
        currentUser = null;
        isTestMode = false;
        // 網路錯誤時也強制跳轉到登入頁面
        forceLoginRedirect();
    }
}

// 強制跳轉到登入頁面
function forceLoginRedirect() {
    console.log('用戶未登入，強制跳轉到登入頁面');
    
    // 保存當前頁面URL，登入後可以跳轉回來
    sessionStorage.setItem('redirectAfterLogin', window.location.href);
    
    // 顯示登入提示訊息
    if (typeof addMessage === 'function') {
        addMessage('系統', '🔒 檢測到您尚未登入，即將跳轉到登入頁面...');
    }
    
    // 顯示彈窗提示用戶
    showLoginPermissionModal();
    
    // 延遲跳轉，讓用戶看到提示
    setTimeout(() => {
        window.location.href = '/login.html';
    }, 2000);
}

// 顯示需要登入的提示並禁用直播功能
function showLoginRequired() {
    const userAvatar = document.getElementById('userAvatar');
    const streamBtn = document.getElementById('streamBtn');
    
    // 設置預設頭像，並添加點擊事件
    if (userAvatar) {
        userAvatar.innerHTML = '<i class="fas fa-user"></i>';
        userAvatar.title = '點擊登入';
        userAvatar.style.cursor = 'pointer';
        // 添加點擊事件直接跳轉到登入頁面
        userAvatar.onclick = function() {
            window.location.href = '/login.html';
        };
    }
    
    // 禁用直播按鈕
    if (streamBtn) {
        streamBtn.disabled = true;
        streamBtn.innerHTML = '<i class="fas fa-lock"></i> 請先登入';
        streamBtn.onclick = function() {
            window.location.href = '/login.html';
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
        window.location.href = '/login.html';
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
            messageElement.innerHTML = `
                您需要登入才能使用直播功能。
                <br><br>
                系統將在 2 秒後自動跳轉到登入頁面，您也可以點擊下方按鈕立即跳轉。
            `;
        }
        if (buttons) {
            buttons.innerHTML = `
                <a href="/login.html" class="modal-btn primary">
                    <i class="fas fa-sign-in-alt"></i>
                    立即登入
                </a>
                <a href="/register.html" class="modal-btn secondary">
                    <i class="fas fa-user-plus"></i>
                    免費註冊
                </a>
                <button onclick="enableTestMode()" class="modal-btn danger">
                    <i class="fas fa-flask"></i>
                    測試模式
                </button>
            `;
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
            buttons.innerHTML = `
                <button onclick="closeLoginModal()" class="modal-btn primary">
                    <i class="fas fa-check"></i>
                    確定
                </button>
            `;
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
                buttonsElement.innerHTML = `
                    <button onclick="closeLoginModal()" class="modal-btn primary">
                        <i class="fas fa-check"></i>
                        確定
                    </button>
                `;
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
            buttons.innerHTML = `
                <button onclick="closeLoginModal()" class="modal-btn primary">
                    <i class="fas fa-check"></i>
                    確定
                </button>
            `;
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
                isTestMode = false;
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
                isTestMode = false;
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

// 啟用測試模式
function enableTestMode() {
    currentUser = testUser;
    isTestMode = true;
    
    // 保存測試用戶到本地存儲
    localStorage.setItem('testUser', JSON.stringify(testUser));
    
    updateUserDisplay(currentUser);
    enableBroadcastFeatures();
    closeLoginModal();
    
    // 顯示測試模式提示
    showTestModeWarning();
    
    if (typeof addMessage === 'function') {
        addMessage('系統', '🧪 已啟用測試模式，現在可以開始直播測試');
    }
}

// 顯示測試模式警告
function showTestModeWarning() {
    const modal = document.getElementById('loginPermissionModal');
    if (modal) {
        const icon = modal.querySelector('.modal-icon i');
        const title = modal.querySelector('.modal-title');
        const messageElement = modal.querySelector('.modal-message');
        const buttons = modal.querySelector('.modal-buttons');
        
        if (icon) icon.className = 'fas fa-flask';
        if (title) title.textContent = '測試模式已啟用';
        if (messageElement) {
            messageElement.innerHTML = `
                <div class="test-account-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>注意：</strong>您正在使用測試帳號模式。測試帳號無法登出，只能通過清除瀏覽器數據來重置。
                    <br><br>
                    測試模式僅用於功能測試，不建議在正式環境中使用。
                </div>
            `;
        }
        if (buttons) {
            buttons.innerHTML = `
                <button onclick="closeLoginModal()" class="modal-btn primary">
                    <i class="fas fa-check"></i>
                    我知道了
                </button>
                <button onclick="clearTestMode()" class="modal-btn danger">
                    <i class="fas fa-trash"></i>
                    清除測試數據
                </button>
            `;
        }
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

// 清除測試模式
function clearTestMode() {
    localStorage.removeItem('testUser');
    currentUser = null;
    isTestMode = false;
    
    showLoginRequired();
    closeLoginModal();
    
    if (typeof addMessage === 'function') {
        addMessage('系統', '🧹 測試模式已清除，請重新登入');
    }
}

// 獲取當前直播標題
function getCurrentStreamTitle() {
    return currentStreamTitle || '未命名直播';
}

// 用戶管理功能
let currentUser = null;
let isTestMode = false;
const testUser = {
    username: 'test_user',
    displayName: '測試主播',
    email: 'test@example.com',
    id: 'test_123',
    isTestAccount: true
};

// 切換用戶選單
function toggleUserMenu() {
    console.log('toggleUserMenu 被調用');
    
    // 如果沒有登入，直接跳轉到登入頁面
    if (!currentUser) {
        window.location.href = '/login.html';
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
    
    let menuContent = `
        <div class="menu-user-info">
            <div class="menu-user-name">${currentUserName}</div>
            ${isTestMode ? '<div style="font-size: 0.8rem; color: #f59e0b;">測試模式</div>' : ''}
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
    `;

    // 如果不是測試模式，顯示登出選項
    if (!isTestMode) {
        menuContent += `
            <a href="#" onclick="logout(); event.preventDefault();" class="menu-link logout">
                <i class="fas fa-sign-out-alt"></i>
                登出
            </a>
        `;
    } else {
        menuContent += `
            <a href="#" onclick="clearTestMode(); event.preventDefault();" class="menu-link logout">
                <i class="fas fa-trash"></i>
                清除測試數據
            </a>
        `;
    }

    menu.innerHTML = menuContent;
    
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
        return currentUser.displayName || currentUser.username || '用戶';
    }
    return '未登入';
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
    userAvatar.style.cursor = 'pointer';
    
    // 移除之前的點擊事件，添加正常的用戶選單功能
    userAvatar.onclick = function() {
        toggleUserMenu();
    };
    
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
    showInfoModal('直播管理', '直播管理功能正在開發中，敬請期待！', `
        <button onclick="closeLoginModal()" class="modal-btn primary">
            <i class="fas fa-check"></i>
            我知道了
        </button>
    `);
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

// 用戶載入已移至 script.js 的 initializeBroadcaster() 統一處理
// document.addEventListener('DOMContentLoaded', function() { loadCurrentUser(); });

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
        const maxAttempts = 20; // 最多等待 10 秒
        
        const checkInterval = setInterval(() => {
            attempts++;
            
            if (checkScriptLoading()) {
                clearInterval(checkInterval);
                resolve(true);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error('腳本加載超時');
                resolve(false);
            }
        }, 500);
    });
}

// 聊天系統初始化已移至 script.js 的 initializeBroadcaster() 統一處理
/*
document.addEventListener('DOMContentLoaded', async function() {
    // 等待腳本加載完成
    console.log('等待腳本加載...');
    const scriptsLoaded = await waitForScriptsToLoad();
    
    if (!scriptsLoaded) {
        console.error('某些腳本未能正確加載');
        showErrorModal('頁面初始化失敗，請重新整理頁面。如果問題持續，請檢查網路連線。');
    }
    
    // 啟動登入狀態監控
    if (typeof startLoginStatusMonitoring === 'function') {
        startLoginStatusMonitoring();
    }
    
    // 設置彈窗相關事件
    if (typeof setupModalEvents === 'function') {
        setupModalEvents();
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
    
    // 初始化載入其他主播列表
    setTimeout(() => {
        console.log('🔄 初始化載入其他主播列表');
        loadOtherBroadcasters();
    }, 3000);
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

// 确保 toggleUserMenu 函数在全局作用域中可用
console.log('=== 检查用户菜单函数 ===');
console.log('toggleUserMenu 函数:', typeof toggleUserMenu);
console.log('==========================');

// 如果函数不在全局作用域，手动添加到window对象
if (typeof window.toggleUserMenu !== 'function') {
    console.log('手动添加 toggleUserMenu 到全局作用域');
    window.toggleUserMenu = function() {
        console.log('toggleUserMenu 被調用');
        
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
        
        menu.innerHTML = `
            <div class="menu-user-info">
                <div class="menu-user-name">${currentUserName}</div>
            </div>
            <a href="#" class="menu-link">
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
            <a href="#" class="menu-link logout">
                <i class="fas fa-sign-out-alt"></i>
                登出
            </a>
        `;
        
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
    };
    
    console.log('✅ toggleUserMenu 已添加到全局作用域');
}

// 特效功能
let currentEffect = null;
let backgroundBlurEnabled = false;
let canvasContext = null;
let effectCanvas = null;

function applyEffect(effectType) {
    const videoElement = document.getElementById('localVideo');
    if (!videoElement) return;
    
    // 🎨 如果點擊的是當前已啟用的特效，則關閉特效
    if (currentEffect === effectType) {
        clearEffect();
        // 移除所有特效按鈕的active狀態
        document.querySelectorAll('.effect-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        // 通知觀眾端清除特效
        broadcastEffectToViewers('clear');
        return;
    }
    
    // 🎨 切換特效時：先清除舊特效，通知觀眾，稍微延遲後再套用新特效
    if (currentEffect && currentEffect !== 'none') {
        clearEffect();
        broadcastEffectToViewers('clear');
        
        // 稍微延遲後再套用新特效，讓清除效果更明顯
        setTimeout(() => {
            applyNewEffect(effectType, videoElement);
        }, 100);
    } else {
        // 如果沒有舊特效，直接套用新特效
        applyNewEffect(effectType, videoElement);
    }
}

// 🎨 新增：套用新特效的輔助函數
function applyNewEffect(effectType, videoElement) {
    // 移除所有特效按鈕的active狀態
    document.querySelectorAll('.effect-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (typeof hideFilmFrameOverlay === 'function') {
        hideFilmFrameOverlay(videoElement);
    }
    
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
            videoElement.style.filter = 'blur(8px)'; // 增強模糊效果從 2px 改為 8px
            break;
        case 'vintage':
            // 老舊膠卷效果：褪色的暖色調
            videoElement.style.filter = 'sepia(0.4) saturate(0.6) contrast(1.1) brightness(1.05) hue-rotate(-5deg)';
            
            // 添加膠卷邊框效果 - 使用容器而不是 video 本身
            const videoContainer = videoElement.parentElement;
            if (videoContainer) {
                videoContainer.style.border = '12px solid #1a1a1a';
                videoContainer.style.boxShadow = 'inset 0 0 0 3px #333, 0 0 25px rgba(0,0,0,0.6)';
                videoContainer.style.borderRadius = '8px'; // 覆蓋原本的圓角
            }
            if (typeof showFilmFrameOverlay === 'function') {
                showFilmFrameOverlay(videoElement);
            }
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

function showFilmFrameOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!container) return;
    if (container.querySelector('.film-frame-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'film-frame-overlay';
    overlay.innerHTML = `
        <div class="film-frame-bar top"></div>
        <div class="film-frame-bar bottom"></div>
        <div class="film-frame-strip left"></div>
        <div class="film-frame-strip right"></div>`;
    container.appendChild(overlay);
}

function hideFilmFrameOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.film-frame-overlay');
    if (overlay) {
        overlay.remove();
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
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
        z-index: 10;
    `;
    
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
    element.style.cssText = `
        position: absolute;
        font-size: ${Math.random() * 20 + 15}px;
        left: ${Math.random() * 100}%;
        top: -50px;
        animation: fall ${Math.random() * 3 + 2}s linear infinite;
        animation-delay: ${Math.random() * 2}s;
    `;
    
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
        
        // 清除容器的邊框效果
        const videoContainer = videoElement.parentElement;
        if (videoContainer) {
            videoContainer.style.border = '';
            videoContainer.style.boxShadow = '';
            videoContainer.style.borderRadius = '15px'; // 恢復原本的圓角
        }

    hideFilmFrameOverlay(videoElement);
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
    
    if (typeof restoreOriginalStream === 'function') {
        restoreOriginalStream();
    }
    
    addMessage('系統', '🧹 已清除所有特效');
}

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
        const maxAttempts = 20; // 最多等待 10 秒
        
        const checkInterval = setInterval(() => {
            attempts++;
            
            if (checkScriptLoading()) {
                clearInterval(checkInterval);
                resolve(true);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error('腳本加載超時');
                resolve(false);
            }
        }, 500);
    });
}

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
