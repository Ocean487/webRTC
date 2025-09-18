// ?典?霈
let localStream = null;
let isStreaming = false;
let isVideoEnabled = true;
let isAudioEnabled = true;
let currentFacingMode = 'user'; // 'user' or 'environment'
let streamStartTime = null;
let durationInterval = null;
let messageCount = 0;
let viewerCount = 0;
let currentQuality = '720';
let dataTransferInterval = null;
let currentAudioOutput = null; // ?嗅??唾?頛詨蝡?
// 銝餅ID?賊?
let myBroadcasterId = null;

// ?脣?銝餅ID???function getBroadcasterId() {
    if (!myBroadcasterId) {
        // ??閰血?URL??脣?
        const urlParams = new URLSearchParams(window.location.search);
        const urlBroadcasterId = urlParams.get('broadcaster');
        
        if (urlBroadcasterId) {
            myBroadcasterId = urlBroadcasterId;
        } else if (window.currentUser && window.currentUser.id) {
            // ?箸?嗅??冽ID??
            myBroadcasterId = `broadcaster_${window.currentUser.id}`;
        } else {
            // ?敺?隞踝?雿輻????            myBroadcasterId = `broadcaster_${Date.now()}`;
        }
    }
    return myBroadcasterId;
}

// ???唾??賊?霈
let tabAudioStream = null;
let isTabAudioEnabled = false;
let audioContext = null;
let mixedAudioStream = null;

// WebSocket ??
let streamingSocket = null;
let peerConnections = new Map(); // viewerId -> RTCPeerConnection

// WebRTC ?蔭 - ?芸?閬蝺函Ⅳ?澆捆??const constraints = {
    video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
        facingMode: 'user'
    },
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: { ideal: 48000 },
        channelCount: { ideal: 2 }
    }
};

// WebRTC ???蔭 - 憓撥蝺刻圾蝣澆?舀
const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' },
        { urls: 'stun:stun.l.google.com:19305' }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
};

// ????document.addEventListener('DOMContentLoaded', function() {
    loadDevices();
    checkAudioOutputSupport();
    simulateInitialActivity();
    // ?券??Ｚ??交?撠勗遣蝡?WebSocket ??隞交?渲?憭拙???    connectToStreamingServer();
});

// 蝣箔??唾?頠?甇?Ⅱ?
function ensureAudioTracksEnabled(stream) {
    if (!stream) return;
    
    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach(track => {
        if (track.readyState === 'live') {
            track.enabled = true;
            console.log('?唾?頠?撌脣???', track.id, '???', track.readyState);
        } else {
            console.warn('?唾?頠???撣?', track.id, '???', track.readyState);
        }
    });
}

// 瑼Ｘ?唾?頛詨蝡舀??function checkAudioOutputSupport() {
    const localVideo = document.getElementById('localVideo');
    if (!localVideo.setSinkId) {
        addMessage('蝟餌絞', '?? ?函??汗?其??舀?唾?頛詨蝡臬????踝?撠蝙?券?閮剛撓?箇垢');
        console.warn('?汗?其??舀 setSinkId API');
        return false;
    }
    
    // 瑼Ｘ?臬?舀?唾?頛詨蝡臬???    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        addMessage('蝟餌絞', '?? ?函??汗?其??舀鋆蔭???');
        console.warn('?汗?其??舀 enumerateDevices API');
        return false;
    }
    
    console.log('?唾?頛詨蝡臬??賣?湔迤撣?);
    return true;
}

// 頛?舐鋆蔭
async function loadDevices() {
    try {
        // ??瘙??誑?脣?鋆蔭璅惜
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const cameras = devices.filter(device => device.kind === 'videoinput');
        const microphones = devices.filter(device => device.kind === 'audioinput');
        const speakers = devices.filter(device => device.kind === 'audiooutput');

        const cameraSelect = document.getElementById('cameraSelect');
        const microphoneSelect = document.getElementById('microphoneSelect');
        const audioOutputSelect = document.getElementById('audioOutputSelect');

        // 頛?蔣璈?        cameraSelect.innerHTML = '';
        cameras.forEach((camera, index) => {
            const option = document.createElement('option');
            option.value = camera.deviceId;
            option.textContent = camera.label || `?蔣璈?${index + 1}`;
            cameraSelect.appendChild(option);
        });

        // 頛暻亙?憸?        microphoneSelect.innerHTML = '';
        microphones.forEach((mic, index) => {
            const option = document.createElement('option');
            option.value = mic.deviceId;
            option.textContent = mic.label || `暻亙?憸?${index + 1}`;
            microphoneSelect.appendChild(option);
        });

        // 頛?唾?頛詨蝡?        audioOutputSelect.innerHTML = '';
        
        // 瘛餃??身?賊?
        const defaultOption = document.createElement('option');
        defaultOption.value = 'default';
        defaultOption.textContent = '?身?唾?頛詨蝡?;
        audioOutputSelect.appendChild(defaultOption);
        
        // 瘛餃?瑼Ｘ葫?啁??唾?頛詨蝡?        speakers.forEach((speaker, index) => {
            const option = document.createElement('option');
            option.value = speaker.deviceId;
            option.textContent = speaker.label || `?唾?頛詨蝡?${index + 1}`;
            audioOutputSelect.appendChild(option);
        });

        console.log('瑼Ｘ葫?啁??唾?頛詨蝡?', speakers.length, speakers.map(s => s.label));

    } catch (error) {
        console.error('?⊥?頛鋆蔭?”:', error);
        addMessage('蝟餌絞', '?? ?⊥?瑼Ｘ葫?唾?閮?蝵殷?隢炎?亦汗?冽???);
    }
}

