# Codebase Architecture Analysis — Beeyond Limits MVP

**Date**: 2026-07-27  
**Explorer**: Codebase Architecture Explorer (`explorer_p0_1`)  
**Scope**: Codebase layout, module boundaries, state management, storage schemas, background service worker, and message-passing mechanisms in `src/`.

---

## 1. Directory Structure & File Index

The repository follows a clean V3 Chrome Extension layout with React 19, Vite, and Tailwind CSS v4.

```text
F:\Chrome Extension Projects\Beeyond Limits\
├── manifest.json                # MV3 extension manifest (permissions, background worker, popup)
├── package.json                 # Node dependencies, scripts ("test": "node --test", "build": "vite build && ...")
├── index.html                   # Action popup HTML host mounting src/main.jsx
├── src/
│   ├── main.jsx                 # React entry point, renders <App /> into #root
│   ├── App.jsx                  # Single-page container owning navigation state ('home' | 'pomodoro' | ...)
│   ├── index.css                # Tailwind directives & Neo-Brutalist CSS rules (.brutal-border, .brutal-shadow)
│   ├── background.js            # MV3 Service Worker (Orchestrates Pomodoro, Blocker, Ambient Sounds, Alarms, Offscreen)
│   ├── offscreen.html           # HTML container for offscreen audio playback
│   ├── offscreen.js             # Offscreen script setting up message handler & audio controller
│   ├── blocked.html             # DNR redirect page when blocked website is accessed
│   ├── blocked.js               # Client script for blocked page
│   ├── core/                    # Domain logic & pure functions (decoupled from React)
│   │   ├── pomodoro.js          # Pure Pomodoro settings normalization, state restoration, phase completion
│   │   ├── blocking.js          # URL normalization, domain sanitization, DNR rule generation & application
│   │   ├── audio.js             # Audio clip selectors, offscreen controller, message handler factory
│   │   ├── offscreenBridge.js   # Offscreen document lifecycle helper (create/reuse & ping)
│   │   └── operationQueue.js    # Operation queue factory for serializing async background operations
│   ├── pages/                   # React view pages
│   │   ├── Home.jsx             # Feature index home page (FeatureCards 01-04 + DailyQuote)
│   │   ├── Pomodoro.jsx         # Pomodoro timer view (timer display, settings, controls)
│   │   ├── TaskList.jsx         # Task manager view (task input, filter, stats, list)
│   │   ├── WebsiteBlocker.jsx   # Website blocker view (domain input, block toggle, domain list)
│   │   └── AmbientSounds.jsx    # Ambient sound mixer view (6 sound controls + test/stop buttons)
│   ├── components/              # Reusable React components
│   │   ├── Icons.jsx            # Custom SVG icon set
│   │   ├── FeatureCard.jsx      # Home page feature action card
│   │   ├── DailyQuote.jsx       # Daily motivational quote display
│   │   ├── Timer.jsx            # SVG circular progress timer display
│   │   ├── SessionStats.jsx     # Completed Pomodoro sessions count card
│   │   ├── NumberSlider.jsx     # Custom slider for duration settings
│   │   ├── AudioControl.jsx     # Sound toggle & test audio component for Pomodoro
│   │   ├── Task.jsx             # Task item with edit/delete/checkbox
│   │   ├── TaskStats.jsx        # Task completion stats card
│   │   ├── BlockedURL.jsx       # Blocked domain card
│   │   ├── BlockerStats.jsx     # Blocker metrics card
│   │   └── VolumeSlider.jsx     # Sound volume slider
│   └── utils/
│       └── quotesUtils.js       # Daily quote loading & selection helper
├── public/                      # Static assets (icons, audio clips m4a, quotes.json)
└── tests/                       # Node built-in test runner unit/integration tests
    ├── backgroundStartup.test.js
    ├── blocking.test.js
    ├── manifest.test.js
    ├── offscreenAudio.test.js
    ├── offscreenBridge.test.js
    ├── operationQueue.test.js
    └── pomodoro.test.js
```

---

## 2. Module Boundaries & Existing Capabilities

