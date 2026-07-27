# Milestone 1: Core Domain Model & Types — Analysis & Specification

**Author**: Milestone 1 Domain Explorer  
**Target Module**: `src/core/focusSession.js`  
**Target Test Suite**: `tests/focusSession.test.js`  
**Date**: 2026-07-27  

---

## 1. Executive Summary

Milestone 1 (Slice 1: Pure Session Domain) establishes the domain foundation for Beeyond Limits' Focus Session feature. It encompasses data contract definitions, schema normalization, pure state transition functions, time/progress calculators, invariant validation, daily progress aggregation, and history retention rules. 

This analysis provides the complete design, interface specification, state transition rules, and TDD test suite plan for `src/core/focusSession.js` and `tests/focusSession.test.js`.

---

## 2. Core Domain Model Design (`src/core/focusSession.js`)

### 2.1 Enums & Constants

```js
export const FOCUS_STATES = Object.freeze({
  IDLE: "idle",
  ACTIVE_FOCUS: "active_focus",
  PAUSED_FOCUS: "paused_focus",
  FOCUS_COMPLETED: "focus_completed",
  ACTIVE_BREAK: "active_break",
  PAUSED_BREAK: "paused_break",
  BREAK_COMPLETED: "break_completed",
  ABANDONED: "abandoned",
});

export const FOCUS_PHASES = Object.freeze({
  FOCUS: "focus",
  BREAK: "break",
});

export const FOCUS_BOUNDS = Object.freeze({
  MIN_FOCUS_MINUTES: 5,
  MAX_FOCUS_MINUTES: 120,
  DEFAULT_FOCUS_MINUTES: 25,
  MIN_BREAK_MINUTES: 1,
  MAX_BREAK_MINUTES: 30,
  DEFAULT_BREAK_MINUTES: 5,
  MAX_GOAL_LENGTH: 120,
  MAX_TEMPLATE_NAME_LENGTH: 40,
  MAX_HISTORY_DAYS: 90,
  MAX_HISTORY_RECORDS: 500,
});

export const DEFAULT_FOCUS_SETTINGS = Object.freeze({
  focusDuration: FOCUS_BOUNDS.DEFAULT_FOCUS_MINUTES,
  breakDuration: FOCUS_BOUNDS.DEFAULT_BREAK_MINUTES,
  blockerEnabled: true,
  ambientSound: Object.freeze({
    enabled: false,
    soundId: null,
    volume: 50,
  }),
});

export const DEFAULT_TEMPLATES = Object.freeze([
  Object.freeze({
    id: "template_quick_25",
    name: "Pomodoro 25",
    focusDuration: 25,
    breakDuration: 5,
    goal: Object.freeze({ type: "text", text: "", taskId: null }),
    blocker: Object.freeze({ enabled: true, presetId: "default" }),
    ambientSound: Object.freeze({ enabled: false, soundId: null, volume: 50 }),
    isDefault: true,
  }),
  Object.freeze({
    id: "template_deep_50",
    name: "Deep Work 50",
    focusDuration: 50,
    breakDuration: 10,
    goal: Object.freeze({ type: "text", text: "", taskId: null }),
    blocker: Object.freeze({ enabled: true, presetId: "default" }),
    ambientSound: Object.freeze({ enabled: false, soundId: null, volume: 50 }),
    isDefault: true,
  }),
  Object.freeze({
    id: "template_sprint_15",
    name: "Quick Sprint 15",
    focusDuration: 15,
    breakDuration: 3,
    goal: Object.freeze({ type: "text", text: "", taskId: null }),
    blocker: Object.freeze({ enabled: true, presetId: "default" }),
    ambientSound: Object.freeze({ enabled: false, soundId: null, volume: 50 }),
    isDefault: true,
  }),
]);
```

---

### 2.2 Data Schemas

#### 1. Template Schema (`focusSessionTemplates`)
```js
{
  id: "template_1722080000000_abc12", // string
  name: "Study Session",             // string (1..40 chars)
  focusDuration: 25,                  // number (5..120)
  breakDuration: 5,                   // number (1..30)
  goal: {
    type: "text",                     // "text" | "task"
    text: "Read Chapter 4",           // string (0..120 chars)
    taskId: null                      // string | number | null
  },
  blocker: {
    enabled: true,                    // boolean
    presetId: "default"               // string
  },
  ambientSound: {
    enabled: true,                    // boolean
    soundId: "rain",                  // string | null
    volume: 40                        // number (0..100)
  },
  isDefault: false,                   // boolean
  createdAt: 1722080000000,           // timestamp ms
  updatedAt: 1722080000000            // timestamp ms
}
```

