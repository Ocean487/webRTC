// 觀眾端特效處理
console.log('🎨 載入觀眾端特效處理模組...');

// 記錄當前特效狀態，避免重複清除造成閃爍
let currentViewerEffect = 'clear';
const overlayEffects = new Set(['particles', 'hearts', 'confetti', 'snow']);

const GLASSES_IMAGE_PATH = 'images/glass.png';
const DOG_IMAGE_PATH = 'images/dog.png';
const PINGO_IMAGE_PATH = 'images/pingo.png';
const PINGO_AUDIO_PATH = 'images/pingo.mp3';
const SECH_IMAGE_PATH = 'images/sech.png';
const SECH_AUDIO_PATH = 'images/sech.mp3';
const LAIXIONG_IMAGE_PATH = 'images/chder.png';
const LAIXIONG_AUDIO_PATH = 'images/chder.mp3';
const MAO_ZED_IMAGE_PATH = 'images/Mao_Zed.png';
const MAO_ZED_AUDIO_PATH = 'images/Mao_Zed.mp3';
const LAOGAO_IMAGE_PATH = 'images/high.png';
const LAOGAO_AUDIO_PATH = 'images/high.mp3';
const GUODONG_IMAGE_PATH = 'images/don.png';
const GUODONG_AUDIO_PATH = 'images/don.mp3';
const HUOGUO_IMAGE_PATH = 'images/god.png';
const HUOGUO_AUDIO_PATH = 'images/god.mp3';
const HSINCHU_IMAGE_PATH = 'images/god2.png';
const HSINCHU_AUDIO_PATH = 'images/god2.mp3';
const CAR_IMAGE_PATH = 'images/Car.png';
const CAR_AUDIO_PATH = 'images/Car.mp3';
const CAR2_IMAGE_PATH = 'images/Car2.png';
const CAR2_AUDIO_PATH = 'images/Car2.mp3';
const LOOK_IMAGE_PATH = 'images/look.png';
const LOOK_AUDIO_PATH = 'images/look.mp3';
const LUMUMU_IMAGE_PATH = 'images/lumumu.png';
const LUMUMU_AUDIO_PATH = 'images/lumumu.mp3';
const CHIIKAWA_IMAGE_PATH = 'images/Chiikawa.png';
const CHIIKAWA_AUDIO_PATH = 'images/Chiikawa.mp3';
const FULL_FACE_LANDMARK_INDICES = Array.from({ length: 68 }, (_, index) => index);
const FACE_API_LOCAL_MODEL_PATH = window.FACE_API_MODEL_BASE || '/weights';
const FACE_API_CDN_MODEL_PATH = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';
const FACE_API_MODEL_PATH_FORMAT = (typeof window !== 'undefined' && typeof window.FACE_API_MODEL_PATH_FORMAT === 'string')
    ? window.FACE_API_MODEL_PATH_FORMAT
    : 'manifest';
const FACE_API_ADDITIONAL_SOURCES = (typeof window !== 'undefined' && Array.isArray(window.FACE_API_MODEL_SOURCES))
    ? window.FACE_API_MODEL_SOURCES
    : undefined;

let viewerGlassesTracker = null;
let viewerDogTracker = null;
let viewerPingoTracker = null;
let viewerPingoAudio = null;
let viewerSechTracker = null;
let viewerSechAudio = null;
let viewerLaixiongTracker = null;
let viewerLaixiongAudio = null;
let viewerMaoZedTracker = null;
let viewerMaoZedAudio = null;
let viewerLaogaoTracker = null;
let viewerLaogaoAudio = null;
let viewerGuodongTracker = null;
let viewerGuodongAudio = null;
let viewerHuoguoTracker = null;
let viewerHuoguoAudio = null;
let viewerHsinchuTracker = null;
let viewerHsinchuAudio = null;
let viewerCarTracker = null;
let viewerCarAudio = null;
let viewerCar2Tracker = null;
let viewerCar2Audio = null;
let viewerLookTracker = null;
let viewerLookAudio = null;
let viewerLumumuTracker = null;
let viewerLumumuAudio = null;
let viewerChiikawaTracker = null;
let viewerChiikawaAudio = null;

function ensureViewerGlassesTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用眼鏡特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立眼鏡追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerGlassesTracker) {
        viewerGlassesTracker.setTargets(videoElement, container);
        return viewerGlassesTracker;
    }

    viewerGlassesTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: GLASSES_IMAGE_PATH,
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES
    });

    return viewerGlassesTracker;
}

async function startViewerGlassesTracking(videoElement, container) {
    const tracker = ensureViewerGlassesTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端眼鏡追蹤', error);
    }
}

function stopViewerGlassesTracking() {
    if (viewerGlassesTracker) {
        viewerGlassesTracker.stop();
        viewerGlassesTracker = null;
    }
}

function ensureViewerDogTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用狗狗特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立狗狗追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerDogTracker) {
        viewerDogTracker.setTargets(videoElement, container);
        return viewerDogTracker;
    }

    viewerDogTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: DOG_IMAGE_PATH,
        overlayClassName: 'dog-overlay',
        overlayImageAlt: '可愛狗狗特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 3.4,
        verticalOffsetRatio: 0.02,
        overlayZIndex: 13,
        minConfidence: 0.5,
        flipHorizontal: false,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: [18,19,20,21,22,23,24,25,26],
        widthLandmarkPair: [20,24]
    });

    return viewerDogTracker;
}

async function startViewerDogTracking(videoElement, container) {
    const tracker = ensureViewerDogTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端狗狗追蹤', error);
    }
}

function stopViewerDogTracking() {
    if (viewerDogTracker) {
        viewerDogTracker.stop();
        viewerDogTracker = null;
    }
}

function ensureViewerPingoAudio() {
    if (viewerPingoAudio) {
        return viewerPingoAudio;
    }
    const audio = new Audio(PINGO_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    viewerPingoAudio = audio;
    return audio;
}

function stopViewerPingoAudio() {
    if (viewerPingoAudio) {
        viewerPingoAudio.pause();
        viewerPingoAudio.currentTime = 0;
    }
}

function playViewerPingoAudio() {
    const audio = ensureViewerPingoAudio();
    if (!audio) {
        return;
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 皮鼓音效播放失敗，瀏覽器可能阻擋了自動播放', error);
        });
    }
}

function ensureViewerSechAudio() {
    if (viewerSechAudio) {
        return viewerSechAudio;
    }
    const audio = new Audio(SECH_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    viewerSechAudio = audio;
    return audio;
}

function stopViewerSechAudio() {
    if (viewerSechAudio) {
        viewerSechAudio.pause();
        viewerSechAudio.currentTime = 0;
    }
}

function playViewerSechAudio() {
    const audio = ensureViewerSechAudio();
    if (!audio) {
        return;
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 世間音效播放失敗，瀏覽器可能阻擋了自動播放', error);
        });
    }
}

function ensureViewerLaixiongAudio() {
    if (viewerLaixiongAudio) {
        return viewerLaixiongAudio;
    }
    const audio = new Audio(LAIXIONG_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    viewerLaixiongAudio = audio;
    return audio;
}

function stopViewerLaixiongAudio() {
    if (viewerLaixiongAudio) {
        viewerLaixiongAudio.pause();
        viewerLaixiongAudio.currentTime = 0;
    }
}

function playViewerLaixiongAudio() {
    const audio = ensureViewerLaixiongAudio();
    if (!audio) {
        return;
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 賴兄音效播放失敗，瀏覽器可能阻擋了自動播放', error);
        });
    }
}

function ensureViewerMaoZedAudio() {
    if (viewerMaoZedAudio) {
        return viewerMaoZedAudio;
    }
    const audio = new Audio(MAO_ZED_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    viewerMaoZedAudio = audio;
    return audio;
}

function stopViewerMaoZedAudio() {
    if (viewerMaoZedAudio) {
        viewerMaoZedAudio.pause();
        viewerMaoZedAudio.currentTime = 0;
    }
}

function playViewerMaoZedAudio() {
    const audio = ensureViewerMaoZedAudio();
    if (!audio) {
        return;
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 毛主席音效播放失敗，瀏覽器可能阻擋了自動播放', error);
        });
    }
}

function ensureViewerLaogaoAudio() {
    if (viewerLaogaoAudio) {
        return viewerLaogaoAudio;
    }
    const audio = new Audio(LAOGAO_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    viewerLaogaoAudio = audio;
    return audio;
}

function stopViewerLaogaoAudio() {
    if (viewerLaogaoAudio) {
        viewerLaogaoAudio.pause();
        viewerLaogaoAudio.currentTime = 0;
    }
}

function playViewerLaogaoAudio() {
    const audio = ensureViewerLaogaoAudio();
    if (!audio) {
        return;
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 老高音效播放失敗，瀏覽器可能阻擋了自動播放', error);
        });
    }
}

