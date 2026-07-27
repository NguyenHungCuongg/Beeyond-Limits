/* global chrome */

import {
  syncBlockingRulesFromStorage,
  updateBlockingConfiguration,
} from "./core/blocking.js";
import {
  completePomodoroPhase,
  normalizePomodoroSettings,
  restorePomodoroState,
} from "./core/pomodoro.js";
import { getPomodoroAudioFiles } from "./core/audio.js";
import { createOffscreenBridge } from "./core/offscreenBridge.js";

import { createOperationQueue } from "./core/operationQueue.js";
import {
  createFocusSession,
  pauseFocusSession,
  resumeFocusSession,
  completeFocusSession,
  abandonFocusSession,
  startBreakSession,
  calculateRemainingSeconds,
  calculateProgressPercentage,
  FOCUS_STATES,
  FOCUS_PHASES,
} from "./core/focusSession.js";
import {
  getActiveFocusSession,
  setActiveFocusSession,
  clearActiveFocusSession,
  getFocusTemplates,
  getFocusHistory,
  appendFocusHistory,
  getFocusPreferences,
  updateFocusPreferences,
  initializeFocusStorage,
} from "./core/focusStorage.js";

const POMODORO_ALARM = "pomodoroTimer";
export const FOCUS_ALARM = "focusSessionTimer";

const DEFAULT_AMBIENT_SETTINGS = Object.freeze({
  bird: { enabled: false, volume: 50 },
  campfire: { enabled: false, volume: 50 },
  ocean_waves: { enabled: false, volume: 50 },
  rain: { enabled: false, volume: 50 },
  thunder: { enabled: false, volume: 50 },
  wind: { enabled: false, volume: 50 },
});

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeAmbientSettings(settings = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_AMBIENT_SETTINGS).map(([soundKey, defaults]) => {
      const saved = settings[soundKey] ?? {};
      return [
        soundKey,
        {
          enabled:
            typeof saved.enabled === "boolean"
              ? saved.enabled
              : defaults.enabled,
          volume: Number.isFinite(saved.volume)
            ? Math.min(100, Math.max(0, saved.volume))
            : defaults.volume,
        },
      ];
    }),
  );
}

class AmbientSoundManager {
  constructor(chromeApi, offscreenBridge) {
    this.chromeApi = chromeApi;
    this.offscreenBridge = offscreenBridge;
    this.settings = normalizeAmbientSettings();
    this.ready = this.loadSettings();
  }

  async loadSettings() {
    const result = await this.chromeApi.storage.local.get(["ambientSettings"]);
    this.settings = normalizeAmbientSettings(result.ambientSettings);

    const enabledSounds = Object.entries(this.settings).filter(
      ([, setting]) => setting.enabled,
    );
    const results = await Promise.allSettled(
      enabledSounds.map(([soundKey, setting]) =>
        this.startSound(soundKey, setting.volume),
      ),
    );

    for (const resultItem of results) {
      if (resultItem.status === "rejected") {
        console.error("Unable to restore an ambient sound:", resultItem.reason);
      }
    }
  }

  async startSound(soundKey, volume) {
    await this.offscreenBridge.send({
      type: "START_AMBIENT_SOUND",
      soundKey,
      audioUrl: this.chromeApi.runtime.getURL(`audio/${soundKey}.m4a`),
      volume: volume / 100,
    });
  }

  async stopSound(soundKey) {
    await this.offscreenBridge.send({
      type: "STOP_AMBIENT_SOUND",
      soundKey,
    });
  }

  async updateVolume(soundKey, volume) {
    await this.offscreenBridge.send({
      type: "UPDATE_AMBIENT_VOLUME",
      soundKey,
      volume: volume / 100,
    });
  }

