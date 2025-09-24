// VibeLo 观众端 JavaScript 功能
// 全局變數
let currentUser = null;
let socket = null;
let peerConnection = null;
let isConnected = false;
let viewerId = 'viewer_' + Math.random().toString(36).substr(2, 9);

// 獲取URL參數中的主播ID
function getStreamerIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('streamer') || 'default';
}

// 全局變數存儲主播ID
let targetStreamerId = getStreamerIdFromUrl();

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== VibeLo 观众端初始化 ===');
    loadCurrentUser();
    connectWebSocket();
    setupEventListeners();
    setupMobileMenu();
    
    // 初始化状态显示
    updateConnectionStatus();
    
    // 顯示歡迎消息
    displaySystemMessage('歡迎來到直播間！等待主播開始直播...');
});

// 載入當前用戶
async function loadCurrentUser() {
    try {
        const response = await fetch('/api/user/current');
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            updateUserDisplay(currentUser);
        } else {
            showGuestMode();
        }
    } catch (error) {
        console.error('載入用戶信息失敗:', error);
        showGuestMode();
    }
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
    userAvatar.innerHTML = '<i class="fas fa-user"></i>';
}

// 連接 WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = function() {
        console.log('WebSocket 連接成功');
        isConnected = true;
        updateConnectionStatus();
        
        // 作為觀眾加入
        socket.send(JSON.stringify({
            type: 'viewer_join',
            viewerId: viewerId,
            streamerId: targetStreamerId,
            userInfo: currentUser || { displayName: `觀眾${viewerId.substr(-3)}`, avatarUrl: null }
        }));
        
        displaySystemMessage('已連接到直播間');
    };
    
    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    socket.onclose = function() {
        console.log('WebSocket 連接關閉');
        isConnected = false;
        updateConnectionStatus();
        displaySystemMessage('連接已斷開，正在重新連接...');
        // 嘗試重新連接
        setTimeout(connectWebSocket, 3000);
    };
    
    socket.onerror = function(error) {
        console.error('WebSocket 錯誤:', error);
        displaySystemMessage('連接錯誤，請檢查網絡連接');
    };
}

// 處理 WebSocket 消息
function handleWebSocketMessage(data) {
    console.log('收到消息:', data);
    
    switch(data.type) {
        case 'viewer_joined':
            window.receivedViewerJoined = true;
            console.log('✅ 收到 viewer_joined 消息');
            displaySystemMessage('已成功加入直播間');
            updateConnectionStatus();
            
            // 處理主播信息
            if (data.broadcasterInfo) {
                updateBroadcasterInfo(data.broadcasterInfo);
            }
            break;
        case 'broadcaster_info':
            // 處理主播信息（當主播未在直播時）
            if (data.broadcasterInfo) {
                updateBroadcasterInfo(data.broadcasterInfo);
                displaySystemMessage(data.message || '等待主播開始直播');
            }
            break;
        case 'stream_start':
            window.receivedStreamStart = true;
            console.log('✅ 收到 stream_start 消息');
            handleStreamStarted(data);
            updateConnectionStatus();
            break;
        case 'stream_status':
            handleStreamStatus(data);
            break;
        case 'stream_end':
            handleStreamEnded();
            break;
        case 'title_update':
            handleTitleUpdate(data);
            break;
        case 'chat_message':
            // 舊格式的聊天消息，轉換為新格式後由ChatSystem處理
            if (window.chatSystem && window.chatSystem.handleMessage) {
                window.chatSystem.handleMessage({
                    type: 'chat',
                    role: data.isStreamer ? 'broadcaster' : 'viewer',
                    username: data.username || '匿名用戶',
                    message: data.text || data.message || '',
                    timestamp: data.timestamp
                });
            } else {
                displayChatMessage(data);
            }
            break;
        case 'chat':
            // 新的統一聊天協議 - 不在這裡處理，完全交給ChatSystem
            console.log('[VIEWER] chat類型消息由ChatSystem直接處理，跳過重複處理');
            break;
        case 'viewer_count_update':
            updateViewerCount(data.count);
            break;
        case 'offer':
            window.receivedOffer = true;
            console.log('✅ 收到 WebRTC offer');
            handleOffer(data.offer);
            updateConnectionStatus();
            break;
        case 'ice_candidate':
            window.receivedIceCandidate = true;
            console.log('✅ 收到 ICE candidate');
            handleIceCandidate(data.candidate);
            break;
        case 'ack':
            console.log('收到確認:', data);
            break;
        default:
            console.log('未知消息類型:', data.type);
    }
}

