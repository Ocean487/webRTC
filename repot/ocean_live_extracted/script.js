// 全局變數
let localStream = null;
let baseVideoStream = null; // 原始視訊流，用於恢復及特效處理
let isStreaming = false;
let isVideoEnabled = true;
let isAudioEnabled = true;
let currentFacingMode = 'user'; // 'user' or 'environment'
let streamStartTime = null;
let durationInterval = null;
let messageCount = 0;
let viewerCount = 0;
let currentQuality = '720';
let dataTransferInterval = null;
let currentAudioOutput = 'default'; // 當前音訊輸出端
let isScreenSharing = false;
let screenShareStream = null;
let isRestoringCamera = false;

const DEVICE_STORAGE_KEYS = {
    camera: 'broadcaster_camera_device_id',
    microphone: 'broadcaster_microphone_device_id',
    audioOutput: 'broadcaster_audio_output_id'
};

if (typeof window !== 'undefined') {
    window.currentAudioOutput = currentAudioOutput;
}

function getStoredDeviceId(type) {
    const key = DEVICE_STORAGE_KEYS[type];
    if (!key || typeof localStorage === 'undefined') {
        return null;
    }
    try {
        return localStorage.getItem(key);
    } catch (err) {
        console.warn('讀取裝置偏好失敗:', err);
        return null;
    }
}

function rememberDeviceSelection(type, deviceId) {
    const key = DEVICE_STORAGE_KEYS[type];
    if (!key || typeof localStorage === 'undefined') {
        return;
    }
    try {
        if (deviceId) {
            localStorage.setItem(key, deviceId);
        }
    } catch (err) {
        console.warn('儲存裝置偏好失敗:', err);
    }
}

function populateDeviceSelect(selectEl, devices, type, placeholder) {
    console.log(`📝 [populateDeviceSelect] 開始填充 ${placeholder}:`, {
        selectEl: !!selectEl,
        deviceCount: devices.length,
        type: type
    });

    if (!selectEl) {
        console.error(`❌ ${placeholder}選擇器元素不存在 (ID: ${type}Select)`);
        return null;
    }

    // 清空現有選項
    selectEl.innerHTML = '';
    console.log(`✅ 已清空 ${placeholder} 選擇器`);

    if (!devices.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = `未找到${placeholder}`;
        option.disabled = true;
        option.selected = true;
        selectEl.appendChild(option);
        console.warn(`⚠️ 未找到任何${placeholder}裝置`);
        return null;
    }

    const storedId = getStoredDeviceId(type);
    const existingValue = selectEl.value;
    const deviceIds = devices.map(device => device.deviceId || '');

    console.log(`📋 ${placeholder} 裝置列表:`, devices.map(d => ({
        id: d.deviceId,
        label: d.label || '無標籤'
    })));

    // 添加所有設備選項
    devices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId || '';
        option.textContent = device.label || `${placeholder} ${index + 1}`;
        selectEl.appendChild(option);
    });

    console.log(`✅ 已添加 ${devices.length} 個${placeholder}選項`);

    // 選擇優先的設備
    const preferredId = [storedId, existingValue].find(id => id && deviceIds.includes(id));
    if (preferredId) {
        selectEl.value = preferredId;
        console.log(`✅ ${placeholder}已選擇儲存的裝置:`, preferredId);
    } else if (devices.length > 0) {
        selectEl.selectedIndex = 0;
        const firstDevice = devices[0];
        console.log(`✅ ${placeholder}已選擇第一個裝置:`, firstDevice.label || firstDevice.deviceId);
    }

    const finalValue = selectEl.value || null;
    if (finalValue) {
        rememberDeviceSelection(type, finalValue);
        console.log(`💾 已儲存 ${placeholder} 選擇:`, finalValue);
    }

    return finalValue;
}

// 控制直播開始延遲訊息的計時器，避免停止後又被延遲任務喚起
let streamStartTimer = null;

// 主播ID相關 - 使用 livestream-platform.js 中宣告的版本

// 獲取主播ID的函數 - 使用 livestream-platform.js 中的版本
function getBroadcasterId() {
    if (window.currentUser && window.currentUser.id) {
        myBroadcasterId = window.currentUser.id.toString();
        return myBroadcasterId;
    }
    if (currentUser && currentUser.id) {
        myBroadcasterId = currentUser.id.toString();
        return myBroadcasterId;
    }
    if (!myBroadcasterId) {
        myBroadcasterId = getBroadcasterIdFromUrl();
    }
    return myBroadcasterId;
}

// 分頁音訊相關變數
let tabAudioStream = null;
let isTabAudioEnabled = false;
let audioContext = null;
let mixedAudioStream = null;
let originalMicAudioTrack = null; // 🎵 保存原始麥克風音訊軌道

// WebSocket 連接
let streamingSocket = null;
window.streamingSocket = null; // 讓其他模組可以透過 window 訪問
let peerConnections = new Map(); // viewerId -> RTCPeerConnection

// 信令重試狀態
let pendingStreamStartPayload = null;
let lastKnownStreamTitle = '精彩直播中';
const pendingOfferQueue = new Map(); // viewerId -> offer message
const pendingIceCandidateQueue = new Map(); // viewerId -> [candidate messages]

const STREAMING_WS_DEFAULTS = [
    'wss://vibelo.l0sscat.com:8443',
    'wss://vibelo.l0sscat.com:8080',
    'ws://localhost:8443',
    'ws://localhost:8080',
    'ws://127.0.0.1:8443',
    'ws://127.0.0.1:8080'
];

function buildStreamingWebSocketCandidates() {
    const candidates = [];

    try {
        if (typeof window !== 'undefined') {
            if (Array.isArray(window.STREAMING_WS_URLS)) {
                window.STREAMING_WS_URLS.forEach((url) => {
                    if (typeof url === 'string' && url.trim()) {
                        candidates.push(url.trim());
                    }
                });
            }

            if (typeof window.STREAMING_WS_URL === 'string' && window.STREAMING_WS_URL.trim()) {
                candidates.push(window.STREAMING_WS_URL.trim());
            }

            if (window.location && window.location.host) {
                const originProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                candidates.push(`${originProtocol}//${window.location.host}`);
            }
        }
    } catch (error) {
        console.warn('⚠️ 無法建立同源 WebSocket 連線設定:', error);
    }

    STREAMING_WS_DEFAULTS.forEach((url) => candidates.push(url));

    const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
    if (!uniqueCandidates.length) {
        console.error('❌ 無可用的 WebSocket 連線候選列表');
    }
    return uniqueCandidates;
}

function createStreamStartPayload(title) {
    return {
        type: 'stream_start',
        broadcasterId: getBroadcasterId(),
        title: title || '精彩直播中',
        message: '主播已開始直播',
        timestamp: Date.now(),
        requestViewers: true
    };
}

function queueStreamStartAnnouncement(title, { forceQueue = false } = {}) {
    lastKnownStreamTitle = title || lastKnownStreamTitle || '精彩直播中';
    pendingStreamStartPayload = createStreamStartPayload(lastKnownStreamTitle);
    if (forceQueue) {
        console.log('⏳ stream_start 將在 WebSocket 連線恢復後發送');
        return;
    }
    trySendPendingStreamStart();
}

function trySendPendingStreamStart() {
    if (!pendingStreamStartPayload) {
        return;
    }
    if (!streamingSocket || streamingSocket.readyState !== WebSocket.OPEN) {
        console.warn('⚠️ streamingSocket 未連接，stream_start 暫存等待連線');
        return;
    }
    streamingSocket.send(JSON.stringify(pendingStreamStartPayload));
    console.log('✅ 已發送 stream_start (包含 requestViewers)');
    pendingStreamStartPayload = null;
}

function queueOfferForViewer(viewerId, message) {
    pendingOfferQueue.set(viewerId, message);
    console.warn(`⚠️ WebSocket 未連接，暫存觀眾 ${viewerId?.substr ? viewerId.substr(-3) : viewerId} 的 offer`);
}

function queueIceCandidateForViewer(viewerId, message) {
    if (!pendingIceCandidateQueue.has(viewerId)) {
        pendingIceCandidateQueue.set(viewerId, []);
    }
    pendingIceCandidateQueue.get(viewerId).push(message);
}

function flushPendingOffers() {
    if (!streamingSocket || streamingSocket.readyState !== WebSocket.OPEN) {
        return;
    }
    pendingOfferQueue.forEach((message, viewerId) => {
        streamingSocket.send(JSON.stringify(message));
        console.log(`📤 已補發觀眾 ${viewerId?.substr ? viewerId.substr(-3) : viewerId} 的 offer`);
        pendingOfferQueue.delete(viewerId);
    });
}

function flushPendingIceCandidates() {
    if (!streamingSocket || streamingSocket.readyState !== WebSocket.OPEN) {
        return;
    }
    pendingIceCandidateQueue.forEach((messages, viewerId) => {
        messages.forEach(candidateMessage => {
            streamingSocket.send(JSON.stringify(candidateMessage));
        });
        console.log(`🧊 已補發觀眾 ${viewerId?.substr ? viewerId.substr(-3) : viewerId} 的 ${messages.length} 筆 ICE 候選`);
        pendingIceCandidateQueue.delete(viewerId);
    });
}

function flushPendingSignalingQueue() {
    trySendPendingStreamStart();
    flushPendingOffers();
    flushPendingIceCandidates();
}

function clearPendingViewerQueues(viewerId) {
    pendingOfferQueue.delete(viewerId);
    pendingIceCandidateQueue.delete(viewerId);
}

// WebRTC 配置 - 優化視頻編碼兼容性
const constraints = {
    video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
        facingMode: 'user'
    },
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: { ideal: 48000 },
        channelCount: { ideal: 2 }
    }
};

// WebRTC 連接配置 - 增強 NAT 穿透和防火牆支援
const rtcConfiguration = {
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

// 統一初始化函數
async function initializeBroadcaster() {
    console.log('🚀 開始初始化主播端...');
    
    // 等待 DOM 完全載入
    if (document.readyState !== 'complete') {
        console.log('⏳ 等待 DOM 完全載入...');
        await new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve, { once: true });
            }
        });
    }
    
    // 立即初始化主播ID並存儲到全局
    if (!myBroadcasterId) {
        myBroadcasterId = getBroadcasterIdFromUrl();
        console.log('✅ 主播ID已初始化:', myBroadcasterId);
    }
    window.myBroadcasterId = myBroadcasterId; // 確保全局可訪問

    // 先行初始化設備列表，避免下拉選單停留在「載入中...」
    await initializeDeviceSelectors();
    
    // 首先載入用戶資料
    if (typeof loadCurrentUser === 'function') {
        const userLoaded = await loadCurrentUser();
        console.log('🔍 [DEBUG] loadCurrentUser 結果:', userLoaded);
        
        // 如果用戶未登入，停止初始化
        if (!userLoaded) {
            console.log('❌ 用戶未登入，停止初始化直播功能');
            return;
        }
    }
    
    // 檢查用戶是否已登入
    console.log('🔍 [DEBUG] 檢查 currentUser:', currentUser);
    if (!currentUser || currentUser.isGuest) {
        console.log('❌ 用戶未登入或為訪客，停止初始化直播功能');
        return;
    }
    
    console.log('✅ 用戶已登入，繼續初始化直播功能');
    if (currentUser.id) {
        myBroadcasterId = currentUser.id.toString();
        window.myBroadcasterId = myBroadcasterId;
        console.log('🎯 已使用登入用戶ID作為主播ID:', myBroadcasterId);
    }

    // 再次刷新裝置列表（確保權限授權後取得完整標籤）
    await initializeDeviceSelectors(true);
    simulateInitialActivity();
    
    // 初始化標題輸入
    const titleInput = document.getElementById('streamTitleInput');
    if (titleInput && typeof currentStreamTitle !== 'undefined') {
        titleInput.value = currentStreamTitle;
    }
    
    // 統一建立 WebSocket 連接（替代多個連接）
    console.log('🔍 [DEBUG] 準備調用 connectToStreamingServer');
    connectToStreamingServer();
    
    // ❌ 移除這裡的 initializeChat()，改在 WebSocket 連接成功後才調用
    // initializeChat(); // 已移至 connectToStreamingServer 的 onopen 事件中
    
    // 🎵 初始化分頁音訊重連管理器
    setTimeout(() => {
        if (window.tabAudioReconnectManager && streamingSocket) {
            window.tabAudioReconnectManager.initialize(streamingSocket, myBroadcasterId || 'unknown');
            console.log('✅ 分頁音訊重連管理器已初始化');
        }
    }, 1000);
    
    // 初始化標題 WebSocket（延遲，避免衝突）
    setTimeout(() => {
        if (typeof initTitleWebSocket === 'function') {
            initTitleWebSocket();
        }
    }, 2000);
    
    // 延遲視頻編碼優化
    setTimeout(() => {
        optimizeVideoEncodingForCompatibility();
    }, 3000);
    
    // 載入其他主播列表
    setTimeout(() => {
        if (typeof loadOtherBroadcasters === 'function') {
            loadOtherBroadcasters();
        }
    }, 4000);
    
    console.log('✅ 主播端初始化完成');
}

// 主初始化
document.addEventListener('DOMContentLoaded', initializeBroadcaster);

// 確保音訊軌道正確啟用
function ensureAudioTracksEnabled(stream) {
    if (!stream) return;
    
    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach(track => {
        if (track.readyState === 'live') {
            track.enabled = true;
            console.log('音訊軌道已啟用:', track.id, '狀態:', track.readyState);
        } else {
            console.warn('音訊軌道狀態異常:', track.id, '狀態:', track.readyState);
        }
    });
}

// 檢查音訊輸出端支援
function checkAudioOutputSupport() {
    const localVideo = document.getElementById('localVideo');
    if (!localVideo.setSinkId) {
        addMessage('系統', '⚠️ 您的瀏覽器不支援音訊輸出端切換功能，將使用預設輸出端');
        console.warn('瀏覽器不支援 setSinkId API');
        return false;
    }
    
    // 檢查是否支援音訊輸出端列舉
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        addMessage('系統', '⚠️ 您的瀏覽器不支援裝置列舉功能');
        console.warn('瀏覽器不支援 enumerateDevices API');
        return false;
    }
    
    console.log('音訊輸出端功能支援正常');
    return true;
}

