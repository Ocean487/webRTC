// VibeLo 观众端 JavaScript 功能
// 全局變數
let currentUser = null;
let socket = null;
let peerConnection = null;
let isConnected = false;
let viewerId = 'viewer_' + Math.random().toString(36).substr(2, 9);
let reconnectAttempts = 0;
let maxReconnectAttempts = 3;

// 獲取URL參數中的主播ID
function getStreamerIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('streamer') || 'default';
}

// 全局變數存儲主播ID
let targetStreamerId = getStreamerIdFromUrl();

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
    console.log('=== VibeLo 观众端初始化 ===');
    
    // 檢查 HTTPS 安全上下文
    if (location.protocol === 'https:') {
        console.log('✅ 運行在 HTTPS 安全上下文中');
        if (!window.isSecureContext) {
            console.warn('⚠️ 非安全上下文，WebRTC 功能可能受限');
            displaySystemMessage('⚠️ 檢測到安全上下文問題，部分功能可能受限');
        }
    } else {
        console.warn('⚠️ 運行在 HTTP 環境中，建議使用 HTTPS');
    }
    
    // 先載入用戶資訊
    await loadCurrentUser();
    console.log('🔍 [DEBUG] 載入用戶後的 currentUser:', currentUser);
    
    // 延遲初始化聊天系統，確保用戶信息已設置
    setTimeout(() => {
        initializeChatSystem();
    }, 100);
    
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
    console.log('觀看者頁面：檢查登入狀態');
    
    try {
        console.log('🔍 [DEBUG] 發送 API 請求到 /api/user');
        const response = await fetch('/api/user');
        console.log('🔍 [DEBUG] API 響應狀態:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('🔍 [DEBUG] API 響應數據:', data);
            
            if (data.success && data.user) {
                currentUser = data.user;
                updateUserDisplay(currentUser);
                console.log('✅ 檢測到已登入用戶:', currentUser.displayName);
                
                // 同步到 localStorage 以便其他功能使用
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                return;
            } else {
                console.log('❌ API 響應失敗或無用戶資料:', data);
            }
        } else {
            console.log('❌ API 請求失敗，狀態碼:', response.status);
        }
    } catch (error) {
        console.log('⚠️ 檢查登入狀態失敗，使用訪客模式:', error.message);
    }
    
    // 如果未登入或檢查失敗，使用訪客模式
    console.log('觀看者頁面：使用訪客模式');
    localStorage.removeItem('currentUser');
    showGuestMode();
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

// 手動檢查登入狀態（只在用戶主動請求時執行）
async function checkLoginStatusManually() {
    console.log('用戶主動檢查登入狀態');
    
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
                currentUser = data.user;
                updateUserDisplay(currentUser);
                console.log('檢測到已登入用戶:', currentUser.displayName);
                
                // 移除訪客選單
                const menu = document.querySelector('.user-dropdown');
                if (menu) menu.remove();
                
                // 顯示成功消息
                displaySystemMessage(`歡迎回來，${currentUser.displayName}！`);
                
                // 更新聊天系統的用戶信息
                if (window.chatSystem) {
                    window.chatSystem.updateUsername(currentUser.displayName);
                }
            } else {
                displaySystemMessage('未檢測到登入狀態，繼續以訪客模式觀看');
            }
        } else {
            displaySystemMessage('未登入，繼續以訪客模式觀看');
        }
    } catch (error) {
        console.error('檢查登入狀態失敗:', error);
        displaySystemMessage('無法檢查登入狀態，繼續以訪客模式觀看');
    }
}

// 初始化聊天系統
function initializeChatSystem() {
    console.log('[VIEWER] 初始化聊天系統');
    
    // 獲取用戶名稱
    let username = '訪客';
    if (currentUser && currentUser.displayName) {
        username = currentUser.displayName;
    } else if (currentUser && currentUser.isGuest) {
        username = currentUser.displayName;
    }
    
    // 創建聊天系統實例，使用觀看者頁面的HTML結構
    window.chatSystem = new ChatSystem({
        isStreamer: false,
        username: username,
        socket: socket,  // 使用觀看者的WebSocket連接
        selectors: {
            chatContainer: '#chatMessages',
            messageInput: '#chatInput',
            sendButton: '#sendButton'
        }
    });
    
    // 當WebSocket連接建立後，將其設置到聊天系統
    if (socket && socket.readyState === WebSocket.OPEN) {
        window.chatSystem.setSocket(socket);
    }
    
    console.log('[VIEWER] 聊天系統初始化完成，用戶名:', username);
}

