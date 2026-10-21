/* ===== GCITY Configuration =====
 * Để dùng Firebase: tạo project Firebase, bật Realtime Database + Authentication,
 * copy config dưới đây và đặt USE_FIREBASE = true.
 * Hướng dẫn chi tiết xem README.md
 */
const GCITY_CONFIG = {
  USE_FIREBASE: false,  // đổi thành true khi đã cấu hình Firebase

  // Tìm video YouTube bằng cách gõ tên (NPC 📺 Anh Chiếu Màn).
  // Key đặt trong js/keys.js (đọc qua YTKEYS, xoay vòng nhiều key — mỗi key miễn phí ~100 lượt tìm/ngày).
  // File đó được phát công khai cùng game nên PHẢI giới hạn key theo tên miền trong Google Cloud Console (xem đầu js/ytkeys.js).
  // Chạy local không có key vẫn chơi được, chỉ dán link video thay vì gõ từ khoá.
  YOUTUBE: { KEYS_FILE:'js/keys.js', GLOBAL:'GCITY_KEYS' },
  FIREBASE: {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "0000000000",
    appId: "1:000:web:abcdef"
  },

  // Nhân vật 3D từ file GLB (js/glbchar.js). Key = 'giớitính:thứ-tự-trong-bảng-chọn', vd 'male:0' = nhân vật nam đầu tiên.
  // Không có file hoặc lỗi tải → tự dùng nhân vật dựng sẵn, game không bị treo. Thêm nhân vật khác = thêm 1 dòng.
  // Tuỳ chọn mỗi model: height, headScale, legScale, outline, lift, gripAhead, yaw, bones (xem đầu file js/glbchar.js)
  MODELS: {
    'male:0':   { url:'models/male0.glb' },
    'male:1':   { url:'models/man_casual.glb' },
    'male:2':   { url:'models/man_punk.glb' },
    'male:3':   { url:'models/man_suit.glb' },
    'male:4':   { url:'models/man_worker.glb' },
    'male:5':   { url:'models/man_beach.glb' },
    'female:0': { url:'models/female0.glb' },
    'female:1': { url:'models/woman_casual.glb' },
    'female:2': { url:'models/woman_formal.glb' },
    'female:3': { url:'models/woman_punk.glb' },
    'female:4': { url:'models/woman_suit.glb' },
    'female:5': { url:'models/woman_worker.glb' }
  },

  GAME: {
    startCoins: 100,
    moveSpeed: 160,          // px/sec
    runSpeed: 280,
    playerName: "Player",
    defaultZone: "plaza",
    botCount: 0              // 0 = không có bot (đặt >0 nếu muốn bot mô phỏng người chơi khi offline)
  }
};
