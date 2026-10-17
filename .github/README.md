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
- **Game chơi qua NPC** (không có menu, không có chữ gợi ý): lại gần NPC (🃏 Lật hình, 🎟 Quay số may mắn, 🎟 Trường đua) rồi **chạm vào NPC** (hoặc bấm E trên desktop). Quay số may mắn: chọn số 01–99, tự chọn số xu, 10 giải quay độc lập, mỗi giải trúng thưởng ×10 số xu chơi, trúng nhiều giải thì cộng dồn
- Phải chạy qua http (`npx serve .` / GitHub Pages). Mở file:// thì YouTube báo lỗi 153

## Trường đua thú (cập nhật: 7 thú)
- Đường đua mở rộng thành **sân vận động 7 làn** (2 đoạn thẳng + 2 nửa vòng), có vạch xuất phát, cổng số làn, vạch đích caro, lan can 2 tầng, bãi cỏ giữa
- **7 bạn thú** dựng chi tiết bằng khối Three.js (`js/animals.js`): 🐎 Ngựa Đỏ, 🐕 Chó Xanh, 🐇 Thỏ Vàng, 🐢 Rùa Tím, 🦊 Cáo Cam, 🐖 Heo Hồng, 🐸 Ếch Xanh Lá. Mỗi con có yếm/vòng cổ màu làn, thẻ số bay trên đầu, chân chạy, đuôi vẫy, tai động, con thắng nhảy ăn mừng
- Tỉ lệ thưởng **×6** (vé 10 xu → về nhất nhận 60 xu). Đổi hệ số ở hằng số `MULT` trong `js/park.js`

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

## v26 — Sửa lỗi giao diện/điều khiển · lời thoại · từ nhạy cảm · dọn code chết

### Lỗi logic đã sửa
- **Đổi nhân vật** (`js/ui.js`, `js/game.js`): có nút ✕ và Esc để đóng; dùng chung ảnh xem trước 3D như lúc chọn lần đầu (bỏ `renderCharGrid3D` hình người phẳng 64×80 và đoạn "patch initCharSelect" nằm sau lệnh gọi nên không bao giờ chạy). Lần chọn đầu tiên vẫn không đóng được (chưa có nhân vật).
- **Alt-tab khi đang giữ W**: thêm xử lý `blur` / ẩn tab → nhả hết phím, nhân vật không chạy mãi.
- **Esc khi đang gõ trong ô chat / ô link TV** vẫn đóng được panel (Esc được xử lý trước bước "bỏ qua khi đang gõ").
- **Toà nhà**: RẠP PHIM, PIZZA HOUSE, SUNNY MART, MOON BAR, HAPPY TOYS chỉ để trang trí → báo "chưa mở cửa" thay vì mở nhầm menu thuê xe. XỔ SỐ CITY → vé số, THUÊ ĐỒ → thuê đồ, ĐẢO CÂU CÁ → cửa hàng mồi như cũ.
- **Nút ←** không còn thoát game ngay: hiện hộp "Bạn muốn thoát game?" (Ở lại / Thoát; Esc = ở lại), lưu game trước khi thoát.
- **Tìm YouTube** (`js/park.js`): `badRequest` / `forbidden` không còn bị coi là "key hỏng" (trước đây một từ khoá lạ khoá key cả ngày). Chỉ `keyInvalid`, `ipRefererBlocked`, `apiNotEnabled`, `accessNotConfigured` mới khoá key.
- **parseYT**: ID trần 11 ký tự phải có chữ HOA / số / `_` như ID thật; "lofi-hiphop" là từ khoá, được đem đi tìm.
- **Đóng tab giữa ván**: ván Quay số dở được lưu kèm kết quả đã bốc → lần sau vào game được trả đúng kết quả (không thể "thoát khi thấy thua để lấy lại xu"); ván Lật hình dở được hoàn phí. Đóng panel Lật hình giữa chừng = bỏ ván (vẫn mất phí). Dữ liệu nằm ở `pending` trong save.
- **`window.__gcity`** chỉ tồn tại khi chạy local (`localhost`, `127.0.0.1`, `file://`).
- **Ngư phủ trên đảo**: trước đây bấm E / chạm vào ngư phủ là lỗi `TypeError` (hành động `'fishing'` không tồn tại) — nay họ chỉ là nhân vật trang trí.
- **Code chết đã xoá**: `js/map.js`, `Player.update`, `rentBike`, `buyCinema`, `buyCombo`, `btnMap`, `.shop-tab`, vật phẩm "Vé phim".

