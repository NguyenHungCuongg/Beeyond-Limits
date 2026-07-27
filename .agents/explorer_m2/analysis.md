# Milestone 2 Blueprint & Analysis Report: State Persistence & Storage Schema

**Author**: Milestone 2 Persistence Explorer  
**Date**: 2026-07-27  
**Scope**: Milestone 2 (Slice 2: State Persistence & Storage Schema)  
**Target Files**: `src/core/focusStorage.js`, `tests/focusStorage.test.js`

---

## 1. Executive Summary

Milestone 2 establishes the storage and persistence layer for the **Focus Session** feature in Beeyond Limits. It defines `src/core/focusStorage.js` and its corresponding unit test suite `tests/focusStorage.test.js`.

The storage module bridges the pure domain logic in `src/core/focusSession.js` with Chrome's asynchronous `chrome.storage.local` API (or mock injection in tests). It manages four distinct storage keys while guaranteeing that existing Chrome storage data (`tasks`, `blockedUrls`, `isBlocking`, `ambientSettings`, `pomodoroSettings`, `pomodoroState`) remains completely untouched and functional.

---

## 2. Architecture & Storage Schema

### 2.1 Storage Keys Contract

The storage module exports a frozen dictionary `STORAGE_KEYS`:

```javascript
export const STORAGE_KEYS = Object.freeze({
  ACTIVE_SESSION: "activeFocusSession",
  TEMPLATES: "focusSessionTemplates",
  HISTORY: "focusSessionHistory",
  PREFERENCES: "focusSessionPreferences",
});
```

### 2.2 Storage Data Schemas

1. **`activeFocusSession`**
   - **Type**: `Object | null`
   - **Default**: `null`
   - **Description**: Authoritative runtime snapshot managed by background service worker.
   - **Shape**:
     ```javascript
     {
       id: "session_1722086400000_abc12",
       schemaVersion: 1,
       templateId: "template_quick_25" | null,
       snapshot: {
         focusDuration: 25,
         breakDuration: 5,
         goal: { type: "task", text: "Task Title", taskId: 101 },
         blocker: { enabled: true, presetId: "default" },
         ambientSound: { enabled: true, soundId: "rain", volume: 50 }
       },
       goal: { type: "task", text: "Task Title", taskId: 101 },
       phase: "focus" | "break",
       status: "active_focus" | "paused_focus" | "focus_completed" | "active_break" | "paused_break" | "break_completed" | "abandoned",
       startedAt: 1722086400000,
       phaseStartedAt: 1722086400000,
       phaseEndsAt: 1722087900000 | null,
       durationSeconds: 1500,
       remainingSeconds: 1500,
       completedAt: null | 1722087900000,
       abandonedAt: null | 1722086500000,
       abandonReason: null | "user_stopped",
       preSessionState: null | Object
     }
     ```

2. **`focusSessionTemplates`**
   - **Type**: `Array<TemplateObject>`
   - **Default**: Seeded from `DEFAULT_TEMPLATES` (`template_quick_25`, `template_deep_50`, `template_sprint_15`).
   - **Shape**:
     ```javascript
     {
       id: "template_custom_1722086400000",
       name: "My Custom Template",
       focusDuration: 45,
       breakDuration: 10,
       goal: { type: "text", text: "Deep Reading", taskId: null },
       blocker: { enabled: true, presetId: "default" },
       ambientSound: { enabled: true, soundId: "rain", volume: 60 },
       isDefault: false,
       createdAt: 1722086400000,
       updatedAt: 1722086400000
     }
     ```

3. **`focusSessionHistory`**
   - **Type**: `Array<HistoryRecord>`
   - **Default**: `[]`
   - **Shape**:
     ```javascript
     {
       id: "history_session_1722086400000_abc12",
       runtimeId: "session_1722086400000_abc12",
       dateStr: "2026-07-27",
       status: "focus_completed" | "abandoned",
       focusDurationMinutes: 25,
       actualFocusSeconds: 1500,
       startedAt: 1722086400000,
       completedAt: 1722087900000,
       abandonedAt: null,
       goal: { type: "task", text: "Task Title", taskId: 101 },
       templateId: "template_quick_25"
     }
     ```

4. **`focusSessionPreferences`**
   - **Type**: `Object`
   - **Default**: Merged with `DEFAULT_FOCUS_SETTINGS`.
   - **Shape**:
     ```javascript
     {
       focusDuration: 25,
       breakDuration: 5,
       blockerEnabled: true,
       ambientSound: {
         enabled: false,
         soundId: null,
         volume: 50
       }
     }
     ```

