# 三大問題修復方案

## 問題診斷

### 問題 1：觀眾介面的直播標題不會更改
**根本原因：** 
- 觀眾端的 `handleTitleUpdate` 函數中有 broadcasterId 驗證
- 如果 `data.broadcasterId !== targetStreamerId`，標題更新會被忽略
- 需要確保主播端發送的 broadcasterId 與觀眾端的 targetStreamerId 一致

**修復方法：**
1. 確保主播端 `updateStreamTitle()` 函數正確設置 broadcasterId
2. 確保觀眾端 `targetStreamerId` 正確初始化
3. 檢查服務器端 `handleTitleUpdate()` 正確轉發 broadcasterId

### 問題 2：主播介面的聊天室字傳不出去
**根本原因：**
- 主播的聊天系統可能使用了獨立的 WebSocket 連接
- ChatSystem 需要正確設置 broadcasterId 才能讓服務器路由消息
- 需要確保 ChatSystem 的 WebSocket 連接狀態正常

**修復方法：**
1. 確保 ChatSystem 初始化時正確獲取 broadcasterId
2. 確保聊天消息包含正確的 broadcasterId
3. 檢查服務器端 `handleChatMessage()` 正確廣播消息

### 問題 3：觀眾介面下直播主開始直播後觀眾不會自動載入直播
**根本原因：**
- 觀眾端已經實現了 `handleStreamStarted()`，會自動調用 `initializePeerConnection()`
- 問題可能是 `stream_start` 消息沒有正確發送到觀眾
- 或者 broadcasterId 不匹配導致消息被過濾

**修復方法：**
1. 確保服務器在主播開始直播時正確廣播 `stream_start` 到所有觀眾
2. 確保 `stream_start` 消息包含正確的 broadcasterId
3. 確保觀眾端正確處理 `stream_start` 消息

## 詳細修復步驟

### 步驟 1：檢查主播端 broadcasterId 初始化

在 `livestream-platform.js` 中，確保 `myBroadcasterId` 在最早的時機被設置：

```javascript
// 在 DOMContentLoaded 事件中盡早設置
document.addEventListener('DOMContentLoaded', async function() {
    // 立即設置 broadcasterId
    if (!myBroadcasterId) {
        myBroadcasterId = getBroadcasterIdFromUrl();
        console.log('✅ 主播ID已初始化:', myBroadcasterId);
    }
    
    // 將 broadcasterId 存儲到全局變數，供其他模組使用
    window.myBroadcasterId = myBroadcasterId;
    
    // ... 其他初始化代碼
});
```

### 步驟 2：檢查觀眾端 targetStreamerId 初始化

在 `viewer.js` 開頭已經正確設置：
```javascript
let targetStreamerId = getStreamerIdFromUrl();
```

但需要確保也存儲到全局：
```javascript
// 在 DOMContentLoaded 中添加
window.targetStreamerId = targetStreamerId;
console.log('✅ 觀眾目標主播ID:', targetStreamerId);
```

### 步驟 3：修復標題更新

主播端 `updateStreamTitle()` 已經包含 broadcasterId，但需要確保兩個 WebSocket 都發送：

```javascript
// 檢查 titleSocket 和 streamingSocket 的發送邏輯
if (titleSocket && titleSocket.readyState === WebSocket.OPEN) {
    titleSocket.send(JSON.stringify({
        type: 'title_update',
        broadcasterId: myBroadcasterId,  // 確保這個值正確
        title: currentStreamTitle,
        timestamp: Date.now()
    }));
}

if (window.streamingSocket && window.streamingSocket.readyState === WebSocket.OPEN) {
    window.streamingSocket.send(JSON.stringify({
        type: 'title_update',
        broadcasterId: myBroadcasterId,  // 確保這個值正確
        title: currentStreamTitle,
        timestamp: Date.now()
    }));
}
```

### 步驟 4：修復聊天系統

在 `chat-system.js` 中，確保 broadcasterId 正確傳遞：

檢查 `sendMessage()` 函數：
```javascript
sendMessage(text) {
    // ... 前面的代碼

    // 獲取 broadcasterId
    let broadcasterId = null;
    if (this.isStreamer) {
        broadcasterId = window.myBroadcasterId || window.getBroadcasterIdFromUrl?.();
    } else {
        broadcasterId = window.targetStreamerId || window.getStreamerIdFromUrl?.();
    }

    console.log('[ChatSystem] 聊天訊息使用的broadcasterId:', broadcasterId, '角色:', this.isStreamer ? 'broadcaster' : 'viewer');

    const message = {
        type: 'chat',
        role: this.isStreamer ? 'broadcaster' : 'viewer',
        username: this.username,
        message: text,
        timestamp: Date.now(),
        broadcasterId: broadcasterId  // 確保這個字段存在
    };

    // 同時設置 WebSocket 的 broadcasterId 屬性
    if (this.socket && broadcasterId) {
        this.socket.broadcasterId = broadcasterId;
    }

    // ... 發送邏輯
}
```

