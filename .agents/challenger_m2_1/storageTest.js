import test from "node:test";
import assert from "node:assert/strict";

import {
  STORAGE_KEYS,
  getActiveFocusSession,
  setActiveFocusSession,
  clearActiveFocusSession,
  getFocusTemplates,
  saveFocusTemplate,
  deleteFocusTemplate,
  getFocusHistory,
  appendFocusHistory,
  getFocusPreferences,
  updateFocusPreferences,
  initializeFocusStorage,
} from "../../src/core/focusStorage.js";

import {
  DEFAULT_TEMPLATES,
  DEFAULT_FOCUS_SETTINGS,
  FOCUS_STATES,
} from "../../src/core/focusSession.js";

/**
 * Helper to create a configurable mock Chrome storage API.
 */
function createMockStorage(initialData = {}, options = {}) {
  const store = new Map(Object.entries(initialData));
  const { delayMs = 0, quotaErrorOnSet = false, getError = false } = options;

  async function sleep() {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    async get(keys) {
      await sleep();
      if (getError) {
        throw new Error("STORAGE_GET_FAILED: Storage read error");
      }
      if (keys === null || keys === undefined) {
        return Object.fromEntries(store.entries());
      }
      if (typeof keys === "string") {
        return store.has(keys) ? { [keys]: store.get(keys) } : {};
      }
      if (Array.isArray(keys)) {
        const result = {};
        for (const k of keys) {
          if (store.has(k)) result[k] = store.get(k);
        }
        return result;
      }
      if (typeof keys === "object") {
        const result = {};
        for (const [k, defaultVal] of Object.entries(keys)) {
          result[k] = store.has(k) ? store.get(k) : defaultVal;
        }
        return result;
      }
      return {};
    },
    async set(items) {
      await sleep();
      if (quotaErrorOnSet) {
        throw new Error("MAX_WRITE_OPERATIONS_PER_MINUTE: Quota exceeded");
      }
      for (const [k, v] of Object.entries(items)) {
        store.set(k, v);
      }
    },
    async remove(keys) {
      await sleep();
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) {
        store.delete(k);
      }
    },
    _getRaw(key) {
      return store.get(key);
    },
    _getAll() {
      return Object.fromEntries(store.entries());
    },
  };
}

// ==========================================
// CATEGORY 1: Storage Quota Edge Cases
// ==========================================

test("QUOTA: storage.set rejection propagates error when quota exceeded on setActiveFocusSession", async () => {
  const mockStorage = createMockStorage({}, { quotaErrorOnSet: true });
  const session = { id: "sess_1", status: FOCUS_STATES.ACTIVE_FOCUS };

  await assert.rejects(
    async () => setActiveFocusSession(session, mockStorage),
    (err) => err.message.includes("MAX_WRITE_OPERATIONS_PER_MINUTE")
  );
});

test("QUOTA: storage.set rejection propagates error when quota exceeded on saveFocusTemplate", async () => {
  const mockStorage = createMockStorage({}, { quotaErrorOnSet: true });

  await assert.rejects(
    async () => saveFocusTemplate({ name: "Quota Test" }, mockStorage),
    (err) => err.message.includes("MAX_WRITE_OPERATIONS_PER_MINUTE")
  );
});

test("QUOTA: storage.set rejection propagates error when quota exceeded on appendFocusHistory", async () => {
  const mockStorage = createMockStorage({}, { quotaErrorOnSet: true });

  await assert.rejects(
    async () => appendFocusHistory({ runtimeId: "sess_q1", status: FOCUS_STATES.FOCUS_COMPLETED }, mockStorage),
    (err) => err.message.includes("MAX_WRITE_OPERATIONS_PER_MINUTE")
  );
});

test("QUOTA: storage.set rejection propagates error when quota exceeded on updateFocusPreferences", async () => {
  const mockStorage = createMockStorage({}, { quotaErrorOnSet: true });

  await assert.rejects(
    async () => updateFocusPreferences({ focusDuration: 45 }, mockStorage),
    (err) => err.message.includes("MAX_WRITE_OPERATIONS_PER_MINUTE")
  );
});

test("QUOTA: storage.get failure propagates error gracefully", async () => {
  const mockStorage = createMockStorage({}, { getError: true });

  await assert.rejects(
    async () => getActiveFocusSession(mockStorage),
    (err) => err.message.includes("STORAGE_GET_FAILED")
  );

  await assert.rejects(
    async () => initializeFocusStorage(mockStorage),
    (err) => err.message.includes("STORAGE_GET_FAILED")
  );
});

// ==========================================
// CATEGORY 2: Corrupted Storage Payloads
// ==========================================