#### 2. Active Session Schema (`activeFocusSession`)
```js
{
  id: "session_1722081000000_xyz99",  // string (unique runtime ID)
  schemaVersion: 1,                   // number
  templateId: "template_quick_25",    // string | null
  snapshot: { ...templateOrConfig },  // immutable snapshot of start configuration
  goal: {
    type: "task",
    text: "Complete API Specs",
    taskId: 42
  },
  phase: "focus",                     // "focus" | "break"
  status: "active_focus",             // value from FOCUS_STATES
  startedAt: 1722081000000,           // timestamp ms
  phaseStartedAt: 1722081000000,      // timestamp ms
  phaseEndsAt: 1722082500000,         // timestamp ms | null (null when paused)
  durationSeconds: 1500,              // number (focusDuration * 60)
  remainingSeconds: 1500,             // number (seconds remaining when paused/cached)
  completedAt: null,                  // timestamp ms | null
  abandonedAt: null,                  // timestamp ms | null
  abandonReason: null,                // string | null
  preSessionState: null               // captured background state for rollback/restoration
}
```

#### 3. History Record Schema (`focusSessionHistory`)
```js
{
  id: "history_1722082500000_123",    // string
  runtimeId: "session_1722081000000_xyz99", // string (prevents duplicates)
  templateId: "template_quick_25",
  goal: { type: "task", text: "Complete API Specs", taskId: 42 },
  focusDurationMinutes: 25,
  actualFocusSeconds: 1500,
  status: "focus_completed",          // "focus_completed" | "abandoned"
  startedAt: 1722081000000,
  endedAt: 1722082500000,
  dateStr: "2026-07-27",              // YYYY-MM-DD local date string
  abandonReason: null
}
```

---

### 2.3 Pure Domain Functions Specification

#### `normalizeFocusConfig(config)`
Normalizes raw input configuration object, applying strict defaults and clamping bounds.
- **Duration Normalization**: Clamps `focusDuration` between 5 and 120 (fallback 25 if non-numeric). Clamps `breakDuration` between 1 and 30 (fallback 5).
- **Goal Normalization**: Truncates `text` to 120 chars. Sets `type` to `"task"` if valid `taskId` is provided, else `"text"`.
- **Blocker Normalization**: `enabled` as boolean, `presetId` defaults to `"default"`.
- **Ambient Sound Normalization**: `enabled` as boolean, `volume` clamped [0, 100], `soundId` normalized to string or `null`. (Enforces at most one ambient sound track).

#### `createFocusSession(config, nowTimestamp = Date.now())`
Creates a brand new `activeFocusSession` runtime object.
- **Parameters**: `config` (partial or full config), `nowTimestamp` (number ms).
- **Behavior**:
  - Calls `normalizeFocusConfig(config)`.
  - Generates immutable snapshot from normalized config.
  - Sets `status` to `FOCUS_STATES.ACTIVE_FOCUS`.
  - Sets `phase` to `FOCUS_PHASES.FOCUS`.
  - Sets `durationSeconds` to `focusDuration * 60`.
  - Sets `startedAt` & `phaseStartedAt` to `nowTimestamp`.
  - Sets `phaseEndsAt` to `nowTimestamp + durationSeconds * 1000`.
  - Sets `remainingSeconds` to `durationSeconds`.

#### `pauseFocusSession(session, nowTimestamp = Date.now())`
Transitions an active session into paused state.
- **Preconditions / Invariants**: Session must be in `ACTIVE_FOCUS` or `ACTIVE_BREAK`. If not, returns session unmodified.
- **Behavior**:
  - Calculates remaining seconds: `calculateRemainingSeconds(session, nowTimestamp)`.
  - If phase is `FOCUS`: sets `status` to `FOCUS_STATES.PAUSED_FOCUS`.
  - If phase is `BREAK`: sets `status` to `FOCUS_STATES.PAUSED_BREAK`.
  - Sets `remainingSeconds` to computed remaining value.
  - Sets `phaseEndsAt` to `null`.

#### `resumeFocusSession(session, nowTimestamp = Date.now())`
Resumes a paused focus or break session.
- **Preconditions / Invariants**: Session must be in `PAUSED_FOCUS` or `PAUSED_BREAK`. If not, returns session unmodified.
- **Behavior**:
  - Computes new phase end time: `nowTimestamp + (session.remainingSeconds * 1000)`.
  - If phase is `FOCUS`: sets `status` to `FOCUS_STATES.ACTIVE_FOCUS`.
  - If phase is `BREAK`: sets `status` to `FOCUS_STATES.ACTIVE_BREAK`.
  - Sets `phaseEndsAt` to computed end time.