  async updateSettings(newSettings) {
    await this.ready;
    const nextSettings = normalizeAmbientSettings({
      ...this.settings,
      ...newSettings,
    });

    for (const [soundKey, next] of Object.entries(nextSettings)) {
      const current = this.settings[soundKey];
      if (!current.enabled && next.enabled) {
        await this.startSound(soundKey, next.volume);
      } else if (current.enabled && !next.enabled) {
        await this.stopSound(soundKey);
      } else if (next.enabled && current.volume !== next.volume) {
        await this.updateVolume(soundKey, next.volume);
      }
    }

    await this.chromeApi.storage.local.set({ ambientSettings: nextSettings });
    this.settings = nextSettings;
    return { success: true, settings: nextSettings };
  }

  async stopAllSounds() {
    await this.ready;
    await this.offscreenBridge.send({ type: "STOP_ALL_AMBIENT_SOUNDS" });

    const nextSettings = Object.fromEntries(
      Object.entries(this.settings).map(([soundKey, setting]) => [
        soundKey,
        { ...setting, enabled: false },
      ]),
    );
    await this.chromeApi.storage.local.set({ ambientSettings: nextSettings });
    this.settings = nextSettings;
    return { success: true, settings: nextSettings };
  }

  async testSound(soundKey, volume = 50) {
    await this.ready;
    await this.offscreenBridge.send({
      type: "TEST_AMBIENT_SOUND",
      soundKey,
      audioUrl: this.chromeApi.runtime.getURL(`audio/${soundKey}.m4a`),
      volume: Math.min(100, Math.max(0, volume)) / 100,
    });
    return { success: true };
  }
}

class BackgroundPomodoroManager {
  constructor(chromeApi, offscreenBridge) {
    this.chromeApi = chromeApi;
    this.offscreenBridge = offscreenBridge;
    this.isActive = false;
    this.isBreak = false;
    this.currentTime = 25 * 60;
    this.initialTime = 25 * 60;
    this.phaseEndsAt = null;
    this.focusTime = 25;
    this.breakTime = 5;
    this.sessionCount = 0;
    this.audioEnabled = true;
    this.completionPromise = null;
    this.ready = this.loadState();
  }

  async loadState() {
    try {
      const result = await this.chromeApi.storage.local.get([
        "pomodoroState",
        "pomodoroSettings",
      ]);
      const restored = restorePomodoroState(
        result.pomodoroState,
        result.pomodoroSettings,
      );
      Object.assign(this, restored);

      if (!this.isActive) {
        return;
      }

      if (!this.phaseEndsAt) {
        this.isActive = false;
        await this.saveState();
        return;
      }

      if (this.phaseEndsAt <= Date.now()) {
        await this.completeCurrentPhase();
        return;
      }

      await this.chromeApi.alarms.create(POMODORO_ALARM, {
        when: this.phaseEndsAt,
      });
    } catch (error) {
      console.error("Unable to restore Pomodoro state:", error);
      this.isActive = false;
      this.phaseEndsAt = null;
    }
  }

  async saveState() {
    const state = {
      isActive: this.isActive,
      isBreak: this.isBreak,
      currentTime: this.currentTime,
      initialTime: this.initialTime,
      phaseEndsAt: this.phaseEndsAt,
      sessionCount: this.sessionCount,
      lastUpdated: Date.now(),
    };

    await this.chromeApi.storage.local.set({ pomodoroState: state });
    this.chromeApi.runtime
      .sendMessage({
        type: "POMODORO_STATE_UPDATE",
        state: this.getState(),
      })
      .catch(() => {});
  }

  phaseDuration() {
    return (this.isBreak ? this.breakTime : this.focusTime) * 60;
  }

  async startTimer({ skipReady = false } = {}) {
    if (!skipReady) {
      await this.ready;
    }
    if (this.currentTime <= 0) {
      this.currentTime = this.phaseDuration();
      this.initialTime = this.currentTime;
    }

    this.isActive = true;
    this.phaseEndsAt = Date.now() + this.currentTime * 1000;
    await this.chromeApi.alarms.create(POMODORO_ALARM, {
      when: this.phaseEndsAt,
    });
    await this.saveState();
    return { success: true, state: this.getState() };
  }

