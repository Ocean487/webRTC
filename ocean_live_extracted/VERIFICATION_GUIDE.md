# 問題修復驗證指南

## 修復概述

已完成以下5個問題的修復，請按照此指南逐一測試：

---

## ✅ 問題1：觀眾介面標題不更新 + "未知訊息類型: broadcaster_info" 錯誤

### 已修復內容：
1. **viewer.js**: 修改 default case，未知消息先轉發給全局處理器再記錄
2. **livestream-platform.js**: 添加 titleSocket.onmessage 消息路由
3. **script.js**: updateStreamTitle() 增加 window.sendTitleUpdate() 備用方案
4. **websocket-fallback-connection.js**: 添加 broadcaster_info/title_update 轉發

### 測試步驟：
1. **準備**：
   - 主播端和觀眾端都打開瀏覽器控制台（F12）
   - 確認沒有紅色錯誤
   
2. **測試標題更新**：
   - 主播：在標題輸入框輸入新標題，按 Enter
   - 主播控制台：應該看到 `[titleSocket] 收到消息: broadcaster_info`
   - 觀眾控制台：應該**不再**出現 `🔍 未知消息類型: broadcaster_info`
   - 觀眾頁面：標題應該立即更新

3. **驗證成功標誌**：
   - ❌ 觀眾控制台沒有 "未知訊息類型: broadcaster_info"
   - ✅ 觀眾控制台顯示 "📝 更新直播標題"
   - ✅ 觀眾頁面顯示新標題

---

## ✅ 問題2：主播聊天室訊息傳不出去

### 已修復內容：
1. **chat-system.js**: broadcasterId 優先從 window.myBroadcasterId 獲取
2. **server.js**: 添加 broadcastToBroadcasterViewers() 路由函數

### 測試步驟：
1. **檢查連接**：
   ```javascript
   // 主播控制台執行：
   console.log('主播 WebSocket:', window.streamingSocket?.readyState); // 應該是 1
   console.log('主播 ID:', window.myBroadcasterId);
   
   // 觀眾控制台執行：
   console.log('觀眾 WebSocket:', window.socket?.readyState); // 應該是 1
   console.log('觀眾目標主播 ID:', window.targetStreamerId);
   ```
   
2. **測試雙向聊天**：
   - 主播：輸入消息 "測試主播消息" → 送出
   - 主播控制台：`[ChatSystem] 已成功發送訊息到WebSocket`
   - 觀眾頁面：應該看到 "測試主播消息"
   - 觀眾：輸入消息 "測試觀眾消息" → 送出
   - 主播頁面：應該看到 "測試觀眾消息"

3. **驗證成功標誌**：
   - ✅ 雙方 ID 匹配（myBroadcasterId === targetStreamerId）
   - ✅ WebSocket readyState === 1 (OPEN)
   - ✅ 主播和觀眾都能看到對方消息

### 常見問題排查：
- **如果聊天不通**：檢查 `window.myBroadcasterId` 是否設置
  ```javascript
  // 主播控制台手動設置（臨時）：
  window.myBroadcasterId = '你的用戶ID';
  ```

---

## ✅ 問題3：觀眾提前進入直播間，直播開始後不自動載入

### 已修復內容：
1. **viewer.js**: stream_start 消息處理中檢查 broadcasterId 匹配
2. **script.js**: startStream() 發送 stream_start 包含 broadcasterId

### 測試步驟：
1. **觀眾先進入**：
   - 觀眾打開直播頁面（此時主播未開播）
   - 觀眾頁面應顯示 "等待直播開始..."

2. **主播開始直播**：
   - 主播點擊 "開始直播"
   - 觀眾控制台：`✅ 收到 stream_start 消息`
   - 觀眾控制台：`🔄 直播開始，立即初始化 WebRTC 連接`
   - 3秒後觀眾頁面：視頻應該自動開始播放

3. **驗證成功標誌**：
   - ✅ 觀眾頁面視頻元素添加 'live' class
   - ✅ 狀態文字變為 "直播中"
   - ✅ 視頻在3秒內開始播放（不需要手動刷新）

---

## ✅ 問題4：主播停止直播後自動重新開始

### 已修復內容：
1. **script.js**: 添加 streamStartTimer/streamStartRetryTimer 變量
2. **script.js**: startStream() 延遲發送用計時器包裹，檢查 isStreaming
3. **script.js**: stopStream() 清除兩個計時器

### 測試步驟：
1. **快速開關測試**：
   - 主播點擊 "開始直播"
   - 等待1秒（計時器觸發前）
   - 立即點擊 "停止直播"
   - 觀察：直播應該停止，**不應該**自動重啟

2. **正常流程測試**：
   - 主播點擊 "開始直播"
   - 等待3秒（確保計時器已觸發）
   - 點擊 "停止直播"
   - 觀察：直播應該正常停止

