        // 平滑滾動
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    const targetId = this.getAttribute('href');
                    let scrollOptions = {
                        behavior: 'smooth',
                        block: 'start'
                    };
                    
                    // 特別處理關於和功能區塊，讓它們居中顯示
                    if (targetId === '#about' || targetId === '#features') {
                        const navbar = document.querySelector('.navbar');
                        const navbarHeight = navbar ? navbar.offsetHeight : 0;
                        const targetPosition = target.offsetTop - navbarHeight;
                        
                        window.scrollTo({
                            top: targetPosition,
                            behavior: 'smooth'
                        });
                    } else {
                        target.scrollIntoView(scrollOptions);
                    }
                }
            });
        });

        // 導航欄激活狀態
        window.addEventListener('scroll', () => {
            const sections = document.querySelectorAll('section[id]');
            const navLinks = document.querySelectorAll('.nav-link');
            
            let current = '';
            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.clientHeight;
                if (scrollY >= (sectionTop - 200)) {
                    current = section.getAttribute('id');
                }
            });

            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${current}`) {
                    link.classList.add('active');
                }
            });
        });

        // 影片播放器功能
        class DemoVideoPlayer {
            constructor() {
                this.currentSlide = 0;
                this.totalSlides = 4;
                this.isPlaying = false;
                this.slideInterval = null;
                
                this.init();
            }
            
            init() {
                this.playButton = document.getElementById('playButton');
                this.videoOverlay = document.querySelector('.video-overlay');
                this.slides = document.querySelectorAll('.demo-slide');
                
                this.bindEvents();
                
                // 3秒後自動開始播放
                setTimeout(() => {
                    this.autoPlay();
                }, 3000);
            }
            
            bindEvents() {
                this.playButton?.addEventListener('click', () => this.play());
            }
            
            autoPlay() {
                this.play();
            }
            
            play() {
                this.isPlaying = true;
                this.videoOverlay.classList.add('hidden');
                this.startSlideShow();
            }
            
            startSlideShow() {
                this.slideInterval = setInterval(() => {
                    this.nextSlide();
                }, 5000); // 每5秒換一張
            }
            
            stopSlideShow() {
                if (this.slideInterval) {
                    clearInterval(this.slideInterval);
                    this.slideInterval = null;
                }
            }
            
            nextSlide() {
                this.slides[this.currentSlide].classList.remove('active');
                this.currentSlide = (this.currentSlide + 1) % this.totalSlides;
                this.slides[this.currentSlide].classList.add('active');
                
                // 如果回到第一張，表示一輪結束，繼續無縫循環
                if (this.currentSlide === 0) {
                    // 繼續播放，不停止
                }
            }
            
            reset() {
                this.slides[this.currentSlide].classList.remove('active');
                this.currentSlide = 0;
                this.slides[this.currentSlide].classList.add('active');
                this.videoOverlay.classList.remove('hidden');
                this.isPlaying = false;
                this.stopSlideShow();
                
                // 重新開始自動播放循環
                setTimeout(() => {
                    this.autoPlay();
                }, 3000);
            }
        }
        
        // 初始化影片播放器
        document.addEventListener('DOMContentLoaded', () => {
            new DemoVideoPlayer();
        });
    