// 處理直播開始
function handleStreamStarted(data) {
    console.log('直播開始:', data);
    
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    const liveIndicator = document.getElementById('liveIndicator');
    const streamTitle = document.getElementById('streamTitle');
    const streamerName = document.getElementById('streamerName');
    const statusText = document.getElementById('statusText');
    
    if (videoPlaceholder) videoPlaceholder.style.display = 'none';
    if (liveIndicator) liveIndicator.style.display = 'flex';
    
    // 更新主播名稱為直播狀態
    if (streamerName) {
        const broadcasterName = window.currentBroadcasterName || '主播';
        streamerName.textContent = `${broadcasterName} 正在直播`;
    }
    
    // 更新狀態文字
    if (statusText) {
        statusText.textContent = '';
        statusText.className = 'status-text live';
    }
    
    // 更新直播標題
    if (streamTitle) {
        if (data.title && data.title.trim() !== '') {
            streamTitle.textContent = data.title;
            console.log('直播開始，標題:', data.title);
        } else {
            streamTitle.textContent = '精彩直播中';
            console.log('直播開始，使用預設標題');
        }
        
        // 為直播開始添加一個特殊的動畫效果
        streamTitle.classList.add('updating');
        streamTitle.style.transform = 'scale(1.1)';
        setTimeout(() => {
            streamTitle.style.transform = 'scale(1)';
            streamTitle.classList.remove('updating');
        }, 500);
    }
    
    displaySystemMessage('🎉 主播已開始直播！');
    
    // 立即初始化 WebRTC 連接
    console.log('🔄 直播開始，立即初始化 WebRTC 連接');
    initializePeerConnection();
    
    // 如果 3 秒后还没有收到 offer，主动请求
    setTimeout(function() {
        if (!window.receivedOffer && socket && isConnected) {
            console.log('⚠️ 3秒后仍未收到 offer，主动请求 WebRTC 连接');
            socket.send(JSON.stringify({
                type: 'request_webrtc_connection',
                viewerId: viewerId,
                streamerId: targetStreamerId
            }));
            displaySystemMessage('🔄 正在请求视频连接...');
        }
    }, 3000);
}

// 處理直播標題更新
function handleTitleUpdate(data) {
    console.log('收到標題更新:', data);
    
    const streamTitle = document.getElementById('streamTitle');
    if (streamTitle) {
        streamTitle.classList.add('updating');
        
        if (data.title && data.title.trim() !== '') {
            streamTitle.textContent = data.title;
            console.log('標題已更新為:', data.title);
            displaySystemMessage(`📝 直播標題已更新: ${data.title}`);
        } else {
            streamTitle.textContent = '直播進行中';
            console.log('標題已重置為預設值');
            displaySystemMessage('📝 直播標題已重置');
        }
        
        streamTitle.style.transform = 'scale(1.05)';
        setTimeout(() => {
            streamTitle.style.transform = 'scale(1)';
            streamTitle.classList.remove('updating');
        }, 300);
    }
}