  async pauseTimer() {
    await this.ready;
    if (this.phaseEndsAt) {
      this.currentTime = Math.max(
        0,
        Math.ceil((this.phaseEndsAt - Date.now()) / 1000),
      );
    }
    this.isActive = false;
    this.phaseEndsAt = null;
    await this.chromeApi.alarms.clear(POMODORO_ALARM);
    await this.saveState();
    return { success: true, state: this.getState() };
  }

  async resetTimer() {
    await this.ready;
    this.isActive = false;
    this.isBreak = false;
    this.currentTime = this.focusTime * 60;
    this.initialTime = this.currentTime;
    this.phaseEndsAt = null;
    this.sessionCount = 0;
    await this.chromeApi.alarms.clear(POMODORO_ALARM);
    await this.saveState();
    return { success: true, state: this.getState() };
  }

  async completeCurrentPhase() {
    if (this.completionPromise) {
      return this.completionPromise;
    }

    this.completionPromise = this.performPhaseCompletion().finally(() => {
      this.completionPromise = null;
    });
    return this.completionPromise;
  }

  async performPhaseCompletion() {
    await this.chromeApi.alarms.clear(POMODORO_ALARM);
    const next = completePomodoroPhase(this.getState(), {
      focusTime: this.focusTime,
      breakTime: this.breakTime,
      audioEnabled: this.audioEnabled,
    });
    Object.assign(this, next);

    const context = this.isBreak ? "break" : "focus";
    await this.startTimer({ skipReady: true });

    this.playNotification(context).catch((error) => {
      console.error("Unable to play Pomodoro notification:", error);
    });
    this.showNotification(context);

    return { success: true, state: this.getState() };
  }

  async playNotification(context) {
    if (!this.audioEnabled) {
      return { success: true, skipped: true };
    }

    const audioUrls = getPomodoroAudioFiles(context).map((filename) =>
      this.chromeApi.runtime.getURL(`audio/${filename}`),
    );
    return this.offscreenBridge.send({
      type: "PLAY_POMODORO_AUDIO",
      audioUrls,
    });
  }

  showNotification(context) {
    const startingBreak = context === "break";
    this.chromeApi.notifications
      .create({
        type: "basic",
        iconUrl: "images/icon32.png",
        title: startingBreak
          ? "Great job! Time for a break! 🎉"
          : "Break's over! Ready to focus? 💪",
        message: startingBreak
          ? `Take a ${this.breakTime} minute break.`
          : `Time for a ${this.focusTime} minute focus session.`,
      })
      .catch((error) => {
        console.error("Unable to show Pomodoro notification:", error);
      });
  }

  async updateSettings(settings) {
    await this.ready;
    const normalized = normalizePomodoroSettings({
      focusTime:
        settings.focusTime === undefined ? this.focusTime : settings.focusTime,
      breakTime:
        settings.breakTime === undefined ? this.breakTime : settings.breakTime,
      audioEnabled:
        settings.audioEnabled === undefined
          ? this.audioEnabled
          : settings.audioEnabled,
    });

    const focusChanged = normalized.focusTime !== this.focusTime;
    const breakChanged = normalized.breakTime !== this.breakTime;
    Object.assign(this, normalized);

    if (
      !this.isActive &&
      ((!this.isBreak && focusChanged) || (this.isBreak && breakChanged))
    ) {
      this.currentTime = this.phaseDuration();
      this.initialTime = this.currentTime;
    }

    await this.chromeApi.storage.local.set({ pomodoroSettings: normalized });
    await this.saveState();
    return { success: true, state: this.getState() };
  }

