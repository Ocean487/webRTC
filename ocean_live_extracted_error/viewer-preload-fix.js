// 觀眾頁面預載入修復 - 防止等待文字閃爍
// 此腳本需要在 HTML 解析時立即執行

(function() {
    'use strict';
    
    console.log('🔧 觀眾頁面預載入修復啟動...');
    
    // 立即隱藏可能造成閃爍的元素
    function hideFlickerElements() {
        // 添加 CSS 規則來立即隱藏 HTML 占位符
        const style = document.createElement('style');
        style.id = 'preload-fix-style';
        style.textContent = `
            /* 立即隱藏 HTML 占位符防止閃爍 */
            #videoPlaceholder {
                display: none !important;
                visibility: hidden !important;
            }
            
            #videoPlaceholder h3,
            #videoPlaceholder p {
                display: none !important;
                visibility: hidden !important;
            }
            
            /* 完全隱藏視頻元素防止控制條閃爍 */
            #remoteVideo {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                position: absolute !important;
                top: -9999px !important;
                left: -9999px !important;
            }
            
            /* 確保載入動畫不顯示 */
            .loading-animation {
                display: none !important;
            }
            
            /* 隱藏播放提示按鈕 - 自動播放不需要用戶點擊 */
            .play-prompt,
            #playPrompt {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            
            /* 確保等待文字只在適當時機顯示 */
            .stream-video {
                background: #000000 !important;
            }
        `;
        
        // 盡快插入樣式
        if (document.head) {
            document.head.appendChild(style);
        } else {
            // 如果 head 還沒準備好，等 DOM 開始載入
            document.addEventListener('DOMContentLoaded', function() {
                if (!document.getElementById('preload-fix-style')) {
                    document.head.appendChild(style);
                }
            });
        }
        
        console.log('✅ 預載入樣式已插入，防止閃爍');
    }
    
    // 監聽 DOM 變化，立即隱藏問題元素
    function setupMutationObserver() {
        if (typeof MutationObserver === 'undefined') {
            return; // 舊瀏覽器不支援
        }
        
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 立即隱藏 videoPlaceholder
                            if (node.id === 'videoPlaceholder') {
                                node.style.display = 'none';
                                node.style.visibility = 'hidden';
                                console.log('🔧 立即隱藏了 videoPlaceholder');
                            }
                            
                            // 立即隱藏 remoteVideo
                            if (node.id === 'remoteVideo') {
                                node.style.display = 'none';
                                node.style.visibility = 'hidden';
                                node.style.opacity = '0';
                                node.style.position = 'absolute';
                                node.style.top = '-9999px';
                                node.style.left = '-9999px';
                                console.log('🔧 立即隱藏了 remoteVideo');
                            }
                            
                            // 立即隱藏播放提示
                            if (node.id === 'playPrompt' || node.classList.contains('play-prompt')) {
                                node.style.display = 'none';
                                node.style.visibility = 'hidden';
                                node.style.opacity = '0';
                                node.style.pointerEvents = 'none';
                                console.log('🔧 立即隱藏了播放提示');
                            }
                            
                            // 檢查子元素
                            const placeholder = node.querySelector('#videoPlaceholder');
                            if (placeholder) {
                                placeholder.style.display = 'none';
                                placeholder.style.visibility = 'hidden';
                                console.log('🔧 立即隱藏了子元素 videoPlaceholder');
                            }
                            
                            const remoteVideo = node.querySelector('#remoteVideo');
                            if (remoteVideo) {
                                remoteVideo.style.display = 'none';
                                remoteVideo.style.visibility = 'hidden';
                                remoteVideo.style.opacity = '0';
                                remoteVideo.style.position = 'absolute';
                                remoteVideo.style.top = '-9999px';
                                remoteVideo.style.left = '-9999px';
                                console.log('🔧 立即隱藏了子元素 remoteVideo');
                            }
                            
                            const playPrompt = node.querySelector('#playPrompt, .play-prompt');
                            if (playPrompt) {
                                playPrompt.style.display = 'none';
                                playPrompt.style.visibility = 'hidden';
                                playPrompt.style.opacity = '0';
                                playPrompt.style.pointerEvents = 'none';
                                console.log('🔧 立即隱藏了子元素播放提示');
                            }
                        }
                    });
                }
            });
        });
        
        // 開始觀察
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
        
        // 5 秒後停止觀察（節省資源）
        setTimeout(() => {
            observer.disconnect();
            console.log('🔧 停止 DOM 變化觀察');
        }, 5000);
        
        console.log('✅ DOM 變化觀察器已啟動');
    }
    
    // 主初始化函數
    function init() {
        hideFlickerElements();
        setupMutationObserver();
        
        // 當 DOM 準備好時，確保元素被正確隱藏
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(function() {
                    const placeholder = document.getElementById('videoPlaceholder');
                    if (placeholder) {
                        placeholder.style.display = 'none';
                        placeholder.style.visibility = 'hidden';
                        console.log('🔧 DOMContentLoaded 後確認隱藏 videoPlaceholder');
                    }
                    
                    const remoteVideo = document.getElementById('remoteVideo');
                    if (remoteVideo) {
                        remoteVideo.style.display = 'none';
                        remoteVideo.style.visibility = 'hidden';
                        remoteVideo.style.opacity = '0';
                        remoteVideo.style.position = 'absolute';
                        remoteVideo.style.top = '-9999px';
                        remoteVideo.style.left = '-9999px';
                        console.log('🔧 DOMContentLoaded 後確認隱藏 remoteVideo');
                    }
                }, 10); // 短暫延遲確保其他腳本執行完
            });
        } else {
            // DOM 已經載入完成
            setTimeout(function() {
                const placeholder = document.getElementById('videoPlaceholder');
                if (placeholder) {
                    placeholder.style.display = 'none';
                    placeholder.style.visibility = 'hidden';
                    console.log('🔧 立即確認隱藏 videoPlaceholder');
                }
                
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteVideo) {
                    remoteVideo.style.display = 'none';
                    remoteVideo.style.visibility = 'hidden';
                    remoteVideo.style.opacity = '0';
                    remoteVideo.style.position = 'absolute';
                    remoteVideo.style.top = '-9999px';
                    remoteVideo.style.left = '-9999px';
                    console.log('🔧 立即確認隱藏 remoteVideo');
                }
            }, 10);
        }
        
        console.log('✅ 觀眾頁面預載入修復初始化完成');
    }
    
    // 立即執行
    init();
    
})();

console.log('🔧 觀眾頁面預載入修復腳本已載入');
