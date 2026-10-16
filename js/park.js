/* ===== GCITY Park: màn hình lớn chiếu YouTube + mini game =====
 * - Video YouTube là iframe HTML, được "dán" lên màn hình 3D bằng CSS matrix3d (homography
 *   từ 4 góc màn hình đã project ra màn hình 2D) nên xoay camera video vẫn bám theo.
 * - Mini game: Lật hình (phí 5🪙), Đánh lô (tự đặt xu, 10 giải quay độc lập).
 */
const Park = (() => {
  const $ = id => document.getElementById(id);
  const FW = 960, FH = 540;
  let player = null, frame = null, videoId = null, lastZone = null;

  // ---------- Trường đua thú: 7 bạn thú · cược 1 ăn 6 · mở vé 30s -> đua ~10s -> kết quả 7s ----------
  const AN=['🐎 Ngựa Đỏ','🐕 Chó Xanh','🐇 Thỏ Vàng','🐢 Rùa Tím','🦊 Cáo Cam','🐖 Heo Hồng','🐸 Ếch Xanh Lá'], N=AN.length, MULT=6;
  const RC={id:206453,ph:'open',t:30,tk:null,p:AN.map(()=>0),v:[],w:-1,fee:10,acc:0};
  const dot = i => `<span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${Animals.LANE_CSS[i]};margin-right:6px;border:1px solid #fff6"></span>`;
  let raceT = 0;
  function raceStep(dt){
    RC.t -= dt;
    if(RC.ph==='open' && RC.t<=0){ RC.ph='run'; RC.p=AN.map(()=>0); RC.v=AN.map(()=>.085+Math.random()*.05); RC.t=0; }
    else if(RC.ph==='run'){
      RC.t += dt; AN.forEach((_,i)=>{ RC.p[i] += (RC.v[i] + Math.sin(RC.t*2+i*2)*.02)*dt; });
      const m = Math.max(...RC.p);
      if(m>=1){ RC.w=RC.p.indexOf(m); RC.ph='end'; RC.t=7;
        if(RC.tk===RC.w){ const win=Math.round(RC.fee*MULT); player.coins+=win; UI.updateHUD(player); UI.toast(`🎉 Trúng vé đua! +${win}🪙`); }
        else if(RC.tk!==null) UI.toast('Vé đua không trúng, chúc may mắn!'); }
    }
    else if(RC.ph==='end' && RC.t<=0){ RC.ph='open'; RC.t=30; RC.id++; RC.tk=null; RC.p=AN.map(()=>0); RC.w=-1; }
    RC.acc += dt;
    if(RC.acc>=.5){ RC.acc=0;
      const st = RC.ph==='open' ? `Đang mở vé ${Math.ceil(RC.t)} giây` : RC.ph==='run' ? 'Đang đua!' : `Thắng: ${AN[RC.w]}`;
      Scene3D.setRaceBoard(`Sơ Cấp · Phiên #${RC.id} · 7 thú · 1 ăn ${MULT}`,'VÉ CỦA BẠN', RC.tk===null ? 'Chưa mua vé phiên này' : AN[RC.tk],'TRẠNG THÁI',st); }
    Scene3D.setRacers(RC.p, RC.ph==='run', RC.ph==='end' ? RC.w : -1);
  }
  function openRace(){
    const b = showGamePanel('🎟 Trường đua thú');
    if(RC.ph!=='open'){ b.innerHTML = `<div class="mg-info">${RC.ph==='run' ? 'Đang đua, chờ phiên sau để mua vé.' : 'Phiên đã kết thúc, chờ phiên mới.'}</div>`; return; }
    if(RC.tk!==null){ b.innerHTML = `<div class="mg-info">Vé của bạn: ${dot(RC.tk)}${RC.tk+1}. ${AN[RC.tk]} (phiên #${RC.id}). Về nhất nhận x${MULT}.</div>`; return; }
    b.innerHTML = AN.map((n,i)=>`<button class="shop-item" data-a="${i}">${dot(i)}${i+1}. ${n} — ${RC.fee}🪙</button>`).join('') + `<div class="mg-info">Chọn một trong 7 bạn thú, về nhất ăn x${MULT} tiền vé (cược 1 ăn ${MULT}).</div>`;
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
    Scene3D.setScreenText('GCITY TV', 'Chạm NPC 📺 cạnh sân khấu để chọn video');
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
    lo: { name:'🎟 Đánh lô', fee:0, custom:true, start(b){ loStart(b); } },
  };

  // ---------- Đánh lô ----------
  // Chọn số 01–99 + đặt xu -> bấm "Kết quả": 10 giải quay lần lượt, mỗi giải là một lần quay ĐỘC LẬP (có thể trùng số giữa các giải).
  // Mỗi giải trùng số đã chọn => thưởng x10 tiền đặt; trúng nhiều giải thì cộng dồn (2 giải = x20, 3 giải = x30, ...).
  const LO = { PRIZES:10, MULT:10, MAX:10000000000, pick:1, bet:10000, busy:false, res:[], shown:0, body:null, summary:'' };
  const nf  = n => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const two = n => String(n).padStart(2, '0');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const loQ = sel => (LO.body && LO.body.isConnected) ? LO.body.querySelector(sel) : null;   // panel đóng/mở lại giữa chừng vẫn an toàn
  function loBalance(){ const el = loQ('#loBal'); if(el) el.textContent = nf(player.coins) + ' xu'; }
  function loLock(on){
    ['#loPick', '#loBet', '#loGo'].forEach(s => { const el = loQ(s); if(el) el.disabled = on; });
    const go = loQ('#loGo'); if(go) go.textContent = on ? 'Đang quay…' : 'Kết quả';
  }
  function loStart(body){
    if(!LO.busy) LO.bet = Math.max(1, Math.min(LO.bet, Math.floor(player.coins) || 1));
    LO.body = body;
    body.innerHTML = `
      <div class="lo-bal"><span>Số dư</span><b id="loBal">${nf(player.coins)} xu</b></div>
      <div class="lo-rule">Số 01–99 · ${LO.PRIZES} giải · Thưởng ×${LO.MULT}/giải trúng</div>
      <div class="lo-row">
        <label>Số chọn<input id="loPick" class="mg-input" inputmode="numeric" maxlength="2" value="${LO.pick}"></label>
        <label>Đặt xu<input id="loBet" class="mg-input" inputmode="numeric" value="${LO.bet}"></label>
      </div>
      <div class="lo-rule">Tối đa ${nf(LO.MAX)} xu/lượt.</div>
      <button class="btn-primary btn-wide" id="loGo">Kết quả</button>
      <div class="lo-rule" id="loSum">${LO.summary}</div>
      <div class="lo-title">Kết quả quay số</div>
      <div class="lo-grid">${Array.from({length:LO.PRIZES}, (_, i) => `<div class="lo-box" id="loB${i}"><small>Giải ${i+1}</small><b>··</b></div>`).join('')}</div>`;
    body.querySelectorAll('#loPick, #loBet').forEach(inp => inp.oninput = () => { inp.value = inp.value.replace(/\D/g, ''); });
    // dựng lại các giải đã quay (nếu mở lại panel khi đang quay / sau khi quay xong)
    LO.res.slice(0, LO.shown).forEach((v, i) => {
      const el = body.querySelector('#loB' + i); el.lastChild.textContent = two(v); el.classList.toggle('hit', v === LO.pick);
    });
    if(LO.busy) loLock(true);
    body.querySelector('#loGo').onclick = () => {
      if(LO.busy) return;
      const pick = parseInt(loQ('#loPick').value, 10), bet = parseInt(loQ('#loBet').value, 10);
      if(!(pick >= 1 && pick <= 99)){ UI.toast('Chọn số từ 01 đến 99'); return; }
      if(!(bet >= 1)){ UI.toast('Nhập số xu muốn đặt'); return; }
      if(bet > LO.MAX){ UI.toast(`Tối đa ${nf(LO.MAX)} xu/lượt`); return; }
      if(bet > player.coins){ UI.toast('Không đủ xu!'); return; }
      LO.pick = pick; LO.bet = bet; loSpin();
    };
  }
  async function loSpin(){
    const pick = LO.pick, bet = LO.bet;
    LO.busy = true; LO.shown = 0; LO.summary = '';
    LO.res = Array.from({length:LO.PRIZES}, () => 1 + Math.floor(Math.random() * 99));   // mỗi giải một lần random riêng
    player.coins -= bet; UI.updateHUD(player); loBalance(); loLock(true);
    for(let i = 0; i < LO.PRIZES; i++){ const el = loQ('#loB' + i); if(el){ el.className = 'lo-box'; el.lastChild.textContent = '··'; } }
    const sum = t => { LO.summary = t; const el = loQ('#loSum'); if(el) el.textContent = t; };
    sum('Đang quay…');
    let hits = 0;
    for(let i = 0; i < LO.PRIZES; i++){          // quay lần lượt từng giải
      const t0 = performance.now();
      while(performance.now() - t0 < 450){
        const el = loQ('#loB' + i); if(el){ el.classList.add('spin'); el.lastChild.textContent = two(1 + Math.floor(Math.random() * 99)); }
        await wait(55);
      }
      const v = LO.res[i], hit = v === pick; if(hit) hits++;
      LO.shown = i + 1;
      const el = loQ('#loB' + i); if(el){ el.classList.remove('spin'); el.classList.toggle('hit', hit); el.lastChild.textContent = two(v); }
      if(hits) sum(`Trúng ${hits} giải → ×${hits * LO.MULT}`);
      await wait(120);
    }
    const win = bet * LO.MULT * hits;
    player.coins += win; UI.updateHUD(player); loBalance();
    LO.busy = false; loLock(false);
    if(hits){ sum(`🎉 Trúng ${hits} giải (×${hits * LO.MULT}) → +${nf(win)} xu`); UI.toast(`🎉 Đánh lô trúng ${hits} giải! +${nf(win)} xu`); }
    else { sum(`Trượt rồi, mất ${nf(bet)} xu`); UI.toast('Đánh lô trượt, chúc may mắn lần sau!'); }
  }

  function showGamePanel(title){
    document.querySelectorAll('.panel').forEach(p=>p.classList.add('hidden'));
    $('gamePanel').classList.remove('hidden'); $('gameTitle').textContent = title;
    return $('gameBody');
  }
  function openGame(id){
    const g = MG[id]; if(!g) return;
    if(g.custom){ g.start(showGamePanel(g.name)); return; }
    if(player.coins < g.fee){ UI.toast(`Cần ${g.fee}🪙 để chơi`); return; }
    player.coins -= g.fee; UI.updateHUD(player);
    const body = showGamePanel(g.name);
    g.start(body, (reward, msg)=>{
      player.coins += reward; UI.updateHUD(player);
      body.innerHTML = `<div class="mg-result">${msg}<br>${reward ? '+' + reward + '🪙' : 'Chúc may mắn lần sau'}</div><button class="btn-primary btn-wide" id="mgAgain">Chơi lại (${g.fee}🪙)</button>`;
      $('mgAgain').onclick = ()=> openGame(id);
    });
  }
  function init(p){
    player = p; frame = $('tvFrame');
    frame.style.width = FW + 'px'; frame.style.height = FH + 'px';
    try { $('tvUrl').value = localStorage.getItem('gcity_yt') || ''; } catch(e){}
    $('tvPlay').onclick = ()=> playVideo($('tvUrl').value);
    $('tvStop').onclick = stopVideo;
  }

  return { init, update, openRace, openGame, matrix3d, parseYT };
})();
