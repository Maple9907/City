/* ===== GCITY 3D - GLBChar: nhân vật 3D từ file GLB (glTF) =====
 * Thay "da" của nhân vật dựng bằng khối (js/character.js) bằng model GLB có xương, nhưng GIỮ NGUYÊN toàn bộ animation cũ
 * (đi / chạy / nhảy / ngồi ghế / ngồi xếp bằng / vẫy / buồn / nhảy múa / ăn mừng / lái xe / câu cá).
 *
 * Cách hoạt động (retarget):
 *   - character.js vẫn dựng bộ "xương giả" (các pivot body/head/armL/armR/foreL/foreR/legL/legR/shinL/shinR) và vẫn chạy
 *     GChar.update như cũ → mọi animation đã chỉnh tay giữ nguyên. Bộ pivot này KHÔNG có mesh nên vô hình.
 *   - Mỗi khung, GLBChar.sync() đọc góc quay của các pivot đó rồi quy ra góc quay (hệ toạ độ thế giới) cho xương GLB tương ứng.
 *     Công thức: QuayXương_thếgiới = ĐộLệchPivot × XoayVềTưThếThảXuống × QuayXương_lúcNghỉ  → không phụ thuộc T-pose hay A-pose,
 *     không phụ thuộc trục cục bộ của từng loại rig.
 *   - Tự nhận xương theo tên (Mixamo, Quaternius, KayKit, Unreal, Rigify...). Nhận không đủ → báo console và game dùng lại nhân vật cũ.
 *   - Tự co chân + phóng đầu theo tỉ lệ chibi để khớp chiều cao hông (1.2) mà ngồi ghế / xếp bằng / lái xe đã chỉnh sẵn.
 *
 * Cấu hình: GCITY_CONFIG.MODELS trong js/config.js  →  { 'male:0': { url:'models/male0.glb', ... } }
 *   url         đường dẫn GLB (bắt buộc)
 *   height      chiều cao mong muốn (đơn vị rig; nhân vật dựng sẵn cao ~3.45, mặc định 3.1)
 *   headScale   phóng đầu (mặc định 1.25; 1 = giữ nguyên)
 *   legScale    co chân (bỏ trống = tự tính để hông đúng 1.2; 1 = chân dài thật, ngồi ghế sẽ lệch)
 *   armScale    nhân thêm độ dài tay (bỏ trống = tự chuẩn hoá theo thân model; 1 = giữ tay gốc của file GLB)
 *   outline     viền toon (mặc định true)
 *   lift        độ sáng nền thêm 0..1 (mặc định 0.22; model tối thì tăng)
 *   gripAhead   chỉnh vị trí cầm cần câu so với cổ tay (mặc định 0.14)
 *   yaw         xoay thêm (rad). Bỏ trống = tự dò hướng mặt theo mũi chân
 *   bones       ép tên xương: { hips:'tên', ... } (chỉ cần khi tự nhận sai)
 *
 * API: GLBChar.preload() → Promise (không bao giờ reject) · GLBChar.ready(key) · GLBChar.attach(key, g, parts) · GLBChar.sync(g, parts)
 *      GLBChar.makeDriver(g) · GLBChar.lowestY(g, parts) · GLBChar.fail(key)
 */
