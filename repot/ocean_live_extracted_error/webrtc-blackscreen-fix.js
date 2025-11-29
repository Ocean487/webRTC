// WebRTC 黑屏問題專項診斷修復工具
// 基於 CSDN 文章解決思路：https://blog.csdn.net/qq_36083245/article/details/140032054

console.log('🔍 WebRTC 黑屏問題診斷開始...');

class WebRTCBlackScreenFixer {
    constructor() {
        this.diagnosticResults = [];
        this.fixes = [];
    }

    // 1. 檢查網路問題
    async checkNetworkIssues() {
        console.log('\n1. 📡 檢查網路問題...');
        
        try {
            // 檢查 ICE 候選收集
            if (window.peerConnection) {
                const pc = window.peerConnection;
                console.log('ICE 連接狀態:', pc.iceConnectionState);
                console.log('ICE 收集狀態:', pc.iceGatheringState);
                console.log('連接狀態:', pc.connectionState);
                
                if (pc.iceConnectionState === 'failed') {
                    this.diagnosticResults.push('❌ ICE 連接失敗 - 可能是 NAT/防火牆問題');
                    this.fixes.push('建議：檢查網路設置，確保 STUN/TURN 服務器可用');
                } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                    this.diagnosticResults.push('✅ ICE 連接正常');
                }
                
                // 檢查 ICE 候選類型
                const stats = await pc.getStats();
                let hasRelay = false, hasHost = false, hasSrflx = false;
                
                stats.forEach(report => {
                    if (report.type === 'local-candidate') {
                        if (report.candidateType === 'host') hasHost = true;
                        if (report.candidateType === 'srflx') hasSrflx = true;
                        if (report.candidateType === 'relay') hasRelay = true;
                    }
                });
                
                console.log('ICE 候選類型:', { host: hasHost, srflx: hasSrflx, relay: hasRelay });
                
                if (!hasHost && !hasSrflx && !hasRelay) {
                    this.diagnosticResults.push('❌ 沒有收集到任何有效的 ICE 候選');
                    this.fixes.push('建議：檢查 STUN 服務器配置');
                }
            }
        } catch (error) {
            console.error('網路檢查失敗:', error);
        }
    }

    // 2. 檢查信令問題
    checkSignalingIssues() {
        console.log('\n2. 📨 檢查信令問題...');
        
        // 檢查全局信令標記
        const signalChecks = {
            receivedOffer: !!window.receivedOffer,
            receivedStreamStart: !!window.receivedStreamStart,
            receivedIceCandidate: !!window.receivedIceCandidate
        };
        
        console.log('信令狀態:', signalChecks);
        
        if (!signalChecks.receivedOffer) {
            this.diagnosticResults.push('❌ 未收到 WebRTC Offer');
            this.fixes.push('建議：檢查主播端是否正常發送 Offer');
        }
        
        if (!signalChecks.receivedStreamStart) {
            this.diagnosticResults.push('❌ 未收到直播開始信號');
            this.fixes.push('建議：確認主播已開始直播');
        }
        
        // 檢查 WebSocket 連接
        if (window.socket) {
            console.log('WebSocket 狀態:', window.socket.readyState);
            if (window.socket.readyState !== WebSocket.OPEN) {
                this.diagnosticResults.push('❌ WebSocket 連接異常');
                this.fixes.push('建議：重新整理頁面重新建立連接');
            } else {
                this.diagnosticResults.push('✅ WebSocket 連接正常');
            }
        }
    }

    // 3. 檢查瀏覽器兼容性
    checkBrowserCompatibility() {
        console.log('\n3. 🌐 檢查瀏覽器兼容性...');
        
        const userAgent = navigator.userAgent;
        console.log('瀏覽器:', userAgent);
        
        // 檢查 WebRTC 支援
        const webrtcSupport = {
            getUserMedia: !!navigator.mediaDevices?.getUserMedia,
            RTCPeerConnection: !!window.RTCPeerConnection,
            MediaStream: !!window.MediaStream
        };
        
        console.log('WebRTC 支援:', webrtcSupport);
        
        Object.entries(webrtcSupport).forEach(([feature, supported]) => {
            if (!supported) {
                this.diagnosticResults.push(`❌ 瀏覽器不支援 ${feature}`);
                this.fixes.push('建議：使用 Chrome 或 Firefox 最新版本');
            }
        });
        
        // 檢查編解碼器支援
        if (window.RTCRtpReceiver?.getCapabilities) {
            const videoCapabilities = RTCRtpReceiver.getCapabilities('video');
            const supportedCodecs = videoCapabilities?.codecs?.map(c => c.mimeType) || [];
            console.log('支援的視頻編解碼器:', supportedCodecs);
            
            const hasH264 = supportedCodecs.some(c => c.includes('H264'));
            const hasVP8 = supportedCodecs.some(c => c.includes('VP8'));
            
            if (!hasH264 && !hasVP8) {
                this.diagnosticResults.push('❌ 缺少常用視頻編解碼器支援');
                this.fixes.push('建議：更新瀏覽器或嘗試不同瀏覽器');
            }
        }
    }

    // 4. 檢查權限問題  
    async checkPermissionIssues() {
        console.log('\n4. 🔒 檢查權限問題...');
        
        try {
            // 檢查媒體權限
            const permissions = await navigator.permissions.query({ name: 'camera' });
            console.log('攝像頭權限:', permissions.state);
            
            if (permissions.state === 'denied') {
                this.diagnosticResults.push('❌ 攝像頭權限被拒絕');
                this.fixes.push('建議：在瀏覽器設置中允許攝像頭權限');
            }
        } catch (error) {
            console.log('無法檢查權限:', error.message);
        }
        
        // 檢查安全上下文
        if (!window.isSecureContext) {
            this.diagnosticResults.push('❌ 非安全上下文，WebRTC 功能受限');
            this.fixes.push('建議：使用 HTTPS 協議');
        }
    }

    // 5. 檢查代碼問題
    checkCodeIssues() {
        console.log('\n5. 💻 檢查代碼問題...');
        
        const remoteVideo = document.getElementById('remoteVideo');
        if (!remoteVideo) {
            this.diagnosticResults.push('❌ 找不到 remoteVideo 元素');
            this.fixes.push('建議：檢查 HTML 結構');
            return;
        }
        
        console.log('視頻元素狀態:', {
            srcObject: !!remoteVideo.srcObject,
            videoWidth: remoteVideo.videoWidth,
            videoHeight: remoteVideo.videoHeight,
            readyState: remoteVideo.readyState,
            paused: remoteVideo.paused,
            muted: remoteVideo.muted,
            autoplay: remoteVideo.autoplay
        });
        
        // 檢查媒體流
        if (remoteVideo.srcObject) {
            const stream = remoteVideo.srcObject;
            const videoTracks = stream.getVideoTracks();
            const audioTracks = stream.getAudioTracks();
            
            console.log('媒體流信息:', {
                active: stream.active,
                videoTracks: videoTracks.length,
                audioTracks: audioTracks.length
            });
            
            if (videoTracks.length === 0) {
                this.diagnosticResults.push('❌ 媒體流中沒有視頻軌道');
                this.fixes.push('建議：檢查主播端視頻軌道發送');
            } else {
                const track = videoTracks[0];
                console.log('視頻軌道狀態:', {
                    readyState: track.readyState,
                    enabled: track.enabled,
                    muted: track.muted
                });
                
                if (track.readyState === 'ended') {
                    this.diagnosticResults.push('❌ 視頻軌道已結束');
                    this.fixes.push('建議：重新建立連接');
                } else if (track.muted) {
                    this.diagnosticResults.push('⚠️ 視頻軌道被靜音');
                    this.fixes.push('建議：檢查軌道靜音狀態');
                }
            }
            
            // 檢查視頻尺寸
            if (remoteVideo.videoWidth === 0 || remoteVideo.videoHeight === 0) {
                this.diagnosticResults.push('❌ 視頻尺寸為 0');
                this.fixes.push('建議：可能是編解碼器問題或軌道問題');
            }
        } else {
            this.diagnosticResults.push('❌ 視頻元素沒有媒體流');
            this.fixes.push('建議：檢查 ontrack 事件處理');
        }
        
        // 檢查 PeerConnection
        if (window.peerConnection) {
            const receivers = window.peerConnection.getReceivers();
            const videoReceivers = receivers.filter(r => r.track && r.track.kind === 'video');
            
            if (videoReceivers.length === 0) {
                this.diagnosticResults.push('❌ 沒有視頻接收器');
                this.fixes.push('建議：檢查主播端是否正確添加視頻軌道');
            }
        }
    }

    // 6. 應用修復措施
    async applyFixes() {
        console.log('\n6. 🔧 應用修復措施...');
        
        const remoteVideo = document.getElementById('remoteVideo');
        
        if (remoteVideo) {
            // 修復 1: 強化視頻元素設置
            console.log('🔄 強化視頻元素設置...');
            remoteVideo.style.cssText = `
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                width: 100% !important;
                height: auto !important;
                background: #000 !important;
                object-fit: contain !important;
            `;
            
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            remoteVideo.controls = true; // 便於調試
            
            // 修復 2: 重新設置媒體流
            if (remoteVideo.srcObject) {
                console.log('🔄 重新設置媒體流...');
                const stream = remoteVideo.srcObject;
                remoteVideo.srcObject = null;
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
                remoteVideo.srcObject = stream;
                
                // 嘗試播放
                try {
                    await remoteVideo.play();
                    console.log('✅ 視頻播放成功');
                } catch (error) {
                    console.log('⚠️ 自動播放失敗:', error.message);
                    
                    // 創建手動播放按鈕
                    this.createPlayButton(remoteVideo);
                }
            } else if (window.peerConnection) {
                // 修復 3: 從接收器重建媒體流
                console.log('🔄 從接收器重建媒體流...');
                const receivers = window.peerConnection.getReceivers();
                const videoReceiver = receivers.find(r => r.track && r.track.kind === 'video');
                
                if (videoReceiver) {
                    const newStream = new MediaStream();
                    newStream.addTrack(videoReceiver.track);
                    
                    // 添加音頻軌道
                    const audioReceiver = receivers.find(r => r.track && r.track.kind === 'audio');
                    if (audioReceiver) {
                        newStream.addTrack(audioReceiver.track);
                    }
                    
                    remoteVideo.srcObject = newStream;
                    
                    try {
                        await remoteVideo.play();
                        console.log('✅ 重建媒體流播放成功');
                    } catch (error) {
                        console.log('⚠️ 重建媒體流播放失敗:', error.message);
                        this.createPlayButton(remoteVideo);
                    }
                }
            }
        }
        
        // 修復 4: 重新建立連接（如果需要）
        if (window.peerConnection && window.peerConnection.connectionState === 'failed') {
            console.log('🔄 重新建立 WebRTC 連接...');
            
            if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                window.socket.send(JSON.stringify({
                    type: 'viewer_join',
                    viewerId: window.viewerId,
                    streamerId: window.targetStreamerId,
                    userInfo: window.currentUser || { displayName: `觀眾${window.viewerId.substr(-3)}`, avatarUrl: null }
                }));
            }
        }
    }

    // 創建手動播放按鈕
    createPlayButton(videoElement) {
        // 移除已存在的按鈕
        const existingBtn = document.getElementById('manual-play-btn');
        if (existingBtn) existingBtn.remove();
        
        const playBtn = document.createElement('button');
        playBtn.id = 'manual-play-btn';
        playBtn.innerHTML = '▶️ 點擊播放視頻';
        playBtn.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10000;
            padding: 15px 30px;
            font-size: 18px;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            font-weight: bold;
        `;
        
        playBtn.onclick = async () => {
            try {
                await videoElement.play();
                console.log('✅ 手動播放成功');
                playBtn.remove();
            } catch (error) {
                console.error('❌ 手動播放失敗:', error);
                alert('視頻播放失敗，請檢查瀏覽器設置或嘗試重新整理頁面');
            }
        };
        
        document.body.appendChild(playBtn);
        console.log('已創建手動播放按鈕');
    }

    // 生成診斷報告
    generateReport() {
        console.log('\n📋 === 診斷報告 ===');
        
        if (this.diagnosticResults.length === 0) {
            console.log('✅ 沒有發現明顯問題');
        } else {
            console.log('發現的問題:');
            this.diagnosticResults.forEach(result => console.log(`  ${result}`));
        }
        
        if (this.fixes.length > 0) {
            console.log('\n💡 建議修復措施:');
            this.fixes.forEach(fix => console.log(`  ${fix}`));
        }
        
        console.log('\n🔧 其他建議:');
        console.log('  - 打開 chrome://webrtc-internals/ 查看詳細連接信息');
        console.log('  - 檢查主播端是否正常直播');
        console.log('  - 嘗試重新整理頁面');
        console.log('  - 使用不同瀏覽器測試');
        console.log('  - 檢查網路防火牆設置');
    }

    // 執行完整診斷
    async runFullDiagnosis() {
        console.log('🚀 開始 WebRTC 黑屏問題完整診斷...');
        
        await this.checkNetworkIssues();
        this.checkSignalingIssues();
        this.checkBrowserCompatibility();
        await this.checkPermissionIssues();
        this.checkCodeIssues();
        
        this.generateReport();
        
        // 自動應用修復
        await this.applyFixes();
        
        console.log('✅ 診斷和修復完成');
    }
}

// 創建全局實例
window.webrtcFixer = new WebRTCBlackScreenFixer();

// 全局函數
window.fixWebRTCBlackScreen = () => window.webrtcFixer.runFullDiagnosis();

console.log('🛠️ WebRTC 黑屏修復工具已載入');
console.log('使用方法: fixWebRTCBlackScreen()');

// 自動執行診斷（如果是觀眾頁面）
if (window.location.pathname.includes('viewer') || window.location.search.includes('streamer=')) {
    setTimeout(() => {
        console.log('🔄 自動執行黑屏診斷...');
        window.webrtcFixer.runFullDiagnosis();
    }, 2000);
}
