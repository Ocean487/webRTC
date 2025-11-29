// 移動菜單狀態
let isMenuOpen = false;

// 切換移動菜單
function toggleMenu() {
    const navLinks = document.querySelector('.nav-links');
    const menuButton = document.querySelector('.menu-toggle');
    
    isMenuOpen = !isMenuOpen;
    
    if (isMenuOpen) {
        navLinks.classList.add('active');
        menuButton.innerHTML = '<i class="fas fa-times"></i>';
    } else {
        navLinks.classList.remove('active');
        menuButton.innerHTML = '<i class="fas fa-bars"></i>';
    }
}

// 通用的用戶下拉選單功能
function toggleUserMenu() {
    // 移除現有選單
    const existingMenu = document.querySelector('.user-dropdown');
    if (existingMenu) {
        existingMenu.style.opacity = '0';
        existingMenu.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            if (existingMenu.parentNode) {
                existingMenu.remove();
            }
        }, 150);
        return;
    }
    
    // 獲取用戶頭像元素
    const userAvatar = document.getElementById('userAvatar');
    if (!userAvatar) {
        console.error('用戶頭像元素未找到');
        return;
    }
    
    const currentUserName = userAvatar.title || userAvatar.textContent || '用戶';
    
    // 創建下拉選單
    const menu = document.createElement('div');
    menu.className = 'user-dropdown';
    menu.style.opacity = '0';
    menu.style.transform = 'translateY(-10px)';
    menu.style.transition = 'all 0.15s ease-out';
    
    // 根據當前頁面設置不同的選單內容
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    let menuContent = '';
    
    if (currentPage.includes('livestream')) {
        menuContent = `
            <div class="menu-user-info">
                <div class="menu-user-name">${currentUserName}</div>
            </div>
            <a href="viewer.html" class="menu-link">
                <i class="fas fa-eye"></i>
                觀看直播
            </a>
            <a href="index.html" class="menu-link">
                <i class="fas fa-home"></i>
                回到首頁
            </a>
        `;
    } else if (currentPage.includes('viewer')) {
        menuContent = `
            <div class="menu-user-info">
                <div class="menu-user-name">${currentUserName}</div>
            </div>
            <a href="livestream_platform.html" class="menu-link">
                <i class="fas fa-video"></i>
                開始直播
            </a>
            <a href="index.html" class="menu-link">
                <i class="fas fa-home"></i>
                回到首頁
            </a>
        `;
    } else {
        menuContent = `
            <div class="menu-user-info">
                <div class="menu-user-name">${currentUserName}</div>
            </div>
            <a href="livestream_platform.html" class="menu-link">
                <i class="fas fa-video"></i>
                開始直播
            </a>
            <a href="viewer.html" class="menu-link">
                <i class="fas fa-eye"></i>
                觀看直播
            </a>
            <a href="about.html" class="menu-link">
                <i class="fas fa-info-circle"></i>
                關於平台
            </a>
        `;
    }
    
    // 添加登出選項（如果有logout函數）
    if (typeof logout === 'function') {
        menuContent += `
            <a href="#" onclick="logout(); event.preventDefault();" class="menu-link logout">
                <i class="fas fa-sign-out-alt"></i>
                登出
            </a>
        `;
    }
    
    menu.innerHTML = menuContent;
    
    // 確保userAvatar是一個相對定位的容器
    if (userAvatar.style.position !== 'relative') {
        userAvatar.style.position = 'relative';
    }
    
    userAvatar.appendChild(menu);
    
    // 顯示動畫
    setTimeout(() => {
        menu.style.opacity = '1';
        menu.style.transform = 'translateY(0)';
    }, 10);
    
    // 點擊其他地方關閉選單
    setTimeout(() => {
        function closeMenu(e) {
            if (!menu.contains(e.target) && !userAvatar.contains(e.target)) {
                menu.style.opacity = '0';
                menu.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    if (menu.parentNode) {
                        menu.remove();
                    }
                }, 150);
                document.removeEventListener('click', closeMenu);
            }
        }
        document.addEventListener('click', closeMenu);
    }, 100);
}

