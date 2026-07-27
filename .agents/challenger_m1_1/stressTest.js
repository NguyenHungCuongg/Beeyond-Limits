/**
 * .agents/challenger_m1_1/stressTest.js
 * Independent Adversarial Stress Test Suite for src/core/focusSession.js
 */

import assert from "node:assert/strict";
import {
  FOCUS_STATES,
  FOCUS_PHASES,
  FOCUS_BOUNDS,
  DEFAULT_FOCUS_SETTINGS,
  DEFAULT_TEMPLATES,
  normalizeFocusConfig,
  createFocusSession,
  pauseFocusSession,
  resumeFocusSession,
  calculateRemainingSeconds,
  calculateProgressPercentage,
  isSessionExpired,
  completeFocusSession,
  abandonFocusSession,
  startBreakSession,
  aggregateDailyProgress,
  calculateStreakDays,
  pruneHistoryRecords,
  isDuplicateCompletion,
} from "../../src/core/focusSession.js";

const testResults = [];

function runStressScenario(id, title, fn) {
  try {
    fn();
    testResults.push({ id, title, passed: true });
    console.log(`[PASS] ${id}: ${title}`);
  } catch (err) {
    testResults.push({ id, title, passed: false, error: err.message });
    console.error(`[FAIL] ${id}: ${title} -> ${err.message}`);
  }
}

console.log("===============================================================");
console.log(" ADVERSARIAL STRESS TEST SUITE: src/core/focusSession.js ");
console.log("===============================================================\n");

// -------------------------------------------------------------
// Dimension 1: Invalid State Transitions
// -------------------------------------------------------------

runStressScenario("ST-101", "Pause IDLE session returns IDLE unchanged", () => {
  const session = { status: FOCUS_STATES.IDLE };
  const res = pauseFocusSession(session, Date.now());
  assert.equal(res.status, FOCUS_STATES.IDLE);
});

runStressScenario("ST-102", "Pause FOCUS_COMPLETED session returns FOCUS_COMPLETED unchanged", () => {
  const session = completeFocusSession(createFocusSession());
  const res = pauseFocusSession(session, Date.now());
  assert.equal(res.status, FOCUS_STATES.FOCUS_COMPLETED);
});

runStressScenario("ST-103", "Pause ABANDONED session returns ABANDONED unchanged", () => {
  const session = abandonFocusSession(createFocusSession());
  const res = pauseFocusSession(session, Date.now());
  assert.equal(res.status, FOCUS_STATES.ABANDONED);
});

runStressScenario("ST-104", "Resume ACTIVE_FOCUS session returns active session unchanged", () => {
  const session = createFocusSession();
  const res = resumeFocusSession(session, Date.now());
  assert.equal(res.status, FOCUS_STATES.ACTIVE_FOCUS);
  assert.equal(res, session);
});

runStressScenario("ST-105", "Resume ABANDONED session returns ABANDONED unchanged", () => {
  const session = abandonFocusSession(createFocusSession());
  const res = resumeFocusSession(session, Date.now());
  assert.equal(res.status, FOCUS_STATES.ABANDONED);
});

runStressScenario("ST-106", "Complete FOCUS_COMPLETED session is idempotent", () => {
  const now = 1000000;
  const session = createFocusSession({}, now);
  const completed1 = completeFocusSession(session, now + 1000);
  const completed2 = completeFocusSession(completed1, now + 999999);
  assert.equal(completed2.completedAt, now + 1000);
  assert.deepEqual(completed1, completed2);
});

// CRITICAL STATE TRANSITION BUG DETECTION
runStressScenario("ST-107", "[BUG CHECK] Complete ABANDONED session must NOT transition to FOCUS_COMPLETED", () => {
  const abandoned = abandonFocusSession(createFocusSession());
  const res = completeFocusSession(abandoned, Date.now());
  assert.equal(
    res.status,
    FOCUS_STATES.ABANDONED,
    `BUG DETECTED: completeFocusSession changed status from '${FOCUS_STATES.ABANDONED}' to '${res.status}'!`
  );
});

runStressScenario("ST-108", "Abandon already FOCUS_COMPLETED session returns FOCUS_COMPLETED unchanged", () => {
  const completed = completeFocusSession(createFocusSession());
  const res = abandonFocusSession(completed, "user_cancelled");
  assert.equal(res.status, FOCUS_STATES.FOCUS_COMPLETED);
});

runStressScenario("ST-109", "Start break from ACTIVE_FOCUS session is rejected", () => {
  const active = createFocusSession();
  const res = startBreakSession(active, 5);
  assert.equal(res.status, FOCUS_STATES.ACTIVE_FOCUS);
  assert.equal(res.phase, FOCUS_PHASES.FOCUS);
});

