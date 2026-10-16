# 🏙️ GCITY 3D - Game Thành phố (bản 3D WebGL)

Bản 3D thật dùng Three.js. Yêu cầu trình duyệt hỗ trợ WebGL (Chrome, Edge, Firefox, Safari mới nhất).

## Chạy
Mở `index.html` hoặc `npx serve .`

## 

## Tính năng
- Quảng trường 3D thật: tòa nhà, cây, đài phun nước Hoàng Gia 3 tầng có tia nước hạt, đèn đường, ghế đá
- Nhân vật 3D dựng từ khối nguyên thủy (6 nam + 6 nữ), animation đi/nhảy/ngồi/vẫy/7 điệu nhảy
- Camera third-person, kéo chuột xoay, lăn chuột zoom
- WASD di chuyển tương đối camera, E tương tác tòa nhà
- 2 zone: Quảng trường ↔ Đảo câu cá (cổng tàu)
- Chat real-time (bong bóng trên đầu), mini-game câu cá, xổ số, rạp phim, thuê đồ
- Multiplayer Firebase (đổi USE_FIREBASE=true trong js/config.js)
- NPC đứng ở các điểm chơi; offline không có bot (đổi `botCount` trong js/config.js nếu muốn)

## Asset
Toàn bộ asset tự vẽ bằng Three.js geometry (không file ngoài). Thay bằng model GLTF/ảnh của bạn trong `js/three-scene.js`.

## Bản Công viên (cập nhật)
- Zone chính là **Công viên GCITY**: đài phun nước ở giữa, 8 ghế quanh đài + 3 ghế hướng về màn hình (**chạm vào ghế để ngồi** — xa thì nhân vật tự đi tới; chạm ra chỗ khác hoặc di chuyển joystick/WASD để đứng dậy)
- **Màn hình lớn** phía bắc chiếu YouTube: lại gần **chạm vào NPC 📺 Anh Chiếu Màn** (cạnh sân khấu) hoặc bấm E, dán link. Video bám theo màn hình 3D khi xoay camera
- **Game chơi qua NPC** (không có menu, không có chữ gợi ý): lại gần NPC (🃏 Lật hình, 🎟 Đánh lô, 🎟 Trường đua) rồi **chạm vào NPC** (hoặc bấm E trên desktop). Đánh lô: chọn số 01–99, tự đặt xu, 10 giải quay độc lập, mỗi giải trúng thưởng ×10 tiền đặt, trúng nhiều giải thì cộng dồn
- Phải chạy qua http (`npx serve .` / GitHub Pages). Mở file:// thì YouTube báo lỗi 153

## Trường đua thú (cập nhật: 7 thú)
- Đường đua mở rộng thành **sân vận động 7 làn** (2 đoạn thẳng + 2 nửa vòng), có vạch xuất phát, cổng số làn, vạch đích caro, lan can 2 tầng, bãi cỏ giữa
- **7 bạn thú** dựng chi tiết bằng khối Three.js (`js/animals.js`): 🐎 Ngựa Đỏ, 🐕 Chó Xanh, 🐇 Thỏ Vàng, 🐢 Rùa Tím, 🦊 Cáo Cam, 🐖 Heo Hồng, 🐸 Ếch Xanh Lá. Mỗi con có yếm/vòng cổ màu làn, thẻ số bay trên đầu, chân chạy, đuôi vẫy, tai động, con thắng nhảy ăn mừng
- Tỷ lệ cược **1 ăn 6** (vé 10🪙 → trúng nhận 60🪙). Đổi hệ số ở hằng số `MULT` trong `js/park.js`

## Đài phun nước Hoàng Gia (cập nhật)
- Dựng riêng trong `js/fountain.js` (module `Fountain`): bậc thềm đá, hồ chính viền vàng + 32 họa tiết chạm nổi, cột giữa có rãnh, 4 cột phụ, 8 con sơn, bồn giữa, bồn đỉnh, thiên cầu vàng xoay
- ~1500 hạt nước đi theo quỹ đạo tính trước nên luôn rơi đúng vào bồn đỉnh / bồn giữa / hồ, không bị cụt giữa không trung; chạy theo thời gian thực nên tốc độ không phụ thuộc màn hình 60Hz hay 120Hz
- Chi tiết lặp lại dùng `InstancedMesh` (3 draw call thay vì ~50), vật liệu Lambert cho nhẹ trên điện thoại
- Đổi kích thước: hằng số `SCALE` đầu `js/fountain.js` (va chạm `Fountain.RADIUS` tự theo). Đổi số hạt: `NM` (tia chính) và `NR` (tia vòng)
