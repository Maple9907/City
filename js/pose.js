/* Trang kiểm tra tư thế (chỉ dùng khi phát triển) — tools/pose.html
 *
 * Bày các tư thế của nhân vật (nam + nữ) KÈM đồ vật thật: ghế đá, xe mui trần, máy bay, nền đất, để soát bằng mắt
 * xem gối có đúng góc, bàn chân có đặt phẳng, tay có nắm đúng vô-lăng / cần lái, cần câu có đúng tư thế không.
 *
 * Tham số URL:
 *   ?m=0..5        bộ nhân vật (0 = nhân vật đầu tiên mỗi giới). Mặc định 1
 *   ?only=a,b      chỉ vẽ các tư thế này (mặc định: tất cả). Tên: xem ACTS bên dưới
 *   ?view=side     side (nhìn ngang, mặt quay sang phải) | front | back | q3 (chéo 3/4)
 *   ?cols=N        số cột ô
 *   ?t=0.6         thời điểm đóng băng của hành động (giây); mặc định mỗi tư thế có sẵn một giá trị
 *   ?live=1        cho hoạt ảnh chạy thật (không đóng băng)
 *   ?steer=0.4 &pitch=0.3   góc lái / ngóc đầu khi ride-car / ride-plane
 * Mở qua http (npx serve .), không dùng file://.
 * Mọi số đo (góc gối, khoảng cách gối, góc khuỷu…) lấy ở window.__pose.measure(i); toạ độ khớp: window.__pose.joints(item).
 */
