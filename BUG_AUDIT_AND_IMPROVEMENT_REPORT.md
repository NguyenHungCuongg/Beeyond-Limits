# Beeyond Limits — Bug Audit & Product Improvement Report

> Audit date: 2026-07-26  
> Scope: frontend Chrome Extension (Manifest V3), source code and production build  
> Verdict: **Not ready for Chrome Web Store production release**

## 1. Executive summary

The production bundle builds successfully, but the extension still has release-blocking reliability and quality problems in its three core flows: Pomodoro, Website Blocker, and audio playback.

### Finding counts

| Severity | Count | Meaning |
|---|---:|---|
| High | 5 | Core behavior is unreliable, misleading, or lacks a release safety net |
| Medium | 11 | Material UX, privacy, accessibility, performance, or edge-case problem |
| Low | 2 | Product polish, content quality, or maintainability issue |
| **Total** | **18** | Includes confirmed defects and risks requiring runtime verification |

### Quality gates

| Check | Result | Evidence |
|---|---|---|
| Production build | Pass | `npm run build`; Vite built 51 modules and produced `dist/` |
| ESLint | Fail | `src/offscreen.js:223` declares an unused `soundKey` |
| Automated tests | Missing | `package.json` has no `test` script and the repository contains no test files |
| Browser runtime audit | Limited | Isolated Chrome/DevTools could not be started in the current execution environment |

### Highest-priority problems

1. **Pomodoro can drift or stop when the Manifest V3 service worker is suspended.**
2. **Website Blocker can block unrelated sites because it uses substring matching.**
3. **A rule update failure can leave the UI saying “blocking enabled” while no rules are active.**
4. **Pomodoro notification audio depends on an arbitrary web tab and has a missing fallback page.**
5. **There is no automated regression suite, and the current lint gate already fails.**

## 2. Method and evidence levels

The audit followed the sequence: reproduce/check → localize → reduce → identify root cause → propose a regression guard.

Evidence labels used below:

- **Confirmed:** directly demonstrated by build/lint output or deterministic source behavior.
- **Platform-confirmed:** source behavior conflicts with official Chrome Extension documentation.
- **Runtime verification required:** highly plausible source-level defect, but a real unpacked-extension run is still required.

Official Chrome references:

- [Migrate timers from extension service workers to `chrome.alarms`](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)
- [Declarative Net Request URL matching and domain anchoring](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- [Web-accessible resources and extension fingerprinting risk](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources)

## 3. Bug inventory

### BL-001 — Pomodoro timer is not reliable in a Manifest V3 service worker

- **Severity:** High
- **Status:** Platform-confirmed
- **Location:** `src/background.js:96-106`
- **Observed behavior:** The timer is driven by `setInterval(..., 1000)` and in-memory fields on `BackgroundPomodoroManager`.
- **Root cause:** Chrome may terminate an inactive extension service worker, which cancels its timers. Persisting the latest second does not make elapsed time continue while the worker is suspended.
- **User impact:** A 25-minute focus session can take longer than 25 real minutes, pause without the user asking, or complete late.
- **Recommended fix:** Store an absolute `phaseEndsAt` timestamp. Use `chrome.alarms` for phase completion and derive displayed seconds from `phaseEndsAt - Date.now()`.
- **Regression guard:** Start a short session, terminate the service worker from `chrome://extensions`, wait, reopen the popup, and assert the remaining time reflects real elapsed time.

### BL-002 — Restoring a timer at zero resets it to a full focus session

- **Severity:** High
- **Status:** Confirmed
- **Location:** `src/background.js:29-47`
- **Observed behavior:** `this.currentTime = state.currentTime || this.focusTime * 60`.
- **Root cause:** `0` is treated as a missing value. Therefore the later branch checking `this.currentTime === 0 && this.isActive` is effectively unreachable for a persisted zero.
- **User impact:** If the worker stops after saving `0` but before switching phase, reopening the extension can restart a full focus interval instead of moving to break.
- **Recommended fix:** Use nullish checks (`state.currentTime ?? default`) and make phase transitions idempotent using an absolute deadline and a phase ID.
- **Regression guard:** Seed storage with `{ isActive: true, currentTime: 0 }`, initialize the manager, and assert exactly one transition to break.

### BL-003 — Website Blocker blocks unrelated domains and URLs

- **Severity:** High
- **Status:** Confirmed
- **Location:** `src/background.js:790-808`, `src/content.js:482-493`
- **Observed behavior:** DNR adds a high-priority catch-all `*${domain}*`. The content script also uses `hostname.includes(domain)`, `currentUrl.includes(domain)`, and `domain.includes(currentHost)`.
- **Minimal examples:**
  - Blocking `youtube.com` also matches `notyoutube.com`.
  - A URL such as `example.com/?next=youtube.com` can be blocked.
  - Blocking `mail.google.com` may also block `google.com` because the stored domain contains the current host.
- **Root cause:** Domain identity is implemented as substring matching instead of host-boundary matching.
- **User impact:** False positives can prevent access to legitimate or important sites.
- **Recommended fix:** Normalize user input with `new URL()`, store hostname only, and generate one anchored DNR condition such as `||youtube.com/`. Remove the content-script blocker fallback.
- **Regression guard:** Table-driven tests for exact domain, subdomain, lookalike domain, domain in path/query, uppercase input, and IDN/punycode.

### BL-004 — Blocker updates can fail open while the UI still says “enabled”

- **Severity:** High
- **Status:** Confirmed design defect; runtime failure path requires verification
- **Location:** `src/background.js:754-818`, `src/pages/WebsiteBlocker.jsx:151-167`
- **Observed behavior:** Existing dynamic rules are removed in one API call, then new rules are added in a second call. Errors are only logged. The popup optimistically updates `isBlocking` without receiving rule-application status.
- **Root cause:** Rule replacement is non-atomic and the UI state models user intent, not actual DNR state.
- **User impact:** Invalid input, quota exhaustion, or an API error can remove every active rule while the popup continues to claim sites are blocked.
- **Recommended fix:** Validate all rules first, replace them in one `updateDynamicRules({ removeRuleIds, addRules })` operation, return a structured result to the popup, and roll the toggle back on failure.
- **Regression guard:** Force `updateDynamicRules` to reject and assert that previous rules remain active and the UI displays an error.

### BL-005 — Pomodoro completion audio is unreliable and its fallback file is missing

- **Severity:** High
- **Status:** Confirmed architecture/file defect; autoplay behavior needs runtime verification
- **Location:** `src/background.js:185-215`, `src/background.js:671-699`, `manifest.json:17-22`
- **Observed behavior:** The service worker queries every tab, sends audio to the first tab with a content script, and stops searching after message delivery—not after confirmed playback. If no content script exists, test audio opens `simple-audio-test.html`.
- **Root cause:** Playback is coupled to an arbitrary web page and browser autoplay policy. `simple-audio-test.html` is declared but does not exist in the source or `dist/`.
- **User impact:** The timer may complete silently, play in an unexpected tab, or open a missing-page fallback.
- **Recommended fix:** Use the existing offscreen document as the single audio owner for Pomodoro and ambient sounds. Remove tab-based playback and the nonexistent fallback.
- **Regression guard:** Complete a timer with only `chrome://` tabs open and assert offscreen playback plus a notification.

### BL-006 — Ambient audio initialization has a race and reports success too early

- **Severity:** Medium
- **Status:** Runtime verification required
- **Location:** `src/background.js:285-324`, `src/background.js:405-419`, `src/offscreen.js:114-179`
- **Observed behavior:** `loadSettings()` and `initOffscreen()` start concurrently in the constructor. Restoring enabled sounds may call `ensureOffscreen()` while initial creation is still in progress. The offscreen listener responds `{ success: true }` before `audio.play()` resolves.
- **Root cause:** There is no shared initialization promise or playback acknowledgement.
- **User impact:** Restored sounds can intermittently fail after worker startup while UI/storage still mark them enabled.
- **Recommended fix:** Lazily create one offscreen document through a memoized promise; await `audio.play()` and return an explicit success/error response.
- **Regression guard:** Persist two enabled sounds, restart the service worker repeatedly, and assert both reach the `playing` state exactly once.

### BL-007 — Offscreen audio always logs a missing control and uses fake user activation

- **Severity:** Medium
- **Status:** Confirmed
- **Location:** `src/offscreen.js:12-49`, `src/offscreen.html`
- **Observed behavior:** `enableAudio()` searches for `#enable-audio`, but that element does not exist. The fallback programmatically clicks a hidden button.
- **Root cause:** Old experimental autoplay code remains after the offscreen UI was changed. Synthetic clicks do not represent a real user gesture.
- **User impact:** A guaranteed console error on offscreen startup and misleading fallback logic that cannot reliably solve autoplay restrictions.
- **Recommended fix:** Delete the fake activation path and rely on a user-initiated popup command forwarded to the offscreen document.
- **Regression guard:** Offscreen startup should produce zero errors and playback failure should propagate to the popup.

### BL-008 — URL validation accepts paths as if they were domains

- **Severity:** Medium
- **Status:** Confirmed
- **Location:** `src/pages/WebsiteBlocker.jsx:103-118`
- **Observed behavior:** Input such as `example.com/some/path` passes the regex, and `cleanUrl()` preserves the path.
- **Root cause:** The UI validates an approximate URL string while downstream code expects a hostname.
- **User impact:** Malformed or unexpectedly broad DNR patterns; duplicate detection also becomes inconsistent.
- **Recommended fix:** Parse using `new URL()` after adding a default scheme, reject credentials/ports when unsupported, and store only normalized `hostname`.
- **Regression guard:** Unit tests for domain, full URL, path, query, port, IPv4/IPv6, IDN, malformed labels, and whitespace.

### BL-009 — DNR creates nine rules per domain and can exceed dynamic-rule quota

- **Severity:** Medium
- **Status:** Confirmed
- **Location:** `src/background.js:741-813`
- **Observed behavior:** Eight URL patterns plus one catch-all are generated per blocked domain.
- **Root cause:** Match-pattern concepts are duplicated instead of using DNR’s domain anchor syntax.
- **User impact:** Unnecessary rule churn; a sufficiently large list can make an entire update fail after old rules were removed.
- **Recommended fix:** Use one anchored rule per normalized domain and enforce a UI limit below the browser quota.
- **Regression guard:** Generate the maximum supported list and assert rule count equals domain count.

### BL-010 — Content script performs repeated work on every visited page

- **Severity:** Medium
- **Status:** Confirmed
- **Location:** `manifest.json:29-36`, `src/content.js:637-701`
- **Observed behavior:** The content script is injected into `<all_urls>`, observes broad DOM mutations, repeatedly reads extension storage every 500 ms for 10 seconds, and emits extensive console logs.
- **Root cause:** A second imperative blocking engine duplicates DNR and includes several backup polling strategies.
- **User impact:** Avoidable CPU/storage work and console noise on every normal page, even when blocking is disabled.
- **Recommended fix:** Make DNR the only blocking engine. Keep no content script unless a narrowly scoped, user-visible feature requires it.
- **Regression guard:** Performance smoke test showing zero Beeyond content-script activity on an unblocked page.

### BL-011 — Pomodoro progress ring shows the current minute, not session progress

- **Severity:** Medium
- **Status:** Confirmed
- **Location:** `src/components/Timer.jsx:10-18`, `src/pages/Pomodoro.jsx:154-157`
- **Observed behavior:** `Pomodoro` calculates full-session progress and passes it to `Timer`, but `Timer` ignores that prop and recomputes progress using `seconds % 60`.
- **Root cause:** The display component contains an older minute-ring model.
- **User impact:** The ring loops every minute and misrepresents progress through a 25-minute session.
- **Recommended fix:** Accept and clamp the supplied session progress, or pass `currentTime` and `initialTime` and derive one canonical percentage.
- **Regression guard:** At 12:30 remaining in a 25-minute session, assert the ring is 50% complete.

### BL-012 — “Today’s Progress” includes every task ever created

- **Severity:** Medium
- **Status:** Confirmed
- **Location:** `src/components/TaskStats.jsx:3-12`, `src/pages/TaskList.jsx:73-103`
- **Observed behavior:** The card title says “Today’s Progress”, but statistics use the entire stored array. Tasks have no `completedAt`.
- **Root cause:** The data model cannot express daily completion.
- **User impact:** The reported productivity rate becomes increasingly misleading over time.
- **Recommended fix:** Either rename the card to “All-time Progress” or store `completedAt` and filter by the user’s local calendar day.
- **Regression guard:** Mix tasks from two dates and assert today’s totals include only today.

### BL-013 — Core navigation and controls are not keyboard/screen-reader accessible

- **Severity:** Medium
- **Status:** Confirmed
- **Location:** `src/pages/Home.jsx:14-87`, `src/components/AudioControl.jsx:13-27`, `src/pages/WebsiteBlocker.jsx:197-210`
- **Observed behavior:** Home feature cards are clickable `<div>` elements with no keyboard semantics. Toggle buttons do not expose accessible names, `role="switch"`, or `aria-checked`.
- **Root cause:** Interaction styling was applied without semantic HTML.
- **User impact:** Keyboard and assistive-technology users cannot reliably navigate or understand application state.
- **Recommended fix:** Use `<button>`/`<a>` for cards, add visible focus states, and expose switch names/states.
- **Regression guard:** Keyboard-only walkthrough plus accessibility-tree assertions for every interactive control.

### BL-014 — Edit/delete/remove actions are hidden on hover

- **Severity:** Medium
- **Status:** Confirmed
- **Location:** `src/components/Task.jsx:72-105`, `src/components/BlockedURL.jsx:62-70`
- **Observed behavior:** Actions use `opacity-0 group-hover:opacity-100` without equivalent `focus-within` behavior.
- **Root cause:** Availability is communicated only through pointer hover.
- **User impact:** Keyboard and some touch users cannot discover available actions; focus may land on an invisible button.
- **Recommended fix:** Keep actions visible in the popup or reveal them with `group-focus-within`; ensure focus indicators remain visible.
- **Regression guard:** Tab through task and block lists without a mouse and assert focused controls are visible.

### BL-015 — Blocklist domains are sent to Google for favicons

- **Severity:** Medium
- **Status:** Confirmed
- **Location:** `src/components/BlockedURL.jsx:17-20`
- **Observed behavior:** Each list item loads `https://www.google.com/s2/favicons?domain=...`.
- **Root cause:** Remote favicon lookup is used for decoration.
- **User impact:** The user’s distraction/block list—including a private or sensitive domain—can be disclosed to a third party.
- **Recommended fix:** Use a local generic icon by default. If favicons are retained, make them opt-in and document the data flow.
- **Regression guard:** Open the blocker page and assert no external network requests are made.

### BL-016 — Release quality gate is absent and currently red

- **Severity:** Medium
- **Status:** Confirmed
- **Location:** `package.json`, `src/offscreen.js:223`
- **Observed behavior:** There is no test command. `npm run lint` fails on one unused variable.
- **Root cause:** The project has no automated verification baseline.
- **User impact:** Core regressions cannot be detected before publishing, and the existing static-quality gate is already failing.
- **Recommended fix:** Add unit tests for domain normalization/matching, Pomodoro state transitions, and quote date selection; add browser-level extension smoke tests; require lint + test + build in CI.
- **Regression guard:** CI must reject any change unless all three gates pass.

### BL-017 — Daily quote changes at UTC midnight instead of local midnight

- **Severity:** Low
- **Status:** Confirmed
- **Location:** `src/utils/quotesUtils.js:10-13`
- **Observed behavior:** The date seed comes from `new Date().toISOString()`.
- **Root cause:** UTC date is used for a user-facing daily concept.
- **User impact:** In UTC+7, the quote changes at 07:00 rather than 00:00 local time.
- **Recommended fix:** Build a local `YYYY-MM-DD` key from `getFullYear()`, `getMonth()`, and `getDate()`.
- **Regression guard:** Test around local midnight in positive and negative UTC offsets.

### BL-018 — Content and codebase contain duplicated/obsolete artifacts

- **Severity:** Low
- **Status:** Confirmed
- **Locations:** `public/quotes.json`, `src/utils/audioManager.js`, `src/utils/popupAudioManager.js`, `src/pages/Pomodoro.jsx`, `src/content.js`, `public/manifest.json`
- **Observed behavior:**
  - Quote dataset: 316 rows, 298 unique quote texts, 18 duplicate rows across 17 duplicated texts.
  - Popup/audio behavior is implemented in several places.
  - Content script contains ambient handlers although ambient playback is owned by the offscreen document.
  - Two manifests describe different permissions and capabilities.
- **Root cause:** Multiple debugging iterations were retained instead of converging on one architecture.
- **User impact:** Conflicting behavior is harder to reason about and future fixes are likely to change the wrong implementation.
- **Recommended fix:** Establish one timer state machine, one audio owner, one blocker engine, and one canonical manifest; remove unused modules only after references are proven absent.
- **Regression guard:** Dead-code check, clean lint, and architecture tests around message types.

## 4. Release-blocking manual test plan

Because automated Chrome runtime access was unavailable during this audit, run these cases in a clean Chrome profile before accepting the findings as fully reproduced:

1. Load `dist/` as unpacked and confirm the popup, service worker, and offscreen document have zero console errors.
2. Start a 2-minute Pomodoro, close the popup, terminate the service worker, wait 30 seconds, reopen, and compare real vs displayed time.
3. Seed a persisted active timer at zero and reload the extension.
4. Block `youtube.com`; verify `youtube.com` and `www.youtube.com` are blocked while `notyoutube.com` and a URL containing `youtube.com` only in its query are allowed.
5. Force invalid rule input/API rejection and verify the popup does not show a false enabled state.
6. Finish a Pomodoro with only Chrome internal pages open; verify notification and sound.
7. Restart the worker with two ambient sounds persisted as enabled; verify both resume once.
8. Complete a keyboard-only walkthrough of every page.
9. Inspect popup network traffic and confirm whether Google favicon/font requests occur.

## 5. Product framing and improvement ideas

### Current “How Might We” framing

**How might we help a student or knowledge worker enter and complete one distraction-free focus session with minimal setup, while keeping all personal productivity data local?**

This is provisional because the target audience, success metric, and cloud constraint have not yet been confirmed by the product owner.

### Seven idea variations

1. **Simplification — One-button Focus Ritual**  
   Replace four disconnected tools with one primary action: choose a task → start focus → automatically enable the relevant blocklist and soundscape → review the outcome.

2. **Combination — Task-linked Pomodoro**  
   Every focus session belongs to one task. On completion, the user marks progress, adds a short note, or continues. This makes Pomodoro sessions meaningful rather than merely counting time.

3. **Inversion — Block only when commitment exists**  
   Do not offer a global blocker toggle as the default. Blocking activates only while a focus session is running, then automatically releases during breaks.

4. **Constraint-based — Local-first Focus Journal**  
   Add a small, private history: focused minutes, completed sessions, interruptions, and task outcomes. No account, backend, or cross-device sync in the first release.

5. **Audience shift — Study/Work presets**  
   Offer a few deliberate presets such as Deep Study, Reading, Coding, and Admin Sprint. Each preset defines duration, blocklist, and sound mix without adding a complex settings page.

6. **Expert lens — Interruption recovery**  
   When a user pauses or abandons a session, ask one lightweight question (“What interrupted you?”). Weekly insights can reveal patterns more useful than generic motivational quotes.

7. **10× direction — Adaptive focus coach**  
   Recommend duration, break timing, and blocking based on local history. This is potentially differentiating but should not be built until reliable session data and user demand exist.

## 6. Preliminary convergence

| Direction | User value | Feasibility | Differentiation | Main risk |
|---|---|---|---|---|
| Reliable Focus Ritual (ideas 1–3) | High | High after core fixes | Medium–High | Users may prefer independent tools |
| Private Focus Insights (ideas 4 & 6) | Medium–High | Medium | Medium | Logging can feel like extra work |
| Adaptive Presets/Coach (ideas 5 & 7) | Unproven | Medium–Low | High | Premature complexity and weak data |

### Provisional recommendation

Build **Reliable Focus Ritual** first. The project already has almost every required primitive; the missing value is orchestration. Today it is a toolbox. The sharper product is a guided loop:

`Choose one task → focus with protection → finish or reflect → see honest progress`

This direction delivers a coherent reason to use Beeyond Limits instead of competing as four average standalone utilities.

## 7. Key assumptions to validate

- [ ] The primary user is a student or individual knowledge worker who focuses alone.
- [ ] Users want website blocking coupled to focus time rather than enabled globally.
- [ ] Selecting one task before a session does not add too much friction.
- [ ] Local-only history is enough for the first public release.
- [ ] A completed focus session—not time spent in the popup—is the right activation metric.

Suggested validation:

- Interview 5 target users about their current focus ritual and existing workaround.
- Give them a clickable/manual prototype of the single focus flow.
- Measure whether at least 4/5 can start a protected session in under 20 seconds without explanation.
- Run a 7-day dogfood test and track completed sessions, abandoned sessions, and blocker false positives.

## 8. Recommended roadmap

### P0 — Reliability foundation

1. Replace service-worker intervals with absolute deadlines + `chrome.alarms`.
2. Reduce Website Blocker to one anchored DNR rule per normalized domain.
3. Add a packaged extension blocked page and remove the imperative content-script blocker.
4. Consolidate all sound playback in one offscreen audio service.
5. Add unit tests, extension smoke tests, and CI; make lint/test/build green.

### P1 — Coherent MVP

1. Create one `FocusSession` model linking a task, timer phase, block profile, sound preset, and outcome.
2. Add the one-button Focus Ritual to the home screen.
3. Automatically enable blocking during focus and release it during breaks/stop.
4. Store a minimal local session history and show honest daily/weekly totals.

### P2 — Store readiness

1. Complete keyboard and screen-reader accessibility.
2. Remove unnecessary permissions, remote favicon lookups, broad web-accessible resources, and production debug logs.
3. Bundle fonts locally or use system fonts.
4. Add a privacy disclosure, permission rationale, error states, and a Chrome Web Store QA checklist.

### P3 — Validate before expanding

1. Dogfood with 5–10 users for one week.
2. Target: ≥70% successful session completion, zero blocker false positives, zero timer drift reports.
3. Only then test presets, interruption reflection, or adaptive recommendations.

## 9. MVP scope

### In

- Reliable focus/break timer across popup closure and service-worker termination
- One selected task per focus session
- Domain-safe blocking active only during focus
- One optional sound preset
- Local session history and accurate daily totals
- Keyboard-accessible, privacy-safe popup

### Not doing yet

- **Accounts, backend, or sync** — reliability and core value are not yet validated.
- **AI focus coach** — insufficient trusted behavioral data and unclear user demand.
- **Social leaderboards/gamification** — can optimize visible streaks instead of meaningful work.
- **More sounds/themes** — breadth does not fix the broken focus loop.
- **Automatic site classification** — adds privacy and accuracy risk before basic domain blocking is trustworthy.
- **Complex project management** — the extension should support one focus commitment, not replace a full task manager.

## 10. Open product questions

1. Is the first target audience students, individual professionals, or both?
2. Does “product-ready” mean a stable Chrome Web Store release, or must the first release also prove retention?
3. Must all data remain local, or is optional account/sync acceptable later?
4. Should blocking be globally available, session-bound, or both?
5. What is the primary success metric: completed sessions, focused minutes, completed tasks, or 7-day return rate?

## 11. Final verdict

**Request changes before release.** The visual product is coherent enough for a prototype, but the timer lifecycle, domain matching, failure reporting, and audio ownership need architectural fixes—not patches. Once P0 is complete and the manual test plan passes in a clean Chrome profile, the project will have a credible foundation for a focused MVP.
