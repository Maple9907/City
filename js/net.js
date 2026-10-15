/* ===== GCITY Network Layer =====
 * Abstraction: LocalMock (offline, with bots) hoặc Firebase (real multiplayer).
 * Đổi GCITY_CONFIG.USE_FIREBASE = true để dùng Firebase.
 * Interface:
 *   net.init(player) -> promise
 *   net.onPlayerJoin(cb), net.onPlayerLeave(cb), net.onPlayerUpdate(cb)
 *   net.sendMyState(state)
 *   net.sendChat(text)
 *   net.onChat(cb)
 *   net.getPlayers() -> array
 */
const Net = (() => {
  let mode = GCITY_CONFIG.USE_FIREBASE ? 'firebase' : 'local';
  let myId = null;
  let players = {};
  let cbs = { join:[], leave:[], update:[], chat:[] };
  let fbRef = null;

  function emit(evt, data){ cbs[evt].forEach(cb=>cb(data)); }

  // ---- LOCAL MOCK (bots) ----
  const botNames = ["Bé Bo","Candy","Miu Miu","Kyo","Luna","Tidus","Yuna","Cloud","Aerith","Squall"];
  const botChars = [];
  function spawnBots(){
    for(let i=0;i<GCITY_CONFIG.GAME.botCount;i++){
      const id = 'bot_'+i;
      const gender = Math.random()<.5?'male':'female';
      players[id] = {
        id, name: botNames[i%botNames.length],
        gender, charIndex: Math.floor(Math.random()*6),
        x: 200 + Math.random()*600, y: 200 + Math.random()*400,
        dir: Math.floor(Math.random()*4), moving: false,
        action: null, actionT: 0, targetX:0, targetY:0,
        chatT: 5 + Math.random()*10
      };
      botChars.push(players[id]);
    }
  }
  function tickBots(dt){
    Object.values(players).forEach(p=>{
      if(!p.id.startsWith('bot_')) return;
      // wander
      p.chatT -= dt;
      if(p.chatT <= 0){
        p.chatT = 8 + Math.random()*15;
        const lines = ["Hi mọi người!","Đi chơi không?","Có ai câu cá không?","Haha","Ở đâu vậy?","Đẹp quá đi","Let's go!"];
        emit('chat', { name:p.name, text: lines[Math.floor(Math.random()*lines.length)], id:p.id });
      }
      if(!p.moving && Math.random()<0.01){
        p.targetX = 100 + Math.random()*800;
        p.targetY = 100 + Math.random()*500;
        p.moving = true;
      }
      if(p.moving){
        const dx = p.targetX - p.x, dy = p.targetY - p.y;
        const d = Math.hypot(dx,dy);
        if(d < 5){ p.moving = false; }
        else {
          const sp = 80*dt;
          p.x += dx/d*sp; p.y += dy/d*sp;
          if(Math.abs(dx)>Math.abs(dy)) p.dir = dx>0?1:3; else p.dir = dy>0?0:2;
        }
      }
    });
  }

  // ---- FIREBASE ----
  function initFirebase(player){
    return new Promise((resolve,reject)=>{
      // load firebase SDK dynamically
      const s = document.createElement('script');
      s.src = "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js";
      s.onload = ()=>{
        const s2 = document.createElement('script');
        s2.src = "https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js";
        s2.onload = ()=>{
          try {
            firebase.initializeApp(GCITY_CONFIG.FIREBASE);
            fbRef = firebase.database().ref('gcity');
            myId = 'p_' + Math.random().toString(36).substr(2,8);
            const meRef = fbRef.child('players/'+myId);
            meRef.set({ name:player.name, gender:player.gender, charIndex:player.charIndex, x:player.x, y:player.y, dir:0, ts:Date.now() });
            meRef.onDisconnect().remove();
            // listen
            fbRef.child('players').on('child_added', s=>{
              const d = s.val(); if(!d || s.key===myId) return;
              players[s.key] = {...d, id:s.key};
              emit('join', players[s.key]);
            });
            fbRef.child('players').on('child_removed', s=>{
              delete players[s.key]; emit('leave', s.key);
            });
            fbRef.child('players').on('child_changed', s=>{
              const d = s.val(); if(!d || s.key===myId) return;
              players[s.key] = {...players[s.key], ...d, id:s.key};
              emit('update', players[s.key]);
            });
            fbRef.child('chat').limitToLast(1).on('child_added', s=>{
              const d = s.val(); if(d) emit('chat', d);
            });
            resolve();
          } catch(e){ reject(e); }
        };
        document.head.appendChild(s2);
      };
      document.head.appendChild(s);
    });
  }

  return {
    init(player){
      myId = 'me';
      players[myId] = player;
      if(mode==='firebase'){
        return initFirebase(player).catch(e=>{ console.warn('Firebase failed, fallback to local', e); mode='local'; spawnBots(); });
      } else {
        spawnBots();
        return Promise.resolve();
      }
    },
    tick(dt){ if(mode==='local') tickBots(dt); },
    sendMyState(state){
      if(mode==='firebase' && fbRef){
        fbRef.child('players/'+myId).update({...state, ts:Date.now()});
      }
    },
    sendChat(text){
      const msg = { id:myId, name: players[myId].name, text, ts:Date.now() };
      if(mode==='firebase' && fbRef){ fbRef.child('chat').push(msg); }
      emit('chat', msg);
    },
    onPlayerJoin(cb){ cbs.join.push(cb); },
    onPlayerLeave(cb){ cbs.leave.push(cb); },
    onPlayerUpdate(cb){ cbs.update.push(cb); },
    onChat(cb){ cbs.chat.push(cb); },
    getPlayers(){ return Object.values(players).filter(p=>p.id!==myId); },
    myId(){ return myId; }
  };
})();