// ??/?迫?湔
async function toggleStream() {
    if (!isStreaming) {
        await startStream();
    } else {
        stopStream();
    }
}

// ???湔
async function startStream() {
    try {
        // 蝪∪????脣? - ?芰??敶望??漸?◢
        // YouTube?唾?撠?蝟餌絞?單?瘛瑕
        const userStream = await navigator.mediaDevices.getUserMedia(getConstraints());
        
        // ?湔雿輻?冽慦?瘚?銝脰?銴??閮毽??        localStream = userStream;
        
        // 憿舐內?砍閬?
        const localVideo = document.getElementById('localVideo');
        const placeholder = document.getElementById('previewPlaceholder');
        
        localVideo.srcObject = localStream;
        localVideo.style.display = 'block';
        placeholder.style.display = 'none';

        // 蝣箔??唾?頠?甇?Ⅱ?
        ensureAudioTracksEnabled(localStream);

        console.log('?湔瘚歇??嚗ouTube?唾?撠?蝟餌絞?單?瘛瑕');

        // 閮剔蔭?唾?頛詨蝡荔?憒?撌脤??
        if (currentAudioOutput && currentAudioOutput !== 'default') {
            try {
                if (localVideo.setSinkId) {
                    await localVideo.setSinkId(currentAudioOutput);
                    console.log('撌脰身蝵桅閮撓?箇垢:', currentAudioOutput);
                    
                    // ?脣?鋆蔭?迂銝阡＊蝷?                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const selectedDevice = devices.find(device => 
                        device.kind === 'audiooutput' && device.deviceId === currentAudioOutput
                    );
                    const deviceName = selectedDevice ? selectedDevice.label : '?身?唾?頛詨蝡?;
                    addMessage('蝟餌絞', `?? ?唾?頛詨蝡臬歇閮剔蔭?? ${deviceName}`);
                    
                    // 蝣箔??唾??剜
                    try {
                        await localVideo.play();
                        console.log('?唾?撌脤?憪??);
                    } catch (playError) {
                        console.warn('?芸??剜憭望?:', playError);
                        addMessage('蝟餌絞', '?? 隢???閮?Ｖ誑???剜?唾?');
                    }
                }
            } catch (error) {
                console.warn('閮剔蔭?唾?頛詨蝡臬仃??', error);
                addMessage('蝟餌絞', '?? ?唾?頛詨蝡航身蝵桀仃??雿輻?身頛詨蝡?);
            }
        } else {
            addMessage('蝟餌絞', '?? 雿輻?身?唾?頛詨蝡?);
            
            // 蝣箔??唾??剜
            try {
                await localVideo.play();
                console.log('?唾?撌脤?憪??);
            } catch (playError) {
                console.warn('?芸??剜憭望?:', playError);
                addMessage('蝟餌絞', '?? 隢???閮?Ｖ誑???剜?唾?');
            }
        }

        // ?湔 UI ???        isStreaming = true;
        window.isStreaming = isStreaming; // 蝣箔??典??航赤??        window.localStream = localStream; // 蝣箔??典??航赤??        updateStreamStatus(true);
        startStreamTimer();
        // simulateViewers();

        addMessage('蝟餌絞', '?? ?湔撌脤?憪?閫?曉隞亦??唬???Ｖ?');

        // 璅⊥?豢??唾撓
        simulateDataTransfer();
        
        // 蝣箔? WebSocket ??撌脣遣蝡??虜撌脣?頛?遣蝡?
        if (!streamingSocket || streamingSocket.readyState !== WebSocket.OPEN) {
            connectToStreamingServer();
        }
        
        // 蝑? WebSocket ??撱箇?敺???函?剖歇??
        setTimeout(() => {
            if (streamingSocket && streamingSocket.readyState === WebSocket.OPEN) {
                // ?脣??湔璅?
                const titleInput = document.getElementById('streamTitleInput');
                const streamTitle = titleInput ? titleInput.value.trim() : '';
                const finalTitle = streamTitle || '蝎曉蔗?湔銝?;
                
                // 蝣箔?銝餅蝡舐?璅?憿舐內銋??                if (titleInput && !streamTitle) {
                    titleInput.value = finalTitle;
                }
                
                // ?湔銝餅蝡舀?憿＊蝷?                updateStreamTitle();
                
                console.log('?潮?剝?憪?隞塚?璅?:', finalTitle);
                
                // ????函?剝?憪?銝西?瘙歇?函?閫?曉?銵?                streamingSocket.send(JSON.stringify({
                    type: 'stream_start',
                    title: finalTitle,
                    message: '銝餅撌脤?憪??,
                    timestamp: Date.now(),
                    requestViewers: true // 隢??嗅??函?閫?曉?銵?                }));
                
                addMessage('蝟餌絞', `?? ?湔撌脤?憪?璅?: ${finalTitle}`);
                addMessage('蝟餌絞', '?? 甇??箇???曉遣蝡?...');
            }
        }, 1000);

    } catch (error) {
        console.error('?⊥????湔:', error);
        
        let errorMessage = '?⊥????湔: ';
        if (error.name === 'NotAllowedError') {
            errorMessage += '隢?閮勗???敶望??漸?◢甈?';
        } else if (error.name === 'NotFoundError') {
            errorMessage += '?曆??唳?敶望??漸?◢鋆蔭';
        } else {
            errorMessage += error.message;
        }
        
        addMessage('蝟餌絞', '??' + errorMessage);
        
        // 憿舐內甈?隢??內
        showPermissionRequest();
    }
}

// ?迫?湔
function stopStream() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // ?梯?閬?嚗＊蝷粹?閬?    const localVideo = document.getElementById('localVideo');
    const placeholder = document.getElementById('previewPlaceholder');
    
    localVideo.style.display = 'none';
    placeholder.style.display = 'flex';

    // ?蔭???    isStreaming = false;
    updateStreamStatus(false);
    stopStreamTimer();
    resetStats();
    
    // ?????WebRTC ??
    peerConnections.forEach(connection => {
        connection.close();
    });
    peerConnections.clear();
    
    // ????函?剔???    if (streamingSocket) {
        streamingSocket.send(JSON.stringify({
            type: 'stream_end',
            broadcasterId: getBroadcasterId()
        }));
    }

    addMessage('蝟餌絞', '? ?湔撌脩?????閫??');
}