// 連接 WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    console.log('🔗 嘗試連接 WebSocket:', wsUrl);
    console.log('🎯 目標主播ID:', targetStreamerId);
    console.log('👤 觀眾ID:', viewerId);
    
    // 清理之前的連接
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
    
    try {
    socket = new WebSocket(wsUrl);
        
        // 連接超時檢測
        const connectionTimeout = setTimeout(() => {
            if (socket.readyState === WebSocket.CONNECTING) {
                console.error('❌ WebSocket 連接超時');
                socket.close();
                displaySystemMessage('❌ 連接超時，正在重試...');
                setTimeout(connectWebSocket, 3000);
            }
        }, 10000);
    
    socket.onopen = function() {
            clearTimeout(connectionTimeout);
            console.log('✅ WebSocket 連接成功');
        isConnected = true;
        updateConnectionStatus();
            
            // 將 WebSocket 設置到聊天系統
            if (window.chatSystem) {
                window.chatSystem.setSocket(socket);
            }
            
            // 立即建立 WebRTC 連接
            initializePeerConnection();
            
            // 準備用戶信息
            const userInfo = currentUser && !currentUser.isGuest ? {
                displayName: currentUser.displayName,
                avatarUrl: currentUser.avatarUrl || null,
                isLoggedIn: true,
                isGuest: false
            } : { 
                displayName: `觀眾${viewerId.substr(-3)}`, 
                avatarUrl: null,
                isGuest: true
            };
            
            console.log('📤 發送觀眾加入消息:', {
                viewerId: viewerId,
                streamerId: targetStreamerId,
                userInfo: userInfo
            });
        
        // 作為觀眾加入
        socket.send(JSON.stringify({
            type: 'viewer_join',
            viewerId: viewerId,
            streamerId: targetStreamerId,
                userInfo: userInfo
        }));
        
            displaySystemMessage('✅ 已連接到服務器，正在加入直播間...');
    };
    
    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        // 強制調試所有消息
        console.log('🔍 [DEBUG] 觀眾端收到消息:', data.type, data);
        
        handleWebSocketMessage(data);
    };
    
        socket.onclose = function(event) {
            clearTimeout(connectionTimeout);
            console.log('🔌 WebSocket 連接關閉:', event.code, event.reason);
        isConnected = false;
        updateConnectionStatus();
            
            // 根據關閉原因決定是否重連
            if (event.code !== 1000) { // 非正常關閉
                displaySystemMessage('❌ 連接意外斷開，正在重新連接...');
        setTimeout(connectWebSocket, 3000);
            } else {
                displaySystemMessage('連接已關閉');
            }
    };
    
    socket.onerror = function(error) {
            clearTimeout(connectionTimeout);
            console.error('❌ WebSocket 錯誤:', error);
            console.error('   錯誤詳細:', {
                readyState: socket.readyState,
                url: socket.url,
                protocol: socket.protocol
            });
            
            displaySystemMessage('❌ 連接錯誤，請檢查網絡連接和服務器狀態');
            
            // 如果是連接錯誤，稍後重試
            if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.CLOSED) {
                setTimeout(connectWebSocket, 5000);
            }
        };
        
    } catch (error) {
        console.error('❌ 創建 WebSocket 連接失敗:', error);
        displaySystemMessage('❌ 無法建立連接，請檢查服務器狀態');
        setTimeout(connectWebSocket, 5000);
    }
}

