# CHANGELOG — bản đã rà soát (three.js r186)

Dựa trên gói gốc `gcity3d.bin`. Mọi thay đổi bên dưới đều nhỏ, không đụng logic gameplay.

### Sửa
- `tools/pose.html`: importmap đổi từ CDN jsDelivr sang `js/vendor/` → chạy offline như game chính (trước đây trang này vẫn cần mạng dù tài liệu ghi "không phụ thuộc internet").
- README: bỏ mô tả cũ "importmap trỏ tới jsDelivr" (đã đóng gói vendor).
- `js/game.js`: hook debug `window.__GCITY__` (có `move()` dịch chuyển, `mount()`...) trước đây lộ ra cả bản deploy → nay chỉ có khi chạy local (cùng cơ chế với `window.__gcity`). Mảng `__GCITY_ERRORS` giới hạn 50 phần tử (trước đây không giới hạn, lỗi lặp mỗi khung hình sẽ ăn dần RAM).
- Xoá thư mục `assets/` (bản sao model không được code tham chiếu; `js/config.js` luôn trỏ tới `models/`). Ghi chú giấy phép model chuyển sang `models/README.txt`.
- Sửa comment/README nói sai: đường dẫn model, cách chạy, và chuyện khoá YouTube "không nằm trong source" (thực tế nằm công khai trong `js/keys.js`).

## Không thay đổi (cố ý)
- `js/keys.js`: giữ nguyên 3 khoá YouTube của bạn. Xem cảnh báo bảo mật trong báo cáo: phải giới hạn key theo tên miền ở Google Cloud Console.
- Toàn bộ gameplay, UI, vật lý, 12 model GLB.