// ?脣?蝝?璇辣
function getConstraints() {
    const quality = getQualitySettings(currentQuality);
    return {
        video: {
            ...quality,
            facingMode: currentFacingMode,
            deviceId: document.getElementById('cameraSelect').value || undefined
        },
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            deviceId: document.getElementById('microphoneSelect').value || undefined
        }
    };
}

// ?脣??怨釭閮剖?
function getQualitySettings(quality) {
    const settings = {
        '480': { width: { ideal: 854 }, height: { ideal: 480 } },
        '720': { width: { ideal: 1280 }, height: { ideal: 720 } },
        '1080': { width: { ideal: 1920 }, height: { ideal: 1080 } }
    };
    return settings[quality] || settings['720'];
}

// ??閬?
async function toggleVideo() {
    if (!localStream) return;

    const videoTracks = localStream.getVideoTracks();
    videoTracks.forEach(track => {
        track.enabled = !track.enabled;
    });

    isVideoEnabled = !isVideoEnabled;
    const btn = document.getElementById('videoBtn');
    btn.textContent = isVideoEnabled ? '? ??閬?' : '? ??閬?';

    addMessage('蝟餌絞', isVideoEnabled ? '? 閬?撌脤??? : '? 閬?撌脤???);
    
    // ?湔????曄?頠????    if (isStreaming) {
        const viewerIds = Array.from(peerConnections.keys());
        for (const viewerId of viewerIds) {
            await updatePeerConnectionTracks(viewerId);
        }
    }
}

// ???唾?
async function toggleAudio() {
    if (!localStream) return;

    const audioTracks = localStream.getAudioTracks();
    audioTracks.forEach(track => {
        track.enabled = !track.enabled;
    });

    isAudioEnabled = !isAudioEnabled;
    const btn = document.getElementById('audioBtn');
    btn.textContent = isAudioEnabled ? '? ???唾?' : '? ???唾?';

    addMessage('蝟餌絞', isAudioEnabled ? '? ?唾?撌脤??? : '? ?唾?撌脤???);
    
    // ?湔????曄?頠????    if (isStreaming) {
        const viewerIds = Array.from(peerConnections.keys());
        for (const viewerId of viewerIds) {
            await updatePeerConnectionTracks(viewerId);
        }
    }
}