#### `calculateRemainingSeconds(session, nowTimestamp = Date.now())`
Calculates remaining seconds for display or countdown without mutating session state.
- **Behavior**:
  - If session is `null` / `undefined`: returns `0`.
  - If status is `PAUSED_FOCUS` or `PAUSED_BREAK`: returns `Math.max(0, session.remainingSeconds || 0)`.
  - If status is `ACTIVE_FOCUS` or `ACTIVE_BREAK`:
    - If `!session.phaseEndsAt`: returns `0`.
    - Returns `Math.max(0, Math.ceil((session.phaseEndsAt - nowTimestamp) / 1000))`.
  - If status is terminal (`FOCUS_COMPLETED`, `BREAK_COMPLETED`, `ABANDONED`, `IDLE`): returns `0`.

#### `calculateProgressPercentage(session, nowTimestamp = Date.now())`
Calculates completion progress percentage (0.0 to 100.0) for the current phase.
- **Formula**: `((totalDuration - remainingSeconds) / totalDuration) * 100`.
- **Behavior**:
  - Clamped strictly between `0.0` and `100.0`.
  - Returns `100.0` if status is completed/abandoned.
  - Safely handles `totalDuration <= 0` returning `0.0`.

#### `isSessionExpired(session, nowTimestamp = Date.now())`
Checks whether the active phase countdown has reached or passed zero.
- **Behavior**:
  - Returns `true` IF status is `ACTIVE_FOCUS` or `ACTIVE_BREAK` AND `session.phaseEndsAt !== null` AND `nowTimestamp >= session.phaseEndsAt`.
  - Returns `false` otherwise.

#### `completeFocusSession(session, nowTimestamp = Date.now())`
Transitions a focus or break phase to its completed state.
- **Idempotency Rule**: If session is already `FOCUS_COMPLETED` or `BREAK_COMPLETED`, returns the session unchanged without updating `completedAt`.
- **Behavior**:
  - If in focus phase (`ACTIVE_FOCUS` or `PAUSED_FOCUS`):
    - Sets `status` to `FOCUS_STATES.FOCUS_COMPLETED`.
    - Sets `completedAt` to `nowTimestamp`.
    - Sets `remainingSeconds` to `0`, `phaseEndsAt` to `null`.
  - If in break phase (`ACTIVE_BREAK` or `PAUSED_BREAK`):
    - Sets `status` to `FOCUS_STATES.BREAK_COMPLETED`.
    - Sets `remainingSeconds` to `0`, `phaseEndsAt` to `null`.

#### `abandonFocusSession(session, reason = "user_stopped", nowTimestamp = Date.now())`
Abandons an active or paused session early.
- **Preconditions**: Cannot abandon an already completed or idle session.
- **Behavior**:
  - Sets `status` to `FOCUS_STATES.ABANDONED`.
  - Sets `abandonedAt` to `nowTimestamp`.
  - Sets `abandonReason` to string `reason`.
  - Sets `phaseEndsAt` to `null`.

#### `startBreakSession(session, durationMinutes = null, nowTimestamp = Date.now())`
Starts the break phase after focus completion.
- **Preconditions**: Can ONLY be invoked when session status is `FOCUS_COMPLETED` or `BREAK_COMPLETED`.
- **Behavior**:
  - Break duration determined by `durationMinutes` (clamped 1..30) or snapshot's `breakDuration`.
  - Sets `phase` to `FOCUS_PHASES.BREAK`.
  - Sets `status` to `FOCUS_STATES.ACTIVE_BREAK`.
  - Sets `durationSeconds` to `breakMinutes * 60`.
  - Sets `phaseStartedAt` to `nowTimestamp`.
  - Sets `phaseEndsAt` to `nowTimestamp + durationSeconds * 1000`.
  - Sets `remainingSeconds` to `durationSeconds`.

---

### 2.4 Daily Progress Aggregation & History Retention

#### `aggregateDailyProgress(historyRecords = [], targetDateStr = null)`
Aggregates completed sessions and total focus minutes for a local date string (format `YYYY-MM-DD`).
- **Logic**:
  - Filters records matching `targetDateStr` (or today if `null`).
  - `completedSessions`: Count of records where `status === FOCUS_STATES.FOCUS_COMPLETED`.
  - `focusMinutes`: Sum of `focusDurationMinutes` (or `Math.round(actualFocusSeconds / 60)`) for `FOCUS_COMPLETED` records.
  - `abandonedSessions`: Count of records where `status === FOCUS_STATES.ABANDONED`.
  - `completionRate`: `completedSessions / (completedSessions + abandonedSessions)` (0.0 to 1.0, or 0 if 0 total).
  - Note: **Break sessions do NOT increment completed sessions or focus minutes.**

#### `calculateStreakDays(historyRecords = [], referenceDateStr = null)`
Calculates consecutive days with at least 1 completed focus session up to `referenceDateStr`.

