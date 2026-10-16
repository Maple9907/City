/* ===== GCITY - Đài phun nước Hoàng Gia (3 tầng, chạm khắc, thiên cầu vàng) =====
 * Dựng bằng khối nguyên thủy Three.js, không asset ngoài.
 * API:  const fx = Fountain.create();      // { group, update(time) }
 *       fx.group.position.set(x, y, z);  scene.add(fx.group);
 *       mỗi frame: fx.update(time_giây);
 *       Fountain.RADIUS = bán kính va chạm (mép bậc ngoài).
 * Kích thước gốc (bản mẫu) bán kính 8.5 → thu bằng SCALE cho vừa quảng trường.
 */
const Fountain = (() => {
  const SCALE = 0.55;
  const RADIUS = 8.5 * SCALE;          // mép bậc đá ngoài cùng

  // Toạ độ bên dưới là hệ "gốc" (chưa nhân SCALE)
  const POOL_Y = 1.75;                 // mặt nước hồ chính
  const MID_Y  = 4.77;                 // mặt nước bồn giữa
  const TOP_Y  = 6.53;                 // mặt nước bồn đỉnh
  const SPH_Y  = 7.2;                  // tâm thiên cầu
  const JET_Y0 = 7.9;                  // điểm bắn tia chính (đỉnh thiên cầu)
  const RING_Y0 = 4.85;                // điểm bắn tia vòng (mép bồn giữa)
  const G_MAIN = 23, G_RING = 20;      // trọng lực (đơn vị/giây²)
  const TAU = Math.PI * 2;

  let dotTex = null;
  function dotTexture(){               // chấm tròn mềm cho hạt nước (thay cho ô vuông mặc định của Points)
    if(dotTex) return dotTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grad = g.createRadialGradient(32,32,0,32,32,32);
    // lõi trắng xanh + viền xanh ngọc đậm hơn → nổi rõ trên nền gạch kem sáng của quảng trường (màu thuần trắng bị chìm)
    grad.addColorStop(0,'rgba(240,252,255,1)'); grad.addColorStop(0.4,'rgba(125,218,248,0.95)'); grad.addColorStop(0.8,'rgba(60,170,230,0.55)'); grad.addColorStop(1,'rgba(60,170,230,0)');
    g.fillStyle = grad; g.fillRect(0,0,64,64);
    dotTex = new THREE.CanvasTexture(c);
    return dotTex;
  }

  // InstancedMesh: gộp nhiều chi tiết lặp lại (họa tiết, rãnh cột, con sơn) vào 1 draw call
  function instanced(geo, mat, items, shadow){
    const m = new THREE.InstancedMesh(geo, mat, items.length);
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1,1,1), p = new THREE.Vector3(), e = new THREE.Euler();
    items.forEach((it, i) => {
      e.set(it.rx||0, it.ry||0, it.rz||0, 'YXZ');            // Ry·Rx·Rz: xoay quanh trục đứng sau khi nghiêng theo trục tiếp tuyến
      q.setFromEuler(e); p.set(it.x, it.y, it.z);
      m.setMatrixAt(i, mx.compose(p, q, sc));
    });
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;                                   // bounding sphere của InstancedMesh (r128) không tính các instance
    m.castShadow = !!shadow; m.receiveShadow = true;
    return m;
  }

  function create(){
    const root = new THREE.Group();
    const body = new THREE.Group(); body.scale.setScalar(SCALE); root.add(body);

    // ---- vật liệu (Lambert cho nhẹ trên điện thoại, màu khớp tông pastel của công viên) ----
    const L = (c, extra) => new THREE.MeshLambertMaterial(Object.assign({ color:c }, extra||{}));
    const marble = L(0xece8dc), carved = L(0xd6d0c0), dark = L(0xa8a396), stone1 = L(0xd9d3c4), stone2 = L(0xe6e0d2), stoneRim = L(0xb3ac9c);
    const gold = L(0xd9a93a, { emissive:0x3d2a05 });
    const water = L(0x2f9bd0, { transparent:true, opacity:0.92 });   // xanh sâu hơn: ánh sáng game (ambient .85 + sun .6) làm màu sáng bị cháy thành cyan phẳng

    const add = (geo, mat, x, y, z, o) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
      o = o || {};
      if(o.rx) m.rotation.x = o.rx;
      m.castShadow = !!o.cast; m.receiveShadow = o.recv !== false;
      body.add(m); return m;
    };
    const cyl = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg || 40);
    const tor = (R, r, ts) => new THREE.TorusGeometry(R, r, 10, ts || 48);

    // ---- bậc thềm đá ----
    add(cyl(8.2, 8.5, 0.3, 48), stone1, 0, 0.15, 0, { cast:true });
    add(tor(8.35, 0.08), stoneRim, 0, 0.3, 0, { rx:Math.PI/2 });
    add(cyl(7.3, 7.6, 0.3, 48), stone2, 0, 0.45, 0, { cast:true });

    // ---- hồ chính ----
    add(cyl(6.2, 6.4, 1.2, 48), marble, 0, 1.05, 0, { cast:true });
    const reliefs = [];                                        // họa tiết chạm nổi quanh thân hồ (32 tấm)
    for(let i=0;i<32;i++){ const a = i/32*TAU; reliefs.push({ x:Math.cos(a)*6.33, y:1.05, z:Math.sin(a)*6.33, ry:-a }); }
    body.add(instanced(new THREE.BoxGeometry(0.16, 0.6, 0.5), carved, reliefs, false));
    add(tor(6.3, 0.22), gold, 0, 1.68, 0, { rx:Math.PI/2 });
    add(tor(6.45, 0.15), marble, 0, 0.55, 0, { rx:Math.PI/2 });
    add(cyl(6.02, 6.02, 0.1, 48), water, 0, 1.7, 0, { cast:false });   // nước cao hơn nắp hồ 0.05 → không bị z-fighting

    // ---- cột trung tâm + rãnh dọc thân (nghiêng theo độ thon của cột) ----
    add(cyl(0.65, 0.85, 3.5, 28), marble, 0, 2.9, 0, { cast:true });
    const taper = Math.atan(0.2/3.5), flutes = [];
    for(let i=0;i<12;i++){ const a = i/12*TAU; flutes.push({ x:Math.cos(a)*0.75, y:2.9, z:Math.sin(a)*0.75, ry:-a, rz:taper }); }
    body.add(instanced(new THREE.BoxGeometry(0.1, 3.3, 0.1), carved, flutes, false));
    add(tor(0.83, 0.07, 32), gold, 0, 2.9, 0, { rx:Math.PI/2 });

    // ---- 4 cột phụ + đầu cột vàng (chạm tới đáy bồn giữa) ----
    for(let i=0;i<4;i++){ const a = i/4*TAU, x = Math.cos(a)*1.3, z = Math.sin(a)*1.3;
      add(cyl(0.22, 0.28, 2.9, 18), dark, x, 2.6, z, { cast:true });
      add(cyl(0.32, 0.22, 0.2, 18), gold, x, 4.15, z);
    }

    // ---- bồn giữa + 8 con sơn đỡ (nghiêng đúng theo trục tiếp tuyến, lệch 22.5° so với cột phụ) ----
    add(cyl(3.3, 1.1, 0.55, 44), marble, 0, 4.4, 0, { cast:true });
    const brackets = [];
    for(let i=0;i<8;i++){ const a = (i+0.5)/8*TAU; brackets.push({ x:Math.cos(a)*1.0, y:3.95, z:Math.sin(a)*1.0, ry:-a, rz:-0.6 }); }
    body.add(instanced(new THREE.BoxGeometry(0.22, 0.9, 0.5), carved, brackets, true));
    add(tor(3.35, 0.18), gold, 0, 4.7, 0, { rx:Math.PI/2 });
    add(cyl(3.12, 3.12, 0.1, 44), water, 0, 4.72, 0, { cast:false });

    // ---- tầng đỉnh (có nước, bản mẫu để trống) ----
    add(cyl(0.35, 0.45, 1.5, 22), marble, 0, 5.45, 0, { cast:true });
    add(cyl(1.3, 0.45, 0.45, 30), marble, 0, 6.25, 0, { cast:true });
    add(tor(1.32, 0.1, 32), gold, 0, 6.5, 0, { rx:Math.PI/2 });
    add(cyl(1.18, 1.18, 0.06, 30), water, 0, 6.5, 0, { cast:false });

    // ---- thiên cầu vàng (có cuống nối xuống bồn đỉnh) ----
    add(cyl(0.08, 0.12, 0.7, 12), gold, 0, 6.85, 0, { cast:true });
    const sphere = new THREE.Group(); sphere.position.y = SPH_Y; body.add(sphere);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 14), gold); core.castShadow = true; sphere.add(core);
    for(let i=0;i<3;i++){
      const ring = new THREE.Mesh(tor(0.45 + i*0.08, 0.03, 32), gold);
      ring.rotation.x = i*Math.PI/3; ring.rotation.y = i*Math.PI/4; sphere.add(ring);
    }

    // ---- hạt nước: quỹ đạo giải tích (độ cao/thời gian rơi tính trước) → luôn rơi đúng vào bồn/hồ, không bị cụt giữa không trung ----
    const NM = 900, NR = 600, N = NM + NR;
    const pos = new Float32Array(N*3);
    const x0 = new Float32Array(N), z0 = new Float32Array(N), y0 = new Float32Array(N);
    const vx = new Float32Array(N), vy = new Float32Array(N), vz = new Float32Array(N);
    const gr = new Float32Array(N), life = new Float32Array(N), born = new Float32Array(N);

    function spawn(i){
      const a = Math.random()*TAU;
      if(i < NM){                                              // tia chính: bắn từ đỉnh thiên cầu, rơi vào bồn đỉnh / bồn giữa / hồ
        const rt = 5.3*Math.pow(Math.random(), 1.6);           // bán kính chạm nước (dồn nhiều về giữa)
        const yl = rt < 1.1 ? TOP_Y : rt < 2.9 ? MID_Y : POOL_Y;
        const H = 3.0 + Math.random()*1.7, v = Math.sqrt(2*G_MAIN*H);
        const T = v/G_MAIN + Math.sqrt(2*(JET_Y0 + H - yl)/G_MAIN);
        const j = Math.random()*0.06;
        x0[i] = Math.cos(a)*j; z0[i] = Math.sin(a)*j; y0[i] = JET_Y0;
        vx[i] = Math.cos(a)*rt/T; vz[i] = Math.sin(a)*rt/T; vy[i] = v; gr[i] = G_MAIN; life[i] = T;
      } else {                                                 // tia vòng: bắn từ mép bồn giữa, vòng cung rơi xuống hồ
        const r0 = 2.4 + Math.random()*0.6, rt = 3.9 + Math.random()*1.7, T = 0.95 + Math.random()*0.3;
        x0[i] = Math.cos(a)*r0; z0[i] = Math.sin(a)*r0; y0[i] = RING_Y0;
        vx[i] = Math.cos(a)*(rt - r0)/T; vz[i] = Math.sin(a)*(rt - r0)/T;
        vy[i] = (POOL_Y - RING_Y0 + 0.5*G_RING*T*T)/T; gr[i] = G_RING; life[i] = T;
      }
    }
    for(let i=0;i<N;i++){ spawn(i); pos[i*3+1] = -50; }        // ẩn cho tới khi update() đầu tiên đặt pha

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color:0xffffff, size:0.15, map:dotTexture(), transparent:true, opacity:1, depthWrite:false
    }));
    pts.frustumCulled = false;                                 // vị trí đổi liên tục, bounding sphere ban đầu không đúng
    body.add(pts);

    let ready = false;
    function update(time){
      if(!ready){ for(let i=0;i<N;i++) born[i] = time - Math.random()*life[i]; ready = true; }
      sphere.rotation.y = time*0.3;
      for(let i=0;i<N;i++){
        let t = time - born[i];
        if(t >= life[i]){
          const stale = t - life[i] > 0.25;                   // khung hình trễ lâu (tab bị treo / máy yếu)
          if(!stale) born[i] += life[i];                      // bình thường: nối liền quỹ đạo kế tiếp, không giật
          spawn(i);
          if(stale) born[i] = time - Math.random()*life[i];   // trễ: rải lại pha ngẫu nhiên, tránh cả đàn hạt cùng bắt đầu một lúc
          t = Math.max(0, time - born[i]);
        }
        pos[i*3]   = x0[i] + vx[i]*t;
        pos[i*3+1] = y0[i] + vy[i]*t - 0.5*gr[i]*t*t;
        pos[i*3+2] = z0[i] + vz[i]*t;
      }
      geo.attributes.position.needsUpdate = true;
    }

    return { group: root, update };
  }

  return { create, RADIUS, SCALE, POOL_Y, MID_Y, TOP_Y };
})();
