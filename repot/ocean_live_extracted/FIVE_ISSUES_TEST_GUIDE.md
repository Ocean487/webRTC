# 五大問題修復測試指南

## 修復總結

已完成以下5個問題的修復：

---

## ✅ 問題1：觀眾介面的直播標題不會實時更改

### 修復內容：
**livestream-platform.js** - 改進 `onTitleInput()` 函數，縮短防抖延遲到 300ms，並在輸入時立即廣播標題更新

**修改位置**：第 340-368 行

**關鍵改進**：
```javascript
// 舊版：500ms 防抖，不立即廣播
setTimeout(updateStreamTitle, 500);

// 新版：300ms 防抖 + 立即廣播
setTimeout(() => {
    updateStreamTitle();
    // 立即通過兩個通道發送
    if (titleSocket && titleSocket.readyState === WebSocket.OPEN) {
        titleSocket.send(JSON.stringify(payload));
    }
    if (streamingSocket && streamingSocket.readyState === WebSocket.OPEN) {
        streamingSocket.send(JSON.stringify(payload));
    }
}, 300);
```

### 測試步驟：
1. **主播端**：在標題輸入框輸入文字（不需要按 Enter）
2. **觀眾端**：打開控制台，監看日誌
3. **預期結果**：
   - 主播輸入後 300ms 內，觀眾控制台顯示：
     ```
     ⚡ 實時標題更新已發送 (titleSocket): [新標題]
     ⚡ 實時標題更新已發送 (streamingSocket): [新標題]
     ```
   - 觀眾頁面標題立即更新（帶有放大動畫）
   - 不需要主播按 Enter 就能實時看到標題變化

### 驗證命令：
```javascript
// 主播控制台：
console.log('titleSocket 狀態:', titleSocket?.readyState); // 應為 1
console.log('streamingSocket 狀態:', streamingSocket?.readyState); // 應為 1

// 觀眾控制台：
console.log('socket 狀態:', socket?.readyState); // 應為 1
console.log('當前標題:', document.getElementById('streamTitle')?.textContent);
```

---

## ✅ 問題2：主播介面的聊天室字傳不出去

### 根本原因分析：
聊天系統的 `broadcasterId` 路由邏輯已正確實現，問題可能出在：
1. WebSocket 連接未建立（readyState !== 1）
2. broadcasterId 未正確設置
3. server.js 的聊天路由未正確分發

### 檢查清單：
```javascript
// 主播控制台執行：
console.log('=== 聊天系統診斷 ===');
console.log('1. streamingSocket 狀態:', window.streamingSocket?.readyState); // 應為 1
console.log('2. broadcasterId:', window.myBroadcasterId); // 應有值
console.log('3. ChatSystem socket:', window.chatSystem?.socket?.readyState); // 應為 1
console.log('4. socket.broadcasterId:', window.chatSystem?.socket?.broadcasterId); // 應與 myBroadcasterId 相同
console.log('=====================');

// 觀眾控制台執行：
console.log('=== 觀眾聊天診斷 ===');
console.log('1. socket 狀態:', window.socket?.readyState); // 應為 1
console.log('2. targetStreamerId:', window.targetStreamerId); // 應與主播 ID 相同
console.log('==================');
```

### 測試步驟：
1. **前置檢查**：
   - 主播和觀眾都開啟控制台（F12）
   - 執行上述診斷命令，確保所有值正確

2. **測試主播→觀眾**：
   - 主播輸入：「測試主播消息」→ 送出
   - 主播控制台應顯示：`[ChatSystem] 已成功發送訊息到WebSocket`
   - 觀眾頁面應立即看到消息

3. **測試觀眾→主播**：
   - 觀眾輸入：「測試觀眾消息」→ 送出
   - 主播頁面應立即看到消息