#### `pruneHistoryRecords(historyRecords = [], maxDays = 90, maxRecords = 500, nowTimestamp = Date.now())`
Enforces history retention limits.
- Filters out records older than `maxDays` (90 days).
- Truncates resulting array to at most `maxRecords` (500 newest records).

#### `isDuplicateCompletion(historyRecords = [], runtimeId)`
Returns `true` if `historyRecords` already contains a completion record with `runtimeId === runtimeId`. Used by background service worker to guarantee idempotent completion recording.

---

## 3. TDD Test Specification (`tests/focusSession.test.js`)

The test suite must be written using Node's built-in test runner (`node:test`) and strict assertions (`node:assert/strict`).

### Test Suite Structure

```
tests/focusSession.test.js
├── Suite 1: Enums & Default Configurations
├── Suite 2: Configuration Normalization & Validation
├── Suite 3: Session Creation (createFocusSession)
├── Suite 4: State Machine Transitions (Pause, Resume, Expiry)
├── Suite 5: Calculation Helpers (Remaining Seconds, Progress %, Expiry)
├── Suite 6: Focus Completion & Idempotency
├── Suite 7: Break Session Flow
├── Suite 8: Abandonment Flow
├── Suite 9: Daily Progress Aggregation & Streak Calculation
└── Suite 10: History Retention & Duplicate Check
```

### Detailed Test Case Specs

#### Suite 1: Enums & Default Configurations
1. **`FOCUS_STATES` enum integrity**:
   - Assert `FOCUS_STATES` contains all 8 required states: `idle`, `active_focus`, `paused_focus`, `focus_completed`, `active_break`, `paused_break`, `break_completed`, `abandoned`.
   - Assert `FOCUS_STATES` is frozen (`Object.isFrozen`).
2. **`DEFAULT_FOCUS_SETTINGS` & `DEFAULT_TEMPLATES`**:
   - Assert default focus duration is `25` minutes and break duration is `5` minutes.
   - Assert `DEFAULT_TEMPLATES` contains 3 preset templates (25m, 50m, 15m).

#### Suite 2: Configuration Normalization (`normalizeFocusConfig`)
3. **Valid config normalization**:
   - Given custom valid `focusDuration: 50`, `breakDuration: 10`, returns normalized object preserving these values.
4. **Out-of-bounds duration clamping**:
   - Given `focusDuration: 2` (below 5), clamps to `5`.
   - Given `focusDuration: 180` (above 120), clamps to `120`.
   - Given `breakDuration: 0` (below 1), clamps to `1`.
   - Given `breakDuration: 45` (above 30), clamps to `30`.
   - Given non-numeric or NaN values, falls back to default (`25` and `5`).
5. **Goal text normalization & truncation**:
   - Given text > 120 chars, truncates string to exactly 120 chars.
   - Given valid `taskId`, sets `type: "task"`. Given no `taskId`, sets `type: "text"`.
6. **Ambient sound normalization**:
   - Given `volume: 150`, clamps volume to `100`. Given `volume: -10`, clamps to `0`.
   - Ensures sound configuration only contains a single `soundId` string.

#### Suite 3: Session Creation (`createFocusSession`)
7. **Basic creation timestamps and state**:
   - Given `nowTimestamp = 1000000` and `focusDuration = 25`, creates session with:
     - `status: "active_focus"`
     - `phase: "focus"`
     - `startedAt: 1000000`
     - `phaseStartedAt: 1000000`
     - `phaseEndsAt: 1000000 + 25 * 60 * 1000` (1500000)
     - `durationSeconds: 1500`
     - `remainingSeconds: 1500`
8. **Template separation / immutability**:
   - Verify mutating input template object after `createFocusSession` does NOT mutate the session's internal `snapshot`.

#### Suite 4: State Machine Transitions (Pause & Resume)
9. **`pauseFocusSession` from `active_focus`**:
   - Given active session at `nowTimestamp = 1000000` with `phaseEndsAt = 1500000` (500s remaining), calling `pauseFocusSession(session, 1000000)` returns:
     - `status: "paused_focus"`
     - `phaseEndsAt: null`
     - `remainingSeconds: 500`
10. **`resumeFocusSession` from `paused_focus`**:
    - Given paused session with `remainingSeconds: 500` at `nowTimestamp = 2000000`, calling `resumeFocusSession(session, 2000000)` returns:
      - `status: "active_focus"`
      - `phaseEndsAt: 2000000 + 500 * 1000` (2500000)
11. **Invalid pause/resume transitions**:
    - Calling `pauseFocusSession` on an `idle` or `focus_completed` session returns the session unchanged.
    - Calling `resumeFocusSession` on an `active_focus` session returns the session unchanged.

