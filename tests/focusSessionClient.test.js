import test from "node:test";
import assert from "node:assert/strict";
import { createFocusSessionClient } from "../src/core/focusSessionClient.js";

function createRuntime(responses = {}) {
  const messages = [];
  return {
    messages,
    api: {
      async sendMessage(message) {
        messages.push(message);
        const response = responses[message.type];
        return typeof response === "function" ? response(message) : response ?? { success: true };
      },
    },
  };
}

test("focus session client sends state and lifecycle commands", async () => {
  const runtime = createRuntime({
    FOCUS_GET_STATE: { success: true, activeSession: null, templates: [], history: [] },
    FOCUS_START_SESSION: { success: true, activeSession: { id: "runtime-1" } },
    FOCUS_PAUSE_SESSION: { success: true, activeSession: { id: "runtime-1", status: "paused_focus" } },
  });
  const client = createFocusSessionClient(runtime.api);

  const state = await client.getState();
  const started = await client.startSession({ focusDuration: 25 });
  const paused = await client.pauseSession("runtime-1");

  assert.equal(state.activeSession, null);
  assert.equal(started.activeSession.id, "runtime-1");
  assert.equal(paused.activeSession.status, "paused_focus");
  assert.deepEqual(runtime.messages, [
    { type: "FOCUS_GET_STATE" },
    { type: "FOCUS_START_SESSION", config: { focusDuration: 25 } },
    { type: "FOCUS_PAUSE_SESSION", runtimeId: "runtime-1" },
  ]);
});

test("focus session client rejects unsuccessful background responses", async () => {
  const runtime = createRuntime({
    FOCUS_GET_STATE: { success: false, error: "Storage unavailable" },
  });
  const client = createFocusSessionClient(runtime.api);

  await assert.rejects(client.getState(), /Storage unavailable/);
});

test("focus session client fails clearly when the extension runtime is unavailable", async () => {
  const client = createFocusSessionClient(null);

  await assert.rejects(client.getState(), /Extension runtime is unavailable/);
});
