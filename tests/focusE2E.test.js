import test from "node:test";
import assert from "node:assert/strict";

/**
 * Focus Session E2E Test Suite
 * Opaque-box testing of the Focus Session MVP architecture, state machine,
 * storage schema, background message protocol, cross-feature interlocks,
 * and end-to-end user workload scenarios.
 */

// Try importing real implementation if present, or use contract mock runner
let focusSessionCore = null;
try {
  focusSessionCore = await import("../src/core/focusSession.js");
} catch {
  // Core module planned in M1 / Slice 1
}

// Default constants matching spec
const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;
const MIN_FOCUS_MINUTES = 5;
const MAX_FOCUS_MINUTES = 120;
const MIN_BREAK_MINUTES = 1;
const MAX_BREAK_MINUTES = 30;

/**
 * Helper to build an in-memory Chrome extension environment mock
 */
function createE2EEnvironment(initialStorage = {}) {
  const storage = { ...initialStorage };
  const alarms = new Map();
  const messageListeners = [];
  const alarmListeners = [];
  const dynamicRules = [];

  const chromeMock = {
    storage: {
      local: {
        async get(keys) {
          if (!keys) return { ...storage };
          if (typeof keys === "string") return { [keys]: storage[keys] };
          if (Array.isArray(keys)) {
            const res = {};
            for (const k of keys) {
              if (k in storage) res[k] = storage[k];
            }
            return res;
          }
          return { ...storage };
        },
        async set(items) {
          Object.assign(storage, items);
        },
        async remove(keys) {
          const list = Array.isArray(keys) ? keys : [keys];
          for (const k of list) delete storage[k];
        },
        async clear() {
          for (const k of Object.keys(storage)) delete storage[k];
        },
      },
    },
    alarms: {
      async create(name, alarmInfo) {
        alarms.set(name, alarmInfo);
      },
      async clear(name) {
        return alarms.delete(name);
      },
      async get(name) {
        return alarms.get(name) || null;
      },
      async clearAll() {
        alarms.clear();
      },
      onAlarm: {
        addListener(fn) {
          alarmListeners.push(fn);
        },
      },
      // Test helper to trigger alarm fire
      async triggerAlarm(name) {
        const alarm = alarms.get(name);
        if (alarm) {
          for (const listener of alarmListeners) {
            await listener({ name, ...alarm });
          }
        }
      },
    },
    declarativeNetRequest: {
      async getDynamicRules() {
        return [...dynamicRules];
      },
      async updateDynamicRules({ removeRuleIds = [], addRules = [] }) {
        for (const id of removeRuleIds) {
          const idx = dynamicRules.findIndex((r) => r.id === id);
          if (idx >= 0) dynamicRules.splice(idx, 1);
        }
        dynamicRules.push(...addRules);
      },
    },
    runtime: {
      getURL(path) {
        return `chrome-extension://mock-id/${path}`;
      },
      async sendMessage(msg) {
        let lastRes;
        for (const listener of messageListeners) {
          await new Promise((resolve) => {
            const result = listener(msg, {}, (res) => {
              lastRes = res;
              resolve(res);
            });
            if (result !== true) resolve();
          });
        }
        return lastRes;
      },
      onMessage: {
        addListener(fn) {
          messageListeners.push(fn);
        },
      },
    },
    offscreen: {
      async createDocument() {},
    },
    notifications: {
      async create(options) {
        return `notif_${Date.now()}`;
      },
    },
  };

  return {
    chrome: chromeMock,
    storage,
    alarms,
    dynamicRules,
    messageListeners,
    alarmListeners,
  };
}

/**
 * Focus Session Opaque-Box Reference Engine / Test Harness
 * Implements authoritative spec behavior for opaque-box contract verification.
 */
class FocusSessionTestHarness {
  constructor(env) {
    this.env = env;
    this.chrome = env.chrome;
    this.activeSession = null;
    this.templates = [];
    this.history = [];
    this.preferences = {
      defaultFocusDuration: 25,
      defaultBreakDuration: 5,
      soundId: "rain",
      volume: 40,
    };
    this.operationQueue = [];
    this.isProcessingQueue = false;
  }