#### Suite 5: Calculation Helpers (`calculateRemainingSeconds`, `calculateProgressPercentage`, `isSessionExpired`)
12. **`calculateRemainingSeconds` active vs paused**:
    - Given active session with `phaseEndsAt: 1500000` and `now = 1200000`, returns `300` seconds.
    - Given active session with `now >= phaseEndsAt` (e.g. `now = 1600000`), returns `0` (never negative).
    - Given paused session with `remainingSeconds: 450`, returns `450` regardless of `now`.
13. **`calculateProgressPercentage` precision & bounds**:
    - At start (`remaining = 1500`, `duration = 1500`), returns `0.0`.
    - Halfway (`remaining = 750`, `duration = 1500`), returns `50.0`.
    - Completed (`remaining = 0`), returns `100.0`.
    - Handles `durationSeconds <= 0` gracefully returning `0.0`.
14. **`isSessionExpired` check**:
    - Given active session with `phaseEndsAt: 1500000`:
      - `now = 1499999` -> returns `false`.
      - `now = 1500000` -> returns `true`.
      - `now = 1500001` -> returns `true`.
    - Given paused session -> returns `false` regardless of `now`.

#### Suite 6: Focus Completion & Idempotency (`completeFocusSession`)
15. **Focus phase completion transition**:
    - Given `active_focus` session expired at `nowTimestamp = 1500000`, `completeFocusSession` returns:
      - `status: "focus_completed"`
      - `completedAt: 1500000`
      - `remainingSeconds: 0`
      - `phaseEndsAt: null`
16. **Completion Idempotency**:
    - Calling `completeFocusSession(session, 1500000)` once sets `completedAt: 1500000`.
    - Calling `completeFocusSession(alreadyCompletedSession, 2000000)` again returns the exact same object without modifying `completedAt` or state.

#### Suite 7: Break Session Flow (`startBreakSession`)
17. **`startBreakSession` transition**:
    - Given `focus_completed` session, calling `startBreakSession(session, 5, 1500000)` returns:
      - `phase: "break"`
      - `status: "active_break"`
      - `durationSeconds: 300`
      - `phaseStartedAt: 1500000`
      - `phaseEndsAt: 1500000 + 300000` (1800000)
18. **Invalid break start**:
    - Calling `startBreakSession` on an `active_focus` or `abandoned` session returns session unchanged (or throws safe invariant error).
19. **Pause & Resume Break**:
    - Verify `pauseFocusSession` on `active_break` transitions to `paused_break`.
    - Verify `resumeFocusSession` on `paused_break` transitions to `active_break`.

#### Suite 8: Abandonment Flow (`abandonFocusSession`)
20. **Abandon active focus session**:
    - Calling `abandonFocusSession(session, "user_cancelled", 1200000)` from `active_focus` or `paused_focus` returns:
      - `status: "abandoned"`
      - `abandonedAt: 1200000`
      - `abandonReason: "user_cancelled"`
      - `phaseEndsAt: null`
21. **Cannot abandon completed session**:
    - Calling `abandonFocusSession` on `focus_completed` session returns the completed session unchanged.

#### Suite 9: Daily Progress Aggregation & Streak Calculation
22. **`aggregateDailyProgress` calculation**:
    - Given history records:
      - Record 1: date "2026-07-27", status `focus_completed`, duration 25 min.
      - Record 2: date "2026-07-27", status `focus_completed`, duration 50 min.
      - Record 3: date "2026-07-27", status `abandoned`, duration 25 min.
      - Record 4: date "2026-07-27", break completion record (should be ignored).
    - Aggregation for "2026-07-27" yields:
      - `completedSessions: 2`
      - `focusMinutes: 75`
      - `abandonedSessions: 1`
      - `completionRate: 0.67` (2/3)
23. **`calculateStreakDays`**:
    - Given completed sessions on 2026-07-25, 2026-07-26, 2026-07-27, streak calculation for 2026-07-27 returns `3`.
    - Given gap on 2026-07-26, streak for 2026-07-27 returns `1`.

#### Suite 10: History Retention & Duplicate Prevention
24. **`pruneHistoryRecords` limit enforcement**:
    - Given array of 600 records spanning 120 days:
      - Filters out records older than 90 days.
      - Caps total count to 500 newest records.
25. **`isDuplicateCompletion` verification**:
    - Returns `true` if `runtimeId` exists in history records with `focus_completed`. Returns `false` otherwise.

---

## 4. Implementation Code Blueprint (`src/core/focusSession.js`)

Below is the complete reference implementation blueprint for `src/core/focusSession.js` designed for the implementer:

```js
/**
 * src/core/focusSession.js
 * Pure domain model & state transition engine for Focus Sessions.
 * Contains no side-effects or browser API calls.
 */

export const FOCUS_STATES = Object.freeze({
  IDLE: "idle",
  ACTIVE_FOCUS: "active_focus",
  PAUSED_FOCUS: "paused_focus",
  FOCUS_COMPLETED: "focus_completed",
  ACTIVE_BREAK: "active_break",
  PAUSED_BREAK: "paused_break",
  BREAK_COMPLETED: "break_completed",
  ABANDONED: "abandoned",
});

export const FOCUS_PHASES = Object.freeze({
  FOCUS: "focus",
  BREAK: "break",
});

export const FOCUS_BOUNDS = Object.freeze({
  MIN_FOCUS_MINUTES: 5,
  MAX_FOCUS_MINUTES: 120,
  DEFAULT_FOCUS_MINUTES: 25,
  MIN_BREAK_MINUTES: 1,
  MAX_BREAK_MINUTES: 30,
  DEFAULT_BREAK_MINUTES: 5,
  MAX_GOAL_LENGTH: 120,
  MAX_TEMPLATE_NAME_LENGTH: 40,
  MAX_HISTORY_DAYS: 90,
  MAX_HISTORY_RECORDS: 500,
});

export const DEFAULT_FOCUS_SETTINGS = Object.freeze({
  focusDuration: FOCUS_BOUNDS.DEFAULT_FOCUS_MINUTES,
  breakDuration: FOCUS_BOUNDS.DEFAULT_BREAK_MINUTES,
  blockerEnabled: true,
  ambientSound: Object.freeze({
    enabled: false,
    soundId: null,
    volume: 50,
  }),
});

export const DEFAULT_TEMPLATES = Object.freeze([
  Object.freeze({
    id: "template_quick_25",
    name: "Pomodoro 25",
    focusDuration: 25,
    breakDuration: 5,
    goal: Object.freeze({ type: "text", text: "", taskId: null }),
    blocker: Object.freeze({ enabled: true, presetId: "default" }),
    ambientSound: Object.freeze({ enabled: false, soundId: null, volume: 50 }),
    isDefault: true,
  }),
  Object.freeze({
    id: "template_deep_50",
    name: "Deep Work 50",
    focusDuration: 50,
    breakDuration: 10,
    goal: Object.freeze({ type: "text", text: "", taskId: null }),
    blocker: Object.freeze({ enabled: true, presetId: "default" }),
    ambientSound: Object.freeze({ enabled: false, soundId: null, volume: 50 }),
    isDefault: true,
  }),
  Object.freeze({
    id: "template_sprint_15",
    name: "Quick Sprint 15",
    focusDuration: 15,
    breakDuration: 3,
    goal: Object.freeze({ type: "text", text: "", taskId: null }),
    blocker: Object.freeze({ enabled: true, presetId: "default" }),
    ambientSound: Object.freeze({ enabled: false, soundId: null, volume: 50 }),
    isDefault: true,
  }),
]);

function clamp(value, min, max, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

export function normalizeFocusConfig(config = {}) {
  const focusDuration = clamp(
    config.focusDuration,
    FOCUS_BOUNDS.MIN_FOCUS_MINUTES,
    FOCUS_BOUNDS.MAX_FOCUS_MINUTES,
    FOCUS_BOUNDS.DEFAULT_FOCUS_MINUTES
  );

  const breakDuration = clamp(
    config.breakDuration,
    FOCUS_BOUNDS.MIN_BREAK_MINUTES,
    FOCUS_BOUNDS.MAX_BREAK_MINUTES,
    FOCUS_BOUNDS.DEFAULT_BREAK_MINUTES
  );

  const rawGoalText = typeof config.goal?.text === "string" ? config.goal.text.trim() : "";
  const goalText = rawGoalText.slice(0, FOCUS_BOUNDS.MAX_GOAL_LENGTH);
  const taskId = config.goal?.taskId ?? null;
  const goalType = taskId !== null && taskId !== undefined ? "task" : "text";

  const blockerEnabled = Boolean(config.blocker?.enabled ?? true);
  const presetId = typeof config.blocker?.presetId === "string" ? config.blocker.presetId : "default";

  const soundEnabled = Boolean(config.ambientSound?.enabled ?? false);
  const soundId = typeof config.ambientSound?.soundId === "string" ? config.ambientSound.soundId : null;
  const volume = clamp(config.ambientSound?.volume, 0, 100, 50);

  return {
    focusDuration,
    breakDuration,
    goal: { type: goalType, text: goalText, taskId },
    blocker: { enabled: blockerEnabled, presetId },
    ambientSound: { enabled: soundEnabled && Boolean(soundId), soundId: soundEnabled ? soundId : null, volume },
  };
}

export function createFocusSession(config = {}, nowTimestamp = Date.now()) {
  const normalized = normalizeFocusConfig(config);
  const durationSeconds = normalized.focusDuration * 60;
  const runtimeId = `session_${nowTimestamp}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id: runtimeId,
    schemaVersion: 1,
    templateId: config.templateId || null,
    snapshot: JSON.parse(JSON.stringify(normalized)),
    goal: normalized.goal,
    phase: FOCUS_PHASES.FOCUS,
    status: FOCUS_STATES.ACTIVE_FOCUS,
    startedAt: nowTimestamp,
    phaseStartedAt: nowTimestamp,
    phaseEndsAt: nowTimestamp + durationSeconds * 1000,
    durationSeconds,
    remainingSeconds: durationSeconds,
    completedAt: null,
    abandonedAt: null,
    abandonReason: null,
    preSessionState: config.preSessionState || null,
  };
}

