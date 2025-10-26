# 🔧 三大問題修復測試指南

## 修復摘要

已完成以下修復：

### ✅ 問題 1：觀眾介面的直播標題不會更改
**修復內容：**
- 在觀眾端 `viewer.js` 添加 `window.targetStreamerId` 全局變數設置
- 在 `stream_start` 消息處理中添加 broadcasterId 驗證
- 確保標題更新時 broadcasterId 匹配

**關鍵代碼：**
```javascript
// viewer.js line 18-20
window.targetStreamerId = targetStreamerId;

// viewer.js line 694-704 (stream_start 處理)
if (data.broadcasterId && data.broadcasterId !== targetStreamerId) {
    console.log('⚠️ stream_start 來自其他主播，忽略');
    break;
}
```

### ✅ 問題 2：主播介面的聊天室字傳不出去  
**修復內容：**
- 在 `script.js` 的 `initializeBroadcaster()` 函數開頭立即初始化 broadcasterId
- 設置 `window.myBroadcasterId` 全局變數供聊天系統使用
- 確保 ChatSystem 能正確獲取 broadcasterId

**關鍵代碼：**
```javascript
// script.js line 131-137
if (!myBroadcasterId) {
    myBroadcasterId = getBroadcasterIdFromUrl();
    console.log('✅ 主播ID已初始化:', myBroadcasterId);
}
window.myBroadcasterId = myBroadcasterId; // 確保全局可訪問
```

### ✅ 問題 3：觀眾介面下直播主開始直播後觀眾不會自動載入直播
**修復內容：**
- 在 `stream_start` 消息處理中添加 broadcasterId 驗證
- 確保只處理來自當前觀看主播的 stream_start 消息
- `handleStreamStarted()` 已經實現自動調用 `initializePeerConnection()`

**關鍵代碼：**
```javascript
// viewer.js line 694-704
case 'stream_start':
    console.log('🔍 [DEBUG] stream_start broadcasterId:', data.broadcasterId, '當前觀看的主播:', targetStreamerId);
    
    if (data.broadcasterId && data.broadcasterId !== targetStreamerId) {
        console.log('⚠️ stream_start 來自其他主播，忽略');
        break;
    }
    
    handleStreamStarted(data); // 會自動調用 initializePeerConnection()
```

---

## 🧪 詳細測試步驟

### 測試前準備

1. **清除瀏覽器緩存**
   ```
   按 Ctrl + Shift + Delete (Windows)
   或 Cmd + Shift + Delete (Mac)
   選擇清除緩存和 Cookie
   ```

2. **硬重新整理頁面**
   ```
   主播端：按 Ctrl + Shift + R
   觀眾端：按 Ctrl + Shift + R
   ```

3. **打開瀏覽器開發者工具**
   ```
   按 F12 或 Ctrl + Shift + I
   切換到 Console (控制台) 標籤
   ```

---

### 📝 測試 1：標題更新功能

#### 步驟 1：主播端設置標題
1. 打開主播端頁面
2. 登入帳號
3. 在控制台輸入檢查 ID：
   ```javascript
   console.log('主播ID:', window.myBroadcasterId);
   ```
   應該看到類似：`主播ID: 12345`

4. 在標題輸入框輸入測試標題："測試直播標題 123"
5. 按 Enter 鍵
6. 檢查控制台輸出：
   ```
   直播標題已更新: 測試直播標題 123
   主播ID: 12345
   已通過titleSocket發送標題更新到觀眾端
   或
   已通過streamingSocket發送標題更新到觀眾端
   ```

#### 步驟 2：觀眾端確認標題
1. 打開觀眾端頁面（使用正確的 URL參數）：
   ```
   http://localhost:8443/viewer.html?broadcaster=12345
   ```
   ⚠️ **重要**：broadcaster 參數必須與主播ID一致

2. 在控制台檢查 ID：
   ```javascript
   console.log('觀眾目標主播ID:', window.targetStreamerId);
   ```
   應該看到：`觀眾目標主播ID: 12345`