test("CORRUPTION: getFocusTemplates handles null or corrupted array items without throwing unhandled exceptions", async () => {
  const mockStorage = createMockStorage({
    [STORAGE_KEYS.TEMPLATES]: [null, undefined, 123, "invalid_item", { id: "valid_1", name: "Valid" }],
  });

  const templates = await getFocusTemplates(mockStorage);
  assert.equal(templates.length, 5);

  // SAVE attempt when storage contains null/corrupted items
  // Vulnerability test: saveFocusTemplate uses currentTemplates.findIndex((t) => t.id === templateId)
  // If t is null or non-object, t.id throws TypeError!
  let saveThrew = false;
  try {
    await saveFocusTemplate({ id: "new_temp", name: "New" }, mockStorage);
  } catch (err) {
    saveThrew = true;
    assert.ok(err instanceof TypeError, "saveFocusTemplate throws TypeError on null items in templates array");
  }
  assert.equal(saveThrew, true, "CONFIRMED VULNERABILITY: saveFocusTemplate crashes with TypeError on null array elements");

  // DELETE attempt when storage contains null/corrupted items
  let deleteThrew = false;
  try {
    await deleteFocusTemplate("valid_1", mockStorage);
  } catch (err) {
    deleteThrew = true;
    assert.ok(err instanceof TypeError, "deleteFocusTemplate throws TypeError on null items in templates array");
  }
  assert.equal(deleteThrew, true, "CONFIRMED VULNERABILITY: deleteFocusTemplate crashes with TypeError on null array elements");
});

test("CORRUPTION: getFocusPreferences with non-object/array corrupted payload", async () => {
  // Case A: preferences is an array
  const mockStorageArray = createMockStorage({
    [STORAGE_KEYS.PREFERENCES]: ["corrupted_array_item"],
  });

  const prefsFromArray = await getFocusPreferences(mockStorageArray);
  // typeof [] === "object", so typeof storedPrefs !== "object" fails to catch array!
  assert.equal(typeof prefsFromArray, "object");
  // Check if numeric key "0" got mixed into preferences
  assert.equal("0" in prefsFromArray, true, "CONFIRMED VULNERABILITY: array preferences spread numeric keys into preferences object");

  // Case B: ambientSound is a string instead of object
  const mockStorageStringSound = createMockStorage({
    [STORAGE_KEYS.PREFERENCES]: {
      focusDuration: 25,
      ambientSound: "rain",
    },
  });

  const prefsFromSoundStr = await getFocusPreferences(mockStorageStringSound);
  // Spreading "rain" results in { '0': 'r', '1': 'a', '2': 'i', '3': 'n', enabled: false, soundId: null, volume: 50 }
  assert.equal("0" in prefsFromSoundStr.ambientSound, true, "CONFIRMED VULNERABILITY: string ambientSound spreads character indices into ambientSound object");
});

test("CORRUPTION: getActiveFocusSession returning non-object primitive", async () => {
  const mockStorage = createMockStorage({
    [STORAGE_KEYS.ACTIVE_SESSION]: "corrupted_string_session",
  });

  const session = await getActiveFocusSession(mockStorage);
  assert.equal(session, "corrupted_string_session"); // No runtime type validation on read
});

test("CORRUPTION: initializeFocusStorage when storage contains corrupted template non-array object", async () => {
  const mockStorage = createMockStorage({
    [STORAGE_KEYS.TEMPLATES]: { corrupted: "not_an_array" },
  });

  const state = await initializeFocusStorage(mockStorage);
  // Should overwrite templates with default templates
  assert.deepEqual(state.focusSessionTemplates, DEFAULT_TEMPLATES);
  assert.deepEqual(mockStorage._getRaw(STORAGE_KEYS.TEMPLATES), DEFAULT_TEMPLATES);
});

// ==========================================
// CATEGORY 3: Duplicate Template IDs
// ==========================================

test("DUPLICATE_IDS: saveFocusTemplate when duplicate template IDs exist in storage", async () => {
  const dupTemplate1 = { id: "template_dup", name: "Original Duplicate A", focusDuration: 25 };
  const dupTemplate2 = { id: "template_dup", name: "Original Duplicate B", focusDuration: 50 };

  const mockStorage = createMockStorage({
    [STORAGE_KEYS.TEMPLATES]: [dupTemplate1, dupTemplate2],
  });

  // Save update for template_dup
  await saveFocusTemplate({ id: "template_dup", name: "Updated Duplicate", focusDuration: 30 }, mockStorage);

  const resultingTemplates = await getFocusTemplates(mockStorage);
  
  // Notice: findIndex finds the first match at index 0 and updates it.
  // The second duplicate entry remains untouched at index 1!
  assert.equal(resultingTemplates.length, 2, "Duplicate template ID remains in templates array after save");
  assert.equal(resultingTemplates[0].name, "Updated Duplicate");
  assert.equal(resultingTemplates[1].name, "Original Duplicate B");
  assert.equal(resultingTemplates[0].id, resultingTemplates[1].id, "CONFIRMED VULNERABILITY: Duplicate IDs persist after template save");
});

