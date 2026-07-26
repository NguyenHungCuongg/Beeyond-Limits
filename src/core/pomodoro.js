export const DEFAULT_POMODORO_SETTINGS = Object.freeze({
  focusTime: 25,
  breakTime: 5,
  audioEnabled: true,
});

function validDuration(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function normalizePomodoroSettings(settings = {}) {
  return {
    focusTime: validDuration(
      settings.focusTime,
      DEFAULT_POMODORO_SETTINGS.focusTime,
    ),
    breakTime: validDuration(
      settings.breakTime,
      DEFAULT_POMODORO_SETTINGS.breakTime,
    ),
    audioEnabled:
      typeof settings.audioEnabled === "boolean"
        ? settings.audioEnabled
        : DEFAULT_POMODORO_SETTINGS.audioEnabled,
  };
}

export function restorePomodoroState(state, settings) {
  const normalizedSettings = normalizePomodoroSettings(settings);
  const isBreak = Boolean(state?.isBreak);
  const phaseDuration =
    (isBreak ? normalizedSettings.breakTime : normalizedSettings.focusTime) *
    60;

  return {
    isActive: Boolean(state?.isActive),
    isBreak,
    currentTime:
      Number.isFinite(state?.currentTime) && state.currentTime >= 0
        ? state.currentTime
        : phaseDuration,
    initialTime:
      Number.isFinite(state?.initialTime) && state.initialTime > 0
        ? state.initialTime
        : phaseDuration,
    phaseEndsAt:
      Number.isFinite(state?.phaseEndsAt) && state.phaseEndsAt > 0
        ? state.phaseEndsAt
        : null,
    sessionCount:
      Number.isInteger(state?.sessionCount) && state.sessionCount >= 0
        ? state.sessionCount
        : 0,
    ...normalizedSettings,
  };
}

export function completePomodoroPhase(state, settings) {
  const normalizedSettings = normalizePomodoroSettings(settings);
  const wasBreak = Boolean(state?.isBreak);
  const isBreak = !wasBreak;
  const phaseDuration =
    (isBreak ? normalizedSettings.breakTime : normalizedSettings.focusTime) *
    60;

  return {
    ...state,
    isActive: false,
    isBreak,
    currentTime: phaseDuration,
    initialTime: phaseDuration,
    phaseEndsAt: null,
    sessionCount: Math.max(0, state?.sessionCount ?? 0) + (wasBreak ? 0 : 1),
  };
}