// 處理 WebSocket 消息
function handleWebSocketMessage(data) {
    console.log('收到消息:', data);
    
    // 🎵 處理音樂流 관련消息
    if (data.type && data.type.startsWith('music_')) {
        if (window.musicStreamReconnectManager) {
            window.musicStreamReconnectManager.handleMusicStreamChange(data);
        }
    }
    
    // 🎵 處理分頁音訊相關消息
    if (data.type && data.type.startsWith('tab_audio')) {
        if (window.tabAudioReconnectManager) {
            window.tabAudioReconnectManager.handleTabAudioState(data.data || data);
        }
    }
    
    // 🎵 處理音訊流重連相關消息
    if (data.type && data.type.includes('audio')) {
        if (window.viewerAudioReconnectManager) {
            if (data.type === 'audio_stream_status') {
                window.viewerAudioReconnectManager.handleAudioStreamStatus(data);
            } else if (data.type === 'audio_track_update') {
                window.viewerAudioReconnectManager.handleTabAudioDetected(data);
            }
        }
    }
    
    switch(data.type) {
        case 'viewer_joined':
            window.receivedViewerJoined = true;
            console.log('✅ 收到 viewer_joined 消息:', data);
            displaySystemMessage('✅ 已成功加入直播間');
            updateConnectionStatus();
            
            // 處理分配的用戶信息
            if (data.userInfo) {
                console.log('👤 收到分配的用戶信息:', data.userInfo);
                // 只有在當前為訪客模式時才更新為 Ghost 用戶
                if (data.userInfo.isGuest && data.userInfo.displayName && (!currentUser || currentUser.isGuest)) {
                    console.log('🔄 更新為 Ghost 用戶:', data.userInfo.displayName);
                    currentUser = data.userInfo;
                    updateUserDisplay(currentUser);
                } else if (currentUser && !currentUser.isGuest) {
                    console.log('✅ 保持已登入用戶狀態，忽略 Ghost 分配');
                }
            }
            
            // 處理主播信息
            if (data.broadcasterInfo) {
                console.log('📺 收到主播信息:', data.broadcasterInfo);
                updateBroadcasterInfo(data.broadcasterInfo);
            } else {
                console.log('⏳ 主播信息為空，等待主播上線');
                displaySystemMessage('等待主播開始直播...');
            }
            
            // 請求建立WebRTC連接
            if (socket && socket.readyState === WebSocket.OPEN) {
                console.log('📡 請求建立 WebRTC 連接');
                socket.send(JSON.stringify({
                    type: 'request_webrtc_connection',
                    viewerId: viewerId,
                    streamerId: targetStreamerId
                }));
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
            console.log('🔍 [DEBUG] stream_start 數據:', data);
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
            console.log('✅ 收到確認:', data);
            break;
        case 'error':
            console.error('❌ 服務器錯誤:', data.message);
            displaySystemMessage('❌ 服務器錯誤: ' + (data.message || '未知錯誤'));
            break;
        case 'broadcaster_offline':
            console.log('📺 主播已離線');
            displaySystemMessage('📺 主播已離線，等待重新連接...');
            break;
        case 'connection_rejected':
            console.error('❌ 連接被拒絕:', data.reason);
            displaySystemMessage('❌ 連接被拒絕: ' + (data.reason || '未知原因'));
            break;
        case 'no_broadcaster':
            console.log('⏳ 沒有找到主播');
            displaySystemMessage('⏳ 主播尚未開始直播，請稍候...');
            break;
        case 'music_stream_state':
            // 處理音樂流狀態響應
            if (window.musicStreamReconnectManager) {
                window.musicStreamReconnectManager.handleMusicStreamState(data);
            }
            break;
        case 'tab_audio_state':
            // 處理分頁音訊狀態響應
            if (window.tabAudioReconnectManager) {
                window.tabAudioReconnectManager.handleTabAudioState(data);
            }
            break;
        case 'audio_stream_status':
            // 處理整合音訊流狀態響應
            if (window.musicStreamReconnectManager) {
                window.musicStreamReconnectManager.handleAudioStreamStatus(data);
            }
            // 同時調用簡化版處理器
            if (window.handleAudioStatusResponse) {
                window.handleAudioStatusResponse(data);
            }
            break;
        default:
            console.log('🔍 未知消息類型:', data.type, '內容:', data);
    }
}

// 處理直播開始
function handleStreamStarted(data) {
    console.log('🎬 [DEBUG] handleStreamStarted 被調用:', data);
    
    const streamVideo = document.getElementById('streamVideo');
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    const streamTitle = document.getElementById('streamTitle');
    const streamerName = document.getElementById('streamerName');
    const statusText = document.getElementById('statusText');
    
    console.log('🔍 [DEBUG] DOM元素檢查:');
    console.log('  - streamVideo:', !!streamVideo);
    console.log('  - videoPlaceholder:', !!videoPlaceholder);
    console.log('  - streamTitle:', !!streamTitle);
    console.log('  - streamerName:', !!streamerName);
    console.log('  - statusText:', !!statusText);
    
    // 添加 live 類別以顯示視頻
    if (streamVideo) {
        streamVideo.classList.add('live');
        console.log('✅ 已添加 live 類別到 stream-video');
    }
    
    if (videoPlaceholder) videoPlaceholder.style.display = 'none';
    
    // 更新主播名稱為直播狀態
    if (streamerName) {
        const broadcasterName = window.currentBroadcasterName || '主播';
        streamerName.textContent = `${broadcasterName} 正在直播`;
        console.log('✅ 已更新主播名稱:', streamerName.textContent);
    }
    
    // 更新狀態文字 - 使用已宣告的statusText變數
    if (statusText) {
        console.log('🔍 [DEBUG] statusText 元素存在，準備更新');
        console.log('🔍 [DEBUG] 更新前 - 文字內容:', statusText.textContent);
        console.log('🔍 [DEBUG] 更新前 - CSS類別:', statusText.className);
        
        statusText.textContent = '直播中';
        statusText.className = 'status-text live';
        
        // 強制覆蓋內聯樣式
        statusText.style.color = 'white';
        statusText.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
        statusText.style.fontWeight = '700';
        
        console.log('✅ 已更新狀態文字為直播中');
        console.log('🔍 [DEBUG] 更新後 - 文字內容:', statusText.textContent);
        console.log('🔍 [DEBUG] 更新後 - CSS類別:', statusText.className);
        
        // 檢查計算樣式
        const computedStyle = window.getComputedStyle(statusText);
        console.log('🔍 [DEBUG] 計算樣式 - 背景色:', computedStyle.backgroundColor);
        console.log('🔍 [DEBUG] 計算樣式 - 文字色:', computedStyle.color);
        console.log('🔍 [DEBUG] 計算樣式 - 字重:', computedStyle.fontWeight);
        console.log('🔍 [DEBUG] 計算樣式 - 顯示:', computedStyle.display);
    } else {
        console.error('❌ statusText 元素不存在！');
        console.log('🔍 [DEBUG] 嘗試重新查找 statusText 元素...');
        const retryStatusText = document.getElementById('statusText');
        if (retryStatusText) {
            console.log('✅ 重新查找成功，更新狀態');
            retryStatusText.textContent = '直播中';
            retryStatusText.className = 'status-text live';
            
            // 強制覆蓋內聯樣式
            retryStatusText.style.color = 'white';
            retryStatusText.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
            retryStatusText.style.fontWeight = '700';
        } else {
            console.error('❌ 重新查找也失敗，statusText 元素確實不存在');
        }
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
    
    // 強制修復狀態文字顯示
    setTimeout(() => {
        forceFixStatusText();
    }, 100);
    
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
            // displaySystemMessage(`📝 直播標題已更新: ${data.title}`);
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
    
    if (data.status === 'live') {
        // 直播進行中
        if (statusText) statusText.textContent = '直播中';
        if (videoPlaceholder) videoPlaceholder.style.display = 'none';
        
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
        statusText.style.color = 'white';
        statusText.className = 'status-text waiting';
    }
}

// 處理直播結束
function handleStreamEnded() {
    console.log('直播結束');
    
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    const remoteVideo = document.getElementById('remoteVideo');
    const playPrompt = document.getElementById('playPrompt');
    const streamTitle = document.getElementById('streamTitle');
    
    if (videoPlaceholder) videoPlaceholder.style.display = 'block';
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
                    // 多個 STUN 服務器提供冗餘 - Google 免費服務
            { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    
                    // 其他供應商的 STUN 服務器
                    { urls: 'stun:stun.services.mozilla.com' },
                    { urls: 'stun:stun.stunprotocol.org:3478' },
                    { urls: 'stun:stun.cloudflare.com:3478' },
                    { urls: 'stun:stun.nextcloud.com:443' },
                    
                    // OpenRelay 免費 TURN 服務器 - UDP
                    {
                        urls: 'turn:openrelay.metered.ca:80',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    {
                        urls: 'turn:openrelay.metered.ca:443',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    // OpenRelay 免費 TURN 服務器 - TCP（防火牆友好）
                    {
                        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    {
                        urls: 'turns:openrelay.metered.ca:443?transport=tcp',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    
                    // 備用免費 TURN 服務器
                    {
                        urls: 'turn:a.relay.metered.ca:80',
                        username: 'a6d6f890e1a6c2f20a0a4806',
                        credential: 'CGlPcFU3d2o5OCtSR2s='
                    },
                    {
                        urls: 'turn:a.relay.metered.ca:443',
                        username: 'a6d6f890e1a6c2f20a0a4806', 
                        credential: 'CGlPcFU3d2o5OCtSR2s='
                    }
                ],
                iceCandidatePoolSize: 32,           // 更大的候選池以處理複雜網路
                bundlePolicy: 'max-bundle',         // 最大化束結策略減少延遲
                rtcpMuxPolicy: 'require',           // 要求 RTCP 復用節省埠口
                iceTransportPolicy: 'all',          // 允許所有傳輸類型（UDP/TCP）
                
                // 額外的企業級配置
                enableDtlsSrtp: true,               // 啟用 DTLS-SRTP 加密
                
                // 針對嚴格 NAT 環境的優化
                sdpSemantics: 'unified-plan',       // 使用統一計劃 SDP
                
                // ICE 連接參數優化
                iceCheckingTimeout: 5000,           // ICE 檢查超時 5 秒
                iceDisconnectedTimeout: 20000,      // ICE 斷線超時 20 秒
                iceFailedTimeout: 30000,            // ICE 失敗超時 30 秒
                iceRestartTimeout: 20000,           // ICE 重啟超時 20 秒
                
                // 強制使用 IPv4（避免 IPv6 問題）
                iceTransportPolicy: 'all',
                iceCandidatePoolSize: 32
    };
    
    peerConnection = new RTCPeerConnection(configuration);
    
    // 檢查接收端編解碼器能力
    if (window.RTCRtpReceiver && RTCRtpReceiver.getCapabilities) {
        const videoCapabilities = RTCRtpReceiver.getCapabilities('video');
        if (videoCapabilities && videoCapabilities.codecs) {
            console.log('🎥 [接收端] 支援的視頻解碼器:');
            videoCapabilities.codecs.forEach(codec => {
                console.log(`  ${codec.mimeType} - ${codec.clockRate || 'N/A'}Hz`);
            });
            
            // 檢查關鍵編解碼器支援
            const hasH264 = videoCapabilities.codecs.some(c => c.mimeType.includes('H264'));
            const hasVP8 = videoCapabilities.codecs.some(c => c.mimeType.includes('VP8'));
            const hasVP9 = videoCapabilities.codecs.some(c => c.mimeType.includes('VP9'));
            
            console.log('🎯 [解碼支援] H264:', hasH264, '| VP8:', hasVP8, '| VP9:', hasVP9);
            
            if (!hasH264 && !hasVP8 && !hasVP9) {
                console.error('❌ 瀏覽器不支援常見的視頻解碼器');
                displaySystemMessage('❌ 瀏覽器不支援視頻解碼，請更新瀏覽器');
            } else {
                console.log('✅ 瀏覽器支援視頻解碼');
            }
        }
    }
    
    peerConnection.ontrack = function(event) {
        console.log('收到遠程視頻流', event);
        console.log('🎬 軌道詳情:', {
            kind: event.track.kind,
            id: event.track.id,
            label: event.track.label,
            readyState: event.track.readyState,
            enabled: event.track.enabled
        });
        
        const remoteVideo = document.getElementById('remoteVideo');
        const videoPlaceholder = document.getElementById('videoPlaceholder');
        const playPrompt = document.getElementById('playPrompt');
        
        if (remoteVideo && event.streams && event.streams[0]) {
            const stream = event.streams[0];
            console.log('📺 設置視頻流到 video 元素');
            console.log('🔍 流詳情:', {
                id: stream.id,
                active: stream.active,
                videoTracks: stream.getVideoTracks().length,
                audioTracks: stream.getAudioTracks().length
            });
            
            // 檢查視頻軌道詳情
            const videoTracks = stream.getVideoTracks();
            if (videoTracks.length > 0) {
                const videoTrack = videoTracks[0];
                console.log('🎥 視頻軌道詳情:', {
                    kind: videoTrack.kind,
                    id: videoTrack.id,
                    label: videoTrack.label,
                    readyState: videoTrack.readyState,
                    enabled: videoTrack.enabled,
                    muted: videoTrack.muted
                });
                
                // 獲取視頻軌道設定
                const settings = videoTrack.getSettings();
                if (settings) {
                    console.log('⚙️ 視頻設定:', settings);
                }
            } else {
                console.warn('⚠️ 沒有視頻軌道在流中');
            }
            
            remoteVideo.srcObject = stream;
            
            // 確保視頻元素顯示
            remoteVideo.style.display = 'block';
            if (videoPlaceholder) videoPlaceholder.style.display = 'none';
            
            // 監聽視頻元素的事件
            remoteVideo.onloadedmetadata = function() {
                console.log('✅ 視頻元數據已載入');
                console.log('📏 視頻尺寸:', remoteVideo.videoWidth, 'x', remoteVideo.videoHeight);
                console.log('⏱️ 視頻時長:', remoteVideo.duration);
                
                if (remoteVideo.videoWidth === 0 || remoteVideo.videoHeight === 0) {
                    console.warn('⚠️ 視頻尺寸為 0，可能是解碼問題');
                    displaySystemMessage('⚠️ 視頻解碼異常，正在重試...');
                } else {
                    // displaySystemMessage('✅ 視頻元數據已載入');
                }
            };
            
            remoteVideo.onloadeddata = function() {
                console.log('✅ 視頻數據已載入，準備播放');
                // displaySystemMessage('🎬 視頻數據已載入');
            };
            
            remoteVideo.oncanplay = function() {
                console.log('✅ 視頻可以開始播放');
                // displaySystemMessage('▶️ 視頻準備就緒');
            };
            
            remoteVideo.onplay = function() {
                console.log('✅ 視頻開始播放');
                // displaySystemMessage('🎬 視頻播放開始');
                if (playPrompt) playPrompt.style.display = 'none';
            };
            
            remoteVideo.onwaiting = function() {
                console.log('⏳ 視頻等待數據');
                // displaySystemMessage('⏳ 等待視頻數據...');
            };
            
            remoteVideo.onstalled = function() {
                console.warn('⚠️ 視頻播放停滯');
                // displaySystemMessage('⚠️ 視頻播放停滯，檢查網路連接');
            };
            
            remoteVideo.onerror = function(error) {
                console.error('❌ 視頻播放錯誤:', error);
                console.error('❌ 視頻錯誤詳情:', {
                    error: remoteVideo.error,
                    code: remoteVideo.error ? remoteVideo.error.code : 'unknown',
                    message: remoteVideo.error ? remoteVideo.error.message : 'unknown'
                });
                
                let errorMessage = '視頻播放錯誤';
                if (remoteVideo.error) {
                    switch (remoteVideo.error.code) {
                        case 1: errorMessage = '視頻載入中止'; break;
                        case 2: errorMessage = '網路錯誤'; break;
                        case 3: errorMessage = '視頻解碼錯誤'; break;
                        case 4: errorMessage = '不支援的視頻格式'; break;
                        default: errorMessage = '未知視頻錯誤';
                    }
                }
                
                displaySystemMessage('❌ ' + errorMessage + '，請重新整理頁面');
            };
            
            // 強制自動播放 - 多種策略
            const tryAutoPlay = async () => {
                try {
                    // 策略1: 嘗試靜音播放
                    remoteVideo.muted = true;
                    await remoteVideo.play();
                    console.log('✅ 靜音自動播放成功');
                    
                    // 延遲後嘗試取消靜音
                    setTimeout(async () => {
                        try {
                            // 檢查瀏覽器是否允許自動取消靜音
                            if (remoteVideo.muted) {
                                // 嘗試播放以觸發用戶互動檢查
                                await remoteVideo.play();
                                remoteVideo.muted = false;
                                console.log('✅ 已取消靜音');
                            }
                        } catch (unmuteError) {
                            console.warn('⚠️ 取消靜音失敗，保持靜音模式:', unmuteError.message);
                            // 顯示提示用戶點擊取消靜音
                            displaySystemMessage('🔊 請點擊視頻取消靜音以聽到聲音');
                            // 啟用用戶互動處理
                            enableAudioOnUserInteraction();
                        }
                    }, 1000);
                    
                // displaySystemMessage('🎬 視頻已開始播放');
                    return true;
                } catch (error1) {
                    console.log('策略1失敗，嘗試策略2:', error1);
                    
                    try {
                        // 策略2: 強制播放（保持靜音）
                        remoteVideo.muted = true;
                        remoteVideo.autoplay = true;
                        remoteVideo.setAttribute('autoplay', '');
                        remoteVideo.setAttribute('muted', '');
                        await remoteVideo.play();
                        console.log('✅ 強制靜音播放成功');
                        // displaySystemMessage('🎬 視頻已開始播放（靜音模式）');
                        return true;
                    } catch (error2) {
                        console.log('策略2失敗，嘗試策略3:', error2);
                        
                        try {
                            // 策略3: 使用 requestAnimationFrame
                            await new Promise((resolve, reject) => {
                                requestAnimationFrame(async () => {
                                    try {
                                        remoteVideo.muted = true;
                                        await remoteVideo.play();
                                        resolve();
                                    } catch (e) {
                                        reject(e);
                                    }
                                });
                            });
                            console.log('✅ RAF 策略播放成功');
                            // displaySystemMessage('🎬 視頻已開始播放');
                            return true;
                        } catch (error3) {
                            console.log('所有自動播放策略都失敗:', error3);
                            // 不顯示播放按鈕，而是自動重試
                            setTimeout(tryAutoPlay, 2000);
                            displaySystemMessage('🔄 正在嘗試自動播放...');
                            return false;
                        }
                    }
                }
            };
            
            tryAutoPlay();
        } else {
            console.error('未收到有效的視頻流');
        }
    };
    
    peerConnection.onicecandidate = function(event) {
        if (event.candidate && socket && isConnected) {
            console.log('🎯 觀眾發送 ICE 候選給主播:', event.candidate.type);
            socket.send(JSON.stringify({
                type: 'ice_candidate',
                candidate: event.candidate,
                viewerId: viewerId,
                streamerId: targetStreamerId  // 添加目標主播ID
            }));
        } else if (!event.candidate) {
            console.log('✅ 觀眾 ICE 候選收集完成');
        }
    };
    
    peerConnection.onconnectionstatechange = function() {
        console.log('WebRTC 連接狀態變更:', peerConnection.connectionState);
        updateConnectionStatus();
        
        if (peerConnection.connectionState === 'connected') {
            console.log('✅ WebRTC 連接已建立');
            // displaySystemMessage('🎬 視頻串流已連接');
            // 重置重試計數器
            reconnectAttempts = 0;
        } else if (peerConnection.connectionState === 'connecting') {
            console.log('🔄 WebRTC 正在連接...');
            // displaySystemMessage('🔄 正在建立視頻連接...');
        } else if (peerConnection.connectionState === 'disconnected') {
            console.log('⚠️ WebRTC 連接已斷開');
            // displaySystemMessage('⚠️ 視頻串流已斷開');
        } else if (peerConnection.connectionState === 'failed') {
            console.error('❌ WebRTC 連接失敗');
            // displaySystemMessage('❌ 視頻連接失敗，正在重試...');
            
            // 嘗試重新建立連接（有限次數）
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                setTimeout(() => {
                    console.log(`🔄 嘗試重新建立 WebRTC 連接 (${reconnectAttempts}/${maxReconnectAttempts})`);
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        // 清理舊的連接
                        if (peerConnection) {
                            peerConnection.close();
                        }
                        
                        // 重新初始化 PeerConnection
                        initializePeerConnection();
                        
                        // 重新發送加入請求
                        socket.send(JSON.stringify({
                            type: 'viewer_join',
                            viewerId: viewerId,
                            streamerId: targetStreamerId,
                            userInfo: currentUser && !currentUser.isGuest ? {
                                displayName: currentUser.displayName,
                                avatarUrl: currentUser.avatarUrl || null,
                                isLoggedIn: true,
                                isGuest: false
                            } : { displayName: `觀眾${viewerId.substr(-3)}`, avatarUrl: null, isGuest: true }
                        }));
                        
                        displaySystemMessage(`🔄 正在重新連接... (${reconnectAttempts}/${maxReconnectAttempts})`);
                    }
                }, 3000); // 3秒後重試
            } else {
                console.error('❌ 已達到最大重連次數');
                displaySystemMessage('❌ 連接失敗次數過多，請重新整理頁面');
            }
        }
    };
    
    // 添加 ICE 連接狀態監聽
    peerConnection.oniceconnectionstatechange = function() {
        console.log('ICE 連接狀態變更:', peerConnection.iceConnectionState);
        
        if (peerConnection.iceConnectionState === 'connected' || 
            peerConnection.iceConnectionState === 'completed') {
            console.log('✅ ICE 連接成功');
        } else if (peerConnection.iceConnectionState === 'failed') {
            console.error('❌ ICE 連接失敗');
            displaySystemMessage('❌ 網路連接失敗，正在嘗試重連...');
            
            // ICE 重啟嘗試
            setTimeout(() => {
                if (peerConnection && peerConnection.iceConnectionState === 'failed') {
                    console.log('🔄 嘗試 ICE 重啟');
                    try {
                        peerConnection.restartIce();
                        displaySystemMessage('🔄 正在重啟網路連接...');
                    } catch (error) {
                        console.error('ICE 重啟失敗:', error);
                        displaySystemMessage('❌ 網路重連失敗，請重新整理頁面');
                    }
                }
            }, 2000);
        } else if (peerConnection.iceConnectionState === 'disconnected') {
            console.warn('⚠️ ICE 連接斷開');
            displaySystemMessage('⚠️ 網路連接不穩定');
        }
    };
    
    // 添加 ICE 候選處理 - 增強 NAT 診斷
    peerConnection.onicecandidate = function(event) {
        if (event.candidate) {
            const candidate = event.candidate;
            console.log('🎯 觀眾生成 ICE 候選:', {
                type: candidate.type,
                protocol: candidate.protocol,
                address: candidate.address,
                port: candidate.port,
                priority: candidate.priority,
                candidate: candidate.candidate.substring(0, 50) + '...'
            });
            
            // 分析候選類型以判斷 NAT 穿透狀況
            if (candidate.type === 'host') {
                console.log('✅ 本地候選 (直連可能)');
                // displaySystemMessage('🌐 偵測到直連網路環境');
            } else if (candidate.type === 'srflx') {
                console.log('🔄 伺服器反射候選 (STUN 通過 NAT)');
                // displaySystemMessage('🔄 正在通過 NAT 建立連接...');
            } else if (candidate.type === 'relay') {
                console.log('🔀 中繼候選 (TURN 伺服器)');
                // displaySystemMessage('🔀 使用中繼伺服器，網路環境較複雜');
            } else if (candidate.type === 'prflx') {
                console.log('🎭 對等反射候選');
            }
            
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'ice_candidate',
                    candidate: event.candidate,
                    viewerId: viewerId,
                    streamerId: targetStreamerId
                }));
            }
        } else {
            console.log('✅ 觀眾 ICE 候選收集完成');
            
            // 檢查收集到的候選類型
            setTimeout(() => {
                if (peerConnection) {
                    peerConnection.getStats().then(stats => {
                        let hostCount = 0, srflxCount = 0, relayCount = 0;
                        stats.forEach(report => {
                            if (report.type === 'local-candidate') {
                                if (report.candidateType === 'host') hostCount++;
                                else if (report.candidateType === 'srflx') srflxCount++;
                                else if (report.candidateType === 'relay') relayCount++;
                            }
                        });
                        
                        console.log(`📊 候選統計 - 本地:${hostCount}, STUN:${srflxCount}, TURN:${relayCount}`);
                        
                        if (hostCount > 0) {
                            // displaySystemMessage('✅ 網路環境良好，支援直連');
                        } else if (srflxCount > 0) {
                            // displaySystemMessage('🔄 透過 NAT 環境連接');
                        } else if (relayCount > 0) {
                            // displaySystemMessage('🔀 使用中繼連接，可能較慢');
                        } else {
                            // displaySystemMessage('⚠️ 網路連接受限，請檢查防火牆');
                        }
                    }).catch(err => console.error('無法獲取統計:', err));
                }
            }, 1000);
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
            console.log('📤 觀眾發送 WebRTC Answer 給主播');
            socket.send(JSON.stringify({
                type: 'answer',
                answer: answer,
                viewerId: viewerId,
                streamerId: targetStreamerId  // 添加目標主播ID
            }));
            
            // displaySystemMessage('✅ 已回應主播連接請求');
        }
    } catch (error) {
        console.error('處理 offer 失敗:', error);
        // displaySystemMessage('視頻連接失敗，請刷新頁面重試');
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
        statusText.textContent = '直播中';
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
    
    // 如果是訪客模式，直接跳轉到登入頁面
    if (!currentUser || currentUser.isGuest) {
        console.log('訪客點擊頭像，跳轉到登入頁面');
        window.location.href = 'login.html';
        return;
    }
    
    // 已登入用戶顯示下拉選單
    console.log('已登入用戶點擊頭像，顯示下拉選單');
    
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
    
    const currentUserName = getCurrentUserName() || '觀眾';
    
    // 創建下拉選單 - 已登入觀眾版本
    const menu = document.createElement('div');
    menu.className = 'user-dropdown';
    menu.style.opacity = '0';
    menu.style.transform = 'translateY(-10px)';
    menu.style.transition = 'all 0.15s ease-out';
    
    menu.innerHTML = `
        <div class="menu-user-info">
            <div class="menu-user-name">${currentUserName}</div>
        </div>
        <a href="index.html" class="menu-link">
            <i class="fas fa-home"></i>
            首頁
        </a>
        <a href="browse.html" class="menu-link">
            <i class="fas fa-eye"></i>
            瀏覽直播
        </a>
        <a href="livestream_platform.html" class="menu-link">
            <i class="fas fa-video"></i>
            開始直播
        </a>
        <a href="about.html" class="menu-link">
            <i class="fas fa-info-circle"></i>
            關於平台
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
                userInfo: currentUser && !currentUser.isGuest ? {
                    displayName: currentUser.displayName,
                    avatarUrl: currentUser.avatarUrl || null,
                    isLoggedIn: true,
                    isGuest: false
                } : { displayName: `观众${viewerId.substr(-3)}`, avatarUrl: null, isGuest: true }
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
                userInfo: currentUser && !currentUser.isGuest ? {
                    displayName: currentUser.displayName,
                    avatarUrl: currentUser.avatarUrl || null,
                    isLoggedIn: true,
                    isGuest: false
                } : { displayName: `观众${viewerId.substr(-3)}`, avatarUrl: null, isGuest: true }
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

// 請求直播流
window.requestStream = function() {
    console.log('🎯 手動請求直播流');
    
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        displaySystemMessage('❌ WebSocket 未連接，請重新整理頁面');
        return;
    }
    
    // 重置重試計數器（手動請求時）
    reconnectAttempts = 0;
    
    // 發送觀看者加入請求
    const joinMessage = {
        type: 'viewer_join',
        viewerId: viewerId,
        streamerId: targetStreamerId,
        userInfo: currentUser && !currentUser.isGuest ? {
            displayName: currentUser.displayName,
            avatarUrl: currentUser.avatarUrl || null,
            isLoggedIn: true,
            isGuest: false
        } : { displayName: `觀眾${viewerId.substr(-3)}`, avatarUrl: null, isGuest: true },
        timestamp: Date.now()
    };
    
    console.log('發送觀看者加入請求:', joinMessage);
    socket.send(JSON.stringify(joinMessage));
    
    // 發送請求直播流消息
    const requestMessage = {
        type: 'request_stream',
        viewerId: viewerId,
        streamerId: targetStreamerId,
        timestamp: Date.now()
    };
    
    console.log('發送請求直播流消息:', requestMessage);
    socket.send(JSON.stringify(requestMessage));
    
    displaySystemMessage('📡 已發送直播請求，等待主播回應...');
    
    // 重置 WebRTC 連接
    if (peerConnection) {
        peerConnection.close();
    }
    initializePeerConnection();
};

// 網路品質檢測功能
function checkNetworkQuality() {
    console.log('🔍 開始網路品質檢測...');
    
    if (!peerConnection || peerConnection.connectionState !== 'connected') {
        console.log('⚠️ WebRTC 未連接，無法檢測品質');
        return;
    }
    
    peerConnection.getStats().then(stats => {
        let inboundRTP = null;
        let candidatePair = null;
        
        stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
                inboundRTP = report;
            } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                candidatePair = report;
            }
        });
        
        if (inboundRTP) {
            const bitrate = inboundRTP.bytesReceived * 8 / 1000; // kbps
            const packetsLost = inboundRTP.packetsLost || 0;
            const packetsReceived = inboundRTP.packetsReceived || 0;
            const lossRate = packetsReceived > 0 ? (packetsLost / packetsReceived * 100).toFixed(2) : 0;
            
            console.log('📊 視頻品質統計:', {
                bitrate: `${bitrate.toFixed(0)} kbps`,
                packetsLost: packetsLost,
                packetsReceived: packetsReceived,
                lossRate: `${lossRate}%`,
                framesDropped: inboundRTP.framesDropped || 0,
                framesReceived: inboundRTP.framesReceived || 0
            });
            
            // 評估網路品質
            if (lossRate > 5) {
                displaySystemMessage('⚠️ 網路品質不佳，可能因為 NAT/防火牆限制');
            } else if (lossRate > 2) {
                displaySystemMessage('🔄 網路品質一般，建議檢查網路設置');
            } else {
                displaySystemMessage('✅ 網路品質良好');
            }
        }
        
        if (candidatePair) {
            console.log('🔗 連接路徑:', {
                localCandidateType: candidatePair.localCandidateType || 'unknown',
                remoteCandidateType: candidatePair.remoteCandidateType || 'unknown',
                currentRoundTripTime: candidatePair.currentRoundTripTime || 'unknown',
                availableOutgoingBitrate: candidatePair.availableOutgoingBitrate || 'unknown'
            });
            
            // 根據候選類型提供建議
            if (candidatePair.localCandidateType === 'relay' || candidatePair.remoteCandidateType === 'relay') {
                console.log('📡 使用 TURN 中繼，這表示 NAT/防火牆較嚴格');
                displaySystemMessage('🔀 透過中繼伺服器連接，如需更好品質請調整網路設置');
            }
        }
        
    }).catch(err => {
        console.error('網路品質檢測失敗:', err);
    });
}

// 調試連接狀態
window.debugConnection = function() {
    console.log('🔧 === 觀看者連接調試信息 ===');
    
    // 基本連接狀態
    console.log('1. 基本狀態:');
    console.log('   - WebSocket 狀態:', socket ? socket.readyState : '未創建');
    console.log('   - WebSocket URL:', socket ? socket.url : 'N/A');
    console.log('   - 是否已連接 (isConnected):', isConnected);
    console.log('   - 觀看者ID:', viewerId);
    console.log('   - 目標主播ID:', targetStreamerId);
    console.log('   - 當前用戶:', currentUser ? currentUser.displayName : '訪客');
    
    // WebRTC 狀態
    console.log('\n2. WebRTC 狀態:');
    if (peerConnection) {
        console.log('   - PeerConnection 狀態:', peerConnection.connectionState);
        console.log('   - ICE 連接狀態:', peerConnection.iceConnectionState);
        console.log('   - ICE 收集狀態:', peerConnection.iceGatheringState);
        console.log('   - 信令狀態:', peerConnection.signalingState);
    } else {
        console.log('   - PeerConnection: 未創建');
    }
    
    // 視頻元素狀態
    const remoteVideo = document.getElementById('remoteVideo');
    console.log('\n3. 視頻元素狀態:');
    if (remoteVideo) {
        console.log('   - 視頻元素存在: 是');
        console.log('   - 視頻流:', remoteVideo.srcObject ? '已接收' : '未接收');
        console.log('   - 視頻顯示狀態:', remoteVideo.style.display);
        console.log('   - 視頻準備狀態:', remoteVideo.readyState);
        console.log('   - 視頻是否暫停:', remoteVideo.paused);
        console.log('   - 視頻是否靜音:', remoteVideo.muted);
        
        if (remoteVideo.srcObject) {
            const stream = remoteVideo.srcObject;
            console.log('   - 視頻軌道數:', stream.getVideoTracks().length);
            console.log('   - 音頻軌道數:', stream.getAudioTracks().length);
            
            if (remoteVideo.videoWidth && remoteVideo.videoHeight) {
                console.log('   - 視頻尺寸:', `${remoteVideo.videoWidth}x${remoteVideo.videoHeight}`);
            }
        }
    } else {
        console.log('   - 視頻元素存在: 否');
    }
    
    // 聊天系統狀態
    console.log('\n4. 聊天系統狀態:');
    if (window.chatSystem) {
        console.log('   - 聊天系統: 已初始化');
        console.log('   - 聊天用戶名:', window.chatSystem.username);
        console.log('   - 聊天連接狀態:', window.chatSystem.isConnected);
    } else {
        console.log('   - 聊天系統: 未初始化');
    }
    
    // 收到的消息記錄
    console.log('\n5. 消息接收記錄:');
    console.log('   - 收到 viewer_joined:', window.receivedViewerJoined ? '是' : '否');
    console.log('   - 收到 stream_start:', window.receivedStreamStart ? '是' : '否');
    console.log('   - 收到 WebRTC offer:', window.receivedOffer ? '是' : '否');
    console.log('   - 收到 ICE candidate:', window.receivedIceCandidate ? '是' : '否');
    
    // 建議操作
    console.log('\n6. 診斷建議:');
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.log('   ❌ WebSocket 未連接，請重新整理頁面');
    } else if (!isConnected) {
        console.log('   ⚠️ WebSocket 已連接但未收到確認，檢查服務器狀態');
    } else if (!window.receivedStreamStart) {
        console.log('   ⚠️ 主播可能未開始直播，請確認主播端狀態');
    } else if (!window.receivedOffer) {
        console.log('   ❌ 未收到 WebRTC offer，主播端可能有問題');
    } else if (!peerConnection) {
        console.log('   ❌ WebRTC 連接未建立，嘗試重新連接');
    } else if (peerConnection.connectionState !== 'connected') {
        console.log('   ⚠️ WebRTC 連接狀態異常:', peerConnection.connectionState);
    } else if (!remoteVideo || !remoteVideo.srcObject) {
        console.log('   ❌ 未接收到視頻流，檢查主播攝像頭權限');
    } else {
        console.log('   ✅ 所有連接正常，如果仍無畫面請檢查瀏覽器設置');
    }
    
    // 檢查編解碼器兼容性
    console.log('\n7. 編解碼器兼容性:');
    if (window.RTCRtpReceiver && RTCRtpReceiver.getCapabilities) {
        const videoCapabilities = RTCRtpReceiver.getCapabilities('video');
        if (videoCapabilities && videoCapabilities.codecs) {
            const supportedCodecs = videoCapabilities.codecs.map(c => c.mimeType).join(', ');
            console.log('   - 支援的解碼器:', supportedCodecs);
            
            const hasH264 = videoCapabilities.codecs.some(c => c.mimeType.includes('H264'));
            const hasVP8 = videoCapabilities.codecs.some(c => c.mimeType.includes('VP8'));
            const hasVP9 = videoCapabilities.codecs.some(c => c.mimeType.includes('VP9'));
            
            console.log('   - H.264 支援:', hasH264 ? '✅' : '❌');
            console.log('   - VP8 支援:', hasVP8 ? '✅' : '❌');
            console.log('   - VP9 支援:', hasVP9 ? '✅' : '❌');
            
            if (!hasH264 && !hasVP8 && !hasVP9) {
                console.error('   ❌ 缺乏主要編解碼器支援！');
            }
        }
    }
    
    // 執行網路品質檢測
    if (peerConnection && peerConnection.connectionState === 'connected') {
        console.log('\n8. 網路品質檢測:');
        checkNetworkQuality();
    }
    
    console.log('\n=== 調試信息結束 ===');
    
    // 在聊天中顯示簡要狀態
    let status = '🔧 連接狀態：';
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        status += 'WebSocket 未連接';
    } else if (!isConnected) {
        status += 'WebSocket 已連接，等待確認';
    } else if (!window.receivedStreamStart) {
        status += '已連接，等待主播開始直播';
    } else if (!peerConnection || peerConnection.connectionState !== 'connected') {
        status += '正在建立視頻連接...';
    } else if (!remoteVideo || !remoteVideo.srcObject) {
        status += '視頻連接已建立，等待視頻流';
    } else {
        status += '一切正常！';
    }
    
    displaySystemMessage(status);
};

// 強制修復狀態文字顯示
function forceFixStatusText() {
    console.log('🔧 強制修復狀態文字顯示');
    
    // 重新獲取元素確保正確性
    const statusText = document.getElementById('statusText');
    if (statusText) {
        console.log('🔍 找到 statusText 元素');
        console.log('🔍 當前文字內容:', statusText.textContent);
        console.log('🔍 當前類別:', statusText.className);
        
        // 強制設置文字內容和樣式
        statusText.textContent = '直播中';
        statusText.className = 'status-text live';
        statusText.style.color = 'white';
        statusText.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
        statusText.style.fontWeight = '700';
        
        console.log('✅ 強制修復完成');
        console.log('🔍 修復後文字內容:', statusText.textContent);
        console.log('🔍 修復後類別:', statusText.className);
        
        return true;
    } else {
        console.error('❌ 找不到 statusText 元素');
        return false;
    }
}

// 處理用戶互動以啟用音頻
function enableAudioOnUserInteraction() {
    const remoteVideo = document.getElementById('remoteVideo');
    if (!remoteVideo) return;
    
    // 添加點擊事件監聽器
    const enableAudio = async () => {
        try {
            if (remoteVideo.muted) {
                remoteVideo.muted = false;
                console.log('✅ 用戶互動後成功取消靜音');
                displaySystemMessage('🔊 音頻已啟用');
                
                // 移除事件監聽器
                remoteVideo.removeEventListener('click', enableAudio);
                document.removeEventListener('click', enableAudio);
                document.removeEventListener('keydown', enableAudio);
            }
        } catch (error) {
            console.warn('⚠️ 用戶互動後取消靜音失敗:', error);
        }
    };
    
    // 添加多種用戶互動事件
    remoteVideo.addEventListener('click', enableAudio);
    document.addEventListener('click', enableAudio);
    document.addEventListener('keydown', enableAudio);
    
    // 顯示提示
    displaySystemMessage('🔊 點擊任意位置啟用音頻');
}

console.log('✅ 观众端核心功能已加载完成');

