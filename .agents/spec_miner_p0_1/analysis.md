# Beeyond Limits — Focus Session Specification & Architecture Analysis

> **Specification Mining Report**  
> **Author**: Specification Miner Agent  
> **Target System**: Beeyond Limits Chrome Extension (Focus Session MVP)  
> **Date**: 2026-07-27  

---

## 1. Executive Summary & Core Mission

Beeyond Limits is an offline-first, local-only Chrome Extension designed to boost productivity for students, office workers, and freelancers. The **Focus Session MVP** transforms the user experience into a **Session-first, non-Session-only** model:
- **Focus Session** operates as an overarching orchestration layer coordinating four distinct tools: **Pomodoro Timer**, **Task List**, **Website Blocker**, and **Ambient Sounds**.
- **Quick Tools** retains standalone, uninhibited access to each of the four tools for quick, single-purpose usage.
- **Authoritative Source of Truth**: The background service worker (`src/background.js`) manages timer state, alarms, storage sync, and component orchestration. The React popup UI (`src/App.jsx`) is a state-driven view layer that dispatches commands and renders background state.

---

## 2. Complete Feature Inventory & Functional Requirements

### 2.1 Overview of Functional Requirements

| ID | Feature Name | Description | Key Constraints & Rules |
|---|---|---|---|
| **F-01** | Quick Session Setup | Start a focus session in <=2 actions from Home using defaults (25m focus / 5m break). | Goal, blocker, and ambient sound are all optional. No mandatory template saving or naming. |
| **F-02** | Session Goal Selection | Specify what to focus on via freeform text or linked existing task. | Text goal max 120 chars. Task picker fetches incomplete items from `tasks` storage key. Captures `taskId` and text snapshot. |
| **F-03** | Duration Customization | Select focus and break durations. | Focus choices: 15, 25, 50 mins or custom (5–120 mins). Break range: 1–30 mins (default 5 mins). |
| **F-04** | Website Blocker Integration | Activate Declarative Net Request rules for distracting sites during focus. | MVP uses shared blocklist (`blockedUrls`). Blocker **remains active during Pause** to prevent bypass. Disables during Break. |
| **F-05** | Ambient Sound Integration | Play ambient sound during focus session via Offscreen Audio API. | Select at most 1 ambient sound per Focus Session. Sound pauses on session pause. Off by default during Break. Volume adjustable (0–100%). Preview stops before session start. |
| **F-06** | Transactional Start & Rollback | Start timer, blocker, and audio deterministically. | Captures pre-session state. If any component fails to initialize, roll back all applied components in reverse order and present actionable error. |
| **F-07** | Session State Machine | Manage state transitions deterministically in `src/core/focusSession.js`. | Supported states: `idle`, `starting`, `active_focus`, `paused_focus`, `focus_completed`, `active_break`, `paused_break`, `break_completed`, `abandoned`. |
| **F-08** | Runtime Persistence & Service Worker Recovery | Restore active/paused session upon SW restart or popup reopen. | Authoritative runtime state stored in `activeFocusSession`. Derives remaining time from `phaseEndsAt`. Expired alarms trigger exact-once completion. |
| **F-09** | Idempotent Focus Completion | Record completion exactly once when focus timer reaches zero. | Focus interval completion creates a history record in `focusSessionHistory` keyed by runtime ID. Break timer completion does **not** increment completed sessions. |
| **F-10** | Linked Task Completion | Prompt user to mark linked task complete upon focus completion. | Explicit user checkbox/action required (`[ ] MARK LINKED TASK COMPLETE`). Never completes linked tasks automatically. Updates `tasks` storage key once. |
| **F-11** | Break Management | Allow optional break after focus completion. | Break timer does not start automatically; requires explicit user action (`Start Break`). Blocker disabled. Option to `Skip Break` or `Finish`. |
| **F-12** | Saved Session Templates | Save, list, edit, duplicate, and delete reusable session templates. | Template name max 40 chars. Editing a template does **not** mutate an active runtime session snapshot. |
| **F-13** | Today Progress & Metrics | Aggregate completed focus sessions, total focus minutes, completion rate, and streak. | Local calendar day aggregation. Abandoned sessions count toward started but not completed. History retained up to 90 days or 500 records. |
| **F-14** | Session-First Home Navigation | Redesign Home hierarchy with active session priority. | Priority: 1. Resume Card (if session running/paused), 2. Start Focus CTA, 3. Today Stats, 4. Saved Sessions, 5. Quick Tools, 6. Daily Quote. |
| **F-15** | Quick Tools Preservation | Maintain independent access to Pomodoro, Tasks, Blocker, and Sounds. | All existing pages, routes, storage keys, and standalone usages remain fully functional. |

---

### 2.2 Complete State Machine Specification

