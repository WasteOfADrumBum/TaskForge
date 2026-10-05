# KAN-9: Immediate local logout

- Jira: https://taskforgejms.atlassian.net/browse/KAN-9
- Branch: `codex/KAN-9-immediate-local-logout`
- Approved milestone: release readiness and bounded Phase 2.
- Starting source: `d6ad789` (KAN-8, PR #19, deployed client/API identity verified).

## Acceptance and implementation boundary

1. Logout clears the stored token, auth state and tasks/projects/agents synchronously, then replaces navigation with login. It works offline or with a failed/stalled server; no unhandled rejection or session-expired feedback.
2. Because the API is stateless and has no session to revoke, the UI sends no logout acknowledgement. Keep the server endpoint/API export for compatibility; do not introduce revocation, refresh tokens or auth infrastructure.
3. Repeated logout calls remain safe. Old API success, error, body parsing and network failures after logout or a new login cannot return stale data or error feedback into the current session.
4. Use the real global Redux store for API race tests. Cover resolved/rejected/stalled/offline acknowledgement scenarios without sending that request, delayed fetch/body success/error, and current-session compatibility.

## Inspection and scoped fix

The existing hook awaited an unbounded logout request. Authenticated fetch checked the token before returning a response, but tasks/projects/agents parsed JSON afterward without another check. Red tests reproduced stale success/error body returns after logout/new login. A shared authenticated body reader now rechecks the token after parsing, including parse errors; authenticated fetch also checks a rejected network request before rethrowing it. Stale failures use the existing SessionExpiredError control path without dispatching session expiration for a new or absent session. Independent review reproduced a second boundary after parsing but before the consumer resumed; resource actions/loaders and page save/delete continuations now recheck the captured session immediately before state updates, feedback, loading cleanup or navigation. Regression tests cover those final consumption boundaries.

## Design and delivery

Retain the current logout button and login page; no design-dependent layout or Figma change. No production account writes, data migration, hosting change, new cost or core auth architecture change. Server JWT lifetime/stateless behavior remain unchanged.

Required gates: formatting, lint, client/server types/builds, all tests, full audit, local synthetic QA, independent review, exact-head PR CI, main CI and deployed source identity. No completion/deployment claim until verified.

## Local browser QA

With the local API intentionally offline, the actual logout button clears localStorage synchronously, navigates to login within the browser check, shows no session-expired message and sends zero logout requests. No production account/data activity. Existing local React script warning remains tracked under KAN-13. Full final validation and delivery gates are still pending.

## Final local validation

- 786 tests passed (385 client, 401 server), including API races, immediate logout, 36 final-consumer/UI regressions and repeated-JWT/session-generation cases.
- Format, lint, client/server types, both builds, full audit (0 vulnerabilities) and whitespace checks passed.
- Independent review identified two continuation boundaries; both are guarded and regression-tested. Final review and PR/main CI/deployment/source checks remain gates.

## Identical-token boundary

A regression also proved that logout followed by login with the same JWT string could accept an old result. The client auth slice now increments an in-memory sessionVersion on login/logout/expiration. Fetch retains the original version with its Response; body parsing and final consumers compare both token and version. No server JWT format/lifetime, revocation, storage or authentication infrastructure changes. Reused-token body/error/action/401/network regressions pass; final full validation passed.
