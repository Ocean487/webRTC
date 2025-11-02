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
window.titleSocket = null; // 讓其他模組可以透過 window 訪問
let titleSocketReconnectAttempts = 0; // 重連嘗試次數
let titleSocketReconnectTimer = null; // 重連計時器
const MAX_RECONNECT_ATTEMPTS = 5; // 最多重連5次

const FACE_API_LOCAL_MODEL_PATH = window.FACE_API_MODEL_BASE || '/weights';
const FACE_API_CDN_MODEL_PATH = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';
const GLASSES_IMAGE_PATH = 'images/glass.png';
const DOG_IMAGE_PATH = 'images/dog.png';
const PINGO_IMAGE_PATH = 'images/pingo.png';
const PINGO_AUDIO_PATH = 'images/pingo.mp3';
const SECH_IMAGE_PATH = 'images/sech.png';
const SECH_AUDIO_PATH = 'images/sech.mp3';
const LAIXIONG_IMAGE_PATH = 'images/chder.png';
const LAIXIONG_AUDIO_PATH = 'images/chder.mp3';
const MAO_ZED_IMAGE_PATH = 'images/Mao_Zed.png';
const MAO_ZED_AUDIO_PATH = 'images/Mao_Zed.mp3';
const LAOGAO_IMAGE_PATH = 'images/high.png';
const LAOGAO_AUDIO_PATH = 'images/high.mp3';
const GUODONG_IMAGE_PATH = 'images/don.png';
const GUODONG_AUDIO_PATH = 'images/don.mp3';
const HUOGUO_IMAGE_PATH = 'images/god.png';
const HUOGUO_AUDIO_PATH = 'images/god.mp3';
const HSINCHU_IMAGE_PATH = 'images/god2.png';
const HSINCHU_AUDIO_PATH = 'images/god2.mp3';
const CAR_IMAGE_PATH = 'images/Car.png';
const CAR_AUDIO_PATH = 'images/Car.mp3';
const CAR2_IMAGE_PATH = 'images/Car2.png';
const CAR2_AUDIO_PATH = 'images/Car2.mp3';
const LOOK_IMAGE_PATH = 'images/look.png';
const LOOK_AUDIO_PATH = 'images/look.mp3';
const LUMUMU_IMAGE_PATH = 'images/lumumu.png';
const LUMUMU_AUDIO_PATH = 'images/lumumu.mp3';
const CHIIKAWA_IMAGE_PATH = 'images/Chiikawa.png';
const CHIIKAWA_AUDIO_PATH = 'images/Chiikawa.mp3';
const CAT_IMAGE_PATH = 'images/cat.png';
const CAT_AUDIO_PATH = 'images/cat.mp3';
const POLAR_IMAGE_PATH = 'images/chsihu.png';
const POLAR_AUDIO_PATH = 'images/chsihu.mp3';
const FULL_FACE_LANDMARK_INDICES = Array.from({ length: 68 }, (_, index) => index);
const FACE_API_MODEL_PATH_FORMAT = (typeof window !== 'undefined' && typeof window.FACE_API_MODEL_PATH_FORMAT === 'string')
    ? window.FACE_API_MODEL_PATH_FORMAT
    : 'manifest';
const FACE_API_ADDITIONAL_SOURCES = (typeof window !== 'undefined' && Array.isArray(window.FACE_API_MODEL_SOURCES))
    ? window.FACE_API_MODEL_SOURCES
    : undefined;

let broadcasterGlassesTracker = null;
let broadcasterDogTracker = null;
let broadcasterPingoTracker = null;
let broadcasterPingoAudio = null;
let broadcasterSechTracker = null;
let broadcasterSechAudio = null;
let broadcasterLaixiongTracker = null;
let broadcasterLaixiongAudio = null;
let broadcasterMaoZedTracker = null;
let broadcasterMaoZedAudio = null;
let broadcasterLaogaoTracker = null;
let broadcasterLaogaoAudio = null;
let broadcasterGuodongTracker = null;
let broadcasterGuodongAudio = null;
let broadcasterHuoguoTracker = null;
let broadcasterHuoguoAudio = null;
let broadcasterHsinchuTracker = null;
let broadcasterHsinchuAudio = null;
let broadcasterCarTracker = null;
let broadcasterCarAudio = null;
let broadcasterCar2Tracker = null;
let broadcasterCar2Audio = null;
let broadcasterLookTracker = null;
let broadcasterLookAudio = null;
let broadcasterLumumuTracker = null;
let broadcasterLumumuAudio = null;
let broadcasterChiikawaTracker = null;
let broadcasterChiikawaAudio = null;
let broadcasterCatTracker = null;
let broadcasterCatAudio = null;
let broadcasterPolarTracker = null;
let broadcasterPolarAudio = null;

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
    // 檢查是否已經連接或正在連接
    if (titleSocket && (titleSocket.readyState === WebSocket.OPEN || titleSocket.readyState === WebSocket.CONNECTING)) {
        console.log('⚠️ titleSocket 已存在，跳過重複初始化');
        return; 
    }

    // 檢查是否超過最大重連次數
    if (titleSocketReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('❌ titleSocket 重連次數已達上限，停止重連');
        return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    console.log('🔌 初始化標題WebSocket連接:', wsUrl, `(第 ${titleSocketReconnectAttempts + 1} 次嘗試)`);
    titleSocket = new WebSocket(wsUrl);
    window.titleSocket = titleSocket;
    
    titleSocket.onopen = function() {
        console.log('✅ 標題WebSocket已連接');
        titleSocketReconnectAttempts = 0; // 重置重連計數
        
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
    
    // 處理來自 titleSocket 的消息，轉發給全域的處理器（例如 viewer.js 的 handleWebSocketMessage）
    titleSocket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('[titleSocket] 收到消息:', data.type, data);

            // 優先使用全域的 handleWebSocketMessage（viewer.js 提供）
            if (typeof window.handleWebSocketMessage === 'function') {
                window.handleWebSocketMessage(data);
                return;
            }

            // 若沒有 handleWebSocketMessage，嘗試使用更專門的 handler
            if (data.type === 'broadcaster_info' || data.type === 'title_update' || data.type === 'effect_update') {
                if (typeof window.handleTitleUpdate === 'function' && data.type === 'title_update') {
                    window.handleTitleUpdate(data);
                    return;
                }

                if (typeof window.updateBroadcasterInfo === 'function' && data.type === 'broadcaster_info') {
                    window.updateBroadcasterInfo(data.broadcasterInfo || { displayName: data.displayName || data.broadcaster });
                    return;
                }
            }

            console.log('[titleSocket] 無可用全域路由，消息類型:', data.type);
        } catch (err) {
            console.error('[titleSocket] 解析或處理消息失敗:', err);
        }
    };
    
    titleSocket.onclose = function(event) {
        console.log('⚠️ 標題WebSocket連接已關閉', event.code, event.reason);
        titleSocket = null; // 清除引用
        window.titleSocket = null;
        
        // 清除舊的重連計時器
        if (titleSocketReconnectTimer) {
            clearTimeout(titleSocketReconnectTimer);
            titleSocketReconnectTimer = null;
        }
        
        // 只在未超過最大重連次數時才重連
        if (titleSocketReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            titleSocketReconnectAttempts++;
            const delay = Math.min(3000 * titleSocketReconnectAttempts, 15000); // 漸進式延遲，最多15秒
            console.log(`🔄 將在 ${delay/1000} 秒後重連 titleSocket (第 ${titleSocketReconnectAttempts} 次)`);
            
            titleSocketReconnectTimer = setTimeout(() => {
                initTitleWebSocket();
            }, delay);
        } else {
            console.error('❌ titleSocket 重連次數已達上限，停止重連');
        }
    };
    
    titleSocket.onerror = function(error) {
        console.error('❌ 標題WebSocket連接錯誤:', error);
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

                const broadcasterId = myBroadcasterId || getBroadcasterIdFromUrl();

                if (!broadcasterId) {
                    console.warn('⚠️ 無法識別主播ID，標題更新未廣播');
                    return;
                }

                myBroadcasterId = broadcasterId;
                
                // 使用專門的標題WebSocket發送更新
                if (titleSocket && titleSocket.readyState === WebSocket.OPEN) {
                    titleSocket.send(JSON.stringify({
                        type: 'title_update',
                        broadcasterId,
                        title: currentStreamTitle,
                        timestamp: Date.now()
                    }));
                    console.log('✅ 已通過titleSocket發送標題更新');
                } else {
                    console.warn('⚠️ titleSocket未連接，將僅通過streamingSocket發送');
                    // 不在這裡重連，避免無限循環
                }
                
                // 如果正在直播，也通過主要的streamingSocket發送
                if (window.streamingSocket && window.streamingSocket.readyState === WebSocket.OPEN) {
                    window.streamingSocket.send(JSON.stringify({
                        type: 'title_update',
                        broadcasterId,
                        title: currentStreamTitle,
                        timestamp: Date.now()
                    }));
                    console.log('✅ 已通過streamingSocket發送標題更新');
                }
            } else {
                currentTitleDisplay.textContent = '目前標題: 未設定';
            }
        }
    }
}

