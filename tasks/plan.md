# Implementation Plan: Focus Session MVP

Status: **Approved — 2026-07-27**  
Approved spec: [`docs/specs/focus-session-ux-spec.md`](../docs/specs/focus-session-ux-spec.md)

## Goal

Implement the approved Session-first experience without removing the existing Pomodoro, Task List, Website Blocker or Ambient Sounds tools.

The implementation must make the background service worker the source of truth for the active session, preserve existing user data and count each completed focus interval exactly once.

## Approved Product Decisions

1. Quick Session defaults to 25 minutes of focus and 5 minutes of break.
2. On pause, the timer and ambient sound pause while Website Blocker remains active.
3. Break starts only after explicit user action.
4. An MVP session selects at most one ambient sound.
5. Completing a focus interval does not automatically complete its linked task.

## Existing Architecture Constraints

- `src/App.jsx` owns page navigation with local React state.
- `src/background.js` owns the durable Pomodoro, blocker and ambient operations.
- Pomodoro uses `chrome.alarms` and persists `pomodoroState`.
- Tasks, blocked URLs and sound settings already use `chrome.storage.local`.
- Existing tools must continue to work independently.
- The project currently uses Node's built-in test runner and has no React test library.
- No new dependency or Chrome permission is authorized by this plan.

## Architecture Direction

Add one background-owned `FocusSessionManager` as the orchestration layer.

```text
React screens
    │ session commands / state updates
    ▼
FocusSessionManager (background)
    ├── Pomodoro operations
    ├── Blocking configuration
    ├── Ambient operations
    ├── Runtime persistence
    └── Completion history
```

Pure normalization and transition logic belongs in `src/core/focusSession.js`. Browser API calls and cross-component coordination belong in the background manager. React screens only request commands and render returned state.

Template and runtime data remain separate. Starting a session copies a template/setup into an immutable runtime snapshot so later template edits cannot affect the active session.

## Storage Strategy

Add:

- `focusSessionTemplates`
- `activeFocusSession`
- `focusSessionHistory`
- `focusSessionPreferences`

Preserve:

- `tasks`
- `blockedUrls`
- `isBlocking`
- `ambientSettings`
- `pomodoroSettings`
- `pomodoroState`

The first MVP will reference the existing shared blocklist. It will not introduce a blocklist-preset editor.

Before starting, runtime captures enough previous blocker and ambient state to restore independent-tool settings safely when the session ends.

## Background Message Contract

Proposed commands:

```text
FOCUS_SESSION_GET_STATE
FOCUS_SESSION_START
FOCUS_SESSION_PAUSE
FOCUS_SESSION_RESUME
FOCUS_SESSION_STOP
FOCUS_SESSION_START_BREAK
FOCUS_SESSION_SKIP_BREAK
FOCUS_SESSION_FINISH
FOCUS_SESSION_UPDATE_VOLUME

FOCUS_SESSION_TEMPLATE_LIST
FOCUS_SESSION_TEMPLATE_SAVE
FOCUS_SESSION_TEMPLATE_UPDATE
FOCUS_SESSION_TEMPLATE_DUPLICATE
FOCUS_SESSION_TEMPLATE_DELETE

FOCUS_SESSION_PROGRESS_GET
FOCUS_SESSION_STATE_UPDATE
```

All mutation commands are serialized through an operation queue. Responses use the existing `{ success, state, error }` convention.

## Vertical Implementation Slices

### Slice 1 — Pure session domain

Build and test the data contracts and state machine without browser APIs or React.

Deliverables:

- Defaults and validation.
- Template and runtime normalization.
- State transitions for start, pause, resume, stop, focus completion, break and finish.
- Idempotent completion.
- Daily progress aggregation.
- History retention rules.

Expected files:

- `src/core/focusSession.js`
- `tests/focusSession.test.js`

Checkpoint:

- All domain transitions are covered by deterministic Node tests.
- Invalid events cannot create impossible states.

### Slice 2 — Background orchestration

Add `FocusSessionManager` and integrate it with the existing background managers.

Deliverables:

- Start transaction coordinates timer, blocker and one ambient sound.
- Partial startup failure rolls back operations already applied.
- Pause stops timer and session sound but leaves blocker active.
- Resume restores timer and session sound.
- Stop/finish restores previous independent-tool state.
- Alarm completion records one history item and publishes state.
- Service worker startup restores or completes an expired runtime.

Expected files:

- `src/background.js`
- `src/core/focusSession.js`
- `tests/backgroundFocusSession.test.js`
- Existing test helpers as required

Checkpoint:

- Background tests prove orchestration order, rollback and completion idempotency.
- Existing background, Pomodoro, blocking and audio tests still pass.

### Slice 3 — Session client and application routing

Create a reusable client hook/service for background session commands and add routes for the new screens.

Deliverables:

- Initial state fetch.
- Runtime update listener.
- Loading and actionable error states.
- Navigation for Setup, Active, Complete and Saved Sessions.
- Reopen behavior routes users back to active/paused session.

Expected files:

- `src/App.jsx`
- `src/hooks/useFocusSession.js`
- Optional `src/core/focusSessionClient.js`

Checkpoint:

- UI uses background state as its source of truth.
- No second countdown is maintained as authoritative React state.

### Slice 4 — Session Setup

Implement the approved setup experience as one scrollable screen.

Deliverables:

- Optional text goal.
- Active-task picker.
- 15/25/50 quick durations and custom duration.
- Break duration.
- Blocker toggle with configured-domain count.
- One ambient sound selector, preview and volume.
- Start CTA.
- Optional Save as Template flow.
- Validation and partial-start error recovery.

Expected files:

