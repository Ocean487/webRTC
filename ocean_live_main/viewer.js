// 觀眾端 WebRTC 直播觀看
let peerConnection = null;
let socket = null;
let localStream = null;
let isConnected = false;
let viewerId = null;
let messageCount = 0;
let autoplayEnabled = false;
let currentUser = null; // 當前用戶信息

// 檢測移動端
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// WebRTC 配置 - 優化視頻解碼
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' },
        { urls: 'stun:stun.l.google.com:19305' }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
};

// 啟用自動播放（移動端需要用戶交互）
function enableAutoplay() {
    const remoteVideo = document.getElementById('remoteVideo');
    
    if (remoteVideo && remoteVideo.srcObject) {
        remoteVideo.muted = false;
        remoteVideo.play().then(() => {
            console.log('視頻播放成功');
            autoplayEnabled = true;
        }).catch(error => {
            console.error('視頻播放失敗:', error);
        });
    }
    
    autoplayEnabled = true;
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    loadCurrentUser(); // 載入用戶信息
    initializeViewer();
    generateViewerId();
});

// 載入當前用戶信息
async function loadCurrentUser() {
    try {
        const response = await fetch('/api/user/current');
        
        // 處理401未授權錯誤
        if (response.status === 401) {
            console.log('用戶未登入 (401)，將使用訪客身份');
            currentUser = null;
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            console.log('觀眾用戶信息已載入:', currentUser);
        } else {
            console.log('用戶未登入，將使用訪客身份');
            currentUser = null;
        }
    } catch (error) {
        console.log('載入用戶信息失敗，將使用訪客身份:', error.message);
        currentUser = null;
    }
}

// 獲取當前用戶顯示名稱
function getCurrentUserDisplayName() {
    if (currentUser) {
        return currentUser.displayName;
    } else {
        // 使用服務器分配的Ghost名稱
        return window.assignedGhostName || `觀眾${viewerId ? viewerId.substr(-3) : '000'}`;
    }
}