```
                                  ┌───────────────┐
                                  │     idle      │
                                  └───────┬───────┘
                                          │ FOCUS_SESSION_START requested
                                          ▼
                                  ┌───────────────┐
                                  │   starting    │
                                  └───────┬───────┘
                                          │ success
                                          ▼
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │                                active_focus                                 │
   └───┬──────────────────────────┬─────────────────────────────┬────────────────┘
       │ FOCUS_SESSION_PAUSE      │ Focus timer reaches zero    │ STOP_EARLY confirmed
       ▼                          ▼                             ▼
┌──────────────┐         ┌──────────────────┐          ┌─────────────────┐
│ paused_focus │         │ focus_completed  │          │    abandoned    │
└──────┬───────┘         └────────┬─────────┘          └────────┬────────┘
       │ FOCUS_SESSION_RESUME     │                             │
       └──────────────────────────┤                             │ Clears runtime,
                                  ├────────────────────────┐    │ restores pre-session
                                  │ START_BREAK            │    │ state -> idle
                                  ▼                        ▼    ▼
                         ┌──────────────────┐     ┌──────────────┐
                         │   active_break   │     │    idle      │
                         └────────┬─────────┘     └──────────────┘
                                  │ FOCUS_SESSION_PAUSE / timer zero / SKIP_BREAK
                                  ▼
                         ┌──────────────────┐
                         │   paused_break   │ / break_completed
                         └────────┬─────────┘
                                  │ FINISH / SKIP_BREAK
                                  ▼
                         ┌──────────────────┐
                         │       idle       │
                         └──────────────────┘
```

#### Detailed Transition Table

| Current State | Trigger Event | Next State | Action / Side Effects |
|---|---|---|---|
| `idle` | `FOCUS_SESSION_START` | `starting` | Validates setup input, creates immutable runtime snapshot, stores pre-session state. |
| `starting` | `START_SUCCESS` | `active_focus` | Activates timer alarm (`phaseEndsAt`), activates Blocker DNR rules (if enabled), starts Offscreen Audio (if enabled). Persists `activeFocusSession`. |
| `starting` | `START_FAILURE` | `idle` | Rolls back applied components in reverse order. Returns actionable error to UI. |
| `active_focus` | `FOCUS_SESSION_PAUSE` | `paused_focus` | Clears timer alarm, calculates and stores `remainingSeconds`, stops audio. **Website Blocker remains active**. |
| `paused_focus` | `FOCUS_SESSION_RESUME` | `active_focus` | Calculates new `phaseEndsAt = Date.now() + remainingSeconds * 1000`, sets timer alarm, restarts session audio. |
| `active_focus` / `paused_focus` | `STOP_CONFIRMED` | `abandoned` | Clears alarm, stops audio, deactivates session blocker, restores pre-session state. Writes history record with status `abandoned`. Clears `activeFocusSession`. |
| `active_focus` | `TIMER_ZERO` / `ALARM_FIRED` | `focus_completed` | **Idempotent transition**: Checks runtime ID. Writes `completed` history record to `focusSessionHistory` exactly once. Updates today's metrics. Stops session audio. Keeps blocker active. |
| `focus_completed` | `FOCUS_SESSION_START_BREAK` | `active_break` | Deactivates focus blocker. Sets break timer alarm (`phaseEndsAt = Date.now() + breakDuration * 60 * 1000`). Sound disabled by default. |
| `focus_completed` | `FOCUS_SESSION_FINISH` | `idle` | Restores pre-session blocker & audio state. Clears `activeFocusSession`. |
| `active_break` | `FOCUS_SESSION_PAUSE` | `paused_break` | Clears break alarm, stores `remainingSeconds`. |
| `paused_break` | `FOCUS_SESSION_RESUME` | `active_break` | Re-calculates `phaseEndsAt` and resets break timer alarm. |
| `active_break` / `paused_break` | `SKIP_BREAK` / `FINISH` | `idle` | Clears break timer, restores pre-session state, clears `activeFocusSession`. |
| `active_break` | `TIMER_ZERO` | `break_completed` | Break timer finished. Does **not** increment focus completion count. Awaits user `Finish` action. |

---

## 3. Features Discovered & Edge Cases

