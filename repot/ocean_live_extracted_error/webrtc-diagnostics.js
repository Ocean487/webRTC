// WebRTC 直播問題診斷工具
// 基於 MDN WebRTC API 文檔和最佳實踐

class WebRTCDiagnostics {
    constructor() {
        this.diagnosticsData = {
            broadcaster: {
                isStreaming: false,
                hasLocalStream: false,
                peerConnections: 0,
                streamingSocket: null
            },
            viewer: {
                isConnected: false,
                hasPeerConnection: false,
                hasRemoteStream: false,
                socket: null
            },
            network: {
                iceServers: [],
                candidates: [],
                connectionState: 'new'
            }
        };
    }

    // 主播端診斷
    diagnoseBroadcaster() {
        console.log('🔍 === 主播端診斷開始 ===');
        
        // 檢查全局變數
        const globalChecks = {
            isStreaming: typeof window.isStreaming !== 'undefined' ? window.isStreaming : false,
            localStream: typeof window.localStream !== 'undefined' ? !!window.localStream : false,
            streamingSocket: typeof window.streamingSocket !== 'undefined' ? !!window.streamingSocket : false,
            peerConnections: typeof window.peerConnections !== 'undefined' ? window.peerConnections.size : 0
        };
        
        console.log('📊 主播端狀態:', globalChecks);
        
        // 檢查媒體流
        if (window.localStream) {
            const videoTracks = window.localStream.getVideoTracks();
            const audioTracks = window.localStream.getAudioTracks();
            
            console.log('🎥 視頻軌道:', videoTracks.length, videoTracks.map(t => ({
                id: t.id,
                kind: t.kind,
                enabled: t.enabled,
                readyState: t.readyState,
                label: t.label
            })));
            
            console.log('🎵 音頻軌道:', audioTracks.length, audioTracks.map(t => ({
                id: t.id,
                kind: t.kind,
                enabled: t.enabled,
                readyState: t.readyState,
                label: t.label
            })));
            
            // 檢查視頻軌道設置
            if (videoTracks.length > 0) {
                const videoTrack = videoTracks[0];
                const settings = videoTrack.getSettings();
                console.log('📏 視頻設置:', settings);
                
                if (settings.width === 0 || settings.height === 0) {
                    console.error('❌ 視頻軌道尺寸為 0，可能有問題');
                    return { status: 'error', message: '視頻軌道無效' };
                }
            }
        } else {
            console.error('❌ 沒有本地媒體流');
            return { status: 'error', message: '請先開始直播並啟用攝像頭' };
        }
        
        // 檢查 WebSocket 連接
        if (window.streamingSocket) {
            console.log('🌐 WebSocket 狀態:', window.streamingSocket.readyState);
            if (window.streamingSocket.readyState !== WebSocket.OPEN) {
                console.error('❌ WebSocket 未連接');
                return { status: 'error', message: 'WebSocket 連接失敗' };
            }
        } else {
            console.error('❌ WebSocket 未初始化');
            return { status: 'error', message: 'WebSocket 未初始化' };
        }
        
        // 檢查 PeerConnection
        if (window.peerConnections && window.peerConnections.size > 0) {
            console.log('🔗 PeerConnection 詳情:');
            window.peerConnections.forEach((pc, viewerId) => {
                console.log(`   觀眾 ${viewerId.substr(-3)}:`, {
                    connectionState: pc.connectionState,
                    iceConnectionState: pc.iceConnectionState,
                    iceGatheringState: pc.iceGatheringState,
                    signalingState: pc.signalingState
                });
                
                // 檢查發送者
                const senders = pc.getSenders();
                console.log(`   發送者 (${senders.length}):`, senders.map(s => ({
                    kind: s.track ? s.track.kind : 'none',
                    trackId: s.track ? s.track.id : 'none',
                    enabled: s.track ? s.track.enabled : false
                })));
            });
        } else {
            console.warn('⚠️ 沒有觀眾連接');
        }
        
        return { status: 'success', message: '主播端檢查完成' };
    }

