/* ===== GCITY Vehicles: xe mui trần + máy bay thuê =====
 * Model dùng chung cho bãi đỗ (three-scene.js) và lúc lái (game.js) nên xe đậu ở bãi
 * và xe bạn ngồi lên là một. Quy ước: đầu xe hướng +Z (local), cánh/bánh quay theo trục X/Z.
 *   Vehicles.build(kind, color) -> THREE.Group, userData = { seat:{x,y,z}, wheels[], prop|null, maxSpeed }
 *   seat = vị trí MẶT GHẾ (local) nơi mông nhân vật ngồi.
 */
const Vehicles = (() => {
  const M = c => new THREE.MeshLambertMaterial({ color:c });
  const GLASS = () => new THREE.MeshLambertMaterial({ color:0xa8d8f0, transparent:true, opacity:0.55 });
  const DARK = 0x2b3440, SEAT = 0x8a5a35;

  const CARS = [
    { name:'Xe Đỏ',        color:0xe85c5c },
    { name:'Xe Xanh Dương', color:0x4aa3df },
    { name:'Xe Vàng',      color:0xf2c94c },
    { name:'Xe Xanh Lá',   color:0x8fc15a },
  ];
  const PLANES = [
    { name:'Máy bay Xanh', color:0x2fa5b5 },
    { name:'Máy bay Vàng', color:0xf2a93b },
  ];
  const PRICE = { car:50, plane:150 };      // xu / lượt thuê
  const RENT_SEC = 300;                     // 5 phút
  const css = c => '#' + c.toString(16).padStart(6, '0');

  function box(g, w, h, d, x, y, z, c){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
    m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
  }
  function wheelGeo(r, w){ const g = new THREE.CylinderGeometry(r, r, w, 14); g.rotateZ(Math.PI/2); return g; }

  // ---------- Xe mui trần 4 chỗ (2 ghế trước + ghế băng sau) ----------
  function car(color){
    const g = new THREE.Group(), wheels = [];
    box(g, 1.9, 0.5, 1.0,   0, 0.62,  1.2,  color);      // capo
    box(g, 1.9, 0.5, 0.8,   0, 0.62, -1.35, color);      // cốp
    box(g, 1.9, 0.28, 1.7,  0, 0.5, -0.15,  color);      // sàn
    box(g, 0.14, 0.4, 1.7,  0.88, 0.84, -0.15, color);   // thành xe 2 bên
    box(g, 0.14, 0.4, 1.7, -0.88, 0.84, -0.15, color);
    box(g, 1.62, 0.06, 1.7, 0, 0.66, -0.15, 0x1f2630);   // nền cabin tối
    [-0.42, 0.42].forEach(x => {                          // 2 ghế trước
      box(g, 0.62, 0.16, 0.55, x, 0.82, 0.25, DARK);
      box(g, 0.62, 0.55, 0.12, x, 1.1, -0.07, DARK);
    });
    box(g, 1.5, 0.16, 0.5, 0, 0.82, -0.85, DARK);         // ghế băng sau
    box(g, 1.5, 0.55, 0.12, 0, 1.1, -1.12, DARK);
    const ws = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.06), GLASS());   // kính chắn gió
    ws.position.set(0, 1.12, 0.68); ws.rotation.x = -0.45; g.add(ws);
    box(g, 1.95, 0.14, 0.12, 0, 0.42, 1.74, 0xb8bcc2);    // cản trước
    [-0.62, 0.62].forEach(x => { box(g, 0.3, 0.16, 0.08, x, 0.72, 1.72, 0xfff3a0); box(g, 0.3, 0.14, 0.08, x, 0.72, -1.76, 0xc0392b); });
    const wg = wheelGeo(0.38, 0.3), wm = M(0x1a1a1a);
    [[-0.98, 1.15], [0.98, 1.15], [-0.98, -1.2], [0.98, -1.2]].forEach(([x, z]) => {
      const w = new THREE.Mesh(wg, wm); w.position.set(x, 0.38, z); w.castShadow = true; g.add(w); wheels.push(w);
    });
    g.userData = { seat:{ x:0.42, y:0.9, z:0.25 }, wheels, prop:null, maxSpeed:11 };
    return g;
  }

  // ---------- Máy bay cánh quạt 2 chỗ (ghế nâu, cánh quạt ở mũi) ----------
  function plane(color){
    const g = new THREE.Group(), dark = 0x222222;
    const fu = new THREE.CylinderGeometry(0.4, 0.25, 3.0, 12); fu.rotateX(Math.PI/2);       // thân: to ở mũi, thon ở đuôi
    const f = new THREE.Mesh(fu, M(color)); f.position.set(0, 0.72, 0); f.castShadow = true; g.add(f);
    const cone = new THREE.ConeGeometry(0.4, 0.4, 12); cone.rotateX(Math.PI/2);
    const nose = new THREE.Mesh(cone, M(0xe9e9e9)); nose.position.set(0, 0.72, 1.7); g.add(nose);
    box(g, 4.6, 0.08, 1.0, 0, 0.62, 0.15, color);                                              // cánh
    box(g, 0.3, 0.12, 1.0, -2.3, 0.62, 0.15, 0xe74c3c);                                        // đầu cánh đỏ / xanh
    box(g, 0.3, 0.12, 1.0,  2.3, 0.62, 0.15, 0x2ecc71);
    box(g, 1.7, 0.06, 0.5, 0, 0.8, -1.35, color);                                              // đuôi ngang
    box(g, 0.07, 0.7, 0.55, 0, 1.15, -1.38, color);                                            // đuôi đứng
    box(g, 0.56, 0.12, 0.5, 0, 1.12, 0.5, SEAT);  box(g, 0.56, 0.5, 0.1, 0, 1.42, 0.22, SEAT);   // ghế lái
    box(g, 0.56, 0.12, 0.5, 0, 1.12, -0.4, SEAT); box(g, 0.56, 0.5, 0.1, 0, 1.42, -0.68, SEAT);  // ghế sau
    const ws = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.05), GLASS());              // kính chắn gió
    ws.position.set(0, 1.32, 0.88); ws.rotation.x = -0.5; g.add(ws);
    const wg = wheelGeo(0.22, 0.12), wm = M(dark);                                             // bộ bánh hạ cánh
    [[-0.55, 0.3], [0.55, 0.3], [0, 1.0]].forEach(([x, z]) => {
      const w = new THREE.Mesh(wg, wm); w.position.set(x, 0.24, z); g.add(w);
      box(g, 0.06, 0.4, 0.06, x, 0.46, z, dark);
    });
    // cánh quạt: xoay quanh trục dọc thân (Z). Đứng yên trên bãi, chỉ quay khi nổ máy.
    const prop = new THREE.Group(); prop.position.set(0, 0.72, 1.92);
    box(prop, 0.1, 1.5, 0.05, 0, 0, 0, dark); box(prop, 1.5, 0.1, 0.05, 0, 0, 0, dark);
    const sp = new THREE.ConeGeometry(0.1, 0.22, 10); sp.rotateX(Math.PI/2);
    const spin = new THREE.Mesh(sp, M(0xcccccc)); spin.position.z = 0.1; prop.add(spin);
    g.add(prop);
    g.userData = { seat:{ x:0, y:1.18, z:0.5 }, wheels:[], prop, maxSpeed:13 };
    return g;
  }

  function build(kind, color){ return kind === 'plane' ? plane(color) : car(color); }

  return { build, CARS, PLANES, PRICE, RENT_SEC, css };
})();