### 2.1 Pomodoro Module
* **Domain (`src/core/pomodoro.js`)**:
  * `DEFAULT_POMODORO_SETTINGS`: `{ focusTime: 25, breakTime: 5, audioEnabled: true }`.
  * Pure functions handle setting normalization (`normalizePomodoroSettings`), state restoration (`restorePomodoroState`), and phase transitions (`completePomodoroPhase`).
* **Background Worker (`src/background.js` - `BackgroundPomodoroManager`)**:
  * Owns the timer state (`isActive`, `isBreak`, `currentTime`, `initialTime`, `phaseEndsAt`, `sessionCount`).
  * Uses `chrome.alarms` with alarm name `"pomodoroTimer"`.
  * Listens to alarm triggers and updates state asynchronously using `pomodoroOperationQueue`.
  * Broadcasts state changes to active listeners via message `POMODORO_STATE_UPDATE`.
* **UI (`src/pages/Pomodoro.jsx`)**:
  * Sends commands (`POMODORO_START`, `POMODORO_PAUSE`, `POMODORO_RESET`, `POMODORO_UPDATE_SETTINGS`, `POMODORO_GET_STATE`, `POMODORO_TEST_AUDIO`).
  * Polls background state every 1 second as fallback while active, and listens to `POMODORO_STATE_UPDATE`.

### 2.2 Tasks Module
* **Domain & UI (`src/pages/TaskList.jsx`)**:
  * Task object shape: `{ id: number|string, text: string, completed: boolean, createdAt: string, completedAt?: string|null }`.
  * Direct interaction with `chrome.storage.local` under the key `tasks`.
  * Fully isolated in React UI (`TaskList.jsx`). The background service worker currently has no task manager or task listeners.

### 2.3 Website Blocker Module
* **Domain (`src/core/blocking.js`)**:
  * Domain sanitization and normalization (`normalizeDomain`, `sanitizeBlockedUrls`). Removes scheme, `www.`, path, credentials, and validates domain rules.
  * Builds Manifest V3 `declarativeNetRequest` (DNR) dynamic redirect rules (redirecting main_frame requests matching domain to `/blocked.html`). Rule IDs start at `1000`.
  * Operations are atomic: DNR dynamic rules updated via `chrome.declarativeNetRequest.updateDynamicRules`.
* **Background Worker (`src/background.js`)**:
  * Serialized via `blockerOperationQueue`.
  * Synchronizes DNR rules on extension startup (`onStartup`) and install (`onInstalled`).
  * Handles message `UPDATE_BLOCKING_RULES`.
* **UI (`src/pages/WebsiteBlocker.jsx`)**:
  * Reads `blockedUrls` and `isBlocking` from `chrome.storage.local`.
  * Sends `UPDATE_BLOCKING_RULES` to trigger background rule updates and storage saves.

### 2.4 Ambient Sounds Module
* **Domain & Offscreen Bridge (`src/core/audio.js`, `src/core/offscreenBridge.js`)**:
  * 6 predefined ambient sound channels: `bird`, `campfire`, `ocean_waves`, `rain`, `thunder`, `wind`.
  * Offscreen document (`src/offscreen.html` & `src/offscreen.js`) hosts HTML5 `Audio` elements to comply with MV3 audio playback constraints in service workers.
  * Bridge auto-creates offscreen document if missing (`chrome.offscreen.createDocument`) and verifies readiness using ping-pong messages.
* **Background Worker (`src/background.js` - `AmbientSoundManager`)**:
  * Manages setting defaults: `{ enabled: false, volume: 50 }` for each sound channel.
  * Handles messages: `AMBIENT_UPDATE_SETTINGS`, `AMBIENT_TEST_SOUND`, `AMBIENT_STOP_ALL`.
  * Operations serialized via `ambientOperationQueue`.
* **UI (`src/pages/AmbientSounds.jsx`)**:
  * Reads `ambientSettings` from `chrome.storage.local`.
  * Sends settings update messages to background worker.

---

## 3. Storage Schemas & Persistence Patterns

All extension persistence currently uses `chrome.storage.local` (with `localStorage` fallbacks in React views when `chrome.storage.local` is unavailable in dev mode).

### Existing Storage Keys & Schemas

