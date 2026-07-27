# Adversarial Analysis Report — Focus Session History & Domain Logic (M1)

**Agent**: Adversarial Challenger 2 (`challenger_m1_2`)  
**Date**: 2026-07-27  
**Target Core File**: `src/core/focusSession.js`  
**Test Suite**: `.agents/challenger_m1_2/historyTest.js`  
**Verdict**: **REQUEST_CHANGES**

---

## Executive Summary

As Adversarial Challenger 2, an independent stress-test harness (`historyTest.js`) was constructed to empirically challenge the domain logic in `src/core/focusSession.js` across 5 key dimensions:
1. **1000+ History Records Scale & Performance**
2. **Duplicate Completion Calls & Idempotency**
3. **Timezone Shifts & Date Formatting Consistency**
4. **90-Day History Pruning Limits & Timestamp Fields**
5. **Daily Streak Calculation & Edge Cases**

While basic happy path unit tests in `tests/focusSession.test.js` pass, empirical stress testing revealed **3 significant logic flaws** in core history and analytics functions that will degrade history retention, duplicate detection, and analytics in downstream milestones.

---

## Findings & Failure Modes

### 1. [HIGH] History Pruning Omits `completedAt` Timestamp
- **Location**: `src/core/focusSession.js` lines 357–360 (`pruneHistoryRecords`)
- **Code Under Test**:
  ```javascript
  const validRecords = historyRecords.filter((r) => {
    if (!r) return false;
    const recordTime = r.endedAt || r.startedAt || 0;
    return recordTime >= cutoffMs;
  });
  ```
- **Observed Bug**:
  - `completeFocusSession()` sets the `completedAt` timestamp on focus session objects (`{ status: "focus_completed", completedAt: <timestamp> }`).
  - `pruneHistoryRecords()` inspects ONLY `r.endedAt` and `r.startedAt`. It ignores `r.completedAt`.
  - If a completed history record relies on `completedAt` (and lacks `endedAt` or `startedAt`), `recordTime` falls back to `0`.
  - `0 >= cutoffMs` evaluates to `false` for any current epoch timestamp.
- **Empirical Impact**: Valid completed sessions logged with `completedAt` are silently purged from history upon pruning.
- **Remediation**: Update timestamp extraction to check `r.endedAt || r.completedAt || r.startedAt || 0`.

---

### 2. [MEDIUM] Timezone Discrepancy between Daily Progress & Streak Calculation
- **Location**: `src/core/focusSession.js` line 291 (`aggregateDailyProgress`) vs line 335 (`calculateStreakDays`)
- **Code Under Test**:
  - In `aggregateDailyProgress`:
    ```javascript
    const dateKey = targetDateStr || new Date().toISOString().split("T")[0]; // UTC date (e.g. "2026-07-27")
    ```
  - In `calculateStreakDays`:
    ```javascript
    curr = referenceDateStr ? new Date(referenceDateStr) : new Date(); // Local system date (e.g. local getFullYear())
    ```
- **Observed Bug**:
  - When no explicit date string is provided, `aggregateDailyProgress()` resolves "today" using UTC (`toISOString()`), whereas `calculateStreakDays()` resolves "today" using local system time.
  - For users in non-UTC timezones (e.g., UTC+7, UTC-5), near local midnight UTC date and local date differ by 1 calendar day.
  - This causes UI mismatch where daily progress reports metrics for Date A while streak calculation evaluates starting from Date B.
- **Empirical Impact**: Inconsistent daily analytics and streak counts across timezone boundaries.
- **Remediation**: Standardize default date calculation across all history functions to use local ISO date strings (`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`).

---

### 3. [MEDIUM] `isDuplicateCompletion` Field Name Fragility (`runtimeId` vs `id`)
- **Location**: `src/core/focusSession.js` line 370 (`isDuplicateCompletion`)
- **Code Under Test**:
  ```javascript
  export function isDuplicateCompletion(historyRecords = [], runtimeId) {
    if (!Array.isArray(historyRecords) || !runtimeId) return false;
    return historyRecords.some((r) => r && r.runtimeId === runtimeId && r.status === FOCUS_STATES.FOCUS_COMPLETED);
  }
  ```
- **Observed Bug**:
  - `createFocusSession()` names the runtime session identifier `id` (`id: runtimeId`).
  - If a caller stores session history directly using the session object (`{ id: "session_123", status: "focus_completed" }`), `r.runtimeId` is `undefined`.
  - `isDuplicateCompletion()` fails to recognize the record as completed, allowing duplicate completion logs.
- **Empirical Impact**: Duplicate history entries can be recorded if history objects use standard session property `id`.
- **Remediation**: Update check to `(r.runtimeId === runtimeId || r.id === runtimeId)`.

---

## Stress Test Results Summary

| Stress Category | Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| **1000+ Scale** | 2,500 history records over 150 days | Execution < 50ms, correct top 500 records | Executed in ~3ms, correctly sorted descending | **PASS** |
| **Duplicate Completion** | Repeated `completeFocusSession()` calls | Immutable `completedAt` timestamp | `completedAt` timestamp preserved on duplicate calls | **PASS** |
| **Duplicate Completion** | `isDuplicateCompletion()` with `id` property only | Detect duplicate by session `id` | Returned `false` due to checking only `runtimeId` | **FAIL (Bug #3)** |
| **Timezone Shifts** | Default reference date comparison (UTC vs Local) | Consistent default date resolution | Mismatch between UTC (`aggregateDailyProgress`) & Local (`calculateStreakDays`) | **FAIL (Bug #2)** |
| **Leap Year & Month Bounds** | Feb 28 -> Feb 29 -> Mar 1 (Leap year 2028) | Continuous 3-day streak | Correctly calculated 3-day streak across leap day | **PASS** |
| **90-Day Pruning** | Record with `completedAt` timestamp only | Retained within 90-day window | Record purged because `endedAt`/`startedAt` were undefined | **FAIL (Bug #1)** |

---

## Recommended Action Plan

To reach full release readiness for Milestone 1:

1. **Fix History Pruning Timestamp Check**:
   Modify `pruneHistoryRecords` in `src/core/focusSession.js`:
   ```javascript
   const recordTime = r.endedAt || r.completedAt || r.startedAt || 0;
   ```
2. **Harmonize Timezone Date Strings**:
   Modify `aggregateDailyProgress` default date resolution:
   ```javascript
   const d = new Date();
   const dateKey = targetDateStr || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
   ```
3. **Enhance Duplicate Completion Matching**:
   Modify `isDuplicateCompletion` to check both `runtimeId` and `id`:
   ```javascript
   return historyRecords.some((r) => r && (r.runtimeId === runtimeId || r.id === runtimeId) && r.status === FOCUS_STATES.FOCUS_COMPLETED);
   ```

---

## Final Verdict
**REQUEST_CHANGES** — The identified bugs in `pruneHistoryRecords`, `aggregateDailyProgress`, and `isDuplicateCompletion` must be resolved before proceeding to storage persistence (M2) and background engine (M3).
