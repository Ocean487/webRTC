// ?脣?URL?銝剔?銝餅ID嚗?????雿輻?嗅??冽ID
function getBroadcasterIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlBroadcasterId = urlParams.get('broadcaster');
    
    if (urlBroadcasterId) {
        // 憒???'current'嚗蝙?函??貂D
        if (urlBroadcasterId === 'current') {
            if (currentUser && currentUser.id) {
                return `broadcaster_${currentUser.id}`;
            }
            // 憒?瘝??嗅??冽嚗蝙?冽??
            return `broadcaster_${Date.now()}`;
        }
        return urlBroadcasterId;
    }
    
    // 憒?瘝?URL?嚗?潛??嗥??D
    if (currentUser && currentUser.id) {
        return `broadcaster_${currentUser.id}`;
    }
    
    // ?敺?隞踝?雿輻???喟??銝ID
    return `broadcaster_${Date.now()}`;
}

// ?典?霈摮銝餅ID
let myBroadcasterId = null;

// ?湔璅??賊??
let currentStreamTitle = '';
let titleSocket = null; // 撠??冽璅??湔?ebSocket??

// 閮箸?賣 - 瑼Ｘ?湔蝟餌絞???
function diagnoseLiveStreamIssue() {
    console.log('=== ?湔蝟餌絞閮箸 ===');
    console.log('1. ?冽?餃???', currentUser ? '撌脩?? : '?芰??);
    if (currentUser) {
        console.log('   ?冽鞈?:', currentUser);
    }
    
    console.log('2. WebSocket?????');
    console.log('   - titleSocket:', titleSocket ? titleSocket.readyState : '?芸遣蝡?);
    console.log('   - streamingSocket:', window.streamingSocket ? window.streamingSocket.readyState : '?芸遣蝡?);
    
    console.log('3. ?湔???', window.isStreaming ? '?湔銝? : '?芰??);
    console.log('4. ?砍慦?瘚?', window.localStream ? '撌脣遣蝡? : '?芸遣蝡?);
    
    if (window.localStream) {
        console.log('   - 閬頠?:', window.localStream.getVideoTracks().length);
        console.log('   - ?喲頠?:', window.localStream.getAudioTracks().length);
        window.localStream.getTracks().forEach((track, index) => {
            console.log(`   - 頠? ${index}: ${track.kind}, ??? ${track.readyState}, ?: ${track.enabled}`);
        });
    }
    
    console.log('5. WebRTC???賊?:', window.peerConnections ? window.peerConnections.size : 0);
    if (window.peerConnections && window.peerConnections.size > 0) {
        window.peerConnections.forEach((pc, viewerId) => {
            console.log(`   - 閫??${viewerId}: ${pc.connectionState}, ICE: ${pc.iceConnectionState}, 靽∩誘: ${pc.signalingState}`);
        });
    }
    
    // 瑼Ｘ?餃API
    fetch('/api/user/current')
        .then(response => response.json())
        .then(data => {
            console.log('6. ???函?亦???', data);
        })
        .catch(error => {
            console.log('6. ???函?交炎?亙仃??', error);
        });
    
    console.log('=== 閮箸摰? ===');
    
    // ??撱箄降
    if (!window.isStreaming) {
        console.log('? 撱箄降: 隢?暺???憪?准???);
    } else if (!window.localStream) {
        console.log('? 撱箄降: 隢?閮望?敶望?甈?銝阡??圈?憪??);
    } else if (!window.peerConnections || window.peerConnections.size === 0) {
        console.log('? 撱箄降: 瘝?閫?暸?嚗?蝣箄?閫?曄垢撌脤???);
    }
}

// ?冽?嗅銝剖隞亥矽??diagnoseLiveStreamIssue() 靘那?瑕?憿?
window.diagnoseLiveStreamIssue = diagnoseLiveStreamIssue;


// ????憿ebSocket??
function initTitleWebSocket() {
    if (titleSocket && (titleSocket.readyState === WebSocket.OPEN || titleSocket.readyState === WebSocket.CONNECTING)) {
        return; // 撌脩????迤?券?
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    console.log('????憿ebSocket??:', wsUrl);
    titleSocket = new WebSocket(wsUrl);
    
    titleSocket.onopen = function() {
        console.log('??璅?WebSocket撌脤?');
        
        // ???蜓?背D
        if (!myBroadcasterId) {
            myBroadcasterId = getBroadcasterIdFromUrl();
        }
        
        console.log('銝餅ID:', myBroadcasterId);
        
        // ?潮蜓?剖??亥???
        if (currentUser) {
            titleSocket.send(JSON.stringify({
                type: 'broadcaster_join',
                broadcasterId: myBroadcasterId,
                userInfo: {
                    username: currentUser.username || currentUser.email || 'Anonymous',
                    displayName: currentUser.displayName || currentUser.username || 'Anonymous'
                }
            }));
        }
    };
    
    titleSocket.onclose = function() {
        console.log('璅?WebSocket??撌脤????岫??..');
        setTimeout(initTitleWebSocket, 3000); // 3蝘???
    };
    
    titleSocket.onerror = function(error) {
        console.error('璅?WebSocket???航炊:', error);
    };
}

// ?湔?湔璅?
function updateStreamTitle() {
    const titleInput = document.getElementById('streamTitleInput');
    const currentTitleDisplay = document.getElementById('currentTitle');
    
    if (titleInput && currentTitleDisplay) {
        const newTitle = titleInput.value.trim();
        if (newTitle !== currentStreamTitle) {
            currentStreamTitle = newTitle;
            if (currentStreamTitle) {
                currentTitleDisplay.textContent = `?桀?璅?: ${currentStreamTitle}`;
                console.log('?湔璅?撌脫??', currentStreamTitle);
                
                // 雿輻撠???憿ebSocket?潮??
                if (titleSocket && titleSocket.readyState === WebSocket.OPEN) {
                    titleSocket.send(JSON.stringify({
                        type: 'title_update',
                        title: currentStreamTitle,
                        timestamp: Date.now()
                    }));
                    console.log('撌脤?titleSocket?潮?憿?啣閫?曄垢');
                } else {
                    console.warn('titleSocket?芷?嚗瘜??憿??);
                    // ?岫???
                    initTitleWebSocket();
                }
                
                // 憒?甇??湔嚗???銝餉??treamingSocket?潮?
                if (window.streamingSocket && window.streamingSocket.readyState === WebSocket.OPEN) {
                    window.streamingSocket.send(JSON.stringify({
                        type: 'title_update',
                        title: currentStreamTitle,
                        timestamp: Date.now()
                    }));
                    console.log('撌脤?streamingSocket?潮?憿?啣閫?曄垢');
                }
            } else {
                currentTitleDisplay.textContent = '?桀?璅?: ?芾身摰?;
            }
        }
    }
}

// 撖行?璅??湔嚗頛詨??
function onTitleInput() {
    // ?脫???嚗???餌????
    clearTimeout(window.titleUpdateTimeout);
    window.titleUpdateTimeout = setTimeout(updateStreamTitle, 500);
}

// ??璅?頛詨獢??鈭辣
function handleTitleKeyPress(event) {
    // 瑼Ｘ?臬??Enter??
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault(); // ?脫迫銵典?漱
        
        // 蝡閫貊璅??湔
        clearTimeout(window.titleUpdateTimeout);
        updateStreamTitle();
        
        // 蝣箔?銝餅?迂銋?titleSocket?潮?
        if (titleSocket && titleSocket.readyState === WebSocket.OPEN && currentUser) {
            titleSocket.send(JSON.stringify({
                type: 'broadcaster_info',
                broadcaster: currentUser.username || currentUser.email || 'Anonymous',
                timestamp: Date.now()
            }));
            console.log('撌脤?titleSocket?潮蜓?剛?閮閫?曄垢:', currentUser.username || currentUser.email);
        }
        
        // 銋?銝餉??treamingSocket?潮?憒?摮嚗?
        if (window.streamingSocket && window.streamingSocket.readyState === WebSocket.OPEN && currentUser) {
            window.streamingSocket.send(JSON.stringify({
                type: 'broadcaster_info',
                broadcaster: currentUser.username || currentUser.email || 'Anonymous',
                timestamp: Date.now()
            }));
            console.log('撌脤?streamingSocket?潮蜓?剛?閮閫?曄垢:', currentUser.username || currentUser.email);
        }
    }
}

// ?頛??憪?璅??炎?亦?亦???
// 璅??????歇蝘餉 script.js ??initializeBroadcaster() 蝯曹???
// ?踹?憭?????蝒?
// document.addEventListener('DOMContentLoaded', function() { ... });

// 瑼Ｘ?餃???
async function checkLoginStatus() {
    try {
        // 瑼Ｘ???函?亦???
        const response = await fetch('/api/user/current');
        const data = await response.json();
        
        if (data.success && data.user) {
            currentUser = data.user;
            isTestMode = false;
            updateUserDisplay(currentUser);
            enableBroadcastFeatures();
            
            // ?冽?餃敺?憒?????憿ebSocket??嚗?撱箇???
            if (!titleSocket || titleSocket.readyState !== WebSocket.OPEN) {
                initTitleWebSocket();
            }
        } else {
            currentUser = null;
            isTestMode = false;
            // 撘瑕頝唾??啁?仿???
            forceLoginRedirect();
        }
    } catch (error) {
        console.error('瑼Ｘ?餃??仃??', error);
        currentUser = null;
        isTestMode = false;
        // 蝬脰楝?航炊??撘瑕頝唾??啁?仿???
        forceLoginRedirect();
    }
}

// 撘瑕頝唾??啁?仿???
function forceLoginRedirect() {
    console.log('?冽?芰?伐?撘瑕頝唾??啁?仿???);
    
    // 靽??嗅??URL嚗?亙??臭誑頝唾???
    sessionStorage.setItem('redirectAfterLogin', window.location.href);
    
    // 憿舐內?餃?內閮
    if (typeof addMessage === 'function') {
        addMessage('蝟餌絞', '?? 瑼Ｘ葫?唳撠?餃嚗撠歲頧?餃?...');
    }
    
    // 憿舐內敶??內?冽
    showLoginPermissionModal();
    
    // 撱園頝唾?嚗??冽??內
    setTimeout(() => {
        window.location.href = '/login.html';
    }, 2000);
}

// 憿舐內?閬?亦??內銝衣??函?剖???
function showLoginRequired() {
    const userAvatar = document.getElementById('userAvatar');
    const streamBtn = document.getElementById('streamBtn');
    
    // 閮剔蔭?身?剖?嚗蒂瘛餃?暺?鈭辣
    if (userAvatar) {
        userAvatar.innerHTML = '<i class="fas fa-user"></i>';
        userAvatar.title = '暺??餃';
        userAvatar.style.cursor = 'pointer';
        // 瘛餃?暺?鈭辣?湔頝唾??啁?仿???
        userAvatar.onclick = function() {
            window.location.href = '/login.html';
        };
    }
    
    // 蝳?湔??
    if (streamBtn) {
        streamBtn.disabled = true;
        streamBtn.innerHTML = '<i class="fas fa-lock"></i> 隢??餃';
        streamBtn.onclick = function() {
            window.location.href = '/login.html';
        };
    }
    
    // 憿舐內?餃?內閮
    if (typeof addMessage === 'function') {
        addMessage('蝟餌絞', '?? 隢??餃?雿輻?湔?');
    }
}

// 憓撥?oggleStream?賣嚗??怎?仿?霅?
function secureToggleStream() {
    // 瑼Ｘ?冽?臬撌脩??
    if (!currentUser) {
        window.location.href = '/login.html';
        return;
    }
    
    // 蝑? script.js ??摰?
    if (typeof toggleStream === 'function') {
        toggleStream();
    } else {
        console.log('蝑? script.js ??...');
        // 撱園?岫嚗?敺?砍?頛?
        setTimeout(() => {
            if (typeof toggleStream === 'function') {
                toggleStream();
            } else {
                console.error('toggleStream ?賣?芣??);
                showErrorModal('?湔??急??⊥?雿輻嚗???渡??敺?閰艾???憿?蝥?隢炎?亦雯頝舫????);
            }
        }, 1000);
    }
}

// 摰???餃????
function secureToggleVideo() {
    if (typeof toggleVideo === 'function') {
        toggleVideo();
    } else {
        setTimeout(() => {
            if (typeof toggleVideo === 'function') {
                toggleVideo();
            } else {
                console.error('toggleVideo ?賣?芣??);
                showErrorModal('閬??急??⊥?雿輻嚗???渡??');
            }
        }, 500);
    }
}

// 摰??餃????
function secureToggleAudio() {
    if (typeof toggleAudio === 'function') {
        toggleAudio();
    } else {
        setTimeout(() => {
            if (typeof toggleAudio === 'function') {
                toggleAudio();
            } else {
                console.error('toggleAudio ?賣?芣??);
                showErrorModal('?喲??急??⊥?雿輻嚗???渡??');
            }
        }, 500);
    }
}

// 摰?撟?鈭怠??
function secureShareScreen() {
    if (typeof shareScreen === 'function') {
        shareScreen();
    } else {
        setTimeout(() => {
            if (typeof shareScreen === 'function') {
                shareScreen();
            } else {
                console.error('shareScreen ?賣?芣??);
                showErrorModal('?Ｗ??澈??急??⊥?雿輻嚗???渡??');
            }
        }, 500);
    }
}

// 摰????餃????
function secureToggleTabAudio() {
    if (typeof toggleTabAudio === 'function') {
        toggleTabAudio();
    } else {
        setTimeout(() => {
            if (typeof toggleTabAudio === 'function') {
                toggleTabAudio();
            } else {
                console.error('toggleTabAudio ?賣?芣??);
                showErrorModal('???喲??急??⊥?雿輻嚗???渡??');
            }
        }, 500);
    }
}

// 憿舐內?餃甈?敶?
function showLoginPermissionModal() {
    const modal = document.getElementById('loginPermissionModal');
    if (modal) {
        modal.classList.add('show');
        
        // 瘛餃?瘛∪?
        setTimeout(() => {
            const content = modal.querySelector('.modal-content');
            if (content) {
                content.style.transform = 'scale(1)';
                content.style.opacity = '1';
            }
        }, 10);
        
        // ?餅迫?皛曉?
        document.body.style.overflow = 'hidden';
        
        // 暺????敶?
        modal.onclick = function(e) {
            if (e.target === modal) {
                closeLoginModal();
            }
        };
        
        // ESC?菟???蝒?
        document.addEventListener('keydown', handleEscKey);
    }
}

// ???餃敶?
function closeLoginModal() {
    const modal = document.getElementById('loginPermissionModal');
    if (modal) {
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.transform = 'scale(0.8)';
            content.style.opacity = '0';
        }
        
        setTimeout(() => {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            
            // ?蔭敶??批捆?圈?隤???
            resetModalContent();
        }, 300);
        
        // 蝘駁鈭辣????
        document.removeEventListener('keydown', handleEscKey);
    }
}

// ?蔭敶??批捆?圈?隤???
function resetModalContent() {
    const modal = document.getElementById('loginPermissionModal');
    if (modal) {
        const icon = modal.querySelector('.modal-icon i');
        const title = modal.querySelector('.modal-title');
        const messageElement = modal.querySelector('.modal-message');
        const buttons = modal.querySelector('.modal-buttons');
        
        if (icon) icon.className = 'fas fa-user-lock';
        if (title) title.textContent = '?閬?交???;
        if (messageElement) {
            messageElement.innerHTML = `
                ?券?閬?交??賭蝙?函?剖??賬?
                <br><br>
                蝟餌絞撠 2 蝘??芸?頝唾??啁?仿??ｇ??其??臭誑暺?銝??蝡頝唾???
            `;
        }
        if (buttons) {
            buttons.innerHTML = `
                <a href="/login.html" class="modal-btn primary">
                    <i class="fas fa-sign-in-alt"></i>
                    蝡?餃
                </a>
                <a href="/register.html" class="modal-btn secondary">
                    <i class="fas fa-user-plus"></i>
                    ?祥閮餃?
                </a>
                <button onclick="enableTestMode()" class="modal-btn danger">
                    <i class="fas fa-flask"></i>
                    皜祈岫璅∪?
                </button>
            `;
        }
    }
}

// ESC?菔???
function handleEscKey(e) {
    if (e.key === 'Escape') {
        closeLoginModal();
    }
}

// 憿舐內?航炊?內敶?
function showErrorModal(message) {
    const modal = document.getElementById('loginPermissionModal');
    if (modal) {
        // ?湔敶??批捆?粹隤支縑??
        const icon = modal.querySelector('.modal-icon i');
        const title = modal.querySelector('.modal-title');
        const messageElement = modal.querySelector('.modal-message');
        const buttons = modal.querySelector('.modal-buttons');
        
        if (icon) icon.className = 'fas fa-exclamation-triangle';
        if (title) title.textContent = '蝟餌絞?航炊';
        if (messageElement) messageElement.textContent = message;
        if (buttons) {
            buttons.innerHTML = `
                <button onclick="closeLoginModal()" class="modal-btn primary">
                    <i class="fas fa-check"></i>
                    蝣箏?
                </button>
            `;
        }
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

// 憿舐內靽⊥?內敶?
function showInfoModal(title, message, buttons = null) {
    const modal = document.getElementById('loginPermissionModal');
    if (modal) {
        // ?湔敶??批捆
        const icon = modal.querySelector('.modal-icon i');
        const titleElement = modal.querySelector('.modal-title');
        const messageElement = modal.querySelector('.modal-message');
        const buttonsElement = modal.querySelector('.modal-buttons');
        
        if (icon) icon.className = 'fas fa-info-circle';
        if (titleElement) titleElement.textContent = title;
        if (messageElement) {
            messageElement.innerHTML = message;
        }
        if (buttonsElement) {
            if (buttons) {
                buttonsElement.innerHTML = buttons;
            } else {
                buttonsElement.innerHTML = `
                    <button onclick="closeLoginModal()" class="modal-btn primary">
                        <i class="fas fa-check"></i>
                        蝣箏?
                    </button>
                `;
            }
        }
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

// 憿舐內???內敶?
function showSuccessModal(message) {
    const modal = document.getElementById('loginPermissionModal');
    if (modal) {
        // ?湔敶??批捆?箸??縑??
        const icon = modal.querySelector('.modal-icon i');
        const title = modal.querySelector('.modal-title');
        const messageElement = modal.querySelector('.modal-message');
        const buttons = modal.querySelector('.modal-buttons');
        
        if (icon) icon.className = 'fas fa-check-circle';
        if (title) title.textContent = '????';
        if (messageElement) messageElement.textContent = message;
        if (buttons) {
            buttons.innerHTML = `
                <button onclick="closeLoginModal()" class="modal-btn primary">
                    <i class="fas fa-check"></i>
                    蝣箏?
                </button>
            `;
        }
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

// 撖行?瑼Ｘ葫?餃?????
let loginCheckInterval;
function startLoginStatusMonitoring() {
    // 瘥?0蝘炎?乩?甈∠?亦???
    loginCheckInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/user/current');
            const data = await response.json();
            
            const wasLoggedIn = !!currentUser;
            const isLoggedIn = data.success && data.user;
            
            if (!wasLoggedIn && isLoggedIn) {
                // ?冽???
                currentUser = data.user;
                isTestMode = false;
                updateUserDisplay(currentUser);
                enableBroadcastFeatures();
                closeLoginModal(); // ???航憿舐內??亙?蝒?
                
                // 憿舐內甇∟?瘨
                if (window.addMessage) {
                    addMessage('蝟餌絞', `?? 甇∟???嚗?{currentUser.displayName}嚗?典隞仿?憪?凋?`);
                }
            } else if (wasLoggedIn && !isLoggedIn) {
                // ?冽?餃鈭?
                currentUser = null;
                isTestMode = false;
                showLoginRequired();
                
                if (window.addMessage) {
                    addMessage('蝟餌絞', '?? 瑼Ｘ葫?唳撌脩?綽??湔?撌脫??);
                }
            }
        } catch (error) {
            console.error('瑼Ｘ?餃??仃??', error);
        }
    }, 30000);
}

// ?迫?餃????
function stopLoginStatusMonitoring() {
    if (loginCheckInterval) {
        clearInterval(loginCheckInterval);
        loginCheckInterval = null;
    }
}

// ??湔?
function enableBroadcastFeatures() {
    const streamBtn = document.getElementById('streamBtn');
    
    if (streamBtn) {
        streamBtn.disabled = false;
        streamBtn.innerHTML = '<i class="fas fa-play-circle"></i> ???湔';
        // 雿輻憓撥??toggleStream?賣
        streamBtn.onclick = secureToggleStream;
    }
}

// ?皜祈岫璅∪?
function enableTestMode() {
    currentUser = testUser;
    isTestMode = true;
    
    // 靽?皜祈岫?冽?唳?啣???
    localStorage.setItem('testUser', JSON.stringify(testUser));
    
    updateUserDisplay(currentUser);
    enableBroadcastFeatures();
    closeLoginModal();
    
    // 憿舐內皜祈岫璅∪??內
    showTestModeWarning();
    
    if (typeof addMessage === 'function') {
        addMessage('蝟餌絞', '?妒 撌脣??冽葫閰行芋撘??曉?臭誑???湔皜祈岫');
    }
}

// 憿舐內皜祈岫璅∪?霅血?
function showTestModeWarning() {
    const modal = document.getElementById('loginPermissionModal');
    if (modal) {
        const icon = modal.querySelector('.modal-icon i');
        const title = modal.querySelector('.modal-title');
        const messageElement = modal.querySelector('.modal-message');
        const buttons = modal.querySelector('.modal-buttons');
        
        if (icon) icon.className = 'fas fa-flask';
        if (title) title.textContent = '皜祈岫璅∪?撌脣???;
        if (messageElement) {
            messageElement.innerHTML = `
                <div class="test-account-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>瘜冽?嚗?/strong>?冽迤?其蝙?冽葫閰血董?芋撘葫閰血董?瘜?綽??芾??皜?汗?冽???蔭??
                    <br><br>
                    皜祈岫璅∪???澆??賣葫閰佗?銝遣霅啣甇???啣?銝凋蝙?具?
                </div>
            `;
        }
        if (buttons) {
            buttons.innerHTML = `
                <button onclick="closeLoginModal()" class="modal-btn primary">
                    <i class="fas fa-check"></i>
                    ???
                </button>
                <button onclick="clearTestMode()" class="modal-btn danger">
                    <i class="fas fa-trash"></i>
                    皜皜祈岫?豢?
                </button>
            `;
        }
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

// 皜皜祈岫璅∪?
function clearTestMode() {
    localStorage.removeItem('testUser');
    currentUser = null;
    isTestMode = false;
    
    showLoginRequired();
    closeLoginModal();
    
    if (typeof addMessage === 'function') {
        addMessage('蝟餌絞', '?完 皜祈岫璅∪?撌脫??歹?隢??啁??);
    }
}

// ?脣??嗅??湔璅?
function getCurrentStreamTitle() {
    return currentStreamTitle || '?芸???;
}

// ?冽蝞∠??
let currentUser = null;
let isTestMode = false;
const testUser = {
    username: 'test_user',
    displayName: '皜祈岫銝餅',
    email: 'test@example.com',
    id: 'test_123',
    isTestAccount: true
};

// ???冽?詨
function toggleUserMenu() {
    console.log('toggleUserMenu 鋡怨矽??);
    
    // 憒?瘝??餃嚗?亥歲頧?餃?
    if (!currentUser) {
        window.location.href = '/login.html';
        return;
    }
    
    // 蝘駁?暹??詨
    const existingMenu = document.querySelector('.user-dropdown');
    if (existingMenu) {
        console.log('蝘駁?暹??詨');
        existingMenu.style.opacity = '0';
        existingMenu.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            if (existingMenu.parentNode) {
                existingMenu.remove();
            }
        }, 150);
        return;
    }
    
    // ?脣??嗅??冽?迂
    const userAvatar = document.getElementById('userAvatar');
    if (!userAvatar) {
        console.error('?冽?剖????芣??);
        return;
    }
    
    console.log('?萄遣?啁?銝??詨');
    
    const currentUserName = getCurrentUserName() || '銝餅';
    
    // ?萄遣銝??詨
    const menu = document.createElement('div');
    menu.className = 'user-dropdown';
    menu.style.opacity = '0';
    menu.style.transform = 'translateY(-10px)';
    menu.style.transition = 'all 0.15s ease-out';
    
    let menuContent = `
        <div class="menu-user-info">
            <div class="menu-user-name">${currentUserName}</div>
            ${isTestMode ? '<div style="font-size: 0.8rem; color: #f59e0b;">皜祈岫璅∪?</div>' : ''}
        </div>
        <a href="#" onclick="openStreamManagement(); event.preventDefault();" class="menu-link">
            <i class="fas fa-video"></i>
            ?湔蝞∠?
        </a>
        <a href="viewer.html" class="menu-link">
            <i class="fas fa-eye"></i>
            閫???
        </a>
        <a href="index.html" class="menu-link">
            <i class="fas fa-home"></i>
            ?擐?
        </a>
    `;

    // 憒?銝皜祈岫璅∪?嚗＊蝷箇?粹??
    if (!isTestMode) {
        menuContent += `
            <a href="#" onclick="logout(); event.preventDefault();" class="menu-link logout">
                <i class="fas fa-sign-out-alt"></i>
                ?餃
            </a>
        `;
    } else {
        menuContent += `
            <a href="#" onclick="clearTestMode(); event.preventDefault();" class="menu-link logout">
                <i class="fas fa-trash"></i>
                皜皜祈岫?豢?
            </a>
        `;
    }

    menu.innerHTML = menuContent;
    
    // 蝣箔?userAvatar?臭??捆?剁?憒?銝??鋆?
    let container = userAvatar;
    if (userAvatar.style.position !== 'relative') {
        userAvatar.style.position = 'relative';
    }
    
    container.appendChild(menu);
    console.log('?詨撌脫溶?DOM');
    
    // 憿舐內?
    setTimeout(() => {
        menu.style.opacity = '1';
        menu.style.transform = 'translateY(0)';
        console.log('?詨?撌脰孛??);
    }, 10);
    
    // 暺??嗡??唳???詨
    setTimeout(() => {
        function closeMenu(e) {
            if (!menu.contains(e.target) && !container.contains(e.target)) {
                console.log('???詨');
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

// ?脣??嗅??冽?迂
function getCurrentUserName() {
    if (currentUser) {
        return currentUser.displayName || currentUser.username || '?冽';
    }
    return '?芰??;
}

// 頛?嗅??冽靽⊥嚗???賣嚗??摰寞改?
async function loadCurrentUser() {
    return checkLoginStatus();
}

// 憿舐內?餃?內???臬撥?園?摰?嚗???賣嚗??摰寞改?
function showLoginPrompt() {
    showLoginRequired();
}

// ?湔?冽憿舐內
function updateUserDisplay(user) {
    const userAvatar = document.getElementById('userAvatar');
    
    // 閮剔蔭?剖?
    if (user.avatarUrl) {
        userAvatar.innerHTML = `<img src="${user.avatarUrl}" alt="${user.displayName}">`;
    } else {
        // 雿輻?冽?迂?洵銝??瘥??粹??
        const initial = user.displayName.charAt(0).toUpperCase();
        userAvatar.innerHTML = initial;
    }
    
    // 閮剔蔭?冽靽⊥
    userAvatar.title = user.displayName;
    userAvatar.style.cursor = 'pointer';
    
    // 蝘駁銋?????隞塚?瘛餃?甇?虜??園?桀???
    userAvatar.onclick = function() {
        toggleUserMenu();
    };
    
    // ?脣??嗅??冽?啣撅霈
    window.currentUser = user;
    
    console.log('?冽靽⊥撌脰???', user);
}

// ?脣??嗅??冽 - ?冽?予摰?
function getCurrentUser() {
    return currentUser ? currentUser.displayName : '銝餅';
}

// ?脣??嗅??冽?剖?
function getCurrentUserAvatar() {
    if (currentUser && currentUser.avatarUrl) {
        return `<img src="${currentUser.avatarUrl}" alt="${currentUser.displayName}">`;
    } else if (currentUser) {
        return currentUser.displayName.charAt(0).toUpperCase();
    } else {
        return '<i class="fas fa-star"></i>';
    }
}

// ???湔蝞∠?
function openStreamManagement() {
    // ?ㄐ?臭誑???湔蝞∠??Ｘ?歲頧蝞∠??
    showInfoModal('?湔蝞∠?', '?湔蝞∠??甇??銝哨??祈???嚗?, `
        <button onclick="closeLoginModal()" class="modal-btn primary">
            <i class="fas fa-check"></i>
            ???
        </button>
    `);
}

// ?餃?
async function logout() {
    try {
        const response = await fetch('/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = '/login.html';
        } else {
            showErrorModal('?餃憭望?嚗? + data.message);
        }
    } catch (error) {
        console.error('?餃憭望?:', error);
        showErrorModal('?餃憭望?嚗?蝔??岫');
    }
}

// ?冽頛撌脩宏??script.js ??initializeBroadcaster() 蝯曹???
// document.addEventListener('DOMContentLoaded', function() { loadCurrentUser(); });

// 瑼Ｘ??賣?臬撌脣?頛?
function checkScriptLoading() {
    const requiredFunctions = ['toggleStream', 'toggleVideo', 'toggleAudio', 'shareScreen', 'toggleTabAudio'];
    const missingFunctions = requiredFunctions.filter(func => typeof window[func] !== 'function');
    
    if (missingFunctions.length > 0) {
        console.warn('蝻箏?隞乩??賣:', missingFunctions);
        return false;
    } else {
        console.log('???剖??賢歇皞?撠梁?');
        return true;
    }
}

// 蝑????砍?頛???
function waitForScriptsToLoad() {
    return new Promise((resolve) => {
        if (checkScriptLoading()) {
            resolve(true);
            return;
        }
        
        let attempts = 0;
        const maxAttempts = 20; // ?憭?敺?10 蝘?
        
        const checkInterval = setInterval(() => {
            attempts++;
            
            if (checkScriptLoading()) {
                clearInterval(checkInterval);
                resolve(true);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error('?單??頞?');
                resolve(false);
            }
        }, 500);
    });
}

// ?予蝟餌絞???歇蝘餉 script.js ??initializeBroadcaster() 蝯曹???
/ /   J�)Y�|q}R�YS�]�y�  s c r i p t . j s   �v  i n i t i a l i z e B r o a d c a s t e r ( )   q} NU�t 
 