// 音訊相關變數
let musicAudioContext; // 重命名以避免與script.js中的audioContext衝突
let musicAudioNode;
let streamDestination;
let youtubePlayer;
let musicAudioElement; // 新增：用於播放YouTube音訊的audio元素
let isMuted = false;
let currentVolume = 100; // 預設最大音量

// 初始化事件監聽
document.addEventListener('DOMContentLoaded', () => {
    // 初始化 YouTube API
    initYouTubeAPI();
    
    // 初始化音量控制
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        volumeSlider.value = currentVolume;
        volumeSlider.addEventListener('input', (e) => {
            setVolume(parseInt(e.target.value));
        });
    }
    
    // 初始化網址輸入框事件
    const urlInput = document.getElementById('youtube-url');
    if (urlInput) {
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loadYouTubeVideo();
            }
        });
    }
});

// 初始化音頻環境
function initAudioContext() {
    musicAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    streamDestination = musicAudioContext.createMediaStreamDestination();
}

// 初始化 YouTube API
function initYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    
    // 初始化音頻環境
    initAudioContext();
}

// YouTube API 準備就緒時調用
function onYouTubeIframeAPIReady() {
    youtubePlayer = new YT.Player('youtube-embed', {
        height: '200',
        width: '100%',
        playerVars: {
            'playsinline': 1,
            'controls': 1,
            'autoplay': 0, // 改為手動播放
            'mute': 0,     // 確保不靜音
            'rel': 0,
            'showinfo': 0,
            'modestbranding': 1,
            'fs': 1
        },
        events: {
            'onReady': onYouTubePlayerReady,
            'onStateChange': onYouTubePlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    console.log('YouTube播放器準備就緒');
    
    // 設置初始音量
    youtubePlayer.setVolume(currentVolume);
    if (!isMuted) {
        youtubePlayer.unMute();
    }
    
    showMusicStatus('🎵 YouTube播放器已初始化');
}

function onPlayerStateChange(event) {
    // 播放狀態改變時的回調
    const states = {
        '-1': '未開始',
        '0': '已結束', 
        '1': '播放中',
        '2': '已暫停',
        '3': '緩衝中',
        '5': '已提示'
    };
    
    const state = states[event.data] || '未知';
    console.log('YouTube播放器狀態:', state);
    
    // 不重新載入直播，讓YouTube音訊自然通過系統音效混入
    if (event.data === YT.PlayerState.PLAYING) {
        console.log('🎵 YouTube 音樂開始播放');
    } else if (event.data === YT.PlayerState.PAUSED) {
        console.log('⏸️ YouTube 音樂暫停');
    } else if (event.data === YT.PlayerState.ENDED) {
        console.log('🔄 YouTube 音樂播放結束');
    }
}

// 移除會重新載入直播的函數
// 音訊會通過Web Audio API自動混入直播流
function updateStreamAudio() {
    // 不再重新啟動整個直播流
    // 音訊混合已經在startStream中設置好了
    console.log('音訊更新 - 無需重新載入直播');
}

// 從 YouTube 網址提取影片 ID
function extractVideoId(url) {
    // 支援多種 YouTube 網址格式
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
        /youtu\.be\/([^&\n?#]+)/,
        /youtube\.com\/embed\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
}

// 載入 YouTube 影片（新的網址輸入功能）
function loadYouTubeVideo() {
    const urlInput = document.getElementById('youtube-url');
    const url = urlInput.value.trim();
    
    if (!url) {
        alert('請輸入 YouTube 影片網址');
        return;
    }
    
    // 提取影片 ID
    const videoId = extractVideoId(url);
    
    if (!videoId) {
        alert('無效的 YouTube 網址，請檢查格式');
        return;
    }
    
    // 自動在新視窗播放YouTube影片（不再詢問用戶）
    openYouTubeInNewWindow(videoId, url);
}

// 在新視窗中開啟YouTube
function openYouTubeInNewWindow(videoId, originalUrl) {
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}&autoplay=1`;
    
    // 開啟新視窗
    const newWindow = window.open(
        youtubeUrl,
        'YouTubePlayer',
        'width=800,height=600,scrollbars=yes,resizable=yes,menubar=no,toolbar=no,location=no,status=no'
    );
    
    if (newWindow) {
        console.log('YouTube 影片已在新視窗開啟:', youtubeUrl);
        showMusicStatus('✅ YouTube 已在新視窗開啟');
        
        // 顯示音訊分享提示
        setTimeout(() => {
            showAudioSharingInstructions();
        }, 2000);
    } else {
        alert('無法開啟新視窗，請檢查瀏覽器設定');
    }
}

// 顯示音訊分享指示
function showAudioSharingInstructions() {
    const instructions = `
🎵 音訊分享指示：

1. 點擊直播控制面板中的"開始直播"
2. 選擇"分享螢幕"或"分享視窗"
3. 在分享選項中勾選"分享音訊"
4. 選擇整個螢幕或YouTube視窗
5. 開始分享後，觀眾就能聽到YouTube音樂

注意：請確保YouTube視窗有播放音樂，並且系統音量適中。
    `;
    
    // 只顯示音訊分享指示，不再詢問詳細設定
    alert(instructions);
}

// 顯示詳細音訊設定
function showDetailedAudioSettings() {
    const settings = `
🔧 詳細音訊設定指南：

📱 瀏覽器設定：
• Chrome: 設定 → 隱私權和安全性 → 網站設定 → 攝影機/麥克風
• Firefox: 偏好設定 → 隱私權與安全性 → 權限
• Edge: 設定 → Cookie和網站權限 → 攝影機/麥克風

🔊 系統音量建議：
• 主播聲音 (麥克風): 70-80%
• 背景音樂 (YouTube): 60-70%
• 系統主音量: 50-60%

🎵 分享選項：
• ✅ 勾選 "分享音訊" (Share Audio)
• ✅ 選擇 "分享分頁" 或 "分享螢幕"
• ✅ 允許瀏覽器存取音訊權限

⚡ 疑難排解：
• 如果觀眾聽不到音樂：重新分享螢幕並確保勾選音訊
• 如果有回音：使用耳機或降低喇叭音量
• 如果聲音延遲：重新整理頁面後再試

需要更多協助嗎？請聯絡技術支援。
    `;
    
    alert(settings);
}

// 顯示音訊分享指南
function showAudioSharingGuide() {
    const guide = `
🎵 完整音訊分享步驟：

1️⃣ 播放背景音樂：
   • 輸入YouTube網址並載入
   • 選擇"在新視窗播放"
   • 確保音樂正常播放

2️⃣ 開始直播分享：
   • 點擊"開始直播"按鈕
   • 選擇"分享螢幕"
   • ⚠️ 重要：勾選"分享音訊"選項
   • 選擇包含YouTube的螢幕或視窗

3️⃣ 音量調整：
   • YouTube音量：70-80%
   • 系統音量：50-70%
   • 建議使用耳機避免回音

是否要立即開始設定？
    `;
    
    if (confirm(guide)) {
        // 自動執行音訊設定流程
        startAudioSetupFlow();
    }
}

// 音訊設定流程
function startAudioSetupFlow() {
    // 步驟1：檢查是否有YouTube網址
    const urlInput = document.getElementById('youtube-url');
    if (!urlInput.value.trim()) {
        alert('請先輸入YouTube影片網址！');
        urlInput.focus();
        return;
    }
    
    // 步驟2：載入音樂
    if (confirm('步驟1：載入背景音樂\n\n點擊確定載入YouTube影片')) {
        loadYouTubeVideo();
        
        // 步驟3：提醒開始直播
        setTimeout(() => {
            if (confirm('步驟2：開始直播\n\n音樂載入完成後，點擊確定查看直播設定')) {
                showLiveStreamAudioInstructions();
            }
        }, 3000);
    }
}

// 直播音訊設定說明
function showLiveStreamAudioInstructions() {
    const instructions = `
🔴 直播音訊設定：

現在請按照以下步驟開始直播：

1. 點擊"開始直播"按鈕 ▶️
2. 選擇"分享螢幕"或"分享視窗"
3. 🔊 重要：勾選"分享音訊"選項
4. 選擇包含YouTube播放的螢幕
5. 開始分享

完成後觀眾就能聽到背景音樂了！

需要測試音訊效果嗎？
    `;
    
    if (confirm(instructions)) {
        // 可以添加音訊測試功能
        testAudioOutput();
    }
}

// 測試音訊輸出
function testAudioOutput() {
    alert('🎧 音訊測試提示：\n\n1. 請觀察YouTube視窗是否正常播放\n2. 檢查系統音量是否適中\n3. 如果使用耳機，確保沒有回音\n4. 建議先在測試環境中驗證效果');
}

// 在當前頁面播放（原有功能）
function loadYouTubeInCurrentPage(videoId) {
    if (youtubePlayer && youtubePlayer.loadVideoById) {
        try {
            youtubePlayer.loadVideoById({
                videoId: videoId,
                startSeconds: 0,
                suggestedQuality: 'default'
            });
            
            // 等待播放器載入後開啟音訊
            setTimeout(() => {
                if (!isMuted) {
                    youtubePlayer.unMute();
                    youtubePlayer.setVolume(currentVolume);
                }
                youtubePlayer.playVideo();
                console.log('YouTube 影片已載入並開始播放:', videoId);
                
                // 顯示成功訊息
                showMusicStatus('✅ 音樂已載入並開始播放');
            }, 1000);
            
        } catch (error) {
            console.error('載入影片失敗:', error);
            alert('載入影片失敗，請稍後再試');
        }
    } else {
        alert('YouTube 播放器尚未準備就緒，請稍後再試');
    }
}

// 創建audio元素來播放YouTube音訊
function createAudioElementForYouTube(videoId) {
    // 移除舊的音訊元素
    if (musicAudioElement) {
        musicAudioElement.pause();
        musicAudioElement.remove();
        if (musicAudioNode) {
            musicAudioNode.disconnect();
        }
    }
    
    // 創建新的audio元素
    musicAudioElement = document.createElement('audio');
    musicAudioElement.crossOrigin = 'anonymous';
    musicAudioElement.loop = false;
    musicAudioElement.volume = currentVolume / 100;
    
    // 使用YouTube的音訊URL（注意：這可能受到CORS限制）
    // 作為替代方案，我們使用系統音效混合
    console.log('注意：由於YouTube的CORS限制，音訊將通過系統音效混入直播');
    console.log('請確保您的系統音效設置正確，讓直播軟體能夠捕獲系統音效');
    
    // 如果有音訊上下文，嘗試連接
    if (musicAudioContext && streamDestination) {
        try {
            // 注意：由於瀏覽器安全限制，這個方法可能不工作
            // musicAudioNode = musicAudioContext.createMediaElementSource(musicAudioElement);
            // musicAudioNode.connect(streamDestination);
            // musicAudioNode.connect(musicAudioContext.destination);
            
            console.log('音訊將通過YouTube播放器的系統音效傳入');
        } catch (error) {
            console.log('音訊連接限制:', error);
        }
    }
}

// 載入指定的影片 ID（保留原有功能）
function loadVideo(videoId) {
    if (videoId && youtubePlayer) {
        youtubePlayer.loadVideoById({
            videoId: videoId,
            startSeconds: 0,
            suggestedQuality: 'default'
        });
        youtubePlayer.setVolume(currentVolume);
        if (!isMuted) {
            youtubePlayer.unMute();
        }
    }
}

// 切換靜音
function toggleMute() {
    isMuted = !isMuted;
    
    if (youtubePlayer) {
        if (isMuted) {
            youtubePlayer.mute();
        } else {
            youtubePlayer.unMute();
            youtubePlayer.setVolume(currentVolume);
        }
    }
    
    // 也控制audio元素（如果存在）
    if (musicAudioElement) {
        musicAudioElement.muted = isMuted;
    }
    
    const muteButton = document.getElementById('muteButton');
    if (muteButton) {
        muteButton.textContent = isMuted ? '🔇' : '🔊';
    }
    
    console.log('音樂', isMuted ? '靜音' : '取消靜音');
}

// 設置音量
function setVolume(value) {
    currentVolume = value;
    
    if (youtubePlayer && !isMuted) {
        youtubePlayer.setVolume(currentVolume);
    }
    
    // 也設置audio元素音量（如果存在）
    if (musicAudioElement) {
        musicAudioElement.volume = currentVolume / 100;
    }
    
    console.log('音樂音量設為:', currentVolume + '%');
}

// 獲取混合音頻流（包含麥克風和YouTube音頻）
function getMixedAudioStream() {
    if (!musicAudioContext || !streamDestination) {
        return null;
    }
    
    return streamDestination.stream;
}

// 示例 YouTube 網址（用於測試）
function loadExampleVideo() {
    const urlInput = document.getElementById('youtube-url');
    if (urlInput) {
        urlInput.value = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // 示例網址
        loadYouTubeVideo();
    }
}

// 音訊設置說明
function showAudioSetupInfo() {
    alert(`🎵 YouTube音訊設置說明：

1. 播放YouTube影片後，音訊會通過您的系統喇叭播放
2. 如果使用OBS等直播軟體，請設置為「桌面音訊」或「系統音效」
3. 確保瀏覽器和系統音量都已開啟
4. 建議使用耳機避免音訊回授

注意：由於瀏覽器安全限制，無法直接擷取YouTube的音訊流，
所以需要通過系統音效的方式混入直播中。`);
}

// 在頁面載入時顯示音訊設置提示

// 顯示音樂狀態
function showMusicStatus(message) {
    // 在music panel上顯示狀態
    const embedDiv = document.getElementById('youtube-embed');
    if (embedDiv) {
        let statusDiv = document.getElementById('music-status');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'music-status';
            statusDiv.style.cssText = `
                background: #e3f2fd;
                padding: 8px 12px;
                margin: 8px 0;
                border-radius: 6px;
                font-size: 0.8rem;
                color: #1565c0;
                border-left: 3px solid #2196f3;
            `;
            embedDiv.parentNode.insertBefore(statusDiv, embedDiv.nextSibling);
        }
        statusDiv.textContent = message;
        
        // 3秒後自動隱藏狀態
        setTimeout(() => {
            if (statusDiv && statusDiv.parentNode) {
                statusDiv.style.opacity = '0.5';
            }
        }, 3000);
    }
}

// 改進的音量控制
function setVolume(value) {
    currentVolume = value;
    
    if (youtubePlayer && !isMuted) {
        youtubePlayer.setVolume(currentVolume);
        showMusicStatus(`🔊 音量調整為 ${currentVolume}%`);
    }
    
    // 也設置audio元素音量（如果存在）
    if (musicAudioElement) {
        musicAudioElement.volume = currentVolume / 100;
    }
    
    console.log('音樂音量設為:', currentVolume + '%');
}

// 改進的切換靜音功能
function toggleMute() {
    isMuted = !isMuted;
    const muteButton = document.getElementById('muteButton');
    
    if (youtubePlayer) {
        if (isMuted) {
            youtubePlayer.mute();
            if (muteButton) {
                muteButton.innerHTML = '<i class="fas fa-volume-mute"></i>';
            }
            showMusicStatus('🔇 音樂已靜音');
        } else {
            youtubePlayer.unMute();
            youtubePlayer.setVolume(currentVolume);
            if (muteButton) {
                muteButton.innerHTML = '<i class="fas fa-volume-up"></i>';
            }
            showMusicStatus('🔊 音樂已取消靜音');
        }
    }
    
    // 也控制audio元素（如果存在）
    if (musicAudioElement) {
        musicAudioElement.muted = isMuted;
    }
    
    console.log('音樂靜音狀態:', isMuted);
}

// 音樂控制按鈕功能
function pauseMusic() {
    if (youtubePlayer && youtubePlayer.pauseVideo) {
        youtubePlayer.pauseVideo();
        showMusicStatus('⏸️ 音樂已暫停');
    }
}

function playMusic() {
    if (youtubePlayer && youtubePlayer.playVideo) {
        youtubePlayer.playVideo();
        showMusicStatus('▶️ 音樂已播放');
    }
}

function stopMusic() {
    if (youtubePlayer && youtubePlayer.stopVideo) {
        youtubePlayer.stopVideo();
        showMusicStatus('⏹️ 音樂已停止');
    }
}

// YouTube播放器事件處理
function onYouTubePlayerReady(event) {
    console.log('YouTube播放器準備完成');
    showMusicStatus('🎵 YouTube播放器已準備就緒');
    
    // 設置初始音量
    if (!isMuted) {
        event.target.setVolume(currentVolume);
    }
}

function onYouTubePlayerStateChange(event) {
    const states = {
        '-1': '未開始',
        '0': '已結束',
        '1': '播放中',
        '2': '已暫停',
        '3': '緩衝中',
        '5': '已提示'
    };
    
    const state = states[event.data] || '未知';
    console.log('YouTube播放器狀態:', state);
    
    if (event.data === 1) { // 播放中
        showMusicStatus('🎵 音樂播放中');
    } else if (event.data === 2) { // 暫停
        showMusicStatus('⏸️ 音樂已暫停');
    } else if (event.data === 0) { // 結束
        showMusicStatus('🔄 音樂播放完畢');
    }
}

// 設定YouTube播放器的音訊輸出
async function setYouTubeAudioOutput(deviceId) {
    try {
        // 如果沒有指定設備ID，使用預設設備
        if (!deviceId || deviceId === '') {
            console.log('使用預設音訊輸出設備');
            return;
        }
        
        if (youtubePlayer && youtubePlayer.getIframe) {
            const iframe = youtubePlayer.getIframe();
            if (iframe && iframe.setSinkId) {
                await iframe.setSinkId(deviceId);
                showMusicStatus('🔊 背景音樂音訊輸出已切換');
                console.log('YouTube播放器音訊輸出已切換至:', deviceId);
            } else {
                console.log('YouTube iframe不支援setSinkId');
            }
        }
    } catch (error) {
        console.error('設定YouTube音訊輸出失敗:', error);
        showMusicStatus('⚠️ 音訊輸出切換失敗，使用預設設備');
    }
}

// 監聽音訊輸出變更
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 音樂播放器已載入');
    console.log('💡 提示：YouTube音訊將通過系統音效混入直播');
    
    // 監聽音訊輸出選擇變更
    const audioOutputSelect = document.getElementById('audioOutputSelect');
    if (audioOutputSelect) {
        audioOutputSelect.addEventListener('change', function() {
            setYouTubeAudioOutput(this.value);
        });
    }
});