### Chữ hiển thị cho người chơi
- Thông báo YouTube không còn nhắc key / quota: "Chức năng tìm kiếm đang tạm nghỉ, bạn vui lòng dán link video nhé." / "Hiện chưa tìm được video. Vui lòng thử lại sau." (chi tiết kỹ thuật ghi ra console).
- Lỗi khởi động: "Thiết bị chưa hỗ trợ WebGL. Vui lòng dùng Chrome, Edge hoặc Safari bản mới." / "Chưa vào được thành phố. Vui lòng tải lại trang." (không còn in `e.message`).
- Lời chào trong chat rút còn 2 câu. Bảng đua thú 3D: "Đua thú · 7 thú · thưởng ×6", bỏ "Sơ Cấp" và số phiên giả.
- Bỏ ghi chú kiểu dev ("(ngồi lái thật)", "(có nút Bay lên / Hạ cánh)", "bán ~10🪙").
- Lời thoại NPC ngư phủ viết lại cho tự nhiên (Cô Mười, Bác Sáu, Chú Tư).
- Thống nhất đơn vị **"xu"** trong chữ (HUD vẫn giữ icon 🪙); thiếu xu luôn là một câu: "Bạn không đủ xu để thực hiện giao dịch này." (`UI.NO_COIN`).
- "KQ:123" → "Kết quả: 123"; nút "Kết quả" của Quay số → "Quay số"; ô số mặc định hiện `01`; Túi đồ hiện "Cần cơ bản / Cần cao cấp" và xu có dấu chấm (1.234.567) như HUD.
- Từ dễ bị gắn nhãn cờ bạc: "Đánh lô" → **Quay số may mắn**, "Cá Cược / 1 ăn 6" → **Đua thú / thưởng ×6**, NPC Út Cá Cược → Út Đua Thú, Chú Ba Đánh Lô → Chú Ba Quay Số, "Đặt xu" → "Xu tham gia". (Còn "Vé số" / "Xổ số City" — chưa đổi, báo nếu cũng muốn đổi.)

## v25 — Sửa lỗi đua thú lệch · XSS chat · Firebase multiplayer · phím E vòng đu quay

- **Đua thú không còn lệch** (`js/park.js`): `RC.t` bị trừ `dt` rồi cộng lại trong cùng khung hình nên luôn = 0 → `Math.sin(RC.t*2+i*2)` là hằng số, Cáo Cam / Chó Xanh thắng ~87%. Giờ pha chạy dùng đồng hồ riêng `RC.rt`, pha dao động `RC.o` random mỗi ván. Mô phỏng 20.000 ván: mỗi con ~14,3%. (Chỉ sửa đồng hồ mà giữ pha cố định `i*2` vẫn lệch 10–19%, có 3 con thắng > 16,7% là mức hoà vốn của cược x6.)
- **XSS chat** (`js/ui.js`): `addChat` / `renderPlayers` không còn đưa tên và nội dung vào `innerHTML`, dùng `textContent` (câu chào đầu game cũng đi qua `addChat` nên được vá luôn).
- **Firebase** (`js/net.js`, mặc định vẫn tắt): đổi `me` → `p_xxx` giờ đổi luôn khoá trong `players` (hết nhân đôi người chơi, `sendChat` hết lỗi); tin mình gửi hiện 1 lần; không hiện lại tin cuối cũ khi vừa vào; dữ liệu người lạ (tên, giới tính, charIndex, toạ độ, tin nhắn) được cắt/làm sạch, không giả được tin "Hệ thống"; tải SDK lỗi thì tự về chế độ local thay vì treo màn hình vào game.
- **Vòng đu quay** (`js/game.js`): đang ngồi chỉ WASD / mũi tên / joystick mới tính là "muốn xuống" (trước đây phím E vừa bấm hoặc Shift đang giữ cũng làm xuống ngay); phải nhả phím di chuyển rồi bấm lại mới xuống; giữ phím E không còn lên/xuống liên tục (bỏ `keydown` lặp).

