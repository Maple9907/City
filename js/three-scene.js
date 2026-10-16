/* ===== GCITY 3D - Three.js Scene =====
 * Toàn bộ 3D dựng bằng hình khối nguyên thủy (không asset ngoài).
 * API: Scene3D.init(), buildZone(), createCharacter(), updatePlayer(), camera, collision.
 */
const Scene3D = (() => {
  let scene, camera, renderer, clock;
  let container;
  let worldGroup;      // group chứa zone hiện tại
  let characters = {}; // id -> {group, parts, action, actionT}
  // Camera third-person kiểu "Quảng trường Mini": xoay (yaw) + nghiêng (pitch) + zoom (dist) quanh nhân vật
  const CAM = { fov:55, lookY:1.5, pitch0:0.5, dist0:13, minPitch:0.1, maxPitch:1.5,
                minDist:5, maxDist:120,   // maxDist bị chặn bởi sương mù (Fog 110→260)
                rotX:0.006, rotY:0.005, follow:0.2 };
  const camClamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const setCamDist = d => { camDist = camClamp(d, CAM.minDist, CAM.maxDist); };
  let camAngle = 0, camPitch = CAM.pitch0, camDist = CAM.dist0;
  const camTarget = new THREE.Vector3(), camPtr = new Map();
  let camSnap = true, camLastT = 0, camLastX = 0, camLastZ = 0;
  // Độ phân giải thích ứng: bắt đầu ở mật độ điểm ảnh gốc của máy (tối đa 3x), tự hạ khi FPS < 24. Thêm ?res=1.5 vào URL để ép cố định.
  const RES = { max:Math.min(window.devicePixelRatio||1, 3), min:1, cur:1, n:0, t:0, low:0, warm:true, fixed:false };
  const maxAniso = () => Math.min(8, renderer.capabilities.getMaxAnisotropy());   // nền gạch không bị nhoè khi nhìn xiên
  let waterMesh = null, fountainParticles = null;
  let screenInfo = null, screenCanvas = null, screenTex = null, spinners = [];
  let ferris = null, racers = [], raceCanvas = null, raceTex = null;

  // 6 nam + 6 nữ: màu skin, tóc, áo, quần, kiểu tóc
  const CHAR_DEFS = {
    male: [
      { skin:0xf5c9a0, hair:0x6b3f2a, shirt:0xffffff, pants:0x151515, hairStyle:'short' },
      { skin:0xf5c9a0, hair:0x2a1a0f, shirt:0x3b82f6, pants:0x1e3a5f, hairStyle:'short' },
      { skin:0xe8b88f, hair:0x0f0f0f, shirt:0xef4444, pants:0x2d2d2d, hairStyle:'spiky' },
      { skin:0xf0c090, hair:0x6b4423, shirt:0x10b981, pants:0x374151, hairStyle:'curly' },
      { skin:0xf5d0a8, hair:0xd4a017, shirt:0x8b5cf6, pants:0x4c1d95, hairStyle:'short' },
      { skin:0xe0a878, hair:0x1a1a1a, shirt:0xf59e0b, pants:0x78350f, hairStyle:'spiky' },
      { skin:0xf8d8b8, hair:0x8b4513, shirt:0xec4899, pants:0x831843, hairStyle:'curly' },
    ],
    female: [
      { skin:0xf8d4b0, hair:0x1a1a1a, shirt:0xec4899, pants:0xbe185d, hairStyle:'long', skirt:true },
      { skin:0xf0c090, hair:0x8b4513, shirt:0xf59e0b, pants:0x92400e, hairStyle:'ponytail', skirt:true },
      { skin:0xfce0c0, hair:0xf5d060, shirt:0x06b6d4, pants:0x155e75, hairStyle:'twin', skirt:true },
      { skin:0xe8b88f, hair:0x2d1b0e, shirt:0xa855f7, pants:0x6b21a8, hairStyle:'long', skirt:false },
      { skin:0xf5c9a0, hair:0xc0392b, shirt:0x22c55e, pants:0x14532d, hairStyle:'ponytail', skirt:true },
      { skin:0xf8d8b8, hair:0x4a3728, shirt:0xf43f5e, pants:0x9f1239, hairStyle:'twin', skirt:true },
    ]
  };

  const ZONES = {
    plaza: { size:60, buildings:[
      { x:-22, z:-22, w:10, h:8, d:10, color:0x8b4513, roof:0x5a2d0c, type:'cinema', name:'Rạp CGV' },
      { x:22, z:-22, w:10, h:9, d:10, color:0x4a5568, roof:0x2d3748, type:'lottery', name:'Xổ số City' },
      { x:-22, z:22, w:9, h:7, d:9, color:0x2b6cb0, roof:0x1a365d, type:'rental', name:'Thuê đồ' },
      { x:22, z:22, w:9, h:7, d:9, color:0x9f1239, roof:0x500724, type:'shop', name:'Cửa hàng' },
    ], trees:[
      {x:-12,z:-8},{x:-6,z:-16},{x:8,z:-14},{x:14,z:-6},{x:-14,z:8},{x:-8,z:14},{x:6,z:16},{x:14,z:10},{x:0,z:-18},{x:18,z:0}
    ], benches:[{x:-8,z:0},{x:8,z:0},{x:0,z:-8},{x:0,z:8}], fountain:{x:0,z:0}, lamps:[{x:-18,z:0},{x:18,z:0},{x:0,z:-18},{x:0,z:18}],
      portal:{x:0,z:29,w:6,d:3,to:'fishing',label:'🚤 Đảo câu cá'}, spawn:{x:0,z:10} },
    fishing: { size:50, buildings:[
      { x:-18, z:-16, w:8, h:6, d:8, color:0x6b4423, roof:0x4a2c1a, type:'fishshop', name:'Cửa hàng câu cá' },
    ], trees:[{x:-10,z:-8},{x:12,z:-12}], benches:[{x:0,z:0}], fountain:null, lamps:[{x:-15,z:5},{x:15,z:5}],
      water:{x:0,z:14,w:48,d:20}, docks:[{x:-12,z:4},{x:0,z:4},{x:12,z:4}],
      portal:{x:0,z:-24,w:6,d:3,to:'plaza',label:'🚤 Quảng trường'}, spawn:{x:0,z:-8} }
  };

  ZONES.plaza.name = 'Công viên GCITY'; ZONES.fishing.name = 'Đảo câu cá';
  const H = Math.PI/2, P2 = a=>a.map(([x,z])=>({x,z}));
  const Bd = (x,z,w,d,h,ry,color,roof,type,name)=>({x,z,w,d,h,ry,color,roof,type,name});
  Object.assign(ZONES.plaza, {
    size:104, race:{x:43,z:0,rx:6,rz:11}, rentLot:{x:-42,z:3}, wheel:{x:14,z:42,r:3}, spawn:{x:0,z:9}, portal:{x:0,z:37,w:6,d:3,to:'fishing',label:'🚤 Đảo câu cá'},
    buildings:[
      Bd(-22,-27,10,6,8,0,0xe8876f,0xc96a55,'shop','SUNNY MART'), Bd(22,-27,10,6,10,0,0x8b72c8,0x6a53a8,'lottery','XỔ SỐ CITY'),
      Bd(-27,-9,6,10,9,H,0x4fa3ab,0x2f7f88,'cinema','RẠP PHIM'), Bd(-27,9,6,8,6,H,0x6fb7b0,0x3f8f8c,'fishshop','ĐÁO CÂU CÁ'),
      Bd(27,-9,6,10,10,-H,0xd77aa0,0xb55a82,'shop','PIZZA HOUSE'), Bd(27,9,6,10,8,-H,0xf0a35e,0xcf8040,'rental','THUÊ ĐỒ'),
      Bd(-22,27,10,6,9,Math.PI,0x8b72c8,0x6a53a8,'shop','MOON BAR'), Bd(22,27,10,6,8,Math.PI,0x4fa3ab,0x2f7f88,'shop','HAPPY TOYS'),
    ],
    trees:P2([[-12,-12],[12,-12],[-12,12],[12,12],[-13,-4],[13,-4],[-13,4],[13,4]]),
    lamps:P2([[-15.5,-9],[-15.5,9],[15.5,-9],[15.5,9],[-6,-15.5],[6,-15.5],[-6,15.5],[6,15.5]]),
    flowers:P2([[-6.5,-12.5],[6.5,-12.5],[-6.5,12.5],[6.5,12.5]]),
    benches:[], fountain:{x:0,z:0},
    screen:{x:0, z:-37.5, w:16, h:9, y:1.4},
    games:[
      {id:'memory', name:'Lật hình',  icon:'🃏', x:-12, z:0,  color:0xec4899},
      {id:'timing', name:'Canh nhịp', icon:'🎯', x:12,  z:0,  color:0x22c55e},
      {id:'guess',  name:'Đoán số',   icon:'🔢', x:0,   z:13, color:0xf59e0b},
    ]
  });
  [[-7,-7],[7,-7],[-7,7],[7,7]].forEach(([bx,bz])=>ZONES.plaza.benches.push({x:bx, z:bz, ry:Math.atan2(-bx,-bz)}));
  [-9,-4.5,4.5,9].forEach(bx=>ZONES.plaza.benches.push({x:bx, z:-32.5, ry:Math.PI})); // ghế trên sân khấu, hướng về màn hình

  function init(cont){
    container = cont;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfe9f4);
    scene.fog = new THREE.Fog(0xbfe9f4, 110, 260);

    camera = new THREE.PerspectiveCamera(CAM.fov, window.innerWidth/window.innerHeight, 0.1, 400);
    renderer = new THREE.WebGLRenderer({ antialias:true });
    const qRes = parseFloat(new URLSearchParams(location.search).get('res'));
    if(qRes > 0){ RES.max = camClamp(qRes, 0.5, 3); RES.fixed = true; }
    RES.cur = RES.max; renderer.setPixelRatio(RES.cur);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // lights
    const amb = new THREE.AmbientLight(0xffffff, 0.85); scene.add(amb);
    const sun = new THREE.DirectionalLight(0xfff5e0, 0.6);
    sun.position.set(20, 30, 10); sun.castShadow = true;
    sun.shadow.mapSize.set(2048,2048);
    sun.shadow.camera.left=-60; sun.shadow.camera.right=60;
    sun.shadow.camera.top=60; sun.shadow.camera.bottom=-60; sun.shadow.camera.far=200;
    scene.add(sun);

    // camera orbit: kéo 1 ngón/chuột = xoay + nghiêng; lăn chuột / chụm 2 ngón = zoom
    const cv = renderer.domElement;
    cv.style.touchAction = 'none';   // chặn trình duyệt cuộn/zoom trang khi kéo trên canvas
    cv.addEventListener('pointerdown', e=>{
      if(e.pointerType==='mouse') camPtr.clear();
      try{ cv.setPointerCapture(e.pointerId); }catch(_){}
      camPtr.set(e.pointerId, [e.clientX, e.clientY]);
    });
    cv.addEventListener('pointermove', e=>{
      const p = camPtr.get(e.pointerId); if(!p) return;
      if(camPtr.size===1){
        camAngle -= (e.clientX-p[0])*CAM.rotX;
        camPitch = camClamp(camPitch + (e.clientY-p[1])*CAM.rotY, CAM.minPitch, CAM.maxPitch);
      } else if(camPtr.size===2){
        const o = [...camPtr.entries()].find(q=>q[0]!==e.pointerId)[1];
        const d0 = Math.hypot(p[0]-o[0], p[1]-o[1]), d1 = Math.hypot(e.clientX-o[0], e.clientY-o[1]);
        if(d1>1) setCamDist(camDist*d0/d1);
      }
      p[0]=e.clientX; p[1]=e.clientY;
    });
    const camPtrEnd = e=>{ camPtr.delete(e.pointerId); };
    cv.addEventListener('pointerup', camPtrEnd);
    cv.addEventListener('pointercancel', camPtrEnd);
    cv.addEventListener('lostpointercapture', camPtrEnd);
    window.addEventListener('blur', ()=> camPtr.clear());   // tránh kẹt trạng thái "đang kéo" khi mất focus
    cv.addEventListener('wheel', e=>{ setCamDist(camDist*(1+(e.deltaMode===1? e.deltaY*33 : e.deltaY)*0.001)); }, {passive:true});
    window.addEventListener('resize', ()=>{
      camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    clock = new THREE.Clock();
  }

  // ===== WORLD BUILDING =====
  function makeGroundTexture(color1, color2){
    const c = document.createElement('canvas'); c.width=c.height=256;
    const g = c.getContext('2d');
    g.fillStyle='#'+color1.toString(16).padStart(6,'0'); g.fillRect(0,0,256,256);
    g.fillStyle='#'+color2.toString(16).padStart(6,'0');
    for(let i=0;i<256;i+=32){ for(let j=0;j<256;j+=32){ if((i+j)%64===0) g.fillRect(i,j,32,32); } }
    const tex = new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(8,8); tex.anisotropy=maxAniso();
    return tex;
  }

  function tileTex(c1,c2,rx,ry){
    const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
    g.fillStyle=c1; g.fillRect(0,0,128,128); g.fillStyle=c2; g.fillRect(0,0,64,64); g.fillRect(64,64,64,64);
    g.strokeStyle='rgba(120,70,40,.18)'; g.lineWidth=2; g.strokeRect(0,0,128,128);
    const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx,ry); t.anisotropy=maxAniso(); return t;
  }
  function makeTree(x,z,s,base=true){
    const t=new THREE.Group(), lm=c=>new THREE.MeshLambertMaterial({color:c,flatShading:true});
    if(base){ const b=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.6,0.12,16),lm(0x8a5a3a)); b.position.y=0.07; t.add(b); }
    const tr=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.35,2.2,6),lm(0x6b4423)); tr.position.y=1.1; tr.castShadow=true; t.add(tr);
    [[0,3.1,0,1.5,0x3f9d4a],[0.5,3.9,0.2,1.1,0x57b85c],[-0.5,3.6,-0.3,1.0,0x4aa954]].forEach(([a,b2,c,r,col])=>{ const l=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),lm(col)); l.position.set(a,b2,c); l.castShadow=true; t.add(l); });
    t.scale.setScalar(s); t.position.set(x,0,z); worldGroup.add(t);
  }
  function buildPlazaFloor(){
    const L=c=>new THREE.MeshLambertMaterial(typeof c==='object'?c:{color:c});
    const flat=(w,d,x,y,zz,m)=>{ const o=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m); o.rotation.x=-Math.PI/2; o.position.set(x,y,zz); o.receiveShadow=true; worldGroup.add(o); };
    const bx=(w,h,d,x,y,zz,m)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(x,y,zz); o.castShadow=o.receiveShadow=true; worldGroup.add(o); };
    const isl=new THREE.Mesh(new THREE.CylinderGeometry(56,56,1,64),L(0x9fd69a)); isl.position.y=-0.5; isl.receiveShadow=true; worldGroup.add(isl);
    [[-44,-30],[47,32],[-40,34]].forEach(([x,zz])=>{ const h=new THREE.Mesh(new THREE.SphereGeometry(10,14,8),L(0xb6e3a8)); h.scale.y=0.45; h.position.set(x,0,zz); worldGroup.add(h); });
    flat(62,62,0,0.02,0,L({map:tileTex('#d3d8dc','#c4cad0',31,31)}));
    flat(32,32,0,0.06,0,L({map:tileTex('#f7d9ac','#f0cc9c',16,16)}));
    const road=L(0x3a3f47); flat(42,5,0,0.06,-18.5,road); flat(42,5,0,0.06,18.5,road); flat(5,32,-18.5,0.06,0,road); flat(5,32,18.5,0.06,0,road);
    const cr=()=>({map:tileTex('#d9967c','#cf8a70',16,2)}); flat(32,4,0,0.1,0,L(cr())); flat(4,32,0,0.1,0,L({map:tileTex('#d9967c','#cf8a70',2,16)}));
    const cm=new THREE.Mesh(new THREE.CircleGeometry(8,48),L({map:tileTex('#cf8a70','#c47d64',8,8)})); cm.rotation.x=-Math.PI/2; cm.position.y=0.14; cm.receiveShadow=true; worldGroup.add(cm);
    const rg=new THREE.Mesh(new THREE.RingGeometry(8,8.4,48),L(0xb26a50)); rg.rotation.x=-Math.PI/2; rg.position.y=0.16; worldGroup.add(rg);
    const dm=L(0xe8c86a), wm=L(0xf4f1e6);
    for(let t=-19;t<=19;t+=3.5){ flat(1.6,0.2,t,0.1,-18.5,dm); flat(1.6,0.2,t,0.1,18.5,dm); flat(0.2,1.6,-18.5,0.1,t*0.78,dm); flat(0.2,1.6,18.5,0.1,t*0.78,dm); }
    for(let k=-2.5;k<=2.5;k+=1){ flat(0.55,4,k,0.11,-18.5,wm); flat(0.55,4,k,0.11,18.5,wm); flat(4,0.55,-18.5,0.11,k,wm); flat(4,0.55,18.5,0.11,k,wm); }
    const wood=L(0xc99a6b); bx(22,0.3,8,0,0.15,-35,wood); bx(5,0.15,1.2,0,0.075,-30.4,wood);
    [-10.5,10.5].forEach(sx=>bx(1.1,2.4,1,sx,1.5,-36,L(0x1b1f27)));
    (ZONES.plaza.flowers||[]).forEach(f=>{ bx(3,0.5,1.2,f.x,0.3,f.z,L(0xe6d3b0));
      for(let i=-1;i<=1;i++) for(let j=0;j<2;j++){ const fl=new THREE.Mesh(new THREE.SphereGeometry(0.22,6,5),L(i%2?0xf06a8d:0xff8fa8)); fl.position.set(f.x+i*0.9,0.65,f.z+(j-0.5)*0.5); worldGroup.add(fl); } });
    for(let i=0;i<22;i++){ const a=i/22*Math.PI*2+Math.sin(i*3)*0.1, r=46+Math.sin(i*5)*4; const tx=Math.cos(a)*r, tz=Math.sin(a)*r; if((tx>33&&Math.abs(tz)<17)||(tx<-33&&tz>-15&&tz<19)||(tz>33&&tx>-21&&tx<23)) continue; makeTree(tx, tz, 1.5+Math.abs(Math.sin(i*7))*0.8, false); }
    buildExtras();
  }

  function setRacers(ts){ const R=ZONES.plaza.race; racers.forEach((g,i)=>{ const a=ts[i], l=0.72+i*0.08, vx=-Math.sin(a)*R.rx*l, vz=Math.cos(a)*R.rz*l;
    g.position.set(R.x+Math.cos(a)*R.rx*l,0.14,R.z+Math.sin(a)*R.rz*l); g.rotation.y=Math.atan2(-vz,vx); }); }
  function setRaceBoard(sub,tl,tt,sl,st){
    if(!raceCanvas) return; const g=raceCanvas.getContext('2d');
    g.fillStyle='#173a36'; g.fillRect(0,0,1024,384); g.textAlign='center'; g.fillStyle='#fff'; g.font='bold 64px sans-serif'; g.fillText('TRƯỜNG ĐUA THÚ',512,80);
    g.font='34px sans-serif'; g.fillStyle='#bfe9e0'; g.fillText(sub,512,130);
    [[270,tl,tt],[760,sl,st]].forEach(([x,h,t])=>{ g.fillStyle='#0f2b28'; g.fillRect(x-230,160,460,190); g.fillStyle='#8fc9bd'; g.font='28px sans-serif'; g.fillText(h,x,200); g.fillStyle='#fff'; g.font='bold 40px sans-serif'; g.fillText(t,x,270,430); });
    raceTex.needsUpdate=true;
  }
  function buildExtras(){
    const Z=ZONES.plaza, L=c=>new THREE.MeshLambertMaterial({color:c}), R=Z.race, Lt=Z.rentLot, W=Z.wheel;
    const box=(w,h,d,x,y,zz,c,pr)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),L(c)); o.position.set(x,y,zz); o.castShadow=true; (pr||worldGroup).add(o); return o; };
    const ell=(g,c,y,sx,sz)=>{ const o=new THREE.Mesh(g,L(c)); o.rotation.x=-Math.PI/2; o.scale.set(sx,sz,1); o.position.set(R.x,y,R.z); o.receiveShadow=true; worldGroup.add(o); };
    // --- trường đua thú ---
    ell(new THREE.CircleGeometry(1,48),0xd9754b,0.12,R.rx,R.rz); ell(new THREE.CircleGeometry(1,48),0x58b58a,0.14,R.rx*.62,R.rz*.62);
    [0.7,0.8,0.9].forEach(k=>ell(new THREE.RingGeometry(k,k+0.015,64),0xf4f1e6,0.13,R.rx,R.rz));
    const rail=new THREE.Mesh(new THREE.TorusGeometry(1,0.02,6,64),L(0xf4f1e6)); rail.rotation.x=Math.PI/2; rail.scale.set(R.rx*1.12,R.rz*1.12,1); rail.position.set(R.x,0.85,R.z); worldGroup.add(rail);
    for(let i=0;i<32;i++){ const a=i/32*Math.PI*2; box(0.12,0.9,0.12,R.x+Math.cos(a)*R.rx*1.12,0.45,R.z+Math.sin(a)*R.rz*1.12,0xf4f1e6); }
    [0xe74c3c,0x3498db,0xf1c40f,0x9b59b6].forEach(c=>{ const g=new THREE.Group(), b=new THREE.Mesh(new THREE.SphereGeometry(0.45,10,8),L(c)), h=new THREE.Mesh(new THREE.SphereGeometry(0.28,8,6),L(c));
      b.scale.set(1.3,0.9,0.9); b.position.y=0.5; b.castShadow=true; h.position.set(0.6,0.8,0); g.add(b); g.add(h); worldGroup.add(g); racers.push(g); });
    const bd=new THREE.Group(); box(14.6,6,0.5,0,3.8,0,0x1d3b34,bd); [-6,6].forEach(x=>box(0.6,1,0.6,x,0.5,0,0x1d3b34,bd));
    raceCanvas=document.createElement('canvas'); raceCanvas.width=1024; raceCanvas.height=384; raceTex=new THREE.CanvasTexture(raceCanvas);
    const pn=new THREE.Mesh(new THREE.PlaneGeometry(14,5.4),new THREE.MeshBasicMaterial({map:raceTex})); pn.position.set(0,3.8,0.27); bd.add(pn);
    bd.position.set(R.x+8.3,0,R.z); bd.rotation.y=-Math.PI/2; worldGroup.add(bd); setRaceBoard('Sơ Cấp','VÉ CỦA BẠN','—','TRẠNG THÁI','Đang tải…'); setRacers([0,0,0,0].map(()=>Math.PI/2));
    // --- bãi thuê xe + máy bay ---
    box(10,0.06,26,Lt.x,0.03,Lt.z,0x3a3f47);
    [0xe85c5c,0x4aa3df,0xf2c94c,0x8fc15a].forEach((c,i)=>{ const g=new THREE.Group(); box(3.2,0.8,1.6,0,0.7,0,c,g); box(1.7,0.7,1.4,-0.1,1.4,0,0x2b3440,g);
      [[-1,-.85],[1,-.85],[-1,.85],[1,.85]].forEach(([x,zz])=>{ const w=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.3,10),L(0x111111)); w.rotation.x=Math.PI/2; w.position.set(x,.35,zz); g.add(w); });
      g.position.set(Lt.x,0,Lt.z-9+i*3.6); worldGroup.add(g); });
    [0x4aa3df,0xf2c94c].forEach((c,i)=>{ const g=new THREE.Group(), fu=new THREE.Mesh(new THREE.CylinderGeometry(.45,.35,3.4,10),L(c)); fu.rotation.z=Math.PI/2; fu.position.y=1; fu.castShadow=true; g.add(fu);
      box(0.9,.12,4.4,0.1,1.1,0,c,g); box(.5,.9,.1,-1.6,1.5,0,c,g); box(.4,.1,1.6,-1.6,1.1,0,c,g); box(.08,.1,1.5,1.75,1,0,0x333333,g); g.position.set(Lt.x,0,Lt.z+5.5+i*4.6); worldGroup.add(g); });
    const ls=makeTextSprite('THUÊ XE · MÁY BAY',{fontsize:30,color:'#fff',bg:'rgba(30,50,80,.9)'}); ls.position.set(Lt.x+3,3.6,Lt.z-10); ls.scale.set(0.9*ls.userData.ar,0.9,1); worldGroup.add(ls);
    // --- vòng quay + sàn gỗ ---
    const wg=new THREE.Group(), rot=new THREE.Group(), gond=[]; rot.position.y=9;
    rot.add(new THREE.Mesh(new THREE.TorusGeometry(7,0.18,6,40),L(0x3f8f8c)));
    for(let i=0;i<4;i++){ const sp=box(14,0.1,0.1,0,0,0,0x3f8f8c,rot); sp.rotation.z=i*Math.PI/4; }
    [0xe85c5c,0x4aa3df,0xf2c94c,0x8fc15a,0xd77aa0,0xf0a35e,0x8b72c8,0x58b8c0].forEach((c,i)=>{ const a=i/8*Math.PI*2, pv=new THREE.Group(); pv.position.set(Math.cos(a)*7,Math.sin(a)*7,0); box(1.6,1.2,1.4,0,-0.9,0,c,pv); rot.add(pv); gond.push(pv); });
    wg.add(rot); const l1=box(0.4,10,0.4,-2.6,4.6,0,0x3f8f8c,wg); l1.rotation.z=0.3; const l2=box(0.4,10,0.4,2.6,4.6,0,0x3f8f8c,wg); l2.rotation.z=-0.3;
    wg.position.set(W.x,0,W.z); worldGroup.add(wg); ferris={rot,gond};
    box(10,0.3,7,-12,0.15,39,0xc99a6b); box(4,0.15,1,-12,0.075,35,0xc99a6b);
  }

  function buildZone(zoneId){
    if(worldGroup){ scene.remove(worldGroup); }
    worldGroup = new THREE.Group();
    const z = ZONES[zoneId];
    waterMesh = null; fountainParticles = null; screenInfo = null; screenCanvas = null; spinners = []; ferris = null; racers = []; raceCanvas = null;

    // ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(z.size, z.size),
      new THREE.MeshLambertMaterial({ map: makeGroundTexture(zoneId==='fishing'?0x3a6b3a:0x4a7c4a, zoneId==='fishing'?0x356035:0x427042) })
    );
    ground.rotation.x = -Math.PI/2; ground.receiveShadow = true;
    if(zoneId!=='plaza') worldGroup.add(ground); else buildPlazaFloor();

    // plaza paths (cross)
    if(false){
      const pathMat = new THREE.MeshLambertMaterial({ color:0xb8a080 });
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(z.size, 0.1, 4), pathMat); p1.position.y=0.05; p1.receiveShadow=true; worldGroup.add(p1);
      const p2 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, z.size), pathMat); p2.position.y=0.05; p2.receiveShadow=true; worldGroup.add(p2);
      const ring = new THREE.Mesh(new THREE.RingGeometry(4,10,48), new THREE.MeshLambertMaterial({color:0xcbb99a, side:THREE.DoubleSide}));
      ring.rotation.x=-Math.PI/2; ring.position.y=0.11; ring.receiveShadow=true; worldGroup.add(ring); // sân lát quanh đài phun
    }

    // buildings (low-poly nhiều tầng, mặt tiền quay theo ry)
    z.buildings.forEach(b=>{
      const g=new THREE.Group(), sw=Math.abs(Math.sin(b.ry||0))>.5, lw=sw?b.d:b.w, ld=sw?b.w:b.d;
      const add=(w,h,d,x,y,zz,c,cast)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color:c})); m.position.set(x,y,zz); m.castShadow=!!cast; m.receiveShadow=true; g.add(m); };
      add(lw,b.h,ld,0,b.h/2,0,b.color,true); add(lw+0.6,0.5,ld+0.6,0,b.h+0.25,0,b.roof,true);
      const fl=Math.max(1,Math.round(b.h/3)), fh=b.h/fl, n=Math.max(2,Math.floor(lw/2.6)), sp=lw/n;
      for(let f=0;f<fl;f++){
        if(f>0) add(lw+0.3,0.18,ld+0.3,0,f*fh,0,0xf3e3b8);
        for(let i=0;i<n;i++){ const x=-lw/2+sp*(i+.5); if(f===0&&Math.abs(x)<1.4) continue;
          add(1.3,1.3,0.12,x,f*fh+fh*0.55,ld/2+0.03,0xf3e3b8); add(1.05,1.05,0.14,x,f*fh+fh*0.55,ld/2+0.05,0x58b8c0); }
      }
      add(1.6,2.4,0.14,0,1.2,ld/2+0.05,0x3b2a22);
      for(let i=0;i<6;i++) add(lw/6,0.15,1.2,-lw/2+lw/12+i*lw/6,2.9,ld/2+0.6,i%2?0xffffff:b.roof);
      const sg=makeTextSprite(b.name,{fontsize:30,color:'#ffffff',bg:'rgba(70,40,60,.85)'}); sg.position.set(0,3.75,ld/2+0.3); sg.scale.set(0.85*sg.userData.ar,0.85,1); g.add(sg);
      g.position.set(b.x,0,b.z); g.rotation.y=b.ry||0; worldGroup.add(g);
    });

    // trees
    (z.trees||[]).forEach(t=>makeTree(t.x,t.z,1));

    // benches
    (z.benches||[]).forEach(b=>{
      const bench=new THREE.Group(), wd=new THREE.MeshLambertMaterial({color:0xb06a35}), mt=new THREE.MeshLambertMaterial({color:0x2f4a3a});
      const bx=(w,h,d,x,y,zz,m)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(x,y,zz); o.castShadow=true; bench.add(o); };
      bx(2,0.1,0.55,0,0.55,0.05,wd); bx(2,0.1,0.1,0,0.95,-0.22,wd); bx(2,0.1,0.1,0,0.75,-0.22,wd);
      [-0.9,0.9].forEach(x=>{ bx(0.1,0.55,0.55,x,0.28,0,mt); bx(0.1,0.1,0.6,x,0.8,0,mt); });
      bench.position.set(b.x,0.1,b.z); bench.rotation.y = b.ry||0; worldGroup.add(bench);
    });

    // lamps (đèn lồng)
    (z.lamps||[]).forEach(l=>{
      const lamp=new THREE.Group(), dk=new THREE.MeshLambertMaterial({color:0x2f4a3a});
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.14,3.6,6),dk); pole.position.y=1.8; lamp.add(pole);
      const bulb=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.8,0.7),new THREE.MeshLambertMaterial({color:0xf2d98a,emissive:0x6a5a20})); bulb.position.y=4.0; lamp.add(bulb);
      const cap=new THREE.Mesh(new THREE.ConeGeometry(0.6,0.4,4),dk); cap.position.y=4.6; cap.rotation.y=Math.PI/4; lamp.add(cap);
      lamp.position.set(l.x,0,l.z); worldGroup.add(lamp);
    });

    // fountain (nhiều tầng + tia nước vòng cung)
    if(z.fountain){
      const f=new THREE.Group(), cm=(c,o)=>new THREE.MeshLambertMaterial({color:c,transparent:!!o,opacity:o||1});
      const cyl=(r1,r2,h,y,c,o)=>{ const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,32),cm(c,o)); m.position.y=y; m.castShadow=true; f.add(m); };
      cyl(3.4,3.6,0.7,0.35,0xe0c9a0); cyl(3.0,3.0,0.12,0.72,0x7fd6da,0.95); cyl(1.1,1.4,0.5,0.95,0xe0c9a0); cyl(0.85,0.85,0.1,1.22,0x34b4c2);
      const jm=new THREE.MeshBasicMaterial({color:0xc4f3f7,transparent:true,opacity:0.85});
      for(let i=0;i<8;i++){ const a=i/8*Math.PI*2, c=Math.cos(a), s=Math.sin(a);
        const cv=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,1.3,0),new THREE.Vector3(c*1.6,4.2,s*1.6),new THREE.Vector3(c*2.7,0.8,s*2.7));
        f.add(new THREE.Mesh(new THREE.TubeGeometry(cv,16,0.05,5,false),jm)); }
      f.position.set(z.fountain.x,0.14,z.fountain.z); worldGroup.add(f);
    }

    // water (fishing zone)
    if(z.water){
      const w = z.water;
      waterMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w.w, w.d, 20, 10),
        new THREE.MeshLambertMaterial({color:0x1a5a8a, transparent:true, opacity:0.85})
      );
      waterMesh.rotation.x = -Math.PI/2; waterMesh.position.set(w.x, 0.1, w.z);
      worldGroup.add(waterMesh);
      // docks
      (z.docks||[]).forEach(d=>{
        const dock = new THREE.Mesh(new THREE.BoxGeometry(4,0.3,3), new THREE.MeshLambertMaterial({color:0x6b4423}));
        dock.position.set(d.x, 0.15, d.z); dock.castShadow=true; dock.receiveShadow=true; worldGroup.add(dock);
      });
    }

    // portal (glowing ring)
    if(z.portal){
      const p = z.portal;
      const ring = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.1, p.d), new THREE.MeshBasicMaterial({color:0xffd700, transparent:true, opacity:0.5}));
      ring.position.set(p.x, 0.1, p.z); worldGroup.add(ring);
      const sign = makeTextSprite(p.label, {fontsize:28, color:'#fff', bg:'rgba(255,180,0,.8)'});
      sign.position.set(p.x, 3, p.z); sign.scale.set(0.8*sign.userData.ar, 0.8, 1); worldGroup.add(sign);
    }

    // màn hình lớn (công viên)
    if(z.screen){
      const sc = z.screen, g = new THREE.Group(), dark = new THREE.MeshLambertMaterial({color:0x1a2538});
      const frame = new THREE.Mesh(new THREE.BoxGeometry(sc.w+1, sc.h+1, 0.8), dark); frame.position.y = sc.y + sc.h/2; frame.castShadow = true; g.add(frame);
      [-1,1].forEach(k=>{ const post = new THREE.Mesh(new THREE.BoxGeometry(0.9, sc.y+0.5, 0.9), dark); post.position.set(k*sc.w*0.32, (sc.y+0.5)/2, 0); g.add(post); });
      screenCanvas = document.createElement('canvas'); screenCanvas.width = 1280; screenCanvas.height = 720;
      screenTex = new THREE.CanvasTexture(screenCanvas);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(sc.w, sc.h), new THREE.MeshBasicMaterial({map:screenTex}));
      panel.position.set(0, sc.y + sc.h/2, 0.41); g.add(panel);
      g.position.set(sc.x, 0, sc.z); worldGroup.add(g);
      screenInfo = sc; setScreenText('GCITY TV', 'Lại gần bấm E để chọn video YouTube');
    }
    // ô mini game (pad phát sáng + viên ngọc xoay + nhãn)
    (z.games||[]).forEach(gm=>{
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,0.2,24), new THREE.MeshLambertMaterial({color:gm.color}));
      pad.position.set(gm.x, 0.1, gm.z); worldGroup.add(pad);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshLambertMaterial({color:gm.color, emissive:gm.color, emissiveIntensity:0.5}));
      gem.position.set(gm.x, 2, gm.z); worldGroup.add(gem); spinners.push(gem);
      const lb = makeTextSprite(gm.icon+' '+gm.name, {fontsize:30, color:'#fff', bg:'rgba(0,0,0,.7)'});
      lb.position.set(gm.x, 3.7, gm.z); lb.scale.set(0.6*lb.userData.ar, 0.6, 1); worldGroup.add(lb);
    });

    scene.add(worldGroup);
    return z;
  }

  // ===== TEXT SPRITE (name + chat) =====
  function makeTextSprite(text, opts={}){
    const { fontsize=24, color='#fff', bg='rgba(0,0,0,.6)' } = opts;
    const SS = 3;   // vẽ gấp 3 lần rồi thu nhỏ → chữ nét trên màn retina và khi camera zoom gần
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    g.font = `bold ${fontsize}px sans-serif`;
    const lw = Math.ceil(g.measureText(text).width + 20), lh = fontsize + 16;
    c.width = lw*SS; c.height = lh*SS;
    const g2 = c.getContext('2d');
    g2.scale(SS, SS);
    g2.fillStyle = bg;
    roundRect2(g2, 0, 0, lw, lh, 8); g2.fill();
    g2.font = `bold ${fontsize}px sans-serif`; g2.fillStyle = color; g2.textAlign='center'; g2.textBaseline='middle';
    if(/,0\)$/.test(bg)){ g2.lineWidth=6; g2.lineJoin='round'; g2.strokeStyle='rgba(20,30,40,.7)'; g2.strokeText(text, lw/2, lh/2); }
    g2.fillText(text, lw/2, lh/2);
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest:false }));
    spr.userData.ar = lw/lh; return spr;
  }
  function roundRect2(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }

  // ===== CHARACTER BUILDER (primitives) =====
  function createCharacter(gender, idx, name, isMe){
    const def = CHAR_DEFS[gender][idx % CHAR_DEFS[gender].length];
    const g = new THREE.Group();
    const parts = {};

    const skinMat = new THREE.MeshLambertMaterial({color:def.skin});
    const shirtMat = new THREE.MeshLambertMaterial({color:def.shirt});
    const pantsMat = new THREE.MeshLambertMaterial({color:def.pants});
    const hairMat = new THREE.MeshLambertMaterial({color:def.hair});

    // legs (pivot at hip)
    parts.legL = new THREE.Group(); parts.legL.position.set(-0.35, 1.2, 0);
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 1.2, 10), pantsMat); legL.position.y=-0.6; legL.castShadow=true;
    parts.legL.add(legL); g.add(parts.legL);
    parts.legR = new THREE.Group(); parts.legR.position.set(0.35, 1.2, 0);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 1.2, 10), pantsMat); legR.position.y=-0.6; legR.castShadow=true;
    parts.legR.add(legR); g.add(parts.legR);
    // shoes
    const shoeMat = new THREE.MeshLambertMaterial({color:0x222222});
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.2,0.5), shoeMat); shoeL.position.set(-0.35,-0.1,0.05); g.add(shoeL); parts.shoeL=shoeL;
    const shoeR = shoeL.clone(); shoeR.position.x=0.35; g.add(shoeR); parts.shoeR=shoeR;

    // body
    let body;
    if(def.skirt){
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 1.2, 8), shirtMat);
    } else {
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.5, 1.3, 14), shirtMat);
    }
    body.position.y = 1.85; if(!def.skirt) body.scale.z = 0.62; body.castShadow=true; g.add(body); parts.body=body;

    // arms (pivot at shoulder)
    parts.armL = new THREE.Group(); parts.armL.position.set(-0.75, 2.4, 0);
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 1.1, 8), skinMat); armL.position.y=-0.55; armL.castShadow=true;
    parts.armL.add(armL); g.add(parts.armL);
    parts.armR = new THREE.Group(); parts.armR.position.set(0.75, 2.4, 0);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 1.1, 8), skinMat); armR.position.y=-0.55; armR.castShadow=true;
    parts.armR.add(armR); g.add(parts.armR);

    // head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), skinMat);
    head.position.y = 3.0; head.castShadow=true; g.add(head); parts.head=head;
    // eyes
    const eyeMat = new THREE.MeshBasicMaterial({color:0x222});
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06,6,6), eyeMat); eyeL.position.set(-0.18, 3.05, 0.45); g.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.x=0.18; g.add(eyeR);

    // hair styles
    if(def.hairStyle==='short' || def.hairStyle==='spiky'){
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI*2, 0, Math.PI/2), hairMat);
      hair.position.y=3.05; hair.castShadow=true; g.add(hair);
      if(def.hairStyle==='spiky'){
        for(let i=0;i<5;i++){
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12,0.4,6), hairMat);
          const a = -0.5 + i*0.25;
          spike.position.set(Math.sin(a)*0.3, 3.5, Math.cos(a)*0.3);
          spike.rotation.x = -a*0.8; g.add(spike);
        }
      }
    } else if(def.hairStyle==='curly'){
      for(let i=0;i<8;i++){
        const a = i/8*Math.PI*2;
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.2,6,6), hairMat);
        curl.position.set(Math.cos(a)*0.5, 3.2+Math.sin(i)*0.1, Math.sin(a)*0.5); g.add(curl);
      }
    } else if(def.hairStyle==='long'){
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI*2, 0, Math.PI/2), hairMat);
      hair.position.y=3.05; g.add(hair);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.3), hairMat);
      back.position.set(0, 2.5, -0.35); g.add(back);
    } else if(def.hairStyle==='ponytail'){
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI*2, 0, Math.PI/2), hairMat);
      hair.position.y=3.05; g.add(hair);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.2,0.8,8), hairMat);
      tail.position.set(0, 2.7, -0.5); tail.rotation.x=0.4; g.add(tail);
    } else if(def.hairStyle==='twin'){
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI*2, 0, Math.PI/2), hairMat);
      hair.position.y=3.05; g.add(hair);
      const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.18,0.7,8), hairMat);
      t1.position.set(-0.55, 2.8, -0.2); t1.rotation.z=0.3; g.add(t1);
      const t2 = t1.clone(); t2.position.x=0.55; t2.rotation.z=-0.3; g.add(t2);
    }

    // name tag
    const nameTag = makeTextSprite(name, { fontsize:30, color:'#ffffff', bg:'rgba(0,0,0,0)' });
    nameTag.position.y = 3.9; nameTag.scale.set(0.75*nameTag.userData.ar, 0.75, 1);
    g.add(nameTag); parts.nameTag = nameTag;
    parts.chatBubble = null;

    g.scale.setScalar(0.62);
    g.userData = { parts, gender, idx, def, action:null, actionT:0, moving:false, walkT:0, dir:0 };
    return g;
  }

  function setChatBubble(charGroup, text){
    const parts = charGroup.userData.parts;
    if(parts.chatBubble){ charGroup.remove(parts.chatBubble); parts.chatBubble = null; }
    if(!text) return;
    const bubble = makeTextSprite(text.length>24? text.slice(0,24)+'…' : text, { fontsize:22, color:'#222', bg:'#ffffff' });
    bubble.position.y = 4.6; bubble.scale.set(5, 1.2, 1);
    charGroup.add(bubble); parts.chatBubble = bubble;
  }

  // ===== ANIMATION =====
  function updateCharacter(charGroup, dt, time){
    const ud = charGroup.userData;
    const p = ud.parts;
    ud.walkT += dt * (ud.moving? 8 : 0);
    const swing = ud.moving ? Math.sin(ud.walkT)*0.6 : 0;

    // reset
    p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
    p.armL.rotation.x = -swing*0.8; p.armR.rotation.x = swing*0.8;
    p.armL.rotation.z = 0; p.armR.rotation.z = 0;
    charGroup.position.y = 0;
    charGroup.rotation.y = ud.face || 0;
    p.body.rotation.z = 0;
    p.body.scale.y = 1;

    if(ud.action){
      ud.actionT += dt;
      const t = ud.actionT;
      if(ud.action==='jump'){
        charGroup.position.y = Math.abs(Math.sin(t*Math.PI/0.8)) * 1.5;
      } else if(ud.action==='sit'){
        charGroup.position.y = -0.4;
        p.legL.rotation.x = 1.2; p.legR.rotation.x = 1.2;
      } else if(ud.action==='wave'){
        p.armR.rotation.x = -2.2 + Math.sin(t*6)*0.3;
      } else if(ud.action==='cry'){
        p.armL.rotation.x = -1.8; p.armR.rotation.x = -1.8;
        p.body.rotation.z = Math.sin(t*4)*0.05;
      } else if(ud.action && ud.action.startsWith('dance')){
        // generic dance: arm wave + body bounce + spin
        const bt = t*5;
        p.armL.rotation.x = -1.5 + Math.sin(bt)*0.8;
        p.armR.rotation.x = -1.5 + Math.cos(bt)*0.8;
        p.armL.rotation.z = Math.sin(bt)*0.5;
        p.armR.rotation.z = -Math.cos(bt)*0.5;
        charGroup.position.y = Math.abs(Math.sin(bt*2))*0.3;
        charGroup.rotation.y += Math.sin(bt*0.7)*0.6;
        p.body.scale.y = 1 + Math.sin(bt*2)*0.05;
      } else if(ud.action==='holla'){
        p.armL.rotation.x = -2.5; p.armR.rotation.x = -2.5;
        charGroup.position.y = Math.abs(Math.sin(t*8))*0.2;
      }
    }
  }

  // ===== CAMERA =====
  function updateCamera(px, pz, py = 0){
    const now = performance.now();
    const dt = Math.min(0.05, (now-camLastT)/1000); camLastT = now;
    // dịch chuyển xa (qua cổng zone, spawn lại) → đặt camera ngay, không cho "bay" xuyên map
    if(Math.hypot(px-camLastX, pz-camLastZ) > 6) camSnap = true;
    camLastX = px; camLastZ = pz;

    const cp = Math.cos(camPitch), ly = py + CAM.lookY;
    camTarget.set(px + Math.sin(camAngle)*cp*camDist,
                  ly + Math.sin(camPitch)*camDist,
                  pz + Math.cos(camAngle)*cp*camDist);
    if(camSnap){ camera.position.copy(camTarget); camSnap = false; }
    else camera.position.lerp(camTarget, 1 - Math.pow(1-CAM.follow, dt*60));   // = lerp .2 @60FPS, đồng đều ở mọi tần số quét
    camera.lookAt(px, ly, pz);
  }
  function getMoveDir(){
    // trả về hướng di chuyển tương đối camera: {x, z}
    return { fx: -Math.sin(camAngle), fz: -Math.cos(camAngle), rx: Math.cos(camAngle), rz: -Math.sin(camAngle) };
  }

  // ===== COLLISION / INTERACTION =====
  function getZone(zoneId){ return ZONES[zoneId]; }
  function collides(zoneId, x, zpos, r=0.8){
    const z = ZONES[zoneId];
    if(Math.abs(x)>z.size/2-r || Math.abs(zpos)>z.size/2-r) return true;
    for(const b of z.buildings){
      if(Math.abs(x-b.x)<b.w/2+r && Math.abs(zpos-b.z)<b.d/2+r) return true;
    }
    for(const t of (z.trees||[])){ if(Math.hypot(x-t.x, zpos-t.z)<1.2+r) return true; }
    if(z.fountain && Math.hypot(x-z.fountain.x, zpos-z.fountain.z)<3.5+r) return true;
    if(z.screen && Math.abs(x-z.screen.x)<z.screen.w/2+r && Math.abs(zpos-z.screen.z)<1.2+r) return true;
    if(zoneId==='plaza' && Math.hypot(x,zpos)>53) return true;
    if(z.race && ((x-z.race.x)/(z.race.rx+r))**2+((zpos-z.race.z)/(z.race.rz+r))**2<1) return true;
    if(z.rentLot && Math.abs(x-z.rentLot.x)<5.5 && Math.abs(zpos-z.rentLot.z)<13) return true;
    if(z.wheel && Math.hypot(x-z.wheel.x,zpos-z.wheel.z)<z.wheel.r+r) return true;
    if(z.water){ const w=z.water; if(Math.abs(x-w.x)<w.w/2 && Math.abs(zpos-w.z)<w.d/2 && zpos>w.z-w.d/2+2) return true; }
    return false;
  }
  function atPortal(zoneId, x, z){
    const p = ZONES[zoneId].portal; if(!p) return null;
    if(Math.abs(x-p.x)<p.w/2 && Math.abs(z-p.z)<p.d/2) return p;
    return null;
  }
  function nearBuilding(zoneId, x, z){
    for(const b of ZONES[zoneId].buildings){
      if(Math.hypot(x-b.x, z-(b.z+b.d/2)) < 4) return b;
    }
    return null;
  }
  function atDock(zoneId, x, z){
    const z_ = ZONES[zoneId];
    if(zoneId!=='fishing' || !z_.docks) return false;
    for(const d of z_.docks){ if(Math.hypot(x-d.x, z-d.z)<3) return true; }
    return false;
  }

  // ===== CÔNG VIÊN: điểm tương tác + màn hình =====
  function nearSpot(zoneId, x, z){
    const Z = ZONES[zoneId]; let best = null, bd = 1e9;
    const test = (kind, ref, px, pz, rad, label)=>{ const d = Math.hypot(x-px, z-pz); if(d<rad && d<bd){ bd=d; best={kind, ref, label}; } };
    Z.buildings.forEach(b=>{ const ry=b.ry||0, ld=Math.abs(Math.sin(ry))>.5?b.w:b.d; test('building', b, b.x+Math.sin(ry)*ld/2, b.z+Math.cos(ry)*ld/2, 4.5, b.name); });
    (Z.games||[]).forEach(g=>test('game', g, g.x, g.z, 3, g.icon+' '+g.name));
    (Z.benches||[]).forEach(b=>test('bench', b, b.x, b.z, 1.8, 'Ngồi'));
    if(Z.race) test('race', Z.race, Z.race.x-9.5, Z.race.z, 5, '🎟 Trường đua');
    if(Z.rentLot) test('vehicle', Z.rentLot, Z.rentLot.x+6, Z.rentLot.z, 6, '🚗 Thuê xe · 4/4 · ✈ 2/2');
    if(!best && Z.screen) test('screen', Z.screen, Z.screen.x, Z.screen.z+8, 9, '📺 Màn hình lớn (chọn video)');
    return best;
  }
  function setScreenText(a, b){
    if(!screenCanvas) return;
    const g = screenCanvas.getContext('2d'), gr = g.createLinearGradient(0,0,1280,720);
    gr.addColorStop(0,'#0f1b33'); gr.addColorStop(1,'#1c2f55'); g.fillStyle = gr; g.fillRect(0,0,1280,720);
    g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.font = 'bold 120px sans-serif'; g.fillText(a, 640, 340);
    g.fillStyle = '#fff'; g.font = '44px sans-serif'; g.fillText(b, 640, 430);
    screenTex.needsUpdate = true;
  }
  // 4 góc màn hình (TL,TR,BR,BL) theo toạ độ pixel; null nếu không có/ở sau camera
  function screenCorners2D(){
    if(!screenInfo) return null;
    const sc = screenInfo, zf = sc.z + 0.43, W = window.innerWidth, H = window.innerHeight;
    camera.updateMatrixWorld();
    const vs = [[-1,1],[1,1],[1,0],[-1,0]].map(([kx,ky])=> new THREE.Vector3(sc.x + kx*sc.w/2, sc.y + ky*sc.h, zf));
    if(vs.some(v=> v.clone().applyMatrix4(camera.matrixWorldInverse).z > -0.2)) return null;
    return vs.map(v=>{ const p = v.project(camera); return [(p.x+1)/2*W, (1-p.y)/2*H]; });
  }

  // ===== RENDER LOOP =====
  function render(time){
    if(!RES.fixed){   // chỉ hạ, không tăng lại → không bị giật qua lại giữa 2 mức
      const now = performance.now();
      if(document.hidden){ RES.t = 0; RES.n = 0; }
      else if(!RES.t){ RES.t = now; RES.n = 0; }
      else if(++RES.n && now-RES.t >= 1500){
        const fps = RES.n*1000/(now-RES.t); RES.t = now; RES.n = 0;
        if(RES.warm) RES.warm = false;                      // bỏ qua cửa sổ đầu (biên dịch shader)
        else if(fps < 24 && RES.cur > RES.min){
          if(++RES.low >= 2){ RES.low = 0; RES.cur = Math.max(RES.min, RES.cur-0.5); renderer.setPixelRatio(RES.cur); renderer.setSize(window.innerWidth, window.innerHeight); }
        } else RES.low = 0;
      }
    }
    spinners.forEach(m=>{ m.rotation.y = time*1.5; });
    if(ferris){ ferris.rot.rotation.z = time*0.2; ferris.gond.forEach(g=>g.rotation.z = -time*0.2); }
    // fountain particles
    if(fountainParticles){
      const pos = fountainParticles.geometry.attributes.position.array;
      const ud = fountainParticles.userData;
      for(let i=0;i<ud.N;i++){
        ud.t[i] += 0.03;
        const phase = ud.t[i] % 1.5;
        const a = ud.a[i];
        pos[i*3] = Math.cos(a)*phase*2;
        pos[i*3+1] = 3 + phase*3 - phase*phase*3;
        pos[i*3+2] = Math.sin(a)*phase*2;
      }
      fountainParticles.geometry.attributes.position.needsUpdate = true;
    }
    if(waterMesh){
      const pos = waterMesh.geometry.attributes.position.array;
      for(let i=0;i<pos.length;i+=3){
        pos[i+2] = Math.sin(time*2 + pos[i]*0.3 + pos[i+1]*0.2)*0.15;
      }
      waterMesh.geometry.attributes.position.needsUpdate = true;
      waterMesh.geometry.computeVertexNormals();
    }
    renderer.render(scene, camera);
  }

  return { init, buildZone, createCharacter, setChatBubble, updateCharacter,
    updateCamera, getMoveDir, collides, atPortal, nearBuilding, atDock, render, nearSpot, setScreenText, screenCorners2D, setRacers, setRaceBoard,
    getZone, CHAR_DEFS, get scene(){return scene;}, get camera(){return camera;}, get pixelRatio(){return RES.cur;} };
})();
