/* ===== GCITY 3D — Lớp VẬT LÝ (rigid-body nhẹ, không thư viện ngoài) =====
 * Áp cho cả bản r186 (ES module) và bản r128 (three.min.js) vì chỉ dùng API THREE cơ bản.
 *
 *  · driveCar(r, dt, inp)  — xe: lực kéo, phanh/lùi, cản gió, góc lái giảm theo tốc độ,
 *                            bám ngang (drift), nghiêng thân xe, nảy khi đâm tường.
 *  · flyPlane(r, dt, inp)  — máy bay: lực nâng theo tốc độ, mất tốc độ thì chúi/rơi,
 *                            nghiêng cánh + quay mũi phối hợp, chạm đất nảy nhẹ.
 *  · props                 — thùng phuy / thùng gỗ / cọc nón: rơi, lăn, ma sát,
 *                            va chạm với nhà–cây–đèn–ghế, với nhau, với xe và với người.
 *
 * Va chạm tĩnh lấy từ dữ liệu zone của Scene3D (toà nhà, cây, đèn, ghế, bồn hoa, đài phun nước…).
 */
const Phys = (() => {
  const GRAV = 20;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const PLANE = { GROUND: 0.03, MAX_ALT: 50, LIMIT: 52, LIMIT_IN: 49.5, REV: 0.45, VS: 12, BANK: 0.52, PITCH: 0.28 };

  // ================= STATIC COLLIDERS =================
  const solidCache = {};
  function solids(zoneId) {
    if (solidCache[zoneId]) return solidCache[zoneId];
    const zone = (typeof Scene3D !== 'undefined' && Scene3D.getZone) ? Scene3D.getZone(zoneId) : null;
    const out = [];
    if (!zone) return (solidCache[zoneId] = out);
    const rect = (kind, x, z, hw, hd, ry, y0, y1) => out.push({ kind, x, z, hw, hd, ry: ry || 0, y0, y1 });
    const circ = (kind, x, z, r, y0, y1) => out.push({ kind, x, z, r, y0, y1 });

    (zone.buildings || []).forEach(b => {
      const swap = Math.abs(Math.sin(b.ry || 0)) > 0.5;   // toà xoay 90°: w/d hoán đổi như bản dựng hình
      rect('building', b.x, b.z, (swap ? b.d : b.w) / 2, (swap ? b.w : b.d) / 2, 0, 0.45, 0.45 + b.h + 0.32);
    });
    (zone.trees || []).forEach(t => circ('tree', t.x, t.z, 0.34, 0, 2.45));
    (zone.lamps || []).forEach(l => circ('lamp', l.x, l.z, 0.26, 0, 4.9));
    (zone.benches || []).forEach(b => rect('bench', b.x, b.z + 0.05, 1.0, 0.3, b.ry || 0, 0, 0.62 + ((typeof Scene3D !== 'undefined' && Scene3D.benchBase) ? Scene3D.benchBase(b) : 0)));   // ghế đứng trên sân gạch → đỉnh ghế cao thêm đúng bằng độ cao nền
    (zone.flowers || []).forEach(f => rect('flowerbed', f.x, f.z, 1.6, 0.75, 0, 0, 1.15));
    if (zone.fountain) circ('fountain', zone.fountain.x, zone.fountain.z, (typeof Fountain !== 'undefined' && Fountain.RADIUS) || 3.2, 0, 5.1);
    if (zone.screen) rect('screen', zone.screen.x, zone.screen.z, zone.screen.w / 2 + 0.4, 0.5, 0, 0, zone.screen.y + zone.screen.h);
    solidCache[zoneId] = out;
    return out;
  }
  function clearSolids() { Object.keys(solidCache).forEach(k => delete solidCache[k]); }

  // hình tròn (x,z,r) vs hình chữ nhật xoay (tâm, nửa cạnh, góc)
  function circleRect(s, x, z, r) {
    const c = Math.cos(s.ry), sn = Math.sin(s.ry);
    const dx = x - s.x, dz = z - s.z;
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    const px = clamp(lx, -s.hw, s.hw), pz = clamp(lz, -s.hd, s.hd);
    let ex = lx - px, ez = lz - pz, d = Math.hypot(ex, ez), nx, nz, pen;
    if (d > 1e-6) {
      if (d > r) return null;
      nx = ex / d; nz = ez / d; pen = r - d;
    } else {                                   // tâm nằm trong hộp → đẩy ra theo cạnh gần nhất
      const ox = s.hw - Math.abs(lx), oz = s.hd - Math.abs(lz);
      if (ox < oz) { nx = lx < 0 ? -1 : 1; nz = 0; pen = ox + r; }
      else { nx = 0; nz = lz < 0 ? -1 : 1; pen = oz + r; }
    }
    return { nx: nx * c + nz * sn, nz: -nx * sn + nz * c, pen, kind: s.kind };
  }
  function circleCircle(s, x, z, r) {
    const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz), sum = s.r + r;
    if (d >= sum) return null;
    if (d < 1e-6) return { nx: 1, nz: 0, pen: sum, kind: s.kind };
    return { nx: dx / d, nz: dz / d, pen: sum - d, kind: s.kind };
  }
  // va chạm sâu nhất của một hình tròn với thế giới tĩnh (chỉ xét vật nằm trong khoảng cao y0..y1)
  function resolveCircle(zoneId, x, z, r, y0, y1) {
    let best = null;
    const list = solids(zoneId);
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (y1 < s.y0 || y0 > s.y1) continue;
      const h = s.r != null ? circleCircle(s, x, z, r) : circleRect(s, x, z, r);
      if (h && (!best || h.pen > best.pen)) best = h;
    }
    // xe/máy bay đang đỗ trong bãi cũng là vật cản
    if (typeof Scene3D !== 'undefined' && Scene3D.getLotSlots) {
      for (const slot of Scene3D.getLotSlots() || []) {
        const m = slot.mesh;
        if (!m || !m.visible) continue;
        const rad = (slot.kind === 'plane' ? 1.5 : 1.15) + r;
        const dx = x - m.position.x, dz = z - m.position.z, d = Math.hypot(dx, dz);
        if (d < rad && (!best || rad - d > best.pen)) {
          best = d < 1e-6 ? { nx: 1, nz: 0, pen: rad, kind: 'parked' }
                          : { nx: dx / d, nz: dz / d, pen: rad - d, kind: 'parked' };
        }
      }
    }
    return best;
  }
  function boundaryHit(zoneId, x, z, r) {
    const zone = Scene3D.getZone(zoneId); if (!zone) return null;
    const half = (zone.size || 104) / 2;
    if (Math.hypot(x, z) > (zone.island ? 999 : 53) - r) return { nx: -x, nz: -z, pen: 0.2, kind: 'boundary' };
    if (Math.abs(x) > half - r) return { nx: x > 0 ? -1 : 1, nz: 0, pen: Math.abs(x) - (half - r), kind: 'boundary' };
    if (Math.abs(z) > half - r) return { nx: 0, nz: z > 0 ? -1 : 1, pen: Math.abs(z) - (half - r), kind: 'boundary' };
    return null;
  }
  function normalizeHit(h) {
    if (!h) return h;
    const d = Math.hypot(h.nx, h.nz) || 1;
    return { nx: h.nx / d, nz: h.nz / d, pen: h.pen || 0, kind: h.kind };
  }

  // ================= ĐỘNG: THÙNG / KIỆN / CỌC NÓN =================
  const props = [];
  let propGroup = null, propZone = 'plaza';
  const PROP_DEFS = [
    { kind: 'barrel', x: 7.4, z: 6.6 }, { kind: 'barrel', x: 8.5, z: 7.4 }, { kind: 'barrel', x: 6.8, z: 8.3 },
    { kind: 'crate', x: -8.6, z: -6.4 }, { kind: 'crate', x: -9.4, z: -5.7 }, { kind: 'crate', x: -8.2, z: -5.4 },
    { kind: 'barrel', x: 16.4, z: -13.5 }, { kind: 'crate', x: 17.4, z: -12.8 },
    { kind: 'cone', x: -4.2, z: 18.5 }, { kind: 'cone', x: -2.6, z: 19.4 }, { kind: 'cone', x: -8.5, z: 20.2 },
    { kind: 'barrel', x: -18.5, z: 15.5 }, { kind: 'crate', x: -19.4, z: 16.4 }
  ];

  function mat(c) { return new THREE.MeshLambertMaterial({ color: c }); }
  function buildMesh(kind) {
    const g = new THREE.Group();
    if (kind === 'barrel') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 14), mat(0xd9534f));
      body.castShadow = true; g.add(body);
      [-0.26, 0.26].forEach(y => {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.07, 14), mat(0x35414f));
        ring.position.y = y; g.add(ring);
      });
      g.userData.h = 1.0; g.userData.r = 0.44; g.userData.m = 28;
    } else if (kind === 'crate') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.82, 0.82), mat(0xb98c52));
      box.castShadow = true; g.add(box);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.12, 0.86), mat(0x8a6538));
      edge.position.y = 0.3; g.add(edge); const e2 = edge.clone(); e2.position.y = -0.3; g.add(e2);
      g.userData.h = 0.82; g.userData.r = 0.5; g.userData.m = 22;
    } else {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.75, 12), mat(0xf28c28));
      cone.position.y = 0.3; cone.castShadow = true; g.add(cone);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.56), mat(0xd8641c));
      g.add(base); g.userData.h = 0.75; g.userData.r = 0.34; g.userData.m = 5;
    }
    return g;
  }
  function initProps(scene) {
    if (propGroup) { scene.add(propGroup); return; }
    propGroup = new THREE.Group();
    scene.add(propGroup);
    PROP_DEFS.forEach(def => {
      const mesh = buildMesh(def.kind);
      const p = { kind: def.kind, mesh, x: def.x, z: def.z, y: 0, vx: 0, vz: 0, vy: 0,
                  r: mesh.userData.r, h: mesh.userData.h, m: mesh.userData.m, spin: Math.random() * 6, roll: 0 };
      // không sinh ra bên trong vật cản: đẩy ra ngoài nếu lỡ rơi vào
      const hit = normalizeHit(resolveCircle('plaza', p.x, p.z, p.r, 0, p.h));
      if (hit) { p.x += hit.nx * (hit.pen + 0.05); p.z += hit.nz * (hit.pen + 0.05); }
      mesh.position.set(p.x, p.h / 2, p.z);
      propGroup.add(mesh);
      props.push(p);
    });
  }
  function setZone(zoneId) {
    propZone = zoneId;
    if (propGroup) propGroup.visible = zoneId === 'plaza';
  }

  function stepProps(dt, ctx) {
    if (!propGroup || !props.length) return;
    const zone = propZone;
    // --- tích phân + ma sát + va chạm tĩnh
    for (const p of props) {
      p.vy -= GRAV * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = p.vy < -1.4 ? -p.vy * 0.28 : 0; }
      const sp = Math.hypot(p.vx, p.vz);
      if (sp > 0.001 && p.y <= 0.002) {           // ma sát mặt sàn
        const k = Math.max(0, sp - (4.2 * dt)) / sp;
        p.vx *= k; p.vz *= k;
      }
      p.x += p.vx * dt; p.z += p.vz * dt;
      const hit = normalizeHit(resolveCircle(zone, p.x, p.z, p.r, p.y, p.y + p.h) || boundaryHit(zone, p.x, p.z, p.r));
      if (hit) {
        p.x += hit.nx * (hit.pen + 0.002); p.z += hit.nz * (hit.pen + 0.002);
        const vn = p.vx * hit.nx + p.vz * hit.nz;
        if (vn < 0) { p.vx -= 1.35 * vn * hit.nx; p.vz -= 1.35 * vn * hit.nz; }   // nảy nhẹ
      }
      if (Math.hypot(p.vx, p.vz) < 0.02) { p.vx = 0; p.vz = 0; }
    }
    // --- va chạm giữa các vật thể với nhau (bảo toàn động lượng)
    for (let i = 0; i < props.length; i++) {
      for (let j = i + 1; j < props.length; j++) {
        const a = props[i], b = props[j];
        if (Math.abs(a.y - b.y) > (a.h + b.h) * 0.55) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), sum = a.r + b.r;
        if (d >= sum || d < 1e-6) continue;
        const nx = dx / d, nz = dz / d, pen = sum - d;
        const ma = a.m, mb = b.m, tot = ma + mb;
        a.x -= nx * pen * (mb / tot); a.z -= nz * pen * (mb / tot);
        b.x += nx * pen * (ma / tot); b.z += nz * pen * (ma / tot);
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rel < 0) {
          const jimp = -(1 + 0.35) * rel / (1 / ma + 1 / mb);
          a.vx -= jimp * nx / ma; a.vz -= jimp * nz / ma;
          b.vx += jimp * nx / mb; b.vz += jimp * nz / mb;
        }
      }
    }
    // --- người chơi đẩy vật (đi bộ đụng vào là xô đi)
    const pl = ctx && ctx.player;
    if (pl) {
      const pvx = (ctx.playerVel && ctx.playerVel.x) || 0, pvz = (ctx.playerVel && ctx.playerVel.z) || 0;
      for (const p of props) {
        const dx = p.x - pl.x, dz = p.z - pl.z, d = Math.hypot(dx, dz), sum = p.r + 0.42;
        if (d < sum && d > 1e-4 && p.y < 2) {
          const nx = dx / d, nz = dz / d, push = (sum - d) * 2.4 + Math.hypot(pvx, pvz) * 0.9;
          p.vx += nx * push * 0.35 + pvx * 0.28; p.vz += nz * push * 0.35 + pvz * 0.28;
          p.spin += push * 0.05;
        }
      }
    }
    // --- xe tông vào vật: vật bị hất văng, xe chậm lại một chút
    const veh = ctx && ctx.vehicle;
    if (veh) {
      const c = Math.cos(veh.yaw), s = Math.sin(veh.yaw);
      const halfL = veh.type === 'plane' ? 2.6 : 2.35, halfW = veh.type === 'plane' ? 2.6 : 1.15;
      const vsp = Math.hypot(veh.vx || 0, veh.vz || 0);
      for (const p of props) {
        if (veh.type === 'plane' && veh.alt > p.h + 0.4) continue;
        const dx = p.x - veh.x, dz = p.z - veh.z;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        const ox = halfW + p.r - Math.abs(lx), oz = halfL + p.r - Math.abs(lz);
        if (ox <= 0 || oz <= 0) continue;
        // đẩy ra theo trục nông nhất
        let nx, nz;
        if (ox < oz) { nx = (lx < 0 ? -1 : 1) * c; nz = -(lx < 0 ? -1 : 1) * s; p.x += nx * ox; p.z += nz * ox; }
        else { nx = (lz < 0 ? -1 : 1) * s; nz = (lz < 0 ? -1 : 1) * c; p.x += nx * oz; p.z += nz * oz; }
        p.vx = (veh.vx || 0) * 1.35 + nx * (2.5 + vsp * 0.5);
        p.vz = (veh.vz || 0) * 1.35 + nz * (2.5 + vsp * 0.5);
        p.vy = Math.min(3.2, vsp * 0.28);
        p.spin += vsp * 0.12;
        if (veh.onHitProp) veh.onHitProp(p, vsp);
      }
    }
    // --- hiển thị
    for (const p of props) {
      const sp = Math.hypot(p.vx, p.vz);
      p.spin += sp * dt * 0.9;
      const lean = Math.min(0.7, sp * 0.07);
      const a = Math.atan2(p.vx, p.vz);
      p.mesh.position.set(p.x, p.y + p.h / 2, p.z);
      p.mesh.rotation.set(Math.cos(a) * lean, p.spin, -Math.sin(a) * lean);
    }
  }
  function resetProps() {
    props.forEach((p, i) => {
      const d = PROP_DEFS[i]; if (!d) return;
      p.x = d.x; p.z = d.z; p.y = 0; p.vx = p.vz = p.vy = 0;
    });
  }

  // ================= XE HƠI =================
  // r.speed = vận tốc dọc (m/s), r.vLat = vận tốc ngang cục bộ (trượt), r.vx/r.vz = vận tốc thế giới
  function driveCar(r, dt, inp) {
    const zone = inp.zone;
    if (r.vLat == null) { r.vLat = 0; r.vx = 0; r.vz = 0; }
    const fwd = { x: Math.sin(r.yaw), z: Math.cos(r.yaw) };
    const right = { x: Math.cos(r.yaw), z: -Math.sin(r.yaw) };
    let vF = r.vx * fwd.x + r.vz * fwd.z;
    let vS = r.vx * right.x + r.vz * right.z;

    // --- lực kéo / phanh / số lùi
    const ACC = 13.5, BRAKE = 20, REV = 7;
    if (inp.throttle > 0.05) vF += ACC * inp.throttle * dt;
    else if (inp.throttle < -0.05) {
      if (vF > 0.5) vF -= BRAKE * Math.abs(inp.throttle) * dt;      // đang chạy tới → phanh
      else vF += REV * inp.throttle * dt;                            // đã dừng → lùi
    }
    // --- cản gió + lực cản lăn
    vF -= vF * (0.30 + 0.030 * Math.abs(vF)) * dt;
    if (Math.abs(inp.throttle) < 0.05 && Math.abs(vF) < 0.12) vF = 0;
    vF = clamp(vF, -5.5, r.maxSpeed);

    // --- lái: góc lái giảm khi chạy nhanh (ổn định ở tốc độ cao)
    const steerAng = inp.steer * 0.60 * (1 - 0.55 * Math.min(1, Math.abs(vF) / 13));
    const yawRate = (vF / 2.45) * Math.tan(steerAng);
    r.yaw += yawRate * dt;

    // --- bám ngang: lốp giữ xe theo hướng mũi; vào cua gấp thì đuôi văng ra
    const grip = inp.handbrake ? 2.2 : 7.0;
    vS *= Math.exp(-grip * dt);
    vS += -yawRate * vF * dt * 0.30;
    vS = clamp(vS, -6, 6);

    r.vx = fwd.x * vF + right.x * vS;
    r.vz = fwd.z * vF + right.z * vS;

    // --- di chuyển + va chạm (nảy ra khỏi tường, trượt dọc tường)
    const solid = (px, pz) => !!Scene3D.aircraftCollision(zone, px, 0, pz, r.yaw, 0, 0, r.collisionBoxes);
    let x = r.v.position.x, z = r.v.position.z, impact = 0;
    const nx = x + r.vx * dt, nz = z + r.vz * dt;
    if (!solid(nx, z)) x = nx;
    else { impact = Math.max(impact, Math.abs(r.vx)); r.vx *= -0.30; r.vLat = 0; }
    if (!solid(x, nz)) z = nz;
    else { impact = Math.max(impact, Math.abs(r.vz)); r.vz *= -0.30; r.vLat = 0; }
    if (impact > 0.3) r.speedShake = Math.min(1, impact / 8);

    r.v.position.x = x; r.v.position.z = z;
    r.speed = r.vx * Math.sin(r.yaw) + r.vz * Math.cos(r.yaw);

    // --- thân xe nghiêng theo gia tốc (nhún giảm xóc)
    const latAcc = yawRate * r.speed;
    const rollT = clamp(-latAcc * 0.020, -0.13, 0.13);
    const pitchT = clamp((r.lastSpeed != null ? (r.speed - r.lastSpeed) / Math.max(dt, 1e-3) : 0) * 0.004, -0.09, 0.09);
    r.bank += (rollT - r.bank) * Math.min(1, dt * 7);
    r.pitch += (pitchT - r.pitch) * Math.min(1, dt * 6);
    r.lastSpeed = r.speed;
    r.v.rotation.set(r.pitch, r.yaw, r.bank, 'YXZ');
    return { impact: impact };
  }

  // ================= MÁY BAY =================
  function flyPlane(r, dt, inp) {
    const zone = inp.zone;
    if (r.vy == null) r.vy = 0;
    if (r.vx == null) { r.vx = 0; r.vz = 0; }
    // --- tốc độ không khí (có quán tính)
    const tgt = inp.throttle >= 0 ? inp.throttle * r.maxSpeed : inp.throttle * r.maxSpeed * PLANE.REV;
    r.speed += (tgt - r.speed) * Math.min(1, dt * (Math.abs(tgt) > Math.abs(r.speed) ? 2.2 : 3.4));
    if (Math.abs(tgt) < 0.01 && Math.abs(r.speed) < 0.12) r.speed = 0;

    const air = Math.abs(r.speed) / r.maxSpeed;              // 0..1 tỉ lệ tốc độ
    const lift = Math.min(1.2, air * air);                   // lực nâng ∝ tốc độ²
    const airborne = r.alt > 0.5;

    // --- độ cao: điều khiển mong muốn → gia tốc đứng; thiếu tốc độ thì chúi xuống (mất lực nâng)
    let vsTgt = 0;
    if (inp.climb) vsTgt = inp.climb * PLANE.VS * clamp(lift * 1.15, 0, 1);
    if (airborne && lift < 0.42) vsTgt -= (0.42 - lift) * 26;   // stall
    if (inp.autoDescend) vsTgt = -PLANE.VS * 0.75;
    r.vy += (vsTgt - r.vy) * Math.min(1, dt * (inp.climb || inp.autoDescend ? 3.0 : 1.7));
    r.alt += r.vy * dt;

    // --- chạm đất: nảy nhẹ nếu còn rơi nhanh
    if (r.alt <= PLANE.GROUND) {
      r.alt = PLANE.GROUND;
      if (r.vy < -3.5) { r.vy = -r.vy * 0.22; r.speed *= 0.86; r.speedShake = 0.6; }
      else r.vy = 0;
    }
    if (r.alt > PLANE.MAX_ALT) { r.alt = PLANE.MAX_ALT; r.vy = Math.min(0, r.vy); }

    // --- nghiêng cánh + quay mũi phối hợp (banked turn)
    const bankT = inp.steer * PLANE.BANK * (0.35 + Math.min(1, air));
    r.bank += (bankT - r.bank) * Math.min(1, dt * 3.5);
    r.yaw -= inp.steer * dt * (0.9 + 2.0 * Math.min(1, air));   // đánh mũi ngược dấu xe (camera đuổi sau lưng)
    // lực quán tính ngang: mũi quay trước, thân xe trượt theo một nhịp
    const fwd = { x: Math.sin(r.yaw), z: Math.cos(r.yaw) }, right = { x: Math.cos(r.yaw), z: -Math.sin(r.yaw) };
    const wantVx = fwd.x * r.speed, wantVz = fwd.z * r.speed;
    r.vx += (wantVx - r.vx) * Math.min(1, dt * 2.6);
    r.vz += (wantVz - r.vz) * Math.min(1, dt * 2.6);

    // --- pitch: mũi ngẩng khi lên, chúi khi xuống
    const pitchT = clamp((r.vy / PLANE.VS) * PLANE.PITCH, -PLANE.PITCH, PLANE.PITCH);
    r.pitch += (pitchT - r.pitch) * Math.min(1, dt * 4);

    // --- di chuyển + va chạm vật thể (toà nhà, đèn, cây…)
    const solid = (px, pz) => !!Scene3D.aircraftCollision(zone, px, r.alt, pz, r.yaw, -r.pitch, r.bank, r.flightBoxes);
    let x = r.v.position.x, z = r.v.position.z, impact = 0;
    const nx = x + r.vx * dt, nz = z + r.vz * dt;
    if (!solid(nx, z)) x = nx;
    else { impact = Math.max(impact, Math.abs(r.vx)); r.vx *= -0.22; }
    if (!solid(x, nz)) z = nz;
    else { impact = Math.max(impact, Math.abs(r.vz)); r.vz *= -0.22; }
    if (impact > 0.5) { r.speed *= 0.45; r.speedShake = Math.min(1, impact / 9); }
    const L = PLANE.LIMIT_IN, d = Math.hypot(x, z);
    if (d > L) { const k = L / d; x *= k; z *= k; }

    r.v.position.set(x, r.alt, z);
    r.v.rotation.set(-r.pitch, r.yaw, r.bank, 'YXZ');
    r.speed = r.vx * Math.sin(r.yaw) + r.vz * Math.cos(r.yaw);
    return { impact: impact, airborne: r.alt > 0.5 };
  }

  return { solids, resolveCircle, initProps, setZone, updateProps: stepProps, resetProps,
           driveCar, flyPlane, props, PLANE, clearSolids };
})();