### 3.1 Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Setup | Preset Duration Quick Select | Preset duration buttons (15m, 25m, 50m) and custom slider (5–120m). | User button tap or slider change | Updated focus duration & CTA label (`Start X Min Focus`) | Reverts to 25m if input < 5 or > 120 | `focus-session-ux-spec.md` §5.2 |
| 2 | Setup | Active Task Goal Picker | Select an existing incomplete task from `tasks` storage to set as session goal. | `taskId` from dropdown | Goal label filled, `taskId` & text snapshot saved | Falls back to freeform text if task deleted | `focus-session-ux-spec.md` §5.2 |
| 3 | Setup | Empty Blocklist Warning | Display count of blocked domains; show warning link if zero domains configured. | `blockedUrls` storage array | Status text (`No sites configured`) + `Add sites` action link | Bypasses DNR activation if domains = 0 | `focus-session-ux-spec.md` §5.2 |
| 4 | Setup | Ambient Sound Preview | Brief preview audio clip playback during setup. | Sound ID selection | Audio playback sample | Preview auto-stops before session start | `focus-session-ux-spec.md` §5.2 |
| 5 | Setup | Save Setup as Template | Save current setup configuration into reusable template list without starting session. | Template Name (max 40 chars) | Item saved to `focusSessionTemplates` | Validates non-empty trimmed name | `focus-session-ux-spec.md` §5.2 |
| 6 | Active View | Background-Synced Countdown | High-precision countdown synchronized with background SW target end time. | Background state (`phaseEndsAt`) | `MM:SS` timer display (`role="timer"`) | Recalculates from `phaseEndsAt` on popup reopen | `focus-session-ux-spec.md` §5.3 |
| 7 | Active View | Pause Blocker Protection | Website Blocker remains strictly active during session pause. | Pause button click | Timer & sound paused; Blocker state set to `Still blocking` | Prevents user from pausing to browse blocked sites | `focus-session-ux-spec.md` §2, §5.3 |
| 8 | Active View | Stop Early Confirmation | Modal confirmation dialog before abandoning an active/paused session. | Stop Early button click | Confirmation dialog ("Keep focusing" vs "Stop session") | Closing dialog returns focus to session without abandoning | `focus-session-ux-spec.md` §4, §5.3 |
| 9 | Summary View | Explicit Task Completion Checkbox | Checkbox allowing user to mark the linked task completed upon focus finish. | User checkbox click | `tasks` storage updated to mark task complete | Optional action; task stays active if unchecked | `focus-session-ux-spec.md` §5.4 |
| 10 | Summary View | Optional Break Transition | Start optional break timer without incrementing completed session stats. | Start Break CTA | Break timer active, blocker disabled | Break timer expiration does not count as session completion | `focus-session-ux-spec.md` §5.4, §5.5 |
| 11 | Saved Sessions | Template CRUD Operations | List, edit, duplicate, and delete saved session templates. | Template actions | Updated `focusSessionTemplates` array | Delete requires confirmation modal | `focus-session-ux-spec.md` §5.6 |
| 12 | Saved Sessions | Template Snapshot Isolation | Runtime session copies template into immutable snapshot at start. | Template object | Immutable runtime snapshot | Editing/deleting template during active session does not affect runtime | `plan.md` Architecture Direction |
| 13 | Home View | Resume Card Override | Replaces Start Hero with Session Resume Card whenever active/paused session exists. | SW runtime status | Active session summary card with `RETURN TO SESSION` CTA | Prevents starting a second concurrent session | `focus-session-ux-spec.md` §5.1 |
| 14 | Progress | Daily Stats & Streak | Aggregates today's completed count, focus minutes, completion rate, and streak. | `focusSessionHistory` records | Stats display cards | Local calendar date grouping (midnight reset) | `focus-session-ux-spec.md` §7, `tasks/todo.md` T03 |
| 15 | SW Core | SW Restart Recovery | Recovers active/paused session state after Service Worker wake-up. | `activeFocusSession` storage | Recalculated state & alarm restoration | If `phaseEndsAt` passed while stopped, triggers exact-once completion | `focus-session-ux-spec.md` §10 |

---

### 3.2 Edge Cases Specification

