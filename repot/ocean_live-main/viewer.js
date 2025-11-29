// 全局變數
let socket = null;
let peerConnection = null;
let isConnected = false;
let viewerId = 'viewer_' + Math.random().toString(36).substr(2, 9);
        
// 獲取broadcasterId（用於獨立聊天室）
const urlParams = new URLSearchParams(window.location.search);
const currentBroadcasterId = urlParams.get('broadcasterId') || 
                                   urlParams.get('broadcaster') || 
                                   'global';
        
// 設置全局變數供聊天系統使用
window.currentBroadcasterId = currentBroadcasterId;
        
console.log('觀眾加入聊天室:', currentBroadcasterId);

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
    await window.checkAuth(); // 使用 common.js 中的 checkAuth
    window.updateUserDisplay(window.currentUser); // 使用 common.js 中的 updateUserDisplay
    connectWebSocket();
    setupEventListeners();
    setupMobileMenu();
            
    // 顯示歡迎消息
    displaySystemMessage('歡迎來到直播間！等待主播開始直播...');
});

// 診斷函數 - 檢查觀眾端接收狀態
function diagnoseViewerIssue() {
    console.log('=== 觀眾端診斷 ===');
    console.log('1. WebSocket連接狀態:', socket ? socket.readyState : '未建立');
    console.log('2. WebRTC連接狀態:', peerConnection ? peerConnection.connectionState : '未建立');
            
    const remoteVideo = document.getElementById('remoteVideo');
    console.log('3. 遠程視頻元素:', remoteVideo ? '存在' : '不存在');
    console.log('4. 視頻流狀態:', remoteVideo && remoteVideo.srcObject ? '已接收' : '未接收');
    console.log('5. 視頻元素顯示:', remoteVideo ? remoteVideo.style.display : 'N/A');
    console.log('6. 視頻是否準備好:', remoteVideo ? remoteVideo.readyState : 'N/A');
    console.log('7. 視頻是否暫停:', remoteVideo ? remoteVideo.paused : 'N/A');
    console.log('8. 視頻是否靜音:', remoteVideo ? remoteVideo.muted : 'N/A');
    console.log('9. 連接狀態:', isConnected ? '已連接' : '未連接');
    console.log('10. 觀眾ID:', viewerId);
            
    if (remoteVideo && remoteVideo.srcObject) {
        const stream = remoteVideo.srcObject;
        console.log('11. 視頻軌道數量:', stream.getVideoTracks().length);
        console.log('12. 音頻軌道數量:', stream.getAudioTracks().length);
                
        stream.getVideoTracks().forEach((track, index) => {
            console.log(`    視頻軌道 ${index}:`, {
                readyState: track.readyState,
                enabled: track.enabled,
                muted: track.muted,
                label: track.label
            });
        });
                
        stream.getAudioTracks().forEach((track, index) => {
            console.log(`    音頻軌道 ${index}:`, {
                readyState: track.readyState,
                enabled: track.enabled,
                muted: track.muted,
                label: track.label
            });
        });
                
        // 檢查視頻尺寸
        if (remoteVideo.videoWidth && remoteVideo.videoHeight) {
            console.log('13. 視頻尺寸:', `${remoteVideo.videoWidth}x${remoteVideo.videoHeight}`);
        } else {
            console.log('13. 視頻尺寸: 未知或未載入');
        }
    }
            
    // 檢查 WebRTC 連接詳細狀態
    if (peerConnection) {
        console.log('14. WebRTC 詳細狀態:', {
            connectionState: peerConnection.connectionState,
            iceConnectionState: peerConnection.iceConnectionState,
            iceGatheringState: peerConnection.iceGatheringState,
            signalingState: peerConnection.signalingState
        });
    }
            
    // 檢查頁面元素狀態
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    const playPrompt = document.getElementById('playPrompt');
    console.log('15. videoPlaceholder 顯示:', videoPlaceholder ? videoPlaceholder.style.display : 'N/A');
    console.log('16. playPrompt 顯示:', playPrompt ? playPrompt.style.display : 'N/A');
            
    console.log('=== 觀眾端診斷完成 ===');
            
    // 提供修復建議
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn('建議: WebSocket連接有問題，請重新整理頁面');
    }
            
    if (!peerConnection) {
        console.warn('建議: WebRTC連接未建立，請等待主播開始直播');
    }
            
    if (remoteVideo && remoteVideo.srcObject && remoteVideo.paused) {
        console.warn('建議: 視頻已接收但暫停，請點擊播放按鈕');
    }
            
    if (remoteVideo && !remoteVideo.srcObject) {
        console.warn('建議: 未接收到視頻流，請檢查主播是否正在直播');
    }
}