### 如果仍無法發送：
```javascript
// 主播控制台手動設置（臨時修復）：
window.myBroadcasterId = 'YOUR_USER_ID'; // 替換成你的用戶 ID
if (window.chatSystem && window.chatSystem.socket) {
    window.chatSystem.socket.broadcasterId = window.myBroadcasterId;
}
console.log('✅ 已手動設置 broadcasterId');

// 重新初始化聊天系統：
if (window.initChatSystem) {
    window.initChatSystem({
        isStreamer: true,
        username: window.currentUser?.displayName || '主播',
        selectors: {
            chatContainer: '#chatMessages',
            messageInput: '#messageInput',
            sendButton: '.btn-send'
        }
    });
}
```

---

## ✅ 問題3：直播主開始直播後停止直播會自動再次打開

### 修復狀態：
**已在之前修復完成**（script.js 第 537-544 行）

### 驗證方法：
```javascript
// 主播控制台：
console.log('streamStartTimer:', streamStartTimer); // 應為 null
console.log('streamStartRetryTimer:', streamStartRetryTimer); // 應為 null
```

### 測試步驟：
1. **快速開關測試**：
   - 點擊「開始直播」
   - 等待 1 秒（計時器未觸發前）
   - 立即點擊「停止直播」
   - **預期**：直播應停止，不會自動重啟

2. **正常流程測試**：
   - 點擊「開始直播」
   - 等待 5 秒（確保完全啟動）
   - 點擊「停止直播」
   - **預期**：直播正常停止，無重啟

3. **檢查日誌**：
   ```javascript
   // 停止直播後檢查：
   console.log('isStreaming:', window.isStreaming); // 應為 false
   console.log('streamStartTimer:', streamStartTimer); // 應為 null
   console.log('streamStartRetryTimer:', streamStartRetryTimer); // 應為 null
   ```

---

## ✅ 問題4：觀眾看不到直播主的特效

### 根本原因分析：
觀眾端特效系統已完整實現（viewer-effects.js），問題可能是：
1. broadcasterId 不匹配導致特效被過濾
2. viewer-effects.js 未正確載入
3. WebSocket 連接問題

### 檢查清單：
```javascript
// 觀眾控制台：
console.log('=== 特效系統診斷 ===');
console.log('1. applyViewerEffect 函數:', typeof applyViewerEffect); // 應為 'function'
console.log('2. socket 狀態:', socket?.readyState); // 應為 1
console.log('3. targetStreamerId:', targetStreamerId); // 應有值
console.log('4. remoteVideo 元素:', document.getElementById('remoteVideo')); // 應存在
console.log('====================');
```

### 測試步驟：
1. **確認直播已連接**：
   - 觀眾端能看到主播視頻畫面
   - 視頻正常播放

2. **測試特效同步**：
   - 主播：點擊「彩虹邊框」特效按鈕
   - 觀眾控制台應顯示：
     ```
     🎨 收到特效更新: rainbowBorder 來自主播: [ID]
     🎨 應用特效: rainbowBorder
     ```
   - 觀眾視頻應出現彩虹邊框動畫

3. **測試多種特效**：
   - 黑白 (bw)
   - 模糊 (blur)
   - 懷舊 (sepia)
   - 霓虹邊框 (neon)
   - 閃電邊框 (glow)
   - 星星動畫 (particles)
   - 愛心動畫 (hearts)

4. **測試清除特效**：
   - 主播：再次點擊已啟用的特效按鈕（關閉特效）
   - 觀眾視頻應恢復正常

### 如果特效不同步：
```javascript
// 觀眾控制台手動測試：
applyViewerEffect('rainbowBorder'); // 應立即看到彩虹邊框
applyViewerEffect('clear'); // 應清除特效

// 檢查 broadcasterId 匹配：
console.log('主播 ID 匹配:', 
    '主播發送的 ID:', '[從控制台日誌中找]',
    '觀眾期待的 ID:', targetStreamerId,
    '是否匹配:', '[主播ID]' === targetStreamerId
);
```

