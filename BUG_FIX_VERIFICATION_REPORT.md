# Báo cáo xác minh sửa lỗi Beeyond Limits

> **Status note:** This is the pre-fix baseline. See `BUG_FIX_IMPLEMENTATION_REPORT.md` for the post-fix status.

**Ngày kiểm tra:** 2026-07-27  
**Phiên bản được kiểm tra:** commit `1947122` (`Fix bug phase 2&3`)  
**Báo cáo đối chiếu:** `BUG_AUDIT_AND_IMPROVEMENT_REPORT.md`

## 1. Kết luận

Phiên bản hiện tại **chưa sẵn sàng để phát hành production**.

Các thay đổi gần đây đã xử lý tốt một số vấn đề về giao diện, thống kê công việc, tiến trình Pomodoro và dữ liệu câu trích dẫn. Tuy nhiên, những luồng cốt lõi gồm service worker, chặn website và phát âm thanh Pomodoro vẫn còn lỗi nghiêm trọng. Đặc biệt, việc dùng `chrome.alarms` nhưng không khai báo quyền `alarms` có thể khiến service worker lỗi ngay khi khởi động và kéo theo nhiều chức năng nền không được đăng ký.

| Trạng thái | Số lượng |
|---|---:|
| Đã sửa | 6 |
| Sửa một phần | 4 |
| Chưa sửa | 7 |
| Hồi quy / phát sinh lỗi nghiêm trọng | 1 |
| **Tổng cộng** | **18** |

### Các lỗi chặn phát hành

1. **BL-001 — Service worker có thể dừng khi khởi động:** mã nguồn dùng `chrome.alarms`, nhưng manifest thiếu quyền `alarms`.
2. **BL-004 — Không thể bật Website Blocker ổn định:** message mới truyền trạng thái và danh sách URL, nhưng hàm xử lý cũ bỏ qua cả hai tham số và đọc dữ liệu cũ trong storage.
3. **BL-005 — Âm báo hoàn tất Pomodoro vẫn không phát:** background gửi `PLAY_POMODORO_AUDIO`, nhưng offscreen document không xử lý message này.
4. **BL-006/BL-007 — Ambient audio còn race condition và báo thành công giả:** quá trình tạo offscreen document chưa được khóa, còn dựa vào synthetic click và phản hồi thành công trước khi `audio.play()` hoàn tất.
5. **BL-016 — Không có automated test hoặc CI:** các luồng quan trọng chưa có regression safety net.

## 2. Kết quả kiểm tra kỹ thuật

| Hạng mục | Kết quả | Ghi chú |
|---|---|---|
| `npm run lint` | Pass | Không còn lỗi ESLint tại thời điểm kiểm tra |
| `npm run build` | Pass | Vite build thành công, 51 module được chuyển đổi |
| Automated tests | Không có | `package.json` không có script `test`; không tìm thấy test suite |
| Git worktree trước kiểm tra | Sạch | Không có thay đổi chưa commit |
| Runtime trên Chrome thật | Chưa xác minh đầy đủ | Chrome DevTools connector không khả dụng; Chrome headless cục bộ bỏ qua cờ load extension |

Các kết luận trong báo cáo này dựa trên static analysis, build/lint, các repro nhỏ độc lập và đối chiếu với tài liệu chính thức của Chrome Extensions. Trước khi release vẫn cần chạy manual test trên Chrome với extension được load ở chế độ unpacked.

## 3. Đối chiếu 18 lỗi

