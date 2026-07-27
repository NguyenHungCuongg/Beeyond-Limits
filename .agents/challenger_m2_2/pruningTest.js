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
  FOCUS_BOUNDS,
} from "../../src/core/focusSession.js";

/**
 * Mock Chrome Storage API helper for testing.
 */
function createMockStorage(initialData = {}) {
  const store = new Map(Object.entries(initialData));

  return {
    async get(keys) {
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
      for (const [k, v] of Object.entries(items)) {
        store.set(k, v);
      }
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) {
        store.delete(k);
      }
    },
    _getRaw(key) {
      return store.get(key);
    },
    _has(key) {
      return store.has(key);
    },
  };
}

// ============================================================================
// Adversarial Suite 1: 600+ Records History Pruning & Capacity Stress Test
// ============================================================================

test("ADVERSARIAL: Append 650 records sequentially - verifies 500 max record limit and recency ordering", async () => {
  const mockStorage = createMockStorage();
  const baseTime = Date.now();
  const minuteMs = 60 * 1000;

  // Append 650 records incrementally
  for (let i = 1; i <= 650; i++) {
    const record = {
      runtimeId: `session_bulk_${i}`,
      status: FOCUS_STATES.FOCUS_COMPLETED,
      focusDurationMinutes: 25,
      actualFocusSeconds: 1500,
      completedAt: baseTime + i * minuteMs, // sequential increasing time
    };
    await appendFocusHistory(record, mockStorage);
  }

  const history = await getFocusHistory(mockStorage);

  // Requirement: Capacity must be strictly capped at 500 (FOCUS_BOUNDS.MAX_HISTORY_RECORDS)
  assert.equal(history.length, 500, `Expected history length to be 500, got ${history.length}`);

  // Requirement: Most recent record (i = 650) must be at index 0 (sorted newest first)
  assert.equal(history[0].runtimeId, "session_bulk_650");

  // Requirement: Oldest retained record must be i = 151 (650 - 500 + 1)
  assert.equal(history[history.length - 1].runtimeId, "session_bulk_151");

  // Verify that purged items (i = 1 to 150) are no longer present
  const containsPurged = history.some((r) => r.runtimeId === "session_bulk_1");
  assert.equal(containsPurged, false, "Oldest record (session_bulk_1) should have been pruned");
});

test("ADVERSARIAL: Append 600 records with mixed ages (100 > 90 days old) - verifies 90-day cutoff pruning", async () => {
  const mockStorage = createMockStorage();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // 100 records older than 90 days (100 to 199 days old)
  for (let i = 100; i < 200; i++) {
    await appendFocusHistory(
      {
        runtimeId: `old_session_${i}`,
        status: FOCUS_STATES.FOCUS_COMPLETED,
        completedAt: now - i * dayMs,
      },
      mockStorage
    );
  }

  // 500 records within last 30 days
  for (let i = 1; i <= 500; i++) {
    await appendFocusHistory(
      {
        runtimeId: `recent_session_${i}`,
        status: FOCUS_STATES.FOCUS_COMPLETED,
        completedAt: now - (i % 30) * dayMs - i * 1000,
      },
      mockStorage
    );
  }

  const history = await getFocusHistory(mockStorage);

  // All 100 old sessions (> 90 days) must be pruned
  const hasOldSession = history.some((r) => r.runtimeId.startsWith("old_session_"));
  assert.equal(hasOldSession, false, "Sessions older than 90 days must be pruned out");

  // Remaining history length must not exceed 500
  assert.ok(history.length <= 500, `Expected history <= 500, got ${history.length}`);
});

test("ADVERSARIAL: Append invalid/malformed history records handling", async () => {
  const mockStorage = createMockStorage();

  // Test non-object / empty inputs
  let res = await appendFocusHistory(null, mockStorage);
  assert.deepEqual(res, []);

  res = await appendFocusHistory(undefined, mockStorage);
  assert.deepEqual(res, []);

  res = await appendFocusHistory("not an object", mockStorage);
  assert.deepEqual(res, []);

  // Append valid record with completedAt timestamp
  const recordWithTime = {
    runtimeId: "session_valid_timestamp",
    status: FOCUS_STATES.FOCUS_COMPLETED,
    completedAt: Date.now(),
  };
  res = await appendFocusHistory(recordWithTime, mockStorage);
  assert.equal(res.length, 1);
  assert.ok(res[0].dateStr, "dateStr should be generated");
});

// ============================================================================
// Adversarial Suite 2: Duplicate Completion & Idempotency Testing
// ============================================================================

test("ADVERSARIAL: Duplicate completion attempts with same runtimeId - idempotency check", async () => {
  const mockStorage = createMockStorage();
  const runtimeId = "unique_session_001";
  const now = Date.now();

  const originalRecord = {
    runtimeId,
    status: FOCUS_STATES.FOCUS_COMPLETED,
    completedAt: now,
    focusDurationMinutes: 25,
  };

  const firstAppend = await appendFocusHistory(originalRecord, mockStorage);
  assert.equal(firstAppend.length, 1);

  // Attempt duplicate append with different timestamp / payload
  const duplicateRecord = {
    runtimeId,
    status: FOCUS_STATES.FOCUS_COMPLETED,
    completedAt: now + 5000,
    focusDurationMinutes: 30,
  };

  const secondAppend = await appendFocusHistory(duplicateRecord, mockStorage);
  assert.equal(secondAppend.length, 1, "Duplicate completion should not increase history count");
  assert.equal(secondAppend[0].completedAt, now, "Original record should remain unaltered");
});