// 實時標題更新（當輸入時）
function onTitleInput() {
    // 防抖處理，避免過頻繁的更新，但縮短延遲以提供更即時的體驗
    clearTimeout(window.titleUpdateTimeout);
    window.titleUpdateTimeout = setTimeout(() => {
        updateStreamTitle();
        // 立即廣播到觀眾端
        const titleInput = document.getElementById('streamTitleInput');
        if (titleInput && titleInput.value.trim()) {
            const broadcasterId = myBroadcasterId || getBroadcasterIdFromUrl();
            const payload = {
                type: 'title_update',
                broadcasterId,
                title: titleInput.value.trim(),
                timestamp: Date.now()
            };
            
            // 通過兩個通道發送，確保到達
            if (titleSocket && titleSocket.readyState === WebSocket.OPEN) {
                titleSocket.send(JSON.stringify(payload));
                console.log('⚡ 實時標題更新已發送 (titleSocket):', payload.title);
            }
            
            if (window.streamingSocket && window.streamingSocket.readyState === WebSocket.OPEN) {
                window.streamingSocket.send(JSON.stringify(payload));
                console.log('⚡ 實時標題更新已發送 (streamingSocket):', payload.title);
            }
        }
    }, 300); // 300ms 防抖，更即時
}

// 處理標題輸入框的按鍵事件
function handleTitleKeyPress(event) {
    // 檢查是否按下Enter鍵
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault(); // 防止表單提交
        
        // 立即觸發標題更新
        clearTimeout(window.titleUpdateTimeout);
        updateStreamTitle();
        
        // 確保主播名稱也通過titleSocket發送（包含 broadcasterId 與一致格式）
        if (titleSocket && titleSocket.readyState === WebSocket.OPEN && currentUser) {
            const broadcasterId = myBroadcasterId || getBroadcasterIdFromUrl();
            titleSocket.send(JSON.stringify({
                type: 'broadcaster_info',
                broadcasterId,
                // 向後相容：保留舊欄位 broadcaster（字串）
                broadcaster: currentUser.username || currentUser.email || currentUser.displayName || 'Anonymous',
                // 新格式：提供物件，便於觀眾端顯示
                displayName: currentUser.displayName || currentUser.username || 'Anonymous',
                broadcasterInfo: {
                    displayName: currentUser.displayName || currentUser.username || 'Anonymous',
                    avatarUrl: currentUser.avatarUrl || null
                },
                timestamp: Date.now()
            }));
            console.log('已通過titleSocket發送主播資訊到觀眾端:', currentUser.username || currentUser.email || currentUser.displayName);
        }
        
        // 也通過主要的streamingSocket發送（如果存在）
        if (window.streamingSocket && window.streamingSocket.readyState === WebSocket.OPEN && currentUser) {
            const broadcasterId = myBroadcasterId || getBroadcasterIdFromUrl();
            window.streamingSocket.send(JSON.stringify({
                type: 'broadcaster_info',
                broadcasterId,
                broadcaster: currentUser.username || currentUser.email || currentUser.displayName || 'Anonymous',
                displayName: currentUser.displayName || currentUser.username || 'Anonymous',
                broadcasterInfo: {
                    displayName: currentUser.displayName || currentUser.username || 'Anonymous',
                    avatarUrl: currentUser.avatarUrl || null
                },
                timestamp: Date.now()
            }));
            console.log('已通過streamingSocket發送主播資訊到觀眾端:', currentUser.username || currentUser.email || currentUser.displayName);
        }
    }
}

// 全域 API：從其他模組呼叫以廣播標題更新（接受可選的 broadcasterId）
window.sendTitleUpdate = function(title, broadcasterId = null) {
    try {
        const id = broadcasterId || myBroadcasterId || getBroadcasterIdFromUrl();
        const payload = {
            type: 'title_update',
            broadcasterId: id,
            title: title || currentStreamTitle || '精彩直播中',
            timestamp: Date.now()
        };

        let sent = false;
        
        if (titleSocket && titleSocket.readyState === WebSocket.OPEN) {
            titleSocket.send(JSON.stringify(payload));
            console.log('[sendTitleUpdate] ✅ 已通過 titleSocket 發送:', payload.title);
            sent = true;
        }

        if (window.streamingSocket && window.streamingSocket.readyState === WebSocket.OPEN) {
            window.streamingSocket.send(JSON.stringify(payload));
            console.log('[sendTitleUpdate] ✅ 已通過 streamingSocket 發送:', payload.title);
            sent = true;
        }
        
        if (!sent) {
            console.warn('[sendTitleUpdate] ⚠️ 無可用 WebSocket 連接');
        }
    } catch (err) {
        console.error('[sendTitleUpdate] ❌ 發送失敗:', err);
    }
};

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
            
            // 不在這裡初始化 titleSocket，由 script.js 統一管理
            console.log('✅ 用戶登入成功，等待 script.js 初始化連接');
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
        // 交由集中註冊的事件監聽器處理，避免重複觸發
        streamBtn.onclick = null;
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
*/

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
    
    // 清除 titleSocket 重連計時器
    if (titleSocketReconnectTimer) {
        clearTimeout(titleSocketReconnectTimer);
        titleSocketReconnectTimer = null;
    }
    
    // 關閉 titleSocket 連接
    if (titleSocket) {
        titleSocket.close();
        titleSocket = null;
    }
    
    console.log('🧹 頁面卸載，已清理所有連接');
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
let canvasContext = null;
let effectCanvas = null;

// 確保函數在全域範圍可用
window.applyEffect = applyEffect;
window.applyNewEffect = applyNewEffect;
window.clearEffect = clearEffect;
window.createAnimationOverlay = createAnimationOverlay;
window.broadcastEffectToViewers = broadcastEffectToViewers;
window.currentEffect = currentEffect;

