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
        this.context = this.canvas.getContext('2d');
        
        // 創建特效處理畫布
        this.effectCanvas = document.createElement('canvas');
        this.effectContext = this.effectCanvas.getContext('2d');
        
        console.log('✅ 視頻特效處理器已初始化');
    }
    
    // 設置輸入視頻源
    setVideoSource(videoElement) {
        this.video = videoElement;
        
        // 設置畫布尺寸與視頻匹配
        this.canvas.width = videoElement.videoWidth || 640;
        this.canvas.height = videoElement.videoHeight || 480;
        this.effectCanvas.width = this.canvas.width;
        this.effectCanvas.height = this.canvas.height;
        
        console.log(`📐 設置視頻特效尺寸: ${this.canvas.width}x${this.canvas.height}`);
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
        this.isProcessing = false;
        console.log('⏹️ 視頻特效處理已停止');
    }
    
    // 處理每一幀
    processFrame() {
        if (!this.isProcessing || !this.video) return;
        
        try {
            // 將視頻幀繪製到畫布
            this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // 應用當前特效
            this.applyCurrentEffect();
            
            // 繼續處理下一幀
            this.animationId = requestAnimationFrame(() => this.processFrame());
            
        } catch (error) {
            console.error('處理視頻幀時出錯:', error);
        }
    }
    
    // 應用當前特效
    applyCurrentEffect() {
        const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
        let processedData = imageData;
        
        switch (this.currentEffect) {
            case 'vintage':
                processedData = this.applyVintageEffect(imageData);
                break;
            case 'blackwhite':
                processedData = this.applyBlackWhiteEffect(imageData);
                break;
            case 'sepia':
                processedData = this.applySepiaEffect(imageData);
                break;
            case 'invert':
                processedData = this.applyInvertEffect(imageData);
                break;
            case 'edge':
                processedData = this.applyEdgeDetection(imageData);
                break;
            case 'emboss':
                processedData = this.applyEmbossEffect(imageData);
                break;
            case 'blur':
                processedData = this.applyBlurEffect(imageData);
                break;
            case 'bright':
                processedData = this.applyBrightnessEffect(imageData);
                break;
            case 'rainbow':
                processedData = this.applyRainbowEffect(imageData);
                break;
            default:
                // 'none' - 不應用特效
                break;
        }
        
        // 將處理後的數據繪製回畫布
        this.context.putImageData(processedData, 0, 0);
    }
    
    // 復古特效
    applyVintageEffect(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // 復古色調調整
            data[i] = Math.min(255, r * 1.2 + 30);     // 增加紅色
            data[i + 1] = Math.min(255, g * 1.1 + 20); // 略增綠色
            data[i + 2] = Math.max(0, b * 0.8 - 10);   // 減少藍色
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
            
            data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
            data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
            data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
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
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                
                // 簡單的 3x3 平均模糊
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const neighborIdx = ((y + dy) * width + (x + dx)) * 4 + c;
                            sum += data[neighborIdx];
                        }
                    }
                    newData[idx + c] = sum / 9;
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