  getState() {
    let currentTime = this.currentTime;
    if (this.isActive && this.phaseEndsAt) {
      currentTime = Math.max(
        0,
        Math.ceil((this.phaseEndsAt - Date.now()) / 1000),
      );
    }

    return {
      isActive: this.isActive,
      isBreak: this.isBreak,
      currentTime,
      initialTime: this.initialTime,
      phaseEndsAt: this.phaseEndsAt,
      sessionCount: this.sessionCount,
      focusTime: this.focusTime,
      breakTime: this.breakTime,
      audioEnabled: this.audioEnabled,
    };
  }
}

export class FocusSessionManager {
  constructor(chromeApi) {
    this.chromeApi = chromeApi;
    this.completionPromise = null;
    this.ready = this.loadState();
  }

  async loadState() {
    try {
      await initializeFocusStorage(this.chromeApi);
      const activeSession = await getActiveFocusSession(this.chromeApi);
      if (!activeSession) {
        return;
      }

      if (
        activeSession.status === FOCUS_STATES.ACTIVE_FOCUS ||
        activeSession.status === FOCUS_STATES.ACTIVE_BREAK
      ) {
        const now = Date.now();
        if (activeSession.phaseEndsAt && activeSession.phaseEndsAt <= now) {
          await this.completeCurrentPhase();
        } else if (activeSession.phaseEndsAt) {
          await this.chromeApi.alarms.create(FOCUS_ALARM, {
            when: activeSession.phaseEndsAt,
          });
        }
      }
    } catch (error) {
      console.error("Unable to restore Focus Session state:", error);
    }
  }

  async getState() {
    await this.ready;
    const [rawActive, templates, history, preferences] = await Promise.all([
      getActiveFocusSession(this.chromeApi),
      getFocusTemplates(this.chromeApi),
      getFocusHistory(this.chromeApi),
      getFocusPreferences(this.chromeApi),
    ]);

    let activeSession = rawActive;
    if (activeSession) {
      const now = Date.now();
      activeSession = {
        ...activeSession,
        remainingSeconds: calculateRemainingSeconds(activeSession, now),
        progressPercentage: calculateProgressPercentage(activeSession, now),
      };
    }

    return {
      success: true,
      activeSession,
      templates,
      history,
      preferences,
    };
  }

  async startSession(payload = {}) {
    await this.ready;
    const inputConfig = payload.config || payload || {};
    const config = {
      templateId: inputConfig.templateId,
      focusDuration: inputConfig.durationMinutes ?? inputConfig.focusDuration,
      breakDuration: inputConfig.breakDuration,
      goal:
        inputConfig.goal ??
        (inputConfig.taskId !== undefined || inputConfig.taskText !== undefined
          ? {
              type: inputConfig.taskId ? "task" : "text",
              taskId: inputConfig.taskId,
              text: inputConfig.taskText || "",
            }
          : undefined),
      blocker:
        inputConfig.blocker ??
        (inputConfig.blockerEnabled !== undefined
          ? { enabled: inputConfig.blockerEnabled }
          : undefined),
      ambientSound:
        inputConfig.ambientSound ??
        (inputConfig.soundTrack
          ? { enabled: true, soundId: inputConfig.soundTrack }
          : undefined),
      preSessionState: inputConfig.preSessionState,
    };

    const session = createFocusSession(config, Date.now());
    await setActiveFocusSession(session, this.chromeApi);
    await this.chromeApi.alarms.create(FOCUS_ALARM, {
      when: session.phaseEndsAt,
    });

    this.broadcastStateUpdate(session);
    return { success: true, activeSession: session };
  }

  async pauseSession(payload = {}) {
    await this.ready;
    const session = await getActiveFocusSession(this.chromeApi);
    if (!session) {
      return { success: false, error: "No active focus session found" };
    }
    if (payload.runtimeId && session.id !== payload.runtimeId) {
      return { success: false, error: "Session runtime ID mismatch" };
    }

    const updated = pauseFocusSession(session, Date.now());
    await this.chromeApi.alarms.clear(FOCUS_ALARM);
    await setActiveFocusSession(updated, this.chromeApi);

    this.broadcastStateUpdate(updated);
    return { success: true, activeSession: updated };
  }