function applyEffect(effectType, triggerButton = null) {
    console.log('🎨 applyEffect 被調用:', effectType);
    
    const videoElement = document.getElementById('localVideo');
    if (!videoElement) {
        console.error('❌ 找不到 localVideo 元素!');
        return;
    }
    
    console.log('✅ 找到視頻元素:', videoElement);
    console.log('📦 視頻容器:', videoElement.parentElement);
    
    // 🎨 如果點擊的是當前已啟用的特效，則關閉特效
    if (currentEffect === effectType) {
        console.log('🔄 關閉當前特效:', currentEffect);
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
        console.log('🔄 切換特效:', currentEffect, '→', effectType);
        clearEffect();
        broadcastEffectToViewers('clear');
        
        // 稍微延遲後再套用新特效，讓清除效果更明顯
        setTimeout(() => {
            applyNewEffect(effectType, videoElement, triggerButton);
        }, 100);
    } else {
        // 如果沒有舊特效，直接套用新特效
        console.log('✨ 套用新特效:', effectType);
        applyNewEffect(effectType, videoElement, triggerButton);
    }
}

// 🎨 新增：套用新特效的輔助函數
function applyNewEffect(effectType, videoElement, triggerButton = null) {
    console.log('🔧 applyNewEffect 開始:', effectType);
    
    // 移除所有特效按鈕的active狀態
    document.querySelectorAll('.effect-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (!videoElement) {
        videoElement = document.getElementById('localVideo');
    }

    if (!videoElement) {
        console.error('❌ applyNewEffect: 找不到 localVideo 元素');
        return;
    }

    console.log('📹 視頻元素確認:', {
        width: videoElement.offsetWidth,
        height: videoElement.offsetHeight,
        display: window.getComputedStyle(videoElement).display
    });

    if (typeof hideFilmFrameOverlay === 'function') {
        hideFilmFrameOverlay(videoElement);
    }

    resetVideoEffectStyles(videoElement);

    if (triggerButton && effectType !== 'clear') {
        triggerButton.classList.add('active');
        console.log('✅ 按鈕標記為 active');
    }
    
    if (effectType === 'clear') {
        // 通知觀眾端清除特效
        broadcastEffectToViewers('clear');
        return;
    }
    
    // 設置新特效
    currentEffect = effectType;
    const videoContainer = videoElement.parentElement;
    let messageHandled = false;
    
    console.log('🎨 開始套用特效:', effectType);
    
    // 添加特效類別到影片元素
    switch (effectType) {
        case 'blur':
            videoElement.style.filter = 'blur(8px)';
            console.log('✅ 模糊特效已套用, filter:', videoElement.style.filter);
            break;
        case 'rainbow':
            // 將漸變彩虹覆蓋層套用到容器
            if (videoContainer) {
                ensureRainbowOverlayLayers(videoContainer);
                videoContainer.classList.remove('effect-rainbow-filter');
                void videoContainer.offsetHeight; // 觸發重排
                videoContainer.classList.add('effect-rainbow-filter');
                console.log('✅ 漸變彩虹覆蓋層已套用到容器');
            } else {
                videoElement.classList.add('effect-rainbow-filter');
                const fallbackContainer = videoElement.parentElement;
                if (fallbackContainer) {
                    ensureRainbowOverlayLayers(fallbackContainer);
                }
                console.log('✅ 彩虹特效已套用到視頻元素（降級模式）');
            }
            break;
        case 'bw':
            videoElement.style.filter = 'grayscale(100%)';
            videoElement.style.webkitFilter = 'grayscale(100%)';
            console.log('✅ 黑白特效已套用, filter:', videoElement.style.filter);
            // 驗證是否成功套用
            setTimeout(() => {
                const computedFilter = window.getComputedStyle(videoElement).filter;
                console.log('🔍 實際計算後的 filter:', computedFilter);
            }, 100);
            break;
        case 'sepia':
            videoElement.style.filter = 'sepia(100%)';
            console.log('✅ 懷舊特效已套用');
            break;
        case 'glasses':
            showGlassesOverlay(videoElement);
            console.log('✅ 眼鏡特效已套用');
            break;
        case 'dog':
            showDogOverlay(videoElement);
            console.log('✅ 狗狗特效已套用');
            break;
        case 'pingo':
            showPingoOverlay(videoElement);
            console.log('✅ 皮鼓特效已套用');
            break;
        case 'sech':
            showSechOverlay(videoElement);
            console.log('✅ 世間特效已套用');
            break;
        case 'laixiong':
            showLaixiongOverlay(videoElement);
            console.log('✅ 賴兄特效已套用');
            break;
        case 'maoZed':
            showMaoZedOverlay(videoElement);
            console.log('✅ 毛主席特效已套用');
            break;
        case 'laogao':
            showLaogaoOverlay(videoElement);
            console.log('✅ 老高特效已套用');
            break;
        case 'guodong':
            showGuodongOverlay(videoElement);
            console.log('✅ 國棟特效已套用');
            break;
        case 'huoguo':
            showHuoguoOverlay(videoElement);
            console.log('✅ 火鍋特效已套用');
            break;
        case 'hsinchu':
            showHsinchuOverlay(videoElement);
            console.log('✅ 新竹特效已套用');
            break;
        case 'car':
            showCarOverlay(videoElement);
            console.log('✅ 車特效已套用');
            break;
        case 'car2':
            showCar2Overlay(videoElement);
            console.log('✅ 上車特效已套用');
            break;
        case 'look':
            showLookOverlay(videoElement);
            console.log('✅ 回答我特效已套用');
            break;
        case 'lumumu':
            showLumumuOverlay(videoElement);
            console.log('✅ 秀燕特效已套用');
            break;
        case 'chiikawa':
            showChiikawaOverlay(videoElement);
            console.log('✅ 吉伊卡哇特效已套用');
            break;
        case 'cat':
            showCatOverlay(videoElement);
            console.log('✅ 哈基米特效已套用');
            break;
        case 'polar':
            showPolarOverlay(videoElement);
            console.log('✅ 北極熊特效已套用');
            break;
        case 'bright':
            videoElement.style.filter = 'brightness(1.15) contrast(0.95) saturate(1.1)';
            console.log('✅ 美白特效已套用');
            break;
        case 'warm':
            // 紅紅的暖色調效果
            videoElement.style.filter = 'sepia(1) saturate(2.2) hue-rotate(-35deg) brightness(1.08) contrast(1.12)';
            console.log('✅ 暖色調特效已套用, filter:', videoElement.style.filter);
            // 驗證是否成功套用
            setTimeout(() => {
                const computedFilter = window.getComputedStyle(videoElement).filter;
                console.log('🔍 實際計算後的 filter:', computedFilter);
            }, 100);
            break;
        case 'invert':
            videoElement.style.filter = 'invert(1) hue-rotate(180deg)';
            console.log('✅ 反相特效已套用');
            if (typeof applyVideoEffect === 'function') {
                applyVideoEffect('invert');
                messageHandled = true;
            }
            break;
        case 'rainbowBorder':
            // 邊框樣式的彩虹
            if (videoContainer) {
                videoContainer.classList.add('effect-rainbow-border');
                console.log('✅ 彩虹邊框已套用, classes:', videoContainer.classList.toString());
                // 驗證容器樣式
                setTimeout(() => {
                    const hasClass = videoContainer.classList.contains('effect-rainbow-border');
                    const overflow = window.getComputedStyle(videoContainer).overflow;
                    console.log('🔍 邊框驗證:', { hasClass, overflow });
                }, 100);
            }
            break;
        case 'neon':
            videoElement.style.filter = 'contrast(1.2) saturate(1.3)';
            if (videoContainer) {
                videoContainer.classList.add('effect-neon-border');
                console.log('✅ 霓虹邊框已套用');
            }
            break;
        case 'glow':
            if (videoContainer) {
                ensureLightningBorderOverlay(videoContainer);
                videoContainer.classList.add('effect-glow-border');
                console.log('✅ 閃電邊框已套用');
            }
            break;
        case 'particles':
            createParticleEffect();
            console.log('✅ 星星動畫已啟動');
            break;
        case 'hearts':
            createHeartEffect();
            console.log('✅ 愛心動畫已啟動');
            break;
        case 'confetti':
            createConfettiEffect();
            console.log('✅ 彩帶動畫已啟動');
            break;
        case 'snow':
            createSnowEffect();
            console.log('✅ 雪花動畫已啟動');
            break;
        default:
            console.warn('⚠️ 未知的特效類型:', effectType);
    }
    
    // 標記活躍按鈕
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // 通知觀眾端應用相同特效
    broadcastEffectToViewers(effectType);
    
    console.log(`✅ 特效套用完成: ${effectType}`);
    if (typeof addMessage === 'function' && !messageHandled) {
        addMessage('系統', `✨ 已應用 ${getEffectName(effectType)} 特效`);
    }
}