| # | Feature | Input / Trigger Condition | Observed & Required System Behavior |
|---|---------|---------------------------|--------------------------------------|
| E-01 | Transactional Start | Blocker fails to enable (e.g. DNR error) after Pomodoro timer created. | Rollback timer operation, reset state to `idle`, remain on Setup screen, display component-specific error with retry/disable options. |
| E-02 | Service Worker Expiry | SW wakes up and finds `phaseEndsAt` timestamp is in the past. | Complete session immediately: write exactly one history record to `focusSessionHistory`, transition state to `focus_completed`, stop audio, update today stats. |
| E-03 | Corrupt Storage | `activeFocusSession` contains malformed or unparseable JSON schema. | Fail closed safely: preserve existing `blockedUrls`, stop session audio, clear `activeFocusSession`, transition state to `idle` with non-blocking user alert. |
| E-04 | Double Completion | Alarm fires AND user closes popup AND SW restarts simultaneously for same runtime ID. | Idempotency guard: `FocusSessionManager` checks `focusSessionHistory` by `runtimeId`. Second completion trigger is ignored. |
| E-05 | Popup Navigation | User clicks "Home" button while session is active. | View routes back to Home screen. Session timer, DNR blocking, and offscreen audio continue running without interruption in background. |
| E-06 | Empty Blocklist | User enables Website Blocker in setup, but `blockedUrls` contains 0 domains. | Display status `No sites configured` with link `Add sites`. Session starts without throwing DNR error. Blocker badge indicates `0 sites blocked`. |
| E-07 | Deleted Linked Task | Session linked to `taskId: 123`, but task was deleted from `tasks` storage before completion. | Focus Complete screen displays task text snapshot. Checking task completion degrades gracefully (skips storage mutation for missing ID). |
| E-08 | Template Editing During Active Session | User edits template `Study 50` while a session started from `Study 50` is active. | Active session continues using its immutable `snapshot`. Updated template settings apply only to future sessions. |
| E-09 | History Retention Limit | `focusSessionHistory` reaches 500 records or records older than 90 days exist. | Prune records older than 90 days or trim array beyond 500 items, summarizing daily totals before removal. |
| E-10 | Rapid Button Taps | User rapidly clicks "Start Session" or "Pause" multiple times. | Operations are serialized through background `operationQueue`. UI disables buttons while operation pending. |

---

## 4. The 7 Implementation Slices & TDD Specifications

The project execution plan is strictly structured into 7 sequential implementation slices. Every slice follows Test-Driven Development (Red-Green-Refactor).

```
Slice 1: Pure Session Domain (Core Logic & Transitions)
   │
   ▼
Slice 2: Background Orchestration (Manager, Storage, SW Recovery)
   │
   ▼
Slice 3: Client Contract & App Routing (Hooks, SW Messaging, Views)
   │
   ├───► Slice 4: Session Setup UI (Goal, Duration, Environment, Templates)
   │
   └───► Slice 5: Runtime UI (Active, Paused, Complete, Break)
   │
   ▼
Slice 6: Session-First Home & Progress (Resume Hero, Quick Tools, Stats)
   │
   ▼
Slice 7: Hardening & Release Verification (E2E Tests, Accessibility, Build)
```

---

### Slice 1 — Pure Session Domain
- **Primary Objective**: Implement pure data contracts, normalization, validation, state machine transitions, progress aggregation, and retention logic in isolation.
- **Target Files**:
  - `src/core/focusSession.js` (New implementation)
  - `tests/focusSession.test.js` (New unit test suite)
- **TDD Sequence & Unit Tests**:
  1. *Test 1.1 (Data Normalization)*: Verify `normalizeSessionSetup()` applies defaults (25m focus / 5m break), clamps focus duration between 5–120 mins, clamps break duration between 1–30 mins, normalizes goals (text <= 120 chars), and enforces max 1 ambient sound.
  2. *Test 1.2 (Template & Runtime Schemas)*: Verify `createRuntimeFromSetup()` creates a deep-cloned immutable snapshot and assigns unique `id` (uuid/nanoid), `startedAt`, and `status: "starting"`.
  3. *Test 1.3 (State Transitions)*: Verify `transitionFocusSession(state, event)` handles valid transitions (`idle -> starting -> active_focus -> paused_focus -> focus_completed -> active_break -> paused_break -> break_completed -> idle` and `abandoned`). Verify invalid events return unchanged state without throwing.
  4. *Test 1.4 (Completion Idempotency)*: Verify completing an active session with identical `runtimeId` multiple times yields identical completion state and does not create duplicate history items.
  5. *Test 1.5 (Progress Aggregation & Retention)*: Verify `aggregateDailyProgress(history, dateString)` calculates completed sessions, focus minutes, completion rate, and consecutive streak. Verify `pruneHistory(history)` enforces max 90 days / 500 items constraint.
- **Implementation Expectations**: Pure functions only. Zero DOM, Chrome API, or network dependencies. 100% deterministic test execution using `node --test tests/focusSession.test.js`.

---

### Slice 2 — Background Orchestration
- **Primary Objective**: Implement `FocusSessionManager` inside service worker (`src/background.js`) to coordinate Pomodoro timer, DNR Website Blocker, and Offscreen Audio API, with transactional rollback and SW restart recovery.
- **Target Files**:
  - `src/background.js` (Extended SW manager)
  - `src/core/focusSession.js`
  - `tests/backgroundFocusSession.test.js` (New integration test suite)
  - `tests/backgroundStartup.test.js` (SW startup test suite)