// 處理直播狀態更新
function handleStreamStatus(data) {
    console.log('收到直播狀態更新:', data);
    
    const statusText = document.getElementById('statusText');
    const streamTitle = document.getElementById('streamTitle');
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    const liveIndicator = document.getElementById('liveIndicator');
    
    if (data.status === 'live') {
        // 直播進行中
        if (statusText) statusText.textContent = '';
        if (videoPlaceholder) videoPlaceholder.style.display = 'none';
        if (liveIndicator) liveIndicator.style.display = 'flex';
        
        // 更新標題
        if (streamTitle && data.title) {
            streamTitle.textContent = data.title;
            streamTitle.classList.add('updating');
            streamTitle.style.transform = 'scale(1.05)';
            setTimeout(() => {
                streamTitle.style.transform = 'scale(1)';
                streamTitle.classList.remove('updating');
            }, 300);
        }
        
        displaySystemMessage('🔴 直播正在進行中！');
        
        // 如果還沒有 WebRTC 連接，嘗試初始化
        if (!peerConnection || peerConnection.connectionState === 'closed') {
            initializePeerConnection();
        }
    } else if (data.status === 'starting') {
        // 直播準備中
        if (statusText) statusText.textContent = '直播準備中...';
        if (streamTitle && data.title) {
            streamTitle.textContent = data.title;
        }
        displaySystemMessage('⏳ 直播即將開始...');
    }
}