// 獲取當前用戶頭像
function getCurrentUserAvatar() {
    if (currentUser && currentUser.avatarUrl) {
        return `<img src="${currentUser.avatarUrl}" alt="${currentUser.displayName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else if (currentUser) {
        return currentUser.displayName.charAt(0).toUpperCase();
    } else {
        // Ghost用戶頭像
        const ghostName = window.assignedGhostName || 'G';
        return ghostName.startsWith('Ghost_s') ? 'G' + ghostName.replace('Ghost_s', '') : 'G';
    }
}

// 初始化觀眾端
function initializeViewer() {
    // 檢查HTTPS（移動端需要）
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        addMessage('系統', '⚠️ 手機瀏覽器需要HTTPS才能觀看直播，請使用HTTPS連接');
    }
    
    // 檢查是否支援 WebRTC
    if (!navigator.mediaDevices || !window.RTCPeerConnection) {
        addMessage('系統', '❌ 您的瀏覽器不支援 WebRTC，請使用現代瀏覽器');
        return;
    }

    // 移動端提示
    if (isMobile) {
        addMessage('系統', '📱 移動端檢測到，已優化移動體驗');
    }

    // 嘗試連接到直播服務器
    connectToStreamingServer();
}

// 生成觀眾ID
function generateViewerId() {
    viewerId = 'viewer_' + Math.random().toString(36).substr(2, 9);
}

// 連接到直播服務器
function connectToStreamingServer() {
    updateConnectionStatus('connecting', '連接中...');
    
    try {
        // 建立 WebSocket 連接
        socket = new WebSocket('ws://localhost:3000');
        
        socket.onopen = function() {
            console.log('已連接到直播服務器');
            updateConnectionStatus('connected', '已連接');
            isConnected = true;
            
            // 發送觀眾加入訊息
            const userInfo = currentUser ? {
                displayName: currentUser.displayName,
                avatarUrl: currentUser.avatarUrl,
                isLoggedIn: true
            } : {
                isLoggedIn: false
            };
            
            socket.send(JSON.stringify({
                type: 'viewer_join',
                viewerId: viewerId,
                userInfo: userInfo,
                timestamp: Date.now()
            }));
            
            addMessage('系統', '✅ 已連接到直播間');
            
            // 如果重整後沒有收到 stream_start，主動請求狀態
            setTimeout(() => {
                if (!document.getElementById('streamInfo').style.display || 
                    document.getElementById('streamInfo').style.display === 'none') {
                    addMessage('系統', '🔄 正在檢查直播狀態...');
                }
            }, 2000);
        };
        
        socket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        };
        
        socket.onclose = function() {
            console.log('與直播服務器斷開連接');
            updateConnectionStatus('disconnected', '連接斷開');
            isConnected = false;
            addMessage('系統', '⚠️ 與直播服務器斷開連接');
            
            // 嘗試重新連接
            setTimeout(() => {
                if (!isConnected) {
                    addMessage('系統', '🔄 嘗試重新連接...');
                    connectToStreamingServer();
                }
            }, 3000);
        };
        
        socket.onerror = function(error) {
            console.error('WebSocket 錯誤:', error);
            updateConnectionStatus('disconnected', '連接錯誤');
            addMessage('系統', '❌ 連接直播服務器失敗');
        };
        
    } catch (error) {
        console.error('無法連接到直播服務器:', error);
        updateConnectionStatus('disconnected', '連接失敗');
        addMessage('系統', '❌ 無法連接到直播服務器，請檢查服務器是否運行');
        
        // 顯示服務器連接提示
        showServerConnectionHelp();
    }
}

// 處理服務器訊息
function handleServerMessage(data) {
    console.log('🔔 觀眾端收到服務器消息:', data.type, data);
    
    switch (data.type) {
        case 'stream_start':
            handleStreamStart(data);
            break;
        case 'stream_status':
            handleStreamStatus(data);
            break;
        case 'stream_end':
            handleStreamEnd();
            break;
        case 'title_update':
            handleTitleUpdate(data);
            break;
        case 'effect_update':
            handleEffectUpdate(data);
            break;
        case 'viewer_joined':
            // 處理觀眾加入確認，保存分配的用戶信息
            console.log('觀眾加入確認:', data.message);
            if (data.userInfo) {
                if (data.userInfo.isGuest && data.userInfo.displayName) {
                    window.assignedGhostName = data.userInfo.displayName;
                    console.log('已分配Ghost名稱:', window.assignedGhostName);
                    
                    // 更新頁面顯示的用戶名
                    updateDisplayedUserName();
                }
            }
            break;
        case 'chat_message':
            handleChatMessage(data);
            break;
        case 'viewer_count_update':
            updateViewerCount(data.count);
            break;
        case 'offer':
            console.log('🎯 觀眾端收到 WebRTC Offer');
            handleOffer(data);
            break;
        case 'ice_candidate':
            handleIceCandidate(data);
            break;
        default:
            console.log('未知訊息類型:', data.type, data);
    }
}

// 更新頁面顯示的用戶名
function updateDisplayedUserName() {
    const userAvatar = document.querySelector('.user-avatar');
    if (userAvatar && window.assignedGhostName) {
        const avatarText = window.assignedGhostName.startsWith('Ghost_s') ? 
            'G' + window.assignedGhostName.replace('Ghost_s', '') : 'G';
        if (!userAvatar.querySelector('img')) {
            userAvatar.textContent = avatarText;
        }
    }
}

// 處理直播開始
function handleStreamStart(data) {
    console.log('收到 stream_start 訊息:', data);
    
    // 更新狀態顯示
    updateStreamStatus(data.status, data.title, data.message);
    
    // 隱藏 "目前沒有直播" 訊息
    const noStreamMessage = document.getElementById('noStreamMessage');
    if (noStreamMessage) {
        noStreamMessage.style.display = 'none';
    }
    
    // 顯示直播資訊
    document.getElementById('streamTitle').textContent = data.title || '直播中';
    document.getElementById('streamInfo').style.display = 'block';
    
    // 建立 WebRTC 連接
    createPeerConnection();
    
    // 處理主播的 offer
    if (data.offer) {
        handleOffer(data);
    }
    
    // 更新連接狀態
    updateConnectionStatus('connected', '已連接直播');
    
    // 等待主播發送 offer
    addMessage('系統', '⏳ 等待主播發送串流邀請...');
}

// 處理直播狀態更新
function handleStreamStatus(data) {
    console.log('直播狀態更新:', data);
    updateStreamStatus(data.status, data.title, data.message);
}

// 處理標題更新
function handleTitleUpdate(data) {
    console.log('標題更新:', data.title);
    if (data.title) {
        document.getElementById('streamTitle').textContent = data.title;
        addMessage('系統', `📝 直播標題已更新為: ${data.title}`);
    }
}

// 更新直播狀態顯示
function updateStreamStatus(status, title, message) {
    const statusElement = document.getElementById('statusText');
    if (statusElement) {
        statusElement.textContent = message || status;
        statusElement.className = `status-text status-${status}`;
    }
    
    if (title) {
        document.getElementById('streamTitle').textContent = title;
    }
    
    if (message) {
        addMessage('系統', message);
    }
}

// 處理直播結束
function handleStreamEnd() {
    addMessage('系統', '📺 直播已結束');
    
    // 隱藏直播資訊
    document.getElementById('streamInfo').style.display = 'none';
    
    // 顯示等待畫面
    const remoteVideo = document.getElementById('remoteVideo');
    const placeholder = document.getElementById('videoPlaceholder');
    
    remoteVideo.style.display = 'none';
    placeholder.style.display = 'flex';
    
    // 關閉 WebRTC 連接
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
}

// 智能視頻播放函數，處理各種瀏覽器兼容性問題
function playVideoWithSmartFallback(videoElement) {
    console.log('🚀 [播放] 開始智能播放視頻...');
    
    // 確保視頻屬性設置正確
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.controls = false; // 確保不顯示控制項
    videoElement.muted = false; // 預設不靜音
    
    // 設置視頻編碼格式偏好
    if (videoElement.canPlayType) {
        const formats = [
            'video/webm; codecs="vp8"',
            'video/webm; codecs="vp9"', 
            'video/mp4; codecs="avc1.42E01E"',
            'video/mp4; codecs="h264"'
        ];
        
        for (const format of formats) {
            const support = videoElement.canPlayType(format);
            console.log(`視頻格式支援 ${format}: ${support}`);
        }
    }
    
    // 嘗試直接播放
    const playPromise = videoElement.play();
    
    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log('✅ [播放] 視頻直接播放成功');
            addMessage('系統', '🎬 直播播放成功！');
            
            // 監聽播放狀態
            videoElement.addEventListener('playing', () => {
                console.log('✅ [播放] 視頻正在播放中');
                addMessage('系統', '▶️ 視頻正在播放');
            });
            
            videoElement.addEventListener('waiting', () => {
                console.log('⏳ [播放] 視頻緩衝中...');
                addMessage('系統', '⏳ 視頻緩衝中...');
            });
            
        }).catch(error => {
            console.log('❌ [播放] 直接播放失敗:', error.name, error.message);
            
            // 如果是自動播放被阻止，嘗試靜音播放
            if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
                console.log('🔇 [播放] 嘗試靜音播放...');
                addMessage('系統', '🔇 嘗試靜音播放...');
                
                videoElement.muted = true;
                videoElement.play().then(() => {
                    console.log('✅ [播放] 靜音播放成功');
                    addMessage('系統', '🎬 靜音播放成功！點擊視頻可開啟聲音');
                    
                    // 添加點擊恢復聲音功能
                    videoElement.onclick = function() {
                        this.muted = false;
                        addMessage('系統', '🔊 聲音已開啟');
                        this.onclick = null; // 移除點擊事件
                    };
                    
                    // 1秒後嘗試自動恢復聲音（更快）
                    setTimeout(() => {
                        if (videoElement.muted) {
                            videoElement.muted = false;
                            addMessage('系統', '🔊 已自動開啟聲音');
                        }
                    }, 1000);
                    
                }).catch(mutedError => {
                    console.error('❌ [播放] 靜音播放也失敗:', mutedError);
                    addMessage('系統', '⚠️ 請點擊視頻畫面開始播放');
                    
                    // 添加手動點擊播放
                    videoElement.onclick = function() {
                        this.play().then(() => {
                            addMessage('系統', '🎬 手動播放成功！');
                            this.onclick = null;
                        }).catch(e => {
                            addMessage('系統', '❌ 播放失敗，請重新整理頁面');
                            console.error('手動播放也失敗:', e);
                        });
                    };
                });
            } else {
                // 其他錯誤，顯示手動播放提示
                console.error('❌ 播放失敗，其他錯誤:', error);
                addMessage('系統', '⚠️ 請點擊視頻畫面開始播放');
                
                videoElement.onclick = function() {
                    this.play().then(() => {
                        addMessage('系統', '🎬 手動播放成功！');
                        this.onclick = null;
                    }).catch(e => {
                        addMessage('系統', '❌ 播放失敗，請重新整理頁面');
                        console.error('手動播放失敗:', e);
                    });
                };
            }
        });
    } else {
        // 舊瀏覽器處理
        console.log('⚠️ [播放] 瀏覽器不支援 Promise 形式的 play()');
        addMessage('系統', '⚠️ 請點擊視頻畫面開始播放');
        
        videoElement.onclick = function() {
            try {
                this.play();
                addMessage('系統', '🎬 手動播放成功！');
                this.onclick = null;
            } catch (e) {
                addMessage('系統', '❌ 播放失敗，請重新整理頁面');
                console.error('播放失敗:', e);
            }
        };
    }
}

// 建立 WebRTC 連接
function createPeerConnection() {
    try {
        peerConnection = new RTCPeerConnection(configuration);
        
        // 🚨 [WebRTC調試] 詳細監控連接狀態
        peerConnection.onconnectionstatechange = function() {
            console.log('🔗 [WebRTC] 連接狀態變化:', peerConnection.connectionState);
            addMessage('系統', `🔗 連接狀態: ${peerConnection.connectionState}`);
            
            if (peerConnection.connectionState === 'connected') {
                addMessage('系統', '✅ WebRTC 連接已建立！');
                
                // 檢查接收器
                const receivers = peerConnection.getReceivers();
                console.log('📺 [Receivers] 接收器數量:', receivers.length);
                receivers.forEach((receiver, index) => {
                    const track = receiver.track;
                    if (track) {
                        console.log(`📺 [Receiver ${index}] 軌道類型: ${track.kind}, 狀態: ${track.readyState}, ID: ${track.id}`);
                        addMessage('系統', `📺 檢測到 ${track.kind} 軌道`);
                    } else {
                        console.log(`📺 [Receiver ${index}] 無軌道`);
                    }
                });
                
                if (receivers.length === 0) {
                    console.error('❌ [Receivers] 沒有檢測到任何接收器！');
                    addMessage('系統', '⚠️ 沒有檢測到媒體軌道');
                }
            } else if (peerConnection.connectionState === 'failed') {
                addMessage('系統', '❌ WebRTC 連接失敗');
            }
        };
        
        peerConnection.oniceconnectionstatechange = function() {
            console.log('🧊 [ICE] ICE 連接狀態變化:', peerConnection.iceConnectionState);
            addMessage('系統', `🧊 ICE狀態: ${peerConnection.iceConnectionState}`);
        };
        
        peerConnection.onsignalingstatechange = function() {
            console.log('📡 [Signal] 信號狀態變化:', peerConnection.signalingState);
        };
        
        // 處理遠端串流
        peerConnection.ontrack = function(event) {
            console.log('🎬 [ontrack] 收到遠端串流事件!!!', event);
            console.log('🎬 [ontrack] 串流數量:', event.streams ? event.streams.length : 0);
            
            if (event.track) {
                console.log('🎵 [track] 軌道類型:', event.track.kind, '狀態:', event.track.readyState);
            }
            
            addMessage('系統', `🎬 收到 ${event.track.kind} 軌道!`);
            
            const remoteVideo = document.getElementById('remoteVideo');
            const placeholder = document.getElementById('videoPlaceholder');
            
            if (event.streams && event.streams[0]) {
                const stream = event.streams[0];
                console.log('設置視訊源，軌道數量:', stream.getTracks().length);
                
                // 設置軌道建立時間戳記，用於後續檢測
                window.trackEstablishmentTime = Date.now();
                console.log('軌道建立時間已記錄:', new Date(window.trackEstablishmentTime));
                
                // 記錄軌道信息
                stream.getTracks().forEach(track => {
                    console.log(`軌道: ${track.kind}, 狀態: ${track.readyState}, ID: ${track.id}`);
                });
                
                // 設置視訊源
                remoteVideo.srcObject = stream;
                remoteVideo.style.display = 'block';
                placeholder.style.display = 'none';
                
                // 顯示直播資訊
                document.getElementById('streamInfo').style.display = 'block';
                
                addMessage('系統', '� 正在接收直播畫面...');
                
                // 立即嘗試播放
                console.log('🚀 [播放] 立即嘗試播放視頻...');
                playVideoWithSmartFallback(remoteVideo);
                
                // 監聽視訊載入
                remoteVideo.onloadedmetadata = function() {
                    console.log('視訊元數據已載入');
                    addMessage('系統', '✅ 視訊已準備就緒');
                    
                    // 嘗試播放視訊
                    playVideoWithSmartFallback(remoteVideo);
                };
                
                remoteVideo.onplay = function() {
                    console.log('視訊開始播放');
                    addMessage('系統', '🎬 直播開始播放！');
                };
                
                remoteVideo.onerror = function(error) {
                    console.error('視訊播放錯誤:', error);
                    addMessage('系統', '❌ 視訊播放錯誤，請重新整理頁面');
                };
                
            } else {
                console.error('沒有收到串流');
                addMessage('系統', '❌ 沒有收到直播串流');
            }
        };
        
        // 🔍 添加診斷計時器
        setTimeout(() => {
            console.log('🔍 [診斷] 檢查WebRTC狀態...');
            addMessage('系統', '🔍 正在診斷連接狀態...');
            
            const receivers = peerConnection.getReceivers();
            console.log('🔍 [診斷] 接收器數量:', receivers.length);
            console.log('🔍 [診斷] 連接狀態:', peerConnection.connectionState);
            console.log('🔍 [診斷] ICE狀態:', peerConnection.iceConnectionState);
            console.log('🔍 [診斷] 信號狀態:', peerConnection.signalingState);
            
            addMessage('系統', `🔍 接收器: ${receivers.length}, 連接: ${peerConnection.connectionState}`);
            
            if (receivers.length === 0) {
                console.error('🚫 [診斷] 警告：沒有檢測到任何媒體接收器！');
                addMessage('系統', '🚫 警告：沒有檢測到媒體接收器');
            } else {
                receivers.forEach((receiver, index) => {
                    const track = receiver.track;
                    if (track) {
                        console.log(`🔍 [診斷] 接收器${index}: ${track.kind} (${track.readyState})`);
                        addMessage('系統', `🔍 接收器${index}: ${track.kind}`);
                    }
                });
            }
        }, 5000); // 5秒後檢查狀態
        
        // 處理 ICE 候選
        peerConnection.onicecandidate = function(event) {
            if (event.candidate && socket && isConnected) {
                socket.send(JSON.stringify({
                    type: 'ice_candidate',
                    candidate: event.candidate,
                    viewerId: viewerId
                }));
            }
        };
        
        // 處理連接狀態變化
        peerConnection.onconnectionstatechange = function() {
            console.log('WebRTC 連接狀態:', peerConnection.connectionState);
            
            if (peerConnection.connectionState === 'connected') {
                addMessage('系統', '✅ WebRTC 連接已建立');
            } else if (peerConnection.connectionState === 'failed') {
                addMessage('系統', '❌ WebRTC 連接失敗');
            } else if (peerConnection.connectionState === 'connecting') {
                addMessage('系統', '🔄 正在建立 WebRTC 連接...');
            } else if (peerConnection.connectionState === 'disconnected') {
                addMessage('系統', '⚠️ WebRTC 連接已斷開');
            }
        };
        
        // 監聽 ICE 連接狀態
        peerConnection.oniceconnectionstatechange = function() {
            console.log('ICE 連接狀態:', peerConnection.iceConnectionState);
            addMessage('系統', `🌐 ICE 狀態: ${peerConnection.iceConnectionState}`);
            
            if (peerConnection.iceConnectionState === 'failed') {
                addMessage('系統', '❌ ICE 連接失敗，可能需要重新建立連接');
            } else if (peerConnection.iceConnectionState === 'connected') {
                addMessage('系統', '✅ ICE 連接成功，視訊串流已建立');
            } else if (peerConnection.iceConnectionState === 'checking') {
                addMessage('系統', '🔄 ICE 正在檢查連接...');
            }
        };
        
        // 監聽信令狀態
        peerConnection.onsignalingstatechange = function() {
            console.log('信令狀態:', peerConnection.signalingState);
            addMessage('系統', `📡 信令狀態: ${peerConnection.signalingState}`);
            
            if (peerConnection.signalingState === 'stable') {
                addMessage('系統', '✅ 信令狀態穩定');
            } else if (peerConnection.signalingState === 'have-remote-offer') {
                addMessage('系統', '📡 已收到遠端 offer');
            } else if (peerConnection.signalingState === 'have-local-offer') {
                addMessage('系統', '📡 已發送本地 offer');
            }
        };
        
    } catch (error) {
        console.error('建立 WebRTC 連接失敗:', error);
        addMessage('系統', '❌ 建立視訊連接失敗');
    }
}

// 處理主播的 offer
async function handleOffer(data) {
    console.log('收到主播的 offer:', data);
    
    // 檢查是否是軌道更新
    const isTrackUpdate = peerConnection && peerConnection.signalingState === 'stable';
    
    if (isTrackUpdate) {
        addMessage('系統', '🔄 收到主播的軌道更新，正在重新協商...');
    } else {
        addMessage('系統', '📡 收到主播的串流邀請，正在建立連接...');
    }
    
    if (!peerConnection) {
        createPeerConnection();
    }
    
    try {
        // 設置遠端描述
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log('已設置遠端描述');
        
        if (isTrackUpdate) {
            addMessage('系統', '✅ 軌道更新已處理');
        } else {
            addMessage('系統', '✅ 已設置遠端描述');
        }
        
        // 創建 answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log('已創建並設置本地 answer');
        
        if (isTrackUpdate) {
            addMessage('系統', '✅ 軌道更新回應已發送');
        } else {
            addMessage('系統', '✅ 已創建並設置本地 answer');
        }
        
        // 發送 answer 給主播
        if (socket && isConnected) {
            const answerMessage = {
                type: 'answer',
                answer: answer,
                viewerId: viewerId
            };
            console.log('發送 answer 給主播:', answerMessage);
            socket.send(JSON.stringify(answerMessage));
            
            if (isTrackUpdate) {
                addMessage('系統', '📤 軌道更新回應已發送給主播');
            } else {
                addMessage('系統', '📤 已發送連接回應給主播');
            }
        }
        
        if (isTrackUpdate) {
            addMessage('系統', '🔄 軌道更新完成，視訊串流正在更新...');
            
            // 軌道更新後，強制重新播放視訊
            setTimeout(() => {
                if (remoteVideo.srcObject) {
                    console.log('軌道更新後嘗試自動播放...');
                    playVideoWithFallback(remoteVideo);
                    
                    // 檢查是否需要自動重整
                    setTimeout(() => {
                        if (detectScreenSwitchIssue()) {
                            return; // 如果檢測到問題，會自動重整
                        }
                    }, 3000); // 等待3秒後檢查
                }
            }, 1000);
        } else {
            addMessage('系統', '🔄 正在建立視訊連接...');
        }
        
    } catch (error) {
        console.error('處理 offer 失敗:', error);
        if (isTrackUpdate) {
            addMessage('系統', '❌ 軌道更新失敗: ' + error.message);
        } else {
            addMessage('系統', '❌ 連接直播串流失敗: ' + error.message);
        }
    }
}

// 處理 ICE 候選
async function handleIceCandidate(data) {
    console.log('收到 ICE 候選:', data);
    
    if (peerConnection && data.candidate) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log('已添加 ICE 候選');
        } catch (error) {
            console.error('添加 ICE 候選失敗:', error);
            addMessage('系統', '❌ 添加 ICE 候選失敗');
        }
    } else {
        console.error('無法處理 ICE 候選:', data);
    }
}

// 處理聊天訊息
function handleChatMessage(data) {
    if (data.viewerId !== viewerId) { // 不顯示自己的訊息
        const isStreamer = data.isStreamer || false;
        addMessage(data.username || data.viewerId, data.message, data.userAvatar, isStreamer);
    }
}

// 發送聊天訊息
function sendMessage() {
    const messageInput = document.getElementById('chatInput'); // 修正ID
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    if (!isConnected) {
        addMessage('系統', '⚠️ 尚未連接到直播間，無法發送訊息');
        return;
    }

    // 獲取正確的用戶名稱
    let displayName, avatarUrl;
    if (currentUser) {
        // 登入用戶使用真實姓名
        displayName = currentUser.displayName;
        avatarUrl = currentUser.avatarUrl;
    } else {
        // 訪客使用服務器分配的Ghost名稱
        displayName = window.assignedGhostName || '訪客';
        avatarUrl = null;
    }

    const messageData = {
        type: 'chat_message',
        message: message,
        username: displayName,
        userAvatar: avatarUrl,
        timestamp: new Date().toISOString(),
        viewerId: viewerId
    };

    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(messageData));
        messageInput.value = '';
        
        // 在本地顯示自己的訊息
        addMessage(displayName, message, avatarUrl);
    }
}

// 處理聊天訊息
function handleChatMessage(data) {
    if (data.viewerId !== viewerId) { // 不顯示自己的訊息
        const isStreamer = data.isStreamer || false;
        addMessage(data.username || data.viewerId, data.message, data.userAvatar, isStreamer);
    }
}

// 處理 Enter 鍵發送
function handleEnter(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// 添加聊天訊息
function addMessage(username, content, userAvatar = null, isStreamer = false) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    // 根據用戶類型設置不同的樣式
    if (username === '系統') {
        messageDiv.classList.add('system');
    } else if (username === getCurrentUserDisplayName()) {
        messageDiv.classList.add('own-message');
    } else if (isStreamer) {
        messageDiv.classList.add('streamer');
    }
    
    const timestamp = new Date().toLocaleTimeString('zh-TW', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // 獲取用戶頭像
    const avatar = getUserAvatar(username, userAvatar);
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            ${avatar}
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-username">${username}</span>
                    <span class="message-timestamp">${timestamp}</span>
                </div>
                <div class="message-text">${content}</div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // 更新訊息計數
    if (username !== '系統') {
        messageCount++;
    }
}

// 獲取用戶頭像（觀眾端版本）
function getUserAvatar(username, userAvatar = null) {
    if (username === '系統') {
        return '<i class="fas fa-cog"></i>';
    } else if (userAvatar) {
        // 如果有用戶頭像圖片
        return `<img src="${userAvatar}" alt="${username}">`;
    } else if (username === getCurrentUserDisplayName()) {
        // 當前用戶的頭像
        return getCurrentUserAvatar();
    } else {
        // 其他用戶顯示用戶名的第一個字母
        return username.charAt(0).toUpperCase();
    }
}

// 更新連接狀態
function updateConnectionStatus(status, text) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    // 移除所有狀態類別
    statusDot.classList.remove('connected', 'connecting', 'disconnected');
    
    // 添加新狀態類別
    statusDot.classList.add(status);
    statusText.textContent = text;
}

// 更新觀眾數量
function updateViewerCount(count) {
    document.getElementById('chatViewerCount').textContent = count;
}

// 顯示服務器連接幫助
function showServerConnectionHelp() {
    const helpMessage = `
        <div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 15px; padding: 1rem; margin: 1rem 0; color: white;">
            <h4>🔧 需要啟動直播服務器</h4>
            <p>要觀看直播，需要先啟動後端服務器：</p>
            <ol style="text-align: left; margin: 1rem 0;">
                <li>安裝 Node.js</li>
                <li>在終端機中執行：<code>npm install</code></li>
                <li>啟動服務器：<code>npm start</code></li>
                <li>重新整理此頁面</li>
            </ol>
        </div>
    `;
    
    const chatMessages = document.getElementById('chatMessages');
    const helpDiv = document.createElement('div');
    helpDiv.innerHTML = helpMessage;
    chatMessages.appendChild(helpDiv);
}

// 頁面卸載時清理資源
window.addEventListener('beforeunload', function() {
    if (socket) {
        socket.close();
    }
    if (peerConnection) {
        peerConnection.close();
    }
});

// 創建視訊播放控制界面
function createVideoControls(videoElement) {
    // 檢查是否已經有控制界面
    if (document.getElementById('videoControls')) return;
    
    // 添加手動重整按鈕到頁面
    addManualRefreshButton();
    
    const videoContainer = videoElement.parentElement;
    
    // 創建控制界面容器
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'videoControls';
    controlsContainer.className = 'video-controls';
    controlsContainer.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(transparent, rgba(0,0,0,0.8));
        padding: 25px 20px 20px;
        display: flex;
        flex-direction: column;
        gap: 15px;
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(10px);
    `;
    
    // 播放/暫停按鈕 - 大而美觀
    const playPauseBtn = document.createElement('button');
    playPauseBtn.innerHTML = '▶️';
    playPauseBtn.className = 'control-btn play-btn';
    playPauseBtn.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        color: white;
        padding: 15px 20px;
        border-radius: 50px;
        cursor: pointer;
        font-size: 20px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        min-width: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // 播放按鈕懸停效果
    playPauseBtn.onmouseenter = function() { 
        this.style.transform = 'scale(1.1) translateY(-2px)';
        this.style.boxShadow = '0 12px 35px rgba(102, 126, 234, 0.6)';
    };
    playPauseBtn.onmouseleave = function() { 
        this.style.transform = 'scale(1) translateY(0)';
        this.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.4)';
    };
    
    playPauseBtn.onclick = function() {
        if (videoElement.paused) {
            videoElement.play();
            this.innerHTML = '⏸️';
            this.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
        } else {
            videoElement.pause();
            this.innerHTML = '▶️';
            this.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }
    };
    
    // 音量控制 - 美化
    const volumeControl = document.createElement('div');
    volumeControl.style.cssText = `
        display: flex; 
        align-items: center; 
        gap: 12px;
        background: rgba(255,255,255,0.1);
        padding: 8px 15px;
        border-radius: 25px;
        backdrop-filter: blur(5px);
    `;
    volumeControl.innerHTML = `
        <span style="color: white; font-size: 16px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🔊</span>
        <input type="range" min="0" max="1" step="0.1" value="1" 
               style="width: 80px; height: 6px; cursor: pointer; border-radius: 3px; background: rgba(255,255,255,0.3); outline: none;">
    `;
    
    // 直播串流不需要進度條和時間顯示
    
    // 全螢幕按鈕 - 美化
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.className = 'control-btn fullscreen-btn';
    fullscreenBtn.style.cssText = `
        background: rgba(255,255,255,0.15);
        border: 2px solid rgba(255,255,255,0.3);
        color: white;
        padding: 12px 16px;
        border-radius: 50px;
        cursor: pointer;
        font-size: 18px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(5px);
    `;
    
    fullscreenBtn.onmouseenter = function() { 
        this.style.background = 'rgba(255,255,255,0.25)';
        this.style.borderColor = 'rgba(255,255,255,0.5)';
        this.style.transform = 'scale(1.05)';
    };
    fullscreenBtn.onmouseleave = function() { 
        this.style.background = 'rgba(255,255,255,0.15)';
        this.style.borderColor = 'rgba(255,255,255,0.3)';
        this.style.transform = 'scale(1)';
    };
    
    fullscreenBtn.onclick = function() {
        if (!document.fullscreenElement) {
            videoContainer.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };
    
    // 組裝控制界面 - 簡化版，適合直播
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
    topRow.appendChild(playPauseBtn);
    topRow.appendChild(volumeControl);
    topRow.appendChild(fullscreenBtn);
    
    controlsContainer.appendChild(topRow);
    
    // 直播時不需要進度條，只顯示直播狀態
    const liveIndicator = document.createElement('div');
    liveIndicator.style.cssText = `
        color: #ff4444; 
        font-size: 14px; 
        text-align: center;
        font-weight: 600;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        background: rgba(255,68,68,0.2);
        padding: 8px 15px;
        border-radius: 20px;
        backdrop-filter: blur(5px);
        border: 1px solid rgba(255,68,68,0.3);
    `;
    liveIndicator.innerHTML = '🔴 直播中';
    controlsContainer.appendChild(liveIndicator);
    
    // 添加到視訊容器
    videoContainer.style.position = 'relative';
    videoContainer.appendChild(controlsContainer);
    
    // 音量控制事件
    const volumeSlider = volumeControl.querySelector('input');
    const volumeIcon = volumeControl.querySelector('span');
    volumeSlider.oninput = function() {
        videoElement.volume = this.value;
        volumeIcon.innerHTML = this.value == 0 ? '🔇' : '🔊';
    };
    
    // 直播串流不需要進度條控制
    
    // 滑鼠懸停顯示控制界面
    videoContainer.onmouseenter = function() {
        controlsContainer.style.opacity = '1';
        controlsContainer.style.transform = 'translateY(0)';
    };
    
    videoContainer.onmouseleave = function() {
        controlsContainer.style.opacity = '0';
        controlsContainer.style.transform = 'translateY(10px)';
    };
    
    // 自動隱藏控制界面
    let hideTimeout;
    videoContainer.onmousemove = function() {
        clearTimeout(hideTimeout);
        controlsContainer.style.opacity = '1';
        controlsContainer.style.transform = 'translateY(0)';
        
        hideTimeout = setTimeout(() => {
            if (!videoContainer.matches(':hover')) {
                controlsContainer.style.opacity = '0';
                controlsContainer.style.transform = 'translateY(10px)';
            }
        }, 3000);
    };
}

// 智能播放函數 - 處理各種播放情況
async function playVideoWithFallback(videoElement) {
    try {
        // 首先嘗試正常播放
        await videoElement.play();
        console.log('視訊播放成功！');
        addMessage('系統', '🎬 視訊開始播放！');
        return true;
    } catch (error) {
        console.error('正常播放失敗:', error);
        
        // 嘗試靜音播放
        try {
            videoElement.muted = true;
            await videoElement.play();
            console.log('靜音播放成功！');
            addMessage('系統', '🎬 靜音播放成功！');
            
            // 播放成功後恢復音量
            setTimeout(() => {
                videoElement.muted = false;
                addMessage('系統', '🔊 已恢復音量');
            }, 2000);
            return true;
        } catch (muteError) {
            console.error('靜音播放也失敗:', muteError);
            addMessage('系統', '⚠️ 請點擊播放按鈕開始播放');
            
            // 設置點擊播放
            videoElement.style.cursor = 'pointer';
            videoElement.title = '點擊播放視訊';
            
            // 添加點擊播放事件
            videoElement.onclick = function() {
                this.play().then(() => {
                    addMessage('系統', '🎬 手動播放成功！');
                    this.style.cursor = 'default';
                    this.title = '';
                }).catch(e => {
                    addMessage('系統', '❌ 手動播放失敗');
                });
            };
            return false;
        }
    }
}

// 自動重整功能 - 當檢測到畫面切換問題時自動重整
function autoRefreshOnScreenSwitch() {
    addMessage('系統', '🔄 檢測到畫面切換，正在自動重整...');
    
    // 延遲重整，讓用戶看到訊息
    setTimeout(() => {
        addMessage('系統', '🔄 正在重新載入頁面...');
        window.location.reload();
    }, 2000);
}

// 檢測畫面切換問題
function detectScreenSwitchIssue() {
    const remoteVideo = document.getElementById('remoteVideo');
    
    // 檢查視訊是否卡住
    if (remoteVideo.srcObject && remoteVideo.srcObject.getTracks) {
        const tracks = remoteVideo.srcObject.getTracks();
        const videoTrack = tracks.find(track => track.kind === 'video');
        
        // 更保守的檢測：確保軌道已經存在一段時間且現在才結束
        if (videoTrack && videoTrack.readyState === 'ended' && window.trackEstablishmentTime) {
            const timeSinceEstablishment = Date.now() - window.trackEstablishmentTime;
            
            // 只有在軌道建立超過30秒後才認為是異常結束
            if (timeSinceEstablishment > 30000) {
                console.log('檢測到視訊軌道異常結束，可能是畫面切換問題');
                addMessage('系統', '⚠️ 檢測到視訊軌道問題，準備自動重整');
                autoRefreshOnScreenSwitch();
                return true;
            } else {
                console.log('軌道結束但建立時間太短，忽略自動重整');
            }
        }
    }
    
    return false;
}

// 添加手動重整按鈕
function addManualRefreshButton() {
    // 檢查是否已經有重整按鈕
    if (document.getElementById('manualRefreshBtn')) return;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'manualRefreshBtn';
    refreshBtn.innerHTML = '🔄 重整畫面';
    refreshBtn.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 25px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        transition: all 0.3s ease;
    `;
    
    // 懸停效果
    refreshBtn.onmouseenter = function() {
        this.style.transform = 'scale(1.05)';
        this.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
    };
    
    refreshBtn.onmouseleave = function() {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
    };
    
    // 點擊重整
    refreshBtn.onclick = function() {
        addMessage('系統', '🔄 手動重整畫面...');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    };
    
    document.body.appendChild(refreshBtn);
}

// 直播串流不需要時間格式化

// 定期檢查連接狀態
setInterval(function() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        // 發送心跳包
        socket.send(JSON.stringify({
            type: 'heartbeat',
            viewerId: viewerId,
            timestamp: Date.now()
        }));
    }
}, 30000); // 每30秒發送一次心跳包

// 定期檢查畫面切換問題
setInterval(function() {
    if (peerConnection && peerConnection.connectionState === 'connected') {
        detectScreenSwitchIssue();
    }
}, 10000); // 每10秒檢查一次

// 設置事件監聽器
function setupEventListeners() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    
    if (sendButton) {
        sendButton.addEventListener('click', function() {
            sendMessage();
        });
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    // 用戶頭像點擊事件
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar) {
        userAvatar.addEventListener('click', function() {
            if (!currentUser) {
                window.location.href = '/login.html';
            }
        });
    }
    
    console.log('事件監聽器已設置');
}

// ========== 視頻解碼修復功能 ==========

// 檢查並診斷接收器狀態 - 用於視頻解碼問題診斷
function checkAndDiagnoseReceiver() {
    if (!peerConnection) {
        console.log('🔍 [診斷] 沒有 WebRTC 連接');
        return;
    }
    
    const receivers = peerConnection.getReceivers();
    console.log('🔍 [診斷] 接收器數量:', receivers.length);
    console.log('🔍 [診斷] 連接狀態:', peerConnection.connectionState);
    console.log('🔍 [診斷] ICE狀態:', peerConnection.iceConnectionState);
    console.log('🔍 [診斷] 信號狀態:', peerConnection.signalingState);
    
    addMessage('系統', `🔍 接收器: ${receivers.length}, 連接: ${peerConnection.connectionState}`);
    
    if (receivers.length === 0) {
        console.error('🚫 [診斷] 警告：沒有檢測到任何媒體接收器！');
        addMessage('系統', '🚫 警告：沒有檢測到媒體接收器');
        
        // 嘗試重新請求 offer
        if (socket && isConnected) {
            console.log('🔄 [診斷] 請求主播重新發送串流');
            addMessage('系統', '🔄 請求主播重新發送串流');
            socket.send(JSON.stringify({
                type: 'request_stream_retry',
                viewerId: viewerId,
                timestamp: Date.now()
            }));
        }
    } else {
        receivers.forEach((receiver, index) => {
            const track = receiver.track;
            if (track) {
                console.log(`🔍 [診斷] 接收器${index}: ${track.kind} (${track.readyState})`);
                addMessage('系統', `🔍 接收器${index}: ${track.kind} - ${track.readyState}`);
                
                // 檢查軌道狀態
                if (track.readyState === 'ended') {
                    console.warn(`⚠️ [診斷] 軌道${index}已結束`);
                    addMessage('系統', `⚠️ ${track.kind}軌道已結束`);
                } else if (track.muted) {
                    console.warn(`🔇 [診斷] 軌道${index}被靜音`);
                    addMessage('系統', `🔇 ${track.kind}軌道被靜音`);
                }
            } else {
                console.log(`🔍 [診斷] 接收器${index}: 無軌道`);
                addMessage('系統', `🔍 接收器${index}: 無軌道`);
            }
        });
    }
    
    // 檢查視頻元素狀態
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo) {
        console.log('📺 [視頻元素] 狀態檢查:');
        console.log('  - srcObject:', !!remoteVideo.srcObject);
        console.log('  - readyState:', remoteVideo.readyState);
        console.log('  - paused:', remoteVideo.paused);
        console.log('  - ended:', remoteVideo.ended);
        console.log('  - networkState:', remoteVideo.networkState);
        console.log('  - videoWidth:', remoteVideo.videoWidth);
        console.log('  - videoHeight:', remoteVideo.videoHeight);
        
        addMessage('系統', `📺 視頻狀態: readyState=${remoteVideo.readyState}, paused=${remoteVideo.paused}`);
        
        if (remoteVideo.srcObject && remoteVideo.paused && remoteVideo.readyState >= 2) {
            console.log('🚀 [診斷] 視頻有數據但暫停，嘗試播放');
            addMessage('系統', '🚀 檢測到暫停的視頻，嘗試播放');
            playVideoWithSmartFallback(remoteVideo);
        }
    }
}

// 增強的視頻解碼器檢測和修復
function enhanceVideoDecodingCapability() {
    console.log('🔧 [修復] 增強視頻解碼能力...');
    
    // 檢查瀏覽器支援的視頻格式
    const video = document.createElement('video');
    const formats = [
        { name: 'H.264 Baseline', codec: 'video/mp4; codecs="avc1.42E01E"' },
        { name: 'H.264 Main', codec: 'video/mp4; codecs="avc1.4D401E"' },
        { name: 'H.264 High', codec: 'video/mp4; codecs="avc1.64001E"' },
        { name: 'VP8', codec: 'video/webm; codecs="vp8"' },
        { name: 'VP9', codec: 'video/webm; codecs="vp9"' },
        { name: 'AV1', codec: 'video/mp4; codecs="av01.0.08M.08"' }
    ];
    
    console.log('🎥 [格式支援] 檢查視頻格式支援:');
    formats.forEach(format => {
        const support = video.canPlayType(format.codec);
        console.log(`  ${format.name}: ${support || '不支援'}`);
        if (support) {
            addMessage('系統', `✅ 支援 ${format.name}`);
        }
    });
    
    // 檢查 WebRTC 編解碼器支援
    if (window.RTCRtpReceiver && RTCRtpReceiver.getCapabilities) {
        const videoCapabilities = RTCRtpReceiver.getCapabilities('video');
        if (videoCapabilities && videoCapabilities.codecs) {
            console.log('🎥 [WebRTC] 支援的視頻編解碼器:');
            videoCapabilities.codecs.forEach(codec => {
                console.log(`  ${codec.mimeType} - ${codec.clockRate || 'N/A'}Hz`);
            });
            
            // 檢查是否支援主要編解碼器
            const hasH264 = videoCapabilities.codecs.some(c => c.mimeType.includes('H264'));
            const hasVP8 = videoCapabilities.codecs.some(c => c.mimeType.includes('VP8'));
            const hasVP9 = videoCapabilities.codecs.some(c => c.mimeType.includes('VP9'));
            
            console.log('📊 [WebRTC] 主要編解碼器支援:');
            console.log(`  H.264: ${hasH264}`);
            console.log(`  VP8: ${hasVP8}`);
            console.log(`  VP9: ${hasVP9}`);
            
            if (hasH264) addMessage('系統', '✅ WebRTC 支援 H.264');
            if (hasVP8) addMessage('系統', '✅ WebRTC 支援 VP8');
            if (hasVP9) addMessage('系統', '✅ WebRTC 支援 VP9');
            
            if (!hasH264 && !hasVP8 && !hasVP9) {
                addMessage('系統', '⚠️ 未檢測到主要視頻編解碼器支援');
            }
        }
    }
    
    // 檢查硬體解碼支援
    if (navigator.mediaCapabilities) {
        const testConfigs = [
            {
                type: 'media-source',
                video: {
                    contentType: 'video/mp4; codecs="avc1.42E01E"',
                    width: 1280,
                    height: 720,
                    bitrate: 2000000,
                    framerate: 30
                }
            },
            {
                type: 'media-source', 
                video: {
                    contentType: 'video/webm; codecs="vp8"',
                    width: 1280,
                    height: 720,
                    bitrate: 2000000,
                    framerate: 30
                }
            }
        ];
        
        testConfigs.forEach(async (config, index) => {
            try {
                const result = await navigator.mediaCapabilities.decodingInfo(config);
                console.log(`🔧 [硬體解碼${index}] 配置:`, config.video.contentType);
                console.log(`  支援: ${result.supported}`);
                console.log(`  流暢: ${result.smooth}`);
                console.log(`  省電: ${result.powerEfficient}`);
                
                if (result.supported) {
                    addMessage('系統', `✅ 硬體解碼支援: ${config.video.contentType.split(';')[0]}`);
                }
            } catch (error) {
                console.warn('硬體解碼檢測失敗:', error);
            }
        });
    }
}

// 在頁面載入時執行解碼能力檢測
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        enhanceVideoDecodingCapability();
    }, 2000);
});

// 全局函數 - 手動修復視頻
window.fixVideoDecoding = function() {
    console.log('🔧 [手動修復] 開始修復視頻解碼...');
    addMessage('系統', '🔧 開始手動修復視頻解碼');
    
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo && remoteVideo.srcObject) {
        // 重新設置視頻源
        const currentStream = remoteVideo.srcObject;
        remoteVideo.srcObject = null;
        
        setTimeout(() => {
            remoteVideo.srcObject = currentStream;
            remoteVideo.load();
            addMessage('系統', '🔄 視頻源已重新設置');
            
            setTimeout(() => {
                playVideoWithSmartFallback(remoteVideo);
            }, 500);
        }, 100);
    } else {
        addMessage('系統', '⚠️ 沒有找到視頻源，請確保直播已開始');
    }
    
    // 檢查連接狀態
    setTimeout(() => {
        checkAndDiagnoseReceiver();
    }, 2000);
};

console.log('✅ 視頻解碼修復功能已載入');

// ========== 特效處理功能 ==========

// 處理主播發送的特效更新
function handleEffectUpdate(data) {
    console.log('🎨 [特效] 收到主播特效更新:', data.effect);
    addMessage('系統', `🎨 主播應用了 ${getEffectDisplayName(data.effect)} 特效`);
    
    const remoteVideo = document.getElementById('remoteVideo');
    if (!remoteVideo) {
        console.warn('⚠️ [特效] 找不到遠端視頻元素');
        return;
    }
    
    // 應用特效到觀眾端視頻
    applyViewerEffect(remoteVideo, data.effect);
}

// 在觀眾端應用特效
function applyViewerEffect(videoElement, effectType) {
    console.log('🎨 [特效] 在觀眾端應用特效:', effectType);
    
    // 清除之前的特效
    clearViewerEffect(videoElement);
    
    if (effectType === 'clear') {
        addMessage('系統', '✨ 特效已清除');
        return;
    }
    
    // 根據特效類型應用視覺效果
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
            videoElement.style.filter = 'blur(0.5px) contrast(1.1) brightness(1.05)';
            break;
        case 'bright':
            videoElement.style.filter = 'brightness(1.15) contrast(0.95) saturate(1.1)';
            break;
        case 'warm':
            videoElement.style.filter = 'sepia(0.3) saturate(1.2) hue-rotate(5deg) brightness(1.05)';
            break;
        case 'neon':
            videoElement.style.border = '3px solid #ff6b35'; // 亮橘色
            videoElement.style.boxShadow = '0 0 20px #ff6b35, inset 0 0 20px #ff6b35';
            break;
        case 'glow':
            videoElement.style.boxShadow = '0 0 30px #ff6b35'; // 亮橘色光暈
            break;
        case 'rainbow':
            videoElement.style.border = '3px solid #ff6b35';
            videoElement.style.borderImage = 'linear-gradient(45deg, #ff6b35, #feca57, #ff6b35, #feca57) 1';
            break;
        case 'particles':
            createViewerParticleEffect(videoElement);
            break;
        case 'hearts':
            createViewerHeartEffect(videoElement);
            break;
        case 'confetti':
            createViewerConfettiEffect(videoElement);
            break;
        case 'snow':
            createViewerSnowEffect(videoElement);
            break;
        default:
            console.warn('🎨 [特效] 未知特效類型:', effectType);
            return;
    }
    
    console.log('✅ [特效] 特效應用成功:', effectType);
}

// 清除觀眾端特效
function clearViewerEffect(videoElement) {
    // 清除CSS濾鏡
    videoElement.style.filter = '';
    videoElement.style.border = '';
    videoElement.style.boxShadow = '';
    videoElement.style.borderImage = '';
    
    // 清除動畫覆蓋層
    const existingOverlay = document.querySelector('.viewer-animation-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
}

// 創建觀眾端動畫特效
function createViewerAnimationOverlay(type) {
    // 移除現有的動畫覆蓋層
    const existing = document.querySelector('.viewer-animation-overlay');
    if (existing) {
        existing.remove();
    }
    
    const remoteVideo = document.getElementById('remoteVideo');
    if (!remoteVideo) return;
    
    // 創建覆蓋層容器
    const overlay = document.createElement('div');
    overlay.className = `viewer-animation-overlay ${type}`;
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 10;
        overflow: hidden;
    `;
    
    // 將覆蓋層添加到視頻容器
    const videoContainer = remoteVideo.parentElement;
    if (videoContainer) {
        // 確保容器有相對定位
        if (getComputedStyle(videoContainer).position === 'static') {
            videoContainer.style.position = 'relative';
        }
        videoContainer.appendChild(overlay);
        
        // 根據類型創建不同的動畫
        switch (type) {
            case 'particles':
                createParticles(overlay);
                break;
            case 'hearts':
                createHearts(overlay);
                break;
            case 'confetti':
                createConfetti(overlay);
                break;
            case 'snow':
                createSnow(overlay);
                break;
        }
        
        // 5秒後自動移除動畫
        setTimeout(() => {
            if (overlay.parentElement) {
                overlay.remove();
            }
        }, 5000);
    }
}

// 創建粒子效果
function createParticles(container) {
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: absolute;
                width: 4px;
                height: 4px;
                background: #ff6b35;
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: 100%;
                animation: particleFloat ${2 + Math.random() * 3}s ease-out forwards;
            `;
            container.appendChild(particle);
            
            setTimeout(() => particle.remove(), 5000);
        }, i * 100);
    }
}

// 創建愛心效果
function createHearts(container) {
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            const heart = document.createElement('div');
            heart.innerHTML = '❤️';
            heart.style.cssText = `
                position: absolute;
                font-size: ${15 + Math.random() * 10}px;
                left: ${Math.random() * 100}%;
                top: 100%;
                animation: heartFloat ${3 + Math.random() * 2}s ease-out forwards;
            `;
            container.appendChild(heart);
            
            setTimeout(() => heart.remove(), 5000);
        }, i * 200);
    }
}

// 創建彩帶效果
function createConfetti(container) {
    const colors = ['#ff6b35', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'];
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: absolute;
                width: ${3 + Math.random() * 5}px;
                height: ${8 + Math.random() * 12}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -20px;
                animation: confettiFall ${2 + Math.random() * 3}s ease-in forwards;
                transform: rotate(${Math.random() * 360}deg);
            `;
            container.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 5000);
        }, i * 50);
    }
}