// 載入可用裝置
async function loadDevices(forceRefresh = false) {
    console.log('🔍 [loadDevices] 開始載入裝置...', { forceRefresh });

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== 'function') {
        console.error('❌ 瀏覽器不支援裝置列舉');
        return;
    }

    // 驗證 DOM 元素存在
    const cameraSelect = document.getElementById('cameraSelect');
    const microphoneSelect = document.getElementById('microphoneSelect');
    const audioOutputSelect = document.getElementById('audioOutputSelect');
    
    console.log('🔍 [loadDevices] DOM 元素檢查:', {
        cameraSelect: !!cameraSelect,
        microphoneSelect: !!microphoneSelect,
        audioOutputSelect: !!audioOutputSelect
    });

    if (!cameraSelect || !microphoneSelect || !audioOutputSelect) {
        console.error('❌ 設備選擇器元素不存在，延遲 500ms 後重試...');
        setTimeout(() => loadDevices(forceRefresh), 500);
        return;
    }

    try {
        let devices = await navigator.mediaDevices.enumerateDevices();
        console.log(`📋 初始裝置列表 (${devices.length} 個):`, devices.map(d => ({
            kind: d.kind,
            label: d.label || '(無標籤)',
            deviceId: d.deviceId
        })));

        let hasLabels = devices.some(device => !!device.label);
        console.log('🏷️ 裝置標籤狀態:', hasLabels ? '已有標籤' : '無標籤');

        const shouldAttemptPermission = (!hasLabels && !window.__deviceLabelAttempted) || (forceRefresh && !hasLabels);
        if (shouldAttemptPermission && typeof navigator.mediaDevices.getUserMedia === 'function') {
            console.log('🔐 嘗試請求裝置權限以獲取標籤...');
            try {
                window.__deviceLabelAttempted = true;
                const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                console.log('✅ 權限請求成功，停止臨時流');
                tempStream.getTracks().forEach(track => track.stop());
                devices = await navigator.mediaDevices.enumerateDevices();
                hasLabels = devices.some(device => !!device.label);
                console.log(`📋 重新列舉裝置 (${devices.length} 個):`, devices.map(d => ({
                    kind: d.kind,
                    label: d.label || '(無標籤)',
                    deviceId: d.deviceId
                })));
            } catch (permError) {
                console.warn('⚠️ 無法預先取得裝置權限:', permError);
            }
        }

        const cameras = devices.filter(device => device.kind === 'videoinput');
        const microphones = devices.filter(device => device.kind === 'audioinput');
        const audioOutputs = devices
            .filter(device => device.kind === 'audiooutput')
            .map(device => ({ deviceId: device.deviceId || 'default', label: device.label }));

        console.log('📊 裝置統計:', {
            cameras: cameras.length,
            microphones: microphones.length,
            audioOutputs: audioOutputs.length
        });

        if (!audioOutputs.some(output => output.deviceId === 'default')) {
            audioOutputs.unshift({ deviceId: 'default', label: '預設音訊輸出端' });
            console.log('➕ 添加預設音訊輸出端');
        }

        console.log('📝 開始填充設備選擇器...');
        const selectedCamera = populateDeviceSelect(cameraSelect, cameras, 'camera', '攝影機');
        const selectedMicrophone = populateDeviceSelect(microphoneSelect, microphones, 'microphone', '麥克風');

        let selectedOutput = null;
        if (audioOutputSelect) {
            selectedOutput = populateDeviceSelect(audioOutputSelect, audioOutputs, 'audioOutput', '音訊輸出端');
        }

        if (selectedCamera) {
            rememberDeviceSelection('camera', selectedCamera);
        }
        if (selectedMicrophone) {
            rememberDeviceSelection('microphone', selectedMicrophone);
        }
        if (selectedOutput) {
            rememberDeviceSelection('audioOutput', selectedOutput);
            currentAudioOutput = selectedOutput;
        } else if (!currentAudioOutput) {
            currentAudioOutput = 'default';
        }

        window.currentAudioOutput = currentAudioOutput;

        console.log('📊 設備檢測完成:', {
            攝影機: cameras.length,
            麥克風: microphones.length,
            音訊輸出: audioOutputs.length,
            已選擇攝影機: selectedCamera,
            已選擇麥克風: selectedMicrophone,
            已選擇音訊輸出: selectedOutput
        });

        // 在控制台顯示載入的裝置詳情
        console.log('📹 攝影機列表:', cameras.map(c => ({ id: c.deviceId, label: c.label })));
        console.log('🎤 麥克風列表:', microphones.map(m => ({ id: m.deviceId, label: m.label })));
        console.log('🔊 音訊輸出列表:', audioOutputs.map(o => ({ id: o.deviceId, label: o.label })));

        if (!hasLabels && typeof addMessage === 'function') {
            addMessage('系統', '⚠️ 無法取得裝置名稱，可能未授權存取裝置');
        } else if (hasLabels) {
            console.log('✅ 成功取得所有裝置標籤');
        }

    } catch (error) {
        console.error('無法載入裝置列表:', error);
        if (typeof addMessage === 'function') {
            addMessage('系統', '⚠️ 無法檢測音視訊裝置，請檢查瀏覽器權限');
        }
    }
}

async function initializeDeviceSelectors(forceRefresh = false) {
    console.log('🚦 [initializeDeviceSelectors] 執行', { forceRefresh });

    if (!navigator.mediaDevices) {
        console.warn('⚠️ mediaDevices API 不支援，無法初始化設備選擇器');
        return;
    }

    const canRequestPermission = typeof navigator.mediaDevices.getUserMedia === 'function';
    if (canRequestPermission && !window.__devicePermissionRequested) {
        window.__devicePermissionRequested = true;
        try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            console.log('✅ (initializeDeviceSelectors) 已取得裝置權限');
            tempStream.getTracks().forEach(track => track.stop());
        } catch (err) {
            console.warn('⚠️ (initializeDeviceSelectors) 無法預先取得裝置權限:', err);
        }
    }

    await loadDevices(forceRefresh);

    if (!window.__deviceChangeListenerRegistered) {
        const handleDeviceChange = () => initializeDeviceSelectors(true);
        if (typeof navigator.mediaDevices.addEventListener === 'function') {
            navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        } else {
            navigator.mediaDevices.ondevicechange = handleDeviceChange;
        }
        window.__deviceChangeListenerRegistered = true;
        console.log('🔄 已註冊裝置變更監聽器');
    }

    checkAudioOutputSupport();
}

// 初始化聊天系統
function initializeChat() {
    console.log('初始化聊天系統...');
    if (window.chatSystem) {
        console.log('聊天系統已存在');
        return;
    }
    
    if (typeof ChatSystem === 'undefined') {
        console.error('ChatSystem 類未定義，請確保 chat-system.js 已加載');
        return;
    }
    
    window.chatSystem = new ChatSystem({
        isStreamer: true,
        socket: streamingSocket,
        selectors: {
            chatContainer: '#chatMessages',
            messageInput: '#messageInput',
            sendButton: '.btn-send'
        }
    });
    
    console.log('聊天系統初始化完成');
}

// 開始/停止直播
async function toggleStream() {
    // 檢查用戶是否已登入
    if (!currentUser || currentUser.isGuest) {
        console.log('❌ 用戶未登入，無法使用直播功能');
        addMessage('系統', '❌ 請先登入才能使用直播功能');
        return;
    }
    
    if (!isStreaming) {
        await startStream();
    } else {
        stopStream();
    }
}

// 開始直播
async function startStream() {
    // 檢查用戶是否已登入
    if (!currentUser || currentUser.isGuest) {
        console.log('❌ 用戶未登入，無法開始直播');
        addMessage('系統', '❌ 請先登入才能開始直播');
        return;
    }
    
    try {
        // 簡化的流獲取 - 只獲取攝影機和麥克風
        // YouTube音訊將通過系統音效混入
        const userStream = await navigator.mediaDevices.getUserMedia(getConstraints());
        
        localStream = userStream;
        
        // 顯示本地視訊
        const localVideo = document.getElementById('localVideo');
        const placeholder = document.getElementById('previewPlaceholder');
        
        localVideo.srcObject = localStream;
        if (localVideo.setSinkId && currentAudioOutput) {
            try {
                await localVideo.setSinkId(currentAudioOutput);
                console.log('音訊輸出端已套用至直播視訊元素:', currentAudioOutput);
            } catch (sinkError) {
                console.warn('無法套用指定音訊輸出端:', sinkError);
            }
        }
        localVideo.style.display = 'block';
        placeholder.style.display = 'none';

        // 確保音訊軌道正確啟用
        ensureAudioTracksEnabled(localStream);

        console.log('直播流已啟動，YouTube音訊將通過系統音效混入');

        // 設置音訊輸出端（如果已選擇）
        if (currentAudioOutput && currentAudioOutput !== 'default') {
            try {
                if (localVideo.setSinkId) {
                    await localVideo.setSinkId(currentAudioOutput);
                    console.log('已設置音訊輸出端:', currentAudioOutput);
                    
                    // 獲取裝置名稱並顯示
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const selectedDevice = devices.find(device => 
                        device.kind === 'audiooutput' && device.deviceId === currentAudioOutput
                    );
                    const deviceName = selectedDevice ? selectedDevice.label : '預設音訊輸出端';
                    addMessage('系統', `🔊 音訊輸出端已設置為: ${deviceName}`);
                    
                    // 確保音訊播放
                    try {
                        await localVideo.play();
                        console.log('音訊已開始播放');
                    } catch (playError) {
                        console.warn('自動播放失敗:', playError);
                        addMessage('系統', '⚠️ 請點擊視訊畫面以開始播放音訊');
                    }
                }
            } catch (error) {
                console.warn('設置音訊輸出端失敗:', error);
                addMessage('系統', '⚠️ 音訊輸出端設置失敗，使用預設輸出端');
            }
        } else {
            // addMessage('系統', '🔊 使用預設音訊輸出端');
            
            // 確保音訊播放
            try {
                await localVideo.play();
                console.log('音訊已開始播放');
            } catch (playError) {
                console.warn('自動播放失敗:', playError);
                addMessage('系統', '⚠️ 請點擊視訊畫面以開始播放音訊');
            }
        }

        // 更新 UI 狀態
        isStreaming = true;
        window.isStreaming = isStreaming; // 確保全局可訪問
        window.localStream = localStream; // 確保全局可訪問
        console.log('🎬 [STREAM START] isStreaming 設置為 true, localStream:', localStream ? '已建立' : '未建立');
        console.log('🎬 [STREAM START] localStream 軌道數量:', localStream ? localStream.getTracks().length : 0);
        updateStreamStatus(true);
        startStreamTimer();
        // simulateViewers();

        addMessage('系統', '🎉 直播已開始！觀眾可以看到你的畫面了');

        // 模擬數據傳輸
        simulateDataTransfer();
        
        // 確保 WebSocket 連接已建立（通常已在頁面載入時建立）
        if (!streamingSocket || streamingSocket.readyState !== WebSocket.OPEN) {
            connectToStreamingServer();
        }
        
        // 等待 WebSocket 連接建立後通知服務器直播已開始
        streamStartTimer = setTimeout(() => {
            if (!isStreaming) {
                console.log('🛑 已停止直播，取消延遲的 stream_start 動作');
                return;
            }

            const titleInput = document.getElementById('streamTitleInput');
            const streamTitle = titleInput ? titleInput.value.trim() : '';
            const finalTitle = streamTitle || '精彩直播中';

            if (titleInput && !streamTitle) {
                titleInput.value = finalTitle;
            }

            updateStreamTitle();
            lastKnownStreamTitle = finalTitle;

            if (!streamingSocket || streamingSocket.readyState !== WebSocket.OPEN) {
                console.warn('⚠️ streamingSocket 未連接，將於重連後發送 stream_start');
                connectToStreamingServer();
            }

            console.log('發送直播開始事件，標題:', finalTitle);
            console.log('🎬 [STREAM START] 準備公告 stream_start，當前 isStreaming:', isStreaming);
            console.log('🎬 [STREAM START] localStream 狀態:', localStream ? '存在' : '不存在');

            queueStreamStartAnnouncement(finalTitle);
            addMessage('系統', `標題: ${finalTitle}`);
        }, 1000);

    } catch (error) {
        console.error('無法啟動直播:', error);
        
        let errorMessage = '無法啟動直播: ';
        if (error.name === 'NotAllowedError') {
            errorMessage += '請允許存取攝影機和麥克風權限';
        } else if (error.name === 'NotFoundError') {
            errorMessage += '找不到攝影機或麥克風裝置';
        } else {
            errorMessage += error.message;
        }
        
        addMessage('系統', '❌ ' + errorMessage);
        
        // 顯示權限請求提示
        showPermissionRequest();
    }
}

// 停止直播
function stopStream() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (screenShareStream) {
        screenShareStream.getTracks().forEach(track => {
            if (track.readyState === 'live') {
                track.stop();
            }
        });
    }

    isScreenSharing = false;
    screenShareStream = null;
    isRestoringCamera = false;
    window.isScreenSharing = false;
    window.screenShareStream = null;

    // 清除可能尚未執行的延遲發送計時器，避免誤觸重新開始
    if (streamStartTimer) {
        clearTimeout(streamStartTimer);
        streamStartTimer = null;
    }

    // 隱藏視訊，顯示預覽
    const localVideo = document.getElementById('localVideo');
    const placeholder = document.getElementById('previewPlaceholder');
    
    localVideo.style.display = 'none';
    placeholder.style.display = 'flex';

    // 重置狀態
    isStreaming = false;
    updateStreamStatus(false);
    stopStreamTimer();
    resetStats();
    
    // 關閉所有 WebRTC 連接
    peerConnections.forEach(connection => {
        connection.close();
    });
    peerConnections.clear();
    pendingOfferQueue.clear();
    pendingIceCandidateQueue.clear();
    pendingStreamStartPayload = null;
    
    // 通知服務器直播結束
    if (streamingSocket) {
        streamingSocket.send(JSON.stringify({
            type: 'stream_end',
            broadcasterId: getBroadcasterId()
        }));
    }

    addMessage('系統', '📺 直播已結束，感謝觀看！');
}

// 獲取約束條件
function getConstraints() {
    const quality = getQualitySettings(currentQuality);
    const cameraSelectEl = document.getElementById('cameraSelect');
    const microphoneSelectEl = document.getElementById('microphoneSelect');
    const selectedCameraId = cameraSelectEl ? cameraSelectEl.value : getStoredDeviceId('camera');
    const selectedMicrophoneId = microphoneSelectEl ? microphoneSelectEl.value : getStoredDeviceId('microphone');
    return {
        video: {
            ...quality,
            facingMode: currentFacingMode,
            deviceId: selectedCameraId || undefined
        },
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            deviceId: selectedMicrophoneId || undefined
        }
    };
}

// 獲取畫質設定
function getQualitySettings(quality) {
    const settings = {
        '480': { width: { ideal: 854 }, height: { ideal: 480 } },
        '720': { width: { ideal: 1280 }, height: { ideal: 720 } },
        '1080': { width: { ideal: 1920 }, height: { ideal: 1080 } }
    };
    return settings[quality] || settings['720'];
}

