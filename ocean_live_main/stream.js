// WebRTC 配置
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

// 全局變數
let localStream = null;
let peerConnections = new Map();
let isStreaming = false;
let streamStartTime = null;
let socket = null;
let currentUser = null;
let isConnected = false;
let broadcasterId = 'broadcaster_' + Math.random().toString(36).substr(2, 9);

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();
    connectWebSocket();
    initializeStream();
    setupChatSystem();
    updateUIForRole();
});

// 載入當前用戶
async function loadCurrentUser() {
    try {
        const response = await fetch('/api/user/current');
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            console.log('主播用戶信息已載入:', currentUser);
        } else {
            console.log('用戶未登入，使用默認身份');
            currentUser = { displayName: '主播', username: '主播' };
        }
    } catch (error) {
        console.error('載入用戶信息失敗:', error);
        currentUser = { displayName: '主播', username: '主播' };
    }
}

// 連接 WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = function() {
        console.log('WebSocket 連接成功');
        isConnected = true;
        
        // 作為主播加入
        socket.send(JSON.stringify({
            type: 'broadcaster_join',
            broadcasterId: broadcasterId,
            userInfo: currentUser
        }));
        
        displaySystemMessage('已連接到服務器');
    };
    
    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    socket.onclose = function() {
        console.log('WebSocket 連接關閉');
        isConnected = false;
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
        case 'broadcaster_joined':
            displaySystemMessage('主播已成功加入直播間');
            break;
        case 'viewer_join':
            handleViewerJoin(data.viewerId);
            break;
        case 'chat_message':
            displayChatMessage(data);
            break;
        case 'answer':
            handleAnswer(data);
            break;
        case 'ice_candidate':
            handleIceCandidate(data);
            break;
        case 'viewer_count_update':
            updateViewerCount(data.count);
            break;
        default:
            console.log('未知消息類型:', data.type);
    }
}

// 顯示系統消息
function displaySystemMessage(text) {
    addMessageToChat('系統', text);
}

// 初始化直播
async function initializeStream() {
    const urlParams = new URLSearchParams(window.location.search);
    const streamId = urlParams.get('id');
    
    if (streamId) {
        // 觀眾模式
        document.getElementById('streamControls').style.display = 'none';
        await joinStream(streamId);
    } else {
        // 主播模式
        document.getElementById('startStreamButton').addEventListener('click', toggleStream);
    }
}

// 開始/停止直播
async function toggleStream() {
    if (!isStreaming) {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            document.getElementById('streamVideo').srcObject = localStream;
            document.getElementById('startStreamButton').textContent = '結束直播';
            
            isStreaming = true;
            streamStartTime = Date.now();
            
            // 通知服務器開始直播
            if (socket && isConnected) {
                socket.send(JSON.stringify({
                    type: 'stream_start',
                    broadcasterId: broadcasterId,
                    title: '直播中',
                    timestamp: new Date().toISOString()
                }));
            }
            
            displaySystemMessage('直播已開始');
            
        } catch (error) {
            console.error('無法訪問攝像頭或麥克風:', error);
            alert('無法訪問攝像頭或麥克風，請確認權限設置');
        }
    } else {
        stopStreaming();
    }
}

// 停止直播
function stopStreaming() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        document.getElementById('streamVideo').srcObject = null;
    }
    
    isStreaming = false;
    document.getElementById('startStreamButton').textContent = '開始直播';
    
    // 通知服務器結束直播
    if (socket && isConnected) {
        socket.send(JSON.stringify({
            type: 'stream_end',
            broadcasterId: broadcasterId,
            timestamp: new Date().toISOString()
        }));
    }
    
    // 清理連接
    peerConnections.forEach(connection => connection.close());
    peerConnections.clear();
    
    displaySystemMessage('直播已結束');
}

// 加入直播
async function joinStream(streamId) {
    // TODO: 實現觀眾加入直播的邏輯
    console.log('加入直播:', streamId);
}