- **TDD Sequence & Unit Tests**:
  1. *Test 2.1 (Storage & Manager Init)*: Test `FocusSessionManager.init()` loads `activeFocusSession`, `focusSessionTemplates`, `focusSessionHistory`, and `focusSessionPreferences` from `chrome.storage.local`. Missing keys load safe empty defaults.
  2. *Test 2.2 (Transactional Start)*: Test start transaction: (a) captures pre-session state, (b) starts timer alarm, (c) enables DNR rules, (d) starts offscreen sound. Verify that if sound fails, timer alarm and DNR rules are rolled back in reverse order.
  3. *Test 2.3 (Pause & Resume Orchestration)*: Test pause stops timer alarm and offscreen sound, while leaving DNR blocker active. Test resume restores timer alarm (`phaseEndsAt`) and restarts offscreen sound.
  4. *Test 2.4 (Stop Early & Pre-Session Restoration)*: Test stop command clears alarm, stops offscreen sound, deactivates session DNR rules, restores pre-session `isBlocking` & `ambientSettings`, and writes `abandoned` history record.
  5. *Test 2.5 (Alarm Completion & Exact-Once Record)*: Test `chrome.alarms.onAlarm` listener triggers session completion, updates daily stats, stops sound, and writes exactly 1 completed history record.
  6. *Test 2.6 (SW Restart Recovery)*: Test SW restart with stored active session: recalculates remaining time from `phaseEndsAt`. If time expired while SW was idle, completes session immediately.
  7. *Test 2.7 (Template CRUD Commands)*: Test message handlers for template listing, saving, updating, duplicating, and deleting. Enforce name trimming and max 40 chars limit.
- **Implementation Expectations**: All background operations serialized through `operationQueue`. Response payload format: `{ success: true|false, state: {...}, error?: string }`. Mock Chrome APIs for deterministic testing (`node --test tests/backgroundFocusSession.test.js`).

---

### Slice 3 — Client Contract & Application Routing
- **Primary Objective**: Create React integration hooks and background messaging client, and configure client-side navigation routing.
- **Target Files**:
  - `src/hooks/useFocusSession.js` (New custom hook)
  - `src/core/focusSessionClient.js` (New client API wrapper)
  - `src/App.jsx` (Routing updates)
- **TDD Sequence & Unit Tests**:
  1. *Test 3.1 (Client State Hook)*: Test `useFocusSession` fetches initial state on mount, subscribes to `FOCUS_SESSION_STATE_UPDATE` runtime messages, and cleans up listeners on unmount.
  2. *Test 3.2 (Command Messaging)*: Test wrapper functions (`startSession`, `pauseSession`, `resumeSession`, `stopSession`, `finishSession`) send formatted runtime messages to SW.
  3. *Test 3.3 (Reopen Routing)*: Test `App.jsx` routing logic: if active or paused runtime session exists in state, default route automatically redirects to `ActiveFocusSession` screen.
- **Implementation Expectations**: React screens do **not** run an independent authoritative timer interval. State is driven strictly by SW messages.

---

### Slice 4 — Session Setup UI
- **Primary Objective**: Build the single scrollable setup view (`FocusSessionSetup.jsx`) with goal fields, duration controls, blocker/ambient toggles, and template actions.
- **Target Files**:
  - `src/pages/FocusSessionSetup.jsx` (New page)
  - `src/components/SessionGoalField.jsx` (New component)
  - `src/components/SessionDurationPicker.jsx` (New component)
  - `src/components/SessionEnvironment.jsx` (New component)
  - `src/components/VolumeSlider.jsx`, `src/components/NumberSlider.jsx`
- **TDD Sequence & Unit Tests**:
  1. *Test 4.1 (Goal Field & Task Picker)*: Verify text goal input (max 120 chars) and dropdown loading incomplete tasks from `tasks` storage.
  2. *Test 4.2 (Duration Picker)*: Test quick select buttons (15m, 25m, 50m) and custom duration range (5–120m) updating CTA text (`Start 25 Min Focus`).
  3. *Test 4.3 (Environment Controls)*: Test Website Blocker toggle displaying domain count & empty warning link. Test Ambient Sound single-select, preview button (auto-stops before start), and volume slider.
  4. *Test 4.4 (Start & Template Actions)*: Test Start button invoking background start command. Test Save as Template modal validating template name (max 40 chars).
- **Implementation Expectations**: Strict Carnival Neo-Brutalist styling. Quick session runnable in <=2 clicks from Home.

---

### Slice 5 — Runtime and Completion UI
- **Primary Objective**: Implement the active session timer, paused state view, stop early modal, completion summary screen, linked task confirmation, and break timer screens.
- **Target Files**:
  - `src/pages/ActiveFocusSession.jsx` (New page)
  - `src/pages/FocusSessionComplete.jsx` (New page)
  - `src/components/SessionTimer.jsx` (New component)
  - `src/components/SessionStatus.jsx` (New component)
  - `src/components/ConfirmDialog.jsx` (New component)