  async resumeSession(payload = {}) {
    await this.ready;
    const session = await getActiveFocusSession(this.chromeApi);
    if (!session) {
      return { success: false, error: "No active focus session found" };
    }
    if (payload.runtimeId && session.id !== payload.runtimeId) {
      return { success: false, error: "Session runtime ID mismatch" };
    }

    const updated = resumeFocusSession(session, Date.now());
    await setActiveFocusSession(updated, this.chromeApi);
    if (updated.phaseEndsAt) {
      await this.chromeApi.alarms.create(FOCUS_ALARM, {
        when: updated.phaseEndsAt,
      });
    }

    this.broadcastStateUpdate(updated);
    return { success: true, activeSession: updated };
  }

  async abandonSession(payload = {}) {
    await this.ready;
    const session = await getActiveFocusSession(this.chromeApi);
    if (!session) {
      return { success: false, error: "No active focus session found" };
    }
    if (payload.runtimeId && session.id !== payload.runtimeId) {
      return { success: false, error: "Session runtime ID mismatch" };
    }

    const reason = payload.reason || "user_stopped";
    const now = Date.now();
    const updated = abandonFocusSession(session, reason, now);

    await this.chromeApi.alarms.clear(FOCUS_ALARM);

    const historyRecord = {
      id: updated.id,
      runtimeId: updated.id,
      status: FOCUS_STATES.ABANDONED,
      focusDurationMinutes:
        updated.snapshot?.focusDuration ||
        Math.round((updated.durationSeconds || 0) / 60),
      actualFocusSeconds: Math.max(
        0,
        Math.round((now - updated.startedAt) / 1000),
      ),
      startedAt: updated.startedAt,
      abandonedAt: updated.abandonedAt || now,
      abandonReason: reason,
      goal: updated.goal,
      templateId: updated.templateId,
    };

    await appendFocusHistory(historyRecord, this.chromeApi);
    await clearActiveFocusSession(this.chromeApi);

    this.broadcastStateUpdate(null);
    return { success: true, activeSession: null };
  }

  async startBreak(payload = {}) {
    await this.ready;
    const session = await getActiveFocusSession(this.chromeApi);
    if (!session) {
      return { success: false, error: "No session found to start break" };
    }
    if (payload.runtimeId && session.id !== payload.runtimeId) {
      return { success: false, error: "Session runtime ID mismatch" };
    }

    const durationMinutes = payload.durationMinutes ?? payload.breakDuration;
    const breakSession = startBreakSession(
      session,
      durationMinutes,
      Date.now(),
    );

    await setActiveFocusSession(breakSession, this.chromeApi);
    if (breakSession.phaseEndsAt) {
      await this.chromeApi.alarms.create(FOCUS_ALARM, {
        when: breakSession.phaseEndsAt,
      });
    }

    this.broadcastStateUpdate(breakSession);
    return { success: true, activeSession: breakSession };
  }

  async skipBreak(payload = {}) {
    await this.ready;
    const session = await getActiveFocusSession(this.chromeApi);
    if (payload.runtimeId && session && session.id !== payload.runtimeId) {
      return { success: false, error: "Session runtime ID mismatch" };
    }

    await this.chromeApi.alarms.clear(FOCUS_ALARM);
    await clearActiveFocusSession(this.chromeApi);

    this.broadcastStateUpdate(null);
    return { success: true, activeSession: null };
  }

  async updatePreferences(payload = {}) {
    await this.ready;
    const prefsToUpdate = payload.preferences || payload;
    const updated = await updateFocusPreferences(
      prefsToUpdate,
      this.chromeApi,
    );
    return { success: true, preferences: updated };
  }

