# Orchestration Plan — Focus Session MVP

## Objective
Lead the team to implement the 'Focus Session' MVP feature for Beeyond Limits (a Chrome Extension productivity tool) following the specs (`docs/ideas/focus-session.md`, `docs/specs/focus-session-ux-spec.md`), implementation plan (`tasks/plan.md`, `tasks/todo.md`), and design system (`DESIGN.md`).

## Methodology: Project Pattern
1. **Phase 0: Survey & Requirements Mapping**
   - Dispatch `teamwork_preview_spec_miner` subagents to analyze the reference specs (`docs/ideas/focus-session.md`, `docs/specs/focus-session-ux-spec.md`, `tasks/plan.md`, `tasks/todo.md`, `DESIGN.md`) and existing codebase.
   - Aggregate findings into `PROJECT.md` at project root with Feature Inventory, Architecture, Milestones, Interface Contracts, and Code Layout.

2. **Dual Track Execution**
   - **Track 1: Implementation Track**
     - Milestone 1: Core Domain Model & Types (`src/types/focus.ts`, `src/services/focus/domain.ts`)
     - Milestone 2: State Persistence & Storage Schema (`src/services/focus/storage.ts`)
     - Milestone 3: Background Service Worker Engine & Timer (`src/background/focusEngine.ts`)
     - Milestone 4: Feature Integration Connectors (Pomodoro, Blocker, Sounds, Tasks connectors)
     - Milestone 5: React UI - Setup Screen (`src/components/focus/FocusSetup.tsx`)
     - Milestone 6: React UI - Active Session & Floating Widget (`src/components/focus/FocusActive.tsx`, `FocusWidget.tsx`)
     - Milestone 7: React UI - Completion & Summary Screen (`src/components/focus/FocusSummary.tsx`)
     - Milestone 8: Final E2E Integration Pass & Coverage Hardening
   - **Track 2: E2E Testing Track**
     - Build opaque-box E2E test infra and test cases across 4 tiers covering all user requirements.
     - Publish `TEST_READY.md`.

3. **Per-Milestone Iteration Loop**
   - For each milestone:
     a. **Explorer / Spec Miner**: Analyze scope and propose fix/implementation strategy.
     b. **Worker**: Implement code changes following strict TDD, run `npm test`, `npm run lint`, `npm run build`.
     c. **Reviewers**: 2 independent reviewers verify code quality, correctness, Neo-Brutalist design adherence, and test suite.
     d. **Challengers**: 2 independent challengers stress-test and verify edge cases.
     e. **Forensic Auditor**: Verify genuine non-cheating implementation.
     f. **Gate**: Require 100% build/test pass, all Reviewer APPROVE, all Challenger pass, CLEAN Audit.

4. **Completion Criteria**
   - All 7 slices implemented and passing TDD sequence.
   - `npm test` passes cleanly.
   - `npm run lint` returns 0 warnings/errors.
   - `npm run build` succeeds.
   - Neo-Brutalist design language verified.
