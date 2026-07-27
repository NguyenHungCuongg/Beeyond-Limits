import test from "node:test";
import assert from "node:assert/strict";

let serialTail = Promise.resolve();

const serialTest = (name, fn) =>
  test(name, async (...args) => {
    const previous = serialTail;
    let release;
    serialTail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn(...args);
    } finally {
      release();
    }
  });

function createMockChrome(initialStorage = {}) {
  const storageState = { ...initialStorage };
  const alarmsCreated = [];
  const alarmsCleared = [];
  const notificationsCreated = [];
  const broadcastMessages = [];
  const messageListeners = [];
  const alarmListeners = [];
  const startupListeners = [];
  const installedListeners = [];

  const chromeMock = {
    alarms: {
      onAlarm: {
        addListener(listener) {
          alarmListeners.push(listener);
        },
      },
      async create(name, alarmInfo) {
        alarmsCreated.push({ name, alarmInfo });
      },
      async clear(name) {
        alarmsCleared.push(name);
        return true;
      },
    },
    notifications: {
      async create(options) {
        notificationsCreated.push(options);
        return "notification_id";
      },
    },
    runtime: {
      getURL(path) {
        return `chrome-extension://test/${path}`;
      },
      async sendMessage(msg) {
        broadcastMessages.push(msg);
        return { success: true };
      },
      onMessage: {
        addListener(listener) {
          messageListeners.push(listener);
        },
      },
      onStartup: {
        addListener(listener) {
          startupListeners.push(listener);
        },
      },
      onInstalled: {
        addListener(listener) {
          installedListeners.push(listener);
        },
      },
    },
    storage: {
      local: {
        async get(keys) {
          if (Array.isArray(keys)) {
            return Object.fromEntries(
              keys
                .filter((key) => key in storageState)
                .map((key) => [key, storageState[key]])
            );
          }
          if (typeof keys === "string") {
            return keys in storageState ? { [keys]: storageState[keys] } : {};
          }
          return { ...storageState };
        },
        async set(values) {
          Object.assign(storageState, values);
        },
        async remove(keys) {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const k of keyList) {
            delete storageState[k];
          }
        },
      },
    },
  };

  return {
    chromeMock,
    storageState,
    alarmsCreated,
    alarmsCleared,
    notificationsCreated,
    broadcastMessages,
    messageListeners,
    alarmListeners,
    startupListeners,
    installedListeners,
  };
}

serialTest("SW Startup & Hydration: re-registers active alarm if phase ends in future", async () => {
  const futureTime = Date.now() + 600000;
  const initialSession = {
    id: "session_test_1",
    schemaVersion: 1,
    phase: "focus",
    status: "active_focus",
    startedAt: Date.now() - 300000,
    phaseStartedAt: Date.now() - 300000,
    phaseEndsAt: futureTime,
    durationSeconds: 900,
    remainingSeconds: 600,
    completedAt: null,
    abandonedAt: null,
    abandonReason: null,
    snapshot: { focusDuration: 15, breakDuration: 3 },
  };

  const mock = createMockChrome({
    activeFocusSession: initialSession,
  });

  globalThis.chrome = mock.chromeMock;

  const bg = await import(`../src/background.js?test_startup1=${Date.now()}`);
  await bg.focusManager.ready;

  assert.equal(mock.alarmsCreated.length, 1);
  assert.equal(mock.alarmsCreated[0].name, "focusSessionTimer");
  assert.equal(mock.alarmsCreated[0].alarmInfo.when, futureTime);

  delete globalThis.chrome;
});

serialTest("SW Startup & Hydration: catches up expired alarm if phase ends in past", async () => {
  const pastTime = Date.now() - 5000;
  const initialSession = {
    id: "session_test_expired",
    schemaVersion: 1,
    phase: "focus",
    status: "active_focus",
    startedAt: pastTime - 1500000,
    phaseStartedAt: pastTime - 1500000,
    phaseEndsAt: pastTime,
    durationSeconds: 1500,
    remainingSeconds: 0,
    completedAt: null,
    abandonedAt: null,
    abandonReason: null,
    snapshot: { focusDuration: 25, breakDuration: 5 },
  };

  const mock = createMockChrome({
    activeFocusSession: initialSession,
  });

  globalThis.chrome = mock.chromeMock;

  const bg = await import(`../src/background.js?test_startup2=${Date.now()}`);
  await bg.focusManager.ready;

  const history = mock.storageState.focusSessionHistory || [];
  assert.equal(history.length, 1);
  assert.equal(history[0].runtimeId, "session_test_expired");
  assert.equal(history[0].status, "focus_completed");
  assert.equal(mock.notificationsCreated.length, 1);

  delete globalThis.chrome;
});