// ???⊿
async function switchCamera() {
    if (!isStreaming) return;

    try {
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        
        // 靽??嗅??閮???        const currentAudioTrack = localStream ? localStream.getAudioTracks()[0] : null;
        
        // ?芸?甇Ｚ?閮???靽??唾?頠?
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            videoTracks.forEach(track => track.stop());
        }

        // ???慦?銝脫?嚗?閬?嚗?        const videoConstraints = getConstraints();
        const newVideoStream = await navigator.mediaDevices.getUserMedia(videoConstraints);
        
        // ?萄遣?啁?銝脫?嚗??急??閮??????閮???        const newStream = new MediaStream();
        
        // 瘛餃??啁?閬?頠?
        newVideoStream.getVideoTracks().forEach(track => {
            newStream.addTrack(track);
        });
        
        // 靽????閮???        if (currentAudioTrack && currentAudioTrack.readyState === 'live') {
            newStream.addTrack(currentAudioTrack);
            console.log('靽????唾?頠?嚗??D:', currentAudioTrack.id);
        }
        
        // ?湔?砍銝脫?
        localStream = newStream;
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;
        
        // 蝣箔??唾?頠??
        const newAudioTracks4 = localStream.getAudioTracks();
        newAudioTracks4.forEach(track => {
            track.enabled = true;
            console.log('?唾?頠?撌脣???', track.id, '???', track.readyState);
        });

        // ?閮剔蔭?唾?頛詨蝡?        if (currentAudioOutput && currentAudioOutput !== 'default') {
            try {
                const localVideo = document.getElementById('localVideo');
                if (localVideo.setSinkId) {
                    await localVideo.setSinkId(currentAudioOutput);
                    console.log('撌脤??啗身蝵桅閮撓?箇垢:', currentAudioOutput);
                }
            } catch (error) {
                console.warn('?閮剔蔭?唾?頛詨蝡臬仃??', error);
            }
        }

        const cameraType = currentFacingMode === 'user' ? '??? : '敺??;
        addMessage('蝟餌絞', `?? 撌脣??${cameraType}嚗閮???霈);
        
        // ?湔???WebRTC ??????        await updateAllPeerConnections();
    } catch (error) {
        console.error('???⊿憭望?:', error);
        addMessage('蝟餌絞', '???⊿??憭望?');
    }
}

// ?澈?Ｗ?
async function shareScreen() {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { 
                cursor: 'always',
                displaySurface: 'monitor'
            },
            audio: true
        });

        // 靽??嗅??閮???憒???閰梧?
        const currentAudioTrack = localStream ? localStream.getAudioTracks()[0] : null;
        
        // ?芸?甇Ｚ?閮???靽??唾?頠?
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            videoTracks.forEach(track => track.stop());
        }

        // ?萄遣?啁?銝脫?嚗??怨撟?鈭怎?閬?頠??????唾?頠?
        const newStream = new MediaStream();
        
        // 瘛餃??Ｗ??澈??閮???        screenStream.getVideoTracks().forEach(track => {
            newStream.addTrack(track);
        });
        
        // 靽????閮???憒?摮銝???
        if (currentAudioTrack && currentAudioTrack.readyState === 'live') {
            newStream.addTrack(currentAudioTrack);
            console.log('靽????唾?頠?嚗??D:', currentAudioTrack.id);
        } else {
            // 憒?瘝????唾?頠?嚗溶?撟?鈭怎??唾?頠?
            screenStream.getAudioTracks().forEach(track => {
                newStream.addTrack(track);
            });
        }

        // ?湔?砍銝脫?銝西身蝵桀閬???
        localStream = newStream;
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;
        
        // 蝣箔??唾?頠??
        const newAudioTracks = localStream.getAudioTracks();
        newAudioTracks.forEach(track => {
            track.enabled = true;
            console.log('?唾?頠?撌脣???', track.id, '???', track.readyState);
        });

        // ?閮剔蔭?唾?頛詨蝡?        if (currentAudioOutput && currentAudioOutput !== 'default') {
            try {
                const localVideo = document.getElementById('localVideo');
                if (localVideo.setSinkId) {
                    await localVideo.setSinkId(currentAudioOutput);
                    console.log('撌脤??啗身蝵桅閮撓?箇垢:', currentAudioOutput);
                }
            } catch (error) {
                console.warn('?閮剔蔭?唾?頛詨蝡臬仃??', error);
            }
        }

        addMessage('蝟餌絞', '?儭??Ｗ??澈撌脤?憪??唾?靽?銝?');

        // ???Ｗ??澈蝯?
        screenStream.getVideoTracks()[0].onended = () => {
            addMessage('蝟餌絞', '?儭??Ｗ??澈撌脩???);
            // ?臭誑?豢????蔣璈?蝯??湔
        };

        // ?湔????曄?頠?
        if (isStreaming) {
            await updateAllPeerConnections();
        }

    } catch (error) {
        console.error('?Ｗ??澈憭望?:', error);
        addMessage('蝟餌絞', '???Ｗ??澈憭望?');
    }
}

// ???怨釭
async function changeQuality() {
    if (!isStreaming) {
        currentQuality = document.getElementById('qualitySelect').value;
        document.getElementById('currentQuality').textContent = currentQuality + 'p';
        return;
    }

    try {
        currentQuality = document.getElementById('qualitySelect').value;
        
        // 靽??嗅??閮???        const currentAudioTrack = localStream ? localStream.getAudioTracks()[0] : null;
        
        // ?芷??圈?蝵株?閮???        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            const quality = getQualitySettings(currentQuality);
            await videoTracks[0].applyConstraints(quality);
            document.getElementById('currentQuality').textContent = currentQuality + 'p';
            addMessage('蝟餌絞', `? ?怨釭撌脣?? ${currentQuality}p嚗閮???霈);
        }

    } catch (error) {
        console.error('?怨釭??憭望?:', error);
        addMessage('蝟餌絞', '???怨釭??憭望?');
    }
}

// ??閬?鋆蔭
async function switchVideoDevice() {
    if (!isStreaming) return;

    try {
        // 靽??嗅??閮???        const currentAudioTrack = localStream ? localStream.getAudioTracks()[0] : null;
        
        // ?芸?甇Ｚ?閮???        const videoTracks = localStream.getVideoTracks();
        videoTracks.forEach(track => track.stop());

        const newStream = await navigator.mediaDevices.getUserMedia({
            video: {
                ...getQualitySettings(currentQuality),
                deviceId: document.getElementById('cameraSelect').value
            },
            audio: false
        });

        // ?萄遣?啁?銝脫?嚗??急??閮??????閮???        const combinedStream = new MediaStream();
        
        // 瘛餃??啁?閬?頠?
        newStream.getVideoTracks().forEach(track => {
            combinedStream.addTrack(track);
        });
        
        // 靽????閮???        if (currentAudioTrack && currentAudioTrack.readyState === 'live') {
            combinedStream.addTrack(currentAudioTrack);
            console.log('靽????唾?頠?嚗??D:', currentAudioTrack.id);
        }

        // ?湔?砍銝脫?
        localStream = combinedStream;
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;
        
        // 蝣箔??唾?頠??
        const newAudioTracks2 = localStream.getAudioTracks();
        newAudioTracks2.forEach(track => {
            track.enabled = true;
            console.log('?唾?頠?撌脣???', track.id, '???', track.readyState);
        });

        // ?閮剔蔭?唾?頛詨蝡?        if (currentAudioOutput && currentAudioOutput !== 'default') {
            try {
                const localVideo = document.getElementById('localVideo');
                if (localVideo.setSinkId) {
                    await localVideo.setSinkId(currentAudioOutput);
                    console.log('撌脤??啗身蝵桅閮撓?箇垢:', currentAudioOutput);
                }
            } catch (error) {
                console.warn('?閮剔蔭?唾?頛詨蝡臬仃??', error);
            }
        }
        
        addMessage('蝟餌絞', '? ?蔣璈歇??嚗閮???霈?);

        // ?湔????曄?頠?
        if (isStreaming) {
            await updateAllPeerConnections();
        }

    } catch (error) {
        console.error('?蔣璈??仃??', error);
        addMessage('蝟餌絞', '???蔣璈??仃??);
    }
}

