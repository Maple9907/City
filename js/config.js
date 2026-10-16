/* ===== GCITY Configuration =====
 * Để dùng Firebase: tạo project Firebase, bật Realtime Database + Authentication,
 * copy config dưới đây và đặt USE_FIREBASE = true.
 * Hướng dẫn chi tiết xem README.md
 */
const GCITY_CONFIG = {
  USE_FIREBASE: false,  // đổi thành true khi đã cấu hình Firebase

  // Tìm video YouTube bằng cách gõ tên (NPC 📺 Anh Chiếu Màn). Để trống "" = chỉ dán link được.
  // Lấy key miễn phí: Google Cloud Console -> bật "YouTube Data API v3" -> tạo API key,
  // rồi giới hạn key theo HTTP referrer (tên miền web của bạn) để người khác không dùng ké.
  YOUTUBE_API_KEY: "AIzaSyC-WpmofuFqCZB12C2B8fKOL_85qfLJTSg",

  FIREBASE: {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "0000000000",
    appId: "1:000:web:abcdef"
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