// 更新主播信息顯示
function updateBroadcasterInfo(broadcasterInfo) {
    console.log('更新主播信息:', broadcasterInfo);
    
    // 存儲主播名稱到全局變量
    window.currentBroadcasterName = broadcasterInfo.displayName || '主播';
    
    const streamerName = document.getElementById('streamerName');
    const streamerAvatar = document.getElementById('streamerAvatar');
    const statusText = document.getElementById('statusText');
    
    if (streamerName && broadcasterInfo.displayName) {
        streamerName.textContent = `等待主播 ${broadcasterInfo.displayName} 開始直播`;
    }
    
    if (streamerAvatar) {
        if (broadcasterInfo.avatarUrl) {
            streamerAvatar.innerHTML = `<img src="${broadcasterInfo.avatarUrl}" alt="${broadcasterInfo.displayName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
            streamerAvatar.innerHTML = '<i class="fas fa-user"></i>';
        }
    }
    
    if (statusText) {
        statusText.textContent = `等待 ${broadcasterInfo.displayName} 開始直播`;
        statusText.className = 'status-text waiting';
    }
}

// 處理直播結束
function handleStreamEnded() {
    console.log('直播結束');
    
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    const liveIndicator = document.getElementById('liveIndicator');
    const remoteVideo = document.getElementById('remoteVideo');
    const playPrompt = document.getElementById('playPrompt');
    const streamTitle = document.getElementById('streamTitle');
    
    if (videoPlaceholder) videoPlaceholder.style.display = 'block';
    if (liveIndicator) liveIndicator.style.display = 'none';
    if (remoteVideo) remoteVideo.style.display = 'none';
    if (playPrompt) playPrompt.style.display = 'none';
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    displaySystemMessage('📺 直播已結束，感謝觀看！');
    
    // 更新狀態顯示
    const statusText = document.getElementById('statusText');
    if (statusText) {
        statusText.textContent = '等待直播中';
        statusText.className = 'status-text';
    }
    
    // 重置主播信息和標題
    document.getElementById('streamerName').textContent = '等待直播中...';
    document.getElementById('streamerAvatar').innerHTML = '<i class="fas fa-user"></i>';
    
    // 重置標題時添加動畫效果
    if (streamTitle) {
        streamTitle.classList.add('updating');
        streamTitle.style.transform = 'scale(0.95)';
        setTimeout(() => {
            streamTitle.textContent = '等待精彩直播...';
            streamTitle.style.transform = 'scale(1)';
            streamTitle.classList.remove('updating');
        }, 300);
    }
}

// 初始化 WebRTC 連接 - 修復直播畫面顯示問題
function initializePeerConnection() {
    console.log('初始化 WebRTC 連接');
    
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };
    
    peerConnection = new RTCPeerConnection(configuration);
    
    peerConnection.ontrack = function(event) {
        console.log('收到遠程視頻流', event);
        const remoteVideo = document.getElementById('remoteVideo');
        const videoPlaceholder = document.getElementById('videoPlaceholder');
        const playPrompt = document.getElementById('playPrompt');
        
        if (remoteVideo && event.streams && event.streams[0]) {
            console.log('設置視頻流到 video 元素');
            remoteVideo.srcObject = event.streams[0];
            
            // 確保視頻元素顯示
            remoteVideo.style.display = 'block';
            if (videoPlaceholder) videoPlaceholder.style.display = 'none';
            
            // 監聽視頻元素的事件
            remoteVideo.onloadedmetadata = function() {
                console.log('視頻元數據已載入');
                console.log('視頻尺寸:', remoteVideo.videoWidth, 'x', remoteVideo.videoHeight);
            };
            
            remoteVideo.onloadeddata = function() {
                console.log('視頻數據已載入，準備播放');
            };
            
            remoteVideo.oncanplay = function() {
                console.log('視頻可以開始播放');
            };
            
            remoteVideo.onplay = function() {
                console.log('視頻開始播放');
                if (playPrompt) playPrompt.style.display = 'none';
            };
            
            remoteVideo.onerror = function(error) {
                console.error('視頻播放錯誤:', error);
                displaySystemMessage('視頻播放錯誤，請重新整理頁面');
            };
            
            // 嘗試自動播放
            remoteVideo.play().then(() => {
                console.log('自動播放成功');
                displaySystemMessage('🎬 視頻已開始播放');
            }).catch(error => {
                console.log('自動播放失敗，顯示播放提示:', error);
                if (playPrompt) {
                    playPrompt.style.display = 'block';
                    displaySystemMessage('請點擊播放按鈕開始觀看');
                }
            });
        } else {
            console.error('未收到有效的視頻流');
        }
    };
    
    peerConnection.onicecandidate = function(event) {
        if (event.candidate && socket && isConnected) {
            socket.send(JSON.stringify({
                type: 'ice_candidate',
                candidate: event.candidate,
                viewerId: viewerId
            }));
        }
    };
    
    peerConnection.onconnectionstatechange = function() {
        console.log('WebRTC 連接狀態:', peerConnection.connectionState);
        updateConnectionStatus();
        
        if (peerConnection.connectionState === 'connected') {
            displaySystemMessage('視頻串流已連接');
        } else if (peerConnection.connectionState === 'disconnected') {
            displaySystemMessage('視頻串流已斷開');
        } else if (peerConnection.connectionState === 'failed') {
            displaySystemMessage('視頻連接失敗，正在重試...');
        }
    };
}

// 處理 WebRTC Offer
async function handleOffer(offer) {
    console.log('處理 WebRTC Offer');
    
    if (!peerConnection) {
        initializePeerConnection();
    }
    
    try {
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        if (socket && isConnected) {
            socket.send(JSON.stringify({
                type: 'answer',
                answer: answer,
                viewerId: viewerId
            }));
        }
    } catch (error) {
        console.error('處理 offer 失敗:', error);
        displaySystemMessage('視頻連接失敗，請刷新頁面重試');
    }
}

// 處理 ICE Candidate
async function handleIceCandidate(candidate) {
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(candidate);
        } catch (error) {
            console.error('添加 ICE candidate 失敗:', error);
        }
    }
}

// 顯示聊天消息
function displayChatMessage(data) {
    const chatMessages = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    
    const time = new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    messageElement.innerHTML = `
        <div class="message-avatar">
            ${data.userAvatar ? 
                `<img src="${data.userAvatar}" alt="${data.username}">` : 
                (data.username.charAt(0).toUpperCase())
            }
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-user">${data.username}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${data.text}</div>
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 顯示系統消息
function displaySystemMessage(text) {
    displayChatMessage({
        username: '系統',
        text: text,
        userAvatar: null,
        timestamp: new Date().toISOString()
    });
}

// 更新连接状态显示
function updateConnectionStatus() {
    const statusText = document.getElementById('statusText');
    if (!statusText) return;
    
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        statusText.textContent = '正在连接服务器...';
        statusText.className = 'status-text connecting';
    } else if (!isConnected) {
        statusText.textContent = '正在加入直播间...';
        statusText.className = 'status-text connecting';
    } else if (!window.receivedStreamStart) {
        statusText.textContent = '等待主播开始直播...';
        statusText.className = 'status-text waiting';
    } else if (!peerConnection) {
        statusText.textContent = '正在建立视频连接...';
        statusText.className = 'status-text connecting';
    } else if (peerConnection.connectionState === 'connecting') {
        statusText.textContent = '视频连接中...';
        statusText.className = 'status-text connecting';
    } else if (peerConnection.connectionState === 'connected') {
        statusText.textContent = '';
        statusText.className = 'status-text live';
    } else if (peerConnection.connectionState === 'failed') {
        statusText.textContent = '视频连接失败，正在重试...';
        statusText.className = 'status-text error';
    } else {
        statusText.textContent = `视频连接状态: ${peerConnection.connectionState}`;
        statusText.className = 'status-text';
    }
}

// 設置事件監聽器
function setupEventListeners() {
    // 聊天事件監聽器已移除，由ChatSystem完全處理
}

// 設置移動端菜單
function setupMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileNav = document.getElementById('mobileNav');
    
    if (mobileMenuToggle && mobileNav) {
        mobileMenuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const isActive = mobileNav.classList.toggle('active');
            
            // 更新可訪問性屬性
            mobileMenuToggle.setAttribute('aria-expanded', isActive);
            mobileMenuToggle.setAttribute('aria-label', isActive ? '關閉選單' : '開啟選單');
            
            // 切換圖標
            const icon = mobileMenuToggle.querySelector('i');
            if (isActive) {
                icon.className = 'fas fa-times';
            } else {
                icon.className = 'fas fa-bars';
            }
        });

        // 點擊頁面其他地方關閉菜單
        document.addEventListener('click', function() {
            if (mobileNav.classList.contains('active')) {
                mobileNav.classList.remove('active');
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
                mobileMenuToggle.setAttribute('aria-label', '開啟選單');
                const icon = mobileMenuToggle.querySelector('i');
                icon.className = 'fas fa-bars';
            }
        });

        // 阻止菜單內部點擊冒泡
        mobileNav.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        // 窗口大小改變時隱藏移動端菜單
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768 && mobileNav.classList.contains('active')) {
                mobileNav.classList.remove('active');
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
                mobileMenuToggle.setAttribute('aria-label', '開啟選單');
                const icon = mobileMenuToggle.querySelector('i');
                icon.className = 'fas fa-bars';
            }
        });

        // ESC 鍵關閉菜單
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
                mobileNav.classList.remove('active');
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
                mobileMenuToggle.setAttribute('aria-label', '開啟選單');
                const icon = mobileMenuToggle.querySelector('i');
                icon.className = 'fas fa-bars';
                mobileMenuToggle.focus(); // 返回焦點到按鈕
            }
        });
    }
}

