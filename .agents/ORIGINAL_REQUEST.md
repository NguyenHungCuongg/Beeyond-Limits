# Original User Request

## Initial Request — 2026-07-27T13:47:03Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Teamwork subagent is currently executing the project

Implement the 'Focus Session' MVP feature for Beeyond Limits, a Chrome Extension productivity tool, as detailed in the provided spec and implementation plan.

Working directory: `F:\Chrome Extension Projects\Beeyond Limits`
Integrity mode: development

## Reference Material
- Idea: `docs/ideas/focus-session.md`
- UX Spec: `docs/specs/focus-session-ux-spec.md`
- Implementation Plan: `tasks/plan.md`
- Task List: `tasks/todo.md`
- Design System: `DESIGN.md`

## Requirements

### R1. Implement Focus Session MVP
Execute the implementation plan across all 7 slices (from domain logic to background orchestration and React UI) as outlined in `tasks/todo.md`. The feature must allow users to start a focus session orchestrating Pomodoro, Tasks, Website Blocker, and Ambient Sounds.

### R2. Test-Driven Development & Preservation
Follow the strict TDD sequence specified in the plan. Write failing tests before implementing behavior. Existing independent tools (Pomodoro, Tasks, Blocker, Sounds) and user storage data must remain fully functional.

### R3. Adhere to Neo-Brutalist UI
All new UI components (Setup, Active Session, Completion) must strictly follow the "Carnival" Neo-Brutalist design language documented in `DESIGN.md`.

## Acceptance Criteria

### Automated Verification
- [ ] `npm test` passes completely, including all new core and background orchestration tests.
- [ ] `npm run lint` returns 0 warnings/errors.
- [ ] `npm run build` successfully compiles the extension.

### Functional Verification
- [ ] A default 25-minute focus session can be started in no more than two actions from the Home screen.
- [ ] The background service worker acts as the authoritative source of truth for the session timer and state.
- [ ] Session state (active, paused) accurately survives the popup being closed and reopened.
- [ ] Focus completion is recorded exactly once per runtime ID.