    // 觀眾端診斷
    diagnoseViewer() {
        console.log('🔍 === 觀眾端診斷開始 ===');
        
        // 檢查全局變數
        const globalChecks = {
            isConnected: typeof window.isConnected !== 'undefined' ? window.isConnected : false,
            peerConnection: typeof window.peerConnection !== 'undefined' ? !!window.peerConnection : false,
            socket: typeof window.socket !== 'undefined' ? !!window.socket : false,
            viewerId: typeof window.viewerId !== 'undefined' ? window.viewerId : 'unknown'
        };
        
        console.log('📊 觀眾端狀態:', globalChecks);
        
        // 檢查 WebSocket
        if (window.socket) {
            console.log('🌐 WebSocket 狀態:', window.socket.readyState);
            if (window.socket.readyState !== WebSocket.OPEN) {
                console.error('❌ WebSocket 未連接');
                return { status: 'error', message: 'WebSocket 連接失敗，請重新整理頁面' };
            }
        } else {
            console.error('❌ WebSocket 未初始化');
            return { status: 'error', message: 'WebSocket 未初始化' };
        }
        
        // 檢查 PeerConnection
        if (window.peerConnection) {
            const pc = window.peerConnection;
            console.log('🔗 PeerConnection 狀態:', {
                connectionState: pc.connectionState,
                iceConnectionState: pc.iceConnectionState,
                iceGatheringState: pc.iceGatheringState,
                signalingState: pc.signalingState
            });
            
            // 檢查接收者
            const receivers = pc.getReceivers();
            console.log(`📺 接收者 (${receivers.length}):`, receivers.map(r => ({
                kind: r.track ? r.track.kind : 'none',
                trackId: r.track ? r.track.id : 'none',
                readyState: r.track ? r.track.readyState : 'none'
            })));
            
            // 檢查遠程流
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo) {
                console.log('📺 遠程視頻元素:', {
                    src: !!remoteVideo.srcObject,
                    videoWidth: remoteVideo.videoWidth,
                    videoHeight: remoteVideo.videoHeight,
                    readyState: remoteVideo.readyState,
                    paused: remoteVideo.paused,
                    currentTime: remoteVideo.currentTime,
                    duration: remoteVideo.duration
                });
                
                if (remoteVideo.srcObject) {
                    const stream = remoteVideo.srcObject;
                    const videoTracks = stream.getVideoTracks();
                    const audioTracks = stream.getAudioTracks();
                    
                    console.log('🎥 遠程視頻軌道:', videoTracks.map(t => ({
                        id: t.id,
                        kind: t.kind,
                        enabled: t.enabled,
                        readyState: t.readyState,
                        label: t.label
                    })));
                    
                    if (videoTracks.length === 0) {
                        console.error('❌ 沒有接收到視頻軌道');
                        return { status: 'error', message: '沒有接收到視頻軌道，主播可能未開啟攝像頭' };
                    }
                } else {
                    console.error('❌ 遠程視頻元素沒有流');
                    return { status: 'error', message: '沒有接收到視頻流' };
                }
            } else {
                console.error('❌ 找不到遠程視頻元素');
                return { status: 'error', message: '視頁元素不存在' };
            }
        } else {
            console.error('❌ PeerConnection 未初始化');
            return { status: 'error', message: 'WebRTC 連接未建立' };
        }
        
        return { status: 'success', message: '觀眾端檢查完成' };
    }

    // 網路連接診斷
    async diagnoseNetwork() {
        console.log('🔍 === 網路連接診斷開始 ===');
        
        // 測試 STUN 服務器連接
        const stunServers = [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun.services.mozilla.com',
            'stun:stun.stunprotocol.org:3478'
        ];
        
        for (const stunUrl of stunServers) {
            try {
                const result = await this.testStunServer(stunUrl);
                console.log(`🌐 STUN 測試 ${stunUrl}:`, result);
            } catch (error) {
                console.error(`❌ STUN 測試失敗 ${stunUrl}:`, error);
            }
        }
        
        // 檢查瀏覽器支援
        this.checkBrowserSupport();
        
        return { status: 'success', message: '網路診斷完成' };
    }

    // 測試 STUN 服務器
    testStunServer(stunUrl) {
        return new Promise((resolve, reject) => {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: stunUrl }]
            });
            
            let resolved = false;
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    pc.close();
                    reject(new Error('超時'));
                }
            }, 5000);
            
            pc.onicecandidate = function(event) {
                if (event.candidate && !resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    pc.close();
                    resolve({
                        type: event.candidate.type,
                        address: event.candidate.address,
                        protocol: event.candidate.protocol
                    });
                }
            };
            
            // 創建 offer 來觸發 ICE 收集
            pc.createDataChannel('test');
            pc.createOffer().then(offer => pc.setLocalDescription(offer));
        });
    }

    // 檢查瀏覽器支援
    checkBrowserSupport() {
        console.log('🔍 瀏覽器支援檢查:');
        
        const support = {
            getUserMedia: !!navigator.mediaDevices?.getUserMedia,
            RTCPeerConnection: !!window.RTCPeerConnection,
            WebSocket: !!window.WebSocket,
            getDisplayMedia: !!navigator.mediaDevices?.getDisplayMedia
        };
        
        console.log('📱 瀏覽器支援:', support);
        
        // 檢查編解碼器支援
        if (window.RTCRtpSender?.getCapabilities) {
            const videoCapabilities = RTCRtpSender.getCapabilities('video');
            const audioCapabilities = RTCRtpSender.getCapabilities('audio');
            
            console.log('🎥 視頻編解碼器:', videoCapabilities?.codecs?.map(c => c.mimeType));
            console.log('🎵 音頻編解碼器:', audioCapabilities?.codecs?.map(c => c.mimeType));
        }
        
        return support;
    }

    // 完整診斷
    async runFullDiagnostics() {
        console.log('🚀 === WebRTC 完整診斷開始 ===');
        
        const results = {
            network: await this.diagnoseNetwork(),
            browser: this.checkBrowserSupport()
        };
        
        // 根據當前頁面判斷角色
        if (window.location.pathname.includes('viewer') || window.location.search.includes('streamer=')) {
            results.viewer = this.diagnoseViewer();
        } else {
            results.broadcaster = this.diagnoseBroadcaster();
        }
        
        console.log('📋 診斷結果摘要:', results);
        
        // 生成建議
        const suggestions = this.generateSuggestions(results);
        console.log('💡 改善建議:', suggestions);
        
        return { results, suggestions };
    }

    // 生成改善建議
    generateSuggestions(results) {
        const suggestions = [];
        
        // 根據診斷結果生成建議
        if (results.broadcaster?.status === 'error') {
            suggestions.push(`主播端問題: ${results.broadcaster.message}`);
        }
        
        if (results.viewer?.status === 'error') {
            suggestions.push(`觀眾端問題: ${results.viewer.message}`);
        }
        
        if (results.network?.status === 'error') {
            suggestions.push(`網路問題: ${results.network.message}`);
        }
        
        // 通用建議
        suggestions.push('1. 確認主播已開始直播並啟用攝像頭');
        suggestions.push('2. 檢查網路連接是否穩定');
        suggestions.push('3. 確認瀏覽器支援 WebRTC (建議使用 Chrome/Firefox)');
        suggestions.push('4. 檢查防火牆設置是否阻擋 WebRTC 連接');
        suggestions.push('5. 嘗試重新整理頁面重新建立連接');
        
        return suggestions;
    }
}

