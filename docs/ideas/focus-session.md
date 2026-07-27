# Beeyond Limits — Focus Session

## Problem Statement

Làm thế nào để giúp sinh viên, nhân viên văn phòng và freelancer nhanh chóng tạo một môi trường tập trung hoàn chỉnh, thay vì phải tự bật và quản lý Pomodoro, Todo List, Website Blocker và Ambient Sound như bốn công cụ riêng biệt?

## Target Users

- Sinh viên cần tập trung khi học, đọc tài liệu hoặc ôn thi.
- Nhân viên văn phòng và freelancer cần các khoảng deep work có chủ đích.
- Người dùng muốn một công cụ đơn giản, riêng tư và không yêu cầu tài khoản.

## Product Goal

Beeyond Limits là một công cụ tăng năng suất lấy **Focus Session** làm trải nghiệm cốt lõi. Pomodoro, Todo List, Website Blocker và Ambient Sound trở thành các thành phần phối hợp trong một session, đồng thời vẫn có thể được sử dụng độc lập.

North-star metric:

> Số Focus Session được hoàn thành.

## Recommended Direction

Áp dụng mô hình **Session-first, không Session-only**.

Trang chủ ưu tiên hành động `Start Focus Session`, các session đã lưu và tiến độ trong ngày. Bốn công cụ hiện tại được chuyển xuống khu vực `Quick Tools`, để người dùng vẫn có thể mở riêng khi cần.

Focus Session đóng vai trò lớp điều phối:

1. Người dùng chọn công việc cần thực hiện.
2. Thiết lập thời lượng tập trung và nghỉ.
3. Chọn preset website cần chặn.
4. Chọn ambient sound và âm lượng.
5. Bắt đầu session.
6. Beeyond Limits đồng thời chạy timer, kích hoạt blocker, phát âm thanh và theo dõi task.
7. Khi timer kết thúc, session được ghi nhận là hoàn thành.

Việc đặt tên và lưu session là tùy chọn. Người dùng phải có thể bắt đầu nhanh với cấu hình mặc định mà không cần tạo template trước.

## Product Principles

- **Start first, configure second:** Cấu hình mặc định phải đủ tốt để bắt đầu trong vài giây.
- **Progressive disclosure:** Chỉ hiển thị các lựa chọn chi tiết khi người dùng cần.
- **Every component is optional:** Một session không bắt buộc phải sử dụng đủ cả bốn chức năng.
- **Local-first:** Session, task, preset và thống kê được lưu trên thiết bị bằng Chrome Storage.
- **Manual control remains available:** Các công cụ riêng lẻ không bị khóa sau quy trình session.
- **Completion over configuration:** Giao diện tối ưu cho việc hoàn thành session, không phải tạo nhiều preset.

## Core User Flows

### Quick Session

1. Mở extension.
2. Nhấn `Start Focus Session`.
3. Sử dụng cấu hình mặc định hoặc điều chỉnh nhanh.
4. Nhấn `Start`.
5. Hoàn thành hoặc chủ động dừng session.

### Saved Session

1. Chọn một session đã lưu, ví dụ `Study 50 min`.
2. Kiểm tra hoặc thay đổi task hiện tại.
3. Nhấn `Start`.

### Individual Tool

1. Mở khu vực `Quick Tools`.
2. Chọn Timer, Tasks, Blocker hoặc Sounds.
3. Sử dụng công cụ độc lập mà không cần tạo session.

## MVP Scope

### Session setup

- Bắt đầu một session nhanh mà không cần đặt tên.
- Thiết lập thời lượng tập trung.
- Thiết lập thời lượng nghỉ.
- Chọn một task hiện có hoặc nhập mục tiêu ngắn cho session.
- Bật/tắt Website Blocker và chọn blocklist hiện có.
- Bật/tắt Ambient Sound, chọn âm thanh và âm lượng.
- Mỗi thành phần đều có thể được bỏ qua.

### Session lifecycle

- Start, pause, resume và stop session.
- Timer tiếp tục hoạt động khi popup đóng.
- Website Blocker chỉ được kích hoạt theo cấu hình của session.
- Ambient Sound được phát trong background.
- Chỉ ghi nhận completed khi session kết thúc hợp lệ.
- Session bị dừng sớm được ghi nhận riêng, không tính là completed.
- Khôi phục trạng thái session đang chạy khi người dùng mở lại popup.

### Saved sessions

- Đặt tên và lưu cấu hình hiện tại thành template.
- Xem và bắt đầu lại session đã lưu.
- Chỉnh sửa, nhân bản và xóa template.
- Lưu dữ liệu bằng `chrome.storage.local`.

### Progress

- Số session hoàn thành hôm nay.
- Tổng số phút tập trung hoàn thành hôm nay.
- Tỷ lệ session hoàn thành trên số session đã bắt đầu.
- Chuỗi ngày có ít nhất một session hoàn thành.

### Existing tools

- Giữ các trang Pomodoro, Todo List, Website Blocker và Ambient Sound.
- Đặt chúng trong khu vực `Quick Tools` thay vì để chúng là nội dung chính của trang chủ.

## Suggested Session Data Model