// 更新觀看人數
function updateViewerCount(count) {
    const viewerCountEl = document.getElementById('viewerCount');
    const chatViewerCountEl = document.getElementById('chatViewerCount');
    
    if (viewerCountEl) viewerCountEl.textContent = count;
    if (chatViewerCountEl) chatViewerCountEl.textContent = count;
}

// 切換用戶選單
function toggleUserMenu() {
    console.log('toggleUserMenu 被調用，currentUser:', currentUser);
    
    // 如果用戶未登入，直接重定向到登入頁面
    if (!currentUser) {
        console.log('未登入用戶點擊頭像，重定向到登入頁面');
        window.location.href = 'login.html';
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
    
    const currentUserName = getCurrentUserName() || 'Ghost_觀眾';
    
    // 創建下拉選單 - 已登入觀眾版本
    const menu = document.createElement('div');
    menu.className = 'user-dropdown';
    menu.style.opacity = '0';
    menu.style.transform = 'translateY(-10px)';
    menu.style.transition = 'all 0.15s ease-out';
    
    // 已登入觀眾選單
    menu.innerHTML = `
        <div class="menu-user-info">
            <div class="menu-user-name">${currentUserName}</div>
        </div>
        <a href="livestream_platform.html" class="menu-link">
            <i class="fas fa-video"></i>
            我要直播
        </a>
        <a href="index.html" class="menu-link">
            <i class="fas fa-home"></i>
            回到首頁
        </a>
        <div class="menu-link" onclick="logout()">
            <i class="fas fa-sign-out-alt"></i>
            登出
        </div>
    `;
    
    userAvatar.style.position = 'relative';
    userAvatar.appendChild(menu);
    
    // 显示动画
    setTimeout(() => {
        menu.style.opacity = '1';
        menu.style.transform = 'translateY(0)';
    }, 10);
    
    // 点击其他地方关闭菜单
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

// 獲取當前用戶名稱
function getCurrentUserName() {
    if (currentUser && currentUser.displayName) {
        return currentUser.displayName;
    }
    return '觀眾';
}

// 登出功能
async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            window.location.href = 'index.html';
        } else {
            console.error('登出失敗');
        }
    } catch (error) {
        console.error('登出錯誤:', error);
    }
}

