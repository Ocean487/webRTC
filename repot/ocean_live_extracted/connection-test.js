// WebRTC 連接測試 - 專門解決觀眾無法看直播的問題
// 基於您搜尋的文章和最佳實踐

class ConnectionTest {
    constructor() {
        this.isViewer = window.location.pathname.includes('viewer') || window.location.search.includes('streamer=');
        this.testResults = [];
    }

    // 主要診斷函數
    async diagnoseViewerIssue() {
        console.log('🔍 === 觀眾無法看直播診斷 ===');
        
        const tests = [
            { name: '檢查頁面類型', test: this.checkPageType.bind(this) },
            { name: '檢查 WebSocket 連接', test: this.checkWebSocket.bind(this) },
            { name: '檢查 PeerConnection', test: this.checkPeerConnection.bind(this) },
            { name: '檢查視頻元素', test: this.checkVideoElement.bind(this) },
            { name: '檢查事件監聽', test: this.checkEventListeners.bind(this) },
            { name: '檢查主播狀態', test: this.checkBroadcasterStatus.bind(this) }
        ];

        for (const { name, test } of tests) {
            console.log(`🔍 ${name}...`);
            try {
                const result = await test();
                this.testResults.push({ name, status: 'pass', result });
                console.log(`✅ ${name}: 通過`);
            } catch (error) {
                this.testResults.push({ name, status: 'fail', error: error.message });
                console.error(`❌ ${name}: ${error.message}`);
            }
        }

        this.generateReport();
        return this.testResults;
    }

    // 檢查頁面類型
    checkPageType() {
        const url = window.location.href;
        console.log('當前頁面:', url);
        
        if (this.isViewer) {
            console.log('✅ 確認為觀眾頁面');
            return { type: 'viewer', url };
        } else {
            console.log('✅ 確認為主播頁面');
            return { type: 'broadcaster', url };
        }
    }

    // 檢查 WebSocket 連接
    checkWebSocket() {
        if (this.isViewer) {
            if (!window.socket) {
                throw new Error('觀眾端 WebSocket 未初始化');
            }
            if (window.socket.readyState !== WebSocket.OPEN) {
                throw new Error(`觀眾端 WebSocket 狀態異常: ${window.socket.readyState}`);
            }
            return { status: 'connected', readyState: window.socket.readyState };
        } else {
            if (!window.streamingSocket) {
                throw new Error('主播端 WebSocket 未初始化');
            }
            if (window.streamingSocket.readyState !== WebSocket.OPEN) {
                throw new Error(`主播端 WebSocket 狀態異常: ${window.streamingSocket.readyState}`);
            }
            return { status: 'connected', readyState: window.streamingSocket.readyState };
        }
    }

    // 檢查 PeerConnection
    checkPeerConnection() {
        if (this.isViewer) {
            if (!window.peerConnection) {
                throw new Error('觀眾端 PeerConnection 未建立');
            }
            
            const pc = window.peerConnection;
            const states = {
                connectionState: pc.connectionState,
                iceConnectionState: pc.iceConnectionState,
                iceGatheringState: pc.iceGatheringState,
                signalingState: pc.signalingState
            };
            
            // 檢查接收者
            const receivers = pc.getReceivers();
            const videoReceivers = receivers.filter(r => r.track && r.track.kind === 'video');
            const audioReceivers = receivers.filter(r => r.track && r.track.kind === 'audio');
            
            if (videoReceivers.length === 0) {
                throw new Error('沒有視頻接收器');
            }
            
            return {
                states,
                receivers: {
                    total: receivers.length,
                    video: videoReceivers.length,
                    audio: audioReceivers.length
                }
            };
        } else {
            if (!window.peerConnections || window.peerConnections.size === 0) {
                throw new Error('主播端沒有觀眾連接');
            }
            
            const connections = [];
            window.peerConnections.forEach((pc, viewerId) => {
                const senders = pc.getSenders();
                const videoSenders = senders.filter(s => s.track && s.track.kind === 'video');
                
                connections.push({
                    viewerId: viewerId.substr(-3),
                    connectionState: pc.connectionState,
                    iceConnectionState: pc.iceConnectionState,
                    senders: {
                        total: senders.length,
                        video: videoSenders.length
                    }
                });
            });
            
            return { connectionCount: window.peerConnections.size, connections };
        }
    }

