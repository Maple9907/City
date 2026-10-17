/* ===== KHOÁ YOUTUBE — FILE NÀY KHÔNG CHỨA KEY THẬT =====
 * Nội dung bên dưới chỉ là giá trị rỗng trong repo.
 * Khi deploy, GitHub Actions sẽ GHI ĐÈ file này bằng key thật lấy từ
 * Secret của repo (YT_KEYS) — mỗi dòng 1 key.
 * Nếu mở bản deploy mà thấy `window.GCITY_KEYS = []` thì là bản local,
 * hoặc workflow chưa chạy / chưa cấu hình secret.
 * → Chi tiết cách cấu hình: README, mục "Khoá YouTube Data API".
 */
// Nếu trang đã có sẵn danh sách key (vd: bạn tự gán trước khi nạp) thì giữ nguyên, không xoá.
if(!Array.isArray(window.GCITY_KEYS)) window.GCITY_KEYS = [];
