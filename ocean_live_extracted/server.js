const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Database = require('./database');

// 全局工具函數：安全的JSON發送
function sendJSON(ws, obj) {
    try {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(obj));
            return true;
        }
        return false;
    } catch (err) {
        console.error('sendJSON error', err);
        return false;
    }
}

// 創建 Express 應用
const app = express();

// 嘗試創建HTTPS服務器，失敗則使用HTTP
let server;
let isHttps = false;

try {
    // 嘗試讀取SSL證書
    const options = {
        key: fs.readFileSync(path.join(__dirname, 'private-key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'certificate.pem'))
    };
    server = https.createServer(options, app);
    isHttps = true;
    console.log('🔒 HTTPS服務器已啟用 - 支援移動端WebRTC');
} catch (error) {
    console.log('⚠️  SSL證書載入失敗，使用HTTP服務器');
    console.log('   錯誤詳情:', error.message);
    console.log('💡 提示：移動端瀏覽器需要HTTPS才能使用WebRTC');
    console.log('   可運行 generate-ssl.bat 生成證書');
    server = http.createServer(app);
}

// 設置服務器的最大監聽器數量，防止內存洩漏警告
server.setMaxListeners(20);

// 初始化資料庫
const db = new Database();

// Ghost用戶管理系統
class GhostUserManager {
    constructor() {
        this.ghostUsers = new Set(); // 當前使用的Ghost序號
        this.usedNumbers = new Set(); // 已使用的序號
    }

    // 分配新的Ghost用戶名
    assignGhostName() {
        // 找到最小可用序號
        let number = 1;
        while (this.usedNumbers.has(number)) {
            number++;
        }
        
        this.usedNumbers.add(number);
        this.ghostUsers.add(number);
        return `Ghost_s${number}`;
    }

    // 釋放Ghost用戶名
    releaseGhostName(ghostName) {
        if (ghostName && ghostName.startsWith('Ghost_s')) {
            const number = parseInt(ghostName.replace('Ghost_s', ''));
            if (!isNaN(number)) {
                this.ghostUsers.delete(number);
                this.usedNumbers.delete(number);
                console.log(`📤 釋放Ghost用戶: ${ghostName}`);
            }
        }
    }

    // 獲取當前Ghost用戶數量
    getGhostCount() {
        return this.ghostUsers.size;
    }
}

const ghostManager = new GhostUserManager();

// 中間件設置
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 設置 session 中間件
app.use(session({
    secret: 'vibelo-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isHttps, // 根據服務器類型動態設置
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 小時
    }
}));

// 當前活躍用戶 (用於防止衝突)
const activeUsers = new Map(); // userId -> { sessionId, socketId, lastActivity }
// 聊天管控資料結構
const mutedViewers = new Set(); // viewerId
const kickedViewers = new Set(); // viewerId
// 基礎敏感詞 (可擴充 / 改為讀取外部檔案)
const SENSITIVE_WORDS = ['badword','垃圾','fuck'];
function filterSensitive(text){
    if(!text) return text;
    let result = text;
    SENSITIVE_WORDS.forEach(w=>{
        const re = new RegExp(w.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&'),'ig');
        result = result.replace(re, (m)=> m[0] + '*'.repeat(Math.max(0, m.length-2)) + (m.length>1? m[m.length-1]:'') );
    });
    return result;
}
// 發送頻率限制: viewerId -> { lastText, lastTime }
const rateMap = new Map();
const MIN_INTERVAL_MS = 1200; // 最短間隔
const DUPLICATE_WINDOW_MS = 6000; // 相同內容視為重複時間窗

// 創建 WebSocket 服務器
const wss = new WebSocket.Server({ server });

// 設置WebSocket服務器的最大監聽器數量
wss.setMaxListeners(20);

// 直播狀態
let isStreaming = false;
let broadcaster = null;
let viewers = new Map(); // viewerId -> WebSocket
let chatUsers = new Map(); // WebSocket -> { role, username, timestamp }
let activeBroadcasters = new Map(); // userId -> { ws, userInfo, startTime, viewerCount }
let activeConnections = new Map(); // connectionId -> { type, userId, streamerId, ws }
let viewerCount = 0;
let currentStreamTitle = ''; // 當前直播標題

// WebSocket 連接處理
wss.on('connection', function connection(ws, req) {
    console.log('新的 WebSocket 連接');
    
    let clientType = null; // 'broadcaster' 或 'viewer'
    let clientId = null;
    
    ws.on('message', async function message(data) {
        let message;
        try {
            message = JSON.parse(data);
            console.log('收到訊息:', message.type, '內容:', message);
        } catch (err) {
            console.error('JSON parse error:', err);
            sendJSON(ws, { type: 'error', error: 'invalid_json' });
            return;
        }
        
        try {
            switch (message.type) {
                case 'broadcaster_join':
                    handleBroadcasterJoin(ws, message);
                    clientType = 'broadcaster';
                    sendJSON(ws, { type: 'ack', event: 'broadcaster_join', ok: true });
                    break;
                    
                case 'viewer_join':
                    handleViewerJoin(ws, message);
                    clientType = 'viewer';
                    clientId = message.viewerId;
                    sendJSON(ws, { type: 'ack', event: 'viewer_join', ok: true, viewerId: message.viewerId });
                    break;
                    
            case 'stream_start':
                handleStreamStart(message);
                sendJSON(ws, { type: 'ack', event: 'stream_start', ok: true });
                
                // 🚨 [CRITICAL FIX] 確保 online_viewers 消息發送到正確的連接
                if (message.requestViewers) {
                    const viewerList = Array.from(viewers.keys());
                    console.log(`🔄 [DIRECT] 直接發送 online_viewers 給當前連接，觀眾: ${viewerList.length} 個`);
                    
                    const onlineViewersMessage = {
                        type: 'online_viewers',
                        viewers: viewerList,
                        count: viewerList.length,
                        message: viewerList.length > 0 ? 
                            `已為 ${viewerList.length} 個在線觀眾建立連接` : 
                            '目前沒有觀眾在線'
                    };
                    
                    sendJSON(ws, onlineViewersMessage);
                    console.log(`✅ [DIRECT] online_viewers 消息已直接發送:`, onlineViewersMessage);
                }
                break;                case 'stream_end':
                    handleStreamEnd();
                    sendJSON(ws, { type: 'ack', event: 'stream_end', ok: true });
                    break;
                    
                case 'offer':
                    handleOffer(message);
                    break;
                    
                case 'answer':
                    handleAnswer(message);
                    break;
                    
                case 'ice_candidate':
                    handleIceCandidate(message);
                    break;
                    
                case 'request_broadcaster_info':
                    handleRequestBroadcasterInfo(ws, message);
                    break;
                    
                case 'request_webrtc_connection':
                    handleRequestWebRTCConnection(ws, message);
                    break;
                    
                case 'chat_message':
                    // 舊版本兼容性 - 轉換為新的 chat 類型
                    await handleChatMessage(ws, {
                        ...message,
                        type: 'chat',
                        role: message.isStreamer ? 'broadcaster' : 'viewer'
                    });
                    break;
                    
                case 'chat_join':
                    handleChatJoin(ws, message);
                    break;
                    
                case 'chat':
                    handleChatMessage(ws, message);
                    break;
                    
                case 'heartbeat':
                    sendJSON(ws, { type: 'heartbeat_ack', timestamp: new Date().toISOString() });
                    break;
                
                case 'title_update':
                    handleTitleUpdate(message);
                    sendJSON(ws, { type: 'ack', event: 'title_update', ok: true });
                    break;
                    
                case 'effect_update':
                    handleEffectUpdate(message);
                    sendJSON(ws, { type: 'ack', event: 'effect_update', ok: true });
                    break;
                    
                default:
                    console.log('未知訊息類型:', message.type);
            }
            
        } catch (error) {
            console.error('處理訊息時發生錯誤:', error);
        }
    });
    
    ws.on('close', function close() {
        console.log('WebSocket 連接關閉');
        
        if (clientType === 'broadcaster') {
            handleBroadcasterDisconnect();
        } else if (clientType === 'viewer' && clientId) {
            handleViewerDisconnect(clientId);
        }
    });
    
    ws.on('error', function error(err) {
        console.error('WebSocket 錯誤:', err);
    });
});

// 處理主播加入
function handleBroadcasterJoin(ws, message) {
    console.log('主播已加入');
    const userInfo = message.userInfo || {
        displayName: '主播',
        avatarUrl: null,
        isLoggedIn: false
    };
    
    const broadcasterId = message.broadcasterId || `broadcaster_${Date.now()}`;
    
    broadcaster = {
        ws: ws,
        id: broadcasterId,
        timestamp: Date.now(),
        userInfo: userInfo
    };
    
    // 添加到活躍直播者列表
    activeBroadcasters.set(broadcasterId, {
        ws: ws,
        userInfo: userInfo,
        startTime: new Date(),
        viewerCount: 0
    });
    
    // 添加到活躍連接列表
    const connectionId = `broadcaster_${broadcasterId}_${Date.now()}`;
    activeConnections.set(connectionId, {
        type: 'broadcaster',
        userId: broadcasterId,
        streamerId: broadcasterId,
        ws: ws
    });
    
    console.log('主播資訊:', userInfo);
    console.log('已添加到活躍直播者列表:', broadcasterId);
    
    // 向所有已連接的觀眾發送主播信息
    if (viewers.size > 0) {
        console.log('向', viewers.size, '個觀眾發送主播信息');
        viewers.forEach((viewerWs, viewerId) => {
            if (viewerWs.readyState === WebSocket.OPEN) {
                viewerWs.send(JSON.stringify({
                    type: 'broadcaster_info',
                    broadcasterInfo: userInfo,
                    message: '等待主播開始直播'
                }));
            }
        });
    }
    
    // 不再自動註冊為聊天用戶，讓主播的ChatSystem通過chat_join來註冊
    console.log('主播WebRTC連接已建立，等待ChatSystem發送chat_join');
    
    // 發送確認訊息
    ws.send(JSON.stringify({
        type: 'broadcaster_joined',
        message: '主播已成功加入直播間',
        broadcasterId: broadcasterId
    }));
}

// 處理觀眾加入
function handleViewerJoin(ws, message) {
    const viewerId = message.viewerId;
    const streamerId = message.streamerId || 'default'; // 觀看的主播ID
    let userInfo = message.userInfo || {};
    
    // 檢查是否為登入用戶
    if (userInfo.isLoggedIn && userInfo.displayName) {
        console.log('登入用戶加入:', viewerId, '用戶名:', userInfo.displayName, '觀看主播:', streamerId);
    } else {
        // 分配Ghost用戶名
        const ghostName = ghostManager.assignGhostName();
        userInfo = {
            displayName: ghostName,
            avatarUrl: null,
            isGuest: true
        };
        console.log('訪客加入:', viewerId, '分配Ghost名稱:', ghostName, '觀看主播:', streamerId);
        
        // 將Ghost名稱關聯到viewerId
        ws.ghostName = ghostName;
    }
    
    viewers.set(viewerId, ws);
    viewerCount++;
    
    // 添加到活躍連接列表
    const connectionId = `viewer_${viewerId}_${Date.now()}`;
    activeConnections.set(connectionId, {
        type: 'viewer',
        userId: viewerId,
        streamerId: streamerId,
        ws: ws
    });
    
    // 更新對應主播的觀眾數
    if (activeBroadcasters.has(streamerId)) {
        const broadcasterData = activeBroadcasters.get(streamerId);
        broadcasterData.viewerCount = (broadcasterData.viewerCount || 0) + 1;
        activeBroadcasters.set(streamerId, broadcasterData);
    }
    
    // 發送確認訊息，包含分配的用戶信息和主播信息
    const broadcasterInfo = broadcaster ? broadcaster.userInfo : null;
    ws.send(JSON.stringify({
        type: 'viewer_joined',
        message: '觀眾已成功加入直播間',
        viewerId: viewerId,
        userInfo: userInfo,
        broadcasterInfo: broadcasterInfo,
        streamerId: streamerId
    }));
    
    // 移除歡迎消息，保持聊天室乾淨
    
    // 如果主播正在直播，發送直播開始訊息
    if (isStreaming && broadcaster) {
        console.log('觀眾加入時主播正在直播，發送 stream_start');
        ws.send(JSON.stringify({
            type: 'stream_start',
            title: currentStreamTitle || '精彩直播中',
            message: '主播正在直播中',
            status: 'live'
        }));
        
        // 發送當前直播狀態
        setTimeout(() => {
            ws.send(JSON.stringify({
                type: 'stream_status',
                title: currentStreamTitle || '精彩直播中',
                message: '直播進行中',
                status: 'live'
            }));
        }, 500);
        
        // 通知主播有新觀眾需要連接
        if (broadcaster.ws.readyState === WebSocket.OPEN) {
            console.log('通知主播有新觀眾需要連接:', viewerId);
            broadcaster.ws.send(JSON.stringify({
                type: 'viewer_join',
                viewerId: viewerId
            }));
        }
    } else {
        console.log('觀眾加入時主播未在直播');
        
        // 即使主播未在直播，也發送主播信息以便觀眾端顯示等待信息
        if (broadcaster && broadcaster.userInfo) {
            ws.send(JSON.stringify({
                type: 'broadcaster_info',
                broadcasterInfo: broadcaster.userInfo,
                message: '等待主播開始直播'
            }));
        }
    }
    
    // 更新所有觀眾的觀眾數量
    updateViewerCount();
}

// 處理直播開始
function handleStreamStart(message) {
    console.log('直播開始');
    isStreaming = true;
    
    // 更新當前標題
    if (message.title) {
        currentStreamTitle = message.title;
    }
    
    // 通知所有觀眾直播已開始
    broadcastToViewers({
        type: 'stream_start',
        title: currentStreamTitle || message.title || '直播中',
        message: '直播即將開始',
        status: 'starting'
    });
    
    // 1秒後發送直播開始狀態
    setTimeout(() => {
        broadcastToViewers({
            type: 'stream_status',
            title: currentStreamTitle || message.title || '直播中',
            message: '直播開始',
            status: 'live'
        });
    }, 1000);
    
    // 🎯 [REMOVED] 不再在這里發送 online_viewers，由消息處理直接發送
    console.log(`🔄 [INFO] 直播開始處理完成，觀眾列表將由消息處理直接發送`);
}

// 處理直播結束
function handleStreamEnd() {
    console.log('直播結束');
    isStreaming = false;
    currentStreamTitle = ''; // 清除標題
    
    // 通知所有觀眾直播已結束
    broadcastToViewers({
        type: 'stream_end',
        message: '直播已結束'
    });
}

// 處理直播標題更新
function handleTitleUpdate(message) {
    console.log('收到標題更新:', message.title);
    currentStreamTitle = message.title || '';
    
    // 廣播標題更新給所有觀眾
    broadcastToViewers({
        type: 'title_update',
        title: currentStreamTitle,
        timestamp: message.timestamp || Date.now()
    });
    
    console.log('已廣播標題更新給', viewerCount, '個觀眾');
}

// 處理特效更新
function handleEffectUpdate(message) {
    console.log('🎨 [特效] 收到主播特效更新:', message.effect);
    
    // 廣播特效更新給所有觀眾
    broadcastToViewers({
        type: 'effect_update',
        effect: message.effect,
        timestamp: message.timestamp || Date.now()
    });
    
    console.log(`🎨 [特效] 已廣播特效 "${message.effect}" 給 ${viewerCount} 個觀眾`);
}

// 處理 WebRTC Offer
function handleOffer(message) {
    console.log('📡 處理 Offer from broadcaster to viewer:', message.viewerId);
    console.log('   主播ID:', message.broadcasterId);
    console.log('   觀眾是否存在:', viewers.has(message.viewerId));
    console.log('   當前觀眾數量:', viewers.size);
    
    // 將 Offer 轉發給特定觀眾
    if (message.viewerId && viewers.has(message.viewerId)) {
        const viewerWs = viewers.get(message.viewerId);
        console.log('   觀眾 WebSocket 狀態:', viewerWs.readyState);
        
        if (viewerWs.readyState === WebSocket.OPEN) {
            const offerData = {
                type: 'offer',
                offer: message.offer,
                broadcasterId: message.broadcasterId
            };
            viewerWs.send(JSON.stringify(offerData));
            console.log('✅ Offer 已轉發給觀眾:', message.viewerId);
        } else {
            console.log('❌ 觀眾 WebSocket 未開啟，無法轉發 Offer');
        }
    } else {
        console.log('❌ 找不到觀眾或觀眾ID無效:', message.viewerId);
        console.log('   可用觀眾列表:', Array.from(viewers.keys()));
    }
}

// 處理 WebRTC Answer
function handleAnswer(message) {
    console.log('📡 處理 Answer from viewer:', message.viewerId);
    console.log('   主播是否存在:', !!broadcaster);
    console.log('   主播 WebSocket 狀態:', broadcaster ? broadcaster.ws.readyState : 'N/A');
    
    // 將 Answer 轉發給主播
    if (broadcaster && broadcaster.ws.readyState === WebSocket.OPEN) {
        const answerData = {
            type: 'answer',
            answer: message.answer,
            viewerId: message.viewerId
        };
        broadcaster.ws.send(JSON.stringify(answerData));
        console.log('✅ Answer 已轉發給主播');
    } else {
        console.log('❌ 找不到主播或主播 WebSocket 未開啟');
    }
}

// 處理 ICE 候選
function handleIceCandidate(message) {
    console.log('🧊 處理 ICE 候選:', message.broadcasterId ? 'from broadcaster' : 'from viewer');
    
    if (message.broadcasterId) {
        // 來自主播的 ICE 候選，轉發給特定觀眾
        console.log('   轉發給觀眾:', message.viewerId);
        console.log('   觀眾是否存在:', viewers.has(message.viewerId));
        
        if (message.viewerId && viewers.has(message.viewerId)) {
            const viewerWs = viewers.get(message.viewerId);
            console.log('   觀眾 WebSocket 狀態:', viewerWs.readyState);
            
            if (viewerWs.readyState === WebSocket.OPEN) {
                const candidateData = {
                    type: 'ice_candidate',
                    candidate: message.candidate,
                    broadcasterId: message.broadcasterId
                };
                viewerWs.send(JSON.stringify(candidateData));
                console.log('✅ ICE candidate 已轉發給觀眾');
            } else {
                console.log('❌ 觀眾 WebSocket 未開啟');
            }
        } else {
            console.log('❌ 找不到觀眾');
        }
    } else if (message.viewerId) {
        // 來自觀眾的 ICE 候選，轉發給主播
        console.log('   轉發給主播，觀眾ID:', message.viewerId);
        console.log('   主播是否存在:', !!broadcaster);
        console.log('   主播 WebSocket 狀態:', broadcaster ? broadcaster.ws.readyState : 'N/A');
        
        if (broadcaster && broadcaster.ws.readyState === WebSocket.OPEN) {
            const candidateData = {
                type: 'ice_candidate',
                candidate: message.candidate,
                viewerId: message.viewerId
            };
            broadcaster.ws.send(JSON.stringify(candidateData));
            console.log('✅ ICE candidate 已轉發給主播');
        } else {
            console.log('❌ 找不到主播或主播 WebSocket 未開啟');
        }
    }
}

// 處理觀眾請求主播信息
function handleRequestBroadcasterInfo(ws, message) {
    console.log('📡 觀眾請求主播信息:', message.viewerId);
    
    if (broadcaster && broadcaster.userInfo) {
        // 發送主播信息給觀眾
        const broadcasterInfoMessage = {
            type: 'broadcaster_info',
            broadcasterInfo: broadcaster.userInfo,
            message: isStreaming ? '主播正在直播中' : '等待主播開始直播'
        };
        
        ws.send(JSON.stringify(broadcasterInfoMessage));
        console.log('✅ 已發送主播信息給觀眾:', message.viewerId);
        
        // 如果正在直播，也發送直播開始消息
        if (isStreaming) {
            const streamStartMessage = {
                type: 'stream_start',
                title: currentStreamTitle || '精彩直播中',
                message: '主播正在直播'
            };
            
            ws.send(JSON.stringify(streamStartMessage));
            console.log('✅ 已發送直播開始消息給觀眾:', message.viewerId);
        }
    } else {
        console.log('❌ 沒有主播信息可發送');
        ws.send(JSON.stringify({
            type: 'broadcaster_info',
            broadcasterInfo: null,
            message: '等待主播加入'
        }));
    }
}

// 處理觀眾請求 WebRTC 連接
function handleRequestWebRTCConnection(ws, message) {
    console.log('📡 觀眾請求 WebRTC 連接:', message.viewerId);
    
    if (broadcaster && broadcaster.ws.readyState === WebSocket.OPEN) {
        // 通知主播有觀眾需要連接
        broadcaster.ws.send(JSON.stringify({
            type: 'viewer_join',
            viewerId: message.viewerId,
            streamerId: message.streamerId || 'default'
        }));
        console.log('✅ 已通知主播建立與觀眾的連接:', message.viewerId);
    } else {
        console.log('❌ 找不到主播或主播未連接');
        ws.send(JSON.stringify({
            type: 'error',
            message: '主播未連接，無法建立視頻連接'
        }));
    }
}

// 處理聊天加入
function handleChatJoin(ws, message) {
    console.log('用戶加入聊天:', message.role, message.username);
    
    // 直接添加到chatUsers，每個WebSocket連接都是唯一的
    chatUsers.set(ws, {
        role: message.role,
        username: message.username,
        timestamp: Date.now()
    });
    console.log(`用戶已添加到聊天列表: ${message.username} (${message.role})`);
    console.log(`當前聊天用戶總數: ${chatUsers.size}`);
    
    // 發送確認
    ws.send(JSON.stringify({
        type: 'chat_join_ack',
        role: message.role,
        username: message.username,
        timestamp: new Date().toISOString()
    }));
    
    // 不廣播用戶加入消息，保持聊天室乾淨
}

// 處理聊天訊息（新的統一處理）
function handleChatMessage(ws, message) {
    // 統一處理不同的訊息格式
    const messageText = message.message || message.text || '';
    const username = message.username || '匿名用戶';
    const role = message.role || 'viewer';
    
    console.log('收到聊天訊息:', messageText, '來自:', username, '角色:', role);
    
    try {
        // 驗證訊息內容
        if (!messageText || typeof messageText !== 'string' || messageText.trim() === '') {
            console.log('空訊息被忽略');
            return;
        }
        
        // 建立統一的聊天訊息格式
        const chatMessage = {
            type: 'chat',
            role: role,
            username: username,
            message: messageText.trim(),
            text: messageText.trim(), // 同時提供 text 字段以保持兼容性
            timestamp: message.timestamp || new Date().toISOString()
        };
        
        // 只廣播給ChatSystem用戶，不廣播給WebRTC連接
        broadcastToChatUsers(chatMessage);
        
        console.log('已廣播聊天訊息:', chatMessage.message, '來自:', chatMessage.username, '角色:', chatMessage.role);
        
    } catch (error) {
        console.error('處理聊天訊息時發生錯誤:', error);
    }
}

// 專門廣播給ChatSystem用戶
function broadcastToChatUsers(message) {
    const messageStr = JSON.stringify(message);
    let broadcastCount = 0;
    
    // 只發送給聊天用戶（ChatSystem連接）
    chatUsers.forEach((userInfo, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(messageStr);
                broadcastCount++;
                console.log(`[聊天廣播] 發送給: ${userInfo.username} (${userInfo.role})`);
            } catch (error) {
                console.error('發送給聊天用戶失敗:', userInfo.username, error);
                // 移除斷線的聊天用戶
                chatUsers.delete(ws);
            }
        }
    });
    
    console.log(`聊天訊息已廣播給 ${broadcastCount} 個ChatSystem用戶`);
}

