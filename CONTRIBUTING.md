# Contributing to Beeyond Limits

Thank you for helping improve Beeyond Limits.

## Development setup

1. Fork and clone the repository.
2. Install dependencies with `npm install`.
3. Run `npm run build`.
4. Open `chrome://extensions`, enable Developer mode, and load the generated `dist/` directory.

## Quality checks

Run these commands before opening a pull request:

```bash
npm test
npm run lint
npm run build
```

For changes to timers, blocking, storage, notifications, or audio, also test the production build as an unpacked extension. Verify popup closure and reopening, browser restart recovery, timer completion, blocker restoration, and audio controls.

## Pull requests

- Keep each pull request focused on one problem.
- Add or update regression tests for behavior changes.
- Explain the user-facing effect and how it was verified.
- Preserve local-first data handling and avoid adding remote code or telemetry without prior discussion and matching privacy disclosures.
- Do not broaden Chrome permissions without documenting the reason and updating `docs/CHROME_WEB_STORE.md`.

## Design and architecture

Preserve the existing neo-brutalist visual language and deterministic Focus Session state transitions. Architectural decisions are recorded in `docs/decisions/`.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
