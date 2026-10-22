/* ===== GCITY 3D - Character v2 =====
 * Nhân vật chibi dựng hoàn toàn từ hình khối (không asset ngoài), tương thích three.js r128.
 *
 * Điểm chính:
 *  - Tỉ lệ chibi, mặt có mắt (lòng trắng + tròng + điểm sáng), lông mày, mũi, miệng cười, má hồng, tai
 *  - 8 kiểu tóc và 12 bộ trang phục khác nhau; nhân vật mặc định để tay trống
 *  - Tay có khuỷu + bàn tay, chân có đầu gối + giày (giày đi theo chân khi bước)
 *  - Mỗi bộ phận được "bake" thành 1 mesh vertex-color => chỉ ~14 draw call / nhân vật
 *  - Viền toon (inverted hull) cho nhân vật nổi bật trên nền pastel
 *  - Animation: thở, chớp mắt, đung đưa tóc/đuôi, đi/chạy mượt, ngồi ghế đúng chiều, ngồi xếp bằng, 1 điệu nhảy + nhảy lên
 *
 * API (giữ nguyên tên bộ phận cũ để game.js không phải đổi):
 *   GChar.DEFS                      { male:[...], female:[...] }
 *   GChar.build(gender, idx)        -> { group, parts }  (giữ nguyên rig và các anchor)
 *   GChar.update(group, dt, time)   -> cập nhật pose (đọc group.userData: moving, walkT, face, action, actionT)
 *   GChar.preview(gender, idx,w,h)  -> dataURL ảnh 3D cho màn chọn nhân vật (null nếu không có WebGL)
 */
