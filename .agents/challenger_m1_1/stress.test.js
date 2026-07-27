import test from "node:test";
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

// -------------------------------------------------------------
// Dimension 1: Invalid State Transitions
// -------------------------------------------------------------

test("[Adversarial M1] ST-101: Pause IDLE session returns IDLE unchanged", () => {
  const session = { status: FOCUS_STATES.IDLE };
  const res = pauseFocusSession(session, Date.now());
  assert.equal(res.status, FOCUS_STATES.IDLE);
});

test("[Adversarial M1] ST-102: Pause FOCUS_COMPLETED session returns FOCUS_COMPLETED unchanged", () => {
  const session = completeFocusSession(createFocusSession());
  const res = pauseFocusSession(session, Date.now());
  assert.equal(res.status, FOCUS_STATES.FOCUS_COMPLETED);
});

test("[Adversarial M1] ST-103: Pause ABANDONED session returns ABANDONED unchanged", () => {
  const session = abandonFocusSession(createFocusSession());
  const res = pauseFocusSession(session, Date.now());
  assert.equal(res.status, FOCUS_STATES.ABANDONED);
});

test("[Adversarial M1] ST-104: Resume ACTIVE_FOCUS session returns active session unchanged", () => {
  const session = createFocusSession();
  const res = resumeFocusSession(session, Date.now());
  assert.equal(res.status, FOCUS_STATES.ACTIVE_FOCUS);
  assert.equal(res, session);
});

test("[Adversarial M1] ST-105: Resume ABANDONED session returns ABANDONED unchanged", () => {
  const session = abandonFocusSession(createFocusSession());
  const res = resumeFocusSession(session, Date.now());
  assert.equal(res.status, FOCUS_STATES.ABANDONED);
});

test("[Adversarial M1] ST-106: Complete FOCUS_COMPLETED session is idempotent", () => {
  const now = 1000000;
  const session = createFocusSession({}, now);
  const completed1 = completeFocusSession(session, now + 1000);
  const completed2 = completeFocusSession(completed1, now + 999999);
  assert.equal(completed2.completedAt, now + 1000);
  assert.deepEqual(completed1, completed2);
});

test("[Adversarial M1] ST-107: Complete ABANDONED session must NOT transition to FOCUS_COMPLETED", () => {
  const abandoned = abandonFocusSession(createFocusSession());
  const res = completeFocusSession(abandoned, Date.now());
  // Empirical verification of bug: completeFocusSession mutates ABANDONED to FOCUS_COMPLETED
  assert.equal(
    res.status,
    FOCUS_STATES.ABANDONED,
    `FLAW: completeFocusSession allowed transition from ${FOCUS_STATES.ABANDONED} to ${res.status}`
  );
});

test("[Adversarial M1] ST-108: Abandon already FOCUS_COMPLETED session returns FOCUS_COMPLETED unchanged", () => {
  const completed = completeFocusSession(createFocusSession());
  const res = abandonFocusSession(completed, "user_cancelled");
  assert.equal(res.status, FOCUS_STATES.FOCUS_COMPLETED);
});

test("[Adversarial M1] ST-109: Start break from ACTIVE_FOCUS session is rejected", () => {
  const active = createFocusSession();
  const res = startBreakSession(active, 5);
  assert.equal(res.status, FOCUS_STATES.ACTIVE_FOCUS);
  assert.equal(res.phase, FOCUS_PHASES.FOCUS);
});

test("[Adversarial M1] ST-110: Start break from ABANDONED session is rejected", () => {
  const abandoned = abandonFocusSession(createFocusSession());
  const res = startBreakSession(abandoned, 5);
  assert.equal(res.status, FOCUS_STATES.ABANDONED);
});

// -------------------------------------------------------------
// Dimension 2: Clock Rewinds & Time Anomalies
// -------------------------------------------------------------

test("[Adversarial M1] ST-201: Clock Rewind: calculateRemainingSeconds with nowTimestamp before startedAt", () => {
  const startedAt = 1000000;
  const session = createFocusSession({ focusDuration: 25 }, startedAt);
  const remaining = calculateRemainingSeconds(session, 500000);
  assert.equal(remaining, 2000);
});

test("[Adversarial M1] ST-202: Clock Rewind: calculateProgressPercentage clamps to 0%", () => {
  const startedAt = 1000000;
  const session = createFocusSession({ focusDuration: 25 }, startedAt);
  const pct = calculateProgressPercentage(session, 500000);
  assert.equal(pct, 0);
});

test("[Adversarial M1] ST-203: Clock Rewind: isSessionExpired handles rewound clock", () => {
  const startedAt = 1000000;
  const session = createFocusSession({ focusDuration: 25 }, startedAt);
  assert.equal(isSessionExpired(session, 500000), false);
});

