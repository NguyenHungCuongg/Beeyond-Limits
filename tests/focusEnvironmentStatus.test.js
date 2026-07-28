import test from "node:test";
import assert from "node:assert/strict";
import { getFocusEnvironmentIndicators } from "../src/core/focusEnvironmentStatus.js";

test("Focus environment hides features that are off", () => {
  const indicators = getFocusEnvironmentIndicators({
    phase: "focus",
    status: "active_focus",
    snapshot: {
      blocker: { enabled: false, blockedUrls: [] },
      ambientSound: { enabled: false, sounds: {} },
    },
  });

  assert.deepEqual(indicators, []);
});

test("Focus environment describes the active blocker and ambient mix", () => {
  const indicators = getFocusEnvironmentIndicators({
    phase: "focus",
    status: "active_focus",
    snapshot: {
      blocker: {
        enabled: true,
        blockedUrls: [{ url: "youtube.com" }, { url: "reddit.com" }],
      },
      ambientSound: {
        enabled: true,
        sounds: {
          ocean_waves: { enabled: true },
          rain: { enabled: true },
        },
      },
    },
  });

  assert.deepEqual(indicators, [
    { type: "blocker", text: "Blocking 2 sites" },
    { type: "sound", text: "Ocean Waves + Rain playing" },
  ]);
});

test("Focus environment reports paused audio but keeps blocker status", () => {
  const indicators = getFocusEnvironmentIndicators({
    phase: "focus",
    status: "paused_focus",
    snapshot: {
      blocker: {
        enabled: true,
        blockedUrls: [{ url: "youtube.com" }],
      },
      ambientSound: {
        enabled: true,
        soundId: "bird",
      },
    },
  });

  assert.deepEqual(indicators, [
    { type: "blocker", text: "Blocking 1 site" },
    { type: "sound", text: "Birds paused" },
  ]);
});

test("Focus environment hides focus-only indicators during a break", () => {
  const indicators = getFocusEnvironmentIndicators({
    phase: "break",
    status: "active_break",
    snapshot: {
      blocker: {
        enabled: true,
        blockedUrls: [{ url: "youtube.com" }],
      },
      ambientSound: {
        enabled: true,
        soundId: "rain",
      },
    },
  });

  assert.deepEqual(indicators, []);
});
