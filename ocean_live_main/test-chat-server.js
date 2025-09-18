// 精簡版server.js用於測試獨立聊天室
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

const app = express();
const server = http.createServer(app);

// 靜態文件服務
app.use(express.static('.'));

// 獨立聊天室系統
let chatRooms = new Map(); // broadcasterId -> { broadcaster: ws, viewers: Set<ws>, messages: [] }
let chatConnections = new Map(); // ws -> { broadcasterId, role, username }

// 創建 WebSocket 服務器
const wss = new WebSocket.Server({ server });

console.log('WebSocket服務器創建成功');

wss.on('connection', function connection(ws, req) {
    console.log('新的 WebSocket 連接');
    
    ws.on('message', async function message(data) {
        let message;
        try {
            message = JSON.parse(data);
            console.log('收到訊息:', message.type, '內容:', message);
        } catch (err) {
            console.error('JSON parse error:', err);
            ws.send(JSON.stringify({ type: 'error', error: 'invalid_json' }));
            return;
        }
        
        try {
            switch (message.type) {
                case 'chat_join':
                    handleChatJoin(ws, message);
                    break;
                    
                case 'chat':
                    handleChatMessage(ws, message);
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
        handleChatDisconnect(ws);
    });
    
    ws.on('error', function error(err) {
        console.error('WebSocket 錯誤:', err);
    });
});

// 處理聊天加入 - 支持獨立聊天室
function handleChatJoin(ws, message) {
    const broadcasterId = message.broadcasterId || 'global';
    const role = message.role || 'viewer';
    const username = message.username || '匿名用戶';
    
    console.log('用戶加入聊天室:', broadcasterId, '角色:', role, '用戶名:', username);
    
    // 初始化聊天室（如果不存在）
    if (!chatRooms.has(broadcasterId)) {
        chatRooms.set(broadcasterId, {
            broadcaster: null,
            viewers: new Set(),
            messages: []
        });
        console.log('創建新聊天室:', broadcasterId);
    }
    
    const chatRoom = chatRooms.get(broadcasterId);
    
    // 記錄連接信息
    chatConnections.set(ws, {
        broadcasterId: broadcasterId,
        role: role,
        username: username,
        timestamp: Date.now()
    });
    
    // 將用戶添加到對應的聊天室
    if (role === 'broadcaster') {
        chatRoom.broadcaster = ws;
        console.log(`主播 ${username} 加入聊天室: ${broadcasterId}`);
    } else {
        chatRoom.viewers.add(ws);
        console.log(`觀眾 ${username} 加入聊天室: ${broadcasterId}，當前觀眾數: ${chatRoom.viewers.size}`);
    }
    
    // 發送確認
    ws.send(JSON.stringify({
        type: 'chat_join_ack',
        broadcasterId: broadcasterId,
        role: role,
        username: username,
        timestamp: new Date().toISOString(),
        viewerCount: chatRoom.viewers.size
    }));
    
    // 發送最近的聊天記錄（最後10條）
    const recentMessages = chatRoom.messages.slice(-10);
    if (recentMessages.length > 0) {
        ws.send(JSON.stringify({
            type: 'chat_history',
            messages: recentMessages,
            broadcasterId: broadcasterId
        }));
    }
    
    console.log(`聊天室 ${broadcasterId} 統計: 主播: ${chatRoom.broadcaster ? '在線' : '離線'}, 觀眾: ${chatRoom.viewers.size}`);
}

// 處理聊天訊息 - 支持獨立聊天室
function handleChatMessage(ws, message) {
    const connection = chatConnections.get(ws);
    if (!connection) {
        console.error('找不到連接信息，無法處理聊天訊息');
        return;
    }
    
    const broadcasterId = connection.broadcasterId;
    const messageText = message.message || message.text || '';
    const username = connection.username;
    const role = connection.role;
    
    console.log('收到聊天訊息:', messageText, '來自:', username, '聊天室:', broadcasterId);
    
    try {
        // 驗證訊息內容
        if (!messageText || typeof messageText !== 'string' || messageText.trim() === '') {
            console.log('空訊息被忽略');
            return;
        }
        
        // 檢查聊天室是否存在
        if (!chatRooms.has(broadcasterId)) {
            console.error('聊天室不存在:', broadcasterId);
            return;
        }
        
        // 建立統一的聊天訊息格式
        const chatMessage = {
            type: 'chat',
            broadcasterId: broadcasterId,
            role: role,
            username: username,
            message: messageText.trim(),
            text: messageText.trim(), // 同時提供 text 字段以保持兼容性
            timestamp: message.timestamp || new Date().toISOString()
        };
        
        // 將訊息添加到聊天室記錄
        const chatRoom = chatRooms.get(broadcasterId);
        chatRoom.messages.push(chatMessage);
        
        // 限制聊天記錄數量（保留最近100條）
        if (chatRoom.messages.length > 100) {
            chatRoom.messages = chatRoom.messages.slice(-100);
        }
        
        // 廣播給聊天室內的所有用戶
        broadcastToChatRoom(broadcasterId, chatMessage);
        
        console.log(`聊天訊息已廣播到聊天室 ${broadcasterId}: ${chatMessage.message} (來自: ${chatMessage.username})`);
        
    } catch (error) {
        console.error('處理聊天訊息時發生錯誤:', error);
    }
}

// 廣播給特定聊天室的所有用戶
function broadcastToChatRoom(broadcasterId, message) {
    if (!chatRooms.has(broadcasterId)) {
        console.error('聊天室不存在:', broadcasterId);
        return;
    }
    
    const chatRoom = chatRooms.get(broadcasterId);
    const messageStr = JSON.stringify(message);
    let broadcastCount = 0;
    
    // 發送給主播
    if (chatRoom.broadcaster && chatRoom.broadcaster.readyState === WebSocket.OPEN) {
        try {
            chatRoom.broadcaster.send(messageStr);
            broadcastCount++;
        } catch (error) {
            console.error('發送給主播失敗:', error);
            chatRoom.broadcaster = null;
        }
    }
    
    // 發送給所有觀眾
    const disconnectedViewers = [];
    chatRoom.viewers.forEach(viewerWs => {
        if (viewerWs.readyState === WebSocket.OPEN) {
            try {
                viewerWs.send(messageStr);
                broadcastCount++;
            } catch (error) {
                console.error('發送給觀眾失敗:', error);
                disconnectedViewers.push(viewerWs);
            }
        } else {
            disconnectedViewers.push(viewerWs);
        }
    });
    
    // 清理斷線的觀眾
    disconnectedViewers.forEach(ws => {
        chatRoom.viewers.delete(ws);
        chatConnections.delete(ws);
    });
    
    console.log(`聊天室 ${broadcasterId} 訊息已廣播給 ${broadcastCount} 個用戶`);
}

// 處理聊天斷線 - 清理聊天室連接
function handleChatDisconnect(ws) {
    const connection = chatConnections.get(ws);
    if (!connection) {
        return;
    }
    
    const { broadcasterId, role, username } = connection;
    console.log(`用戶斷線: ${username} (${role}) 從聊天室: ${broadcasterId}`);
    
    // 從聊天室中移除用戶
    if (chatRooms.has(broadcasterId)) {
        const chatRoom = chatRooms.get(broadcasterId);
        
        if (role === 'broadcaster') {
            chatRoom.broadcaster = null;
            console.log(`主播 ${username} 離開聊天室: ${broadcasterId}`);
        } else {
            chatRoom.viewers.delete(ws);
            console.log(`觀眾 ${username} 離開聊天室: ${broadcasterId}，剩餘觀眾: ${chatRoom.viewers.size}`);
        }
    }
    
    // 清理連接記錄
    chatConnections.delete(ws);
}

// 啟動伺服器
const PORT = 3002;
server.listen(PORT, () => {
    console.log('🚀 獨立聊天室測試伺服器已啟動');
    console.log(`📡 HTTP 伺服器運行在: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket 伺服器運行在: ws://localhost:${PORT}`);
    console.log(`📺 主播端: http://localhost:${PORT}/livestream_platform.html`);
    console.log(`👥 觀眾端: http://localhost:${PORT}/viewer.html`);
});