### 步驟 5：確保自動載入直播

觀眾端的 `handleStreamStarted()` 已經實現了自動初始化：

```javascript
function handleStreamStarted(data) {
    console.log('🎬 [DEBUG] handleStreamStarted 被調用:', data);
    
    // ... UI 更新

    // 立即初始化 WebRTC 連接
    console.log('🔄 直播開始，立即初始化 WebRTC 連接');
    initializePeerConnection();  // ← 這裡已經會自動載入
    
    // 3 秒後如果還沒收到 offer，主動請求
    if (!window.requestTimeout) {
        window.requestTimeout = setTimeout(function() {
            if (!window.receivedOffer && socket && isConnected) {
                socket.send(JSON.stringify({
                    type: 'request_webrtc_connection',
                    viewerId: viewerId,
                    streamerId: targetStreamerId
                }));
            }
        }, 3000);
    }
}
```

**關鍵：確保服務器端正確發送 stream_start**

檢查 `server.js` 的 `handleStreamStart()` 函數：

```javascript
function handleStreamStart(message) {
    const broadcasterId = message.broadcasterId;
    const broadcaster = activeBroadcasters.get(broadcasterId);
    
    if (broadcaster) {
        broadcaster.isStreaming = true;
        broadcaster.streamTitle = message.title || '';
        
        // 廣播給所有該主播的觀眾
        broadcastToBroadcasterViewers(broadcasterId, {
            type: 'stream_start',
            title: broadcaster.streamTitle,
            message: '主播正在直播中',
            status: 'live',
            broadcasterId: broadcasterId  // ← 確保包含這個
        });
    }
}
```

## 測試步驟

### 測試標題更新：
1. 主播端：打開瀏覽器控制台
2. 修改直播標題並按 Enter
3. 檢查控制台輸出：
   ```
   直播標題已更新: [新標題]
   主播ID: [broadcaster_id]
   已通過titleSocket發送標題更新到觀眾端
   ```
4. 觀眾端：打開控制台
5. 應該看到：
   ```
   收到標題更新: {type: 'title_update', title: '[新標題]', broadcasterId: '[broadcaster_id]'}
   🔍 [DEBUG] 標題更新 broadcasterId: [broadcaster_id] 當前觀看的主播: [broadcaster_id]
   標題已更新為: [新標題]
   ```
6. 確認兩個 ID 必須一致

### 測試聊天功能：
1. 主播端：發送聊天消息
2. 檢查控制台：
   ```
   [ChatSystem] 聊天訊息使用的broadcasterId: [broadcaster_id] 角色: broadcaster
   [ChatSystem] 已成功發送訊息到WebSocket
   ```
3. 觀眾端：應該立即看到消息顯示
4. 觀眾端：發送消息
5. 檢查控制台：
   ```
   [ChatSystem] 聊天訊息使用的broadcasterId: [broadcaster_id] 角色: viewer
   ```
6. 主播端：應該看到觀眾的消息

### 測試自動載入直播：
1. 觀眾端：先打開觀眾頁面（主播未開始直播）
2. 確認看到「等待主播開始直播」
3. 主播端：點擊「開始直播」
4. 觀眾端控制台應該顯示：
   ```
   ✅ 收到 stream_start 消息
   🔍 [DEBUG] stream_start 數據: {type: 'stream_start', broadcasterId: '[id]', ...}
   🎬 [DEBUG] handleStreamStarted 被調用
   🔄 直播開始，立即初始化 WebRTC 連接
   ```
5. 3-5 秒內觀眾應該自動看到直播畫面

## 常見問題排查

### Q: 標題更新失敗
**檢查項：**
- 主播端 `myBroadcasterId` 是否正確設置
- 觀眾端 `targetStreamerId` 是否與主播 ID 一致
- WebSocket 連接是否正常（readyState === 1）
- 服務器端是否正確轉發消息

### Q: 聊天消息不顯示
**檢查項：**
- ChatSystem 是否正確初始化
- WebSocket 連接狀態
- broadcasterId 是否正確包含在消息中
- 服務器端 `handleChatMessage` 是否正確廣播

### Q: 觀眾無法自動載入直播
**檢查項：**
- 觀眾是否正確加入了主播的房間
- 服務器是否發送了 `stream_start` 消息
- `handleStreamStarted` 是否被調用
- `initializePeerConnection` 是否執行
- ICE 連接狀態是否正常

## 緊急調試命令

在瀏覽器控制台中執行：

```javascript
// 檢查主播端狀態
console.log('主播ID:', window.myBroadcasterId);
console.log('WebSocket狀態:', window.streamingSocket?.readyState);
console.log('ChatSystem:', window.chatSystem);

// 檢查觀眾端狀態
console.log('目標主播ID:', window.targetStreamerId);
console.log('WebSocket狀態:', socket?.readyState);
console.log('PeerConnection:', peerConnection);
console.log('ChatSystem:', window.chatSystem);

// 強制重新連接
if (window.chatSystem) {
    window.chatSystem.connect();
}
```
