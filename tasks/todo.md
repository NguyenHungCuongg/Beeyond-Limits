# Tasks: Focus Session MVP

Status: **Ready for implementation**  
Approved plan: [`tasks/plan.md`](plan.md)  
Approved spec: [`docs/specs/focus-session-ux-spec.md`](../docs/specs/focus-session-ux-spec.md)

## Working Rules

- Complete tasks in dependency order.
- Use test-driven development for every behavior change.
- Keep each task focused to the files listed; update this document first if scope changes.
- Run the focused test after each red/green/refactor cycle.
- Run `npm test` after every completed task.
- Run `npm run lint` and `npm run build` at every slice checkpoint.
- Do not add dependencies or Chrome permissions without approval.
- Do not modify or remove existing user storage keys.

## Slice 0 — Establish the Baseline

- [x] **T00 — Verify the existing extension baseline**
  - Depends on: none
  - Acceptance:
    - Existing tests pass before Focus Session changes.
    - Existing lint and production build pass.
    - Any pre-existing failure is recorded before implementation begins.
  - Verify:
    - `npm test`
    - `npm run lint`
    - `npm run build`
  - Files: no production changes

## Slice 1 — Pure Session Domain

- [ ] **T01 — Define and normalize Focus Session data contracts**
  - Depends on: T00
  - Acceptance:
    - Exports defaults for 25-minute focus and 5-minute break.
    - Validates focus duration within 5–120 minutes.
    - Validates break duration within 1–30 minutes.
    - Normalizes optional text/task goals.
    - Normalizes blocker configuration and at most one ambient sound.
    - Separates template data from runtime snapshot data.
    - Invalid/corrupt input falls back safely without throwing.
  - Verify:
    - `node --test tests/focusSession.test.js`
    - `npm test`
  - Files:
    - `src/core/focusSession.js`
    - `tests/focusSession.test.js`

- [ ] **T02 — Implement the Focus Session state machine**
  - Depends on: T01
  - Acceptance:
    - Supports `idle`, `starting`, `active_focus`, `paused_focus`, `focus_completed`, `active_break`, `paused_break`, `break_completed`, `abandoned`.
    - Only valid events can change state.
    - Pause stores remaining seconds and clears the phase end timestamp.
    - Resume creates a new phase end timestamp from remaining time.
    - Break never starts automatically.
    - Stop before focus completion produces `abandoned`.
    - Completion of the same runtime ID is idempotent.
  - Verify:
    - `node --test tests/focusSession.test.js`
    - `npm test`
  - Files:
    - `src/core/focusSession.js`
    - `tests/focusSession.test.js`

- [ ] **T03 — Implement local progress aggregation and retention**
  - Depends on: T02
  - Acceptance:
    - Aggregates completed sessions and focus minutes by local calendar day.
    - Abandoned sessions do not increase completed metrics.
    - Break completion does not increase focus metrics.
    - Calculates completion rate from started and completed focus sessions.
    - Calculates the streak of days with at least one completion.
    - Keeps at most 90 days or 500 detailed history records.
    - Duplicate runtime IDs cannot produce duplicate completion records.
  - Verify:
    - `node --test tests/focusSession.test.js`
    - `npm test`
  - Files:
    - `src/core/focusSession.js`
    - `tests/focusSession.test.js`

