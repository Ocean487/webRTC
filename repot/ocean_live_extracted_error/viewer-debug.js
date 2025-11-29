// 觀眾端視頻顯示問題專項診斷
// 專門解決信令成功但看不到畫面的問題

function diagnoseVideoDisplay() {
    console.log('🔍 === 觀眾端視頻顯示診斷 ===');
    
    // 1. 檢查 PeerConnection 狀態
    console.log('\n1. PeerConnection 狀態檢查:');
    if (!window.peerConnection) {
        console.error('❌ PeerConnection 不存在');
        return;
    }
    
    const pc = window.peerConnection;
    console.log('連接狀態:', pc.connectionState);
    console.log('ICE 連接狀態:', pc.iceConnectionState);
    console.log('ICE 收集狀態:', pc.iceGatheringState);
    console.log('信令狀態:', pc.signalingState);
    
    // 2. 檢查接收器
    console.log('\n2. RTP 接收器檢查:');
    const receivers = pc.getReceivers();
    console.log('接收器總數:', receivers.length);
    
    receivers.forEach((receiver, index) => {
        const track = receiver.track;
        if (track) {
            console.log(`接收器 ${index}:`, {
                kind: track.kind,
                id: track.id,
                readyState: track.readyState,
                enabled: track.enabled,
                muted: track.muted,
                label: track.label
            });
            
            // 檢查軌道設置
            if (track.kind === 'video') {
                const settings = track.getSettings();
                console.log(`視頻軌道設置:`, settings);
                
                if (settings.width === 0 || settings.height === 0) {
                    console.error('❌ 視頻軌道尺寸為 0');
                }
            }
        } else {
            console.log(`接收器 ${index}: 沒有軌道`);
        }
    });
    
    // 3. 檢查視頻元素
    console.log('\n3. 視頻元素檢查:');
    const remoteVideo = document.getElementById('remoteVideo');
    if (!remoteVideo) {
        console.error('❌ 找不到 remoteVideo 元素');
        return;
    }
    
    console.log('視頻元素狀態:', {
        srcObject: !!remoteVideo.srcObject,
        videoWidth: remoteVideo.videoWidth,
        videoHeight: remoteVideo.videoHeight,
        readyState: remoteVideo.readyState,
        paused: remoteVideo.paused,
        currentTime: remoteVideo.currentTime,
        duration: remoteVideo.duration || 'unknown',
        display: remoteVideo.style.display,
        visibility: remoteVideo.style.visibility,
        opacity: remoteVideo.style.opacity
    });
    
    // 4. 檢查媒體流
    console.log('\n4. 媒體流檢查:');
    if (remoteVideo.srcObject) {
        const stream = remoteVideo.srcObject;
        console.log('媒體流信息:', {
            id: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length
        });
        
        const videoTracks = stream.getVideoTracks();
        videoTracks.forEach((track, index) => {
            console.log(`視頻軌道 ${index}:`, {
                id: track.id,
                kind: track.kind,
                readyState: track.readyState,
                enabled: track.enabled,
                muted: track.muted,
                label: track.label
            });
            
            const settings = track.getSettings();
            console.log(`軌道設置:`, settings);
        });
    } else {
        console.error('❌ remoteVideo 沒有 srcObject');
    }
    
    // 5. 檢查 ontrack 事件
    console.log('\n5. 事件處理器檢查:');
    console.log('ontrack 事件:', !!pc.ontrack);
    console.log('onicecandidate 事件:', !!pc.onicecandidate);
    console.log('onconnectionstatechange 事件:', !!pc.onconnectionstatechange);
    
    // 6. 檢查全局變數
    console.log('\n6. 全局變數檢查:');
    console.log('receivedOffer:', !!window.receivedOffer);
    console.log('receivedStreamStart:', !!window.receivedStreamStart);
    console.log('receivedIceCandidate:', !!window.receivedIceCandidate);
    
    // 7. 嘗試手動播放
    console.log('\n7. 嘗試手動播放視頻:');
    if (remoteVideo && remoteVideo.srcObject) {
        remoteVideo.play().then(() => {
            console.log('✅ 手動播放成功');
        }).catch(error => {
            console.error('❌ 手動播放失敗:', error);
        });
    }
    
    // 8. 檢查統計信息
    console.log('\n8. WebRTC 統計信息:');
    pc.getStats().then(stats => {
        let inboundRTP = null;
        let outboundRTP = null;
        let candidatePair = null;
        
        stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
                inboundRTP = report;
            } else if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
                outboundRTP = report;
            } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                candidatePair = report;
            }
        });
        
        if (inboundRTP) {
            console.log('入站 RTP 統計:', {
                packetsReceived: inboundRTP.packetsReceived,
                packetsLost: inboundRTP.packetsLost,
                bytesReceived: inboundRTP.bytesReceived,
                framesReceived: inboundRTP.framesReceived,
                framesDropped: inboundRTP.framesDropped,
                frameWidth: inboundRTP.frameWidth,
                frameHeight: inboundRTP.frameHeight
            });
            
            if (inboundRTP.packetsReceived === 0) {
                console.error('❌ 沒有接收到任何媒體包');
            }
            
            if (inboundRTP.framesReceived === 0) {
                console.error('❌ 沒有接收到任何視頻幀');
            }
        } else {
            console.error('❌ 沒有找到入站 RTP 統計');
        }
        
        if (candidatePair) {
            console.log('候選對信息:', {
                state: candidatePair.state,
                localCandidateType: candidatePair.localCandidateType,
                remoteCandidateType: candidatePair.remoteCandidateType,
                bytesReceived: candidatePair.bytesReceived,
                bytesSent: candidatePair.bytesSent
            });
        }
    }).catch(err => {
        console.error('無法獲取統計信息:', err);
    });
    
    return generateRecommendations();
}