// 全局診斷函數
window.runWebRTCDiagnostics = async function() {
    const diagnostics = new WebRTCDiagnostics();
    const result = await diagnostics.runFullDiagnostics();
    
    // 在控制台顯示結果
    console.log('='.repeat(50));
    console.log('🎯 WebRTC 診斷完成！');
    console.log('='.repeat(50));
    
    if (result.suggestions.length > 0) {
        console.log('💡 建議措施:');
        result.suggestions.forEach((suggestion, index) => {
            console.log(`   ${index + 1}. ${suggestion}`);
        });
    }
    
    return result;
};

// 快速診斷函數
window.quickDiagnose = function() {
    console.log('⚡ 快速診斷...');
    
    const isViewer = window.location.pathname.includes('viewer') || window.location.search.includes('streamer=');
    
    if (isViewer) {
        // 觀眾端快速檢查
        const issues = [];
        
        if (!window.socket || window.socket.readyState !== WebSocket.OPEN) {
            issues.push('❌ WebSocket 未連接');
        }
        
        if (!window.peerConnection) {
            issues.push('❌ WebRTC 連接未建立');
        } else if (window.peerConnection.connectionState === 'failed') {
            issues.push('❌ WebRTC 連接失敗');
        }
        
        const remoteVideo = document.getElementById('remoteVideo');
        if (!remoteVideo || !remoteVideo.srcObject) {
            issues.push('❌ 沒有接收到視頻流');
        }
        
        if (issues.length === 0) {
            console.log('✅ 觀眾端狀態正常');
        } else {
            console.log('⚠️ 發現問題:');
            issues.forEach(issue => console.log(`   ${issue}`));
        }
    } else {
        // 主播端快速檢查
        const issues = [];
        
        if (!window.isStreaming) {
            issues.push('❌ 尚未開始直播');
        }
        
        if (!window.localStream) {
            issues.push('❌ 本地媒體流未建立');
        }
        
        if (!window.streamingSocket || window.streamingSocket.readyState !== WebSocket.OPEN) {
            issues.push('❌ WebSocket 未連接');
        }
        
        if (!window.peerConnections || window.peerConnections.size === 0) {
            issues.push('⚠️ 沒有觀眾連接');
        }
        
        if (issues.length === 0) {
            console.log('✅ 主播端狀態正常');
        } else {
            console.log('⚠️ 發現問題:');
            issues.forEach(issue => console.log(`   ${issue}`));
        }
    }
};

console.log('🔧 WebRTC 診斷工具已載入！');
console.log('使用方法:');
console.log('  - runWebRTCDiagnostics() - 完整診斷');
console.log('  - quickDiagnose() - 快速診斷');
