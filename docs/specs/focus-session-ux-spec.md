# Spec: Focus Session UX

Status: **Approved — 2026-07-27**  
Related product brief: [`docs/ideas/focus-session.md`](../ideas/focus-session.md)

## 1. Objective

Thiết kế trải nghiệm **Session-first, không Session-only** cho Beeyond Limits.

Focus Session trở thành hành động chính trên trang Home và phối hợp bốn khả năng hiện có:

- Pomodoro Timer
- Task List
- Website Blocker
- Ambient Sounds

Người dùng chính là sinh viên, nhân viên văn phòng và freelancer muốn bắt đầu một khoảng tập trung có chủ đích mà không phải cấu hình nhiều công cụ riêng biệt.

### Product outcome

Người dùng có thể mở extension, xác định việc cần làm và bắt đầu một môi trường tập trung hoàn chỉnh trong vài giây. Trong khi đó, bốn công cụ cũ vẫn có thể truy cập độc lập qua `Quick Tools`.

### Primary success metric

> Số Focus Session hoàn thành.

### UX success criteria

- Người mới có thể bắt đầu Quick Session mặc định trong không quá 10 giây.
- Từ Home đến lúc timer chạy không quá hai thao tác nếu dùng cấu hình mặc định.
- Không bắt buộc đặt tên hoặc lưu template trước khi bắt đầu.
- Người dùng luôn nhìn thấy trạng thái session đang chạy khi mở lại popup.
- Mỗi thành phần Task, Blocker và Sound có thể được bật hoặc tắt độc lập.
- Các công cụ riêng vẫn truy cập được từ Home trong tối đa hai thao tác.

## 2. Assumptions Requiring Review

Các quyết định dưới đây được dùng cho bản spec đầu tiên:

1. Popup giữ kích thước cơ sở `400px` và chiều cao hiển thị khoảng `600px`.
2. Quick Session mặc định dùng chu kỳ `25 phút focus / 5 phút break`.
3. Mục tiêu session có thể là một task hiện có hoặc một đoạn text ngắn.
4. MVP chỉ có một blocklist dùng chung. Trường `presetId` được dành cho khả năng thêm nhiều preset sau này.
5. Pause sẽ tạm dừng timer và Ambient Sound; Website Blocker tiếp tục hoạt động để pause không trở thành cách né chặn.
6. Một Focus interval kết thúc hợp lệ được tính là một completed session; break không tạo thêm completed session.
7. Khi Focus kết thúc, break không tự chạy. Người dùng chủ động chọn `Start Break` hoặc `Finish`.
8. Toàn bộ dữ liệu được lưu cục bộ, không có tài khoản, backend hoặc cloud sync.

Nếu một giả định thay đổi, spec phải được cập nhật trước khi lập implementation plan.

## 3. Information Architecture

```text
Home
├── Active Session Resume Card       (chỉ xuất hiện khi có session đang chạy/paused)
├── Primary Action
│   └── Start Focus Session
├── Today Progress
│   ├── Completed Sessions
│   └── Focus Minutes
├── Saved Sessions
│   ├── Start Saved Session
│   ├── Edit
│   ├── Duplicate
│   └── Delete
└── Quick Tools
    ├── Timer
    ├── Tasks
    ├── Blocker
    └── Sounds

Focus Session Setup
├── Focus Goal
├── Duration
├── Website Blocker
├── Ambient Sound
├── Start Session
└── Save as Template

Active Session
├── Current Goal
├── Countdown
├── Enabled Components
├── Pause / Resume
├── Stop Early
└── Minimize to Home

Focus Complete
├── Completion Feedback
├── Mark Linked Task Complete
├── Start Break
├── Finish
└── Save Configuration
```

## 4. Primary Wireflow

