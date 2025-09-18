console.log('🚀 登入頁面開始載入');

// DOM 載入完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM 載入完成');
    
    // 查找元素
    const form = document.querySelector('.auth-form-new');
    const submitBtn = document.querySelector('.btn-login-new');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.querySelector('.password-toggle-new');
    
    console.log('📊 元素檢查結果:', {
        form: !!form,
        submitBtn: !!submitBtn,
        usernameInput: !!usernameInput,
        passwordInput: !!passwordInput,
        toggleBtn: !!toggleBtn
    });
    
    if (!form || !submitBtn || !usernameInput || !passwordInput) {
        console.error('❌ 缺少重要元素');
        return;
    }
    
    // 密碼切換功能
    if (toggleBtn) {
        console.log('🔧 綁定密碼切換按鈕事件');
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ 密碼切換按鈕被點擊');
            window.togglePassword('password'); // 使用 common.js 中的 togglePassword
        });
    }
    
    // 表單提交
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        console.log('📝 表單提交事件觸發');
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        console.log('📋 表單數據:', { username: username, password: '***' });
        
        if (!username || !password) {
            alert('請填寫所有必填欄位');
            return;
        }
        
        // 實際登入處理
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登入中...';
        submitBtn.disabled = true;
        
        // 發送登入請求
        fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: username, // 可以是 email 或 username
                password: password
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('📡 服務器回應:', data);
            
            if (data.success) {
                // 將用戶資訊存入 localStorage
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                alert(`登入成功！歡迎回來，${data.user.displayName}！`);
                window.location.href = data.redirectUrl || 'index.html';
            } else {
                alert(data.message || '登入失敗，請重試');
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        })
        .catch(error => {
            console.error('❌ 登入錯誤:', error);
            alert('網路錯誤，請稍後重試');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        });
    });
    
    // 輸入框焦點事件
    usernameInput.addEventListener('focus', function() {
        console.log(' 用戶名輸入框獲得焦點');
    });
    
    passwordInput.addEventListener('focus', function() {
        console.log(' 密碼輸入框獲得焦點');
    });
    
    // 提交按鈕點擊事件
    submitBtn.addEventListener('click', function() {
        console.log('🖱️ 提交按鈕被點擊');
    });
    
    console.log('✅ 所有事件綁定完成');
});

// 全局點擊測試
document.addEventListener('click', function(e) {
    console.log('🌍 全局點擊:', e.target.tagName, e.target.className, e.target.id);
});

console.log('🏁 JavaScript 載入完成');