## v24 — Khoá YouTube: bỏ khỏi source, tự chèn từ GitHub Secrets + xoay vòng nhiều key

### Vấn đề đã sửa
Key `YOUTUBE_API_KEY` nằm thẳng trong `js/config.js` → ai mở view-source là lấy được, và quota 100 lượt/ngày của bạn bị người khác dùng ké. Giờ **repo không chứa key nào**.

### Cách hoạt động
```
js/keys.js        ← file rỗng trong repo (window.GCITY_KEYS = [])
      ↓  GitHub Actions đọc Secret YT_KEYS, sinh lại file này LÚC DEPLOY
_site/js/keys.js  ← bản trên GitHub Pages, chứa key thật
      ↓
js/ytkeys.js      ← xoay vòng quota
js/park.js        ← tìm video, tự thử key kế tiếp khi key trước hết lượt
```

### Cài đặt trên GitHub (1 lần)
1. Tạo repo mới, đẩy thư mục `City-main/` vào (workflow tự dò file nằm ở gốc hay trong `City-main/`).
2. **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `YT_KEYS`
   - Value: dán các key, **mỗi dòng một key**:
     ```
     AIzaSy...01
     AIzaSy...02
     AIzaSy...03
     ```
3. **Settings → Pages → Source: GitHub Actions**
4. Push lên nhánh `main` → workflow tự build + deploy. Link trang in ra cuối log.

Không có secret nào thì workflow vẫn deploy, chỉ cảnh báo; game chạy bình thường, chỉ mất chức năng gõ từ khoá (dán link video vẫn được).

### Xoay vòng quota (`js/ytkeys.js`)
- Bắt đầu từ **1 key ngẫu nhiên** → người chơi không dồn hết vào key đầu tiên.
- Key trả `quotaExceeded` / `dailyLimitExceeded` / `rateLimitExceeded` → **đánh dấu chết và thử key kế tiếp ngay**, người chơi không thấy gián đoạn.
- Key chết lưu `localStorage` + **tự sống lại đúng 0h00 giờ Pacific** (giờ Google reset quota) — đóng tab mở lại vẫn nhớ, không đốt oan key.
- Hết cả key → báo rõ *"đã dùng hết lượt (N key), reset sau ~X phút"*.
- Mỗi key miễn phí ~100 lượt/ngày nên **N key ≈ N × 100 lượt/ngày, chia chung cho tất cả người chơi** (không phải 100 lượt/người).

### ⚠️ PHẢI LÀM: thu hồi key cũ
Key nằm trong `config.js` của các bản v19–v23. Nếu bạn đã đẩy bất kỳ bản nào lên GitHub thì key đó **đã nằm trong lịch sử repo**. Hãy vào Google Cloud Console → **APIs & Services → Credentials → xoá key cũ** rồi tạo key mới, đưa vào secret `YT_KEYS`.

### Chạy local (không cần key)
`js/keys.js` rỗng nên `YTKEYS.count() = 0` → bản local hiện thông báo *"chưa có khoá YouTube"*, mọi thứ khác chạy bình thường. Muốn thử tìm video thì tự sửa `js/keys.js` thành `window.GCITY_KEYS = ["AIzaSy..."];` (đừng commit file này lên repo — `.gitignore` đã khoá sẵn bản `.local`).

### Thêm khoá mới
Không cần sửa code: thêm key mới vào secret `YT_KEYS` rồi push (hoặc chạy tay workflow). Trong lúc chờ deploy, key chết trên máy người chơi tự sống lại 0h Pacific — nếu muốn xoá ngay thì gõ `YTKEYS.revive()` trong console trình duyệt.

> Lưu ý thật: key API chạy ở trình duyệt thì **bất kỳ ai cũng lấy được từ trang đang chạy** (F12 → Network) — đây là đặc tính của mọi key client-side, không tránh được nếu không có máy chủ làm trung gian. Cách này giữ key khỏi repo / fork / PR, và chia đều quota nhờ nhiều key; nếu cần giấu thật sự thì phải có server proxy.

## v23 — Vạch sang đường đúng hệt ảnh mẫu (đo pixel từ ảnh gốc)