// 切換密碼可見性
function togglePassword(inputId = 'password', iconSelector = null) {
    const input = document.getElementById(inputId);
    const icon = iconSelector ? 
        document.querySelector(iconSelector) : 
        document.querySelector(`#${inputId} ~ .toggle-password i`);
    
    if (input && icon) {
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }
}

// 修復連結路徑
function fixLinks() {
    document.querySelectorAll('a[href^="/"]').forEach(link => {
        const href = link.getAttribute('href');
        if (href.startsWith('/')) {
            const newHref = href.substring(1);
            // 確保不會自動跳轉到preview.html
            if (newHref !== 'preview.html') {
                link.setAttribute('href', newHref);
            }
        }
    });
}

// 導航系統對象
const navigation = {
    // 頁面配置
    pages: {
        home: 'index.html',
        livestream: 'livestream_platform.html',
        viewer: 'viewer.html',
        login: 'login.html',
        register: 'register.html',
        profile: 'profile.html',
        settings: 'settings.html',
        preview: 'preview.html'
    },

    // 檢查訪問權限
    checkPermission() {
        const currentUser = localStorage.getItem('currentUser');
        if (!currentUser) {
            this.goToLogin();
            return false;
        }
        return true;
    },

    // 導航方法
    goToHome() {
        window.location.href = this.pages.home;
    },

    goToLivestream() {
        if (this.checkPermission()) {
            window.location.href = this.pages.livestream;
        }
    },

    goToViewer() {
        window.location.href = this.pages.viewer;
    },

    goToLogin() {
        window.location.href = this.pages.login;
    },

    goToRegister() {
        window.location.href = this.pages.register;
    },

    goToPreview() {
        window.location.href = this.pages.preview;
    },

    goToProfile(username) {
        if (this.checkPermission()) {
            window.location.href = `${this.pages.profile}?user=${username}`;
        }
    },

    goToSettings() {
        if (this.checkPermission()) {
            window.location.href = this.pages.settings;
        }
    },

    async logout() {
        try {
            await fetch('/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
        } catch (error) {
            console.warn('⚠️ 導航登出請求失敗:', error);
        } finally {
            try {
                localStorage.removeItem('currentUser');
                sessionStorage.clear();
            } catch (storageError) {
                console.warn('⚠️ 清除導航登入資訊失敗:', storageError);
            }

            this.goToPreview();
        }
    },

    // 返回按鈕處理
    handleBack() {
        const previousPage = sessionStorage.getItem('previousPage');
        if (previousPage) {
            window.location.href = previousPage;
        } else {
            this.goToHome();
        }
    },

    // 初始化導航
    init() {
        // 保存當前頁面路徑
        const currentPath = window.location.pathname;
        
        // 排除登入和預覽頁面
        if (!currentPath.includes('login.html') && !currentPath.includes('preview.html')) {
            sessionStorage.setItem('previousPage', currentPath);
        }

        // 設置導航欄用戶信息
        this.updateUserNav();
    },

    // 更新導航欄用戶信息
    updateUserNav() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const userMenu = document.getElementById('userMenu');
        
        if (userMenu && currentUser) {
            const avatar = userMenu.querySelector('.avatar');
            if (avatar) {
                avatar.src = currentUser.avatar || 'default-avatar.png';
                avatar.alt = currentUser.username;
            }
        }
    }
};

// 頁面載入時初始化
document.addEventListener('DOMContentLoaded', () => {
    // 修復連結
    fixLinks();
    
    // 初始化導航系統
    navigation.init();
    
    // 設置當前頁面的活動狀態
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath) {
            link.classList.add('active');
        }
    });

    // 監聽所有帶有 hash 的連結
    document.querySelectorAll('a[href*="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href.includes('#')) {
                const [path, hash] = href.split('#');
                const currentPage = window.location.pathname.split('/').pop();
                
                // 如果是當前頁面的錨點，阻止默認行為並平滑滾動
                if (!path || path === currentPage) {
                    e.preventDefault();
                    const element = document.getElementById(hash);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                        // 如果移動菜單是開啟的，關閉它
                        if (isMenuOpen) toggleMenu();
                    }
                }
            }
        });
    });
});