| ID | Trạng thái | Kết quả xác minh | Việc còn lại |
|---|---|---|---|
| BL-001 | **Hồi quy** | Timer đã chuyển sang `chrome.alarms` và lưu `phaseEndsAt`, nhưng `manifest.json` không khai báo quyền `alarms`. Listener `chrome.alarms.onAlarm` được gọi ở top-level trong `src/background.js`, nên service worker có thể lỗi trước khi đăng ký các listener phía sau. | Thêm quyền `alarms`; kiểm tra `chrome.runtime.lastError`; test reload/restart trình duyệt và service-worker suspension. |
| BL-002 | **Chưa sửa** | Khi khôi phục state, `currentTime === 0` vẫn bị xem như thiếu dữ liệu và bị thay bằng toàn bộ thời lượng phase. Settings cũng được load sau state nên phase hết hạn có thể chuyển tiếp bằng thời lượng mặc định 25/5 thay vì settings đã lưu. | Phân biệt rõ `0` với `null`/`undefined`; load settings trước khi phục hồi hoặc chuyển phase; bổ sung test cho state tại mốc 0. |
| BL-003 | **Chưa sửa** | Content script cũ đã bị xóa, nhưng DNR vẫn tạo nhiều wildcard pattern và có rule dạng `*domain*`. Domain như `youtube.com` vẫn có thể match hostname khác hoặc chuỗi nằm trong query. | Chuẩn hóa hostname và dùng rule có ranh giới domain rõ ràng; thêm test cho subdomain hợp lệ và look-alike domain. |
| BL-004 | **Chưa sửa** | Popup gửi `UPDATE_BLOCKING_RULES` kèm `isBlocking` và `blockedUrls`, nhưng `updateBlockingRules()` không nhận tham số và tiếp tục đọc storage cũ. Khi bật từ trạng thái tắt, background có thể xóa rules, trả về `undefined`, còn popup coi thao tác thất bại và không lưu trạng thái mới. Việc remove/add rules cũng chưa atomic. | Viết lại contract message; truyền dữ liệu trực tiếp; trả `{ success, error }`; chỉ lưu state sau khi DNR cập nhật thành công; remove/add trong một lần gọi. |
| BL-005 | **Chưa sửa** | Background gửi message `PLAY_POMODORO_AUDIO`, nhưng `src/offscreen.js` không có case tương ứng. Lần phát thứ hai vẫn dùng `setTimeout` trong service worker và có thể bị mất khi worker suspend. | Thêm handler offscreen và chờ playback thực sự; điều phối sequence trong offscreen document thay vì timer trong service worker. |
| BL-006 | **Chưa sửa** | `AmbientSoundManager` gọi `loadSettings()` và `initOffscreen()` song song; chưa có shared creation promise để ngăn nhiều lần tạo offscreen document. Offscreen còn trả success trước khi `audio.play()` resolve. | Memoize quá trình tạo offscreen document; await thao tác audio; truyền lỗi thật về UI. |
| BL-007 | **Chưa sửa** | `offscreen.js` vẫn tìm `#enable-audio`, trong khi `offscreen.html` không có phần tử này. Cơ chế synthetic click tiếp tục được dùng làm fallback cho autoplay. | Xóa logic DOM không tồn tại và synthetic click; thiết kế luồng cấp phép audio từ một user gesture thật ở popup. |
| BL-008 | **Sửa một phần** | URL đã được parse bằng `new URL()` và chỉ lưu hostname. Tuy nhiên điều kiện `startsWith('http')` làm các domain hợp lệ như `httpbin.org` hoặc `http.cat` bị xem là đã có scheme rồi parse thất bại. Chưa chuẩn hóa trailing dot. | Kiểm tra scheme bằng `/^https?:\/\//i`; chuẩn hóa chữ thường/trailing dot; xác định chính sách cho credentials, port và IDN. |
| BL-009 | **Chưa sửa** | Mỗi domain vẫn tạo khoảng 9 dynamic rules. Điều này làm rule set phình nhanh và tăng độ phức tạp khi cập nhật. | Giảm về một rule có điều kiện domain phù hợp cho mỗi domain, hoặc gom theo capability của DNR. |
| BL-010 | **Đã sửa** | `src/content.js` đã bị xóa, manifest không còn `content_scripts`, và build config không còn copy file này. | Không còn hành động bắt buộc. |
| BL-011 | **Đã sửa** | `Timer.jsx` nhận `progress` theo toàn bộ session thay vì tính vòng tròn theo `seconds % 60`. | Thêm visual regression test nếu có điều kiện. |
| BL-012 | **Đã sửa** | Task đã lưu/xóa `completedAt`; thống kê dùng mốc ngày local và vẫn giữ active carry-over tasks. | Có thể ghi rõ trong UI rằng “Today” gồm cả active backlog để tránh hiểu nhầm. |
| BL-013 | **Sửa một phần** | Các card click trên Home đã chuyển thành `<button>`, nhưng nhiều toggle/icon control vẫn thiếu accessible name, `role="switch"`, `aria-checked` và style `focus-visible`. | Audit bằng keyboard và screen reader; bổ sung semantic state/name cho blocker, audio, ambient và task checkbox. |
| BL-014 | **Đã sửa** | Task action hỗ trợ `focus-within`; nút xóa blocked URL hiển thị khi focus bằng bàn phím. | Có thể bổ sung test keyboard navigation. |
| BL-015 | **Đã sửa** | Đã bỏ lookup favicon qua Google; dùng biểu tượng local nên không còn gửi domain người dùng tới dịch vụ favicon bên ngoài. | Không còn hành động bắt buộc. |
| BL-016 | **Sửa một phần** | Lint và production build đều pass. Tuy nhiên chưa có unit/integration/E2E test, script `test` hoặc CI workflow. | Thiết lập Vitest và Chrome API mocks; thêm CI chạy lint, test, build. |
| BL-017 | **Đã sửa** | Seed câu trích dẫn dùng ngày local (`getFullYear`, `getMonth`, `getDate`) thay vì ngày UTC. | Thêm test quanh thời điểm gần nửa đêm và chuyển ngày. |
| BL-018 | **Sửa một phần** | 298 câu trích dẫn hiện đều unique; một số file manager/content script thừa đã bị xóa. Tuy nhiên vẫn có `public/manifest.json` xung đột với manifest chính, một `PopupAudioManager` cục bộ trong `Pomodoro.jsx`, blocker implementation cũ và quyền `tabs` không được dùng. | Chỉ giữ một manifest, một audio abstraction và một blocker implementation; loại quyền/tài nguyên không cần thiết. |

