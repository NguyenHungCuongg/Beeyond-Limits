# Milestone 3 Exploration Report: Background Service Worker Engine & Timer

## 1. Observation

### 1.1 Existing Architecture in `src/background.js`
- **Alarm Management**: Lines 16 & 409–417 in `src/background.js` define `POMODORO_ALARM = "pomodoroTimer"` and listen for `chrome.alarms.onAlarm`.
- **Operation Queueing**: Lines 15 & 395–397 in `src/background.js` instantiate `createOperationQueue()` for atomic serialization of background tasks (`blockerOperationQueue`, `pomodoroOperationQueue`, `ambientOperationQueue`).
- **Response Helper**: Lines 399–407 in `src/background.js` provide `respond(sendResponse, operation)` which wraps async calls and returns `true` to keep message ports open.
- **Message Listener**: Lines 419–495 in `src/background.js` listen to `chrome.runtime.onMessage` and route messages via a `switch (message.type)` block.
- **Startup / Install Synchronization**: Lines 497–507 in `src/background.js` register `chrome.runtime.onStartup` and `chrome.runtime.onInstalled` handlers to restore dynamic state.

### 1.2 Pure Domain Logic in `src/core/focusSession.js`
- Defines `FOCUS_STATES` (lines 7–16: `IDLE`, `ACTIVE_FOCUS`, `PAUSED_FOCUS`, `FOCUS_COMPLETED`, `ACTIVE_BREAK`, `PAUSED_BREAK`, `BREAK_COMPLETED`, `ABANDONED`).
- Pure functions:
  - `createFocusSession(config, nowTimestamp)` (lines 158–182)
  - `pauseFocusSession(session, now)` (lines 229–244)
  - `resumeFocusSession(session, now)` (lines 246–260)
  - `completeFocusSession(session, now)` (lines 262–285)
  - `abandonFocusSession(session, reason, now)` (lines 287–301)
  - `startBreakSession(session, durationMinutes, now)` (lines 303–328)
  - `isSessionExpired(session, now)` (lines 221–227)
  - `calculateRemainingSeconds(session, now)` (lines 184–198)
  - `calculateProgressPercentage(session, now)` (lines 200–219)
  - `isDuplicateCompletion(historyRecords, runtimeId)` (lines 430–435)

### 1.3 Storage & Persistence Accessors in `src/core/focusStorage.js`
- Storage Keys (lines 15–20):
  - `STORAGE_KEYS.ACTIVE_SESSION = "activeFocusSession"`
  - `STORAGE_KEYS.TEMPLATES = "focusSessionTemplates"`
  - `STORAGE_KEYS.HISTORY = "focusSessionHistory"`
  - `STORAGE_KEYS.PREFERENCES = "focusSessionPreferences"`
- Accessor Functions:
  - `getActiveFocusSession(chromeStorageApi)` & `setActiveFocusSession(session, chromeStorageApi)` & `clearActiveFocusSession(chromeStorageApi)`
  - `getFocusTemplates(chromeStorageApi)`, `saveFocusTemplate(template, api)`, `deleteFocusTemplate(id, api)`
  - `getFocusHistory(chromeStorageApi)`, `appendFocusHistory(historyRecord, api)`
  - `getFocusPreferences(chromeStorageApi)`, `updateFocusPreferences(newPrefs, api)`
  - `initializeFocusStorage(chromeStorageApi)`

### 1.4 Test Infrastructure in `package.json` & Existing Tests
- `package.json` line 10 configures tests via `"test": "node --test"`.
- Existing tests (e.g. `tests/backgroundStartup.test.js`, `tests/focusSession.test.js`, `tests/focusStorage.test.js`) use Node's native runner (`import test from "node:test"` and `import assert from "node:assert/strict"`).

---

## 2. Logic Chain

1. **Service Worker Lifetime & Alarm Lifecycle**:
   - In MV3, service workers are terminated when idle. Therefore, in-memory state cannot be the sole source of truth; state must be persisted in `chrome.storage.local`.
   - `chrome.alarms` must be used for session timing (`focusSessionTimer`). When starting or resuming a session or break, `phaseEndsAt` is computed and `chrome.alarms.create("focusSessionTimer", { when: phaseEndsAt })` is invoked.
   - When pausing, abandoning, or skipping a break, `chrome.alarms.clear("focusSessionTimer")` is called.

2. **Offline Resilience & Re-synchronization on Service Worker Startup**:
   - On SW startup (`chrome.runtime.onStartup` / SW evaluation), `FocusSessionManager.restoreSessionState()` loads `activeFocusSession` from storage.
   - If `activeSession` is active (`ACTIVE_FOCUS` or `ACTIVE_BREAK`):
     - If `activeSession.phaseEndsAt <= Date.now()`, the alarm expired while the SW was inactive. `completeCurrentPhase()` is called immediately to catch up.
     - If `activeSession.phaseEndsAt > Date.now()`, the SW re-registers the alarm: `chrome.alarms.create("focusSessionTimer", { when: activeSession.phaseEndsAt })`.

