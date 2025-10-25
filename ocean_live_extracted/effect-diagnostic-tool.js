/* ==============================================
   🔍 主播頁面特效診斷與測試工具
   ============================================== */

console.log('%c🔍 特效診斷工具載入成功!', 'color: #00d9ff; font-size: 16px; font-weight: bold;');
console.log('%c使用方式: 在 Console 輸入 testEffect("特效名稱")', 'color: #ffd700;');
console.log('%c例如: testEffect("bw") 測試黑白特效', 'color: #ffd700;');

// 完整診斷函數
window.diagnoseEffects = function() {
    console.log('\n%c========== 🔍 特效系統完整診斷 ==========', 'color: #00d9ff; font-size: 14px; font-weight: bold;');
    
    // 1. 檢查視頻元素
    const video = document.getElementById('localVideo');
    console.log('\n%c1️⃣ 視頻元素檢查', 'color: #00ff00; font-weight: bold;');
    if (video) {
        console.log('✅ 視頻元素存在');
        console.log('   - 寬度:', video.offsetWidth + 'px');
        console.log('   - 高度:', video.offsetHeight + 'px');
        console.log('   - 顯示:', window.getComputedStyle(video).display);
        console.log('   - position:', window.getComputedStyle(video).position);
        console.log('   - z-index:', window.getComputedStyle(video).zIndex);
        console.log('   - 當前 filter:', video.style.filter || '(無)');
    } else {
        console.log('❌ 視頻元素不存在!');
        return;
    }
    
    // 2. 檢查視頻容器
    const container = video.parentElement;
    console.log('\n%c2️⃣ 視頻容器檢查', 'color: #00ff00; font-weight: bold;');
    if (container) {
        console.log('✅ 容器存在');
        console.log('   - 類名:', container.className);
        console.log('   - position:', window.getComputedStyle(container).position);
        console.log('   - overflow:', window.getComputedStyle(container).overflow);
        console.log('   - z-index:', window.getComputedStyle(container).zIndex);
    } else {
        console.log('❌ 容器不存在!');
    }
    
    // 3. 檢查特效函數
    console.log('\n%c3️⃣ 特效函數檢查', 'color: #00ff00; font-weight: bold;');
    const functions = {
        'applyEffect': typeof applyEffect === 'function',
        'applyNewEffect': typeof applyNewEffect === 'function',
        'clearEffect': typeof clearEffect === 'function',
        'createAnimationOverlay': typeof createAnimationOverlay === 'function',
        'broadcastEffectToViewers': typeof broadcastEffectToViewers === 'function'
    };
    Object.entries(functions).forEach(([name, exists]) => {
        console.log(exists ? `✅ ${name}` : `❌ ${name} 不存在`);
    });
    
    // 4. 檢查特效按鈕
    console.log('\n%c4️⃣ 特效按鈕檢查', 'color: #00ff00; font-weight: bold;');
    const buttons = document.querySelectorAll('.effect-btn');
    console.log(`找到 ${buttons.length} 個特效按鈕`);
    if (buttons.length > 0) {
        console.log('按鈕列表:');
        buttons.forEach((btn, i) => {
            const effect = btn.getAttribute('data-effect');
            console.log(`   ${i + 1}. ${effect}`);
        });
    }
    
    // 5. 檢查 CSS 動畫
    console.log('\n%c5️⃣ CSS 動畫檢查', 'color: #00ff00; font-weight: bold;');
    const testDiv = document.createElement('div');
    testDiv.style.animation = 'fall 1s linear';
    document.body.appendChild(testDiv);
    const hasAnimation = window.getComputedStyle(testDiv).animation !== '';
    document.body.removeChild(testDiv);
    console.log(hasAnimation ? '✅ @keyframes fall 動畫存在' : '❌ @keyframes fall 動畫不存在');
    
    // 6. 當前狀態
    console.log('\n%c6️⃣ 當前狀態', 'color: #00ff00; font-weight: bold;');
    console.log('   - currentEffect:', window.currentEffect || '(無)');
    console.log('   - 是否直播中:', window.isStreaming ? '是' : '否');
    
    console.log('\n%c========== 診斷完成 ==========\n', 'color: #00d9ff; font-size: 14px; font-weight: bold;');
};

