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
        return typeof response === "function"
          ? response(message)
          : (response ?? { success: true });
      },
    },
  };
}

function createStorage(initialData = {}) {
  const data = { ...initialData };
  return {
    local: {
      async get(keys) {
        if (!keys) return { ...data };
        const result = {};
        for (const key of keys) {
          if (key in data) result[key] = data[key];
        }
        return result;
      },
      async set(items) {
        Object.assign(data, items);
      },
    },
  };
}

test("focus session client sends state and lifecycle commands", async () => {
  const runtime = createRuntime({
    FOCUS_GET_STATE: {
      success: true,
      activeSession: null,
      templates: [],
      history: [],
    },
    FOCUS_START_SESSION: { success: true, activeSession: { id: "runtime-1" } },
    FOCUS_PAUSE_SESSION: {
      success: true,
      activeSession: { id: "runtime-1", status: "paused_focus" },
    },
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

test("focus session client previews the selected ambient sound at its configured volume", async () => {
  const runtime = createRuntime({
    AMBIENT_TEST_SOUND: { success: true },
  });
  const client = createFocusSessionClient(runtime.api);

  await client.testAmbientSound("bird", 35);
  await client.testAmbientSound("ocean_waves", 70);

  assert.deepEqual(runtime.messages, [
    { type: "AMBIENT_TEST_SOUND", soundKey: "bird", volume: 35 },
    { type: "AMBIENT_TEST_SOUND", soundKey: "ocean_waves", volume: 70 },
  ]);
});

test("focus session client requests the next work cycle without reopening setup", async () => {
  const runtime = createRuntime({
    FOCUS_START_NEXT_CYCLE: {
      success: true,
      activeSession: { id: "runtime-1", status: "active_focus" },
    },
  });
  const client = createFocusSessionClient(runtime.api);

  const response = await client.startNextCycle("runtime-1");

  assert.equal(response.activeSession.status, "active_focus");
  assert.deepEqual(runtime.messages, [
    { type: "FOCUS_START_NEXT_CYCLE", runtimeId: "runtime-1" },
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

test("focus session client completes linked task in storage", async () => {
  const runtime = createRuntime({});
  const storage = createStorage({
    tasks: [
      { id: 1, text: "Task 1", completed: false },
      { id: 2, text: "Task 2", completed: false },
    ],
  });
  const client = createFocusSessionClient(runtime.api, storage);

  const result = await client.completeTask(1);
  assert.equal(result.success, true);
  assert.equal(result.updated, true);

  const { tasks } = await storage.local.get(["tasks"]);
  assert.equal(tasks[0].completed, true);
  assert.equal(tasks[1].completed, false);

  // Idempotent test
  const result2 = await client.completeTask(1);
  assert.equal(result2.success, true);
  assert.equal(result2.updated, false);
});

test("focus session client completes string-id tasks and tolerates malformed storage", async () => {
  const runtime = createRuntime({});
  const storage = createStorage({
    tasks: [
      { id: "task-1", text: "Task 1", completed: false },
      { id: "task-2", text: "Task 2", completed: false },
    ],
  });
  const client = createFocusSessionClient(runtime.api, storage);

  const result = await client.completeTask("task-1");
  assert.deepEqual(result, { success: true, updated: true });
  assert.equal((await storage.local.get(["tasks"])).tasks[0].completed, true);

  await storage.local.set({ tasks: { corrupted: true } });
  await assert.doesNotReject(() => client.completeTask("task-2"));
});