3. 當主播更新標題時，觀眾端控制台應該顯示：
   ```
   收到標題更新: {type: 'title_update', title: '測試直播標題 123', broadcasterId: '12345'}
   🔍 [DEBUG] 標題更新 broadcasterId: 12345 當前觀看的主播: 12345
   標題已更新為: 測試直播標題 123
   ```

4. 觀眾端頁面上的標題應該立即變成："測試直播標題 123"

#### 預期結果
✅ 主播端：標題輸入框下方顯示"目前標題: 測試直播標題 123"  
✅ 觀眾端：頁面頂部顯示"測試直播標題 123"  
✅ 控制台：兩端的 broadcasterId 必須一致

#### 常見問題
❌ 標題沒更新 → 檢查 broadcasterId 是否一致
❌ 控制台顯示「來自其他主播，忽略」→ URL 參數錯誤

---

### 💬 測試 2：聊天功能

#### 步驟 1：主播端發送消息
1. 主播端開啟後，在控制台確認：
   ```javascript
   console.log('ChatSystem:', window.chatSystem);
   console.log('主播ID:', window.myBroadcasterId);
   ```

2. 在聊天輸入框輸入："主播測試消息 1"
3. 點擊發送或按 Enter
4. 檢查控制台輸出：
   ```
   [ChatSystem] 聊天訊息使用的broadcasterId: 12345 角色: broadcaster
   [ChatSystem] 已成功發送訊息到WebSocket: {type: 'chat', role: 'broadcaster', username: '主播名稱', message: '主播測試消息 1', broadcasterId: '12345'}
   ```

5. 主播端聊天室應該顯示自己的消息（帶有主播標記）

#### 步驟 2：觀眾端發送消息
1. 觀眾端在控制台確認：
   ```javascript
   console.log('ChatSystem:', window.chatSystem);
   console.log('目標主播ID:', window.targetStreamerId);
   ```

2. 在聊天輸入框輸入："觀眾測試消息 1"
3. 點擊發送或按 Enter
4. 檢查控制台輸出：
   ```
   [ChatSystem] 聊天訊息使用的broadcasterId: 12345 角色: viewer
   [ChatSystem] 已成功發送訊息到WebSocket: {type: 'chat', role: 'viewer', username: 'Ghost123', message: '觀眾測試消息 1', broadcasterId: '12345'}
   ```

5. 觀眾端聊天室應該顯示自己的消息

#### 步驟 3：雙向確認
1. **主播端應該看到：**
   - 主播測試消息 1（自己的）
   - 觀眾測試消息 1（來自觀眾）

2. **觀眾端應該看到：**
   - 主播測試消息 1（來自主播）
   - 觀眾測試消息 1（自己的）

#### 預期結果
✅ 主播消息立即顯示在雙方聊天室  
✅ 觀眾消息立即顯示在雙方聊天室  
✅ 控制台顯示 broadcasterId 一致  
✅ 沒有重複消息（每條消息只顯示一次）

#### 常見問題
❌ 主播消息觀眾看不到 → 檢查 server.js 的 broadcastToBroadcasterViewers 函數
❌ 觀眾消息主播看不到 → 檢查 ChatSystem broadcasterId 設置
❌ 消息顯示兩次 → 檢查是否同時添加了本地顯示和服務器廣播

---

### 🎬 測試 3：自動載入直播

#### 步驟 1：觀眾先進入（主播未開播）
1. **觀眾端**先打開頁面（使用正確的 broadcaster 參數）
   ```
   http://localhost:8443/viewer.html?broadcaster=12345
   ```

2. 觀眾端控制台應該顯示：
   ```
   ✅ WebSocket 連接成功
   📤 發送觀眾加入消息: {viewerId: 'viewer_abc123', streamerId: '12345', ...}
   ```

3. 觀眾端頁面應該顯示：
   - "等待主播開始直播" 或類似提示
   - 播放器區域顯示佔位符