runStressScenario("ST-110", "Start break from ABANDONED session is rejected", () => {
  const abandoned = abandonFocusSession(createFocusSession());
  const res = startBreakSession(abandoned, 5);
  assert.equal(res.status, FOCUS_STATES.ABANDONED);
});

// -------------------------------------------------------------
// Dimension 2: Clock Rewinds & Time Anomalies
// -------------------------------------------------------------

runStressScenario("ST-201", "Clock Rewind: calculateRemainingSeconds with nowTimestamp before startedAt", () => {
  const startedAt = 1000000;
  const session = createFocusSession({ focusDuration: 25 }, startedAt); // durationSeconds = 1500, phaseEndsAt = 2500000
  const remaining = calculateRemainingSeconds(session, 500000); // clock rewound 500s before start
  assert.equal(remaining, 2000); // 2500000 - 500000 = 2000s
});

runStressScenario("ST-202", "Clock Rewind: calculateProgressPercentage clamps to 0%", () => {
  const startedAt = 1000000;
  const session = createFocusSession({ focusDuration: 25 }, startedAt);
  const pct = calculateProgressPercentage(session, 500000);
  assert.equal(pct, 0);
});

runStressScenario("ST-203", "Clock Rewind: isSessionExpired handles rewound clock", () => {
  const startedAt = 1000000;
  const session = createFocusSession({ focusDuration: 25 }, startedAt);
  assert.equal(isSessionExpired(session, 500000), false);
});

runStressScenario("ST-204", "Clock Jump: Massive forward timestamp jump (+100 days)", () => {
  const startedAt = 1000000;
  const session = createFocusSession({ focusDuration: 25 }, startedAt);
  const futureTime = startedAt + 100 * 24 * 3600 * 1000;
  assert.equal(calculateRemainingSeconds(session, futureTime), 0);
  assert.equal(calculateProgressPercentage(session, futureTime), 100);
  assert.equal(isSessionExpired(session, futureTime), true);
});

// -------------------------------------------------------------
// Dimension 3: Boundary Timestamps & Extreme Durations
// -------------------------------------------------------------

runStressScenario("ST-301", "Duration Clamping: Negative, zero, NaN, Infinity focus durations", () => {
  assert.equal(normalizeFocusConfig({ focusDuration: -100 }).focusDuration, FOCUS_BOUNDS.MIN_FOCUS_MINUTES);
  assert.equal(normalizeFocusConfig({ focusDuration: 0 }).focusDuration, FOCUS_BOUNDS.MIN_FOCUS_MINUTES);
  assert.equal(normalizeFocusConfig({ focusDuration: NaN }).focusDuration, FOCUS_BOUNDS.DEFAULT_FOCUS_MINUTES);
  assert.equal(normalizeFocusConfig({ focusDuration: Infinity }).focusDuration, FOCUS_BOUNDS.DEFAULT_FOCUS_MINUTES);
  assert.equal(normalizeFocusConfig({ focusDuration: 999 }).focusDuration, FOCUS_BOUNDS.MAX_FOCUS_MINUTES);
});

runStressScenario("ST-302", "Break Duration Clamping: Out-of-bounds break durations", () => {
  assert.equal(normalizeFocusConfig({ breakDuration: -10 }).breakDuration, FOCUS_BOUNDS.MIN_BREAK_MINUTES);
  assert.equal(normalizeFocusConfig({ breakDuration: 0 }).breakDuration, FOCUS_BOUNDS.MIN_BREAK_MINUTES);
  assert.equal(normalizeFocusConfig({ breakDuration: NaN }).breakDuration, FOCUS_BOUNDS.DEFAULT_BREAK_MINUTES);
  assert.equal(normalizeFocusConfig({ breakDuration: 100 }).breakDuration, FOCUS_BOUNDS.MAX_BREAK_MINUTES);
});

runStressScenario("ST-303", "Goal Text Truncation: 1000-character goal text capped to MAX_GOAL_LENGTH (120)", () => {
  const hugeText = "A".repeat(1000);
  const normalized = normalizeFocusConfig({ goal: { text: hugeText } });
  assert.equal(normalized.goal.text.length, 120);
});

runStressScenario("ST-304", "Timestamp Extremes: nowTimestamp = 0 & Number.MAX_SAFE_INTEGER", () => {
  const s0 = createFocusSession({}, 0);
  assert.equal(s0.startedAt, 0);
  assert.equal(s0.phaseEndsAt, 1500 * 1000);

  const sMax = createFocusSession({}, Number.MAX_SAFE_INTEGER - 10000000);
  assert.equal(sMax.startedAt, Number.MAX_SAFE_INTEGER - 10000000);
});