```text
┌─────────────┐
│    HOME     │
└──────┬──────┘
       │ Start Focus Session
       ▼
┌──────────────────┐
│  SESSION SETUP   │◄──── Start saved template
└──────┬───────────┘
       │ Start
       ▼
┌──────────────────┐
│  ACTIVE SESSION  │
└───┬──────────┬───┘
    │          │
    │ Pause    │ Focus timer reaches zero
    ▼          ▼
┌──────────┐  ┌────────────────┐
│  PAUSED  │  │ FOCUS COMPLETE │
└────┬─────┘  └───────┬────────┘
     │ Resume          ├── Start Break ──► Break Timer
     └─────────────────┤
                       └── Finish ───────► Home + updated progress
```

### Stop-early branch

```text
Active / Paused
      │ Stop
      ▼
Confirmation
├── Keep focusing
└── Stop session
       └── recorded as abandoned, not completed
```

## 5. Screen Specifications

### 5.1 Home

#### Purpose

Giúp người dùng bắt đầu hoặc quay lại một Focus Session. Home không còn là danh mục bốn feature có trọng số ngang nhau.

#### Priority order

1. Active/paused session, nếu có.
2. Start Focus Session.
3. Today Progress.
4. Saved Sessions.
5. Quick Tools.
6. Daily Quote, nếu còn đủ không gian.

#### Wireframe

```text
┌──────────────────────────────────────┐
│ BEEYOND LIMITS              2 TODAY  │
│ Your focus companion       50 MIN    │
├──────────────────────────────────────┤
│                                      │
│  READY TO FOCUS?                     │
│  Set the space. Do the work.         │
│                                      │
│  [ ▶ START FOCUS SESSION ]           │
│                                      │
├──────────────────────────────────────┤
│ SAVED SESSIONS              MANAGE > │
│ ┌──────────────────────────────────┐ │
│ │ STUDY 50              50m  RAIN ▶│ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ DEEP WORK             90m  QUIET▶│ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ QUICK TOOLS                          │
│ [ TIMER ] [ TASKS ] [ BLOCK ] [ ♪ ] │
└──────────────────────────────────────┘
```

#### Active-session variant

Khi có session đang chạy hoặc paused, thay hero bằng resume card:

```text
┌──────────────────────────────────────┐
│ SESSION IN PROGRESS                  │
│ Finish project proposal              │
│ 18:42 REMAINING             RAIN · 8 │
│ [ RETURN TO SESSION ]                │
└──────────────────────────────────────┘
```

Không hiển thị nút tạo session mới khi một session chưa kết thúc.

#### Interaction rules

- `Start Focus Session` mở Session Setup với mặc định 25/5.
- Chọn saved session mở Setup với dữ liệu được điền sẵn, chưa tự chạy.
- `Manage` mở danh sách template đầy đủ.
- Quick Tools điều hướng tới các page hiện có.
- Daily Quote được đặt sau Quick Tools và có thể nằm dưới fold.

### 5.2 Focus Session Setup

#### Purpose

Cho phép xác định “tôi sẽ làm gì” và tùy chỉnh môi trường tập trung mà không biến thành wizard nhiều bước.

#### Wireframe

```text
┌──────────────────────────────────────┐
│ ‹ BACK          NEW FOCUS SESSION    │
├──────────────────────────────────────┤
│ WHAT WILL YOU FOCUS ON?              │
│ [ Write a short goal...            ] │
│ [ or choose an existing task      ▼] │
│                                      │
│ DURATION                             │
│ [ 15 ] [ 25 ] [ 50 ] [ CUSTOM ]     │
│ Break: 5 min                      >  │
│                                      │
│ FOCUS ENVIRONMENT                    │
│ ┌──────────────────────────────────┐ │
│ │ WEBSITE BLOCKER          [ ON  ] │ │
│ │ 8 distracting sites             │ │
│ ├──────────────────────────────────┤ │
│ │ AMBIENT SOUND            [ ON  ] │ │
│ │ Rain                    Volume > │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [ ▶ START 25 MIN FOCUS ]             │
│ [ SAVE AS TEMPLATE ]                 │
└──────────────────────────────────────┘
```

#### Field behavior

**Focus goal**

