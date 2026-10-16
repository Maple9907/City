/* ===== GCITY 3D - Main Game Loop ===== */
(() => {
  let player = null;        // player data (logic)
  let playerMesh = null;    // THREE.Group
  let otherMeshes = {}, npcs = [];     // id -> THREE.Group
  let input = { keys:{}, joy:{x:0,y:0}, run:false };
  let speedBoost = 0;
  let riding = null;   // {type:'car'|'plane', slot, v:THREE.Group, prop, wheels, seat, yaw, alt, targetAlt, remain, maxSpeed, engine, autoDescend}
  const vInput = { fwd:false, back:false, up:false, down: false };
  // ===== Lưu dữ liệu người chơi =====
  // localStorage là chính (đủ: tên, giới tính, nhân vật, xu, túi đồ). Cookie giữ bản rút gọn (tên/giới tính/nhân vật/xu) để dự phòng
  // khi localStorage bị chặn/xoá. Dữ liệu gắn với TÊN MIỀN: đổi domain (www ↔ không www, http ↔ https, localhost ↔ 127.0.0.1) là coi như máy mới.
  const Save = {
    key: 'gcity_save_v1', warned: false,
    parse(raw){ try{ const s = JSON.parse(raw); return (s && typeof s.name==='string' && s.name && (s.gender==='male'||s.gender==='female')) ? s : null; }catch(e){ return null; } },
    load(){
      let s = null;
      try{ s = this.parse(localStorage.getItem(this.key)); }catch(e){}
      if(!s){ try{ const m = document.cookie.match(/(?:^|; )gcity_save=([^;]*)/); if(m) s = this.parse(decodeURIComponent(m[1])); }catch(e){} }
      return s;
    },
    write(d){
      const raw = JSON.stringify(d); let ok = false;
      try{ localStorage.setItem(this.key, raw); ok = (localStorage.getItem(this.key) === raw); }catch(e){}
      try{ document.cookie = 'gcity_save=' + encodeURIComponent(JSON.stringify({ name:d.name, gender:d.gender, charIndex:d.charIndex, coins:d.coins })) + ';max-age=31536000;path=/;SameSite=Lax'; }catch(e){}
      if(!ok && !this.warned){ this.warned = true; try{ UI.toast('Trình duyệt đang chặn lưu dữ liệu (chế độ ẩn danh?) — nhân vật có thể mất khi tải lại'); }catch(e){} }
      return ok;
    },
    clear(){ try{ localStorage.removeItem(this.key); }catch(e){} try{ document.cookie='gcity_save=;max-age=0;path=/'; }catch(e){} }
  };
  let curChar = null, entered = false;
  function saveNow(){
    if(!curChar || !player) return;
    Save.write({ v:2, t:Date.now(), name:curChar.name, gender:curChar.gender, charIndex:curChar.charIndex,
                 coins: Number.isFinite(player.coins) ? player.coins : GCITY_CONFIG.GAME.startCoins, inventory:player.inventory });
  }
  // Lưu theo đồng hồ thật (không phụ thuộc FPS) + lưu ngay khi ẩn tab / thoát app (trên điện thoại beforeunload hay không chạy)
  setInterval(saveNow, 2000);
  window.addEventListener('beforeunload', saveNow);
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') saveNow(); });
  try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}   // xin trình duyệt đừng tự dọn dữ liệu
  let currentZone = 'plaza';

  function $(id){ return document.getElementById(id); }

  // ---- Input ----
  window.addEventListener('keydown', e=>{
    if(e.target && e.target.tagName==='INPUT') return; // đang gõ chat/link thì đừng điều khiển nhân vật
    input.keys[e.code]=true;
    if(e.code==='ShiftLeft'||e.code==='ShiftRight') input.run=true;
    if(e.code==='Escape') document.querySelectorAll('.panel').forEach(p=>p.classList.add('hidden'));
  });
  window.addEventListener('keyup', e=>{
    input.keys[e.code]=false;
    if(e.code==='ShiftLeft'||e.code==='ShiftRight') input.run=false;
  });

  // ---- Boot ----
  const loadSteps = [[10,'Đang mở cửa thành phố…'],[30,'Chuẩn bị cảnh và nhân vật…'],[55,'Đang dựng quảng trường 3D…'],[75,'Một chút nữa, đến City rồi!'],[95,'Kết nối máy chủ…'],[100,'Sẵn sàng!']];
  let step=0;
  const loadTimer = setInterval(()=>{
    if(step<loadSteps.length){ UI.setLoading(loadSteps[step][0], loadSteps[step][1]); step++; }
    else { clearInterval(loadTimer); UI.hideLoading(); const sv=Save.load(); if(sv){ const n=Scene3D.CHAR_DEFS[sv.gender].length; enterGame({name:sv.name, gender:sv.gender, charIndex:Math.min(Math.max(0,sv.charIndex|0),n-1), _save:sv}); } else UI.showCharSelect(); }
  }, 400);

  // Override renderCharGrid cho 3D (dùng màu đơn giản trên canvas)
  UI.renderCharGrid3D = function(){
    const grid = $('charGrid'); grid.innerHTML='';
    const chars = Scene3D.CHAR_DEFS[UI._gender];
    chars.forEach((def, i)=>{
      const card = document.createElement('div');
      card.className = 'char-card' + (i===UI._charIdx?' selected':'');
      const cv = document.createElement('canvas'); cv.width=64; cv.height=80;
      const ctx = cv.getContext('2d');
      // vẽ preview đơn giản: đầu + thân
      ctx.fillStyle='#'+def.skin.toString(16).padStart(6,'0');
      ctx.beginPath(); ctx.arc(32,28,12,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#'+def.hair.toString(16).padStart(6,'0');
      ctx.beginPath(); ctx.arc(32,24,12,Math.PI,0); ctx.fill();
      ctx.fillStyle='#'+def.shirt.toString(16).padStart(6,'0');
      ctx.fillRect(22,38,20,24);
      ctx.fillStyle='#'+def.pants.toString(16).padStart(6,'0');
      ctx.fillRect(23,60,8,16); ctx.fillRect(33,60,8,16);
      card.appendChild(cv);
      const lbl = document.createElement('div'); lbl.className='char-label';
      lbl.textContent = (UI._gender==='male'?'Nam ':'Nữ ')+(i+1);
      card.appendChild(lbl);
      card.onclick = ()=>{ UI._charIdx=i; UI.renderCharGrid3D(); };
      grid.appendChild(card);
    });
  };

  async function enterGame(charData){
    if(entered) return; entered = true;   // chặn bấm đúp "Vào thành phố" → dựng 2 cảnh
    try {
    UI.hideCharSelect();
    $('loadingScreen').classList.remove('hidden');
    UI.setLoading(100, 'Đang vào thành phố 3D…');

    // init 3D
    Scene3D.init($('threeContainer'));
    const zone = Scene3D.buildZone('plaza');
    currentZone = 'plaza';

    const spawn = zone.spawn;
    player = Player.create({ id:'me', name:charData.name, gender:charData.gender, charIndex:charData.charIndex, x:spawn.x, y:0 });
    const sv = charData._save;
    if(sv){
      player.coins = typeof sv.coins==='number' ? sv.coins : GCITY_CONFIG.GAME.startCoins;
      player.inventory = Object.assign({worm:10,shrimp:0,lure:0,fish:0,rod:1,ticket:0}, sv.inventory||{});
    }
    curChar = { name:charData.name, gender:charData.gender, charIndex:charData.charIndex };
    saveNow();   // lưu NGAY khi tạo nhân vật, không chờ vòng lặp
    player.zone = 'plaza';
    playerMesh = Scene3D.createCharacter(charData.gender, charData.charIndex, charData.name, true);
    playerMesh.position.set(spawn.x, 0, spawn.z);
    Scene3D.scene.add(playerMesh);

    await Net.init({ id:'me', name:charData.name, gender:charData.gender, charIndex:charData.charIndex, x:spawn.x, y:spawn.z });

    // tạo mesh cho các player khác (bao gồm bot)
    function ensureOtherMesh(p){
      if(!otherMeshes[p.id]){
        const m = Scene3D.createCharacter(p.gender||'male', p.charIndex||0, p.name, false);
        m.position.set(p.x||0, 0, p.y||0);
        Scene3D.scene.add(m);
        otherMeshes[p.id] = m;
      }
      return otherMeshes[p.id];
    }
    Net.getPlayers().forEach(ensureOtherMesh);
    // NPC đứng ở các điểm tương tác: [tên, giới tính, kiểu, x, z, hướng mặt, câu chào, hành động, zone (mặc định plaza)]
    npcs = [
      ['🎟 Út Cá Cược','female',1,31.9,-1.5,-Math.PI/2,'7 bạn thú ra sân! Cược 1 ăn 6, chọn con nào đây? 🐎','race'],
      ['🚗 Tài Xế Chớp Nhoáng','male',2,-36.2,5.1,-Math.PI/2,'Xe hay máy bay? Chọn xe rồi lên ngồi luôn! ✈','rental'],
      ['🎣 Sáu Cần Câu','female',2,-22.5,9.5,Math.PI/2,'Cá cắn câu rồi kìa, mua mồi đi bạn! 🎣','fish'],
      ['🎰 Bảy Vé Số','male',1,23.5,-22.5,0,'Số đẹp đây, thử vận may nào! 🍀','lottery'],
      ['🍕 Chị Pizza Nóng','female',4,22.5,-8,-Math.PI/2,'Pizza ra lò, vừa thổi vừa ăn nè! 🍕'],
      ['🛒 Tú Tạp Hóa','male',5,-20.5,-22.5,0,'Tạp hóa Sunny, cần gì cũng có! 🛒'],
      ['🃏 Mèo Lật Bài','female',0,-9.2,0,Math.PI/2,'Lật cặp giống nhau, thắng xu liền tay! 🃏','memory'],
      ['🎟 Chú Ba Đánh Lô','male',0,3,13.4,Math.atan2(-3,-13.4),'Chọn số đi con, 10 giải quay liền! 🎟','lo'],
      ['📺 Anh Chiếu Màn','male',3,12.5,-29.5,0,'Dán link YouTube, lên màn hình lớn liền! 📺','tv'],
      ['🎣 Bà Tám Bến Câu','female',3,3.5,1,0,'Ra bến quăng cần đi, nhớ mua mồi nha! 🎣','fish','fishing'],
    ].map(([name,g,c,x,z,f,line,act,zone])=>{
      const m = Scene3D.createCharacter(g, c, name, false);
      m.position.set(x, 0, z); m.userData.face = f; Scene3D.scene.add(m);
      return { m, line, x, z, home:f, cd:0, wv:0, act, zone:zone||'plaza' };
    });
    Net.onPlayerJoin(p=>{ ensureOtherMesh(p); UI.renderPlayers(Net.getPlayers()); });
    Net.onPlayerLeave(id=>{ if(otherMeshes[id]){ Scene3D.scene.remove(otherMeshes[id]); delete otherMeshes[id]; } UI.renderPlayers(Net.getPlayers()); });
    Net.onChat(msg=>{
      UI.addChat(msg.name, msg.text, msg.id==='system');
      if(msg.id==='me' || msg.id===Net.myId()){
        Scene3D.setChatBubble(playerMesh, msg.text);
        clearTimeout(playerMesh._chatT);
        playerMesh._chatT = setTimeout(()=>Scene3D.setChatBubble(playerMesh, null), 5000);
      } else {
        const m = otherMeshes[msg.id];
        if(m){ Scene3D.setChatBubble(m, msg.text); clearTimeout(m._chatT); m._chatT=setTimeout(()=>Scene3D.setChatBubble(m,null),5000); }
      }
    });

    UI.initPanels({
      onChatSend: text=> Net.sendChat(text),
      onEmote: id=>{ Player.doAction(player, id); playerMesh.userData.action = player.action; playerMesh.userData.actionT = 0; },
      onAction: handleAction,
      getPlayer: ()=> player,
      refreshPlayers: ()=> UI.renderPlayers(Net.getPlayers()),
    });
    UI.initJoystick(j=> input.joy = j);
    function bindEnterDefault(){
      $('enterGameBtn').onclick = ()=>{
        const name = $('charName').value.trim() || 'Player';
        enterGame({ name, gender: UI._gender, charIndex: UI._charIdx });
      };
    }
    function openCharSwitch(){
      if(riding){ UI.toast('Hãy xuống xe trước khi đổi nhân vật!'); return; }
      // khoá giới tính: chỉ hiện nhân vật cùng giới với nhân vật đang dùng
      document.querySelectorAll('.gender-tab').forEach(t=>{ t.style.display='none'; });
      UI._gender = curChar.gender; UI._charIdx = curChar.charIndex;
      UI.renderCharGrid3D();
      $('charName').value = curChar.name;
      $('enterGameBtn').textContent = 'Đổi nhân vật';
      $('charSelect').classList.remove('hidden');
      $('enterGameBtn').onclick = ()=>{
        const name = $('charName').value.trim() || curChar.name;
        const gd = UI._gender, ci = UI._charIdx;
        const old = playerMesh, nm = Scene3D.createCharacter(gd, ci, name, true);
        nm.position.copy(old.position); nm.userData.face = old.userData.face;
        nm.userData.action = old.userData.action; nm.userData.moving = old.userData.moving;
        Scene3D.scene.remove(old); Scene3D.scene.add(nm); playerMesh = nm;
        player.name = name; player.gender = gd; player.charIndex = ci;
        curChar = { name, gender:gd, charIndex:ci };
        $('hudName').textContent = name;
        $('charSelect').classList.add('hidden');
        $('enterGameBtn').textContent = 'Vào thành phố';
        document.querySelectorAll('.gender-tab').forEach(t=>{ t.style.display=''; });
        UI._gender = 'male'; UI._charIdx = 0; UI.renderCharGrid3D();
        bindEnterDefault();
        UI.toast('Đã đổi nhân vật');
        saveNow();
      };
    }
    $('btnChar').onclick = openCharSwitch;
    $('btnRun').onclick = ()=>{ input.run = !input.run; $('btnRun').classList.toggle('on', input.run); };
    Park.init(player);
    UI.updateHUD(player);
    UI.renderPlayers(Net.getPlayers());
    UI.addChat('Hệ thống', `Chào mừng ${player.name} đến GCITY 3D! WASD di chuyển, kéo màn hình để xoay/nghiêng camera, lăn chuột hoặc chụm 2 ngón để zoom, chạm vào ghế để ngồi (chạm chỗ khác hoặc di chuyển để đứng dậy), lại gần NPC rồi chạm vào NPC (hoặc bấm E) để chơi game, mua vé/vé số, thuê đồ, câu cá, chiếu video TV.`, true);

    setTimeout(()=> $('loadingScreen').classList.add('hidden'), 500);
    requestAnimationFrame(loop);
    } catch(e) {
      const isWebGL = /WebGL/i.test(e.message);
      $('loadingText').style.whiteSpace='pre-wrap';
      $('loadingText').style.color = '#ff8888';
      $('loadingText').textContent = isWebGL
        ? 'Trình duyệt không hỗ trợ WebGL.\nHãy dùng Chrome/Cổ Edge/Safari mới nhất.'
        : ('Lỗi: ' + e.message);
      console.error(e);
    }
  }
  UI.initCharSelect(enterGame);

  // patch UI initCharSelect để dùng renderCharGrid3D
  const origInit = UI.initCharSelect;
  UI.initCharSelect = function(cb){
    UI._gender='male'; UI._charIdx=0;
    document.querySelectorAll('.gender-tab').forEach(tab=>{
      tab.onclick = ()=>{
        document.querySelectorAll('.gender-tab').forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
        UI._gender = tab.dataset.gender; UI._charIdx=0; UI.renderCharGrid3D();
      };
    });
    UI.renderCharGrid3D();
    $('enterGameBtn').onclick = ()=>{
      const name = $('charName').value.trim() || 'Player';
      cb({ name, gender: UI._gender, charIndex: UI._charIdx });
    };
  };

  // ---- Actions (shop/fish/etc) ----
  function handleAction(type, data){
    if(type==='fishCast'){
      if(currentZone!=='fishing' || !Scene3D.atDock('fishing', playerMesh.position.x, playerMesh.position.z)){
        UI.toast('Hãy đến bến câu cá ở đảo câu cá!'); return;
      }
      const st = Fishing.getState();
      if(st.state==='biting' || st.state==='waiting'){ Fishing.reel(player, onFishEvent); return; }
      Fishing.cast(player, onFishEvent);
    }
    else if(type==='fishSell'){ const r=Fishing.sellAll(player); if(r.count>0) UI.toast(`Bán ${r.count} cá +${r.money}🪙!`); else UI.toast('Chưa có cá.'); UI.updateHUD(player); }
    else if(type==='buyBait'){
      if(player.coins<data.price){ UI.toast('Không đủ tiền!'); return; }
      player.coins-=data.price; player.inventory[data.bait]=(player.inventory[data.bait]||0)+5;
      UI.toast('Mua thành công!'); UI.updateHUD(player);
    }
    else if(type==='buyCinema'){ if(player.coins<20){UI.toast('Không đủ 20🪙!');return;} player.coins-=20; player.inventory.ticket++; UI.toast('Đã mua vé phim! 🎬'); UI.updateHUD(player); }
    else if(type==='buyCombo'){ if(player.coins<15){UI.toast('Không đủ 15🪙!');return;} player.coins-=15; UI.toast('🍿 Combo!'); UI.updateHUD(player); }
    else if(type==='buyLotto'){
      const num=(data||'').trim(); if(!/^\d{3}$/.test(num)){UI.toast('Nhập 3 chữ số!');return;}
      if(player.coins<10){UI.toast('Không đủ 10🪙!');return;} player.coins-=10;
      const res=String(Math.floor(Math.random()*1000)).padStart(3,'0'); let prize=0;
      if(num===res)prize=1000; else if(num[1]===res[1]&&num[2]===res[2])prize=100; else if(num[2]===res[2])prize=20;
      if(prize){player.coins+=prize; UI.toast(`🎉 Trúng ${prize}🪙! KQ:${res}`);} else UI.toast(`Trượt. KQ:${res}`);
      const lr=$('lottoResult'); if(lr)lr.textContent=`${num} → KQ:${res} ${prize?`+${prize}🪙`:''}`;
      UI.updateHUD(player);
    }
    else if(type==='rentBike'){ if(player.coins<30){UI.toast('Không đủ 30🪙!');return;} player.coins-=30; speedBoost=60; UI.toast('🛵 Xe máy 60s!'); UI.updateHUD(player); }
    else if(type==='rentSkate'){ if(player.coins<15){UI.toast('Không đủ 15🪙!');return;} player.coins-=15; speedBoost=Math.max(speedBoost,30); UI.toast('🎿 Giày trượt 30s!'); UI.updateHUD(player); }
    else if(type==='rentVehicle'){
      const slot = Scene3D.getLotSlots()[data.slot];
      if(riding){ UI.toast('Bạn đang ngồi trên xe rồi!'); return; }
      if(!slot || slot.taken){ UI.toast('Xe này vừa có người thuê!'); openVehicleShop(); return; }
      const price = Vehicles.PRICE[slot.kind];
      if(player.coins<price){ UI.toast(`Không đủ ${price}🪙!`); return; }
      player.coins -= price; UI.updateHUD(player);
      mountVehicle(slot);
    }
    else if(type==='buyRod'){ if(player.coins<100){UI.toast('Không đủ 100🪙!');return;} if(player.inventory.rod>=2){UI.toast('Đã có cần cao cấp!');return;} player.coins-=100; player.inventory.rod=2; UI.toast('🎣 Cần nâng cấp!'); UI.updateHUD(player); }
  }
  function onFishEvent(ev){
    const b = $('fishCastBtn');
    if(ev.type==='error') UI.toast(ev.msg);
    else if(ev.type==='casting'){ UI.toast('Đã quăng cần, chờ cá cắn…'); b.textContent='Kéo cần!'; }
    else if(ev.type==='biting'){ UI.toast('🎣 Cá cắn! Kéo nhanh!'); b.textContent='🎣 KÉO NGAY!'; b.style.background='linear-gradient(135deg,#ef4444,#dc2626)'; }
    else if(ev.type==='caught'){ UI.toast(`Bắt được ${ev.fish.icon} ${ev.fish.name} (bán ~${ev.fish.value}🪙)`); resetFishBtn(); }
    else if(ev.type==='escaped'||ev.type==='too_early'){ UI.toast('Cá đã chạy…'); resetFishBtn(); }
    UI.updateHUD(player);
  }
  function resetFishBtn(){ const b=$('fishCastBtn'); if(b){b.textContent='Quăng cần'; b.style.background='';} }

  // E / chạm vào dòng gợi ý để tương tác (building, mini game, ghế, màn hình)
  // Game chỉ chơi qua NPC: lại gần NPC rồi chạm vào NPC (mobile) hoặc bấm E (desktop). Không có chữ gợi ý.
  const NPC_R = 5;
  const NPC_ACT = {
    race:()=>Park.openRace(), memory:()=>Park.openGame('memory'), lo:()=>Park.openGame('lo'),
    fish:()=>UI.openPanel('fishPanel'), tv:()=>UI.openPanel('tvPanel'),
    cinema:()=>UI.openShop('cinema'), lottery:()=>UI.openShop('lottery'), rental:()=>openVehicleShop(),
  };
  const npcDist = n => Math.hypot(playerMesh.position.x - n.x, playerMesh.position.z - n.z);
  function nearestNpc(){
    let best = null, bd = NPC_R;
    npcs.forEach(n=>{ if(n.zone!==currentZone) return; const d = npcDist(n); if(n.act && d < bd){ bd = d; best = n; } });
    return best;
  }
  function npcAt(cx, cy){   // NPC (đang trong tầm) gần điểm chạm nhất; dung sai 42px cho ngón tay
    const cam = Scene3D.camera, W = window.innerWidth, H = window.innerHeight; cam.updateMatrixWorld();
    let best = null, bd = 42;
    npcs.forEach(n=>{
      if(!n.act || n.zone!==currentZone || npcDist(n) > NPC_R) return;
      const pt = y=>{ const v = new THREE.Vector3(n.x, y, n.z).project(cam); return v.z < 1 ? [(v.x+1)/2*W, (1-v.y)/2*H] : null; };
      const a = pt(0.2), b = pt(1.9); if(!a || !b) return;
      const abx = b[0]-a[0], aby = b[1]-a[1];
      const t = Math.max(0, Math.min(1, ((cx-a[0])*abx + (cy-a[1])*aby) / ((abx*abx + aby*aby) || 1)));
      const d = Math.hypot(cx - (a[0]+abx*t), cy - (a[1]+aby*t));
      if(d < bd){ bd = d; best = n; }
    });
    return best;
  }
  function interact(){
    if(!playerMesh) return;
    const npc = nearestNpc(); if(npc){ NPC_ACT[npc.act](); return; }
    const s = Scene3D.nearSpot(currentZone, playerMesh.position.x, playerMesh.position.z);
    if(!s){ const b = Scene3D.nearBench(currentZone, playerMesh.position.x, playerMesh.position.z); if(b) toggleSit(b); return; }
    if(s.kind==='building'){
      if(s.ref.type==='fishshop'){ UI.togglePanel('fishPanel'); return; }
      UI.togglePanel('shopPanel');
      UI.renderShop(s.ref.type==='cinema'?'cinema':s.ref.type==='lottery'?'lottery':'rental');
    }
    else if(s.kind==='screen') UI.togglePanel('tvPanel');
    else if(s.kind==='vehicle') openVehicleShop();
  }
  function sitOn(b){
    const ud = playerMesh.userData;
    playerMesh.position.set(b.x, 0, b.z); ud.face = b.ry; ud.action = 'sit'; ud.actionT = 0; player.action = 'sit';
    player.x = b.x; player.y = b.z; Net.sendMyState({ x:b.x, y:b.z, action:'sit' });
  }
  function standUp(){
    const ud = playerMesh.userData;
    if(ud.action!=='sit') return;
    ud.action = null; player.action = null; Net.sendMyState({ x:player.x, y:player.y, action:null });
  }
  function toggleSit(b){ if(playerMesh.userData.action==='sit') standUp(); else sitOn(b); }

  // Chạm vào ghế: đi tới + ngồi (đứng sát thì ngồi luôn). Chạm ra chỗ khác: đứng dậy / huỷ đi. Di chuyển joystick/WASD: tự đứng dậy (xử lý trong loop).
  let walkTo = null;   // { b: ghế đích, t: thời gian đã đi, stuck: thời gian bị kẹt }
  Scene3D.setTapHandler((cx, cy)=>{
    if(!playerMesh || riding) return;
    const npc = npcAt(cx, cy); if(npc){ UI.guardTap(); NPC_ACT[npc.act](); return; }
    const sitting = playerMesh.userData.action==='sit';
    const b = Scene3D.pickBench(cx, cy);
    if(!b){ walkTo = null; if(sitting) standUp(); return; }
    const d = Math.hypot(playerMesh.position.x - b.x, playerMesh.position.z - b.z);
    if(sitting && d < 0.3) return;                     // đang ngồi đúng ghế này rồi
    if(walkTo && walkTo.b === b) return;               // đang đi tới ghế này rồi
    if(sitting) standUp();
    if(d <= 1.8){ walkTo = null; sitOn(b); }
    else walkTo = { b, t:0, stuck:0 };
  });
  window.addEventListener('keydown', e=>{ if(e.code==='KeyE' && e.target.tagName!=='INPUT') interact(); });

  // camera button
  document.addEventListener('click', e=>{
    if(e.target.id==='btnCam'){ /* toggle cam handled by drag already */ }
  });

  // ===== Xe / máy bay thuê: chạm NPC -> chọn xe -> nhân vật ngồi lên thật (model dùng chung trong js/vehicles.js) =====
  function openVehicleShop(){
    const list = Scene3D.getLotSlots().map(v=>({ i:v.i, kind:v.kind, name:v.name, cssColor:Vehicles.css(v.color), price:Vehicles.PRICE[v.kind], taken:v.taken }));
    UI.renderVehicleShop(list); UI.openPanel('vehiclePanel');
  }
  // vị trí mông nhân vật ngồi (world) từ vị trí/hướng xe + ghế local; y trừ 0.6 vì ở tư thế ngồi hông nằm cao hơn gốc nhân vật ~0.7
  function seatWorld(r){
    const c = Math.cos(r.yaw), sn = Math.sin(r.yaw), st = r.seat;
    return { x: r.v.position.x + st.x*c + st.z*sn, y: r.alt + st.y - 0.6, z: r.v.position.z - st.x*sn + st.z*c };
  }
  function mountVehicle(slot){
    if(riding){ UI.toast('Bạn đang ngồi trên xe rồi!'); return; }
    const v = Vehicles.build(slot.kind, slot.color), ud = v.userData;
    v.position.set(slot.x, 0, slot.z); v.rotation.y = slot.yaw;
    Scene3D.scene.add(v);
    Scene3D.setLotTaken(slot.i, true);                  // xe rời khỏi bãi, bong bóng đếm còn x-1
    Scene3D.setLotBadgeVisible(false);
    riding = { type:slot.kind, slot:slot.i, v, prop:ud.prop||null, wheels:ud.wheels||[], seat:ud.seat, yaw:slot.yaw, alt:0, targetAlt:0,
               remain:Vehicles.RENT_SEC, maxSpeed:ud.maxSpeed, autoDescend:false, engine:0, netT:0 };
    const um = playerMesh.userData;
    um.moving = false; um.action = 'sit'; um.actionT = 0; player.action = 'sit';   // ngồi thật lên ghế
    walkTo = null; speedBoost = 0;
    const sp = seatWorld(riding); player.x = sp.x; player.y = sp.z;
    try{ Net.sendMyState({x:player.x, y:player.y, action:'sit'}); }catch(e){}
    document.querySelectorAll('.panel').forEach(p=>p.classList.add('hidden'));
    const hud = $('vehicleHud'); hud.classList.remove('hidden');
    hud.classList.toggle('car-mode', slot.kind!=='plane');
    $('rentTimer').textContent = 'Xuống xe · 5:00';
    UI.toast(slot.kind==='plane' ? '✈️ Đã lên máy bay! Giữ "Bay lên ↑" để nổ máy và cất cánh.' : '🚗 Đã lên xe! Dùng joystick hoặc nút Tiến/Lùi để lái.');
  }
  function dismountVehicle(){
    if(!riding) return;
    const v = riding.v, yaw = riding.yaw, slot = riding.slot;
    Scene3D.scene.remove(v);
    Scene3D.setLotTaken(slot, false);                   // xe tự về bãi
    Scene3D.setLotBadgeVisible(true);
    playerMesh.position.set(v.position.x, 0, v.position.z);
    playerMesh.userData.face = yaw; playerMesh.userData.moving = false;
    playerMesh.userData.action = null; player.action = null;
    player.x = v.position.x; player.y = v.position.z;
    try{ Net.sendMyState({x:player.x, y:player.y, action:null}); }catch(e){}
    riding = null;
    $('vehicleHud').classList.add('hidden');
    Object.keys(vInput).forEach(k=>vInput[k]=false);
    document.querySelectorAll('.vbtn').forEach(b=>b.classList.remove('hold'));
    UI.toast('Đã xuống xe, xe tự về bãi.');
  }
  function updateRiding(dt){
    const r = riding; if(!r) return;
    let thr = -input.joy.y;
    if(vInput.fwd) thr += 1; if(vInput.back) thr -= 1;
    if(input.keys['KeyW']||input.keys['ArrowUp']) thr += 1;
    if(input.keys['KeyS']||input.keys['ArrowDown']) thr -= 1;
    thr = Math.max(-1, Math.min(1, thr));
    let steer = input.joy.x;
    if(input.keys['KeyA']||input.keys['ArrowLeft']) steer -= 1;
    if(input.keys['KeyD']||input.keys['ArrowRight']) steer += 1;
    steer = Math.max(-1, Math.min(1, steer));
    const isPlane = r.type==='plane';
    if(isPlane){
      if(r.autoDescend){ r.targetAlt = 0; if(thr < 0.4) thr = 0.4; }
      else {
        // chỉ cất cánh được khi động cơ đã nổ đủ mạnh (cánh quạt đang quay)
        if(vInput.up && r.engine > 0.45) r.targetAlt += 9*dt;
        if(vInput.down) r.targetAlt -= 9*dt;
        r.targetAlt = Math.max(0, Math.min(22, r.targetAlt));
      }
      r.alt += (r.targetAlt - r.alt) * Math.min(1, dt*2.5);
      if(r.alt < 0.05) r.alt = 0;
    }
    const airborne = isPlane && r.alt > 0.5;    // đã rời đất (vẫn có thể đâm vào công trình nếu bay thấp)
    const overBuildings = isPlane && r.alt > 10; // bay cao hơn nóc tòa nhà -> không va chạm gì cả
    let speed = thr * r.maxSpeed;
    if(airborne && speed < 5) speed = 5;   // máy bay đang bay không đứng yên được
    r.yaw += steer * dt * 2.4 * (0.25 + Math.min(1, Math.abs(speed)/7));
    const nx = r.v.position.x + Math.sin(r.yaw)*speed*dt;
    const nz = r.v.position.z + Math.cos(r.yaw)*speed*dt;
    let x = r.v.position.x, z = r.v.position.z;
    if(!overBuildings){
      if(!Scene3D.collides(currentZone, nx, r.v.position.z)) x = nx;
      if(!Scene3D.collides(currentZone, x, nz)) z = nz;
    } else {
      const L = 54;
      x = Math.max(-L, Math.min(L, nx)); z = Math.max(-L, Math.min(L, nz));
    }
    r.v.position.set(x, r.alt, z);
    r.v.rotation.y = r.yaw;
    // cánh quạt: đứng yên khi đỗ; bấm Bay lên / chạy trên đường băng thì bắt đầu quay (tăng dần), bay thì quay hết tốc lực
    if(r.prop){
      const want = (airborne || r.targetAlt > 0.3 || vInput.up) ? 1 : (Math.abs(thr) > 0.05 || r.autoDescend ? 0.45 : 0);
      r.engine += (want - r.engine) * Math.min(1, dt * (want > r.engine ? 1.8 : 1.0));
      if(r.engine < 0.01) r.engine = 0;
      r.prop.rotation.z += r.engine * 60 * dt;
    }
    r.wheels.forEach(w=>{ w.rotation.x += speed*dt/0.38; });
    player.x = x; player.y = z;
    Scene3D.updateCamera(x, z, r.alt);
    r.netT -= dt; if(r.netT <= 0){ r.netT = 0.15; try{ Net.sendMyState({x:x, y:z, action:'sit'}); }catch(e){} }
    r.remain -= dt;
    const mm = Math.max(0, Math.floor(r.remain/60)), ss = Math.max(0, Math.floor(r.remain%60));
    const rt = $('rentTimer'); if(rt) rt.textContent = `Xuống xe · ${mm}:${String(ss).padStart(2,'0')}`;
    if(r.remain <= 0 && !r.autoDescend){
      r.autoDescend = true;
      if(!isPlane || r.alt < 0.6){ dismountVehicle(); return; }
      UI.toast('Hết giờ thuê, tự động hạ cánh…');
    }
    if(r.autoDescend && (!isPlane || r.alt < 0.35)){ dismountVehicle(); }
  }
  // gắn sự kiện "giữ nút" cho các nút điều khiển xe/máy bay
  (function bindVehicleBtns(){
    const bind = (id, key)=>{
      const b = document.getElementById(id); if(!b) return;
      const on = e=>{ e.preventDefault(); vInput[key]=true; b.classList.add('hold'); };
      const off = ()=>{ vInput[key]=false; b.classList.remove('hold'); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('pointerleave', off);
    };
    bind('vFwd','fwd'); bind('vBack','back'); bind('vUp','up'); bind('vDown','down');
    const rt = document.getElementById('rentTimer');
    if(rt) rt.addEventListener('click', ()=>{
      if(!riding) return;
      if(riding.type==='plane' && riding.alt > 0.8 && !riding.autoDescend){ riding.autoDescend = true; UI.toast('Đang tự động hạ cánh…'); }
      else dismountVehicle();
    });
  })();

  // ---- Main loop ----
  let lastT = performance.now(), fpsN = 0, fpsT = performance.now();
  function loop(now){
    const dt = Math.min(0.05, (now-lastT)/1000); lastT = now;
    const time = now/1000;
    fpsN++; if(now-fpsT>500){ const f=$('fps'); if(f) f.textContent = Math.round(fpsN*1000/(now-fpsT)) + ' FPS'; fpsN=0; fpsT=now; }

    if(playerMesh){
      let moving = false;
      if(riding){ updateRiding(dt); }
      else {
      // movement (relative to camera)
      let mx=0, mz=0;
      if(input.keys['KeyW']||input.keys['ArrowUp']) { mx+=1; }
      if(input.keys['KeyS']||input.keys['ArrowDown']) { mx-=1; }
      if(input.keys['KeyA']||input.keys['ArrowLeft']) { mz-=1; }
      if(input.keys['KeyD']||input.keys['ArrowRight']) { mz+=1; }
      if(input.joy.x||input.joy.y){ mx += -input.joy.y; mz += input.joy.x; }

      moving = (mx!==0 || mz!==0);
      playerMesh.userData.moving = moving;
      if(moving && playerMesh.userData.action==='sit'){ playerMesh.userData.action = null; player.action = null; } // đi là tự đứng dậy

      if(moving && playerMesh.userData.action!=='sit'){
        const dir = Scene3D.getMoveDir();
        const len = Math.hypot(mx,mz); mx/=len; mz/=len;
        const sp = (input.run||speedBoost>0? 7 : 4) * dt;
        const dx = (dir.fx*mx + dir.rx*mz) * sp;
        const dz = (dir.fz*mx + dir.rz*mz) * sp;
        const px = playerMesh.position.x, pz = playerMesh.position.z;
        if(!Scene3D.collides(currentZone, px+dx, pz)) playerMesh.position.x += dx;
        if(!Scene3D.collides(currentZone, px, pz+dz)) playerMesh.position.z += dz;
        // face direction
        const ang = Math.atan2(dx, dz);
        playerMesh.userData.face = ang;
        // sync to player data
        player.x = playerMesh.position.x; player.y = playerMesh.position.z;
        Net.sendMyState({ x:player.x, y:player.y, action:player.action });
      }

      // đang tự đi tới ghế vừa chạm (bấm joystick/WASD là huỷ)
      if(moving) walkTo = null;
      else if(walkTo){
        const ud = playerMesh.userData, b = walkTo.b, px = playerMesh.position.x, pz = playerMesh.position.z;
        const ddx = b.x - px, ddz = b.z - pz, dist = Math.hypot(ddx, ddz);
        walkTo.t += dt;
        if(dist < 0.8){ walkTo = null; sitOn(b); }
        else if(walkTo.t > 12){ walkTo = null; ud.moving = false; }
        else {
          const sp = Math.min(dist, (input.run||speedBoost>0 ? 7 : 4) * dt), sx = ddx/dist*sp, sz = ddz/dist*sp;
          let mv = false;
          if(!Scene3D.collides(currentZone, px+sx, pz)){ playerMesh.position.x += sx; mv = true; }
          if(!Scene3D.collides(currentZone, px, pz+sz)){ playerMesh.position.z += sz; mv = true; }
          ud.moving = mv; ud.face = Math.atan2(sx, sz);
          player.x = playerMesh.position.x; player.y = playerMesh.position.z;
          Net.sendMyState({ x:player.x, y:player.y, action:player.action });
          walkTo.stuck = mv ? 0 : walkTo.stuck + dt;
          if(walkTo.stuck > 0.5){ walkTo = null; ud.moving = false; UI.toast('Có vật cản, lại gần ghế hơn nhé'); }
        }
      }
      } // end else (!riding)

      if(speedBoost>0) speedBoost-=dt;

      // action timer (auto-clear non-sit)
      if(playerMesh.userData.action && playerMesh.userData.action!=='sit'){
        const dur = playerMesh.userData.action==='jump'?0.8 : (playerMesh.userData.action==='wave'?2.5 : (playerMesh.userData.action==='cry'?3 : (playerMesh.userData.action==='holla'?2 : 4)));
        if(playerMesh.userData.actionT > dur){ playerMesh.userData.action=null; player.action=null; }
      }

      // update animations
      Scene3D.updateCharacter(playerMesh, dt, time);
      if(riding){
        // đặt nhân vật ngồi vào ghế xe (override mọi thứ animation đặt lại); luôn giữ tư thế 'sit'
        const sp = seatWorld(riding);
        playerMesh.position.set(sp.x, sp.y, sp.z);
        playerMesh.rotation.y = riding.yaw;
        playerMesh.userData.face = riding.yaw;
        playerMesh.userData.moving = false;
        if(playerMesh.userData.action !== 'sit'){ playerMesh.userData.action = 'sit'; playerMesh.userData.actionT = 0; }
        player.action = 'sit';
      }
      Object.values(otherMeshes).forEach(m=>{
        // bot/other movement (from net)
        const p = Net.getPlayers().find(pp=>pp.id===m.userData?._id);
        Scene3D.updateCharacter(m, dt, time);
      });

      // sync other players positions from Net (bots wander)
      Net.tick(dt);
      Net.getPlayers().forEach(p=>{
        const m = otherMeshes[p.id];
        if(m){
          m.userData._id = p.id;
          // smooth move toward p.x, p.y
          const tx = p.x||0, tz = p.y||0;
          m.position.x += (tx - m.position.x)*Math.min(1, dt*5);
          m.position.z += (tz - m.position.z)*Math.min(1, dt*5);
          const dist = Math.hypot(tx-m.position.x, tz-m.position.z);
          m.userData.moving = dist > 0.1;
          if(dist>0.05) m.userData.face = Math.atan2(tx-m.position.x, tz-m.position.z);
          m.userData.action = p.action || null;
        }
      });

      // zone portal (bỏ qua khi đang lái xe / bay)
      const portal = Scene3D.atPortal(currentZone, playerMesh.position.x, playerMesh.position.z);
      if(portal && !riding){
        currentZone = portal.to; walkTo = null;
        Scene3D.buildZone(currentZone);
        // re-add player + others
        Scene3D.scene.add(playerMesh);
        player.zone = currentZone;
        Object.values(otherMeshes).forEach(m=>{ Scene3D.scene.add(m); m.visible = (currentZone==='plaza'); });
        const sp = Scene3D.getZone(currentZone).spawn;
        playerMesh.position.set(sp.x, 0, sp.z);
        UI.toast(`Đến ${Scene3D.getZone(currentZone).name}`);
        UI.updateHUD(player);
      }

      npcs.forEach(n=>{
        const m = n.m, ud = m.userData; m.visible = (n.zone===currentZone);
        const dx = playerMesh.position.x - n.x, dz = playerMesh.position.z - n.z, d = Math.hypot(dx,dz);
        const cur = ud.face||0, tgt = d<9 ? Math.atan2(dx,dz) : n.home;
        ud.face = cur + Math.atan2(Math.sin(tgt-cur), Math.cos(tgt-cur)) * Math.min(1, dt*6);
        n.cd -= dt;
        if(d<6 && n.cd<=0){
          n.cd = 25; n.wv = 2.5; ud.action = 'wave'; ud.actionT = 0;
          Scene3D.setChatBubble(m, n.line); clearTimeout(m._chatT); m._chatT = setTimeout(()=>Scene3D.setChatBubble(m,null), 5000);
        }
        if(n.wv>0){ n.wv -= dt; if(n.wv<=0) ud.action = null; }
        Scene3D.updateCharacter(m, dt, time);
      });
      if(!riding) Scene3D.updateCamera(playerMesh.position.x, playerMesh.position.z);
      Park.update(currentZone);
      Fishing.update(dt, player, onFishEvent);
      UI.updateHUD(player);
    }

    Scene3D.render(time);
    requestAnimationFrame(loop);
  }
})();