  async completeCurrentPhase() {
    if (this.completionPromise) {
      return this.completionPromise;
    }

    this.completionPromise = this.performPhaseCompletion().finally(() => {
      this.completionPromise = null;
    });
    return this.completionPromise;
  }

  async performPhaseCompletion() {
    await this.chromeApi.alarms.clear(FOCUS_ALARM);
    const session = await getActiveFocusSession(this.chromeApi);
    if (!session) {
      return { success: false, error: "No active session to complete" };
    }

    const now = Date.now();
    const completedSession = completeFocusSession(session, now);

    if (session.phase === FOCUS_PHASES.FOCUS) {
      const historyRecord = {
        id: completedSession.id,
        runtimeId: completedSession.id,
        status: FOCUS_STATES.FOCUS_COMPLETED,
        focusDurationMinutes: completedSession.snapshot?.focusDuration || 25,
        actualFocusSeconds:
          completedSession.durationSeconds ||
          (completedSession.snapshot?.focusDuration || 25) * 60,
        startedAt: completedSession.startedAt,
        completedAt: completedSession.completedAt || now,
        goal: completedSession.goal,
        templateId: completedSession.templateId,
      };

      await appendFocusHistory(historyRecord, this.chromeApi);
      await setActiveFocusSession(completedSession, this.chromeApi);

      this.showNotification(
        "focus",
        completedSession.snapshot?.focusDuration || 25,
      );
    } else {
      await setActiveFocusSession(completedSession, this.chromeApi);
      this.showNotification(
        "break",
        completedSession.snapshot?.breakDuration || 5,
      );
    }

    this.broadcastStateUpdate(completedSession);
    return { success: true, activeSession: completedSession };
  }

  showNotification(type, durationMinutes) {
    if (!this.chromeApi.notifications?.create) return;

    const isFocus = type === "focus";
    this.chromeApi.notifications
      .create({
        type: "basic",
        iconUrl: "images/icon32.png",
        title: isFocus
          ? "Focus Session Complete! 🎉"
          : "Break Finished! 💪",
        message: isFocus
          ? `You completed a ${durationMinutes} minute focus session.`
          : "Ready for your next focus session?",
      })
      .catch((error) => {
        console.error("Unable to show Focus notification:", error);
      });
  }

  broadcastStateUpdate(activeSession) {
    if (!this.chromeApi.runtime?.sendMessage) return;
    const now = Date.now();
    const sessionPayload = activeSession
      ? {
          ...activeSession,
          remainingSeconds: calculateRemainingSeconds(activeSession, now),
          progressPercentage: calculateProgressPercentage(activeSession, now),
        }
      : null;

    this.chromeApi.runtime
      .sendMessage({
        type: "FOCUS_STATE_UPDATE",
        activeSession: sessionPayload,
      })
      .catch(() => {});
  }
}

const offscreenBridge = createOffscreenBridge(chrome);
const ambientManager = new AmbientSoundManager(chrome, offscreenBridge);
const pomodoroManager = new BackgroundPomodoroManager(chrome, offscreenBridge);
export const focusManager = new FocusSessionManager(chrome);

const blockerOperationQueue = createOperationQueue();
const pomodoroOperationQueue = createOperationQueue();
const ambientOperationQueue = createOperationQueue();
const focusOperationQueue = createOperationQueue();