// 廣播給所有客戶端
function broadcastToAll(message) {
    const messageStr = JSON.stringify(message);
    let broadcastCount = 0;
    
    // 發送給主播（WebRTC連接）
    if (broadcaster && broadcaster.ws && broadcaster.ws.readyState === WebSocket.OPEN) {
        try {
            broadcaster.ws.send(messageStr);
            broadcastCount++;
        } catch (error) {
            console.error('發送給主播失敗:', error);
        }
    }
    
    // 發送給所有觀眾（WebRTC連接）
    viewers.forEach((viewer, viewerId) => {
        if (viewer.readyState === WebSocket.OPEN) {
            try {
                viewer.send(messageStr);
                broadcastCount++;
            } catch (error) {
                console.error('發送給觀眾失敗:', viewerId, error);
                // 移除斷線的觀眾
                viewers.delete(viewerId);
                viewerCount--;
            }
        }
    });
    
    // 發送給所有聊天用戶（ChatSystem連接）
    chatUsers.forEach((userInfo, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(messageStr);
                broadcastCount++;
                console.log(`[廣播] 發送給聊天用戶: ${userInfo.username} (${userInfo.role})`);
            } catch (error) {
                console.error('發送給聊天用戶失敗:', userInfo.username, error);
                // 移除斷線的聊天用戶
                chatUsers.delete(ws);
            }
        }
    });
    
    console.log(`訊息已廣播給 ${broadcastCount} 個客戶端`);
}// 處理主播聊天訊息
function handleBroadcasterChatMessage(message) {
    // 兼容前端可能傳來的 message 或 text 欄位
    const content = message.message || message.text || '';
    console.log('主播聊天訊息:', content);
    
    // 廣播主播訊息給所有觀眾
    const chatMessage = {
        type: 'chat_message',
        username: message.username || '主播',
        message: content,
        text: content, // 增加 text 以便統一處理邏輯 (viewer 端 handleChatMessage 會取 text || message)
        userAvatar: message.userAvatar || null,
        timestamp: message.timestamp || new Date().toISOString(),
        isStreamer: true,
        broadcasterId: message.broadcasterId
    };
    
    // 發送給所有觀眾
    broadcastToViewers(chatMessage);
    
    console.log('已廣播主播訊息給', viewerCount, '個觀眾');
}