export function calculateRemainingSeconds(session, nowTimestamp = Date.now()) {
  if (!session || typeof session !== "object") return 0;

  if (session.status === FOCUS_STATES.PAUSED_FOCUS || session.status === FOCUS_STATES.PAUSED_BREAK) {
    return Math.max(0, Math.ceil(session.remainingSeconds || 0));
  }

  if (session.status === FOCUS_STATES.ACTIVE_FOCUS || session.status === FOCUS_STATES.ACTIVE_BREAK) {
    if (!session.phaseEndsAt) return 0;
    const diffMs = session.phaseEndsAt - nowTimestamp;
    return Math.max(0, Math.ceil(diffMs / 1000));
  }

  return 0;
}

export function calculateProgressPercentage(session, nowTimestamp = Date.now()) {
  if (!session || typeof session !== "object") return 0;

  if (session.status === FOCUS_STATES.FOCUS_COMPLETED || session.status === FOCUS_STATES.BREAK_COMPLETED) {
    return 100;
  }

  if (session.status === FOCUS_STATES.ABANDONED) {
    return 100;
  }

  const total = session.durationSeconds || 0;
  if (total <= 0) return 0;

  const remaining = calculateRemainingSeconds(session, nowTimestamp);
  const elapsed = total - remaining;
  const pct = (elapsed / total) * 100;

  return Math.min(100, Math.max(0, Number(pct.toFixed(1))));
}

export function isSessionExpired(session, nowTimestamp = Date.now()) {
  if (!session || typeof session !== "object") return false;
  if (session.status !== FOCUS_STATES.ACTIVE_FOCUS && session.status !== FOCUS_STATES.ACTIVE_BREAK) {
    return false;
  }
  return session.phaseEndsAt !== null && nowTimestamp >= session.phaseEndsAt;
}

export function pauseFocusSession(session, nowTimestamp = Date.now()) {
  if (!session || typeof session !== "object") return session;
  if (session.status !== FOCUS_STATES.ACTIVE_FOCUS && session.status !== FOCUS_STATES.ACTIVE_BREAK) {
    return session;
  }

  const remainingSeconds = calculateRemainingSeconds(session, nowTimestamp);
  const isFocus = session.phase === FOCUS_PHASES.FOCUS;

  return {
    ...session,
    status: isFocus ? FOCUS_STATES.PAUSED_FOCUS : FOCUS_STATES.PAUSED_BREAK,
    phaseEndsAt: null,
    remainingSeconds,
  };
}

export function resumeFocusSession(session, nowTimestamp = Date.now()) {
  if (!session || typeof session !== "object") return session;
  if (session.status !== FOCUS_STATES.PAUSED_FOCUS && session.status !== FOCUS_STATES.PAUSED_BREAK) {
    return session;
  }

  const remainingSeconds = Math.max(0, session.remainingSeconds || 0);
  const isFocus = session.phase === FOCUS_PHASES.FOCUS;

  return {
    ...session,
    status: isFocus ? FOCUS_STATES.ACTIVE_FOCUS : FOCUS_STATES.ACTIVE_BREAK,
    phaseEndsAt: nowTimestamp + remainingSeconds * 1000,
  };
}

export function completeFocusSession(session, nowTimestamp = Date.now()) {
  if (!session || typeof session !== "object") return session;

  // Idempotency: if already completed, return unchanged
  if (session.status === FOCUS_STATES.FOCUS_COMPLETED || session.status === FOCUS_STATES.BREAK_COMPLETED) {
    return session;
  }

  const isFocus = session.phase === FOCUS_PHASES.FOCUS;

  return {
    ...session,
    status: isFocus ? FOCUS_STATES.FOCUS_COMPLETED : FOCUS_STATES.BREAK_COMPLETED,
    completedAt: isFocus ? (session.completedAt || nowTimestamp) : session.completedAt,
    phaseEndsAt: null,
    remainingSeconds: 0,
  };
}