3. **驗證成功標誌**：
   - ✅ 停止後 isStreaming === false
   - ✅ 停止後不會自動重新發送 stream_start
   - ✅ 控制台沒有延遲的 "發送 stream_start" 消息

---

## ✅ 問題5：觀眾看不到主播特效

### 已修復內容：
1. **viewer.js**: effect_update 消息處理中檢查 broadcasterId
2. **livestream-platform.js**: broadcastEffectToViewers() 包含 broadcasterId

### 測試步驟：
1. **確認直播中**：
   - 主播已開始直播
   - 觀眾已連接並看到視頻

2. **測試特效同步**：
   - 主播：點擊 "彩虹邊框" 特效
   - 觀眾控制台：`🎨 收到特效更新: rainbow 來自主播: [ID]`
   - 觀眾頁面：視頻元素應該出現彩虹邊框動畫
   - 主播：點擊 "發光" 特效
   - 觀眾頁面：邊框應該變為發光效果

3. **驗證成功標誌**：
   - ✅ 觀眾視頻元素 class 包含 `rainbow-border-effect` 或 `glow-border-effect`
   - ✅ 觀眾控制台顯示 broadcasterId 匹配
   - ✅ 特效在觀眾端實時同步（1秒內）

---

## 🔧 預先檢查清單（所有測試前必做）

### 1. 重新整理頁面
- 主播和觀眾都按 **Ctrl + Shift + R** 硬重整
- 清除瀏覽器快取

### 2. 檢查 WebSocket 連接
```javascript
// 主播控制台：
console.log('Broadcaster Socket:', window.streamingSocket?.readyState); // 應該是 1
console.log('Title Socket:', window.titleSocket?.readyState); // 應該是 1
console.log('Broadcaster ID:', window.myBroadcasterId);

// 觀眾控制台：
console.log('Viewer Socket:', window.socket?.readyState); // 應該是 1
console.log('Target Broadcaster ID:', window.targetStreamerId);
```

### 3. 確認伺服器運行
- 伺服器地址：wss://vibelo.l0sscat.com:8443
- 確認 server.js 正在運行
- 檢查防火牆沒有阻擋 8443 端口

### 4. 確認 ID 匹配
```javascript
// 兩邊控制台執行，確認值相同：
// 主播：
console.log('我的 ID:', window.myBroadcasterId);

// 觀眾：
console.log('目標 ID:', window.targetStreamerId);
```

**如果 ID 不匹配或為 null，這是所有問題的根源！**

---

## 📊 測試報告模板

請按此格式回報測試結果：

```
【問題1 - 標題更新】
- 主播控制台消息：✅/❌
- 觀眾未知訊息錯誤：消失 ✅/仍存在 ❌
- 觀眾標題更新：✅/❌

【問題2 - 聊天雙向】
- WebSocket 連接狀態：主播 [1/0] 觀眾 [1/0]
- ID 匹配：✅/❌ (主播ID: ___ 觀眾目標ID: ___)
- 主播→觀眾消息：✅/❌
- 觀眾→主播消息：✅/❌

【問題3 - 自動載入】
- 觀眾提前進入：✅
- 主播開始直播：✅
- 觀眾自動連接：✅/❌
- 連接時間：___ 秒

【問題4 - 防止重啟】
- 快速開關測試：✅/❌
- 正常流程測試：✅/❌
- 自動重啟問題：已解決 ✅/仍存在 ❌

【問題5 - 特效同步】
- 彩虹邊框：✅/❌
- 發光效果：✅/❌
- 同步延遲：___ 秒

【預先檢查】
- 硬重整完成：✅/❌
- 主播 WebSocket：[readyState]
- 觀眾 WebSocket：[readyState]
- ID 匹配：✅/❌
```

---

## 🆘 問題排查

### 如果 WebSocket 未連接 (readyState !== 1)：
1. 檢查網路連接
2. 檢查伺服器是否運行：`netstat -an | findstr 8443`
3. 檢查控制台錯誤訊息
4. 嘗試重新整理頁面

### 如果 ID 為 null 或不匹配：
```javascript
// 主播控制台手動設置：
window.myBroadcasterId = '你的用戶ID';

// 觀眾控制台手動設置：
window.targetStreamerId = '主播的用戶ID';
```

### 如果仍有 "未知訊息類型" 錯誤：
1. 確認已硬重整（Ctrl + Shift + R）
2. 檢查 viewer.js 第 820 行是否已更新
3. 提供完整的控制台錯誤截圖

---

## 📝 注意事項

- **所有修改都已完成**，無需手動編輯代碼
- **必須硬重整頁面**才能載入新代碼
- **WebSocket 連接是一切功能的基礎**，如果 readyState !== 1，其他功能都不會正常工作
- **broadcasterId 匹配是關鍵**，主播和觀眾的 ID 必須相同

---

完成測試後，請提供測試報告，特別標注哪些功能正常、哪些仍有問題！
