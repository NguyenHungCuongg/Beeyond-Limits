import test from "node:test";
import assert from "node:assert/strict";

test("background service worker starts and applies blocker messages end to end", async () => {
  const storageState = {};
  const dynamicRules = [];
  const messageListeners = [];
  const alarmListeners = [];
  const startupListeners = [];
  const installedListeners = [];

  globalThis.chrome = {
    alarms: {
      onAlarm: {
        addListener(listener) {
          alarmListeners.push(listener);
        },
      },
      async create() {},
      async clear() {
        return true;
      },
    },
    declarativeNetRequest: {
      async getDynamicRules() {
        return [...dynamicRules];
      },
      async updateDynamicRules({ removeRuleIds, addRules }) {
        for (const ruleId of removeRuleIds) {
          const index = dynamicRules.findIndex((rule) => rule.id === ruleId);
          if (index >= 0) dynamicRules.splice(index, 1);
        }
        dynamicRules.push(...addRules);
      },
    },
    notifications: {
      async create() {
        return "notification-id";
      },
    },
    offscreen: {
      async createDocument() {},
    },
    runtime: {
      getURL(path) {
        return `chrome-extension://test/${path}`;
      },
      async getContexts() {
        return [];
      },
      async sendMessage() {
        return { success: true, ready: true };
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
          return Object.fromEntries(
            keys
              .filter((key) => key in storageState)
              .map((key) => [key, storageState[key]]),
          );
        },
        async set(values) {
          Object.assign(storageState, values);
        },
      },
    },
  };

  await import(`../src/background.js?test=${Date.now()}`);
  await new Promise((resolve) => queueMicrotask(resolve));

  assert.equal(messageListeners.length, 1);
  assert.equal(alarmListeners.length, 1);
  assert.equal(startupListeners.length, 1);
  assert.equal(installedListeners.length, 1);

  const response = await new Promise((resolve) => {
    const keepAlive = messageListeners[0](
      {
        type: "UPDATE_BLOCKING_RULES",
        isBlocking: true,
        blockedUrls: [{ id: 1, url: "https://www.youtube.com/watch?v=1" }],
      },
      {},
      resolve,
    );
    assert.equal(keepAlive, true);
  });

  assert.equal(response.success, true);
  assert.equal(storageState.isBlocking, true);
  assert.equal(storageState.blockedUrls[0].url, "youtube.com");
  assert.deepEqual(dynamicRules[0].condition.requestDomains, ["youtube.com"]);

  delete globalThis.chrome;
});
