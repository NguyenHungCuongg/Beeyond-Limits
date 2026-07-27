import test from "node:test";
import assert from "node:assert/strict";

import {
  FOCUS_STATES,
  FOCUS_PHASES,
  FOCUS_BOUNDS,
  normalizeFocusConfig,
  createFocusSession,
  completeFocusSession,
  abandonFocusSession,
  startBreakSession,
  aggregateDailyProgress,
  calculateStreakDays,
  pruneHistoryRecords,
  isDuplicateCompletion,
} from "../../src/core/focusSession.js";

// =========================================================
// Category 1: 1000+ History Records Performance & Scale
// =========================================================

test("Adversarial: 1000+ history records performance & correctness", () => {
  const now = new Date("2026-07-27T12:00:00Z").getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const totalRecords = 2500;

  const history = [];
  for (let i = 0; i < totalRecords; i++) {
    // Distribute timestamps over the last 150 days (approx 16-17 records per day)
    const daysAgo = (i % 150);
    const timestamp = now - daysAgo * dayMs - (i * 1000);
    const dateObj = new Date(timestamp);
    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;

    history.push({
      id: `hist_${i}`,
      runtimeId: `session_run_${i}`,
      startedAt: timestamp,
      endedAt: timestamp + 25 * 60 * 1000,
      completedAt: timestamp + 25 * 60 * 1000,
      dateStr,
      status: i % 5 === 0 ? FOCUS_STATES.ABANDONED : FOCUS_STATES.FOCUS_COMPLETED,
      focusDurationMinutes: 25,
      actualFocusSeconds: 1500,
    });
  }

  // Test Pruning Performance
  const pruneStart = performance.now();
  const pruned = pruneHistoryRecords(history, 90, 500, now);
  const pruneDuration = performance.now() - pruneStart;

  assert.ok(pruneDuration < 100, `Pruning 2500 records took too long: ${pruneDuration.toFixed(2)}ms`);
  assert.equal(pruned.length, 500, "Pruned records should be capped at maxRecords = 500");

  // Verify sorting order: newest first
  for (let i = 1; i < pruned.length; i++) {
    const prevTime = pruned[i - 1].endedAt || pruned[i - 1].startedAt;
    const currTime = pruned[i].endedAt || pruned[i].startedAt;
    assert.ok(prevTime >= currTime, "Pruned records must be sorted descending by timestamp");
  }

  // Test Streak Performance
  const streakStart = performance.now();
  const streak = calculateStreakDays(history, "2026-07-27");
  const streakDuration = performance.now() - streakStart;
  assert.ok(streakDuration < 50, `Streak calculation took too long: ${streakDuration.toFixed(2)}ms`);
  assert.ok(streak > 0, "Streak should be positive for continuous days");

  // Test Aggregation Performance
  const aggStart = performance.now();
  const agg = aggregateDailyProgress(history, "2026-07-27");
  const aggDuration = performance.now() - aggStart;
  assert.ok(aggDuration < 50, `Aggregation took too long: ${aggDuration.toFixed(2)}ms`);
  assert.ok(agg.completedSessions > 0, "Daily progress should find completed sessions");

  // Test Duplicate Completion Check Performance
  const dupStart = performance.now();
  const isDup = isDuplicateCompletion(history, "session_run_10");
  const dupDuration = performance.now() - dupStart;
  assert.ok(dupDuration < 10, `Duplicate check took too long: ${dupDuration.toFixed(2)}ms`);
  assert.equal(isDup, true, "Should identify existing completed runtimeId");
});

// =========================================================
// Category 2: Duplicate Completion Calls & Idempotency Edge Cases
// =========================================================