#### 步驟 2：主播開始直播
1. **主播端**點擊「開始直播」按鈕
2. 允許攝影機和麥克風權限
3. 主播端控制台應該顯示：
   ```
   發送直播開始事件，標題: [直播標題]
   type: 'stream_start', broadcasterId: '12345', ...
   ```

#### 步驟 3：觀眾端自動連接
1. **觀眾端**控制台應該在 1-3 秒內顯示：
   ```
   ✅ 收到 stream_start 消息
   🔍 [DEBUG] stream_start 數據: {type: 'stream_start', broadcasterId: '12345', ...}
   🔍 [DEBUG] stream_start broadcasterId: 12345 當前觀看的主播: 12345
   🎬 [DEBUG] handleStreamStarted 被調用
   🔄 直播開始，立即初始化 WebRTC 連接
   Creating peer connection for viewer: viewer_abc123
   Created offer for viewer: viewer_abc123
   ```

2. **3-5 秒內**觀眾端應該：
   - 自動顯示主播的直播畫面
   - 更新狀態為「直播中」
   - 播放視頻和音頻（如果瀏覽器允許自動播放）

3. 如果需要手動播放，會顯示播放按鈕

#### 預期結果
✅ 觀眾端無需手動操作  
✅ 收到 stream_start 後自動初始化 WebRTC  
✅ 3-5 秒內視頻自動開始播放  
✅ broadcasterId 匹配，沒有被過濾  

#### 常見問題
❌ 觀眾沒收到 stream_start → 檢查 server.js handleStreamStart 是否正確廣播
❌ 收到但沒初始化 → 檢查 broadcasterId 是否匹配
❌ 控制台顯示「來自其他主播，忽略」→ URL 參數錯誤或主播ID不匹配
❌ WebRTC 連接失敗 → 檢查 ICE 服務器配置和防火牆設置

---

## 🔍 調試命令速查表

### 主播端調試

```javascript
// 檢查主播ID
console.log('主播ID:', window.myBroadcasterId);

// 檢查WebSocket狀態
console.log('StreamingSocket:', window.streamingSocket?.readyState);
console.log('TitleSocket:', titleSocket?.readyState);

// 檢查聊天系統
console.log('ChatSystem:', window.chatSystem);
console.log('ChatSystem連接:', window.chatSystem?.isConnected);

// 檢查當前用戶
console.log('CurrentUser:', currentUser);

// 強制發送測試消息
if (window.chatSystem) {
    window.chatSystem.sendMessage('測試消息');
}

// 診斷直播系統
window.diagnoseLiveStreamIssue();
```

### 觀眾端調試

```javascript
// 檢查目標主播ID
console.log('目標主播ID:', window.targetStreamerId);

// 檢查WebSocket狀態
console.log('Socket:', socket?.readyState);
console.log('連接狀態:', isConnected);

// 檢查聊天系統
console.log('ChatSystem:', window.chatSystem);

// 檢查PeerConnection
console.log('PeerConnection:', peerConnection);
console.log('Connection State:', peerConnection?.connectionState);
console.log('ICE Connection State:', peerConnection?.iceConnectionState);

// 檢查視頻元素
const remoteVideo = document.getElementById('remoteVideo');
console.log('Remote Video:', remoteVideo);
console.log('Has Stream:', !!remoteVideo?.srcObject);

// 強制重新連接
if (typeof connectWebSocket === 'function') {
    connectWebSocket();
}

// 強制請求直播流
if (typeof initializePeerConnection === 'function') {
    initializePeerConnection();
}
```

---

## ⚠️ 重要注意事項

### broadcasterId 一致性

**最重要的規則：主播ID必須在所有地方保持一致**

1. **主播端生成ID：**
   ```
   URL參數：?broadcaster=12345
   或
   用戶ID：currentUser.id = "12345"
   ```