| Storage Key | Data Structure / Schema | Owned / Managed By |
|-------------|-------------------------|--------------------|
| `pomodoroState` | `{ isActive: boolean, isBreak: boolean, currentTime: number, initialTime: number, phaseEndsAt: number\|null, sessionCount: number, lastUpdated: number }` | `BackgroundPomodoroManager` (`src/background.js`) |
| `pomodoroSettings` | `{ focusTime: number, breakTime: number, audioEnabled: boolean }` | `BackgroundPomodoroManager` (`src/background.js`) |
| `tasks` | `Array<{ id: number\|string, text: string, completed: boolean, createdAt: string, completedAt?: string\|null }>` | `TaskList.jsx` |
| `blockedUrls` | `Array<{ id: number\|string, url: string, createdAt: string }>` | `blocking.js` / `src/background.js` / `WebsiteBlocker.jsx` |
| `isBlocking` | `boolean` | `blocking.js` / `src/background.js` / `WebsiteBlocker.jsx` |
| `ambientSettings` | `Record<SoundKey, { enabled: boolean, volume: number }>` where `SoundKey` is one of `bird`, `campfire`, `ocean_waves`, `rain`, `thunder`, `wind` | `AmbientSoundManager` (`src/background.js`) |

### Proposed New Storage Keys for Focus Session MVP
As specified in `docs/specs/focus-session-ux-spec.md` and `tasks/plan.md`:
* `focusSessionTemplates`: Array of reusable session templates.
* `activeFocusSession`: Active session runtime snapshot & current state.
* `focusSessionHistory`: Array of completed focus interval logs.
* `focusSessionPreferences`: Last used quick session preferences.

Existing keys must be strictly preserved without breaking current tool operation.

---

## 4. Communication & Messaging Patterns

### 4.1 Request-Response Channel (`chrome.runtime.sendMessage`)
Messages sent from UI pages or offscreen bridge follow this format:

```js
// Example from UI component
const response = await chrome.runtime.sendMessage({
  type: "COMMAND_NAME",
  ...payload,
});
```

Background listener (`src/background.js`):
```js
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target === "offscreen") {
    return false; // Handled by offscreen script
  }
  
  switch (message.type) {
    case "SOME_ACTION":
      return respond(sendResponse, operationQueue.run(() => handleAction(message)));
    // ...
  }
});
```
The helper function `respond(sendResponse, promise)` returns `true` to keep the async response channel open, resolving `{ success: true, ... }` or `{ success: false, error: string }`.

### 4.2 State Broadcasting Channel
When background state changes autonomously (e.g. Pomodoro timer alarm completion), background worker broadcasts state:
```js
chrome.runtime.sendMessage({
  type: "POMODORO_STATE_UPDATE",
  state: this.getState(),
}).catch(() => {
  // Ignored if popup is closed and no listener exists
});
```

### 4.3 Offscreen Document Routing
Messages target offscreen document by adding `target: "offscreen"`:
```js
chrome.runtime.sendMessage({
  type: "START_AMBIENT_SOUND",
  target: "offscreen",
  soundKey: "rain",
  audioUrl: "...",
  volume: 0.5,
});
```
`offscreen.js` listens to `chrome.runtime.onMessage` and filters for `message.target === "offscreen"`.

---

## 5. Summary of Architectural Considerations for Focus Session Integration

1. **Background as Authoritative Session Orchestration Layer**:
   `FocusSessionManager` must be added to `src/background.js` (or imported into background worker from `src/core/focusSessionManager.js`). It will coordinate Pomodoro timer alarms, DNR blocking rules, and offscreen ambient audio.
2. **Transactional State Modifications with Rollback**:
   When starting a Focus Session, activating timer, blocker, and ambient sound must be performed atomically. If any component fails, applied changes must roll back.
3. **Restoration of Independent Tool Settings**:
   Before starting a session, previous blocker/ambient states must be captured so stopping/finishing a session restores original independent-tool state.
4. **Idempotent Focus Interval Completion**:
   Focus completion records must be keyed by unique runtime ID (`runtime.id`) to prevent duplicate recordings upon background alarms or service worker restarts.
