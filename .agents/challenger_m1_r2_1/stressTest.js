/**
 * .agents/challenger_m1_r2_1/stressTest.js
 * Independent Adversarial Stress Test Script for FocusSession domain engine.
 * Focuses on: State transitions (especially ABANDONED -> FOCUS_COMPLETED),
 * Goal string normalization, Duplicate ID detection, and Edge cases.
 */

import assert from "node:assert/strict";
import {
  FOCUS_STATES,
  FOCUS_PHASES,
  FOCUS_BOUNDS,
  normalizeFocusConfig,
  createFocusSession,
  pauseFocusSession,
  resumeFocusSession,
  completeFocusSession,
  abandonFocusSession,
  startBreakSession,
  calculateRemainingSeconds,
  calculateProgressPercentage,
  isSessionExpired,
  aggregateDailyProgress,
  calculateStreakDays,
  pruneHistoryRecords,
  isDuplicateCompletion,
} from "../../src/core/focusSession.js";

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    console.error(err.stack);
    failedCount++;
  }
}

console.log("=== STARTING ADVERSARIAL STRESS TESTS ===");

// -------------------------------------------------------------
// Category 1: State Transitions & Invalid State Rejections
// -------------------------------------------------------------

runTest("State Transition: completeFocusSession REJECTS ABANDONED session", () => {
  const session = createFocusSession();
  const abandoned = abandonFocusSession(session, "user_cancelled", 1000);
  assert.equal(abandoned.status, FOCUS_STATES.ABANDONED);
  assert.equal(abandoned.abandonedAt, 1000);

  const completedAttempt = completeFocusSession(abandoned, 2000);
  assert.equal(completedAttempt.status, FOCUS_STATES.ABANDONED, "Status must remain ABANDONED");
  assert.equal(completedAttempt.completedAt, null, "completedAt must remain null");
  assert.equal(completedAttempt.abandonedAt, 1000, "abandonedAt timestamp must be preserved");
});

runTest("State Transition: completeFocusSession REJECTS IDLE session", () => {
  const idleSession = { status: FOCUS_STATES.IDLE };
  const res = completeFocusSession(idleSession, 2000);
  assert.equal(res.status, FOCUS_STATES.IDLE);
});

runTest("State Transition: abandonFocusSession REJECTS FOCUS_COMPLETED session", () => {
  const session = createFocusSession();
  const completed = completeFocusSession(session, 1000);
  assert.equal(completed.status, FOCUS_STATES.FOCUS_COMPLETED);

  const abandonAttempt = abandonFocusSession(completed, "too_late", 2000);
  assert.equal(abandonAttempt.status, FOCUS_STATES.FOCUS_COMPLETED, "Status must remain FOCUS_COMPLETED");
  assert.equal(abandonAttempt.abandonedAt, null, "abandonedAt must remain null");
});

runTest("State Transition: abandonFocusSession REJECTS BREAK_COMPLETED session", () => {
  const session = createFocusSession();
  const completed = completeFocusSession(session, 1000);
  const breakSession = startBreakSession(completed, 5, 1000);
  const breakCompleted = completeFocusSession(breakSession, 2000);
  assert.equal(breakCompleted.status, FOCUS_STATES.BREAK_COMPLETED);

  const abandonAttempt = abandonFocusSession(breakCompleted, "give_up", 3000);
  assert.equal(abandonAttempt.status, FOCUS_STATES.BREAK_COMPLETED);
});

runTest("State Transition: startBreakSession REJECTS ACTIVE_FOCUS and PAUSED_FOCUS sessions", () => {
  const active = createFocusSession();
  assert.equal(startBreakSession(active).status, FOCUS_STATES.ACTIVE_FOCUS);

  const paused = pauseFocusSession(active);
  assert.equal(startBreakSession(paused).status, FOCUS_STATES.PAUSED_FOCUS);
});

runTest("State Transition: startBreakSession REJECTS ABANDONED session", () => {
  const session = createFocusSession();
  const abandoned = abandonFocusSession(session);
  const res = startBreakSession(abandoned);
  assert.equal(res.status, FOCUS_STATES.ABANDONED);
});

runTest("State Transition: pauseFocusSession and resumeFocusSession handle null/undefined/non-object gracefully", () => {
  assert.equal(pauseFocusSession(null), null);
  assert.equal(pauseFocusSession(undefined), undefined);
  assert.equal(pauseFocusSession(123), 123);

  assert.equal(resumeFocusSession(null), null);
  assert.equal(resumeFocusSession(undefined), undefined);
  assert.equal(resumeFocusSession("string"), "string");

  assert.equal(completeFocusSession(null), null);
  assert.equal(abandonFocusSession(null), null);
  assert.equal(startBreakSession(null), null);
});

// -------------------------------------------------------------
// Category 2: Goal String Normalization & Boundary Testing
// -------------------------------------------------------------

runTest("Goal Normalization: Plain string goal formatting and whitespace trimming", () => {
  const res1 = normalizeFocusConfig({ goal: "   Learn WebExtension APIs   " });
  assert.equal(res1.goal.text, "Learn WebExtension APIs");
  assert.equal(res1.goal.type, "text");
  assert.equal(res1.goal.taskId, null);

  const res2 = normalizeFocusConfig({ goal: "   " });
  assert.equal(res2.goal.text, "");
  assert.equal(res2.goal.type, "text");
  assert.equal(res2.goal.taskId, null);
});

runTest("Goal Normalization: Truncation at 120 chars boundary", () => {
  const input120 = "A".repeat(120);
  const input121 = "A".repeat(121);
  const input500 = "B".repeat(500);

  assert.equal(normalizeFocusConfig({ goal: input120 }).goal.text.length, 120);
  assert.equal(normalizeFocusConfig({ goal: input121 }).goal.text.length, 120);
  assert.equal(normalizeFocusConfig({ goal: input500 }).goal.text.length, 120);
  assert.equal(normalizeFocusConfig({ goal: input500 }).goal.text, "B".repeat(120));
});

