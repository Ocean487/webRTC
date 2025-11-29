console.log('🚀 忘記密碼頁面開始載入');

// DOM 載入完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM 載入完成');
    
    // 查找元素
    const form = document.querySelector('.auth-form-new');
    const submitBtn = document.querySelector('.btn-login-new');
    const emailInput = document.getElementById('email');
    
    console.log('📊 元素檢查結果:', {
        form: !!form,
        submitBtn: !!submitBtn,
        emailInput: !!emailInput
    });
    
    if (!form || !submitBtn || !emailInput) {
        console.error('❌ 缺少重要元素');
        return;
    }
    
    // 表單提交
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        console.log('📝 表單提交事件觸發');
        
        const email = emailInput.value.trim();
        
        console.log('📋 表單數據:', { email: email });
        
        if (!email) {
            alert('請輸入您的電子郵件地址');
            return;
        }
        
        // 基本電子郵件格式驗證
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('請輸入有效的電子郵件地址');
            return;
        }
        
        // 模擬發送重設郵件
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 發送中...';
        submitBtn.disabled = true;
        
        setTimeout(() => {
            alert(`重設密碼連結已發送到 ${email}，請檢查您的信箱。`);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            // 清空表單
            emailInput.value = '';
        }, 1500);
    });
    
    // 輸入框焦點事件
    emailInput.addEventListener('focus', function() {
        console.log('📝 電子郵件輸入框獲得焦點');
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

// 處理表單提交
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing forgot password form...');
    
    const form = document.querySelector('.auth-form-new');
    const submitBtn = document.querySelector('.btn-login-new');
    
    if (form && submitBtn) {
        console.log('Form and button found');
        
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Form submitted');
            
            const email = document.getElementById('email').value;
            
            if (!email) {
                alert('請輸入您的電子郵件地址');
                return;
            }
            
            // 簡單的電子郵件格式驗證
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('請輸入有效的電子郵件地址');
                return;
            }
            
            // 模擬發送成功
            const originalText = submitBtn.innerHTML;
            
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 發送中...';
            submitBtn.disabled = true;
            
            setTimeout(() => {
                alert(`重設密碼連結已發送到 ${email}，請檢查您的信箱。`);
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                // 清空表單
                document.getElementById('email').value = '';
            }, 1500);
        });
    } else {
        console.error('Form or button not found:', {
            form: !!form,
            submitBtn: !!submitBtn
        });
    }
});

function handleForgotPassword(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    
    // 這裡添加發送重設密碼郵件的邏輯
    // 暫時只顯示成功訊息
    document.getElementById('successMessage').style.display = 'block';
    document.getElementById('email').disabled = true;
    document.querySelector('button[type="submit"]').disabled = true;

    return false;
}