// 添加诊断和调试功能
window.diagnoseViewerIssue = function() {
    console.log('=== 观众端诊断 ===');
    console.log('1. WebSocket连接状态:', socket ? socket.readyState : '未建立');
    console.log('2. WebRTC连接状态:', peerConnection ? peerConnection.connectionState : '未建立');
    
    const remoteVideo = document.getElementById('remoteVideo');
    console.log('3. 远程视频元素:', remoteVideo ? '存在' : '不存在');
    console.log('4. 视频流状态:', remoteVideo && remoteVideo.srcObject ? '已接收' : '未接收');
    console.log('5. 视频元素显示:', remoteVideo ? remoteVideo.style.display : 'N/A');
    console.log('6. 视频是否准备好:', remoteVideo ? remoteVideo.readyState : 'N/A');
    console.log('7. 视频是否暂停:', remoteVideo ? remoteVideo.paused : 'N/A');
    console.log('8. 视频是否静音:', remoteVideo ? remoteVideo.muted : 'N/A');
    console.log('9. 连接状态:', isConnected ? '已连接' : '未连接');
    console.log('10. 观众ID:', viewerId);
    
    if (remoteVideo && remoteVideo.srcObject) {
        const stream = remoteVideo.srcObject;
        console.log('11. 视频轨道数量:', stream.getVideoTracks().length);
        console.log('12. 音频轨道数量:', stream.getAudioTracks().length);
        
        stream.getVideoTracks().forEach((track, index) => {
            console.log(`    视频轨道 ${index}:`, {
                readyState: track.readyState,
                enabled: track.enabled,
                muted: track.muted,
                label: track.label
            });
        });
        
        stream.getAudioTracks().forEach((track, index) => {
            console.log(`    音频轨道 ${index}:`, {
                readyState: track.readyState,
                enabled: track.enabled,
                muted: track.muted,
                label: track.label
            });
        });
        
        // 检查视频尺寸
        if (remoteVideo.videoWidth && remoteVideo.videoHeight) {
            console.log('13. 视频尺寸:', `${remoteVideo.videoWidth}x${remoteVideo.videoHeight}`);
        } else {
            console.log('13. 视频尺寸: 未知或未载入');
        }
    }
    
    // 检查 WebRTC 连接详细状态
    if (peerConnection) {
        console.log('14. WebRTC 详细状态:', {
            connectionState: peerConnection.connectionState,
            iceConnectionState: peerConnection.iceConnectionState,
            iceGatheringState: peerConnection.iceGatheringState,
            signalingState: peerConnection.signalingState
        });
    }
    
    // 检查页面元素状态
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    const playPrompt = document.getElementById('playPrompt');
    console.log('15. videoPlaceholder 显示:', videoPlaceholder ? videoPlaceholder.style.display : 'N/A');
    console.log('16. playPrompt 显示:', playPrompt ? playPrompt.style.display : 'N/A');
    
    console.log('=== 观众端诊断完成 ===');
    
    // 提供修复建议
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn('建议: WebSocket连接有问题，请重新整理页面');
    }
    
    if (!peerConnection) {
        console.warn('建议: WebRTC连接未建立，请等待主播开始直播');
    }
    
    if (remoteVideo && remoteVideo.srcObject && remoteVideo.paused) {
        console.warn('建议: 视频已接收但暂停，请点击播放按钮');
    }
    
    if (remoteVideo && !remoteVideo.srcObject) {
        console.warn('建议: 未接收到视频流，请检查主播是否正在直播');
    }
};

