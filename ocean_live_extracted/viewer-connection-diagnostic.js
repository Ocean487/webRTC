// 觀眾連接診斷工具
// 專門診斷觀眾連接直播的問題

(function() {
    'use strict';
    
    console.log('🔍 觀眾連接診斷工具啟動...');
    
    let diagnosticResults = {};
    let diagnosticStartTime = Date.now();
    
    // 等待頁面載入完成
    function waitForPageReady() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
    }
    
    // 診斷1: 檢查基本環境
    function checkBasicEnvironment() {
        console.log('📋 1. 檢查基本環境...');
        
        const env = {
            url: window.location.href,
            protocol: window.location.protocol,
            host: window.location.host,
            userAgent: navigator.userAgent,
            webSocketSupport: typeof WebSocket !== 'undefined',
            webRTCSupport: typeof RTCPeerConnection !== 'undefined',
            secureContext: window.isSecureContext
        };
        
        diagnosticResults.environment = env;
        
        console.log('🌐 環境信息:', env);
        
        // 檢查問題
        const issues = [];
        if (!env.webSocketSupport) issues.push('不支援 WebSocket');
        if (!env.webRTCSupport) issues.push('不支援 WebRTC');
        if (env.protocol === 'https:' && !env.secureContext) issues.push('HTTPS 安全上下文問題');
        
        return { status: issues.length === 0 ? 'OK' : 'ISSUES', issues };
    }
    
    // 診斷2: 檢查URL參數和主播ID
    function checkStreamerParams() {
        console.log('📋 2. 檢查主播參數...');
        
        const urlParams = new URLSearchParams(window.location.search);
        const streamerParam = urlParams.get('streamer');
        const targetStreamerId = window.targetStreamerId || getStreamerIdFromUrl();
        
        const params = {
            hasStreamerParam: !!streamerParam,
            streamerParam: streamerParam,
            targetStreamerId: targetStreamerId,
            allParams: Object.fromEntries(urlParams.entries())
        };
        
        diagnosticResults.streamerParams = params;
        
        console.log('🎯 主播參數:', params);
        
        const issues = [];
        if (!streamerParam && targetStreamerId === 'default') {
            issues.push('沒有指定主播ID，使用預設值');
        }
        
        return { status: issues.length === 0 ? 'OK' : 'WARNING', issues };
    }
    
    // 診斷3: 檢查WebSocket連接
    function checkWebSocketConnection() {
        return new Promise((resolve) => {
            console.log('📋 3. 檢查 WebSocket 連接...');
            
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            
            console.log('🔗 WebSocket URL:', wsUrl);
            
            const startTime = Date.now();
            let testSocket;
            
            try {
                testSocket = new WebSocket(wsUrl);
                
                const timeout = setTimeout(() => {
                    testSocket.close();
                    resolve({
                        status: 'TIMEOUT',
                        issues: ['WebSocket 連接超時 (5秒)'],
                        details: { wsUrl, duration: Date.now() - startTime }
                    });
                }, 5000);
                
                testSocket.onopen = function() {
                    clearTimeout(timeout);
                    const duration = Date.now() - startTime;
                    console.log(`✅ WebSocket 連接成功 (${duration}ms)`);
                    
                    testSocket.close();
                    resolve({
                        status: 'OK',
                        issues: [],
                        details: { wsUrl, duration }
                    });
                };
                
                testSocket.onerror = function(error) {
                    clearTimeout(timeout);
                    console.error('❌ WebSocket 連接錯誤:', error);
                    
                    resolve({
                        status: 'ERROR',
                        issues: ['WebSocket 連接失敗'],
                        details: { wsUrl, error: error.toString(), duration: Date.now() - startTime }
                    });
                };
                
                testSocket.onclose = function(event) {
                    console.log('🔌 WebSocket 連接關閉:', event.code, event.reason);
                };
                
            } catch (error) {
                console.error('❌ WebSocket 創建失敗:', error);
                resolve({
                    status: 'ERROR',
                    issues: ['無法創建 WebSocket 連接'],
                    details: { wsUrl, error: error.toString() }
                });
            }
        });
    }
    
    // 診斷4: 檢查服務器響應
    function checkServerResponse() {
        return new Promise((resolve) => {
            console.log('📋 4. 檢查服務器響應...');
            
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            
            try {
                const testSocket = new WebSocket(wsUrl);
                const startTime = Date.now();
                let messageReceived = false;
                
                const timeout = setTimeout(() => {
                    if (!messageReceived) {
                        testSocket.close();
                        resolve({
                            status: 'TIMEOUT',
                            issues: ['服務器無響應 (10秒超時)'],
                            details: { duration: Date.now() - startTime }
                        });
                    }
                }, 10000);
                
                testSocket.onopen = function() {
                    console.log('🔗 測試連接已建立，發送測試消息...');
                    
                    // 發送觀眾加入消息
                    const testMessage = {
                        type: 'viewer_join',
                        viewerId: 'diagnostic_test_' + Math.random().toString(36).substr(2, 9),
                        streamerId: window.targetStreamerId || 'default',
                        userInfo: { displayName: '診斷測試', isTest: true }
                    };
                    
                    testSocket.send(JSON.stringify(testMessage));
                    console.log('📤 已發送測試消息:', testMessage);
                };
                
                testSocket.onmessage = function(event) {
                    clearTimeout(timeout);
                    messageReceived = true;
                    
                    try {
                        const data = JSON.parse(event.data);
                        console.log('📥 收到服務器響應:', data);
                        
                        testSocket.close();
                        resolve({
                            status: 'OK',
                            issues: [],
                            details: { 
                                responseType: data.type,
                                duration: Date.now() - startTime,
                                response: data
                            }
                        });
                    } catch (error) {
                        testSocket.close();
                        resolve({
                            status: 'ERROR',
                            issues: ['服務器響應格式錯誤'],
                            details: { error: error.toString(), rawData: event.data }
                        });
                    }
                };
                
                testSocket.onerror = function(error) {
                    clearTimeout(timeout);
                    console.error('❌ 測試連接錯誤:', error);
                    
                    resolve({
                        status: 'ERROR',
                        issues: ['測試連接失敗'],
                        details: { error: error.toString() }
                    });
                };
                
            } catch (error) {
                resolve({
                    status: 'ERROR',
                    issues: ['無法建立測試連接'],
                    details: { error: error.toString() }
                });
            }
        });
    }
    
    // 診斷5: 檢查現有連接狀態
    function checkExistingConnection() {
        console.log('📋 5. 檢查現有連接狀態...');
        
        const existingSocket = window.socket;
        const existingPeerConnection = window.peerConnection;
        const isConnected = window.isConnected;
        const viewerId = window.viewerId;
        
        const connection = {
            hasSocket: !!existingSocket,
            socketState: existingSocket ? existingSocket.readyState : null,
            socketStateText: existingSocket ? getWebSocketStateText(existingSocket.readyState) : null,
            hasPeerConnection: !!existingPeerConnection,
            peerConnectionState: existingPeerConnection ? existingPeerConnection.connectionState : null,
            iceConnectionState: existingPeerConnection ? existingPeerConnection.iceConnectionState : null,
            isConnected: isConnected,
            viewerId: viewerId
        };
        
        diagnosticResults.existingConnection = connection;
        
        console.log('🔗 現有連接狀態:', connection);
        
        const issues = [];
        if (!connection.hasSocket) issues.push('沒有 WebSocket 連接');
        else if (connection.socketState !== WebSocket.OPEN) issues.push(`WebSocket 狀態異常: ${connection.socketStateText}`);
        
        if (!connection.isConnected) issues.push('標記為未連接');
        
        return { status: issues.length === 0 ? 'OK' : 'ISSUES', issues };
    }
    
    // 輔助函數：獲取WebSocket狀態文字
    function getWebSocketStateText(state) {
        const states = {
            [WebSocket.CONNECTING]: 'CONNECTING',
            [WebSocket.OPEN]: 'OPEN',
            [WebSocket.CLOSING]: 'CLOSING',
            [WebSocket.CLOSED]: 'CLOSED'
        };
        return states[state] || 'UNKNOWN';
    }
    
    // 生成診斷報告
    function generateReport(results) {
        console.log('\n📊 === 觀眾連接診斷報告 ===');
        
        const totalDuration = Date.now() - diagnosticStartTime;
        console.log(`🕒 診斷時間: ${totalDuration}ms`);
        
        let overallStatus = 'OK';
        let criticalIssues = [];
        let warnings = [];
        
        Object.entries(results).forEach(([test, result]) => {
            console.log(`\n📋 ${test}:`);
            console.log(`   狀態: ${result.status}`);
            
            if (result.issues && result.issues.length > 0) {
                console.log(`   問題: ${result.issues.join(', ')}`);
                
                if (result.status === 'ERROR') {
                    overallStatus = 'ERROR';
                    criticalIssues.push(...result.issues);
                } else if (result.status === 'ISSUES' || result.status === 'TIMEOUT') {
                    if (overallStatus !== 'ERROR') overallStatus = 'ISSUES';
                    criticalIssues.push(...result.issues);
                } else if (result.status === 'WARNING') {
                    warnings.push(...result.issues);
                }
            }
            
            if (result.details) {
                console.log('   詳細:', result.details);
            }
        });
        
        console.log(`\n🎯 整體狀態: ${overallStatus}`);
        
        if (criticalIssues.length > 0) {
            console.log('❌ 關鍵問題:');
            criticalIssues.forEach(issue => console.log(`   • ${issue}`));
        }
        
        if (warnings.length > 0) {
            console.log('⚠️ 警告:');
            warnings.forEach(warning => console.log(`   • ${warning}`));
        }
        
        // 提供修復建議
        provideSuggestions(overallStatus, criticalIssues, warnings);
        
        return { overallStatus, criticalIssues, warnings, results };
    }
    
    // 提供修復建議
    function provideSuggestions(status, issues, warnings) {
        console.log('\n💡 修復建議:');
        
        if (issues.some(issue => issue.includes('WebSocket'))) {
            console.log('   🔧 WebSocket 問題:');
            console.log('      • 檢查服務器是否正在運行');
            console.log('      • 確認端口 3000 可訪問');
            console.log('      • 檢查防火牆設置');
        }
        
        if (issues.some(issue => issue.includes('主播ID'))) {
            console.log('   🎯 主播ID 問題:');
            console.log('      • 在 URL 中添加 ?streamer=主播ID');
            console.log('      • 確認主播正在直播');
        }
        
        if (issues.some(issue => issue.includes('超時'))) {
            console.log('   ⏰ 超時問題:');
            console.log('      • 檢查網絡連接');
            console.log('      • 重新載入頁面');
            console.log('      • 檢查服務器負載');
        }
        
        if (status === 'OK') {
            console.log('   ✅ 連接正常，如果仍有問題請檢查:');
            console.log('      • 主播是否正在直播');
            console.log('      • 瀏覽器控制台其他錯誤');
            console.log('      • WebRTC 連接狀態');
        }
    }
    
    // 主診斷函數
    async function runDiagnostic() {
        await waitForPageReady();
        
        console.log('🚀 開始觀眾連接診斷...');
        
        const results = {};
        
        // 執行所有診斷
        results.environment = checkBasicEnvironment();
        results.streamerParams = checkStreamerParams();
        results.existingConnection = checkExistingConnection();
        results.webSocketConnection = await checkWebSocketConnection();
        results.serverResponse = await checkServerResponse();
        
        // 生成報告
        const report = generateReport(results);
        
        // 將結果存儲到全局變量供外部訪問
        window.viewerDiagnosticResults = report;
        
        return report;
    }
    
    // 自動運行診斷
    if (window.location.pathname.includes('viewer')) {
        setTimeout(runDiagnostic, 2000); // 延遲2秒執行，確保其他腳本載入完成
    }
    
    // 提供手動診斷函數
    window.runViewerDiagnostic = runDiagnostic;
    
    console.log('✅ 觀眾連接診斷工具已載入');
    console.log('💡 手動執行診斷: runViewerDiagnostic()');
    
})();

console.log('🔍 觀眾連接診斷工具已載入');