```js
{
  id: "uuid",
  name: "Study 50 min",
  focusDuration: 50,
  breakDuration: 10,
  task: {
    type: "existing",
    taskId: "task-id",
    label: "Read chapter 4"
  },
  blocker: {
    enabled: true,
    presetId: "study-blocklist"
  },
  ambientSound: {
    enabled: true,
    soundId: "rain",
    volume: 0.4
  },
  createdAt: 0,
  updatedAt: 0
}
```

Runtime state và template đã lưu nên là hai cấu trúc riêng. Runtime state cần thêm trạng thái như `startedAt`, `endsAt`, `pausedAt`, `status` và `completedAt`.

## Success Metrics

### Primary

- Completed Focus Sessions.

### Supporting

- Sessions started.
- Completion rate: `completed / started`.
- Focus minutes completed.
- Số ngày có ít nhất một completed session.
- Tỷ lệ session được bắt đầu từ saved template.
- Tỷ lệ người dùng quay lại bắt đầu session vào ngày khác.

Trong MVP, các chỉ số này có thể được tính và lưu cục bộ, không cần hệ thống analytics từ xa.

## Key Assumptions to Validate

- [ ] Người dùng muốn kết hợp ít nhất hai trong bốn công cụ trong cùng một session — kiểm tra qua cách sử dụng thực tế của 5–10 người dùng thử.
- [ ] Người dùng có thể bắt đầu session đầu tiên trong vòng 10 giây — kiểm tra bằng usability test có quan sát.
- [ ] Cấu hình mặc định đủ hữu ích để người mới không cần hiểu toàn bộ hệ thống — đo tỷ lệ bắt đầu nhanh mà không chỉnh sửa.
- [ ] Người dùng có nhu cầu tái sử dụng cấu hình — đo số template được tạo và số lần được sử dụng lại.
- [ ] Session completion tạo động lực quay lại — theo dõi số ngày người dùng hoàn thành session trong một tuần.
- [ ] Website Blocker và Ambient Sound hoạt động ổn định xuyên suốt vòng đời session, kể cả khi popup bị đóng — kiểm tra bằng automated test và browser test.

## Risks and Mitigations

### Setup tạo quá nhiều ma sát

Giảm số trường hiển thị ban đầu, cung cấp mặc định hợp lý và cho phép bắt đầu mà không cần lưu.

### Session orchestration không ổn định

Xây dựng một session state machine duy nhất làm nguồn dữ liệu chuẩn; tránh để mỗi page tự quyết định trạng thái session.

### Người dùng chỉ muốn một công cụ

Giữ `Quick Tools` và không bắt buộc mọi hoạt động phải nằm trong session.

### Thống kê khuyến khích chạy timer thay vì làm việc thật

Chỉ coi thống kê là phản hồi nhẹ. Không bổ sung leaderboard hoặc phần thưởng dễ bị khai thác trong MVP.

### Phạm vi phát triển vượt khả năng duy trì của dự án cá nhân

Giữ toàn bộ dữ liệu local-first, không triển khai account, backend hoặc đồng bộ cloud trong giai đoạn đầu.

## Not Doing (and Why)

- **Không chuyển sang Session-only** — các công cụ riêng vẫn có giá trị cho những nhu cầu nhanh.
- **Không yêu cầu tài khoản hoặc đăng nhập** — không cần thiết cho giả định cốt lõi và làm tăng chi phí vận hành.
- **Không đồng bộ cloud** — local storage đủ cho MVP và phù hợp định hướng riêng tư.
- **Không chia sẻ session giữa người dùng** — chưa giúp kiểm chứng khả năng hoàn thành session.
- **Không xây marketplace template** — tạo cold-start và gánh nặng moderation không cần thiết.
- **Không thêm AI planning** — tăng độ phức tạp nhưng không giải quyết rủi ro cốt lõi.
- **Không gamification phức tạp** — streak đơn giản là đủ để kiểm tra giá trị của tiến độ.
- **Không làm analytics server-side trong MVP** — dữ liệu cục bộ đủ để phát triển và thử nghiệm ban đầu.
- **Không đưa donate vào luồng tập trung** — link donate chỉ nên xuất hiện kín đáo trong About/Settings.
- **Không viết lại toàn bộ bốn module** — tái sử dụng các core module hiện có và thêm một lớp điều phối session.

## Validation Plan

1. Tạo prototype luồng Quick Session với cấu hình mặc định.
2. Cho 5–10 sinh viên, nhân viên văn phòng hoặc freelancer thực hiện một session.
3. Quan sát thời gian từ lúc mở extension đến lúc nhấn Start.
4. Ghi nhận thành phần nào được bật, tắt hoặc gây bối rối.
5. Cho phép lưu template sau khi hoàn thành session đầu tiên.
6. Theo dõi trong một tuần: số session bắt đầu, hoàn thành và template được dùng lại.
7. Chỉ mở rộng Saved Sessions và Progress nếu hành vi thực tế xác nhận nhu cầu.

## Open Questions

- Có nên cho phép session liên kết với một task hiện có, mục tiêu dạng text, hay hỗ trợ cả hai?
- Blocklist nên được lưu dưới dạng preset riêng hay snapshot bên trong mỗi session?
- Khi session bị pause, Website Blocker và Ambient Sound nên tiếp tục hay tạm dừng?
- Break có thuộc cùng một session completion hay được theo dõi riêng?
- Cấu hình Quick Session mặc định tốt nhất cho người mới là 25/5 hay một lựa chọn khác?