3. **Message Protocol Implementation**:
   - `FOCUS_GET_STATE`: Calls `initializeFocusStorage()`, fetches active session, templates, history, and preferences. For active/paused sessions, dynamically populates current `remainingSeconds` and `progressPercentage` before returning.
   - `FOCUS_START_SESSION`: Calls `createFocusSession(config)`, sets `activeFocusSession` in storage, sets `focusSessionTimer` alarm, broadcasts update.
   - `FOCUS_PAUSE_SESSION`: Verifies runtime ID, calls `pauseFocusSession()`, clears alarm, saves updated active session, broadcasts update.
   - `FOCUS_RESUME_SESSION`: Verifies runtime ID, calls `resumeFocusSession()`, creates alarm, saves updated active session, broadcasts update.
   - `FOCUS_ABANDON_SESSION`: Verifies runtime ID, calls `abandonFocusSession()`, clears alarm, appends to history via `appendFocusHistory()`, clears active session, broadcasts update.
   - `FOCUS_START_BREAK`: Calls `startBreakSession()`, creates alarm, saves active session, broadcasts update.
   - `FOCUS_SKIP_BREAK`: Clears alarm, clears active session, broadcasts update.
   - `FOCUS_UPDATE_PREFERENCES`: Calls `updateFocusPreferences()`, returns updated preferences.

4. **Single-Flight Completion & Idempotent Completion Recording**:
   - A completion mutex guard `this.completionPromise` prevents race conditions between alarm triggers and manual message completion calls.
   - When completing a focus phase, `appendFocusHistory()` is called. Because `appendFocusHistory()` uses `isDuplicateCompletion(history, runtimeId)`, duplicate history records for the same `runtimeId` are prevented even under concurrent completion attempts.
   - The session state transitions to `FOCUS_COMPLETED` (allowing the UI to display break choices), while `activeFocusSession` stores the completed snapshot.

5. **Chrome Notifications**:
   - Upon focus phase completion, call `chrome.notifications.create` with title `"Focus Session Complete! 🎉"` and message stating the focus duration.
   - Upon break phase completion, call `chrome.notifications.create` with title `"Break Finished! 💪"` and message prompting the user to start a new focus session.

---

## 3. Caveats

- **Offscreen Audio Integration**: Ambient sound triggering and audio notification playback during focus session state changes will be fully connected in Milestone 4 (`src/core/focusConnectors.js`). Milestone 3 focuses on service worker alarm lifecycle, state machine transitions, storage persistence, and notifications.
- **Concurrent Session Prevention**: Interlocking Pomodoro and Focus Session state machines (to prevent starting a Focus Session while Pomodoro is active) is scheduled for Milestone 4 (Slice 4).
- **Chrome Storage Latency**: All storage writes are queued using `createOperationQueue()` to prevent read-after-write race conditions in Chrome extension service worker environments.

---

## 4. Conclusion

The technical strategy for `FocusSessionManager` in `src/background.js` and `tests/focusEngine.test.js` is fully specified and ready for implementation.

### Implementation Blueprint for `src/background.js`
1. Define constant `FOCUS_ALARM = "focusSessionTimer"`.
2. Instantiate `focusOperationQueue = createOperationQueue()`.
3. Create `FocusSessionManager` class:
   - Methods: `init()`, `restoreSessionState()`, `getState()`, `startSession()`, `pauseSession()`, `resumeSession()`, `abandonSession()`, `startBreak()`, `skipBreak()`, `completeCurrentPhase()`, `showNotification()`.
4. Route all 8 `FOCUS_*` actions in `chrome.runtime.onMessage`.
5. Route `FOCUS_ALARM` in `chrome.alarms.onAlarm`.
6. Attach `restoreSessionState()` to `chrome.runtime.onStartup` and `chrome.runtime.onInstalled`.

### Test Suite Blueprint for `tests/focusEngine.test.js`
Use `node:test` and `node:assert/strict` with mock `chrome` global:
- **Suite 1: SW Startup & Storage Hydration**: Unexpired session re-registers alarm; expired session completes on startup.
- **Suite 2: Message Handlers (all 8 `FOCUS_*` actions)**: Comprehensive message-level test coverage.
- **Suite 3: Alarm Listener & Single-Flight Completion**: Alarm trigger initiates phase transition and triggers Chrome notification.
- **Suite 4: Idempotency & Resiliency**: Duplicate completion calls log to history exactly once per `runtimeId`.

---

## 5. Verification Method

To verify the implementation once written by the implementer agent:

1. **Unit Test Suite**:
   ```bash
   node --test tests/focusEngine.test.js
   ```
   Expect: All tests in `tests/focusEngine.test.js` pass with 0 failures.

2. **Entire Test Suite & Code Quality Checks**:
   ```bash
   npm test
   npm run lint
   npm run build
   ```
   Expect: All test suites pass, 0 lint warnings/errors, successful build output in `dist/`.

3. **Invalidation Conditions**:
   - If `focusSessionTimer` alarm is not registered when session starts.
   - If SW restart does not process an expired `phaseEndsAt`.
   - If `appendFocusHistory` produces duplicate entries for the same `runtimeId`.