function resetVideoEffectStyles(videoElement) {
    if (!videoElement) return;

    videoElement.style.filter = '';
    videoElement.style.webkitFilter = '';
    videoElement.style.animation = '';
    videoElement.classList.remove('effect-rainbow-filter');
    videoElement.style.border = '';
    videoElement.style.boxShadow = '';
    videoElement.style.borderImage = '';
    videoElement.style.background = '';

    const container = videoElement.parentElement;
    if (container) {
        container.classList.remove('effect-rainbow-filter', 'effect-rainbow-border', 'effect-neon-border', 'effect-glow-border');
        container.style.border = '';
        container.style.boxShadow = '';
        container.style.borderImage = '';
        container.style.borderRadius = '15px';
        container.classList.remove('effect-neon-border', 'effect-glow-border', 'effect-rainbow-border');
        removeLightningBorderOverlay(container);
        removeRainbowOverlayLayers(container);
    }

    hideGlassesOverlay(videoElement);
    hideDogOverlay(videoElement);
    hidePingoOverlay(videoElement);
    hideSechOverlay(videoElement);
    hideLaixiongOverlay(videoElement);
    hideMaoZedOverlay(videoElement);
    hideLaogaoOverlay(videoElement);
    hideGuodongOverlay(videoElement);
    hideHuoguoOverlay(videoElement);
    hideHsinchuOverlay(videoElement);
    hideCarOverlay(videoElement);
    hideCar2Overlay(videoElement);
    hideLookOverlay(videoElement);
    hideLumumuOverlay(videoElement);
    hideChiikawaOverlay(videoElement);
    hideCatOverlay(videoElement);
    hidePolarOverlay(videoElement);

    const activeOverlay = document.querySelector('.animation-overlay');
    if (activeOverlay) {
        activeOverlay.remove();
    }

    if (typeof restoreOriginalStream === 'function' && window.videoEffectsProcessor && window.videoEffectsProcessor.currentEffect && window.videoEffectsProcessor.currentEffect !== 'none') {
        restoreOriginalStream();
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

function ensureBroadcasterGlassesTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用眼鏡追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立眼鏡追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterGlassesTracker) {
        broadcasterGlassesTracker.setTargets(videoElement, container);
        return broadcasterGlassesTracker;
    }

    broadcasterGlassesTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: GLASSES_IMAGE_PATH,
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES
    });

    return broadcasterGlassesTracker;
}

async function startBroadcasterGlassesTracking(videoElement, container) {
    const tracker = ensureBroadcasterGlassesTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端眼鏡追蹤', error);
    }
}

function stopBroadcasterGlassesTracking() {
    if (broadcasterGlassesTracker) {
        broadcasterGlassesTracker.stop();
        broadcasterGlassesTracker = null;
    }
}

function showGlassesOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 眼鏡特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterGlassesTracking(videoElement, container);
}

function hideGlassesOverlay(videoElement) {
    stopBroadcasterGlassesTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.glasses-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterDogTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用狗狗追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立狗狗追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterDogTracker) {
        broadcasterDogTracker.setTargets(videoElement, container);
        return broadcasterDogTracker;
    }

    broadcasterDogTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: DOG_IMAGE_PATH,
        overlayClassName: 'dog-overlay',
        overlayImageAlt: '可愛狗狗特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 3.4,
        verticalOffsetRatio: 0.02,
        overlayZIndex: 13,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: [18,19,20,21,22,23,24,25,26],
        widthLandmarkPair: [20,24]
    });

    return broadcasterDogTracker;
}

async function startBroadcasterDogTracking(videoElement, container) {
    const tracker = ensureBroadcasterDogTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端狗狗追蹤', error);
    }
}

function stopBroadcasterDogTracking() {
    if (broadcasterDogTracker) {
        broadcasterDogTracker.stop();
        broadcasterDogTracker = null;
    }
}

function showDogOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 狗狗特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterDogTracking(videoElement, container);
}

function hideDogOverlay(videoElement) {
    stopBroadcasterDogTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.dog-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterPingoAudio() {
    if (broadcasterPingoAudio) {
        return broadcasterPingoAudio;
    }
    const audio = new Audio(PINGO_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.6;
    broadcasterPingoAudio = audio;
    return audio;
}

function playBroadcasterPingoAudio() {
    const audio = ensureBroadcasterPingoAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端皮鼓音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterPingoAudio() {
    if (broadcasterPingoAudio) {
        broadcasterPingoAudio.pause();
        broadcasterPingoAudio.currentTime = 0;
    }
}

function ensureBroadcasterPingoTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用皮鼓追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立皮鼓追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterPingoTracker) {
        broadcasterPingoTracker.setTargets(videoElement, container);
        return broadcasterPingoTracker;
    }

    broadcasterPingoTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: PINGO_IMAGE_PATH,
        overlayClassName: 'pingo-overlay',
        overlayImageAlt: '皮鼓特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 1.9,
        verticalOffsetRatio: 0,
        overlayZIndex: 14,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterPingoTracker;
}

async function startBroadcasterPingoTracking(videoElement, container) {
    const tracker = ensureBroadcasterPingoTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端皮鼓追蹤', error);
    }
}

function stopBroadcasterPingoTracking() {
    if (broadcasterPingoTracker) {
        broadcasterPingoTracker.stop();
        broadcasterPingoTracker = null;
    }
    stopBroadcasterPingoAudio();
}

function showPingoOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 皮鼓特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterPingoTracking(videoElement, container);
    playBroadcasterPingoAudio();
}

function hidePingoOverlay(videoElement) {
    stopBroadcasterPingoTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.pingo-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterSechAudio() {
    if (broadcasterSechAudio) {
        return broadcasterSechAudio;
    }
    const audio = new Audio(SECH_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    broadcasterSechAudio = audio;
    return audio;
}

function playBroadcasterSechAudio() {
    const audio = ensureBroadcasterSechAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端世間音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterSechAudio() {
    if (broadcasterSechAudio) {
        broadcasterSechAudio.pause();
        broadcasterSechAudio.currentTime = 0;
    }
}

function ensureBroadcasterSechTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用世間追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立世間追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterSechTracker) {
        broadcasterSechTracker.setTargets(videoElement, container);
        return broadcasterSechTracker;
    }

    broadcasterSechTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: SECH_IMAGE_PATH,
        overlayClassName: 'sech-overlay',
        overlayImageAlt: '世間特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.15,
        verticalOffsetRatio: -0.05,
        overlayZIndex: 15,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterSechTracker;
}

async function startBroadcasterSechTracking(videoElement, container) {
    const tracker = ensureBroadcasterSechTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端世間追蹤', error);
    }
}

