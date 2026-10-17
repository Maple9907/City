/* ===== GCITY Player =====
 * Player entity: dữ liệu người chơi + danh sách hành động (emotes). Di chuyển/animation nằm ở game.js + three-scene.js.
 */
const Player = (() => {
  const EMOTES = [
    { id:'wave', icon:'👋', name:'Giơ tay chiến thắng', duration:2.5 },
    { id:'cry', icon:'😢', name:'Khóc', duration:3 },
    { id:'sit', icon:'🧘', name:'Ngồi xếp bằng', duration:999 }, // toggle
    { id:'jump', icon:'⬆️', name:'Nhảy', duration:0.8 },
    { id:'dance1', icon:'💃', name:'Nhảy Bby WOW', duration:4 },
    { id:'dance2', icon:'🕺', name:'Nhảy CHAT', duration:4 },
    { id:'dance3', icon:'🐔', name:'Điệu nhảy gà vui nhộn', duration:4 },
    { id:'dance4', icon:'❤️', name:'Nhảy love options', duration:4 },
    { id:'dance5', icon:'🙏', name:'Nhảy sawadika', duration:4 },
    { id:'dance6', icon:'🎵', name:'Điệu Rumba uyển chuyển', duration:4 },
    { id:'dance7', icon:'🎤', name:'Biểu diễn hip hop', duration:4 },
    { id:'holla', icon:'✊', name:'Holla', duration:2 },
  ];

  function create(opts){
    return {
      id: opts.id || 'me',
      name: opts.name || 'Player',
      gender: opts.gender || 'male',
      charIndex: opts.charIndex || 0,
      x: opts.x || 600, y: opts.y || 400,
      dir: 0,              // 0=down,1=right,2=up,3=left
      moving: false,
      frame: 0, frameT: 0,
      action: null, actionT: 0, actionDur: 0,
      targetX: null, targetY: null, // click-to-move
      speed: GCITY_CONFIG.GAME.moveSpeed,
      chatBubble: null, chatT: 0,
      coins: GCITY_CONFIG.GAME.startCoins,
      inventory: { worm:10, shrimp:0, lure:0, fish:0, rod:1 },
      zone: 'plaza'
    };
  }

  function doAction(p, emoteId){
    const e = EMOTES.find(e=>e.id===emoteId);
    if(!e) return;
    if(p.action === 'sit' && emoteId !== 'sit'){ p.action=null; }
    if(emoteId === 'sit' && p.action === 'sit'){ p.action = null; return; }
    p.action = emoteId; p.actionT = 0; p.actionDur = e.duration;
  }

  function say(p, text){
    p.chatBubble = text; p.chatT = 5;
  }

  return { create, doAction, say, EMOTES };
})();
