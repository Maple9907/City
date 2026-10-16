/* ===== GCITY Park: màn hình lớn chiếu YouTube + mini game =====
 * - Video YouTube là iframe HTML, được "dán" lên màn hình 3D bằng CSS matrix3d (homography
 *   từ 4 góc màn hình đã project ra màn hình 2D) nên xoay camera video vẫn bám theo.
 * - Mini game: Lật hình, Canh nhịp, Đoán số (phí 5🪙, thắng nhận xu).
 */
const Park = (() => {
  const $ = id => document.getElementById(id);
  const FW = 960, FH = 540;
  let player = null, frame = null, videoId = null, lastZone = null;

  // ---------- Trường đua thú: mở vé 30s -> đua ~9s -> kết quả 7s ----------
  const AN=['🐎 Ngựa Đỏ','🐕 Chó Xanh','🐇 Thỏ Vàng','🐢 Rùa Tím'], RC={id:206453,ph:'open',t:30,tk:null,p:[0,0,0,0],v:[],w:-1,fee:10,acc:0};
  let raceT = 0;
  function raceStep(dt){
    RC.t -= dt;
    if(RC.ph==='open' && RC.t<=0){ RC.ph='run'; RC.p=[0,0,0,0]; RC.v=AN.map(()=>.09+Math.random()*.05); RC.t=0; }
    else if(RC.ph==='run'){
      RC.t += dt; AN.forEach((_,i)=>{ RC.p[i] += (RC.v[i] + Math.sin(RC.t*2+i*2)*.02)*dt; });
      const m = Math.max(...RC.p);
      if(m>=1){ RC.w=RC.p.indexOf(m); RC.ph='end'; RC.t=7;
        if(RC.tk===RC.w){ const win=Math.round(RC.fee*3.5); player.coins+=win; UI.updateHUD(player); UI.toast(`🎉 Trúng vé đua! +${win}🪙`); }
        else if(RC.tk!==null) UI.toast('Vé đua không trúng, chúc may mắn!'); }
    }
    else if(RC.ph==='end' && RC.t<=0){ RC.ph='open'; RC.t=30; RC.id++; RC.tk=null; RC.p=[0,0,0,0]; }
    RC.acc += dt;
    if(RC.acc>=.5){ RC.acc=0;
      const st = RC.ph==='open' ? `Đang mở vé ${Math.ceil(RC.t)} giây` : RC.ph==='run' ? 'Đang đua!' : `Thắng: ${AN[RC.w]}`;
      Scene3D.setRaceBoard(`Sơ Cấp · Phiên #${RC.id}`,'VÉ CỦA BẠN', RC.tk===null ? 'Chưa mua vé phiên này' : AN[RC.tk],'TRẠNG THÁI',st); }
    Scene3D.setRacers(RC.p.map(p=> Math.PI/2 + p*Math.PI*2));
  }
  function openRace(){
    const b = showGamePanel('🎟 Trường đua thú');
    if(RC.ph!=='open'){ b.innerHTML = `<div class="mg-info">${RC.ph==='run' ? 'Đang đua, chờ phiên sau để mua vé.' : 'Phiên đã kết thúc, chờ phiên mới.'}</div>`; return; }
    if(RC.tk!==null){ b.innerHTML = `<div class="mg-info">Vé của bạn: ${AN[RC.tk]} (phiên #${RC.id}). Về nhất nhận x3.5.</div>`; return; }
    b.innerHTML = AN.map((n,i)=>`<button class="shop-item" data-a="${i}">${n} — ${RC.fee}🪙</button>`).join('') + '<div class="mg-info">Chọn một bạn thú, về nhất nhận x3.5 tiền vé.</div>';
    b.querySelectorAll('[data-a]').forEach(btn=> btn.onclick = ()=>{
      if(RC.ph!=='open') return openRace();
      if(player.coins<RC.fee){ UI.toast(`Cần ${RC.fee}🪙`); return; }
      player.coins -= RC.fee; RC.tk = +btn.dataset.a; UI.updateHUD(player); UI.toast('Đã mua vé 🎟'); openRace();
    });
  }

  // ---------- YouTube ----------
  function parseYT(s){
    s = (s || '').trim();
    if(/^[\w-]{11}$/.test(s)) return s;
    const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);
    return m ? m[1] : null;
  }
  const PLAYING = ['📺 ĐANG PHÁT', 'Lại gần màn hình để xem'];
  function playVideo(input){
    const id = parseYT(input);
    if(!id){ UI.toast('Link YouTube không hợp lệ'); return; }
    videoId = id;
    frame.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
    Scene3D.setScreenText(...PLAYING);
    try { localStorage.setItem('gcity_yt', input); } catch(e){}
  }
  function stopVideo(){
    videoId = null; frame.src = 'about:blank'; frame.style.visibility = 'hidden';
    Scene3D.setScreenText('GCITY TV', 'Lại gần bấm E để chọn video YouTube');
  }

  // Ánh xạ hình chữ nhật FW×FH -> 4 điểm P (TL,TR,BR,BL) => CSS matrix3d
  function matrix3d(P){
    const src = [[0,0],[FW,0],[FW,FH],[0,FH]], A = [], B = [];
    for(let i=0;i<4;i++){
      const [x,y] = src[i], [u,v] = P[i];
      A.push([x,y,1,0,0,0,-u*x,-u*y]); B.push(u);
      A.push([0,0,0,x,y,1,-v*x,-v*y]); B.push(v);
    }
    const n = 8;
    for(let i=0;i<n;i++){
      let m = i;
      for(let r=i+1;r<n;r++) if(Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
      [A[i],A[m]] = [A[m],A[i]]; [B[i],B[m]] = [B[m],B[i]];
      for(let r=i+1;r<n;r++){
        const f = A[r][i]/A[i][i];
        for(let c=i;c<n;c++) A[r][c] -= f*A[i][c];
        B[r] -= f*B[i];
      }
    }
    const h = new Array(n);
    for(let i=n-1;i>=0;i--){
      let s = B[i];
      for(let c=i+1;c<n;c++) s -= A[i][c]*h[c];
      h[i] = s/A[i][i];
    }
    const [a,b,c,d,e,f,g,hh] = h;
    return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
  }

  function update(zone){
    if(!frame) return;
    const nw=performance.now(), dtR=Math.min(0.1,(nw-(raceT||nw))/1000); raceT=nw; raceStep(dtR);
    if(zone !== lastZone){
      lastZone = zone;
      if(zone === 'plaza' && videoId) Scene3D.setScreenText(...PLAYING);
    }
    const pts = (zone === 'plaza' && videoId) ? Scene3D.screenCorners2D() : null;
    const w = pts ? Math.hypot(pts[1][0]-pts[0][0], pts[1][1]-pts[0][1]) : 0;
    if(!pts || w < 80){ frame.style.visibility = 'hidden'; return; }
    frame.style.visibility = 'visible';
    frame.style.transform = matrix3d(pts);
  }

  // ---------- Mini game ----------
  const MG = {
    memory: { name:'🃏 Lật hình', fee:5, start(b, end){
      const E = ['🐶','🐱','🐸','🦊','🐼','🦁'], deck = [...E, ...E].sort(()=>Math.random()-.5);
      let open = [], moves = 0, done = 0, lock = false;
      b.innerHTML = '<div class="mg-info">Lật cặp giống nhau. Số lượt: <b id="mgMoves">0</b></div><div class="mg-grid"></div>';
      const grid = b.querySelector('.mg-grid');
      deck.forEach(e=>{
        const c = document.createElement('button'); c.className = 'mg-card'; c.textContent = '?';
        c.onclick = ()=>{
          if(lock || c.classList.contains('up')) return;
          c.classList.add('up'); c.textContent = e; open.push([c, e]);
          if(open.length < 2) return;
          moves++; b.querySelector('#mgMoves').textContent = moves;
          const [[c1,e1],[c2,e2]] = open; open = [];
          if(e1 === e2){ if(++done === 6) end(moves<=8 ? 40 : moves<=12 ? 25 : 12, `Xong sau ${moves} lượt!`); }
          else { lock = true; setTimeout(()=>{ [c1,c2].forEach(x=>{ x.classList.remove('up'); x.textContent = '?'; }); lock = false; }, 700); }
        };
        grid.appendChild(c);
      });
    }},
    timing: { name:'🎯 Canh nhịp', fee:5, start(b, end){
      b.innerHTML = '<div class="mg-info">Bấm DỪNG khi vạch vàng nằm trong vùng xanh!</div><div class="mg-bar"><div class="mg-zone"></div><div class="mg-mark"></div></div><button class="btn-primary btn-wide" id="mgStop">DỪNG</button>';
      const mark = b.querySelector('.mg-mark'), t0 = performance.now();
      let t = 0, stopped = false;
      const tick = now=>{
        if(stopped || $('gamePanel').classList.contains('hidden')) return;
        const ph = ((now - t0)/900) % 2; t = ph < 1 ? ph : 2 - ph;
        mark.style.left = (t*100) + '%'; requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      b.querySelector('#mgStop').onclick = ()=>{
        stopped = true; const d = Math.abs(t - .5);
        end(d < .04 ? 60 : d < .12 ? 25 : 0, d < .12 ? 'Trúng vùng xanh!' : 'Trượt rồi!');
      };
    }},
    guess: { name:'🔢 Đoán số', fee:5, start(b, end){
      const n = 1 + Math.floor(Math.random()*100); let left = 6;
      b.innerHTML = '<div class="mg-info">Đoán số từ 1 đến 100. Còn <b id="mgLeft">6</b> lượt.</div><input id="mgNum" type="number" min="1" max="100" class="mg-input"><button class="btn-primary btn-wide" id="mgGo">Đoán</button><div id="mgHint" class="mg-info"></div>';
      b.querySelector('#mgGo').onclick = ()=>{
        const v = +b.querySelector('#mgNum').value;
        if(!v || v < 1 || v > 100){ UI.toast('Nhập số từ 1 đến 100'); return; }
        left--; b.querySelector('#mgLeft').textContent = left;
        if(v === n) return end(10 + left*8, `Đúng rồi, số ${n}!`);
        if(!left) return end(0, `Hết lượt, số đúng là ${n}`);
        b.querySelector('#mgHint').textContent = v < n ? '⬆️ Số cần tìm lớn hơn' : '⬇️ Số cần tìm nhỏ hơn';
      };
    }},
  };

  function showGamePanel(title){
    document.querySelectorAll('.panel').forEach(p=>p.classList.add('hidden'));
    $('gamePanel').classList.remove('hidden'); $('gameTitle').textContent = title;
    return $('gameBody');
  }
  function openGame(id){
    const g = MG[id]; if(!g) return;
    if(player.coins < g.fee){ UI.toast(`Cần ${g.fee}🪙 để chơi`); return; }
    player.coins -= g.fee; UI.updateHUD(player);
    const body = showGamePanel(g.name);
    g.start(body, (reward, msg)=>{
      player.coins += reward; UI.updateHUD(player);
      body.innerHTML = `<div class="mg-result">${msg}<br>${reward ? '+' + reward + '🪙' : 'Chúc may mắn lần sau'}</div><button class="btn-primary btn-wide" id="mgAgain">Chơi lại (${g.fee}🪙)</button>`;
      $('mgAgain').onclick = ()=> openGame(id);
    });
  }
  function openMenu(){
    const body = showGamePanel('🎮 Mini game');
    body.innerHTML = Object.keys(MG).map(id=>`<button class="shop-item" data-g="${id}">${MG[id].name} — ${MG[id].fee}🪙</button>`).join('')
      + '<div class="mg-info">Hoặc đứng lên ô phát sáng trong công viên rồi bấm E.</div>';
    body.querySelectorAll('[data-g]').forEach(btn=> btn.onclick = ()=> openGame(btn.dataset.g));
  }

  function init(p){
    player = p; frame = $('tvFrame');
    frame.style.width = FW + 'px'; frame.style.height = FH + 'px';
    try { $('tvUrl').value = localStorage.getItem('gcity_yt') || ''; } catch(e){}
    $('tvPlay').onclick = ()=> playVideo($('tvUrl').value);
    $('tvStop').onclick = stopVideo;
  }

  return { init, update, openRace, openGame, openMenu, matrix3d, parseYT };
})();