### Slice 1 checkpoint

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`

## Slice 2 — Background Orchestration

- [ ] **T04 — Add the background FocusSessionManager foundation**
  - Depends on: T03
  - Acceptance:
    - Manager loads templates, runtime, history and preferences from Chrome Storage.
    - Manager exposes read-only state, template list and daily progress operations.
    - All mutation commands use a dedicated operation queue.
    - Background message responses follow `{ success, state, error }`.
    - Missing Focus Session keys load as safe defaults.
    - Existing Pomodoro, blocker and ambient commands remain operational.
  - Verify:
    - `node --test tests/backgroundFocusSession.test.js`
    - `npm test`
  - Files:
    - `src/background.js`
    - `src/core/focusSession.js`
    - `tests/backgroundFocusSession.test.js`

- [ ] **T05 — Implement transactional Focus Session start**
  - Depends on: T04
  - Acceptance:
    - Start creates an immutable runtime snapshot.
    - Start captures the pre-session Pomodoro, blocker and ambient state.
    - Start configures timer, optional blocker and optional single sound in a deterministic order.
    - Successful start persists runtime before reporting active state.
    - Failure rolls back completed operations in reverse order.
    - A partial session is never reported as active.
    - A second session cannot start while one is active or paused.
  - Verify:
    - `node --test tests/backgroundFocusSession.test.js`
    - `npm test`
  - Files:
    - `src/background.js`
    - `src/core/focusSession.js`
    - `tests/backgroundFocusSession.test.js`

- [ ] **T06 — Implement pause, resume and Stop Early orchestration**
  - Depends on: T05
  - Acceptance:
    - Pause stops timer countdown and session ambient sound.
    - Pause leaves Website Blocker enabled.
    - Resume restarts timer and only the selected session sound.
    - Stop requires a stop command from a confirmed UI action.
    - Stop writes an abandoned history record.
    - Stop restores pre-session blocker and ambient settings.
    - Repeated pause/resume/stop commands are safe and idempotent.
  - Verify:
    - `node --test tests/backgroundFocusSession.test.js`
    - `npm test`
  - Files:
    - `src/background.js`
    - `src/core/focusSession.js`
    - `tests/backgroundFocusSession.test.js`

- [ ] **T07 — Implement focus completion, break and finish orchestration**
  - Depends on: T06
  - Acceptance:
    - Focus alarm completion creates exactly one completed history record.
    - Completion updates daily progress immediately.
    - Completion stops session sound and shows the completion state.
    - Website Blocker remains active until Finish or Start Break.
    - Start Break disables session blocking and starts only after explicit command.
    - Skip Break and Finish clear runtime and restore pre-session settings.
    - Break completion never increments completed focus sessions.
  - Verify:
    - `node --test tests/backgroundFocusSession.test.js`
    - `npm test`
  - Files:
    - `src/background.js`
    - `src/core/focusSession.js`
    - `tests/backgroundFocusSession.test.js`

- [ ] **T08 — Restore runtime after service worker restart**
  - Depends on: T07
  - Acceptance:
    - Active runtime restores from `activeFocusSession`.
    - Remaining time is derived from `phaseEndsAt`, not stale stored seconds.
    - Runtime whose end time passed while the worker was stopped completes exactly once.
    - Paused runtime restores without decrementing its stored remaining time.
    - Corrupt/unknown runtime fails closed and surfaces a recoverable error.
    - User blocklist data is preserved during corrupt-runtime recovery.
  - Verify:
    - `node --test tests/backgroundFocusSession.test.js`
    - `node --test tests/backgroundStartup.test.js`
    - `npm test`
  - Files:
    - `src/background.js`
    - `src/core/focusSession.js`
    - `tests/backgroundFocusSession.test.js`
    - `tests/backgroundStartup.test.js`

- [ ] **T09 — Implement saved-template background commands**
  - Depends on: T08
  - Acceptance:
    - List, save, update, duplicate and delete commands are supported.
    - Template names are trimmed, non-empty and limited to 40 characters.
    - Duplicate generates a new ID and timestamps.
    - Editing a template does not mutate an active runtime snapshot.
    - Storage failure returns an actionable error and preserves prior state.
  - Verify:
    - `node --test tests/backgroundFocusSession.test.js`
    - `npm test`
  - Files:
    - `src/background.js`
    - `src/core/focusSession.js`
    - `tests/backgroundFocusSession.test.js`

### Slice 2 checkpoint

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`

## Slice 3 — Client Contract and Routing