## 4. Phân tích các lỗi nghiêm trọng

### 4.1 BL-001 — Thiếu quyền `alarms`

**Bằng chứng**

- `src/background.js` đăng ký `chrome.alarms.onAlarm.addListener(...)` ở top-level.
- `manifest.json` hiện chỉ khai báo `storage`, `tabs`, `declarativeNetRequest`, `notifications` và `offscreen`.
- Chrome yêu cầu khai báo quyền `"alarms"` trước khi sử dụng API này.

**Tác động**

Nếu namespace/listener không khả dụng, service worker có thể throw khi evaluate script. Các listener được khai báo sau đó — bao gồm message handling và logic blocker — sẽ không được đăng ký. Đây là lỗi có phạm vi ảnh hưởng lớn hơn riêng Pomodoro.

**Yêu cầu sửa**

1. Thêm `"alarms"` vào `permissions`.
2. Xử lý `chrome.runtime.lastError` khi tạo/xóa alarm.
3. Xác minh timer sau khi reload extension, đóng/mở lại Chrome và để service worker bị suspend.
4. Viết test bảo đảm startup không throw khi API không khả dụng hoặc bị mock lỗi.

Tài liệu: [Chrome Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)

### 4.2 BL-004 — Contract cập nhật Website Blocker bị lệch

Luồng hiện tại có hai nguồn dữ liệu không đồng bộ:

```text
Popup: isBlocking=true + blockedUrls mới
                  |
                  v
Background message handler
                  |
                  v
updateBlockingRules() bỏ qua payload
                  |
                  v
Đọc storage cũ: isBlocking=false
                  |
                  v
Xóa rules / trả response không đúng contract
```

Đây là nguyên nhân khiến UI và DNR có thể lệch trạng thái. Hàm cập nhật nên nhận một snapshot duy nhất từ caller, validate/normalize snapshot đó, cập nhật DNR atomically, rồi mới commit storage và phản hồi kết quả.

Chrome cho phép truyền `removeRuleIds` và `addRules` trong cùng một `updateDynamicRules()`; thao tác cập nhật đó là atomic.

Tài liệu: [Chrome Declarative Net Request API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)

### 4.3 BL-005 — Message phát âm thanh không có consumer

Producer trong background gửi:

```text
PLAY_POMODORO_AUDIO
```

Nhưng offscreen document chỉ xử lý các nhóm message như `PING`, ambient start/stop/update, `STOP_ALL` và test ambient. Vì không có handler tương ứng, luồng completion sound chưa được nối hoàn chỉnh.

Ngoài ra, `setTimeout(..., 2000)` trong extension service worker không phải cơ chế sequencing đáng tin cậy do worker có thể bị terminate khi không còn activity. Toàn bộ chuỗi phát nên diễn ra trong offscreen document, nơi lifecycle của media phù hợp hơn.

### 4.4 BL-006/BL-007 — Offscreen lifecycle và autoplay

Chrome khuyến nghị giữ một shared `creating` promise để tránh nhiều caller cùng tạo offscreen document. Code hiện tại chưa có khóa này, đồng thời trả `{ success: true }` trước khi promise từ `audio.play()` hoàn tất.

Fallback click vào `#enable-audio` không thể hoạt động vì phần tử đó không tồn tại. Kể cả tạo phần tử ẩn, synthetic click cũng không thay thế được user activation thật cho các chính sách autoplay.

Tài liệu: [Chrome Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen)

## 5. Các vấn đề tồn đọng ngoài danh sách chính

### 5.1 Quyền và tài nguyên công khai quá rộng