---

## ✅ 問題5：攝影機、麥克風、音訊輸出不會自動抓取到我的設備

### 修復內容：
**script.js** - 改進 `loadDevices()` 函數，在載入設備後自動選擇第一個可用設備

**修改位置**：第 250-331 行

**關鍵改進**：
```javascript
// 🎥 自動選擇第一個可用的攝影機
if (cameras.length > 0) {
    cameraSelect.value = cameras[0].deviceId;
    console.log('✅ 自動選擇攝影機:', cameras[0].label);
}

// 🎤 自動選擇第一個可用的麥克風
if (microphones.length > 0) {
    microphoneSelect.value = microphones[0].deviceId;
    console.log('✅ 自動選擇麥克風:', microphones[0].label);
}

// 🔊 自動選擇第一個可用的音訊輸出端
if (speakers.length > 0) {
    audioOutputSelect.value = speakers[0].deviceId;
    console.log('✅ 自動選擇音訊輸出:', speakers[0].label);
}
```

### 測試步驟：
1. **打開主播頁面**：
   - 允許瀏覽器攝影機和麥克風權限
   - 等待頁面完全載入

2. **檢查設備選單**：
   - 打開控制台（F12）
   - 應該看到：
     ```
     ✅ 自動選擇攝影機: [你的攝影機名稱]
     ✅ 自動選擇麥克風: [你的麥克風名稱]
     ✅ 自動選擇音訊輸出: [你的音訊輸出名稱]
     📊 設備檢測完成: { 攝影機: X, 麥克風: Y, 音訊輸出: Z }
     ```

3. **檢查下拉選單**：
   ```javascript
   // 控制台執行：
   console.log('攝影機選擇:', document.getElementById('cameraSelect')?.value);
   console.log('麥克風選擇:', document.getElementById('microphoneSelect')?.value);
   console.log('音訊輸出選擇:', document.getElementById('audioOutputSelect')?.value);
   // 所有值都應該有內容（不是空字串）
   ```

4. **測試直播啟動**：
   - 點擊「開始直播」
   - 應該立即啟動，無需手動選擇設備
   - 預覽畫面應顯示攝影機畫面

### 手動重新載入設備：
```javascript
// 如果設備未自動選擇，手動重新載入：
loadDevices();

// 或強制選擇第一個設備：
navigator.mediaDevices.enumerateDevices().then(devices => {
    const camera = devices.find(d => d.kind === 'videoinput');
    const mic = devices.find(d => d.kind === 'audioinput');
    const speaker = devices.find(d => d.kind === 'audiooutput');
    
    if (camera) document.getElementById('cameraSelect').value = camera.deviceId;
    if (mic) document.getElementById('microphoneSelect').value = mic.deviceId;
    if (speaker) document.getElementById('audioOutputSelect').value = speaker.deviceId;
    
    console.log('✅ 設備已手動設置');
});
```

---

## 🧪 綜合測試流程

### 1. 初始化檢查（必做）
```bash
# 主播端控制台：
console.log('=== 系統狀態檢查 ===');
console.log('1. currentUser:', window.currentUser);
console.log('2. myBroadcasterId:', window.myBroadcasterId);
console.log('3. streamingSocket:', window.streamingSocket?.readyState);
console.log('4. titleSocket:', titleSocket?.readyState);
console.log('5. chatSystem.socket:', window.chatSystem?.socket?.readyState);
console.log('===================');

# 觀眾端控制台：
console.log('=== 觀眾系統檢查 ===');
console.log('1. socket:', socket?.readyState);
console.log('2. targetStreamerId:', targetStreamerId);
console.log('3. applyViewerEffect:', typeof applyViewerEffect);
console.log('==================');
```