export function abandonFocusSession(session, reason = "user_stopped", nowTimestamp = Date.now()) {
  if (!session || typeof session !== "object") return session;

  if (session.status === FOCUS_STATES.FOCUS_COMPLETED || session.status === FOCUS_STATES.BREAK_COMPLETED) {
    return session; // Cannot abandon completed session
  }

  return {
    ...session,
    status: FOCUS_STATES.ABANDONED,
    abandonedAt: nowTimestamp,
    abandonReason: reason || "user_stopped",
    phaseEndsAt: null,
  };
}

export function startBreakSession(session, durationMinutes = null, nowTimestamp = Date.now()) {
  if (!session || typeof session !== "object") return session;

  // Can only start break from FOCUS_COMPLETED or BREAK_COMPLETED
  if (session.status !== FOCUS_STATES.FOCUS_COMPLETED && session.status !== FOCUS_STATES.BREAK_COMPLETED) {
    return session;
  }

  const breakMins = clamp(
    durationMinutes ?? session.snapshot?.breakDuration,
    FOCUS_BOUNDS.MIN_BREAK_MINUTES,
    FOCUS_BOUNDS.MAX_BREAK_MINUTES,
    FOCUS_BOUNDS.DEFAULT_BREAK_MINUTES
  );

  const durationSeconds = breakMins * 60;

  return {
    ...session,
    phase: FOCUS_PHASES.BREAK,
    status: FOCUS_STATES.ACTIVE_BREAK,
    durationSeconds,
    remainingSeconds: durationSeconds,
    phaseStartedAt: nowTimestamp,
    phaseEndsAt: nowTimestamp + durationSeconds * 1000,
  };
}

export function aggregateDailyProgress(historyRecords = [], targetDateStr = null) {
  const dateKey = targetDateStr || new Date().toISOString().split("T")[0];

  const daysRecords = historyRecords.filter((r) => r.dateStr === dateKey);

  let completedSessions = 0;
  let focusMinutes = 0;
  let abandonedSessions = 0;

  for (const record of daysRecords) {
    if (record.status === FOCUS_STATES.FOCUS_COMPLETED) {
      completedSessions += 1;
      focusMinutes += record.focusDurationMinutes || Math.round((record.actualFocusSeconds || 0) / 60);
    } else if (record.status === FOCUS_STATES.ABANDONED) {
      abandonedSessions += 1;
    }
  }

  const totalAttempted = completedSessions + abandonedSessions;
  const completionRate = totalAttempted > 0 ? Number((completedSessions / totalAttempted).toFixed(2)) : 0;

  return {
    dateStr: dateKey,
    completedSessions,
    focusMinutes,
    abandonedSessions,
    completionRate,
  };
}

export function calculateStreakDays(historyRecords = [], referenceDateStr = null) {
  if (!Array.isArray(historyRecords) || historyRecords.length === 0) return 0;

  const datesWithCompletions = new Set(
    historyRecords
      .filter((r) => r.status === FOCUS_STATES.FOCUS_COMPLETED)
      .map((r) => r.dateStr)
  );

  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  let streak = 0;
  let curr = new Date(refDate);

  while (true) {
    const dateStr = curr.toISOString().split("T")[0];
    if (datesWithCompletions.has(dateStr)) {
      streak += 1;
      curr.setDate(curr.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function pruneHistoryRecords(historyRecords = [], maxDays = 90, maxRecords = 500, nowTimestamp = Date.now()) {
  if (!Array.isArray(historyRecords)) return [];

  const cutoffMs = nowTimestamp - maxDays * 24 * 60 * 60 * 1000;

  const validRecords = historyRecords.filter((r) => {
    const recordTime = r.endedAt || r.startedAt || 0;
    return recordTime >= cutoffMs;
  });

  // Sort descending by endedAt/startedAt
  validRecords.sort((a, b) => (b.endedAt || b.startedAt || 0) - (a.endedAt || a.startedAt || 0));

  return validRecords.slice(0, maxRecords);
}

export function isDuplicateCompletion(historyRecords = [], runtimeId) {
  if (!Array.isArray(historyRecords) || !runtimeId) return false;
  return historyRecords.some((r) => r.runtimeId === runtimeId && r.status === FOCUS_STATES.FOCUS_COMPLETED);
}
```

---

## 5. Verification Plan

1. Execute test suite once implemented:
   ```powershell
   node --test tests/focusSession.test.js
   ```
2. Verify entire suite pass:
   ```powershell
   npm test
   ```
3. Lint and build check:
   ```powershell
   npm run lint
   npm run build
   ```

---

## 6. Recommendations for Implementer

1. Ensure all object mutations use structural clone / object spread to guarantee pure state transitions without mutating original objects.
2. In `createFocusSession`, generate reproducible test IDs when testing by allowing an optional custom ID override in non-production helper mode if needed.
3. Ensure rounding in `calculateRemainingSeconds` uses `Math.ceil` so 0.1s remaining still displays as 1s, preventing the countdown from displaying 0 before the phase is officially expired.
