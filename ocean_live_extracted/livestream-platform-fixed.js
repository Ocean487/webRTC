// 臨時修復文件 - 移除多重初始化
// 這個文件用於修復 livestream-platform.js 的註釋語法錯誤

console.log('🔧 livestream-platform.js 修復版本已載入');

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

// 更新直播標題
function updateStreamTitle() {
    const titleInput = document.getElementById('streamTitleInput');
    const currentTitleDisplay = document.getElementById('currentTitleDisplay');
    
    if (titleInput) {
        const newTitle = titleInput.value.trim();
        if (newTitle !== currentStreamTitle) {
            currentStreamTitle = newTitle;
            if (currentStreamTitle) {
                if (currentTitleDisplay) {
                    currentTitleDisplay.textContent = `目前標題: ${currentStreamTitle}`;
                }
                console.log('直播標題已更新:', currentStreamTitle);
                
                // 使用主要的streamingSocket發送更新
                if (window.streamingSocket && window.streamingSocket.readyState === WebSocket.OPEN) {
                    window.streamingSocket.send(JSON.stringify({
                        type: 'title_update',
                        title: currentStreamTitle,
                        timestamp: Date.now()
                    }));
                    console.log('已通過streamingSocket發送標題更新到觀眾端');
                } else {
                    console.warn('streamingSocket未連接，無法發送標題更新');
                }
            } else {
                if (currentTitleDisplay) {
                    currentTitleDisplay.textContent = '目前標題: 未設定';
                }
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
    }
}

// 檢查登入狀態
async function checkLoginStatus() {
    try {
        // 檢查服務器登入狀態
        const response = await fetch('/api/user/current');
        const data = await response.json();
        
        if (data.success && data.user) {
            currentUser = data.user;
            console.log('✅ 用戶已登入:', currentUser.displayName);
            return true;
        } else {
            console.log('❌ 用戶未登入');
            return false;
        }
    } catch (error) {
        console.error('檢查登入狀態失敗:', error);
        return false;
    }
}

// 載入當前用戶
async function loadCurrentUser() {
    try {
        const response = await fetch('/api/user/current');
        const data = await response.json();
        
        if (data.success && data.user) {
            currentUser = data.user;
            console.log('✅ 用戶已載入:', currentUser.displayName);
            updateUserDisplay(currentUser);
            return true;
        } else {
            console.log('❌ 用戶未登入，強制重定向到登入頁面');
            forceLoginRedirect();
            return false;
        }
    } catch (error) {
        console.error('載入用戶失敗:', error);
        forceLoginRedirect();
        return false;
    }
}

// 強制登入重定向
function forceLoginRedirect() {
    console.log('🚨 主播端需要登入，重定向到登入頁面');
    
    // 顯示登入提示
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.style.display = 'flex';
        loginModal.classList.add('show');
    }
    
    // 禁用所有直播功能
    disableBroadcastingFeatures();
    
    // 顯示登入提示訊息
    displayLoginRequiredMessage();
}

// 禁用直播功能
function disableBroadcastingFeatures() {
    // 禁用開始直播按鈕
    const startButton = document.getElementById('startStreamBtn');
    if (startButton) {
        startButton.disabled = true;
        startButton.textContent = '請先登入';
        startButton.style.opacity = '0.5';
    }
    
    // 禁用標題輸入
    const titleInput = document.getElementById('streamTitleInput');
    if (titleInput) {
        titleInput.disabled = true;
        titleInput.placeholder = '請先登入才能設定標題';
    }
    
    // 禁用設備選擇
    const deviceSelects = document.querySelectorAll('select');
    deviceSelects.forEach(select => {
        select.disabled = true;
    });
    
    console.log('✅ 已禁用所有直播功能');
}

// 顯示登入提示訊息
function displayLoginRequiredMessage() {
    // 創建或更新登入提示
    let loginPrompt = document.getElementById('loginRequiredPrompt');
    if (!loginPrompt) {
        loginPrompt = document.createElement('div');
        loginPrompt.id = 'loginRequiredPrompt';
        loginPrompt.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        `;
        document.body.appendChild(loginPrompt);
    }
    
    loginPrompt.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 20px;">
            <i class="fas fa-lock" style="color: #ff6b6b;"></i>
        </div>
        <h3 style="margin: 0 0 15px 0; color: #ff6b6b;">需要登入才能使用主播功能</h3>
        <p style="margin: 0 0 20px 0; opacity: 0.8;">
            主播功能需要登入帳號才能使用，請先登入或註冊新帳號。
        </p>
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button onclick="redirectToLogin()" style="
                background: #4CAF50;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
            ">登入</button>
            <button onclick="redirectToRegister()" style="
                background: #2196F3;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
            ">註冊</button>
        </div>
    `;
}

// 重定向到登入頁面
function redirectToLogin() {
    window.location.href = '/login.html';
}

// 重定向到註冊頁面
function redirectToRegister() {
    window.location.href = '/register.html';
}

// 更新用戶顯示
function updateUserDisplay(user) {
    const userAvatar = document.getElementById('userAvatar');
    
    if (user.avatarUrl) {
        userAvatar.innerHTML = `<img src="${user.avatarUrl}" alt="${user.displayName}">`;
    } else {
        const initial = user.displayName.charAt(0).toUpperCase();
        userAvatar.innerHTML = initial;
    }
}

// 訪客模式
function showGuestMode() {
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar) {
        userAvatar.innerHTML = '<i class="fas fa-user"></i>';
        userAvatar.title = '點擊登入或繼續以訪客身份觀看';
    }
    
    // 設置訪客用戶信息
    currentUser = {
        displayName: '訪客',
        username: 'guest_' + Math.random().toString(36).substr(2, 6),
        isGuest: true
    };
    
    console.log('已設置為訪客模式');
}

// 由於註釋語法錯誤，暫時移除有問題的 DOMContentLoaded 處理器
// 所有初始化功能已統一至 script.js 的 initializeBroadcaster() 函數處理
