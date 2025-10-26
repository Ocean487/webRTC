# WebSocket 無限重連問題修復總結

## 🐛 問題描述
網站重新整理後會不斷顯示「新的 WebSocket 連接」，導致網站卡住無法使用。

## 🔍 根本原因
`titleSocket` WebSocket 連接在多個地方被**重複初始化**，造成無限重連循環：

### 問題來源：
1. **script.js 第192行**：頁面初始化時調用 `initTitleWebSocket()`
2. **livestream-platform.js 第291行**：`updateStreamTitle()` 失敗時調用
3. **livestream-platform.js 第414行**：`window.sendTitleUpdate()` 失敗時調用
4. **livestream-platform.js 第422行**：`checkLoginStatus()` 成功後調用
5. **livestream-platform.js 第249行**：`onclose` 事件每3秒自動重連

當連接失敗時，多個地方同時嘗試重連 → 產生更多失敗 → 更多重連嘗試 → **無限循環**

---

## ✅ 修復方案

### 1. 添加重連限制機制
```javascript
let titleSocketReconnectAttempts = 0; // 重連嘗試次數
let titleSocketReconnectTimer = null; // 重連計時器
const MAX_RECONNECT_ATTEMPTS = 5; // 最多重連5次
```

### 2. 改進 initTitleWebSocket() 函數
- ✅ 檢查現有連接狀態，避免重複初始化
- ✅ 檢查重連次數上限，防止無限循環
- ✅ 使用漸進式延遲（3秒、6秒、9秒...最多15秒）
- ✅ 清除舊的重連計時器避免衝突
- ✅ 連接成功後重置重連計數
- ✅ 超過上限後完全停止重連

**關鍵改進：**
```javascript
function initTitleWebSocket() {
    // 1. 檢查是否已連接
    if (titleSocket && (titleSocket.readyState === WebSocket.OPEN || 
        titleSocket.readyState === WebSocket.CONNECTING)) {
        console.log('⚠️ titleSocket 已存在，跳過重複初始化');
        return; 
    }

    // 2. 檢查重連次數
    if (titleSocketReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('❌ titleSocket 重連次數已達上限，停止重連');
        return;
    }

    // 3. 創建連接...
    console.log(`🔌 初始化標題WebSocket (第 ${titleSocketReconnectAttempts + 1} 次嘗試)`);
    
    // 4. onopen: 重置計數
    titleSocket.onopen = function() {
        titleSocketReconnectAttempts = 0; // ✅ 成功後重置
    };
    
    // 5. onclose: 漸進式重連
    titleSocket.onclose = function() {
        titleSocket = null;
        
        // 清除舊計時器
        if (titleSocketReconnectTimer) {
            clearTimeout(titleSocketReconnectTimer);
        }
        
        if (titleSocketReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            titleSocketReconnectAttempts++;
            const delay = Math.min(3000 * titleSocketReconnectAttempts, 15000);
            console.log(`🔄 將在 ${delay/1000} 秒後重連 (第 ${titleSocketReconnectAttempts} 次)`);
            
            titleSocketReconnectTimer = setTimeout(initTitleWebSocket, delay);
        }
    };
}
```

### 3. 移除不必要的重連調用

#### ❌ 修改前 - updateStreamTitle():
```javascript
if (titleSocket && titleSocket.readyState === WebSocket.OPEN) {
    // 發送...
} else {
    console.warn('titleSocket未連接');
    initTitleWebSocket(); // ⚠️ 會造成無限循環！
}
```

#### ✅ 修改後:
```javascript
if (titleSocket && titleSocket.readyState === WebSocket.OPEN) {
    // 發送...
    console.log('✅ 已通過titleSocket發送標題更新');
} else {
    console.warn('⚠️ titleSocket未連接，將僅通過streamingSocket發送');
    // 不在這裡重連，避免無限循環
}
```

#### ❌ 修改前 - window.sendTitleUpdate():
```javascript
if (titleSocket && titleSocket.readyState === WebSocket.OPEN) {
    // 發送...
} else {
    console.warn('titleSocket 未連接，嘗試重新連接');
    initTitleWebSocket(); // ⚠️ 會造成無限循環！
}
```

#### ✅ 修改後:
```javascript
let sent = false;

if (titleSocket && titleSocket.readyState === WebSocket.OPEN) {
    titleSocket.send(...);
    sent = true;
}

if (window.streamingSocket && window.streamingSocket.readyState === WebSocket.OPEN) {
    window.streamingSocket.send(...);
    sent = true;
}

if (!sent) {
    console.warn('⚠️ 無可用 WebSocket 連接');
    // 不重連，讓 onclose 自動處理
}
```

#### ❌ 修改前 - checkLoginStatus():
```javascript
if (data.success && data.user) {
    // ...
    if (!titleSocket || titleSocket.readyState !== WebSocket.OPEN) {
        initTitleWebSocket(); // ⚠️ 與 script.js 衝突！
    }
}
```

#### ✅ 修改後:
```javascript
if (data.success && data.user) {
    // ...
    console.log('✅ 用戶登入成功，等待 script.js 初始化連接');
    // 不在這裡初始化，由 script.js 統一管理
}
```