// 新協議聊天處理
async function handleUnifiedChat(payload, senderWs, clientType, clientId){
    try {
        console.log('[DEBUG] handleUnifiedChat 入口 payload=', payload, 'clientType=', clientType, 'clientId=', clientId);
        const text = (payload.text||'').trim();
        if(!text){
            console.log('[DEBUG] 空文字被拒絕 tempId=', payload.tempId);
            return sendJSON(senderWs, { type:'ack', event:'chat', ok:false, error:'empty_message', tempId: payload.tempId||null });
        }
        const role = payload.role === 'broadcaster' ? 'broadcaster' : (payload.role === 'system' ? 'system' : 'viewer');
        // 錯誤防護: 觀眾不可偽造成 broadcaster
        if(role==='broadcaster' && clientType!=='broadcaster'){
            console.log('[WARN] 非法 broadcaster 發送阻擋');
            return sendJSON(senderWs, { type:'ack', event:'chat', ok:false, error:'not_authorized', tempId: payload.tempId||null });
        }
        // 踢出檢查
        if(role==='viewer' && kickedViewers.has(clientId)){
            console.log('[INFO] 被踢用戶嘗試發言 viewerId=', clientId);
            return sendJSON(senderWs, { type:'ack', event:'chat', ok:false, error:'kicked', tempId: payload.tempId||null });
        }
        // 禁言檢查
        if(role==='viewer' && mutedViewers.has(clientId)){
            console.log('[INFO] 被禁言用戶嘗試發言 viewerId=', clientId);
            return sendJSON(senderWs, { type:'ack', event:'chat', ok:false, error:'muted', tempId: payload.tempId||null });
        }
        // 頻率限制 (僅 viewer)
        if(role==='viewer'){
            const info = rateMap.get(clientId) || { lastText:'', lastTime:0 };
            const now = Date.now();
            if(now - info.lastTime < MIN_INTERVAL_MS){
                console.log('[DEBUG] too_fast viewerId=', clientId);
                return sendJSON(senderWs, { type:'ack', event:'chat', ok:false, error:'too_fast', tempId: payload.tempId||null });
            }
            if(info.lastText === text && (now - info.lastTime) < DUPLICATE_WINDOW_MS){
                console.log('[DEBUG] duplicate viewerId=', clientId);
                return sendJSON(senderWs, { type:'ack', event:'chat', ok:false, error:'duplicate', tempId: payload.tempId||null });
            }
            info.lastText = text; info.lastTime = now; rateMap.set(clientId, info);
        }
        // 過濾敏感詞 (非 system)
        let finalText = role==='system' ? text : filterSensitive(text);
        const username = payload.username || (role==='broadcaster' ? '主播' : '匿名');
        const ts = payload.ts || new Date().toISOString();
        const tempId = payload.tempId || null;

        const chatPacket = {
            type: 'chat',
            role,
            username,
            text: finalText,
            timestamp: ts,
            tempId
        };

        // 保存(排除 system)
        if(role !== 'system'){
            try {
                db.saveChatMessage({
                    username,
                    role: role === 'broadcaster' ? 'broadcaster' : 'viewer',
                    content: text,
                    tempId
                }).catch(()=>{});
            } catch(e){ console.warn('保存統一聊天失敗', e.message); }
        }

        let delivered = 0;
        // 廣播給觀眾 (若訊息來自觀眾仍要顯示給其他人 & 主播)
    viewers.forEach((vws, vid) => { if(vws.readyState===WebSocket.OPEN){ if(sendJSON(vws, chatPacket)) delivered++; else console.log('[WARN] 發送觀眾失敗 viewerId=', vid); } });
        // 主播端也收到 (包含自己, 用於送達狀態)
        if(broadcaster && broadcaster.ws && broadcaster.ws.readyState===WebSocket.OPEN){ sendJSON(broadcaster.ws, chatPacket); }

        // ACK
        sendJSON(senderWs, { type:'ack', event:'chat', ok:true, tempId, delivered, timestamp: new Date().toISOString() });
        console.log('[DEBUG] chat 廣播完成 delivered=', delivered, 'tempId=', tempId);
    } catch(err){
        console.error('Unified chat error:', err);
        sendJSON(senderWs, { type:'ack', event:'chat', ok:false, error: err.message, tempId: payload? payload.tempId||null : null });
    }
}