- Text input là lựa chọn mặc định.
- Task picker hiển thị các task chưa hoàn thành.
- Chọn task sẽ điền label của task và lưu `taskId`.
- Không bắt buộc phải có goal để bắt đầu.
- Giới hạn goal text ở 120 ký tự.

**Duration**

- Quick choices: 15, 25 và 50 phút.
- Custom range: 5–120 phút.
- Break mặc định 5 phút; cho phép 1–30 phút.
- CTA cập nhật trực tiếp theo duration: `Start 25 Min Focus`.

**Website Blocker**

- Toggle mặc định lấy theo Quick Session preference gần nhất.
- Hiển thị số domain trong blocklist.
- Nếu blocklist rỗng, trạng thái là `No sites configured` và có link `Add sites`.
- Bật blocker với blocklist rỗng không được tạo cảm giác đã được bảo vệ.

**Ambient Sound**

- Toggle mặc định lấy theo preference gần nhất.
- MVP cho phép chọn tối đa một ambient sound trong Session Setup.
- Volume hiển thị sau khi chọn sound.
- Có preview ngắn, nhưng preview phải dừng trước khi session bắt đầu.

**Save as Template**

- Là secondary action.
- Khi nhấn mới yêu cầu tên template.
- Tên dài tối đa 40 ký tự.
- Lưu không tự động bắt đầu session.

#### Validation

- Duration phải nằm trong giới hạn hợp lệ.
- Không cho Start trong khi lệnh khởi tạo session đang được xử lý.
- Nếu một thành phần phụ khởi động thất bại, không được âm thầm bắt đầu session một phần.
- Hiển thị lỗi theo thành phần và cho phép thử lại hoặc tắt thành phần đó.

### 5.3 Active Session

#### Purpose

Giữ sự chú ý vào goal và thời gian còn lại. Màn hình này không phải dashboard cấu hình.

#### Wireframe

```text
┌──────────────────────────────────────┐
│ FOCUS SESSION               • ACTIVE │
│                                      │
│ FINISH PROJECT PROPOSAL              │
│                                      │
│          ┌────────────────┐          │
│          │                │          │
│          │     18:42      │          │
│          │   FOCUS TIME   │          │
│          │                │          │
│          └────────────────┘          │
│                                      │
│ BLOCKING 8 SITES       RAIN · 40%    │
│                                      │
│ [ Ⅱ PAUSE ]                         │
│ [ STOP EARLY ]          [ HOME ]     │
└──────────────────────────────────────┘
```

#### Interaction rules

- Timer và runtime state được lấy từ background, không dựa vào React interval làm nguồn chuẩn.
- `Pause` tạm dừng timer và sound; blocker tiếp tục hoạt động.
- `Resume` khôi phục đúng cấu hình session.
- `Home` chỉ thu nhỏ trải nghiệm; session tiếp tục chạy.
- `Stop Early` luôn yêu cầu xác nhận.
- Không cho chỉnh duration, blocklist hoặc sound selection khi đang active.
- Volume có thể được chỉnh khi active nếu không làm thay đổi template đã lưu.

#### Paused state

- Đổi status thành `Paused`.
- Timer không giảm.
- CTA chính là `Resume Focus`.
- Website Blocker hiển thị trạng thái `Still blocking`; Ambient Sound hiển thị trạng thái paused.
- Có thể Stop Early.

#### Accessibility

- Countdown dùng `role="timer"` nhưng không thông báo mỗi giây qua screen reader.
- Trạng thái Active/Paused/Completed sử dụng text và icon, không chỉ màu sắc.
- Focus keyboard chuyển tới CTA chính khi màn hình được mở.

### 5.4 Focus Complete

#### Purpose

Ghi nhận thành quả, cập nhật metric và đưa ra một lựa chọn tiếp theo rõ ràng.

#### Wireframe