function ensureViewerGuodongAudio() {
    if (viewerGuodongAudio) {
        return viewerGuodongAudio;
    }
    const audio = new Audio(GUODONG_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    viewerGuodongAudio = audio;
    return audio;
}

function stopViewerGuodongAudio() {
    if (viewerGuodongAudio) {
        viewerGuodongAudio.pause();
        viewerGuodongAudio.currentTime = 0;
    }
}

function playViewerGuodongAudio() {
    const audio = ensureViewerGuodongAudio();
    if (!audio) {
        return;
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 國棟音效播放失敗，瀏覽器可能阻擋了自動播放', error);
        });
    }
}

function ensureViewerHuoguoAudio() {
    if (viewerHuoguoAudio) {
        return viewerHuoguoAudio;
    }
    const audio = new Audio(HUOGUO_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    viewerHuoguoAudio = audio;
    return audio;
}

function stopViewerHuoguoAudio() {
    if (viewerHuoguoAudio) {
        viewerHuoguoAudio.pause();
        viewerHuoguoAudio.currentTime = 0;
    }
}

function playViewerHuoguoAudio() {
    const audio = ensureViewerHuoguoAudio();
    if (!audio) {
        return;
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 火鍋音效播放失敗，瀏覽器可能阻擋了自動播放', error);
        });
    }
}

function ensureViewerHsinchuAudio() {
    if (viewerHsinchuAudio) {
        return viewerHsinchuAudio;
    }
    const audio = new Audio(HSINCHU_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    viewerHsinchuAudio = audio;
    return audio;
}

function stopViewerHsinchuAudio() {
    if (viewerHsinchuAudio) {
        viewerHsinchuAudio.pause();
        viewerHsinchuAudio.currentTime = 0;
    }
}

function playViewerHsinchuAudio() {
    const audio = ensureViewerHsinchuAudio();
    if (!audio) {
        return;
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 新竹音效播放失敗，瀏覽器可能阻擋了自動播放', error);
        });
    }
}

function ensureViewerCarAudio() {
    if (viewerCarAudio) {
        return viewerCarAudio;
    }
    const audio = new Audio(CAR_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    viewerCarAudio = audio;
    return audio;
}

function stopViewerCarAudio() {
    if (viewerCarAudio) {
        viewerCarAudio.pause();
        viewerCarAudio.currentTime = 0;
    }
}

function playViewerCarAudio() {
    const audio = ensureViewerCarAudio();
    if (!audio) {
        return;
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 車音效播放失敗，瀏覽器可能阻擋了自動播放', error);
        });
    }
}

function ensureViewerCar2Audio() {
    if (viewerCar2Audio) {
        return viewerCar2Audio;
    }
    const audio = new Audio(CAR2_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    viewerCar2Audio = audio;
    return audio;
}

function stopViewerCar2Audio() {
    if (viewerCar2Audio) {
        viewerCar2Audio.pause();
        viewerCar2Audio.currentTime = 0;
    }
}

function playViewerCar2Audio() {
    const audio = ensureViewerCar2Audio();
    if (!audio) {
        return;
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 上車音效播放失敗，瀏覽器可能阻擋了自動播放', error);
        });
    }
}

function ensureViewerLookAudio() {
    if (viewerLookAudio) {
        return viewerLookAudio;
    }
    const audio = new Audio(LOOK_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    viewerLookAudio = audio;
    return audio;
}

function stopViewerLookAudio() {
    if (viewerLookAudio) {
        viewerLookAudio.pause();
        viewerLookAudio.currentTime = 0;
    }
}

function playViewerLookAudio() {
    const audio = ensureViewerLookAudio();
    if (!audio) {
        return;
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 回答我音效播放失敗，瀏覽器可能阻擋了自動播放', error);
        });
    }
}

