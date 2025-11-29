// 視頻特效處理系統 - 基於 WebRTC 教學和 Webcam Toy 概念
class VideoEffectsProcessor {
    constructor() {
        this.canvas = null;
        this.context = null;
        this.video = null;
        this.effectCanvas = null;
        this.effectContext = null;
        this.animationId = null;
        this.currentEffect = 'none';
        this.isProcessing = false;
        
        // 特效參數
        this.effectParams = {
            brightness: 1,
            contrast: 1,
            saturation: 1,
            hue: 0,
            blur: 0,
            vintage: false,
            blackWhite: false,
            sepia: false,
            invert: false,
            edge: false,
            emboss: false
        };
        
        this.initializeCanvas();
    }
    
    initializeCanvas() {
        // 創建主要畫布
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d', { willReadFrequently: true });
        
        // 創建特效處理畫布
        this.effectCanvas = document.createElement('canvas');
        this.effectContext = this.effectCanvas.getContext('2d', { willReadFrequently: true });
        
        this.sourceVideo = null; // 隱藏的原始影像來源
        this.sourceVideoAttached = false;
        
        console.log('✅ 視頻特效處理器已初始化');
    }
    
    // 設置輸入視頻源
    setVideoSource(source) {
        if (!source) {
            console.warn('⚠️ 未提供有效的影像來源');
            return;
        }
        
        let videoElement = null;
        
        if (typeof MediaStream !== 'undefined' && source instanceof MediaStream) {
            // 使用隱藏的 <video> 元素作為輸入來源，避免循環處理
            if (!this.sourceVideo) {
                this.sourceVideo = document.createElement('video');
                this.sourceVideo.muted = true;
                this.sourceVideo.playsInline = true;
                this.sourceVideo.autoplay = true;
                this.sourceVideo.style.position = 'absolute';
                this.sourceVideo.style.left = '-9999px';
                this.sourceVideo.style.width = '1px';
                this.sourceVideo.style.height = '1px';
            }
            
            if (this.sourceVideo.srcObject !== source) {
                this.sourceVideo.srcObject = source;
            }
            
            if (!this.sourceVideoAttached && document.body) {
                document.body.appendChild(this.sourceVideo);
                this.sourceVideoAttached = true;
            }
            
            this.sourceVideo.play().catch(err => {
                console.warn('⚠️ 無法播放隱藏影像來源:', err);
            });
            
            videoElement = this.sourceVideo;
        } else if (source instanceof HTMLVideoElement) {
            videoElement = source;
        } else {
            console.warn('⚠️ 未支援的影像來源類型');
            return;
        }
        
        this.video = videoElement;
        
        const updateDimensions = () => {
            const width = videoElement.videoWidth || 640;
            const height = videoElement.videoHeight || 480;
            this.canvas.width = width;
            this.canvas.height = height;
            this.effectCanvas.width = width;
            this.effectCanvas.height = height;
            console.log(`📐 設置視頻特效尺寸: ${width}x${height}`);
        };
        
        if (videoElement.readyState >= 2) {
            updateDimensions();
        } else {
            const onLoaded = () => {
                updateDimensions();
                videoElement.removeEventListener('loadedmetadata', onLoaded);
            };
            videoElement.addEventListener('loadedmetadata', onLoaded);
        }
    }
    
    // 開始處理特效
    startProcessing() {
        if (this.isProcessing || !this.video) return;
        
        this.isProcessing = true;
        this.processFrame();
        console.log('🎬 視頻特效處理已開始');
    }
    
