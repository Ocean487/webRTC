// 全域錯誤處理工具
// 用於抑制常見的不必要錯誤訊息

(function() {
    'use strict';
    
    console.log('🔧 錯誤處理工具啟動...');
    
    // 記錄原始的 console.error
    const originalConsoleError = console.error;
    
    // 需要抑制的錯誤模式
    const suppressedErrors = [
        // API 401 錯誤（多種格式）
        /GET.*\/api\/user.*401.*Unauthorized/i,
        /401.*Unauthorized.*\/api\/user/i,
        /loadCurrentUser.*viewer\.js.*61/i,
        // 瀏覽器擴展錯誤
        /extension.*context.*invalidated/i,
        /immersive.*translate/i,
        /message.*channel.*closed/i,
        // 已知的檔案載入錯誤
        /webrtc-diagnostics\.js.*404/i,
        /connection-test\.js.*404/i,
        // MIME 類型錯誤
        /MIME.*type.*text\/html.*not.*executable/i
    ];
    
    // 重寫 console.error
    console.error = function(...args) {
        const message = args.join(' ');
        
        // 檢查是否需要抑制這個錯誤
        const shouldSuppress = suppressedErrors.some(pattern => pattern.test(message));
        
        if (shouldSuppress) {
            // 用較低的日誌級別記錄
            console.log('🔇 [已抑制錯誤]', ...args);
            return;
        }
        
        // 呼叫原始的 console.error
        originalConsoleError.apply(console, args);
    };
    
    // 全域錯誤事件處理
    window.addEventListener('error', function(event) {
        const errorMessage = event.message || '';
        const filename = event.filename || '';
        
        // 檢查是否是需要抑制的錯誤
        if (errorMessage.includes('401') && filename.includes('/api/user')) {
            console.log('🔇 已抑制 401 錯誤，用戶將使用訪客模式');
            event.preventDefault();
            return false;
        }
        
        if (filename.includes('webrtc-diagnostics.js') || filename.includes('connection-test.js')) {
            console.log('🔇 已抑制缺少檔案的錯誤:', filename);
            event.preventDefault();
            return false;
        }
        
        if (errorMessage.includes('MIME type') && errorMessage.includes('text/html')) {
            console.log('🔇 已抑制 MIME 類型錯誤');
            event.preventDefault();
            return false;
        }
    });
    
    // 處理未捕獲的 Promise 拒絕
    window.addEventListener('unhandledrejection', function(event) {
        const reason = event.reason;
        
        if (reason && typeof reason === 'object') {
            if (reason.status === 401 || (reason.message && reason.message.includes('401'))) {
                console.log('🔇 已抑制 Promise 中的 401 錯誤');
                event.preventDefault();
                return false;
            }
        }
        
        // 抑制 fetch 相關的 401 錯誤
        if (reason && reason.toString && reason.toString().includes('401')) {
            console.log('🔇 已抑制 fetch 401 錯誤');
            event.preventDefault();
            return false;
        }
    });
    
    // 攔截 fetch 的 401 錯誤
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = args[0];
        
        try {
            const response = await originalFetch.apply(this, args);
            
            // 如果是 401 錯誤且是 /api/user，靜默處理
            if (response.status === 401 && (typeof url === 'string' && url.includes('/api/user'))) {
                console.log('🔇 [靜默] /api/user 401 錯誤 - 將使用訪客模式');
                // 創建一個靜默的響應副本，避免控制台錯誤
                const silentResponse = response.clone();
                // 添加標記表示這是被攔截的錯誤
                silentResponse._intercepted = true;
                return silentResponse;
            }
            
            return response;
        } catch (error) {
            // 檢查是否是需要抑制的錯誤
            if (error.message && error.message.includes('401') && 
                typeof url === 'string' && url.includes('/api/user')) {
                console.log('🔇 [靜默] fetch 401 錯誤已被攔截');
            }
            throw error;
        }
    };
    
    console.log('✅ 錯誤處理工具配置完成');
    
})();