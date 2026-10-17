/* ===== GCITY - Đảo câu cá (dựng lại theo ảnh mẫu) =====
 * Đảo cát hình hạt nhân + vòng cỏ + lối đất, rừng cọ, bụi, đá, quầy cá lợp lá,
 * dù + ghế bãi biển, đèn lồng, cầu gỗ có tàu neo, vài đảo nhỏ lơ lửng trên biển.
 * Toàn bộ vẽ bằng hình khối nguyên thủy (không asset ngoài), gộp nhiều khối thành 1 mesh
 * để giữ draw call thấp trên điện thoại.
 *
 * API:  const isle = Island.create();  worldGroup.add(isle.group);  isle.update(time_giây);
 *       Island.walkable(x, z)  → true nếu đứng được (trên cát/cỏ/cầu)
 *       Island.dockY(x, z)     → độ cao mặt cầu gỗ (0 nếu không ở trên cầu)
 *       Fish quanh bờ (Island.fishSpots) dùng cho NPC + kiểm tra "đang ở chỗ câu cá"
 */
const Island = (() => {
  // ===== Hình dáng đảo: bán kính mép cát theo góc (dao động nhẹ cho mép tự nhiên) =====
  const CX = 0, CZ = 0, RX = 30, RZ = 21, BEACH = 5.6;
  const wob = a => 1 + 0.085*Math.sin(a + 0.7) + 0.055*Math.sin(2*a + 1.9)
                   + 0.038*Math.sin(3*a - 0.6) + 0.026*Math.sin(5*a + 2.4);
  const sandEdge = a => { const k = wob(a); return { x: CX + RX*k*Math.cos(a), z: CZ + RZ*k*Math.sin(a) }; };
  const grassEdge = a => { const k = wob(a); return { x: CX + (RX-BEACH)*k*Math.cos(a), z: CZ + (RZ-BEACH)*k*Math.sin(a) }; };
  const seaEdge  = a => { const k = wob(a); return { x: CX + (RX+4.2)*k*Math.cos(a), z: CZ + (RZ+4.2)*k*Math.sin(a) }; };
  // Bán kính quy chuẩn hoá: 1 = đúng mép cát
  const norm = (x, z) => Math.hypot((x-CX)/RX, (z-CZ)/RZ);
  const onIsland = (x, z, m = 0) => {
    const dx = (x-CX)/RX, dz = (z-CZ)/RZ, r = Math.hypot(dx, dz);
    return r <= wob(Math.atan2(dz, dx)) - m/RX;
  };
  // ===== Cầu gỗ: lối hẹp từ bờ bắc đi ra biển + bãi đỗ hình chữ T ở cuối =====
  const PIER = { x0: 0, z0: 15.0, z1: 43.5, halfW: 2.0, platZ0: 41.5, platZ1: 47.5, platHalf: 5.6, y: 0.62 };
  const onPier = (x, z, m = 0) => {
    if (Math.abs(x - PIER.x0) < PIER.halfW + m && z > PIER.z0 - m && z < PIER.z1 + m) return true;                 // lối đi
    if (Math.abs(x - PIER.x0) < PIER.platHalf + m && z > PIER.platZ0 - m && z < PIER.platZ1 + m) return true;      // bãi T
    return false;
  };
  const walkable = (x, z) => onIsland(x, z) || onPier(x, z);
  const dockY = (x, z) => (onPier(x, z) ? PIER.y : 0);

  // ===== Chỗ câu cá quanh bờ (NPC đứng câu + người chơi tới câu) =====
  const faceOut = (x, z)=>{ const l = Math.hypot(x, z) || 1; return Math.atan2(x/l, z/l); };
  const fishSpots = [
    { x: -13.5, z: 14.2, face: faceOut(-13.5, 14.2) },
    { x: -2.0,  z: 17.6, face: faceOut(-2.0, 17.6) },
    { x:  10.5, z: 14.0, face: faceOut(10.5, 14.0) },
    { x:  19.0, z:  2.0, face: faceOut(19.0, 2.0) },
    { x: -18.5, z:  3.5, face: faceOut(-18.5, 3.5) },
  ];
  const PIER_SPOT = { x: PIER.x0, z: PIER.z1 - 2.4, face: 0 };

  // Cây cọ quanh vành cỏ (dùng cho cả dựng hình lẫn va chạm)
  const PALM_AT = [
    [22.5, -4.5, 1.05], [17.5, -10.5, 0.9], [6, -12.5, 1.0], [-6.5, -13.5, 0.95], [-16.5, -11, 1.0], [-21.5, -2.5, 0.9],
    [-20, 7.5, 1.0], [-12, 12.5, 0.88], [2, 13.5, 0.95], [13.5, 11.5, 1.0], [21, 5.5, 0.92], [5.5, 8.5, 0.8],
    [-4.5, 8.5, 0.75], [17.5, 0.5, 0.72], [-2.5, -6.5, 0.7]
  ];
  // ===== Khu quầy cá / nghỉ chân (đặt ở bãi tây bắc) =====
  const HUT = { x: -15.5, z: -7.5, ry: 0.55 };

  // ===== Đảo nhỏ lơ lửng trên biển =====
  const ISLETS = [
    { x: 34, z: -22, r: 5.2, palms: 2 }, { x: -33, z: -26, r: 4.4, palms: 1 },
    { x: 26, z: 30, r: 3.8, palms: 1 },   { x: -14, z: 36, r: 3.2, palms: 1 },
  ];

  // ---------- tiện ích dựng hình ----------
  const TAU = Math.PI * 2;
  const shapeFrom = (fn, n = 72) => {
    const s = new THREE.Shape();
    for (let i = 0; i <= n; i++){ const p = fn(i / n * TAU); i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y); }
    return s;
  };
  function tex(draw, w = 256, h = 256){
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  // texture cát: nền cát + lấm tối/sáng nhỏ
  const sandTex = () => tex((g, w, h) => {
    g.fillStyle = '#e2cb96'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++){
      g.fillStyle = i % 3 ? 'rgba(190,160,105,.30)' : 'rgba(255,246,214,.35)';
      g.fillRect(Math.random()*w, Math.random()*h, 2, 2);
    }
  }, 256, 256);
  // texture cỏ: nền xanh + chấm cỏ tối/sáng
  const grassTex = () => tex((g, w, h) => {
    g.fillStyle = '#69a048'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++){
      g.fillStyle = i % 2 ? 'rgba(96,140,52,.45)' : 'rgba(140,178,80,.40)';
      g.fillRect(Math.random()*w, Math.random()*h, 3, 2);
    }
  }, 256, 256);
  // texture lá rơm cho mái quầy
  const thatchTex = () => tex((g, w, h) => {
    g.fillStyle = '#c9a45e'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < h; r += 9){
      g.fillStyle = r % 18 ? 'rgba(150,116,58,.55)' : 'rgba(214,183,120,.55)';
      g.fillRect(0, r, w, 5);
      g.fillStyle = 'rgba(110,84,42,.35)';
      for (let i = 0; i < 26; i++) g.fillRect(Math.random()*w, r, 2, 9);
    }
  }, 256, 256);
  // dù: nón lá có sọc (canvas wedge)
  const stripeTex = (a, b, wedges = 8) => tex((g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < wedges; i++){
      g.fillStyle = i % 2 ? a : b;
      g.beginPath(); g.moveTo(w/2, h);
      g.arc(w/2, h, w, Math.PI + i/wedges*TAU, Math.PI + (i+1)/wedges*TAU);
      g.closePath(); g.fill();
    }
  }, 256, 256);

  // ===== Gộp khối (vertex color) — dùng cho cây / đá / bụi / gỗ, mỗi nhóm 1 mesh =====
  function Batch(mat){
    const pos = [], nor = [], col = [], idx = []; let vc = 0;
    const v = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color(), nm = new THREE.Matrix3(), m4 = new THREE.Matrix4();
    const api = {
      geo(g, m, hex){
        c.setHex(hex); nm.getNormalMatrix(m);
        const P = g.attributes.position, N = g.attributes.normal, I = g.index;
        for (let i = 0; i < P.count; i++){
          v.fromBufferAttribute(P, i).applyMatrix4(m); n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
          pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); col.push(c.r, c.g, c.b);
        }
        if (I) for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + vc); else for (let i = 0; i < P.count; i++) idx.push(i + vc);
        vc += P.count; return api;
      },
      box(w, h, d, x, y, z, hex, ry){ const mm = new THREE.Matrix4(); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0));
        mm.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h, d)); return api.geo(_box, mm, hex); },
      build(){
        if (!vc) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal',   new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(vc > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
        const mesh = new THREE.Mesh(g, mat); mesh.castShadow = mesh.receiveShadow = true; return mesh;
      }
    };
    return api;
  }
  const _box = new THREE.BoxGeometry(1, 1, 1);
  const _cyl6 = new THREE.CylinderGeometry(1, 1, 1, 6);
  const _cyl8 = new THREE.CylinderGeometry(1, 1, 1, 8);
  const _cyl12 = new THREE.CylinderGeometry(1, 1, 1, 12);
  const _ico0 = new THREE.IcosahedronGeometry(1, 0);
  const _sph = new THREE.SphereGeometry(1, 10, 7);
  const _cone6 = new THREE.ConeGeometry(1, 1, 6);
  const _M = () => new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _V = new THREE.Vector3(), _S = new THREE.Vector3();
  // đặt khối theo vị trí + xoay + tỉ lệ
  function put(B, geo, x, y, z, sx, sy, sz, hex, rx, ry, rz){
    _E.set(rx || 0, ry || 0, rz || 0, 'YXZ'); _Q.setFromEuler(_E);
    B.geo(geo, _M().compose(_V.set(x, y, z), _Q, _S.set(sx, sy, sz)), hex);
  }

  // ===== Lá cọ: dải quạt cong xuống, dựng bằng nhiều ô vuông (mỗi lá ~8 ô) =====
  function frondGeo(len, droop, wide){
    const seg = 8, pos = [], nor = [], idx = [];
    for (let i = 0; i <= seg; i++){
      const t = i / seg;
      const x = t * len;
      const y = Math.sin(t * 1.6) * len * 0.26 - droop * t * t * len * 1.15;   // vồng lên rồi rũ xuống
      const w = wide * Math.sin(Math.min(1, t * 1.15 + 0.10) * Math.PI) * (0.35 + 0.65*t);
      pos.push(x, y, -w, x, y, w);
      nor.push(0, 1, 0, 0, 1, 0);
      if (i < seg){ const a = i*2; idx.push(a, a+1, a+2, a+1, a+3, a+2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  const _fronds = [
    frondGeo(3.1, 0.52, 0.52), frondGeo(3.4, 0.40, 0.58), frondGeo(2.8, 0.60, 0.47), frondGeo(3.2, 0.46, 0.55),
    frondGeo(2.6, 0.66, 0.44)
  ];

  // ===== Cây cọ: thân cong 5 đoạn + 7-8 lá, quả dừa, gốc bùn =====
  const PALM_LEAF = [[0x3f8f3a, 0x4fa845, 0x2f7530], [0x37883a, 0x489c47, 0x2a6d2c], [0x4a9a3a, 0x5cb04a, 0x34762e]];
  function makePalm(B, x, z, s, seed, y0 = 0){
    const h = Math.abs(Math.sin(seed * 12.9898 + x * 78.233 + z * 37.719) * 43758.5453) % 1;
    const pal = PALM_LEAF[Math.floor(h * 3) % 3];
    const H = (4.6 + h * 2.0) * s, lean = (h - 0.5) * 0.9;
    // thân: 6 khối trụ lệch dần tạo độ cong
    let px = 0, pz = 0, py = y0;
    const N = 6;
    for (let i = 0; i < N; i++){
      const t = i / N, hgt = H / N, r = (0.27 - t * 0.12) * s;
      const nx = lean * t * t * s * 1.5, nz = lean * 0.4 * t * t * s * 1.2;
      put(B, _cyl6, x + (px+nx)/2, py + hgt/2, z + (pz+nz)/2, r, hgt * 1.04, r, i % 2 ? 0x8a6238 : 0x7a5530, 0, 0, (lean*0.35));
      px = nx; pz = nz; py += hgt;
    }
    // đọt lá + lá
    const tx = x + px, tz = z + pz, ty = py;
    put(B, _ico0, tx, ty + 0.10*s, tz, 0.36*s, 0.28*s, 0.36*s, pal[2]);
    const cnt = 9;                       // tán lá xoay vòng như ảnh mẫu
    for (let i = 0; i < cnt; i++){
      const a = i / cnt * TAU + h * 3, gg = _fronds[i % _fronds.length];
      const tilt = -0.30 - (i % 3) * 0.16;   // lá ngoài rủ thấp hơn lá trong
      B.geo(gg, _M().compose(_V.set(tx, ty + 0.14*s, tz),
        _Q.setFromEuler(_E.set(tilt, a, (i % 2 ? 0.10 : -0.10), 'YXZ')), _S.set(s, s, s)), pal[i % 3]);
    }
    // 2-3 quả dừa
    if (h > 0.35){ for (let i = 0; i < 3; i++){
      const a = h * 7 + i * 2.1;
      put(B, _sph, tx + Math.cos(a)*0.24*s, ty - 0.12*s, tz + Math.sin(a)*0.24*s, 0.15*s, 0.17*s, 0.15*s, 0x8a6a35);
    } }
    // gốc: vòng cát úp + cỏ mọc quanh
    put(B, _cyl12, x, y0 + 0.06*s, z, 0.42*s, 0.12*s, 0.42*s, 0xdcbf85);
  }

  // ===== Đảo nhỏ: cát + cọ + đá, lơ lửng trên biển =====
  function makeIslet(group, it, idx){
    const B = Batch(new THREE.MeshLambertMaterial({ vertexColors: true }));
    const g = new THREE.CircleGeometry(it.r, 20);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: sandTex() }));
    m.rotation.x = -Math.PI / 2; m.position.set(it.x, 0.12, it.z); m.receiveShadow = true;
    const gg = new THREE.Mesh(new THREE.CircleGeometry(it.r * 0.62, 18), new THREE.MeshLambertMaterial({ map: grassTex() }));
    gg.rotation.x = -Math.PI / 2; gg.position.set(it.x, 0.14, it.z);
    group.add(m); group.add(gg);
    const r2 = it.r * 0.55;
    for (let i = 0; i < it.palms; i++){
      const a = i / Math.max(1, it.palms) * TAU + idx;
      makePalm(B, it.x + Math.cos(a) * r2 * 0.6, it.z + Math.sin(a) * r2 * 0.6, 0.5 + (i % 2) * 0.12, idx * 3 + i, 0.14);
    }
    for (let i = 0; i < 4; i++){
      const a = i * 1.7 + idx;
      put(B, _ico0, it.x + Math.cos(a) * it.r * 0.85, 0.2, it.z + Math.sin(a) * it.r * 0.85, 0.32, 0.2, 0.32, 0x9aa7ab);
    }
    const bm = B.build(); if (bm) group.add(bm);
  }

  // ===== Quầy cá: gỗ + mái lá + quầy hồng phơi sáng + phao cứu sinh + biển cá =====
  function makeHut(night){
    const group = new THREE.Group();          // nhóm riêng của quầy cá (không dính vào group của đảo)
    const W = 7.6, D = 5.6, H = 3.0;
    const B = Batch(new THREE.MeshLambertMaterial({ vertexColors: true }));
    const wood = 0x8a5a32, wood2 = 0x9c6a3c, dark = 0x5c3a1e, post = 0x6f4522;
    // nền + sàn
    B.box(W + 1.0, 0.22, D + 0.9, 0, 0.11, 0, 0x7a5a38);
    B.box(W, 0.12, D, 0, 0.28, 0, 0xa87b4a);
    // 4 cột góc + tường gỗ (vân gỗ bằng các thanh dọc)
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => B.box(0.28, H, 0.28, sx*(W/2-0.1), 0.34 + H/2, sz*(D/2-0.1), post));
    for (let i = 0; i < 9; i++){ const zz = -D/2 + 0.28 + i * ((D - 0.56) / 8);
      B.box(W - 0.3, H - 0.3, 0.12, 0, 0.34 + (H-0.3)/2, zz, i % 2 ? wood : wood2); }
    // vách sau + 2 bên (mặt trước để hở làm quầy)
    B.box(W - 0.3, H - 0.3, 0.12, 0, 0.34 + (H-0.3)/2, -D/2 + 0.06, 0x7a4f2b);
    [[-1,1]].forEach(([sx]) => { for (let i = 0; i < 6; i++){
      const xx = sx * (-W/2 + 0.55 + i * ((W - 1.1) / 5));
      B.box(0.12, H - 0.3, D - 0.3, xx, 0.34 + (H-0.3)/2, 0, i % 2 ? wood2 : wood);
    } });
    // quầy hồng phơi: mặt trước thấp (không kín), 1 thanh ngang trên + đống cá
    B.box(W - 0.3, 0.2, 0.2, 0, 0.34 + H - 0.5, D/2 - 0.1, 0x6f4522);
    B.box(W - 0.5, 0.55, 0.9, 0, 0.6, D/2 - 0.55, 0xc9a05e);       // mặt quầy gỗ sáng
    B.box(W - 0.5, 0.12, 0.95, 0, 0.92, D/2 - 0.55, 0xe8d3a0);      // mặt quầy sáng
    // tấm phát sáng xanh (mảnh ngọc) — sáng mạnh lên ban đêm
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x2ad6e8 });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(W - 0.8, 0.16, 0.06), glowMat);
    glow.position.set(0, 2.05, D/2 + 0.02); group.add(glow);
    // đèn tròn quầy + hộp vàng trên quầy
    put(B, _cyl8, -W/2 + 1.2, 2.2, D/2 + 0.1, 0.22, 0.1, 0.22, 0xffe08a);
    B.box(0.9, 0.6, 0.7, W/2 - 1.5, 1.3, D/2 - 0.55, 0xf0c14a);
    // phao cứu sinh (vành + sọc) treo cột góc
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.17, 6, 16),
      new THREE.MeshLambertMaterial({ color: 0xf4f1e6 }));
    ring.position.set(-W/2 - 0.06, 1.75, D/2 - 0.9); ring.rotation.y = Math.PI/2; group.add(ring);
    for (let i = 0; i < 4; i++){
      const q2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.34), new THREE.MeshLambertMaterial({ color: 0xe74c3c }));
      q2.position.set(-W/2 - 0.06, 1.75 + Math.sin(i/4*TAU)*0.52, D/2 - 0.9 + Math.cos(i/4*TAU)*0.52);
      q2.rotation.x = -i/4*TAU; group.add(q2);
    }
    // mái lá gái 2 mảng (độ dốc ~22°), đuôi mái nhô ra + xà ngang + con cá trên xà
    const rise = 1.35, run = D/2 + 0.55, slope = Math.hypot(rise, run), ang = Math.atan2(rise, run);
    const yTop = 0.34 + H, yRidge = yTop + rise, yMid = yTop + rise/2;
    const roofMat = new THREE.MeshLambertMaterial({ map: thatchTex(), side: THREE.DoubleSide });
    [-1, 1].forEach(sg => {
      const r2 = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.5, slope), roofMat);
      r2.position.set(0, yMid, sg * run / 2);
      r2.rotation.x = sg * (Math.PI/2 - ang);
      r2.castShadow = true; group.add(r2);
    });
    B.box(W + 1.7, 0.16, 0.24, 0, yRidge - 0.02, 0, 0x8a6238);                       // xà đỉnh
    [-1, 1].forEach(sg => B.box(W + 1.6, 0.14, 0.2, 0, yTop - 0.04, sg * (D/2 + 0.5), 0x8a6238));  // đuôi mái
    put(B, _ico0, 0, yRidge + 0.42, 0, 0.55, 0.34, 0.24, 0x7ec8e8, 0, 0, 0);          // cá trên xà
    put(B, _cone6, 0.58, yRidge + 0.42, 0, 0.24, 0.32, 0.13, 0x7ec8e8, 0, 0, Math.PI/2);
    const bm = B.build(); if (bm) group.add(bm);
    group.position.set(HUT.x, 0, HUT.z); group.rotation.y = HUT.ry;
    const g = group;
    // đèn trong quầy (sáng ban đêm)
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), lampMat);
    lamp.position.set(0, 2.25, 0.4); g.add(lamp);
    night.push({ o: lamp, mode: 'basic', dim: 0.9 });
    night.push({ o: glow, mode: 'basic', dim: 1 });
    return g;
  }

  // ===== Dù + ghế bãi biển =====
  function makeUmbrella(group, x, z, colA, colB, night){
    const g = new THREE.Group();
    const t = stripeTex(colA, colB, 10); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.55, 1.25, 10, 1, true),
      new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide, transparent: true }));
    top.position.y = 2.35; top.castShadow = true; g.add(top);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), new THREE.MeshLambertMaterial({ color: 0x8a6238 }));
    pole.position.y = 1.25; g.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.18, 12), new THREE.MeshLambertMaterial({ color: 0xd8d2c4 }));
    base.position.y = 0.09; g.add(base);
    g.position.set(x, 0, z); return g;
  }
  function makeLounger(B, x, z, ry){
    const c1 = 0xe8503c, c2 = 0xfdf6e8, frame = 0xb98a4e;
    const put2 = (w, h, d, px, py, pz, hex, rxx) => put(B, _box, x + px, py, z + pz, w, h, d, hex, rxx || 0, ry, 0);
    // chân ghế nằm
    [-0.9, 0.9].forEach(sx => { put2(0.12, 0.5, 0.12, -1.0, 0.28, sx, frame); put2(0.12, 0.5, 0.12, 0.9, 0.28, sx, frame); });
    // mặt nằm + lưng ngả
    for (let i = 0; i < 7; i++) put2(1.95, 0.1, 0.26, -0.55 + i * 0.27, 0.56, 0, i % 2 ? c1 : c2);
    for (let i = 0; i < 3; i++) put2(1.95, 0.1, 0.26, 0.62, 0.66 + i * 0.22, 0, i % 2 ? c2 : c1, -0.42);
    for (let i = 0; i < 3; i++) put2(1.95, 0.1, 0.26, 0.75 - i * 0.16, 0.74 + i * 0.2, 0, i % 2 ? c1 : c2, 0.5);
  }

  // ===== Bến câu: thùng chài + cắm cần =====
  function makeFishGear(B, x, z, ry){
    // thùng cá (thùng gỗ + nắp + nước)
    put(B, _cyl8, x, 0.34, z, 0.42, 0.42, 0.42, 0x9c6a3c, 0, ry, 0);
    put(B, _cyl8, x, 0.56, z, 0.44, 0.08, 0.44, 0x7a4f2b, 0, ry, 0);
    // cắm cần
    put(B, _cyl6, x + 1.1, 0.7, z + 0.5, 0.07, 1.4, 0.07, 0x8a6238, 0.18, ry, 0);
    put(B, _cyl6, x + 1.1, 0.06, z + 0.5, 0.34, 0.12, 0.34, 0x6f4522);
    // mấy con cá nhỏ trên thùng
    put(B, _ico0, x - 0.1, 0.62, z - 0.1, 0.18, 0.08, 0.1, 0x8fd0e0, 0, ry + 0.5, 0);
    put(B, _ico0, x + 0.12, 0.62, z + 0.05, 0.16, 0.07, 0.09, 0xbfe6f0, 0, ry - 0.7, 0);
  }

  // ===== Cầu gỗ: ván + lan can cọc + bãi T + cọc neo + đèn lồng đầu cầu =====
  function makePier(group, night){
    const B = Batch(new THREE.MeshLambertMaterial({ vertexColors: true }));
    const plank = 0x9c7042, plank2 = 0x8a6238, pile = 0x6f4d2c;
    // ván lối đi (vân ván cách quãng) + 2 dầm dọc
    const zA = PIER.z0, zB = PIER.z1;
    B.box(0.3, 0.3, zB - zA, PIER.x0 - 1.2, PIER.y - 0.25, (zA+zB)/2, 0x5c3a1e);
    B.box(0.3, 0.3, zB - zA, PIER.x0 + 1.2, PIER.y - 0.25, (zA+zB)/2, 0x5c3a1e);
    for (let z = zA; z < zB; z += 0.62){
      B.box(PIER.halfW * 2, 0.14, 0.5, PIER.x0, PIER.y - 0.07, z + 0.25, ((z/0.62) | 0) % 2 ? plank : plank2);
    }
    // bãi T
    for (let x = -PIER.platHalf; x < PIER.platHalf; x += 0.62){
      for (let z = PIER.platZ0; z < PIER.platZ1; z += 0.62)
        B.box(0.5, 0.14, 0.5, x + 0.31, PIER.y - 0.07, z + 0.31, (((x+z)/0.62) | 0) % 2 ? plank : plank2);
    }
    B.box(PIER.platHalf*2, 0.3, 0.3, PIER.x0, PIER.y - 0.25, PIER.platZ0 + 0.3, 0x5c3a1e);
    B.box(PIER.platHalf*2, 0.3, 0.3, PIER.x0, PIER.y - 0.25, PIER.platZ1 - 0.3, 0x5c3a1e);
    // cọc neo xuống nước 2 bên
    for (let z = zA + 1.2; z < zB; z += 4.2){
      [-1, 1].forEach(s => put(B, _cyl6, PIER.x0 + s * (PIER.halfW - 0.15), -0.35, z, 0.22, 2.0, 0.22, pile));
    }
    [[-PIER.platHalf+0.5, PIER.platZ0+0.6], [PIER.platHalf-0.5, PIER.platZ0+0.6], [-PIER.platHalf+0.5, PIER.platZ1-0.6], [PIER.platHalf-0.5, PIER.platZ1-0.6]]
      .forEach(([px, pz]) => put(B, _cyl6, px, -0.4, pz, 0.3, 2.4, 0.3, pile));
    // lan can 2 bên lối đi (cọc + thanh ngang)
    for (let z = zA + 0.6; z < PIER.z1 - 2; z += 3.4){
      [-1, 1].forEach(s => put(B, _cyl6, PIER.x0 + s * (PIER.halfW - 0.1), PIER.y + 0.42, z, 0.11, 0.95, 0.11, pile));
    }
    [-1, 1].forEach(s => B.box(0.1, 0.1, zB - zA - 2, PIER.x0 + s * (PIER.halfW - 0.1), PIER.y + 0.86, (zA+zB)/2 + 0.4, 0x7a5530));
    const bm = B.build(); if (bm) group.add(bm);
    // đèn lồng đầu cầu (2 cọc đèn) — sáng ban đêm
    [[-PIER.platHalf + 0.9, PIER.platZ1 - 0.7], [PIER.platHalf - 0.9, PIER.platZ1 - 0.7]].forEach(([px, pz], i) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.2, 6), new THREE.MeshLambertMaterial({ color: 0x5c3a1e }));
      post.position.set(px, PIER.y + 1.1, pz); group.add(post);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), new THREE.MeshBasicMaterial({ color: 0xffe6a8 }));
      bulb.position.set(px, PIER.y + 2.4, pz); group.add(bulb);
      night.push({ o: bulb, mode: 'basic', dim: 0.25 });
      night.push({ o: post, mode: 'lampOn' });
    });
  }

  // ===== Tàu neo bên bãi T (đuôi nhọc, sườn, chân ván, buộc dây) =====
  function makeBoat(){
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshLambertMaterial({ color: 0x8a5a32 }));
    hull.scale.set(0.85, 0.45, 1.9); g.add(hull);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshLambertMaterial({ color: 0x6f4522 }));
    inner.scale.set(0.68, 0.42, 1.7); inner.position.y = 0.12; g.add(inner);
    [-1, 1].forEach(s => { const o = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 3.0), new THREE.MeshLambertMaterial({ color: 0xa87b4a }));
      o.position.set(s * 0.7, 0.18, 0); o.rotation.y = s * 0.06; g.add(o); });
    [0.55, -0.35].forEach(z => { const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.42), new THREE.MeshLambertMaterial({ color: 0xb98a4e }));
      b.position.set(0, 0.2, z); g.add(b); });
    // chân ván dọc + mạn chèo
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5), new THREE.MeshLambertMaterial({ color: 0xc9a05e }));
    oar.position.set(0.1, 0.3, 0.2); oar.rotation.set(0.2, 0.4, 1.35); g.add(oar);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // ===== Hải âu bay vòng =====
  function makeGulls(group){
    const gulls = [];
    for (let i = 0; i < 3; i++){
      const b = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshLambertMaterial({ color: 0xf7f7f2 }));
      body.scale.set(0.6, 0.6, 1.5); b.add(body);
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.03, 0.22), new THREE.MeshLambertMaterial({ color: 0xe8e8e0 }));
      wingL.position.x = -0.42; const wingR = wingL.clone(); wingR.position.x = 0.42;
      b.add(wingL); b.add(wingR);
      group.add(b);
      gulls.push({ b, wingL, wingR, r: 26 + i * 7, y: 11 + i * 2.4, sp: 0.22 + i * 0.05, ph: i * 2.1, cx: i * 8 - 8, cz: -4 + i * 9 });
    }
    return gulls;
  }

  // ===== Phao câu nổi trên mặt nước (bay sát bờ) =====
  function makeFloaters(group){
    const out = [];
    fishSpots.forEach((s, i) => {
      const fx = s.x + Math.sin(s.face) * 5.2, fz = s.z + Math.cos(s.face) * 5.2;
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshLambertMaterial({ color: 0xe8503c }));
      top.position.y = 0.14; const bot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshLambertMaterial({ color: 0xfdf6e8 }));
      bot.position.y = 0.02; g.add(top); g.add(bot);
      g.position.set(fx, 0, fz); group.add(g);
      // vòng sóng nhỏ quanh phao
      const rip = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.34, 16),
        new THREE.MeshBasicMaterial({ color: 0xdff3f7, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      rip.rotation.x = -Math.PI/2; rip.position.set(fx, 0.07, fz); group.add(rip);
      out.push({ g, rip, ph: i * 1.3 });
    });
    return out;
  }

  // ================= DỰNG CẢ ĐẢO =================
  function create(opts){
    opts = opts || {};
    const group = new THREE.Group();
    const night = [];                       // đăng ký hiệu ứng ban đêm cho Scene3D
    const L = c => new THREE.MeshLambertMaterial({ color: c });

    // ---------- biển ----------
    const seaMat = new THREE.MeshLambertMaterial({ color: 0x11697c });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 1, 1), seaMat);
    sea.rotation.x = -Math.PI/2; sea.position.set(CX, -0.06, CZ); group.add(sea);
    night.push({ o: sea, mode: 'sea' });
    // nước nông bao quanh đảo + bờ sóng
    const shallow = new THREE.Mesh(new THREE.ShapeGeometry(
      (() => { const s = new THREE.Shape();
        for (let i = 0; i <= 72; i++){ const p = seaEdge(i/72*TAU); i ? s.lineTo(p.x, -p.z) : s.moveTo(p.x, -p.z); }
        for (let i = 72; i >= 0; i--){ const p = sandEdge(i/72*TAU); s.lineTo(p.x, -p.z); }
        return s; })(), 24), new THREE.MeshLambertMaterial({ color: 0x1f8ca0 }));
    shallow.rotation.x = -Math.PI/2; shallow.position.y = -0.04; shallow.renderOrder = -1; group.add(shallow);
    night.push({ o: shallow, mode: 'shallow' });
    const foamTexV = tex((g, w, h) => {
      const gr = g.createRadialGradient(w/2, h/2, w*0.30, w/2, h/2, w*0.5);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.72, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, 128, 128);
    const foam = new THREE.Mesh(new THREE.ShapeGeometry(
      (() => { const s = new THREE.Shape();
        for (let i = 0; i <= 72; i++){ const p = seaEdge(i/72*TAU); i ? s.lineTo(p.x, -p.z) : s.moveTo(p.x, -p.z); }
        for (let i = 72; i >= 0; i--){ const p = sandEdge(i/72*TAU); s.lineTo(p.x, -p.z); }
        return s; })(), 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    foam.rotation.x = -Math.PI/2; foam.position.y = 0.02; group.add(foam);
    night.push({ o: foam, mode: 'foam' });

    // ---------- cát + cỏ ----------
    const sand = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(a => { const p = sandEdge(a); return { x: p.x, y: -p.z }; }), 72), new THREE.MeshLambertMaterial({ map: sandTex() }));
    sand.rotation.x = -Math.PI/2; sand.position.y = 0.06; sand.receiveShadow = true; group.add(sand);
    const grass = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(a => { const p = grassEdge(a); return { x: p.x, y: -p.z }; }), 72), new THREE.MeshLambertMaterial({ map: grassTex() }));
    grass.rotation.x = -Math.PI/2; grass.position.y = 0.09; grass.receiveShadow = true; group.add(grass);

    // ---------- lối đất trên cỏ (chạy theo hình bốn cánh, mép cong nhẹ) ----------
    const paths = new THREE.Mesh(new THREE.ShapeGeometry((() => {
      const s = new THREE.Shape(), seg = 14;
      // mỗi nhánh là 1 dải 2 mép (dựng thủ công cho chắc)
      const branch = (ang, len, w0, w1) => {
        const L = [], R = [];
        for (let i = 0; i <= seg; i++){
          const t = i/seg, bend = Math.sin(t * 2.2) * 2.2;
          const cx = Math.cos(ang) * len * t - Math.sin(ang) * bend;
          const cz = Math.sin(ang) * len * t + Math.cos(ang) * bend;
          const dx = Math.cos(ang) * len - Math.sin(ang) * 2.2 * 2.2 * Math.cos(t * 2.2);
          const dz = Math.sin(ang) * len + Math.cos(ang) * 2.2 * 2.2 * Math.cos(t * 2.2);
          const l = Math.hypot(dx, dz) || 1, nx = -dz/l, nz = dx/l;
          const w = (w0 + (w1-w0)*t) / 2;
          L.push({ x: cx + nx*w, z: cz + nz*w }); R.push({ x: cx - nx*w, z: cz - nz*w });
        }
        return { L, R };
      };
      const B2 = [branch(-Math.PI/2 + 0.28, 21, 3.0, 4.2), branch(Math.PI/2 - 0.3, 20, 3.0, 4.0),
                   branch(Math.PI - 0.22, 25, 3.2, 4.4), branch(0.2, 24, 3.0, 4.2)];
      B2.forEach(b => b.L.forEach(p => s.lineTo(p.x, -p.z)));
      for (let i = B2.length - 1; i >= 0; i--){ const b = B2[i]; for (let j = b.R.length-1; j >= 0; j--) s.lineTo(b.R[j].x, -b.R[j].z);
        if (i === 0) s.closePath(); }
      return s;
    })(), 8), new THREE.MeshLambertMaterial({ color: 0xdcc08a }));
    paths.rotation.x = -Math.PI/2; paths.position.y = 0.11; paths.receiveShadow = true; group.add(paths);

    // ---------- cây cọ + bụi + đá + vỏ ốc ----------
    const veg = Batch(new THREE.MeshLambertMaterial({ vertexColors: true }));
    PALM_AT.forEach(([x, z, s], i) => makePalm(veg, x, z, s, i * 3.7 + 1));
    // bụi tròn (3 cụm như ảnh mẫu)
    [[-9.5, -7.5, 2.5], [10.5, -8.5, 2.9], [-13.5, 4.5, 2.2]].forEach(([x, z, r], i) => {
      put(veg, _ico0, x, r*0.42, z, r, r*0.72, r*0.9, 0x4e8f3a, 0, i, 0);
      put(veg, _ico0, x + r*0.4, r*0.3, z - r*0.2, r*0.6, r*0.45, r*0.55, 0x5aa345, 0, i+1, 0);
    });
    // đá trên bãi cát (xám xanh nhạt, dẹt)
    for (let i = 0; i < 16; i++){
      const a = (i / 16) * TAU + 0.3, e = sandEdge(a);
      const k = 0.72 + (i % 3) * 0.12;
      put(veg, _ico0, e.x * k + CX * (1-k), 0.18, e.z * k + CZ * (1-k), 0.55 + (i % 3) * 0.18, 0.3, 0.48 + (i % 2) * 0.14, i % 2 ? 0x9aa7ab : 0x8c9a9e, 0, i, 0);
    }
    // vỏ ốc + sao biển nhỏ trên cát
    for (let i = 0; i < 10; i++){
      const a = (i / 10) * TAU + 1.1, e = sandEdge(a), k = 0.86;
      put(veg, _ico0, e.x * k, 0.1, e.z * k, 0.2, 0.07, 0.2, i % 3 ? 0xf6e3c0 : 0xf08a7a, 0, i, 0);
    }
    const vm = veg.build(); if (vm) group.add(vm);

    // ---------- quầy cá ----------
    group.add(makeHut(night));

    // ---------- dù + ghế bãi biển ----------
    const furn = Batch(new THREE.MeshLambertMaterial({ vertexColors: true }));
    group.add(makeUmbrella(group, -8.5, -1.5, '#e8503c', '#fdf6e8'));
    group.add(makeUmbrella(group, -11.0, 1.2, '#e8503c', '#fdf6e8'));
    group.add(makeUmbrella(group, 8.5, -4.5, '#3fb8d8', '#fdf6e8'));
    makeLounger(furn, -6.0, 0.5, 0.35);
    makeLounger(furn, 11.0, -1.5, -0.5);
    makeLounger(furn, -12.6, -0.8, 0.2);
    // bàn + ghế ngoài hiên quầy
    put(furn, _cyl8, -11.8, 0.75, -4.6, 0.7, 0.08, 0.7, 0xe0c08a);
    put(furn, _cyl8, -11.8, 0.36, -4.6, 0.1, 0.72, 0.1, 0x8a6238);
    put(furn, _cyl8, -13.6, 0.45, -4.6, 0.42, 0.09, 0.42, 0xa87b4a);
    put(furn, _cyl8, -10.0, 0.45, -4.6, 0.42, 0.09, 0.42, 0xa87b4a);
    // thùng chài + cắm cần ở các chỗ câu
    fishSpots.forEach((s, i) => makeFishGear(furn, s.x + Math.cos(s.face) * 1.5, s.z + Math.sin(s.face) * 1.5, s.face));
    makeFishGear(furn, PIER_SPOT.x - 2.2, PIER_SPOT.z + 0.6, 0.3);
    const fm = furn.build(); if (fm) group.add(fm);

    // ---------- đèn lồng kiểu công viên (trên cỏ) ----------
    const LAMPS = [[-6.5, 4.5], [7.5, 7.5], [-2, -8.5], [14.5, 6.5]];
    LAMPS.forEach(([x, z]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 3.4, 6), new THREE.MeshLambertMaterial({ color: 0x2f4a3a }));
      pole.position.set(x, 1.7, z); pole.castShadow = true; group.add(pole);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.62), new THREE.MeshBasicMaterial({ color: 0xffe9b8 }));
      bulb.position.set(x, 3.9, z); group.add(bulb);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.4, 4), new THREE.MeshLambertMaterial({ color: 0x2f4a3a }));
      cap.position.set(x, 4.5, z); cap.rotation.y = Math.PI/4; group.add(cap);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.24, 8), new THREE.MeshLambertMaterial({ color: 0x2f4a3a }));
      base.position.set(x, 0.12, z); group.add(base);
      if (opts.lampPool) opts.lampPool(x, z, 3.9);     // vệt sáng trên mặt đất (Scene3D tự thêm)
      night.push({ o: bulb, mode: 'basic', dim: 0.3 });
    });

    // ---------- cầu + tàu ----------
    makePier(group, night);
    const boat = makeBoat();
    boat.position.set(PIER.platHalf + 2.4, 0.1, PIER.platZ0 + 2.6); boat.rotation.y = -0.25;
    group.add(boat);
    // thuyền nhỏ thứ 2 ngoài khơi
    const boat2 = makeBoat();
    boat2.scale.setScalar(0.72); boat2.position.set(-26, 0.1, 20); boat2.rotation.y = 1.1;
    group.add(boat2);

    // ---------- đảo nhỏ + hải âu + phao câu ----------
    ISLETS.forEach((it, i) => makeIslet(group, it, i * 1.7 + 1));
    const gulls = makeGulls(group);
    const floaters = makeFloaters(group);

    // ---------- cổng về quảng trường (bảng gỗ bên bờ nam) ----------
    const portal = new THREE.Group();
    const PB = Batch(new THREE.MeshLambertMaterial({ vertexColors: true }));
    put(PB, _cyl6, -1.5, 1.6, 0, 0.22, 3.2, 0.22, 0x6f4522);
    put(PB, _cyl6,  1.5, 1.6, 0, 0.22, 3.2, 0.22, 0x6f4522);
    put(PB, _box, 0, 2.7, 0, 3.4, 0.5, 0.22, 0x8a6238);
    put(PB, _box, 0, 1.3, 0, 3.0, 1.5, 0.16, 0x9c7042);
    const pbm = PB.build(); if (pbm) portal.add(pbm);
    portal.position.set(0, 0, -19.6); portal.rotation.y = Math.PI;
    group.add(portal);

    // ---------- update mỗi khung ----------
    const foamMat = foam.material;
    function update(t){
      const w = Math.sin(t * 0.9);
      foamMat.opacity = 0.42 + 0.16 * w;
      foam.scale.setScalar(1 + 0.006 * w);
      boat.position.y = 0.08 + Math.sin(t * 1.1) * 0.16; boat.rotation.z = Math.sin(t * 0.9) * 0.06;
      boat2.position.y = 0.06 + Math.sin(t * 0.8 + 1.4) * 0.12; boat2.rotation.z = Math.sin(t * 0.7) * 0.05;
      floaters.forEach(f => { f.g.position.y = Math.sin(t * 2 + f.ph) * 0.07; f.rip.material.opacity = 0.28 + 0.22 * Math.sin(t * 2 + f.ph); });
      gulls.forEach((g, i) => {
        const a = t * g.sp + g.ph, R = g.r;
        g.b.position.set(g.cx + Math.cos(a) * R, g.y + Math.sin(t * 0.7 + i) * 1.2, g.cz + Math.sin(a) * R * 0.8);
        g.b.rotation.y = -a + Math.PI/2; g.b.rotation.z = 0.1;
        const f = Math.sin(t * 6 + i) * 0.5;
        g.wingL.rotation.z = f; g.wingR.rotation.z = -f;
      });
    }
    return { group, update, night, fishSpots, portalSpot: { x: 0, z: -18.6 } };
  }

  return { create, walkable, dockY, onPier, onIsland, fishSpots, PALM_AT, PIER, PIER_SPOT, HUT, RX, RZ, sandEdge, grassEdge };
})();