- Quyền `tabs` không thấy được sử dụng trong source hiện tại.
- Host permission vẫn là `"<all_urls>"`.
- `web_accessible_resources` công khai audio, quotes, trang blocked và script cho `"<all_urls>"`.

Nên áp dụng nguyên tắc least privilege. Sau khi content script bị xóa, phần lớn audio/quote asset không cần được công khai cho website bên ngoài. Web-accessible resources quá rộng cũng làm tăng bề mặt fingerprinting của extension.

Tài liệu: [Web-accessible resources](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources)

### 5.2 Trang blocked mới chưa được dùng

`blocked.html` và `blocked.js` đã được tạo và đóng gói, nhưng DNR cũ vẫn redirect sang data URL. Vì vậy UI blocked page mới chưa nằm trong luồng chạy thực tế.

### 5.3 Còn nhiều nguồn sự thật trùng lặp

- `public/manifest.json` không đồng nhất với `manifest.json` ở root.
- `Pomodoro.jsx` vẫn chứa một `PopupAudioManager` cục bộ.
- Blocker mới và các helper/pattern cũ cùng tồn tại.

Các bản sao này dễ khiến lần sửa sau thay đổi nhầm file hoặc chỉ sửa một nửa hệ thống.

### 5.4 Logging production

Background, offscreen và audio flow còn nhiều `console.log`. Nên dùng logger có cấp độ và tắt debug logs trong production build, đồng thời giữ error logs có context nhưng không ghi dữ liệu nhạy cảm.

## 6. Thứ tự sửa đề xuất

### P0 — Khôi phục khả năng hoạt động của core flow

1. Thêm quyền `alarms` và xác minh service worker khởi động không lỗi.
2. Viết lại `UPDATE_BLOCKING_RULES` theo một contract duy nhất:
   - nhận `isBlocking` và danh sách hostname đã normalize;
   - tạo rule không overmatch;
   - remove/add atomically;
   - luôn trả `{ success, error? }`;
   - chỉ cập nhật storage/UI sau khi DNR thành công.
3. Thêm handler `PLAY_POMODORO_AUDIO` ở offscreen document và chuyển toàn bộ sequencing audio sang đó.
4. Memoize việc tạo offscreen document, await playback và trả lỗi thật.

### P1 — Ngăn lỗi quay lại

1. Thêm Vitest và mock `chrome.*`.
2. Unit test tối thiểu cho:
   - restore timer ở `currentTime = 0`;
   - phase hết hạn với custom durations;
   - normalize/match domain;
   - enable/disable/update blocker;
   - offscreen creation race;
   - message routing cho Pomodoro và ambient audio.
3. Thêm integration test cho storage → background → DNR.
4. Thêm CI chạy lint, test và build trên mỗi pull request.

### P2 — Production hardening

1. Hoàn thiện keyboard/screen-reader accessibility.
2. Thu hẹp permissions, host permissions và web-accessible resources.
3. Xóa manifest, audio manager và blocker code trùng lặp.
4. Thay debug logging bằng logger theo environment.
5. Thực hiện manual smoke test trên Chrome stable trước release.

## 7. Checklist manual test sau khi sửa

- [ ] Load `dist` dưới dạng unpacked extension và xác nhận service worker không có uncaught error.
- [ ] Start, pause, resume Pomodoro; reload popup; chờ service worker suspend rồi mở lại.
- [ ] Xác nhận timer phục hồi đúng tại `0`, khi phase vừa hết và khi dùng custom durations.
- [ ] Bật/tắt blocker nhiều lần; thêm/xóa domain khi blocker đang bật.
- [ ] `youtube.com` chặn domain chính và subdomain nhưng không chặn `notyoutube.com`.
- [ ] Domain xuất hiện trong path/query không làm request bị chặn nhầm.
- [ ] Các input `httpbin.org`, `http.cat`, URL có path/query, chữ hoa và trailing dot được normalize đúng.
- [ ] Trang blocked tùy chỉnh được hiển thị và nút quay lại hoạt động.
- [ ] Completion sound Pomodoro phát đúng số lần, đúng thứ tự và không overlap.
- [ ] Ambient sound start/stop/update sau nhiều lần mở/đóng popup.
- [ ] Test bằng bàn phím: tab order, focus visible, toggle state và task checkbox.
- [ ] Kiểm tra extension sau khi restart Chrome và sau khi máy sleep/wake.

## 8. Phạm vi thay đổi của lần kiểm tra

Lần kiểm tra này chỉ tạo báo cáo. Không có file source nào của extension được chỉnh sửa.