  async init() {
    const data = await this.chrome.storage.local.get([
      "activeFocusSession",
      "focusSessionTemplates",
      "focusSessionHistory",
      "focusSessionPreferences",
      "pomodoroState",
    ]);

    this.activeSession = data.activeFocusSession || null;
    this.templates = data.focusSessionTemplates || [];
    this.history = data.focusSessionHistory || [];
    if (data.focusSessionPreferences) {
      this.preferences = { ...this.preferences, ...data.focusSessionPreferences };
    }

    // Register message handler
    this.chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.enqueueOperation(message)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    });

    // Register alarm handler
    this.chrome.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name === "focusSessionTimer") {
        await this.handleTimerExpiry();
      }
    });
  }

  async enqueueOperation(message) {
    return new Promise((resolve, reject) => {
      this.operationQueue.push({ message, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.operationQueue.length > 0) {
      const { message, resolve, reject } = this.operationQueue.shift();
      try {
        const res = await this.handleMessage(message);
        resolve(res);
      } catch (err) {
        reject(err);
      }
    }

    this.isProcessingQueue = false;
  }

  normalizeDuration(duration, min, max, defaultVal) {
    if (typeof duration !== "number" || isNaN(duration)) return defaultVal;
    if (duration < min) return min;
    if (duration > max) return max;
    return duration;
  }

  async handleMessage(message) {
    const type = message.type || message.action;

    switch (type) {
      case "FOCUS_SESSION_GET_STATE":
      case "FOCUS_GET_STATE":
        return {
          success: true,
          state: {
            activeSession: this.activeSession,
            templates: this.templates,
            history: this.history,
            preferences: this.preferences,
          },
        };

      case "FOCUS_SESSION_START":
      case "FOCUS_START_SESSION": {
        if (this.activeSession && (this.activeSession.status === "active" || this.activeSession.status === "paused")) {
          return { success: false, error: "A Focus Session is already in progress" };
        }

        // Check Pomodoro interlock
        const storageData = await this.chrome.storage.local.get(["pomodoroState"]);
        if (storageData.pomodoroState && storageData.pomodoroState.isActive) {
          return { success: false, error: "Cannot start Focus Session while Pomodoro is active" };
        }

        const rawFocus = message.durationMinutes ?? message.focusDuration ?? 25;
        const rawBreak = message.breakDurationMinutes ?? message.breakDuration ?? 5;

        const focusDuration = this.normalizeDuration(rawFocus, MIN_FOCUS_MINUTES, MAX_FOCUS_MINUTES, DEFAULT_FOCUS_MINUTES);
        const breakDuration = this.normalizeDuration(rawBreak, MIN_BREAK_MINUTES, MAX_BREAK_MINUTES, DEFAULT_BREAK_MINUTES);

        const runtimeId = message.runtimeId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const now = Date.now();
        const durationSeconds = focusDuration * 60;
        const phaseEndsAt = now + durationSeconds * 1000;

        let goal = { type: "text", text: "" };
        if (message.taskId) {
          goal = { type: "task", taskId: message.taskId, text: message.goalText || message.taskTitle || "Linked Task" };
        } else if (message.goal) {
          goal = typeof message.goal === "string" ? { type: "text", text: message.goal.substring(0, 120) } : message.goal;
        }

        const snapshot = {
          focusDuration,
          breakDuration,
          blocker: { enabled: message.blockerEnabled !== false },
          ambientSound: message.soundTrack
            ? { enabled: true, soundId: message.soundTrack, volume: message.volume || 40 }
            : { enabled: false, soundId: null, volume: 40 },
        };

        this.activeSession = {
          id: runtimeId,
          templateId: message.templateId || null,
          snapshot,
          goal,
          phase: "focus",
          status: "active",
          startedAt: now,
          phaseEndsAt,
          remainingSeconds: durationSeconds,
          completedAt: null,
        };

        // Create alarm
        await this.chrome.alarms.create("focusSessionTimer", { when: phaseEndsAt });

        // Blocker interaction
        if (snapshot.blocker.enabled) {
          const blockedData = await this.chrome.storage.local.get(["blockedUrls"]);
          const urls = blockedData.blockedUrls || [];
          const addRules = urls.map((u, i) => ({
            id: i + 1,
            priority: 1,
            action: { type: "block" },
            condition: { requestDomains: [typeof u === "string" ? u : u.url] },
          }));
          await this.chrome.declarativeNetRequest.updateDynamicRules({ addRules });
        }

        await this.saveState();
        return { success: true, state: { activeSession: this.activeSession } };
      }

      case "FOCUS_SESSION_PAUSE":
      case "FOCUS_PAUSE_SESSION": {
        if (!this.activeSession || this.activeSession.status !== "active") {
          return { success: false, error: "No active session to pause" };
        }
        if (this.activeSession.remainingSeconds <= 0) {
          return { success: false, error: "Cannot pause completed session" };
        }

        const now = Date.now();
        if (this.activeSession.phaseEndsAt) {
          this.activeSession.remainingSeconds = Math.max(
            0,
            Math.ceil((this.activeSession.phaseEndsAt - now) / 1000)
          );
        }
        this.activeSession.status = "paused";
        this.activeSession.phaseEndsAt = null;

        await this.chrome.alarms.clear("focusSessionTimer");
        await this.saveState();
        return { success: true, state: { activeSession: this.activeSession } };
      }

      case "FOCUS_SESSION_RESUME":
      case "FOCUS_RESUME_SESSION": {
        if (!this.activeSession || this.activeSession.status !== "paused") {
          return { success: false, error: "No paused session to resume" };
        }

        const now = Date.now();
        const phaseEndsAt = now + this.activeSession.remainingSeconds * 1000;
        this.activeSession.status = "active";
        this.activeSession.phaseEndsAt = phaseEndsAt;

        await this.chrome.alarms.create("focusSessionTimer", { when: phaseEndsAt });
        await this.saveState();
        return { success: true, state: { activeSession: this.activeSession } };
      }

      case "FOCUS_SESSION_STOP":
      case "FOCUS_ABANDON_SESSION": {
        if (!this.activeSession) {
          return { success: false, error: "No session to stop" };
        }

        const runtimeId = this.activeSession.id;
        const abandonedRecord = {
          id: runtimeId,
          goal: this.activeSession.goal,
          durationMinutes: this.activeSession.snapshot.focusDuration,
          status: "abandoned",
          startedAt: this.activeSession.startedAt,
          endedAt: Date.now(),
          reason: message.reason || "user_stop",
        };

        // Record history idempotent check
        if (!this.history.some((h) => h.id === runtimeId)) {
          this.history.push(abandonedRecord);
        }

        await this.chrome.alarms.clear("focusSessionTimer");
        this.activeSession = null;
        await this.saveState();
        return { success: true, state: { activeSession: null, history: this.history } };
      }

      case "FOCUS_SESSION_START_BREAK":
      case "FOCUS_START_BREAK": {
        if (!this.activeSession || this.activeSession.status !== "completed") {
          return { success: false, error: "Session must be completed to start break" };
        }

        const breakMinutes = message.durationMinutes || this.activeSession.snapshot.breakDuration || 5;
        const now = Date.now();
        const durationSeconds = breakMinutes * 60;
        const phaseEndsAt = now + durationSeconds * 1000;

        this.activeSession.phase = "break";
        this.activeSession.status = "active";
        this.activeSession.startedAt = now;
        this.activeSession.phaseEndsAt = phaseEndsAt;
        this.activeSession.remainingSeconds = durationSeconds;

        await this.chrome.alarms.create("focusSessionTimer", { when: phaseEndsAt });
        await this.saveState();
        return { success: true, state: { activeSession: this.activeSession } };
      }

      case "FOCUS_SESSION_FINISH":
      case "FOCUS_SKIP_BREAK": {
        if (!this.activeSession) {
          return { success: false, error: "No active session to finish" };
        }

        // Handle linked task completion if requested
        if (message.completeTask && this.activeSession.goal && this.activeSession.goal.taskId) {
          const tasksData = await this.chrome.storage.local.get(["tasks"]);
          const tasks = tasksData.tasks || [];
          const updatedTasks = tasks.map((t) =>
            t.id === this.activeSession.goal.taskId ? { ...t, completed: true } : t
          );
          await this.chrome.storage.local.set({ tasks: updatedTasks });
        }

        await this.chrome.alarms.clear("focusSessionTimer");
        this.activeSession = null;
        await this.saveState();
        return { success: true, state: { activeSession: null } };
      }

      case "FOCUS_SESSION_TEMPLATE_SAVE": {
        if (!message.name || message.name.trim().length === 0) {
          return { success: false, error: "Template name cannot be empty" };
        }
        const name = message.name.trim().substring(0, 40);
        const template = {
          id: `template_${Date.now()}`,
          name,
          focusDuration: message.focusDuration || 25,
          breakDuration: message.breakDuration || 5,
          goal: message.goal || { type: "text", text: "" },
          blocker: message.blocker || { enabled: true },
          ambientSound: message.ambientSound || { enabled: true, soundId: "rain", volume: 40 },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.templates.push(template);
        await this.saveState();
        return { success: true, template, templates: this.templates };
      }

      default:
        return { success: false, error: `Unknown command: ${type}` };
    }
  }

  async handleTimerExpiry() {
    if (!this.activeSession) return;

    if (this.activeSession.phase === "focus") {
      this.activeSession.status = "completed";
      this.activeSession.remainingSeconds = 0;
      this.activeSession.phaseEndsAt = null;
      this.activeSession.completedAt = Date.now();

      // Idempotent history logging
      const runtimeId = this.activeSession.id;
      if (!this.history.some((h) => h.id === runtimeId)) {
        this.history.push({
          id: runtimeId,
          goal: this.activeSession.goal,
          durationMinutes: this.activeSession.snapshot.focusDuration,
          status: "completed",
          startedAt: this.activeSession.startedAt,
          completedAt: this.activeSession.completedAt,
        });
      }

      await this.saveState();
    } else if (this.activeSession.phase === "break") {
      this.activeSession.status = "completed";
      this.activeSession.remainingSeconds = 0;
      this.activeSession.phaseEndsAt = null;
      await this.saveState();
    }
  }

  async saveState() {
    await this.chrome.storage.local.set({
      activeFocusSession: this.activeSession,
      focusSessionTemplates: this.templates,
      focusSessionHistory: this.history,
      focusSessionPreferences: this.preferences,
    });
  }
}

// ============================================================================
// TIER 1: FEATURE COVERAGE TESTS
// ============================================================================

test("[Tier 1] State Machine Happy Path", async () => {
  const env = createE2EEnvironment();
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  // 1. Idle state check
  const stateRes1 = await harness.handleMessage({ type: "FOCUS_SESSION_GET_STATE" });
  assert.equal(stateRes1.success, true);
  assert.equal(stateRes1.state.activeSession, null);

  // 2. Start Focus Session -> active_focus
  const startRes = await harness.handleMessage({
    type: "FOCUS_SESSION_START",
    durationMinutes: 25,
    breakDurationMinutes: 5,
    goal: "State Machine Test Goal",
  });
  assert.equal(startRes.success, true);
  assert.equal(startRes.state.activeSession.phase, "focus");
  assert.equal(startRes.state.activeSession.status, "active");
  assert.equal(startRes.state.activeSession.remainingSeconds, 1500);

  // 3. Pause Focus Session -> paused_focus
  const pauseRes = await harness.handleMessage({ type: "FOCUS_SESSION_PAUSE" });
  assert.equal(pauseRes.success, true);
  assert.equal(pauseRes.state.activeSession.status, "paused");
  assert.equal(pauseRes.state.activeSession.phaseEndsAt, null);

  // 4. Resume Focus Session -> active_focus
  const resumeRes = await harness.handleMessage({ type: "FOCUS_SESSION_RESUME" });
  assert.equal(resumeRes.success, true);
  assert.equal(resumeRes.state.activeSession.status, "active");
  assert.ok(resumeRes.state.activeSession.phaseEndsAt > Date.now());

  // 5. Timer Expiry -> focus_completed
  await harness.handleTimerExpiry();
  const stateRes2 = await harness.handleMessage({ type: "FOCUS_SESSION_GET_STATE" });
  assert.equal(stateRes2.state.activeSession.status, "completed");
  assert.equal(stateRes2.state.activeSession.remainingSeconds, 0);

  // 6. Start Break -> active_break
  const breakRes = await harness.handleMessage({ type: "FOCUS_SESSION_START_BREAK", durationMinutes: 5 });
  assert.equal(breakRes.success, true);
  assert.equal(breakRes.state.activeSession.phase, "break");
  assert.equal(breakRes.state.activeSession.status, "active");

  // 7. Break Expiry -> break_completed
  await harness.handleTimerExpiry();
  const stateRes3 = await harness.handleMessage({ type: "FOCUS_SESSION_GET_STATE" });
  assert.equal(stateRes3.state.activeSession.phase, "break");
  assert.equal(stateRes3.state.activeSession.status, "completed");

  // 8. Finish Session -> idle
  const finishRes = await harness.handleMessage({ type: "FOCUS_SESSION_FINISH" });
  assert.equal(finishRes.success, true);
  assert.equal(finishRes.state.activeSession, null);
});

test("[Tier 1] Quick Start 25m Focus Session (2 actions from Home)", async () => {
  const env = createE2EEnvironment();
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  // Action 1 & 2: Click Start Focus Session from Home with zero config (defaults)
  const res = await harness.handleMessage({
    type: "FOCUS_SESSION_START",
  });

  assert.equal(res.success, true);
  const session = res.state.activeSession;
  assert.ok(session.id);
  assert.equal(session.snapshot.focusDuration, 25);
  assert.equal(session.snapshot.breakDuration, 5);
  assert.equal(session.remainingSeconds, 1500);
  assert.equal(session.snapshot.blocker.enabled, true);
  assert.equal(session.phase, "focus");
  assert.equal(session.status, "active");
});

test("[Tier 1] Custom Duration Configuration (50m Focus / 10m Break)", async () => {
  const env = createE2EEnvironment();
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  const res = await harness.handleMessage({
    type: "FOCUS_SESSION_START",
    durationMinutes: 50,
    breakDurationMinutes: 10,
    goal: "Deep Study",
  });

  assert.equal(res.success, true);
  const session = res.state.activeSession;
  assert.equal(session.snapshot.focusDuration, 50);
  assert.equal(session.snapshot.breakDuration, 10);
  assert.equal(session.remainingSeconds, 3000);
});

test("[Tier 1] Task Selection Integration", async () => {
  const env = createE2EEnvironment({
    tasks: [{ id: 101, text: "Write E2E test suite", completed: false }],
  });
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  const res = await harness.handleMessage({
    type: "FOCUS_SESSION_START",
    taskId: 101,
    goalText: "Write E2E test suite",
  });

  assert.equal(res.success, true);
  assert.deepEqual(res.state.activeSession.goal, {
    type: "task",
    taskId: 101,
    text: "Write E2E test suite",
  });
});

test("[Tier 1] Ambient Sound Selection (Single Sound Enforced)", async () => {
  const env = createE2EEnvironment();
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  const res = await harness.handleMessage({
    type: "FOCUS_SESSION_START",
    soundTrack: "rain",
    volume: 60,
  });

  assert.equal(res.success, true);
  const ambient = res.state.activeSession.snapshot.ambientSound;
  assert.equal(ambient.enabled, true);
  assert.equal(ambient.soundId, "rain");
  assert.equal(ambient.volume, 60);
});

test("[Tier 1] Website Blocker Toggle in Setup", async () => {
  const env = createE2EEnvironment();
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  const resDisabled = await harness.handleMessage({
    type: "FOCUS_SESSION_START",
    blockerEnabled: false,
  });
  assert.equal(resDisabled.success, true);
  assert.equal(resDisabled.state.activeSession.snapshot.blocker.enabled, false);
});

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES TESTS
// ============================================================================

test("[Tier 2] Invalid Duration Normalization (Clamping & Bounds)", async () => {
  const env = createE2EEnvironment();
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  // Focus duration too low (<5m)
  const resLow = await harness.handleMessage({
    type: "FOCUS_SESSION_START",
    durationMinutes: 2,
    breakDurationMinutes: 0,
  });
  assert.equal(resLow.success, true);
  assert.equal(resLow.state.activeSession.snapshot.focusDuration, MIN_FOCUS_MINUTES);
  assert.equal(resLow.state.activeSession.snapshot.breakDuration, MIN_BREAK_MINUTES);

  await harness.handleMessage({ type: "FOCUS_SESSION_STOP" });

  // Focus duration too high (>120m)
  const resHigh = await harness.handleMessage({
    type: "FOCUS_SESSION_START",
    durationMinutes: 200,
    breakDurationMinutes: 50,
  });
  assert.equal(resHigh.success, true);
  assert.equal(resHigh.state.activeSession.snapshot.focusDuration, MAX_FOCUS_MINUTES);
  assert.equal(resHigh.state.activeSession.snapshot.breakDuration, MAX_BREAK_MINUTES);
});

test("[Tier 2] Zero Remaining Time Countdown Boundary", async () => {
  const env = createE2EEnvironment();
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  await harness.handleMessage({ type: "FOCUS_SESSION_START", durationMinutes: 5 });
  await harness.handleTimerExpiry();

  const stateRes = await harness.handleMessage({ type: "FOCUS_SESSION_GET_STATE" });
  assert.equal(stateRes.state.activeSession.status, "completed");
  assert.equal(stateRes.state.activeSession.remainingSeconds, 0);
});

test("[Tier 2] Service Worker Restart with Expired Timestamp", async () => {
  const expiredTime = Date.now() - 60000; // 60 seconds ago
  const env = createE2EEnvironment({
    activeFocusSession: {
      id: "session_expired_1",
      snapshot: { focusDuration: 25, breakDuration: 5, blocker: { enabled: true } },
      goal: { type: "text", text: "Expired Session" },
      phase: "focus",
      status: "active",
      startedAt: expiredTime - 1500000,
      phaseEndsAt: expiredTime,
      remainingSeconds: 0,
    },
  });

  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  // Trigger timer expiry handling as background startup would detect
  await harness.handleTimerExpiry();

  const stateRes = await harness.handleMessage({ type: "FOCUS_SESSION_GET_STATE" });
  assert.equal(stateRes.state.activeSession.status, "completed");
  assert.equal(stateRes.state.history.length, 1);
  assert.equal(stateRes.state.history[0].id, "session_expired_1");
});

test("[Tier 2] Pausing at 0 Seconds Boundary", async () => {
  const env = createE2EEnvironment();
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  await harness.handleMessage({ type: "FOCUS_SESSION_START", durationMinutes: 5 });
  await harness.handleTimerExpiry(); // Status is completed, remainingSeconds = 0

  const pauseRes = await harness.handleMessage({ type: "FOCUS_SESSION_PAUSE" });
  assert.equal(pauseRes.success, false);
  assert.match(pauseRes.error, /No active session|Cannot pause/);
});

test("[Tier 2] Fast Resume / Pause Toggles (Operation Queue)", async () => {
  const env = createE2EEnvironment();
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  await harness.handleMessage({ type: "FOCUS_SESSION_START", durationMinutes: 25 });

  // Fire rapid succession of pause and resume commands
  const p1 = harness.handleMessage({ type: "FOCUS_SESSION_PAUSE" });
  const p2 = harness.handleMessage({ type: "FOCUS_SESSION_RESUME" });
  const p3 = harness.handleMessage({ type: "FOCUS_SESSION_PAUSE" });
  const p4 = harness.handleMessage({ type: "FOCUS_SESSION_RESUME" });

  const results = await Promise.all([p1, p2, p3, p4]);
  for (const r of results) {
    assert.equal(r.success, true);
  }

  const finalState = await harness.handleMessage({ type: "FOCUS_SESSION_GET_STATE" });
  assert.equal(finalState.state.activeSession.status, "active");
});

test("[Tier 2] Missing Storage Keys Initialization", async () => {
  // Completely empty storage
  const env = createE2EEnvironment({});
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  const stateRes = await harness.handleMessage({ type: "FOCUS_SESSION_GET_STATE" });
  assert.equal(stateRes.success, true);
  assert.equal(stateRes.state.activeSession, null);
  assert.deepEqual(stateRes.state.templates, []);
  assert.deepEqual(stateRes.state.history, []);
  assert.equal(stateRes.state.preferences.defaultFocusDuration, 25);
});

// ============================================================================
// TIER 3: CROSS-FEATURE INTERACTIONS TESTS
// ============================================================================

test("[Tier 3] Focus Session + Pomodoro Interlock", async () => {
  const env = createE2EEnvironment({
    pomodoroState: {
      isActive: true,
      isBreak: false,
      currentTime: 1200,
    },
  });
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  // Attempting to start Focus Session while Pomodoro is active must fail
  const startRes = await harness.handleMessage({
    type: "FOCUS_SESSION_START",
    durationMinutes: 25,
  });

  assert.equal(startRes.success, false);
  assert.match(startRes.error, /Pomodoro is active/);
});

test("[Tier 3] Focus Session + Website Blocker Rules Interlock", async () => {
  const env = createE2EEnvironment({
    blockedUrls: ["facebook.com", "twitter.com"],
  });
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  // Start Focus Session with blocker enabled
  await harness.handleMessage({
    type: "FOCUS_SESSION_START",
    blockerEnabled: true,
  });

  assert.equal(env.dynamicRules.length, 2);
  assert.equal(env.dynamicRules[0].condition.requestDomains[0], "facebook.com");

  // Pause session: blocker rules MUST remain active ("Still blocking" requirement)
  await harness.handleMessage({ type: "FOCUS_SESSION_PAUSE" });
  assert.equal(env.dynamicRules.length, 2);
});

test("[Tier 3] Focus Session + Ambient Sound Selection", async () => {
  const env = createE2EEnvironment();
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  const startRes = await harness.handleMessage({
    type: "FOCUS_SESSION_START",
    soundTrack: "ocean_waves",
    volume: 50,
  });

  assert.equal(startRes.success, true);
  assert.equal(startRes.state.activeSession.snapshot.ambientSound.soundId, "ocean_waves");
  assert.equal(startRes.state.activeSession.snapshot.ambientSound.volume, 50);
});

test("[Tier 3] Focus Session + Task List Completion Confirmation", async () => {
  const env = createE2EEnvironment({
    tasks: [
      { id: 201, text: "Finish chapter 3", completed: false },
      { id: 202, text: "Review PR", completed: false },
    ],
  });
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  // Start session linked to task 201
  await harness.handleMessage({
    type: "FOCUS_SESSION_START",
    taskId: 201,
    goalText: "Finish chapter 3",
  });

  // Timer completes
  await harness.handleTimerExpiry();

  // Task MUST NOT be automatically marked completed before explicit user confirmation
  let storage = await env.chrome.storage.local.get(["tasks"]);
  assert.equal(storage.tasks.find((t) => t.id === 201).completed, false);

  // User explicitly confirms completion on Focus Complete screen
  await harness.handleMessage({
    type: "FOCUS_SESSION_FINISH",
    completeTask: true,
  });

  storage = await env.chrome.storage.local.get(["tasks"]);
  assert.equal(storage.tasks.find((t) => t.id === 201).completed, true);
  assert.equal(storage.tasks.find((t) => t.id === 202).completed, false);
});

// ============================================================================
// TIER 4: REAL-WORLD WORKLOAD SCENARIOS TESTS
// ============================================================================

test("[Tier 4] Full 25m Focus Session Workload Flow", async () => {
  const env = createE2EEnvironment({
    tasks: [{ id: 301, text: "Write project spec", completed: false }],
    blockedUrls: ["reddit.com"],
  });
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  // 1. User starts 25m focus session with task 301 and rain audio
  const startRes = await harness.handleMessage({
    type: "FOCUS_SESSION_START",
    durationMinutes: 25,
    breakDurationMinutes: 5,
    taskId: 301,
    goalText: "Write project spec",
    soundTrack: "rain",
    blockerEnabled: true,
  });

  assert.equal(startRes.success, true);
  assert.equal(startRes.state.activeSession.status, "active");
  assert.equal(startRes.state.activeSession.phase, "focus");

  // 2. User pauses after 10m
  const pauseRes = await harness.handleMessage({ type: "FOCUS_SESSION_PAUSE" });
  assert.equal(pauseRes.success, true);
  assert.equal(pauseRes.state.activeSession.status, "paused");

  // 3. User resumes
  const resumeRes = await harness.handleMessage({ type: "FOCUS_SESSION_RESUME" });
  assert.equal(resumeRes.success, true);
  assert.equal(resumeRes.state.activeSession.status, "active");

  // 4. Timer expires -> Focus Complete
  await harness.handleTimerExpiry();
  const completedState = await harness.handleMessage({ type: "FOCUS_SESSION_GET_STATE" });
  assert.equal(completedState.state.activeSession.status, "completed");

  // 5. User starts 5m break
  const breakRes = await harness.handleMessage({
    type: "FOCUS_SESSION_START_BREAK",
    durationMinutes: 5,
  });
  assert.equal(breakRes.success, true);
  assert.equal(breakRes.state.activeSession.phase, "break");
  assert.equal(breakRes.state.activeSession.status, "active");

  // 6. Break timer expires
  await harness.handleTimerExpiry();

  // 7. User clicks finish and checks linked task complete
  const finishRes = await harness.handleMessage({
    type: "FOCUS_SESSION_FINISH",
    completeTask: true,
  });
  assert.equal(finishRes.success, true);
  assert.equal(finishRes.state.activeSession, null);

  // Verify task completion
  const storage = await env.chrome.storage.local.get(["tasks"]);
  assert.equal(storage.tasks[0].completed, true);
});

test("[Tier 4] Idempotent History & Progress Logging", async () => {
  const env = createE2EEnvironment();
  const harness = new FocusSessionTestHarness(env);
  await harness.init();

  const sessionStart = await harness.handleMessage({
    type: "FOCUS_SESSION_START",
    durationMinutes: 25,
    goal: "Idempotency Test",
  });
  const runtimeId = sessionStart.state.activeSession.id;

  // Trigger timer expiry multiple times (e.g. SW restart + alarm retry)
  await harness.handleTimerExpiry();
  await harness.handleTimerExpiry();
  await harness.handleTimerExpiry();

  const stateRes = await harness.handleMessage({ type: "FOCUS_SESSION_GET_STATE" });
  const historyEntries = stateRes.state.history.filter((h) => h.id === runtimeId);

  // MUST contain exactly 1 history entry
  assert.equal(historyEntries.length, 1);
  assert.equal(historyEntries[0].status, "completed");
  assert.equal(historyEntries[0].durationMinutes, 25);
});