function stopBroadcasterSechTracking() {
    if (broadcasterSechTracker) {
        broadcasterSechTracker.stop();
        broadcasterSechTracker = null;
    }
    stopBroadcasterSechAudio();
}

function showSechOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 世間特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterSechTracking(videoElement, container);
    playBroadcasterSechAudio();
}

function hideSechOverlay(videoElement) {
    stopBroadcasterSechTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.sech-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterLaixiongAudio() {
    if (broadcasterLaixiongAudio) {
        return broadcasterLaixiongAudio;
    }
    const audio = new Audio(LAIXIONG_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    broadcasterLaixiongAudio = audio;
    return audio;
}

function playBroadcasterLaixiongAudio() {
    const audio = ensureBroadcasterLaixiongAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端賴兄音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterLaixiongAudio() {
    if (broadcasterLaixiongAudio) {
        broadcasterLaixiongAudio.pause();
        broadcasterLaixiongAudio.currentTime = 0;
    }
}

function ensureBroadcasterLaixiongTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用賴兄追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立賴兄追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterLaixiongTracker) {
        broadcasterLaixiongTracker.setTargets(videoElement, container);
        return broadcasterLaixiongTracker;
    }

    broadcasterLaixiongTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: LAIXIONG_IMAGE_PATH,
        overlayClassName: 'laixiong-overlay',
        overlayImageAlt: '賴兄特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.25,
        verticalOffsetRatio: -0.08,
        overlayZIndex: 16,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterLaixiongTracker;
}

async function startBroadcasterLaixiongTracking(videoElement, container) {
    const tracker = ensureBroadcasterLaixiongTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端賴兄追蹤', error);
    }
}

function stopBroadcasterLaixiongTracking() {
    if (broadcasterLaixiongTracker) {
        broadcasterLaixiongTracker.stop();
        broadcasterLaixiongTracker = null;
    }
    stopBroadcasterLaixiongAudio();
}

function showLaixiongOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 賴兄特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterLaixiongTracking(videoElement, container);
    playBroadcasterLaixiongAudio();
}

function hideLaixiongOverlay(videoElement) {
    stopBroadcasterLaixiongTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.laixiong-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterMaoZedAudio() {
    if (broadcasterMaoZedAudio) {
        return broadcasterMaoZedAudio;
    }
    const audio = new Audio(MAO_ZED_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    broadcasterMaoZedAudio = audio;
    return audio;
}

function playBroadcasterMaoZedAudio() {
    const audio = ensureBroadcasterMaoZedAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端毛主席音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterMaoZedAudio() {
    if (broadcasterMaoZedAudio) {
        broadcasterMaoZedAudio.pause();
        broadcasterMaoZedAudio.currentTime = 0;
    }
}

function ensureBroadcasterMaoZedTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用毛主席追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立毛主席追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterMaoZedTracker) {
        broadcasterMaoZedTracker.setTargets(videoElement, container);
        return broadcasterMaoZedTracker;
    }

    broadcasterMaoZedTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: MAO_ZED_IMAGE_PATH,
        overlayClassName: 'mao-overlay',
        overlayImageAlt: '毛主席特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.35,
        verticalOffsetRatio: -0.06,
        overlayZIndex: 17,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterMaoZedTracker;
}

async function startBroadcasterMaoZedTracking(videoElement, container) {
    const tracker = ensureBroadcasterMaoZedTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端毛主席追蹤', error);
    }
}

function stopBroadcasterMaoZedTracking() {
    if (broadcasterMaoZedTracker) {
        broadcasterMaoZedTracker.stop();
        broadcasterMaoZedTracker = null;
    }
    stopBroadcasterMaoZedAudio();
}

function showMaoZedOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 毛主席特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterMaoZedTracking(videoElement, container);
    playBroadcasterMaoZedAudio();
}

function hideMaoZedOverlay(videoElement) {
    stopBroadcasterMaoZedTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.mao-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterLaogaoAudio() {
    if (broadcasterLaogaoAudio) {
        return broadcasterLaogaoAudio;
    }
    const audio = new Audio(LAOGAO_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    broadcasterLaogaoAudio = audio;
    return audio;
}

function playBroadcasterLaogaoAudio() {
    const audio = ensureBroadcasterLaogaoAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端老高音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterLaogaoAudio() {
    if (broadcasterLaogaoAudio) {
        broadcasterLaogaoAudio.pause();
        broadcasterLaogaoAudio.currentTime = 0;
    }
}

function ensureBroadcasterLaogaoTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用老高追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立老高追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterLaogaoTracker) {
        broadcasterLaogaoTracker.setTargets(videoElement, container);
        return broadcasterLaogaoTracker;
    }

    broadcasterLaogaoTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: LAOGAO_IMAGE_PATH,
        overlayClassName: 'laogao-overlay',
        overlayImageAlt: '老高特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.4,
        verticalOffsetRatio: -0.05,
        overlayZIndex: 18,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterLaogaoTracker;
}

async function startBroadcasterLaogaoTracking(videoElement, container) {
    const tracker = ensureBroadcasterLaogaoTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端老高追蹤', error);
    }
}

function stopBroadcasterLaogaoTracking() {
    if (broadcasterLaogaoTracker) {
        broadcasterLaogaoTracker.stop();
        broadcasterLaogaoTracker = null;
    }
    stopBroadcasterLaogaoAudio();
}

function showLaogaoOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 老高特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterLaogaoTracking(videoElement, container);
    playBroadcasterLaogaoAudio();
}

function hideLaogaoOverlay(videoElement) {
    stopBroadcasterLaogaoTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.laogao-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterGuodongAudio() {
    if (broadcasterGuodongAudio) {
        return broadcasterGuodongAudio;
    }
    const audio = new Audio(GUODONG_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    broadcasterGuodongAudio = audio;
    return audio;
}

function playBroadcasterGuodongAudio() {
    const audio = ensureBroadcasterGuodongAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端國棟音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterGuodongAudio() {
    if (broadcasterGuodongAudio) {
        broadcasterGuodongAudio.pause();
        broadcasterGuodongAudio.currentTime = 0;
    }
}

function ensureBroadcasterGuodongTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用國棟追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立國棟追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterGuodongTracker) {
        broadcasterGuodongTracker.setTargets(videoElement, container);
        return broadcasterGuodongTracker;
    }

    broadcasterGuodongTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: GUODONG_IMAGE_PATH,
        overlayClassName: 'guodong-overlay',
        overlayImageAlt: '國棟特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.45,
        verticalOffsetRatio: -0.05,
        overlayZIndex: 19,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterGuodongTracker;
}

async function startBroadcasterGuodongTracking(videoElement, container) {
    const tracker = ensureBroadcasterGuodongTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端國棟追蹤', error);
    }
}

function stopBroadcasterGuodongTracking() {
    if (broadcasterGuodongTracker) {
        broadcasterGuodongTracker.stop();
        broadcasterGuodongTracker = null;
    }
    stopBroadcasterGuodongAudio();
}

function showGuodongOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 國棟特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterGuodongTracking(videoElement, container);
    playBroadcasterGuodongAudio();
}