// 切換視訊
async function toggleVideo() {
    if (!localStream) return;

    const videoTracks = localStream.getVideoTracks();
    videoTracks.forEach(track => {
        track.enabled = !track.enabled;
    });

    isVideoEnabled = !isVideoEnabled;
    const btn = document.getElementById('videoBtn');
    btn.textContent = isVideoEnabled ? '📹 關閉視訊' : '📹 開啟視訊';

    addMessage('系統', isVideoEnabled ? '📹 視訊已開啟' : '📹 視訊已關閉');
    
    // 更新所有觀眾的軌道狀態
    if (isStreaming) {
        const viewerIds = Array.from(peerConnections.keys());
        for (const viewerId of viewerIds) {
            await updatePeerConnectionTracks(viewerId);
        }
    }
}

// 切換音訊
async function toggleAudio() {
    if (!localStream) return;

    const audioTracks = localStream.getAudioTracks();
    audioTracks.forEach(track => {
        track.enabled = !track.enabled;
    });

    isAudioEnabled = !isAudioEnabled;
    const btn = document.getElementById('audioBtn');
    btn.textContent = isAudioEnabled ? '🎤 關閉音訊' : '🎤 開啟音訊';

    addMessage('系統', isAudioEnabled ? '🎤 音訊已開啟' : '🎤 音訊已關閉');
    
    // 更新所有觀眾的軌道狀態
    if (isStreaming) {
        const viewerIds = Array.from(peerConnections.keys());
        for (const viewerId of viewerIds) {
            await updatePeerConnectionTracks(viewerId);
        }
    }
}

// 切換鏡頭
async function switchCamera() {
    if (!isStreaming) return;

    try {
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        
        // 保存當前的音訊軌道
        const currentAudioTrack = localStream ? localStream.getAudioTracks()[0] : null;
        
        // 只停止視訊軌道，保持音訊軌道
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            videoTracks.forEach(track => track.stop());
        }

        // 重新取得媒體串流（只包含視訊）
        const videoConstraints = getConstraints();
        const newVideoStream = await navigator.mediaDevices.getUserMedia(videoConstraints);
        
        // 創建新的串流，包含新的視訊軌道和原有的音訊軌道
        const newStream = new MediaStream();
        
        // 添加新的視訊軌道
        newVideoStream.getVideoTracks().forEach(track => {
            newStream.addTrack(track);
        });
        
        // 保持原有的音訊軌道
        if (currentAudioTrack && currentAudioTrack.readyState === 'live') {
            newStream.addTrack(currentAudioTrack);
            console.log('保持原有音訊軌道，軌道ID:', currentAudioTrack.id);
        }
        
        // 更新本地串流
        localStream = newStream;
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;
        
        // 確保音訊軌道啟用
        const newAudioTracks4 = localStream.getAudioTracks();
        newAudioTracks4.forEach(track => {
            track.enabled = true;
            console.log('音訊軌道已啟用:', track.id, '狀態:', track.readyState);
        });

        // 重新設置音訊輸出端
        if (currentAudioOutput && currentAudioOutput !== 'default') {
            try {
                const localVideo = document.getElementById('localVideo');
                if (localVideo.setSinkId) {
                    await localVideo.setSinkId(currentAudioOutput);
                    console.log('已重新設置音訊輸出端:', currentAudioOutput);
                }
            } catch (error) {
                console.warn('重新設置音訊輸出端失敗:', error);
            }
        }

        const cameraType = currentFacingMode === 'user' ? '前鏡頭' : '後鏡頭';
        addMessage('系統', `🔄 已切換到${cameraType}，音訊保持不變`);
        
        // 更新所有 WebRTC 連接的軌道
        await updateAllPeerConnections();
    } catch (error) {
        console.error('切換鏡頭失敗:', error);
        addMessage('系統', '❌ 鏡頭切換失敗');
    }
}

// 分享螢幕
async function shareScreen() {
    try {
        if (isRestoringCamera) {
            addMessage('系統', '⚠️ 正在恢復攝影機，請稍候再試');
            return;
        }

        if (isScreenSharing) {
            addMessage('系統', '⚠️ 已在進行螢幕分享');
            return;
        }

        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { 
                cursor: 'always',
                displaySurface: 'monitor'
            },
            audio: true
        });

        screenShareStream = screenStream;
        isScreenSharing = true;
        window.screenShareStream = screenShareStream;
        window.isScreenSharing = isScreenSharing;

        // 保存當前的音訊軌道（如果有的話）
        const currentAudioTracks = localStream
            ? localStream.getAudioTracks().filter(track => track.readyState === 'live')
            : [];
        
        // 只停止視訊軌道，保持音訊軌道
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            videoTracks.forEach(track => track.stop());
        }

        // 創建新的串流，包含螢幕分享的視訊軌道和原有的音訊軌道
        const newStream = new MediaStream();
        
        // 添加螢幕分享的視訊軌道
        screenStream.getVideoTracks().forEach(track => {
            newStream.addTrack(track);
        });
        
        // 保持原有的音訊軌道（如果存在且有效）
        if (currentAudioTracks.length > 0) {
            currentAudioTracks.forEach(track => {
                newStream.addTrack(track);
                console.log('保持原有音訊軌道，軌道ID:', track.id);
            });
        } else {
            // 如果沒有原有音訊軌道，添加螢幕分享的音訊軌道
            screenStream.getAudioTracks().forEach(track => {
                newStream.addTrack(track);
            });
        }

        // 更新本地串流並設置到視訊元素
        localStream = newStream;
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;
        window.localStream = localStream;
        baseVideoStream = null;
        
        // 確保音訊軌道啟用
        const newAudioTracks = localStream.getAudioTracks();
        newAudioTracks.forEach(track => {
            track.enabled = true;
            console.log('音訊軌道已啟用:', track.id, '狀態:', track.readyState);
        });

        // 重新設置音訊輸出端
        if (currentAudioOutput && currentAudioOutput !== 'default') {
            try {
                const localVideo = document.getElementById('localVideo');
                if (localVideo.setSinkId) {
                    await localVideo.setSinkId(currentAudioOutput);
                    console.log('已重新設置音訊輸出端:', currentAudioOutput);
                }
            } catch (error) {
                console.warn('重新設置音訊輸出端失敗:', error);
            }
        }

        addMessage('系統', '🖥️ 螢幕分享已開始，音訊保持不變');

        // 監聽螢幕分享結束
        screenStream.getVideoTracks().forEach(track => {
            track.addEventListener('ended', () => {
                console.log('🖥️ 螢幕分享視訊軌道已結束');
                addMessage('系統', '🖥️ 螢幕分享已結束');
                restoreCameraAfterScreenShare();
            }, { once: true });
        });

        // 更新所有觀眾的軌道
        if (isStreaming) {
            await updateAllPeerConnections();
        }

    } catch (error) {
        console.error('螢幕分享失敗:', error);
        addMessage('系統', '❌ 螢幕分享失敗');
        if (screenShareStream) {
            screenShareStream.getTracks().forEach(track => {
                if (track.readyState === 'live') {
                    track.stop();
                }
            });
        }
        isScreenSharing = false;
        screenShareStream = null;
        window.isScreenSharing = isScreenSharing;
        window.screenShareStream = null;
    }
}

async function restoreCameraAfterScreenShare() {
    if (!isScreenSharing || isRestoringCamera) {
        return;
    }

    isRestoringCamera = true;

    try {
        const constraints = getConstraints();
        let cameraStream;
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: constraints.video,
                audio: false
            });
        } catch (error) {
            console.error('恢復攝影機失敗:', error);
            addMessage('系統', '❌ 螢幕分享結束後無法恢復攝影機');
            return;
        }

        const newStream = new MediaStream();
        cameraStream.getVideoTracks().forEach(track => newStream.addTrack(track));

        let liveAudioTracks = [];
        if (localStream) {
            liveAudioTracks = localStream.getAudioTracks().filter(track => track.readyState === 'live');
        }

        if (liveAudioTracks.length === 0) {
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: constraints.audio,
                    video: false
                });
                liveAudioTracks = audioStream.getAudioTracks();
            } catch (audioError) {
                console.warn('恢復音訊軌道失敗:', audioError);
            }
        }

        liveAudioTracks.forEach(track => newStream.addTrack(track));

        if (screenShareStream) {
            screenShareStream.getTracks().forEach(track => {
                if (track.readyState === 'live') {
                    track.stop();
                }
            });
        }

        localStream = newStream;
        window.localStream = newStream;

        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.srcObject = newStream;
            localVideo.style.display = 'block';
            try {
                await localVideo.play();
            } catch (playError) {
                console.warn('恢復攝影機時自動播放失敗:', playError);
            }

            if (currentAudioOutput && currentAudioOutput !== 'default' && localVideo.setSinkId) {
                try {
                    await localVideo.setSinkId(currentAudioOutput);
                } catch (sinkError) {
                    console.warn('恢復攝影機時設置音訊輸出端失敗:', sinkError);
                }
            }
        }

        ensureAudioTracksEnabled(newStream);
        baseVideoStream = null;
        isVideoEnabled = true;

        const videoBtn = document.getElementById('videoBtn');
        if (videoBtn) {
            videoBtn.textContent = '📹 關閉視訊';
        }

        addMessage('系統', '📷 已切回攝影機畫面');

        if (isStreaming) {
            await updateAllPeerConnections();
        }
    } finally {
        isScreenSharing = false;
        screenShareStream = null;
        isRestoringCamera = false;
        window.isScreenSharing = isScreenSharing;
        window.screenShareStream = null;
    }
}

// 切換畫質
async function changeQuality() {
    if (!isStreaming) {
        currentQuality = document.getElementById('qualitySelect').value;
        document.getElementById('currentQuality').textContent = currentQuality + 'p';
        return;
    }

    try {
        currentQuality = document.getElementById('qualitySelect').value;
        
        // 保存當前的音訊軌道
        const currentAudioTrack = localStream ? localStream.getAudioTracks()[0] : null;
        
        // 只重新配置視訊軌道
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            const quality = getQualitySettings(currentQuality);
            await videoTracks[0].applyConstraints(quality);
            document.getElementById('currentQuality').textContent = currentQuality + 'p';
            addMessage('系統', `📺 畫質已切換為 ${currentQuality}p，音訊保持不變`);
        }

    } catch (error) {
        console.error('畫質切換失敗:', error);
        addMessage('系統', '❌ 畫質切換失敗');
    }
}

// 切換視訊裝置
async function switchVideoDevice() {
    const cameraSelect = document.getElementById('cameraSelect');
    if (!cameraSelect) {
        console.warn('找不到攝影機選擇器');
        return;
    }

    rememberDeviceSelection('camera', cameraSelect.value);

    if (!isStreaming) return;

    try {
        // 保存當前的音訊軌道
        const currentAudioTrack = localStream ? localStream.getAudioTracks()[0] : null;
        
        // 只停止視訊軌道
        const videoTracks = localStream.getVideoTracks();
        videoTracks.forEach(track => track.stop());

        const newStream = await navigator.mediaDevices.getUserMedia({
            video: {
                ...getQualitySettings(currentQuality),
                deviceId: cameraSelect.value
            },
            audio: false
        });

        // 創建新的串流，包含新的視訊軌道和原有的音訊軌道
        const combinedStream = new MediaStream();
        
        // 添加新的視訊軌道
        newStream.getVideoTracks().forEach(track => {
            combinedStream.addTrack(track);
        });
        
        // 保持原有的音訊軌道
        if (currentAudioTrack && currentAudioTrack.readyState === 'live') {
            combinedStream.addTrack(currentAudioTrack);
            console.log('保持原有音訊軌道，軌道ID:', currentAudioTrack.id);
        }

        // 更新本地串流
        localStream = combinedStream;
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;
        
        // 確保音訊軌道啟用
        const newAudioTracks2 = localStream.getAudioTracks();
        newAudioTracks2.forEach(track => {
            track.enabled = true;
            console.log('音訊軌道已啟用:', track.id, '狀態:', track.readyState);
        });

        // 重新設置音訊輸出端
        if (currentAudioOutput && currentAudioOutput !== 'default') {
            try {
                const localVideo = document.getElementById('localVideo');
                if (localVideo.setSinkId) {
                    await localVideo.setSinkId(currentAudioOutput);
                    console.log('已重新設置音訊輸出端:', currentAudioOutput);
                }
            } catch (error) {
                console.warn('重新設置音訊輸出端失敗:', error);
            }
        }
        
        addMessage('系統', '📹 攝影機已切換，音訊保持不變');

        // 更新所有觀眾的軌道
        if (isStreaming) {
            await updateAllPeerConnections();
        }

    } catch (error) {
        console.error('攝影機切換失敗:', error);
        addMessage('系統', '❌ 攝影機切換失敗');
    }
}

// 檢查當前音訊輸出端狀態
async function checkAudioOutputStatus() {
    try {
        const localVideo = document.getElementById('localVideo');
        
        if (!localVideo.setSinkId) {
            addMessage('系統', '⚠️ 瀏覽器不支援音訊輸出端切換');
            return;
        }
        
        // 獲取當前音訊輸出端
        const currentSinkId = localVideo.sinkId || 'default';
        
        // 獲取所有音訊輸出端
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
        
        // 找到當前使用的輸出端
        const currentDevice = audioOutputs.find(device => device.deviceId === currentSinkId);
        const deviceName = currentDevice ? currentDevice.label : '預設音訊輸出端';
        
        // 檢查音訊軌道狀態
        const audioTracks = localStream ? localStream.getAudioTracks() : [];
        const enabledTracks = audioTracks.filter(track => track.enabled);
        
        let statusMessage = `🔊 當前音訊輸出端: ${deviceName}\n`;
        statusMessage += `📊 音訊軌道: ${audioTracks.length} 個 (${enabledTracks.length} 個啟用)\n`;
        statusMessage += `▶️ 播放狀態: ${localVideo.paused ? '暫停' : '播放中'}\n`;
        statusMessage += `🔊 音量: ${Math.round(localVideo.volume * 100)}%`;
        
        addMessage('系統', statusMessage);
        
        console.log('音訊輸出端狀態:', {
            sinkId: currentSinkId,
            deviceName: deviceName,
            audioTracks: audioTracks.length,
            enabledTracks: enabledTracks.length,
            paused: localVideo.paused,
            volume: localVideo.volume
        });
        
    } catch (error) {
        console.error('檢查音訊輸出端狀態失敗:', error);
        addMessage('系統', '❌ 檢查音訊輸出端狀態失敗');
    }
}