test("ADVERSARIAL: Abandoned session followed by completion attempt with same runtimeId", async () => {
  const mockStorage = createMockStorage();
  const runtimeId = "session_abandoned_then_completed";
  const now = Date.now();

  // Record 1: Abandoned session
  const abandonedRecord = {
    runtimeId,
    status: FOCUS_STATES.ABANDONED,
    abandonedAt: now,
    abandonReason: "user_cancelled",
  };

  await appendFocusHistory(abandonedRecord, mockStorage);
  const afterAbandon = await getFocusHistory(mockStorage);
  assert.equal(afterAbandon.length, 1);
  assert.equal(afterAbandon[0].status, FOCUS_STATES.ABANDONED);

  // Record 2: Completed session with same runtimeId
  const completedRecord = {
    runtimeId,
    status: FOCUS_STATES.FOCUS_COMPLETED,
    completedAt: now + 1000,
  };

  const afterCompleted = await appendFocusHistory(completedRecord, mockStorage);
  assert.equal(afterCompleted.length, 2, "Abandoned session + completed session with same runtimeId adds record");
});

test("ADVERSARIAL: Multiple duplicate completions when history is at maximum capacity (500)", async () => {
  const mockStorage = createMockStorage();
  const now = Date.now();

  // Pre-fill history with 500 records
  for (let i = 0; i < 500; i++) {
    await appendFocusHistory(
      {
        runtimeId: `cap_session_${i}`,
        status: FOCUS_STATES.FOCUS_COMPLETED,
        completedAt: now - (500 - i) * 1000,
      },
      mockStorage
    );
  }

  let history = await getFocusHistory(mockStorage);
  assert.equal(history.length, 500);

  // Attempt duplicate append of an existing session (`cap_session_250`)
  const dupRecord = {
    runtimeId: "cap_session_250",
    status: FOCUS_STATES.FOCUS_COMPLETED,
    completedAt: now,
  };

  const dupResult = await appendFocusHistory(dupRecord, mockStorage);
  assert.equal(dupResult.length, 500, "Duplicate append at max capacity must maintain exact count of 500");
});

// ============================================================================
// Adversarial Suite 3: Preference Merging & Boundary Hardening
// ============================================================================

test("ADVERSARIAL: Deep preference merging with partial updates", async () => {
  const mockStorage = createMockStorage();

  // Initial update
  await updateFocusPreferences({ focusDuration: 30, blockerEnabled: false }, mockStorage);

  let current = await getFocusPreferences(mockStorage);
  assert.equal(current.focusDuration, 30);
  assert.equal(current.blockerEnabled, false);
  assert.equal(current.breakDuration, DEFAULT_FOCUS_SETTINGS.breakDuration);

  // Partial update targeting only ambientSound volume
  await updateFocusPreferences({ ambientSound: { volume: 75 } }, mockStorage);

  current = await getFocusPreferences(mockStorage);
  assert.equal(current.focusDuration, 30, "focusDuration should be preserved");
  assert.equal(current.blockerEnabled, false, "blockerEnabled should be preserved");
  assert.equal(current.ambientSound.volume, 75, "volume should be updated");
});

test("ADVERSARIAL: Preference updates with out-of-bounds & invalid types", async () => {
  const mockStorage = createMockStorage();

  const extremeUpdate = {
    focusDuration: 999, // Max allowed is 120
    breakDuration: -50, // Min allowed is 1
    ambientSound: {
      enabled: true,
      soundId: "forest",
      volume: 250, // Max allowed is 100
    },
  };

  const updated = await updateFocusPreferences(extremeUpdate, mockStorage);

  assert.equal(updated.focusDuration, FOCUS_BOUNDS.MAX_FOCUS_MINUTES, "focusDuration must be clamped to 120");
  assert.equal(updated.breakDuration, FOCUS_BOUNDS.MIN_BREAK_MINUTES, "breakDuration must be clamped to 1");
  assert.equal(updated.ambientSound.volume, 100, "volume must be clamped to 100");
  assert.equal(updated.ambientSound.soundId, "forest");
});

test("ADVERSARIAL: Preference update with null / empty object / corrupt storage state", async () => {
  const mockStorage = createMockStorage({
    [STORAGE_KEYS.PREFERENCES]: null, // Corrupt null storage
  });

  const prefs = await getFocusPreferences(mockStorage);
  assert.deepEqual(prefs, DEFAULT_FOCUS_SETTINGS, "Should fallback to DEFAULT_FOCUS_SETTINGS on null storage");

  const updated = await updateFocusPreferences({}, mockStorage);
  assert.equal(updated.focusDuration, DEFAULT_FOCUS_SETTINGS.focusDuration);
});
