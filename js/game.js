/* ===== GCITY Main Game =====
 * Vòng lặp chính: render canvas, xử lý input, chuyển zone, orchestrate tất cả.
 */
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let W=0, H=0, camX=0, camY=0;
  let player = null;
  let input = { keys:{}, joy:{x:0,y:0}, run:false };
  let lastT = 0;
  let time = 0;
  let speedBoost = 0; // thời gian tăng tốc còn lại

  function resize(){
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize); resize();

  // ---- Input ----
  window.addEventListener('keydown', e=>{
    input.keys[e.code] = true;
    if(e.code==='ShiftLeft'||e.code==='ShiftRight') input.run=true;
    if(e.code==='Escape'){ document.querySelectorAll('.panel').forEach(p=>p.classList.add('hidden')); }
  });
  window.addEventListener('keyup', e=>{
    input.keys[e.code] = false;
    if(e.code==='ShiftLeft'||e.code==='ShiftRight') input.run=false;
  });
  // click-to-move
  canvas.addEventListener('click', e=>{
    if(!player) return;
    const rect = canvas.getBoundingClientRect();
    const wx = e.clientX - rect.left + camX;
    const wy = e.clientY - rect.top + camY;
    if(!GameMap.collides(player.zone, wx, wy)){
      player.targetX = wx; player.targetY = wy;
    }
  });

  // ---- Render ----
  function render(){
    const zone = GameMap.getZone(player.zone);
    // camera follow
    camX = player.x - W/2; camY = player.y - H/2;
    camX = Math.max(0, Math.min(zone.width - W, camX));
    camY = Math.max(0, Math.min(zone.height - H, camY));
    if(zone.width < W) camX = (zone.width - W)/2;
    if(zone.height < H) camY = (zone.height - H)/2;

    ctx.fillStyle = zone.bg;
    ctx.fillRect(0,0,W,H);

    ctx.save();
    ctx.translate(-camX, -camY);

    // vỉa hè
    ctx.fillStyle = '#8b7355';
    (zone.paths||[]).forEach(p=>{ ctx.fillRect(p.x,p.y,p.w,p.h); });
    // lưới cỏ nhẹ
    ctx.strokeStyle = 'rgba(0,0,0,.05)';
    for(let x=0;x<zone.width;x+=40){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,zone.height); ctx.stroke(); }
    for(let y=0;y<zone.height;y+=40){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(zone.width,y); ctx.stroke(); }

    // nước (fishing zone)
    if(zone.water){
      const g = ctx.createLinearGradient(0, zone.water.y, 0, zone.water.y+zone.water.h);
      g.addColorStop(0,'#1a5a8a'); g.addColorStop(1,'#0a2a4a');
      ctx.fillStyle = g;
      ctx.fillRect(zone.water.x, zone.water.y, zone.water.w, zone.water.h);
      // sóng
      ctx.strokeStyle='rgba(255,255,255,.15)';
      for(let i=0;i<8;i++){
        ctx.beginPath();
        const yy = zone.water.y + 20 + i*28 + Math.sin(time*2+i)*3;
        ctx.moveTo(0, yy);
        for(let x=0;x<zone.water.w;x+=20){ ctx.lineTo(x, yy + Math.sin(time*3 + x*0.05 + i)*4); }
        ctx.stroke();
      }
      // docks
      (zone.docks||[]).forEach(d=>{
        ctx.fillStyle='#6b4423'; ctx.fillRect(d.x-30, d.y-8, 60, 16);
        ctx.fillStyle='#4a2c1a'; ctx.fillRect(d.x-30, d.y+8, 60, 4);
      });
    }

    // portal (cổng chuyển zone)
    if(zone.portal){
      const p = zone.portal;
      ctx.fillStyle='rgba(255,215,0,.2)'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.strokeStyle='#ffd700'; ctx.setLineDash([6,4]); ctx.strokeRect(p.x,p.y,p.w,p.h); ctx.setLineDash([]);
      ctx.fillStyle='#ffd700'; ctx.font='bold 14px sans-serif'; ctx.textAlign='center';
      ctx.fillText(p.label, p.x+p.w/2, p.y+p.h/2+5);
    }

    // buildings (sort by y for depth)
    const drawables = [];
    zone.buildings.forEach(b=> drawables.push({ y:b.y+b.h, fn:()=>Assets.drawBuilding(ctx, b.x, b.y, b.w, b.h, b.color, b.roof) }));
    (zone.trees||[]).forEach(t=> drawables.push({ y:t.y, fn:()=>Assets.drawTree(ctx, t.x, t.y, t.s) }));
    (zone.benches||[]).forEach(b=> drawables.push({ y:b.y, fn:()=>Assets.drawBench(ctx, b.x, b.y) }));
    if(zone.fountain) drawables.push({ y:zone.fountain.y+10, fn:()=>Assets.drawFountain(ctx, zone.fountain.x, zone.fountain.y, time) });

    // players (me + others)
    const others = Net.getPlayers();
    others.forEach(p=> drawables.push({ y:p.y, fn:()=>{
      Assets.drawCharacter(ctx, p.gender||'male', p.charIndex||0, p.x, p.y, p.dir||0, p.frame||0, p.action||null, p.actionT||0);
      drawName(p);
    }}));
    drawables.push({ y:player.y, fn:()=>{
      Assets.drawCharacter(ctx, player.gender, player.charIndex, player.x, player.y, player.dir, player.frame, player.action, player.actionT);
      drawName(player, true);
    }});

    drawables.sort((a,b)=>a.y-b.y);
    drawables.forEach(d=>d.fn());

    // biển hiệu building gần đó
    const near = GameMap.nearBuilding(player.zone, player.x, player.y);
    if(near){
      ctx.fillStyle='rgba(0,0,0,.7)';
      const label = `[E] ${near.name}`;
      ctx.font='13px sans-serif';
      const tw = ctx.measureText(label).width + 16;
      ctx.fillRect(player.x - tw/2, player.y - 70, tw, 22);
      ctx.fillStyle='#ffd700'; ctx.textAlign='center';
      ctx.fillText(label, player.x, player.y - 55);
    }

    ctx.restore();
  }

  function drawName(p, isMe){
    // tên + chat bubble
    ctx.font='bold 12px sans-serif'; ctx.textAlign='center';
    const name = p.name || 'Player';
    const tw = ctx.measureText(name).width + 12;
    ctx.fillStyle = isMe? 'rgba(255,215,0,.9)' : 'rgba(0,0,0,.6)';
    ctx.fillRect(p.x - tw/2, p.y - 58, tw, 18);
    ctx.fillStyle = isMe? '#222' : '#fff';
    ctx.fillText(name, p.x, p.y - 45);
    if(p.chatBubble){
      ctx.font='12px sans-serif';
      const bw = Math.min(160, ctx.measureText(p.chatBubble).width + 16);
      ctx.fillStyle='#fff';
      roundRect(ctx, p.x - bw/2, p.y - 92, bw, 24, 8); ctx.fill();
      ctx.fillStyle='#222';
      ctx.fillText(p.chatBubble.length>20? p.chatBubble.slice(0,20)+'…' : p.chatBubble, p.x, p.y - 76);
    }
  }
  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  }

  // ---- Actions ----
  function handleAction(type, data){
    if(type==='fishCast'){
      if(player.zone !== 'fishing' || !GameMap.atDock(player.zone, player.x, player.y)){
        UI.toast('Hãy đến bến câu cá ở đảo câu cá!'); return;
      }
      Fishing.cast(player, ev=>{
        if(ev.type==='error') UI.toast(ev.msg);
        if(ev.type==='casting'){ UI.toast('Đã quăng cần, chờ cá cắn…'); $('fishCastBtn').textContent='Kéo cần!'; }
        if(ev.type==='biting'){ UI.toast('🎣 Cá cắn mồi! Kéo nhanh!'); $('fishCastBtn').textContent='🎣 KÉO NGAY!'; $('fishCastBtn').style.background='linear-gradient(135deg,#ef4444,#dc2626)'; }
        if(ev.type==='escaped'){ UI.toast('Cá đã chạy mất…'); resetFishBtn(); }
        if(ev.type==='too_early'){ UI.toast('Kéo sớm quá, cá chạy rồi!'); resetFishBtn(); }
        if(ev.type==='caught'){
          UI.toast(`Bắt được ${ev.fish.icon} ${ev.fish.name} giá ${ev.fish.value}🪙!`);
          player.coins += ev.fish.value;
          resetFishBtn(); UI.updateHUD(player);
        }
      });
      // click button = reel nếu đang biting
      const st = Fishing.getState();
      if(st.state==='biting' || st.state==='waiting'){
        Fishing.reel(player, ev=>{
          if(ev.type==='caught'){ UI.toast(`Bắt được ${ev.fish.icon} ${ev.fish.name} giá ${ev.fish.value}🪙!`); player.coins += ev.fish.value; UI.updateHUD(player); }
          if(ev.type==='too_early') UI.toast('Kéo sớm quá, cá chạy rồi!');
          resetFishBtn();
        });
      }
    }
    else if(type==='fishSell'){
      const r = Fishing.sellAll(player);
      if(r.count>0) UI.toast(`Bán ${r.count} con cá, nhận ${r.money}🪙!`);
      else UI.toast('Chưa có cá nào để bán.');
      UI.updateHUD(player);
    }
    else if(type==='buyBait'){
      if(player.coins < data.price){ UI.toast('Không đủ tiền!'); return; }
      player.coins -= data.price;
      player.inventory[data.bait] = (player.inventory[data.bait]||0) + 5;
      UI.toast(`Mua 5 ${data.bait==='worm'?'giun':data.bait==='shrimp'?'tép':'mồi giả'}!`);
      UI.updateHUD(player);
    }
    else if(type==='buyCinema'){
      if(player.coins<20){ UI.toast('Không đủ 20🪙!'); return; }
      player.coins-=20; player.inventory.ticket++;
      UI.toast('Đã mua vé phim! 🎬'); UI.updateHUD(player);
    }
    else if(type==='buyCombo'){
      if(player.coins<15){ UI.toast('Không đủ 15🪙!'); return; }
      player.coins-=15; UI.toast('🍿 Combo đã sẵn sàng!'); UI.updateHUD(player);
    }
    else if(type==='buyLotto'){
      const num = (data||'').trim();
      if(!/^\d{3}$/.test(num)){ UI.toast('Hãy nhập 3 chữ số!'); return; }
      if(player.coins<10){ UI.toast('Không đủ 10🪙!'); return; }
      player.coins-=10;
      const result = String(Math.floor(Math.random()*1000)).padStart(3,'0');
      let prize = 0;
      if(num===result) prize = 1000;
      else if(num[1]===result[1] && num[2]===result[2]) prize = 100;
      else if(num[2]===result[2]) prize = 20;
      if(prize){ player.coins += prize; UI.toast(`🎉 Trúng ${prize}🪙! KQ: ${result}`); }
      else UI.toast(`Trượt rồi. KQ: ${result}`);
      const lr = document.getElementById('lottoResult');
      if(lr) lr.textContent = `Lần quay: ${num} → KQ: ${result} ${prize?`+${prize}🪙`:''}`;
      UI.updateHUD(player);
    }
    else if(type==='rentBike'){
      if(player.coins<30){ UI.toast('Không đủ 30🪙!'); return; }
      player.coins-=30; speedBoost = 60; player.speed = GCITY_CONFIG.GAME.moveSpeed * 1.8;
      UI.toast('🛵 Xe máy đã sẵn sàng (60s)!'); UI.updateHUD(player);
    }
    else if(type==='rentSkate'){
      if(player.coins<15){ UI.toast('Không đủ 15🪙!'); return; }
      player.coins-=15; speedBoost = Math.max(speedBoost, 30); player.speed = GCITY_CONFIG.GAME.moveSpeed * 1.4;
      UI.toast('🎿 Giày trượt (30s)!'); UI.updateHUD(player);
    }
    else if(type==='buyRod'){
      if(player.coins<100){ UI.toast('Không đủ 100🪙!'); return; }
      if(player.inventory.rod>=2){ UI.toast('Bạn đã có cần cao cấp!'); return; }
      player.coins-=100; player.inventory.rod=2;
      UI.toast('🎣 Đã nâng cấp cần câu!'); UI.updateHUD(player);
    }
  }
  function resetFishBtn(){
    const b = $('fishCastBtn'); if(!b) return;
    b.textContent='Quăng cần'; b.style.background='';
  }
  function $(id){ return document.getElementById(id); }

  // E key interaction với building gần đó
  window.addEventListener('keydown', e=>{
    if(e.code==='KeyE' && player){
      const near = GameMap.nearBuilding(player.zone, player.x, player.y);
      if(near){
        if(near.type==='cinema'||near.type==='lottery'||near.type==='rental'||near.type==='shop'){
          UI.togglePanel('shopPanel');
          UI.renderShop(near.type==='cinema'?'cinema':near.type==='lottery'?'lottery':'rental');
        }
        if(near.type==='fishshop'){ UI.togglePanel('fishPanel'); }
      }
    }
  });

  // ---- Main loop ----
  function loop(t){
    const dt = Math.min(0.05, (t - lastT)/1000 || 0);
    lastT = t; time += dt;

    if(player){
      // speed boost timer
      if(speedBoost>0){ speedBoost-=dt; if(speedBoost<=0){ player.speed=GCITY_CONFIG.GAME.moveSpeed; } }

      Player.update(player, dt, input, player.zone);
      Net.tick(dt);
      Fishing.update(dt, player, ()=>{});
      Net.sendMyState({ x:player.x, y:player.y, dir:player.dir, action:player.action, actionT:player.actionT });

      // chuyển zone
      const portal = GameMap.atPortal(player.zone, player.x, player.y);
      if(portal){
        player.zone = portal.to;
        const sp = GameMap.getZone(player.zone).spawn;
        player.x = sp.x; player.y = sp.y;
        player.targetX = null; player.targetY = null;
        UI.toast(`Đến ${GameMap.getZone(player.zone).name}`);
        UI.updateHUD(player);
      }
      UI.updateHUD(player);
    }
    render();
    requestAnimationFrame(loop);
  }

  // ---- Boot ----
  const loadSteps = [
    [10, 'Đang mở cửa thành phố…'],
    [30, 'Chuẩn bị cảnh và nhân vật…'],
    [55, 'Đang dựng quảng trường…'],
    [75, 'Một chút nữa, đến City rồi!'],
    [95, 'Kết nối máy chủ…'],
    [100, 'Sẵn sàng!'],
  ];
  let step = 0;
  const loadTimer = setInterval(()=>{
    if(step < loadSteps.length){
      UI.setLoading(loadSteps[step][0], loadSteps[step][1]);
      step++;
    } else {
      clearInterval(loadTimer);
      UI.hideLoading();
      UI.showCharSelect();
    }
  }, 400);

  UI.initCharSelect(async (charData)=>{
    UI.hideCharSelect();
    UI.setLoading(100, 'Đang vào thành phố…');
    $('loadingScreen').classList.remove('hidden');

    const spawn = GameMap.getZone('plaza').spawn;
    player = Player.create({
      id: 'me', name: charData.name, gender: charData.gender,
      charIndex: charData.charIndex, x: spawn.x, y: spawn.y
    });

    await Net.init(player);
    Net.onChat(msg=>{
      UI.addChat(msg.name, msg.text, msg.id==='system');
      if(msg.id !== Net.myId()){
        const p = Net.getPlayers().find(p=>p.id===msg.id);
        if(p){ Player.say(p, msg.text); }
      } else {
        Player.say(player, msg.text);
      }
    });
    Net.onPlayerJoin(p=> UI.renderPlayers(Net.getPlayers()));
    Net.onPlayerLeave(()=> UI.renderPlayers(Net.getPlayers()));

    UI.initPanels({
      onChatSend: text=> Net.sendChat(text),
      onEmote: id=> Player.doAction(player, id),
      onAction: handleAction,
      getPlayer: ()=> player,
      refreshPlayers: ()=> UI.renderPlayers(Net.getPlayers()),
    });
    UI.initJoystick(j=> input.joy = j);
    UI.updateHUD(player);
    UI.renderPlayers(Net.getPlayers());
    UI.addChat('Hệ thống', `Chào mừng ${player.name} đến với GCITY! Dùng WASD/click để di chuyển, E để tương tác.`, true);

    setTimeout(()=>{ $('loadingScreen').classList.add('hidden'); }, 600);
    requestAnimationFrame(loop);
  });
})();