---

## 3. Storage Module Detailed Design (`src/core/focusStorage.js`)

### 3.1 Dependency Injection Pattern
All accessors accept `chromeStorageApi` as an optional parameter:
```javascript
function getStorage(chromeStorageApi) {
  const api = chromeStorageApi || globalThis.chrome?.storage?.local;
  if (!api || typeof api.get !== "function" || typeof api.set !== "function") {
    throw new Error("Chrome storage API is unavailable");
  }
  return api;
}
```

### 3.2 Accessor Function Specifications

1. **`getActiveFocusSession(chromeStorageApi)`**
   - **Operation**: `api.get(STORAGE_KEYS.ACTIVE_SESSION)`
   - **Behavior**: Returns the active session object or `null` if unset/missing.

2. **`setActiveFocusSession(session, chromeStorageApi)`**
   - **Operation**: `api.set({ [STORAGE_KEYS.ACTIVE_SESSION]: session })`
   - **Behavior**: Saves `session` object to storage. Returns the saved session.

3. **`clearActiveFocusSession(chromeStorageApi)`**
   - **Operation**: `api.remove(STORAGE_KEYS.ACTIVE_SESSION)` (or `set({ [STORAGE_KEYS.ACTIVE_SESSION]: null })`)
   - **Behavior**: Removes active session key. Returns `true`.

4. **`getFocusTemplates(chromeStorageApi)`**
   - **Operation**: `api.get(STORAGE_KEYS.TEMPLATES)`
   - **Behavior**: Returns stored array if present; if uninitialized or non-array, returns `DEFAULT_TEMPLATES`.

5. **`saveFocusTemplate(template, chromeStorageApi)`**
   - **Operation**: Reads existing templates via `getFocusTemplates`. Normalizes template fields (trims name max 40 chars, clamps focus/break duration, normalizes blocker and sound).
   - **ID & Collision Handling**: If `template.id` exists and matches an existing template in storage, updates it in-place and updates `updatedAt`. If no `template.id` or no match, generates new ID `template_${Date.now()}_${random}` and sets `createdAt`/`updatedAt`.
   - **Persistence**: Writes updated array to `focusSessionTemplates`.
   - **Returns**: The saved template object.

6. **`deleteFocusTemplate(templateId, chromeStorageApi)`**
   - **Operation**: Reads templates via `getFocusTemplates`. Filters out matching `templateId`.
   - **Persistence**: If filtered array length < original length, writes updated array and returns `true`. Otherwise returns `false`.

7. **`getFocusHistory(chromeStorageApi)`**
   - **Operation**: `api.get(STORAGE_KEYS.HISTORY)`
   - **Behavior**: Returns stored array if present; if uninitialized or non-array, returns `[]`.

8. **`appendFocusHistory(historyRecord, chromeStorageApi)`**
   - **Operation**: Reads history via `getFocusHistory`. Checks `isDuplicateCompletion(history, historyRecord.runtimeId || historyRecord.id)`.
   - **Idempotency**: If duplicate completion, returns existing history without modification.
   - **Enrichment**: Ensures `dateStr` is populated (e.g. `getLocalDateString(record.completedAt || Date.now())`).
   - **Auto-pruning**: Invokes `pruneHistoryRecords(updatedHistory, 90, 500)` before persisting.
   - **Persistence**: Writes pruned history array to `focusSessionHistory`.
   - **Returns**: Updated history array.

9. **`getFocusPreferences(chromeStorageApi)`**
   - **Operation**: `api.get(STORAGE_KEYS.PREFERENCES)`
   - **Behavior**: Merges stored preferences object with `DEFAULT_FOCUS_SETTINGS` to guarantee complete schema. Returns merged preferences.

10. **`updateFocusPreferences(newPreferences, chromeStorageApi)`**
    - **Operation**: Reads existing preferences. Performs deep merge with `newPreferences`.
    - **Normalization**: Clamps durations (focus 5–120m, break 1–30m, volume 0–100).
    - **Persistence**: Writes merged preferences to `focusSessionPreferences`.
    - **Returns**: Updated preferences object.