function respond(sendResponse, operation) {
  Promise.resolve(operation)
    .then((result) => sendResponse(result ?? { success: true }))
    .catch((error) => {
      console.error("Background operation failed:", error);
      sendResponse({ success: false, error: errorMessage(error) });
    });
  return true;
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POMODORO_ALARM) {
    pomodoroOperationQueue
      .run(() => pomodoroManager.completeCurrentPhase())
      .catch((error) => {
        console.error("Unable to complete Pomodoro phase:", error);
      });
  } else if (alarm.name === FOCUS_ALARM) {
    focusOperationQueue
      .run(() => focusManager.completeCurrentPhase())
      .catch((error) => {
        console.error("Unable to complete Focus phase:", error);
      });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target === "offscreen") {
    return false;
  }

  switch (message.type) {
    case "UPDATE_BLOCKING_RULES":
      return respond(
        sendResponse,
        blockerOperationQueue.run(() =>
          updateBlockingConfiguration(
            chrome,
            message.isBlocking,
            message.blockedUrls,
          ),
        ),
      );
    case "POMODORO_START":
      return respond(
        sendResponse,
        pomodoroOperationQueue.run(() => pomodoroManager.startTimer()),
      );
    case "POMODORO_PAUSE":
      return respond(
        sendResponse,
        pomodoroOperationQueue.run(() => pomodoroManager.pauseTimer()),
      );
    case "POMODORO_RESET":
      return respond(
        sendResponse,
        pomodoroOperationQueue.run(() => pomodoroManager.resetTimer()),
      );
    case "POMODORO_UPDATE_SETTINGS":
      return respond(
        sendResponse,
        pomodoroOperationQueue.run(() =>
          pomodoroManager.updateSettings(message.settings ?? {}),
        ),
      );
    case "POMODORO_GET_STATE":
      return respond(
        sendResponse,
        pomodoroOperationQueue.run(() =>
          pomodoroManager.ready.then(() => ({
            success: true,
            state: pomodoroManager.getState(),
          })),
        ),
      );
    case "POMODORO_TEST_AUDIO":
      return respond(
        sendResponse,
        pomodoroManager.ready.then(() =>
          pomodoroManager.playNotification(message.context),
        ),
      );
    case "AMBIENT_UPDATE_SETTINGS":
      return respond(
        sendResponse,
        ambientOperationQueue.run(() =>
          ambientManager.updateSettings(message.settings ?? {}),
        ),
      );
    case "AMBIENT_TEST_SOUND":
      return respond(
        sendResponse,
        ambientManager.testSound(message.soundKey, message.volume),
      );
    case "AMBIENT_STOP_ALL":
      return respond(
        sendResponse,
        ambientOperationQueue.run(() => ambientManager.stopAllSounds()),
      );
    case "FOCUS_GET_STATE":
      return respond(
        sendResponse,
        focusOperationQueue.run(() => focusManager.getState()),
      );
    case "FOCUS_START_SESSION":
      return respond(
        sendResponse,
        focusOperationQueue.run(() => focusManager.startSession(message)),
      );
    case "FOCUS_PAUSE_SESSION":
      return respond(
        sendResponse,
        focusOperationQueue.run(() => focusManager.pauseSession(message)),
      );
    case "FOCUS_RESUME_SESSION":
      return respond(
        sendResponse,
        focusOperationQueue.run(() => focusManager.resumeSession(message)),
      );
    case "FOCUS_ABANDON_SESSION":
      return respond(
        sendResponse,
        focusOperationQueue.run(() => focusManager.abandonSession(message)),
      );
    case "FOCUS_START_BREAK":
      return respond(
        sendResponse,
        focusOperationQueue.run(() => focusManager.startBreak(message)),
      );
    case "FOCUS_SKIP_BREAK":
      return respond(
        sendResponse,
        focusOperationQueue.run(() => focusManager.skipBreak(message)),
      );
    case "FOCUS_UPDATE_PREFERENCES":
      return respond(
        sendResponse,
        focusOperationQueue.run(() => focusManager.updatePreferences(message)),
      );
    default:
      return false;
  }
});

async function synchronizeStartup() {
  try {
    await blockerOperationQueue.run(() => syncBlockingRulesFromStorage(chrome));
    await focusOperationQueue.run(() => focusManager.ready);
  } catch (error) {
    console.error("Unable to synchronize startup:", error);
  }
}

chrome.runtime.onStartup.addListener(synchronizeStartup);
chrome.runtime.onInstalled.addListener(synchronizeStartup);
synchronizeStartup();