test("DUPLICATE_IDS: deleteFocusTemplate removes ALL templates matching templateId", async () => {
  const dup1 = { id: "dup_id", name: "Dup 1" };
  const dup2 = { id: "dup_id", name: "Dup 2" };
  const unique = { id: "unique_id", name: "Unique" };

  const mockStorage = createMockStorage({
    [STORAGE_KEYS.TEMPLATES]: [dup1, dup2, unique],
  });

  const deleted = await deleteFocusTemplate("dup_id", mockStorage);
  assert.equal(deleted, true);

  const remaining = await getFocusTemplates(mockStorage);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, "unique_id");
});

// ==========================================
// CATEGORY 4: Concurrent Get/Set Calls (Race Conditions)
// ==========================================

test("CONCURRENCY: concurrent saveFocusTemplate calls cause lost updates", async () => {
  // Simulate asynchronous storage with 10ms I/O latency
  const mockStorage = createMockStorage({}, { delayMs: 10 });

  // Fire 5 concurrent save operations
  const savePromises = [
    saveFocusTemplate({ name: "Concurrent Template 1", focusDuration: 15 }, mockStorage),
    saveFocusTemplate({ name: "Concurrent Template 2", focusDuration: 20 }, mockStorage),
    saveFocusTemplate({ name: "Concurrent Template 3", focusDuration: 30 }, mockStorage),
    saveFocusTemplate({ name: "Concurrent Template 4", focusDuration: 40 }, mockStorage),
    saveFocusTemplate({ name: "Concurrent Template 5", focusDuration: 45 }, mockStorage),
  ];

  await Promise.all(savePromises);

  const finalTemplates = await getFocusTemplates(mockStorage);
  
  // Default templates length is 3. We added 5 templates, so expected total is 8.
  // Due to race condition in read-modify-write without serialization, intermediate updates are lost!
  const expectedCount = DEFAULT_TEMPLATES.length + 5;
  const actualCount = finalTemplates.length;

  assert.notEqual(
    actualCount,
    expectedCount,
    `CONFIRMED VULNERABILITY: Lost updates in concurrent saveFocusTemplate! Expected ${expectedCount} templates, but found ${actualCount}`
  );
});

test("CONCURRENCY: concurrent appendFocusHistory calls cause lost history records", async () => {
  const mockStorage = createMockStorage({}, { delayMs: 10 });

  const historyRecords = [
    { runtimeId: "c_sess_1", status: FOCUS_STATES.FOCUS_COMPLETED, focusDurationMinutes: 25 },
    { runtimeId: "c_sess_2", status: FOCUS_STATES.FOCUS_COMPLETED, focusDurationMinutes: 25 },
    { runtimeId: "c_sess_3", status: FOCUS_STATES.FOCUS_COMPLETED, focusDurationMinutes: 25 },
    { runtimeId: "c_sess_4", status: FOCUS_STATES.FOCUS_COMPLETED, focusDurationMinutes: 25 },
  ];

  await Promise.all(historyRecords.map((r) => appendFocusHistory(r, mockStorage)));

  const finalHistory = await getFocusHistory(mockStorage);
  
  // 4 history items were appended concurrently. If properly serialized, finalHistory.length would be 4.
  assert.notEqual(
    finalHistory.length,
    4,
    `CONFIRMED VULNERABILITY: Lost history entries in concurrent appendFocusHistory! Expected 4, found ${finalHistory.length}`
  );
});

test("CONCURRENCY: concurrent updateFocusPreferences calls cause lost preference fields", async () => {
  const mockStorage = createMockStorage({}, { delayMs: 10 });

  // Call 1 updates focusDuration to 50
  // Call 2 updates breakDuration to 15
  await Promise.all([
    updateFocusPreferences({ focusDuration: 50 }, mockStorage),
    updateFocusPreferences({ breakDuration: 15 }, mockStorage),
  ]);

  const finalPrefs = await getFocusPreferences(mockStorage);

  // If atomic or serialized, both focusDuration = 50 AND breakDuration = 15 would be present.
  const hasBothUpdates = finalPrefs.focusDuration === 50 && finalPrefs.breakDuration === 15;

  assert.equal(
    hasBothUpdates,
    false,
    `CONFIRMED VULNERABILITY: Concurrent preference updates overwrite each other! focusDuration: ${finalPrefs.focusDuration}, breakDuration: ${finalPrefs.breakDuration}`
  );
});