// 處理主播斷線
function handleBroadcasterDisconnect() {
    console.log('主播斷線');
    
    // 清理activeBroadcasters中的記錄
    let broadcasterId = null;
    if (broadcaster && broadcaster.id) {
        broadcasterId = broadcaster.id;
        activeBroadcasters.delete(broadcasterId);
        console.log('已從活躍直播者列表移除:', broadcasterId);
    }
    
    // 清理activeConnections中的記錄
    for (const [connectionId, connection] of activeConnections.entries()) {
        if (connection.type === 'broadcaster' && connection.userId === broadcasterId) {
            activeConnections.delete(connectionId);
            console.log('已移除主播連接記錄:', connectionId);
        }
    }
    
    broadcaster = null;
    isStreaming = false;
    
    // 通知所有觀眾主播已斷線
    broadcastToViewers({
        type: 'stream_end',
        message: '主播已斷線，直播結束'
    });
}

// 處理觀眾斷線
function handleViewerDisconnect(viewerId) {
    console.log('觀眾斷線:', viewerId);
    
    let streamerId = null;
    
    if (viewers.has(viewerId)) {
        const viewerWs = viewers.get(viewerId);
        
        // 如果是Ghost用戶，釋放Ghost名稱
        if (viewerWs.ghostName) {
            ghostManager.releaseGhostName(viewerWs.ghostName);
        }
        
        viewers.delete(viewerId);
        viewerCount--;
        updateViewerCount();
    }
    
    // 從activeConnections中找到並移除觀眾連接記錄
    for (const [connectionId, connection] of activeConnections.entries()) {
        if (connection.type === 'viewer' && connection.userId === viewerId) {
            streamerId = connection.streamerId;
            activeConnections.delete(connectionId);
            console.log('已移除觀眾連接記錄:', connectionId);
            break;
        }
    }
    
    // 更新對應主播的觀眾數
    if (streamerId && activeBroadcasters.has(streamerId)) {
        const broadcasterData = activeBroadcasters.get(streamerId);
        broadcasterData.viewerCount = Math.max((broadcasterData.viewerCount || 1) - 1, 0);
        activeBroadcasters.set(streamerId, broadcasterData);
        console.log(`已更新主播 ${streamerId} 的觀眾數: ${broadcasterData.viewerCount}`);
    }
}

