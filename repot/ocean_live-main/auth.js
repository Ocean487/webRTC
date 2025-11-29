// 用戶數據存儲
let users = JSON.parse(localStorage.getItem('users')) || {};
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// 切換密碼可見性
function togglePassword(inputId = 'password') {
    const passwordInput = document.getElementById(inputId);
    const button = event.currentTarget;
    const eyeIcon = button.querySelector('i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        loginTab.classList.remove('active');
        registerTab.classList.add('active');
    }
}

// 處理登入/註冊
async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!username || !password) {
        alert('請填寫使用者名稱和密碼');
        return;
    }

    // 檢查是否是註冊
    if (!users[username]) {
        if (password !== confirmPassword) {
            alert('兩次輸入的密碼不一致');
            return;
        }
        // 註冊新用戶
        users[username] = {
            password: await hashPassword(password),
            followings: [],
            avatar: 'default-avatar.png',
            createdAt: new Date().toISOString()
        };
        localStorage.setItem('users', JSON.stringify(users));
    } else {
        // 登入驗證
        const isValid = await verifyPassword(password, users[username].password);
        if (!isValid) {
            alert('密碼錯誤');
            return;
        }
    }

    // 設置當前用戶
    currentUser = {
        username,
        avatar: users[username].avatar
    };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    // 檢查之前的頁面
    let previousPage = sessionStorage.getItem('previousPage') || 'index.html';
    // 確保不會跳轉到preview頁面
    if (previousPage === 'preview.html') {
        previousPage = 'index.html';
    }
    // 跳轉回之前的頁面或主頁
    window.location.href = previousPage;
}

// 登出
function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

// 檢查登入狀態
function checkAuth() {
    if (!currentUser) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// 密碼加密（示例使用簡單的雜湊）
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// 驗證密碼
async function verifyPassword(password, hash) {
    const hashedInput = await hashPassword(password);
    return hashedInput === hash;
}

// 頁面加載時檢查登入狀態
document.addEventListener('DOMContentLoaded', () => {
    const isLoginPage = window.location.pathname.includes('login.html');
    const isRegisterPage = window.location.pathname.includes('register.html');
    
    if (!isLoginPage && !isRegisterPage && !checkAuth()) {
        return;
    }

    // 更新用戶界面
    if (currentUser) {
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar) {
            userAvatar.src = currentUser.avatar;
            userAvatar.alt = currentUser.username;
        }
    }
});