// 快速測試函數
window.testEffect = function(effectType) {
    console.log(`\n%c🧪 測試特效: ${effectType}`, 'color: #ffd700; font-size: 14px; font-weight: bold;');
    
    const video = document.getElementById('localVideo');
    if (!video) {
        console.error('❌ 找不到視頻元素!');
        return;
    }
    
    const container = video.parentElement;
    
    // 清除舊特效
    video.style.filter = '';
    video.style.animation = '';
    container.classList.remove('effect-rainbow-border', 'effect-neon-border', 'effect-glow-border');
    document.querySelectorAll('.animation-overlay').forEach(el => el.remove());
    
    console.log('🧹 已清除舊特效');
    
    // 套用新特效
    switch(effectType) {
        case 'bw':
        case 'black-white':
            video.style.filter = 'grayscale(100%)';
            console.log('✅ 套用黑白特效');
            console.log('   filter:', video.style.filter);
            break;
            
        case 'warm':
            video.style.filter = 'sepia(0.8) saturate(1.5) hue-rotate(-20deg) brightness(1.1) contrast(1.1)';
            console.log('✅ 套用暖色調特效');
            console.log('   filter:', video.style.filter);
            break;
            
        case 'blur':
            video.style.filter = 'blur(8px)';
            console.log('✅ 套用模糊特效');
            break;
            
        case 'rainbow':
            video.style.filter = 'hue-rotate(0deg) saturate(2)';
            video.style.animation = 'rainbow-filter 3s linear infinite';
            console.log('✅ 套用彩虹濾鏡特效');
            break;
            
        case 'rainbowBorder':
        case 'rainbow-border':
            container.classList.add('effect-rainbow-border');
            console.log('✅ 套用彩虹邊框');
            console.log('   classes:', container.className);
            break;
            
        case 'neon':
            container.classList.add('effect-neon-border');
            console.log('✅ 套用霓虹邊框');
            break;
            
        case 'glow':
            container.classList.add('effect-glow-border');
            console.log('✅ 套用發光邊框');
            break;
            
        case 'particles':
        case 'stars':
            createTestAnimation('✨');
            console.log('✅ 套用星星動畫');
            break;
            
        case 'hearts':
            createTestAnimation('❤️');
            console.log('✅ 套用愛心動畫');
            break;
            
        case 'confetti':
            createTestAnimation('🎉');
            console.log('✅ 套用彩帶動畫');
            break;
            
        case 'snow':
            createTestAnimation('❄️');
            console.log('✅ 套用雪花動畫');
            break;
            
        default:
            console.warn('⚠️ 未知的特效類型:', effectType);
            console.log('可用特效: bw, warm, blur, rainbow, rainbowBorder, neon, glow, particles, hearts, confetti, snow');
    }
    
    // 驗證
    setTimeout(() => {
        console.log('\n%c🔍 驗證結果:', 'color: #00ff00;');
        console.log('   - 計算後的 filter:', window.getComputedStyle(video).filter);
        console.log('   - 容器 classes:', container.className);
        const overlay = document.querySelector('.animation-overlay');
        if (overlay) {
            console.log('   - 動畫元素數量:', overlay.children.length);
        }
    }, 200);
};

// 創建測試動畫
function createTestAnimation(symbol) {
    const video = document.getElementById('localVideo');
    const container = video.parentElement;
    
    // 移除舊動畫
    document.querySelectorAll('.animation-overlay').forEach(el => el.remove());
    
    // 創建新動畫層
    const overlay = document.createElement('div');
    overlay.className = 'animation-overlay';
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
        z-index: 10;
        border-radius: 15px;
    `;
    
    container.appendChild(overlay);
    
    // 創建 20 個動畫元素
    for (let i = 0; i < 20; i++) {
        const el = document.createElement('div');
        el.textContent = symbol;
        el.style.cssText = `
            position: absolute;
            font-size: ${Math.random() * 20 + 15}px;
            left: ${Math.random() * 100}%;
            top: -50px;
            animation: fall ${Math.random() * 3 + 2}s linear infinite;
            animation-delay: ${Math.random() * 2}s;
        `;
        overlay.appendChild(el);
    }
}

// 自動執行診斷
console.log('\n%c執行自動診斷...', 'color: #00d9ff;');
setTimeout(() => {
    if (typeof diagnoseEffects === 'function') {
        diagnoseEffects();
    }
}, 1000);

console.log('\n%c可用命令:', 'color: #ffd700; font-size: 14px;');
console.log('  diagnoseEffects()     - 完整系統診斷');
console.log('  testEffect("bw")      - 測試黑白特效');
console.log('  testEffect("warm")    - 測試暖色調特效');
console.log('  testEffect("rainbow") - 測試彩虹特效');
console.log('  testEffect("neon")    - 測試霓虹邊框');
console.log('  testEffect("particles") - 測試星星動畫');
console.log('  testEffect("hearts")  - 測試愛心動畫\n');
