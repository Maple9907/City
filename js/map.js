/* ===== GCITY Map =====
 * Hai zone: plaza (quảng trường) và fishing (đảo câu cá).
 * Mỗi zone có: kích thước, obstacles (buildings/trees), interactive spots, spawn points.
 */
const GameMap = (() => {
  const zones = {
    plaza: {
      name: 'Quảng trường 3D',
      width: 1200, height: 800,
      bg: '#2d5a2d',
      // obstacles: {x,y,w,h} - tòa nhà, cây (cây có r=12)
      buildings: [
        {x:40, y:40, w:160, h:120, color:'#8b4513', roof:'#5a2d0c', type:'cinema', name:'Rạp CGV'},
        {x:1000, y:40, w:160, h:120, color:'#4a5568', roof:'#2d3748', type:'lottery', name:'Xổ số City'},
        {x:40, y:640, w:140, h:120, color:'#2b6cb0', roof:'#1a365d', type:'rental', name:'Thuê đồ'},
        {x:1020, y:640, w:140, h:120, color:'#9f1239', roof:'#500724', type:'shop', name:'Cửa hàng'},
      ],
      trees: [
        {x:300,y:120,s:1},{x:420,y:90,s:1.2},{x:700,y:110,s:1},{x:850,y:140,s:1.1},
        {x:280,y:680,s:1.1},{x:500,y:700,s:1},{x:750,y:690,s:1.2},{x:950,y:700,s:1},
        {x:150,y:400,s:1},{x:1050,y:400,s:1},
      ],
      benches: [{x:400,y:400},{x:800,y:400},{x:600,y:250},{x:600,y:550}],
      fountain: {x:600, y:400},
      // khu chuyển zone: bến tàu đi đảo câu cá
      portal: {x:600, y:750, w:120, h:40, to:'fishing', label:'🚤 Đảo câu cá'},
      spawn: {x:600, y:500},
      // đường đi (path) - vẽ vỉa hè
      paths: [
        {x:0,y:380,w:1200,h:40}, {x:580,y:0,w:40,h:800}
      ]
    },
    fishing: {
      name: 'Đảo câu cá 3D',
      width: 1000, height: 700,
      bg: '#3a6b3a',
      buildings: [
        {x:40, y:40, w:120, h:90, color:'#6b4423', roof:'#4a2c1a', type:'fishshop', name:'Cửa hàng câu cá'},
      ],
      trees: [{x:200,y:100,s:1},{x:800,y:120,s:1.1},{x:150,y:550,s:1}],
      benches: [{x:400,y:300}],
      fountain: null,
      // nước (khu vực câu cá) - vùng nước lớn ở dưới
      water: {x:0, y:450, w:1000, h:250},
      // chốt câu cá (dock)
      docks: [{x:300,y:440},{x:500,y:440},{x:700,y:440}],
      portal: {x:500, y:30, w:120, h:40, to:'plaza', label:'🚤 Quảng trường'},
      spawn: {x:500, y:150},
      paths: [{x:480,y:0,w:40,h:450}]
    }
  };

  function getZone(z){ return zones[z] || zones.plaza; }

  // Kiểm tra va chạm với obstacles (buildings + trees + fountain)
  function collides(zone, x, y, r=10){
    const z = getZone(zone);
    // buildings
    for(const b of z.buildings){
      if(x+r>b.x && x-r<b.x+b.w && y+r>b.y && y-r<b.y+b.h) return true;
    }
    // trees
    for(const t of (z.trees||[])){
      if(Math.hypot(x-t.x, y-t.y) < r+12) return true;
    }
    // fountain
    if(z.fountain && Math.hypot(x-z.fountain.x, y-z.fountain.y) < r+36) return true;
    // bounds
    if(x<r || x>z.width-r || y<r || y>z.height-r) return true;
    // water (fishing zone) - không đi vào nước
    if(z.water && x>z.water.x && x<z.water.x+z.water.w && y>z.water.y+10 && y<z.water.y+z.water.h) return true;
    return false;
  }

  // Kiểm tra có đang đứng tại portal không
  function atPortal(zone, x, y){
    const z = getZone(zone);
    const p = z.portal;
    if(!p) return null;
    if(x>p.x && x<p.x+p.w && y>p.y && y<p.y+p.h) return p;
    return null;
  }

  // Kiểm tra có đang đứng gần một building interactive không
  function nearBuilding(zone, x, y){
    const z = getZone(zone);
    for(const b of z.buildings){
      const cx = b.x + b.w/2, cy = b.y + b.h;
      if(Math.hypot(x-cx, y-cy) < 60) return b;
    }
    return null;
  }

  // Kiểm tra có đang đứng tại dock câu cá không
  function atDock(zone, x, y){
    const z = getZone(zone);
    if(zone !== 'fishing' || !z.docks) return false;
    for(const d of z.docks){
      if(Math.hypot(x-d.x, y-d.y) < 40) return true;
    }
    return false;
  }

  return { getZone, collides, atPortal, nearBuilding, atDock, zones };
})();