runTest("Goal Normalization: Object goal with taskId variations", () => {
  const withTaskId0 = normalizeFocusConfig({ goal: { text: "Task 0", taskId: 0 } });
  assert.equal(withTaskId0.goal.type, "task");
  assert.equal(withTaskId0.goal.taskId, 0);

  const withTaskIdEmptyStr = normalizeFocusConfig({ goal: { text: "Task Empty", taskId: "" } });
  assert.equal(withTaskIdEmptyStr.goal.type, "task");
  assert.equal(withTaskIdEmptyStr.goal.taskId, "");

  const withTaskIdNull = normalizeFocusConfig({ goal: { text: "Task Null", taskId: null } });
  assert.equal(withTaskIdNull.goal.type, "text");
  assert.equal(withTaskIdNull.goal.taskId, null);

  const withTaskIdUndefined = normalizeFocusConfig({ goal: { text: "Task Undefined" } });
  assert.equal(withTaskIdUndefined.goal.type, "text");
  assert.equal(withTaskIdUndefined.goal.taskId, null);
});

runTest("Goal Normalization: Malformed and unexpected goal input types", () => {
  assert.equal(normalizeFocusConfig({ goal: 12345 }).goal.text, "");
  assert.equal(normalizeFocusConfig({ goal: true }).goal.text, "");
  assert.equal(normalizeFocusConfig({ goal: null }).goal.text, "");
  assert.equal(normalizeFocusConfig({ goal: { text: 12345 } }).goal.text, "");
  assert.equal(normalizeFocusConfig({ goal: { text: null } }).goal.text, "");
  assert.equal(normalizeFocusConfig({ goal: { text: "   \n\t Multi-line \t\n   " } }).goal.text, "Multi-line");
});

// -------------------------------------------------------------
// Category 3: Duplicate ID Detection & History Handling
// -------------------------------------------------------------

runTest("Duplicate Detection: Matches runtimeId and id accurately", () => {
  const history = [
    { runtimeId: "session_A", status: FOCUS_STATES.FOCUS_COMPLETED },
    { id: "session_B", status: FOCUS_STATES.FOCUS_COMPLETED },
    { runtimeId: "session_C", status: FOCUS_STATES.ABANDONED },
    { id: "session_D", status: FOCUS_STATES.BREAK_COMPLETED },
  ];

  assert.equal(isDuplicateCompletion(history, "session_A"), true, "Should match runtimeId for completed session");
  assert.equal(isDuplicateCompletion(history, "session_B"), true, "Should match id for completed session");
  assert.equal(isDuplicateCompletion(history, "session_C"), false, "ABANDONED session should not count as duplicate completion");
  assert.equal(isDuplicateCompletion(history, "session_D"), false, "BREAK_COMPLETED session should not count as duplicate focus completion");
  assert.equal(isDuplicateCompletion(history, "session_E"), false, "Unseen session ID should return false");
});

runTest("Duplicate Detection: Robustness against corrupt history entries", () => {
  const corruptHistory = [
    null,
    undefined,
    "string_entry",
    12345,
    {},
    { runtimeId: null, status: FOCUS_STATES.FOCUS_COMPLETED },
    { id: undefined, status: FOCUS_STATES.FOCUS_COMPLETED },
    { runtimeId: "session_VALID", status: FOCUS_STATES.FOCUS_COMPLETED },
  ];

  assert.equal(isDuplicateCompletion(corruptHistory, "session_VALID"), true);
  assert.equal(isDuplicateCompletion(corruptHistory, "session_NONEXISTENT"), false);
  assert.equal(isDuplicateCompletion(null, "session_VALID"), false);
  assert.equal(isDuplicateCompletion([], null), false);
  assert.equal(isDuplicateCompletion([], undefined), false);
  assert.equal(isDuplicateCompletion([], ""), false);
});

// -------------------------------------------------------------
// Category 4: Runtime ID Uniqueness & Snapshot Immutability Stress
// -------------------------------------------------------------

runTest("Runtime ID: Uniqueness across 1,000 rapid calls at identical timestamp", () => {
  const fixedNow = 1722081000000;
  const ids = new Set();
  const count = 1000;

  for (let i = 0; i < count; i++) {
    const session = createFocusSession({}, fixedNow);
    ids.add(session.id);
  }

  assert.equal(ids.size, count, `All ${count} generated session IDs at the same timestamp must be unique`);
});

runTest("Snapshot Immutability: Mutating returned session object or config does not contaminate snapshot", () => {
  const config = {
    focusDuration: 45,
    goal: { text: "Deep Focus", taskId: "t-1" },
    blocker: { enabled: true, presetId: "strict" },
    ambientSound: { enabled: true, soundId: "waves", volume: 60 },
  };

  const session = createFocusSession(config);

  // Mutate original config object
  config.focusDuration = 5;
  config.goal.text = "Hacked Goal";
  config.goal.taskId = "t-hacked";
  config.blocker.enabled = false;

  // Mutate session top-level goal object
  session.goal.text = "Mutated Session Goal";

  // Check that session.snapshot retains original sanitized values
  assert.equal(session.snapshot.focusDuration, 45);
  assert.equal(session.snapshot.goal.text, "Deep Focus");
  assert.equal(session.snapshot.goal.taskId, "t-1");
  assert.equal(session.snapshot.blocker.enabled, true);
  assert.equal(session.snapshot.ambientSound.volume, 60);
});

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------

console.log("\n=============================================");
console.log(`STRESS TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("=============================================\n");

if (failedCount > 0) {
  process.exit(1);
}
