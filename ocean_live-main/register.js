console.log('🚀 註冊頁面開始載入');

// DOM 載入完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM 載入完成');
    
    // 查找元素
    const form = document.querySelector('.auth-form-new');
    const submitBtn = document.querySelector('.btn-login-new');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const termsCheckbox = document.getElementById('terms');
    const toggleBtns = document.querySelectorAll('.password-toggle-new');
    
    console.log('📊 元素檢查結果:', {
        form: !!form,
        submitBtn: !!submitBtn,
        usernameInput: !!usernameInput,
        emailInput: !!emailInput,
        passwordInput: !!passwordInput,
        confirmPasswordInput: !!confirmPasswordInput,
        termsCheckbox: !!termsCheckbox,
        toggleBtns: toggleBtns.length
    });
    
    if (!form || !submitBtn) {
        console.error('❌ 缺少重要元素');
        return;
    }
    
    // 密碼切換功能
    toggleBtns.forEach((btn, index) => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log(`🖱️ 密碼切換按鈕 ${index + 1} 被點擊`);
            const input = btn.parentElement.querySelector('input');
            if (input) {
                window.togglePassword(input.id); // 使用 common.js 中的 togglePassword
            }
        });
    });
    
    // 表單提交
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        console.log('📝 表單提交事件觸發');
        
        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();
        const termsAccepted = termsCheckbox.checked;
        
        console.log('📋 表單數據:', { 
            username: username, 
            email: email, 
            password: '***',
            confirmPassword: '***',
            termsAccepted: termsAccepted
        });
        
        // 驗證
        if (!username || !email || !password || !confirmPassword) {
            alert('請填寫所有必填欄位');
            return;
        }
        
        if (password !== confirmPassword) {
            alert('兩次輸入的密碼不一致');
            return;
        }
        
        if (!termsAccepted) {
            alert('請同意服務條款和隱私政策');
            return;
        }
        
        if (password.length < 6) {
            alert('密碼長度至少需要6個字元');
            return;
        }
        
        // 模擬註冊過程
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 註冊中...';
        submitBtn.disabled = true;
        
        setTimeout(() => {
            alert('註冊成功！歡迎加入 VibeLo！');
            window.location.href = 'login.html';
        }, 1500);
    });
    
    // 輸入框焦點事件
    [usernameInput, emailInput, passwordInput, confirmPasswordInput].forEach((input, index) => {
        if (input) {
            input.addEventListener('focus', function() {
                console.log(`📝 輸入框 ${index + 1} 獲得焦點`);
            });
        }
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