function generateRecommendations() {
    console.log('\n💡 === 問題診斷建議 ===');
    
    const recommendations = [];
    
    // 基於檢查結果生成建議
    const remoteVideo = document.getElementById('remoteVideo');
    const pc = window.peerConnection;
    
    if (!pc) {
        recommendations.push('1. PeerConnection 不存在，請重新整理頁面');
        return recommendations;
    }
    
    if (pc.connectionState !== 'connected') {
        recommendations.push('2. WebRTC 連接狀態異常，請檢查網路');
    }
    
    if (!remoteVideo) {
        recommendations.push('3. 視頻元素不存在，請檢查 HTML 結構');
    } else if (!remoteVideo.srcObject) {
        recommendations.push('4. 視頻元素沒有媒體流，檢查 ontrack 事件');
    } else if (remoteVideo.videoWidth === 0) {
        recommendations.push('5. 視頻尺寸為 0，可能是編解碼器問題');
    }
    
    const receivers = pc.getReceivers();
    const videoReceivers = receivers.filter(r => r.track && r.track.kind === 'video');
    
    if (videoReceivers.length === 0) {
        recommendations.push('6. 沒有視頻接收器，主播可能沒有發送視頻');
    }
    
    recommendations.push('7. 嘗試在主播端重新開始直播');
    recommendations.push('8. 檢查瀏覽器是否支援視頻解碼');
    recommendations.push('9. 嘗試使用不同的瀏覽器');
    recommendations.push('10. 檢查網路防火牆設置');
    
    recommendations.forEach(rec => console.log(rec));
    
    return recommendations;
}

// 修復視頻顯示問題的嘗試
function attemptVideoFix() {
    console.log('🔧 嘗試修復視頻顯示問題...');
    
    const remoteVideo = document.getElementById('remoteVideo');
    const pc = window.peerConnection;
    
    if (!remoteVideo || !pc) {
        console.error('❌ 基本元素不存在，無法修復');
        return false;
    }
    
    // 修復嘗試 1: 重新設置視頻流
    if (remoteVideo.srcObject) {
        console.log('🔄 嘗試重新設置視頻流...');
        const stream = remoteVideo.srcObject;
        remoteVideo.srcObject = null;
        setTimeout(() => {
            remoteVideo.srcObject = stream;
            remoteVideo.play().catch(e => console.error('播放失敗:', e));
        }, 100);
    }
    
    // 修復嘗試 2: 檢查視頻元素樣式
    console.log('🔄 檢查視頻元素樣式...');
    remoteVideo.style.display = 'block';
    remoteVideo.style.visibility = 'visible';
    remoteVideo.style.opacity = '1';
    remoteVideo.style.width = '100%';
    remoteVideo.style.height = 'auto';
    
    // 修復嘗試 3: 強制視頻載入
    if (remoteVideo.srcObject) {
        console.log('🔄 強制視頻載入...');
        remoteVideo.load();
        remoteVideo.play().catch(e => console.error('強制播放失敗:', e));
    }
    
    // 修復嘗試 4: 重新建立 ontrack 事件
    console.log('🔄 重新設置 ontrack 事件...');
    pc.ontrack = function(event) {
        console.log('🎬 收到遠程視頻流 (修復模式)', event);
        
        if (remoteVideo && event.streams && event.streams[0]) {
            const stream = event.streams[0];
            console.log('📺 重新設置視頻流到 video 元素');
            
            remoteVideo.srcObject = stream;
            remoteVideo.style.display = 'block';
            
            // 隱藏占位符
            const videoPlaceholder = document.getElementById('videoPlaceholder');
            if (videoPlaceholder) {
                videoPlaceholder.style.display = 'none';
            }
            
            // 嘗試播放
            remoteVideo.play().then(() => {
                console.log('✅ 修復模式：視頻播放成功');
            }).catch(error => {
                console.error('❌ 修復模式：視頻播放失敗', error);
            });
        }
    };
    
    console.log('✅ 修復嘗試完成');
    return true;
}

