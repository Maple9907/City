/* ===== GCITY Player =====
 * Player entity: di chuyển (WASD/arrow/joystick/click), animation, actions/emotes/dances.
 */
const Player = (() => {
  const EMOTES = [
    { id:'wave', icon:'👋', name:'Giơ tay chiến thắng', duration:2.5 },
    { id:'cry', icon:'😢', name:'Khóc', duration:3 },
    { id:'sit', icon:'🧘', name:'Ngồi xếp bằng', duration:999 }, // toggle
    { id:'jump', icon:'⬆️', name:'Nhảy', duration:0.8 },
    { id:'dance1', icon:'💃', name:'Nhảy Bby WOW', duration:4 },
    { id:'dance2', icon:'🕺', name:'Nhảy CHAT', duration:4 },
    { id:'dance3', icon:'🐔', name:'Điệu nhảy gà vui nhộn', duration:4 },
    { id:'dance4', icon:'❤️', name:'Nhảy love options', duration:4 },
    { id:'dance5', icon:'🙏', name:'Nhảy sawadika', duration:4 },
    { id:'dance6', icon:'🎵', name:'Điệu Rumba uyển chuyển', duration:4 },
    { id:'dance7', icon:'🎤', name:'Biểu diễn hip hop', duration:4 },
    { id:'holla', icon:'✊', name:'Holla', duration:2 },
  ];

  function create(opts){
    return {
      id: opts.id || 'me',
      name: opts.name || 'Player',
      gender: opts.gender || 'male',
      charIndex: opts.charIndex || 0,
      x: opts.x || 600, y: opts.y || 400,
      dir: 0,              // 0=down,1=right,2=up,3=left
      moving: false,
      frame: 0, frameT: 0,
      action: null, actionT: 0, actionDur: 0,
      targetX: null, targetY: null, // click-to-move
      speed: GCITY_CONFIG.GAME.moveSpeed,
      chatBubble: null, chatT: 0,
      coins: GCITY_CONFIG.GAME.startCoins,
      inventory: { worm:10, shrimp:0, lure:0, fish:0, rod:1, ticket:0 },
      zone: 'plaza'
    };
  }

  function update(p, dt, input, zone){
    // action timer
    if(p.action){
      p.actionT += dt;
      if(p.action !== 'sit' && p.actionT >= p.actionDur){
        p.action = null; p.actionT = 0;
      }
    }
    // chat bubble timer
    if(p.chatT > 0){ p.chatT -= dt; if(p.chatT<=0) p.chatBubble=null; }

    // sit: không di chuyển được
    if(p.action === 'sit'){ p.moving = false; return; }

    let dx=0, dy=0;
    if(input.keys){
      if(input.keys['ArrowUp']||input.keys['KeyW']) dy-=1;
      if(input.keys['ArrowDown']||input.keys['KeyS']) dy+=1;
      if(input.keys['ArrowLeft']||input.keys['KeyA']) dx-=1;
      if(input.keys['ArrowRight']||input.keys['KeyD']) dx+=1;
    }
    if(input.joy){ dx += input.joy.x; dy += input.joy.y; }
    const keyMoving = (dx!==0 || dy!==0);

    if(keyMoving){
      p.targetX = null; p.targetY = null;
      const len = Math.hypot(dx,dy); dx/=len; dy/=len;
      const sp = (input.run? GCITY_CONFIG.GAME.runSpeed : p.speed) * dt;
      const nx = p.x + dx*sp, ny = p.y + dy*sp;
      if(!GameMap.collides(zone, nx, p.y)) p.x = nx;
      if(!GameMap.collides(zone, p.x, ny)) p.y = ny;
      if(Math.abs(dx)>Math.abs(dy)) p.dir = dx>0?1:3; else p.dir = dy>0?0:2;
      p.moving = true;
    } else if(p.targetX !== null){
      const ddx = p.targetX - p.x, ddy = p.targetY - p.y;
      const d = Math.hypot(ddx,ddy);
      if(d < 6){ p.targetX = null; p.targetY = null; p.moving = false; }
      else {
        const sp = p.speed * dt;
        const nx = p.x + ddx/d*sp, ny = p.y + ddy/d*sp;
        if(!GameMap.collides(zone, nx, p.y)) p.x = nx; else p.targetX=null;
        if(!GameMap.collides(zone, p.x, ny)) p.y = ny; else p.targetY=null;
        if(Math.abs(ddx)>Math.abs(ddy)) p.dir = ddx>0?1:3; else p.dir = ddy>0?0:2;
        p.moving = true;
      }
    } else {
      p.moving = false;
    }

    // animation frame
    if(p.moving){
      p.frameT += dt;
      if(p.frameT > 0.15){ p.frameT = 0; p.frame = 1-p.frame; }
    } else { p.frame = 0; }
  }

  function doAction(p, emoteId){
    const e = EMOTES.find(e=>e.id===emoteId);
    if(!e) return;
    if(p.action === 'sit' && emoteId !== 'sit'){ p.action=null; }
    if(emoteId === 'sit' && p.action === 'sit'){ p.action = null; return; }
    p.action = emoteId; p.actionT = 0; p.actionDur = e.duration;
  }

  function say(p, text){
    p.chatBubble = text; p.chatT = 5;
  }

  return { create, update, doAction, say, EMOTES };
})();