test("Adversarial: Duplicate completion calls & idempotency edge cases", () => {
  const now = 1722081000000;
  const session = createFocusSession({ focusDuration: 25 }, now);

  // First completion
  const completed1 = completeFocusSession(session, now + 1500000);
  assert.equal(completed1.status, FOCUS_STATES.FOCUS_COMPLETED);
  assert.equal(completed1.completedAt, now + 1500000);

  // Duplicate completion with different timestamp
  const completed2 = completeFocusSession(completed1, now + 2000000);
  assert.equal(completed2.completedAt, now + 1500000, "Second completion call must not overwrite completedAt");
  assert.deepEqual(completed1, completed2, "Second completion call must return identical object");

  // Duplicate completion check in history array
  const history = [
    { runtimeId: "session_abc", status: FOCUS_STATES.FOCUS_COMPLETED },
    { runtimeId: "session_xyz", status: FOCUS_STATES.ABANDONED },
    { runtimeId: "session_break", status: FOCUS_STATES.BREAK_COMPLETED },
  ];

  assert.equal(isDuplicateCompletion(history, "session_abc"), true);
  assert.equal(isDuplicateCompletion(history, "session_xyz"), false, "Abandoned session is not a completed focus session");
  assert.equal(isDuplicateCompletion(history, "session_break"), false, "Break completed session is not a focus completed session");

  // Edge cases for runtimeId parameter in isDuplicateCompletion
  assert.equal(isDuplicateCompletion(history, null), false);
  assert.equal(isDuplicateCompletion(history, undefined), false);
  assert.equal(isDuplicateCompletion(history, ""), false);
  assert.equal(isDuplicateCompletion(history, 12345), false);
  assert.equal(isDuplicateCompletion(null, "session_abc"), false);

  // Field naming edge case: What if history record has `id` instead of `runtimeId`?
  const historyIdOnly = [
    { id: "session_abc", status: FOCUS_STATES.FOCUS_COMPLETED }
  ];
  const isDupWithId = isDuplicateCompletion(historyIdOnly, "session_abc");
  // Document behavior: isDuplicateCompletion checks r.runtimeId === runtimeId
  assert.equal(isDupWithId, false, "EXPOSURE: records with only 'id' field return false in isDuplicateCompletion");
});

// =========================================================
// Category 3: Timezone Shifts & Date Formatting Edge Cases
// =========================================================