const GLBChar = (() => {
  const HIP_Y = 1.2;                         // độ cao hông của rig dựng sẵn (pivot body / legL / legR)
  const ARM_RATIO = 0.86;                    // tay (vai → cổ tay) = 0.86 × thân (hông → vai) của CHÍNH model đó — nam/nữ lệch nhau tới 50% nên không thể dùng một con số cố định
  const DEFAULTS = { height:3.1, headScale:1.25, outline:true, lift:0.22, gripAhead:0.14, palm:0.12 };
  const models = {};                         // key → { cfg, scene, state:'loading'|'ready'|'failed', fit, mats, outlineMat }
  const listeners = [];                      // gọi khi 1 model sẵn sàng (kể cả về muộn sau preload) – dùng để vẽ lại ảnh chọn nhân vật
  const onReady = cb => { listeners.push(cb); };
  const cfgAll = () => (typeof GCITY_CONFIG !== 'undefined' && GCITY_CONFIG.MODELS) || {};
  const modern = () => !(typeof GFX !== 'undefined' && GFX.modern === false) && parseInt(THREE.REVISION, 10) >= 152;

  // ------------------------------------------------------------------ tải file
  function loadOne(key){
    const cfg = Object.assign({}, DEFAULTS, cfgAll()[key]);
    const m = models[key] = { cfg, state:'loading', scene:null, fit:null };
    return new Promise(resolve => {
      const done = (ok, why) => { if(!ok){ m.state = 'failed'; console.warn('[GLBChar] ' + key + ': dùng nhân vật dựng sẵn. Lý do: ' + why); } resolve(); };
      try{
        const loader = new THREE.GLTFLoader(); if(THREE.MeshoptDecoder && loader.setMeshoptDecoder) loader.setMeshoptDecoder(THREE.MeshoptDecoder);
        loader.load(cfg.url, gltf => {
          try{ prepare(m, gltf.scene); m.state = 'ready'; listeners.forEach(f => { try{ f(key); }catch(e){} }); resolve(); }
          catch(e){ done(false, e.message || e); }
        }, undefined, err => done(false, 'không tải được ' + cfg.url + ' (' + ((err && err.message) || err) + ')'));
      }catch(e){ done(false, e.message || e); }
    });
  }
  async function preload(){
    const keys = Object.keys(cfgAll()).filter(k => cfgAll()[k] && cfgAll()[k].url);
    if(!keys.length) return;
    try{ await (window.GLBLibs || Promise.resolve()); }catch(e){}
    if(!THREE.GLTFLoader || !THREE.SkeletonUtils){ console.warn('[GLBChar] thiếu GLTFLoader/SkeletonUtils → dùng nhân vật dựng sẵn'); return; }
    await Promise.race([ Promise.all(keys.map(loadOne)), new Promise(r => setTimeout(r, 12000)) ]);   // quá 12s thì bỏ qua, game vẫn chạy
    keys.forEach(k => { if(models[k] && models[k].state === 'loading') models[k].state = 'failed'; });
  }
  const ready = key => !!(models[key] && models[key].state === 'ready');
  const fail = key => { if(models[key]) models[key].state = 'failed'; };

  // ------------------------------------------------------------------ vật liệu: PBR → Lambert (nhẹ cho điện thoại) + viền toon
  function prepare(m, scene){
    const lift = m.cfg.lift, map = new Map();
    const conv = src => {
      if(map.has(src)) return map.get(src);
      const n = new THREE.MeshLambertMaterial({ color:src.color ? src.color.clone() : 0xffffff, map:src.map || null, transparent:!!src.transparent,
        opacity:src.opacity === undefined ? 1 : src.opacity, alphaTest:src.alphaTest || 0, side:src.side, vertexColors:!!src.vertexColors });
      if(n.map && !modern()){                                                                                  // luồng màu kiểu r128: texture coi như đã là màu hiển thị
        if(parseInt(THREE.REVISION, 10) < 152) n.map.encoding = THREE.LinearEncoding; else n.map.colorSpace = THREE.NoColorSpace;
      }
      if(lift > 0){                                                                                          // nâng sáng đều, khỏi bị tối mặt khuất (giữ đúng sắc màu vật liệu)
        if(n.map){ n.emissive.setRGB(lift, lift, lift); n.emissiveMap = n.map; } else n.emissive.copy(n.color).multiplyScalar(lift);
      }
      n.name = src.name; map.set(src, n); return n;
    };
    scene.traverse(o => { if(o.isMesh){ o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material); o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; } });
    m.scene = scene;
  }
  function makeOutlineMat(thick){
    const mt = new THREE.MeshBasicMaterial({ color:0x2b2236, side:THREE.BackSide });
    mt.onBeforeCompile = sh => {
      sh.uniforms.uThick = { value:thick };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uThick;')
        .replace('#include <skinning_vertex>', '#include <skinning_vertex>\n  transformed += normalize(objectNormal) * uThick;');
    };
    mt.customProgramCacheKey = () => 'gcity-glb-outline';
    return mt;
  }

  // ------------------------------------------------------------------ nhận diện xương theo tên
  const IGNORE = new Set(['mixamorig','def','org','mch','bip01','bip001','cc','base','armature','rig','jnt','joint','bone','skeleton','metarig','ctrl']);
  const ROLE = {
    hips:['hips','hip','pelvis'], neck:['neck','neck01','neck1'], head:['head'], shoulder:['shoulder','clavicle','collar'],
    upperArm:['arm','upperarm','uparm','armupper'], foreArm:['forearm','lowerarm','lowarm','armlower'], hand:['hand'],
    upLeg:['upleg','upperleg','thigh','legupper'], lowLeg:['leg','lowerleg','lowleg','calf','shin','leglower'], foot:['foot','ankle'], toe:['toebase','toe','toes','ball']
  };
  const ROLE_OF = {}; Object.keys(ROLE).forEach(r => ROLE[r].forEach(k => { ROLE_OF[k] = r; }));
  function classify(name){
    const t = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !IGNORE.has(w));
    let side = null; const rest = [];
    t.forEach(w => { if(w === 'left' || w === 'l') side = 'L'; else if(w === 'right' || w === 'r') side = 'R'; else rest.push(w); });
    const key = rest.join('');
    if(/^(spine|chest|upperchest|torso)\d*$/.test(key)) return { role:'spine', side:null };
    let role = ROLE_OF[key];
    if(!role){ const mm = /^(left|right)(.+)$/.exec(key); if(mm){ side = mm[1] === 'left' ? 'L' : 'R'; role = ROLE_OF[mm[2]]; } }   // tên dính liền kiểu "leftarm"
    return { role:role || null, side };
  }
  const depthOf = o => { let d = 0; while(o.parent){ d++; o = o.parent; } return d; };
  const isAnc = (a, b) => { for(let o = b.parent; o; o = o.parent) if(o === a) return true; return false; };

  function findBones(root, force){
    const cand = {}; const all = [];
    root.traverse(o => { if(o.isBone) all.push(o); });
    if(!all.length) throw new Error('GLB không có xương (skin)');
    const byName = n => all.find(b => b.name === n || b.name.replace(/[:.\s]/g, '') === String(n).replace(/[:.\s]/g, ''));
    all.forEach(b => {
      const c = classify(b.name); if(!c.role) return;
      const k = c.role + (c.side || ''); (cand[k] = cand[k] || []).push(b);
    });
    let hipsBone = null;
    const pick = (role, side) => {
      const f = force && force[role + (side || '')]; if(f){ const b = byName(f); if(b) return b; }
      let list = cand[role + (side || '')]; if(!list || !list.length) return null;
      if(hipsBone){ const under = list.filter(b => isAnc(hipsBone, b)); if(under.length) list = under; }   // bỏ xương IK / điều khiển nằm ngoài cây hông
      return list.slice().sort((a, b) => depthOf(a) - depthOf(b))[0];
    };
    const B = { hips:pick('hips') }; hipsBone = B.hips; B.head = pick('head'); B.neck = pick('neck');
    ['L','R'].forEach(s => { B['upperArm' + s] = pick('upperArm', s); B['foreArm' + s] = pick('foreArm', s); B['hand' + s] = pick('hand', s);
      B['upLeg' + s] = pick('upLeg', s); B['lowLeg' + s] = pick('lowLeg', s); B['foot' + s] = pick('foot', s); B['toe' + s] = pick('toe', s); });
    const need = ['hips','head','upperArmL','foreArmL','handL','upperArmR','foreArmR','handR','upLegL','lowLegL','footL','upLegR','lowLegR','footR'];
    const miss = need.filter(k => !B[k]);
    if(miss.length) throw new Error('không nhận ra xương: ' + miss.join(', ') + '  (xương có trong file: ' + all.slice(0, 40).map(b => b.name).join(', ') + ' …). Hãy khai báo cfg.bones để ép tên.');
    // cấu trúc phải đúng dạng humanoid: hông ⊃ đùi ⊃ cẳng chân ⊃ bàn chân, vai ⊃ cánh tay ⊃ cẳng tay ⊃ bàn tay (rig IK kiểu robot thì không retarget được)
    // Lưu ý: nhiều rig (bộ nhân vật nữ) đặt ĐÙI NGANG HÀNG với hông — cùng cha là Root. Vẫn là humanoid hợp lệ,
    // trước đây bị coi là lỗi nên cả 5 model nữ bị bỏ và quay về nhân vật dựng sẵn.
    const legUnderHips = b => isAnc(B.hips, b) || (!!B.hips.parent && isAnc(B.hips.parent, b));
    const chain = [['upLegL','lowLegL','footL','leg'], ['upLegR','lowLegR','footR','leg'], ['upperArmL','foreArmL','handL','arm'], ['upperArmR','foreArmR','handR','arm']];
    chain.forEach(c => {
      const top = B[c[0]];
      if(c[3] === 'leg' ? !legUnderHips(top) : !isAnc(B.hips, top)) throw new Error('cấu trúc xương không phải humanoid chuẩn: "' + top.name + '" không nối với hông "' + B.hips.name + '"');
      for(let i = 0; i < 2; i++) if(!isAnc(B[c[i]], B[c[i + 1]])) throw new Error('cấu trúc xương không phải humanoid chuẩn: "' + B[c[i + 1]].name + '" không nằm dưới "' + B[c[i]].name + '"');
    });
    // chuỗi cột sống: các xương "spine" nằm trên đường từ hông tới vai
    const spine = []; for(let o = B.upperArmL.parent; o && o !== B.hips; o = o.parent){ if(classify(o.name).role === 'spine') spine.unshift(o); }
    B.spine = spine;
    if(!B.neck){ for(let o = B.head.parent; o && o !== B.hips; o = o.parent){ if(classify(o.name).role === 'neck'){ B.neck = o; break; } } }
    return B;
  }

  // ------------------------------------------------------------------ "bộ xương giả": cùng pivot như makeProto trong character.js nhưng không có mesh
  function makeDriver(g){
    const mk = (name, x, y, z, parent) => { const o = new THREE.Group(); o.name = name; o.position.set(x, y, z); (parent || g).add(o); return o; };
    const p = {};
    p.body = mk('body', 0, HIP_Y, 0); p.head = mk('head', 0, 2.38, 0);
    p.eyeL = mk('eyeL', -0.235, 0.58, 0.515, p.head); p.eyeR = mk('eyeR', 0.235, 0.58, 0.515, p.head);   // chỉ để GChar.update không lỗi (chớp mắt / buồn)
    [-1, 1].forEach(s => {
      const arm = mk(s < 0 ? 'armL' : 'armR', s*0.66, 2.2, 0); arm.userData.restZ = s*0.1; arm.rotation.z = s*0.1;
      const fore = mk(s < 0 ? 'foreL' : 'foreR', 0, -0.5, 0, arm);
      const leg = mk(s < 0 ? 'legL' : 'legR', s*0.3, HIP_Y, 0), shin = mk(s < 0 ? 'shinL' : 'shinR', 0, -0.62, 0, leg);
      p[arm.name] = arm; p[fore.name] = fore; p[leg.name] = leg; p[shin.name] = shin;
    });
    return p;
  }

  // ------------------------------------------------------------------ dựng 1 thể hiện: clone model, co chân/phóng đầu, đo trạng thái nghỉ
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _DOWN = new THREE.Vector3(0, -1, 0), _UP = new THREE.Vector3(0, 1, 0);
  const _inv = new THREE.Matrix4(), _vv = new THREE.Vector3();
  const skinned = (sm, i, out) => {                                          // vị trí đỉnh i sau skin, trong hệ mesh (r151+: getVertexPosition · r128: boneTransform)
    if(sm.getVertexPosition) return sm.getVertexPosition(i, out);
    out.fromBufferAttribute(sm.geometry.attributes.position, i); return sm.boneTransform(i, out);
  };
  const worldQ = (o, out) => { o.matrixWorld.decompose(_v, out, _s); return out; };
  const worldP = (o, out) => out.setFromMatrixPosition(o.matrixWorld);

  function fitModel(m, B, obj, holder, g){
    // đo ở tư thế nghỉ, chưa co / phóng gì
    g.updateMatrixWorld(true);
    let bottom = Infinity, top = -Infinity;
    obj.traverse(sm => {
      if(!sm.isSkinnedMesh || (sm.material && sm.material.transparent)) return;
      const pos = sm.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 8000));
      for(let i = 0; i < pos.count; i += step){ skinned(sm, i, _vv).applyMatrix4(sm.matrixWorld); if(_vv.y < bottom) bottom = _vv.y; if(_vv.y > top) top = _vv.y; }
    });
    const upY = (worldP(B.upLegL, _v).y + worldP(B.upLegR, _v2).y) / 2;
    bottom = Math.min(bottom, worldP(B.footL, _v).y, worldP(B.footR, _v2).y);
    const headY = worldP(B.head, _v).y;
    const legLen = Math.max(1e-4, upY - bottom), above = top - upY, hs = m.cfg.headScale;
    const U = above + (hs - 1) * Math.max(0, top - headY);               // phần trên hông sau khi phóng đầu (đơn vị model)
    let ls = m.cfg.legScale;
    if(ls === undefined){ ls = HIP_Y * U / (legLen * Math.max(0.5, m.cfg.height - HIP_Y)); ls = Math.min(1, Math.max(0.5, ls)); }
    const k = HIP_Y / (legLen * ls);                                      // hệ số phóng chung: hông đúng độ cao HIP_Y
    // tay: chuẩn hoá độ dài vai → cổ tay. Model nữ vốn có tay dài hơn hẳn (1.05 so với 0.82 của nam)
    // nên tay thõng quá đùi, trông lệch tỉ lệ với chân ngắn; co lại cho mọi nhân vật cùng một tầm với.
    const armLen = worldP(B.upperArmL, _v).distanceTo(worldP(B.foreArmL, _v2)) + worldP(B.foreArmL, _v).distanceTo(worldP(B.handL, _v2));
    const shY = (worldP(B.upperArmL, _v).y + worldP(B.upperArmR, _v2).y) / 2;             // cao độ vai (đơn vị model)
    const torso = Math.max(1e-4, shY - upY);                                             // thân: hông → vai
    const as = Math.min(1.15, Math.max(0.5, ARM_RATIO * torso * (m.cfg.armScale || 1) / Math.max(1e-4, armLen)));   // co để 12 nhân vật cùng tỉ lệ tay/thân
    // hướng mặt: mũi chân so với cổ chân (Mixamo/glTF mặc định +Z)
    let yaw = m.cfg.yaw;
    if(yaw === undefined){
      yaw = 0;
      const f = new THREE.Vector3();                                      // cộng vector cổ chân → mũi chân của cả 2 chân: độ xoè ngoài triệt tiêu, chỉ còn hướng tiến
      [['toeL','footL'], ['toeR','footR']].forEach(([t, ft]) => { if(B[t]) f.add(worldP(B[t], _v).sub(worldP(B[ft], _v2))); });
      if(Math.hypot(f.x, f.z) > 1e-5) yaw = -Math.atan2(f.x, f.z);
    }
    return { k, ls, hs, as, yaw, upY, bottom, legLen };
  }

  function attach(key, g, p){
    const m = models[key]; if(!m || m.state !== 'ready') throw new Error('model chưa sẵn sàng: ' + key);
    const obj = THREE.SkeletonUtils.clone(m.scene), holder = new THREE.Group();
    holder.add(obj); g.add(holder);
    const B = findBones(obj, m.cfg.bones);
    if(!m.fit){ m.fit = fitModel(m, B, obj, holder, g); console.info('[GLBChar] ' + key + ' → k=' + m.fit.k.toFixed(2) + ' legScale=' + m.fit.ls.toFixed(2) + ' headScale=' + m.fit.hs + ' armScale=' + m.fit.as.toFixed(2) + ' yaw=' + m.fit.yaw.toFixed(2)); }
    const F = m.fit;
    // co chân + phóng đầu (scale đều trên xương nên không méo khi xoay), rồi đặt hông đúng độ cao rig
    B.upLegL.scale.multiplyScalar(F.ls); B.upLegR.scale.multiplyScalar(F.ls); B.head.scale.multiplyScalar(F.hs);
    // Tay: co ĐỀU 3 trục ở xương cánh tay trên (con cháu thừa hưởng). Trước đây chỉ co dọc trục xương để tay không mỏng đi, nhưng co không đều ở xương CHA
    // làm cẳng tay bị méo + đổi chiều dài mỗi khi khuỷu gập (tỉ lệ co tác dụng theo trục của xương cha, sau phép quay khuỷu) → bàn tay không bao giờ
    // tới đúng chỗ khi nắm vô-lăng / đặt lên đùi. Co đều thì chiều dài tay cố định, IK chính xác. Bàn tay được phóng lại một phần để không bé tí.
    B.upperArmL.scale.multiplyScalar(F.as); B.upperArmR.scale.multiplyScalar(F.as);
    const hk = Math.min(1.3, Math.pow(1 / Math.max(0.3, F.as), 0.75));
    B.handL.scale.multiplyScalar(hk); B.handR.scale.multiplyScalar(hk);
    holder.rotation.y = F.yaw; holder.scale.setScalar(F.k);
    holder.position.set(0, HIP_Y - F.k * F.upY, 0);
    g.updateMatrixWorld(true);
    // viền toon (cùng skeleton, mesh riêng). Độ dày đổi từ đơn vị rig (0.032, như nhân vật dựng sẵn) về đơn vị cục bộ của mesh
    if(m.cfg.outline){
      const sk = []; obj.traverse(o => { if(o.isSkinnedMesh && !(o.material && o.material.transparent)) sk.push(o); });
      if(!m.outlineMat && sk.length){ const ws = Math.max(1e-6, sk[0].matrixWorld.getMaxScaleOnAxis()); m.outlineMat = makeOutlineMat(0.032 / ws); }
      if(m.outlineMat) sk.forEach(s => { const o = new THREE.SkinnedMesh(s.geometry, m.outlineMat); o.bind(s.skeleton, s.bindMatrix); o.frustumCulled = false; o.userData.outline = true; s.add(o); });
    }

    // ---- trạng thái nghỉ (hệ toạ độ g) cho từng xương được điều khiển ----
    const side = (b) => (worldP(b, _v).x < 0 ? 'L' : 'R');                // pivot 'L' của rig dựng sẵn nằm ở -X → ghép theo vị trí thật, không theo tên Trái/Phải
    const S = { model:key, holder, obj, ents:[], meshes:[], bones:B, rodAnchor:null, gripAhead:m.cfg.gripAhead, handR:null };
    obj.traverse(o => { if(o.isSkinnedMesh && !o.userData.outline) S.meshes.push(o); });
    const ents = S.ents;
    const add = (bone, src, frac, down, childBone) => {
      const e = { bone, src, frac, W0:new THREE.Quaternion(), R0:new THREE.Quaternion(), anc:-1, mid:new THREE.Quaternion(), qs:new THREE.Quaternion() };
      worldQ(bone, e.W0);
      if(down){                                                            // xoay xương nghỉ sao cho hướng xương chỉ thẳng xuống (rig dựng sẵn rủ tay/chân xuống)
        const d = worldP(childBone, _v).sub(worldP(bone, _v2)).normalize();
        _q.setFromUnitVectors(d, _DOWN); e.R0.copy(_q).multiply(e.W0);
      } else e.R0.copy(e.W0);
      ents.push(e); return e;
    };
    add(B.hips, 'none', 0, false);
    B.spine.forEach((b, i) => add(b, 'body', (i + 1) / Math.max(1, B.spine.length), false));
    if(B.neck) add(B.neck, 'head', 0.4, false);
    add(B.head, 'head', 1, false);
    const sL = side(B.upperArmL), sR = side(B.upperArmR);
    if(sL === sR) throw new Error('2 tay nằm cùng một bên trục X – model xoay lạ, hãy đặt cfg.yaw');
    [['L', B.upperArmL, B.foreArmL, B.handL], ['R', B.upperArmR, B.foreArmR, B.handR]].forEach(([, ua, fa, hd]) => {
      const sd = side(ua);
      add(ua, 'arm' + sd, 1, true, fa); add(fa, 'fore' + sd, 1, true, hd);
    });
    [['L', B.upLegL, B.lowLegL, B.footL], ['R', B.upLegR, B.lowLegR, B.footR]].forEach(([, ul, ll, ft]) => {
      const sd = side(ul);
      add(ul, 'leg' + sd, 1, true, ll); add(ll, 'shin' + sd, 1, true, ft); add(ft, 'foot' + sd, 0.35, false);
    });
    ents.sort((a, b) => depthOf(a.bone) - depthOf(b.bone));                // cha trước con
    // quan hệ cha – con giữa các xương được điều khiển; xương trung gian (vai, spine phụ…) giữ nguyên quay cục bộ lúc nghỉ
    ents.forEach(e => {
      let a = -1; for(let i = ents.length - 1; i >= 0; i--){ if(ents[i] !== e && isAnc(ents[i].bone, e.bone)){ if(a < 0 || depthOf(ents[i].bone) > depthOf(ents[a].bone)) a = i; } }
      e.anc = a;
      const pq = worldQ(e.bone.parent, new THREE.Quaternion());
      if(a < 0) e.mid.copy(pq); else e.mid.copy(ents[a].W0).invert().multiply(pq);
    });
    // bảng xương theo phía pivot ('L' = -X, 'R' = +X) cho IK (character.js) + đo kích thước thật của model để chia tỉ lệ tư thế
    S.arm = {}; S.leg = {};
    [['upperArmL','foreArmL','handL'], ['upperArmR','foreArmR','handR']].forEach(([u, f, h]) => { S.arm[side(B[u])] = { up:B[u], fore:B[f], hand:B[h] }; });
    [['upLegL','lowLegL','footL','toeL'], ['upLegR','lowLegR','footR','toeR']].forEach(([u, l, f, t]) => { S.leg[side(B[u])] = { up:B[u], low:B[l], foot:B[f], toe:B[t] || null }; });
    S.dims = measureDims(S, obj);
    S.palm = m.cfg.palm !== undefined ? m.cfg.palm : DEFAULTS.palm;
    S.fingers = buildFingers(B, side); S.gripPrev = { L:0, R:0 };
    return S;
  }

  // ---- Ngón tay (nắm vô-lăng / tay cầm / cần câu) ----
  // Mọi rig Mixamo / Blender đều có xương ngón (tên chứa Thumb|Index|Middle|Ring|Pinky). Trục gập = trục ngang bàn tay (ngón trỏ → ngón út) lấy từ vị trí xương THẬT lúc nghỉ,
  // chiều gập chọn sao cho đầu ngón cong về phía lòng bàn tay (xuống / vào thân) → không phụ thuộc tên Left/Right hay hệ trục của từng file. p.grip.L/R = 0..1.
  const FING_RE = /(thumb|index|middle|ring|pinky)/i, CURL_K = { thumb:[0.35, 0.55, 0.45, 0.3], other:[0.85, 1.0, 0.75, 0.5] }, CURL_MAX = 1.35;
  function buildFingers(B, side){
    const out = { L:[], R:[] }, W = b => worldP(b, new THREE.Vector3());
    [B.handL, B.handR].forEach(hd => {
      const sd = side(hd), roots = {};
      hd.children.forEach(c => { const m = FING_RE.exec(c.name || ''); if(m && c.isBone !== false) roots[m[1].toLowerCase()] = c; });
      if(!roots.index || !roots.pinky || !roots.middle) return;
      const chain = r => { const o = []; for(let b = r; b; b = b.children.find(x => x.isBone && FING_RE.test(x.name || '')) || null){ if(!/_end$/i.test(b.name || '')) o.push(b); } return o; };
      const A = W(roots.pinky).sub(W(roots.index)).normalize();
      const mc = chain(roots.middle), v = W(mc[mc.length - 1]).sub(W(roots.middle));
      const c = new THREE.Vector3().crossVectors(A, v), hp = W(hd), inward = hp.x > 0 ? -1 : 1;
      const sg = (-c.y + 0.7*inward*c.x + 0.3*c.z) >= 0 ? 1 : -1;                    // + : cong xuống / vào thân / ra trước
      Object.keys(roots).forEach(name => {
        const ks = name === 'thumb' ? CURL_K.thumb : CURL_K.other;
        chain(roots[name]).forEach((b, i) => {
          const axis = A.clone().applyQuaternion(worldQ(b, new THREE.Quaternion()).invert()).multiplyScalar(sg);
          out[sd].push({ bone:b, q0:b.quaternion.clone(), axis, k:ks[Math.min(i, ks.length - 1)] });
        });
      });
    });
    return out;
  }
  const _fq = new THREE.Quaternion();
  function applyGrip(S, p){
    const gp = p.grip;
    for(let i = 0; i < 2; i++){
      const sd = i ? 'R' : 'L', gv = gp ? Math.max(0, Math.min(1, gp[sd] || 0)) : 0;
      if(Math.abs(gv - S.gripPrev[sd]) < 1e-3) continue;                              // chỉ cập nhật khi đổi (không tốn gì lúc đi bộ)
      S.gripPrev[sd] = gv;
      const F = S.fingers[sd];
      for(let j = 0; j < F.length; j++){ const f = F[j]; _fq.setFromAxisAngle(f.axis, f.k * gv * CURL_MAX); f.bone.quaternion.copy(f.q0).multiply(_fq); }
    }
  }

  // Kích thước thật (hệ toạ độ nhóm, trước scale 0.58) của model SAU khi co chân / phóng đầu: để IK đặt tay / gối / bàn chân đúng chỗ
  // cho mọi model (nam to khoẻ, nữ nhỏ nhắn; đùi/cẳng, vai/hông khác nhau). Đo ở tư thế nghỉ nên không phụ thuộc pose.
  function measureDims(S, obj){
    const P = b => worldP(b, new THREE.Vector3());
    const D = { hip:{}, knee:{}, ankle:{}, toe:{}, shoulder:{}, elbow:{}, wrist:{} };
    ['L', 'R'].forEach(sd => {
      const a = S.arm[sd], l = S.leg[sd];
      D.hip[sd] = P(l.up); D.knee[sd] = P(l.low); D.ankle[sd] = P(l.foot); D.toe[sd] = l.toe ? P(l.toe) : null;
      D.shoulder[sd] = P(a.up); D.elbow[sd] = P(a.fore); D.wrist[sd] = P(a.hand);
    });
    const avg = (A, B2) => (A.L.distanceTo(B2.L) + A.R.distanceTo(B2.R)) / 2;
    D.thigh = avg(D.hip, D.knee); D.shin = avg(D.knee, D.ankle); D.upper = avg(D.shoulder, D.elbow); D.fore = avg(D.elbow, D.wrist);
    D.hipW = Math.abs(D.hip.L.x - D.hip.R.x); D.shoulderW = Math.abs(D.shoulder.L.x - D.shoulder.R.x);
    // đế giày: điểm thấp nhất của lưới (đã skin) → cổ chân cao hơn đế bao nhiêu
    let low = Infinity;
    S.meshes.forEach(sm => {
      const pos = sm.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 4000));
      for(let i = 0; i < pos.count; i += step){ skinned(sm, i, _vv).applyMatrix4(sm.matrixWorld); if(_vv.y < low) low = _vv.y; }
    });
    D.sole = low;
    D.ankleH = Math.max(0.03, (D.ankle.L.y + D.ankle.R.y) / 2 - low);
    D.toeLen = D.toe.L ? Math.max(0.1, D.toe.L.z - D.ankle.L.z) : 0.3;
    return D;
  }

  // ------------------------------------------------------------------ mỗi khung: pivot giả → xương thật
  const _D = { body:new THREE.Quaternion(), head:new THREE.Quaternion(), armL:new THREE.Quaternion(), armR:new THREE.Quaternion(),
    foreL:new THREE.Quaternion(), foreR:new THREE.Quaternion(), legL:new THREE.Quaternion(), legR:new THREE.Quaternion(), shinL:new THREE.Quaternion(), shinR:new THREE.Quaternion() };
  const _id = new THREE.Quaternion(), _w = new THREE.Quaternion(), _pw = new THREE.Quaternion(), _t = new THREE.Quaternion();
  
  function sync(g, p){
    const S = p.glb; if(!S) return;
    _D.body.copy(p.body.quaternion); _D.head.copy(p.head.quaternion);
    ['L','R'].forEach(s => {
      _D['arm' + s].copy(p['arm' + s].quaternion); _D['fore' + s].copy(p['arm' + s].quaternion).multiply(p['fore' + s].quaternion);
      _D['leg' + s].copy(p['leg' + s].quaternion); _D['shin' + s].copy(p['leg' + s].quaternion).multiply(p['shin' + s].quaternion);
    });
    const ents = S.ents;
    for(let i = 0; i < ents.length; i++){
      const e = ents[i];
      if(e.src === 'none'){ e.qs.copy(e.R0); continue; }                    // hông: giữ nguyên
      let d;
      if(e.src === 'body') d = _D.body; else if(e.src === 'head') d = _D.head;
      else if(e.src === 'footL' || e.src === 'footR'){
        const fo = p.footD && p.footD[e.src === 'footL' ? 'L' : 'R'];       // bàn chân do pose chỉ định (đặt phẳng trên sàn / bàn đạp) → dùng đúng góc đó
        if(fo) d = fo; else d = _D[e.src === 'footL' ? 'shinL' : 'shinR'];
      }
      else d = _D[e.src];
      if(e.frac !== 1 && e.frac !== undefined && !(e.src.charAt(0) === 'f' && e.src.length === 5 && e.src.indexOf('foot') === 0 && p.footD && p.footD[e.src === 'footL' ? 'L' : 'R'])){ _t.copy(_id).slerp(d, e.frac); d = _t; }
      e.qs.copy(d).multiply(e.R0);                                          // Q_thếgiới = Δ × R0
      // quay cục bộ = (quay thế giới của cha)^-1 × Q_thếgiới ; cha = (xương điều khiển gần nhất) × (đoạn trung gian lúc nghỉ)
      if(e.anc < 0) _pw.copy(e.mid); else _pw.copy(ents[e.anc].qs).multiply(e.mid);
      e.bone.quaternion.copy(_pw).invert().multiply(e.qs);
    }
    applyGrip(S, p);
  }

  // ---- truy vấn vị trí khớp THẬT của xương (hệ toạ độ nhóm): dùng cho IK + đặt cần câu. Gọi SAU sync() ----
  // vai: gốc xương cánh tay trên (đi theo thân khi nghiêng) · lòng bàn tay: cổ tay + hướng cẳng tay × palm
  function shoulder(g, p, side, out){
    const S = p.glb; g.updateMatrixWorld(true);
    worldP(S.arm[side].up, out); return g.worldToLocal(out);
  }
  const _pa = new THREE.Vector3(), _pb = new THREE.Vector3();
  function palm(g, p, side, out, k){
    const S = p.glb, a = S.arm[side]; g.updateMatrixWorld(true);
    worldP(a.hand, out); g.worldToLocal(out);
    worldP(a.fore, _pa); g.worldToLocal(_pa);
    _pb.copy(out).sub(_pa); const l = _pb.length() || 1;
    return out.addScaledVector(_pb, (k === undefined ? S.palm : k) / l);
  }
  // hướng cẳng tay (khuỷu → cổ tay), hệ toạ độ nhóm: IK dùng để biết cánh tay đang chỉ đâu
  function foreDir(g, p, side, out){
    const S = p.glb, a = S.arm[side]; g.updateMatrixWorld(true);
    worldP(a.hand, out); g.worldToLocal(out); worldP(a.fore, _pa); g.worldToLocal(_pa);
    return out.sub(_pa).normalize();
  }

  // điểm thấp nhất của cơ thể (toạ độ cục bộ của g, chưa nhân scale) – dùng cho tư thế ngồi xếp bằng
  function lowestY(g, p){
    const S = p.glb; sync(g, p); g.updateMatrixWorld(true); _inv.copy(g.matrixWorld).invert();
    let low = Infinity;
    S.meshes.forEach(sm => {
      const pos = sm.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 3000));
      for(let i = 0; i < pos.count; i += step){ skinned(sm, i, _vv).applyMatrix4(sm.matrixWorld).applyMatrix4(_inv); if(_vv.y < low) low = _vv.y; }
    });
    return low;
  }

  // dùng khi đã có sẵn scene (test / nạp từ nơi khác)
  function inject(key, scene){
    const cfg = Object.assign({}, DEFAULTS, cfgAll()[key]);
    const m = models[key] = { cfg, state:'loading', scene:null, fit:null };
    prepare(m, scene); m.state = 'ready'; return m;
  }
  return { preload, ready, onReady, fail, attach, sync, shoulder, palm, foreDir, makeDriver, lowestY, inject, models, classify };
})();