11. **`initializeFocusStorage(chromeStorageApi)`**
    - **Operation**: Performs `api.get([STORAGE_KEYS.ACTIVE_SESSION, STORAGE_KEYS.TEMPLATES, STORAGE_KEYS.HISTORY, STORAGE_KEYS.PREFERENCES])`.
    - **Safety Guarantee**: ONLY sets default values for keys that are `undefined` in storage. NEVER overwrites existing user templates, history, active session, or preferences.
    - **Initial Values**:
      - `activeFocusSession`: `null` (not written if absent unless explicitly setting default state).
      - `focusSessionTemplates`: `DEFAULT_TEMPLATES` (written if key undefined).
      - `focusSessionHistory`: `[]` (written if key undefined).
      - `focusSessionPreferences`: `DEFAULT_FOCUS_SETTINGS` (written if key undefined).
    - **Returns**: Object with current state `{ activeFocusSession, focusSessionTemplates, focusSessionHistory, focusSessionPreferences }`.

---

## 4. TDD Test Specifications (`tests/focusStorage.test.js`)

### 4.1 Mock Storage Implementation
Tests rely on Node's native test runner (`node:test`) and strict assertions (`node:assert/strict`).

```javascript
function createMockStorage(initialData = {}) {
  const store = new Map(Object.entries(initialData));

  return {
    async get(keys) {
      if (keys === null || keys === undefined) {
        return Object.fromEntries(store.entries());
      }
      if (typeof keys === "string") {
        return store.has(keys) ? { [keys]: store.get(keys) } : {};
      }
      if (Array.isArray(keys)) {
        const result = {};
        for (const k of keys) {
          if (store.has(k)) result[k] = store.get(k);
        }
        return result;
      }
      if (typeof keys === "object") {
        const result = {};
        for (const [k, defaultVal] of Object.entries(keys)) {
          result[k] = store.has(k) ? store.get(k) : defaultVal;
        }
        return result;
      }
      return {};
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) {
        store.set(k, v);
      }
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) {
        store.delete(k);
      }
    },
    _getRaw(key) {
      return store.get(key);
    },
    _has(key) {
      return store.has(key);
    }
  };
}
```

### 4.2 Test Suite Structure & Concrete Scenarios

#### Suite 1: Storage Initialization & Default Seeding
- `initializeFocusStorage populates empty storage with defaults without throwing`
- `initializeFocusStorage preserves existing user templates and custom preferences`
- `initializeFocusStorage does not overwrite an existing active session`

#### Suite 2: Active Session Persistence (CRUD)
- `getActiveFocusSession returns null when storage is uninitialized`
- `setActiveFocusSession persists runtime session object`
- `clearActiveFocusSession removes active session from storage`

#### Suite 3: Focus Templates Access & Mutations
- `getFocusTemplates returns DEFAULT_TEMPLATES when storage is empty`
- `saveFocusTemplate creates a new template with generated ID when ID is omitted`
- `saveFocusTemplate updates existing template when ID matches (collision handling)`
- `saveFocusTemplate normalizes name length and clamps duration bounds`
- `deleteFocusTemplate removes template by ID and returns true`
- `deleteFocusTemplate returns false when template ID does not exist`

#### Suite 4: Focus History & Auto-Pruning
- `getFocusHistory returns empty array when uninitialized`
- `appendFocusHistory adds history record and auto-generates dateStr if missing`
- `appendFocusHistory ignores duplicate completion records with same runtimeId (idempotency)`
- `appendFocusHistory prunes records older than 90 days or exceeding 500 entries`

#### Suite 5: Preferences Persistence & Merging
- `getFocusPreferences returns DEFAULT_FOCUS_SETTINGS when uninitialized`
- `updateFocusPreferences merges partial updates into existing preferences`
- `updateFocusPreferences clamps out-of-bound duration and volume settings`

#### Suite 6: API Safety & Dependency Injection Edge Cases
- `accessors throw descriptive error if chromeStorageApi is missing`
- `accessors function correctly with injected mock storage`

---

## 5. Implementation Blueprint

### 5.1 Code Structure for `src/core/focusStorage.js`

