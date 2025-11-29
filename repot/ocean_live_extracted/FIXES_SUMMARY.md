# 直播系統問題修復摘要

## 修復的問題

### 問題1: 觀眾介面的直播標題不會更改
**原因**: `handleTitleUpdate`沒有檢查broadcasterId匹配，導致接收到其他主播的標題更新
**修復**: 
- 在`viewer.js`的`handleTitleUpdate`函數中添加broadcasterId匹配檢查
- 只處理當前觀看主播的標題更新

### 問題2 & 3: 聊天室消息無法互相看到
**原因**: 
1. 聊天消息沒有正確攜帶broadcasterId
2. WebSocket連接上沒有設置broadcasterId屬性
3. broadcasterId的獲取順序不正確

**修復**:
1. 修改`chat-system.js`中的broadcasterId獲取邏輯:
   - 主播端優先使用`window.myBroadcasterId`
   - 觀眾端優先使用`window.targetStreamerId`
   - 將獲取到的broadcasterId存儲到全局變量
   
2. 在發送消息時將broadcasterId設置到WebSocket連接:
   ```javascript
   if (this.socket && broadcasterId) {
       this.socket.broadcasterId = broadcasterId;
   }
   ```

3. 服務器端已有broadcasterId路由邏輯，會根據broadcasterId將消息發送給對應的主播和觀眾

### 問題4: 觀眾介面下直播主開始直播後觀眾不會自動載入直播
**原因**: `handleStreamStarted`函數已經正確處理stream_start事件並初始化WebRTC連接
**狀態**: 此功能應該正常工作，如果仍有問題，請檢查:
1. 主播端是否正確發送了`stream_start`消息
2. 觀眾端WebSocket是否已連接
3. broadcasterId是否匹配

## 額外修復

### 特效更新broadcasterId匹配
- 在`viewer.js`的`effect_update`處理中添加broadcasterId匹配檢查
- 避免應用其他主播的特效

## 測試步驟

1. **測試聊天功能**:
   - 開啟主播介面和觀眾介面
   - 確認兩邊的broadcasterId匹配（檢查控制台日誌）
   - 主播發送消息，觀眾應該能看到
   - 觀眾發送消息，主播應該能看到

2. **測試標題更新**:
   - 主播更新直播標題
   - 觀眾介面應該即時顯示新標題
   - 檢查控制台確認broadcasterId匹配

3. **測試直播自動載入**:
   - 先開啟觀眾介面
   - 再開啟主播介面並開始直播
   - 觀眾端應該自動連接並顯示視頻

4. **測試特效同步**:
   - 主播應用特效
   - 觀眾端應該看到相同特效

## 關鍵日誌輸出

查找以下日誌來確認修復是否生效:

```
[ChatSystem] 聊天訊息使用的broadcasterId: [ID] 角色: [broadcaster/viewer]
[ChatSystem] WebSocket.broadcasterId已設置: [ID]
🔍 [DEBUG] 標題更新 broadcasterId: [ID] 當前觀看的主播: [ID]
🎨 收到特效更新: [effect] 來自主播: [ID]
```

## 注意事項

1. 確保主播和觀眾使用相同的broadcasterId
2. 主播ID來源優先級:
   - URL參數 `?broadcaster=ID`
   - 用戶登入ID
   - 自動生成的時間戳ID

3. 如果問題仍然存在，請在瀏覽器控制台執行:
   ```javascript
   console.log('主播ID:', window.myBroadcasterId || window.targetStreamerId);
   console.log('WebSocket broadcasterId:', socket?.broadcasterId);
   ```