function ensureViewerLumumuAudio() {
    if (viewerLumumuAudio) {
        return viewerLumumuAudio;
    }
    const audio = new Audio(LUMUMU_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    viewerLumumuAudio = audio;
    return audio;
}

function stopViewerLumumuAudio() {
    if (viewerLumumuAudio) {
        viewerLumumuAudio.pause();
        viewerLumumuAudio.currentTime = 0;
    }
}

function playViewerLumumuAudio() {
    const audio = ensureViewerLumumuAudio();
    if (!audio) {
        return;
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 秀燕音效播放失敗，瀏覽器可能阻擋了自動播放', error);
        });
    }
}

function ensureViewerChiikawaAudio() {
    if (viewerChiikawaAudio) {
        return viewerChiikawaAudio;
    }
    const audio = new Audio(CHIIKAWA_AUDIO_PATH);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.7;
    viewerChiikawaAudio = audio;
    return audio;
}

function stopViewerChiikawaAudio() {
    if (viewerChiikawaAudio) {
        viewerChiikawaAudio.pause();
        viewerChiikawaAudio.currentTime = 0;
    }
}

function playViewerChiikawaAudio() {
    const audio = ensureViewerChiikawaAudio();
    if (!audio) {
        return;
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
            console.warn('⚠️ 吉伊卡哇音效播放失敗，瀏覽器可能阻擋了自動播放', error);
        });
    }
}

function ensureViewerPingoTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用皮鼓特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立皮鼓追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerPingoTracker) {
        viewerPingoTracker.setTargets(videoElement, container);
        return viewerPingoTracker;
    }

    viewerPingoTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: PINGO_IMAGE_PATH,
        overlayClassName: 'pingo-overlay',
        overlayImageAlt: '皮鼓特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 1.9,
        verticalOffsetRatio: 0,
        overlayZIndex: 14,
        minConfidence: 0.5,
        flipHorizontal: false,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return viewerPingoTracker;
}

async function startViewerPingoTracking(videoElement, container) {
    const tracker = ensureViewerPingoTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端皮鼓追蹤', error);
    }
}

function stopViewerPingoTracking() {
    if (viewerPingoTracker) {
        viewerPingoTracker.stop();
        viewerPingoTracker = null;
    }
    stopViewerPingoAudio();
}

function ensureViewerSechTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用世間特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立世間追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerSechTracker) {
        viewerSechTracker.setTargets(videoElement, container);
        return viewerSechTracker;
    }

    viewerSechTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: SECH_IMAGE_PATH,
        overlayClassName: 'sech-overlay',
        overlayImageAlt: '世間特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.15,
        verticalOffsetRatio: -0.05,
        overlayZIndex: 15,
        minConfidence: 0.5,
        flipHorizontal: false,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return viewerSechTracker;
}

async function startViewerSechTracking(videoElement, container) {
    const tracker = ensureViewerSechTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端世間追蹤', error);
    }
}

function stopViewerSechTracking() {
    if (viewerSechTracker) {
        viewerSechTracker.stop();
        viewerSechTracker = null;
    }
    stopViewerSechAudio();
}

function ensureViewerLaixiongTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用賴兄特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立賴兄追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerLaixiongTracker) {
        viewerLaixiongTracker.setTargets(videoElement, container);
        return viewerLaixiongTracker;
    }

    viewerLaixiongTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: LAIXIONG_IMAGE_PATH,
        overlayClassName: 'laixiong-overlay',
        overlayImageAlt: '賴兄特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.25,
        verticalOffsetRatio: -0.08,
        overlayZIndex: 16,
        minConfidence: 0.5,
        flipHorizontal: false,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return viewerLaixiongTracker;
}

async function startViewerLaixiongTracking(videoElement, container) {
    const tracker = ensureViewerLaixiongTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端賴兄追蹤', error);
    }
}

function stopViewerLaixiongTracking() {
    if (viewerLaixiongTracker) {
        viewerLaixiongTracker.stop();
        viewerLaixiongTracker = null;
    }
    stopViewerLaixiongAudio();
}

function ensureViewerMaoZedTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用毛主席特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立毛主席追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerMaoZedTracker) {
        viewerMaoZedTracker.setTargets(videoElement, container);
        return viewerMaoZedTracker;
    }

    viewerMaoZedTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: MAO_ZED_IMAGE_PATH,
        overlayClassName: 'mao-overlay',
        overlayImageAlt: '毛主席特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.35,
        verticalOffsetRatio: -0.06,
        overlayZIndex: 17,
        minConfidence: 0.5,
        flipHorizontal: false,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return viewerMaoZedTracker;
}

