# ADR-002: Keep broad host access for user-configured blocking

## Status

Accepted

## Date

2026-07-30

## Context

Beeyond Limits lets a user enter arbitrary HTTP or HTTPS domains and redirect matching top-level navigation to a packaged blocked page. Blocking continues during an active focus session after the popup closes. Chrome's `declarativeNetRequest` redirect action requires host access for the affected sites.

The extension could instead declare optional host permissions and ask for access separately for each domain. That would reduce install-time scope, but it would also add a permission lifecycle to domain creation, template reuse, session restoration, imported configurations, and removal. The current product has no onboarding or recovery flow for partially granted domain sets.

## Decision

Keep `<all_urls>` in `host_permissions` for the current release.

Use this access only for dynamic `declarativeNetRequest` rules targeting `main_frame` navigation to domains explicitly configured by the user. Do not add content scripts, page inspection, cookie access, request-body access, or browsing-history collection under this permission.

Document the permission prominently in the Chrome Web Store listing, privacy policy, reviewer notes, and permission-justification fields.

## Alternatives considered

### Optional host permissions per domain

This is the preferred future direction if the product adds a clear permission-request and recovery experience. It was not selected for the current release because permission prompts, denied-domain state, saved-session restoration, and permission revocation are not yet represented in the data model or UI.

### Block without a custom redirect page

A pure block action can reduce host-access requirements in some configurations, but it removes the intentional Beeyond Limits blocked-page experience and does not meet the current product design.

## Consequences

- Installation displays a broad host-access warning.
- Chrome Web Store review may take longer and requires a precise justification.
- Privacy disclosures must remain explicit and consistent with implementation.
- Any future page-reading or injection feature requires a new decision and updated user consent; this ADR does not authorize it.
- The optional per-domain permission model should be reconsidered when the required UX and state-management work is implemented.