- **TDD Sequence & Unit Tests**:
  1. *Test 5.1 (Active Timer & Status)*: Test `SessionTimer` displaying formatted `MM:SS` countdown with `role="timer"`. Test status badges (`BLOCKING 8 SITES`, `RAIN · 40%`).
  2. *Test 5.2 (Paused State & Blocker Badge)*: Test Paused UI displaying `Still blocking` badge and `Resume Focus` primary CTA.
  3. *Test 5.3 (Stop Early Modal)*: Test Stop Early button opening `ConfirmDialog` with focus trapping and keyboard navigation. Confirming dispatches stop command and redirects Home.
  4. *Test 5.4 (Focus Complete Screen)*: Test completion summary showing stats ("25 MIN", "TODAY: X SESSIONS"), `[ ] MARK LINKED TASK COMPLETE` checkbox, `Start Break` CTA, and `Finish for Now` CTA.
  5. *Test 5.5 (Break View)*: Test break active screen showing countdown, disabled blocker indicator, `Skip Break` action, and break completion view.
- **Implementation Expectations**: Timer display updates smoothly without screen reader spam. Zero scroll needed for active view at 400x600px.

---

### Slice 6 — Session-First Home, Templates and Progress
- **Primary Objective**: Restructure `Home.jsx` to prioritize Focus Session actions over feature cards, add saved sessions shortcuts, and implement template management.
- **Target Files**:
  - `src/pages/Home.jsx` (Redesigned page)
  - `src/pages/SavedSessions.jsx` (New management page)
  - `src/components/SavedSessionCard.jsx` (New component)
  - `src/components/TodayFocusStats.jsx` (New component)
  - `src/components/QuickTools.jsx` (New component)
- **TDD Sequence & Unit Tests**:
  1. *Test 6.1 (Home Resume Card Priority)*: Test Home rendering Active Session Resume Card if session active/paused; otherwise render `Start Focus Session` hero CTA.
  2. *Test 6.2 (Today Stats Display)*: Test rendering today's completed sessions count and focus minutes.
  3. *Test 6.3 (Quick Tools Grid)*: Test rendering grid links for standalone tools (Timer, Tasks, Blocker, Sounds).
  4. *Test 6.4 (Saved Sessions CRUD)*: Test template cards, template launch (opens prefilled setup without auto-starting), edit modal, duplicate, and delete confirmation modal.
- **Implementation Expectations**: Four legacy oversized feature cards removed from Home. Daily Quote moved below fold.

---

### Slice 7 — Hardening and Release Verification
- **Primary Objective**: Comprehensive testing, accessibility audit, Chrome DevTools verification, viewport testing, and documentation updates.
- **Target Files**:
  - All test files (`tests/*.test.js`)
  - `README.md`
- **Verification Commands & Steps**:
  1. Run `npm test` (All unit and background integration tests pass).
  2. Run `npm run lint` (0 warnings, 0 errors).
  3. Run `npm run build` (Vite extension build completes cleanly).
  4. Run `npx prettier --check .` (Code formatting clean).
  5. Perform Chrome DevTools runtime audit: verify Quick Session start, popup close/reopen state preservation, service worker wake-up recovery, DNR blocking persistence during pause, and offscreen audio playback.
  6. Verify accessibility: full keyboard navigation, visible focus rings, ARIA roles (`role="timer"`), color contrast compliance.
  7. Verify responsive layout: 360px, 400px, 480px popup viewports.

---

## 5. Design System Constraints (Carnival Neo-Brutalist Theme)

All new screens, components, buttons, inputs, cards, and modals **must strictly conform** to the Carnival Neo-Brutalist design language established in `DESIGN.md`.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CARNIVAL NEO-BRUTALISM                          │
├────────────────────────────────────────────────────────────────────────┤
│ • Background: Canvas #f2e9e1  • Borders: Thick 3px Solid Ink #0d0c0c   │
│ • Paper: Pure White #ffffff   • Shadows: Hard 4px Offsets (No Soft Blur)│
│ • Accent 1: Mustard #eeba0b   • Halftone: Ink Dots / White Radial Dots │
│ • Accent 2: Crimson #9e1414   • Typography: Anton (Display),           │
│ • Accent 3: Sapphire #1e3a8a                  Outfit (Sans Body),      │
│ • Accent 4: Emerald #147a42                   JetBrains Mono (Mono)    │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Color Tokens & Semantic Assignments

