// 獲取URL參數中的主播ID，如果沒有則使用當前用戶ID
function getBroadcasterIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlBroadcasterId = urlParams.get('broadcaster');
    
    if (urlBroadcasterId) {
        // 如果是 'username'，使用當前用戶的用戶名
        if (urlBroadcasterId === 'username') {
            if (currentUser && currentUser.username) {
                return `broadcaster_${currentUser.username}`;
            } else if (currentUser && currentUser.displayName) {
                return `broadcaster_${currentUser.displayName}`;
            }
            // 如果沒有當前用戶，使用時間戳
            return `broadcaster_${Date.now()}`;
        }
        // 如果是實際的用戶名，直接使用
        return `broadcaster_${urlBroadcasterId}`;
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
let titleSocket = null;
let isTitleSocketConnected = false;

// 初始化標題WebSocket連接
function initTitleSocket() {
    if (titleSocket && titleSocket.readyState === WebSocket.OPEN) {
        console.log('標題WebSocket已連接');
        return;
    }
    
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        console.log('初始化標題WebSocket連接:', wsUrl);
        titleSocket = new WebSocket(wsUrl);
        
        titleSocket.onopen = function() {
            console.log('✅ 標題WebSocket已連接');
            isTitleSocketConnected = true;
            
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
        
        titleSocket.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                console.log('標題WebSocket收到消息:', data);
                
                if (data.type === 'title_updated') {
                    console.log('收到標題更新:', data.title);
                    // 這裡可以處理標題更新邏輯
                }
            } catch (error) {
                console.error('解析標題WebSocket消息失敗:', error);
            }
        };
        
        titleSocket.onclose = function() {
            console.log('標題WebSocket連接已關閉');
            isTitleSocketConnected = false;
            
            // 嘗試重連
            setTimeout(() => {
                if (!isTitleSocketConnected) {
                    console.log('嘗試重新連接標題WebSocket...');
                    initTitleSocket();
                }
            }, 3000);
        };
        
        titleSocket.onerror = function(error) {
            console.error('標題WebSocket錯誤:', error);
            isTitleSocketConnected = false;
        };
        
    } catch (error) {
        console.error('初始化標題WebSocket失敗:', error);
    }
}

// 更新直播標題
function updateStreamTitle(newTitle) {
    if (!titleSocket || !isTitleSocketConnected) {
        console.log('標題WebSocket未連接，嘗試重新連接...');
        initTitleSocket();
        return;
    }
    
    const message = {
        type: 'update_title',
        broadcasterId: myBroadcasterId,
        title: newTitle,
        timestamp: Date.now()
    };
    
    console.log('發送標題更新:', message);
    titleSocket.send(JSON.stringify(message));
}

// 登入狀態監控
let loginCheckInterval = null;
let isMonitoringLogin = false;

// 開始監控登入狀態
function startLoginStatusMonitoring() {
    if (isMonitoringLogin) {
        console.log('登入狀態監控已在運行');
        return;
    }
    
    console.log('開始監控登入狀態');
    isMonitoringLogin = true;
    
    // 立即檢查一次
    checkLoginStatus();
    
    // 每5秒檢查一次
    loginCheckInterval = setInterval(checkLoginStatus, 5000);
}

// 停止監控登入狀態
function stopLoginStatusMonitoring() {
    if (loginCheckInterval) {
        clearInterval(loginCheckInterval);
        loginCheckInterval = null;
    }
    isMonitoringLogin = false;
    console.log('停止監控登入狀態');
}

// 檢查登入狀態
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        if (data.success && data.user) {
            // 用戶已登入
            if (!currentUser || currentUser.id !== data.user.id) {
                console.log('檢測到用戶登入:', data.user.displayName);
                currentUser = data.user;
                
                // 更新主播ID
                if (!myBroadcasterId) {
                    myBroadcasterId = getBroadcasterIdFromUrl();
                }
                
                // 重新連接WebSocket
                if (titleSocket) {
                    titleSocket.close();
                }
                initTitleSocket();
            }
        } else {
            // 用戶未登入
            if (currentUser) {
                console.log('檢測到用戶登出');
                currentUser = null;
                
                // 關閉WebSocket連接
                if (titleSocket) {
                    titleSocket.close();
                    titleSocket = null;
                    isTitleSocketConnected = false;
                }
                
                // 顯示登入提示
                showLoginModal();
            }
        }
    } catch (error) {
        console.error('檢查登入狀態失敗:', error);
    }
}

// 顯示登入提示彈窗
function showLoginModal() {
    // 檢查是否已經有彈窗
    if (document.getElementById('loginPermissionModal')) {
        return;
    }
    
    const modal = document.createElement('div');
    modal.id = 'loginPermissionModal';
    modal.className = 'modal-overlay show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>需要登入</h3>
                <button class="close-btn" onclick="closeLoginModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p>您需要登入才能使用直播功能。</p>
                <div class="modal-actions">
                    <a href="login.html" class="btn btn-primary">前往登入</a>
                    <button class="btn btn-secondary" onclick="closeLoginModal()">稍後再說</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 關閉登入提示彈窗
function closeLoginModal() {
    const modal = document.getElementById('loginPermissionModal');
    if (modal) {
        modal.remove();
    }
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('主播頁面載入完成');
    
    // 檢查登入狀態
    checkLoginStatus();
    
    // 啟動登入狀態監控
    startLoginStatusMonitoring();
    
    // 初始化標題WebSocket
    setTimeout(() => {
        initTitleSocket();
    }, 1000);
});

// 頁面卸載時清理
window.addEventListener('beforeunload', function() {
    stopLoginStatusMonitoring();
    if (titleSocket) {
        titleSocket.close();
    }
});

// 聊天系統初始化已移至 script.js 的 initializeBroadcaster() 統一處理