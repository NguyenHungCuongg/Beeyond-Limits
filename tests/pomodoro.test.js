import test from "node:test";
import assert from "node:assert/strict";

import {
  completePomodoroPhase,
  normalizePomodoroSettings,
  restorePomodoroState,
} from "../src/core/pomodoro.js";

test("restorePomodoroState preserves an explicit zero time", () => {
  const state = restorePomodoroState(
    {
      isActive: false,
      isBreak: false,
      currentTime: 0,
      initialTime: 1500,
      sessionCount: 2,
    },
    { focusTime: 25, breakTime: 5, audioEnabled: true },
  );

  assert.equal(state.currentTime, 0);
  assert.equal(state.initialTime, 1500);
});

test("restorePomodoroState uses saved custom settings when state fields are absent", () => {
  const state = restorePomodoroState(
    { isActive: false, isBreak: true },
    { focusTime: 50, breakTime: 12, audioEnabled: false },
  );

  assert.equal(state.currentTime, 12 * 60);
  assert.equal(state.initialTime, 12 * 60);
  assert.equal(state.audioEnabled, false);
});

test("normalizePomodoroSettings rejects invalid durations", () => {
  assert.deepEqual(normalizePomodoroSettings({ focusTime: 0, breakTime: -1 }), {
    focusTime: 25,
    breakTime: 5,
    audioEnabled: true,
  });
});

test("completePomodoroPhase uses custom break and focus durations", () => {
  const breakState = completePomodoroPhase(
    { isBreak: false, sessionCount: 3 },
    { focusTime: 50, breakTime: 12, audioEnabled: true },
  );
  assert.equal(breakState.isBreak, true);
  assert.equal(breakState.currentTime, 12 * 60);
  assert.equal(breakState.sessionCount, 4);

  const focusState = completePomodoroPhase(breakState, {
    focusTime: 50,
    breakTime: 12,
    audioEnabled: true,
  });
  assert.equal(focusState.isBreak, false);
  assert.equal(focusState.currentTime, 50 * 60);
  assert.equal(focusState.sessionCount, 4);
});