(async () => {
  const q = new URLSearchParams(location.search);
  const mi = q.has('m') ? Math.max(0, Math.min(5, Number(q.get('m')) || 0)) : 1;
  const view = q.get('view') || 'side';
  const live = q.get('live') === '1';
  const steerQ = q.has('steer') ? Number(q.get('steer')) : 0;
  const pitchQ = q.has('pitch') ? Number(q.get('pitch')) : 0;
  const tQ = q.has('t') ? Number(q.get('t')) : null;
  const SCALE = 0.58;                                  // đúng tỉ lệ nhân vật trong game (three-scene.js createCharacter)
  const VIEW_YAW = { side: Math.PI / 2, front: 0, back: Math.PI, q3: Math.PI / 4 }[view];

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x1b1d24, 1);
  document.body.style.margin = '0';
  document.body.style.background = '#1b1d24';
  document.body.style.overflow = 'hidden';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const dl = new THREE.DirectionalLight(0xfff2dd, 2.4); dl.position.set(-3, 7, 8); scene.add(dl);

  // ----- danh sách tư thế. Tham số thứ 3: đồ vật đi kèm (bench | car | plane) -----
  const ACTS = [
    ['idle',  {}], ['walk', { moving:true }], ['run', { moving:true, running:true }], ['jump', { action:'jump', actionT:0.42 }],
    ['sit',   { action:'sit', actionT:0.6 }, 'bench'], ['lotus', { action:'lotus', actionT:0.6 }],
    ['ride-car',   { action:'ride', rideMode:'car', vehicleSteer:steerQ, actionT:0.6 }, 'car'],
    ['ride-plane', { action:'ride', rideMode:'plane', vehicleSteer:steerQ, vehiclePitch:pitchQ, actionT:0.6 }, 'plane'],
    ['ride-ferris',{ action:'ride', rideMode:'ferris', actionT:0.6 }],
    ['rod-walk', { action:'rod', moving:true, lineOut:false, actionT:0.6 }],
    ['rod',   { action:'rod', lineOut:false, actionT:0.6 }],
    ['cast-prep', { action:'cast', actionT:0.30 }],
    ['cast',  { action:'cast', actionT:0.52 }],
    ['cast-end', { action:'cast', actionT:0.80 }],
    ['wait',  { action:'fish', lineOut:true, actionT:0.6 }],
    ['bite',  { action:'bite', lineOut:true, actionT:0.12 }],
    ['fight', { action:'reel', lineOut:true, actionT:0.35 }],
    ['fight2',{ action:'reel', lineOut:true, actionT:0.80 }],
    ['hoist', { action:'reel', lineOut:true, actionT:1.40 }],
    ['land',  { action:'reel', lineOut:true, actionT:1.95 }],
    ['win',   { action:'reel', lineOut:true, actionT:2.70 }]
  ];
  const only = q.get('only') ? q.get('only').split(',') : null;
  const acts = ACTS.filter(a => !only || only.indexOf(a[0]) >= 0);
  const GEN = ['male', 'female'];
  const nCells = acts.length * GEN.length;
  const COLS = Number(q.get('cols')) || Math.min(nCells, 4);
  const rows = Math.ceil(nCells / COLS);
  // kích thước ô thế giới theo tỉ lệ ô cửa sổ → ô lưới nhãn CSS khớp từng nhân vật (mặc định 3.6 × 3.0; có xe / máy bay: 5.4 × 3.9; ghi đè bằng ?cw=&ch=)
  const cellAsp = (innerWidth / COLS) / (innerHeight / rows);
  const hasVeh = acts.some(a => a[2] === 'car' || a[2] === 'plane');
  let CW = Number(q.get('cw')) || (hasVeh ? 5.4 : 3.6), CH = Number(q.get('ch')) || (hasVeh ? 3.9 : 3.0);
  if(cellAsp >= CW / CH) CW = CH * cellAsp; else CH = CW / cellAsp;

  const grid = document.createElement('div');
  grid.style.cssText = `position:fixed;inset:0;display:grid;grid-template-columns:repeat(${COLS},1fr);grid-template-rows:repeat(${rows},1fr);pointer-events:none;font:12px/1.3 system-ui,sans-serif;color:#9aa3b8`;
  acts.forEach(([name]) => GEN.forEach(gender => {
    const d = document.createElement('div');
    d.textContent = name + ' · ' + gender;
    d.style.cssText = 'padding:6px 8px;border:1px solid #2a2e3a;box-sizing:border-box';
    grid.appendChild(d);
  }));
  document.body.appendChild(grid);

  // camera trực giao khớp đúng lưới ô
  const cam = new THREE.OrthographicCamera(-COLS * CW / 2, COLS * CW / 2, rows * CH / 2, -rows * CH / 2, 0.1, 400);
  cam.position.set(0, 0, 60); cam.lookAt(0, 0, 0);
  renderer.setSize(innerWidth, innerHeight);
  addEventListener('resize', () => location.reload());

  try { await window.GLBLibs; } catch (e) {}
  if(!q.has('noglb')){ try { await GLBChar.preload(); } catch (e) {} }   // ?noglb=1: thử đường dựng nhân vật dự phòng (khối hộp)

  // ----- đồ vật -----
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  function makeBench(){                                // giống hệt ghế trong js/three-scene.js
    const bench = new THREE.Group(), wd = lam(0xb06a35), mt = lam(0x2f4a3a);
    const bx = (w, h, d, x, y, zz, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, zz); bench.add(o); };
    bx(2, 0.09, 0.55, 0, 0.185, 0.05, wd); bx(2, 0.08, 0.1, 0, 0.42, -0.22, wd); bx(2, 0.08, 0.1, 0, 0.56, -0.22, wd);
    [-0.9, 0.9].forEach(x => { bx(0.1, 0.33, 0.55, x, 0.065, 0, mt); bx(0.1, 0.52, 0.1, x, 0.30, -0.22, mt); bx(0.1, 0.07, 0.6, x, 0.32, 0, mt); });
    bench.position.y = 0.1; return bench;
  }
  // làm mờ đồ vật để thấy chân / tay nhân vật đằng sau thành ghế, thành xe (?ghost=1 để vẽ đặc)
  const ghostA = q.has('ghost') ? Number(q.get('ghost')) : 0.38;
  const solidPart = m => { for(let o = m; o; o = o.parent) if(o.name === 'steering' || o.name === 'yoke') return true; return false; };   // vô-lăng / yoke luôn vẽ đặc
  const ghost = o => { if(ghostA >= 1) return o; o.traverse(m => { if(m.isMesh && !solidPart(m)){ m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = ghostA; m.material.depthWrite = false; } }); return o; };
  const groundMat = lam(0x5d6b4f);
  const makeGround = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(CW * 0.9, 0.04, CW * 0.9), groundMat); m.position.y = -0.02; return m; };

  const items = [];
  let ci = 0;
  acts.forEach(([name, ud0, prop]) => GEN.forEach(gender => {
    const col = ci % COLS, row = (ci / COLS) | 0; ci++;
    const cx = (col - (COLS - 1) / 2) * CW, cy = ((rows - 1) / 2 - row) * CH - CH / 2 + 0.45;   // cy = mặt đất của ô
    const root = new THREE.Group(); root.position.set(cx, cy, 0); scene.add(root);
    const content = new THREE.Group(); content.rotation.y = VIEW_YAW; root.add(content);           // xoay cả ô để chọn góc nhìn
    content.add(makeGround());
    const b = GChar.build(gender, mi);
    b.group.scale.setScalar(SCALE);
    const ud = b.group.userData;
    ud.parts = b.parts; ud.walkT = 0; ud.mv = 0; ud.face = 0; ud.yaw = 0; ud.action = null; ud.actionT = 0;
    Object.assign(ud, ud0);
    content.add(b.group);
    const it = { name, gender, root, content, group: b.group, ud0, prop: prop || null, idx: items.length, seat: null };
    if(prop === 'bench') content.add(ghost(makeBench()));
    if(prop === 'car' || prop === 'plane'){
      const v = Vehicles.build(prop, prop === 'car' ? 0xe85c5c : 0x2fa5b5);
      const st = v.userData.seat, alt = prop === 'plane' ? 0.03 : 0;
      v.position.set(-st.x, alt, -st.z); content.add(ghost(v));        // xe đặt sao cho ghế trùng gốc ô (nhân vật đứng ở gốc)
      it.seat = { y: alt + st.y - 0.6 }; it.vehicle = v;       // cùng công thức seatWorld() trong js/game.js
    }
    items.push(it);
  }));

  // ----- số đo -----
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  const wp = (o, g) => { const v = new THREE.Vector3(); o.updateWorldMatrix(true, false); v.setFromMatrixPosition(o.matrixWorld); return g.worldToLocal(v); };
  function joints(it){
    const g = it.group, p = g.userData.parts; g.updateMatrixWorld(true);
    const J = {};
    const lr = b => wp(b, g).x < 0 ? 'L' : 'R';                    // trái/phải theo vị trí thật trong hệ nhân vật (pivot 'L' ở -X)
    if(p.glb){
      const B = p.glb.bones;
      [['upLegL','lowLegL','footL','toeL'], ['upLegR','lowLegR','footR','toeR']].forEach(ks => {
        const s = lr(B[ks[0]]);
        J['hip' + s] = wp(B[ks[0]], g); J['knee' + s] = wp(B[ks[1]], g); J['ankle' + s] = wp(B[ks[2]], g);
        if(B[ks[3]]) J['toe' + s] = wp(B[ks[3]], g);
      });
      [['upperArmL','foreArmL','handL'], ['upperArmR','foreArmR','handR']].forEach(ks => {
        const s = lr(B[ks[0]]);
        J['shoulder' + s] = wp(B[ks[0]], g); J['elbow' + s] = wp(B[ks[1]], g); J['wrist' + s] = wp(B[ks[2]], g);
      });
      J.head = wp(B.head, g); J.hips = wp(B.hips, g);
    } else {
      ['L','R'].forEach(s => {
        J['hip' + s] = wp(p['leg' + s], g); J['knee' + s] = wp(p['shin' + s], g);
        J['ankle' + s] = g.worldToLocal(p['shin' + s].localToWorld(new THREE.Vector3(0, -0.5, 0)));
        J['shoulder' + s] = wp(p['arm' + s], g); J['elbow' + s] = wp(p['fore' + s], g);
        J['wrist' + s] = g.worldToLocal(p['fore' + s].localToWorld(new THREE.Vector3(0, -0.58, 0.02)));
      });
      J.head = wp(p.head, g); J.hips = wp(p.body, g);
    }
    return J;
  }
  const ang = (a, b, c) => { const u = _v.copy(a).sub(b), v = _w.copy(c).sub(b); return Math.acos(Math.max(-1, Math.min(1, u.dot(v) / (u.length() * v.length() + 1e-9)))) * 180 / Math.PI; };
  const r3 = n => +n.toFixed(3);
  function measure(i){
    const it = items[i], J = joints(it), r = {}; const d = (a, b) => r3(J[a].distanceTo(J[b]));
    ['L','R'].forEach(s => {
      r['knee' + s] = +ang(J['hip' + s], J['knee' + s], J['ankle' + s]).toFixed(1);
      r['elbow' + s] = +ang(J['shoulder' + s], J['elbow' + s], J['wrist' + s]).toFixed(1);
    });
    r.hipW = d('hipL', 'hipR'); r.kneeW = d('kneeL', 'kneeR'); r.ankleW = d('ankleL', 'ankleR'); r.shoulderW = d('shoulderL', 'shoulderR');
    r.upperArm = d('shoulderL', 'elbowL'); r.foreArm = d('elbowL', 'wristL'); r.thigh = d('hipL', 'kneeL'); r.shin = d('kneeL', 'ankleL');
    const g = it.group, Wy = v => r3(g.localToWorld(v.clone()).y - it.root.position.y);   // độ cao thế giới so với mặt đất ô
    r.ankleY = [Wy(J.ankleL), Wy(J.ankleR)]; r.kneeY = [Wy(J.kneeL), Wy(J.kneeR)]; r.hipY = [Wy(J.hipL), Wy(J.hipR)];
    if(J.toeL) r.toeY = [Wy(J.toeL), Wy(J.toeR)];
    return r;
  }
  window.__pose = { scene, renderer, cam, items, joints, measure, THREE };

  // ----- vòng lặp -----
  function step(it, dt, t){
    const g = it.group, ud = g.userData, a = it.ud0.action;
    if(!live){
      if(it.ud0.actionT !== undefined) ud.actionT = (tQ !== null ? tQ : it.ud0.actionT) - dt;
      if(it.ud0.moving){ ud.mv = 1; ud.walkT = 1.1 - (it.ud0.running ? 12.2 : 8.4) * dt; }
    }
    if(it.vehicle) Vehicles.animate(it.vehicle, it.prop, Number(ud.vehicleSteer) || 0, Number(ud.vehiclePitch) || 0);
    GChar.update(g, dt, t);
    // game.js đặt lại vị trí SAU update: ngồi trên xe / máy bay → hông đúng mặt ghế
    if(it.seat){ g.position.set(0, it.seat.y, g.userData.rideShift || 0); }
    else if(a === 'jump') g.position.y += 1.0;
  }
  let last = performance.now();
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    items.forEach(it => step(it, live ? dt : 0.016, live ? now / 1000 : 3.7));
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  };
  for(let k = 0; k < 24; k++) items.forEach(it => step(it, 0.016, 3.7));      // chạy trước vài khung: hoàn tất trộn tư thế + đồng bộ xương GLB
  requestAnimationFrame(frame);
  window.__poseReady = true;
})();