```text
┌──────────────────────────────────────┐
│                                      │
│            FOCUS COMPLETE            │
│                                      │
│              25 MIN                  │
│       Finish project proposal        │
│                                      │
│ TODAY: 3 SESSIONS · 75 MIN           │
│                                      │
│ [ ] MARK LINKED TASK COMPLETE        │
│                                      │
│ [ ☕ START 5 MIN BREAK ]              │
│ [ FINISH FOR NOW ]                   │
│                                      │
│ SAVE THIS SETUP FOR NEXT TIME        │
└──────────────────────────────────────┘
```

#### Interaction rules

- Completion được ghi nhận trước khi màn hình xuất hiện và phải idempotent.
- Linked task không tự hoàn thành; người dùng xác nhận bằng checkbox/action.
- `Start Break` bắt đầu break timer nhưng không tạo Focus completion mới.
- `Finish for Now` kết thúc runtime session và về Home.
- Chỉ hiện `Save this setup` nếu session chưa bắt đầu từ template hoặc cấu hình đã thay đổi.

### 5.5 Break

Break sử dụng cùng cấu trúc Active Session nhưng:

- Status là `Break`.
- Website Blocker tắt trong break.
- Ambient Sound mặc định dừng; người dùng có thể bật lại thủ công.
- CTA cho phép `Skip Break`.
- Hết break không tự động bắt đầu focus tiếp theo.
- Hoàn thành break không tăng số Focus Session completed.

### 5.6 Saved Sessions Management

Màn hình này nằm ngoài luồng bắt đầu nhanh:

- Danh sách template.
- Edit, duplicate và delete.
- Delete cần xác nhận.
- Template đang được dùng bởi runtime session có thể sửa vì runtime giữ snapshot riêng.
- Empty state hướng người dùng tạo template từ một cấu hình đã dùng thành công.

## 6. State Model from the UX Perspective

```text
idle
  └── start requested ──► starting
                            ├── success ──► active_focus
                            └── failure ──► idle + actionable error

active_focus
  ├── pause ─────────────► paused_focus
  ├── stop confirmed ────► abandoned
  └── timer completed ───► focus_completed

paused_focus
  ├── resume ────────────► active_focus
  └── stop confirmed ────► abandoned

focus_completed
  ├── start break ───────► active_break
  └── finish ────────────► idle

active_break
  ├── pause ─────────────► paused_break
  ├── skip ──────────────► idle
  └── timer completed ───► break_completed

paused_break
  ├── resume ────────────► active_break
  └── skip ──────────────► idle

break_completed
  └── finish ────────────► idle
```

Terminal records:

- `completed`: Focus interval reached zero.
- `abandoned`: User stopped before zero.

`completed` must be recorded at most once for each runtime session ID.

## 7. Data and Persistence Requirements

### Storage keys

Proposed new keys:

```text
focusSessionTemplates
activeFocusSession
focusSessionHistory
focusSessionPreferences
```

Existing keys to preserve:

```text
tasks
blockedUrls
isBlocking
ambientSettings
pomodoroSettings
pomodoroState
```

### Template versus runtime

A template stores reusable user intent. Runtime stores an immutable snapshot plus current state.

```js
const template = {
  id: "template-id",
  name: "Study 50",
  focusDuration: 50,
  breakDuration: 10,
  goal: { type: "text", text: "" },
  blocker: { enabled: true, presetId: "default" },
  ambientSound: { enabled: true, soundId: "rain", volume: 40 },
  createdAt: 0,
  updatedAt: 0,
};

const runtime = {
  id: "runtime-id",
  templateId: "template-id",
  snapshot: template,
  goal: { type: "task", taskId: 123, text: "Read chapter 4" },
  phase: "focus",
  status: "active",
  startedAt: 0,
  phaseEndsAt: 0,
  remainingSeconds: 1500,
  completedAt: null,
};
```

Template edits must not mutate an active runtime session.

### History retention

- MVP lưu tối đa 90 ngày hoặc 500 history records, tùy giới hạn nào đạt trước.
- Dữ liệu cũ hơn được tổng hợp theo ngày trước khi xóa chi tiết.
- Không lưu lịch sử duyệt web hoặc domain người dùng đã cố truy cập.

