# 🎵 觀眾重整後分頁音訊修復說明

## 問題描述
當主播啟用「分享分頁音訊給觀眾」功能後,**觀眾重整頁面(F5)會聽不到背景音樂**。

## 問題根源

### 原始流程
1. 主播啟用分頁音訊 → 創建混音音訊流
2. 使用 `updateAudioTracks()` 更新**現有觀眾**的音訊軌道
3. ❌ **但 `localStream` 沒有被更新**
4. 觀眾重整後重新加入 → 主播用 `localStream` 建立新連接
5. ❌ **`localStream` 中還是原始麥克風音訊,不是混音音訊**
6. **結果**: 觀眾聽不到背景音樂

### 問題示意圖
```
啟用分頁音訊時:
┌─────────────────┐
│  localStream    │  ← 原始麥克風音訊 (沒更新!)
│  (video + mic)  │
└─────────────────┘
         ↓
┌─────────────────┐
│ 混音音訊流建立   │  ← 混音 = 分頁音訊 + 麥克風
│ (tab + mic)     │
└─────────────────┘
         ↓
┌─────────────────┐
│ 更新現有觀眾的   │  ← 現有觀眾可以聽到
│ WebRTC 軌道     │
└─────────────────┘

觀眾重整後:
┌─────────────────┐
│  localStream    │  ← ❌ 還是原始麥克風音訊
│  (video + mic)  │
└─────────────────┘
         ↓
┌─────────────────┐
│ 為重整的觀眾    │  ← ❌ 只有麥克風音訊
│ 建立新連接      │     沒有背景音樂!
└─────────────────┘
```

## 修復方案

### 核心思路
**在啟用/停用分頁音訊時,同步更新 `localStream` 的音訊軌道**

這樣當觀眾重整後重新加入時,主播用更新後的 `localStream` 建立連接,觀眾就能聽到混音音訊。

### 修改內容

#### 1. 添加變數保存原始麥克風音訊 (`script.js`)
```javascript
// 分頁音訊相關變數
let tabAudioStream = null;
let isTabAudioEnabled = false;
let audioContext = null;
let mixedAudioStream = null;
let originalMicAudioTrack = null; // 🎵 新增:保存原始麥克風音訊軌道
```

#### 2. 修改 `updateAudioTracks()` 函數
```javascript
async function updateAudioTracks(newAudioStream) {
    // ... 原有代碼 ...
    
    // 🎵 關鍵修復:更新 localStream 的音訊軌道
    if (localStream) {
        // 保存原始麥克風音訊軌道(只在第一次啟用時保存)
        if (!originalMicAudioTrack && !isTabAudioEnabled) {
            const oldAudioTracks = localStream.getAudioTracks();
            if (oldAudioTracks.length > 0) {
                originalMicAudioTrack = oldAudioTracks[0];
                console.log('✅ 已保存原始麥克風音訊軌道');
            }
        }
        
        // 移除舊的音訊軌道
        const oldAudioTracks = localStream.getAudioTracks();
        oldAudioTracks.forEach(track => {
            localStream.removeTrack(track);
        });
        
        // 添加新的音訊軌道(混音或原始)
        localStream.addTrack(newAudioTrack);
        console.log('✅ 已更新 localStream 的音訊軌道');
    }
    
    // 更新所有現有觀眾的連接...
}
```

#### 3. 修改停用分頁音訊的邏輯
```javascript
// 停用分頁音訊時
// 🎵 恢復到原始麥克風音訊
if (originalMicAudioTrack && isStreaming) {
    console.log('🔄 恢復原始麥克風音訊軌道');
    
    // 創建包含原始麥克風音訊的流
    const originalMicStream = new MediaStream([originalMicAudioTrack]);
    await updateAudioTracks(originalMicStream);
    
    addMessage('系統', '✅ 背景音樂分享已停用，恢復為純麥克風音訊');
}
```

### 修復後的流程
```
啟用分頁音訊時:
┌─────────────────┐
│  localStream    │  ← 保存原始麥克風音訊
│  (video + mic)  │
└─────────────────┘
         ↓
┌─────────────────┐
│ 混音音訊流建立   │  ← 混音 = 分頁音訊 + 麥克風
│ (tab + mic)     │
└─────────────────┘
         ↓
┌─────────────────────────┐
│ 更新 localStream +      │  ← ✅ 關鍵修復!
│ 更新現有觀眾的 WebRTC   │
└─────────────────────────┘

觀眾重整後:
┌─────────────────┐
│  localStream    │  ← ✅ 已更新為混音音訊
│  (video + mix)  │
└─────────────────┘
         ↓
┌─────────────────┐
│ 為重整的觀眾    │  ← ✅ 包含混音音訊
│ 建立新連接      │     可以聽到背景音樂!
└─────────────────┘
```

## 測試步驟

### 1. 準備測試環境
- 主播端開始直播
- 觀眾A進入直播間(確認可以看到畫面和聽到聲音)