// 廣播訊息給所有觀眾
function broadcastToViewers(message) {
    viewers.forEach((viewer, viewerId) => {
        if (viewer.readyState === WebSocket.OPEN) {
            try {
                viewer.send(JSON.stringify(message));
            } catch (error) {
                console.error('發送訊息給觀眾失敗:', error);
                // 移除斷線的觀眾
                viewers.delete(viewerId);
                viewerCount--;
            }
        }
    });
}

// 更新觀眾數量
function updateViewerCount() {
    const countMessage = {
        type: 'viewer_count_update',
        count: viewerCount
    };
    
    // 更新所有觀眾的數量顯示
    broadcastToViewers(countMessage);
    
    // 更新主播的數量顯示
    if (broadcaster && broadcaster.ws.readyState === WebSocket.OPEN) {
        broadcaster.ws.send(JSON.stringify(countMessage));
    }
}

// 定期清理斷線的連接
setInterval(() => {
    // 清理斷線的觀眾
    viewers.forEach((viewer, viewerId) => {
        if (viewer.readyState !== WebSocket.OPEN) {
            console.log('清理斷線觀眾:', viewerId);
            viewers.delete(viewerId);
            viewerCount--;
        }
    });
    
    // 清理斷線的主播
    if (broadcaster && broadcaster.ws.readyState !== WebSocket.OPEN) {
        console.log('清理斷線主播');
        broadcaster = null;
        isStreaming = false;
    }
    
    // 更新觀眾數量
    if (viewerCount !== viewers.size) {
        viewerCount = viewers.size;
        updateViewerCount();
    }
}, 30000); // 每30秒檢查一次