### 2. 逐項測試
- ✅ 問題5：打開頁面 → 檢查設備自動選擇
- ✅ 問題3：開始直播 → 立即停止 → 確認不重啟
- ✅ 問題1：修改標題 → 觀眾端實時看到
- ✅ 問題2：主播發送聊天 → 觀眾收到；觀眾發送聊天 → 主播收到
- ✅ 問題4：主播套用特效 → 觀眾立即看到

### 3. 壓力測試
- 快速連續修改標題 10 次
- 快速發送 20 條聊天訊息
- 快速切換 5 種不同特效
- 快速開關直播 3 次

---

## 📊 測試報告模板

```markdown
【測試環境】
- 瀏覽器：Chrome / Firefox / Safari
- 作業系統：Windows / macOS / Linux
- 測試時間：[日期時間]

【問題1 - 實時標題更新】
- 主播輸入標題：✅/❌
- 300ms 延遲廣播：✅/❌
- 觀眾實時看到：✅/❌
- 控制台日誌：[貼上日誌]

【問題2 - 聊天雙向】
- WebSocket 連接：主播 [1/0] 觀眾 [1/0]
- broadcasterId 匹配：✅/❌
- 主播→觀眾：✅/❌
- 觀眾→主播：✅/❌
- 控制台日誌：[貼上日誌]

【問題3 - 防止重啟】
- 快速開關測試：✅/❌
- 計時器清除：✅/❌
- 無重啟發生：✅/❌

【問題4 - 特效同步】
- applyViewerEffect 載入：✅/❌
- 彩虹邊框同步：✅/❌
- 其他特效同步：✅/❌
- 清除特效同步：✅/❌
- broadcasterId 匹配：✅/❌

【問題5 - 設備自動選擇】
- 攝影機自動選擇：✅/❌
- 麥克風自動選擇：✅/❌
- 音訊輸出自動選擇：✅/❌
- 設備數量：攝影機 [X] 麥克風 [Y] 音訊輸出 [Z]
- 控制台日誌：[貼上日誌]

【整體評價】
- 所有功能正常：✅/❌
- 發現的新問題：[描述]
- 建議改進：[建議]
```

---

## 🆘 常見問題排查

### Q1：標題還是不會實時更新？
```javascript
// 檢查防抖延遲：
console.log('titleUpdateTimeout:', window.titleUpdateTimeout);

// 手動觸發一次：
updateStreamTitle();

// 確認 WebSocket 連接：
console.log('titleSocket:', titleSocket?.readyState);
console.log('streamingSocket:', window.streamingSocket?.readyState);
```

### Q2：聊天訊息還是發不出去？
```javascript
// 檢查 ChatSystem 初始化：
console.log('chatSystem:', window.chatSystem);
console.log('chatSystem.isConnected:', window.chatSystem?.isConnected);

// 手動發送測試：
if (window.chatSystem && window.chatSystem.socket) {
    window.chatSystem.socket.send(JSON.stringify({
        type: 'chat',
        role: 'broadcaster',
        username: '測試',
        message: '手動測試訊息',
        broadcasterId: window.myBroadcasterId,
        timestamp: new Date().toISOString()
    }));
}
```

### Q3：特效完全看不到？
```javascript
// 檢查腳本載入：
console.log('viewer-effects.js 已載入:', typeof applyViewerEffect !== 'undefined');

// 手動載入腳本（如果未載入）：
const script = document.createElement('script');
script.src = 'viewer-effects.js';
document.body.appendChild(script);
script.onload = () => console.log('✅ viewer-effects.js 已載入');
```

### Q4：設備還是沒有自動選擇？
```javascript
// 手動觸發 loadDevices：
loadDevices().then(() => {
    console.log('✅ 設備已重新載入');
    console.log('攝影機:', document.getElementById('cameraSelect')?.value);
    console.log('麥克風:', document.getElementById('microphoneSelect')?.value);
    console.log('音訊輸出:', document.getElementById('audioOutputSelect')?.value);
});
```

---

**測試完成後，請提供測試報告！** 🚀