// 专门诊断 WebRTC 连接问题的函数
window.diagnoseWebRTCIssue = function() {
    console.log('=== WebRTC 连接问题诊断 ===');
    console.log('1. 基本信息:');
    console.log('   - 观众ID:', viewerId);
    console.log('   - 目标主播ID:', targetStreamerId);
    console.log('   - WebSocket 状态:', socket ? socket.readyState : '未建立');
    console.log('   - isConnected 标志:', isConnected);
    console.log('   - WebRTC 连接:', peerConnection ? peerConnection.connectionState : '未建立');
    
    console.log('2. 消息接收情况:');
    console.log('   - 是否收到 viewer_joined:', window.receivedViewerJoined ? '是' : '否');
    console.log('   - 是否收到 stream_start:', window.receivedStreamStart ? '是' : '否');
    console.log('   - 是否收到 offer:', window.receivedOffer ? '是' : '否');
    console.log('   - 是否收到 ice_candidate:', window.receivedIceCandidate ? '是' : '否');
    
    console.log('3. 建议操作:');
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.log('   ❌ WebSocket 未连接，请重新整理页面');
    } else if (!isConnected) {
        console.log('   ❌ 未收到 viewer_joined 消息，请检查服务器连接');
    } else if (!window.receivedStreamStart) {
        console.log('   ⚠️ 主播可能未开始直播，请确保主播端已点击"开始直播"');
    } else if (!window.receivedOffer) {
        console.log('   ❌ 未收到 WebRTC offer，主播端可能有问题');
    } else {
        console.log('   ✅ 基础连接正常，可能是 WebRTC 协商问题');
    }
    
    console.log('4. 尝试修复:');
    console.log('   在控制台输入: forceReconnect()');
    console.log('=== 诊断完成 ===');
};

// 强制重新连接函数 - 用于调试
window.forceReconnect = function() {
    console.log('强制重新连接...');
    
    // 关闭现有连接
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // 重置视频元素
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo) {
        remoteVideo.srcObject = null;
        remoteVideo.style.display = 'none';
    }
    
    // 显示等待画面
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    if (videoPlaceholder) {
        videoPlaceholder.style.display = 'block';
    }
    
    // 隐藏播放按钮
    const playPrompt = document.getElementById('playPrompt');
    if (playPrompt) {
        playPrompt.style.display = 'none';
    }
    
    // 重新初始化连接
    setTimeout(() => {
        if (socket && isConnected) {
            socket.send(JSON.stringify({
                type: 'viewer_join',
                viewerId: viewerId,
                streamerId: targetStreamerId,
                userInfo: currentUser || { displayName: `观众${viewerId.substr(-3)}`, avatarUrl: null }
            }));
            console.log('已发送重新加入请求');
        }
    }, 1000);
    
    displaySystemMessage('🔄 正在重新连接...');
};

