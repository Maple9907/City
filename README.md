# 🏙️ GCITY 3D - Game Thành phố (bản 3D WebGL)

Bản 3D thật dùng Three.js. Yêu cầu trình duyệt hỗ trợ WebGL (Chrome, Edge, Firefox, Safari mới nhất).

## Chạy
Mở `index.html` hoặc `npx serve .`


## Tính năng
- Quảng trường 3D thật: tòa nhà, cây, đài phun nước có hạt nước, đèn đường, ghế đá
- Nhân vật 3D dựng từ khối nguyên thủy (6 nam + 6 nữ), animation đi/nhảy/ngồi/vẫy/7 điệu nhảy
- Camera third-person, kéo chuột xoay, lăn chuột zoom
- WASD di chuyển tương đối camera, E tương tác tòa nhà
- 2 zone: Quảng trường ↔ Đảo câu cá (cổng tàu)
- Chat real-time (bong bóng trên đầu), mini-game câu cá, xổ số, rạp phim, thuê đồ
- Multiplayer Firebase (đổi USE_FIREBASE=true trong js/config.js)

## Asset
Toàn bộ asset tự vẽ bằng Three.js geometry (không file ngoài). Thay bằng model GLTF/ảnh của bạn trong `js/three-scene.js`.

## Bản Công viên (cập nhật)
- Zone chính là **Công viên GCITY**: đài phun nước ở giữa, 8 ghế quanh đài + 3 ghế hướng về màn hình (E để ngồi/đứng dậy, đi là tự đứng dậy)
- **Màn hình lớn** phía bắc chiếu YouTube: đứng gần bấm E (hoặc nút 📺 TV), dán link. Video bám theo màn hình 3D khi xoay camera
- Phải chạy qua http (`npx serve .` / GitHub Pages). Mở file:// thì YouTube báo lỗi 153