// 測試音訊輸出端
async function testAudioOutput() {
    try {
        const selectedOutputId = document.getElementById('audioOutputSelect').value;
        const localVideo = document.getElementById('localVideo');
        
        if (!localVideo.setSinkId) {
            addMessage('系統', '⚠️ 您的瀏覽器不支援音訊輸出端切換功能');
            return;
        }

        // 如果正在直播，使用實際的視訊元素測試
        if (isStreaming && localStream) {
            try {
                // 切換到選擇的音訊輸出端
                await localVideo.setSinkId(selectedOutputId);
                
                // 獲取裝置名稱
                const devices = await navigator.mediaDevices.enumerateDevices();
                const selectedDevice = devices.find(device => 
                    device.kind === 'audiooutput' && device.deviceId === selectedOutputId
                );
                const deviceName = selectedDevice ? selectedDevice.label : '預設音訊輸出端';
                
                addMessage('系統', `🔊 正在測試音訊輸出端: ${deviceName}`);
                
                // 確保視訊播放
                if (localVideo.paused) {
                    await localVideo.play();
                }
                
                // 3秒後恢復原來的輸出端
                setTimeout(async () => {
                    if (currentAudioOutput && currentAudioOutput !== 'default') {
                        await localVideo.setSinkId(currentAudioOutput);
                    }
                    addMessage('系統', '🔊 音訊測試完成，已恢復原輸出端');
                }, 3000);
                
            } catch (error) {
                console.error('音訊測試失敗:', error);
                addMessage('系統', '❌ 音訊測試失敗: ' + error.message);
            }
        } else {
            // 如果沒有直播，創建測試音訊
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 音符
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // 降低音量
            
            oscillator.start();
            
            // 播放 1 秒後停止
            setTimeout(() => {
                oscillator.stop();
                addMessage('系統', '🔊 音訊測試完成');
            }, 1000);
        }
        
    } catch (error) {
        console.error('音訊測試失敗:', error);
        addMessage('系統', '❌ 音訊測試失敗');
    }
}

// 切換音訊輸出端
async function switchAudioOutput() {
    try {
        const audioOutputSelect = document.getElementById('audioOutputSelect');
        if (!audioOutputSelect) {
            console.warn('找不到音訊輸出選擇器');
            return;
        }

        const selectedOutputId = audioOutputSelect.value;
        rememberDeviceSelection('audioOutput', selectedOutputId);
        const localVideo = document.getElementById('localVideo');
        
        // 檢查瀏覽器是否支援 setSinkId
        if (!localVideo.setSinkId) {
            addMessage('系統', '⚠️ 您的瀏覽器不支援音訊輸出端切換功能');
            return;
        }

        if (!isStreaming) {
            currentAudioOutput = selectedOutputId;
            addMessage('系統', '🔊 音訊輸出端已設定，開始直播後生效');
            return;
        }

        // 切換音訊輸出端
        await localVideo.setSinkId(selectedOutputId);
        currentAudioOutput = selectedOutputId;
        
        // 獲取裝置名稱
        const devices = await navigator.mediaDevices.enumerateDevices();
        const selectedDevice = devices.find(device => 
            device.kind === 'audiooutput' && device.deviceId === selectedOutputId
        );
        const deviceName = selectedDevice ? selectedDevice.label : '預設音訊輸出端';
        
        addMessage('系統', `🔊 音訊輸出端已切換至: ${deviceName}`);
        
        console.log('音訊輸出端已切換至:', deviceName, 'ID:', selectedOutputId);
        
        // 確保音訊播放
        if (localVideo.paused) {
            try {
                await localVideo.play();
                console.log('音訊已開始播放');
                addMessage('系統', '▶️ 音訊已開始播放');
            } catch (error) {
                console.warn('自動播放失敗:', error);
                addMessage('系統', '⚠️ 請點擊視訊畫面以開始播放音訊');
            }
        } else {
            console.log('視訊已在播放中');
        }
        
        // 檢查音訊軌道狀態
        const audioTracks = localStream ? localStream.getAudioTracks() : [];
        const enabledTracks = audioTracks.filter(track => track.enabled);
        console.log('音訊軌道狀態:', {
            total: audioTracks.length,
            enabled: enabledTracks.length,
            tracks: audioTracks.map(track => ({
                id: track.id,
                enabled: track.enabled,
                readyState: track.readyState
            }))
        });
        
    } catch (error) {
        console.error('切換音訊輸出端失敗:', error);
        
        let errorMessage = '切換音訊輸出端失敗: ';
        if (error.name === 'NotAllowedError') {
            errorMessage += '請允許存取音訊輸出端權限';
        } else if (error.name === 'NotFoundError') {
            errorMessage += '找不到指定的音訊輸出端';
        } else {
            errorMessage += error.message;
        }
        
        addMessage('系統', '❌ ' + errorMessage);
    }
}

// 切換音訊裝置
async function switchAudioDevice() {
    const microphoneSelect = document.getElementById('microphoneSelect');
    if (!microphoneSelect) {
        console.warn('找不到麥克風選擇器');
        return;
    }

    rememberDeviceSelection('microphone', microphoneSelect.value);

    if (!isStreaming) return;

    try {
        // 保存當前的視訊軌道
        const currentVideoTrack = localStream ? localStream.getVideoTracks()[0] : null;
        
        // 只停止音訊軌道
        const audioTracks = localStream.getAudioTracks();
        audioTracks.forEach(track => track.stop());

        const newStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                deviceId: microphoneSelect.value
            }
        });

        // 創建新的串流，包含新的音訊軌道和原有的視訊軌道
        const combinedStream = new MediaStream();
        
        // 添加新的音訊軌道
        newStream.getAudioTracks().forEach(track => {
            combinedStream.addTrack(track);
        });
        
        // 保持原有的視訊軌道
        if (currentVideoTrack && currentVideoTrack.readyState === 'live') {
            combinedStream.addTrack(currentVideoTrack);
            console.log('保持原有視訊軌道，軌道ID:', currentVideoTrack.id);
        }

        // 更新本地串流
        localStream = combinedStream;
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;
        
        // 確保音訊軌道啟用
        const newAudioTracks3 = localStream.getAudioTracks();
        newAudioTracks3.forEach(track => {
            track.enabled = true;
            console.log('音訊軌道已啟用:', track.id, '狀態:', track.readyState);
        });

        // 重新設置音訊輸出端
        if (currentAudioOutput && currentAudioOutput !== 'default') {
            try {
                const localVideo = document.getElementById('localVideo');
                if (localVideo.setSinkId) {
                    await localVideo.setSinkId(currentAudioOutput);
                    console.log('已重新設置音訊輸出端:', currentAudioOutput);
                }
            } catch (error) {
                console.warn('重新設置音訊輸出端失敗:', error);
            }
        }
        
        addMessage('系統', '🎤 麥克風已切換，視訊保持不變');

        // 更新所有觀眾的軌道
        if (isStreaming) {
            await updateAllPeerConnections();
        }

    } catch (error) {
        console.error('麥克風切換失敗:', error);
        addMessage('系統', '❌ 麥克風切換失敗');
    }
}

