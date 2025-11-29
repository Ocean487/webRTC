# Broadcaster Chat Redesign

本次更新重構主播端聊天室，解決原先無法穩定發送/接收訊息問題，提升可靠性與擴充性。

## 新增檔案
- `broadcaster-chat.js`: 模組化聊天室邏輯（自動重連 / 心跳 / 訊息佇列 / 清理 / 統一格式）

## 主要改善
1. 自動重連機制：指數退避 1s ~ 15s，狀態列顯示連線狀態。
2. 訊息暫存佇列：離線時輸入的訊息暫存，重連後自動送出。
3. 統一訊息格式：使用 `{ type:'broadcaster_chat_message', text, username, timestamp }`，伺服器轉為 `chat_message` 廣播。
4. 避免重複顯示：本地先行顯示主播訊息，伺服器 echo 不重複渲染。
5. 系統提示統一走 `addSystemMessage()`。
6. 安全處理：基本字元跳脫避免 XSS。
7. 心跳保活：20 秒送一次 `heartbeat`。
8. UI 增強：新增聊天室狀態列（連線 / 重試 / 失敗 / 中斷）。

## 修改內容
- `livestream_platform.html`：
  - 新增 chatStatusBar。
  - 將舊的 `sendMessage` / `handleEnter` 替換為 `BroadcasterChat` API。
  - 載入新腳本 `broadcaster-chat.js`。
- `server.js`：
  - 強化 `broadcaster_chat_message` 轉換，統一 `text` 欄位。

## 使用方式
- 主播輸入訊息按 Enter 或按送出按鈕。
- 斷線時仍可輸入，會顯示「訊息暫存佇列，等待重送」。
- 重新連線後自動送出未送成功訊息。

## 後續可加強（可選）
- 加入訊息送達狀態 (sent / delivered / failed)。
- 加入使用者自訂暱稱與頭像同步。
- 加入管理功能（刪除訊息 / 禁言觀眾）。
- 支援特殊格式（貼圖 / 超連結預覽 / @標記）。
- 支援多房間（roomId）。

如需再加入觀眾端模組化重構或訊息持久化（寫入資料庫）可以再告訴我。