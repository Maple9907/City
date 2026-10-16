/* ===== GCITY 3D - Main Game Loop ===== */
(() => {
  let player = null;        // player data (logic)
  let playerMesh = null;    // THREE.Group
  let otherMeshes = {}, npcs = [];     // id -> THREE.Group
  let input = { keys:{}, joy:{x:0,y:0}, run:false };
  let speedBoost = 0;
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
    else { clearInterval(loadTimer); UI.hideLoading(); UI.showCharSelect(); }
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

  UI.initCharSelect(async (charData)=>{
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
    // NPC đứng ở các điểm tương tác: [tên, giới tính, kiểu, x, z, hướng mặt, câu chào]
    npcs = [
      ['🎟 Út Cá Cược','female',1,35,-1.5,-Math.PI/2,'Chọn bạn thú đi, về nhất ăn x3.5 nha! 🐎','race'],
      ['🚗 Tài Xế Chớp Nhoáng','male',2,-35,0,Math.PI/2,'Xe hay máy bay? Bay luôn cho nhanh! ✈'],
      ['🍿 Bắp Rang Bự','male',4,-4,-28.8,0,'Bắp rang nóng giòn, phim hay chờ sẵn! 🍿'],
      ['🎣 Sáu Cần Câu','female',2,-22.5,9.5,Math.PI/2,'Cá cắn câu rồi kìa, mua mồi đi bạn! 🎣'],
      ['🎰 Bảy Vé Số','male',1,23.5,-22.5,0,'Số đẹp đây, thử vận may nào! 🍀'],
      ['🍕 Chị Pizza Nóng','female',4,22.5,-8,-Math.PI/2,'Pizza ra lò, vừa thổi vừa ăn nè! 🍕'],
      ['🛒 Tú Tạp Hóa','male',5,-20.5,-22.5,0,'Tạp hóa Sunny, cần gì cũng có! 🛒'],
      ['🃏 Mèo Lật Bài','female',0,-9.2,0,Math.PI/2,'Lật cặp giống nhau, thắng xu liền tay! 🃏','memory'],
      ['🎟 Chú Ba Đánh Lô','male',0,3,13.4,Math.atan2(-3,-13.4),'Chọn số đi con, 10 giải quay liền! 🎟','lo'],
    ].map(([name,g,c,x,z,f,line,act])=>{
      const m = Scene3D.createCharacter(g, c, name, false);
      m.position.set(x, 0, z); m.userData.face = f; Scene3D.scene.add(m);
      return { m, line, x, z, home:f, cd:0, wv:0, act };
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
    let ci = charData.charIndex, gd = charData.gender;
    $('btnChar').onclick = ()=>{
      ci++; if(ci >= Scene3D.CHAR_DEFS[gd].length){ ci = 0; gd = gd==='male' ? 'female' : 'male'; }
      const old = playerMesh, nm = Scene3D.createCharacter(gd, ci, player.name, true);
      nm.position.copy(old.position); nm.userData.face = old.userData.face;
      Scene3D.scene.remove(old); Scene3D.scene.add(nm); playerMesh = nm; UI.toast('Đã đổi nhân vật');
    };
    $('btnRun').onclick = ()=>{ input.run = !input.run; $('btnRun').classList.toggle('on', input.run); };
    Park.init(player);
    UI.updateHUD(player);
    UI.renderPlayers(Net.getPlayers());
    UI.addChat('Hệ thống', `Chào mừng ${player.name} đến GCITY 3D! WASD di chuyển, kéo màn hình để xoay/nghiêng camera, lăn chuột hoặc chụm 2 ngón để zoom, chạm vào ghế để ngồi (chạm chỗ khác hoặc di chuyển để đứng dậy), lại gần NPC rồi chạm vào NPC (hoặc bấm E) để chơi game.`, true);

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
  });

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
  const NPC_ACT = { race:()=>Park.openRace(), memory:()=>Park.openGame('memory'), lo:()=>Park.openGame('lo') };
  const npcDist = n => Math.hypot(playerMesh.position.x - n.x, playerMesh.position.z - n.z);
  function nearestNpc(){
    if(currentZone!=='plaza') return null;
    let best = null, bd = NPC_R;
    npcs.forEach(n=>{ const d = npcDist(n); if(n.act && d < bd){ bd = d; best = n; } });
    return best;
  }
  function npcAt(cx, cy){   // NPC (đang trong tầm) gần điểm chạm nhất; dung sai 42px cho ngón tay
    if(currentZone!=='plaza') return null;
    const cam = Scene3D.camera, W = window.innerWidth, H = window.innerHeight; cam.updateMatrixWorld();
    let best = null, bd = 42;
    npcs.forEach(n=>{
      if(!n.act || npcDist(n) > NPC_R) return;
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
    else if(s.kind==='vehicle'){ UI.togglePanel('shopPanel'); UI.renderShop('rental'); }
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
    if(!playerMesh) return;
    const npc = npcAt(cx, cy); if(npc){ NPC_ACT[npc.act](); return; }
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

  // ---- Main loop ----
  let lastT = performance.now(), fpsN = 0, fpsT = performance.now();
  function loop(now){
    const dt = Math.min(0.05, (now-lastT)/1000); lastT = now;
    const time = now/1000;
    fpsN++; if(now-fpsT>500){ const f=$('fps'); if(f) f.textContent = Math.round(fpsN*1000/(now-fpsT)) + ' FPS'; fpsN=0; fpsT=now; }

    if(playerMesh){
      // movement (relative to camera)
      let mx=0, mz=0;
      if(input.keys['KeyW']||input.keys['ArrowUp']) { mx+=1; }
      if(input.keys['KeyS']||input.keys['ArrowDown']) { mx-=1; }
      if(input.keys['KeyA']||input.keys['ArrowLeft']) { mz-=1; }
      if(input.keys['KeyD']||input.keys['ArrowRight']) { mz+=1; }
      if(input.joy.x||input.joy.y){ mx += -input.joy.y; mz += input.joy.x; }

      const moving = (mx!==0 || mz!==0);
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

      if(speedBoost>0) speedBoost-=dt;

      // action timer (auto-clear non-sit)
      if(playerMesh.userData.action && playerMesh.userData.action!=='sit'){
        const dur = playerMesh.userData.action==='jump'?0.8 : (playerMesh.userData.action==='wave'?2.5 : (playerMesh.userData.action==='cry'?3 : (playerMesh.userData.action==='holla'?2 : 4)));
        if(playerMesh.userData.actionT > dur){ playerMesh.userData.action=null; player.action=null; }
      }

      // update animations
      Scene3D.updateCharacter(playerMesh, dt, time);
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

      // zone portal
      const portal = Scene3D.atPortal(currentZone, playerMesh.position.x, playerMesh.position.z);
      if(portal){
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
        const m = n.m, ud = m.userData; m.visible = (currentZone==='plaza');
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
      Scene3D.updateCamera(playerMesh.position.x, playerMesh.position.z);
      Park.update(currentZone);
      Fishing.update(dt, player, onFishEvent);
      UI.updateHUD(player);
    }

    Scene3D.render(time);
    requestAnimationFrame(loop);
  }
})();