    // 檢查視頻元素
    checkVideoElement() {
        if (this.isViewer) {
            const remoteVideo = document.getElementById('remoteVideo');
            if (!remoteVideo) {
                throw new Error('找不到 remoteVideo 元素');
            }
            
            const info = {
                srcObject: !!remoteVideo.srcObject,
                videoWidth: remoteVideo.videoWidth,
                videoHeight: remoteVideo.videoHeight,
                readyState: remoteVideo.readyState,
                paused: remoteVideo.paused,
                currentTime: remoteVideo.currentTime,
                duration: remoteVideo.duration || 'unknown',
                display: remoteVideo.style.display
            };
            
            if (!remoteVideo.srcObject) {
                throw new Error('remoteVideo 沒有視頻流');
            }
            
            if (remoteVideo.videoWidth === 0 || remoteVideo.videoHeight === 0) {
                throw new Error('視頻尺寸為 0，可能是解碼問題');
            }
            
            return info;
        } else {
            const localVideo = document.getElementById('localVideo');
            if (!localVideo) {
                throw new Error('找不到 localVideo 元素');
            }
            
            const info = {
                srcObject: !!localVideo.srcObject,
                videoWidth: localVideo.videoWidth,
                videoHeight: localVideo.videoHeight,
                readyState: localVideo.readyState
            };
            
            if (!localVideo.srcObject) {
                throw new Error('localVideo 沒有視頻流');
            }
            
            return info;
        }
    }

    // 檢查事件監聽
    checkEventListeners() {
        if (this.isViewer) {
            const pc = window.peerConnection;
            if (!pc) {
                throw new Error('PeerConnection 不存在');
            }
            
            // 檢查關鍵事件是否已設置
            const events = {
                ontrack: !!pc.ontrack,
                onicecandidate: !!pc.onicecandidate,
                onconnectionstatechange: !!pc.onconnectionstatechange,
                oniceconnectionstatechange: !!pc.oniceconnectionstatechange
            };
            
            const missingEvents = Object.entries(events)
                .filter(([event, exists]) => !exists)
                .map(([event]) => event);
            
            if (missingEvents.length > 0) {
                throw new Error(`缺少事件監聽: ${missingEvents.join(', ')}`);
            }
            
            return events;
        } else {
            // 檢查主播端的全局函數
            const functions = {
                handleViewerJoin: typeof window.handleViewerJoin === 'function',
                createPeerConnection: typeof window.createPeerConnection === 'function',
                sendStreamToViewer: typeof window.sendStreamToViewer === 'function',
                handleAnswer: typeof window.handleAnswer === 'function'
            };
            
            const missingFunctions = Object.entries(functions)
                .filter(([func, exists]) => !exists)
                .map(([func]) => func);
            
            if (missingFunctions.length > 0) {
                throw new Error(`缺少關鍵函數: ${missingFunctions.join(', ')}`);
            }
            
            return functions;
        }
    }

    // 檢查主播狀態
    checkBroadcasterStatus() {
        if (this.isViewer) {
            // 觀眾端檢查是否收到過信令
            const signals = {
                receivedOffer: !!window.receivedOffer,
                receivedStreamStart: !!window.receivedStreamStart,
                receivedIceCandidate: !!window.receivedIceCandidate
            };
            
            if (!signals.receivedStreamStart) {
                throw new Error('未收到直播開始信號，主播可能未開始直播');
            }
            
            if (!signals.receivedOffer) {
                throw new Error('未收到 WebRTC Offer，主播端可能有問題');
            }
            
            return signals;
        } else {
            // 主播端檢查直播狀態
            const status = {
                isStreaming: !!window.isStreaming,
                hasLocalStream: !!window.localStream,
                peerConnectionCount: window.peerConnections ? window.peerConnections.size : 0
            };
            
            if (!status.isStreaming) {
                throw new Error('主播未開始直播');
            }
            
            if (!status.hasLocalStream) {
                throw new Error('主播沒有本地視頻流');
            }
            
            return status;
        }
    }

    // 生成診斷報告
    generateReport() {
        console.log('\n📋 === 診斷報告 ===');
        
        const passed = this.testResults.filter(r => r.status === 'pass').length;
        const failed = this.testResults.filter(r => r.status === 'fail').length;
        
        console.log(`📊 測試結果: ${passed} 通過, ${failed} 失敗`);
        
        if (failed > 0) {
            console.log('\n❌ 失敗的測試:');
            this.testResults
                .filter(r => r.status === 'fail')
                .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
        }
        
        console.log('\n💡 建議措施:');
        this.generateRecommendations();
    }

    // 生成建議措施
    generateRecommendations() {
        const failedTests = this.testResults.filter(r => r.status === 'fail');
        const recommendations = [];
        
        if (failedTests.some(t => t.name.includes('WebSocket'))) {
            recommendations.push('1. 重新整理頁面重新建立 WebSocket 連接');
            recommendations.push('2. 檢查網路連接是否穩定');
        }
        
        if (failedTests.some(t => t.name.includes('PeerConnection'))) {
            recommendations.push('3. 檢查防火牆設置，確保 WebRTC 流量通過');
            recommendations.push('4. 嘗試使用不同的網路環境');
        }
        
        if (failedTests.some(t => t.name.includes('視頻元素'))) {
            recommendations.push('5. 檢查瀏覽器是否支援視頻解碼');
            recommendations.push('6. 嘗試使用 Chrome 或 Firefox 最新版本');
        }
        
        if (failedTests.some(t => t.name.includes('主播狀態'))) {
            recommendations.push('7. 確認主播已開始直播並啟用攝像頭');
            recommendations.push('8. 檢查主播端是否有錯誤訊息');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('所有測試通過，如果仍有問題請聯繫技術支援');
        }
        
        recommendations.forEach(rec => console.log(`  ${rec}`));
    }

