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
  // Hằng số tư thế lái, DÙNG CHUNG cho model xe/máy bay (dưới đây) và nhân vật (character.js đặt tay theo đúng vành vô-lăng / tay cầm của cần lái),
  // nên bàn tay luôn nằm đúng trên vật mà nó đang nắm. Toạ độ theo hệ của xe (đầu xe = +Z). floorY = mặt sàn đặt chân. seat = mặt ghế.
  const RIDE = {
    car: {
      seat:{ x:-0.42, y:1.0, z:0.25 }, floorY:0.69,
      wheel:{ x:-0.42, y:1.46, z:0.58, R:0.21, tilt:0.5, spin:0.48, gripAng:{ L:Math.PI - 0.55, R:0.55 } }   // vô-lăng nghiêng ra sau 29°, tay 9h30 / 2h30; đáy vành cao hơn đầu gối, khuỷu gập ~105°
    },
    plane: {
      seat:{ x:0, y:0.99, z:0.4 }, floorY:0.665,
      yoke:{ x:0, y:1.20, z:0.74, handleX:0.27, handleY:0.12, roll:0.6, pull:0.22 },                          // cần lái dạng "yoke": hai tay cầm thẳng đứng ở hai đầu
      pedals:[{ x:-0.2, y:0.80, z:1.0, tilt:0.25, len:0.34 }, { x:0.2, y:0.80, z:1.0, tilt:0.25, len:0.34 }]                    // bàn đạp bánh lái (trái, phải)
    }
  };
  // Vị trí lòng bàn tay (hệ toạ độ xe) khi nắm vô-lăng / cần lái. side: 'L' (-X) | 'R' (+X). steer -1..1, pitch rad (máy bay: dương = ngóc đầu)
  function grip(kind, side, steer, pitch, out){
    if(kind === 'plane'){
      const Y = RIDE.plane.yoke, a = steer * Y.roll, c = Math.cos(a), sn = Math.sin(a), hx = (side === 'R' ? 1 : -1) * Y.handleX, hy = Y.handleY;
      const pull = Math.max(-0.5, Math.min(0.5, pitch || 0)) * Y.pull;
      return out.set(Y.x + hx*c - hy*sn, Y.y + hx*sn + hy*c, Y.z - pull);
    }
    const W = RIDE.car.wheel, th = W.gripAng[side], psi = -steer * W.spin;                 // vành quay quanh trục vô-lăng đúng như game.js (rotation.z = -steer*spin)
    let x = W.R*Math.cos(th), y = W.R*Math.sin(th);
    const x1 = x*Math.cos(psi) - y*Math.sin(psi), y1 = x*Math.sin(psi) + y*Math.cos(psi);
    const ct = Math.cos(W.tilt), st = Math.sin(W.tilt);                                    // nghiêng quanh X: (y,z) → (y·cos, y·sin)
    return out.set(W.x + x1, W.y + y1*ct, W.z + y1*st);
  }
  // Cập nhật vật điều khiển theo lái: vô-lăng quay, yoke xoay + kéo/đẩy (game.js gọi mỗi khung)
  function animate(v, kind, steer, pitch){
    const ud = v.userData;
    if(kind === 'plane' && ud.yoke){
      const Y = RIDE.plane.yoke;
      ud.yoke.rotation.z = steer * Y.roll;
      ud.yoke.position.z = Y.z - Math.max(-0.5, Math.min(0.5, pitch || 0)) * Y.pull;
    } else if(ud.steering) ud.steering.rotation.z = -steer * RIDE.car.wheel.spin;
  }
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
      box(g, 0.62, 0.16, 0.55, x, 0.92, 0.25, DARK);              // mặt ghế cao 1.0 (cách sàn 0.31 như ghế đá) để chân ngồi đúng tư thế
      box(g, 0.62, 0.55, 0.12, x, 1.2, -0.07, DARK);
    });
    box(g, 1.5, 0.16, 0.5, 0, 0.92, -0.85, DARK);         // ghế băng sau
    box(g, 1.5, 0.55, 0.12, 0, 1.2, -1.12, DARK);
    box(g, 1.7, 0.14, 0.34, 0, 1.02, 0.62, color);       // bảng táp-lô
    const Wh = RIDE.car.wheel;
    const steering = new THREE.Group(); steering.name = 'steering';   // vô-lăng ở ghế lái: nghiêng ra sau, đúng tầm 2 bàn tay (xem RIDE.car.wheel)
    steering.position.set(Wh.x, Wh.y, Wh.z); steering.rotation.x = Wh.tilt;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(Wh.R,0.032,8,24), M(DARK)); steering.add(rim);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.07,10,8), M(0x68717a)); steering.add(hub);
    const spokeA = new THREE.Mesh(new THREE.BoxGeometry(Wh.R*2-0.04,0.03,0.025), M(DARK)); steering.add(spokeA);
    const spokeB = new THREE.Mesh(new THREE.BoxGeometry(0.03,Wh.R-0.03,0.025), M(DARK)); spokeB.position.y = -(Wh.R-0.03)/2; steering.add(spokeB);
    g.add(steering);
    const shaftGeo = new THREE.CylinderGeometry(0.045,0.06,0.30,10); shaftGeo.rotateX(Math.PI/2);
    const shaft = new THREE.Mesh(shaftGeo,M(DARK)); shaft.rotation.x = Wh.tilt;                // trục lái chỉ từ tâm vô-lăng xuống táp-lô theo đúng pháp tuyến vành
    shaft.position.set(Wh.x, Wh.y - 0.15*Math.sin(Wh.tilt), Wh.z + 0.15*Math.cos(Wh.tilt)); g.add(shaft);
    box(g, 0.2, 0.3, 0.16, Wh.x, 1.18, Wh.z + 0.28, DARK);                               // vỏ trục lái dưới vô-lăng, nối xuống táp-lô
    const ws = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.06), GLASS());   // kính chắn gió (dời ra trước để không cắt qua vô-lăng)
    ws.position.set(0, 1.12, 0.88); ws.rotation.x = -0.45; g.add(ws);
    box(g, 1.95, 0.14, 0.12, 0, 0.42, 1.74, 0xb8bcc2);    // cản trước
    [-0.62, 0.62].forEach(x => { box(g, 0.3, 0.16, 0.08, x, 0.72, 1.72, 0xfff3a0); box(g, 0.3, 0.14, 0.08, x, 0.72, -1.76, 0xc0392b); });
    const wg = wheelGeo(0.38, 0.3), wm = M(0x1a1a1a);
    const frontWheels = [];
    [[-0.98, 1.15], [0.98, 1.15], [-0.98, -1.2], [0.98, -1.2]].forEach(([x, z]) => {
      const pivot = new THREE.Group(); pivot.position.set(x,0.38,z);
      const w = new THREE.Mesh(wg, wm); w.castShadow = true; pivot.add(w); g.add(pivot); wheels.push(w);
      if(z > 0) frontWheels.push(pivot);
    });
    // Compound collision boxes follow the open-car silhouette; unlike a large
    // circle they leave the cabin open and let the hood/trunk act as low steps.
    const collisionBoxes = [
      { x:0, y:0.62, z:1.2,   w:2.05, h:0.5, d:1.05 }, // hood
      { x:0, y:0.62, z:-1.35, w:2.05, h:0.5, d:0.85 }, // trunk
      { x:0, y:0.50, z:-0.15, w:1.72, h:0.28,d:1.7 },  // floor
      { x:0.88,y:0.84,z:-0.15, w:0.14,h:0.4, d:1.7 },  // side rail
      { x:-0.88,y:0.84,z:-0.15,w:0.14,h:0.4, d:1.7 },  // side rail
      ...[[-0.98,1.15],[0.98,1.15],[-0.98,-1.2],[0.98,-1.2]].map(([x,z]) =>
        ({ x, y:0.38, z, w:0.42, h:0.72, d:0.42 }))
    ];
    g.userData = { seat:Object.assign({}, RIDE.car.seat), wheels, frontWheels, steering, prop:null, maxSpeed:11, collisionBoxes };
    return g;
  }

  // ---------- Máy bay cánh quạt 2 chỗ (ghế nâu, cánh quạt ở mũi) ----------
  function plane(color){
    const g = new THREE.Group(), dark = 0x222222;
    // thân: to ở mũi, thon ở đuôi — tách 3 đoạn để khoét BUỒNG LÁI HỞ (bản cũ là 1 ống đặc nên cổ chân/mũi chân phi công chìm trong thân)
    // bán kính theo z: r(z) = 0.325 + 0.05z (đuôi 0.25 → mũi 0.4, giữ nguyên dáng cũ)
    const seg = (z0, z1) => {
      const r = z => 0.325 + 0.05*z, geo = new THREE.CylinderGeometry(r(z1), r(z0), z1 - z0, 12); geo.rotateX(Math.PI/2);
      const m = new THREE.Mesh(geo, M(color)); m.position.set(0, 0.72, (z0 + z1)/2); m.castShadow = true; g.add(m);
    };
    seg(-1.5, 0.0); seg(1.2, 1.5);                                                             // đuôi · hốc động cơ
    box(g, 0.64, 0.06, 1.2, 0, 0.40, 0.6, color);                                              // sàn buồng lái (chân đặt xuống đây)
    box(g, 0.06, 0.46, 1.2, -0.35, 0.67, 0.6, color); box(g, 0.06, 0.46, 1.2, 0.35, 0.67, 0.6, color);   // thành buồng lái
    box(g, 0.76, 0.5, 0.1, 0, 0.7, 1.22, color);                                               // vách trước
    box(g, 0.34, 0.50, 0.34, 0, 0.68, 0.4, DARK);                                              // chân ghế lái
    const cone = new THREE.ConeGeometry(0.4, 0.4, 12); cone.rotateX(Math.PI/2);
    const nose = new THREE.Mesh(cone, M(0xe9e9e9)); nose.position.set(0, 0.72, 1.7); g.add(nose);
    box(g, 4.6, 0.08, 1.0, 0, 0.62, 0.15, color);                                              // cánh
    box(g, 0.3, 0.12, 1.0, -2.3, 0.62, 0.15, 0xe74c3c);                                        // đầu cánh đỏ / xanh
    box(g, 0.3, 0.12, 1.0,  2.3, 0.62, 0.15, 0x2ecc71);
    box(g, 1.7, 0.06, 0.5, 0, 0.8, -1.35, color);                                              // đuôi ngang
    box(g, 0.07, 0.7, 0.55, 0, 1.15, -1.38, color);                                            // đuôi đứng
    // ghế hạ thấp (mặt ghế y 0.99, trước đây 1.18): cao hơn sàn buồng lái 0.33 như ghế đá → đùi gần ngang, chân với tới bàn đạp
    box(g, 0.56, 0.12, 0.5, 0, 0.93, 0.4, SEAT);  box(g, 0.56, 0.5, 0.1, 0, 1.23, 0.12, SEAT);   // ghế lái
    box(g, 0.56, 0.12, 0.5, 0, 0.93, -0.4, SEAT); box(g, 0.56, 0.5, 0.1, 0, 1.23, -0.68, SEAT);  // ghế sau
    const ws = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.05), GLASS());              // kính chắn gió
    ws.position.set(0, 1.14, 1.27); ws.rotation.x = -0.5; g.add(ws);
    // bảng đồng hồ + cần lái dạng yoke: trục ngang nối bảng đồng hồ, tay lái chữ U ở đầu trục, hai tay cầm thẳng đứng ở hai đầu (RIDE.plane.yoke).
    // Kéo cần = yoke lùi về phía phi công (mũi ngẩng), bẻ lái = yoke xoay quanh trục (game.js gọi Vehicles.animate)
    const Yk = RIDE.plane.yoke;
    box(g, 0.74, 0.34, 0.08, 0, 1.10, 1.17, dark);                                                     // bảng đồng hồ
    const colGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.34, 8); colGeo.rotateX(Math.PI/2);
    const col = new THREE.Mesh(colGeo, M(0x555d66)); col.position.set(0, Yk.y - 0.02, Yk.z + 0.17); g.add(col);   // trục cần lái
    const yoke = new THREE.Group(); yoke.name = 'yoke'; yoke.position.set(Yk.x, Yk.y, Yk.z); g.add(yoke);
    box(yoke, Yk.handleX*2 + 0.06, 0.05, 0.05, 0, 0, 0, dark);                                          // thanh ngang chữ U
    [-1, 1].forEach(sx => {
      box(yoke, 0.05, Yk.handleY*2 + 0.08, 0.05, sx*Yk.handleX, Yk.handleY*0.5, 0, dark);                 // trụ thẳng đứng
      const grp = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.13, 10), M(0xc0392b)); grp.position.set(sx*Yk.handleX, Yk.handleY, 0); yoke.add(grp);   // tay cầm cao su đỏ
    });
    box(g, 0.66, 0.06, 0.86, 0, 0.635, 0.72, dark);                                                    // sàn buồng lái: bàn chân đặt phẳng
    RIDE.plane.pedals.forEach(pd => {                                                                    // bàn đạp bánh lái hai bên
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, pd.len || 0.2), M(0x3a424c)); m.position.set(pd.x, pd.y, pd.z); m.rotation.x = pd.tilt; g.add(m);
      box(g, 0.04, pd.y - 0.65, 0.04, pd.x, (pd.y + 0.65)/2, pd.z + (pd.len || 0.2)/2 - 0.05, dark);
    });
    const wg = wheelGeo(0.22, 0.12), wm = M(dark);                                             // bộ bánh hạ cánh
    [[-0.55, 0.3], [0.55, 0.3], [0, 1.35]].forEach(([x, z]) => {
      const w = new THREE.Mesh(wg, wm); w.position.set(x, 0.24, z); g.add(w);
      box(g, 0.06, 0.4, 0.06, x, 0.46, z, dark);
    });
    // cánh quạt: xoay quanh trục dọc thân (Z). Đứng yên trên bãi, chỉ quay khi nổ máy.
    const prop = new THREE.Group(); prop.position.set(0, 0.72, 1.92);
    box(prop, 0.1, 1.5, 0.05, 0, 0, 0, dark); box(prop, 1.5, 0.1, 0.05, 0, 0, 0, dark);
    const sp = new THREE.ConeGeometry(0.1, 0.22, 10); sp.rotateX(Math.PI/2);
    const spin = new THREE.Mesh(sp, M(0xcccccc)); spin.position.z = 0.1; prop.add(spin);
    g.add(prop);
    // Hitboxes follow the visible silhouette instead of treating the aircraft as
    // one large 2D circle: fuselage, wing, tailplane, fin, propeller, and gear.
    const flightBoxes = [
      { x:0, y:0.72, z:0,    w:0.8, h:0.8, d:3.2 },   // fuselage
      { x:0, y:0.62, z:0.15, w:4.9, h:0.1, d:1.0 },   // main wing
      { x:0, y:0.8,  z:-1.35,w:1.7, h:0.1, d:0.5 },   // tailplane
      { x:0, y:1.15, z:-1.38,w:0.1, h:0.7, d:0.55 },  // fin
      { x:0, y:0.72, z:1.92, w:1.5, h:1.5, d:0.15 },  // propeller disc
      { x:0, y:0.24, z:0.3,  w:1.25,h:0.44,d:0.44 },  // main landing gear
      { x:0, y:0.24, z:1.35, w:0.3, h:0.44,d:0.3 }    // tail wheel
    ];
    g.userData = { seat:Object.assign({}, RIDE.plane.seat), wheels:[], prop, yoke, maxSpeed:13, flightBoxes, collisionBoxes:flightBoxes };
    return g;
  }

  function build(kind, color){ return kind === 'plane' ? plane(color) : car(color); }

  return { build, CARS, PLANES, PRICE, RENT_SEC, css, RIDE, grip, animate };
})();
