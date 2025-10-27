// Shared face-tracked glasses overlay helper for broadcaster and viewer pages.
(function (global) {
    const DEFAULT_IMAGE_PATH = 'images/glass.png';
    const DEFAULT_MODEL_BASE = '/weights';
    const CDN_MODEL_BASE = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';
    const ALTERNATE_MODEL_SOURCES = [
        { base: CDN_MODEL_BASE, type: 'manifest', label: 'jsDelivr face-api.js@0.22.2' },
        { base: 'https://unpkg.com/face-api.js@0.22.2/weights', type: 'manifest', label: 'unpkg face-api.js@0.22.2' },
        { base: 'https://cdn.jsdelivr.net/npm/face-api.js-models@0.22.2/weights', type: 'manifest', label: 'jsDelivr face-api.js-models@0.22.2' },
        { base: 'https://unpkg.com/face-api.js-models@0.22.2/weights', type: 'manifest', label: 'unpkg face-api.js-models@0.22.2' },
        { base: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.6/model', type: 'directory', label: '@vladmandic/face-api@1.7.6' }
    ];
    const NETWORK_DEFINITIONS = [
        { key: 'tinyFaceDetector', directory: 'tiny_face_detector', loader: () => faceapi.nets.tinyFaceDetector },
        { key: 'faceLandmark68Net', directory: 'face_landmark_68', loader: () => faceapi.nets.faceLandmark68Net }
    ];
    const DEFAULT_DETECTION_INTERVAL = 150;
    const SCALE_FACTOR = 2.4; // Adjusts overlay width relative to eye distance
    const VERTICAL_OFFSET_RATIO = 0.15; // Moves glasses slightly downward toward the nose

    let modelsReady = false;
    let modelsLoadingPromise = null;
    const imageCache = new Map();

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function ensureImage(path) {
        if (!path) {
            return null;
        }
        if (imageCache.has(path)) {
            return imageCache.get(path);
        }
        const img = new Image();
        const imagePromise = new Promise((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = (error) => reject(error);
        });
        img.src = path;
        try {
            await imagePromise;
            imageCache.set(path, img);
            return img;
        } catch (error) {
            console.warn('⚠️ 無法載入眼鏡圖片:', path, error);
            return null;
        }
    }

    function sanitizeBase(base) {
        if (!base || typeof base !== 'string') {
            return null;
        }
        const trimmed = base.trim();
        if (!trimmed) {
            return null;
        }
        return trimmed.replace(/\/+$/u, '');
    }

    function joinUrl(base, segment) {
        if (!segment) {
            return base;
        }
        if (base.endsWith('/')) {
            return `${base}${segment}`;
        }
        return `${base}/${segment}`;
    }

    function normalizeSourceEntry(entry) {
        if (!entry) {
            return null;
        }
        if (typeof entry === 'string') {
            return { base: sanitizeBase(entry), type: 'manifest', label: entry };
        }
        if (typeof entry === 'object') {
            const normalizedBase = sanitizeBase(entry.base);
            if (!normalizedBase) {
                return null;
            }
            return {
                base: normalizedBase,
                type: entry.type === 'directory' ? 'directory' : 'manifest',
                label: entry.label || entry.name || normalizedBase
            };
        }
        return null;
    }

    function resolveModelSources(tracker) {
        const sources = [];
        const seen = new Set();

        const addSource = (entry) => {
            const normalized = normalizeSourceEntry(entry);
            if (!normalized || !normalized.base) {
                return;
            }
            const key = `${normalized.type}:${normalized.base}`;
            if (seen.has(key)) {
                return;
            }
            seen.add(key);
            sources.push(normalized);
        };

        if (tracker) {
            addSource({ base: tracker.modelBasePath, type: tracker.modelPathFormat || 'manifest', label: 'primary-modelBase' });
            addSource({ base: tracker.fallbackModelBasePath, type: tracker.fallbackModelPathFormat || 'manifest', label: 'fallback-modelBase' });

            if (Array.isArray(tracker.additionalModelSources)) {
                tracker.additionalModelSources.forEach(addSource);
            }
        }

        ALTERNATE_MODEL_SOURCES.forEach(addSource);
        return sources;
    }

    async function loadFromSource(source) {
        const label = source.label || source.base;
        const loadPromises = NETWORK_DEFINITIONS.map((definition) => {
            const net = definition.loader();
            if (!net || typeof net.loadFromUri !== 'function') {
                throw new Error('face-api 網路未初始化');
            }
            const targetBase = source.type === 'directory'
                ? joinUrl(source.base, definition.directory)
                : source.base;
            return net.loadFromUri(targetBase);
        });

        await Promise.all(loadPromises);
        console.log(`✅ face-api 模型載入完成: ${label}`);
    }

    async function loadModels(tracker) {
        if (modelsReady) {
            return true;
        }

        if (typeof faceapi === 'undefined') {
            console.error('❌ face-api.js 未載入，無法初始化眼鏡追蹤');
            return false;
        }

        if (!modelsLoadingPromise) {
            modelsLoadingPromise = (async () => {
                const sources = resolveModelSources(tracker);
                if (!sources.length) {
                    throw new Error('未提供任何可用的 face-api 模型來源');
                }

                let lastError = null;
                for (const source of sources) {
                    try {
                        console.log(`🌐 嘗試從 ${source.base} 載入 face-api 模型 (模式: ${source.type})`);
                        await loadFromSource(source);
                        modelsReady = true;
                        return true;
                    } catch (error) {
                        lastError = error;
                        console.warn(`⚠️ face-api 模型載入失敗，來源: ${source.base}`, error);
                    }
                }

                if (lastError) {
                    throw lastError;
                }
                throw new Error('face-api 模型載入失敗: 所有來源皆無法使用');
            })()
            .catch((error) => {
                modelsReady = false;
                modelsLoadingPromise = null;
                console.error('❌ face-api 模型載入失敗', error);
                console.info('💡 請確認 /weights 目錄已部署或設定 window.FACE_API_MODEL_SOURCES 提供有效的模型來源。');
                return false;
            });
        }

        return modelsLoadingPromise;
    }

    function averagePoint(points) {
        if (!points || !points.length) {
            return null;
        }
        const total = points.reduce((acc, point) => {
            acc.x += point.x;
            acc.y += point.y;
            return acc;
        }, { x: 0, y: 0 });
        return {
            x: total.x / points.length,
            y: total.y / points.length
        };
    }

    class GlassesTracker {
        constructor(options = {}) {
            this.video = options.videoElement || null;
            this.container = options.container || (this.video ? this.video.parentElement : null);
            this.imagePath = options.imagePath || DEFAULT_IMAGE_PATH;
            this.modelBasePath = options.modelBasePath || DEFAULT_MODEL_BASE;
            this.fallbackModelBasePath = options.fallbackModelBasePath || CDN_MODEL_BASE;
            this.modelPathFormat = options.modelPathFormat || 'manifest';
            this.fallbackModelPathFormat = options.fallbackModelPathFormat || 'manifest';
            if (Array.isArray(options.additionalModelSources)) {
                this.additionalModelSources = options.additionalModelSources;
            } else if (options.additionalModelSources) {
                this.additionalModelSources = [options.additionalModelSources];
            } else {
                this.additionalModelSources = null;
            }
            this.detectionInterval = options.detectionIntervalMs || DEFAULT_DETECTION_INTERVAL;
            this.overlay = null;
            this.overlayImage = null;
            this.running = false;
            this.loopActive = false;
            this.detectorOptions = null;
            this.lastDetectionAt = 0;
            this.minConfidence = typeof options.minConfidence === 'number' ? options.minConfidence : 0.5;
            this.flipHorizontal = !!options.flipHorizontal;
            this.detectorInputSize = typeof options.detectorInputSize === 'number' ? options.detectorInputSize : 320;
        }

        setTargets(videoElement, container) {
            this.video = videoElement;
            this.container = container || (videoElement ? videoElement.parentElement : null);
        }

        async start() {
            if (!this.video) {
                console.warn('⚠️ GlassesTracker: 缺少 video 元素');
                return false;
            }
            if (!this.container) {
                this.container = this.video.parentElement;
            }
            if (!this.container) {
                console.warn('⚠️ GlassesTracker: 缺少容器元素');
                return false;
            }

            if (this.running) {
                this.ensureOverlay();
                return true;
            }

            if (this.video.readyState < 2) {
                await new Promise((resolve) => {
                    const handler = () => {
                        this.video.removeEventListener('loadedmetadata', handler);
                        resolve();
                    };
                    this.video.addEventListener('loadedmetadata', handler, { once: true });
                });
            }

            this.overlayImage = await ensureImage(this.imagePath);
            if (!this.overlayImage) {
                console.warn('⚠️ GlassesTracker: 無法載入眼鏡圖片，停止追蹤');
                return false;
            }

            const modelsAvailable = await loadModels(this);
            if (!modelsAvailable) {
                console.warn('⚠️ GlassesTracker: 模型載入失敗，停止追蹤');
                return false;
            }

            this.detectorOptions = new faceapi.TinyFaceDetectorOptions({
                inputSize: this.detectorInputSize,
                scoreThreshold: this.minConfidence
            });

            this.ensureOverlay();
            this.running = true;
            this.lastDetectionAt = Date.now();
            this.loop();
            return true;
        }

        stop() {
            this.running = false;
            this.loopActive = false;
            if (this.overlay && this.overlay.parentElement) {
                this.overlay.parentElement.removeChild(this.overlay);
            }
            this.overlay = null;
            this.overlayImage = null;
        }

        ensureOverlay() {
            if (this.overlay && this.overlay.parentElement === this.container) {
                return this.overlay;
            }
            if (!this.container) {
                return null;
            }
            if (!this.overlay) {
                const div = document.createElement('div');
                div.className = 'glasses-overlay';
                const img = document.createElement('img');
                img.alt = '虛擬眼鏡特效';
                img.src = this.imagePath;
                div.appendChild(img);
                this.overlay = div;
            }
            if (!this.overlayImage) {
                this.overlayImage = this.overlay.querySelector('img');
            }
            this.overlay.style.opacity = '0';
            this.container.appendChild(this.overlay);
            return this.overlay;
        }

        async loop() {
            if (this.loopActive) {
                return;
            }
            this.loopActive = true;

            while (this.running) {
                if (!this.video || this.video.readyState < 2 || this.video.paused || this.video.ended) {
                    this.hideOverlay();
                    await wait(120);
                    continue;
                }

                try {
                    const detectionTask = faceapi
                        .detectSingleFace(this.video, this.detectorOptions)
                        .withFaceLandmarks();
                    const detection = await detectionTask;
                    if (!this.running) {
                        break;
                    }
                    if (detection) {
                        this.lastDetectionAt = Date.now();
                        this.updateOverlay(detection);
                    } else if (Date.now() - this.lastDetectionAt > this.detectionInterval * 3) {
                        this.hideOverlay();
                    }
                } catch (error) {
                    console.warn('⚠️ GlassesTracker: 偵測失敗', error);
                    this.hideOverlay();
                    await wait(this.detectionInterval * 2);
                }

                await wait(this.detectionInterval);
            }

            this.loopActive = false;
        }

        hideOverlay() {
            if (this.overlay) {
                this.overlay.style.opacity = '0';
            }
        }

        updateOverlay(detection) {
            const overlay = this.ensureOverlay();
            if (!overlay || !this.overlayImage) {
                return;
            }

            const videoWidth = this.video.videoWidth || this.video.clientWidth;
            const videoHeight = this.video.videoHeight || this.video.clientHeight;
            if (!videoWidth || !videoHeight) {
                this.hideOverlay();
                return;
            }

            const containerWidth = this.container.clientWidth || videoWidth;
            const containerHeight = this.container.clientHeight || videoHeight;
            const scaleX = containerWidth / videoWidth;
            const scaleY = containerHeight / videoHeight;

            const landmarks = detection.landmarks;
            const leftEye = averagePoint(landmarks.getLeftEye());
            const rightEye = averagePoint(landmarks.getRightEye());
            if (!leftEye || !rightEye) {
                this.hideOverlay();
                return;
            }

            let adjustedLeftEye = leftEye;
            let adjustedRightEye = rightEye;

            if (this.flipHorizontal) {
                adjustedLeftEye = { x: videoWidth - rightEye.x, y: rightEye.y };
                adjustedRightEye = { x: videoWidth - leftEye.x, y: leftEye.y };
            }

            const centerX = (adjustedLeftEye.x + adjustedRightEye.x) / 2;
            const centerY = (adjustedLeftEye.y + adjustedRightEye.y) / 2;
            const eyeDistance = Math.hypot(
                adjustedRightEye.x - adjustedLeftEye.x,
                adjustedRightEye.y - adjustedLeftEye.y
            );

            const overlayWidth = eyeDistance * ((scaleX + scaleY) / 2) * SCALE_FACTOR;
            const naturalRatio = this.overlayImage.naturalHeight && this.overlayImage.naturalWidth
                ? this.overlayImage.naturalHeight / this.overlayImage.naturalWidth
                : 0.4;
            const overlayHeight = overlayWidth * naturalRatio;
            const tilt = Math.atan2(
                adjustedRightEye.y - adjustedLeftEye.y,
                adjustedRightEye.x - adjustedLeftEye.x
            );

            overlay.style.width = `${overlayWidth}px`;
            overlay.style.height = `${overlayHeight}px`;
            overlay.style.left = `${centerX * scaleX}px`;
            overlay.style.top = `${centerY * scaleY + overlayHeight * VERTICAL_OFFSET_RATIO}px`;
            overlay.style.transform = `translate(-50%, -50%) rotate(${tilt}rad)`;
            overlay.style.opacity = '1';
        }
    }

    function createGlassesTracker(options) {
        return new GlassesTracker(options);
    }

    global.createGlassesTracker = createGlassesTracker;
})(typeof window !== 'undefined' ? window : this);