## 8. Visual Direction

Giữ hệ thống neo-brutalist hiện tại:

- Canvas `#f2e9e1`
- Ink `#0d0c0c`
- Mustard cho primary focus action
- Crimson cho destructive/stop actions
- Sapphire cho Task
- Emerald cho enabled/protected state
- Anton cho display headings
- JetBrains Mono cho labels, status và metadata
- Border 3px và hard shadow hiện có

### Hierarchy constraints

- Mỗi screen chỉ có một primary CTA.
- Display heading không được đẩy CTA xuống quá sâu trong popup.
- Active Session ưu tiên timer và goal; decoration phải tối thiểu.
- Không dùng bốn feature card lớn trên Home mới.
- Không dựa hoàn toàn vào màu để biểu thị trạng thái.

## 9. Responsive and Popup Behavior

- Target chính: Chrome action popup rộng 400px.
- Nội dung phải dùng được từ 360px đến 480px.
- Primary CTA nên xuất hiện trong viewport đầu tiên trên Home và Setup.
- Screen dài có thể scroll; Active Session không nên cần scroll ở 400 × 600px.
- Không đặt hành động thiết yếu chỉ ở trạng thái hover.
- Touch target tối thiểu 44 × 44 CSS pixels khi có thể.

## 10. Error and Recovery UX

### Popup reopened

- Đọc runtime state từ background.
- Nếu active hoặc paused, Home hiển thị Resume Card.
- Điều hướng vào Active Session phải tái tạo đúng countdown và component status.

### Service worker restarted

- Khôi phục runtime từ Chrome Storage.
- Tính remaining time từ `phaseEndsAt`.
- Nếu thời điểm kết thúc đã qua, hoàn tất phase đúng một lần.

### Partial startup failure

Ví dụ timer tạo thành công nhưng blocker thất bại:

- Roll back các thành phần đã khởi động.
- Không chuyển sang Active Session.
- Hiển thị thành phần thất bại và hai lựa chọn: `Try Again` hoặc tắt thành phần đó.

### Storage failure

- Không xác nhận template đã lưu nếu Chrome Storage thất bại.
- Runtime đang chạy được ưu tiên an toàn; lỗi ghi history không được làm timer dừng.
- Cho phép thử ghi lại completion record.

## 11. Tech Stack

- React `19.1.x`
- Vite `5.4.x`
- Tailwind CSS `4.1.x`
- Chrome Extension Manifest V3
- Chrome Storage, Alarms, Declarative Net Request, Notifications và Offscreen APIs
- Node built-in test runner

Không bổ sung dependency mới trong giai đoạn UX/MVP nếu khả năng hiện tại đủ đáp ứng.

## 12. Commands

```powershell
npm run dev
npm run lint
npm test
npm run build
npx prettier --check .
```

## 13. Project Structure

Existing structure:

```text
src/pages/          Page-level React views
src/components/     Reusable UI components
src/core/           Pure domain logic and browser-facing helpers
src/background.js   Service worker and long-lived orchestration
tests/              Node unit and integration tests
docs/ideas/         Product briefs
docs/specs/         Reviewed feature specifications
```

Expected additions during implementation planning:

```text
src/pages/FocusSessionSetup.jsx
src/pages/ActiveFocusSession.jsx
src/pages/FocusSessionComplete.jsx
src/components/Session*.jsx
src/core/focusSession.js
tests/focusSession.test.js
```

Exact file changes belong in the implementation plan, not this UX spec.

## 14. Code Style

- Functional React components and hooks.
- Pure transition/normalization functions belong in `src/core`.
- Background owns durable runtime state.
- Components send explicit commands and render returned state.
- Message type constants use uppercase snake case.
- Async failures must be surfaced to the UI.

Example:

```js
export function transitionFocusSession(state, event) {
  if (state.status === "active" && event.type === "PAUSE") {
    return {
      ...state,
      status: "paused",
      remainingSeconds: event.remainingSeconds,
      phaseEndsAt: null,
    };
  }

  return state;
}
```