// 截圖功能
function takeScreenshot() {
    if (!localStream) return;

    const canvas = document.createElement('canvas');
    const video = document.getElementById('localVideo');
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // 下載截圖
    const link = document.createElement('a');
    link.download = `screenshot_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    link.href = canvas.toDataURL();
    link.click();

    addMessage('系統', '📸 截圖已下載');
}

// 全螢幕切換
function toggleFullscreen() {
    const videoContainer = document.querySelector('.video-container');
    
    if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().catch(err => {
            console.error('全螢幕失敗:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// 更新直播狀態
function updateStreamStatus(isLive) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const streamBtn = document.getElementById('streamBtn');

    // 添加null檢查
    if (!statusDot || !statusText || !streamBtn) {
        console.error('無法找到必要的UI元素:', {
            statusDot: !!statusDot,
            statusText: !!statusText,
            streamBtn: !!streamBtn
        });
        return;
    }

    if (isLive) {
        statusDot.classList.add('live');
        statusText.textContent = '直播中';
        statusText.classList.add('live-status'); // 添加直播狀態類
        streamBtn.textContent = '⏹️ 停止直播';
        streamBtn.classList.add('streaming');
        
        // 也更新直播畫面區域的狀態
        const streamStatusDot = document.getElementById('streamStatusDot');
        const streamStatusText = document.getElementById('streamStatusText');
        if (streamStatusDot && streamStatusText) {
            streamStatusDot.classList.add('live');
            streamStatusText.textContent = '直播中';
            streamStatusText.classList.add('live-status');
        }
    } else {
        statusDot.classList.remove('live');
        statusText.classList.remove('live-status'); // 移除直播狀態類
        streamBtn.textContent = '🔴 開始直播';
        streamBtn.classList.remove('streaming');
        
        // 也更新直播畫面區域的狀態
        const streamStatusDot = document.getElementById('streamStatusDot');
        const streamStatusText = document.getElementById('streamStatusText');
        if (streamStatusDot && streamStatusText) {
            streamStatusDot.classList.remove('live');
            streamStatusText.classList.remove('live-status');
        }
    }
}

// 開始直播計時器
function startStreamTimer() {
    streamStartTime = Date.now();
    durationInterval = setInterval(updateDuration, 1000);
}

// 停止直播計時器
function stopStreamTimer() {
    if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
    }
    streamStartTime = null;
}

// 更新直播時長
function updateDuration() {
    if (!streamStartTime) return;

    const elapsed = Date.now() - streamStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    const durationElement = document.getElementById('duration');
    if (durationElement) {
        durationElement.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// 模擬觀眾數量
function simulateViewers() {
    if (!isStreaming) return;

    // 隨機增加觀眾
    const viewerIncrease = Math.floor(Math.random() * 3) + 1;
    viewerCount += viewerIncrease;
    
    const viewerCountElement = document.getElementById('viewerCount');
    const chatViewerCountElement = document.getElementById('chatViewerCount');
    
    if (viewerCountElement) {
        viewerCountElement.textContent = viewerCount;
    }
    if (chatViewerCountElement) {
        chatViewerCountElement.textContent = viewerCount;
    }

    // 隨機發送觀眾訊息
    if (Math.random() < 0.3) {
        const messages = [
            '主播好！',
            '畫面很清晰呢',
            '支持主播！',
            '請問主播在玩什麼遊戲？',
            '主播的聲音很好聽',
            '這個直播間很棒！',
            '主播加油！',
            '請問主播幾歲？',
            '主播的技術很棒',
            '這個直播很有趣'
        ];
        
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        const usernames = ['觀眾A', '觀眾B', '觀眾C', '觀眾D', '觀眾E', '觀眾F'];
        const randomUsername = usernames[Math.floor(Math.random() * usernames.length)];
        
        addMessage(randomUsername, randomMessage);
    }

    // 繼續模擬
    setTimeout(simulateViewers, Math.random() * 5000 + 3000);
}

// 模擬數據傳輸
function simulateDataTransfer() {
    if (!isStreaming) return;

    const dataRate = Math.floor(Math.random() * 1000) + 100;
    const dataRateElement = document.getElementById('dataRate');
    if (dataRateElement) {
        dataRateElement.textContent = `${dataRate} KB/s`;
    }

    dataTransferInterval = setTimeout(simulateDataTransfer, 2000);
}

// 重置統計數據
function resetStats() {
    viewerCount = 0;
    messageCount = 0;
    
    // 安全地重置所有統計元素
    const elements = {
        'viewerCount': '0',
        'chatViewerCount': '0',
        'messageCount': '0',
        'duration': '00:00',
        'dataRate': '0 KB/s'
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    if (dataTransferInterval) {
        clearTimeout(dataTransferInterval);
        dataTransferInterval = null;
    }
}

// 添加聊天訊息
function addMessage(username, content) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    // 根據用戶類型設置不同的樣式
    if (username === '系統') {
        messageDiv.classList.add('system');
    } else if (username === '主播' || username === getCurrentUser()) {
        messageDiv.classList.add('broadcaster');
    }
    
    const timestamp = new Date().toLocaleTimeString('zh-TW', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // 獲取用戶頭像
    const avatar = getUserAvatar(username);
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            ${avatar}
        </div>
        <div class="message-content-wrapper">
            <div class="message-bubble">
                <div class="message-header">
                    <span class="username">${username}</span>
                    <span class="timestamp">${timestamp}</span>
                </div>
                <div class="message-content">${content}</div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    
    // 強制自動滾動到底部 - 使用多種方法確保滾動
    scrollChatToBottom();
    
    // 延遲再次滾動，確保 DOM 完全更新
    setTimeout(() => {
        scrollChatToBottom();
    }, 50);
    
    // 再次延遲滾動，處理可能的動畫或佈局變化
    setTimeout(() => {
        scrollChatToBottom();
    }, 100);
    
    // 更新訊息計數
    if (username !== '系統') {
        messageCount++;
        const messageCountElement = document.getElementById('messageCount');
        if (messageCountElement) {
            messageCountElement.textContent = messageCount;
        }
    }
}

// 獲取用戶頭像
function getUserAvatar(username) {
    if (username === '系統') {
        return '<i class="fas fa-cog"></i>';
    } else if (username === '主播' || username === getCurrentUser()) {
        // 使用當前用戶的頭像
        if (window.getCurrentUserAvatar) {
            return window.getCurrentUserAvatar();
        } else {
            return '<i class="fas fa-star"></i>';
        }
    } else {
        // 普通用戶顯示用戶名的第一個字母
        return username.charAt(0).toUpperCase();
    }
}

// 獲取當前用戶名稱
function getCurrentUser() {
    // 從全域變數或頁面函數獲取用戶名
    if (window.currentUser && window.currentUser.displayName) {
        return window.currentUser.displayName;
    } else if (window.getCurrentUser) {
        return window.getCurrentUser();
    } else {
        return '主播'; // 預設值
    }
}

// 獲取當前用戶完整信息
function getCurrentUserInfo() {
    console.log('🔍 [DEBUG] getCurrentUserInfo 被調用');
    console.log('🔍 [DEBUG] window.currentUser:', window.currentUser);
    console.log('🔍 [DEBUG] currentUser:', currentUser);
    
    // 首先檢查全局變數 currentUser (必須是已登入用戶)
    if (window.currentUser || currentUser) {
        const user = window.currentUser || currentUser;
        console.log('🔍 [DEBUG] 找到用戶:', user);
        
        // 如果是訪客，返回null
        if (user.isGuest) {
            console.log('❌ 訪客無法使用主播功能');
            return null;
               }
        
        const userInfo = {
            id: user.id || user.userId || null,
            userId: user.id || user.userId || null,
            username: user.username || user.email || null,
            displayName: user.displayName || user.username,
            avatarUrl: user.avatarUrl || user.avatar || null,
            balance: typeof user.balance === 'number' ? user.balance : null,
            isLoggedIn: true,
            isGuest: false
        };
        
        console.log('✅ 返回用戶資訊:', userInfo);
        return userInfo;
    }
    
    console.log('❌ 未找到已登入用戶');
    return null;
}

// 發送訊息 - 僅作為後備，優先使用ChatSystem
function sendMessage() {
    console.log('[SCRIPT] sendMessage被調用');
    
    // 檢查ChatSystem是否可用，如果可用則委託給ChatSystem處理
    if (window.chatSystem && 
        window.chatSystem.isReady && 
        typeof window.chatSystem.sendMessage === 'function') {
        console.log('[SCRIPT] 檢測到ChatSystem可用，委託給ChatSystem處理');
        window.chatSystem.sendMessage();
        return;
    }
    
    console.log('[SCRIPT] ChatSystem不可用，使用後備處理');
    
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) {
        console.error('[SCRIPT] 找不到messageInput元素');
        return;
    }
    
    const message = messageInput.value.trim();
    
    if (!message) {
        console.warn('[SCRIPT] 消息為空，忽略發送');
        return;
    }

    console.log('[SCRIPT] sendMessage invoked. socketState=', streamingSocket? streamingSocket.readyState : 'null', 'raw=', message);
    
    // 獲取當前用戶名稱
    const currentUserName = getCurrentUser();
    
    // 通過 WebSocket 發送訊息給所有觀眾
    if (streamingSocket && streamingSocket.readyState === WebSocket.OPEN) {
        const messageData = {
            type: 'chat',  // 使用統一的聊天消息類型
            role: 'broadcaster',
            username: currentUserName,
            message: message,
            timestamp: new Date().toISOString()
        };
        
        streamingSocket.send(JSON.stringify(messageData));
        console.log('[SCRIPT] 已發送訊息給所有觀眾 payload=', messageData);
        
        // 不立即在本地顯示消息，讓 ChatSystem 處理服務器回傳的消息
        // addMessage(currentUserName, message, 'broadcaster');
        
    } else {
        console.warn('[SCRIPT] WebSocket 未連接，無法發送訊息');
        addMessage('系統', '⚠️ 網路連接異常，訊息無法發送', 'system');
    }
    
    messageInput.value = '';
}

// 滾動聊天室到底部
function scrollChatToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        // 強制滾动到底部（最直接的方法）
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        console.log('聊天室強制滾动 - scrollTop:', chatMessages.scrollTop, 'scrollHeight:', chatMessages.scrollHeight);
        
        // 驗證滾動是否成功
        setTimeout(() => {
            if (chatMessages.scrollTop < chatMessages.scrollHeight - chatMessages.clientHeight - 10) {
                console.warn('聊天室滾動可能失敗，再次嘗試');
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }, 100);
    }
}

// 處理Enter鍵發送
function handleEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
}

// 顯示權限請求提示
function showPermissionRequest() {
    const videoContainer = document.querySelector('.video-container');
    
    // 檢查是否已經有提示
    if (videoContainer.querySelector('.permission-request')) return;
    
    const permissionDiv = document.createElement('div');
    permissionDiv.className = 'permission-request';
    permissionDiv.innerHTML = `
        <h3>🔐 需要權限</h3>
        <p>請允許瀏覽器存取您的攝影機和麥克風來開始直播</p>
        <button class="btn btn-primary" onclick="requestPermissions()">重新請求權限</button>
    `;
    
    videoContainer.appendChild(permissionDiv);
}

// 重新請求權限
async function requestPermissions() {
    try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        addMessage('系統', '✅ 權限已獲得，請重新點擊開始直播');
        
        // 移除權限提示
        const permissionRequest = document.querySelector('.permission-request');
        if (permissionRequest) {
            permissionRequest.remove();
        }
        
    } catch (error) {
        addMessage('系統', '❌ 權限請求失敗，請檢查瀏覽器設定');
    }
}

// 模擬初始活動
function simulateInitialActivity() {
    // 模擬一些初始的聊天訊息
    setTimeout(() => {
        addMessage('系統', '👋 歡迎來到直播平台！');
    }, 1000);
    
    setTimeout(() => {
        addMessage('系統', '💡 提示：點擊開始直播來啟動您的攝影機');
    }, 3000);
}

// 連接到直播服務器
function connectToStreamingServer() {
    console.log('🔍 [DEBUG] connectToStreamingServer 被調用');
    console.log('🔍 [DEBUG] currentUser:', currentUser);
    console.log('🔍 [DEBUG] currentUser.isGuest:', currentUser ? currentUser.isGuest : 'undefined');

    if (!currentUser || currentUser.isGuest) {
        console.log('❌ 用戶未登入，無法連接直播服務器');
        console.log('🔍 [DEBUG] 用戶狀態檢查失敗，停止連接');
        return;
    }

    console.log('✅ 用戶已登入，繼續連接流程');

    if (streamingSocket && (streamingSocket.readyState === WebSocket.OPEN || streamingSocket.readyState === WebSocket.CONNECTING)) {
        console.log('WebSocket 已連接或正在連接中');
        return;
    }

    const wsCandidates = buildStreamingWebSocketCandidates();
    if (!wsCandidates.length) {
        addMessage('系統', '❌ 找不到可用的 WebSocket 服務端點，請聯絡系統管理員');
        return;
    }

    const attemptConnection = (candidateIndex = 0) => {
        if (candidateIndex >= wsCandidates.length) {
            console.error('❌ 所有 WebSocket 候選端點皆無法連線');
            addMessage('系統', '❌ 無法連接到直播服務器，請稍後再試');
            return;
        }

        const wsUrl = wsCandidates[candidateIndex];
        console.log(`🔧 嘗試 WebSocket 連接: ${wsUrl} (候選 ${candidateIndex + 1}/${wsCandidates.length})`);

        let hasOpened = false;
        let connectTimeout = null;

        try {
            streamingSocket = new WebSocket(wsUrl);
            window.streamingSocket = streamingSocket;
        } catch (creationError) {
            console.error('❌ 無法建立 WebSocket 實例:', creationError);
            setTimeout(() => attemptConnection(candidateIndex + 1), 500);
            return;
        }

        const clearConnectTimeout = () => {
            if (connectTimeout) {
                clearTimeout(connectTimeout);
                connectTimeout = null;
            }
        };

        connectTimeout = setTimeout(() => {
            if (streamingSocket && streamingSocket.readyState === WebSocket.CONNECTING) {
                console.warn('⚠️ WebSocket 連接超時，強制關閉重新嘗試');
                try {
                    streamingSocket.close();
                } catch (closeError) {
                    console.warn('⚠️ 關閉超時連線失敗:', closeError);
                }
            }
        }, 10000);

        streamingSocket.onopen = function() {
            hasOpened = true;
            clearConnectTimeout();
            window.activeStreamingWsUrl = wsUrl;

            console.log('✅ 已連接到直播服務器:', wsUrl);
            addMessage('系統', `🔗 已連接到直播服務器 (${wsUrl})`);

            const userInfo = getCurrentUserInfo();
            console.log('🔍 [DEBUG] WebSocket 連線時獲取的 userInfo:', userInfo);

            if (!userInfo) {
                console.log('❌ 無法獲取用戶信息，斷開連接');
                streamingSocket.close();
                return;
            }

            const joinMessage = {
                type: 'broadcaster_join',
                broadcasterId: getBroadcasterId(),
                userInfo: userInfo
            };

            console.log('🔍 [DEBUG] 發送主播加入訊息:', joinMessage);
            streamingSocket.send(JSON.stringify(joinMessage));

            flushPendingSignalingQueue();

            console.log('🔍 [DEBUG] WebSocket 已連接，現在初始化聊天系統');
            setTimeout(() => {
                if (!window.chatSystem) {
                    initializeChat();
                } else if (window.chatSystem.setSocket) {
                    console.log('⚠️ ChatSystem 已存在，更新 socket 引用');
                    window.chatSystem.setSocket(streamingSocket);
                }
            }, 500);
        };

        streamingSocket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            console.log('🚨 [FORCE DEBUG] 主播端收到消息:', data);

            if (data.type === 'chat_message' || data.type === 'chat') {
                console.log('[CHAT_DEBUG] 收到聊天封包', data);
            }

            if (data.type === 'online_viewers' || data.type === 'viewer_join') {
                console.log('🎯 [CRITICAL] WebRTC相關消息:', data);
                console.log(`📱 [WebRTC] 收到關鍵消息: ${data.type} - 詳細信息見上方`);
            }

            handleServerMessage(data);
        };

        streamingSocket.onerror = function(error) {
            clearConnectTimeout();
            console.error('❌ WebSocket 錯誤:', error, 'URL:', wsUrl);

            if (!hasOpened) {
                console.warn(`⚠️ 無法連線至 ${wsUrl}，嘗試下一個候選`);
                setTimeout(() => attemptConnection(candidateIndex + 1), 500);
                return;
            }

            addMessage('系統', '❌ 連接直播服務器失敗，請檢查網路連線');
        };

        streamingSocket.onclose = function(event) {
            clearConnectTimeout();
            window.streamingSocket = null;
            streamingSocket = null;

            console.log('❌ 與直播服務器斷開連接', {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean,
                url: wsUrl
            });

            if (isStreaming && lastKnownStreamTitle) {
                queueStreamStartAnnouncement(lastKnownStreamTitle, { forceQueue: true });
            }

            if (hasOpened) {
                addMessage('系統', `⚠️ 與直播服務器斷開連接 (Code: ${event.code})`);
                setTimeout(() => {
                    console.log('🔄 嘗試重新連接...');
                    connectToStreamingServer();
                }, 3000);
            } else if (candidateIndex + 1 < wsCandidates.length) {
                console.warn(`⚠️ ${wsUrl} 連線被關閉，改嘗試下一個候選`);
                setTimeout(() => attemptConnection(candidateIndex + 1), 500);
            } else {
                console.error('❌ 所有候選 WebSocket 都已嘗試且失敗');
                addMessage('系統', '❌ 無法連接到直播服務器，請稍後再試');
            }
        };
    };

    attemptConnection(0);
}

// 處理服務器訊息
function handleServerMessage(data) {
    console.log('🔔 主播端收到服務器消息:', data.type, data);
    // addMessage('系統', `📨 收到消息: ${data.type}`);
    const chatSystemReady = !!(window.chatSystem && window.chatSystem.isReady && window.chatSystem.isConnected);
    
    switch (data.type) {
        case 'broadcaster_joined':
            // addMessage('系統', '✅ 主播已成功加入直播間');
            break;
            
        case 'viewer_join':
            handleViewerJoin(data);
            break;
            
        case 'viewers_need_connection':
            handleViewersNeedConnection(data);
            break;
            
        case 'online_viewers':
            // 處理服務器返回的在線觀眾列表
            console.log('🎯 處理在線觀眾列表消息');
            console.log('🎯 [ONLINE_VIEWERS] 收到消息，數據:', data);
            console.log('🎯 [ONLINE_VIEWERS] 當前 isStreaming:', isStreaming);
            console.log('🎯 [ONLINE_VIEWERS] localStream:', localStream ? '存在' : '不存在');
            // addMessage('系統', `🎯 收到在線觀眾列表: ${data.viewers ? data.viewers.length : 0} 個`);
            handleOnlineViewers(data);
            break;
            
        case 'answer':
            handleAnswer(data);
            break;
            
        case 'ice_candidate':
            handleIceCandidate(data);
            break;
            
        case 'chat_message':
            // 總是嘗試讓 ChatSystem 處理，如果不可用才用備用方案
            if (window.chatSystem && window.chatSystem.handleMessage) {
                console.log('[CHAT] 由 ChatSystem 處理 chat_message');
                window.chatSystem.handleMessage(data);
            } else {
                console.log('[CHAT] ChatSystem 不可用，使用備用處理');
                handleChatMessage(data);
            }
            break;
            
        // 多主播相關事件處理
        case 'broadcaster_online':
        case 'broadcaster_offline':
        case 'broadcaster_stream_started':
        case 'broadcaster_stream_ended':
            if (typeof handleMultiBroadcasterMessage === 'function') {
                handleMultiBroadcasterMessage(data);
            }
            break;
        case 'chat': // 新的聊天協議處理
            // 總是嘗試讓 ChatSystem 處理，如果不可用才用備用方案
            if (window.chatSystem && window.chatSystem.handleMessage) {
                console.log('[CHAT] 由 ChatSystem 處理 chat 類型消息');
                window.chatSystem.handleMessage(data);
            } else {
                console.log('[CHAT] ChatSystem 不可用，使用備用處理 chat 消息');
                const legacyPayload = {
                    username: data.role === 'system' ? '系統' : data.username,
                    message: data.text || data.message,
                    text: data.text || data.message,
                    isStreamer: data.role === 'broadcaster',
                    isSystemMessage: data.role === 'system',
                    viewerId: data.viewerId,
                    timestamp: data.timestamp || Date.now()
                };
                handleChatMessage(legacyPayload);
            }
            break;
            
        case 'viewer_count_update':
            updateViewerCount(data.count);
            break;

        case 'gift_received':
            if (typeof window.handleStreamerGiftEvent === 'function') {
                window.handleStreamerGiftEvent(data);
            }
            break;
            
        default:
            console.log('未知訊息類型:', data.type);
    }
}

// 處理服務器返回的在線觀眾列表
function handleOnlineViewers(data) {
    console.log('🚨 [FORCE DEBUG] handleOnlineViewers 被調用:', data);
    console.log(`📊 [INFO] 觀眾數量: ${data.viewers ? data.viewers.length : 0}`);
    
    console.log('收到在線觀眾列表:', data.viewers);
    console.log('當前直播狀態:', isStreaming, '本地媒體流:', localStream ? '已建立' : '未建立');
    console.log('全局變量檢查:', {
        'window.isStreaming': window.isStreaming,
        'window.localStream': window.localStream ? '已建立' : '未建立',
        'isStreaming': isStreaming,
        'localStream': localStream ? '已建立' : '未建立'
    });
    
    if (!isStreaming || !localStream) {
        console.log('❌ 無法為觀眾建立連接：直播未開始或媒體流未建立');
        addMessage('系統', '❌ 無法為觀眾建立連接：請確保直播已開始');
        console.log(`❌ [ERROR] 條件檢查失敗: isStreaming=${isStreaming}, localStream=${localStream ? '存在' : '不存在'}`);
        return;
    }
    
    const viewers = data.viewers || [];
    
    if (viewers.length === 0) {
        console.log('📺 目前沒有觀眾在線');
        addMessage('系統', '📺 等待觀眾加入...');
        return;
    }
    
    console.log(`📺 為 ${viewers.length} 個在線觀眾建立連接...`);
    // addMessage('系統', `📺 正在為 ${viewers.length} 個觀眾建立連接...`);
    
    // 為每個在線觀眾建立 WebRTC 連接
    viewers.forEach((viewerId, index) => {
        if (!peerConnections.has(viewerId)) {
            console.log(`🔄 為觀眾 ${viewerId.substr(-3)} 建立 WebRTC 連接...`);
            // addMessage('系統', `🔄 正在為觀眾 ${viewerId.substr(-3)} 建立連接...`);
            
            // 延遲建立連接，避免同時建立太多連接
            setTimeout(() => {
                try {
                    console.log(`🚨 [FORCE DEBUG] 開始為觀眾 ${viewerId} 建立 PeerConnection`);
                    clearPendingViewerQueues(viewerId);
                    createPeerConnection(viewerId);
                    setTimeout(() => {
                        console.log(`🚨 [FORCE DEBUG] 開始為觀眾 ${viewerId} 發送 Stream`);
                        sendStreamToViewer(viewerId);
                    }, 500); // 等待 PeerConnection 建立完成
                } catch (error) {
                    console.error(`為觀眾 ${viewerId.substr(-3)} 建立連接失敗:`, error);
                    addMessage('系統', `❌ 為觀眾 ${viewerId.substr(-3)} 建立連接失敗`);
                }
            }, index * 500); // 順序延遲避免衝突
        } else {
            console.log(`ℹ️ 觀眾 ${viewerId.substr(-3)} 已有連接`);
        }
    });
}

// 處理觀眾加入
function handleViewerJoin(data) {
    console.log('觀眾加入:', data.viewerId);
    console.log(`👥 觀眾 ${data.viewerId.substr(-3)} 已加入直播間`);
    
    // 詳細調試信息
    console.log('當前直播狀態 isStreaming:', isStreaming);
    console.log('本地媒體流 localStream:', localStream ? '已建立' : '未建立');
    console.log('已有的 PeerConnection 數量:', peerConnections.size);
    
    // 如果正在直播，為新觀眾建立連接
    if (isStreaming && localStream) {
        // 檢查是否已經有連接
        if (!peerConnections.has(data.viewerId)) {
            console.log(`🔄 為觀眾 ${data.viewerId.substr(-3)} 建立視訊連接...`);
            // addMessage('系統', `🔄 正在為觀眾 ${data.viewerId.substr(-3)} 建立連接...`);
            
            // 建立 WebRTC 連接
            clearPendingViewerQueues(data.viewerId);
            createPeerConnection(data.viewerId);
            
            // 發送直播串流
            sendStreamToViewer(data.viewerId);
        } else {
            // addMessage('系統', `ℹ️ 觀眾 ${data.viewerId.substr(-3)} 已有連接`);
        }
    } else {
        if (!isStreaming) {
            console.log('⚠️ 主播尚未開始直播');
            // addMessage('系統', `⚠️ 觀眾 ${data.viewerId.substr(-3)} 加入，但直播尚未開始`);
        }
        if (!localStream) {
            console.log('⚠️ 本地媒體流未建立');
            // addMessage('系統', `⚠️ 無法為觀眾建立連接：攝影機未啟用`);
        }
    }
}

// 處理觀眾需要連接
function handleViewersNeedConnection(data) {
    console.log('觀眾需要連接:', data.viewers);
    console.log('當前直播狀態 isStreaming:', isStreaming);
    console.log('本地媒體流 localStream:', localStream ? '已建立' : '未建立');
    addMessage('系統', data.message);
    
    if (!isStreaming) {
        console.log('⚠️ 直播尚未開始，無法建立觀眾連接');
        addMessage('系統', '⚠️ 直播尚未開始，無法建立觀眾連接');
        return;
    }
    
    if (!localStream) {
        console.log('⚠️ 本地媒體流未建立，無法建立觀眾連接');
        addMessage('系統', '⚠️ 攝影機未啟用，無法建立觀眾連接');
        return;
    }
    
    // 為所有等待的觀眾建立連接
    data.viewers.forEach(viewerId => {
        if (!peerConnections.has(viewerId)) {
            console.log('為觀眾', viewerId, '建立連接');
            addMessage('系統', `🔄 正在為等待的觀眾 ${viewerId.substr(-3)} 建立連接...`);
            clearPendingViewerQueues(viewerId);
            createPeerConnection(viewerId);
            sendStreamToViewer(viewerId);
        } else {
            console.log('觀眾', viewerId, '已有連接，跳過');
        }
    });
}

// 建立 WebRTC 連接
function createPeerConnection(viewerId) {
    try {
        console.log('為觀眾', viewerId, '建立 WebRTC 連接');
        const peerConnection = new RTCPeerConnection(rtcConfiguration);
        
        // 添加本地串流軌道
        if (localStream) {
            console.log('本地串流軌道數量:', localStream.getTracks().length);
            
            // 分別處理視訊和音訊軌道
            const videoTracks = localStream.getVideoTracks();
            const audioTracks = localStream.getAudioTracks();
            
            console.log(`視訊軌道: ${videoTracks.length}, 音訊軌道: ${audioTracks.length}`);
            
            // 添加視訊軌道
            videoTracks.forEach((track, index) => {
                try {
                    const sender = peerConnection.addTrack(track, localStream);
                    console.log(`✅ 已添加視訊軌道 ${index}:`, track.readyState, track.id);
                } catch (error) {
                    console.error(`❌ 添加視訊軌道 ${index} 失敗:`, error);
                }
            });
            
            // 添加音訊軌道
            audioTracks.forEach((track, index) => {
                try {
                    const sender = peerConnection.addTrack(track, localStream);
                    console.log(`✅ 已添加音訊軌道 ${index}:`, track.readyState, track.id);
                } catch (error) {
                    console.error(`❌ 添加音訊軌道 ${index} 失敗:`, error);
                }
            });
            
            // addMessage('系統', `📹 已為觀眾 ${viewerId.substr(-3)} 添加 ${videoTracks.length} 個視訊軌道和 ${audioTracks.length} 個音訊軌道`);
            
        } else {
            console.error('❌ 本地串流不存在');
            addMessage('系統', `❌ 無法為觀眾 ${viewerId.substr(-3)} 建立連接：本地串流不存在`);
            return;
        }
        
        // 處理 ICE 候選 - 增強 NAT 穿透診斷
        peerConnection.onicecandidate = function(event) {
            if (event.candidate) {
                const candidate = event.candidate;
                console.log('🎯 發送 ICE 候選給觀眾:', viewerId.substr(-3), {
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
                } else if (candidate.type === 'srflx') {
                    console.log('🔄 伺服器反射候選 (STUN 通過 NAT)');
                } else if (candidate.type === 'relay') {
                    console.log('🔀 中繼候選 (TURN 伺服器)');
                    if (typeof addMessage === 'function') {
                        addMessage('系統', '🔀 使用 TURN 中繼伺服器，可能因 NAT/防火牆限制');
                    }
                }

                const candidateMessage = {
                    type: 'ice_candidate',
                    candidate: event.candidate,
                    broadcasterId: getBroadcasterId(),
                    viewerId: viewerId
                };

                if (streamingSocket && streamingSocket.readyState === WebSocket.OPEN) {
                    streamingSocket.send(JSON.stringify(candidateMessage));
                } else {
                    console.warn('⚠️ WebSocket 未連接，暫存 ICE 候選等待補發');
                    queueIceCandidateForViewer(viewerId, candidateMessage);
                    connectToStreamingServer();
                }
            } else if (!event.candidate) {
                console.log('✅ ICE 候選收集完成 for 觀眾:', viewerId.substr(-3));
            }
        };
        
        // 監聽連接狀態
        peerConnection.onconnectionstatechange = function() {
            const state = peerConnection.connectionState;
            console.log(`觀眾 ${viewerId.substr(-3)} 連接狀態:`, state);
            
            switch (state) {
                case 'connecting':
                    // addMessage('系統', `🔄 正在與觀眾 ${viewerId.substr(-3)} 建立連接...`);
                    break;
                case 'connected':
                    console.log(`✅ 觀眾 ${viewerId.substr(-3)} 視訊連接成功`);
                    // addMessage('系統', `✅ 觀眾 ${viewerId.substr(-3)} 連接成功！`);
                    break;
                case 'disconnected':
                    console.log(`⚠️ 觀眾 ${viewerId.substr(-3)} 連接中斷`);
                    // addMessage('系統', `⚠️ 觀眾 ${viewerId.substr(-3)} 連接中斷`);
                    break;
                case 'failed':
                    console.log(`❌ 觀眾 ${viewerId.substr(-3)} 連接失敗`);
                    // addMessage('系統', `❌ 觀眾 ${viewerId.substr(-3)} 連接失敗，將嘗試重連...`);
                    
                    // 清理失敗的連接並嘗試重新建立
                    setTimeout(() => {
                        if (peerConnection.connectionState === 'failed') {
                            console.log(`🔄 為觀眾 ${viewerId.substr(-3)} 重新建立連接...`);
                            peerConnections.delete(viewerId);
                            clearPendingViewerQueues(viewerId);
                            
                            // 重新建立連接
                            setTimeout(() => {
                                if (isStreaming && localStream) {
                                    createPeerConnection(viewerId);
                                    setTimeout(() => sendStreamToViewer(viewerId), 1000);
                                }
                            }, 2000);
                        }
                    }, 3000);
                    break;
                case 'closed':
                    console.log(`🔒 觀眾 ${viewerId.substr(-3)} 連接已關閉`);
                    addMessage('系統', `🔒 觀眾 ${viewerId.substr(-3)} 已離開`);
                    peerConnections.delete(viewerId);
                    clearPendingViewerQueues(viewerId);
                    break;
            }
        };
        
        // 監聽 ICE 連接狀態
        peerConnection.oniceconnectionstatechange = function() {
            console.log('觀眾', viewerId, 'ICE 狀態:', peerConnection.iceConnectionState);
            
            if (peerConnection.iceConnectionState === 'failed') {
                console.log(`❌ 觀眾 ${viewerId.substr(-3)} ICE 連接失敗`);
            } else if (peerConnection.iceConnectionState === 'connected') {
                console.log(`✅ 觀眾 ${viewerId.substr(-3)} ICE 連接成功`);
            }
        };
        
        // 監聽信令狀態
        peerConnection.onsignalingstatechange = function() {
            console.log('觀眾', viewerId, '信令狀態:', peerConnection.signalingState);
        };
        
        // 儲存連接
        peerConnections.set(viewerId, peerConnection);
        console.log('WebRTC 連接已建立並儲存');
        
    } catch (error) {
        console.error('建立 WebRTC 連接失敗:', error);
        addMessage('系統', `❌ 為觀眾 ${viewerId.substr(-3)} 建立連接失敗`);
    }
}

// 發送串流給觀眾
async function sendStreamToViewer(viewerId) {
    const peerConnection = peerConnections.get(viewerId);
    if (!peerConnection) {
        console.error('找不到觀眾的 PeerConnection:', viewerId);
        // addMessage('系統', `❌ 找不到觀眾 ${viewerId.substr(-3)} 的連接`);
        return;
    }
    
    try {
        console.log('為觀眾', viewerId, '創建 WebRTC offer');
        // addMessage('系統', `🔄 正在為觀眾 ${viewerId.substr(-3)} 創建連接...`);
        
        // 創建 offer
        let offer = await peerConnection.createOffer();
        
        // 優先使用 VP8 編碼器
        if (offer.sdp) {
            console.log('修改 SDP 以優先使用 VP8');
            offer.sdp = preferCodec(offer.sdp, 'video', 'VP8');
        }
        
        await peerConnection.setLocalDescription(offer);
        
        console.log('Offer 創建成功，準備發送給觀眾:', viewerId);
        
        // 發送 offer 給觀眾
        const offerMessage = {
            type: 'offer',
            offer: offer,
            broadcasterId: getBroadcasterId(),
            viewerId: viewerId
        };

        if (streamingSocket && streamingSocket.readyState === WebSocket.OPEN) {
            console.log('發送 offer 給觀眾:', viewerId, '主播ID:', offerMessage.broadcasterId, '- Offer SDP 長度:', offer.sdp.length);
            streamingSocket.send(JSON.stringify(offerMessage));
            // addMessage('系統', `📤 已向觀眾 ${viewerId.substr(-3)} 發送連接請求`);
        } else {
            console.warn('WebSocket 連接不可用，暫存 offer 以待發送');
            queueOfferForViewer(viewerId, offerMessage);
            connectToStreamingServer();
            addMessage('系統', `⏳ 觀眾 ${viewerId.substr(-3)} 的連接請求將在網路恢復後發送`);
        }
        
    } catch (error) {
        console.error('發送串流失敗:', error);
        addMessage('系統', `❌ 發送串流給觀眾 ${viewerId.substr(-3)} 失敗: ${error.message}`);
    }
}

// 修改 SDP 以優先使用指定編碼器
function preferCodec(sdp, type, codec) {
    var sdpLines = sdp.split('\r\n');
    var mLineIndex = -1;
    for (var i = 0; i < sdpLines.length; i++) {
        if (sdpLines[i].search('m=' + type) !== -1) {
            mLineIndex = i;
            break;
        }
    }
    if (mLineIndex === -1) return sdp;
    var codecPayloadType = null;
    var pattern = new RegExp('a=rtpmap:(\\d+) ' + codec + '/\\d+');
    for (var i = 0; i < sdpLines.length; i++) {
        if (sdpLines[i].match(pattern)) {
            codecPayloadType = sdpLines[i].match(pattern)[1];
            break;
        }
    }
    if (codecPayloadType === null) return sdp;
    var elements = sdpLines[mLineIndex].split(' ');
    var newMLine = elements.slice(0, 3);
    var payloadTypes = elements.slice(3);
    var index = payloadTypes.indexOf(codecPayloadType);
    if (index !== -1) {
        payloadTypes.splice(index, 1);
    }
    payloadTypes.unshift(codecPayloadType);
    newMLine = newMLine.concat(payloadTypes);
    sdpLines[mLineIndex] = newMLine.join(' ');
    return sdpLines.join('\r\n');
}

// 更新直播標題顯示
function updateStreamTitle() {
    const titleInput = document.getElementById('streamTitleInput');
    const streamTitle = document.getElementById('streamTitle');

    // 優先從輸入框取得標題，否則使用全局暫存或預設
    const currentTitle = (titleInput && titleInput.value && titleInput.value.trim()) ? titleInput.value.trim() : (window.currentStreamTitle || '精彩直播中');

    if (streamTitle) {
        streamTitle.textContent = currentTitle;
        console.log('✅ 直播標題已更新（DOM）:', currentTitle);
    } else {
        console.log('ℹ️ 找不到 streamTitle DOM 元素，但仍會廣播標題更新');
    }

    // 保存到全局變數以便其他模組使用
    window.currentStreamTitle = currentTitle;
    lastKnownStreamTitle = currentTitle;

    // 如果有全域的 sendTitleUpdate，使用它來廣播標題更新（容錯於 titleSocket 未連線時）
    if (typeof window.sendTitleUpdate === 'function') {
        window.sendTitleUpdate(currentTitle);
    } else {
        console.log('ℹ️ sendTitleUpdate 未定義，跳過廣播');
    }
}

// 處理觀眾的 answer
async function handleAnswer(data) {
    console.log('收到觀眾 answer:', data.viewerId);
    const peerConnection = peerConnections.get(data.viewerId);
    
    if (peerConnection) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            console.log('已設置觀眾 answer 為遠端描述');
            console.log(`✅ 觀眾 ${data.viewerId.substr(-3)} 連接回應已處理`);
        } catch (error) {
            console.log('設置觀眾 answer 失敗:', error);
            console.log(`❌ 處理觀眾 ${data.viewerId.substr(-3)} 回應失敗`);
        }
    } else {
        console.error('找不到觀眾的 WebRTC 連接:', data.viewerId);
        // addMessage('系統', `❌ 找不到觀眾 ${data.viewerId.substr(-3)} 的連接`);
    }
}

// 處理 ICE 候選
async function handleIceCandidate(data) {
    console.log('收到觀眾 ICE 候選:', data.viewerId);
    const peerConnection = peerConnections.get(data.viewerId);
    
    if (peerConnection && data.candidate) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log('已添加觀眾 ICE 候選');
        } catch (error) {
            console.error('添加觀眾 ICE 候選失敗:', error);
            addMessage('系統', `❌ 處理觀眾 ${data.viewerId.substr(-3)} ICE 候選失敗`);
        }
    } else {
        console.error('無法處理 ICE 候選:', data);
    }
}

// 處理聊天訊息
function handleChatMessage(data) {
    // 獲取消息文本（支持新舊格式）
    const messageText = data.text || data.message || '';
    const userName = data.username || '未知用戶';
    
    if (data.viewerId && data.viewerId !== 'system') { 
        // 來自觀眾的訊息
        const viewerName = data.username || `觀眾${data.viewerId.substr(-3)}`;
        addMessage(viewerName, messageText);
        console.log('收到觀眾訊息:', viewerName, messageText);
    } else if (data.isStreamer) {
        // 來自主播的訊息（回顯確認）
        console.log('收到主播訊息回顯:', userName, messageText);
        addMessage(userName, messageText);
    } else if (data.isSystemMessage || data.viewerId === 'system') {
        // 系統消息
        addMessage('系統', messageText);
        console.log('收到系統訊息:', messageText);
    } else {
        // 其他消息
        addMessage(userName, messageText);
        console.log('收到其他訊息:', userName, messageText);
    }
}

// 更新觀眾數量
function updateViewerCount(count) {
    viewerCount = count;
    document.getElementById('viewerCount').textContent = count;
    document.getElementById('chatViewerCount').textContent = count;
}

// 更新所有 WebRTC 連接的軌道
async function updateAllPeerConnections() {
    if (!localStream) return;
    
    try {
        addMessage('系統', '🔄 正在更新所有觀眾的視訊軌道...');
        
        // 為每個觀眾重新建立連接
        const viewerIds = Array.from(peerConnections.keys());
        
        for (const viewerId of viewerIds) {
            // 關閉舊連接
            const oldConnection = peerConnections.get(viewerId);
            if (oldConnection) {
                oldConnection.close();
                peerConnections.delete(viewerId);
                clearPendingViewerQueues(viewerId);
            }
            
            // 建立新連接
            createPeerConnection(viewerId);
            await sendStreamToViewer(viewerId);
        }
        
        addMessage('系統', '✅ 所有觀眾的視訊軌道已更新');
    } catch (error) {
        console.error('更新 WebRTC 連接失敗:', error);
        addMessage('系統', '❌ 更新視訊軌道失敗');
    }
}

// 更新單個 WebRTC 連接的軌道（用於視訊開關等）
async function updatePeerConnectionTracks(viewerId) {
    const peerConnection = peerConnections.get(viewerId);
    if (!peerConnection || !localStream) return;
    
    try {
        console.log('正在更新觀眾', viewerId, '的軌道...');
        
        // 獲取當前軌道
        const currentTracks = localStream.getTracks();
        const currentSenders = peerConnection.getSenders();
        
        // 檢查是否需要更新軌道
        let needsUpdate = false;
        
        // 檢查軌道數量是否匹配
        if (currentTracks.length !== currentSenders.length) {
            needsUpdate = true;
        } else {
            // 檢查軌道內容是否匹配
            for (let i = 0; i < currentTracks.length; i++) {
                if (currentSenders[i] && currentSenders[i].track) {
                    if (currentSenders[i].track.id !== currentTracks[i].id) {
                        needsUpdate = true;
                        break;
                    }
                } else {
                    needsUpdate = true;
                    break;
                }
            }
        }
        
        if (!needsUpdate) {
            console.log('觀眾', viewerId, '的軌道已是最新，無需更新');
            return;
        }
        
        // 智能軌道更新：只更新變化的軌道，保持音訊軌道
        const audioTrack = currentTracks.find(track => track.kind === 'audio');
        const videoTrack = currentTracks.find(track => track.kind === 'video');
        
        // 找到現有的軌道發送器
        const existingAudioSender = currentSenders.find(sender => 
            sender.track && sender.track.kind === 'audio'
        );
        const existingVideoSender = currentSenders.find(sender => 
            sender.track && sender.track.kind === 'video'
        );
        
        // 只更新視訊軌道，保持音訊軌道
        if (videoTrack && videoTrack.readyState === 'live') {
            if (existingVideoSender) {
                // 替換現有視訊軌道
                await existingVideoSender.replaceTrack(videoTrack);
                console.log('已替換視訊軌道，軌道ID:', videoTrack.id);
            } else {
                // 添加新視訊軌道
                peerConnection.addTrack(videoTrack, localStream);
                console.log('已添加新視訊軌道，軌道ID:', videoTrack.id);
            }
        }
        
        // 確保音訊軌道存在且啟用
        if (audioTrack && audioTrack.readyState === 'live') {
            if (!existingAudioSender) {
                peerConnection.addTrack(audioTrack, localStream);
                console.log('已添加音訊軌道，軌道ID:', audioTrack.id);
            } else if (existingAudioSender.track !== audioTrack) {
                // 音訊軌道已更改，替換它
                await existingAudioSender.replaceTrack(audioTrack);
                console.log('已替換音訊軌道，軌道ID:', audioTrack.id);
            } else {
                console.log('音訊軌道保持不變，軌道ID:', audioTrack.id);
            }
        }
        
        // 重新協商連接
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            // 發送新的 offer 給觀眾
            if (streamingSocket) {
                const offerMessage = {
                    type: 'offer',
                    offer: offer,
                    broadcasterId: getBroadcasterId(),
                    viewerId: viewerId
                };
                console.log('發送更新後的 offer 給觀眾:', viewerId);
                streamingSocket.send(JSON.stringify(offerMessage));
            }
            
            console.log('已更新觀眾', viewerId, '的軌道並重新協商');
        } catch (error) {
            console.error('重新協商失敗:', error);
        }
        
    } catch (error) {
        console.error('更新軌道失敗:', error);
    }
}

// 頁面卸載時清理資源
window.addEventListener('beforeunload', function() {
    if (streamingSocket) {
        streamingSocket.close();
    }
    
    // 關閉所有 WebRTC 連接
    peerConnections.forEach(connection => {
        connection.close();
    });
    peerConnections.clear();
});

// 初始化聊天室功能
function initializeChat() {
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    
    if (chatMessages) {
        console.log('初始化聊天室容器');
        
        // 確保容器有正確的滾動屬性
        chatMessages.style.overflowY = 'auto';
        chatMessages.style.overflowX = 'hidden';
        
        // 確保聊天室初始就滾動到底部
        scrollChatToBottom();
        
        // 監聽新訊息添加，自動滾動
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    console.log('檢測到新訊息，自動滾動');
                    scrollChatToBottom();
                }
            });
        });
        
        observer.observe(chatMessages, {
            childList: true,
            subtree: false
        });
        
        // 監聽滾動事件，用於調試
        // chatMessages.addEventListener('scroll', () => {
        //     // console.log('聊天室滾動位置:', chatMessages.scrollTop, '/', chatMessages.scrollHeight);
        // });
    }
    
    // 為輸入框添加實時滾動
    if (messageInput) {
        messageInput.addEventListener('input', () => {
            // 當用戶正在輸入時也保持在底部
            setTimeout(scrollChatToBottom, 50);
        });
        
        // 當輸入框獲得焦點時，滾動到底部
        messageInput.addEventListener('focus', () => {
            setTimeout(scrollChatToBottom, 100);
        });
    }
    
    // 創建 ChatSystem 實例
    if (typeof ChatSystem !== 'undefined') {
        console.log('🚀 創建主播端 ChatSystem 實例');
        
        // 獲取主播用戶信息
        let username = '主播';
        if (currentUser && currentUser.displayName) {
            username = currentUser.displayName;
        } else if (currentUser && currentUser.username) {
            username = currentUser.username;
        }
        
        // 創建 ChatSystem 實例
        window.chatSystem = new ChatSystem({
            isStreamer: true,
            username: username,
            socket: streamingSocket, // 使用現有的 WebSocket 連接
            selectors: {
                chatContainer: '#chatMessages',
                messageInput: '#messageInput',
                sendButton: '.btn-send'
            }
        });
        
        console.log('✅ 主播端 ChatSystem 已創建');
    } else {
        console.warn('⚠️ ChatSystem 類別未定義，聊天功能可能無法正常工作');
    }
}

// 聊天初始化已移至 initializeBroadcaster() 統一處理

// 分頁音訊捕獲功能
async function captureTabWithAudio() {
    try {
        console.log('開始捕獲分頁音訊...');
        addMessage('系統', '🎵 正在啟用分頁音訊分享...');
        
        // 請求分頁螢幕共享（包含音訊）
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
            video: {
                mediaSource: 'tab'
            },
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                googEchoCancellation: false,
                googAutoGainControl: false,
                googNoiseSuppression: false,
                googHighpassFilter: false,
                googAudioMirroring: false
            }
        });
        
        // 檢查是否包含音訊軌道
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
            addMessage('系統', '⚠️ 所選分頁沒有音訊，請選擇包含音訊的分頁（如YouTube等音樂網站）');
            stream.getTracks().forEach(track => track.stop());
            return null;
        }
        
        console.log('分頁音訊軌道信息:', audioTracks[0].getSettings());
        
        // 停止視訊軌道（我們只需要音訊）
        stream.getVideoTracks().forEach(track => track.stop());
        
        addMessage('系統', '✅ 分頁音訊已成功啟用，觀眾現在可以聽到背景音樂');
        return stream;
    } catch (error) {
        console.error('捕獲分頁音訊失敗:', error);
        if (error.name === 'NotAllowedError') {
            addMessage('系統', '❌ 用戶拒絕了分頁音訊權限，請重試並允許音訊分享');
        } else if (error.name === 'NotFoundError') {
            addMessage('系統', '❌ 未找到音訊源，請確保選擇的分頁有音訊播放');
        } else {
            addMessage('系統', '❌ 啟用分頁音訊失敗，請確保使用支援的瀏覽器');
        }
        return null;
    }
}

// 創建混音音訊流
async function createMixedStream(tabStream) {
    try {
        console.log('開始創建混音音訊流...');
        
        // 關閉之前的音訊上下文
        if (audioContext && audioContext.state !== 'closed') {
            await audioContext.close();
        }
        
        // 創建新的音訊上下文
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();
        
        let hasAudio = false;
        
        // 處理分頁音訊（背景音樂）
        if (tabStream) {
            const tabAudioTracks = tabStream.getAudioTracks();
            if (tabAudioTracks.length > 0) {
                const tabSource = audioContext.createMediaStreamSource(tabStream);
                const tabGain = audioContext.createGain();
                tabGain.gain.value = 0.8; // 設置背景音樂音量
                tabSource.connect(tabGain);
                tabGain.connect(destination);
                hasAudio = true;
                
                console.log('分頁音訊已連接到混音器，音量設為 80%');
                addMessage('系統', '🎵 背景音樂已加入直播串流');
            }
        }
        
        // 處理麥克風音訊
        if (localStream) {
            const audioTracks = localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                const micStream = new MediaStream(audioTracks);
                const micSource = audioContext.createMediaStreamSource(micStream);
                const micGain = audioContext.createGain();
                micGain.gain.value = 1.0; // 保持麥克風原音量
                micSource.connect(micGain);
                micGain.connect(destination);
                hasAudio = true;
                
                console.log('麥克風音訊已連接到混音器');
                addMessage('系統', '🎤 麥克風音訊已加入混音');
            }
        }
        
        if (!hasAudio) {
            console.warn('沒有可用的音訊源');
            addMessage('系統', '⚠️ 沒有檢測到音訊源');
            return null;
        }
        
        console.log('混音音訊流創建成功');
        addMessage('系統', '✅ 音訊混音完成，觀眾現在可以同時聽到您的聲音和背景音樂');
        return destination.stream;
    } catch (error) {
        console.error('創建混音音訊流失敗:', error);
        addMessage('系統', '❌ 音訊混音失敗: ' + error.message);
        return null;
    }
}

// 更新WebRTC連接中的音訊軌道
async function updateAudioTracks(newAudioStream) {
    try {
        console.log('更新WebRTC音訊軌道...');
        
        const audioTracks = newAudioStream.getAudioTracks();
        if (audioTracks.length === 0) {
            console.warn('新音訊流沒有音訊軌道');
            return;
        }
        
        const newAudioTrack = audioTracks[0];
        
        // 🎵 關鍵修復：更新 localStream 的音訊軌道
        // 這樣當觀眾重整後重新加入時，會收到混音後的音訊
        if (localStream) {
            // 保存原始麥克風音訊軌道(只在第一次啟用分頁音訊時保存)
            if (!originalMicAudioTrack && !isTabAudioEnabled) {
                const oldAudioTracks = localStream.getAudioTracks();
                if (oldAudioTracks.length > 0) {
                    originalMicAudioTrack = oldAudioTracks[0];
                    console.log('✅ 已保存原始麥克風音訊軌道:', originalMicAudioTrack.id);
                }
            }
            
            // 移除舊的音訊軌道
            const oldAudioTracks = localStream.getAudioTracks();
            oldAudioTracks.forEach(track => {
                localStream.removeTrack(track);
                console.log('已從 localStream 移除舊音訊軌道:', track.id);
            });
            
            // 添加新的音訊軌道(混音或原始)
            localStream.addTrack(newAudioTrack);
            console.log('✅ 已將音訊軌道添加到 localStream:', newAudioTrack.id);
        }
        
        // 更新所有觀眾的WebRTC連接
        for (const [viewerId, peerConnection] of peerConnections) {
            try {
                // 找到現有的音訊發送器
                const audioSender = peerConnection.getSenders().find(sender => 
                    sender.track && sender.track.kind === 'audio'
                );
                
                if (audioSender) {
                    // 替換音訊軌道
                    await audioSender.replaceTrack(newAudioTrack);
                    console.log(`已為觀眾 ${viewerId} 更新音訊軌道`);
                } else {
                    // 添加新的音訊軌道
                    peerConnection.addTrack(newAudioTrack, newAudioStream);
                    console.log(`已為觀眾 ${viewerId} 添加音訊軌道`);
                }
            } catch (error) {
                console.error(`更新觀眾 ${viewerId} 的音訊軌道失敗:`, error);
            }
        }
        
        addMessage('系統', '🔄 音訊軌道已更新給所有觀眾');
    } catch (error) {
        console.error('更新音訊軌道失敗:', error);
        addMessage('系統', '❌ 音訊軌道更新失敗');
    }
}

// 切換分頁音訊功能
async function toggleTabAudio() {
    const tabAudioBtn = document.getElementById('tabAudioBtn');
    
    if (!tabAudioBtn) {
        console.error('找不到分頁音訊按鈕');
        return;
    }
    
    if (!isTabAudioEnabled) {
        // 啟用分頁音訊
        try {
            // 檢查是否正在直播
            if (!isStreaming) {
                addMessage('系統', '⚠️ 請先開始直播再啟用背景音樂分享');
                return;
            }
            
            addMessage('系統', '📻 準備啟用背景音樂分享...');
            tabAudioStream = await captureTabWithAudio();
            
            if (tabAudioStream) {
                isTabAudioEnabled = true;
                tabAudioBtn.classList.add('active');
                tabAudioBtn.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
                tabAudioBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                
                // 創建混音音訊流
                mixedAudioStream = await createMixedStream(tabAudioStream);
                
                if (mixedAudioStream && isStreaming) {
                    // 更新WebRTC連接中的音訊軌道
                    await updateAudioTracks(mixedAudioStream);
                    addMessage('系統', '🎉 背景音樂分享已成功啟用！觀眾現在可以聽到音樂了');
                    
                    // 🎵 發送分頁音訊啟用狀態
                    if (window.tabAudioReconnectManager) {
                        window.tabAudioReconnectManager.toggleTabAudio(true, 'tab');
                    }
                } else {
                    throw new Error('混音音訊流創建失敗');
                }
            } else {
                throw new Error('無法捕獲分頁音訊');
            }
        } catch (error) {
            console.error('啟用分頁音訊失敗:', error);
            addMessage('系統', '❌ 啟用背景音樂分享失敗: ' + error.message);
            
            // 重置狀態
            isTabAudioEnabled = false;
            if (tabAudioStream) {
                tabAudioStream.getTracks().forEach(track => track.stop());
                tabAudioStream = null;
            }
            tabAudioBtn.classList.remove('active');
            tabAudioBtn.style.background = '';
            tabAudioBtn.innerHTML = '<i class="fas fa-volume-off"></i>';
        }
    } else {
        // 停用分頁音訊
        try {
            addMessage('系統', '🔇 正在停用背景音樂分享...');
            
            if (tabAudioStream) {
                tabAudioStream.getTracks().forEach(track => track.stop());
                tabAudioStream = null;
            }
            
            if (audioContext && audioContext.state !== 'closed') {
                await audioContext.close();
                audioContext = null;
            }
            
            if (mixedAudioStream) {
                mixedAudioStream.getTracks().forEach(track => track.stop());
                mixedAudioStream = null;
            }
            
            isTabAudioEnabled = false;
            tabAudioBtn.classList.remove('active');
            tabAudioBtn.style.background = '';
            tabAudioBtn.innerHTML = '<i class="fas fa-volume-off"></i>';
            
            // 🎵 恢復到原始麥克風音訊
            if (originalMicAudioTrack && isStreaming) {
                console.log('🔄 恢復原始麥克風音訊軌道:', originalMicAudioTrack.id);
                
                // 創建包含原始麥克風音訊的流
                const originalMicStream = new MediaStream([originalMicAudioTrack]);
                await updateAudioTracks(originalMicStream);
                
                addMessage('系統', '✅ 背景音樂分享已停用，恢復為純麥克風音訊');
            } else {
                console.warn('⚠️ 找不到原始麥克風音訊軌道');
                addMessage('系統', '⚠️ 無法恢復原始音訊，請重新啟動攝影機');
            }
            
            // 🎵 發送分頁音訊停用狀態
            if (window.tabAudioReconnectManager) {
                window.tabAudioReconnectManager.toggleTabAudio(false, 'tab');
            }
        } catch (error) {
            console.error('停用分頁音訊失敗:', error);
            addMessage('系統', '❌ 停用背景音樂分享時發生錯誤: ' + error.message);
        }
    }
}

// ========== 視頻編碼優化功能 ==========

// 優化視頻編碼器設定，提高觀眾端解碼成功率
function optimizeVideoEncodingForCompatibility() {
    console.log('🔧 [編碼優化] 開始優化視頻編碼設定...');
    
    // 檢查發送端能力
    if (window.RTCRtpSender && RTCRtpSender.getCapabilities) {
        const videoCapabilities = RTCRtpSender.getCapabilities('video');
        if (videoCapabilities && videoCapabilities.codecs) {
            console.log('🎥 [發送端] 支援的視頻編解碼器:');
            videoCapabilities.codecs.forEach(codec => {
                console.log(`  ${codec.mimeType} - ${codec.clockRate || 'N/A'}Hz`);
            });
            
            // 尋找最佳編解碼器
            const preferredCodecs = [
                'video/H264', // 最廣泛支援
                'video/VP8',  // WebRTC 標準
                'video/VP9'   // 較新但支援良好
            ];
            
            const availableCodecs = videoCapabilities.codecs.filter(codec => 
                preferredCodecs.some(preferred => codec.mimeType.includes(preferred))
            );
            
            console.log('🎯 [編碼優化] 可用的首選編解碼器:', availableCodecs.length);
            availableCodecs.forEach(codec => {
                console.log(`  ✅ ${codec.mimeType}`);
            });
            
            // addMessage('系統', `🎥 檢測到 ${availableCodecs.length} 個兼容的視頻編解碼器`);
        }
    }
    
    return true;
}

// 為 PeerConnection 設定首選編解碼器
function setPreferredVideoCodecs(peerConnection) {
    if (!peerConnection || !RTCRtpSender.getCapabilities) {
        return;
    }
    
    try {
        const transceivers = peerConnection.getTransceivers();
        const videoTransceiver = transceivers.find(t => 
            t.sender && t.sender.track && t.sender.track.kind === 'video'
        );
        
        if (videoTransceiver) {
            const capabilities = RTCRtpSender.getCapabilities('video');
            if (capabilities && capabilities.codecs) {
                // 按偏好排序編解碼器
                const sortedCodecs = capabilities.codecs.sort((a, b) => {
                    const preferenceOrder = [
                        'video/H264',
                        'video/VP8', 
                        'video/VP9',
                        'video/AV1'
                    ];
                    
                    const aIndex = preferenceOrder.findIndex(p => a.mimeType.includes(p));
                    const bIndex = preferenceOrder.findIndex(p => b.mimeType.includes(p));
                    
                    if (aIndex === -1) return 1;
                    if (bIndex === -1) return -1;
                    
                    return aIndex - bIndex;
                });
                
                // 設定編解碼器偏好
                videoTransceiver.setCodecPreferences(sortedCodecs);
                console.log('✅ [編碼優化] 已設定編解碼器偏好順序');
                addMessage('系統', '✅ 視頻編碼器已優化');
            }
        }
    } catch (error) {
        console.warn('⚠️ [編碼優化] 設定編解碼器偏好失敗:', error);
        // 不影響主要功能，繼續執行
    }
}

// 在建立 PeerConnection 後呼叫編碼優化
function createOptimizedPeerConnection(viewerId) {
    try {
        console.log('為觀眾', viewerId, '建立優化的 WebRTC 連接');
        const peerConnection = new RTCPeerConnection(rtcConfiguration);
        
        // 添加本地串流軌道
        if (localStream) {
            console.log('本地串流軌道數量:', localStream.getTracks().length);
            
            const videoTracks = localStream.getVideoTracks();
            const audioTracks = localStream.getAudioTracks();
            
            console.log(`視訊軌道: ${videoTracks.length}, 音訊軌道: ${audioTracks.length}`);
            
            // 添加視訊軌道
            videoTracks.forEach((track, index) => {
                try {
                    const sender = peerConnection.addTrack(track, localStream);
                    console.log(`✅ 已添加視訊軌道 ${index}:`, track.readyState, track.id);
                    
                    // 嘗試優化此發送器的編碼參數
                    if (sender.setParameters) {
                        sender.getParameters().then(params => {
                            if (params.encodings && params.encodings.length > 0) {
                                // 設定適中的碼率，確保兼容性
                                params.encodings[0].maxBitrate = 2500000; // 2.5 Mbps
                                params.encodings[0].maxFramerate = 30;
                                
                                return sender.setParameters(params);
                            }
                        }).then(() => {
                            console.log(`✅ 已優化視訊軌道 ${index} 編碼參數`);
                        }).catch(error => {
                            console.warn(`⚠️ 優化視訊軌道 ${index} 編碼參數失敗:`, error);
                        });
                    }
                } catch (error) {
                    console.error(`❌ 添加視訊軌道 ${index} 失敗:`, error);
                }
            });
            
            // 添加音訊軌道
            audioTracks.forEach((track, index) => {
                try {
                    const sender = peerConnection.addTrack(track, localStream);
                    console.log(`✅ 已添加音訊軌道 ${index}:`, track.readyState, track.id);
                } catch (error) {
                    console.error(`❌ 添加音訊軌道 ${index} 失敗:`, error);
                }
            });
            
            // addMessage('系統', `📹 已為觀眾 ${viewerId.substr(-3)} 添加 ${videoTracks.length} 個視訊軌道和 ${audioTracks.length} 個音訊軌道`);
            
            // 延遲設定編解碼器偏好，確保軌道已添加
            setTimeout(() => {
                setPreferredVideoCodecs(peerConnection);
            }, 100);
            
        } else {
            console.error('❌ 本地串流不存在');
            addMessage('系統', `❌ 無法為觀眾 ${viewerId.substr(-3)} 建立連接：本地串流不存在`);
            return null;
        }
        
        return peerConnection;
        
    } catch (error) {
        console.error('建立優化 WebRTC 連接失敗:', error);
        addMessage('系統', `❌ 為觀眾 ${viewerId.substr(-3)} 建立優化連接失敗`);
        return null;
    }
}

// 視頻編碼優化已移至 initializeBroadcaster() 統一處理

console.log('✅ 視頻編碼優化功能已載入');

// 确保所有函数都在全局作用域中可用
// 應用視頻特效 - 基於 WebRTC 教學和 Webcam Toy 概念
function applyVideoEffect(effectType) {
    console.log(`🎨 應用視頻特效: ${effectType}`);
    
    if (!window.videoEffectsProcessor) {
        console.error('視頻特效處理器未初始化');
        addMessage('系統', '❌ 特效系統未就緒');
        return;
    }
    
    const localVideo = document.getElementById('localVideo');
    if (!localVideo || !localVideo.srcObject) {
        console.error('本地視頻元素或流不存在');
        addMessage('系統', '❌ 請先開始直播才能使用特效');
        return;
    }
    
    try {
        // 儲存原始視訊流，避免重複處理造成顏色累積
        if (!baseVideoStream) {
            baseVideoStream = localStream || localVideo.srcObject;
            console.log('📼 保存原始視訊流供特效處理');
        }

        const sourceStream = baseVideoStream;
        if (!sourceStream) {
            console.error('找不到可用的原始視訊流');
            addMessage('系統', '❌ 無法取得原始畫面進行特效處理');
            return;
        }

        // 使用原始視訊流作為特效輸入
        window.videoEffectsProcessor.setVideoSource(sourceStream);

        // 應用特效
        window.videoEffectsProcessor.setEffect(effectType);

        // 開始處理
        window.videoEffectsProcessor.startProcessing();

        // 等待一小段時間後獲取處理後的流
        setTimeout(() => {
            const processedStream = window.videoEffectsProcessor.getProcessedStream();
            if (processedStream) {
                // 補上原始音訊軌道，確保直播聲音不受影響
                if (sourceStream.getAudioTracks().length > 0 && processedStream.getAudioTracks().length === 0) {
                    sourceStream.getAudioTracks().forEach(track => {
                        const clonedTrack = track.clone();
                        processedStream.addTrack(clonedTrack);
                    });
                }

                // 替換本地視頻顯示
                localVideo.srcObject = processedStream;

                // 更新全局流引用，確保後續操作使用特效後的流
                localStream = processedStream;

                // 更新所有觀眾的流
                updateStreamForAllViewers(processedStream);

                addMessage('系統', `🎨 已套用 ${getEffectDisplayName(effectType)} 特效`);
                console.log(`✅ 特效 ${effectType} 已成功應用`);
            }
        }, 150);

    } catch (error) {
        console.error('應用特效時出錯:', error);
        addMessage('系統', `❌ 特效應用失敗: ${error.message}`);
    }
}

// 恢復原始視頻流
function restoreOriginalStream() {
    console.log('🔄 恢復原始視頻流');
    
    if (window.videoEffectsProcessor) {
        window.videoEffectsProcessor.stopProcessing();
    }

    const originalStream = baseVideoStream || localStream;
    
    if (originalStream) {
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.srcObject = originalStream;

            // 更新全局流引用
            localStream = originalStream;

            // 更新所有觀眾的流
            updateStreamForAllViewers(originalStream);

            addMessage('系統', '🔄 已恢復原始畫面');
            console.log('✅ 原始視頻流已恢復');
        }
    }

    if (window.videoEffectsProcessor) {
        window.videoEffectsProcessor.setEffect('none');
    }
    baseVideoStream = null;
}

// 更新所有觀眾的視頻流
async function updateStreamForAllViewers(newStream) {
    console.log('📡 更新所有觀眾的視頻流');
    
    if (!newStream) {
        console.error('新視頻流不存在');
        return;
    }
    
    // 更新全局流
    const videoTrack = newStream.getVideoTracks()[0];
    if (videoTrack) {
        // 更新所有 PeerConnection 的視頻軌道
        for (const [viewerId, peerConnection] of peerConnections) {
            const sender = peerConnection.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );
            
            if (sender) {
                try {
                    await sender.replaceTrack(videoTrack);
                    console.log(`✅ 已為觀眾 ${viewerId.substr(-3)} 更新視頻軌道`);
                } catch (error) {
                    console.error(`❌ 更新觀眾 ${viewerId.substr(-3)} 視頻軌道失敗:`, error);
                }
            }
        }
    }
}

// 獲取特效顯示名稱
function getEffectDisplayName(effectType) {
    const displayNames = {
        'none': '無特效',
        'vintage': '復古濾鏡',
        'blackwhite': '黑白濾鏡',
        'sepia': '懷舊濾鏡',
    'invert': '反相濾鏡',
    'glasses': '戴眼鏡特效',
        'edge': '邊緣檢測',
        'emboss': '浮雕效果',
        'blur': '模糊效果',
        'bright': '亮度增強',
        'rainbow': '彩虹效果'
    };
    
    return displayNames[effectType] || effectType;
}

// 兼容性函數 - 僅在 UI 版本未載入時才提供後備處理
if (!window.applyEffect) {
    window.applyEffect = function(effectType) {
        applyVideoEffect(effectType);
    };
}

console.log('=== 检查全局函数可用性 ===');
console.log('toggleStream:', typeof toggleStream);
console.log('toggleVideo:', typeof toggleVideo);
console.log('toggleAudio:', typeof toggleAudio);
console.log('shareScreen:', typeof shareScreen);
console.log('toggleTabAudio:', typeof toggleTabAudio);
console.log('applyVideoEffect:', typeof applyVideoEffect);
console.log('🎨 視頻特效功能已就緒');
console.log('============================');