// === 登入和註冊路由 ===

// 認證中間件
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({
            success: false,
            message: '請先登入'
        });
    }
}

// 檢查用戶是否已在其他地方登入
function checkUserConflict(userId, sessionId) {
    const activeUser = activeUsers.get(userId);
    if (activeUser && activeUser.sessionId !== sessionId) {
        return true; // 有衝突
    }
    return false; // 無衝突
}

// 登入處理
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    console.log('🔐 登入嘗試:', { email, password: '*'.repeat(password.length) });
    
    try {
        // 使用資料庫驗證用戶
        const user = await db.authenticateUser(email, password);
        
        // 檢查用戶是否已在其他地方登入
        if (checkUserConflict(user.id, req.sessionID)) {
            // 踢掉之前的會話
            const previousUser = activeUsers.get(user.id);
            if (previousUser) {
                await db.deleteSession(previousUser.sessionId);
            }
        }
        
        // 設置會話
        req.session.userId = user.id;
        req.session.user = user;
        
        // 記錄活躍用戶
        activeUsers.set(user.id, {
            sessionId: req.sessionID,
            lastActivity: Date.now()
        });
        
        // 創建資料庫會話記錄
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小時後過期
        await db.createSession(req.sessionID, user.id, expiresAt, req.ip, req.get('User-Agent'));
        
        console.log('✅ 登入成功:', user.displayName);
        res.json({
            success: true,
            message: '登入成功！',
            user: user,
            redirectUrl: '/index.html'
        });
        
    } catch (error) {
        console.log('❌ 登入失敗:', error.message);
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

// 註冊處理
app.post('/register', async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    
    console.log('📝 註冊嘗試:', { username, email });
    
    // 檢查密碼是否一致
    if (password !== confirmPassword) {
        return res.status(400).json({
            success: false,
            message: '兩次輸入的密碼不一致'
        });
    }
    
    // 檢查密碼強度
    if (password.length < 6) {
        return res.status(400).json({
            success: false,
            message: '密碼至少需要6個字符'
        });
    }
    
    try {
        // 使用資料庫創建用戶
        const newUser = await db.createUser(username, email, password, username);
        
        console.log('✅ 註冊成功:', username);
        res.json({
            success: true,
            message: '註冊成功！請使用新帳號登入',
            redirectUrl: '/login.html'
        });
        
    } catch (error) {
        console.log('❌ 註冊失敗:', error.message);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// 獲取當前用戶信息
app.get('/api/user/current', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: '用戶未登入'
            });
        }
        
        const user = await db.getUserById(req.session.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用戶不存在'
            });
        }
        
        // 移除敏感信息
        const { password_hash, ...userInfo } = user;
        
        res.json({
            success: true,
            user: userInfo
        });
        
    } catch (error) {
        console.error('獲取用戶信息失敗:', error);
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        });
    }
});

