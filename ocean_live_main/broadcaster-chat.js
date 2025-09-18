/* (Deprecated) Broadcaster Chat Module
 * 現在主播端已改回與觀眾相同 unified script.js chat_message 流程。
 * 保留檔案避免 404；若要重新啟用請在 livestream_platform.html 再次引用。
 */
(function(window){
  const ChatStates = { DISCONNECTED:'disconnected', CONNECTING:'connecting', CONNECTED:'connected', ERROR:'error' };
  const RETRY_BASE = 1000; // ms
  const RETRY_MAX = 15000;
  const MAX_QUEUE = 100;
  const HEARTBEAT_INTERVAL = 20000;
  const WS_URL = (location.protocol==='https:'? 'wss://':'ws://') + location.host;

  let socket = null;
  let state = ChatStates.DISCONNECTED;
  let retryCount = 0;
  let heartbeatTimer = null;
  let unsentQueue = [];
  let connectedAt = null;
  const pendingMap = new Map(); // tempId -> { createdAt, retries, element }
  const RESEND_AFTER = 5000; // ms
  const MAX_RETRIES = 3;

  // DOM refs (lazy)
  function $(id){ return document.getElementById(id); }
  function chatMessagesEl(){ return $('chatMessages'); }
  function inputEl(){ return $('messageInput'); }
  function statusBarEl(){ return $('chatStatusBar'); }

  function nowISO(){ return new Date().toISOString(); }

  function sanitize(text){
    if(!text) return '';
    return text.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c]||c));
  }

  function log(...args){ console.log('[BroadcasterChat]', ...args); }

  function setState(next){
    if(state===next) return;
    state = next;
    updateStatusUI();
  }

  function updateStatusUI(){
    const bar = statusBarEl();
    if(!bar) return;
    bar.dataset.state = state;
    let text='';
    switch(state){
      case ChatStates.CONNECTING: text='聊天連線中…'; break;
      case ChatStates.CONNECTED: text='已連線'; break;
      case ChatStates.ERROR: text='連線錯誤, 重試中…'; break;
      case ChatStates.DISCONNECTED: default: text='未連線';
    }
    bar.querySelector('.status-text').textContent = text;
  }

  function addSystemMessage(msg){ addMessage({ username:'系統', text:msg, isSystemMessage:true }); }

  function addMessage({ username, text, isStreamer, isSystemMessage, userAvatar, timestamp, pending, tempId, statusLabel }){
    log('[DBG:addMessage] 呼叫', {username, text, isStreamer, isSystemMessage, pending, tempId});
    const container = chatMessagesEl();
    if(!container) return;
    const div = document.createElement('div');
    div.className = 'message';
    if(isSystemMessage) div.classList.add('system');
    if(isStreamer) div.classList.add('broadcaster');
    if(pending) div.classList.add('pending');
    if(tempId) div.dataset.tempId = tempId;
    const timeStr = new Date(timestamp||Date.now()).toLocaleTimeString('zh-TW',{ hour:'2-digit', minute:'2-digit'});
    const safeUser = sanitize(username||'匿名');
    const safeText = renderRichContent(text||'');
    let avatarHTML = '';
    if(isSystemMessage) avatarHTML = '<i class="fas fa-cog"></i>';
    else if(isStreamer) avatarHTML = '<i class="fas fa-star"></i>';
    else if(userAvatar) avatarHTML = `<img src="${userAvatar}">`;
    else avatarHTML = safeUser.charAt(0).toUpperCase();

    div.innerHTML = `
      <div class="message-avatar">${avatarHTML}</div>
      <div class="message-content-wrapper">
        <div class="message-bubble">
          <div class="message-header">
            <span class="username">${safeUser}</span>
            <span class="timestamp">${timeStr}</span>
          </div>
          <div class="message-content">${safeText}${pending? ` <span class="msg-status" style="opacity:.6;font-size:11px;">(${statusLabel||'發送中'})</span>`:''}</div>
        </div>
      </div>`;
    container.appendChild(div);
    // auto scroll
    container.scrollTop = container.scrollHeight;
    log('[DBG:addMessage] 完成 append', {tempId, class: div.className});
    return div;
  }

  function renderRichContent(raw){
    // 基本跳脫後再做連結/圖片判斷與 emoji 處理
    const esc = sanitize(raw);
    // 圖片URL (jpg|png|gif|webp) 獨立一行或結尾
    const imgRegex = /(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp))(?![^<]*>)/gi;
    let replaced = esc.replace(imgRegex, (m)=>`<div class="img-wrap" style="margin-top:4px;"><img src="${m}" style="max-width:160px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,.15);" loading="lazy"/></div>`);
    // 一般URL
    const urlRegex = /(https?:\/\/[^\s]+)(?![^<]*>)/gi;
    replaced = replaced.replace(urlRegex, (m)=>`<a href="${m}" target="_blank" rel="noopener" style="color:#2563eb;">${m}</a>`);
    // 簡單 emoji 轉換
    replaced = replaced.replace(/:\)/g,'😊').replace(/:D/g,'😄').replace(/:\(/g,'🙁').replace(/:heart:/g,'❤️');
    return replaced;
  }

  function connect(){
    if(socket && (socket.readyState===WebSocket.OPEN || socket.readyState===WebSocket.CONNECTING)) return;
    setState(ChatStates.CONNECTING);
    try{
      socket = new WebSocket(WS_URL);
    }catch(e){
      setState(ChatStates.ERROR);
      scheduleReconnect();
      return;
    }
    socket.onopen = ()=>{
      connectedAt = Date.now();
      retryCount = 0;
      setState(ChatStates.CONNECTED);
      log('WebSocket connected');
      // identify broadcaster
      sendRaw({ type:'broadcaster_join', broadcasterId:'broadcaster_1' });
      flushQueue();
      startHeartbeat();
      addSystemMessage('聊天室已連線');
    };
    socket.onmessage = (evt)=>{
      let data; try{ data = JSON.parse(evt.data);}catch(err){ return; }
      handleIncoming(data);
    };
    socket.onclose = ()=>{
      stopHeartbeat();
      setState(ChatStates.DISCONNECTED);
      addSystemMessage('聊天連線中斷');
      scheduleReconnect();
    };
    socket.onerror = (err)=>{
      log('socket error', err);
      setState(ChatStates.ERROR);
      addSystemMessage('聊天連線錯誤');
      // will trigger close after
    };
  }

  function scheduleReconnect(){
    const delay = Math.min(RETRY_BASE * Math.pow(2, retryCount++), RETRY_MAX);
    log('Reconnect in', delay,'ms');
    setTimeout(connect, delay);
  }

  function startHeartbeat(){
    stopHeartbeat();
    heartbeatTimer = setInterval(()=>{
      if(socket && socket.readyState===WebSocket.OPEN){
        sendRaw({ type:'heartbeat', ts: nowISO() });
      }
    }, HEARTBEAT_INTERVAL);
  }
  function stopHeartbeat(){ if(heartbeatTimer){ clearInterval(heartbeatTimer); heartbeatTimer=null; } }

  function sendRaw(obj){
    if(socket && socket.readyState===WebSocket.OPEN){
      try{ socket.send(JSON.stringify(obj)); return true; }catch(e){ log('sendRaw failed', e); }
    }
    return false;
  }

  function queueMessage(payload){
    if(unsentQueue.length >= MAX_QUEUE) unsentQueue.shift();
    unsentQueue.push(payload);
  }

  function flushQueue(){
    if(!unsentQueue.length) return;
    const copy = [...unsentQueue];
    unsentQueue = [];
    copy.forEach(p=> internalSendChat(p.text, p.localEcho));
  }

  function internalSendChat(text, localEcho=true){
    log('[DBG:internalSendChat] 開始', {text, localEcho});
    const payload = {
      type:'chat',
      role:'broadcaster',
      text:text,
      username: window.getCurrentUser? window.getCurrentUser(): '主播',
      ts: nowISO()
    };
    // 產生臨時 ID 用於 ACK 更新
    const tempId = 'tmp_' + Math.random().toString(36).slice(2,10);
    if(localEcho){
      const el = addMessage({ username: payload.username, text, isStreamer:true, timestamp: payload.timestamp, pending:true, tempId, statusLabel:'發送中' });
      pendingMap.set(tempId, { createdAt: Date.now(), retries:0, element: el, text });
    }
    // 將 tempId 附加（伺服器目前不處理，但可擴充）
    payload.tempId = tempId;
    log('[DBG:internalSendChat] sendRaw 前', payload);
    if(!sendRaw(payload)){
      queueMessage({ text, localEcho });
      if(state!==ChatStates.CONNECTED) connect();
      addSystemMessage('訊息暫存佇列，等待重送');
      return false;
    }
    log('[DBG:internalSendChat] sendRaw 已送出', {tempId});
    return true;
  }

  function checkPending(){
    const now = Date.now();
    pendingMap.forEach((meta, tid)=>{
      if(!meta.element || !document.body.contains(meta.element)) { pendingMap.delete(tid); return; }
      if(meta.element.classList.contains('pending')){
        const statusSpan = meta.element.querySelector('.msg-status');
        const elapsed = now - meta.createdAt;
        if(elapsed > RESEND_AFTER * (meta.retries+1) && meta.retries < MAX_RETRIES){
          // 標記重送
            meta.retries++;
            if(statusSpan) statusSpan.textContent = `(重送中 ${meta.retries})`;
            // 嘗試重送
            const resendPayload = {
              type:'chat',
              role:'broadcaster',
              text: meta.text,
              username: window.getCurrentUser? window.getCurrentUser(): '主播',
              ts: nowISO(),
              tempId: tid
            };
            sendRaw(resendPayload);
        } else if(meta.retries >= MAX_RETRIES && elapsed > RESEND_AFTER * (meta.retries+1)){
            if(statusSpan) statusSpan.textContent = '(失敗)';
            meta.element.classList.add('failed');
            pendingMap.delete(tid);
        }
      }
    });
    requestAnimationFrame(()=> setTimeout(checkPending, 1000));
  }

  function handleIncoming(data){
    log('[DBG:handleIncoming] 收到', data);
    switch(data.type){
      case 'chat_message':
        if(data.isStreamer){
          // 以 tempId 精準匹配
          if(data.tempId && pendingMap.has(data.tempId)){
            const meta = pendingMap.get(data.tempId);
            if(meta.element){
              meta.element.classList.remove('pending');
              const status = meta.element.querySelector('.msg-status');
              if(status){ status.textContent = '(已送出)'; status.style.opacity='.5'; setTimeout(()=>{ if(status){ status.remove(); } }, 1200); }
            }
            pendingMap.delete(data.tempId);
            return;
          }
          // 沒有匹配到 (例如重新整理後) 則正常顯示
          addMessage({ username:data.username, text:data.text, isStreamer:true, timestamp:data.timestamp });
        } else {
          addMessage(data);
        }
        break;
      case 'chat':
        if(data.role==='broadcaster'){
          if(data.tempId && pendingMap.has(data.tempId)){
            const meta = pendingMap.get(data.tempId);
            if(meta.element){
              meta.element.classList.remove('pending');
              const status = meta.element.querySelector('.msg-status');
              if(status){ status.textContent='(已送出)'; status.style.opacity='.5'; setTimeout(()=>{ if(status){ status.remove(); } },1000); }
            }
            pendingMap.delete(data.tempId);
            return;
          }
          addMessage({ username:data.username, text:data.text, isStreamer:true, timestamp:data.timestamp });
        } else if(data.role==='system') {
          addMessage({ username:'系統', text:data.text, isSystemMessage:true, timestamp:data.timestamp });
        } else {
          addMessage({ username:data.username, text:data.text, timestamp:data.timestamp });
        }
        break;
      case 'ack':
        if(data.event==='chat_message' && !data.ok){
          addSystemMessage('訊息未被接受: ' + (data.error||'未知錯誤'));
        } else if(data.event==='chat_message' && data.ok && data.tempId && pendingMap.has(data.tempId)){
          // 使用 ACK 也可提早清除 pending (雙保險)
          const meta = pendingMap.get(data.tempId);
          if(meta && meta.element){
            meta.element.classList.remove('pending');
            const status = meta.element.querySelector('.msg-status');
            if(status){ status.textContent = '(已送出)'; status.style.opacity='.5'; setTimeout(()=>{ if(status){ status.remove(); } }, 1000); }
          }
          pendingMap.delete(data.tempId);
        } else if(data.event==='chat' && data.ok && data.tempId && pendingMap.has(data.tempId)){
          const meta = pendingMap.get(data.tempId);
            if(meta && meta.element){
              meta.element.classList.remove('pending');
              const status = meta.element.querySelector('.msg-status');
              if(status){ status.textContent='(已送出)'; status.style.opacity='.5'; setTimeout(()=>{ if(status){ status.remove(); } }, 800); }
            }
            pendingMap.delete(data.tempId);
        } else if(data.event==='chat' && !data.ok){
          log('[DBG:handleIncoming] chat ack error', data);
          switch(data.error){
            case 'too_fast': addSystemMessage('發送過快，請稍候'); break;
            case 'duplicate': addSystemMessage('重複內容被阻擋'); break;
            case 'muted': addSystemMessage('您已被禁言'); break;
            case 'kicked': addSystemMessage('您已被踢出聊天室'); break;
            case 'not_authorized': addSystemMessage('未授權的角色'); break;
            default: addSystemMessage('訊息被拒絕: ' + data.error); break;
          }
        }
        break;
      case 'viewer_count_update':
        const vcEl = document.getElementById('chatViewerCount');
        if(vcEl) vcEl.textContent = data.count;
        break;
      case 'broadcaster_joined':
        addSystemMessage('已註冊為主播');
        break;
      case 'stream_start':
        addSystemMessage('直播已開始');
        break;
      case 'stream_end':
        addSystemMessage('直播已結束');
        break;
      default:
        // ignore others or future types
        break;
    }
  }

  // Public API
  function sendChatMessage(){
    const input = inputEl();
    if(!input) return;
    if(input.dataset.cooldown==='1'){ addSystemMessage('請稍候再發送 (冷卻中)'); return; }
    const raw = input.value;
    const text = raw.trim();
    if(!text) return;
    if(window.__lastSendText && window.__lastSendText===text && Date.now()-window.__lastSendTime < 5000){ addSystemMessage('重複訊息已阻擋'); return; }
    window.__lastSendText = text;
    window.__lastSendTime = Date.now();
    input.value='';
    internalSendChat(text, true);
    input.dataset.cooldown='1';
    input.disabled = true;
    setTimeout(()=>{ input.dataset.cooldown='0'; input.disabled=false; }, 1000);
  }
  function handleEnter(e){
    if(e.key==='Enter'){
      if(e.shiftKey){
        // 插入換行
        const input = inputEl();
        if(!input) return;
        const start = input.selectionStart, end = input.selectionEnd;
        const val = input.value;
        input.value = val.slice(0,start) + '\n' + val.slice(end);
        input.selectionStart = input.selectionEnd = start + 1;
        e.preventDefault();
      } else {
        e.preventDefault();
        sendChatMessage();
      }
    }
  }

  // Expose
  window.BroadcasterChat = { connect, sendChatMessage, handleEnter };

  // Auto init when DOM ready
  document.addEventListener('DOMContentLoaded', ()=>{
    connect();
    checkPending();
    // 載入歷史訊息
    fetch('/api/chat/history?limit=50').then(r=>r.json()).then(data => {
      if(data.success && Array.isArray(data.messages)){
        data.messages.forEach(msg => {
          addMessage({
            username: msg.username,
            text: msg.text,
            isStreamer: msg.role==='broadcaster',
            timestamp: msg.timestamp
          });
        });
      }
    }).catch(()=>{});
  });

})(window);