- [ ] **T10 — Add the Focus Session React client hook**
  - Depends on: T09
  - Acceptance:
    - Hook fetches initial session state, templates and progress.
    - Hook subscribes to `FOCUS_SESSION_STATE_UPDATE`.
    - Hook exposes explicit command functions for the approved message contract.
    - Loading, busy and error states are represented separately.
    - Listener and polling resources are cleaned up on unmount.
    - Browser-development fallback does not masquerade as a running extension session.
  - Verify:
    - `npm test`
    - `npm run lint`
    - Manual development smoke check
  - Files:
    - `src/hooks/useFocusSession.js`
    - `src/core/focusSessionClient.js`
    - `src/App.jsx`

- [ ] **T11 — Add Focus Session routes and runtime recovery navigation**
  - Depends on: T10
  - Acceptance:
    - App can render Home, Setup, Active, Complete and Saved Sessions pages.
    - Opening the popup with active/paused runtime makes Resume available immediately.
    - Navigation to Home does not stop runtime.
    - Starting a second Setup flow is blocked while runtime exists.
    - Existing four page routes remain unchanged.
  - Verify:
    - `npm run lint`
    - `npm run build`
    - Manual route smoke check
  - Files:
    - `src/App.jsx`
    - `src/pages/FocusSessionSetup.jsx`
    - `src/pages/ActiveFocusSession.jsx`
    - `src/pages/FocusSessionComplete.jsx`
    - `src/pages/SavedSessions.jsx`

### Slice 3 checkpoint

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`

## Slice 4 — Session Setup

- [ ] **T12 — Build goal and duration controls**
  - Depends on: T11
  - Acceptance:
    - Goal text is optional and limited to 120 characters.
    - Picker lists only active tasks.
    - Choosing a task stores both `taskId` and a text snapshot.
    - Quick duration choices are 15, 25 and 50 minutes.
    - Custom focus range is 5–120 minutes.
    - Break range is 1–30 minutes and defaults to 5.
    - Primary CTA label reflects selected duration.
  - Verify:
    - `npm run lint`
    - `npm run build`
    - Keyboard interaction smoke check
  - Files:
    - `src/pages/FocusSessionSetup.jsx`
    - `src/components/SessionGoalField.jsx`
    - `src/components/SessionDurationPicker.jsx`
    - `src/components/NumberSlider.jsx`

- [ ] **T13 — Build blocker and ambient environment controls**
  - Depends on: T12
  - Acceptance:
    - Blocker and ambient sound have independent toggles.
    - Blocker displays configured-domain count.
    - Empty blocklist displays `No sites configured` and a link to add sites.
    - Session can select at most one ambient sound.
    - Sound preview stops before session start.
    - Volume is keyboard accessible and only shown for an enabled selected sound.
  - Verify:
    - `npm run lint`
    - `npm run build`
    - Manual sound-preview and empty-blocklist checks
  - Files:
    - `src/pages/FocusSessionSetup.jsx`
    - `src/components/SessionEnvironment.jsx`
    - `src/components/VolumeSlider.jsx`
    - `src/App.jsx`

- [ ] **T14 — Connect Setup start and Save as Template flows**
  - Depends on: T13
  - Acceptance:
    - Default session starts in two actions from Home.
    - Start is disabled while a start operation is pending.
    - Component startup errors identify the failed component.
    - User can retry or disable the failed optional component.
    - Save asks for a template name only when invoked.
    - Saving does not automatically start.
    - Existing template data prefills Setup without mutating the template.
  - Verify:
    - `npm test`
    - `npm run lint`
    - `npm run build`
    - Real-extension Setup smoke check
  - Files:
    - `src/pages/FocusSessionSetup.jsx`
    - `src/hooks/useFocusSession.js`
    - `src/components/SessionEnvironment.jsx`
    - `src/App.jsx`

### Slice 4 checkpoint

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`

## Slice 5 — Runtime and Completion UI