### 2. 啟用分頁音訊
- 主播在另一個分頁播放音樂(例如 YouTube)
- 主播點擊「🎵 分享分頁音訊給觀眾」按鈕
- 確認按鈕變為綠色並顯示 `🔊` 圖示
- **驗證**: 觀眾A可以聽到背景音樂

### 3. 測試觀眾重整
- 觀眾A按 **F5** 重整頁面
- 等待頁面重新載入和 WebRTC 連接建立(約3-5秒)
- **預期結果**: 
  - ✅ 觀眾可以看到直播畫面
  - ✅ 觀眾可以聽到主播聲音
  - ✅ **觀眾可以聽到背景音樂** (修復重點!)

### 4. 測試新觀眾加入
- 觀眾B在分頁音訊已啟用的情況下進入直播間
- **預期結果**: 
  - ✅ 觀眾B可以聽到背景音樂(不需要重整)

### 5. 測試停用分頁音訊
- 主播點擊按鈕停用分頁音訊
- **預期結果**: 
  - ✅ 所有觀眾只聽到麥克風聲音
  - ✅ 聽不到背景音樂

### 6. 測試重新啟用
- 主播再次啟用分頁音訊
- **預期結果**: 
  - ✅ 所有觀眾(包括重整過的)都能聽到背景音樂

## 技術細節

### localStream 的作用
`localStream` 是主播的本地媒體流,包含視訊和音訊軌道。當有新觀眾加入或觀眾重整時,主播會用 `localStream` 來建立 WebRTC 連接。

### 為什麼要保存 originalMicAudioTrack?
當啟用分頁音訊時,混音音訊軌道會替換 `localStream` 中的麥克風軌道。如果不保存原始軌道,停用分頁音訊時就無法恢復。

### 音訊軌道的生命週期
```
開始直播
  ↓
創建 localStream (麥克風音訊)
  ↓
保存 originalMicAudioTrack ← 第一次啟用分頁音訊時
  ↓
啟用分頁音訊
  ↓
localStream 音訊軌道 = 混音音訊
  ↓
停用分頁音訊
  ↓
localStream 音訊軌道 = originalMicAudioTrack (恢復)
```

## 日誌輸出

### 啟用分頁音訊時的日誌
```
更新WebRTC音訊軌道...
✅ 已保存原始麥克風音訊軌道: xxxxxxxx
已從 localStream 移除舊音訊軌道: xxxxxxxx
✅ 已更新 localStream 的音訊軌道: yyyyyyyy
已為觀眾 viewer_xxx 更新音訊軌道
🔄 音訊軌道已更新給所有觀眾
```

### 觀眾重整後重新加入的日誌(主播端)
```
觀眾加入: viewer_xxx
🔄 為觀眾 xxx 建立視訊連接...
本地串流軌道數量: 2
視訊軌道: 1, 音訊軌道: 1
✅ 已添加視訊軌道 0
✅ 已添加音訊軌道 0  ← 這個音訊軌道是混音後的
```

### 停用分頁音訊時的日誌
```
🔇 正在停用背景音樂分享...
🔄 恢復原始麥克風音訊軌道: xxxxxxxx
更新WebRTC音訊軌道...
已從 localStream 移除舊音訊軌道: yyyyyyyy
✅ 已更新 localStream 的音訊軌道: xxxxxxxx
✅ 背景音樂分享已停用，恢復為純麥克風音訊
```

## 相關檔案

- `script.js` - 主播端主程式(核心修復)
  - 變數定義: 第 26-30 行
  - `updateAudioTracks()`: 第 2512-2574 行
  - `toggleTabAudio()`: 第 2576-2688 行

## 注意事項

1. **不要停止 originalMicAudioTrack**
   - 這個軌道在停用分頁音訊時需要使用
   - 只有在結束直播時才停止

2. **確保 localStream 存在**
   - 所有音訊更新操作都需要檢查 `localStream` 是否存在

3. **音訊軌道的引用關係**
   ```
   originalMicAudioTrack → 永遠指向原始麥克風
   localStream.audioTrack → 可能是原始或混音
   mixedAudioStream.audioTrack → 混音後的音訊
   ```

## 成功標準

修復成功的判斷標準:
- ✅ 啟用分頁音訊後,現有觀眾可以聽到背景音樂
- ✅ 啟用分頁音訊後,**重整的觀眾**可以聽到背景音樂
- ✅ 啟用分頁音訊後,**新加入的觀眾**可以聽到背景音樂
- ✅ 停用分頁音訊後,所有觀眾恢復為只聽到麥克風聲音
- ✅ 重複啟用/停用不會出錯

## 更新日誌

**2025-10-25**
- ✅ 新增 `originalMicAudioTrack` 變數
- ✅ 修改 `updateAudioTracks()` 同步更新 `localStream`
- ✅ 修改停用邏輯使用保存的原始音訊軌道
- ✅ 修復觀眾重整後聽不到分頁音訊的問題