async function startViewerMaoZedTracking(videoElement, container) {
    const tracker = ensureViewerMaoZedTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端毛主席追蹤', error);
    }
}

function stopViewerMaoZedTracking() {
    if (viewerMaoZedTracker) {
        viewerMaoZedTracker.stop();
        viewerMaoZedTracker = null;
    }
    stopViewerMaoZedAudio();
}

function ensureViewerLaogaoTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用老高特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立老高追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerLaogaoTracker) {
        viewerLaogaoTracker.setTargets(videoElement, container);
        return viewerLaogaoTracker;
    }

    viewerLaogaoTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: LAOGAO_IMAGE_PATH,
        overlayClassName: 'laogao-overlay',
        overlayImageAlt: '老高特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.2,
        verticalOffsetRatio: -0.04,
        overlayZIndex: 18,
        minConfidence: 0.5,
        flipHorizontal: false,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return viewerLaogaoTracker;
}

async function startViewerLaogaoTracking(videoElement, container) {
    const tracker = ensureViewerLaogaoTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端老高追蹤', error);
    }
}

function stopViewerLaogaoTracking() {
    if (viewerLaogaoTracker) {
        viewerLaogaoTracker.stop();
        viewerLaogaoTracker = null;
    }
    stopViewerLaogaoAudio();
}

function ensureViewerGuodongTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用國棟特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立國棟追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerGuodongTracker) {
        viewerGuodongTracker.setTargets(videoElement, container);
        return viewerGuodongTracker;
    }

    viewerGuodongTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: GUODONG_IMAGE_PATH,
        overlayClassName: 'guodong-overlay',
        overlayImageAlt: '國棟特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.3,
        verticalOffsetRatio: -0.05,
        overlayZIndex: 19,
        minConfidence: 0.5,
        flipHorizontal: false,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return viewerGuodongTracker;
}

async function startViewerGuodongTracking(videoElement, container) {
    const tracker = ensureViewerGuodongTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端國棟追蹤', error);
    }
}

function stopViewerGuodongTracking() {
    if (viewerGuodongTracker) {
        viewerGuodongTracker.stop();
        viewerGuodongTracker = null;
    }
    stopViewerGuodongAudio();
}

function ensureViewerHuoguoTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用火鍋特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立火鍋追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerHuoguoTracker) {
        viewerHuoguoTracker.setTargets(videoElement, container);
        return viewerHuoguoTracker;
    }

    viewerHuoguoTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: HUOGUO_IMAGE_PATH,
        overlayClassName: 'huoguo-overlay',
        overlayImageAlt: '火鍋特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.35,
        verticalOffsetRatio: -0.06,
        overlayZIndex: 20,
        minConfidence: 0.5,
        flipHorizontal: false,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return viewerHuoguoTracker;
}

async function startViewerHuoguoTracking(videoElement, container) {
    const tracker = ensureViewerHuoguoTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端火鍋追蹤', error);
    }
}

function stopViewerHuoguoTracking() {
    if (viewerHuoguoTracker) {
        viewerHuoguoTracker.stop();
        viewerHuoguoTracker = null;
    }
    stopViewerHuoguoAudio();
}

function ensureViewerHsinchuTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用新竹特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立新竹追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerHsinchuTracker) {
        viewerHsinchuTracker.setTargets(videoElement, container);
        return viewerHsinchuTracker;
    }

    viewerHsinchuTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: HSINCHU_IMAGE_PATH,
        overlayClassName: 'hsinchu-overlay',
        overlayImageAlt: '新竹特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.32,
        verticalOffsetRatio: -0.05,
        overlayZIndex: 21,
        minConfidence: 0.5,
        flipHorizontal: false,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return viewerHsinchuTracker;
}

async function startViewerHsinchuTracking(videoElement, container) {
    const tracker = ensureViewerHsinchuTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端新竹追蹤', error);
    }
}

function stopViewerHsinchuTracking() {
    if (viewerHsinchuTracker) {
        viewerHsinchuTracker.stop();
        viewerHsinchuTracker = null;
    }
    stopViewerHsinchuAudio();
}

function ensureViewerCarTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用車特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立車追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerCarTracker) {
        viewerCarTracker.setTargets(videoElement, container);
        return viewerCarTracker;
    }

    viewerCarTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: CAR_IMAGE_PATH,
        overlayClassName: 'car-overlay',
        overlayImageAlt: '車特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.28,
        verticalOffsetRatio: -0.04,
        overlayZIndex: 22,
        minConfidence: 0.5,
        flipHorizontal: false,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return viewerCarTracker;
}

async function startViewerCarTracking(videoElement, container) {
    const tracker = ensureViewerCarTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端車追蹤', error);
    }
}

function stopViewerCarTracking() {
    if (viewerCarTracker) {
        viewerCarTracker.stop();
        viewerCarTracker = null;
    }
    stopViewerCarAudio();
}

function ensureViewerCar2Tracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用上車特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立上車追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerCar2Tracker) {
        viewerCar2Tracker.setTargets(videoElement, container);
        return viewerCar2Tracker;
    }

    viewerCar2Tracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: CAR2_IMAGE_PATH,
        overlayClassName: 'car2-overlay',
        overlayImageAlt: '上車特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.5,
        verticalOffsetRatio: -0.02,
        overlayZIndex: 23,
        minConfidence: 0.5,
        flipHorizontal: false,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return viewerCar2Tracker;
}

async function startViewerCar2Tracking(videoElement, container) {
    const tracker = ensureViewerCar2Tracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端上車追蹤', error);
    }
}

function stopViewerCar2Tracking() {
    if (viewerCar2Tracker) {
        viewerCar2Tracker.stop();
        viewerCar2Tracker = null;
    }
    stopViewerCar2Audio();
}

function ensureViewerLookTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用回答我特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立回答我追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerLookTracker) {
        viewerLookTracker.setTargets(videoElement, container);
        return viewerLookTracker;
    }

    viewerLookTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: LOOK_IMAGE_PATH,
        overlayClassName: 'look-overlay',
        overlayImageAlt: '回答我特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.6,
        verticalOffsetRatio: -0.06,
        overlayZIndex: 24,
        minConfidence: 0.5,
        flipHorizontal: false,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return viewerLookTracker;
}

async function startViewerLookTracking(videoElement, container) {
    const tracker = ensureViewerLookTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端回答我追蹤', error);
    }
}

function stopViewerLookTracking() {
    if (viewerLookTracker) {
        viewerLookTracker.stop();
        viewerLookTracker = null;
    }
    stopViewerLookAudio();
}

function ensureViewerLumumuTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用秀燕特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立秀燕追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerLumumuTracker) {
        viewerLumumuTracker.setTargets(videoElement, container);
        return viewerLumumuTracker;
    }

    viewerLumumuTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: LUMUMU_IMAGE_PATH,
        overlayClassName: 'lumumu-overlay',
        overlayImageAlt: '秀燕特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.55,
        verticalOffsetRatio: -0.05,
        overlayZIndex: 24,
        minConfidence: 0.5,
        flipHorizontal: false,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return viewerLumumuTracker;
}

async function startViewerLumumuTracking(videoElement, container) {
    const tracker = ensureViewerLumumuTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端秀燕追蹤', error);
    }
}

function stopViewerLumumuTracking() {
    if (viewerLumumuTracker) {
        viewerLumumuTracker.stop();
        viewerLumumuTracker = null;
    }
    stopViewerLumumuAudio();
}

function ensureViewerChiikawaTracker(videoElement, container) {
    if (typeof createGlassesTracker !== 'function') {
        console.error('❌ 缺少 glasses-tracker 模組，無法啟用吉伊卡哇特效');
        return null;
    }
    if (!videoElement || !container) {
        console.warn('⚠️ 無法建立吉伊卡哇追蹤器: 缺少 video 或容器元素');
        return null;
    }

    if (viewerChiikawaTracker) {
        viewerChiikawaTracker.setTargets(videoElement, container);
        return viewerChiikawaTracker;
    }

    viewerChiikawaTracker = createGlassesTracker({
        videoElement,
        container,
        imagePath: CHIIKAWA_IMAGE_PATH,
        overlayClassName: 'chiikawa-overlay',
        overlayImageAlt: '吉伊卡哇特效',
        modelBasePath: FACE_API_LOCAL_MODEL_PATH,
        fallbackModelBasePath: FACE_API_CDN_MODEL_PATH,
        detectionIntervalMs: 140,
        modelPathFormat: FACE_API_MODEL_PATH_FORMAT,
        additionalModelSources: FACE_API_ADDITIONAL_SOURCES,
        scaleFactor: 2.5,
        verticalOffsetRatio: -0.05,
        overlayZIndex: 24,
        minConfidence: 0.5,
        flipHorizontal: false,
        landmarkStrategy: 'custom',
        anchorLandmarkIndices: FULL_FACE_LANDMARK_INDICES,
        widthLandmarkPair: [0, 16]
    });

    return viewerChiikawaTracker;
}