// 添加连接状态跟踪变量
let lastWebRTCWarningTime = 0;
let lastConnectionCheckTime = 0;

// 添加更详细的连接状态监控
setInterval(function() {
    if (socket) {
        const now = Date.now();
        
        // 只在需要时显示详细日志，避免刷屏
        if (now - lastConnectionCheckTime > 30000) { // 每30秒显示一次详细状态
            console.log(`🔍 连接状态检查 - WebSocket: ${socket.readyState}, WebRTC: ${peerConnection ? peerConnection.connectionState : '未建立'}`);
            lastConnectionCheckTime = now;
        }
        
        if (socket.readyState === WebSocket.OPEN && !isConnected) {
            console.log('⚠️ WebSocket 已连接但 isConnected 为 false，尝试重新加入');
            socket.send(JSON.stringify({
                type: 'viewer_join',
                viewerId: viewerId,
                streamerId: targetStreamerId,
                userInfo: currentUser || { displayName: `观众${viewerId.substr(-3)}`, avatarUrl: null }
            }));
        }
        
        // 检查是否收到过 viewer_joined 消息，但避免重复警告
        if (socket.readyState === WebSocket.OPEN && isConnected && !peerConnection) {
            // 只在第一次或每60秒警告一次
            if (now - lastWebRTCWarningTime > 60000) {
                console.log('🔍 WebSocket 已连接且 isConnected=true，但 WebRTC 未建立');
                console.log('   可能原因：1) 主播未开始直播 2) 主播端未发送 offer 3) 网络问题');
                lastWebRTCWarningTime = now;
                
                // 主动请求主播信息（只在警告时请求，避免重复请求）
                socket.send(JSON.stringify({
                    type: 'request_broadcaster_info',
                    viewerId: viewerId
                }));
            }
            
            // 如果已经收到 stream_start 但没有 WebRTC 连接，主动请求连接
            if (window.receivedStreamStart && now - lastWebRTCWarningTime < 10000) { // 只在最近10秒内警告过的情况下请求
                console.log('⚠️ 已收到 stream_start 但 WebRTC 未建立，主动请求连接');
                socket.send(JSON.stringify({
                    type: 'request_webrtc_connection',
                    viewerId: viewerId,
                    streamerId: targetStreamerId
                }));
            }
        }
    }
}, 5000); // 每5秒检查一次

// 添加页面可见性检测
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log('👁️ 页面变为可见，检查连接状态');
        if (socket && socket.readyState === WebSocket.OPEN) {
            console.log('✅ WebSocket 连接正常');
        } else {
            console.log('⚠️ WebSocket 连接异常，尝试重连');
            connectWebSocket();
        }
    }
});

// 确保 enableAutoplay 函数在全局作用域中可用
window.enableAutoplay = function() {
    const remoteVideo = document.getElementById('remoteVideo');
    const playPrompt = document.getElementById('playPrompt');
    
    console.log('用户点击播放按钮');
    
    if (remoteVideo && remoteVideo.srcObject) {
        console.log('尝试播放视频');
        
        // 确保视频不是静音的
        remoteVideo.muted = false;
        
        remoteVideo.play().then(() => {
            console.log('手动播放成功');
            if (playPrompt) playPrompt.style.display = 'none';
            // 显示成功消息
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                const messageElement = document.createElement('div');
                messageElement.className = 'chat-message';
                messageElement.innerHTML = `
                    <div class="message-avatar">
                        系
                    </div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-user">系统</span>
                            <span class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div class="message-text">🎬 视频已开始播放</div>
                    </div>
                `;
                chatMessages.appendChild(messageElement);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }).catch(error => {
            console.error('手动播放失败:', error);
            alert('播放失败，请检查浏览器设置');
        });
    } else {
        console.error('没有可播放的视频流');
        alert('没有可播放的视频流，请等待主播开始直播');
    }
};

console.log('✅ 观众端核心功能已加载完成');