Đã soi ảnh mẫu ở mức từng pixel (phóng 10× vùng vạch sang đường) và sửa lại cho khớp:

- **Vạch sang đường không phải zebra sọc ngang** mà là **8 sọc dài SONG SONG chiều xe chạy**, xếp dày theo bề ngang, chiếm trọn bề rộng đường (~4,2 đơn vị theo chiều dài đường). Vẽ trước vốn bị đảo chiều nên nhìn sai hoàn toàn.
- **Đúng 4 vạch sang đường**, đặt ở giữa mỗi cạnh. Bỏ hẳn 8 nhóm **sơn ngựa ở góc** (v22 từng chuyển sang góc) — ảnh mẫu không có, chỉ có 4 vạch sang đường thôi.
- **Vạch giữa đường đổi từ vàng → trắng** (ảnh mẫu: vạch trắng xám, không hề có vạch vàng) và vẫn tự dừng trước vùng vạch sang đường.
- Số sọc 8, sọc mảnh 0,26, bước ~0,6 — khớp tỉ lệ vạch/khoảng cách của ảnh mẫu.

## v22 — Đường vuông vức · đèn toà nhà ban đêm · tư thế ngồi · cabin đu quay

### 🛣️ Đường (đúng ảnh mẫu)
- **Khung đường vuông vức**: cả 4 cạnh dài bằng nhau (mép ngoài 22, rộng 5), vỉa hè xám chạy liền mạch khép kín 4 góc — trước đây vỉa hè dọc chỉ chạy tới giữa nên **khuyết mất 4 góc**, nhìn lệch.
- **Không còn vạch đè vạch**:
  - **Vạch sang đường** (sọc toả ngang, 7 sọc) đặt ở **giữa mỗi cạnh** — chỗ người đi bộ qua đường.
  - **Vạch vàng giữa** (đứt) chạy quanh khung và **tự dừng trước vùng vạch sang đường** (trước đây vạch vàng chạy xuyên qua vạch sang đường).
  - **Sơn ngựa** (sọc dài song song chiều xe) lùi về **2 đoạn lệch góc mỗi cạnh**, không còn chồng lên vị trí vạch sang đường.

### 💡 Ánh sáng toà nhà ban đêm
- Mỗi toà nhà có **quầng sáng ấm trước cửa** + hào quang ở cửa + 2 đèn trang trí hai bên cửa (tắt ban ngày) — đúng kiểu ánh sáng đổ ra vỉa hè trong ảnh mẫu.

### 🪑 Tư thế ngồi + hành động
- `sit`: hông đúng mặt ghế, đùi vuông góc + hơi mở, cẳng chân thẳng xuống, tay đặt trên đùi, thân hơi ngả lưng, thở nhẹ. Đầu tóc đuôi ngọn rũ theo.
- `ride` (**mới**): dùng khi ngồi xe / cabin đu quay — thân cúi, đùi vuông góc, hai tay chống ra trước (vô-lăng / lan can). Xe thuê và đu quay đã chuyển sang tư thế này.

### 🚫 Bug nhân vật đi xuyên ghế
- Ghế đã thành vật cản thật (hộp 2 × 0.6 có xét góc xoay). Khi đi bằng joystick/WASD thì bị chặn đúng bờ ghế; nhưng khi **chạm để đi tới ngồi** thì bỏ qua va chạm ghế (vẫn tới được chỗ).

### 🎡 Vòng đu quay có cabin để ngồi
- 8 cabin thật: sàn + 4 cột + nóc + mái chóp + **ghế ngồi có lưng** + thanh treo vành (thay vì 8 hộp treo không ngồi được).
- **Chạm vào vòng đu quay** (hoặc bấm E khi ở gần) để lên cabin; nhân vật bám theo cabin, camera bám theo độ cao, tư thế `ride`. Chạm/bấm E lần nữa hoặc bấm phím di chuyển để xuống.
- Hành khách chọn cabin gần nhất nên lên không bị "bay" từ xa.

## v21 — Ngày/đêm theo giờ thiết bị · gọn HUD

