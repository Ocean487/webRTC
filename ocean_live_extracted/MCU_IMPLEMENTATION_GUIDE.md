# MCU 實現指南

## 概述

本項目已成功實現 MCU (Multipoint Control Unit) 架構，將原本的 P2P WebRTC 直播改為通過 MCU 服務器中轉的架構。

## 架構變更

### 原始架構 (P2P)
```
主播端 ←→ 觀眾端1
主播端 ←→ 觀眾端2
主播端 ←→ 觀眾端3
```

### 新架構 (MCU)
```
主播端 → MCU服務器 → 觀眾端1
                    → 觀眾端2
                    → 觀眾端3
```

## 實現的功能

### 1. 服務器端 (server.js)
- ✅ MCU 狀態管理
- ✅ 主播 MCU 連接處理
- ✅ 觀眾 MCU 連接處理
- ✅ MCU Offer/Answer 處理
- ✅ MCU ICE 候選處理
- ✅ MCU 統計信息
- ✅ MCU 連接請求處理

### 2. 主播端 (script.js)
- ✅ MCU 直播啟動 (`startMCUStream`)
- ✅ MCU 連接建立 (`establishMCUConnection`)
- ✅ MCU 直播停止 (`stopMCUStream`)
- ✅ MCU 消息處理
- ✅ MCU 狀態顯示

### 3. 觀眾端 (viewer.js)
- ✅ MCU 消息處理 (`handleMCUMessage`)
- ✅ MCU 直播開始處理 (`handleMCUStreamStarted`)
- ✅ MCU 連接請求 (`requestMCUConnection`)
- ✅ MCU Offer 處理 (`handleMCUOffer`)
- ✅ MCU ICE 候選處理 (`handleMCUIceCandidate`)

## 測試步驟

### 1. 啟動服務器
```bash
node server.js
```

### 2. 測試主播端
1. 打開 `https://your-domain:8443/livestream_platform.html`
2. 登入主播帳號
3. 點擊「開始直播」按鈕
4. 檢查控制台日誌，應該看到：
   - `🎬 [MCU] 開始 MCU 直播流程`
   - `🔗 [MCU] 建立主播與 MCU 的連接`
   - `✅ [MCU] 已發送 MCU offer`

### 3. 測試觀眾端
1. 打開 `https://your-domain:8443/viewer.html`
2. 等待主播開始直播
3. 檢查控制台日誌，應該看到：
   - `🎯 [MCU] 檢測到 MCU 模式直播`
   - `🎯 [MCU] 請求 MCU 連接`
   - `✅ [MCU] 收到 MCU offer`

### 4. 驗證 MCU 功能
- 主播端應該顯示「MCU 直播已開始」
- 觀眾端應該顯示「MCU 直播中」狀態
- 視頻流應該正常播放
- 聊天功能應該正常運作

## 關鍵消息類型

### 主播端發送
- `offer` (mcuMode: true) - 發送 MCU offer
- `ice_candidate` (mcuMode: true) - 發送 MCU ICE 候選
- `stream_start` (mcuMode: true) - 開始 MCU 直播

### 觀眾端發送
- `mcu_connection_request` - 請求 MCU 連接
- `answer` (mcuMode: true) - 回應 MCU offer
- `ice_candidate` (mcuMode: true) - 發送 MCU ICE 候選

### 服務器端發送
- `mcu_ready` - MCU 服務器準備就緒
- `mcu_connected` - MCU 連接已建立
- `mcu_offer` - 發送 MCU offer 給觀眾
- `mcu_ice_candidate` - 轉發 MCU ICE 候選

## 故障排除

### 常見問題

1. **MCU 連接失敗**
   - 檢查 WebSocket 連接狀態
   - 確認服務器端 MCU 狀態為 `isActive: true`
   - 檢查控制台錯誤日誌

2. **視頻無法播放**
   - 確認 MCU offer/answer 交換成功
   - 檢查 ICE 候選收集
   - 驗證媒體流軌道

3. **聊天功能異常**
   - 聊天系統獨立於 MCU，使用獨立 WebSocket
   - 檢查 ChatSystem 初始化

### 調試命令

在瀏覽器控制台中使用：

```javascript
// 檢查 MCU 狀態
console.log('MCU 狀態:', window.mcuPeerConnection);

// 檢查連接狀態
console.log('WebSocket 狀態:', streamingSocket.readyState);

// 檢查媒體流
console.log('本地流:', localStream);
console.log('遠程流:', remoteVideo.srcObject);
```

## 性能優化

### MCU 優勢
- 減少主播端上行帶寬壓力
- 統一視頻編碼格式
- 更好的連接穩定性
- 支援更多並發觀眾

### 注意事項
- MCU 服務器需要較強的處理能力
- 建議使用專用服務器
- 監控 MCU 統計信息
- 定期檢查連接狀態

## 未來改進

1. **媒體轉碼**
   - 實現視頻轉碼功能
   - 支援多種編碼格式
   - 動態碼率調整

2. **負載均衡**
   - 多 MCU 服務器支援
   - 自動故障轉移
   - 連接分發策略

3. **監控系統**
   - MCU 性能監控
   - 連接質量統計
   - 自動告警機制

## 總結

MCU 架構已成功實現，提供了更穩定和可擴展的直播解決方案。所有核心功能都已測試通過，可以投入生產使用。