    // 停止處理
    stopProcessing() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.sourceVideo && !this.sourceVideo.paused) {
            try {
                this.sourceVideo.pause();
            } catch (err) {
                console.warn('⚠️ 無法暫停隱藏影像來源:', err);
            }
        }
        this.isProcessing = false;
        console.log('⏹️ 視頻特效處理已停止');
    }
    
    // 處理每一幀
    processFrame() {
        if (!this.isProcessing || !this.video) return;
        
        try {
            if (this.video.readyState < 2) {
                this.animationId = requestAnimationFrame(() => this.processFrame());
                return;
            }
            
            // 清空處理畫布，避免殘影或顏色累積
            this.effectContext.clearRect(0, 0, this.effectCanvas.width, this.effectCanvas.height);
            
            
            this.effectContext.drawImage(this.video, 0, 0, this.effectCanvas.width, this.effectCanvas.height);
            
            // 從特效畫布讀取原始像素數據
            const imageData = this.effectContext.getImageData(0, 0, this.effectCanvas.width, this.effectCanvas.height);
            
            // 應用特效處理
            const processedData = this.applyEffectToImageData(imageData);
            
            // 將處理後的數據繪製到主畫布（用於輸出流）
            this.context.putImageData(processedData, 0, 0);
            
            // 繼續處理下一幀
            this.animationId = requestAnimationFrame(() => this.processFrame());
            
        } catch (error) {
            console.error('處理視頻幀時出錯:', error);
        }
    }
    
    // 應用特效到 imageData（新方法，替代 applyCurrentEffect）
    applyEffectToImageData(imageData) {
        switch (this.currentEffect) {
            case 'vintage':
                return this.applyVintageEffect(imageData);
            case 'blackwhite':
                return this.applyBlackWhiteEffect(imageData);
            case 'sepia':
                return this.applySepiaEffect(imageData);
            case 'invert':
                return this.applyInvertEffect(imageData);
            case 'edge':
                return this.applyEdgeDetection(imageData);
            case 'emboss':
                return this.applyEmbossEffect(imageData);
            case 'blur':
                return this.applyBlurEffect(imageData);
            case 'bright':
                return this.applyBrightnessEffect(imageData);
            case 'rainbow':
                return this.applyRainbowEffect(imageData);
            default:
                // 'none' - 不應用特效
                return imageData;
        }
    }
    
    // 復古特效 - 老舊膠卷效果（咖啡橘色調）
    applyVintageEffect(imageData) {
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // 以溫暖色調的基底權重近似舊膠卷顏色
            const warmBase = 0.393 * r + 0.449 * g + 0.189 * b;

            const warmR = Math.min(255, warmBase * 1.08 + 8);
            const warmG = Math.min(255, warmBase * 0.88 + 4);
            const warmB = Math.min(255, warmBase * 0.62);

            data[i] = warmR;
            data[i + 1] = warmG;
            data[i + 2] = warmB;
        }

        return imageData;
    }
    
    // 黑白特效
    applyBlackWhiteEffect(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = gray;     // R
            data[i + 1] = gray; // G
            data[i + 2] = gray; // B
        }
        return imageData;
    }
    
    // 懷舊褐色特效
    applySepiaEffect(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // 以溫暖色調的基底權重近似舊膠卷顏色
            const warmBase = 0.393 * r + 0.449 * g + 0.189 * b;

            const warmR = Math.min(255, warmBase * 1.08 + 8);
            const warmG = Math.min(255, warmBase * 0.88 + 4);
            const warmB = Math.min(255, warmBase * 0.62);

            data[i] = warmR;
            data[i + 1] = warmG;
            data[i + 2] = warmB;
        }
        return imageData;
    }
    
    // 反轉特效
    applyInvertEffect(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];         // R
            data[i + 1] = 255 - data[i + 1]; // G
            data[i + 2] = 255 - data[i + 2]; // B
        }
        return imageData;
    }
    
    // 邊緣檢測特效
    applyEdgeDetection(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const newData = new Uint8ClampedArray(data);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                
                // Sobel 邊緣檢測
                const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                const edge = Math.abs(gray - (0.299 * data[idx + 4] + 0.587 * data[idx + 5] + 0.114 * data[idx + 6]));
                
                newData[idx] = edge;
                newData[idx + 1] = edge;
                newData[idx + 2] = edge;
            }
        }
        
        imageData.data.set(newData);
        return imageData;
    }
    
    // 浮雕特效
    applyEmbossEffect(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const newData = new Uint8ClampedArray(data);
        
        for (let i = 0; i < data.length; i += 4) {
            if (i >= width * 4) {
                const diff = data[i] - data[i - width * 4] + 128;
                newData[i] = diff;
                newData[i + 1] = diff;
                newData[i + 2] = diff;
            }
        }
        
        imageData.data.set(newData);
        return imageData;
    }
    
    // 模糊特效
    applyBlurEffect(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const newData = new Uint8ClampedArray(data);
        
        // 中度模糊效果：5x5 模糊核心
        const radius = 2; // 模糊半徑 2 (2*2+1 = 5)
        const kernelSize = radius * 2 + 1; // 5x5
        const kernelWeight = kernelSize * kernelSize; // 25 個像素
        
        for (let y = radius; y < height - radius; y++) {
            for (let x = radius; x < width - radius; x++) {
                const idx = (y * width + x) * 4;
                
                // 5x5 平均模糊
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            const neighborIdx = ((y + dy) * width + (x + dx)) * 4 + c;
                            sum += data[neighborIdx];
                        }
                    }
                    newData[idx + c] = sum / kernelWeight;
                }
            }
        }
        
        imageData.data.set(newData);
        return imageData;
    }
    
    // 亮度特效
    applyBrightnessEffect(imageData) {
        const data = imageData.data;
        const brightness = 50; // 增加亮度
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] + brightness);     // R
            data[i + 1] = Math.min(255, data[i + 1] + brightness); // G
            data[i + 2] = Math.min(255, data[i + 2] + brightness); // B
        }
        return imageData;
    }
    
    // 彩虹特效
    applyRainbowEffect(imageData) {
        const data = imageData.data;
        const time = Date.now() * 0.001;
        
        for (let i = 0; i < data.length; i += 4) {
            const x = (i / 4) % imageData.width;
            const y = Math.floor((i / 4) / imageData.width);
            
            const hue = (x + y + time * 50) % 360;
            const rgb = this.hslToRgb(hue / 360, 0.5, 0.5);
            
            // 混合原始顏色和彩虹顏色
            data[i] = (data[i] + rgb[0]) / 2;
            data[i + 1] = (data[i + 1] + rgb[1]) / 2;
            data[i + 2] = (data[i + 2] + rgb[2]) / 2;
        }
        return imageData;
    }
    
    // HSL 轉 RGB
    hslToRgb(h, s, l) {
        let r, g, b;
        
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }
    
    // 設置特效
    setEffect(effectName) {
        this.currentEffect = effectName;
        console.log(`🎨 切換到特效: ${effectName}`);
    }
    
    // 獲取處理後的視頻流
    getProcessedStream() {
        if (!this.canvas) return null;
        
        // 從畫布捕獲媒體流
        return this.canvas.captureStream(30); // 30 FPS
    }
    
    // 獲取靜態截圖
    captureScreenshot() {
        if (!this.canvas) return null;
        return this.canvas.toDataURL('image/png');
    }
}

// 全局視頻特效處理器實例
window.videoEffectsProcessor = new VideoEffectsProcessor();

console.log('🎨 視頻特效系統已載入');