serialTest("Message Handlers: handles FOCUS_GET_STATE, FOCUS_START_SESSION, FOCUS_PAUSE_SESSION, FOCUS_RESUME_SESSION, FOCUS_ABANDON_SESSION, FOCUS_START_BREAK, FOCUS_SKIP_BREAK, FOCUS_UPDATE_PREFERENCES", async () => {
  const mock = createMockChrome();
  globalThis.chrome = mock.chromeMock;

  await import(`../src/background.js?test_msg=${Date.now()}`);
  assert.equal(mock.messageListeners.length, 1);
  const listener = mock.messageListeners[0];

  const dispatch = (message) =>
    new Promise((resolve) => {
      const keepAlive = listener(message, {}, resolve);
      assert.equal(keepAlive, true);
    });

  // 1. FOCUS_GET_STATE
  const stateRes = await dispatch({ type: "FOCUS_GET_STATE" });
  assert.equal(stateRes.success, true);
  assert.equal(stateRes.activeSession, null);
  assert.ok(Array.isArray(stateRes.templates));
  assert.ok(Array.isArray(stateRes.history));

  // 2. FOCUS_START_SESSION
  const startRes = await dispatch({
    type: "FOCUS_START_SESSION",
    focusDuration: 25,
    breakDuration: 5,
    goal: { type: "text", text: "Write unit tests" },
  });
  assert.equal(startRes.success, true);
  assert.ok(startRes.activeSession);
  assert.equal(startRes.activeSession.status, "active_focus");
  const runtimeId = startRes.activeSession.id;

  // 3. FOCUS_PAUSE_SESSION
  const pauseRes = await dispatch({
    type: "FOCUS_PAUSE_SESSION",
    runtimeId,
  });
  assert.equal(pauseRes.success, true);
  assert.equal(pauseRes.activeSession.status, "paused_focus");
  assert.ok(mock.alarmsCleared.includes("focusSessionTimer"));

  // 4. FOCUS_RESUME_SESSION
  const resumeRes = await dispatch({
    type: "FOCUS_RESUME_SESSION",
    runtimeId,
  });
  assert.equal(resumeRes.success, true);
  assert.equal(resumeRes.activeSession.status, "active_focus");

  // 5. FOCUS_ABANDON_SESSION
  const abandonRes = await dispatch({
    type: "FOCUS_ABANDON_SESSION",
    runtimeId,
    reason: "interrupted",
  });
  assert.equal(abandonRes.success, true);
  assert.equal(abandonRes.activeSession, null);
  const abandonHistory = mock.storageState.focusSessionHistory;
  assert.equal(abandonHistory.length, 1);
  assert.equal(abandonHistory[0].runtimeId, runtimeId);
  assert.equal(abandonHistory[0].status, "abandoned");

  // Start new session for Break testing
  const start2Res = await dispatch({
    type: "FOCUS_START_SESSION",
    focusDuration: 15,
  });
  const runtimeId2 = start2Res.activeSession.id;

  // Complete session via alarm
  mock.alarmListeners[0]({ name: "focusSessionTimer" });
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 6. FOCUS_START_BREAK
  const breakRes = await dispatch({
    type: "FOCUS_START_BREAK",
    runtimeId: runtimeId2,
    durationMinutes: 5,
  });
  assert.equal(breakRes.success, true);
  assert.equal(breakRes.activeSession.status, "active_break");

  // 7. FOCUS_SKIP_BREAK
  const skipRes = await dispatch({
    type: "FOCUS_SKIP_BREAK",
    runtimeId: runtimeId2,
  });
  assert.equal(skipRes.success, true);
  assert.equal(skipRes.activeSession, null);

  // 8. FOCUS_UPDATE_PREFERENCES
  const prefRes = await dispatch({
    type: "FOCUS_UPDATE_PREFERENCES",
    preferences: { focusDuration: 30, breakDuration: 10 },
  });
  assert.equal(prefRes.success, true);
  assert.equal(prefRes.preferences.focusDuration, 30);
  assert.equal(prefRes.preferences.breakDuration, 10);

  delete globalThis.chrome;
});

serialTest("Alarm Triggers & Single-Flight Completion: triggers notification and is idempotent", async () => {
  const session = {
    id: "session_alarm_test",
    schemaVersion: 1,
    phase: "focus",
    status: "active_focus",
    startedAt: Date.now() - 1500000,
    phaseStartedAt: Date.now() - 1500000,
    phaseEndsAt: Date.now() - 100,
    durationSeconds: 1500,
    remainingSeconds: 0,
    completedAt: null,
    abandonedAt: null,
    abandonReason: null,
    snapshot: { focusDuration: 25, breakDuration: 5 },
  };

  const mock = createMockChrome({
    activeFocusSession: session,
  });

  globalThis.chrome = mock.chromeMock;

  const bg = await import(`../src/background.js?test_alarm=${Date.now()}`);
  await bg.focusManager.ready;

  // Trigger completion twice simultaneously
  const p1 = bg.focusManager.completeCurrentPhase();
  const p2 = bg.focusManager.completeCurrentPhase();
  const [res1, res2] = await Promise.all([p1, p2]);

  assert.equal(res1, res2);
  assert.equal(res1.success, true);
  assert.equal(res1.activeSession.status, "focus_completed");

  const history = mock.storageState.focusSessionHistory || [];
  assert.equal(history.length, 1);
  assert.equal(history[0].runtimeId, "session_alarm_test");

  // Attempting another completion after promise resolved should be idempotent via isDuplicateCompletion
  await bg.focusManager.completeCurrentPhase();
  const historyAfter = mock.storageState.focusSessionHistory || [];
  assert.equal(historyAfter.length, 1);

  delete globalThis.chrome;
});
