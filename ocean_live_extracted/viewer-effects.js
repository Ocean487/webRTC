// 觀眾端特效處理
console.log('🎨 載入觀眾端特效處理模組...');

// 記錄當前特效狀態，避免重複清除造成閃爍
let currentViewerEffect = 'clear';
const overlayEffects = new Set(['particles', 'hearts', 'confetti', 'snow']);

// 重新啟動彩虹濾鏡動畫
function restartRainbowFilterAnimation(videoElement) {
    if (!videoElement) return;

    const videoContainer = videoElement.closest('.stream-video') || document.getElementById('streamVideo');
    
    if (videoContainer) {
        ensureRainbowOverlayLayers(videoContainer);
        // 移除並重新添加類別以重啟漸層動畫
        videoContainer.classList.remove('effect-rainbow-filter');
        void videoContainer.offsetHeight; // 觸發重排
        videoContainer.classList.add('effect-rainbow-filter');
        console.log('✅ 漸變彩虹覆蓋層已套用到容器');
    } else {
        console.warn('⚠️ 找不到視頻容器，改為在父層創建覆蓋層');
        const fallbackContainer = videoElement.parentElement;
        if (fallbackContainer) {
            ensureRainbowOverlayLayers(fallbackContainer);
            fallbackContainer.classList.remove('effect-rainbow-filter');
            void fallbackContainer.offsetHeight;
            fallbackContainer.classList.add('effect-rainbow-filter');
        }
    }
}

function ensureRainbowOverlayLayers(container) {
    if (!container) return;

    let gradientLayer = container.querySelector('.rainbow-gradient-layer');
    if (!gradientLayer) {
        gradientLayer = document.createElement('div');
        gradientLayer.className = 'rainbow-gradient-layer';
        container.appendChild(gradientLayer);
    }

    let glowLayer = container.querySelector('.rainbow-glow-layer');
    if (!glowLayer) {
        glowLayer = document.createElement('div');
        glowLayer.className = 'rainbow-glow-layer';
        container.appendChild(glowLayer);
    }
}

function removeRainbowOverlayLayers(container) {
    if (!container) return;
    const gradientLayer = container.querySelector('.rainbow-gradient-layer');
    if (gradientLayer) {
        gradientLayer.remove();
    }
    const glowLayer = container.querySelector('.rainbow-glow-layer');
    if (glowLayer) {
        glowLayer.remove();
    }
}

// 嘗試確保影片在套用特效後保持播放
function ensureRemoteVideoPlaying(videoElement) {
    if (!videoElement || !videoElement.srcObject) return;
    if (!videoElement.paused) {
        console.log('✅ 影片正在播放中');
        return;
    }

    console.log('🔁 應用特效後影片偵測為暫停，嘗試恢復播放');
    const originalMuted = videoElement.muted;
    let retryCount = 0;
    const maxRetries = 3;

    const tryPlay = (muteBeforePlay) => {
        if (muteBeforePlay) {
            videoElement.muted = true;
        }

        const playPromise = videoElement.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise.then(() => {
                console.log('✅ 影片播放已恢復');
                if (!muteBeforePlay) {
                    videoElement.muted = originalMuted;
                } else if (!originalMuted) {
                    // 如果原本未靜音，嘗試恢復音量
                    setTimeout(() => {
                        videoElement.muted = false;
                    }, 100);
                }
            }).catch(error => {
                console.warn('⚠️ 嘗試播放失敗:', error.message);
                retryCount++;
                
                if (!muteBeforePlay && retryCount < maxRetries) {
                    // 第二次嘗試使用靜音播放，以符合瀏覽器自動播放政策
                    console.log('🔁 嘗試靜音播放...');
                    tryPlay(true);
                } else if (retryCount < maxRetries) {
                    // 延遲重試
                    console.log(`🔁 延遲 500ms 後重試 (${retryCount}/${maxRetries})...`);
                    setTimeout(() => tryPlay(true), 500);
                } else {
                    console.error('❌ 播放重試次數已達上限，顯示手動播放提示');
                }
            });
        }
    };

    tryPlay(false);
}