// 處理觀眾加入
async function handleViewerJoin(viewerId) {
    console.log('新觀眾加入:', viewerId);
    
    if (!localStream) {
        console.log('本地流未準備好，無法建立連接');
        return;
    }
    
    // 為新觀眾創建 WebRTC 連接
    const peerConnection = new RTCPeerConnection(configuration);
    peerConnections.set(viewerId, peerConnection);
    
    // 添加本地流到連接
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    
    // 處理 ICE candidate
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket && isConnected) {
            socket.send(JSON.stringify({
                type: 'ice_candidate',
                candidate: event.candidate,
                viewerId: viewerId,
                broadcasterId: broadcasterId
            }));
        }
    };
    
    // 創建 offer
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // 發送 offer 給觀眾
        if (socket && isConnected) {
            socket.send(JSON.stringify({
                type: 'offer',
                offer: offer,
                viewerId: viewerId,
                broadcasterId: broadcasterId
            }));
        }
    } catch (error) {
        console.error('創建 offer 失敗:', error);
        peerConnections.delete(viewerId);
    }
}

// 處理 WebRTC Answer
async function handleAnswer(data) {
    const viewerId = data.viewerId;
    const peerConnection = peerConnections.get(viewerId);
    
    if (peerConnection && data.answer) {
        try {
            await peerConnection.setRemoteDescription(data.answer);
            console.log('WebRTC 連接建立成功，觀眾:', viewerId);
        } catch (error) {
            console.error('設置 remote description 失敗:', error);
        }
    }
}

// 處理 ICE Candidate
async function handleIceCandidate(data) {
    const viewerId = data.viewerId;
    const peerConnection = peerConnections.get(viewerId);
    
    if (peerConnection && data.candidate) {
        try {
            await peerConnection.addIceCandidate(data.candidate);
        } catch (error) {
            console.error('添加 ICE candidate 失敗:', error);
        }
    }
}

// 聊天系統
function setupChatSystem() {
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim()) {
            sendMessage();
        }
    });
}

// 發送聊天訊息
function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    if (!socket || !isConnected) {
        displaySystemMessage('連接已斷開，請刷新頁面重新連接');
        return;
    }
    
    const userName = currentUser ? currentUser.displayName : '主播';
    const userAvatar = currentUser ? currentUser.avatarUrl : null;
    
    // 發送聊天消息到服務器
    socket.send(JSON.stringify({
        type: 'broadcaster_chat_message',
        text: message,
        username: userName,
        userAvatar: userAvatar,
        timestamp: new Date().toISOString(),
        broadcasterId: broadcasterId
    }));
    
    // 清空輸入框
    chatInput.value = '';
}

// 顯示聊天消息
function displayChatMessage(data) {
    const username = data.username || '未知用戶';
    const text = data.text || '';
    addMessageToChat(username, text);
}

// 添加訊息到聊天室
function addMessageToChat(username, message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    messageElement.innerHTML = `
        <span class="username">${username}:</span>
        <span class="message">${message}</span>
    `;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 根據角色更新界面
function updateUIForRole() {
    const urlParams = new URLSearchParams(window.location.search);
    const streamId = urlParams.get('id');
    
    const streamControls = document.getElementById('streamControls');
    const streamSettings = document.querySelector('.stream-settings');
    
    if (streamId) {
        // 觀眾界面
        streamControls.style.display = 'none';
        streamSettings.style.display = 'none';
    } else {
        // 主播界面
        streamControls.style.display = 'flex';
        streamSettings.style.display = 'flex';
    }
}

// 更新觀眾數量
function updateViewerCount(count) {
    document.getElementById('viewerCount').textContent = count;
}

// 更新直播時長
setInterval(() => {
    if (isStreaming && streamStartTime) {
        const duration = Math.floor((Date.now() - streamStartTime) / 1000);
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        const seconds = duration % 60;
        
        document.getElementById('streamDuration').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}, 1000);
