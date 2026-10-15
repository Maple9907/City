/* ===== GCITY Procedural Assets =====
 * Tất cả asset được vẽ bằng canvas (không dùng file ngoài).
 * 6 nhân vật nam + 6 nhân vật nữ, mỗi nhân vật có 4 hướng + animation đi.
 */
const Assets = (() => {
  const charDefs = {
    male: [
      { skin:'#f5c9a0', hair:'#2a1a0f', shirt:'#3b82f6', pants:'#1e3a5f', hairStyle:'short' },
      { skin:'#e8b88f', hair:'#0f0f0f', shirt:'#ef4444', pants:'#2d2d2d', hairStyle:'spiky' },
      { skin:'#f0c090', hair:'#6b4423', shirt:'#10b981', pants:'#374151', hairStyle:'curly' },
      { skin:'#f5d0a8', hair:'#d4a017', shirt:'#8b5cf6', pants:'#4c1d95', hairStyle:'short' },
      { skin:'#e0a878', hair:'#1a1a1a', shirt:'#f59e0b', pants:'#78350f', hairStyle:'spiky' },
      { skin:'#f8d8b8', hair:'#8b4513', shirt:'#ec4899', pants:'#831843', hairStyle:'curly' },
    ],
    female: [
      { skin:'#f8d4b0', hair:'#1a1a1a', shirt:'#ec4899', pants:'#be185d', hairStyle:'long', skirt:true },
      { skin:'#f0c090', hair:'#8b4513', shirt:'#f59e0b', pants:'#92400e', hairStyle:'ponytail', skirt:true },
      { skin:'#fce0c0', hair:'#f5d060', shirt:'#06b6d4', pants:'#155e75', hairStyle:'twin', skirt:true },
      { skin:'#e8b88f', hair:'#2d1b0e', shirt:'#a855f7', pants:'#6b21a8', hairStyle:'long', skirt:false },
      { skin:'#f5c9a0', hair:'#c0392b', shirt:'#22c55e', pants:'#14532d', hairStyle:'ponytail', skirt:true },
      { skin:'#f8d8b8', hair:'#4a3728', shirt:'#f43f5e', pants:'#9f1239', hairStyle:'twin', skirt:true },
    ]
  };

  // Vẽ nhân vật lên canvas context, tại (x,y) là điểm giữa chân
  // dir: 0=xuống,1=phải,2=lên,3=trái; frame: 0 hoặc 1 (animation bước)
  // action: null|'wave'|'cry'|'sit'|'jump'|'dance1'..'dance6'
  function drawCharacter(ctx, gender, idx, x, y, dir, frame, action, actionT){
    const def = charDefs[gender][idx % charDefs[gender].length];
    ctx.save();
    ctx.translate(x, y);
    const bob = frame ? 1 : 0;
    let yOff = -bob;
    let armSwing = frame ? 3 : -3;
    let legSwing = frame ? 4 : -4;

    if(action==='jump'){ yOff = -8 - Math.sin(actionT*Math.PI)*12; }
    if(action==='sit'){ yOff = 4; legSwing = 0; armSwing = 0; }

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(0, 2, 12, 4, 0, 0, Math.PI*2); ctx.fill();

    ctx.translate(0, yOff);
    const flip = (dir===3) ? -1 : 1;
    ctx.scale(flip, 1);

    const skin = def.skin, hair = def.hair, shirt = def.shirt, pants = def.pants;

    // legs
    ctx.fillStyle = pants;
    if(action==='sit'){
      ctx.fillRect(-7, -10, 14, 6); // ngồi gập chân
    } else {
      ctx.fillRect(-6+legSwing*0.5, -12, 5, 12);
      ctx.fillRect(1-legSwing*0.5, -12, 5, 12);
    }
    // shoes
    ctx.fillStyle = '#222';
    ctx.fillRect(-7+legSwing*0.5, -2, 6, 3);
    ctx.fillRect(0-legSwing*0.5, -2, 6, 3);

    // body (shirt)
    ctx.fillStyle = shirt;
    if(def.skirt && !action){
      ctx.beginPath(); ctx.moveTo(-8,-26); ctx.lineTo(8,-26); ctx.lineTo(11,-12); ctx.lineTo(-11,-12); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillRect(-7, -26, 14, 15);
    }

    // arms
    ctx.fillStyle = skin;
    let leftArmY = -25, rightArmY = -25;
    let leftArmX = -9, rightArmX = 6;
    if(action==='wave'){
      rightArmY = -38 - Math.sin(actionT*8)*3; rightArmX = 4;
    }
    if(action && action.startsWith('dance')){
      const t = actionT*6;
      leftArmY = -28 + Math.sin(t)*6; rightArmY = -28 + Math.cos(t)*6;
      leftArmX = -9 + Math.cos(t)*3; rightArmX = 6 + Math.sin(t)*3;
    }
    if(action==='cry'){ leftArmY = -20; rightArmY = -20; }
    ctx.fillRect(leftArmX - armSwing*0.3, leftArmY, 4, 11);
    ctx.fillRect(rightArmX + armSwing*0.3, rightArmY, 4, 11);

    // head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, -33, 8, 0, Math.PI*2); ctx.fill();

    // hair
    ctx.fillStyle = hair;
    if(def.hairStyle==='short' || def.hairStyle==='spiky'){
      ctx.beginPath(); ctx.arc(0, -35, 8.5, Math.PI, 0); ctx.fill();
      if(def.hairStyle==='spiky'){
        ctx.beginPath();
        ctx.moveTo(-8,-36); ctx.lineTo(-10,-44); ctx.lineTo(-5,-38);
        ctx.lineTo(-2,-46); ctx.lineTo(1,-38); ctx.lineTo(5,-45); ctx.lineTo(8,-37);
        ctx.closePath(); ctx.fill();
      }
    } else if(def.hairStyle==='curly'){
      for(let a=0;a<5;a++){ const ang = Math.PI + a*Math.PI/4; ctx.beginPath(); ctx.arc(Math.cos(ang)*7, -35+Math.sin(ang)*5, 3.5, 0, Math.PI*2); ctx.fill(); }
    } else if(def.hairStyle==='long'){
      ctx.beginPath(); ctx.arc(0, -35, 8.5, Math.PI, 0); ctx.fill();
      ctx.fillRect(-9, -34, 4, 16); ctx.fillRect(5, -34, 4, 16);
    } else if(def.hairStyle==='ponytail'){
      ctx.beginPath(); ctx.arc(0, -35, 8.5, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(8, -30, 3, 7, 0.3, 0, Math.PI*2); ctx.fill();
    } else if(def.hairStyle==='twin'){
      ctx.beginPath(); ctx.arc(0, -35, 8.5, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-9, -28, 3, 6, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(9, -28, 3, 6, 0.3, 0, Math.PI*2); ctx.fill();
    }

    // face (only when facing down/side)
    if(dir===0 || dir===1 || dir===3){
      ctx.fillStyle = '#222';
      ctx.fillRect(-3.5, -34, 1.5, 2); // eyes
      ctx.fillRect(2, -34, 1.5, 2);
      if(action==='cry'){
        ctx.fillStyle = '#6bc5ff';
        ctx.fillRect(-4, -31, 1.5, 4); ctx.fillRect(2.5, -31, 1.5, 4);
        ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(-2,-29); ctx.lineTo(2,-29); ctx.stroke();
      } else if(action && action.startsWith('dance')){
        ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.arc(0, -30, 2.5, 0, Math.PI); ctx.stroke();
      } else {
        ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(-1.5,-30); ctx.lineTo(1.5,-30); ctx.stroke();
      }
    }

    ctx.restore();
  }

  // Vẽ cây
  function drawTree(ctx, x, y, scale=1){
    ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
    ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0,4,18,6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#6b4423'; ctx.fillRect(-3,-20,6,22);
    ctx.fillStyle='#2d6a2d'; ctx.beginPath(); ctx.arc(0,-30,16,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#3a8a3a'; ctx.beginPath(); ctx.arc(-6,-34,10,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(7,-32,9,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // Vẽ tòa nhà
  function drawBuilding(ctx, x, y, w, h, color, roof){
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle='rgba(0,0,0,.3)'; ctx.fillRect(4,4,w,h);
    ctx.fillStyle=color; ctx.fillRect(0,0,w,h);
    ctx.fillStyle=roof; ctx.fillRect(-4,-8,w+8,10);
    // cửa sổ
    ctx.fillStyle='#ffd700';
    for(let wy=10; wy<h-14; wy+=18){
      for(let wx=8; wx<w-10; wx+=16){
        if(Math.random()<.7) ctx.fillRect(wx,wy,8,10);
      }
    }
    // cửa
    ctx.fillStyle='#4a2c1a'; ctx.fillRect(w/2-8, h-18, 16, 18);
    ctx.restore();
  }

  // Vẽ đài phun nước
  function drawFountain(ctx, x, y, t){
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle='rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0,6,40,14,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#888'; ctx.beginPath(); ctx.ellipse(0,0,40,14,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#4a9eff'; ctx.beginPath(); ctx.ellipse(0,-2,34,11,0,0,Math.PI*2); ctx.fill();
    // nước phun
    ctx.strokeStyle='rgba(107,197,255,.7)'; ctx.lineWidth=2;
    for(let i=0;i<5;i++){
      const a = i/5*Math.PI*2 + t*0.5;
      ctx.beginPath(); ctx.moveTo(0,-4);
      ctx.quadraticCurveTo(Math.cos(a)*14, -20-Math.sin(t*3+i)*4, Math.cos(a)*22, -4);
      ctx.stroke();
    }
    ctx.fillStyle='#aaa'; ctx.fillRect(-4,-18,8,16);
    ctx.restore();
  }

  // Vẽ ghế đá
  function drawBench(ctx, x, y){
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle='#6b4423'; ctx.fillRect(-16,-4,32,4); ctx.fillRect(-16,-10,32,3);
    ctx.fillStyle='#444'; ctx.fillRect(-13,-4,3,6); ctx.fillRect(10,-4,3,6);
    ctx.restore();
  }

  // Vẽ biển hiệu khu vực
  function drawSign(ctx, x, y, text){
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle='#4a2c1a'; ctx.fillRect(-2,-20,4,24);
    ctx.fillStyle='#8b4513'; ctx.fillRect(-40,-36,80,20);
    ctx.fillStyle='#ffd700'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center';
    ctx.fillText(text, 0, -22);
    ctx.restore();
  }

  return { charDefs, drawCharacter, drawTree, drawBuilding, drawFountain, drawBench, drawSign };
})();