- [ ] **T15 — Build Active and Paused Focus Session UI**
  - Depends on: T11, T14
  - Acceptance:
    - Goal, countdown and enabled-component summary fit without required scroll at 400×600.
    - Countdown renders background-provided time and phase end state.
    - Pause and Resume call background commands.
    - Paused UI states `Still blocking` for Website Blocker.
    - Home navigation leaves runtime active.
    - Status is communicated by text/icon as well as color.
  - Verify:
    - `npm run lint`
    - `npm run build`
    - Real-extension active/pause/resume check
  - Files:
    - `src/pages/ActiveFocusSession.jsx`
    - `src/components/SessionTimer.jsx`
    - `src/components/SessionStatus.jsx`
    - `src/hooks/useFocusSession.js`

- [ ] **T16 — Add Stop Early confirmation and recovery states**
  - Depends on: T15
  - Acceptance:
    - Stop Early always opens a confirmation.
    - Cancel returns to the unchanged session.
    - Confirm records abandoned state and returns Home.
    - Busy state prevents duplicate stop requests.
    - Failure leaves the user on a recoverable session screen.
    - Dialog is keyboard navigable and returns focus to its trigger.
  - Verify:
    - `npm run lint`
    - `npm run build`
    - Keyboard-only confirmation check
  - Files:
    - `src/pages/ActiveFocusSession.jsx`
    - `src/components/ConfirmDialog.jsx`
    - `src/hooks/useFocusSession.js`

- [ ] **T17 — Build Focus Complete and linked-task confirmation**
  - Depends on: T15
  - Acceptance:
    - Completion screen shows focus minutes, goal and updated daily progress.
    - Linked task remains active until explicit confirmation.
    - Confirming task completion updates the existing `tasks` storage record once.
    - Start Break and Finish are separate explicit actions.
    - Save Setup is shown only when appropriate.
  - Verify:
    - `npm test`
    - `npm run lint`
    - `npm run build`
    - Real-extension completion check
  - Files:
    - `src/pages/FocusSessionComplete.jsx`
    - `src/hooks/useFocusSession.js`
    - `src/core/focusSessionClient.js`
    - `src/App.jsx`

- [ ] **T18 — Build active/paused/completed Break UI**
  - Depends on: T17
  - Acceptance:
    - Break starts only after the user selects Start Break.
    - Blocker is disabled for break.
    - Ambient sound is off by default for break.
    - Pause/resume works for break timer.
    - Skip Break and Finish clear runtime safely.
    - Break completion does not alter focus completion metrics.
  - Verify:
    - `npm test`
    - `npm run lint`
    - `npm run build`
    - Real-extension break check
  - Files:
    - `src/pages/ActiveFocusSession.jsx`
    - `src/pages/FocusSessionComplete.jsx`
    - `src/components/SessionStatus.jsx`
    - `src/hooks/useFocusSession.js`

### Slice 5 checkpoint

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Browser verification: active, pause, reopen, complete and break

## Slice 6 — Session-first Home, Templates and Progress

- [ ] **T19 — Redesign Home around Start/Resume Session**
  - Depends on: T14, T18
  - Acceptance:
    - Start or Resume is the first primary action.
    - An active runtime replaces the new-session hero with a Resume card.
    - Today’s completed sessions and focus minutes are visible.
    - Quick Tools exposes Timer, Tasks, Blocker and Sounds.
    - Daily Quote appears below the core session content.
    - Existing four oversized feature cards are removed from Home.
  - Verify:
    - `npm run lint`
    - `npm run build`
    - Popup check at 360px, 400px and 480px widths
  - Files:
    - `src/pages/Home.jsx`
    - `src/components/TodayFocusStats.jsx`
    - `src/components/QuickTools.jsx`
    - `src/App.jsx`