function hideGuodongOverlay(videoElement) {
    stopBroadcasterGuodongTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.guodong-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterHuoguoAudio() {
    if (broadcasterHuoguoAudio) {
        return broadcasterHuoguoAudio;
    }
    const audio = new Audio(HUOGUO_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    broadcasterHuoguoAudio = audio;
    return audio;
}

function playBroadcasterHuoguoAudio() {
    const audio = ensureBroadcasterHuoguoAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端火鍋音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterHuoguoAudio() {
    if (broadcasterHuoguoAudio) {
        broadcasterHuoguoAudio.pause();
        broadcasterHuoguoAudio.currentTime = 0;
    }
}

function ensureBroadcasterHuoguoTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用火鍋追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立火鍋追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterHuoguoTracker) {
        broadcasterHuoguoTracker.setTargets(videoElement, container);
        return broadcasterHuoguoTracker;
    }

    broadcasterHuoguoTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: HUOGUO_IMAGE_PATH,
        overlayClassName: 'huoguo-overlay',
        overlayImageAlt: '火鍋特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.5,
        verticalOffsetRatio: -0.06,
        overlayZIndex: 20,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterHuoguoTracker;
}

async function startBroadcasterHuoguoTracking(videoElement, container) {
    const tracker = ensureBroadcasterHuoguoTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端火鍋追蹤', error);
    }
}

function stopBroadcasterHuoguoTracking() {
    if (broadcasterHuoguoTracker) {
        broadcasterHuoguoTracker.stop();
        broadcasterHuoguoTracker = null;
    }
    stopBroadcasterHuoguoAudio();
}

function showHuoguoOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 火鍋特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterHuoguoTracking(videoElement, container);
    playBroadcasterHuoguoAudio();
}

function hideHuoguoOverlay(videoElement) {
    stopBroadcasterHuoguoTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.huoguo-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterHsinchuAudio() {
    if (broadcasterHsinchuAudio) {
        return broadcasterHsinchuAudio;
    }
    const audio = new Audio(HSINCHU_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    broadcasterHsinchuAudio = audio;
    return audio;
}

function playBroadcasterHsinchuAudio() {
    const audio = ensureBroadcasterHsinchuAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端新竹音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterHsinchuAudio() {
    if (broadcasterHsinchuAudio) {
        broadcasterHsinchuAudio.pause();
        broadcasterHsinchuAudio.currentTime = 0;
    }
}

function ensureBroadcasterHsinchuTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用新竹追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立新竹追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterHsinchuTracker) {
        broadcasterHsinchuTracker.setTargets(videoElement, container);
        return broadcasterHsinchuTracker;
    }

    broadcasterHsinchuTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: HSINCHU_IMAGE_PATH,
        overlayClassName: 'hsinchu-overlay',
        overlayImageAlt: '新竹特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.4,
        verticalOffsetRatio: -0.05,
        overlayZIndex: 21,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterHsinchuTracker;
}

async function startBroadcasterHsinchuTracking(videoElement, container) {
    const tracker = ensureBroadcasterHsinchuTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端新竹追蹤', error);
    }
}

function stopBroadcasterHsinchuTracking() {
    if (broadcasterHsinchuTracker) {
        broadcasterHsinchuTracker.stop();
        broadcasterHsinchuTracker = null;
    }
    stopBroadcasterHsinchuAudio();
}

function showHsinchuOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 新竹特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterHsinchuTracking(videoElement, container);
    playBroadcasterHsinchuAudio();
}

function hideHsinchuOverlay(videoElement) {
    stopBroadcasterHsinchuTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.hsinchu-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterCarAudio() {
    if (broadcasterCarAudio) {
        return broadcasterCarAudio;
    }
    const audio = new Audio(CAR_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    broadcasterCarAudio = audio;
    return audio;
}

function playBroadcasterCarAudio() {
    const audio = ensureBroadcasterCarAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端車音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterCarAudio() {
    if (broadcasterCarAudio) {
        broadcasterCarAudio.pause();
        broadcasterCarAudio.currentTime = 0;
    }
}

function ensureBroadcasterCar2Audio() {
    if (broadcasterCar2Audio) {
        return broadcasterCar2Audio;
    }
    const audio = new Audio(CAR2_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    broadcasterCar2Audio = audio;
    return audio;
}

function playBroadcasterCar2Audio() {
    const audio = ensureBroadcasterCar2Audio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端上車音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterCar2Audio() {
    if (broadcasterCar2Audio) {
        broadcasterCar2Audio.pause();
        broadcasterCar2Audio.currentTime = 0;
    }
}

function ensureBroadcasterLookAudio() {
    if (broadcasterLookAudio) {
        return broadcasterLookAudio;
    }
    const audio = new Audio(LOOK_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    broadcasterLookAudio = audio;
    return audio;
}

function playBroadcasterLookAudio() {
    const audio = ensureBroadcasterLookAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端回答我音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterLookAudio() {
    if (broadcasterLookAudio) {
        broadcasterLookAudio.pause();
        broadcasterLookAudio.currentTime = 0;
    }
}

function ensureBroadcasterLumumuAudio() {
    if (broadcasterLumumuAudio) {
        return broadcasterLumumuAudio;
    }
    const audio = new Audio(LUMUMU_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    broadcasterLumumuAudio = audio;
    return audio;
}

function playBroadcasterLumumuAudio() {
    const audio = ensureBroadcasterLumumuAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端秀燕音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterLumumuAudio() {
    if (broadcasterLumumuAudio) {
        broadcasterLumumuAudio.pause();
        broadcasterLumumuAudio.currentTime = 0;
    }
}

function ensureBroadcasterChiikawaAudio() {
    if (broadcasterChiikawaAudio) {
        return broadcasterChiikawaAudio;
    }
    const audio = new Audio(CHIIKAWA_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    broadcasterChiikawaAudio = audio;
    return audio;
}

function playBroadcasterChiikawaAudio() {
    const audio = ensureBroadcasterChiikawaAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端吉伊卡哇音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterChiikawaAudio() {
    if (broadcasterChiikawaAudio) {
        broadcasterChiikawaAudio.pause();
        broadcasterChiikawaAudio.currentTime = 0;
    }
}

function ensureBroadcasterCatAudio() {
    if (broadcasterCatAudio) {
        return broadcasterCatAudio;
    }
    const audio = new Audio(CAT_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    broadcasterCatAudio = audio;
    return audio;
}

function playBroadcasterCatAudio() {
    const audio = ensureBroadcasterCatAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端哈基米音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterCatAudio() {
    if (broadcasterCatAudio) {
        broadcasterCatAudio.pause();
        broadcasterCatAudio.currentTime = 0;
    }
}

function ensureBroadcasterPolarAudio() {
    if (broadcasterPolarAudio) {
        return broadcasterPolarAudio;
    }
    const audio = new Audio(POLAR_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    broadcasterPolarAudio = audio;
    return audio;
}

function playBroadcasterPolarAudio() {
    const audio = ensureBroadcasterPolarAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 主播端北極熊音效播放被阻擋', error);
        });
    }
}

function stopBroadcasterPolarAudio() {
    if (broadcasterPolarAudio) {
        broadcasterPolarAudio.pause();
        broadcasterPolarAudio.currentTime = 0;
    }
}

function ensureBroadcasterCarTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用車追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立車追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterCarTracker) {
        broadcasterCarTracker.setTargets(videoElement, container);
        return broadcasterCarTracker;
    }

    broadcasterCarTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: CAR_IMAGE_PATH,
        overlayClassName: 'car-overlay',
        overlayImageAlt: '車特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.38,
        verticalOffsetRatio: -0.04,
        overlayZIndex: 22,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterCarTracker;
}

async function startBroadcasterCarTracking(videoElement, container) {
    const tracker = ensureBroadcasterCarTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端車追蹤', error);
    }
}

function stopBroadcasterCarTracking() {
    if (broadcasterCarTracker) {
        broadcasterCarTracker.stop();
        broadcasterCarTracker = null;
    }
    stopBroadcasterCarAudio();
}

function ensureBroadcasterCar2Tracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用上車追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立上車追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterCar2Tracker) {
        broadcasterCar2Tracker.setTargets(videoElement, container);
        return broadcasterCar2Tracker;
    }

    broadcasterCar2Tracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: CAR2_IMAGE_PATH,
        overlayClassName: 'car2-overlay',
        overlayImageAlt: '上車特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.5,
        verticalOffsetRatio: -0.02,
        overlayZIndex: 23,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterCar2Tracker;
}

async function startBroadcasterCar2Tracking(videoElement, container) {
    const tracker = ensureBroadcasterCar2Tracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端上車追蹤', error);
    }
}

function stopBroadcasterCar2Tracking() {
    if (broadcasterCar2Tracker) {
        broadcasterCar2Tracker.stop();
        broadcasterCar2Tracker = null;
    }
    stopBroadcasterCar2Audio();
}

function showCarOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 車特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterCarTracking(videoElement, container);
    playBroadcasterCarAudio();
}

function hideCarOverlay(videoElement) {
    stopBroadcasterCarTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.car-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function showCar2Overlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 上車特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterCar2Tracking(videoElement, container);
    playBroadcasterCar2Audio();
}

function hideCar2Overlay(videoElement) {
    stopBroadcasterCar2Tracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.car2-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterLookTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用回答我追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立回答我追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterLookTracker) {
        broadcasterLookTracker.setTargets(videoElement, container);
        return broadcasterLookTracker;
    }

    broadcasterLookTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: LOOK_IMAGE_PATH,
        overlayClassName: 'look-overlay',
        overlayImageAlt: '回答我特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.6,
        verticalOffsetRatio: -0.06,
        overlayZIndex: 24,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterLookTracker;
}

async function startBroadcasterLookTracking(videoElement, container) {
    const tracker = ensureBroadcasterLookTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端回答我追蹤', error);
    }
}

function stopBroadcasterLookTracking() {
    if (broadcasterLookTracker) {
        broadcasterLookTracker.stop();
        broadcasterLookTracker = null;
    }
    stopBroadcasterLookAudio();
}

function showLookOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 回答我特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterLookTracking(videoElement, container);
    playBroadcasterLookAudio();
}

function hideLookOverlay(videoElement) {
    stopBroadcasterLookTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.look-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterLumumuTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用秀燕追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立秀燕追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterLumumuTracker) {
        broadcasterLumumuTracker.setTargets(videoElement, container);
        return broadcasterLumumuTracker;
    }

    broadcasterLumumuTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: LUMUMU_IMAGE_PATH,
        overlayClassName: 'lumumu-overlay',
        overlayImageAlt: '秀燕特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.55,
        verticalOffsetRatio: -0.05,
        overlayZIndex: 24,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterLumumuTracker;
}