// 創建雪花效果
function createSnow(container) {
    for (let i = 0; i < 25; i++) {
        setTimeout(() => {
            const snowflake = document.createElement('div');
            snowflake.innerHTML = '❄️';
            snowflake.style.cssText = `
                position: absolute;
                font-size: ${8 + Math.random() * 8}px;
                left: ${Math.random() * 100}%;
                top: -20px;
                animation: snowFall ${3 + Math.random() * 4}s linear forwards;
                opacity: 0.8;
            `;
            container.appendChild(snowflake);
            
            setTimeout(() => snowflake.remove(), 7000);
        }, i * 100);
    }
}

// 特效函數別名
function createViewerParticleEffect(videoElement) {
    createViewerAnimationOverlay('particles');
}

function createViewerHeartEffect(videoElement) {
    createViewerAnimationOverlay('hearts');
}

function createViewerConfettiEffect(videoElement) {
    createViewerAnimationOverlay('confetti');
}

function createViewerSnowEffect(videoElement) {
    createViewerAnimationOverlay('snow');
}

// 獲取特效顯示名稱
function getEffectDisplayName(effectType) {
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
        'snow': '雪花',
        'clear': '清除'
    };
    return names[effectType] || effectType;
}

// 添加動畫CSS樣式
if (!document.getElementById('viewerEffectStyles')) {
    const style = document.createElement('style');
    style.id = 'viewerEffectStyles';
    style.textContent = `
        @keyframes particleFloat {
            0% { transform: translateY(0) scale(0); opacity: 1; }
            50% { opacity: 1; }
            100% { transform: translateY(-200px) scale(1); opacity: 0; }
        }
        
        @keyframes heartFloat {
            0% { transform: translateY(0) scale(0) rotate(0deg); opacity: 1; }
            50% { opacity: 1; }
            100% { transform: translateY(-150px) scale(1.2) rotate(20deg); opacity: 0; }
        }
        
        @keyframes confettiFall {
            0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(300px) rotate(720deg); opacity: 0; }
        }
        
        @keyframes snowFall {
            0% { transform: translateY(-20px) translateX(0); opacity: 0.8; }
            100% { transform: translateY(300px) translateX(${Math.random() * 50 - 25}px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

console.log('✅ 觀眾端特效處理功能已載入');