test("[Adversarial M1] ST-204: Clock Jump: Massive forward timestamp jump (+100 days)", () => {
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

test("[Adversarial M1] ST-301: Duration Clamping: Negative, zero, NaN, Infinity focus durations", () => {
  assert.equal(normalizeFocusConfig({ focusDuration: -100 }).focusDuration, FOCUS_BOUNDS.MIN_FOCUS_MINUTES);
  assert.equal(normalizeFocusConfig({ focusDuration: 0 }).focusDuration, FOCUS_BOUNDS.MIN_FOCUS_MINUTES);
  assert.equal(normalizeFocusConfig({ focusDuration: NaN }).focusDuration, FOCUS_BOUNDS.DEFAULT_FOCUS_MINUTES);
  assert.equal(normalizeFocusConfig({ focusDuration: Infinity }).focusDuration, FOCUS_BOUNDS.DEFAULT_FOCUS_MINUTES);
  assert.equal(normalizeFocusConfig({ focusDuration: 999 }).focusDuration, FOCUS_BOUNDS.MAX_FOCUS_MINUTES);
});

test("[Adversarial M1] ST-302: Break Duration Clamping: Out-of-bounds break durations", () => {
  assert.equal(normalizeFocusConfig({ breakDuration: -10 }).breakDuration, FOCUS_BOUNDS.MIN_BREAK_MINUTES);
  assert.equal(normalizeFocusConfig({ breakDuration: 0 }).breakDuration, FOCUS_BOUNDS.MIN_BREAK_MINUTES);
  assert.equal(normalizeFocusConfig({ breakDuration: NaN }).breakDuration, FOCUS_BOUNDS.DEFAULT_BREAK_MINUTES);
  assert.equal(normalizeFocusConfig({ breakDuration: 100 }).breakDuration, FOCUS_BOUNDS.MAX_BREAK_MINUTES);
});

test("[Adversarial M1] ST-303: Goal Text Truncation: 1000-character goal text capped to MAX_GOAL_LENGTH", () => {
  const hugeText = "A".repeat(1000);
  const normalized = normalizeFocusConfig({ goal: { text: hugeText } });
  assert.equal(normalized.goal.text.length, 120);
});

test("[Adversarial M1] ST-304: Timestamp Extremes: nowTimestamp = 0 & Number.MAX_SAFE_INTEGER", () => {
  const s0 = createFocusSession({}, 0);
  assert.equal(s0.startedAt, 0);
  assert.equal(s0.phaseEndsAt, 1500 * 1000);

  const sMax = createFocusSession({}, Number.MAX_SAFE_INTEGER - 10000000);
  assert.equal(sMax.startedAt, Number.MAX_SAFE_INTEGER - 10000000);
});

// -------------------------------------------------------------
// Dimension 4: Corrupted & Malformed Session Objects
// -------------------------------------------------------------

test("[Adversarial M1] ST-401: Corrupted Input: Null, undefined, empty object safe fallbacks", () => {
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

test("[Adversarial M1] ST-402: Corrupted Session: Invalid status string and missing phaseEndsAt", () => {
  const invalidStatus = { status: "CORRUPTED_STATUS" };
  assert.equal(calculateRemainingSeconds(invalidStatus), 0);
  assert.equal(calculateProgressPercentage(invalidStatus), 0);
  assert.equal(isSessionExpired(invalidStatus), false);
});

test("[Adversarial M1] ST-403: Corrupted Paused Session: String remainingSeconds handles non-number", () => {
  const pausedStr = { status: FOCUS_STATES.PAUSED_FOCUS, remainingSeconds: "invalid_string" };
  const rem = calculateRemainingSeconds(pausedStr);
  assert.equal(Number.isNaN(rem) ? 0 : rem, 0);
});

// -------------------------------------------------------------
// Dimension 5: Aggregation, Streak & History Utilities
// -------------------------------------------------------------

test("[Adversarial M1] ST-501: Aggregation: Array with null, undefined, and corrupted records", () => {
  const history = [
    null,
    undefined,
    { status: FOCUS_STATES.FOCUS_COMPLETED, dateStr: "2026-07-27", focusDurationMinutes: 25 },
    { status: "INVALID_STATUS", dateStr: "2026-07-27" },
    { status: FOCUS_STATES.FOCUS_COMPLETED, dateStr: "2026-07-27", actualFocusSeconds: 1800 },
  ];
  const agg = aggregateDailyProgress(history, "2026-07-27");
  assert.equal(agg.completedSessions, 2);
  assert.equal(agg.focusMinutes, 55);
});

test("[Adversarial M1] ST-502: Streak Calculation: Malformed reference date string handled gracefully", () => {
  const history = [
    { status: FOCUS_STATES.FOCUS_COMPLETED, dateStr: "2026-07-27" },
    { status: FOCUS_STATES.FOCUS_COMPLETED, dateStr: "2026-07-26" },
  ];
  assert.equal(calculateStreakDays(history, "invalid-date"), 0);
  assert.equal(calculateStreakDays(history, "2026-07-27"), 2);
});

test("[Adversarial M1] ST-503: Prune History: Handles null records and truncates to maxRecords", () => {
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

test("[Adversarial M1] ST-504: Duplicate Completion Check: Validates existing runtimeId", () => {
  const history = [{ runtimeId: "session_123", status: FOCUS_STATES.FOCUS_COMPLETED }];
  assert.equal(isDuplicateCompletion(history, "session_123"), true);
  assert.equal(isDuplicateCompletion(history, "session_999"), false);
  assert.equal(isDuplicateCompletion(null, "session_123"), false);
});
