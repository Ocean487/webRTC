// 手動修復觀眾視頻顯示問題
console.log('🔧 開始手動診斷和修復...');

// 1. 檢查基本元素
const remoteVideo = document.getElementById('remoteVideo');
console.log('1. 視頻元素檢查:');
console.log('  - 元素存在:', !!remoteVideo);

if (remoteVideo) {
    console.log('  - srcObject:', !!remoteVideo.srcObject);
    console.log('  - videoWidth:', remoteVideo.videoWidth);
    console.log('  - videoHeight:', remoteVideo.videoHeight);
    console.log('  - readyState:', remoteVideo.readyState);
    console.log('  - paused:', remoteVideo.paused);
    console.log('  - currentTime:', remoteVideo.currentTime);
    console.log('  - display:', window.getComputedStyle(remoteVideo).display);
    console.log('  - visibility:', window.getComputedStyle(remoteVideo).visibility);
}

// 2. 檢查 PeerConnection
console.log('\n2. PeerConnection 檢查:');
if (window.peerConnection) {
    const pc = window.peerConnection;
    console.log('  - connectionState:', pc.connectionState);
    console.log('  - iceConnectionState:', pc.iceConnectionState);
    console.log('  - signalingState:', pc.signalingState);
    
    const receivers = pc.getReceivers();
    console.log('  - 接收器數量:', receivers.length);
    
    receivers.forEach((receiver, i) => {
        if (receiver.track) {
            console.log(`  - 接收器 ${i}:`, {
                kind: receiver.track.kind,
                readyState: receiver.track.readyState,
                enabled: receiver.track.enabled,
                muted: receiver.track.muted
            });
        }
    });
} else {
    console.log('  - PeerConnection 不存在');
}

// 3. 立即修復嘗試
console.log('\n3. 開始修復嘗試...');

if (remoteVideo && window.peerConnection) {
    // 修復方法 1: 重新設置視頻流
    if (remoteVideo.srcObject) {
        console.log('🔄 方法 1: 重新設置現有視頻流...');
        const currentStream = remoteVideo.srcObject;
        remoteVideo.srcObject = null;
        
        setTimeout(() => {
            remoteVideo.srcObject = currentStream;
            
            // 強制設置樣式
            remoteVideo.style.cssText = `
                display: block !important;
                width: 100% !important;
                height: auto !important;
                background: #000 !important;
                object-fit: contain !important;
            `;
            
            // 嘗試播放
            remoteVideo.play().then(() => {
                console.log('✅ 重新設置成功，視頻開始播放');
            }).catch(err => {
                console.log('⚠️ 自動播放失敗:', err.message);
                
                // 創建手動播放按鈕
                const playBtn = document.createElement('button');
                playBtn.textContent = '▶️ 點擊播放視頻';
                playBtn.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 10000;
                    padding: 15px 30px;
                    font-size: 16px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                `;
                
                playBtn.onclick = () => {
                    remoteVideo.play().then(() => {
                        console.log('✅ 手動播放成功');
                        playBtn.remove();
                    }).catch(e => {
                        console.error('❌ 手動播放也失敗:', e);
                        alert('視頻播放失敗，請檢查瀏覽器設置');
                    });
                };
                
                document.body.appendChild(playBtn);
                console.log('已創建手動播放按鈕');
            });
        }, 200);
    } else {
        console.log('🔄 方法 2: 從接收器重建視頻流...');
        
        // 從接收器重建視頻流
        const receivers = window.peerConnection.getReceivers();
        const videoReceiver = receivers.find(r => r.track && r.track.kind === 'video');
        
        if (videoReceiver && videoReceiver.track) {
            console.log('找到視頻接收器，重建媒體流...');
            
            const newStream = new MediaStream();
            newStream.addTrack(videoReceiver.track);
            
            // 同時添加音頻軌道（如果有）
            const audioReceiver = receivers.find(r => r.track && r.track.kind === 'audio');
            if (audioReceiver && audioReceiver.track) {
                newStream.addTrack(audioReceiver.track);
            }
            
            remoteVideo.srcObject = newStream;
            
            // 強制樣式
            remoteVideo.style.cssText = `
                display: block !important;
                width: 100% !important;
                height: auto !important;
                background: #000 !important;
                object-fit: contain !important;
            `;
            
            console.log('✅ 新媒體流已設置');
            
            // 監聽載入事件
            remoteVideo.onloadedmetadata = () => {
                console.log('✅ 視頻元數據載入完成');
                console.log('視頻尺寸:', remoteVideo.videoWidth, 'x', remoteVideo.videoHeight);
            };
            
            remoteVideo.oncanplay = () => {
                console.log('✅ 視頻可以播放');
                remoteVideo.play();
            };
            
        } else {
            console.error('❌ 沒有找到視頻接收器');
        }
    }
}

// 4. 檢查統計信息
if (window.peerConnection) {
    console.log('\n4. 檢查 WebRTC 統計信息...');
    
    window.peerConnection.getStats().then(stats => {
        let inboundVideo = null;
        let candidatePair = null;
        
        stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
                inboundVideo = report;
            } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                candidatePair = report;
            }
        });
        
        if (inboundVideo) {
            console.log('📊 視頻接收統計:', {
                packetsReceived: inboundVideo.packetsReceived || 0,
                packetsLost: inboundVideo.packetsLost || 0,
                bytesReceived: inboundVideo.bytesReceived || 0,
                framesReceived: inboundVideo.framesReceived || 0,
                framesDropped: inboundVideo.framesDropped || 0,
                frameWidth: inboundVideo.frameWidth || 0,
                frameHeight: inboundVideo.frameHeight || 0
            });
            
            if (inboundVideo.packetsReceived === 0) {
                console.error('❌ 沒有接收到任何視頻包！');
                console.log('💡 建議: 檢查主播端是否正常發送視頻');
            } else if (inboundVideo.framesReceived === 0) {
                console.error('❌ 沒有接收到任何視頻幀！');
                console.log('💡 建議: 可能是編解碼器問題');
            } else {
                console.log('✅ 正在接收視頻數據');
            }
        } else {
            console.error('❌ 沒有視頻接收統計信息');
        }
        
        if (candidatePair) {
            console.log('🔗 連接信息:', {
                localType: candidatePair.localCandidateType,
                remoteType: candidatePair.remoteCandidateType,
                state: candidatePair.state
            });
        }
    }).catch(err => {
        console.error('獲取統計信息失敗:', err);
    });
}

console.log('\n=== 診斷完成 ===');
console.log('💡 如果問題仍然存在，請：');
console.log('1. 檢查主播端是否正常直播');
console.log('2. 嘗試重新整理頁面');
console.log('3. 使用不同的瀏覽器測試');
console.log('4. 檢查網路連接');