async function startBroadcasterLumumuTracking(videoElement, container) {
    const tracker = ensureBroadcasterLumumuTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端秀燕追蹤', error);
    }
}

function stopBroadcasterLumumuTracking() {
    if (broadcasterLumumuTracker) {
        broadcasterLumumuTracker.stop();
        broadcasterLumumuTracker = null;
    }
    stopBroadcasterLumumuAudio();
}

function showLumumuOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 秀燕特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterLumumuTracking(videoElement, container);
    playBroadcasterLumumuAudio();
}

function hideLumumuOverlay(videoElement) {
    stopBroadcasterLumumuTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.lumumu-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterChiikawaTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用吉伊卡哇追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立吉伊卡哇追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterChiikawaTracker) {
        broadcasterChiikawaTracker.setTargets(videoElement, container);
        return broadcasterChiikawaTracker;
    }

    broadcasterChiikawaTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: CHIIKAWA_IMAGE_PATH,
        overlayClassName: 'chiikawa-overlay',
        overlayImageAlt: '吉伊卡哇特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.5,
        verticalOffsetRatio: -0.05,
        overlayZIndex: 24,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterChiikawaTracker;
}

async function startBroadcasterChiikawaTracking(videoElement, container) {
    const tracker = ensureBroadcasterChiikawaTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端吉伊卡哇追蹤', error);
    }
}

function stopBroadcasterChiikawaTracking() {
    if (broadcasterChiikawaTracker) {
        broadcasterChiikawaTracker.stop();
        broadcasterChiikawaTracker = null;
    }
    stopBroadcasterChiikawaAudio();
}

function showChiikawaOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 吉伊卡哇特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterChiikawaTracking(videoElement, container);
    playBroadcasterChiikawaAudio();
}

function hideChiikawaOverlay(videoElement) {
    stopBroadcasterChiikawaTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.chiikawa-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterCatTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用哈基米追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立哈基米追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterCatTracker) {
        broadcasterCatTracker.setTargets(videoElement, container);
        return broadcasterCatTracker;
    }

    broadcasterCatTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: CAT_IMAGE_PATH,
        overlayClassName: 'cat-overlay',
        overlayImageAlt: '哈基米特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.48,
        verticalOffsetRatio: -0.05,
        overlayZIndex: 24,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterCatTracker;
}

async function startBroadcasterCatTracking(videoElement, container) {
    const tracker = ensureBroadcasterCatTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端哈基米追蹤', error);
    }
}

function stopBroadcasterCatTracking() {
    if (broadcasterCatTracker) {
        broadcasterCatTracker.stop();
        broadcasterCatTracker = null;
    }
    stopBroadcasterCatAudio();
}

function showCatOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 哈基米特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterCatTracking(videoElement, container);
    playBroadcasterCatAudio();
}

function hideCatOverlay(videoElement) {
    stopBroadcasterCatTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.cat-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureBroadcasterPolarTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用北極熊追蹤');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立北極熊追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (broadcasterPolarTracker) {
        broadcasterPolarTracker.setTargets(videoElement, container);
        return broadcasterPolarTracker;
    }

    broadcasterPolarTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: POLAR_IMAGE_PATH,
        overlayClassName: 'polar-overlay',
        overlayImageAlt: '北極熊特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 130,
        minConfidence: 0.5,
        flipHorizontal: false,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.3,
        verticalOffsetRatio: -0.12,
        overlayZIndex: 24,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return broadcasterPolarTracker;
}

async function startBroadcasterPolarTracking(videoElement, container) {
    const tracker = ensureBroadcasterPolarTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動主播端北極熊追蹤', error);
    }
}

function stopBroadcasterPolarTracking() {
    if (broadcasterPolarTracker) {
        broadcasterPolarTracker.stop();
        broadcasterPolarTracker = null;
    }
    stopBroadcasterPolarAudio();
}

function showPolarOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!videoElement || !container) {
        console.warn('⚠️ 北極熊特效缺少必要的 DOM 元素');
        return;
    }

    startBroadcasterPolarTracking(videoElement, container);
    playBroadcasterPolarAudio();
}

