// 觀眾端特效處理
console.log('🎨 載入觀眾端特效處理模組...');

// 觀眾端特效應用函數
function applyViewerEffect(effectType) {
    const remoteVideo = document.getElementById('remoteVideo');
    if (!remoteVideo) {
        console.warn('找不到遠程視頻元素');
        return;
    }

    const videoContainer = remoteVideo.parentElement;

    // 清除現有特效
    resetViewerEffectStyles(remoteVideo);

    if (effectType === 'clear') {
        console.log('🧹 清除所有特效');
        return;
    }

    console.log(`🎨 應用特效: ${effectType}`);

    // 應用特效
    switch (effectType) {
        case 'blur':
            remoteVideo.style.filter = 'blur(8px)';
            break;
        case 'rainbow':
            remoteVideo.style.filter = 'hue-rotate(0deg) saturate(2)';
            remoteVideo.style.animation = 'rainbow-filter 3s linear infinite';
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
            remoteVideo.style.filter = 'sepia(0.8) saturate(1.5) hue-rotate(-20deg) brightness(1.1) contrast(1.1)';
            break;
        case 'invert':
            remoteVideo.style.filter = 'invert(1) hue-rotate(180deg)';
            break;
        case 'rainbowBorder':
            if (videoContainer) {
                videoContainer.classList.add('effect-rainbow-border');
            }
            break;
        case 'neon':
            remoteVideo.style.filter = 'contrast(1.2) saturate(1.3)';
            if (videoContainer) {
                videoContainer.classList.add('effect-neon-border');
            }
            break;
        case 'glow':
            if (videoContainer) {
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
}

function resetViewerEffectStyles(videoElement) {
    if (!videoElement) return;

    videoElement.style.filter = '';
    videoElement.style.webkitFilter = '';
    videoElement.style.animation = '';

    const container = videoElement.parentElement;
    if (container) {
        container.classList.remove('effect-neon-border', 'effect-glow-border', 'effect-rainbow-border');
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