// 在控制台中可以調用 diagnoseViewerIssue() 來診斷問題
window.diagnoseViewerIssue = diagnoseViewerIssue;

// 強制重新連接函數 - 用於調試
function forceReconnect() {
    console.log('強制重新連接...');
            
    // 關閉現有連接
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
            
    // 重置視頻元素
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo) {
        remoteVideo.srcObject = null;
        remoteVideo.style.display = 'none';
    }
            
    // 顯示等待畫面
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    if (videoPlaceholder) {
        videoPlaceholder.style.display = 'block';
    }
            
    // 隱藏播放按鈕
    const playPrompt = document.getElementById('playPrompt');
    if (playPrompt) {
        playPrompt.style.display = 'none';
    }
            
    // 重新初始化連接
    setTimeout(() => {
        if (socket && isConnected) {
            socket.send(JSON.stringify({
                type: 'viewer_join',
                viewerId: viewerId,
                streamerId: window.getStreamerIdFromUrl(),
                userInfo: window.currentUser || { displayName: `觀眾${viewerId.substr(-3)}`, avatarUrl: null }
            }));
            console.log('已發送重新加入請求');
        }
    }, 1000);
            
    window.displaySystemMessage('🔄 正在重新連接...');
}
        
window.forceReconnect = forceReconnect;

// 全局變數存儲主播ID
let targetStreamerId = window.getStreamerIdFromUrl();

// 連接 WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
            
    socket = new WebSocket(wsUrl);
            
    socket.onopen = function() {
        console.log('WebSocket 連接成功');
        isConnected = true;
                
        // 作為觀眾加入
        socket.send(JSON.stringify({
            type: 'viewer_join',
            viewerId: viewerId,
            streamerId: targetStreamerId,
            userInfo: window.currentUser || { displayName: `觀眾${viewerId.substr(-3)}`, avatarUrl: null }
        }));
                
        window.displaySystemMessage('已連接到直播間');
    };
            
    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
            
    socket.onclose = function() {
        console.log('WebSocket 連接關閉');
        isConnected = false;
        window.displaySystemMessage('連接已斷開，正在重新連接...');
        // 嘗試重新連接
        setTimeout(connectWebSocket, 3000);
    };
            
    socket.onerror = function(error) {
        console.error('WebSocket 錯誤:', error);
        window.displaySystemMessage('連接錯誤，請檢查網絡連接');
    };
}