// 聊天記錄 API
app.get('/api/chat/history', async (req, res) => {
    const limit = parseInt(req.query.limit || '50', 10);
    try {
        const rows = await db.getRecentChatMessages(Math.min(limit, 200));
        res.json({ success:true, messages: rows.map(r => ({
            id: r.id,
            username: r.username,
            role: r.role,
            text: r.content,
            tempId: r.tempId,
            timestamp: r.createdAt
        })) });
    } catch (e) {
        res.status(500).json({ success:false, message:'取得聊天記錄失敗', error:e.message });
    }
});

// 更新用戶頭像
app.post('/api/user/avatar', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: '用戶未登入'
            });
        }
        
        const { avatarUrl } = req.body;
        
        if (!avatarUrl) {
            return res.status(400).json({
                success: false,
                message: '請提供頭像 URL'
            });
        }
        
        await db.updateUserAvatar(req.session.userId, avatarUrl);
        
        res.json({
            success: true,
            message: '頭像更新成功'
        });
        
    } catch (error) {
        console.error('更新頭像失敗:', error);
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        });
    }
});

// 登出處理
app.post('/logout', async (req, res) => {
    try {
        if (req.session.userId) {
            // 從活躍用戶列表中移除
            activeUsers.delete(req.session.userId);
            
            // 刪除資料庫中的會話
            await db.deleteSession(req.sessionID);
            
            // 銷毀會話
            req.session.destroy((err) => {
                if (err) {
                    console.error('銷毀會話失敗:', err);
                }
            });
            
            console.log('✅ 用戶已登出');
        }
        
        res.json({
            success: true,
            message: '已成功登出'
        });
        
    } catch (error) {
        console.error('登出失敗:', error);
        res.status(500).json({
            success: false,
            message: '登出失敗'
        });
    }
});

// 獲取當前用戶資訊
app.get('/api/user', requireAuth, async (req, res) => {
    try {
        const user = await db.getUserById(req.session.userId);
        res.json({
            success: true,
            user: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '獲取用戶資訊失敗'
        });
    }
});

// 檢查會話狀態
app.get('/api/session/check', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.json({
                authenticated: false
            });
        }
        
        // 檢查是否有會話衝突
        if (checkUserConflict(req.session.userId, req.sessionID)) {
            // 強制登出
            req.session.destroy();
            return res.json({
                authenticated: false,
                conflict: true,
                message: '您的帳號已在其他地方登入'
            });
        }
        
        // 更新最後活動時間
        const activeUser = activeUsers.get(req.session.userId);
        if (activeUser) {
            activeUser.lastActivity = Date.now();
        }
        
        const user = await db.getUserById(req.session.userId);
        res.json({
            authenticated: true,
            user: user
        });
        
    } catch (error) {
        res.json({
            authenticated: false
        });
    }
});

// 獲取活躍用戶數量（管理員功能）
app.get('/api/admin/active-users', requireAuth, (req, res) => {
    // 這裡可以添加管理員權限檢查
    res.json({
        activeUsersCount: activeUsers.size,
        activeUsers: Array.from(activeUsers.entries()).map(([userId, info]) => ({
            userId,
            sessionId: info.sessionId,
            lastActivity: new Date(info.lastActivity)
        }))
    });
});

// === 管理員：踢人 / 禁言 API (簡易示例，實務應加角色驗證) ===
app.post('/api/admin/kick', requireAuth, (req,res)=>{
    const { viewerId } = req.body;
    if(!viewerId) return res.status(400).json({ success:false, message:'缺少 viewerId' });
    kickedViewers.add(viewerId);
    // 斷線該 viewer
    const ws = viewers.get(viewerId);
    if(ws && ws.readyState === WebSocket.OPEN){
        try { ws.close(4001, 'kicked'); } catch(e){}
    }
    viewers.delete(viewerId);
    res.json({ success:true, message:`已踢出 ${viewerId}` });
});

app.post('/api/admin/mute', requireAuth, (req,res)=>{
    const { viewerId } = req.body;
    if(!viewerId) return res.status(400).json({ success:false, message:'缺少 viewerId' });
    mutedViewers.add(viewerId);
    res.json({ success:true, message:`已禁言 ${viewerId}` });
});

app.post('/api/admin/unmute', requireAuth, (req,res)=>{
    const { viewerId } = req.body;
    if(!viewerId) return res.status(400).json({ success:false, message:'缺少 viewerId' });
    mutedViewers.delete(viewerId);
    res.json({ success:true, message:`已解除禁言 ${viewerId}` });
});

