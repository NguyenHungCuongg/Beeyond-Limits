# Spec: Continuous Focus Session Cycles

## Objective

Keep one configured Focus Session running through repeated work and break cycles
until the user explicitly finishes it.

## Behavior

- A completed work cycle can start its configured break.
- A completed break can start the next work cycle immediately, without opening
  Focus Session Setup.
- Every next work cycle reuses the session snapshot: duration, goal, website
  blocklist, and ambient mix.
- Website blocking and ambient audio are restored for work and disabled for
  breaks.
- Every completed work cycle contributes one completion to history and daily
  progress.
- The runtime session ID remains stable; each work cycle has a monotonically
  increasing cycle number and a unique history record ID.
- Finish/skip ends the loop and restores the user's pre-session environment.

## Commands

- Test: `npm test`
- Focused test: `node --test tests/focusSession.test.js tests/focusEngine.test.js`
- Lint: `npm run lint`
- Build: `npm run build`

## Project Structure

- `src/core/focusSession.js`: pure cycle state transitions.
- `src/background.js`: persistence, alarms, and environment orchestration.
- `src/core/focusSessionClient.js`: extension messaging client.
- `src/hooks/useFocusSession.js`: React command adapter.
- `src/pages/FocusSessionComplete.jsx`: cycle completion actions.
- `tests/`: state-machine and background integration coverage.

## Code Style

Use existing immutable state transitions:

```js
return {
  ...session,
  phase: FOCUS_PHASES.FOCUS,
  status: FOCUS_STATES.ACTIVE_FOCUS,
};
```

## Testing Strategy

- Unit-test the break-completed to active-focus transition and invalid states.
- Integration-test two complete work cycles and verify distinct history records.
- Run the full suite, lint, and production build.

## Boundaries

- Always preserve the immutable session snapshot and pre-session environment.
- Do not add dependencies or change extension permissions.
- Do not automatically start a new work cycle without a user action.

## Success Criteria

- “Continue Focus” after a completed break opens the active timer directly.
- The next timer uses the original work duration and environment configuration.
- The loop can repeat for at least two cycles without duplicate history.
- “Finish for now” still ends the session and restores prior state.