- **Trời tự chạy theo giờ máy** (không còn nút bấm): `06:00→07:30` bình minh (đêm→ngày), `07:30→17:00` ban ngày, `17:00→19:00` hoàng hôn, `19:00→06:00` ban đêm. Chuyển mượt ~1,2 giây.
- **Mặt trời đi theo giờ**: đông 6h → nam 12h → tây 18h, thấp dần ở bình minh/hoàng hôn kèm màu hồng cam; ban đêm ánh sáng chuyển sang màu trăng xanh. Ban đêm có sao + trăng như cũ.
- **HUD gọn hơn**: bỏ nút 🎥 (không có tác dụng) và nút 🌙/☀; nút 👥 số người online chuyển xuống cuối thanh hành động (trên điện thoại nằm cuối cột nút bên phải); **tên zone tách khỏi khung tên nhân vật + xu**, đẩy sang góc phải.
- **Sửa lỗi màu trời**: các phép trộn màu ngày/đêm trước đó dùng chung một biến màu tạm cho cả trời + hemi + ambient + mặt trời nên bọn sau đè lên màu trời (ban ngày ra nền kem ấm thay vì xanh, sương mù cũng bị ảnh hưởng). Giờ mỗi đích có màu riêng → trời đúng xanh ban ngày, xanh đen ban đêm.
- Đổi kích thước đảo vẫn nằm ở `js/island.js`. Ép trời tối/sáng khi test (chỉ có khi chạy local — `localhost` / `file://`; bản deploy không mở `window.__gcity`): `window.__gcity.setNight(true)` / `setNight(false, true)`; trả về chạy theo giờ máy: `window.__gcity.scene.followClock()`.

## v20 — Đảo câu cá dựng lại theo ảnh mẫu · animation câu cá · ban đêm cho cả 2 zone

### 🏝️ Đảo câu cá (`js/island.js` — module mới, toàn bộ đảo nằm ở đây)
- **Hình dáng**: bán kính mép cát là hàm `wob(a)` (dao động nhẹ) → đảo hình hạt nhân tự nhiên như ảnh mẫu, không phải hình tròn. Vòng cỏ cách mép cát `BEACH = 5.6`.
- **Nhiều lớp**: biển rộng 600 đơn vị → vùng nước nông → bờ sóng trắng (foam) → bãi cát (texture lấm tối/sáng) → cỏ (texture chấm) → lối đất 4 nhánh uốn cong. Mọi mặt phẳng đều là 1 mesh riêng.
- **Cây cọ** (`makePalm`): thân 6 khối cong dần, 9 lá dải quạt vồng rồi rũ xuống, 2-3 quả dừa, gốc cát. 15 cây, mỗi cây một bảng màu lá riêng; **va chạm theo thân cây** (không đi xuyên qua).
- **Quầy cá**: gỗ + mái lá gái nghiêng 31° (texture rơm) + quầy hồng phơi sáng + thanh phát sáng xanh `2ad6e8` + phao cứu sinh + con cá trên xà; chạm quầy (hoặc E) mở bảng câu cá.
- **Bãi biển**: 3 dù sọc (đỏ/trắng, xanh/trắng) + 3 ghế nằm sọc + bàn ghế ngoài hiên.
- **Cầu gỗ**: lối đi có lan can 2 bên → bãi đỗ hình chữ T ở cuối, cọc neo xuống nước, 2 đèn lồng đầu cầu (tự sáng ban đêm), **tàu neo** bên cạnh (đuôi nhọn, chân ván, mạn chèo) + 1 thuyền nhỏ ngoài khơi — cả hai **đung đưa theo sóng**.
- **Chi tiết sống**: 3 hải âu bay vòng (cánh vẫy), phao câu đỏ/trắng nổi + vòng sóng lan, 4 đảo nhỏ trên biển có cọ + đá, vỏ ốc/sao biển trên cát, thùng chài + cắm cần ở mỗi chỗ câu, bảng "Đảo câu cá" trên cổng gỗ.
- **Va chạm**: `Island.walkable(x,z)` — ra khỏi mép cát là rơi xuống nước; cầu gỗ được nới thêm bán kính nhân vật để đứng được tới mép lan can. `Island.dockY(x,z)` cho nhân vật đứng trên cầu cao 0.62.