## 15. Testing Strategy

### Unit tests

Test pure logic in `src/core/focusSession.js`:

- Normalization and validation.
- Every valid state transition.
- Invalid transitions do not corrupt state.
- Completion is idempotent.
- Restore after service worker restart.
- History aggregation and retention.

### Background integration tests

- Start coordinates timer, blocker and ambient sound.
- Partial failure rolls back prior operations.
- Pause/resume coordinates all enabled components.
- Stop restores non-session component state.
- Alarm completion writes exactly one history record.

### React interaction tests

The current project has no React testing dependency. Adding one requires review during planning. At minimum, behavior must be covered through core tests and browser testing.

### Browser verification

- Quick Session from Home.
- Saved Session start.
- Popup close/reopen while active.
- Pause/resume.
- Stop-early confirmation.
- Focus completion and progress update.
- Service worker restart recovery.
- Keyboard navigation and visible focus.
- Empty blocklist and storage-error states.

## 16. Boundaries

### Always

- Keep focus runtime state in background/storage, not only React memory.
- Preserve access to all four individual tools.
- Make every optional session component explicitly enabled/disabled.
- Use reversible, idempotent operations for start, pause, resume and completion.
- Add tests for state transitions before integrating UI.
- Preserve existing user tasks, blocked URLs and sound preferences.
- Meet keyboard and screen-reader requirements stated in this spec.

### Ask first

- Adding dependencies.
- Changing Chrome permissions or host permissions.
- Migrating or deleting existing storage keys.
- Changing popup to side panel or full-page mode.
- Adding analytics, telemetry, cloud sync or account features.
- Changing the default 25/5 duration.

### Never

- Require an account to start a session.
- Count an abandoned session as completed.
- Mutate a saved template while its runtime snapshot is active.
- Start a partial session without informing the user.
- Store browsing history or attempted blocked URLs for analytics.
- Hide Quick Tools behind a paid or donation gate.
- Place donation prompts inside Active Session.

## 17. Acceptance Criteria

### Home

- [ ] Home prioritizes Start/Resume Focus Session above Quick Tools.
- [ ] Active session is recoverable from Home after popup reopen.
- [ ] Today’s completed count and focus minutes are visible.
- [ ] All four existing tools remain accessible.

### Setup

- [ ] A default 25-minute session starts in no more than two actions from Home.
- [ ] Goal is optional and supports text or an active task.
- [ ] Blocker and sound can be independently enabled.
- [ ] Saved template creation is optional.
- [ ] Startup failure cannot leave an invisible partial session running.

### Active session

- [ ] Countdown remains accurate after popup close/reopen.
- [ ] Pause/resume coordinates all enabled components.
- [ ] Stop Early requires confirmation and records abandoned status.
- [ ] Home navigation does not stop an active session.

### Completion

- [ ] Each focus interval creates at most one completed record.
- [ ] Completed count and focus minutes update immediately.
- [ ] Linked task is only completed after explicit user action.
- [ ] Break is optional and does not increment completed focus sessions.

### Compatibility

- [ ] Existing tasks and tool settings remain intact.
- [ ] Individual Pomodoro, Task, Blocker and Sound pages still work.
- [ ] `npm run lint`, `npm test` and `npm run build` pass.

## 18. Decision Log

Các quyết định sau được duyệt ngày 2026-07-27:

1. Quick Session mặc định dùng chu kỳ `25/5`.
2. Khi pause, timer và Ambient Sound tạm dừng; Website Blocker tiếp tục hoạt động.
3. Break chờ người dùng chủ động bắt đầu, không tự chạy.
4. Mỗi Focus Session trong MVP chọn tối đa một ambient sound; công cụ Sounds độc lập vẫn cho phép mix.
5. Linked task chỉ được đánh dấu hoàn thành sau khi người dùng xác nhận.

Spec đã được chấp thuận để chuyển sang Phase 2: Implementation Plan.