function hidePolarOverlay(videoElement) {
    stopBroadcasterPolarTracking();
    const container = videoElement?.parentElement;
    if (!container) return;
    const overlay = container.querySelector('.polar-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureLightningBorderOverlay(container) {
    if (!container) return;
    if (container.querySelector('.lightning-border-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'lightning-border-overlay';
    overlay.innerHTML = `
        <div class="lightning-layer border-outer"></div>
        <div class="lightning-layer main-card"></div>
        <div class="lightning-layer glow-layer-1"></div>
        <div class="lightning-layer glow-layer-2"></div>
        <div class="lightning-layer overlay-1"></div>
        <div class="lightning-layer overlay-2"></div>
        <div class="lightning-layer background-glow"></div>
    `;
    container.appendChild(overlay);
}

function removeLightningBorderOverlay(container) {
    const overlay = container?.querySelector('.lightning-border-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function ensureRainbowOverlayLayers(container) {
    if (!container) return;

    let gradientLayer = container.querySelector('.rainbow-gradient-layer');
    if (!gradientLayer) {
        gradientLayer = document.createElement('div');
        gradientLayer.className = 'rainbow-gradient-layer';
        container.appendChild(gradientLayer);
    }

    let glowLayer = container.querySelector('.rainbow-glow-layer');
    if (!glowLayer) {
        glowLayer = document.createElement('div');
        glowLayer.className = 'rainbow-glow-layer';
        container.appendChild(glowLayer);
    }
}

function removeRainbowOverlayLayers(container) {
    if (!container) return;
    const gradientLayer = container.querySelector('.rainbow-gradient-layer');
    if (gradientLayer) {
        gradientLayer.remove();
    }
    const glowLayer = container.querySelector('.rainbow-glow-layer');
    if (glowLayer) {
        glowLayer.remove();
    }
}

// 向觀眾端廣播特效狀態
function broadcastEffectToViewers(effectType) {
    const broadcasterId = myBroadcasterId || getBroadcasterIdFromUrl();

    if (!broadcasterId) {
        console.warn('⚠️ 無法識別主播ID，特效更新未廣播');
        return;
    }

    myBroadcasterId = broadcasterId;

    if (window.streamingSocket && window.streamingSocket.readyState === WebSocket.OPEN) {
        window.streamingSocket.send(JSON.stringify({
            type: 'effect_update',
            effect: effectType,
            broadcasterId,
            timestamp: Date.now()
        }));
        console.log(`✅ 已向觀眾廣播特效: ${effectType}`);
    } else {
        console.warn('⚠️ WebSocket 未連接，無法廣播特效');
    }
    
    if (typeof addMessage === 'function') {
        addMessage('系統', `✨ 已應用 ${getEffectName(effectType)} 特效`);
    }
}

// 獲取特效名稱
function getEffectName(effectType) {
    const names = {
        'blur': '模糊',
        'rainbow': '彩虹濾鏡',
        'bw': '黑白',
        'sepia': '懷舊',
        'glasses': '戴眼鏡',
        'dog': '狗狗面具',
        'pingo': '皮鼓',
        'sech': '世間',
        'laixiong': '賴兄',
        'maoZed': '毛主席',
        'laogao': '老高',
    'guodong': '國棟',
    'huoguo': '火鍋',
    'hsinchu': '新竹',
    'car': '車',
    'car2': '上車',
    'look': '回答我',
    'lumumu': '秀燕',
    'chiikawa': '吉伊卡哇',
    'cat': '哈基米',
    'polar': '北極熊',
        'bright': '美白',
        'warm': '暖色調',
        'invert': '反相',
        'rainbowBorder': '彩虹邊框',
        'neon': '霓虹',
        'glow': '閃電',
        'particles': '粒子',
        'hearts': '愛心',
        'confetti': '彩帶',
        'snow': '雪花'
    };
    return names[effectType] || effectType;
}

// 反相特效切換（保留舊函數名稱以維持相容性）
async function toggleBackgroundBlur(triggerButton = null) {
    const videoElement = document.getElementById('localVideo');
    if (!videoElement || !localStream) {
        addMessage('系統', '⚠️ 請先開始直播再使用反相特效');
        return;
    }

    const button = triggerButton || (typeof event !== 'undefined' ? event.target.closest('.effect-btn') : null);
    const nextEffect = currentEffect === 'invert' ? 'clear' : 'invert';
    applyEffect(nextEffect, button);
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
    console.log('🎬 createAnimationOverlay:', type);
    
    // 移除現有的動畫覆蓋層
    const existing = document.querySelector('.animation-overlay');
    if (existing) {
        console.log('🗑️ 移除現有動畫層');
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
    
    const videoElement = document.getElementById('localVideo');
    const videoContainer = videoElement ? videoElement.parentElement : document.querySelector('.video-container');
    
    console.log('📦 動畫容器:', videoContainer);
    
    if (videoContainer) {
        videoContainer.appendChild(overlay);
        console.log('✅ 動畫層已添加到容器');
        
        // 創建動畫元素
        for (let i = 0; i < 20; i++) {
            createAnimationElement(overlay, type);
        }
        console.log(`✅ 已創建 20 個 ${type} 動畫元素`);
        
        // 驗證動畫層
        setTimeout(() => {
            const checkOverlay = document.querySelector('.animation-overlay');
            console.log('🔍 動畫層驗證:', {
                exists: !!checkOverlay,
                childCount: checkOverlay ? checkOverlay.children.length : 0,
                zIndex: checkOverlay ? window.getComputedStyle(checkOverlay).zIndex : 'N/A'
            });
        }, 100);
        
        // 10秒後自動移除
        setTimeout(() => {
            if (overlay.parentNode) {
                console.log('⏰ 自動移除動畫層');
                overlay.remove();
            }
        }, 10000);
    } else {
        console.error('❌ 找不到視頻容器,無法創建動畫');
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
        resetVideoEffectStyles(videoElement);
        hideFilmFrameOverlay(videoElement);
    }
    
    // 移除動畫覆蓋層
    const overlay = document.querySelector('.animation-overlay');
    if (overlay) {
        overlay.remove();
    }
    
    currentEffect = null;
    window.currentEffect = null; // 同步全域變數
    
    // 移除所有按鈕的active狀態
    document.querySelectorAll('.effect-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    stopBroadcasterPingoAudio();
    stopBroadcasterSechAudio();
    stopBroadcasterLaixiongAudio();
    stopBroadcasterMaoZedAudio();
    stopBroadcasterLaogaoAudio();
    stopBroadcasterGuodongAudio();
    stopBroadcasterHuoguoAudio();
    stopBroadcasterHsinchuAudio();
    stopBroadcasterCarAudio();
    stopBroadcasterCar2Audio();
    stopBroadcasterLookAudio();
    stopBroadcasterLumumuAudio();
    stopBroadcasterChiikawaAudio();
    stopBroadcasterCatAudio();
    stopBroadcasterPolarAudio();

    addMessage('系統', '🧹 已清除所有特效');
}

// 確保所有特效函數都在全域範圍
window.applyEffect = applyEffect;
window.applyNewEffect = applyNewEffect;
window.clearEffect = clearEffect;
window.createAnimationOverlay = createAnimationOverlay;
window.createParticleEffect = createParticleEffect;
window.createHeartEffect = createHeartEffect;
window.createConfettiEffect = createConfettiEffect;
window.createSnowEffect = createSnowEffect;
window.broadcastEffectToViewers = broadcastEffectToViewers;
window.getEffectName = getEffectName;
window.resetVideoEffectStyles = resetVideoEffectStyles;

console.log('✅ 所有特效函數已載入到全域範圍');

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
