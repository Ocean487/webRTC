const FACE_MESH_VERSION = '0.4.1633559619';
const FACE_MESH_CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${FACE_MESH_VERSION}`;

// 視頻特效處理系統 - 基於 WebRTC 教學和 Webcam Toy 概念
const FACE_OVAL_INDICES = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
    378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
    162, 21, 54, 103, 67, 109
];
const LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_INDICES = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
const LIPS_INDICES = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 185, 40, 39, 37, 0, 267, 269, 270, 409, 415, 310, 311, 312, 13, 82, 81, 42, 183, 78];
const LEFT_BROW_INDICES = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107, 55];
const RIGHT_BROW_INDICES = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336, 285];
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

        // MediaPipe Face Mesh 狀態（用於消皺平滑）
        this.faceMesh = null;
        this.faceMeshReady = false;
        this.faceMeshLoading = null;
        this.faceMeshBusy = false;
        this.lastFaceLandmarks = null;
        this.lastFaceTs = 0;
        this.faceMeshThrottleMs = 8;
        this.maskCanvas = null;
        this.maskCtx = null;
        this.faceUVCanvas = null;
        this.faceUVCtx = null;
        this.faceUVSize = 512;
        this.cvReady = false;
        this.cvLoading = null;
        this.frameBuffer = null;
        this.faceProcessCanvas = null;
        this.faceProcessCtx = null;
        this.maxFaceProcessWidth = 220;
        this.smoothedFaceLandmarks = null;
        this.landmarkSmoothFactor = 0.5;
        
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
                return this.applyFaceMeshLandmarkEffect(imageData);
            case 'wrinkle':
                return this.applyWrinkleSmoothEffect(imageData);
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
    
    // FaceMesh 特徵點覆蓋（供「消皺」功能使用）
    applyFaceMeshLandmarkEffect(imageData) {
        const width = imageData.width;
        const height = imageData.height;

        this.ensureFaceMesh();
        if (!this.faceMeshReady) {
            return imageData;
        }

        const now = performance.now();
        if (!this.faceMeshBusy && now - this.lastFaceTs > this.faceMeshThrottleMs) {
            this.faceMeshBusy = true;
            this.faceMesh.send({ image: this.effectCanvas })
                .catch(err => console.warn('⚠️ Face Mesh 推論失敗:', err))
                .finally(() => {
                    this.faceMeshBusy = false;
                });
        }

        const landmarks = this.lastFaceLandmarks;
        if (!landmarks) {
            return imageData;
        }

        this.renderFaceCutoutOverlay(imageData, landmarks, width, height);
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

    // 消皺平滑特效：透過 Face Mesh 建立皮膚遮罩後模糊並微調亮度與飽和度
    applyWrinkleSmoothEffect(imageData) {
        const width = imageData.width;
        const height = imageData.height;

        // 確保 Face Mesh 已載入，未就緒時先回傳原圖避免阻塞
        this.ensureFaceMesh();
        if (!this.faceMeshReady) {
            return imageData;
        }

        // 初始化遮罩畫布
        if (!this.maskCanvas) {
            this.maskCanvas = document.createElement('canvas');
            this.maskCtx = this.maskCanvas.getContext('2d');
        }
        if (this.maskCanvas.width !== width || this.maskCanvas.height !== height) {
            this.maskCanvas.width = width;
            this.maskCanvas.height = height;
        }

        const now = performance.now();
        if (!this.faceMeshBusy && now - this.lastFaceTs > this.faceMeshThrottleMs) {
            this.faceMeshBusy = true;
            this.faceMesh.send({ image: this.effectCanvas })
                .catch(err => console.warn('⚠️ Face Mesh 推論失敗:', err))
                .finally(() => {
                    this.faceMeshBusy = false;
                });
        }

        const landmarks = this.lastFaceLandmarks;
        if (!landmarks) {
            return imageData;
        }

        // 建立皮膚遮罩（臉部 oval 並排除眼睛、眉毛、嘴巴）
        this.buildSkinMask(landmarks, width, height);
        const maskImage = this.maskCtx.getImageData(0, 0, width, height);
        const maskData = maskImage.data;

        // 嘗試使用 OpenCV.js 進行高階磨皮（可選）
        this.ensureOpenCv();
        if (this.applyOpenCvSkinSmoothing(imageData, maskImage)) {
            return imageData;
        }

        if (this.applyMosaicSkin(imageData, maskImage, 6)) {
            return imageData;
        }

        const faceBox = this.getFaceBoundingBox(landmarks, width, height);
        if (!faceBox) {
            return imageData;
        }

        if (!this.faceUVCanvas) {
            this.faceUVCanvas = document.createElement('canvas');
            this.faceUVCtx = this.faceUVCanvas.getContext('2d');
        }

        const uvSize = this.faceUVSize;
        if (this.faceUVCanvas.width !== uvSize || this.faceUVCanvas.height !== uvSize) {
            this.faceUVCanvas.width = uvSize;
            this.faceUVCanvas.height = uvSize;
        }

        const srcX = Math.max(0, Math.floor(faceBox.x));
        const srcY = Math.max(0, Math.floor(faceBox.y));
        const srcW = Math.max(1, Math.min(width - srcX, Math.ceil(faceBox.w)));
        const srcH = Math.max(1, Math.min(height - srcY, Math.ceil(faceBox.h)));

        this.faceUVCtx.clearRect(0, 0, uvSize, uvSize);
        this.faceUVCtx.drawImage(this.effectCanvas, srcX, srcY, srcW, srcH, 0, 0, uvSize, uvSize);

        let uvImage = this.faceUVCtx.getImageData(0, 0, uvSize, uvSize);
        uvImage = this.gaussianBlurImage(uvImage, uvSize, uvSize, 12);
        uvImage = this.gaussianBlurImage(uvImage, uvSize, uvSize, 8);
        const uvData = uvImage.data;

        const data = imageData.data;
        const saturationBoost = 0.2;
        const whitenBoost = 55;
        const lerp = (a, b, t) => a + (b - a) * t;
        const startX = srcX;
        const endX = Math.min(width, Math.ceil(faceBox.x + faceBox.w));
        const startY = srcY;
        const endY = Math.min(height, Math.ceil(faceBox.y + faceBox.h));

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const idx = (y * width + x) * 4;
                let alpha = maskData[idx + 3] / 255;
                if (alpha <= 0.02) continue;

                const u = (x - faceBox.x) / faceBox.w;
                const v = (y - faceBox.y) / faceBox.h;
                if (u < 0 || u > 1 || v < 0 || v > 1) continue;

                alpha = Math.min(1, Math.pow(alpha, 1.45));
                const mixStrength = Math.min(1, alpha * 1.2);

                const [ur, ug, ub] = this.sampleUVPixel(uvData, uvSize, uvSize, u, v);
                let nr = lerp(data[idx], ur, mixStrength);
                let ng = lerp(data[idx + 1], ug, mixStrength);
                let nb = lerp(data[idx + 2], ub, mixStrength);

                const sampleLum = 0.299 * ur + 0.587 * ug + 0.114 * ub;
                const baseLum = 0.299 * nr + 0.587 * ng + 0.114 * nb;
                const lightGain = Math.max(0, sampleLum - baseLum) * mixStrength;
                const whiten = whitenBoost * mixStrength;

                nr = this.clamp(nr + lightGain + whiten);
                ng = this.clamp(ng + lightGain + whiten);
                nb = this.clamp(nb + lightGain + whiten);

                const [sr, sg, sb] = this.adjustSaturation(nr, ng, nb, saturationBoost * mixStrength);
                data[idx] = sr;
                data[idx + 1] = sg;
                data[idx + 2] = sb;
            }
        }

        return imageData;
    }

    buildSkinMask(landmarks, width, height) {
        if (!this.maskCtx) return;
        const ctx = this.maskCtx;
        ctx.clearRect(0, 0, width, height);

        // 臉部輪廓
        ctx.save();
        ctx.beginPath();
        FACE_OVAL_INDICES.forEach((idx, i) => {
            const pt = landmarks[idx];
            const x = pt.x * width;
            const y = pt.y * height;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = 'white';
        ctx.fill();

        // 挖除眼睛與嘴巴避免過度模糊
        ctx.globalCompositeOperation = 'destination-out';
        [LEFT_EYE_INDICES, RIGHT_EYE_INDICES, LIPS_INDICES, LEFT_BROW_INDICES, RIGHT_BROW_INDICES].forEach((set) => {
            ctx.beginPath();
            set.forEach((idx, i) => {
                const pt = landmarks[idx];
                const x = pt.x * width;
                const y = pt.y * height;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }

    getFaceBoundingBox(landmarks, width, height) {
        if (!landmarks || landmarks.length === 0) return null;
        let minX = 1;
        let minY = 1;
        let maxX = 0;
        let maxY = 0;

        for (const pt of landmarks) {
            minX = Math.min(minX, pt.x);
            minY = Math.min(minY, pt.y);
            maxX = Math.max(maxX, pt.x);
            maxY = Math.max(maxY, pt.y);
        }

        const padding = 0.04;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(1, maxX + padding);
        maxY = Math.min(1, maxY + padding);

        const boxWidth = (maxX - minX) * width;
        const boxHeight = (maxY - minY) * height;
        if (boxWidth < 2 || boxHeight < 2) return null;

        return {
            x: minX * width,
            y: minY * height,
            w: boxWidth,
            h: boxHeight
        };
    }

    sampleUVPixel(pixels, width, height, u, v) {
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        const x = clamp(u, 0, 1) * (width - 1);
        const y = clamp(v, 0, 1) * (height - 1);
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = Math.min(width - 1, x0 + 1);
        const y1 = Math.min(height - 1, y0 + 1);
        const xf = x - x0;
        const yf = y - y0;

        const idx = (yy, xx) => (yy * width + xx) * 4;
        const interpolate = (c00, c10, c01, c11) => {
            const top = c00 + (c10 - c00) * xf;
            const bottom = c01 + (c11 - c01) * xf;
            return top + (bottom - top) * yf;
        };

        const idx00 = idx(y0, x0);
        const idx10 = idx(y0, x1);
        const idx01 = idx(y1, x0);
        const idx11 = idx(y1, x1);

        const r = interpolate(pixels[idx00], pixels[idx10], pixels[idx01], pixels[idx11]);
        const g = interpolate(pixels[idx00 + 1], pixels[idx10 + 1], pixels[idx01 + 1], pixels[idx11 + 1]);
        const b = interpolate(pixels[idx00 + 2], pixels[idx10 + 2], pixels[idx01 + 2], pixels[idx11 + 2]);
        return [r, g, b];
    }

    gaussianBlurImage(imageData, width, height, radius) {
        const src = imageData.data;
        const temp = new Uint8ClampedArray(src.length);
        const dst = new Uint8ClampedArray(src.length);
        const kernelSize = radius * 2 + 1;
        const weight = kernelSize;

        // 水平模糊
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let k = -radius; k <= radius; k++) {
                        const clampedX = Math.min(width - 1, Math.max(0, x + k));
                        const idx = (y * width + clampedX) * 4 + c;
                        sum += src[idx];
                    }
                    temp[(y * width + x) * 4 + c] = sum / weight;
                }
            }
        }

        // 垂直模糊
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let k = -radius; k <= radius; k++) {
                        const clampedY = Math.min(height - 1, Math.max(0, y + k));
                        const idx = (clampedY * width + x) * 4 + c;
                        sum += temp[idx];
                    }
                    dst[(y * width + x) * 4 + c] = sum / weight;
                }
            }
        }

        return new ImageData(dst, width, height);
    }

    adjustSaturation(r, g, b, amount) {
        // HSL 方式調整飽和度
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l;
        l = (max + min) / 2 / 255;
        if (max === min) {
            h = s = 0;
        } else {
            const d = (max - min);
            s = l > 0.5 ? d / (510 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                default: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        s = Math.max(0, Math.min(1, s + amount));

        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;
        const nr = hue2rgb(p, q, h + 1 / 3);
        const ng = hue2rgb(p, q, h);
        const nb = hue2rgb(p, q, h - 1 / 3);
        return [this.clamp(nr * 255), this.clamp(ng * 255), this.clamp(nb * 255)];
    }

    clamp(v) {
        return Math.max(0, Math.min(255, v));
    }

    renderFaceCutoutOverlay(imageData, landmarks, width, height) {
        if (!this.maskCanvas) {
            this.maskCanvas = document.createElement('canvas');
            this.maskCtx = this.maskCanvas.getContext('2d');
        }

        if (this.maskCanvas.width !== width || this.maskCanvas.height !== height) {
            this.maskCanvas.width = width;
            this.maskCanvas.height = height;
        }

        this.buildSkinMask(landmarks, width, height);
        const maskImage = this.maskCtx.getImageData(0, 0, width, height);
        const maskData = maskImage.data;
        const data = imageData.data;
        if (!this.frameBuffer || this.frameBuffer.length !== data.length) {
            this.frameBuffer = new Uint8ClampedArray(data.length);
        }
        this.frameBuffer.set(data);
        const originalData = this.frameBuffer;
        const faceBox = this.getFaceBoundingBox(landmarks, width, height);
        if (!faceBox) return;

        const startX = Math.max(0, Math.floor(faceBox.x));
        const startY = Math.max(0, Math.floor(faceBox.y));
        const endX = Math.min(width, Math.ceil(faceBox.x + faceBox.w));
        const endY = Math.min(height, Math.ceil(faceBox.y + faceBox.h));
        const regionWidth = Math.max(1, endX - startX);
        const regionHeight = Math.max(1, endY - startY);

        if (!this.faceProcessCanvas) {
            this.faceProcessCanvas = document.createElement('canvas');
            this.faceProcessCtx = this.faceProcessCanvas.getContext('2d', { willReadFrequently: true });
        }

        const maxWidth = this.maxFaceProcessWidth || 220;
        const scaleDown = Math.min(1, maxWidth / regionWidth);
        const processWidth = Math.max(1, Math.round(regionWidth * scaleDown));
        const processHeight = Math.max(1, Math.round(regionHeight * scaleDown));

        if (this.faceProcessCanvas.width !== processWidth || this.faceProcessCanvas.height !== processHeight) {
            this.faceProcessCanvas.width = processWidth;
            this.faceProcessCanvas.height = processHeight;
        }

        const processCtx = this.faceProcessCtx;
        processCtx.imageSmoothingEnabled = true;
        if (processCtx.imageSmoothingQuality) {
            processCtx.imageSmoothingQuality = 'high';
        }
        processCtx.clearRect(0, 0, processWidth, processHeight);
        const supportsFilter = typeof processCtx.filter === 'string';
        const previousFilter = supportsFilter ? processCtx.filter : null;
        if (supportsFilter) {
            processCtx.filter = 'blur(4px)';
        }
        processCtx.drawImage(this.effectCanvas, startX, startY, regionWidth, regionHeight, 0, 0, processWidth, processHeight);
        if (supportsFilter) {
            processCtx.filter = previousFilter || 'none';
        }

        const smoothRegion = processCtx.getImageData(0, 0, processWidth, processHeight);
        const smoothData = smoothRegion.data;

        data.set(originalData);

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const idx = (y * width + x) * 4;
                const alpha = maskData[idx + 3] / 255;
                if (alpha <= 0.02) continue;

                const maskMix = Math.min(1, Math.pow(alpha, 1.2));
                const lift = 24 * maskMix;
                const blend = 0.5 + maskMix * 0.35;
                const px = Math.min(processWidth - 1, Math.max(0, Math.round((x - startX) * scaleDown)));
                const py = Math.min(processHeight - 1, Math.max(0, Math.round((y - startY) * scaleDown)));
                const regionIdx = (py * processWidth + px) * 4;
                const sr = smoothData[regionIdx];
                const sg = smoothData[regionIdx + 1];
                const sb = smoothData[regionIdx + 2];

                data[idx] = this.clamp((originalData[idx] * (1 - blend)) + sr * blend + lift);
                data[idx + 1] = this.clamp((originalData[idx + 1] * (1 - blend)) + sg * blend + lift * 0.95);
                data[idx + 2] = this.clamp((originalData[idx + 2] * (1 - blend)) + sb * blend + lift * 0.9);
            }
        }
    }

    renderLandmarkOverlay(imageData, landmarks, width, height) {
        const palette = [
            [255, 90, 140],
            [90, 210, 255],
            [255, 220, 110]
        ];
        const pointRadius = 3;
        const data = imageData.data;

        const setPixel = (x, y, color) => {
            if (x < 0 || x >= width || y < 0 || y >= height) return;
            const idx = (y * width + x) * 4;
            data[idx] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
            data[idx + 3] = 255;
        };

        const drawDot = (cx, cy, color) => {
            for (let dy = -pointRadius; dy <= pointRadius; dy++) {
                for (let dx = -pointRadius; dx <= pointRadius; dx++) {
                    if (dx * dx + dy * dy <= pointRadius * pointRadius + 1) {
                        setPixel(cx + dx, cy + dy, color);
                    }
                }
            }
        };

        const drawPolyline = (indices, close = false, color = [70, 255, 180]) => {
            for (let i = 0; i < indices.length - 1; i++) {
                const a = landmarks[indices[i]];
                const b = landmarks[indices[i + 1]];
                this.drawLineOnImage(a, b, color, imageData, width, height, setPixel);
            }
            if (close) {
                const a = landmarks[indices[indices.length - 1]];
                const b = landmarks[indices[0]];
                this.drawLineOnImage(a, b, color, imageData, width, height, setPixel);
            }
        };

        landmarks.forEach((pt, index) => {
            const px = Math.round(pt.x * width);
            const py = Math.round(pt.y * height);
            drawDot(px, py, palette[index % palette.length]);
        });

        drawPolyline(FACE_OVAL_INDICES, true, [255, 120, 120]);
        drawPolyline(LEFT_EYE_INDICES, true, [120, 255, 200]);
        drawPolyline(RIGHT_EYE_INDICES, true, [120, 255, 200]);
        drawPolyline(LIPS_INDICES, true, [255, 200, 120]);
        drawPolyline(LEFT_BROW_INDICES, false, [255, 180, 80]);
        drawPolyline(RIGHT_BROW_INDICES, false, [255, 180, 80]);
    }

    drawLineOnImage(ptA, ptB, color, imageData, width, height, setPixel) {
        const x0 = Math.round(ptA.x * width);
        const y0 = Math.round(ptA.y * height);
        const x1 = Math.round(ptB.x * width);
        const y1 = Math.round(ptB.y * height);

        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        let x = x0;
        let y = y0;

        while (true) {
            setPixel(x, y, color);
            if (x === x1 && y === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
    }

    ensureFaceMesh() {
        if (this.faceMeshReady || this.faceMeshLoading) return this.faceMeshLoading;

        this.faceMeshLoading = new Promise((resolve, reject) => {
            const startInstance = () => {
                try {
                    this.faceMesh = new window.FaceMesh({
                        locateFile: (file) => `${FACE_MESH_CDN_BASE}/${file}`
                    });
                    this.faceMesh.setOptions({
                        maxNumFaces: 1,
                        refineLandmarks: true,
                        minDetectionConfidence: 0.35,
                        minTrackingConfidence: 0.35,
                        modelComplexity: 1,
                        staticImageMode: false
                    });
                    this.faceMesh.onResults((res) => {
                        if (res && res.multiFaceLandmarks && res.multiFaceLandmarks.length > 0) {
                            const detected = res.multiFaceLandmarks[0];
                            if (!this.smoothedFaceLandmarks || this.smoothedFaceLandmarks.length !== detected.length) {
                                this.smoothedFaceLandmarks = detected.map(pt => ({ x: pt.x, y: pt.y, z: pt.z || 0 }));
                            } else {
                                const factor = this.landmarkSmoothFactor;
                                for (let i = 0; i < detected.length; i++) {
                                    const target = this.smoothedFaceLandmarks[i];
                                    const source = detected[i];
                                    target.x += (source.x - target.x) * factor;
                                    target.y += (source.y - target.y) * factor;
                                    if (typeof source.z === 'number') {
                                        target.z += (source.z - target.z) * factor;
                                    }
                                }
                            }
                            this.lastFaceLandmarks = this.smoothedFaceLandmarks;
                            this.lastFaceTs = performance.now();
                        }
                    });
                    this.faceMeshReady = true;
                    console.log('✅ Face Mesh 模型已載入');
                    resolve();
                } catch (err) {
                    console.error('❌ 初始化 Face Mesh 失敗:', err);
                    reject(err);
                }
            };

            if (window.FaceMesh) {
                startInstance();
            } else {
                const script = document.createElement('script');
                script.src = `${FACE_MESH_CDN_BASE}/face_mesh.js`;
                script.onload = () => startInstance();
                script.onerror = (err) => {
                    console.error('❌ 載入 Face Mesh 腳本失敗:', err);
                    reject(err);
                };
                document.head.appendChild(script);
            }
        });

        return this.faceMeshLoading;
    }

    ensureOpenCv() {
        if (this.cvReady || this.cvLoading) return this.cvLoading;

        this.cvLoading = new Promise((resolve, reject) => {
            const markReady = () => {
                this.cvReady = true;
                console.log('✅ OpenCV.js 已就緒');
                resolve();
            };

            const waitForCv = () => {
                if (window.cv && typeof window.cv.Mat === 'function') {
                    markReady();
                } else {
                    setTimeout(waitForCv, 50);
                }
            };

            const loadScript = () => {
                const script = document.createElement('script');
                script.src = 'webrtc-filters-tutorial-master/public/lib/opencv.js';
                script.onload = () => {
                    waitForCv();
                };
                script.onerror = (err) => {
                    console.error('❌ 載入 OpenCV.js 失敗:', err);
                    reject(err);
                };
                document.head.appendChild(script);
            };

            if (window.cv && typeof window.cv.Mat === 'function') {
                markReady();
            } else {
                loadScript();
            }
        });

        return this.cvLoading;
    }

    applyOpenCvSkinSmoothing(imageData, maskImage) {
        if (!this.cvReady || !window.cv || typeof window.cv.Mat !== 'function') {
            return false;
        }

        const cv = window.cv;
        let srcMat, rgbMat, bilateralMat, gaussianMat, smoothRgba;
        try {
            srcMat = cv.matFromImageData(imageData);
            rgbMat = new cv.Mat();
            cv.cvtColor(srcMat, rgbMat, cv.COLOR_RGBA2RGB);

            bilateralMat = new cv.Mat();
            cv.bilateralFilter(rgbMat, bilateralMat, 11, 90, 90);

            gaussianMat = new cv.Mat();
            cv.GaussianBlur(bilateralMat, gaussianMat, new cv.Size(7, 7), 0, 0, cv.BORDER_DEFAULT);

            smoothRgba = new cv.Mat();
            cv.cvtColor(gaussianMat, smoothRgba, cv.COLOR_RGB2RGBA);

            const smoothData = smoothRgba.data;
            const maskData = maskImage.data;
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                let alpha = maskData[i + 3] / 255;
                if (alpha <= 0.02) continue;
                alpha = Math.min(1, Math.pow(alpha, 1.35));
                const mix = Math.min(1, alpha * 0.95);

                data[i] = this.clamp(data[i] * (1 - mix) + smoothData[i] * mix + 30 * alpha);
                data[i + 1] = this.clamp(data[i + 1] * (1 - mix) + smoothData[i + 1] * mix + 30 * alpha);
                data[i + 2] = this.clamp(data[i + 2] * (1 - mix) + smoothData[i + 2] * mix + 30 * alpha);
            }

            return true;
        } catch (err) {
            console.warn('⚠️ OpenCV 磨皮失敗，改用備援方案:', err);
            return false;
        } finally {
            [srcMat, rgbMat, bilateralMat, gaussianMat, smoothRgba].forEach(mat => {
                if (mat && typeof mat.delete === 'function') {
                    mat.delete();
                }
            });
        }
    }

    applyMosaicSkin(imageData, maskImage, blockSize = 6) {
        if (!maskImage) return false;

        const data = imageData.data;
        const mask = maskImage.data;
        const { width, height } = imageData;
        const bs = Math.max(2, blockSize);
        let applied = false;

        for (let y = 0; y < height; y += bs) {
            for (let x = 0; x < width; x += bs) {
                let sumR = 0;
                let sumG = 0;
                let sumB = 0;
                let count = 0;

                for (let yy = y; yy < Math.min(y + bs, height); yy++) {
                    for (let xx = x; xx < Math.min(x + bs, width); xx++) {
                        const maskIdx = (yy * width + xx) * 4 + 3;
                        const alpha = mask[maskIdx] / 255;
                        if (alpha > 0.05) {
                            const idx = (yy * width + xx) * 4;
                            sumR += data[idx];
                            sumG += data[idx + 1];
                            sumB += data[idx + 2];
                            count++;
                        }
                    }
                }

                if (!count) continue;
                applied = true;
                const avgR = sumR / count;
                const avgG = sumG / count;
                const avgB = sumB / count;

                for (let yy = y; yy < Math.min(y + bs, height); yy++) {
                    for (let xx = x; xx < Math.min(x + bs, width); xx++) {
                        const maskIdx = (yy * width + xx) * 4 + 3;
                        const alpha = mask[maskIdx] / 255;
                        if (alpha > 0.05) {
                            const idx = (yy * width + xx) * 4;
                            data[idx] = avgR;
                            data[idx + 1] = avgG;
                            data[idx + 2] = avgB;
                        }
                    }
                }
            }
        }

        return applied;
    }

    setEffect(effectName) {
        this.currentEffect = effectName;
        console.log(`🎨 切換到特效: ${effectName}`);
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
