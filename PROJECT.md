# Project: Focus Session MVP for Beeyond Limits

## Architecture
- Core MV3 Architecture:
  - `src/core/focusSession.js`: Pure domain model, state machine logic, duration calculations, validation logic.
  - `src/core/focusStorage.js`: Storage accessors, schema migrations, active session / template / history / preference persistence in `chrome.storage.local`.
  - `src/core/focusConnectors.js`: Interlocking connectors for Ambient Sounds, Website Blocker, Task List, and Pomodoro.
  - `src/background.js` (`FocusSessionManager`): Authoritative service worker background engine managing `chrome.alarms` timer (`focusSessionTimer`), notifications, and messaging protocol.
  - `src/components/focus/` & `src/App.jsx`: React 19 UI views adhering to Carnival Neo-Brutalist design language.

## Feature Inventory
Every requirement and slice feature mapped to milestone owner:
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F-01 Domain Model | Session configuration options, template defaults, state machine types, duration calculations | M1 | spec_miner / plan |
| 2 | F-02 Storage & Schema | `activeFocusSession`, `focusSessionTemplates`, `focusSessionHistory`, `focusSessionPreferences` | M2 | spec_miner / plan |
| 3 | F-03 Background Engine & Timer | `FocusSessionManager` in service worker, `chrome.alarms` timer, runtime state machine | M3 | spec_miner / plan |
| 4 | F-04 Sound Connector | Auto-start/pause ambient sound track on focus state transitions | M4 | spec_miner / plan |
| 5 | F-05 Blocker Connector | Enforce active domain blocking during focus; retain blocking when paused | M4 | spec_miner / plan |
| 6 | F-06 Task Connector | Select task during setup, complete task, reflect task status in session | M4 | spec_miner / plan |
| 7 | F-07 Pomodoro Connector | Interlock with Pomodoro state machine to prevent concurrent sessions | M4 | spec_miner / plan |
| 8 | F-08 Setup Screen UI | Quick Start 25m, session customization, task selection, preset selection | M5 | spec_miner / plan |
| 9 | F-09 Active Session Screen UI | Timer display, progress indicator, pause/resume, abandon modal, linked task display | M6 | spec_miner / plan |
| 10 | F-10 Floating Widget UI | Compact overlay on home/other views showing live session state & quick controls | M6 | spec_miner / plan |
| 11 | F-11 Completion & Summary UI | Celebration animation/badge, summary metrics, break prompt, return home | M7 | spec_miner / plan |
| 12 | F-12 Break Mode UI & Engine | Break timer, option to skip break or enter break | M7 | spec_miner / plan |
| 13 | F-13 Neo-Brutalist Styling | Strictly enforce "Carnival" Neo-Brutalist design system across all UI components | M5, M6, M7 | spec_miner / plan |
| 14 | F-14 Idempotent Completion | Record completion exactly once per runtime session ID in history | M3, M7 | spec_miner / plan |
| 15 | F-15 Offline & Popup Resilience | Session state accurately survives popup close/reopen and service worker restart | M3, M6 | spec_miner / plan |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M_E2E | E2E Test Suite Track | Build opaque-box E2E tests & publish TEST_READY.md | none | DONE |
| M1 | Slice 1: Core Domain Model & Types | `src/core/focusSession.js`, `tests/focusSession.test.js` | none | DONE |
| M2 | Slice 2: State Persistence & Storage Schema | `src/core/focusStorage.js`, `tests/focusStorage.test.js` | M1 | PLANNED |
| M3 | Slice 3: Background Engine & Timer | `FocusSessionManager` in `src/background.js`, `tests/focusEngine.test.js` | M2 | PLANNED |
| M4 | Slice 4: Feature Connectors | Sound, Blocker, Task, Pomodoro connectors, `tests/focusConnectors.test.js` | M3 | PLANNED |
| M5 | Slice 5: Setup Screen UI | `src/components/focus/FocusSetup.jsx`, Neo-Brutalist design | M4 | PLANNED |
| M6 | Slice 6: Active Session & Floating Widget UI | `src/components/focus/FocusActive.jsx`, `FocusWidget.jsx` | M5 | PLANNED |
| M7 | Slice 7: Completion & Summary UI | `src/components/focus/FocusSummary.jsx`, Break flow | M6 | PLANNED |
| M8 | Final Integration & Coverage Hardening | Pass 100% tests, `npm test`, `npm run lint`, `npm run build`, adversarial testing | M7, M_E2E | PLANNED |

## Interface Contracts
### Storage Keys
- `activeFocusSession`: Runtime object or `null`
- `focusSessionTemplates`: Array of custom/default template objects
- `focusSessionHistory`: Array of completed/abandoned session logs
- `focusSessionPreferences`: User preference object (default duration, auto-break, etc.)

### Service Worker Message Protocol
- `FOCUS_GET_STATE`: Returns `{ activeSession, templates, preferences, history }`.
- `FOCUS_START_SESSION`: Input `{ templateId, durationMinutes, taskId, soundTrack, blockerEnabled }`.
- `FOCUS_PAUSE_SESSION`: Input `{ runtimeId }`.
- `FOCUS_RESUME_SESSION`: Input `{ runtimeId }`.
- `FOCUS_ABANDON_SESSION`: Input `{ runtimeId, reason }`.
- `FOCUS_START_BREAK`: Input `{ runtimeId, durationMinutes }`.
- `FOCUS_SKIP_BREAK`: Input `{ runtimeId }`.
- `FOCUS_UPDATE_PREFERENCES`: Input `{ preferences }`.

## Code Layout
- Domain logic: `src/core/focusSession.js`
- Storage logic: `src/core/focusStorage.js`
- Feature Connectors: `src/core/focusConnectors.js`
- Background Engine: `src/background.js` (`FocusSessionManager`)
- React Components: `src/components/focus/FocusSetup.jsx`, `FocusActive.jsx`, `FocusWidget.jsx`, `FocusSummary.jsx`, `FocusBreak.jsx`
- Home / App Integration: `src/App.jsx`, `src/pages/Home.jsx`
- Test Files: `tests/focusSession.test.js`, `tests/focusStorage.test.js`, `tests/focusEngine.test.js`, `tests/focusConnectors.test.js`, `tests/focusE2E.test.js`