### 4. 頁面卸載時清理資源
```javascript
window.addEventListener('beforeunload', function() {
    stopLoginStatusMonitoring();
    
    // 清除重連計時器
    if (titleSocketReconnectTimer) {
        clearTimeout(titleSocketReconnectTimer);
        titleSocketReconnectTimer = null;
    }
    
    // 關閉連接
    if (titleSocket) {
        titleSocket.close();
        titleSocket = null;
    }
    
    console.log('🧹 頁面卸載，已清理所有連接');
});
```

---

## 🧪 測試步驟

### 1. 基本連接測試
```javascript
// 打開主播頁面控制台，執行：
console.log('titleSocket 狀態:', titleSocket?.readyState);
// 應該是 1 (OPEN) 或 0 (CONNECTING)，不應該重複出現「新的 WebSocket 連接」
```

### 2. 重連測試
```javascript
// 手動關閉連接測試重連：
if (titleSocket) titleSocket.close();

// 觀察控制台：
// 應該看到：
// ⚠️ 標題WebSocket連接已關閉
// 🔄 將在 3 秒後重連 (第 1 次)
// 🔌 初始化標題WebSocket連接 (第 1 次嘗試)
// ✅ 標題WebSocket已連接
```

### 3. 重連限制測試
```javascript
// 設置較小的限制測試：
// 修改 MAX_RECONNECT_ATTEMPTS = 2

// 手動關閉連接多次：
for (let i = 0; i < 5; i++) {
    setTimeout(() => {
        if (titleSocket) titleSocket.close();
    }, i * 1000);
}

// 觀察控制台：
// 前2次應該嘗試重連
// 第3次應該顯示：❌ titleSocket 重連次數已達上限，停止重連
// 不應該有更多重連嘗試
```

### 4. 頁面重整測試
```bash
# 重整頁面（Ctrl + Shift + R）
# 觀察控制台：
# - 應該只看到1次「初始化標題WebSocket連接」
# - 不應該看到多次「新的 WebSocket 連接」
# - 頁面應該正常載入，不卡住
```

### 5. 長時間運行測試
```bash
# 讓頁面開著30分鐘，觀察：
# - 連接應該保持穩定 (readyState === 1)
# - 如果意外斷線，應該自動重連（最多5次）
# - 不應該有無限重連循環
# - 頁面應該持續可用
```

---

## 📊 預期效果

### ✅ 修復後的行為：
- 頁面載入時 **只建立1次** titleSocket 連接
- 連接關閉時最多重連 **5次**，每次延遲漸進增加
- 超過5次後**完全停止**重連，不會卡住網站
- 頁面卸載時**自動清理**，不留殘餘計時器
- 控制台日誌清晰易讀，便於除錯

### ❌ 修復前的問題：
- 頁面載入就不斷顯示「新的 WebSocket 連接」
- 多個地方同時嘗試重連，造成指數級增長
- 沒有重連次數限制，無限循環
- 計時器不清理，資源洩漏
- 網站卡住無法使用

---

## 🔧 相關檔案修改

### 修改的檔案：
- ✅ `livestream-platform.js` (主要修改)
  - 第 25-27 行：添加重連控制變量
  - 第 185-285 行：改進 `initTitleWebSocket()` 函數
  - 第 310-330 行：移除 `updateStreamTitle()` 的重連調用
  - 第 397-425 行：移除 `window.sendTitleUpdate()` 的重連調用
  - 第 433-460 行：移除 `checkLoginStatus()` 的重連調用
  - 第 1286-1300 行：添加頁面卸載清理

### 未修改的檔案：
- `script.js` - 保持原樣，仍在第192行調用 `initTitleWebSocket()`（這是唯一合法的初始化位置）
- `viewer.js` - 不受影響（觀眾端不使用 titleSocket）

---

## 💡 最佳實踐

### WebSocket 連接管理的黃金法則：

1. **單一初始化點** - 只在一個地方初始化連接
2. **檢查現有連接** - 初始化前檢查是否已連接
3. **限制重連次數** - 設定最大重連次數上限
4. **漸進式延遲** - 每次重連增加延遲時間
5. **清理計時器** - 新重連前清除舊計時器
6. **資源清理** - 頁面卸載時關閉連接
7. **錯誤處理** - 捕獲並記錄所有錯誤
8. **日誌清晰** - 使用表情符號和計數便於追蹤

### 避免的反模式：

❌ 在多個地方調用 `initWebSocket()`
❌ 失敗後立即重連（沒有延遲）
❌ 無限重連循環（沒有上限）
❌ 不清理計時器和事件監聽器
❌ 忽略連接狀態檢查
❌ 沒有錯誤處理和日誌

---

## 🎯 下一步建議

如果問題仍然存在：

1. **檢查 server.js**：確保 WebSocket 伺服器正常運行
2. **檢查網路**：使用瀏覽器開發者工具的 Network 標籤
3. **檢查防火牆**：確認 8443 端口沒有被阻擋
4. **增加日誌**：在 `titleSocket.onopen/onclose/onerror` 添加更詳細的日誌
5. **監控資源**：使用 Chrome Task Manager 監控記憶體和 CPU

---

**修復完成時間**: 2025-10-25
**測試狀態**: ⏳ 待測試
**修復者**: GitHub Copilot
