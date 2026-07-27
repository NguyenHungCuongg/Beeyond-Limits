# Kế hoạch Sửa lỗi (Bug Fix Plan) - Beeyond Limits

Dựa trên báo cáo `BUG_AUDIT_AND_IMPROVEMENT_REPORT.md`, đây là kế hoạch chi tiết chia thành các Phase để khắc phục triệt để các lỗi hiện tại trước khi tiến hành nâng cấp sản phẩm.

## 🔴 Phase 1: Core Reliability & High-Priority Bugs (Ưu tiên cao nhất)

Mục tiêu: Giải quyết các vấn đề nghiêm trọng nhất ảnh hưởng trực tiếp đến độ tin cậy của 3 tính năng cốt lõi: Pomodoro, Website Blocker, và Audio, đồng thời đảm bảo Extension hoạt động ổn định trên môi trường Manifest V3.

- **1. Fix Pomodoro Timer trên Manifest V3 (BL-001 & BL-002)**
  - Thay thế `setInterval` bằng `chrome.alarms`.
  - Thay vì lưu thời gian đếm ngược, hãy lưu timestamp tuyệt đối (`phaseEndsAt`) để timer không bị trôi hay dừng khi Service Worker bị tắt.
  - Sửa lỗi khi timer được khôi phục ở mức `0` (tránh việc timer tự động bắt đầu lại thay vì chuyển pha).
- **2. Tối ưu Website Blocker và Khắc phục lỗi chặn sai (BL-003, BL-004, BL-009)**
  - Đổi logic matching: Chuyển từ substring matching sang domain/host-boundary matching.
  - Sửa lỗi tạo dư thừa rule: Sử dụng cú pháp anchored domain của DNR (ví dụ `||domain.com/`) thay vì sinh ra 9 rule cho 1 domain.
  - Đảm bảo UI đồng bộ: Chỉ cập nhật trạng thái UI là "Đang chặn" khi API `updateDynamicRules` trả về thành công, validate toàn bộ rule trong một lệnh gọi duy nhất.
- **3. Cấu trúc lại Audio Playback (BL-005, BL-007)**
  - Chuyển giao toàn quyền phát âm thanh thông báo Pomodoro và Ambient Sound cho một Offscreen Document duy nhất.
  - Xóa bỏ cách tiếp cận chèn script phát âm thanh vào các trang web bất kỳ hiện đang mở.
  - Xóa đoạn mã "chữa cháy" click vào nút ẩn để vượt qua chính sách autoplay.

## 🟡 Phase 2: Medium Severity - Logic Errors & Performance

Mục tiêu: Sửa các lỗi liên quan đến logic hiển thị, tối ưu hiệu suất và dọn dẹp các xử lý thừa thãi.

- **1. Sửa lỗi Race Condition ở Ambient Audio (BL-006)**
  - Đảm bảo Offscreen Document được tạo thành công trước khi phát nhạc. Áp dụng promise memoization và gửi phản hồi thành công về popup sau khi promise của `audio.play()` hoàn tất.
- **2. Làm sạch Content Script dư thừa (BL-010)**
  - Xóa bỏ việc quét DOM và gọi `chrome.storage` mỗi 500ms liên tục trên mọi tab của trình duyệt.
  - Giao lại toàn bộ trách nhiệm chặn web cho API `Declarative Net Request` (DNR).
- **3. Sửa UI Pomodoro Progress Ring (BL-011)**
  - Vòng tiến trình hiện tại bị hiển thị lặp lại theo từng phút. Cần lấy % tiến trình của toàn bộ session (25 phút) để render đúng tiến độ tổng thể.
- **4. Cập nhật logic Thống kê "Today's Progress" (BL-012)**
  - Hiện tại thống kê tính tổng tất cả task từ trước đến nay. Cần thêm trường `completedAt` cho Task và chỉ tính toán, hiển thị tiến độ của ngày hôm nay.
- **5. Validate URL trong UI Blocker (BL-008)**
  - Chuẩn hóa URL người dùng nhập bằng `new URL()`, loại bỏ path và query. Chỉ lưu và tạo rule dựa trên `hostname` chuẩn.

## 🟢 Phase 3: Accessibility, Privacy, & Polish (Hoàn thiện)

Mục tiêu: Đảm bảo trải nghiệm UI/UX thân thiện với Keyboard, bảo mật quyền riêng tư của người dùng, và làm sạch code base.

- [x] **1. Khả năng tiếp cận & Focus Indicator (BL-013, BL-014)**
  - Thay thẻ `<div>` thành `<button>` hoặc thẻ `<a>` ở các thành phần tương tác trên màn hình.
  - Sửa lỗi các nút hành động (Edit/Delete Task hoặc BlockURL) bị ẩn và chỉ hiện khi di chuột. Bổ sung focus-within để hỗ trợ người dùng dùng phím Tab.
- [x] **2. Bảo vệ quyền riêng tư người dùng (BL-015)**
  - Gỡ bỏ việc gửi request lấy favicon của domain bị chặn từ Google (`https://www.google.com/s2/favicons?domain=...`). Dùng biểu tượng generic chặn mặc định.
- [x] **3. Cập nhật múi giờ Daily Quotes (BL-017)**
  - Chuyển đổi logic random Quote theo ngày từ múi giờ UTC sang Local Time, giúp người dùng nhận Quote mới vào đúng nửa đêm của họ.
- [x] **4. Dọn dẹp Code và Tài nguyên (BL-018 & BL-016)**
  - Xóa bỏ các dòng quotes bị lặp lại trong `quotes.json`.
  - Loại bỏ các file quản lý audio thừa (`popupAudioManager.js`, `audioManager.js`).
  - Hợp nhất `manifest.json`.
  - Khắc phục các cảnh báo của ESLint và xây dựng baseline kiểm thử/CI cơ bản (Quality Gate).

---