// 獲取正在直播的用戶列表
app.get('/api/live-streams', async (req, res) => {
    try {
        const liveStreams = [];
        
        // 遍歷所有活躍的直播會話
        for (const [userId, streamerData] of activeBroadcasters.entries()) {
            if (streamerData && streamerData.ws && streamerData.ws.readyState === WebSocket.OPEN) {
                // 計算觀眾數量
                const viewerCount = Array.from(activeConnections.values())
                    .filter(conn => conn.type === 'viewer' && conn.streamerId === userId)
                    .length;
                
                // 獲取用戶資訊
                try {
                    const user = await db.getUserById(userId);
                    if (user) {
                        liveStreams.push({
                            userId: userId,
                            username: user.username,
                            viewerCount: viewerCount,
                            startTime: streamerData.startTime || new Date(),
                            status: 'live'
                        });
                    }
                } catch (userError) {
                    console.error('獲取用戶資訊失敗:', userError);
                    // 使用預設資訊
                    liveStreams.push({
                        userId: userId,
                        username: `用戶${userId.substring(0, 8)}`,
                        viewerCount: viewerCount,
                        startTime: streamerData.startTime || new Date(),
                        status: 'live'
                    });
                }
            }
        }
        
        // 按觀眾數量排序
        liveStreams.sort((a, b) => b.viewerCount - a.viewerCount);
        
        res.json({
            success: true,
            streams: liveStreams,
            totalStreams: liveStreams.length
        });
        
    } catch (error) {
        console.error('獲取直播列表失敗:', error);
        res.status(500).json({
            success: false,
            message: '服務器錯誤',
            streams: []
        });
    }
});

// 忘記密碼處理
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    console.log('🔑 忘記密碼請求:', email);
    
    try {
        // 檢查用戶是否存在（不透露密碼）
        const user = await db.getUserByEmail(email);
        
        console.log('✅ 找到用戶，模擬發送重設郵件');
        res.json({
            success: true,
            message: '如果該郵箱存在於我們的系統中，重設密碼連結已發送到您的電子郵件'
        });
    } catch (error) {
        // 為了安全，即使用戶不存在也返回成功訊息
        res.json({
            success: true,
            message: '如果該郵箱存在於我們的系統中，重設密碼連結已發送到您的電子郵件'
        });
    }
});

// 獲取測試帳號列表（開發用）
app.get('/api/test-accounts', async (req, res) => {
    try {
        // 只在開發環境顯示測試帳號
        const accounts = [
            {
                username: 'testuser1',
                email: 'test1@vibelo.com', 
                password: '123456',
                displayName: '測試用戶一號'
            },
            {
                username: 'demouser',
                email: 'demo@vibelo.com',
                password: 'demo123', 
                displayName: '演示用戶'
            },
            {
                username: 'admin',
                email: 'admin@vibelo.com',
                password: 'admin888',
                displayName: '管理員'
            }
        ];
        
        res.json({
            success: true,
            accounts: accounts,
            message: '這些是預設的測試帳號'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '無法獲取測試帳號'
        });
    }
});

// 定期清理過期會話和非活躍用戶
setInterval(async () => {
    try {
        // 清理資料庫中的過期會話
        await db.cleanupExpiredSessions();
        
        // 清理長時間非活躍的用戶
        const now = Date.now();
        const inactiveThreshold = 30 * 60 * 1000; // 30分鐘
        
        for (const [userId, userInfo] of activeUsers.entries()) {
            if (now - userInfo.lastActivity > inactiveThreshold) {
                console.log(`清理非活躍用戶: ${userId}`);
                activeUsers.delete(userId);
                await db.deleteSession(userInfo.sessionId);
            }
        }
        
        console.log(`✅ 會話清理完成，當前活躍用戶: ${activeUsers.size}`);
    } catch (error) {
        console.error('清理會話時發生錯誤:', error);
    }
}, 10 * 60 * 1000); // 每10分鐘執行一次

// 伺服器優雅關閉處理
let isShuttingDown = false;

// 清理函數
async function cleanup() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log('\n🛑 正在關閉伺服器...');
    
    try {
        // 關閉所有WebSocket連接
        console.log('🔌 關閉WebSocket連接...');
        if (broadcaster && broadcaster.ws) {
            broadcaster.ws.close();
        }
        
        viewers.forEach((ws, viewerId) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });
        
        // 清理映射
        viewers.clear();
        chatUsers.clear();
        
        // 關閉資料庫連接
        console.log('💾 關閉資料庫連接...');
        await db.close();
        
        // 關閉 WebSocket 伺服器
        console.log('🌐 關閉WebSocket伺服器...');
        if (wss) {
            wss.close();
        }
        
        // 關閉 HTTP/HTTPS 伺服器
        console.log('📡 關閉HTTP伺服器...');
        server.close(() => {
            console.log('✅ 伺服器已安全關閉');
            process.exit(0);
        });
        
        // 如果5秒內沒有正常關閉，強制退出
        setTimeout(() => {
            console.log('⚠️  強制關閉伺服器');
            process.exit(1);
        }, 5000);
        
    } catch (error) {
        console.error('❌ 關閉伺服器時發生錯誤:', error);
        process.exit(1);
    }
}

// 監聽各種關閉信號
process.on('SIGINT', cleanup);  // Ctrl+C
process.on('SIGTERM', cleanup); // 終止信號
process.on('SIGHUP', cleanup);  // 掛起信號

// 監聽未捕獲的異常
process.on('uncaughtException', (error) => {
    console.error('❌ 未捕獲的異常:', error);
    cleanup();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ 未處理的Promise拒絕:', reason);
    cleanup();
});

// 啟動伺服器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('🚀 VibeLo 直播平台伺服器已啟動');
    
    if (isHttps) {
        console.log(`🔒 HTTPS 伺服器運行在: https://localhost:${PORT}`);
        console.log(`🔌 WebSocket 伺服器運行在: wss://localhost:${PORT}`);
        console.log('📱 移動端支援: 完全支援');
        console.log(`📺 主播端: https://localhost:${PORT}/livestream_platform.html`);
        console.log(`👥 觀眾端: https://localhost:${PORT}/viewer.html`);
    } else {
        console.log(`📡 HTTP 伺服器運行在: http://localhost:${PORT}`);
        console.log(`🔌 WebSocket 伺服器運行在: ws://localhost:${PORT}`);
        console.log('📱 移動端支援: 有限制（需要HTTPS）');
        console.log(`� 主播端: http://localhost:${PORT}/livestream_platform.html`);
        console.log(`👥 觀眾端: http://localhost:${PORT}/viewer.html`);
    }
    
    console.log('�📄 測試帳號列表: ' + (isHttps ? 'https' : 'http') + '://localhost:' + PORT + '/test-accounts.html');
    console.log('💾 使用 SQLite 資料庫進行用戶管理');
});