```javascript
/**
 * src/core/focusStorage.js
 * Storage accessors & schema persistence for Focus Sessions in chrome.storage.local.
 */

import {
  DEFAULT_TEMPLATES,
  DEFAULT_FOCUS_SETTINGS,
  normalizeFocusConfig,
  pruneHistoryRecords,
  isDuplicateCompletion,
  FOCUS_BOUNDS,
} from "./focusSession.js";

export const STORAGE_KEYS = Object.freeze({
  ACTIVE_SESSION: "activeFocusSession",
  TEMPLATES: "focusSessionTemplates",
  HISTORY: "focusSessionHistory",
  PREFERENCES: "focusSessionPreferences",
});

function getStorage(chromeStorageApi) {
  const api = chromeStorageApi || globalThis.chrome?.storage?.local;
  if (!api || typeof api.get !== "function" || typeof api.set !== "function") {
    throw new Error("Chrome storage API is unavailable");
  }
  return api;
}

export async function getActiveFocusSession(chromeStorageApi) {
  const storage = getStorage(chromeStorageApi);
  const data = await storage.get(STORAGE_KEYS.ACTIVE_SESSION);
  return data[STORAGE_KEYS.ACTIVE_SESSION] ?? null;
}

export async function setActiveFocusSession(session, chromeStorageApi) {
  const storage = getStorage(chromeStorageApi);
  await storage.set({ [STORAGE_KEYS.ACTIVE_SESSION]: session });
  return session;
}

export async function clearActiveFocusSession(chromeStorageApi) {
  const storage = getStorage(chromeStorageApi);
  if (typeof storage.remove === "function") {
    await storage.remove(STORAGE_KEYS.ACTIVE_SESSION);
  } else {
    await storage.set({ [STORAGE_KEYS.ACTIVE_SESSION]: null });
  }
  return true;
}

export async function getFocusTemplates(chromeStorageApi) {
  const storage = getStorage(chromeStorageApi);
  const data = await storage.get(STORAGE_KEYS.TEMPLATES);
  const templates = data[STORAGE_KEYS.TEMPLATES];
  return Array.isArray(templates) ? templates : DEFAULT_TEMPLATES;
}

export async function saveFocusTemplate(template, chromeStorageApi) {
  const storage = getStorage(chromeStorageApi);
  const currentTemplates = await getFocusTemplates(chromeStorageApi);

  const rawName = typeof template?.name === "string" ? template.name.trim() : "Untitled Template";
  const name = rawName.slice(0, FOCUS_BOUNDS.MAX_TEMPLATE_NAME_LENGTH) || "Untitled Template";

  const normalizedConfig = normalizeFocusConfig(template);
  const now = Date.now();

  let templateId = template?.id;
  const existingIndex = templateId ? currentTemplates.findIndex((t) => t.id === templateId) : -1;

  let savedTemplate;
  const updatedTemplates = [...currentTemplates];

  if (existingIndex >= 0) {
    savedTemplate = {
      ...updatedTemplates[existingIndex],
      name,
      focusDuration: normalizedConfig.focusDuration,
      breakDuration: normalizedConfig.breakDuration,
      goal: normalizedConfig.goal,
      blocker: normalizedConfig.blocker,
      ambientSound: normalizedConfig.ambientSound,
      updatedAt: now,
    };
    updatedTemplates[existingIndex] = savedTemplate;
  } else {
    templateId = templateId || `template_${now}_${Math.random().toString(36).slice(2, 7)}`;
    savedTemplate = {
      id: templateId,
      name,
      focusDuration: normalizedConfig.focusDuration,
      breakDuration: normalizedConfig.breakDuration,
      goal: normalizedConfig.goal,
      blocker: normalizedConfig.blocker,
      ambientSound: normalizedConfig.ambientSound,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };
    updatedTemplates.push(savedTemplate);
  }

  await storage.set({ [STORAGE_KEYS.TEMPLATES]: updatedTemplates });
  return savedTemplate;
}

export async function deleteFocusTemplate(templateId, chromeStorageApi) {
  const storage = getStorage(chromeStorageApi);
  const currentTemplates = await getFocusTemplates(chromeStorageApi);

  const filtered = currentTemplates.filter((t) => t.id !== templateId);
  if (filtered.length === currentTemplates.length) {
    return false;
  }

  await storage.set({ [STORAGE_KEYS.TEMPLATES]: filtered });
  return true;
}

export async function getFocusHistory(chromeStorageApi) {
  const storage = getStorage(chromeStorageApi);
  const data = await storage.get(STORAGE_KEYS.HISTORY);
  const history = data[STORAGE_KEYS.HISTORY];
  return Array.isArray(history) ? history : [];
}

export async function appendFocusHistory(historyRecord, chromeStorageApi) {
  const storage = getStorage(chromeStorageApi);
  const currentHistory = await getFocusHistory(chromeStorageApi);

  if (!historyRecord || typeof historyRecord !== "object") {
    return currentHistory;
  }

  const runtimeId = historyRecord.runtimeId || historyRecord.id;
  if (runtimeId && isDuplicateCompletion(currentHistory, runtimeId)) {
    return currentHistory;
  }

  const now = Date.now();
  const recordTime = historyRecord.completedAt || historyRecord.abandonedAt || historyRecord.startedAt || now;
  const d = new Date(recordTime);
  const dateStr =
    historyRecord.dateStr ||
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const enrichedRecord = {
    ...historyRecord,
    id: historyRecord.id || `history_${runtimeId || now}`,
    runtimeId: runtimeId || null,
    dateStr,
  };

  const updatedHistory = [...currentHistory, enrichedRecord];
  const pruned = pruneHistoryRecords(updatedHistory, 90, 500, now);

  await storage.set({ [STORAGE_KEYS.HISTORY]: pruned });
  return pruned;
}

export async function getFocusPreferences(chromeStorageApi) {
  const storage = getStorage(chromeStorageApi);
  const data = await storage.get(STORAGE_KEYS.PREFERENCES);
  const storedPrefs = data[STORAGE_KEYS.PREFERENCES];

  if (!storedPrefs || typeof storedPrefs !== "object") {
    return DEFAULT_FOCUS_SETTINGS;
  }

  return {
    ...DEFAULT_FOCUS_SETTINGS,
    ...storedPrefs,
    ambientSound: {
      ...DEFAULT_FOCUS_SETTINGS.ambientSound,
      ...(storedPrefs.ambientSound || {}),
    },
  };
}

export async function updateFocusPreferences(newPreferences, chromeStorageApi) {
  const storage = getStorage(chromeStorageApi);
  const currentPrefs = await getFocusPreferences(chromeStorageApi);

  const merged = {
    ...currentPrefs,
    ...newPreferences,
    ambientSound: {
      ...currentPrefs.ambientSound,
      ...(newPreferences?.ambientSound || {}),
    },
  };

  const normalizedConfig = normalizeFocusConfig(merged);

  const updatedPrefs = {
    focusDuration: normalizedConfig.focusDuration,
    breakDuration: normalizedConfig.breakDuration,
    blockerEnabled: normalizedConfig.blocker.enabled,
    ambientSound: normalizedConfig.ambientSound,
  };

  await storage.set({ [STORAGE_KEYS.PREFERENCES]: updatedPrefs });
  return updatedPrefs;
}

export async function initializeFocusStorage(chromeStorageApi) {
  const storage = getStorage(chromeStorageApi);
  const data = await storage.get([
    STORAGE_KEYS.ACTIVE_SESSION,
    STORAGE_KEYS.TEMPLATES,
    STORAGE_KEYS.HISTORY,
    STORAGE_KEYS.PREFERENCES,
  ]);

  const updates = {};

  if (data[STORAGE_KEYS.ACTIVE_SESSION] === undefined) {
    // Active session defaults to null
    data[STORAGE_KEYS.ACTIVE_SESSION] = null;
  }

  if (!Array.isArray(data[STORAGE_KEYS.TEMPLATES])) {
    updates[STORAGE_KEYS.TEMPLATES] = DEFAULT_TEMPLATES;
    data[STORAGE_KEYS.TEMPLATES] = DEFAULT_TEMPLATES;
  }

  if (!Array.isArray(data[STORAGE_KEYS.HISTORY])) {
    updates[STORAGE_KEYS.HISTORY] = [];
    data[STORAGE_KEYS.HISTORY] = [];
  }

  if (!data[STORAGE_KEYS.PREFERENCES] || typeof data[STORAGE_KEYS.PREFERENCES] !== "object") {
    updates[STORAGE_KEYS.PREFERENCES] = DEFAULT_FOCUS_SETTINGS;
    data[STORAGE_KEYS.PREFERENCES] = DEFAULT_FOCUS_SETTINGS;
  }

  if (Object.keys(updates).length > 0) {
    await storage.set(updates);
  }

  return {
    activeFocusSession: data[STORAGE_KEYS.ACTIVE_SESSION] ?? null,
    focusSessionTemplates: data[STORAGE_KEYS.TEMPLATES],
    focusSessionHistory: data[STORAGE_KEYS.HISTORY],
    focusSessionPreferences: data[STORAGE_KEYS.PREFERENCES],
  };
}
```

---

## 6. Verification Method

Once implemented by the Implementer agent, Milestone 2 can be verified with:

1. **Unit Test Command**:
   ```powershell
   node --test tests/focusStorage.test.js
   ```
2. **Full Suite & Integrity Checks**:
   ```powershell
   npm test
   npm run lint
   npm run build
   ```

---

## 7. Conclusion & Next Steps for Implementer

- Milestone 2 is scoped strictly to `src/core/focusStorage.js` and `tests/focusStorage.test.js`.
- All requirements T04-T06 underlying storage prerequisites are satisfied by this design.
- The Implementer should write failing TDD unit tests first in `tests/focusStorage.test.js`, then implement `src/core/focusStorage.js` to satisfy all test cases.