const GChar = (() => {
  // ====================== DỮ LIỆU NHÂN VẬT ======================
  // outfit: varsity | hoodie | denim | polo | bomber | sport | cardigan | sweater | overalls | dress | cropped | sweatshirt
  // sleeve: short | long | none      legs: long | shorts | skirt
  // hairStyle: short | spiky | curly | long | ponytail | twin | bun | bob
  // bangs: straight | side | none      acc: mảng phụ kiện
  const DEFS = {
    male: [
      { skin:0xf5c9a0, hair:0x5d3828, shirt:0xf1eadb, pants:0x282d38, shoe:0xf4f0e6, accent:0x2f9e91, eye:0x3a2616, under:0x2f5964,
        outfit:'varsity', sleeve:'long', legs:'long', hairStyle:'short', bangs:'side', acc:[] },
      { skin:0xe8b88f, hair:0x24170f, shirt:0x23704a, pants:0x52616a, shoe:0xf2eee3, accent:0xe8d7a6, eye:0x24170c,
        outfit:'hoodie', sleeve:'long', legs:'long', hairStyle:'short', bangs:'straight', acc:[] },
      { skin:0xf0c090, hair:0x191817, shirt:0x416c9a, pants:0x252b36, shoe:0xeee9df, accent:0xc9683f, eye:0x3a2616, under:0xc9683f,
        outfit:'denim', sleeve:'long', legs:'long', hairStyle:'spiky', bangs:'none', acc:[] },
      { skin:0xf5d0a8, hair:0x6b4423, shirt:0xd3b995, pants:0x68734d, shoe:0x795a3b, accent:0x6f805b, eye:0x2f5d8a,
        outfit:'polo', sleeve:'short', legs:'long', hairStyle:'curly', bangs:'none', acc:[] },
      { skin:0xe0a878, hair:0x171717, shirt:0x7d3543, pants:0x29425c, shoe:0xe8e8e4, accent:0xe2caa1, eye:0x1a1a1a, under:0xe2caa1,
        outfit:'bomber', sleeve:'long', legs:'long', hairStyle:'short', bangs:'none', acc:[] },
      { skin:0xf8d8b8, hair:0x8b4513, shirt:0x2e6cc4, pants:0xd59b2e, shoe:0xf5f0e6, accent:0xf5f0e6, eye:0x4a2c17,
        outfit:'sport', sleeve:'none', legs:'shorts', hairStyle:'spiky', bangs:'none', acc:[] },
    ],
    female: [
      { skin:0xf8d4b0, hair:0x9c4b30, shirt:0xe77d69, pants:0x287e78, shoe:0xf2eee5, accent:0xf5e8d8, eye:0x2a1a12, under:0xf5e8d8,
        outfit:'cardigan', sleeve:'long', legs:'long', hairStyle:'long', bangs:'straight', acc:[] },
      { skin:0xf0c090, hair:0x211a16, shirt:0x9c79c5, pants:0x303d62, shoe:0x262735, accent:0xc4a7df, eye:0x3a2616,
        outfit:'sweater', sleeve:'long', legs:'long', hairStyle:'bob', bangs:'side', acc:[] },
      { skin:0xfce0c0, hair:0xf0c765, shirt:0x83b9a2, pants:0x7db9a1, shoe:0xe8bd3e, accent:0xf6d54a, eye:0x2f7fb0, under:0xf6d54a,
        outfit:'overalls', sleeve:'short', legs:'long', hairStyle:'twin', bangs:'straight', acc:[] },
      { skin:0xe8b88f, hair:0x6b362b, shirt:0xe87c8e, pants:0xd96078, shoe:0xf4eee5, accent:0xf4d7a0, eye:0x24170c,
        outfit:'dress', sleeve:'short', legs:'skirt', hairStyle:'ponytail', bangs:'side', acc:[] },
      { skin:0xf5c9a0, hair:0x3a281e, shirt:0x79b9d0, pants:0x583d6d, shoe:0xf2eee4, accent:0xf4e8d1, eye:0x2f6b3a, under:0xf4e8d1,
        outfit:'cropped', sleeve:'long', legs:'long', hairStyle:'bob', bangs:'side', acc:[] },
      { skin:0xf8d8b8, hair:0x34271f, shirt:0xe8b845, pants:0x28543f, shoe:0xe7e8e3, accent:0xf5d985, eye:0x3a2616,
        outfit:'sweatshirt', sleeve:'long', legs:'long', hairStyle:'curly', bangs:'straight', acc:[] },
    ],
  };

  // ====================== HELPER DỰNG HÌNH ======================
  const PI = Math.PI;
  const matCache = new Map();
  const mat = c => { let m = matCache.get(c); if(!m){ m = new THREE.MeshBasicMaterial({ color:c }); matCache.set(c, m); } return m; };
  const shade = (hex, k) => { const c = new THREE.Color(hex); c.r = Math.min(1, c.r*k); c.g = Math.min(1, c.g*k); c.b = Math.min(1, c.b*k); return c.getHex(); };   // k<1 tối, k>1 sáng (đã kẹp ≤1)
  const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

  function add(parent, geo, color, x, y, z, rx, ry, rz, sx, sy, sz){
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x||0, y||0, z||0);
    m.rotation.set(rx||0, ry||0, rz||0);
    m.scale.set(sx||1, sy||1, sz||1);
    parent.add(m); return m;
  }
  const sph = (p, r, c, x,y,z, sx,sy,sz, seg) => add(p, new THREE.SphereGeometry(r, seg||14, Math.max(8, ((seg||14)*0.7)|0)), c, x,y,z, 0,0,0, sx,sy,sz);
  const box = (p, w,h,d, c, x,y,z, rx,ry,rz) => add(p, new THREE.BoxGeometry(w,h,d), c, x,y,z, rx,ry,rz);
  const cyl = (p, rt,rb,h, c, x,y,z, rx,ry,rz, seg) => add(p, new THREE.CylinderGeometry(rt,rb,h, seg||14), c, x,y,z, rx,ry,rz);
  const cone = (p, r,h, c, x,y,z, rx,ry,rz, seg) => add(p, new THREE.ConeGeometry(r,h, seg||8), c, x,y,z, rx,ry,rz);
  const tor = (p, R,r, c, x,y,z, rx,ry,rz, arc) => add(p, new THREE.TorusGeometry(R, r, 6, 20, arc||PI*2), c, x,y,z, rx,ry,rz);

  // capsule bằng Lathe (r128 chưa có CapsuleGeometry). len = khoảng cách 2 tâm bán cầu
  function capGeo(rTop, rBot, len, seg){
    const pts = [], n = 6;
    for(let i=0;i<=n;i++){ const a = -PI/2 + i/n*PI/2; pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a)*rBot), -len/2 + Math.sin(a)*rBot)); }
    for(let i=0;i<=n;i++){ const a = i/n*PI/2;        pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a)*rTop),  len/2 + Math.sin(a)*rTop)); }
    return new THREE.LatheGeometry(pts, seg||14);
  }
  const cap = (p, rTop,rBot,len, c, x,y,z, rx,ry,rz, sx,sy,sz) => add(p, capGeo(rTop,rBot,len), c, x,y,z, rx,ry,rz, sx,sy,sz);

  // Lathe theo profile [[r,y],...] từ dưới lên
  const lathe = (p, prof, c, x,y,z, sx,sy,sz, seg) => add(p, new THREE.LatheGeometry(prof.map(([r,y])=>new THREE.Vector2(r,y)), seg||20), c, x,y,z, 0,0,0, sx,sy,sz);

  // Gộp mọi mesh con của `root` thành 1 BufferGeometry dùng vertex color (toạ độ theo gốc của root)
  function bakeGeo(root){
    root.updateMatrixWorld(true);
    const pos = [], nor = [], col = [];
    root.traverse(o => {
      if(!o.isMesh) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      const p = g.attributes.position, n = g.attributes.normal, c = o.material.color;
      for(let i=0;i<p.count;i++){
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        nor.push(n.getX(i), n.getY(i), n.getZ(i));
        col.push(c.r, c.g, c.b);
      }
      g.dispose();
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }

  const bodyMat = new THREE.MeshPhongMaterial({ vertexColors:true, shininess:20, specular:0x383240 });
  const outlineMat = new THREE.MeshBasicMaterial({ color:0x2b2236, side:THREE.BackSide });
  outlineMat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + normalize(normal) * 0.032;');
  };

  // tạo Mesh (+ viền) từ nhóm tạm
  function bakeMesh(tmp, outline){
    const geo = bakeGeo(tmp);
    const m = new THREE.Mesh(geo, bodyMat); m.castShadow = true;
    if(outline !== false){ const o = new THREE.Mesh(geo, outlineMat); m.add(o); }
    return m;
  }

  // ====================== DỰNG TỪNG BỘ PHẬN ======================
  const T = () => new THREE.Group();

  function buildHead(def, female){
    const t = T(), R = 0.62, skin = def.skin;
    const hy = 0.62;                                               // tâm đầu so với cổ
    // cổ + đầu + tai
    cyl(t, 0.17, 0.2, 0.3, shade(skin, 0.95), 0, 0.02, 0, 0,0,0, 10);
    sph(t, R, skin, 0, hy, 0, 1, 0.96, 0.94, 28);
    [-1,1].forEach(s => { sph(t, 0.11, shade(skin,0.97), s*0.61, hy-0.03, -0.02, 0.55, 1, 0.9, 10); sph(t, 0.05, shade(skin,0.85), s*0.63, hy-0.03, 0.0, 0.5, 1, 0.8, 8); });
    // mũi, miệng, má hồng
    sph(t, 0.05, shade(skin,0.93), 0, hy-0.14, 0.575, 1, 0.9, 0.9, 8);
    tor(t, 0.085, 0.015, 0x7a2f35, 0, hy-0.26, 0.53, 0.25, 0, PI, PI);       // miệng cười (cung dưới)
    const blush = mix(skin, 0xff6f91, 0.45);
    [-1,1].forEach(s => sph(t, 0.1, blush, s*0.37, hy-0.17, 0.43, 1, 0.55, 0.35, 10));
    // lông mày
    const brow = shade(def.hair, 0.9);
    [-1,1].forEach(s => box(t, 0.2, 0.035, 0.05, brow, s*0.235, hy+0.2, 0.52, 0, -s*0.38, s*-0.1));
    // tóc
    buildHair(t, def, female, hy);
    // phụ kiện đầu
    (def.acc||[]).forEach(a => headAcc(t, def, a, hy));
    return t;
  }

  function hairCap(t, c, hy, r){
    const g = new THREE.SphereGeometry(r||0.665, 28, 18, 0, PI*2, 0, PI*0.56);
    const m = add(t, g, c, 0, hy, -0.02, -0.5, 0, 0);
    return m;
  }
  function bangs(t, def, hy){
    const c = def.hair, style = def.bangs;
    if(style === 'none') return;
    const n = 6;
    for(let i=0;i<n;i++){
      const k = (i/(n-1))*2 - 1;                                    // -1..1
      const x = k*0.43, z = Math.sqrt(Math.max(0.05, 0.44 - x*x*0.9)) + 0.04;
      let ry = -k*0.7, rz = 0;
      let len = 0.17;
      if(style === 'side'){ rz = -0.45 - k*0.15; len = 0.2 + (k+1)*0.04; }
      sph(t, 0.15, i%2 ? shade(c,1.08) : c, x, hy+0.29 - Math.abs(k)*0.05, z, 1, len/0.15, 0.7, 10).rotation.set(0.25, ry, rz);
    }
  }
  function sideburns(t, c, hy){ [-1,1].forEach(s => sph(t, 0.12, c, s*0.55, hy-0.08, 0.2, 0.55, 1.25, 0.8, 8)); }
  function shine(t, c, hy){ tor(t, 0.6, 0.02, shade(c,1.4), 0, hy+0.3, -0.04, PI/2-0.45, 0, PI/2-0.6, 1.2); }

  function buildHair(t, def, female, hy){
    const c = def.hair, st = def.hairStyle;
    const hat = (def.acc||[]).some(a => a==='cap' || a==='beanie');
    hairCap(t, c, hy);
    if(!hat){ bangs(t, def, hy); shine(t, c, hy); }
    if(st === 'short'){ sideburns(t, c, hy); sph(t, 0.2, shade(c,1.05), 0.02, hy+0.6, -0.08, 1, 0.7, 1, 10); }
    else if(st === 'spiky'){
      for(let i=0;i<9;i++){
        const a = i/9*PI*2, r = 0.33, up = 0.62 + (i%2)*0.08;
        const k = cone(t, 0.15, 0.48, shade(c, i%2?1.1:1), Math.sin(a)*r, hy+up, Math.cos(a)*r*0.85 - 0.05, 0,0,0, 6);
        k.rotation.set(Math.cos(a)*0.7, 0, -Math.sin(a)*0.7);
      }
      cone(t, 0.16, 0.55, c, 0, hy+0.8, -0.02, 0,0,0, 6);
      for(let i=-1;i<=1;i++){ const k = cone(t, 0.1, 0.34, c, i*0.26, hy+0.38, 0.5, 0,0,0, 6); k.rotation.set(1.9, 0, -i*0.3); }
      sideburns(t, c, hy);
    }
    else if(st === 'curly'){
      for(let i=0;i<14;i++){
        const a = i/14*PI*2, ring = i%2;
        sph(t, 0.24 + ring*0.03, i%3===0?shade(c,1.12):c, Math.sin(a)*0.5, hy+0.3+ring*0.22, Math.cos(a)*0.5 - 0.06, 1,1,1, 10);
      }
      for(let i=0;i<5;i++){ const a = i/5*PI*2; sph(t, 0.26, c, Math.sin(a)*0.22, hy+0.66, Math.cos(a)*0.22 - 0.05, 1,1,1, 10); }
    }
    else if(st === 'long'){
      sph(t, 0.7, c, 0, hy-0.55, -0.22, 0.95, 1.35, 0.58, 18);                  // tấm tóc sau lưng
      [-1,1].forEach(s => { sph(t, 0.19, c, s*0.54, hy-0.3, 0.12, 0.7, 2.1, 0.9, 10); sph(t, 0.14, shade(c,1.12), s*0.58, hy-0.62, 0.16, 0.8, 1.2, 0.9, 10); });
    }
    else if(st === 'bob'){
      sph(t, 0.7, c, 0, hy-0.12, -0.2, 0.98, 0.82, 0.68, 18);
      [-1,1].forEach(s => { sph(t, 0.2, c, s*0.55, hy-0.16, 0.1, 0.8, 1.7, 1, 10); });
    }
    else if(st === 'bun'){
      sph(t, 0.26, c, 0, hy+0.78, -0.12, 1, 1, 1, 14);
      tor(t, 0.2, 0.05, def.accent, 0, hy+0.6, -0.12, PI/2, 0, 0);
      sideburns(t, c, hy);
    }
    else if(st === 'ponytail' || st === 'twin'){ sideburns(t, c, hy); }
  }

  function headAcc(t, def, a, hy){
    const A = def.accent;
    if(a === 'glasses' || a === 'roundglasses'){
      const fc = a === 'glasses' ? 0x222222 : 0x8a5a2b, R = a === 'glasses' ? 0.15 : 0.165;
      [-1,1].forEach(s => { tor(t, R, 0.022, fc, s*0.235, hy-0.04, 0.575, 0.0, s*0.12, 0); });
      box(t, 0.1, 0.025, 0.03, fc, 0, hy-0.02, 0.59); [-1,1].forEach(s => box(t, 0.03, 0.025, 0.36, fc, s*0.58, hy-0.02, 0.24));
    }
    else if(a === 'sunglasses'){
      [-1,1].forEach(s => sph(t, 0.17, 0x1b1b24, s*0.235, hy-0.04, 0.55, 1, 0.78, 0.3, 12));
      box(t, 0.12, 0.03, 0.03, 0x111111, 0, hy-0.01, 0.58); [-1,1].forEach(s => box(t, 0.03, 0.03, 0.36, 0x111111, s*0.59, hy-0.01, 0.24));
    }
    else if(a === 'cap'){
      const g = new THREE.SphereGeometry(0.7, 24, 14, 0, PI*2, 0, PI*0.5); add(t, g, A, 0, hy+0.04, -0.03, -0.18, 0, 0);
      sph(t, 0.45, shade(A,0.85), 0, hy+0.3, 0.55, 1, 0.12, 0.9, 14).rotation.x = 0.22;
      sph(t, 0.07, shade(A,0.8), 0, hy+0.74, -0.02, 1,1,1, 8);
    }
    else if(a === 'beanie'){
      const g = new THREE.SphereGeometry(0.72, 24, 14, 0, PI*2, 0, PI*0.52); add(t, g, A, 0, hy+0.06, -0.04, -0.3, 0, 0);
      tor(t, 0.69, 0.1, shade(A,0.9), 0, hy+0.3, 0.0, PI/2-0.3, 0, 0);
      sph(t, 0.15, shade(A,1.1), 0, hy+0.86, -0.1, 1,1,1, 10);
    }
    else if(a === 'headphones'){
      tor(t, 0.72, 0.045, 0x2a2a33, 0, hy, 0, 0,0,0, PI);
      [-1,1].forEach(s => { cyl(t, 0.2, 0.2, 0.14, A, s*0.72, hy-0.02, 0, 0,0,PI/2, 16); cyl(t, 0.14, 0.14, 0.16, 0x2a2a33, s*0.74, hy-0.02, 0, 0,0,PI/2, 14); });
    }
    else if(a === 'headband'){ tor(t, 0.64, 0.045, A, 0, hy+0.2, -0.02, PI/2-0.38, 0, 0); }
    else if(a === 'bow'){
      const bx = 0.4, by = hy+0.5, bz = 0.12;
      [-1,1].forEach(s => sph(t, 0.15, A, bx + s*0.15, by, bz, 1.1, 0.75, 0.5, 10).rotation.z = s*0.35);
      sph(t, 0.07, shade(A,0.85), bx, by, bz+0.02, 1,1,1, 8);
    }
  }

  // ---------- Thân ----------
  function buildTorso(def, female){
    const t = T(), sk = def.skin, sh = def.shirt, o = def.outfit;
    const trunk = [[0.0001,0.0],[0.44,0.0],[0.5,0.14],[0.5,0.5],[0.47,0.86],[0.38,1.06],[0.2,1.16],[0.0001,1.18]];
    const under = def.under || shade(sh, 1.25);
    const base = o === 'overalls' ? under : sh;
    if(o === 'tank' || o === 'sport'){ lathe(t, trunk, sh, 0,0,0, 1,1,0.72, 22); [-1,1].forEach(s => sph(t, 0.23, sk, s*0.4, 1.0, 0, 1,1,0.8, 10)); }
    else if(o === 'dress'){
      lathe(t, trunk.map(([r,y])=>[r*0.94,y]), sh, 0,0,0, 1,1,0.72, 22);
      // váy xoè
      lathe(t, [[0.0001,-0.58],[0.92,-0.58],[0.9,-0.52],[0.62,-0.4],[0.46,0.02],[0.0001,0.02]], def.pants, 0, 0.2, 0, 1,1,0.9, 24);
      tor(t, 0.92, 0.04, def.accent, 0, -0.35, 0, PI/2, 0, 0).scale.set(1,0.9,1);
      tor(t, 0.47, 0.035, def.accent, 0, 0.26, 0, PI/2, 0, 0).scale.set(1,0.74,1);                  // đai eo
    }
    else lathe(t, trunk, base, 0,0,0, 1,1,0.72, 22);

    // cổ áo
    if(o === 'tee' || o === 'overalls' || o === 'dress' || o === 'polo' || o === 'sport') tor(t, 0.2, 0.05, shade(sh, 0.8), 0, 1.15, 0.03, PI/2, 0, 0).scale.set(1, 0.8, 1);
    if(o === 'hoodie'){
      sph(t, 0.46, shade(sh, 0.9), 0, 1.12, -0.2, 1, 0.62, 0.65, 16);                       // mũ hoodie sau gáy
      box(t, 0.76, 0.34, 0.12, shade(sh, 0.88), 0, 0.3, 0.37, 0.12,0,0);                        // túi trước
      [-1,1].forEach(s => cyl(t, 0.022, 0.022, 0.4, 0xf4f4f4, s*0.13, 0.82, 0.35, 0.1,0,0, 6));  // dây rút
      tor(t, 0.47, 0.05, shade(sh, 0.85), 0, 0.02, 0, PI/2, 0, 0).scale.set(1, 0.72, 1);
    }
    if(['varsity','denim','bomber','cardigan','cropped'].includes(o)){
      box(t, 0.3, 0.98, 0.055, under, 0, 0.61, 0.345, 0.04,0,0); // áo trong lộ ra
      const cropped = o === 'cropped';
      [-1,1].forEach(s => box(t, cropped ? 0.24 : 0.22, cropped ? 0.76 : 0.98, 0.065,
        sh, s*0.16, cropped ? 0.67 : 0.58, 0.365));
      tor(t, 0.22, 0.055, shade(sh, 0.78), 0, 1.12, 0.0, PI/2, 0, 0).scale.set(1, 0.85, 1);
      if(o === 'varsity'){
        box(t, 0.055, 0.98, 0.035, def.accent, 0, 0.58, 0.405);
        [-1,1].forEach(s => {
          box(t, 0.22, 0.10, 0.04, def.accent, s*0.19, 0.98, 0.36);
          box(t, 0.12, 0.17, 0.04, shade(sh,0.78), s*0.27, 0.19, 0.38);
        });
      } else if(o === 'denim'){
        box(t, 0.035, 0.92, 0.035, shade(sh,0.72), 0, 0.58, 0.416);
        [-1,1].forEach(s => {
          box(t, 0.16, 0.18, 0.035, shade(sh,0.88), s*0.20, 0.78, 0.414);
          box(t, 0.17, 0.025, 0.035, def.accent, s*0.20, 0.69, 0.416);
          [0.35,0.53,0.71,0.89].forEach(y => sph(t,0.022,0xd7c7a3,s*0.045,y,0.423,1,1,0.5,6));
        });
      } else if(o === 'cardigan'){
        box(t, 0.06, 0.88, 0.035, shade(sh,0.82), 0, 0.57, 0.414);
        [0.36,0.55,0.74,0.93].forEach(y => sph(t,0.032,def.accent,0.01,y,0.43,1,1,0.5,8));
      } else if(o === 'cropped'){
        box(t, 0.035, 0.68, 0.035, def.accent, 0, 0.69, 0.414);
        [-1,1].forEach(s => box(t,0.15,0.13,0.035,shade(sh,0.8),s*0.22,0.38,0.414));
      } else {
        box(t, 0.04, 0.94, 0.035, def.accent, 0, 0.58, 0.414);
        [-1,1].forEach(s => box(t,0.14,0.14,0.04,shade(sh,0.78),s*0.24,0.21,0.41));
      }
      if(o === 'bomber' || o === 'varsity' || o === 'cardigan') tor(t, 0.47, 0.045, shade(sh,0.82), 0, 0.02, 0, PI/2, 0, 0).scale.set(1,0.72,1);
    }
    if(o === 'overalls'){
      lathe(t, [[0.0001,0.0],[0.46,0.0],[0.5,0.14],[0.5,0.4],[0.0001,0.4]], def.pants, 0,0,0, 1,1,0.74, 22);
      box(t, 0.62, 0.55, 0.1, def.pants, 0, 0.62, 0.36);
      sph(t, 0.07, def.accent, -0.18, 0.7, 0.43, 1,1,0.5, 8); sph(t, 0.07, def.accent, 0.18, 0.7, 0.43, 1,1,0.5, 8);
      [-1,1].forEach(s => box(t, 0.1, 0.6, 0.08, def.pants, s*0.3, 0.95, 0.3, 0,0,-s*0.12));
      box(t, 0.27, 0.21, 0.035, shade(def.pants,0.84), 0, 0.52, 0.425);
      [0.47,0.57].forEach(y => box(t,0.20,0.018,0.02,shade(def.pants,0.68),0,y,0.446));
    }
    if(o === 'polo'){
      const collar = shade(sh,0.78);
      box(t,0.16,0.16,0.045,collar,-0.10,1.08,0.31,0,0,-0.3);
      box(t,0.16,0.16,0.045,collar,0.10,1.08,0.31,0,0,0.3);
      box(t,0.035,0.30,0.03,shade(sh,0.82),0,0.88,0.392);
      [0.82,0.94,1.04].forEach(y => sph(t,0.018,0xf2e9d9,0.045,y,0.412,1,1,0.5,6));
    }
    if(o === 'sport'){
      [-1,1].forEach(s => {
        box(t,0.06,0.92,0.035,def.accent,s*0.34,0.58,0.30);
        box(t,0.22,0.10,0.04,shade(sh,0.82),s*0.34,0.98,0.30);
      });
      tor(t,0.48,0.025,def.accent,0,0.02,0,PI/2,0,0).scale.set(1,0.72,1);
    }
    if(o === 'sweater' || o === 'sweatshirt'){
      const rib = shade(sh,0.78);
      tor(t,0.47,0.035,rib,0,0.04,0,PI/2,0,0).scale.set(1,0.72,1);
      tor(t,0.2,0.035,rib,0,1.14,0.03,PI/2,0,0).scale.set(1,0.8,1);
      if(o === 'sweatshirt') box(t,0.055,0.10,0.035,def.accent,0,0.72,0.365);
    }
    if(o === 'dress'){
      [-1,1].forEach(s => {
        sph(t,0.035,shade(sh,0.84),s*0.18,0.74,0.35,1,1,0.5,8);
        box(t,0.22,0.035,0.035,def.accent,s*0.24,0.51,0.35,0,0,s*0.12);
      });
      tor(t,0.78,0.025,shade(def.pants,0.82),0,-0.24,0,PI/2,0,0).scale.set(1,0.9,1);
    }
    // thắt lưng (quần dài/short)
    if(def.legs !== 'skirt' && o !== 'overalls' && o !== 'dress'){ tor(t, 0.46, 0.03, 0x2a2a2a, 0, 0.03, 0, PI/2, 0, 0).scale.set(1,0.72,1); }
    // balo
    if((def.acc||[]).includes('backpack')){
      sph(t, 0.4, def.accent, 0, 0.62, -0.42, 1, 1.15, 0.55, 14);
      sph(t, 0.22, shade(def.accent, 0.82), 0, 0.42, -0.62, 1, 0.8, 0.4, 10);
      [-1,1].forEach(s => box(t, 0.1, 0.78, 0.05, shade(def.accent, 0.7), s*0.28, 0.72, 0.28, 0.12,0,s*-0.05));
    }
    return t;
  }

  // ---------- Tay: (cánh tay trên) + (cẳng tay + bàn tay) ----------
  function buildArm(def, side){
    const sk = def.skin, sh = def.shirt, long = def.sleeve === 'long', none = def.sleeve === 'none';
    const up = T(), fo = T();
    const sleeveC = def.outfit === 'overalls' ? (def.under || sh) : sh;
    if(none) cap(up, 0.13, 0.12, 0.34, sk, 0, -0.26, 0);
    else if(long) cap(up, 0.17, 0.15, 0.34, sleeveC, 0, -0.26, 0);
    else { cap(up, 0.13, 0.12, 0.34, sk, 0, -0.26, 0); cap(up, 0.2, 0.185, 0.14, sleeveC, 0, -0.14, 0); }
    sph(up, 0.17, none ? sk : sleeveC, 0, 0.0, 0, 1,1,1, 12);                                    // vai tròn
    // cẳng tay
    if(long){ cap(fo, 0.15, 0.13, 0.28, sleeveC, 0, -0.2, 0); tor(fo, 0.14, 0.04, shade(sleeveC, 0.8), 0, -0.4, 0, PI/2, 0, 0); }
    else cap(fo, 0.125, 0.115, 0.3, sk, 0, -0.2, 0);
    sph(fo, 0.155, sk, 0, -0.58, 0.02, 1, 1.05, 0.95, 12);                                      // bàn tay
    [-0.09,-0.03,0.03,0.09].forEach((x,i) => cap(fo,0.031,0.027,0.10,shade(sk,i%2?0.98:0.94),x,-0.66,0.13,0,0,0,1,1,1));
    sph(fo, 0.06, shade(sk, 0.96), side*-0.1, -0.54, 0.1, 1,1,1, 8);                            // ngón cái
    return { up, fo };
  }

  // ---------- Chân: đùi + (cẳng + giày) ----------
  function buildLeg(def){
    const sk = def.skin, pc = def.pants, shoeC = def.shoe;
    const th = T(), sn = T();
    const skirt = def.legs === 'skirt', shorts = def.legs === 'shorts';
    const thighC = skirt ? sk : pc;
    cap(th, 0.2, 0.18, 0.38, thighC, 0, -0.3, 0);
    if(shorts){ cap(th, 0.23, 0.215, 0.14, pc, 0, -0.22, 0); }
    sph(th, 0.19, shorts || skirt ? thighC : pc, 0, 0, 0, 1,1,1, 12);
    // cẳng
    const shinC = (skirt || shorts) ? sk : pc;
    cap(sn, 0.18, 0.155, 0.32, shinC, 0, -0.22, 0);
    if(skirt || shorts){ cap(sn, 0.17, 0.165, 0.14, 0xffffff, 0, -0.4, 0); }                      // tất cổ cao
    sph(sn, 0.18, shinC, 0, 0, 0, 1,1,1, 12);                                                     // khớp gối
    // giày
    sph(sn, 0.2, shoeC, 0, -0.5, 0.1, 1.02, 0.7, 1.55, 14);
    sph(sn, 0.14, shade(shoeC, 1.15), 0, -0.46, 0.3, 1, 0.8, 0.8, 10);                            // mũi giày
    cyl(sn, 0.21, 0.21, 0.05, 0xe9e5dc, 0, -0.595, 0.1, 0,0,0, 14).scale.set(1.0,1,1.75);          // đế
    [0.20,0.25,0.30].forEach(z => box(sn,0.095,0.018,0.025,def.accent,0,-0.365,z));
    return { th, sn };
  }

  // ---------- Đuôi tóc (pivot riêng để đung đưa) ----------
  function buildTail(def, kind){
    const t = T(), c = def.hair;
    if(kind === 'pony'){
      cap(t, 0.16, 0.07, 0.78, c, 0, -0.46, 0);
      sph(t, 0.13, shade(c,1.1), 0, -0.1, 0, 1,1,1, 10);
      tor(t, 0.11, 0.035, def.accent, 0, -0.03, 0, PI/2, 0, 0);
    } else {
      cap(t, 0.14, 0.06, 0.55, c, 0, -0.34, 0);
      sph(t, 0.15, shade(c,1.1), 0, -0.05, 0, 1,1,1, 10);
      sph(t, 0.1, def.accent, 0, 0.04, 0, 1, 0.8, 1.3, 8);                                         // nơ buộc
    }
    return t;
  }

  // ---------- Mắt (pivot riêng để chớp) ----------
  function buildEye(def, female, side){
    const t = T();
    const big = female ? 1.1 : 1;
    sph(t, 0.12, 0xffffff, 0, 0, 0, 1*big, 1.28*big, 0.5, 14);
    sph(t, 0.092, def.eye, 0, -0.01, 0.035, 1*big, 1.3*big, 0.5, 12);
    sph(t, 0.052, 0x0b0b10, 0, -0.01, 0.062, 1*big, 1.3*big, 0.4, 10);
    sph(t, 0.032, 0xffffff, 0.035, 0.05, 0.085, 1,1,0.6, 8);
    sph(t, 0.015, 0xffffff, -0.03, -0.05, 0.08, 1,1,0.6, 6);
    if(female){ box(t, 0.19, 0.03, 0.05, 0x1b1b1b, side*0.015, 0.16*big, 0.02, 0,0, side*0.22); }  // mi
    return t;
  }

  // ====================== LẮP RÁP ======================
  const protoCache = {};
  function makeProto(gender, idx){
    const def = DEFS[gender][idx % DEFS[gender].length], female = gender === 'female';
    const root = new THREE.Group();
    const place = (obj, name, x, y, z) => { obj.name = name; obj.position.set(x, y, z); return obj; };

    // thân (pivot ở hông y=1.2)
    const body = place(new THREE.Group(), 'body', 0, 1.2, 0);
    body.add(bakeMesh(buildTorso(def, female))); root.add(body);

    // đầu (pivot ở gáy)
    const head = place(new THREE.Group(), 'head', 0, 2.38, 0);
    head.add(bakeMesh(buildHead(def, female)));
    [-1,1].forEach(s => { const e = place(buildEyeBaked(def, female, s), s<0?'eyeL':'eyeR', s*0.235, 0.58, 0.515); e.rotation.y = s*0.26; head.add(e); });
    if(def.hairStyle === 'ponytail'){ const tl = place(new THREE.Group(), 'tail', 0, 0.96, -0.6); tl.add(bakeMesh(buildTail(def, 'pony'))); tl.rotation.x = 0.55; head.add(tl); }
    if(def.hairStyle === 'twin'){
      [-1,1].forEach(s => { const tl = place(new THREE.Group(), s<0?'tailL':'tailR', s*0.54, 0.9, -0.16); tl.add(bakeMesh(buildTail(def, 'twin'))); tl.rotation.z = s*0.42; tl.userData.rz = s*0.42; head.add(tl); });
    }
    root.add(head);

    // tay
    [-1,1].forEach(s => {
      const a = buildArm(def, s);
      const arm = place(new THREE.Group(), s<0?'armL':'armR', s*0.66, 2.2, 0);
      arm.add(bakeMesh(a.up));
      const fore = place(new THREE.Group(), s<0?'foreL':'foreR', 0, -0.5, 0); fore.add(bakeMesh(a.fo)); arm.add(fore);
      arm.userData.restZ = s*0.1; arm.rotation.z = s*0.1; root.add(arm);
    });
    // chân
    [-1,1].forEach(s => {
      const l = buildLeg(def);
      const leg = place(new THREE.Group(), s<0?'legL':'legR', s*0.3, 1.2, 0);
      leg.add(bakeMesh(l.th));
      const shin = place(new THREE.Group(), s<0?'shinL':'shinR', 0, -0.62, 0); shin.add(bakeMesh(l.sn)); leg.add(shin);
      root.add(leg);
    });
    root.userData.def = def;
    return root;
  }
  // mắt: bake riêng (không viền để mắt sáng rõ)
  function buildEyeBaked(def, female, side){
    const m = bakeMesh(buildEye(def, female, side), false); m.castShadow = false; const g = new THREE.Group(); g.add(m); return g;
  }

  // Nhân vật dùng model GLB (js/glbchar.js): cùng bộ pivot vô hình như bản dựng sẵn → GChar.update chạy y nguyên,
  // rồi GLBChar.sync() chuyển góc quay các pivot sang xương của model.
  function buildGLB(key, gender, idx){
    const g = new THREE.Group(), parts = GLBChar.makeDriver(g);
    parts.glb = GLBChar.attach(key, g, parts);
    attachGear(g, parts);
    return { group:g, parts, def:DEFS[gender][idx % DEFS[gender].length] };
  }
  function build(gender, idx){
    const key = gender + ':' + (idx % DEFS[gender].length);
    if(typeof GLBChar !== 'undefined' && GLBChar.ready(key)){
      try{ return buildGLB(key, gender, idx); }
      catch(e){ console.warn('[GLBChar] ' + key + ' lỗi → dùng nhân vật dựng sẵn:', e.message || e); GLBChar.fail(key); }
    }
    if(!protoCache[key]) protoCache[key] = makeProto(gender, idx);
    const g = protoCache[key].clone(true);
    const parts = {};
    ['body','head','armL','armR','foreL','foreR','legL','legR','shinL','shinR','eyeL','eyeR','tail','tailL','tailR'].forEach(n => { const o = g.getObjectByName(n); if(o) parts[n] = o; });
    g.userData.def = protoCache[key].userData.def;
    attachGear(g, parts);
    return { group:g, parts, def:g.userData.def };
  }

  // ====================== ĐỒ CÂU (cần + dây + phao + cá) ======================
  // Hai hạng cần, khác hẳn nhau về hình dáng (chọn theo ud.rodTier):
  //   1 · Cơ bản : cần tre/gỗ nâu ngắn, cuộn nhựa xám nhỏ, 2 khoen sắt, phao đỏ-trắng.
  //   2 · Cao cấp: thân carbon đen dài, tay cầm bần, cuộn bạc lớn + quay vàng, 5 khoen vàng, dải quấn đỏ, phao vàng-đỏ; quăng xa hơn.
  // Cần gắn vào cẳng tay phải (foreR) nên đi theo tay. Phao nằm theo TOẠ ĐỘ THẾ GIỚI trên mặt nước (ud.fishTarget):
  // lúc quăng, phao rời đầu cần ở T_RELEASE rồi bay theo đường vòng cung; chỉ khi phao CHẠM NƯỚC mới đặt ud.castLanded = true
  // (game.js thấy cờ này mới tính là đã quăng: trừ mồi + bắt đầu chờ cá). Dây vẽ mỗi khung từ đầu cần tới phao.
  // Hình học cần (đơn vị nhóm, trước scale): sR = chỗ tay phải nắm (dọc cán, tính từ đuôi) · sL = chỗ tay trái nắm đuôi cần ·
  // reel = tâm máy câu (so với trục cần) · knob = núm quay (x lệch sang −X vì tay TRÁI quay máy; r = bán kính quay quanh tâm máy)
  const RODS = {
    1: { tipY: 0.06, tipZ: 2.92, dist: 5.2, sR: 0.50, sL: 0.20, reel:{ y:-0.15, z:0.22 }, knob:{ x:-0.20, r:0.15 } },
    2: { tipY: 0.07, tipZ: 3.60, dist: 6.6, sR: 0.68, sL: 0.28, reel:{ y:-0.20, z:0.40 }, knob:{ x:-0.30, r:0.17 } }
  };
  const T_RELEASE = 0.52;     // giây kể từ lúc vào pose 'cast': buông dây
  // Mốc thời gian pha 'reel' (= trạng thái 'caught' của Fishing, tổng FISH_T.total giây): ghì cá dưới nước → nhấc cá lên tay → giơ chiến thắng
  const FISH_T = { fight:1.0, hoist:1.55, lift:1.9, land:2.1, win:2.5, total:3.0 };
  const smooth = x => x*x*(3 - 2*x);

  function buildRod(tier){
    const rod = T(); rod.name = 'rod' + tier; let crank = null;
    if(tier === 1){
      cyl(rod, 0.055, 0.085, 1.45, 0x8a5a32, 0, 0, 0.72, PI/2, 0, 0);        // cán gỗ
      cyl(rod, 0.030, 0.055, 1.475, 0xa87b4a, 0, 0.05, 2.1825, PI/2, 0, 0); // thân tre nối liền cán
      cyl(rod, 0.11, 0.11, 0.15, 0x4a5568, 0, -0.15, 0.22, PI/2, 0, 0);       // cuộn nhựa nhỏ
      crank = T(); crank.position.set(0, -0.15, 0.22); rod.add(crank);        // tay quay (xoay quanh trục X khi thu cá)
      cyl(crank, 0.03, 0.03, 0.20, 0xd8d2c4, -0.10, 0, 0, 0, 0, PI/2);
      cyl(crank, 0.025, 0.025, 0.15, 0xd8d2c4, -0.20, 0.075, 0, 0, 0, 0);
      sph(crank, 0.05, 0xd8d2c4, -0.20, 0.15, 0, 1, 1, 1, 6);
      tor(rod, 0.065, 0.016, 0x6b7280, 0, -0.03, 1.40, 0, 0, 0);              // 2 khoen sắt
      tor(rod, 0.05, 0.014, 0x6b7280, 0, 0.0, 2.55, 0, 0, 0);
    } else {
      cyl(rod, 0.062, 0.090, 1.30, 0xd9b27c, 0, 0, 0.65, PI/2, 0, 0);         // tay cầm bần
      cyl(rod, 0.095, 0.095, 0.10, 0x2b2b2b, 0, 0, -0.02, PI/2, 0, 0);        // đế cao su
      cyl(rod, 0.105, 0.105, 0.16, 0xe0b84a, 0, 0, 1.00, PI/2, 0, 0);         // vòng đỡ cuộn bằng vàng
      cyl(rod, 0.024, 0.062, 2.30, 0x1d2230, 0, 0.04, 2.45, PI/2, 0, 0);      // thân carbon đen nối liền tay cầm
      [1.55, 2.05, 2.55].forEach(z => cyl(rod, 0.05, 0.05, 0.07, 0xc0392b, 0, 0.04, z, PI/2, 0, 0));   // dải quấn đỏ
      cyl(rod, 0.19, 0.19, 0.12, 0xc9ced6, 0, -0.20, 0.40, PI/2, 0, 0);       // cuộn bạc lớn
      cyl(rod, 0.15, 0.15, 0.17, 0xe0b84a, 0, -0.20, 0.40, PI/2, 0, 0);       // ống chỉ vàng
      crank = T(); crank.position.set(0, -0.20, 0.40); rod.add(crank);        // tay quay vàng (về phía −X cho tay trái, xoay được)
      cyl(crank, 0.035, 0.035, 0.30, 0xe0b84a, -0.15, 0, 0, 0, 0, PI/2);
      cyl(crank, 0.03, 0.03, 0.17, 0xe0b84a, -0.30, 0.085, 0, 0, 0, 0);
      sph(crank, 0.07, 0xe0b84a, -0.30, 0.17, 0, 1, 1, 1, 8);
      [[1.40,0.095],[1.88,0.08],[2.34,0.066],[2.80,0.055],[3.25,0.046]].forEach(([z, r]) =>
        tor(rod, r, 0.016, 0xe0b84a, 0, 0.04 - (0.06 - (z-1.3)*0.0157) - r*0.8, z, 0, 0, 0));   // 5 khoen vàng giảm dần
      sph(rod, 0.042, 0xe0b84a, 0, 0.07, 3.60, 1, 1, 1, 8);                   // khoen đỉnh
    }
    // Phần thân trên tách thành một khớp riêng để cần có thể UỐN CONG khi dìu cá (ud.rodBend).
    const split = tier === 2 ? 1.30 : 1.45;
    const bend = T(); bend.name = 'rodBend'; bend.position.set(0, 0, split);
    rod.children.slice().forEach(o => { if(o.position.z >= split - 1e-6){ bend.add(o); o.position.z -= split; } });
    rod.add(bend);
    const tip = new THREE.Object3D();                                   // đầu cần (đi theo phần cong)
    tip.position.set(0, tier === 2 ? 0.07 : 0.06, (tier === 2 ? 3.60 : 2.92) - split);
    bend.add(tip);
    rod.userData.bend = bend; rod.userData.tip = tip; rod.userData.crank = crank;
    rod.visible = false;       // vị trí + hướng cần đặt MỖI KHUNG theo bàn tay (updateGear), không gắn cứng vào xương nào
    return rod;
  }
  function buildFloat(tier){
    const f = T();
    if(tier === 1){
      sph(f, 0.095, 0xe8503c, 0, 0.10, 0, 1, 1, 1, 8);
      sph(f, 0.095, 0xfdf6e8, 0, -0.03, 0, 1, 1, 1, 8);
      cyl(f, 0.012, 0.012, 0.34, 0x6b7280, 0, 0.26, 0, 0, 0, 0, 4);
    } else {
      sph(f, 0.085, 0xffc83d, 0, 0.14, 0, 0.8, 1.5, 0.8, 8);
      sph(f, 0.085, 0xe8503c, 0, -0.04, 0, 0.8, 1.1, 0.8, 8);
      cyl(f, 0.010, 0.010, 0.38, 0x22d3ee, 0, 0.30, 0, 0, 0, 0, 4);
      sph(f, 0.03, 0x22d3ee, 0, 0.50, 0, 1, 1, 1, 6);
    }
    f.visible = false;
    return f;
  }
  function attachGear(g, p){
    if(!p.foreR) return;
    p.rods = {}; p.floats = {};
    [1, 2].forEach(tier => {
      p.rods[tier] = buildRod(tier); g.add(p.rods[tier]);
      p.floats[tier] = buildFloat(tier); g.add(p.floats[tier]);
    });
    const lineMat = new THREE.MeshBasicMaterial({ color:0xf2efe2, transparent:true, opacity:0.85 });
    p.line = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 1, 4), lineMat); m.visible = false; g.add(m); return m; });
    // cá treo cuối dây khi kéo lên: Sprite luôn quay mặt về camera, vẽ ĐÚNG bức tranh của loài đó trong Sổ cá (js/fishart.js).
    // Mỗi lần kéo cá chỉ đổi map theo ud.fishId (game.js đặt khi 'caught'); texture dùng chung cho mọi nhân vật.
    p.fishMat = new THREE.SpriteMaterial({ map:FishArt.texture('carp'), transparent:true, depthWrite:false, fog:false, toneMapped:false });
    const fish = new THREE.Sprite(p.fishMat); fish.renderOrder = 4; fish.visible = false; g.add(fish); p.rodFish = fish;
    FishArt.preload();
    // gợn nước: [0] bắn nước lúc phao chạm · [1] gợn đều khi chờ / cá đớp
    p.rings = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 28), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide }));
      m.rotation.x = -PI/2; m.renderOrder = 3; m.visible = false; g.add(m); return m;
    });
  }
  const _tipW = new THREE.Vector3(), _fl = new THREE.Vector3(), _tg = new THREE.Vector3(), _end = new THREE.Vector3(),
        _ctl = new THREE.Vector3(), _dir = new THREE.Vector3(), _loc = new THREE.Vector3(), _UP = new THREE.Vector3(0,1,0), _ft = new THREE.Vector3(),
        _pr = new THREE.Vector3(), _hl = new THREE.Vector3();
  const _pts = [0, 1, 2, 3, 4].map(() => new THREE.Vector3());
  function hideGear(p){
    p.rods[1].visible = p.rods[2].visible = false; p.floats[1].visible = p.floats[2].visible = false;
    p.line.forEach(m => m.visible = false); p.rodFish.visible = false; p.rings.forEach(r => r.visible = false);
  }
  // Cập nhật cần/dây/phao/cá/gợn nước. Chạy sau khi đã đặt pose tay. Mọi vị trí tính theo toạ độ THẾ GIỚI của khung này
  // (updateCharacter cộng độ cao nền gy vào position.y SAU khi update → trừ gy ở mặt nước cho khớp).
  function updateGear(g, p, ud, dt, time){
    if(!p.rods) return;
    const a = ud.action;
    if(!(a === 'rod' || a === 'fish' || a === 'cast' || a === 'reel' || a === 'bite')){
      if(ud._gearOn){ hideGear(p); ud._gearOn = false; ud.fishTarget = null; ud.castLanded = false; ud._fpOk = false; ud._gearAct = null; ud._splash = undefined; }
      return;
    }
    ud._gearOn = true;
    const tier = ud.rodTier === 2 ? 2 : 1, R = RODS[tier], rod = p.rods[tier], flt = p.floats[tier];
    p.rods[tier].visible = true; p.rods[3 - tier].visible = false; flt.visible = true; p.floats[3 - tier].visible = false;

    const env = (typeof Island !== 'undefined') ? Island : null;
    const wy = (env ? env.WATER_Y : -0.35) + 0.02 - (ud.gy || 0);          // mặt nước trong hệ toạ độ tạm
    g.updateMatrixWorld(true);
    // cần câu = vật cứng: cán đi qua lòng bàn tay phải THẬT (sau sync xương) theo hướng của pose; máy câu xoay theo ud._crank
    if(ud._rf){
      const rf = ud._rf; palmPos(g, p, 'R', _pr);
      rod.position.copy(_pr).addScaledVector(rf.Z, -R.sR);
      _km.makeBasis(rf.X, rf.Y, rf.Z); rod.quaternion.setFromRotationMatrix(_km);
      if(rod.userData.crank) rod.userData.crank.rotation.x = ud._crank || 0;
      g.updateMatrixWorld(true);
    }
    if(rod.userData.bend) rod.userData.bend.rotation.x = ud.rodBend || 0; // cần uốn cong khi dìu cá
    if(rod.userData.tip) rod.userData.tip.getWorldPosition(_tipW);        // đầu cần (bám theo phần đã cong)
    else { _tipW.set(0, R.tipY, R.tipZ); rod.localToWorld(_tipW); }
    const t = ud.actionT || 0;

    if(a === 'cast' && ud._gearAct !== 'cast'){ ud.castLanded = false; ud._rel = null; ud.fishTarget = null; ud._splash = undefined; }   // lượt quăng mới
    ud._gearAct = a;
    if(!ud.fishTarget){                                                    // điểm rơi: luôn là mặt nước (Island.castTarget tự né đất / bến / thuyền)
      const face = (ud.face !== undefined) ? ud.face : (ud.yaw || 0);
      ud.fishTarget = (env && env.castTarget) ? env.castTarget(g.position.x, g.position.z, face, R.dist)
        : { x:g.position.x + Math.sin(face)*R.dist, z:g.position.z + Math.cos(face)*R.dist };
    }
    const tg = _tg.set(ud.fishTarget.x, wy, ud.fishTarget.z);
    const out = ud.lineOut !== false;                                      // false: dây đã thu, phao treo lủng lẳng dưới đầu cần
    if(!ud._fp) ud._fp = new THREE.Vector3();
    const fp = ud._fp, F = _fl;
    let sag = 0.22, onWater = false;

    if(a === 'cast'){
      if(t < T_RELEASE){                                                   // chưa buông: phao treo dưới đầu cần
        F.copy(_tipW); F.y -= 0.5; sag = 0;
        if(!ud._rel) ud._rel = new THREE.Vector3(); ud._rel.copy(F);
      } else {                                                             // bay theo đường vòng cung tới điểm rơi
        const rel = ud._rel || (ud._rel = new THREE.Vector3().copy(_tipW));
        const dx = tg.x - rel.x, dz = tg.z - rel.z, dist = Math.hypot(dx, dz);
        const u = Math.min(1, (t - T_RELEASE) / (0.35 + dist*0.07));
        F.set(rel.x + dx*u, rel.y + (tg.y - rel.y)*u + Math.sin(u*PI)*(0.9 + dist*0.16), rel.z + dz*u);
        sag = u < 1 ? 0.10 : 0.22;
        if(u >= 1){ if(!ud.castLanded){ ud.castLanded = true; ud._splash = 0; } onWater = true; }   // CHẠM NƯỚC → mới tính
      }
    } else if(a === 'reel'){                                               // cá bị ghì dưới nước → nhấc khỏi mặt nước vào tay trái → giơ cao
      g.localToWorld(_loc.set(0, 0, 0));                                   // vị trí người câu (thế giới)
      const u0 = smooth(Math.min(1, t/FISH_T.fight))*0.12;                // cá bơi lại gần người một chút khi bị ghì
      _ft.set(tg.x + (_loc.x - tg.x)*u0, tg.y + 0.03, tg.z + (_loc.z - tg.z)*u0);
      if(t < FISH_T.fight){ F.copy(_ft); F.y += Math.abs(Math.sin(t*11))*0.06; sag = 0.04; onWater = true; }
      else {
        const u = smooth(Math.min(1, (t - FISH_T.fight)/(FISH_T.lift - FISH_T.fight)));
        palmPos(g, p, 'L', _hl); g.localToWorld(_hl);                      // tay trái đón cá (hoặc giơ cá lên ở pha chiến thắng)
        F.copy(_ft).lerp(_hl, u); F.y += Math.sin(u*PI)*0.55 + (u >= 1 ? Math.sin(time*9)*0.012 : 0);
        sag = 0.04*(1 - u); onWater = u < 0.12;
      }
    } else if(out){                                                        // 'fish' (chờ) / 'bite' (cá đớp): phao nằm trên mặt nước
      const dip = a === 'bite' ? Math.abs(Math.sin(t*9))*0.16 : -Math.sin(time*1.6)*0.015;
      F.set(tg.x, tg.y + 0.03 - dip, tg.z);
      sag = a === 'bite' ? 0.08 : 0.22; onWater = true;
    } else {                                                               // dây đã thu: phao lắc lư dưới đầu cần
      _ft.set(_tipW.x, _tipW.y - 0.55 - (a === 'bite' ? Math.abs(Math.sin(t*9))*0.08 : 0), _tipW.z);
      F.copy(_ft);
      if(ud._fpOk) F.copy(fp).lerp(_ft, 1 - Math.exp(-dt*14));             // phao bay về dưới đầu cần (trước đây lerp vào chính nó nên phao đứng yên tại chỗ)
      if(a === 'rod'){                                                     // đang cầm cần (chưa quăng): phao luôn treo sát đầu cần, đi đâu theo đó
        _dir.copy(F).sub(_tipW); const dl = _dir.length();
        if(dl > 0.8) F.copy(_tipW).addScaledVector(_dir, 0.8/dl);
      }
      sag = 0;
    }
    fp.copy(F); ud._fpOk = true;

    // ---- dây: đường cong bậc 2 đầu cần → đỉnh phao, chia 4 đoạn ----
    _end.copy(F); _end.y += 0.25;
    _ctl.copy(_tipW).add(_end).multiplyScalar(0.5); _ctl.y -= sag*2;
    for(let i = 0; i <= 4; i++){
      const s = i/4, k0 = (1 - s)*(1 - s), k1 = 2*s*(1 - s), k2 = s*s;
      _pts[i].set(_tipW.x*k0 + _ctl.x*k1 + _end.x*k2, _tipW.y*k0 + _ctl.y*k1 + _end.y*k2, _tipW.z*k0 + _ctl.z*k1 + _end.z*k2);
      g.worldToLocal(_pts[i]);
    }
    for(let i = 0; i < 4; i++){
      const m = p.line[i]; _dir.copy(_pts[i+1]).sub(_pts[i]);
      const len = _dir.length() || 0.001;
      m.position.copy(_pts[i]).addScaledVector(_dir, 0.5);
      m.scale.set(1, len, 1);
      m.quaternion.setFromUnitVectors(_UP, _dir.normalize());
      m.visible = true;
    }
    // ---- phao ----
    _loc.copy(F); g.worldToLocal(_loc); flt.position.copy(_loc);
    // ---- cá treo dưới phao khi kéo lên ----
    const showFish = a === 'reel' && F.y > wy + 0.12;
    p.rodFish.visible = showFish;
    if(showFish){
      const fid = FishArt.has(ud.fishId) ? ud.fishId : 'carp', tex = FishArt.texture(fid);
      if(p.fishMat.map !== tex) p.fishMat.map = tex;
      const fl = FishArt.len(fid), fk = 1 / g.scale.x;                    // fl = chiều dài cá theo đơn vị thế giới
      p.rodFish.scale.set(fl*fk, fl*fk*FishArt.H/FishArt.W, 1);
      _loc.set(F.x, F.y - 0.06 - fl*0.5, F.z); g.worldToLocal(_loc); p.rodFish.position.copy(_loc);   // cá treo bằng miệng ngay dưới phao
      p.fishMat.rotation = PI/2 + Math.sin(time*14)*0.4;                  // tranh quay mặt sang phải → xoay 90° cho đầu hướng lên, quẫy nhẹ
    }
    // ---- gợn nước tại điểm rơi ----
    const k = 1 / g.scale.x, ring0 = p.rings[0], ring1 = p.rings[1];
    if(onWater){
      _loc.set(tg.x, tg.y + 0.03, tg.z); g.worldToLocal(_loc);
      if(ud._splash !== undefined && ud._splash < 1){
        const s = ud._splash; ud._splash += dt;
        ring0.visible = true; ring0.position.copy(_loc); ring0.scale.setScalar((0.12 + s*1.0)*k); ring0.material.opacity = (1 - s)*0.75;
      } else ring0.visible = false;
      const bite = a === 'bite', ph = (time*(bite ? 2.2 : 0.5)) % 1;
      ring1.visible = true; ring1.position.copy(_loc); ring1.scale.setScalar((0.12 + ph*(bite ? 0.7 : 0.5))*k); ring1.material.opacity = (1 - ph)*(bite ? 0.7 : 0.3);
    } else { ring0.visible = false; ring1.visible = false; }
  }

  // ====================== IK 2 XƯƠNG (tay · chân) ======================
  // Mỗi pose chỉ cần nói "bàn tay ở ĐÂU / bàn chân ở ĐÂU / gối hướng về ĐÂU" (hệ toạ độ nhóm, trước scale); phần dưới tự tính góc quay
  // của các pivot (vai, khuỷu, hông, gối). Kích thước đùi/cẳng/tay/vai/hông lấy từ chính model (GLBChar.measureDims) nên cùng một pose
  // đúng cho cả 12 nhân vật (nam to, nữ nhỏ). Pivot là bản lề chỉ gập 1 chiều (khuỷu gập ra trước, gối gập ra sau) → không bao giờ bẻ ngược.
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const DIMS_B = { hip:{ L:v3(-0.3, 1.2, 0), R:v3(0.3, 1.2, 0) }, shoulder:{ L:v3(-0.66, 2.2, 0), R:v3(0.66, 2.2, 0) },
    thigh:0.62, shin:0.5, upper:0.5, fore:0.58, hipW:0.6, shoulderW:1.32, ankleH:0.12, toeLen:0.4 };   // bản dựng khối (không có xương GLB)
  const dimsOf = p => (p.glb && p.glb.dims) || DIMS_B;
  const palmOf = p => p.glb ? p.glb.palm : 0;
  const K = { u:v3(0,0,0), pp:v3(0,0,0), J:v3(0,0,0), E:v3(0,0,0), d1:v3(0,0,0), d2:v3(0,0,0), X:v3(0,0,0), Y:v3(0,0,0), Z:v3(0,0,0), b:v3(0,0,0),
              S:v3(0,0,0), T:v3(0,0,0), P:v3(0,0,0) };
  const _km = new THREE.Matrix4(), _ke = new THREE.Euler(0, 0, 0, 'XYZ'), _kq = new THREE.Quaternion();
  const AXY = v3(0, 1, 0);

  // Tìm khuỷu/gối J cho chuỗi 2 xương S→J→E (dài L1, L2) sao cho E chạm T (hoặc gần nhất có thể); pole = hướng khuỷu/gối "nhô" ra.
  function solve2(S, T, L1, L2, pole){
    const u = K.u.copy(T).sub(S), len = u.length() || 1e-6; u.multiplyScalar(1 / len);
    const d = Math.min((L1 + L2) * 0.9995, Math.max(Math.abs(L1 - L2) + 0.02, len));
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const pp = K.pp.copy(pole); pp.addScaledVector(u, -pp.dot(u));
    if(pp.lengthSq() < 1e-8){ pp.set(0, 0, 1).addScaledVector(u, -u.z); if(pp.lengthSq() < 1e-8) pp.set(1, 0, 0); }
    pp.normalize();
    K.J.copy(S).addScaledVector(u, a).addScaledVector(pp, h);
    K.E.copy(S).addScaledVector(u, d);
    K.d1.copy(K.J).sub(S).normalize(); K.d2.copy(K.E).sub(K.J).normalize();
    return len;
  }
  // Đặt 2 pivot (trên, dưới) để xương trên chỉ theo d1, xương dưới chỉ theo d2. Bản lề: tay gập khuỷu ra trước (θ<0), chân gập gối ra sau (θ>0).
  // Trục X cục bộ của pivot = trục bản lề (vuông góc mặt phẳng d1–d2); Z cục bộ = hướng "phía trước" của mu bàn tay / mũi chân.
  function applyChain(up, lo, d1, d2, leg, roll){
    const Y = K.Y.copy(d1).negate(), c = Math.max(-1, Math.min(1, d1.dot(d2))), phi = Math.acos(c);
    const b = K.b.copy(d2).addScaledVector(d1, -c);
    if(b.lengthSq() < 1e-8){ b.set(0, 0, 1).addScaledVector(d1, -d1.z); if(b.lengthSq() < 1e-8) b.set(1, 0, 0); if(leg) b.negate(); }
    b.normalize();
    const Z = K.Z.copy(b); if(leg) Z.negate();
    const X = K.X.crossVectors(Y, Z).normalize();
    up.quaternion.setFromRotationMatrix(_km.makeBasis(X, Y, Z));
    _ke.set(leg ? phi : -phi, roll || 0, 0, 'XYZ'); lo.quaternion.setFromEuler(_ke);
    up.rotation.setFromQuaternion(up.quaternion); lo.rotation.setFromQuaternion(lo.quaternion);
  }
  // vai thật (hệ nhóm): model GLB → vị trí xương (đi theo thân khi nghiêng, cần sync trước); bản khối → xoay vị trí vai quanh hông theo thân
  function shoulderPos(g, p, side, out){
    if(p.glb) return GLBChar.shoulder(g, p, side, out);
    const rest = DIMS_B.shoulder[side], hip = p.body.position;
    out.copy(rest).sub(hip).applyQuaternion(p.body.quaternion).add(hip);
    p['arm' + side].position.copy(out); return out;
  }
  // tay: lòng bàn tay chạm T. pole = hướng khuỷu nhô ra. roll = xoắn cẳng tay (rad) để lật lòng bàn tay.
  function armTo(g, p, side, T, pole, roll){
    const D = dimsOf(p), S = shoulderPos(g, p, side, K.S);
    const reach = solve2(S, T, D.upper, D.fore + palmOf(p), pole);
    applyChain(p['arm' + side], p['fore' + side], K.d1, K.d2, false, roll);
    return reach;
  }
  function legTo(p, side, A, pole){                       // cổ chân chạm A (hệ nhóm)
    const D = dimsOf(p);
    const reach = solve2(D.hip[side], A, D.thigh, D.shin, pole);
    applyChain(p['leg' + side], p['shin' + side], K.d1, K.d2, true, 0);
    return reach;
  }
  function legDirs(p, side, d1, d2){ applyChain(p['leg' + side], p['shin' + side], d1, d2, true, 0); }   // đặt thẳng hướng đùi + cẳng (không IK)
  // bàn chân (xương GLB): quaternion thế giới so với tư thế nghỉ (nghỉ = bàn chân phẳng, mũi chỉ thẳng tới trước)
  function setFoot(p, side, yaw, pitch){
    if(!p.footD) p.footD = {};
    _ke.set(pitch || 0, yaw || 0, 0, 'YXZ'); (p.footD[side] || (p.footD[side] = new THREE.Quaternion())).setFromEuler(_ke);
  }
  const sideSign = side => side === 'R' ? 1 : -1;

  // Tư thế ngồi: hông cao `hipH` so với mặt sàn/ghế đặt chân. Gối mở theo hông của từng model (hơi rộng hơn hông, KHÔNG xoè),
  // góc gối ≈ beta độ, độ chúi của đùi tự tính để bàn chân đặt PHẲNG trên sàn. Trả về hướng đùi để đặt tay lên đùi.
  const SEAT = { d1:{ L:v3(0,0,1), R:v3(0,0,1) }, d2:{ L:v3(0,-1,0), R:v3(0,-1,0) }, top:{ L:v3(), R:v3() } };
  function legsSeated(p, hipH, o){
    o = o || {};
    const D = dimsOf(p), T = D.thigh, S = D.shin, beta = (o.beta || 95) * PI/180, c = PI - beta;
    const dy = hipH - D.ankleH, R = Math.hypot(T + S*Math.cos(c), S*Math.sin(c)), ph = Math.atan2(S*Math.sin(c), T + S*Math.cos(c));
    const delta = Math.asin(Math.max(-1, Math.min(1, dy / R))) - ph;               // đùi chúc xuống delta (≈0: nằm ngang)
    const kneeW = Math.min(D.shoulderW, D.hipW * (o.kneeK || 1.4) + (o.kneeAdd || 0.04));
    const alpha = Math.asin(Math.max(0, Math.min(0.4, (kneeW - D.hipW) / (2 * T * Math.cos(delta)))));
    const gam = delta + c, cd = Math.cos(delta);
    ['L', 'R'].forEach(sd => {
      const sx = sideSign(sd), d1 = SEAT.d1[sd], d2 = SEAT.d2[sd];
      d1.set(sx * Math.sin(alpha) * cd, -Math.sin(delta), Math.cos(alpha) * cd);
      d2.set(0, -Math.sin(gam), Math.cos(gam));                                    // cẳng thẳng dưới gối (bàn chân ngay dưới đầu gối)
      legDirs(p, sd, d1, d2);
      SEAT.top[sd].copy(D.hip[sd]);
      setFoot(p, sd, sx * alpha * 0.8, o.toeDown && sd === o.toeSide ? o.toeDown : 0);
    });
    return { alpha, delta, kneeW };
  }

  // ====================== ANIMATION ======================
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const HIP_Y = 1.2;                         // độ cao hông của rig (cùng GLBChar)
  const SIDES = ['L', 'R'];
  const IKP = v3(0, 0, 0), IKQ = v3(0, 0, 0);
  // Các pivot có thể bị động tác ghi đè — dùng để trộn mượt khi đổi động tác (không bị giật tay khi vào câu / quăng cần / ngồi)
  const ACT_PARTS = ['body','head','armL','armR','foreL','foreR','legL','legR','shinL','shinR'];
  const _qb = new THREE.Quaternion();

  // Điểm thấp nhất của tư thế (toạ độ cục bộ của group, CHƯA nhân scale), đo 1 lần cho mỗi kiểu nhân vật.
  // group.position.y tính theo đơn vị thế giới còn group bị scale (0.58) → phải quy đổi, nếu không nhân vật lún xuống đất.
  const restCache = new Map();
  const _inv = new THREE.Matrix4(), _m = new THREE.Matrix4(), _v = new THREE.Vector3();
  function lowestLocalY(group, p){
    if(p.glb) return GLBChar.lowestY(group, p);
    group.updateMatrixWorld(true);
    _inv.copy(group.matrixWorld).invert();
    let low = Infinity;
    [p.body, p.legL, p.legR].forEach(part => part.traverse(o => {
      if(!o.isMesh || o.material === outlineMat) return;              // bỏ lớp viền
      const pos = o.geometry.attributes.position;
      _m.multiplyMatrices(_inv, o.matrixWorld);
      for(let i = 0; i < pos.count; i++){ _v.fromBufferAttribute(pos, i).applyMatrix4(_m); if(_v.y < low) low = _v.y; }
    }));
    return low;
  }

  // ---- IK tay theo từng pose (chạy sau khi thân + chân đã đặt) ----
  function ikSit(g, p){
    const D = dimsOf(p), thR = D.hipW*0.42 + 0.02;
    for(let i = 0; i < 2; i++){
      const sd = SIDES[i], sx = sideSign(sd), d1 = SEAT.d1[sd];
      IKP.copy(D.hip[sd]).addScaledVector(d1, D.thigh*0.62); IKP.y += thR + 0.03; IKP.x -= sx*0.02;       // mu bàn tay úp lên mặt đùi
      armTo(g, p, sd, IKP, IKQ.set(sx*0.9, -0.1, -0.6), -sx*0.9);
    }
  }
  // "Chỉnh ghế" theo từng model: trượt ghế dọc trục xe (đơn vị thế giới, + = tiến lên) sao cho khoảng cách vai → vô-lăng / yoke làm khuỷu gập
  // tự nhiên (xe ≈ 115°, máy bay ≈ 135°) dù tay dài hay ngắn, vai cao hay thấp. Kết quả lưu ở ud.rideShift; game.js cộng vào ghế (riding.seat.z).
  function rideSlide(p, mode, sc){
    const R = Vehicles.RIDE[mode], D = dimsOf(p), L1 = D.upper, L2 = D.fore + palmOf(p), th = (mode === 'plane' ? 135 : 115) * PI/180;
    const want2 = L1*L1 + L2*L2 - 2*L1*L2*Math.cos(th);
    let sum = 0;
    for(let i = 0; i < 2; i++){
      const sd = SIDES[i], S = D.shoulder[sd];
      Vehicles.grip(mode, sd, 0, 0, IKQ);
      const dx = (IKQ.x - R.seat.x)/sc - S.x, dy = (IKQ.y - (R.seat.y - 0.6))/sc - S.y;
      sum += (IKQ.z - R.seat.z)/sc - S.z - Math.sqrt(Math.max(0, want2 - dx*dx - dy*dy));
    }
    return Math.max(-0.12, Math.min(0.06, sum*0.5*sc));
  }
  function ikRide(g, p, ud){
    const mode = ud.rideMode, R = Vehicles.RIDE[mode], sc = g.scale.y, steer = Math.max(-1, Math.min(1, Number(ud.vehicleSteer) || 0)), pitch = Number(ud.vehiclePitch) || 0;
    const seatZ = R.seat.z + (ud.rideShift || 0);
    for(let i = 0; i < 2; i++){
      const sd = SIDES[i], sx = sideSign(sd);
      Vehicles.grip(mode, sd, steer, pitch, IKP);
      IKP.x -= R.seat.x; IKP.y -= R.seat.y - 0.6; IKP.z -= seatZ; IKP.multiplyScalar(1/sc);                  // hệ toạ độ xe → hệ nhóm (trước scale)
      armTo(g, p, sd, IKP, IKQ.set(sx*0.9, -0.6, -0.3), mode === 'plane' ? (-sx*1.3) : -sx*0.35);
    }
  }
  // ====================== CÂU CÁ · 7 PHA BẰNG IK ======================
  // Mỗi tư thế = một mảng tham số (FI) rồi nội suy giữa các tư thế chuẩn theo thời gian:
  //   rx,ry,rz : lòng bàn tay PHẢI (tay cầm cần) so với vai phải, đơn vị "độ dài tay" ρ (rx ra ngoài · ry lên · rz ra trước) → mọi model cùng khuỷu gập như nhau
  //   pit,yaw,roll : hướng cần (độ): ngẩng lên · lệch ra ngoài · xoay quanh trục cần   bend : độ cong thân cần (rad)
  //   lean,twist,headX : thân ngả (+ ra trước) · thân xoay (+ vai cầm cần lùi sau) · cúi đầu (độ)
  //   kF,kB : góc gối chân TRƯỚC (đối diện tay cầm cần) / chân SAU (độ) · stance : khoảng cách hai bàn chân × bề vai · fz : bước chân trước tối thiểu · hop : nhún bật (thế giới)
  //   lx,ly,lz : tay TRÁI tự do so với vai trái (lx ra ngoài) · wC / wB : tay trái nắm núm quay máy / đuôi cần (phần còn lại = tự do) · gL,gR : độ nắm các ngón
  const FI = { rx:0, ry:1, rz:2, pit:3, yaw:4, roll:5, bend:6, lean:7, twist:8, headX:9, kF:10, kB:11, stance:12, fz:13, hop:14, lx:15, ly:16, lz:17, wC:18, wB:19, gL:20, gR:21 };
  const NF = 22, D2R = PI/180;
  const mkP = o => { const a = new Array(NF).fill(0); for(const k in o) a[FI[k]] = o[k]; return a; };
  const POSE = {
    // 1 · đi bộ / đứng cầm cần: cần ngẩng 42-52°, chéo ra ngoài hông ~15-18°, trọng tâm hạ ~5% (gối khuỵu nhẹ), tay trái buông lỏng
    carry: mkP({ rx:0.20, ry:-0.50, rz:0.40, pit:42, yaw:14, bend:0.03, lean:4, headX:6, lx:0.12, ly:-0.85, lz:0, gR:0.85, gL:0.2 }),
    walk:  mkP({ rx:0.20, ry:-0.60, rz:0.42, pit:52, yaw:18, bend:0.02, lean:3, headX:6, lx:0.12, ly:-0.85, lz:0, gR:0.85, gL:0.2 }),
    // 4 · chờ cá: hai chân rộng bằng vai, gối thả lỏng ~164° (nhún theo nhịp thở), cần ngẩng 20-30° về mặt nước, tay trái trên tay quay máy, mắt dõi phao
    ready: mkP({ rx:0.18, ry:-0.40, rz:0.46, pit:32, yaw:8, bend:0.04, lean:6, headX:10, kF:162, kB:162, stance:1.0, wC:1, gL:0.7, gR:0.85 }),
    wait:  mkP({ rx:0.18, ry:-0.40, rz:0.46, pit:25, yaw:8, bend:0.04, lean:6, headX:12, kF:164, kB:164, stance:1.0, wC:1, gL:0.7, gR:0.85 }),
    // 2 · chuẩn bị quăng: chân đối diện bước nửa bước lên, hai bàn chân 1,2× vai, gối 150-160°, cần ngả ra sau qua vai (đầu cần cong), tay trái đỡ đuôi cần
    back:  mkP({ rx:0.08, ry:0.02, rz:0.36, pit:115, yaw:5, bend:0.20, lean:-10, twist:22, headX:0, kF:166, kB:150, stance:1.2, fz:0.22, wB:1, gL:0.8, gR:0.9 }),
    // 3 · quăng: dồn lực chân sau → chân trước (gối trước gập), cần vung tới dừng ~45° về phía mặt nước
    rel:   mkP({ rx:0.15, ry:-0.05, rz:0.62, pit:45, yaw:8, bend:0.08, lean:12, twist:-18, headX:10, kF:140, kB:172, stance:1.2, fz:0.30, wB:0.3, lx:-0.40, ly:-0.55, lz:0.40, gL:0.5, gR:0.8 }),
    follow:mkP({ rx:0.18, ry:-0.30, rz:0.50, pit:40, yaw:8, bend:0.04, lean:8, twist:-8, headX:10, kF:150, kB:168, stance:1.1, fz:0.25, wC:0.6, lx:-0.40, ly:-0.55, lz:0.40, gL:0.6, gR:0.85 }),
    // 5 · giật cần: hai gối hạ nhanh xuống 130-140°, hai tay giật cần ngược ra sau qua vai, thân ngửa
    hook:  mkP({ rx:0.04, ry:-0.02, rz:0.42, pit:95, yaw:6, bend:0.30, lean:-14, twist:8, headX:-6, kF:135, kB:138, stance:1.05, wB:0.8, wC:0.2, gL:0.8, gR:0.9 }),
    // 6 · dìu cá: gối là giảm xóc, thân ngả sau, đuôi cần tì vào đùi/hông, cần cong như cánh cung, tay trái quay máy
    fight: mkP({ rx:0.00, ry:-0.28, rz:0.36, pit:55, yaw:4, bend:0.32, lean:-12, twist:4, headX:8, kF:150, kB:150, stance:1.05, fz:0.1, wC:1, gL:0.75, gR:0.9 }),
    hoist: mkP({ rx:0.06, ry:-0.15, rz:0.42, pit:68, yaw:2, bend:0.22, lean:-12, twist:0, headX:6, kF:148, kB:152, stance:1.1, fz:0.12, lx:-0.30, ly:-0.45, lz:0.62, wC:0.4, gL:0.4, gR:0.9 }),
    // 7 · bắt cá: gối trước khuỵu sâu, nâng cao cần, tay trái thò xuống đón cá → rồi giơ cả cần lẫn cá lên (tư thế chiến thắng)
    land:  mkP({ rx:0.20, ry:0.05, rz:0.52, pit:78, yaw:6, bend:0.15, lean:4, twist:-6, headX:14, kF:112, kB:152, stance:1.15, fz:0.30, lx:-0.25, ly:-0.42, lz:0.72, gL:0.35, gR:0.9 }),
    win:   mkP({ rx:0.35, ry:0.55, rz:0.25, pit:72, yaw:10, bend:0.12, lean:-6, twist:-6, headX:-4, kF:170, kB:170, stance:1.0, lx:0.40, ly:0.42, lz:0.22, gL:0.9, gR:0.9 })
  };
  const cpP = (a, o) => { for(let i = 0; i < NF; i++) o[i] = a[i]; return o; };
  const lerpP = (a, b, u, o) => { for(let i = 0; i < NF; i++) o[i] = a[i] + (b[i] - a[i])*u; return o; };
  const seqP = (K, t, o) => {
    let i = 0; while(i < K.length - 2 && t > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1]; return lerpP(a[1], b[1], smooth(Math.max(0, Math.min(1, (t - a[0])/(b[0] - a[0])))), o);
  };
  const CAST_K = [[0, POSE.ready], [0.30, POSE.back], [0.52, POSE.rel], [0.80, POSE.follow], [1.10, POSE.wait]];
  const REEL_K = [[0, POSE.fight], [FISH_T.fight, POSE.fight], [FISH_T.hoist, POSE.hoist], [FISH_T.land, POSE.land], [FISH_T.win, POSE.win], [FISH_T.total, POSE.win]];
  const FS = new Array(NF).fill(0);                                     // tư thế câu cá của khung hiện tại (dùng chung cho update → ikFish)
  function fishPose(a, t, mv, ws, tt){
    const o = FS;
    if(a === 'rod') lerpP(POSE.carry, POSE.walk, mv, o), o[FI.lz] += -ws*0.35*mv;           // tay trái đung đưa theo nhịp bước
    else if(a === 'fish') cpP(POSE.wait, o);
    else if(a === 'cast') seqP(CAST_K, t, o);
    else if(a === 'bite'){
      const k = t < 0.12 ? t/0.12 : Math.max(0, 1 - (t - 0.12)/0.55);                       // 0,12s bật gối + giật cần, rồi từ từ trả về
      lerpP(POSE.wait, POSE.hook, k, o); o[FI.bend] += Math.sin(t*22)*0.03*k;
    } else {
      seqP(REEL_K, t, o);
      const fw = Math.max(0, Math.min(1, (FISH_T.hoist - t)/(FISH_T.hoist - FISH_T.fight)));
      const rk = Math.max(0, 1 - t/FISH_T.fight), pull = Math.sin(t*11)*(0.35 + 0.65*rk)*fw;   // cá mệt dần (rk→0): giật yếu đi
      const up = (1 - rk)*10*fw, dn = 14*Math.max(0, pull);                                    // gối sâu hơn khi cá giật, nâng lên khi cá mệt
      o[FI.kF] += up - dn; o[FI.kB] += up - dn*0.7;
      o[FI.bend] += 0.10*Math.abs(pull); o[FI.ry] += pull*0.04*fw; o[FI.lean] -= 3*Math.max(0, pull)*fw;
      if(t > FISH_T.land + 0.05) o[FI.hop] = Math.abs(Math.sin((t - FISH_T.land - 0.05)*6.5))*0.05*Math.max(0, Math.min(1, (FISH_T.total - t)/0.25));   // nhún nhảy mừng
    }
    return o;
  }
  // Hai chân đứng bằng IK: chân trước (L) / chân sau (R) đặt đúng góc gối kF, kB; hạ hông xuống tự tính để bàn chân VẪN chạm đất.
  const _fa = v3(0, 0, 0);
  function fishLegs(group, p, P, bob){
    const D = dimsOf(p), sc = group.scale.y, T = D.thigh, S = D.shin, H0 = (D.hip.L.y + D.hip.R.y)/2, fz = P[FI.fz];
    const sep = Math.min(D.shoulderW, D.hipW*1.6)*P[FI.stance], dx = Math.abs(sep/2 - D.hipW/2);
    const df2 = T*T + S*S - 2*T*S*Math.cos(P[FI.kF]*D2R), db2 = T*T + S*S - 2*T*S*Math.cos(P[FI.kB]*D2R);
    const V = Math.min(Math.sqrt(Math.max(0, df2 - fz*fz - dx*dx)), Math.sqrt(Math.max(0, db2 - dx*dx)));          // hông cao hơn cổ chân bao nhiêu
    const zf = Math.sqrt(Math.max(0, df2 - V*V - dx*dx)), zb = Math.sqrt(Math.max(0, db2 - V*V - dx*dx));          // chân trước tới trước, chân sau lùi sau
    const drop = Math.max(0, H0 - D.ankleH - V) + bob;
    group.position.y = -drop*sc;
    for(let i = 0; i < 2; i++){
      const sd = SIDES[i], sx = sideSign(sd), front = sd === 'L';
      _fa.set(sx*sep/2, drop + D.ankleH, D.hip[sd].z + (front ? zf : -zb));
      legTo(p, sd, _fa, IKQ.set(sx*0.2, 0.2, 1));
      setFoot(p, sd, front ? -sx*0.05 : sx*0.3, 0);
    }
    return drop;
  }
  // khung cần (X = ngang, Y = "mặt trên" có khoen, Z = từ đuôi tới đầu cần). Tay phải nắm cán, tay trái theo wC/wB
  const _rt = v3(0, 0, 0), _sR = v3(0, 0, 0), _sL = v3(0, 0, 0), _tR = v3(0, 0, 0), _tL = v3(0, 0, 0), _bt = v3(0, 0, 0), _kn = v3(0, 0, 0), _fr = v3(0, 0, 0);
  function rodFrame(d, roll, X, Y, Z){
    Z.copy(d); X.set(0, 1, 0).cross(Z); if(X.lengthSq() < 1e-4) X.set(1, 0, 0); X.normalize(); Y.crossVectors(Z, X);
    if(roll){ const c = Math.cos(roll), s = Math.sin(roll); _fr.copy(X).multiplyScalar(c).addScaledVector(Y, s); Y.multiplyScalar(c).addScaledVector(X, -s); X.copy(_fr); }
  }
  function palmPos(g, p, side, out){                                      // lòng bàn tay thật (hệ nhóm)
    if(p.glb) return GLBChar.palm(g, p, side, out);
    p['fore' + side].updateWorldMatrix(true, false); out.set(0, -0.58, 0.02); p['fore' + side].localToWorld(out); return g.worldToLocal(out);
  }
  function ikFish(g, p, ud, P, dt){
    const D = dimsOf(p), rho = (D.upper + D.fore + palmOf(p))/0.98, R = RODS[ud.rodTier === 2 ? 2 : 1];
    const th = P[FI.pit]*D2R, ps = P[FI.yaw]*D2R, ct = Math.cos(th);
    _rt.set(Math.sin(ps)*ct, Math.sin(th), Math.cos(ps)*ct);
    if(!ud._rd) ud._rd = v3(0, 0, 0).copy(_rt);
    ud._rd.lerp(_rt, 1 - Math.exp(-Math.min(dt, 0.05)*22)).normalize();                // hướng cần đổi mượt (không giật khi đổi pha)
    const rf = ud._rf || (ud._rf = { X:v3(0, 0, 0), Y:v3(0, 0, 0), Z:v3(0, 0, 0) });
    rodFrame(ud._rd, P[FI.roll]*D2R, rf.X, rf.Y, rf.Z);
    shoulderPos(g, p, 'R', _sR); shoulderPos(g, p, 'L', _sL);
    _tR.set(_sR.x + P[FI.rx]*rho, _sR.y + P[FI.ry]*rho, _sR.z + P[FI.rz]*rho);          // R = +X → ra ngoài = +x
    _bt.copy(_tR).addScaledVector(rf.Z, -R.sR);                                          // đuôi cần
    let wC = P[FI.wC], wB = P[FI.wB]; const wt = wC + wB; if(wt > 1){ wC /= wt; wB /= wt; }
    const ph = ud._crank || 0;
    _kn.copy(_bt).addScaledVector(rf.Z, R.reel.z).addScaledVector(rf.Y, R.reel.y).addScaledVector(rf.X, R.knob.x)
       .addScaledVector(rf.Y, R.knob.r*Math.cos(ph)).addScaledVector(rf.Z, R.knob.r*Math.sin(ph));        // núm quay (xoay quanh trục máy)
    _tL.set(_sL.x - P[FI.lx]*rho, _sL.y + P[FI.ly]*rho, _sL.z + P[FI.lz]*rho).multiplyScalar(1 - wC - wB);   // L = −X → ra ngoài = −x
    _tL.addScaledVector(_kn, wC); _fr.copy(_bt).addScaledVector(rf.Z, R.sL); _tL.addScaledVector(_fr, wB);
    armTo(g, p, 'R', _tR, IKQ.set(0.6, -1.0, -0.5), -1.3);
    armTo(g, p, 'L', _tL, IKQ.set(-0.6, -1.0, -0.5), 0.9);
  }
  function update(group, dt, time){
    const ud = group.userData, p = ud.parts; if(!p) return;
    if(ud._ph === undefined){ ud._ph = Math.random()*10; ud.mv = 0; ud.yaw = ud.face || 0; ud.blinkAt = 1 + Math.random()*3; }
    const tgt = ud.moving ? 1 : 0;
    ud.mv += (tgt - ud.mv) * Math.min(1, dt*10);
    const run = !!ud.running && !!ud.moving;
    const mv = ud.mv, gait = run ? 12.2 : 8.4;
    ud.walkT += dt * (ud.moving ? gait : 0);
    const w = ud.walkT, sw = Math.sin(w) * (run ? 0.86 : 0.64) * mv;
    const idle = 1 - mv;
    const ph = ud._ph, tt = time + ph;

    // quay mặt mượt
    ud.yaw += wrap((ud.face || 0) - ud.yaw) * Math.min(1, dt*14);
    group.rotation.y = ud.yaw;
    group.position.y = Math.abs(Math.sin(w*2)) * (run ? 0.07 : 0.045) * mv;

    // reset pose cơ bản
    p.legL.rotation.set(sw, 0, 0);  p.legR.rotation.set(-sw, 0, 0);
    p.shinL.rotation.set(Math.max(0, -sw)*1.1 * (mv>0.01?1:0), 0, 0); p.shinR.rotation.set(Math.max(0, sw)*1.1 * (mv>0.01?1:0), 0, 0);
    // tay buông tự nhiên: vai hơi mở ra ngoài, khuỷu gập nhẹ, hai bên lệch pha nhau (trước đây tay duỗi thẳng đứng nên rất đơ)
    const openZ = 0.13, swayL = Math.sin(tt*0.9)*0.06*idle, swayR = Math.sin(tt*0.9 + 0.9)*0.06*idle;
    const aL = -sw*(run?1.0:0.9) - 0.13*idle + swayL, aR = sw*(run?1.0:0.9) - 0.13*idle + swayR;
    p.armL.rotation.set(aL, 0, p.armL.userData.restZ - openZ); p.armR.rotation.set(aR, 0, p.armR.userData.restZ + openZ);
    const elbow = 0.26*mv + 0.30*idle + (run ? 0.34 : 0);
    p.foreL.rotation.set(-0.14 - elbow - Math.max(0, -aL)*0.5, 0, 0.03); p.foreR.rotation.set(-0.14 - elbow - Math.max(0, -aR)*0.5, 0, -0.03);
    p.body.rotation.set(run ? -0.06*mv : -0.015*mv, Math.sin(w)*0.07*mv, Math.sin(w)*0.03*mv);
    p.body.scale.set(1, 1 + Math.sin(tt*2.2)*0.012*idle + Math.abs(Math.cos(w*2))*0.012*mv, 1);
    p.head.rotation.set(Math.sin(tt*1.1)*0.03*idle + (run?0.07:0.04)*mv, Math.sin(tt*0.6)*0.1*idle, -Math.sin(w)*0.025*mv);
    p.head.position.y = 2.38 + Math.sin(tt*2.2)*0.012*idle + Math.abs(Math.sin(w*2))*0.016*mv;

    // tóc đung đưa
    const sway = Math.sin(tt*2.0)*0.05*idle + Math.sin(w*2)*(run?0.17:0.11)*mv;
    if(p.tail){ p.tail.rotation.set(0.55 + 0.25*mv + sway, 0, Math.sin(w)*0.18*mv + Math.sin(tt*1.3)*0.04); }
    [p.tailL, p.tailR].forEach(t => { if(t) t.rotation.set(0.15 + 0.2*mv + sway, 0, t.userData.rz + Math.sin(w + (t===p.tailL?0:1.2))*0.15*mv); });

    // chớp mắt
    ud.blinkAt -= dt;
    let bl = 1;
    if(ud.blinkAt < 0){ const k = -ud.blinkAt; bl = k < 0.07 ? 1 - k/0.07*0.9 : (k < 0.14 ? 0.1 + (k-0.07)/0.07*0.9 : 1); if(k > 0.14) ud.blinkAt = 2 + Math.random()*3.5; }
    p.eyeL.scale.y = bl; p.eyeR.scale.y = bl;

    // ----- hành động -----
    let ik = null; p.footD = null; if(!p.grip) p.grip = { L:0, R:0 }; p.grip.L = p.grip.R = 0;                      // pose IK nào đang chạy (ikSit/ikRide/ikFish) · bàn chân do pose chỉ định
    // Đổi động tác (đứng → câu, chờ → cá cắn, quăng → chờ…): trộn 0.16s từ tư thế đang có sang tư thế mới
    // để cánh tay không bật một nấc. Ghi lại tư thế nền TRƯỚC khi khối động tác ghi đè.
    let blend = 1;
    if(ud.action){
      if(ud._actName !== ud.action){ ud._actName = ud.action; ud._actT = 0; }
      ud._actT = Math.min(1, ud._actT + dt/0.16);
      blend = ud._actT*ud._actT*(3 - 2*ud._actT);
      if(blend < 1){ const q0 = ud._q0 || (ud._q0 = {}); ACT_PARTS.forEach(n => { (q0[n] || (q0[n] = new THREE.Quaternion())).copy(p[n].quaternion); }); }
    } else ud._actName = null;
    if(ud.action){
      ud.actionT += dt;
      const t = ud.actionT, a = ud.action;
      if(a === 'jump'){
        const u = Math.min(1, t/0.8);
        group.position.y = 0;   // độ cao khi nhảy do vật lý trong game.js quyết định (trước đây cộng thêm 1.5 nên nhảy quá cao)
        p.legL.rotation.x = -0.55*Math.sin(u*PI); p.legR.rotation.x = -0.34*Math.sin(u*PI);   // hai chân lệch nhau cho tự nhiên
        p.shinL.rotation.x = 0.95*Math.sin(u*PI); p.shinR.rotation.x = 0.7*Math.sin(u*PI);
        p.armL.rotation.set(-2.45*Math.sin(u*PI), 0, 0.46); p.armR.rotation.set(-2.45*Math.sin(u*PI), 0, -0.46);
        p.foreL.rotation.set(-0.32*Math.sin(u*PI), 0, 0.05); p.foreR.rotation.set(-0.32*Math.sin(u*PI), 0, -0.05);
      } else if(a === 'sit'){
        // Ngồi ghế đá: mặt ghế cao 0.33 (three-scene.js). Hông đặt sát mặt ghế, đùi gần nằm ngang song song nhau, hai gối mở bằng
        // hông + chút ít (KHÔNG xoè, KHÔNG chụm), mũi gối hướng thẳng ra trước, gối ~95°, cẳng chân dựng đứng, bàn chân đặt PHẲNG trên sàn.
        // Hai bàn tay úp lên đùi (IK, xem ikSit). Mọi số đo lấy theo từng model nên nam/nữ đều đúng.
        const br = Math.sin(tt*1.5)*0.010, sc = group.scale.y, hipW = 0.33 + 0.075;     // hông cách sàn 0.405 (thế giới)
        group.position.y = hipW - HIP_Y*sc + br;
        p.body.rotation.set(0.05 + br, 0, 0);
        p.head.rotation.set(-0.04, Math.sin(tt*0.7)*0.07, 0);
        legsSeated(p, hipW/sc, { beta:95 });
        p.grip.L = p.grip.R = 0.22;                                                    // bàn tay đặt lên đùi: các ngón hơi khum tự nhiên
        ik = 'sit';
        if(p.tail) p.tail.rotation.set(0.35, 0, Math.sin(tt*1.2)*0.05);
      } else if(a === 'lotus'){
        // ngồi xếp bằng dưới đất: hông sát mặt đất, hai đầu gối dang ra, cẳng chân vắt chéo trước người
        // (chân phải gác lên trên/phía trước, chân trái nằm dưới), hai tay đặt lên đầu gối, lưng thẳng, thở nhẹ
        const br = Math.sin(tt*1.5)*0.010;
        p.legR.rotation.set(-1.569, 0.223, 0.379);   p.shinR.rotation.set(1.240, 0.058, -1.545);
        p.legL.rotation.set(-1.567, -0.246, -0.371); p.shinL.rotation.set(1.269, 0.684, 1.492);
        p.armR.rotation.set(0.20, 0, -0.22);         p.foreR.rotation.set(-1.28, 0, 0);
        p.armL.rotation.set(0.20, 0, 0.22);          p.foreL.rotation.set(-1.28, 0, 0);
        p.body.rotation.set(0.05 + br*2, 0, 0);
        p.head.rotation.set(-0.03, Math.sin(tt*0.7)*0.06, 0);
        if(p.tail) p.tail.rotation.set(0.35, 0, Math.sin(tt*1.2)*0.05);
        // đặt điểm thấp nhất của chân/váy chạm đúng mặt đất (sau khi đã set pose)
        const key = p.glb ? p.glb.model : (ud.def || p.body);
        let low = restCache.get(key);
        if(low === undefined){ low = lowestLocalY(group, p); restCache.set(key, low); }
        group.position.y = -low * group.scale.y + br;
      } else if(a === 'ride'){
        // Tư thế lái xe, lái máy bay và ngồi cabin tách riêng; giữ nguyên các pivot để không ảnh hưởng animation cũ.
        const mode = ud.rideMode || 'ferris';
        const steer = Math.max(-1,Math.min(1,Number(ud.vehicleSteer)||0));
        const speed = Math.min(1,Math.abs(Number(ud.vehicleSpeed)||0)/12);
        const br = Math.sin(tt*2.4)*0.008 + Math.sin(tt*18)*speed*0.004;
        group.position.y = br;
        if((mode === 'car' || mode === 'plane') && typeof Vehicles !== 'undefined'){
          // Lái xe / lái máy bay: hông đúng mặt ghế, bàn chân đặt phẳng trên sàn (xe) hoặc trên bàn đạp (máy bay), hai bàn tay NẮM đúng
          // vô-lăng / tay cầm yoke (IK theo vị trí thật của vật điều khiển: Vehicles.grip), lưng thẳng, mắt nhìn phía trước.
          const R = Vehicles.RIDE[mode], sc = group.scale.y, pitch = Number(ud.vehiclePitch) || 0;
          const dm = dimsOf(p); if(!ud._slide || ud._slide.d !== dm || ud._slide.m !== mode) ud._slide = { d:dm, m:mode, s:rideSlide(p, mode, sc) };
          ud.rideShift = ud._slide.s;                                                                  // chỉnh ghế theo kích thước model (game.js đọc để đặt ghế)
          p.body.rotation.set(0.05 + br + (mode === 'plane' ? pitch*0.12 : 0), -steer*0.04, -steer*0.05);
          p.head.rotation.set(-0.02 - (mode === 'plane' ? pitch*0.2 : 0), steer*0.10, -steer*0.02);
          if(mode === 'car'){
            legsSeated(p, (R.seat.y - 0.6 + HIP_Y*sc - R.floorY)/sc, { beta:95, toeDown:0.08 + speed*0.22, toeSide:'R' });   // chân phải hơi ấn ga theo tốc độ
          } else {
            // chân duỗi tới hai bàn đạp (gối hướng lên + ra trước), bàn chân nằm trên mặt bàn đạp
            const D = dimsOf(p), P0y = R.seat.y - 0.6;
            for(let i = 0; i < 2; i++){
              const sd = SIDES[i], pd = R.pedals[i], sy = Math.cos(pd.tilt), sz = Math.sin(pd.tilt);
              // mặt trên bàn đạp có pháp tuyến (0, cos, sin); gót chân cách bi bàn chân ~0.6 chiều dài bàn chân về phía sau; cổ chân cao hơn đế ankleH
              IKP.set((pd.x - R.seat.x)/sc, (pd.y - P0y)/sc + 0.02, (pd.z - R.seat.z - ud.rideShift)/sc);
              IKP.y += sy*D.ankleH; IKP.z += sz*D.ankleH;
              IKP.y += sz*D.toeLen*0.6; IKP.z -= sy*D.toeLen*0.6;
              // chân dài / ngắn: trượt cổ chân dọc tấm bàn đạp để gối gập ≈ 120° (không bị co quá hoặc duỗi thẳng)
              const hp = D.hip[sd], dyy = IKP.y - hp.y, dxx = IKP.x - hp.x, wl = D.thigh*D.thigh + D.shin*D.shin + D.thigh*D.shin;   // cos120° = -1/2
              const zT = hp.z + Math.sqrt(Math.max(0, wl - dyy*dyy - dxx*dxx));
              IKP.z += Math.max(-0.12, Math.min(0.24, zT - IKP.z));
              legTo(p, sd, IKP, IKQ.set(sideSign(sd)*0.15, 0.9, 0.6));
              setFoot(p, sd, 0, pd.tilt);
            }
          }
          p.grip.L = p.grip.R = mode === 'plane' ? 0.85 : 0.8;                           // nắm chặt vành vô-lăng / tay cầm yoke
          ik = 'ride';
        } else if(mode === 'car'){
          // (dự phòng khi chưa nạp js/vehicles.js) đùi ngang, cẳng chân dựng đứng
          p.legL.rotation.set(-1.55, 0, -0.12); p.legR.rotation.set(-1.55, 0, 0.12);
          p.shinL.rotation.set(1.52, 0, 0);     p.shinR.rotation.set(1.52, 0, 0);
          p.armL.rotation.set(-0.56, 0, 0.58);  p.armR.rotation.set(-0.56, 0, -0.58);
          p.foreL.rotation.set(-1.20, 0, 0.10); p.foreR.rotation.set(-1.20, 0, -0.10);
          p.body.rotation.set(0.10 + br, 0, 0);
        } else {
          p.legL.rotation.set(-1.52, 0, -0.12); p.legR.rotation.set(-1.52, 0, 0.12);
          p.shinL.rotation.set(1.46, 0, 0);     p.shinR.rotation.set(1.46, 0, 0);
          // Tay thả lỏng trên đùi khi ngồi cabin đu quay, thở nhẹ cho đỡ đơ.
          const s2 = Math.sin(tt*2.2)*0.025;
          p.armL.rotation.set(0.06 + s2, 0, 0.24); p.armR.rotation.set(0.06 - s2, 0, -0.24);
          p.foreL.rotation.set(-0.72, 0, 0.06); p.foreR.rotation.set(-0.72, 0, -0.06);
          p.body.rotation.set(0.08 + br, 0, 0);
          p.head.rotation.set(-0.025, Math.sin(tt*0.7)*0.05, 0);
        }
        if(p.tail) p.tail.rotation.set(0.5, 0, Math.sin(tt*2)*0.06);
      } else if(a === 'wave'){
        p.armR.rotation.set(-2.7, 0, -0.25 + Math.sin(t*9)*0.12);
        p.foreR.rotation.x = -0.3 + Math.sin(t*9)*0.4;
        p.head.rotation.z = 0.08; p.body.rotation.z = Math.sin(t*3)*0.02;
      } else if(a === 'cry'){
        p.armL.rotation.set(-2.1, 0, 0.5); p.armR.rotation.set(-2.1, 0, -0.5);
        p.foreL.rotation.x = -1.6; p.foreR.rotation.x = -1.6;
        p.head.rotation.x = 0.25; p.body.rotation.z = Math.sin(t*14)*0.03; p.eyeL.scale.y = 0.45; p.eyeR.scale.y = 0.45;
      } else if(a.startsWith('dance')){
        const n = +a.slice(5) || 1, bt = t*(4.5 + n*0.3);        // 'dance' (không số) = điệu duy nhất
        group.position.y = Math.abs(Math.sin(bt*2)) * 0.28;
        p.armL.rotation.set(-1.7 + Math.sin(bt)*0.8, 0, 0.5 + Math.sin(bt)*0.4);
        p.armR.rotation.set(-1.7 + Math.cos(bt)*0.8, 0, -0.5 - Math.cos(bt)*0.4);
        p.foreL.rotation.x = -0.6 - Math.sin(bt*2)*0.5; p.foreR.rotation.x = -0.6 + Math.sin(bt*2)*0.5;
        p.legL.rotation.x = Math.sin(bt)*0.5; p.legR.rotation.x = -Math.sin(bt)*0.5;
        p.shinL.rotation.x = Math.max(0, -Math.sin(bt))*0.9; p.shinR.rotation.x = Math.max(0, Math.sin(bt))*0.9;
        p.body.rotation.z = Math.sin(bt)*0.12; p.head.rotation.z = -Math.sin(bt)*0.12;
        p.body.scale.y = 1 + Math.sin(bt*2)*0.04;
        group.rotation.y = ud.yaw + Math.sin(bt*0.7)*0.7;
        if(p.tail) p.tail.rotation.x = 0.4 + Math.sin(bt*2)*0.25;
      } else if(a === 'holla'){
        p.armL.rotation.set(-2.8, 0, 0.2); p.armR.rotation.set(-2.8, 0, -0.2);
        p.foreL.rotation.x = -0.2; p.foreR.rotation.x = -0.2;
        group.position.y = Math.abs(Math.sin(t*8))*0.2;
      }
      // ---------- CÂU CÁ: 7 pha — đi · chuẩn bị · ném · chờ · giật · dìu cá · bắt cá (IK, xem khối "CÂU CÁ" phía trên) ----------
      else if(a === 'rod' || a === 'fish' || a === 'bite' || a === 'reel' || a === 'cast'){
        const ws = Math.sin(w)*0.7, P = fishPose(a, t, mv, ws, tt), sc = group.scale.y;
        p.body.rotation.set(P[FI.lean]*D2R, P[FI.twist]*D2R, 0);
        p.head.rotation.set(P[FI.headX]*D2R, -P[FI.twist]*D2R*0.7 + Math.sin(tt*0.5)*0.05, 0);          // thân xoay thì đầu giữ hướng nhìn mặt nước
        if(a === 'rod'){
          // đi bộ cầm cần: gối khuỵu nhẹ theo nhịp bước (FK), hạ hông tương ứng ~5% chiều cao để bàn chân vẫn chạm đất
          const D = dimsOf(p), tL = -0.20 + ws, tR = -0.20 - ws, sL = 0.36 + Math.max(0, -ws)*0.9, sR = 0.36 + Math.max(0, ws)*0.9;
          p.legL.rotation.set(tL, 0, -0.06); p.legR.rotation.set(tR, 0, 0.06);
          p.shinL.rotation.set(sL, 0, 0);    p.shinR.rotation.set(sR, 0, 0);
          const vL = D.thigh*Math.cos(tL) + D.shin*Math.cos(tL + sL), vR = D.thigh*Math.cos(tR) + D.shin*Math.cos(tR + sR);
          group.position.y = -((D.thigh + D.shin) - Math.max(vL, vR))*sc + Math.abs(Math.sin(w*2))*0.02*mv;
        } else {
          fishLegs(group, p, P, a === 'fish' ? Math.sin(tt*1.6)*0.012 : 0);                              // gối nhún theo nhịp thở khi chờ
          group.position.y += P[FI.hop];
        }
        p.grip.R = P[FI.gR]; p.grip.L = P[FI.gL];
        ud.rodBend = P[FI.bend];
        if(a === 'reel' && t < FISH_T.lift) ud._crank = ((ud._crank || 0) + dt*10) % (PI*2);              // tay trái quay máy ~1,6 vòng/giây
        ik = 'fish';
      }
    }
    // IK tay: thân + chân đã đặt xong → (GLB) đồng bộ xương để biết vai thật đang ở đâu rồi mới chỉnh tay
    if(ik){
      if(p.glb) GLBChar.sync(group, p);
      if(ik === 'sit') ikSit(group, p);
      else if(ik === 'ride') ikRide(group, p, ud);
      else if(ik === 'fish') ikFish(group, p, ud, FS, dt);
    }
    // trộn tư thế nền → tư thế động tác trong 0.16s đầu (xem khối "hành động" ở trên)
    if(ud.action && blend < 1){
      const q0 = ud._q0;
      ACT_PARTS.forEach(n => { _qb.copy(p[n].quaternion); p[n].quaternion.copy(q0[n]).slerp(_qb, blend); });
    }
    // model GLB: đưa pose của các pivot sang xương thật (trước updateGear để cần câu bám đúng bàn tay)
    if(p.glb) GLBChar.sync(group, p);
    // dây câu + phao + cá + gợn nước (vẽ sau khi pose để đầu cần đúng chỗ)
    updateGear(group, p, ud, dt, time);
  }

  // ====================== ẢNH XEM TRƯỚC (màn chọn nhân vật) ======================
  let pR = null, pScene = null, pCam = null;
  const pCache = {};
  function preview(gender, idx, w, h){
    w = w || 128; h = h || 160;
    const key = gender + idx + ':' + w + 'x' + h;
    if(pCache[key]) return pCache[key];
    try{
      if(!pR){
        pR = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true });
        GFX.setupRenderer(pR, { tone:false });
        pR.setPixelRatio(1); pR.setClearColor(0x000000, 0);
        pScene = new THREE.Scene();
        pScene.add(new THREE.AmbientLight(0xffffff, 0.95*GFX.LI));
        const d = new THREE.DirectionalLight(0xfff2dd, 0.65*GFX.LI); d.position.set(3, 6, 8); pScene.add(d);
        pCam = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
      }
      pR.setSize(w, h); pCam.aspect = w/h; pCam.updateProjectionMatrix();
      pCam.position.set(0, 2.0, 9.0); pCam.lookAt(0, 1.85, 0);
      const b = build(gender, idx); b.group.rotation.y = -0.38;
      b.group.userData.parts = b.parts; b.group.userData.walkT = 0;
      update(b.group, 0.016, 0.0); b.group.rotation.y = -0.38;
      pScene.add(b.group); pR.render(pScene, pCam);
      const url = pR.domElement.toDataURL('image/png');
      pScene.remove(b.group);
      return (pCache[key] = url);
    }catch(e){ console.warn('GChar.preview lỗi:', e); return null; }
  }

  function clearPreview(){ Object.keys(pCache).forEach(k => { delete pCache[k]; }); }
  return { DEFS, build, update, preview, clearPreview };
})();