async function startViewerChiikawaTracking(videoElement, container) {
    const tracker = ensureViewerChiikawaTracker(videoElement, container);
    if (!tracker) {
        return;
    }

    try {
        await tracker.start();
    } catch (error) {
        console.error('❌ 無法啟動觀眾端吉伊卡哇追蹤', error);
    }
}

function stopViewerChiikawaTracking() {
    if (viewerChiikawaTracker) {
        viewerChiikawaTracker.stop();
        viewerChiikawaTracker = null;
    }
    stopViewerChiikawaAudio();
}

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
        } else if (effectType === 'glasses') {
            console.log('🔁 重新啟動眼鏡追蹤');
            stopViewerGlassesTracking();
            showViewerGlassesOverlay(remoteVideo, videoContainer);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (effectType === 'dog') {
            console.log('🔁 重新啟動狗狗追蹤');
            stopViewerDogTracking();
            showViewerDogOverlay(remoteVideo, videoContainer);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (effectType === 'pingo') {
            console.log('🔁 重新啟動皮鼓追蹤');
            stopViewerPingoTracking();
            showViewerPingoOverlay(remoteVideo, videoContainer);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (effectType === 'sech') {
            console.log('🔁 重新啟動世間追蹤');
            stopViewerSechTracking();
            showViewerSechOverlay(remoteVideo, videoContainer);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (effectType === 'laixiong') {
            console.log('🔁 重新啟動賴兄追蹤');
            stopViewerLaixiongTracking();
            showViewerLaixiongOverlay(remoteVideo, videoContainer);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (effectType === 'maoZed') {
            console.log('🔁 重新啟動毛主席追蹤');
            stopViewerMaoZedTracking();
            showViewerMaoZedOverlay(remoteVideo, videoContainer);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (effectType === 'laogao') {
            console.log('🔁 重新啟動老高追蹤');
            stopViewerLaogaoTracking();
            showViewerLaogaoOverlay(remoteVideo, videoContainer);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (effectType === 'guodong') {
            console.log('🔁 重新啟動國棟追蹤');
            stopViewerGuodongTracking();
            showViewerGuodongOverlay(remoteVideo, videoContainer);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (effectType === 'huoguo') {
            console.log('🔁 重新啟動火鍋追蹤');
            stopViewerHuoguoTracking();
            showViewerHuoguoOverlay(remoteVideo, videoContainer);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (effectType === 'hsinchu') {
            console.log('🔁 重新啟動新竹追蹤');
            stopViewerHsinchuTracking();
            showViewerHsinchuOverlay(remoteVideo, videoContainer);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (effectType === 'car') {
            console.log('🔁 重新啟動車追蹤');
            stopViewerCarTracking();
            showViewerCarOverlay(remoteVideo, videoContainer);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (effectType === 'car2') {
            console.log('🔁 重新啟動上車追蹤');
            stopViewerCar2Tracking();
            showViewerCar2Overlay(remoteVideo, videoContainer);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (effectType === 'look') {
            console.log('🔁 重新啟動回答我追蹤');
            stopViewerLookTracking();
            showViewerLookOverlay(remoteVideo, videoContainer);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (effectType === 'lumumu') {
            console.log('🔁 重新啟動秀燕追蹤');
            stopViewerLumumuTracking();
            showViewerLumumuOverlay(remoteVideo, videoContainer);
            ensureRemoteVideoPlaying(remoteVideo);
        } else if (effectType === 'chiikawa') {
            console.log('🔁 重新啟動吉伊卡哇追蹤');
            stopViewerChiikawaTracking();
            showViewerChiikawaOverlay(remoteVideo, videoContainer);
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
            showViewerGlassesOverlay(remoteVideo, videoContainer);
            break;
        case 'dog':
            showViewerDogOverlay(remoteVideo, videoContainer);
            break;
        case 'pingo':
            showViewerPingoOverlay(remoteVideo, videoContainer);
            break;
        case 'sech':
            showViewerSechOverlay(remoteVideo, videoContainer);
            break;
        case 'laixiong':
            showViewerLaixiongOverlay(remoteVideo, videoContainer);
            break;
        case 'maoZed':
            showViewerMaoZedOverlay(remoteVideo, videoContainer);
            break;
        case 'laogao':
            showViewerLaogaoOverlay(remoteVideo, videoContainer);
            break;
        case 'guodong':
            showViewerGuodongOverlay(remoteVideo, videoContainer);
            break;
        case 'huoguo':
            showViewerHuoguoOverlay(remoteVideo, videoContainer);
            break;
        case 'hsinchu':
            showViewerHsinchuOverlay(remoteVideo, videoContainer);
            break;
        case 'car':
            showViewerCarOverlay(remoteVideo, videoContainer);
            break;
        case 'car2':
            showViewerCar2Overlay(remoteVideo, videoContainer);
            break;
        case 'look':
            showViewerLookOverlay(remoteVideo, videoContainer);
            break;
        case 'lumumu':
            showViewerLumumuOverlay(remoteVideo, videoContainer);
            break;
        case 'chiikawa':
            showViewerChiikawaOverlay(remoteVideo, videoContainer);
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

    stopViewerGlassesTracking();
    stopViewerDogTracking();
    stopViewerPingoTracking();
    stopViewerSechTracking();
    stopViewerLaixiongTracking();
    stopViewerMaoZedTracking();
    stopViewerLaogaoTracking();
    stopViewerGuodongTracking();
    stopViewerHuoguoTracking();
    stopViewerHsinchuTracking();
    stopViewerCarTracking();
    stopViewerCar2Tracking();
    stopViewerLookTracking();
    stopViewerLumumuTracking();
    stopViewerChiikawaTracking();

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
    const overlays = container ? container.querySelectorAll('.glasses-overlay, .dog-overlay, .pingo-overlay, .sech-overlay, .laixiong-overlay, .mao-overlay, .laogao-overlay, .guodong-overlay, .huoguo-overlay, .hsinchu-overlay, .car-overlay, .car2-overlay, .look-overlay, .lumumu-overlay, .chiikawa-overlay') : null;
    if (overlays) {
        overlays.forEach((overlay) => overlay.remove());
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

function showViewerGlassesOverlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerGlassesTracking(videoElement, targetContainer);
}

function showViewerDogOverlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerDogTracking(videoElement, targetContainer);
}

function showViewerPingoOverlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerPingoTracking(videoElement, targetContainer);
    playViewerPingoAudio();
}

function showViewerLumumuOverlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerLumumuTracking(videoElement, targetContainer);
    playViewerLumumuAudio();
}

function showViewerChiikawaOverlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerChiikawaTracking(videoElement, targetContainer);
    playViewerChiikawaAudio();
}

function showViewerSechOverlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerSechTracking(videoElement, targetContainer);
    playViewerSechAudio();
}

function showViewerLaixiongOverlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerLaixiongTracking(videoElement, targetContainer);
    playViewerLaixiongAudio();
}

function showViewerMaoZedOverlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerMaoZedTracking(videoElement, targetContainer);
    playViewerMaoZedAudio();
}

function showViewerLaogaoOverlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerLaogaoTracking(videoElement, targetContainer);
    playViewerLaogaoAudio();
}

function showViewerGuodongOverlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerGuodongTracking(videoElement, targetContainer);
    playViewerGuodongAudio();
}

function showViewerHuoguoOverlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerHuoguoTracking(videoElement, targetContainer);
    playViewerHuoguoAudio();
}

function showViewerHsinchuOverlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerHsinchuTracking(videoElement, targetContainer);
    playViewerHsinchuAudio();
}

function showViewerCarOverlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerCarTracking(videoElement, targetContainer);
    playViewerCarAudio();
}

function showViewerLookOverlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerLookTracking(videoElement, targetContainer);
    playViewerLookAudio();
}

function showViewerCar2Overlay(videoElement, container) {
    const targetContainer = container || videoElement?.parentElement;
    if (!videoElement || !targetContainer) {
        return;
    }
    startViewerCar2Tracking(videoElement, targetContainer);
    playViewerCar2Audio();
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