2. **觀眾端使用相同ID：**
   ```
   URL參數：?broadcaster=12345（必須與主播端一致）
   ```

3. **服務器端路由：**
   ```
   所有消息（chat, title_update, stream_start）都必須包含相同的 broadcasterId
   ```

### 檢查清單

在測試前確認：
- [ ] 主播端 `window.myBroadcasterId` 已設置
- [ ] 觀眾端 `window.targetStreamerId` 已設置
- [ ] 兩個 ID 完全一致（大小寫、格式）
- [ ] URL 參數正確（`?broadcaster=正確的ID`）
- [ ] WebSocket 連接正常（readyState === 1）
- [ ] 瀏覽器控制台沒有錯誤

### 常見錯誤

| 錯誤訊息 | 原因 | 解決方法 |
|---------|------|---------|
| `來自其他主播，忽略` | broadcasterId 不匹配 | 檢查 URL 參數和主播ID |
| `無法識別主播ID` | myBroadcasterId 未設置 | 確保 initializeBroadcaster 已執行 |
| `ChatSystem undefined` | 聊天系統未初始化 | 檢查 chat-system.js 是否載入 |
| `WebSocket 未連接` | 連接失敗或超時 | 檢查服務器狀態和網絡連接 |
| `PeerConnection failed` | WebRTC 連接問題 | 檢查 ICE 服務器和防火牆 |

---

## 🎯 成功標準

### 標題更新測試通過
- ✅ 主播修改標題，觀眾端2秒內看到變化
- ✅ 控制台顯示 broadcasterId 匹配
- ✅ 沒有「忽略」的訊息

### 聊天功能測試通過
- ✅ 主播發送消息，觀眾立即收到
- ✅ 觀眾發送消息，主播立即收到
- ✅ 每條消息只顯示一次
- ✅ broadcasterId 在所有消息中一致

### 自動載入測試通過
- ✅ 觀眾在主播開播前進入
- ✅ 主播開播後，觀眾3-5秒內自動看到直播
- ✅ 無需手動點擊「請求直播」
- ✅ 控制台顯示完整的 WebRTC 連接流程

---

## 📞 問題排查流程

如果測試失敗，按以下順序檢查：

1. **檢查 broadcasterId 一致性**
   - 主播端和觀眾端的 ID 必須完全一致
   - 使用控制台命令檢查

2. **檢查 WebSocket 連接**
   - readyState 必須為 1 (OPEN)
   - 檢查服務器是否運行

3. **檢查控制台錯誤**
   - 紅色錯誤訊息優先處理
   - 黃色警告可能也很關鍵

4. **檢查網絡請求**
   - 打開 Network 標籤
   - 查看 WebSocket 連接狀態
   - 檢查是否有失敗的請求

5. **清除緩存重試**
   - Ctrl + Shift + Delete 清除緩存
   - Ctrl + Shift + R 硬重新整理

---

## 📊 測試記錄模板

```
測試日期：____________________
測試環境：____________________

【標題更新測試】
主播ID: ____________________
觀眾ID: ____________________
結果: □ 通過  □ 失敗
備註: _______________________

【聊天功能測試】
主播→觀眾: □ 通過  □ 失敗
觀眾→主播: □ 通過  □ 失敗
備註: _______________________

【自動載入測試】
stream_start 收到: □ 是  □ 否
自動初始化: □ 是  □ 否
視頻播放: □ 是  □ 否
延遲時間: ______ 秒
備註: _______________________

【總結】
所有測試: □ 全部通過  □ 部分通過  □ 失敗
主要問題: _______________________
```

---

## 🎉 測試成功後

如果所有測試都通過：

1. ✅ 標題更新正常
2. ✅ 聊天雙向通信正常
3. ✅ 觀眾自動載入直播正常

恭喜！所有功能已修復完成！

如果有任何測試失敗，請：
1. 記錄錯誤訊息
2. 檢查控制台完整日誌
3. 使用調試命令進一步診斷
4. 參考常見問題和解決方法