    // 快速修復嘗試
    async attemptQuickFix() {
        console.log('🔧 嘗試快速修復...');
        
        if (this.isViewer) {
            // 觀眾端修復
            if (!window.peerConnection || window.peerConnection.connectionState === 'failed') {
                console.log('🔄 重新初始化 PeerConnection...');
                if (typeof window.initializePeerConnection === 'function') {
                    window.initializePeerConnection();
                }
            }
            
            // 重新請求流
            if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                console.log('📡 重新發送觀眾加入請求...');
                window.socket.send(JSON.stringify({
                    type: 'viewer_join',
                    viewerId: window.viewerId,
                    streamerId: window.targetStreamerId,
                    userInfo: window.currentUser || { displayName: `觀眾${window.viewerId.substr(-3)}`, avatarUrl: null }
                }));
            }
        } else {
            // 主播端修復
            if (window.isStreaming && window.localStream && window.peerConnections.size === 0) {
                console.log('🔄 嘗試重新建立觀眾連接...');
                // 觸發重新掃描觀眾
                if (window.streamingSocket && window.streamingSocket.readyState === WebSocket.OPEN) {
                    window.streamingSocket.send(JSON.stringify({
                        type: 'request_viewers',
                        broadcasterId: window.getBroadcasterId()
                    }));
                }
            }
        }
        
        console.log('✅ 快速修復嘗試完成');
    }
}

// 全局函數
window.diagnoseConnection = async function() {
    const tester = new ConnectionTest();
    const results = await tester.diagnoseViewerIssue();
    
    // 如果有問題，嘗試快速修復
    const hasFailures = results.some(r => r.status === 'fail');
    if (hasFailures) {
        console.log('\n🔧 檢測到問題，嘗試自動修復...');
        await tester.attemptQuickFix();
        
        // 再次測試
        setTimeout(async () => {
            console.log('\n🔄 重新測試...');
            await tester.diagnoseViewerIssue();
        }, 3000);
    }
    
    return results;
};

// 專門的觀眾連接測試
window.testViewerConnection = function() {
    console.log('🎥 === 觀眾連接專項測試 ===');
    
    if (!window.location.pathname.includes('viewer') && !window.location.search.includes('streamer=')) {
        console.log('❌ 這不是觀眾頁面');
        return;
    }
    
    const issues = [];
    
    // 檢查基本要素
    if (!window.socket || window.socket.readyState !== WebSocket.OPEN) {
        issues.push('WebSocket 未連接');
    }
    
    if (!window.peerConnection) {
        issues.push('PeerConnection 未建立');
    } else {
        if (window.peerConnection.connectionState === 'failed') {
            issues.push('WebRTC 連接失敗');
        }
        
        const receivers = window.peerConnection.getReceivers();
        const videoReceivers = receivers.filter(r => r.track && r.track.kind === 'video');
        if (videoReceivers.length === 0) {
            issues.push('沒有接收到視頻軌道');
        }
    }
    
    const remoteVideo = document.getElementById('remoteVideo');
    if (!remoteVideo) {
        issues.push('找不到 remoteVideo 元素');
    } else if (!remoteVideo.srcObject) {
        issues.push('remoteVideo 沒有視頻流');
    } else if (remoteVideo.videoWidth === 0) {
        issues.push('視頻尺寸為 0');
    }
    
    // 檢查信令
    if (!window.receivedStreamStart) {
        issues.push('未收到直播開始信號');
    }
    
    if (!window.receivedOffer) {
        issues.push('未收到 WebRTC Offer');
    }
    
    if (issues.length === 0) {
        console.log('✅ 觀眾連接狀態正常');
    } else {
        console.log('❌ 發現問題:');
        issues.forEach(issue => console.log(`  - ${issue}`));
        
        console.log('\n💡 建議:');
        console.log('  1. 確認主播已開始直播');
        console.log('  2. 重新整理頁面');
        console.log('  3. 檢查網路連接');
        console.log('  4. 嘗試不同瀏覽器');
    }
    
    return issues;
};

console.log('🔧 連接測試工具已載入！');
console.log('使用方法:');
console.log('  - diagnoseConnection() - 完整診斷');
console.log('  - testViewerConnection() - 觀眾連接測試');