// 觀眾端特效應用函數
function applyViewerEffect(effectType) {
    const remoteVideo = document.getElementById('remoteVideo');
    if (!remoteVideo) {
        console.error('❌ 找不到遠程視頻元素 #remoteVideo');
        return;
    }

    // 使用正確的容器選擇器
    const videoContainer = document.getElementById('streamVideo');
    
    if (!videoContainer) {
        console.error('❌ 找不到視頻容器 #streamVideo');
        return;
    }
    
    console.log('🔍 [DEBUG] 視頻元素狀態:', {
        id: remoteVideo.id,
        display: remoteVideo.style.display,
        computedDisplay: window.getComputedStyle(remoteVideo).display,
        visibility: window.getComputedStyle(remoteVideo).visibility,
        opacity: window.getComputedStyle(remoteVideo).opacity,
        className: remoteVideo.className
    });
    
    console.log('🔍 [DEBUG] 視頻容器狀態:', {
        id: videoContainer.id,
        className: videoContainer.className,
        hasLiveClass: videoContainer.classList.contains('live'),
        overflow: window.getComputedStyle(videoContainer).overflow,
        isolation: window.getComputedStyle(videoContainer).isolation
    });

    if (effectType === 'clear') {
        if (currentViewerEffect !== 'clear') {
            resetViewerEffectStyles(remoteVideo, videoContainer);
            currentViewerEffect = 'clear';
            delete remoteVideo.dataset.viewerEffect;
            console.log('🧹 清除所有特效');
        } else {
            console.log('ℹ️ 已處於無特效狀態，略過重複清除');
        }
        return;
    }

    // 避免重複清除導致閃爍，針對需要重新啟動的特效做個別處理
    if (effectType === currentViewerEffect) {
        if (effectType === 'rainbow') {
            console.log('🔁 重新啟動彩虹濾鏡動畫');
            restartRainbowFilterAnimation(remoteVideo);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (overlayEffects.has(effectType)) {
            console.log('🔁 重新啟動動畫覆蓋層效果');
            createViewerAnimationOverlay(effectType);
            ensureRemoteVideoPlaying(remoteVideo);
        } else {
            console.log('ℹ️ 特效未變更，保持現狀');
        }
        return;
    }

    // 先移除前一個特效，確保狀態乾淨
    resetViewerEffectStyles(remoteVideo, videoContainer);

    console.log(`🎨 應用特效: ${effectType}`);

    // 應用特效
    switch (effectType) {
        case 'blur':
            remoteVideo.style.filter = 'blur(8px)';
            break;
        case 'rainbow':
            restartRainbowFilterAnimation(remoteVideo);
            console.log('✅ 漸變彩虹覆蓋層已應用');
            console.log('   - 視頻類別:', remoteVideo.className);
            console.log('   - 容器類別:', videoContainer ? videoContainer.className : 'N/A');
            break;
        case 'bw':
            remoteVideo.style.filter = 'grayscale(100%)';
            remoteVideo.style.webkitFilter = 'grayscale(100%)';
            break;
        case 'sepia':
            remoteVideo.style.filter = 'sepia(100%)';
            break;
        case 'bright':
            remoteVideo.style.filter = 'brightness(1.15) contrast(0.95) saturate(1.1)';
            break;
        case 'warm':
            remoteVideo.style.filter = 'sepia(1) saturate(2.2) hue-rotate(-35deg) brightness(1.08) contrast(1.12)';
            break;
        case 'invert':
            remoteVideo.style.filter = 'invert(1) hue-rotate(180deg)';
            break;
        case 'rainbowBorder':
            if (videoContainer) {
                videoContainer.classList.add('effect-rainbow-border');
                console.log('✅ 彩虹邊框已應用到容器');
                console.log('   - 容器類別:', videoContainer.className);
                console.log('   - 容器樣式 overflow:', window.getComputedStyle(videoContainer).overflow);
                console.log('   - 容器樣式 isolation:', window.getComputedStyle(videoContainer).isolation);
            }
            break;
        case 'neon':
            if (videoContainer) {
                videoContainer.classList.add('effect-neon-border');
                console.log('✅ 霓虹邊框已應用到容器');
                console.log('   - 容器類別:', videoContainer.className);
                console.log('   - 容器樣式 overflow:', window.getComputedStyle(videoContainer).overflow);
                console.log('   - 容器樣式 isolation:', window.getComputedStyle(videoContainer).isolation);
            }
            break;
        case 'glow':
            if (videoContainer) {
                ensureLightningBorderOverlay(videoContainer);
                videoContainer.classList.add('effect-glow-border');
            }
            break;
        case 'glasses':
            showViewerGlassesOverlay(remoteVideo);
            break;
        case 'particles':
            createViewerAnimationOverlay('particles');
            break;
        case 'hearts':
            createViewerAnimationOverlay('hearts');
            break;
        case 'confetti':
            createViewerAnimationOverlay('confetti');
            break;
        case 'snow':
        createViewerAnimationOverlay('snow');
            break;
    }

    currentViewerEffect = effectType;
    remoteVideo.dataset.viewerEffect = effectType;
    ensureRemoteVideoPlaying(remoteVideo);
}

function resetViewerEffectStyles(videoElement, videoContainer) {
    if (!videoElement) return;

    // 清除所有濾鏡和動畫
    videoElement.style.removeProperty('filter');
    videoElement.style.removeProperty('-webkit-filter');
    videoElement.style.removeProperty('animation');
    videoElement.style.removeProperty('-webkit-animation');
    videoElement.classList.remove('effect-rainbow-filter');
    currentViewerEffect = 'clear';
    delete videoElement.dataset.viewerEffect;

    console.log('🧹 已清除視頻元素的所有特效');

    // 使用傳入的容器或查找容器
    const container = videoContainer || document.getElementById('streamVideo') || videoElement.parentElement;
    if (container) {
        container.classList.remove('effect-neon-border', 'effect-glow-border', 'effect-rainbow-border', 'effect-rainbow-filter');
        removeLightningBorderOverlay(container);
        removeRainbowOverlayLayers(container);
        console.log('🧹 已清除容器的所有邊框特效和彩色分離');
    }

    // 移除眼鏡覆蓋層
    const glassesOverlay = container?.querySelector('.glasses-overlay');
    if (glassesOverlay) {
        glassesOverlay.remove();
    }

    // 移除動畫覆蓋層
    const animationOverlay = container?.querySelector('.animation-overlay');
    if (animationOverlay) {
        animationOverlay.remove();
    }
}

function ensureLightningBorderOverlay(container) {
    if (!container) return;
    if (container.querySelector('.lightning-border-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'lightning-border-overlay';
    overlay.innerHTML = `
        <div class="lightning-layer border-outer"></div>
        <div class="lightning-layer main-card"></div>
        <div class="lightning-layer glow-layer-1"></div>
        <div class="lightning-layer glow-layer-2"></div>
        <div class="lightning-layer overlay-1"></div>
        <div class="lightning-layer overlay-2"></div>
        <div class="lightning-layer background-glow"></div>
    `;
    container.appendChild(overlay);
}

function removeLightningBorderOverlay(container) {
    const overlay = container?.querySelector('.lightning-border-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function showViewerGlassesOverlay(videoElement) {
    const container = videoElement?.parentElement;
    if (!container) return;
    if (container.querySelector('.glasses-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'glasses-overlay';
    overlay.innerHTML = `
        <div class="glasses-lens left"><span class="glasses-glint"></span></div>
        <div class="glasses-bridge"></div>
        <div class="glasses-lens right"><span class="glasses-glint"></span></div>`;
    container.appendChild(overlay);
}

function createViewerAnimationOverlay(type) {
    const remoteVideo = document.getElementById('remoteVideo');
    const videoContainer = remoteVideo?.parentElement;
    if (!videoContainer) return;

    // 移除現有的動畫覆蓋層
    const existing = videoContainer.querySelector('.animation-overlay');
    if (existing) {
        existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = `animation-overlay ${type}`;
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
        z-index: 10;
    `;

    videoContainer.appendChild(overlay);

    // 創建動畫元素
    for (let i = 0; i < 20; i++) {
        createViewerAnimationElement(overlay, type);
    }

    // 10秒後自動移除
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.remove();
        }
    }, 10000);
}

function createViewerAnimationElement(container, type) {
    const element = document.createElement('div');
    const symbols = {
        'particles': '✨',
        'hearts': '❤️',
        'confetti': '🎉',
        'snow': '❄️'
    };

    element.textContent = symbols[type] || '✨';
    element.style.cssText = `
        position: absolute;
        font-size: ${Math.random() * 20 + 15}px;
        left: ${Math.random() * 100}%;
        top: -50px;
        animation: fall ${Math.random() * 3 + 2}s linear infinite;
        animation-delay: ${Math.random() * 2}s;
    `;

    container.appendChild(element);
}

console.log('✅ 觀眾端特效處理模組已載入');