- `src/pages/FocusSessionSetup.jsx`
- `src/components/SessionGoalField.jsx`
- `src/components/SessionDurationPicker.jsx`
- `src/components/SessionEnvironment.jsx`
- `src/App.jsx`

Checkpoint:

- Default session starts within two actions from Home.
- The setup can start without a goal, blocker or sound.

### Slice 5 — Active, paused, break and completion UI

Implement the runtime-facing screens.

Deliverables:

- Accurate timer from background state.
- Goal and enabled-component summary.
- Pause/resume behavior.
- Blocker `Still blocking` status while paused.
- Stop-early confirmation.
- Focus Complete screen.
- Explicit linked-task completion.
- Explicit Start Break, Skip Break and Finish actions.

Expected files:

- `src/pages/ActiveFocusSession.jsx`
- `src/pages/FocusSessionComplete.jsx`
- `src/components/SessionTimer.jsx`
- `src/components/SessionStatus.jsx`
- `src/App.jsx`

Checkpoint:

- Popup close/reopen preserves the correct screen and timer.
- One focus interval increments completion exactly once.

### Slice 6 — Session-first Home, templates and progress

Replace the equal-weight feature-card Home with the approved hierarchy.

Deliverables:

- Start/Resume hero.
- Today completed sessions and focus minutes.
- Saved-session shortcuts.
- Template management: edit, duplicate and delete.
- Quick Tools links to all existing pages.
- Daily Quote moved below primary content.

Expected files:

- `src/pages/Home.jsx`
- `src/pages/SavedSessions.jsx`
- `src/components/SavedSessionCard.jsx`
- `src/components/TodayFocusStats.jsx`
- `src/components/QuickTools.jsx`
- `src/App.jsx`

Checkpoint:

- Active session always outranks creating a new session.
- All four legacy tools remain reachable and functional.

### Slice 7 — Hardening and release verification

Verify the integrated extension in a real Chrome runtime.

Deliverables:

- Keyboard and screen-reader pass.
- Popup viewport checks from 360–480px.
- Empty, loading, error and storage-failure states.
- Service worker restart and expired-alarm recovery.
- Existing-data compatibility.
- Updated README screenshots and feature description after behavior is stable.

Expected files:

- Tests discovered during verification
- `README.md`
- Screenshots, if approved for replacement

Checkpoint:

- Lint, tests, build and browser scenarios pass.
- No new permission is required.

## Dependency Order

```text
Slice 1: Domain
    ↓
Slice 2: Background orchestration
    ↓
Slice 3: Client + routing
    ├─────────────┐
    ↓             ↓
Slice 4: Setup   Slice 5: Runtime UI
    └──────┬──────┘
           ↓
Slice 6: Home + templates + progress
           ↓
Slice 7: Hardening
```

Slices 4 and 5 may be developed independently after the client contract in Slice 3 is stable. All other slices are sequential.

## Test-First Sequence

For every behavior-changing slice:

1. Add a failing test for the smallest behavior.
2. Implement only enough production logic to pass.
3. Refactor while keeping tests green.
4. Run the focused test.
5. Run the full test suite before moving to the next slice.

The background orchestration tests must use fake Chrome APIs and controlled time; they must not depend on wall-clock delays.

## Verification Commands

```powershell
npm run lint
npm test
npm run build
npx prettier --check .
```

Browser verification is required after Slices 5, 6 and 7.

## Risks and Mitigations

### Two competing timer owners

Risk: existing Pomodoro state and Focus Session runtime drift apart.

Mitigation: Focus Session delegates phase timing to one background operation path and treats the returned phase end time as authoritative. Do not add a second alarm for the same phase.

### Session overrides independent settings

Risk: finishing a session leaves blocker or ambient settings changed.

Mitigation: capture pre-session state and restore it on stop/finish. Runtime uses a snapshot rather than rewriting saved template or user preferences.

### Partial start

Risk: timer starts while blocker or sound fails.

Mitigation: transactional start with compensating rollback in reverse order; UI remains in Setup and identifies the failed component.

### Duplicate completion

Risk: alarm handling, service worker recovery and popup commands record the same session more than once.

Mitigation: completion record keyed by runtime ID and an idempotent domain transition.

### Background file becomes too large

Risk: adding the manager directly makes `src/background.js` difficult to maintain.

Mitigation: pure logic stays in `src/core/focusSession.js`; during Slice 2, extract browser managers only when needed without changing unrelated behavior.

### MVP grows into presets and analytics

Risk: multiple blocklists, cloud analytics or gamification delay the core loop.

Mitigation: enforce the approved Not Doing list and local-only metrics.

## Data Compatibility and Rollback

- No existing storage key is deleted or renamed.
- New UI reads missing Focus Session keys as empty/default state.
- Disabling the new Home routes must leave the four existing tools usable.
- A runtime schema version is stored with `activeFocusSession`.
- Unknown or corrupt runtime data fails closed: stop session-owned audio, preserve the user's blocklist, and return to idle with an error.

## Definition of Done

- The approved acceptance criteria in the UX spec all pass.
- A user can start a default session from Home in two actions.
- Runtime survives popup closure and service worker restart.
- Pause leaves Website Blocker active.
- Break requires explicit start.
- Only one ambient sound is used by a Focus Session.
- Linked tasks require explicit completion confirmation.
- Existing tools and stored data remain functional.
- Full automated checks and real-browser verification pass.

## Out of Scope

- Accounts, backend and cloud sync.
- Multiple blocklist presets.
- Multiple ambient sounds inside one Focus Session.
- Automatic task completion.
- Automatic break start.
- Analytics or telemetry server.
- AI planning, social features, marketplace and advanced gamification.
- Chrome side panel or full-page redesign.

## Approval

Plan approved on 2026-07-27. Phase 3 tasks are tracked in [`tasks/todo.md`](todo.md).
