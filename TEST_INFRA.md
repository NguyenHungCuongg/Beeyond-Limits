# Test Infrastructure: Focus Session E2E Test Suite

Status: **Published — 2026-07-27**  
Target: Beeyond Limits Chrome Extension — Focus Session MVP  
Runner: Node built-in test runner (`node:test`, `node:assert/strict`)

---

## 1. Architecture Overview

The Focus Session E2E test infrastructure provides end-to-end opaque-box verification for the Chrome V3 extension background service worker, storage schema, alarms timing, feature interlocking, and UI message protocol.

```text
┌────────────────────────────────────────────────────────┐
│                   React 19 UI Views                    │
│      (Home, FocusSetup, FocusActive, FocusSummary)     │
└───────────────────────────┬────────────────────────────┘
                            │ chrome.runtime.sendMessage(...)
                            ▼
┌────────────────────────────────────────────────────────┐
│       Focus Session Background Engine & Manager        │
│          (Authoritative State Machine & Queue)         │
├───────────────┬────────────────┬───────────────────────┤
│ Pomodoro      │ Blocker (DNR)  │ Ambient Sound         │
│ Interlock     │ Rule Engine    │ Offscreen Audio       │
└───────────────┴────────────────┴───────────────────────┘
                            │ chrome.storage.local
                            ▼
┌────────────────────────────────────────────────────────┐
│           Chrome Extension Storage Persistence          │
│   (activeFocusSession, templates, history, preferences)│
└────────────────────────────────────────────────────────┘
```

---

## 2. 4-Tier Testing Methodology

The test suite in `tests/focusE2E.test.js` is structured into 4 comprehensive verification tiers:

### Tier 1: Feature Coverage (Happy Path)
- **State Machine Happy Path**: Validates lifecycle state transitions: `idle` -> `starting` -> `active_focus` -> `paused_focus` -> `active_focus` -> `focus_completed` -> `active_break` -> `break_completed` -> `idle`.
- **Quick Start (25m Focus / 5m Break)**: Validates starting a session from Home in <= 2 actions with zero configuration.
- **Custom Duration Configuration**: Validates custom duration inputs (e.g., 50m focus, 10m break).
- **Task Selection Integration**: Validates linking an active task to focus session setup and capturing snapshot.
- **Ambient Sound Selection**: Validates selecting an ambient sound track with volume scaling (enforces max 1 sound).
- **Website Blocker Toggle**: Validates independent toggle control over site blocking during setup.

### Tier 2: Boundary & Corner Cases
- **Invalid Duration Normalization**: Clamps focus duration to 5m–120m and break duration to 1m–30m.
- **Zero Remaining Time Boundary**: Verifies transition to `focus_completed` when countdown hits 0s.
- **Service Worker Expired Restart**: Recovers phase state when service worker wakes up after phase completion timestamp has passed.
- **Pausing at 0s Boundary**: Prevents invalid pause commands when session timer has expired.
- **Fast Resume / Pause Toggles**: Exercises operation queue serialization to ensure race condition immunity.
- **Missing Storage Keys**: Ensures safe fallback initialization when storage keys are absent or corrupt.

### Tier 3: Cross-Feature Interactions
- **Focus Session + Pomodoro Interlock**: Rejects starting Focus Session while independent Pomodoro is active to prevent timer collision.
- **Focus Session + Website Blocker DNR Coordination**: Retains active DNR blocking rules while focus session is paused ("Still blocking").
- **Focus Session + Ambient Sound Offscreen Bridge**: Sends audio commands (`START_AMBIENT_SOUND`, `STOP_AMBIENT_SOUND`) over offscreen bridge and restores pre-session settings.
- **Focus Session + Task List Explicit Completion**: Guarantees linked tasks are NOT automatically completed; requires explicit user action.

### Tier 4: Real-World Workload Scenarios
- **Full 25m Focus Session Workload Flow**: Complete end-to-end scenario covering setup -> active -> pause -> resume -> focus completion -> break -> break completion -> finish return home.
- **Idempotent History & Progress Logging**: Guarantees completed focus sessions are logged exactly once per runtime ID regardless of duplicate alarms or service worker restarts.

---

## 3. Chrome Runtime Mock Environment

The test suite utilizes a high-fidelity lightweight Chrome API harness (`createE2EEnvironment`) that emulates MV3 browser APIs deterministically without external dependencies:

| Chrome API | E2E Mock Capability |
|------------|---------------------|
| `chrome.storage.local` | In-memory key-value store supporting async `get`, `set`, `remove`, and `clear`. |
| `chrome.alarms` | Microtask-driven alarm scheduler supporting `create`, `clear`, `get`, and `triggerAlarm`. |
| `chrome.declarativeNetRequest` | Dynamic rules engine tracking active blocking rules by ID and domain. |
| `chrome.runtime` | Message bus delivering messages to `onMessage` listeners with async response handling. |
| `chrome.notifications` | Notification stub capturing system alert creation calls. |
| `chrome.offscreen` | Bridge stub recording offscreen document operations. |

---

## 4. Test Execution Instructions

Run full project test suite (including unit and E2E tests):
```bash
npm test
```

Run focus session E2E tests specifically:
```bash
node --test tests/focusE2E.test.js
```