// 重置視頻顯示
function resetVideoDisplay() {
    console.log('🔄 重置視頻顯示...');
    
    const remoteVideo = document.getElementById('remoteVideo');
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    
    if (remoteVideo) {
        remoteVideo.srcObject = null;
        remoteVideo.style.display = 'none';
    }
    
    if (videoPlaceholder) {
        videoPlaceholder.style.display = 'block';
    }
    
    // 重新初始化 PeerConnection
    if (typeof window.initializePeerConnection === 'function') {
        console.log('🔄 重新初始化 PeerConnection...');
        window.initializePeerConnection();
    }
    
    // 重新發送觀眾加入請求
    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
        console.log('📡 重新發送觀眾加入請求...');
        window.socket.send(JSON.stringify({
            type: 'viewer_join',
            viewerId: window.viewerId,
            streamerId: window.targetStreamerId,
            userInfo: window.currentUser || { displayName: `觀眾${window.viewerId.substr(-3)}`, avatarUrl: null }
        }));
    }
}

// 快速檢查函數
function quickVideoCheck() {
    console.log('⚡ 快速視頻檢查...');
    
    const issues = [];
    const remoteVideo = document.getElementById('remoteVideo');
    const pc = window.peerConnection;
    
    if (!remoteVideo) {
        issues.push('❌ 找不到視頻元素');
    } else {
        if (!remoteVideo.srcObject) {
            issues.push('❌ 視頻元素沒有媒體流');
        } else if (remoteVideo.videoWidth === 0) {
            issues.push('❌ 視頻尺寸為 0');
        } else if (remoteVideo.paused) {
            issues.push('⚠️ 視頻被暫停');
        }
    }
    
    if (!pc) {
        issues.push('❌ PeerConnection 不存在');
    } else {
        if (pc.connectionState !== 'connected') {
            issues.push('❌ WebRTC 連接未建立');
        }
        
        const receivers = pc.getReceivers();
        const videoReceivers = receivers.filter(r => r.track && r.track.kind === 'video');
        if (videoReceivers.length === 0) {
            issues.push('❌ 沒有視頻接收器');
        }
    }
    
    if (issues.length === 0) {
        console.log('✅ 快速檢查：沒有發現明顯問題');
        console.log('💡 建議執行完整診斷：diagnoseVideoDisplay()');
    } else {
        console.log('❌ 發現問題：');
        issues.forEach(issue => console.log(`  ${issue}`));
        console.log('\n💡 建議操作：');
        console.log('  1. 執行 attemptVideoFix() 嘗試自動修復');
        console.log('  2. 執行 diagnoseVideoDisplay() 進行詳細診斷');
        console.log('  3. 執行 resetVideoDisplay() 重置連接');
    }
    
    return issues;
}

// 全域函數註冊
window.diagnoseVideoDisplay = diagnoseVideoDisplay;
window.attemptVideoFix = attemptVideoFix;
window.resetVideoDisplay = resetVideoDisplay;
window.quickVideoCheck = quickVideoCheck;

console.log('🔧 觀眾端視頻診斷工具已載入！');
console.log('使用方法：');
console.log('  - quickVideoCheck() - 快速檢查');
console.log('  - diagnoseVideoDisplay() - 完整診斷');
console.log('  - attemptVideoFix() - 嘗試修復');
console.log('  - resetVideoDisplay() - 重置連接');