### 🎣 Animation câu cá (`js/character.js` + `js/game.js`)
- Nhân vật cầm **cần câu thật** (cán + cuộn dây + 2 khoen) gắn vào cẳng tay phải, **dây câu vẽ mỗi khung** từ đầu cần xuống phao đang nhấp nhô trên mặt nước (2 đoạn có độ chùng khi cá giật).
- 4 tư thế: `cast` (vung tay quăng cần) · `fish` (đứng câu) · `bite` (cá cắn, cần giật + dây chùng) · `reel` (kéo cần).
- **Người chơi**: đứng ở chỗ câu là tự cầm cần và tự quay mặt ra biển; trạng thái mini-game (casting/biting/caught) điều khiển tư thế. Rời khỏi chỗ câu thì cần tự ẩn.
- **NPC**: 5 ngư phủ (Chú Bảy Hải, Cô Mười, Bác Sáu, Chú Tư + Bà Tám Bến Câu ở cuối cầu) đứng câu sẵn ở đúng các chỗ câu, đơm câu định kỳ, vẫy tay chào khi bạn đến gần. Vị trí + hướng mặt lấy thẳng từ `Island.fishSpots` nên không lệch vị trí dựng hình.

### 🌙 Ban đêm cho cả 2 zone (`js/three-scene.js`)
- Ban đêm bật tự động theo giờ thiết bị (xem v21). Đổi trời: màu trời + sương mù, ánh sáng (hemi/ambient/sun chuyển sang ánh trăng xanh), **sao + trăng** hiện lên.
- Đổi theo đêm: màu trời + sương mù, ánh sáng (hemi/ambient/sun chuyển sang ánh trăng xanh), **sao + trăng** hiện lên.
- **Đèn đường bật sáng**: bóng đèn phát quang, có **quầng sáng tròn trên mặt đất** (additive) + halo quanh bóng đèn — đúng kiểu trong ảnh mẫu.
- **Cửa sổ toà nhà sáng vàng ấm** ban đêm: dựng thêm 1 mesh `MeshBasic` cho toàn bộ cửa sổ mỗi toà (ẩn ban ngày, hiện khi trời tối) → tốn đúng 1 draw call/toà.
- Đài phun nước + thanh đèn quầy cá + bóng đèn đầu cầu cũng sáng theo; mặt biển đổi màu đêm.
- Hệ thống đăng ký `nightReg` dùng chung cho cả `js/island.js` và `js/three-scene.js`.

### 🧹 Sửa thêm
- **Rò rỉ bộ nhớ khi đổi zone**: mỗi lần vào zone cũ giờ giải phóng geometry/material/texture của zone cũ (giữ lại tài nguyên dùng chung). Trước đó số geometry tích luỹ dồn lên mỗi lần chuyển zone.
- Bóng đèn đường ban ngày không còn sáng trắng (màu gốc sáng, ban ngày nhân `dim`).
- Va chạm quầy cá tính theo cả góc xoay (hộp 9.4 × 8.7 thay vì 7.6 × 5.6).
- Tên nhân vật + bong bóng chat đẩy lên cao hơn (không dính đầu).

### 🔧 Đổi kích thước đảo
`js/island.js`: `RX/RZ` (bán kính đảo), `BEACH` (bề rộng bãi cát), `PIER` (cầu gỗ), `HUT` (quầy cá), `fishSpots` (chỗ câu), `PALM_AT` (cây cọ). Đổi `fishSpots` là NPC ngư phủ + phao câu + thùng chài tự đổi theo.

## v17: gợi ý trong bảng TV rút gọn còn "Gõ từ khoá hoặc dán link youtube để tìm".

## v16: nhân vật leo được bậc thang + đứng trên sân khấu TV (trước đây luôn ở y=0 nên chìm xuống nền cỏ); chỉ lên được bằng bậc thang giữa; 2 loa là vật cản.

## v15: đã xoá 2 ô vàng (Đánh lô) + hồng (Lật hình); NPC giữ nguyên.