// 處理 WebSocket 消息
function handleWebSocketMessage(data) {
    console.log('收到消息:', data);
            
    switch(data.type) {
        case 'viewer_joined':
            window.displaySystemMessage('已成功加入直播間');
                    
            // 保存服務器分配的用戶信息
            if (data.userInfo) {
                if (data.userInfo.isGuest && data.userInfo.displayName) {
                    window.assignedGhostName = data.userInfo.displayName;
                    console.log('收到服務器分配的Ghost名稱:', window.assignedGhostName);
                            
                    // 更新聊天系統用戶名
                    if (window.updateChatSystemUsername) {
                        window.updateChatSystemUsername();
                    }
                            
                    // 更新頁面顯示的用戶名
                    // This function is not defined in common.js or viewer.js. It needs to be defined or removed.
                    // For now, I will comment it out.
                    // updateDisplayedUserName();
                }
            }
                    
            // 處理主播信息
            if (data.broadcasterInfo) {
                window.updateBroadcasterInfo(data.broadcasterInfo);
            }
            break;
        case 'broadcaster_info':
            // 處理主播信息（當主播未在直播時）
            if (data.broadcasterInfo) {
                window.updateBroadcasterInfo(data.broadcasterInfo);
                window.displaySystemMessage(data.message || '等待主播開始直播');
            }
            break;
        case 'stream_start':
            handleStreamStarted(data);
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
            // ChatSystem已經通過自己的WebSocket監聽器處理了這些消息
            console.log('[VIEWER] chat類型消息由ChatSystem直接處理，跳過重複處理');
            break;
            break;
        case 'viewer_count_update':
            window.updateViewerCount(data.count);
            break;
        case 'offer':
            handleOffer(data.offer);
            break;
        case 'ice_candidate':
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
        // 嘗試從已存儲的主播信息獲取名稱，或使用預設值
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
            
    window.displaySystemMessage('🎉 主播已開始直播！');
            
    // 初始化 WebRTC 連接
    initializePeerConnection();
}

// 處理直播標題更新
function handleTitleUpdate(data) {
    console.log('收到標題更新:', data);
            
    const streamTitle = document.getElementById('streamTitle');
    if (streamTitle) {
        // 添加更新動畫類
        streamTitle.classList.add('updating');
                
        if (data.title && data.title.trim() !== '') {
            streamTitle.textContent = data.title;
            console.log('標題已更新為:', data.title);
                    
            // 顯示一個簡短的通知
            window.displaySystemMessage(`📝 直播標題已更新: ${data.title}`);
        } else {
            streamTitle.textContent = '直播進行中';
            console.log('標題已重置為預設值');
            window.displaySystemMessage('📝 直播標題已重置');
        }
                
        // 添加一個更明顯的動畫效果
        streamTitle.style.transform = 'scale(1.05)';
                
        // 300ms後移除動畫效果
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
                    
            // 添加狀態更新動畫
            streamTitle.classList.add('updating');
            streamTitle.style.transform = 'scale(1.05)';
            setTimeout(() => {
                streamTitle.style.transform = 'scale(1)';
                streamTitle.classList.remove('updating');
            }, 300);
        }
                
        window.displaySystemMessage('🔴 直播正在進行中！');
                
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
        window.displaySystemMessage('⏳ 直播即將開始...');
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
            
    window.displaySystemMessage('📺 直播已結束，感謝觀看！');
            
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

// 初始化 WebRTC 連接
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
                window.displaySystemMessage('視頻播放錯誤，請重新整理頁面');
            };
                    
            // 嘗試自動播放
            remoteVideo.play().then(() => {
                console.log('自動播放成功');
                window.displaySystemMessage('🎬 視頻已開始播放');
            }).catch(error => {
                console.log('自動播放失敗，顯示播放提示:', error);
                if (playPrompt) {
                    playPrompt.style.display = 'block';
                    window.displaySystemMessage('請點擊播放按鈕開始觀看');
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
        if (peerConnection.connectionState === 'connected') {
            window.displaySystemMessage('視頻串流已連接');
        } else if (peerConnection.connectionState === 'disconnected') {
            window.displaySystemMessage('視頻串流已斷開');
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
        window.displaySystemMessage('視頻連接失敗，請刷新頁面重試');
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

// 啟用自動播放
function enableAutoplay() {
    const remoteVideo = document.getElementById('remoteVideo');
    const playPrompt = document.getElementById('playPrompt');
            
    console.log('用戶點擊播放按鈕');
            
    if (remoteVideo && remoteVideo.srcObject) {
        console.log('嘗試播放視頻');
                
        // 確保視頻不是靜音的
        remoteVideo.muted = false;
                
        remoteVideo.play().then(() => {
            console.log('手動播放成功');
            if (playPrompt) playPrompt.style.display = 'none';
            window.displaySystemMessage('🎬 視頻已開始播放');
        }).catch(error => {
            console.error('手動播放失敗:', error);
            window.displaySystemMessage('播放失敗，請檢查瀏覽器設置');
        });
    } else {
        console.error('沒有可播放的視頻流');
        window.displaySystemMessage('沒有可播放的視頻流，請等待主播開始直播');
    }
}

// 發送聊天消息
// 原生sendMessage函數已禁用，完全使用ChatSystem
/*
function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
            
    if (!message) return;
            
    if (!socket || !isConnected) {
        window.displaySystemMessage('連接已斷開，請刷新頁面重新連接');
        return;
    }
            
    const userName = window.currentUser ? window.currentUser.displayName : `觀眾${viewerId.substr(-3)}`;
    const userAvatar = window.currentUser ? window.currentUser.avatarUrl : null;
            
    // 使用統一的 chat 協議
    socket.send(JSON.stringify({
        type: 'chat',
        role: 'viewer',
        username: userName,
        message: message,
        userAvatar: userAvatar,
        timestamp: new Date().toISOString(),
        viewerId: viewerId
    }));
            
    // 清空輸入框
    chatInput.value = '';
}
*/

// 顯示聊天消息
function displayChatMessage(data) {
    const chatMessages = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
            
    const time = new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
    messageElement.innerHTML = `
        <div class="message-avatar">
            ${data.isSystemMessage ? '🤖' : (data.isStreamer ? '🔴' : (data.userAvatar ? `<img src="${data.userAvatar}" alt="${data.username}">` : data.username.charAt(0).toUpperCase()))}
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-user">${data.username}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${data.message}</div>
        </div>
    `;
            
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 顯示系統消息
function displaySystemMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message system-message';
            
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
    messageElement.innerHTML = `
        <div class="message-avatar">
            🤖
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-user">系統</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${message}</div>
        </div>
    `;
            
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 設置事件監聽器
function setupEventListeners() {
    const sendButton = document.getElementById('sendButton');
    const chatInput = document.getElementById('chatInput');
            
    if (sendButton) {
        sendButton.addEventListener('click', () => {
            if (window.chatSystem && typeof window.chatSystem.sendMessage === 'function') {
                window.chatSystem.sendMessage();
            } else {
                console.warn('ChatSystem.sendMessage 函數未載入或不可用');
                // 這裡可以添加一個後備的發送邏輯，或者提示用戶
                displaySystemMessage('聊天功能暫時不可用，請稍後再試。');
            }
        });
    }
            
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (window.chatSystem && typeof window.chatSystem.sendMessage === 'function') {
                    window.chatSystem.sendMessage();
                } else {
                    console.warn('ChatSystem.sendMessage 函數未載入或不可用');
                    displaySystemMessage('聊天功能暫時不可用，請稍後再試。');
                }
            }
        });
    }
}

// 設置移動端菜單
function setupMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileNav = document.getElementById('mobileNav');
            
    if (mobileMenuToggle && mobileNav) {
        mobileMenuToggle.addEventListener('click', () => {
            const isExpanded = mobileMenuToggle.getAttribute('aria-expanded') === 'true' || false;
            mobileMenuToggle.setAttribute('aria-expanded', !isExpanded);
            mobileNav.classList.toggle('active');
        });
    }
}

// 頁面卸載時清理
window.addEventListener('beforeunload', function() {
    if (peerConnection) {
        peerConnection.close();
    }
    if (socket) {
        socket.close();
    }
});

// 初始化聊天系統為觀眾模式
document.addEventListener('DOMContentLoaded', function() {
    // 確保 ChatSystem 腳本已載入
    if (window.initChatSystem) {
        // 獲取用戶名
        let username = '訪客';
        if (window.currentUser && window.currentUser.displayName) {
            username = window.currentUser.displayName;
        } else if (window.assignedGhostName) {
            username = window.assignedGhostName;
        }

        window.initChatSystem({
            isStreamer: false,
            username: username,
            broadcasterId: window.currentBroadcasterId,
            selectors: {
                chatContainer: '#chatMessages',
                messageInput: '#chatInput',
                sendButton: '#sendButton'
            }
        });
    } else {
        console.warn('ChatSystem 腳本未載入，聊天功能可能無法正常工作。');
    }
});