// 瑼Ｘ?嗅??唾?頛詨蝡舐???async function checkAudioOutputStatus() {
    try {
        const localVideo = document.getElementById('localVideo');
        
        if (!localVideo.setSinkId) {
            addMessage('蝟餌絞', '?? ?汗?其??舀?唾?頛詨蝡臬???);
            return;
        }
        
        // ?脣??嗅??唾?頛詨蝡?        const currentSinkId = localVideo.sinkId || 'default';
        
        // ?脣???閮撓?箇垢
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
        
        // ?曉?嗅?雿輻?撓?箇垢
        const currentDevice = audioOutputs.find(device => device.deviceId === currentSinkId);
        const deviceName = currentDevice ? currentDevice.label : '?身?唾?頛詨蝡?;
        
        // 瑼Ｘ?唾?頠????        const audioTracks = localStream ? localStream.getAudioTracks() : [];
        const enabledTracks = audioTracks.filter(track => track.enabled);
        
        let statusMessage = `?? ?嗅??唾?頛詨蝡? ${deviceName}\n`;
        statusMessage += `?? ?唾?頠?: ${audioTracks.length} ??(${enabledTracks.length} ????\n`;
        statusMessage += `?塚? ?剜??? ${localVideo.paused ? '?怠?' : '?剜銝?}\n`;
        statusMessage += `?? ?喲?: ${Math.round(localVideo.volume * 100)}%`;
        
        addMessage('蝟餌絞', statusMessage);
        
        console.log('?唾?頛詨蝡舐???', {
            sinkId: currentSinkId,
            deviceName: deviceName,
            audioTracks: audioTracks.length,
            enabledTracks: enabledTracks.length,
            paused: localVideo.paused,
            volume: localVideo.volume
        });
        
    } catch (error) {
        console.error('瑼Ｘ?唾?頛詨蝡舐??仃??', error);
        addMessage('蝟餌絞', '??瑼Ｘ?唾?頛詨蝡舐??仃??);
    }
}

// 皜祈岫?唾?頛詨蝡?async function testAudioOutput() {
    try {
        const selectedOutputId = document.getElementById('audioOutputSelect').value;
        const localVideo = document.getElementById('localVideo');
        
        if (!localVideo.setSinkId) {
            addMessage('蝟餌絞', '?? ?函??汗?其??舀?唾?頛詨蝡臬?????);
            return;
        }

        // 憒?甇??湔嚗蝙?典祕??閬???皜祈岫
        if (isStreaming && localStream) {
            try {
                // ???圈???唾?頛詨蝡?                await localVideo.setSinkId(selectedOutputId);
                
                // ?脣?鋆蔭?迂
                const devices = await navigator.mediaDevices.enumerateDevices();
                const selectedDevice = devices.find(device => 
                    device.kind === 'audiooutput' && device.deviceId === selectedOutputId
                );
                const deviceName = selectedDevice ? selectedDevice.label : '?身?唾?頛詨蝡?;
                
                addMessage('蝟餌絞', `?? 甇?皜祈岫?唾?頛詨蝡? ${deviceName}`);
                
                // 蝣箔?閬??剜
                if (localVideo.paused) {
                    await localVideo.play();
                }
                
                // 3蝘??Ｗ儔???撓?箇垢
                setTimeout(async () => {
                    if (currentAudioOutput && currentAudioOutput !== 'default') {
                        await localVideo.setSinkId(currentAudioOutput);
                    }
                    addMessage('蝟餌絞', '?? ?唾?皜祈岫摰?嚗歇?Ｗ儔?撓?箇垢');
                }, 3000);
                
            } catch (error) {
                console.error('?唾?皜祈岫憭望?:', error);
                addMessage('蝟餌絞', '???唾?皜祈岫憭望?: ' + error.message);
            }
        } else {
            // 憒?瘝??湔嚗撱箸葫閰阡閮?            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 ?喟泵
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // ???喲?
            
            oscillator.start();
            
            // ?剜 1 蝘??迫
            setTimeout(() => {
                oscillator.stop();
                addMessage('蝟餌絞', '?? ?唾?皜祈岫摰?');
            }, 1000);
        }
        
    } catch (error) {
        console.error('?唾?皜祈岫憭望?:', error);
        addMessage('蝟餌絞', '???唾?皜祈岫憭望?');
    }
}

// ???唾?頛詨蝡?async function switchAudioOutput() {
    try {
        const selectedOutputId = document.getElementById('audioOutputSelect').value;
        const localVideo = document.getElementById('localVideo');
        
        // 瑼Ｘ?汗?冽?行??setSinkId
        if (!localVideo.setSinkId) {
            addMessage('蝟餌絞', '?? ?函??汗?其??舀?唾?頛詨蝡臬?????);
            return;
        }

        if (!isStreaming) {
            currentAudioOutput = selectedOutputId;
            addMessage('蝟餌絞', '?? ?唾?頛詨蝡臬歇閮剖?嚗?憪?剖???');
            return;
        }

        // ???唾?頛詨蝡?        await localVideo.setSinkId(selectedOutputId);
        currentAudioOutput = selectedOutputId;
        
        // ?脣?鋆蔭?迂
        const devices = await navigator.mediaDevices.enumerateDevices();
        const selectedDevice = devices.find(device => 
            device.kind === 'audiooutput' && device.deviceId === selectedOutputId
        );
        const deviceName = selectedDevice ? selectedDevice.label : '?身?唾?頛詨蝡?;
        
        addMessage('蝟餌絞', `?? ?唾?頛詨蝡臬歇???? ${deviceName}`);
        
        console.log('?唾?頛詨蝡臬歇????', deviceName, 'ID:', selectedOutputId);
        
        // 蝣箔??唾??剜
        if (localVideo.paused) {
            try {
                await localVideo.play();
                console.log('?唾?撌脤?憪??);
                addMessage('蝟餌絞', '?塚? ?唾?撌脤?憪??);
            } catch (error) {
                console.warn('?芸??剜憭望?:', error);
                addMessage('蝟餌絞', '?? 隢???閮?Ｖ誑???剜?唾?');
            }
        } else {
            console.log('閬?撌脣?剜銝?);
        }
        
        // 瑼Ｘ?唾?頠????        const audioTracks = localStream ? localStream.getAudioTracks() : [];
        const enabledTracks = audioTracks.filter(track => track.enabled);
        console.log('?唾?頠????', {
            total: audioTracks.length,
            enabled: enabledTracks.length,
            tracks: audioTracks.map(track => ({
                id: track.id,
                enabled: track.enabled,
                readyState: track.readyState
            }))
        });
        
    } catch (error) {
        console.error('???唾?頛詨蝡臬仃??', error);
        
        let errorMessage = '???唾?頛詨蝡臬仃?? ';
        if (error.name === 'NotAllowedError') {
            errorMessage += '隢?閮勗??閮撓?箇垢甈?';
        } else if (error.name === 'NotFoundError') {
            errorMessage += '?曆??唳?摰??唾?頛詨蝡?;
        } else {
            errorMessage += error.message;
        }
        
        addMessage('蝟餌絞', '??' + errorMessage);
    }
}

// ???唾?鋆蔭
async function switchAudioDevice() {
    if (!isStreaming) return;

    try {
        // 靽??嗅???閮???        const currentVideoTrack = localStream ? localStream.getVideoTracks()[0] : null;
        
        // ?芸?甇ａ閮???        const audioTracks = localStream.getAudioTracks();
        audioTracks.forEach(track => track.stop());

        const newStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                deviceId: document.getElementById('microphoneSelect').value
            }
        });

        // ?萄遣?啁?銝脫?嚗??急?閮???????閮???        const combinedStream = new MediaStream();
        
        // 瘛餃??啁??唾?頠?
        newStream.getAudioTracks().forEach(track => {
            combinedStream.addTrack(track);
        });
        
        // 靽?????閮???        if (currentVideoTrack && currentVideoTrack.readyState === 'live') {
            combinedStream.addTrack(currentVideoTrack);
            console.log('靽???閬?頠?嚗??D:', currentVideoTrack.id);
        }

        // ?湔?砍銝脫?
        localStream = combinedStream;
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;
        
        // 蝣箔??唾?頠??
        const newAudioTracks3 = localStream.getAudioTracks();
        newAudioTracks3.forEach(track => {
            track.enabled = true;
            console.log('?唾?頠?撌脣???', track.id, '???', track.readyState);
        });

        // ?閮剔蔭?唾?頛詨蝡?        if (currentAudioOutput && currentAudioOutput !== 'default') {
            try {
                const localVideo = document.getElementById('localVideo');
                if (localVideo.setSinkId) {
                    await localVideo.setSinkId(currentAudioOutput);
                    console.log('撌脤??啗身蝵桅閮撓?箇垢:', currentAudioOutput);
                }
            } catch (error) {
                console.warn('?閮剔蔭?唾?頛詨蝡臬仃??', error);
            }
        }
        
        addMessage('蝟餌絞', '? 暻亙?憸典歇??嚗?閮???霈?);

        // ?湔????曄?頠?
        if (isStreaming) {
            await updateAllPeerConnections();
        }

    } catch (error) {
        console.error('暻亙?憸典??仃??', error);
        addMessage('蝟餌絞', '??暻亙?憸典??仃??);
    }
}

// ?芸??
function takeScreenshot() {
    if (!localStream) return;

    const canvas = document.createElement('canvas');
    const video = document.getElementById('localVideo');
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // 銝??芸?
    const link = document.createElement('a');
    link.download = `screenshot_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    link.href = canvas.toDataURL();
    link.click();

    addMessage('蝟餌絞', '? ?芸?撌脖?頛?);
}

// ?刻撟???function toggleFullscreen() {
    const videoContainer = document.querySelector('.video-container');
    
    if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().catch(err => {
            console.error('?刻撟仃??', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// ?湔?湔???function updateStreamStatus(isLive) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const streamBtn = document.getElementById('streamBtn');

    // 瘛餃?null瑼Ｘ
    if (!statusDot || !statusText || !streamBtn) {
        console.error('?⊥??曉敹??I??:', {
            statusDot: !!statusDot,
            statusText: !!statusText,
            streamBtn: !!streamBtn
        });
        return;
    }

    if (isLive) {
        statusDot.classList.add('live');
        statusText.textContent = '?湔銝?;
        statusText.classList.add('live-status'); // 瘛餃??湔???
        streamBtn.textContent = '?對? ?迫?湔';
        streamBtn.classList.add('streaming');
        
        // 銋?啁?剔?Ｗ??????        const streamStatusDot = document.getElementById('streamStatusDot');
        const streamStatusText = document.getElementById('streamStatusText');
        if (streamStatusDot && streamStatusText) {
            streamStatusDot.classList.add('live');
            streamStatusText.textContent = '?湔銝?;
            streamStatusText.classList.add('live-status');
        }
    } else {
        statusDot.classList.remove('live');
        statusText.classList.remove('live-status'); // 蝘駁?湔???
        streamBtn.textContent = '? ???湔';
        streamBtn.classList.remove('streaming');
        
        // 銋?啁?剔?Ｗ??????        const streamStatusDot = document.getElementById('streamStatusDot');
        const streamStatusText = document.getElementById('streamStatusText');
        if (streamStatusDot && streamStatusText) {
            streamStatusDot.classList.remove('live');
            streamStatusText.classList.remove('live-status');
        }
    }
}

// ???湔閮???function startStreamTimer() {
    streamStartTime = Date.now();
    durationInterval = setInterval(updateDuration, 1000);
}

// ?迫?湔閮???function stopStreamTimer() {
    if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
    }
    streamStartTime = null;
}

// ?湔?湔?
function updateDuration() {
    if (!streamStartTime) return;

    const elapsed = Date.now() - streamStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    const durationElement = document.getElementById('duration');
    if (durationElement) {
        durationElement.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// 璅⊥閫?暹??function simulateViewers() {
    if (!isStreaming) return;

    // ?冽?憓?閫??    const viewerIncrease = Math.floor(Math.random() * 3) + 1;
    viewerCount += viewerIncrease;
    
    const viewerCountElement = document.getElementById('viewerCount');
    const chatViewerCountElement = document.getElementById('chatViewerCount');
    
    if (viewerCountElement) {
        viewerCountElement.textContent = viewerCount;
    }
    if (chatViewerCountElement) {
        chatViewerCountElement.textContent = viewerCount;
    }

    // ?冽??潮??曇???    if (Math.random() < 0.3) {
        const messages = [
            '銝餅憟踝?',
            '?恍敺??啣',
            '?舀?銝餅嚗?,
            '隢?銝餅?函隞暻潮??莎?',
            '銝餅??喳?憟質',
            '??剝?敺?嚗?,
            '銝餅?硃嚗?,
            '隢?銝餅撟暹革嚗?,
            '銝餅??銵?璉?,
            '??剖??閎'
        ];
        
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        const usernames = ['閫?適', '閫?遮', '閫?遨', '閫?遭', '閫?遷', '閫?鄰'];
        const randomUsername = usernames[Math.floor(Math.random() * usernames.length)];
        
        addMessage(randomUsername, randomMessage);
    }

    // 蝜潛?璅⊥
    setTimeout(simulateViewers, Math.random() * 5000 + 3000);
}

// 璅⊥?豢??唾撓
function simulateDataTransfer() {
    if (!isStreaming) return;

    const dataRate = Math.floor(Math.random() * 1000) + 100;
    const dataRateElement = document.getElementById('dataRate');
    if (dataRateElement) {
        dataRateElement.textContent = `${dataRate} KB/s`;
    }

    dataTransferInterval = setTimeout(simulateDataTransfer, 2000);
}

// ?蔭蝯梯??豢?
function resetStats() {
    viewerCount = 0;
    messageCount = 0;
    
    // 摰?圈?蝵格??絞閮?蝝?    const elements = {
        'viewerCount': '0',
        'chatViewerCount': '0',
        'messageCount': '0',
        'duration': '00:00',
        'dataRate': '0 KB/s'
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    if (dataTransferInterval) {
        clearTimeout(dataTransferInterval);
        dataTransferInterval = null;
    }
}

// 瘛餃??予閮
function addMessage(username, content) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    // ?寞??冽憿?閮剔蔭銝??見撘?    if (username === '蝟餌絞') {
        messageDiv.classList.add('system');
    } else if (username === '銝餅' || username === getCurrentUser()) {
        messageDiv.classList.add('broadcaster');
    }
    
    const timestamp = new Date().toLocaleTimeString('zh-TW', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // ?脣??冽?剖?
    const avatar = getUserAvatar(username);
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            ${avatar}
        </div>
        <div class="message-content-wrapper">
            <div class="message-bubble">
                <div class="message-header">
                    <span class="username">${username}</span>
                    <span class="timestamp">${timestamp}</span>
                </div>
                <div class="message-content">${content}</div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    
    // 撘瑕?芸?皛曉??啣???- 雿輻憭車?寞?蝣箔?皛曉?
    scrollChatToBottom();
    
    // 撱園?活皛曉?嚗Ⅱ靽?DOM 摰?湔
    setTimeout(() => {
        scrollChatToBottom();
    }, 50);
    
    // ?活撱園皛曉?嚗???賜????撅霈?
    setTimeout(() => {
        scrollChatToBottom();
    }, 100);
    
    // ?湔閮閮
    if (username !== '蝟餌絞') {
        messageCount++;
        const messageCountElement = document.getElementById('messageCount');
        if (messageCountElement) {
            messageCountElement.textContent = messageCount;
        }
    }
}

// ?脣??冽?剖?
function getUserAvatar(username) {
    if (username === '蝟餌絞') {
        return '<i class="fas fa-cog"></i>';
    } else if (username === '銝餅' || username === getCurrentUser()) {
        // 雿輻?嗅??冽???        if (window.getCurrentUserAvatar) {
            return window.getCurrentUserAvatar();
        } else {
            return '<i class="fas fa-star"></i>';
        }
    } else {
        // ?桅?園＊蝷箇?嗅??洵銝??瘥?        return username.charAt(0).toUpperCase();
    }
}

// ?脣??嗅??冽?迂
function getCurrentUser() {
    // 敺???豢???賣?脣??冽??    if (window.currentUser && window.currentUser.displayName) {
        return window.currentUser.displayName;
    } else if (window.getCurrentUser) {
        return window.getCurrentUser();
    } else {
        return '銝餅'; // ?身??    }
}

// ?脣??嗅??冽摰靽⊥
function getCurrentUserInfo() {
    // 擐?瑼Ｘ?典?霈 currentUser (?航?臬?API頛?身蝵桃?閮芸恥頨思遢)
    if (window.currentUser || currentUser) {
        const user = window.currentUser || currentUser;
        return {
            displayName: user.displayName || user.username,
            avatarUrl: user.avatarUrl || user.avatar || null,
            isLoggedIn: !user.isGuest,
            isGuest: user.isGuest || false
        };
    }
    
    // ?嗆活瑼ＸlocalStorage銝剔??冽靽⊥
    const storedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (storedUser) {
        return {
            displayName: storedUser.username,
            avatarUrl: storedUser.avatar || null,
            isLoggedIn: true,
            isGuest: false
        };
    } 
    
    // ?敺???閮剔?銝餅頨思遢
    return {
        displayName: '銝餅',
        avatarUrl: null,
        isLoggedIn: false,
        isGuest: false
    };
}

// ?潮???- ???箏????芸?雿輻ChatSystem
function sendMessage() {
    console.log('[SCRIPT] sendMessage鋡怨矽??);
    
    // 瑼ＸChatSystem?臬?舐嚗???典?憪?蝯列hatSystem??
    if (window.chatSystem && 
        window.chatSystem.isReady && 
        typeof window.chatSystem.sendMessage === 'function') {
        console.log('[SCRIPT] 瑼Ｘ葫?蚓hatSystem?舐嚗?閮策ChatSystem??');
        window.chatSystem.sendMessage();
        return;
    }
    
    console.log('[SCRIPT] ChatSystem銝?剁?雿輻敺???');
    
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) {
        console.error('[SCRIPT] ?曆??逅essageInput??');
        return;
    }
    
    const message = messageInput.value.trim();
    
    if (!message) {
        console.warn('[SCRIPT] 瘨?箇征嚗蕭?亦??);
        return;
    }

    console.log('[SCRIPT] sendMessage invoked. socketState=', streamingSocket? streamingSocket.readyState : 'null', 'raw=', message);
    
    // ?脣??嗅??冽?迂
    const currentUserName = getCurrentUser();
    
    // ?? WebSocket ?潮??舐策?????    if (streamingSocket && streamingSocket.readyState === WebSocket.OPEN) {
        const messageData = {
            type: 'chat',  // 雿輻蝯曹???憭拇??舫???            role: 'broadcaster',
            username: currentUserName,
            message: message,
            timestamp: new Date().toISOString()
        };
        
        streamingSocket.send(JSON.stringify(messageData));
        console.log('[SCRIPT] 撌脩???舐策?????payload=', messageData);
        
        // 銝??喳?砍憿舐內瘨嚗? ChatSystem ?????典??喟?瘨
        // addMessage(currentUserName, message, 'broadcaster');
        
    } else {
        console.warn('[SCRIPT] WebSocket ?芷?嚗瘜????);
        addMessage('蝟餌絞', '?? 蝬脰楝???啣虜嚗??舐瘜??, 'system');
    }
    
    messageInput.value = '';
}

// 皛曉??予摰文摨
function scrollChatToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        // 撘瑕皛曉??啣??剁???湔?瘜?
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        console.log('?予摰文撥?嗆遝??- scrollTop:', chatMessages.scrollTop, 'scrollHeight:', chatMessages.scrollHeight);
        
        // 撽?皛曉??臬??
        setTimeout(() => {
            if (chatMessages.scrollTop < chatMessages.scrollHeight - chatMessages.clientHeight - 10) {
                console.warn('?予摰斗遝??賢仃???活?岫');
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }, 100);
