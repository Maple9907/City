/* ===== GCITY UI =====
 * Quản lý tất cả panel UI, character select, loading, toast, joystick.
 */
const UI = (() => {
  let selectedGender = 'male', selectedChar = 0;
  let onEnterGame = null, onChatSend = null, onEmote = null, onAction = null;
  let toastTimer = null;

  function $(id){ return document.getElementById(id); }

  // ---- Loading ----
  function setLoading(pct, text){
    $('loadingBar').style.width = pct + '%';
    if(text) $('loadingText').textContent = text;
  }
  function hideLoading(){ $('loadingScreen').classList.add('hidden'); }

  // ---- Character Select ----
  // Ảnh xem trước 3D (GChar.preview) - cache Image để bấm đổi thẻ không bị nháy
  const previewImgs = {};
  function drawPreview3D(ctx, gender, i){
    if(typeof GChar === 'undefined') return false;
    const key = gender + i; let im = previewImgs[key];
    if(!im){ const url = GChar.preview(gender, i, 132, 165); if(!url) return false; im = new Image(); im.src = url; previewImgs[key] = im; }
    if(im.complete) ctx.drawImage(im, 0, 0); else im.onload = ()=> ctx.drawImage(im, 0, 0);
    return true;
  }

  function renderCharGrid(){
    const grid = $('charGrid'); grid.innerHTML = '';
    const chars = (typeof Scene3D!=='undefined'? Scene3D.CHAR_DEFS : {male:[],female:[]})[selectedGender];
    chars.forEach((def, i)=>{
      const card = document.createElement('div');
      card.className = 'char-card' + (i===selectedChar?' selected':'');
      const cv = document.createElement('canvas');
      cv.width = 132; cv.height = 165;
      const ctx = cv.getContext('2d');
      if(!drawPreview3D(ctx, selectedGender, i)){
        // fallback 2D khi trình duyệt không có WebGL: đầu + thân theo màu nhân vật
        ctx.scale(2.06, 2.06);
        ctx.fillStyle='#'+def.skin.toString(16).padStart(6,'0');
        ctx.beginPath(); ctx.arc(32,26,11,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#'+def.hair.toString(16).padStart(6,'0');
        ctx.beginPath(); ctx.arc(32,22,11,Math.PI,0); ctx.fill();
        ctx.fillStyle='#'+def.shirt.toString(16).padStart(6,'0');
        ctx.fillRect(22,36,20,22);
        ctx.fillStyle='#'+def.pants.toString(16).padStart(6,'0');
        ctx.fillRect(23,58,8,18); ctx.fillRect(33,58,8,18);
      }
      card.appendChild(cv);
      const lbl = document.createElement('div');
      lbl.className='char-label';
      lbl.textContent = (selectedGender==='male'?'Nam ':'Nữ ') + (i+1);
      card.appendChild(lbl);
      card.onclick = ()=>{ selectedChar=i; renderCharGrid(); };
      grid.appendChild(card);
    });
  }
  function initCharSelect(cb){
    onEnterGame = cb;
    document.querySelectorAll('.gender-tab').forEach(tab=>{
      tab.onclick = ()=>{
        document.querySelectorAll('.gender-tab').forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
        selectedGender = tab.dataset.gender; selectedChar = 0;
        renderCharGrid();
      };
    });
    renderCharGrid();
    $('enterGameBtn').onclick = ()=>{
      const name = $('charName').value.trim() || 'Player';
      onEnterGame({ name, gender: selectedGender, charIndex: selectedChar });
    };
  }
  function showCharSelect(){ $('charSelect').classList.remove('hidden'); }
  function hideCharSelect(){ $('charSelect').classList.add('hidden'); $('gameScreen').classList.remove('hidden'); }

  // ---- Panels ----
  function togglePanel(id){
    const p = $(id);
    const wasHidden = p.classList.contains('hidden');
    document.querySelectorAll('.panel').forEach(x=>x.classList.add('hidden'));
    if(wasHidden) p.classList.remove('hidden');
  }
  function closePanel(id){ $(id).classList.add('hidden'); }

  function initPanels(callbacks){
    onChatSend = callbacks.onChatSend;
    onEmote = callbacks.onEmote;
    onAction = callbacks.onAction;

    // close buttons
    document.querySelectorAll('.panel-close').forEach(btn=>{
      btn.onclick = ()=> closePanel(btn.dataset.close);
    });
    // bottom action buttons
    $('btnEmote').onclick = ()=> togglePanel('emotePanel');
    $('btnChat').onclick = ()=> togglePanel('chatPanel');
    $('btnFish').onclick = ()=> togglePanel('fishPanel');
    $('btnShop').onclick = ()=> { togglePanel('shopPanel'); renderShop('cinema'); };
    $('btnInventory').onclick = ()=> { togglePanel('inventoryPanel'); renderInventory(callbacks.getPlayer()); };
    $('btnTV').onclick = ()=> togglePanel('tvPanel');
    $('btnMini').onclick = ()=> Park.openMenu();
    $('btnPlayers').onclick = ()=> { togglePanel('playersPanel'); callbacks.refreshPlayers(); };
    ($('btnMap')||{}).onclick = ()=> toast('Bản đồ: Quảng trường ở giữa, đảo câu cá ở cổng tàu phía dưới.');

    // chat
    $('chatSend').onclick = sendChat;
    $('chatInput').addEventListener('keydown', e=>{ if(e.key==='Enter') sendChat(); });

    // emote grid
    const grid = $('emoteGrid'); grid.innerHTML='';
    Player.EMOTES.forEach(e=>{
      const item = document.createElement('button');
      item.className='emote-item';
      item.innerHTML = `<span class="emote-icon">${e.icon}</span>${e.name}`;
      item.onclick = ()=>{ onEmote(e.id); closePanel('emotePanel'); };
      grid.appendChild(item);
    });

    // fishing
    $('fishCastBtn').onclick = ()=> onAction('fishCast');
    $('fishSellBtn').onclick = ()=> onAction('fishSell');
    document.querySelectorAll('.shop-item').forEach(btn=>{
      btn.onclick = ()=> onAction('buyBait', { bait: btn.dataset.bait, price: parseInt(btn.dataset.price) });
    });

    // shop tabs
    document.querySelectorAll('.shop-tab').forEach(tab=>{
      tab.onclick = ()=>{
        document.querySelectorAll('.shop-tab').forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
        renderShop(tab.dataset.tab);
      };
    });
  }

  function sendChat(){
    const input = $('chatInput');
    const text = input.value.trim();
    if(!text) return;
    input.value = '';
    onChatSend(text);
  }
  function addChat(name, text, isSystem){
    const hist = $('chatHistory');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-who${isSystem?' system':''}">${name}:</span><span>${text}</span>`;
    hist.appendChild(div);
    hist.scrollTop = hist.scrollHeight;
  }

  // ---- Shop content (cinema/lottery/rental) ----
  function renderShop(tab){
    const c = $('shopContent');
    if(tab==='cinema'){
      c.innerHTML = `
        <div class="shop-service">
          <h4>🎬 Phim chiếu hôm nay</h4>
          <p>City Adventure 3D - 90 phút. Vé: 20🪙</p>
          <button class="btn-primary" id="buyCinema">Mua vé (20🪙)</button>
        </div>
        <div class="shop-service">
          <h4>🍿 Combo bắp nước</h4>
          <p>Xem phim có bắp ngon hơn. Giá: 15🪙</p>
          <button class="btn-secondary" id="buyCombo">Mua combo (15🪙)</button>
        </div>`;
      $('buyCinema').onclick = ()=> onAction('buyCinema');
      $('buyCombo').onclick = ()=> onAction('buyCombo');
    } else if(tab==='lottery'){
      c.innerHTML = `
        <div class="shop-service">
          <h4>🎰 Vé số City</h4>
          <p>Chọn 3 số. Trúng giải thưởng lên đến 1000🪙! Vé: 10🪙</p>
          <input id="lottoNum" type="text" maxlength="3" placeholder="VD: 123" style="width:100%;padding:8px;background:#1e1e30;border:1px solid #2a2a44;border-radius:6px;color:#fff;margin-bottom:8px;text-align:center;font-size:18px;letter-spacing:4px;" />
          <button class="btn-primary" id="buyLotto">Mua vé (10🪙)</button>
        </div>
        <div class="shop-service">
          <h4>📊 Kết quả gần nhất</h4>
          <p id="lottoResult">Chưa có lần quay nào.</p>
        </div>`;
      $('buyLotto').onclick = ()=> onAction('buyLotto', $('lottoNum').value);
    } else if(tab==='rental'){
      c.innerHTML = `
        <div class="shop-service">
          <h4>🛵 Xe máy (tăng tốc 60s)</h4>
          <p>Di chuyển nhanh hơn trong thành phố. Giá: 30🪙</p>
          <button class="btn-primary" id="rentBike">Thuê xe (30🪙)</button>
        </div>
        <div class="shop-service">
          <h4>🎿 Giày trượt (tăng tốc 30s)</h4>
          <p>Giá: 15🪙</p>
          <button class="btn-secondary" id="rentSkate">Thuê giày (15🪙)</button>
        </div>
        <div class="shop-service">
          <h4>🎣 Cần câu cao cấp</h4>
          <p>Tăng tỉ lệ cá lớn. Giá: 100🪙</p>
          <button class="btn-secondary" id="buyRod">Mua cần (100🪙)</button>
        </div>`;
      $('rentBike').onclick = ()=> onAction('rentBike');
      $('rentSkate').onclick = ()=> onAction('rentSkate');
      $('buyRod').onclick = ()=> onAction('buyRod');
    }
  }

  // ---- Inventory ----
  function renderInventory(p){
    const c = $('inventoryContent'); c.innerHTML='';
    const items = [
      { icon:'🪙', name:'Tiền', count:p.coins },
      { icon:'🐟', name:'Cá', count:p.inventory.fish },
      { icon:'🪱', name:'Giun', count:p.inventory.worm },
      { icon:'🦐', name:'Tép', count:p.inventory.shrimp },
      { icon:'✨', name:'Mồi giả', count:p.inventory.lure },
      { icon:'🎣', name:'Cần', count:p.inventory.rod },
      { icon:'🎫', name:'Vé phim', count:p.inventory.ticket },
    ];
    items.forEach(it=>{
      const slot = document.createElement('div');
      slot.className='inv-slot';
      slot.innerHTML = `${it.icon}<span class="inv-name">${it.name}</span><span class="inv-count">${it.count}</span>`;
      c.appendChild(slot);
    });
  }

  // ---- Players list ----
  function renderPlayers(list){
    const c = $('playersList'); c.innerHTML='';
    list.forEach(p=>{
      const row = document.createElement('div');
      row.className='player-row';
      row.innerHTML = `<span class="player-dot"></span><span>${p.name}</span>`;
      c.appendChild(row);
    });
    $('playerCount').textContent = list.length + 1;
  }

  // ---- HUD update ----
  function updateHUD(p){
    $('hudName').textContent = p.name;
    $('hudCoin').textContent = p.coins;
    $('hudZone').textContent = (Scene3D.getZone(p.zone)||{}).name || '';
    $('fishCount').textContent = p.inventory.fish;
    const bait = p.inventory.lure>0?`Mồi giả (${p.inventory.lure})`:(p.inventory.shrimp>0?`Tép (${p.inventory.shrimp})`:`Giun (${p.inventory.worm})`);
    $('fishBait').textContent = bait;
    $('fishRod').textContent = p.inventory.rod>=2?'Cần cao cấp':'Cần cơ bản';
  }

  // ---- Toast ----
  function toast(msg){
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> t.classList.add('hidden'), 2500);
  }

  // ---- Joystick ----
  function initJoystick(onMove){
    const joy = $('joystick'), knob = $('joystickKnob');
    let active=false, cx=0, cy=0;
    const R = 33;
    function start(e){
      active=true;
      const r = joy.getBoundingClientRect();
      cx = r.left + r.width/2; cy = r.top + r.height/2;
    }
    function move(e){
      if(!active) return;
      const t = e.touches? e.touches[0] : e;
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const d = Math.hypot(dx,dy);
      if(d>R){ dx=dx/d*R; dy=dy/d*R; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      onMove({ x: dx/R, y: dy/R });
    }
    function end(){ active=false; knob.style.transform='translate(-50%,-50%)'; onMove({x:0,y:0}); }
    joy.addEventListener('touchstart', start);
    joy.addEventListener('touchmove', e=>{ e.preventDefault(); move(e); }, {passive:false});
    joy.addEventListener('touchend', end);
    joy.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
  }

  return { setLoading, hideLoading, initCharSelect, showCharSelect, hideCharSelect,
    togglePanel, closePanel, initPanels, addChat, updateHUD, toast, initJoystick,
    renderInventory, renderPlayers, renderShop };
})();