## v14 — cây / toà nhà / ánh sáng / lưu dữ liệu
- **Ánh sáng**: trước đây ambient 0.85 + sun cho tổng ~1.33 ở mặt ngang → gạch, vỉa hè, cỏ bị cháy sáng thành trắng nhạt. Giờ HemisphereLight 0.30 + Ambient 0.32 + Sun 0.52 (tổng ~1.0) → màu gạch be/đỏ đất, cỏ xanh đúng như ảnh mẫu.
- **Cây** (`makeTree`): tán low-poly shading phẳng (khối 20 mặt méo nhẹ), mỗi cây một dáng/một bảng màu xanh (cố định theo vị trí), thân thon + nhánh nhỏ, bệ đất nâu viền đá kem. Mỗi cây = 1 draw call.
- **Toà nhà** (`makeBuilding`): cột góc, cửa sổ có nẹp chữ thập + bậu cửa + chậu hoa trên **cả 4 mặt** (trước đây mặt sau trơ), mái hiên sọc 3 bậc dốc, cửa chính có bậc thềm, mái có lan can + ống khói + máy lạnh. Mỗi toà = 1 mesh (trước là hàng trăm mesh/toà, mỗi mesh tạo 1 material riêng) → nhẹ hơn nhiều trên điện thoại.
- **Lưu dữ liệu** (`game.js`): lưu NGAY khi tạo nhân vật; lưu mỗi 2s theo đồng hồ thật (trước phụ thuộc FPS: dt bị kẹp 0.05 nên máy yếu 5–10 FPS phải chờ 6–12s); lưu thêm khi `pagehide` / ẩn tab (điện thoại hay không chạy `beforeunload`); cookie dự phòng; kẹp `charIndex` để save cũ không làm kẹt game; chặn bấm đúp "Vào thành phố". Dữ liệu gắn với tên miền — đổi domain là máy mới. Muốn giữ nhân vật giữa nhiều máy phải lưu lên server/Firebase theo tài khoản.

## v18: sắp xếp lại công viên — 4 nhánh đá đỏ của trục chữ thập kéo thẳng tới sân khấu / bãi xe / trường đua / cổng tàu; quảng trường gạch nối dài xuống phía nam với sân tròn + cổng gỗ trước cổng tàu; khu nghỉ chân (bàn, dù, 4 ghế) thay sàn gỗ trơ; nền đá cho vòng quay (dời sang x=15.5); lề + đèn + cây cho bãi thuê xe; thêm hàng ghế thứ 3 trước sân khấu và 2 ghế dọc lối ra cổng tàu; đồi cỏ bớt nhạt. Chỉ sửa `js/three-scene.js` (hàm `buildParkLayout`, dữ liệu `ZONES.plaza`), logic game giữ nguyên.

## v19: chữ không còn xuyên qua vật cản + sửa sân khấu
- **Chữ (tên trên đầu, bong bóng chat, biển hiệu, biển bãi thuê xe, biển đích, biển cổng tàu)**: trước đây `makeTextSprite` đặt `depthTest:false` nên luôn vẽ đè lên mọi thứ (đứng sau tòa nhà vẫn thấy tên/chat nổi trên tường). Giờ `depthTest:true` + `depthWrite:false` → bị tòa nhà / cây / xe / đài phun che thì chữ cũng bị che. Biển hiệu tòa nhà đổi từ sprite sang tấm phẳng gắn vào tường (`makeTextPlane`, đặt trước mái hiên) để nhìn xiên không bị tường cắt mất một nửa. Chỉ sửa `js/three-scene.js`.
- **Sân khấu — Bug**: mặt trước sân khấu bị tô xanh lá cùng tông cỏ, lại cao ngang mặt sàn (0.5) nên chớp xanh ở mép; sân khấu đứng thẳng trên cỏ, còn một dải cỏ chen giữa sân khấu và hàng ghế.
- **Sân khấu — Fix**: thân sân khấu đổi sang gỗ nâu sẫm (cao 0.44) + chân đế sẫm hơn, mặt sàn gỗ sáng (dày 0.06) nhô ra 0.15 mỗi phía làm gờ. Độ cao mặt sàn vẫn 0.5 nên `groundY` / `collides` giữ nguyên, nhân vật đứng đúng chỗ. Lát thêm nền gạch 30×12.5 (x ±15, z −30 → −42.5) khớp ô gạch với nền chính (mép trái x=−15 và mép nam z=−30 đều nằm đúng mốc gạch 2.5) → hết dải cỏ phía trước, mặt sau và hai bên đều có gạch. 2 cây vành đai trùng nền gạch được lùi ra sau (z −44.6).
