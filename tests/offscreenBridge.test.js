import test from "node:test";
import assert from "node:assert/strict";

import { createOffscreenBridge } from "../src/core/offscreenBridge.js";

test("concurrent ensure calls create only one offscreen document", async () => {
  let createCalls = 0;
  const chromeApi = {
    runtime: {
      async getContexts() {
        return [];
      },
      async sendMessage(message) {
        assert.equal(message.type, "PING_OFFSCREEN");
        return { success: true, ready: true };
      },
    },
    offscreen: {
      async createDocument() {
        createCalls += 1;
        await new Promise((resolve) => queueMicrotask(resolve));
      },
    },
  };

  const bridge = createOffscreenBridge(chromeApi);
  await Promise.all([bridge.ensure(), bridge.ensure(), bridge.ensure()]);

  assert.equal(createCalls, 1);
});

test("send rejects a failure response from the offscreen document", async () => {
  const chromeApi = {
    runtime: {
      async getContexts() {
        return [{ contextType: "OFFSCREEN_DOCUMENT" }];
      },
      async sendMessage(message) {
        if (message.type === "PING_OFFSCREEN") {
          return { success: true, ready: true };
        }
        return { success: false, error: "playback failed" };
      },
    },
    offscreen: {
      async createDocument() {
        throw new Error("should not create");
      },
    },
  };

  const bridge = createOffscreenBridge(chromeApi);
  await assert.rejects(
    bridge.send({ type: "START_AMBIENT_SOUND", target: "offscreen" }),
    /playback failed/,
  );
});
