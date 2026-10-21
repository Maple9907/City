/* Trang kiểm tra tư thế (chỉ dùng khi phát triển).
 * Bày cùng lúc 12 tư thế × nam/nữ để soát dáng tay, chân, cần câu, vô-lăng, cần lái.
 * Mở: tools/pose.html   ·   đổi bộ model: tools/pose.html?m=2   (phải chạy qua http, không dùng file://)
 */
(async () => {
  const q = new URLSearchParams(location.search);
  const mi = Math.max(0, Math.min(5, Number(q.get('m')) || 1));
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  document.body.style.margin = '0';
  document.body.style.background = '#1b1d24';
  document.body.style.overflow = 'hidden';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 2.6));
  const dl = new THREE.DirectionalLight(0xfff2dd, 2.2); dl.position.set(2, 6, 9); scene.add(dl);

  const ACTS = [
    ['idle', {}], ['walk', { moving:true }], ['run', { moving:true, running:true }], ['jump', { action:'jump', actionT:0.42 }],
    ['sit', { action:'sit', actionT:0.6 }], ['lotus', { action:'lotus', actionT:0.6 }],
    ['ride-car', { action:'ride', rideMode:'car', vehicleSteer:0, actionT:0.6 }],
    ['ride-plane', { action:'ride', rideMode:'plane', vehicleSteer:0.4, actionT:0.6 }],
    ['ride-ferris', { action:'ride', rideMode:'ferris', actionT:0.6 }],
    ['rod', { action:'rod', lineOut:false, actionT:0.6 }],
    ['cast', { action:'cast', actionT:0.6 }],
    ['reel', { action:'reel', lineOut:true, actionT:0.5, fishTarget:{ x:0, z:3 } }]
  ];
  const COLS = 4, CW = 3.6, CH = 5.0;
  const rows = Math.ceil(ACTS.length / COLS);

  const grid = document.createElement('div');
  grid.style.cssText = `position:fixed;inset:0;display:grid;grid-template-columns:repeat(${COLS},${CW}fr);grid-template-rows:repeat(${rows},1fr);pointer-events:none;font:12px/1.3 system-ui,sans-serif;color:#9aa3b8`;
  ACTS.forEach(([name]) => {
    const d = document.createElement('div');
    d.textContent = name;
    d.style.cssText = 'padding:6px 8px;text-transform:none';
    grid.appendChild(d);
  });
  document.body.appendChild(grid);

  const cam = new THREE.OrthographicCamera(-COLS * CW / 2, COLS * CW / 2, rows * CH / 2, -rows * CH / 2, 0.1, 300);
  cam.position.set(0, 0, 60);
  const fit = () => {
    renderer.setSize(innerWidth, innerHeight);
    cam.zoom = Math.min(innerWidth / (COLS * CW), innerHeight / (rows * CH));
    cam.updateProjectionMatrix();
  };
  addEventListener('resize', fit); fit();

  try { await window.GLBLibs; } catch (e) {}
  try { await GLBChar.preload(); } catch (e) {}

  const items = [];
  ACTS.forEach(([name, ud0], i) => {
    const col = i % COLS, row = (i / COLS) | 0;
    const cx = (col - (COLS - 1) / 2) * CW, cy = ((rows - 1) / 2 - row) * CH;
    [['male', -0.75], ['female', 0.75]].forEach(([gender, off]) => {
      const b = GChar.build(gender, mi);
      const ud = b.group.userData;
      ud.parts = b.parts; ud.walkT = 0; ud.mv = 0; ud.face = 0; ud.yaw = 0;
      Object.assign(ud, ud0);
      b.group.position.set(cx + off, cy - 2.1, 0);
      scene.add(b.group);
      items.push({ group: b.group, base: b.group.position.y, act: ud0.action || null });
    });
  });
  window.__poseReady = true;

  const loop = now => {
    const t = now / 1000;
    items.forEach(it => {
      GChar.update(it.group, 0.016, t);
      // giữ nhân vật trong ô: pose có thể tự ghi position.y (nhảy / xếp bằng) → cộng lại gốc ô
      if(it.act === 'jump') it.group.position.y += it.base + 2.1;
      else it.group.position.y = it.base;
    });
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
