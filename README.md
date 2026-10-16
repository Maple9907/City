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
- **Màn hình lớn** phía bắc chiếu YouTube: lại gần **chạm vào NPC 📺 Anh Chiếu Màn** (cạnh sân khấu) hoặc bấm E, **gõ tên video để tìm** (cần `YOUTUBE_API_KEY` trong `js/config.js`) hoặc dán link. Video bám theo màn hình 3D khi xoay camera
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

## Thuê xe · máy bay (cập nhật)
- **Bãi thuê xe** ở phía tây công viên (`rentLot` trong `js/three-scene.js`): 4 xe mui trần (đỏ / xanh dương / vàng / xanh lá) + 2 máy bay (xanh / vàng) đậu trong ô kẻ vạch, có biển hiệu và bong bóng đếm xe còn lại (`Thuê xe · 4/4 · ✈ 2/2`)
- Lại gần **NPC 🚗 Tài Xế Chớp Nhoáng** → chạm vào NPC (hoặc bấm E) → chọn đúng chiếc xe / máy bay muốn thuê (xe 50🪙, máy bay 150🪙, 5 phút). Nhân vật **ngồi thật lên ghế** (tư thế ngồi), xe rời bãi; xuống xe là xe tự về bãi
- Xe: joystick hoặc nút Lùi / Tiến. Máy bay: thêm **Bay lên ↑ / Hạ cánh ↓**; cánh quạt đứng yên khi đỗ, giữ "Bay lên" thì nổ máy, **cánh quạt quay dần** rồi mới cất cánh, bay thì quay hết tốc lực. Bấm "Xuống xe · 4:22" để xuống (đang bay thì tự hạ cánh trước)
- Model xe / máy bay nằm trong `js/vehicles.js` (dùng chung cho bãi đỗ và lúc lái). Đổi giá / thời gian thuê: `PRICE`, `RENT_SEC`; đổi màu / thêm xe: `CARS`, `PLANES`

## v17: gợi ý trong bảng TV rút gọn còn "Gõ từ khoá hoặc dán link youtube để tìm".

## v16: nhân vật leo được bậc thang + đứng trên sân khấu TV (trước đây luôn ở y=0 nên chìm xuống nền cỏ); chỉ lên được bằng bậc thang giữa; 2 loa là vật cản.

## v15: đã xoá 2 ô vàng (Đánh lô) + hồng (Lật hình); NPC giữ nguyên.

## v14 — cây / toà nhà / ánh sáng / lưu dữ liệu
- **Ánh sáng**: trước đây ambient 0.85 + sun cho tổng ~1.33 ở mặt ngang → gạch, vỉa hè, cỏ bị cháy sáng thành trắng nhạt. Giờ HemisphereLight 0.30 + Ambient 0.32 + Sun 0.52 (tổng ~1.0) → màu gạch be/đỏ đất, cỏ xanh đúng như ảnh mẫu.
- **Cây** (`makeTree`): tán low-poly shading phẳng (khối 20 mặt méo nhẹ), mỗi cây một dáng/một bảng màu xanh (cố định theo vị trí), thân thon + nhánh nhỏ, bệ đất nâu viền đá kem. Mỗi cây = 1 draw call.
- **Toà nhà** (`makeBuilding`): cột góc, cửa sổ có nẹp chữ thập + bậu cửa + chậu hoa trên **cả 4 mặt** (trước đây mặt sau trơ), mái hiên sọc 3 bậc dốc, cửa chính có bậc thềm, mái có lan can + ống khói + máy lạnh. Mỗi toà = 1 mesh (trước là hàng trăm mesh/toà, mỗi mesh tạo 1 material riêng) → nhẹ hơn nhiều trên điện thoại.
- **Lưu dữ liệu** (`game.js`): lưu NGAY khi tạo nhân vật; lưu mỗi 2s theo đồng hồ thật (trước phụ thuộc FPS: dt bị kẹp 0.05 nên máy yếu 5–10 FPS phải chờ 6–12s); lưu thêm khi `pagehide` / ẩn tab (điện thoại hay không chạy `beforeunload`); cookie dự phòng; kẹp `charIndex` để save cũ không làm kẹt game; chặn bấm đúp "Vào thành phố". Dữ liệu gắn với tên miền — đổi domain là máy mới. Muốn giữ nhân vật giữa nhiều máy phải lưu lên server/Firebase theo tài khoản.