| Token Name | CSS Variable | Hex Value | Semantic Usage in Focus Session |
|---|---|---|---|
| **Canvas** | `--color-canvas` | `#f2e9e1` | Main extension background (warm pale peach). |
| **Ink** | `--color-ink` | `#0d0c0c` | Primary text, 3px solid borders, and 4px hard offset shadows. |
| **Paper** | `--color-paper` | `#ffffff` | Background for cards, inputs, modals, and container boxes. |
| **Mustard** | `--color-mustard` | `#eeba0b` | Pomodoro Timer module, primary `Start Focus Session` hero CTA, active timer container. |
| **Crimson** | `--color-crimson` | `#9e1414` | Website Blocker module, `Stop Early` button, blocked status badge, destructive confirmations. |
| **Sapphire** | `--color-sapphire` | `#1e3a8a` | Task List module, task goal picker, secondary `Save Template` actions. |
| **Emerald** | `--color-emerald` | `#147a42` | Ambient Sounds module, enabled component status pills, session completed confirmation. |

---

### 5.2 Typography System

- **Display (`font-display`)**: `Anton`, `Impact`, `sans-serif`
  - Usage: Oversized page titles (`text-5xl` to `text-7xl`), massive CTA button text, timer numbers. Always `uppercase leading-none`.
- **Body (`font-sans`)**: `Outfit`, `system-ui`, `sans-serif`
  - Usage: Description text, paragraph copy, labels, modal body text.
- **Monospace (`font-mono`)**: `JetBrains Mono`, `monospace`
  - Usage: Countdown timer display (`18:42`), status pills (`BLOCKING 8 SITES`), tags, metadata, utility text. Always styled as `font-bold uppercase tracking-widest`.

---

### 5.3 Structural Elements & Styling Classes

- **Thick Borders**: `.brutal-border` -> `border-[3px] border-[#0d0c0c]`
- **Hard Offset Shadow**: `.brutal-shadow` -> `shadow-[4px_4px_0px_0px_#0d0c0c]`
- **Small Hard Shadow**: `.brutal-shadow-sm` -> `shadow-[2px_2px_0px_0px_#0d0c0c]`
- **Halftone Patterns**:
  - `.halftone-dark`: Dotted ink radial gradient overlay on light/mustard cards.
  - `.halftone-light`: Dotted white radial gradient overlay on dark cards (Crimson, Sapphire, Emerald).
- **Tactile Interaction / Motion**:
  - **Hover (`:hover`)**: `hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_0px_#0d0c0c]`
  - **Active Click (`:active`)**: `active:translate-x-[4px] active:translate-y-[4px] active:shadow-none` (simulates physical mechanical switch press).

---

### 5.4 Component Styling Specifications

- **Status Badges & Pills**: Solid fill (Emerald/Crimson/Mustard), 3px ink border, 2px hard shadow, JetBrains Mono font bold uppercase.
- **Form Inputs & Sliders**: Paper white background, 3px ink border, 2px hard shadow. Sliders use square thumbs and solid fill progress bars.
- **Confirmation Modals**: Oversized Paper box centered with 3px ink border, 6px hard shadow, dark overlay, Crimson destructive button, Ink outline cancel button.
- **Strict Anti-Patterns**:
  - ❌ NO rounded corners (`rounded-md`, `rounded-lg`, `rounded-full` except status dots).
  - ❌ NO soft drop shadows (`shadow-md`, `shadow-lg`, `blur-*`).
  - ❌ NO color gradients or translucent overlays.

---

## 6. Interface Contracts & Storage Specifications

### 6.1 Storage Keys Contract

```text
Chrome Storage Local (chrome.storage.local)
├── activeFocusSession          (Runtime Session Object | null)
├── focusSessionTemplates       (Array<TemplateObject>)
├── focusSessionHistory         (Array<HistoryRecordObject>)
├── focusSessionPreferences     (UserPreferenceObject)
├── tasks                       (PRESERVED: Array<TaskItem>)
├── blockedUrls                 (PRESERVED: Array<String>)
├── isBlocking                  (PRESERVED: Boolean)
├── ambientSettings             (PRESERVED: Object)
├── pomodoroSettings            (PRESERVED: Object)
└── pomodoroState               (PRESERVED: Object)
```

---

### 6.2 Data Schemas

#### 1. Template Schema (`TemplateObject`)
```ts
interface TemplateObject {
  id: string;                      // Unique ID (UUID/nanoid)
  name: string;                    // Max 40 chars, trimmed
  focusDuration: number;           // Minutes (5-120)
  breakDuration: number;           // Minutes (1-30)
  goal: {
    type: "text" | "task";
    text: string;                  // Max 120 chars
    taskId?: string | number;      // Optional reference to tasks item
  };
  blocker: {
    enabled: boolean;
    presetId: string;              // MVP defaults to "default"
  };
  ambientSound: {
    enabled: boolean;
    soundId: string | null;        // At most 1 sound ID in MVP (e.g. "rain")
    volume: number;                // 0 to 100
  };
  createdAt: number;               // Unix timestamp (ms)
  updatedAt: number;               // Unix timestamp (ms)
}
```

