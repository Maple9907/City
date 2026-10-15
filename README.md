# 🏙️ GCITY - Game Thành phố (Clone)

Bản tái hiện game City (gaubong.us) với **code viết hoàn toàn từ đầu** và **asset tự vẽ bằng canvas** (không dùng asset bản quyền của bên thứ ba). Sẵn sàng up lên GitHub Pages + Firebase.

## ✨ Tính năng (giữ nguyên cốt lõi)

- **Chọn nhân vật**: 6 nam + 6 nữ, vẽ procedural canvas
- **Di chuyển**: WASD / phím mũi tên / click-to-move / joystick (mobile), Shift để chạy
- **2 khu vực**: Quảng trường 3D (plaza) + Đảo câu cá (fishing), chuyển zone qua cổng tàu
- **Hành động / Emotes**: 12 động tác — vẫy tay, khóc, ngồi xếp bằng, nhảy, 7 điệu nhảy (Bby WOW, CHAT, gà, love options, sawadika, Rumba, hip hop), Holla
- **Chat real-time**: bong bóng chat trên đầu nhân vật + lịch sử chat
- **Mini-game câu cá**: quăng cần → chờ cá cắn → kéo đúng lúc → 4 loại cá giá trị khác nhau → bán lấy tiền
- **Cửa hàng thành phố**:
  - 🎬 Rạp phim (mua vé, combo bắp)
  - 🎰 Xổ số (chọn 3 số, trúng đến 1000 coin)
  - 🛵 Thuê đồ (xe máy tăng tốc, giày trượt, cần câu cao cấp)
- **Kinh tế**: coin, túi đồ (mồi, cá, vé, cần câu)
- **Bot NPC**: mô phỏng người chơi khi offline (6 bot đi lại + chat ngẫu nhiên)
- **Multiplayer thật**: tích hợp sẵn Firebase Realtime Database (chỉ cần bật config)

## 🚀 Cách chạy

Chỉ cần mở `index.html` bằng trình duyệt, hoặc dùng server tĩnh:

```bash
npx serve .
# hoặc
python3 -m http.server 8000
```

## 🔥 Up lên GitHub Pages

1. Tạo repo GitHub, push toàn bộ folder này lên
2. Vào **Settings → Pages → Source: main branch / root**
3. Game sẽ chạy tại `https://<username>.github.io/<repo>/`

## 🔌 Kết nối Firebase (multiplayer thật)

1. Tạo project tại [console.firebase.google.com](https://console.firebase.google.com)
2. Bật **Realtime Database** (chế độ test mode để chơi thử)
3. Copy config vào `js/config.js`:
   ```js
   USE_FIREBASE: true,
   FIREBASE: { apiKey: "...", databaseURL: "https://...", projectId: "...", ... }
   ```
4. Push lên GitHub Pages — người chơi khác vào cùng URL sẽ thấy nhau real-time!

## 📁 Cấu trúc

```
├── index.html          # Entry point
├── css/style.css       # Toàn bộ style (dark theme)
└── js/
    ├── config.js       # Cấu hình Firebase + game
    ├── net.js          # Lớp mạng: local mock (bot) ↔ Firebase
    ├── assets.js       # Vẽ procedural: nhân vật, cây, nhà, đài phun
    ├── map.js          # Bản đồ 2 zone, collision, điểm tương tác
    ├── player.js       # Player entity, di chuyển, actions/emotes
    ├── fishing.js      # Mini-game câu cá
    ├── ui.js           # Tất cả panel UI
    └── game.js         # Vòng lặp chính, render canvas
```

## 🎨 Thay asset

Asset được vẽ bằng canvas trong `js/assets.js` (hàm `drawCharacter`, `drawBuilding`, `drawTree`...). Để dùng ảnh thật, thay các hàm này bằng `drawImage` với ảnh PNG của bạn đặt trong folder `assets/`.

## ⚠️ Lưu ý

- Đây là bản viết lại độc lập, **không chứa mã nguồn hay asset gốc** của gaubong.us.
- Tên, tính năng, cơ chế game (gameplay mechanics) không thuộc phạm vi bản quyền.
- Asset gốc (hình ảnh nhân vật, nền) là tài sản của bên thứ ba — hãy tự tạo hoặc mua license riêng nếu muốn dùng.