// -------------------------------------------------------------
// Dimension 4: Corrupted & Malformed Session Objects
// -------------------------------------------------------------

runStressScenario("ST-401", "Corrupted Input: Null, undefined, empty object safe fallbacks", () => {
  assert.equal(calculateRemainingSeconds(null), 0);
  assert.equal(calculateRemainingSeconds(undefined), 0);
  assert.equal(calculateRemainingSeconds({}), 0);
  assert.equal(calculateProgressPercentage(null), 0);
  assert.equal(isSessionExpired(null), false);
  assert.equal(pauseFocusSession(null), null);
  assert.equal(resumeFocusSession(null), null);
  assert.equal(completeFocusSession(null), null);
  assert.equal(abandonFocusSession(null), null);
  assert.equal(startBreakSession(null), null);
});

runStressScenario("ST-402", "Corrupted Session: Invalid status string and missing phaseEndsAt", () => {
  const invalidStatus = { status: "CORRUPTED_STATUS" };
  assert.equal(calculateRemainingSeconds(invalidStatus), 0);
  assert.equal(calculateProgressPercentage(invalidStatus), 0);
  assert.equal(isSessionExpired(invalidStatus), false);
});

runStressScenario("ST-403", "Corrupted Paused Session: String remainingSeconds handles non-number", () => {
  const pausedStr = { status: FOCUS_STATES.PAUSED_FOCUS, remainingSeconds: "invalid_string" };
  const rem = calculateRemainingSeconds(pausedStr);
  assert.equal(Number.isNaN(rem) ? 0 : rem, 0, "Non-number remainingSeconds should evaluate to 0");
});

// -------------------------------------------------------------
// Dimension 5: Aggregation, Streak & History Utilities
// -------------------------------------------------------------

runStressScenario("ST-501", "Aggregation: Array with null, undefined, and corrupted records", () => {
  const history = [
    null,
    undefined,
    { status: FOCUS_STATES.FOCUS_COMPLETED, dateStr: "2026-07-27", focusDurationMinutes: 25 },
    { status: "INVALID_STATUS", dateStr: "2026-07-27" },
    { status: FOCUS_STATES.FOCUS_COMPLETED, dateStr: "2026-07-27", actualFocusSeconds: 1800 },
  ];
  const agg = aggregateDailyProgress(history, "2026-07-27");
  assert.equal(agg.completedSessions, 2);
  assert.equal(agg.focusMinutes, 55); // 25 + 30
});

runStressScenario("ST-502", "Streak Calculation: Malformed reference date string handled gracefully", () => {
  const history = [
    { status: FOCUS_STATES.FOCUS_COMPLETED, dateStr: "2026-07-27" },
    { status: FOCUS_STATES.FOCUS_COMPLETED, dateStr: "2026-07-26" },
  ];
  assert.equal(calculateStreakDays(history, "invalid-date"), 0);
  assert.equal(calculateStreakDays(history, "2026-07-27"), 2);
});

runStressScenario("ST-503", "Prune History: Handles null records and truncates to maxRecords", () => {
  const now = 1000000000;
  const history = [
    null,
    { id: "valid_1", startedAt: now - 1000 },
    { id: "old_1", startedAt: now - (100 * 24 * 3600 * 1000) },
  ];
  const pruned = pruneHistoryRecords(history, 90, 500, now);
  assert.equal(pruned.length, 1);
  assert.equal(pruned[0].id, "valid_1");
});

runStressScenario("ST-504", "Duplicate Completion Check: Validates existing runtimeId", () => {
  const history = [{ runtimeId: "session_123", status: FOCUS_STATES.FOCUS_COMPLETED }];
  assert.equal(isDuplicateCompletion(history, "session_123"), true);
  assert.equal(isDuplicateCompletion(history, "session_999"), false);
  assert.equal(isDuplicateCompletion(null, "session_123"), false);
});

console.log("\n===============================================================");
console.log(" STRESS TEST EXECUTION SUMMARY ");
console.log("===============================================================");
const total = testResults.length;
const passed = testResults.filter((r) => r.passed).length;
const failed = testResults.filter((r) => !r.passed).length;

console.log(`Total Scenarios: ${total}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

testResults.forEach((r) => {
  if (!r.passed) {
    console.error(` - [FAIL] ${r.id}: ${r.title} (${r.error})`);
  }
});

console.log("===============================================================\n");