#### 2. Runtime Session Schema (`RuntimeSession`)
```ts
interface RuntimeSession {
  id: string;                      // Unique runtime instance ID
  templateId: string | null;       // Reference to template if started from one
  snapshot: TemplateObject;        // Immutable snapshot of setup configuration
  goal: {
    type: "text" | "task";
    text: string;
    taskId?: string | number;
  };
  phase: "focus" | "break";        // Current active phase
  status:                          // Current status in state machine
    | "starting"
    | "active"
    | "paused"
    | "focus_completed"
    | "break_completed"
    | "abandoned";
  startedAt: number;               // Unix timestamp (ms)
  phaseEndsAt: number | null;      // Target completion timestamp (ms) or null if paused
  remainingSeconds: number;        // Seconds remaining (authoritative when paused)
  preSessionState: {               // Captured to restore independent tools on stop/finish
    isBlocking: boolean;
    ambientSettings: object;
    pomodoroState: object;
  };
  completedAt: number | null;      // Unix timestamp when focus timer reached 0
}
```

#### 3. History Record Schema (`HistoryRecordObject`)
```ts
interface HistoryRecordObject {
  id: string;                      // History record ID
  runtimeId: string;               // Unique runtime session ID (for idempotency)
  templateId: string | null;
  name: string;                    // Template name or goal text
  focusDuration: number;           // Configured focus minutes
  actualFocusMinutes: number;      // Actual elapsed focus minutes
  goalText: string;
  startedAt: number;               // Timestamp ms
  endedAt: number;                 // Timestamp ms
  status: "completed" | "abandoned";
  dateString: string;              // Local calendar date ("YYYY-MM-DD")
}
```

---

### 6.3 Background Message Protocol

All messages sent via `chrome.runtime.sendMessage` between React UI and Background Service Worker follow this standard format:

#### Client Command Message Format
```ts
interface ServiceWorkerCommand {
  type:
    | "FOCUS_SESSION_GET_STATE"
    | "FOCUS_SESSION_START"
    | "FOCUS_SESSION_PAUSE"
    | "FOCUS_SESSION_RESUME"
    | "FOCUS_SESSION_STOP"
    | "FOCUS_SESSION_START_BREAK"
    | "FOCUS_SESSION_SKIP_BREAK"
    | "FOCUS_SESSION_FINISH"
    | "FOCUS_SESSION_UPDATE_VOLUME"
    | "FOCUS_SESSION_TEMPLATE_LIST"
    | "FOCUS_SESSION_TEMPLATE_SAVE"
    | "FOCUS_SESSION_TEMPLATE_UPDATE"
    | "FOCUS_SESSION_TEMPLATE_DUPLICATE"
    | "FOCUS_SESSION_TEMPLATE_DELETE"
    | "FOCUS_SESSION_PROGRESS_GET";
  payload?: any;
}
```

#### Service Worker Response Format
```ts
interface ServiceWorkerResponse {
  success: boolean;
  state?: {
    activeSession: RuntimeSession | null;
    templates: TemplateObject[];
    todayStats: {
      completedSessions: number;
      focusMinutes: number;
      completionRate: number;
      streakDays: number;
    };
  };
  error?: string;
}
```

#### Background Event Broadcast Format (`FOCUS_SESSION_STATE_UPDATE`)
When background runtime state changes, Service Worker broadcasts to all open extension popups:
```ts
interface StateUpdateBroadcast {
  type: "FOCUS_SESSION_STATE_UPDATE";
  state: ServiceWorkerResponse["state"];
}
```

---

## 7. Verification & Definition of Done Matrix

To ensure full compliance with `ORIGINAL_REQUEST.md`, `focus-session-ux-spec.md`, `tasks/plan.md`, and `tasks/todo.md`, all verification steps must pass before release:

| Verification Axis | Test Command / Method | Success Criteria |
|---|---|---|
| **Unit & Integration Tests** | `npm test` | 100% tests pass across `focusSession.test.js`, `backgroundFocusSession.test.js`, `backgroundStartup.test.js`, and legacy test files. |
| **Linting** | `npm run lint` | 0 warnings, 0 errors. |
| **Build Compilation** | `npm run build` | Vite build succeeds, outputting Chrome MV3 extension bundle in `dist/`. |
| **Code Formatting** | `npx prettier --check .` | All source files adhere to project formatting standards. |
| **Functional E2E** | Chrome Extension Runtime Walkthrough | Quick session starts in <=2 actions; state survives popup close/reopen; Service Worker wake-up recalculates time; Blocker stays active during pause; history recorded exactly once per runtime ID. |
| **Design Integrity** | Visual Inspection | 100% compliant with Neo-Brutalist theme (`DESIGN.md`). Thick borders, hard offset shadows, Anton headings, JetBrains Mono labels, zero soft rounded corners or gradients. |

---
*End of Specification Analysis Report.*