- [ ] **T20 — Add saved-session shortcuts and management**
  - Depends on: T19
  - Acceptance:
    - Home shows a bounded list of saved-session shortcuts.
    - Selecting a template opens prefilled Setup rather than auto-starting.
    - Management supports edit, duplicate and delete.
    - Delete requires confirmation.
    - Empty state suggests saving a successful setup.
    - Active runtime snapshot is unaffected by template edits.
  - Verify:
    - `npm test`
    - `npm run lint`
    - `npm run build`
    - Template CRUD smoke check
  - Files:
    - `src/pages/Home.jsx`
    - `src/pages/SavedSessions.jsx`
    - `src/components/SavedSessionCard.jsx`
    - `src/components/ConfirmDialog.jsx`
    - `src/hooks/useFocusSession.js`

- [ ] **T21 — Complete Home loading, empty and error states**
  - Depends on: T20
  - Acceptance:
    - Home has non-jumping loading placeholders.
    - Missing templates/history render useful empty states.
    - Background/storage errors are visible and retryable.
    - Primary Session action remains reachable within the first viewport.
    - Focus order follows visual order.
  - Verify:
    - `npm run lint`
    - `npm run build`
    - Keyboard and forced-error smoke checks
  - Files:
    - `src/pages/Home.jsx`
    - `src/components/TodayFocusStats.jsx`
    - `src/components/SavedSessionCard.jsx`
    - `src/hooks/useFocusSession.js`

### Slice 6 checkpoint

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Browser verification: Home, Quick Tools and template flows

## Slice 7 — Hardening and Release Verification

- [ ] **T22 — Add integrated recovery and compatibility coverage**
  - Depends on: T21
  - Acceptance:
    - Tests cover close/reopen state restoration.
    - Tests cover service worker restart after phase expiry.
    - Tests cover partial-start rollback.
    - Tests prove existing task, blocker and ambient data is preserved.
    - Tests prove corrupt runtime recovery does not clear the user blocklist.
    - Full existing suite remains green.
  - Verify:
    - `npm test`
    - `npm run lint`
    - `npm run build`
  - Files:
    - `tests/backgroundFocusSession.test.js`
    - `tests/backgroundStartup.test.js`
    - `tests/blocking.test.js`
    - `tests/offscreenAudio.test.js`

- [ ] **T23 — Perform real Chrome functional and accessibility verification**
  - Depends on: T22
  - Acceptance:
    - Quick Session, saved template and Quick Tools flows pass.
    - Popup close/reopen preserves active and paused sessions.
    - Timer remains accurate after service worker restart.
    - Website Blocker remains active while focus is paused.
    - Partial failure shows recovery options.
    - All actions are keyboard reachable with visible focus.
    - Timer/status announcements do not spam screen readers.
    - Active Session fits at 400×600 without essential vertical scrolling.
  - Verify:
    - Chrome DevTools browser walkthrough
    - Console has no uncaught errors
    - Network/background logs have no repeated failed messages
  - Files:
    - Production files only if defects are discovered
    - Relevant test file for every corrected behavioral defect

- [ ] **T24 — Update product documentation and release evidence**
  - Depends on: T23
  - Acceptance:
    - README describes Session-first behavior accurately.
    - Feature list distinguishes Focus Session and Quick Tools.
    - New screenshots reflect Home, Setup and Active Session.
    - Chrome Web Store copy does not claim cloud sync or unsupported analytics.
    - Donate links, if added, appear only in About/Settings and never Active Session.
  - Verify:
    - `npm test`
    - `npm run lint`
    - `npm run build`
    - Documentation and screenshot visual review
  - Files:
    - `README.md`
    - Up to four files under `screenshots/`

## Final Definition of Done

- [ ] All T00–T24 tasks and slice checkpoints are complete.
- [ ] All UX spec acceptance criteria pass.
- [ ] `npm test` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] `npx prettier --check .` passes or formatting differences are resolved.
- [ ] Real Chrome verification passes without uncaught console errors.
- [ ] No dependency or Chrome permission was added without approval.
- [ ] Existing tasks and independent-tool settings remain intact.
- [ ] Focus completion is recorded exactly once per runtime ID.
- [ ] `docs/specs/focus-session-ux-spec.md`, `tasks/plan.md` and this task list match shipped behavior.