test("Adversarial: Timezone shifts, default reference dates & date string formats", () => {
  // Test timezone format discrepancy between aggregateDailyProgress and calculateStreakDays
  const history = [
    { dateStr: "2026-07-27", status: FOCUS_STATES.FOCUS_COMPLETED, focusDurationMinutes: 25 },
  ];

  // Default aggregateDailyProgress uses new Date().toISOString().split("T")[0] (UTC)
  const defaultAgg = aggregateDailyProgress(history);
  
  // Default calculateStreakDays uses local date (curr.getFullYear()-...)
  const defaultStreak = calculateStreakDays(history);

  assert.ok(typeof defaultAgg.dateStr === "string", "aggregateDailyProgress should produce dateStr string");
  assert.ok(typeof defaultStreak === "number", "calculateStreakDays should return number");

  // Test streak calculation with explicit YYYY-MM-DD vs ISO timestamp
  const streakWithExplicitDate = calculateStreakDays(history, "2026-07-27");
  assert.equal(streakWithExplicitDate, 1);

  // Test leap year streak calculation across Feb 28 -> Feb 29 -> Mar 1 (Leap year 2028)
  const leapYearHistory = [
    { dateStr: "2028-03-01", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2028-02-29", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2028-02-28", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];
  const leapStreak = calculateStreakDays(leapYearHistory, "2028-03-01");
  assert.equal(leapStreak, 3, "Streak should cross leap year Feb 29 correctly");

  // Test year boundary transition (Dec 31 -> Jan 01)
  const yearBoundaryHistory = [
    { dateStr: "2027-01-01", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-12-31", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];
  const yearStreak = calculateStreakDays(yearBoundaryHistory, "2027-01-01");
  assert.equal(yearStreak, 2, "Streak should cross year boundary correctly");

  // Test multiple completions on same date
  const multiSameDayHistory = [
    { dateStr: "2026-07-27", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-27", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-26", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];
  const multiStreak = calculateStreakDays(multiSameDayHistory, "2026-07-27");
  assert.equal(multiStreak, 2, "Multiple sessions on same day count as 1 streak day");
});

// =========================================================
// Category 4: 90-Day Pruning Limits & Field Matching
// =========================================================

test("Adversarial: 90-day pruning limits, completedAt field & boundary conditions", () => {
  const now = new Date("2026-07-27T12:00:00Z").getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const ninetyDaysMs = 90 * dayMs;

  // Record exactly at 90 days ago
  const exact90DaysRecord = {
    id: "rec_exact_90",
    startedAt: now - ninetyDaysMs,
    status: FOCUS_STATES.FOCUS_COMPLETED,
  };

  // Record 90 days + 1 second ago
  const olderThan90Record = {
    id: "rec_90_plus",
    startedAt: now - ninetyDaysMs - 1000,
    status: FOCUS_STATES.FOCUS_COMPLETED,
  };

  // Record 89 days ago
  const within90Record = {
    id: "rec_within_90",
    startedAt: now - 89 * dayMs,
    status: FOCUS_STATES.FOCUS_COMPLETED,
  };

  const pruned = pruneHistoryRecords([exact90DaysRecord, olderThan90Record, within90Record], 90, 500, now);
  
  assert.equal(pruned.some(r => r.id === "rec_within_90"), true, "Record within 90 days must be kept");
  assert.equal(pruned.some(r => r.id === "rec_exact_90"), true, "Record at exact cutoff timestamp (>= cutoffMs) should be kept");
  assert.equal(pruned.some(r => r.id === "rec_90_plus"), false, "Record older than 90 days must be pruned");

  // EXPOSURE TEST: completedAt vs endedAt vs startedAt in pruneHistoryRecords
  // pruneHistoryRecords checks `r.endedAt || r.startedAt || 0`
  const recordWithOnlyCompletedAt = {
    id: "rec_completedAt_only",
    completedAt: now - 10 * dayMs,
    status: FOCUS_STATES.FOCUS_COMPLETED,
  };

  const prunedCompletedAtOnly = pruneHistoryRecords([recordWithOnlyCompletedAt], 90, 500, now);
  assert.equal(
    prunedCompletedAtOnly.length,
    0,
    "BUG EXPOSURE: Record with only completedAt (and no endedAt or startedAt) has recordTime=0 and gets pruned!"
  );

  // Corrupt entries resilience
  const corruptHistory = [
    null,
    undefined,
    {},
    { startedAt: "invalid_date" },
    within90Record,
  ];

  const prunedCorrupt = pruneHistoryRecords(corruptHistory, 90, 500, now);
  assert.ok(Array.isArray(prunedCorrupt), "Should handle corrupt array gracefully");
  assert.equal(prunedCorrupt.some(r => r.id === "rec_within_90"), true);
});

// =========================================================
// Category 5: Daily Streak Calculation Edge Cases
// =========================================================

test("Adversarial: Daily streak edge cases & gaps", () => {
  // Gap in streak
  const gapHistory = [
    { dateStr: "2026-07-27", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-26", status: FOCUS_STATES.FOCUS_COMPLETED },
    // Gap on 2026-07-25
    { dateStr: "2026-07-24", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-23", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];

  assert.equal(calculateStreakDays(gapHistory, "2026-07-27"), 2, "Streak breaks at gap day");

  // Streak starting from a day with only abandoned sessions
  const abandonedOnlyHistory = [
    { dateStr: "2026-07-27", status: FOCUS_STATES.ABANDONED },
    { dateStr: "2026-07-26", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];

  assert.equal(calculateStreakDays(abandonedOnlyHistory, "2026-07-27"), 0, "If reference date has no completed sessions, streak is 0");
  assert.equal(calculateStreakDays(abandonedOnlyHistory, "2026-07-26"), 1, "Streak starting from 2026-07-26 should be 1");

  // Unsorted history records
  const unsortedHistory = [
    { dateStr: "2026-07-25", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-27", status: FOCUS_STATES.FOCUS_COMPLETED },
    { dateStr: "2026-07-26", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];

  assert.equal(calculateStreakDays(unsortedHistory, "2026-07-27"), 3, "Unsorted history array should still calculate correct streak");
});
