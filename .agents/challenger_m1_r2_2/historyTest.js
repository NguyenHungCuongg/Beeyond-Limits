import test from "node:test";
import assert from "node:assert/strict";

import {
  FOCUS_STATES,
  aggregateDailyProgress,
  calculateStreakDays,
  pruneHistoryRecords,
  isDuplicateCompletion,
} from "../../src/core/focusSession.js";

// ==========================================
// Adversarial Suite 1: Morning Streak Rollover Across Midnight
// ==========================================

test("Adversarial 1.1: Morning rollover on regular day (today has 0 sessions, yesterday and day before have completions)", () => {
  const history = [
    { dateStr: "2026-07-26", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-25", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-24", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];

  // Reference date: morning of July 27th (no sessions recorded yet for July 27)
  const streak = calculateStreakDays(history, "2026-07-27");
  assert.equal(streak, 3, "Streak should count 3 consecutive days prior to today");
});

test("Adversarial 1.2: Morning rollover across month boundary (Aug 1 morning, completed July 31 & 30)", () => {
  const history = [
    { dateStr: "2026-07-31", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-30", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];

  const streak = calculateStreakDays(history, "2026-08-01");
  assert.equal(streak, 2, "Streak should seamlessly cross month boundary from July 31 to Aug 1");
});

test("Adversarial 1.3: Morning rollover across year boundary (Jan 1 morning, completed Dec 31 & 30)", () => {
  const history = [
    { dateStr: "2026-12-31", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-12-30", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];

  const streak = calculateStreakDays(history, "2027-01-01");
  assert.equal(streak, 2, "Streak should seamlessly cross year boundary from Dec 31 to Jan 1");
});

test("Adversarial 1.4: Morning rollover across leap year boundary (March 1 morning, completed Feb 29 & 28)", () => {
  const history = [
    { dateStr: "2028-02-29", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2028-02-28", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];

  const streak = calculateStreakDays(history, "2028-03-01");
  assert.equal(streak, 2, "Streak should seamlessly cross leap year boundary Feb 29 to March 1");
});

test("Adversarial 1.5: Streak calculation when today already has completed session", () => {
  const history = [
    { dateStr: "2026-07-27", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-26", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-25", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];

  const streak = calculateStreakDays(history, "2026-07-27");
  assert.equal(streak, 3, "Streak includes today when today has a completion");
});

test("Adversarial 1.6: Broken streak when yesterday was missed (even if 2 days ago completed)", () => {
  const history = [
    { dateStr: "2026-07-25", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-24", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];

  // Today is July 27, yesterday was July 26 (no completion)
  const streak = calculateStreakDays(history, "2026-07-27");
  assert.equal(streak, 0, "Streak should be 0 if yesterday was missed and today has no completion");
});

test("Adversarial 1.7: Unordered history array and duplicate completions on same day", () => {
  const history = [
    { dateStr: "2026-07-25", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-27", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-26", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-27", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-26", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];

  const streak = calculateStreakDays(history, "2026-07-27");
  assert.equal(streak, 3, "Unordered history with duplicate same-day completions calculates correctly");
});

test("Adversarial 1.8: Non-completed status (abandoned, active) does not contribute to streak", () => {
  const history = [
    { dateStr: "2026-07-27", status: FOCUS_STATES.ABANDONED },
    { dateStr: "2026-07-26", status: FOCUS_STATES.ACTIVE_FOCUS },
    { dateStr: "2026-07-25", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];

  const streak = calculateStreakDays(history, "2026-07-27");
  assert.equal(streak, 0, "Abandoned and active sessions must not count toward streak");
});


// ==========================================
// Adversarial Suite 2: History Pruning Logic
// ==========================================

test("Adversarial 2.1: Pruning uses completedAt timestamp correctly", () => {
  const now = new Date("2026-07-27T12:00:00Z").getTime();
  const dayMs = 86400000;

  const history = [
    { id: "h1", completedAt: now - 10 * dayMs, status: FOCUS_STATES.FOCUS_COMPLETED },
    { id: "h2", completedAt: now - 89 * dayMs, status: FOCUS_STATES.FOCUS_COMPLETED },
    { id: "h3", completedAt: now - 91 * dayMs, status: FOCUS_STATES.FOCUS_COMPLETED }, // Expired (>90 days)
  ];

  const pruned = pruneHistoryRecords(history, 90, 500, now);
  assert.equal(pruned.length, 2);
  assert.equal(pruned[0].id, "h1");
  assert.equal(pruned[1].id, "h2");
});

test("Adversarial 2.2: Pruning uses abandonedAt timestamp correctly when completedAt is null", () => {
  const now = new Date("2026-07-27T12:00:00Z").getTime();
  const dayMs = 86400000;

  const history = [
    { id: "a1", abandonedAt: now - 5 * dayMs, status: FOCUS_STATES.ABANDONED },
    { id: "a2", abandonedAt: now - 95 * dayMs, status: FOCUS_STATES.ABANDONED }, // Expired
  ];

  const pruned = pruneHistoryRecords(history, 90, 500, now);
  assert.equal(pruned.length, 1);
  assert.equal(pruned[0].id, "a1");
});

test("Adversarial 2.3: Fallback order for timestamps (completedAt -> abandonedAt -> endedAt -> startedAt)", () => {
  const now = new Date("2026-07-27T12:00:00Z").getTime();
  const dayMs = 86400000;

  const history = [
    { id: "r1", startedAt: now - 1 * dayMs },
    { id: "r2", endedAt: now - 2 * dayMs },
    { id: "r3", abandonedAt: now - 3 * dayMs },
    { id: "r4", completedAt: now - 4 * dayMs },
  ];

  const pruned = pruneHistoryRecords(history, 90, 500, now);
  assert.equal(pruned.length, 4);
  // Sorted descending by resolved timestamp: r1 (now-1), r2 (now-2), r3 (now-3), r4 (now-4)
  assert.equal(pruned[0].id, "r1");
  assert.equal(pruned[1].id, "r2");
  assert.equal(pruned[2].id, "r3");
  assert.equal(pruned[3].id, "r4");
});

test("Adversarial 2.4: Truncates history to maxRecords limit, keeping newest first", () => {
  const now = new Date("2026-07-27T12:00:00Z").getTime();
  const history = [];

  for (let i = 0; i < 100; i++) {
    history.push({
      id: `rec_${i}`,
      completedAt: now - i * 10000,
      status: FOCUS_STATES.FOCUS_COMPLETED,
    });
  }

  const pruned = pruneHistoryRecords(history, 90, 25, now);
  assert.equal(pruned.length, 25, "Should truncate array to maxRecords=25");
  assert.equal(pruned[0].id, "rec_0", "Newest record should be at index 0");
  assert.equal(pruned[24].id, "rec_24", "25th newest record should be at index 24");
});

test("Adversarial 2.5: Resilient to null/undefined/corrupt items and non-array input", () => {
  const now = Date.now();
  const corruptHistory = [
    null,
    undefined,
    {},
    { id: "valid", completedAt: now },
    "invalid_string",
    12345,
  ];

  const pruned = pruneHistoryRecords(corruptHistory, 90, 500, now);
  assert.equal(pruned.length, 1);
  assert.equal(pruned[0].id, "valid");

  assert.deepEqual(pruneHistoryRecords(null), []);
  assert.deepEqual(pruneHistoryRecords("not-an-array"), []);
});


// ==========================================
// Adversarial Suite 3: Local Date String Consistency
// ==========================================

test("Adversarial 3.1: Date string formatting consistency between aggregateDailyProgress and calculateStreakDays", () => {
  const dateStr = "2026-07-27";
  const history = [
    { dateStr: dateStr, status: FOCUS_STATES.FOCUS_COMPLETED, focusDurationMinutes: 25 },
  ];

  const daily = aggregateDailyProgress(history, dateStr);
  const streak = calculateStreakDays(history, dateStr);

  assert.equal(daily.dateStr, dateStr);
  assert.equal(daily.completedSessions, 1);
  assert.equal(streak, 1);
});

test("Adversarial 3.2: Formatting of single-digit months and days with leading zeros", () => {
  const jan5 = new Date(2026, 0, 5); // Jan 5, 2026
  const jan5Str = aggregateDailyProgress([], jan5).dateStr;
  assert.equal(jan5Str, "2026-01-05");

  const sept9 = new Date(2026, 8, 9); // Sept 9, 2026
  const sept9Str = aggregateDailyProgress([], sept9).dateStr;
  assert.equal(sept9Str, "2026-09-09");
});

test("Adversarial 3.3: Graceful fallback on invalid date inputs", () => {
  const progressInvalidStr = aggregateDailyProgress([], "not-a-date");
  assert.match(progressInvalidStr.dateStr, /^\d{4}-\d{2}-\d{2}$/);

  const progressNaN = aggregateDailyProgress([], NaN);
  assert.match(progressNaN.dateStr, /^\d{4}-\d{2}-\d{2}$/);

  const progressNull = aggregateDailyProgress([], null);
  assert.match(progressNull.dateStr, /^\d{4}-\d{2}-\d{2}$/);
});

test("Adversarial 3.4: Duplicate completion check handles runtimeId and id properties", () => {
  const history = [
    { id: "session_1", status: FOCUS_STATES.FOCUS_COMPLETED },
    { runtimeId: "session_2", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];

  assert.equal(isDuplicateCompletion(history, "session_1"), true);
  assert.equal(isDuplicateCompletion(history, "session_2"), true);
  assert.equal(isDuplicateCompletion(history, "session_3"), false);
  assert.equal(isDuplicateCompletion(null, "session_1"), false);
  assert.equal(isDuplicateCompletion(history, null), false);
});
