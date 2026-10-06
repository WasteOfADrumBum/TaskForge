# KAN-10: Cold-start feedback

- Jira: https://taskforgejms.atlassian.net/browse/KAN-10
- Branch: `codex/KAN-10-cold-start-feedback`
- Approved milestone: release readiness and bounded Phase 2.
- Starting source: `39c5ec6` (KAN-9, PR #20, both deployed release commits verified).

## Acceptance

1. Fast requests retain the current experience; delayed service has truthful waiting feedback, retry/cancel for safe reads/sign-in, and accessible announcements.
2. Failure cannot hang indefinitely; the full request lifetime includes response body parsing.
3. No automatic write replay or mutation Retry control. Unconfirmed writes instruct refresh/verification before any new submission. Cancellation does not imply server rollback; manual resubmission is not claimed duplicate-free.
4. Implement necessary waiting, failed and recovery feedback using existing TaskForge patterns. Design-tool artifacts are deferred/non-blocking under October 6 user direction.
5. Test fast/slow/failed/header/body/cancel/retry/accessibility, retain session-generation protection, and collect safe cold-start evidence. Document demo access/data strategy without production resets.

## Current implementation checkpoint

Transport/API work is implemented: one 90-second deadline covers fetch and JSON; optional caller signals, typed timeout/cancellation, timer/listener/unread-stream cleanup, and no automatic replay. Writes use clear uncertainty feedback on unconfirmed timeout/cancel/network/body failures. Login is safely repeatable; registration remains a write. Original token/sessionVersion metadata and final consumer guards are preserved.

825 tests passed (424 client, 401 server), including a regression for an unhandled late JSON rejection after deadline. Format, lint, types, both builds, full audit (0 vulnerabilities) and whitespace checks passed. Independent review found no transport blockers; this is sufficient for a partial draft checkpoint, not ticket completion.

## Resumed functional delivery (2026-10-06)

User removed all Figma/MCP/agent/design-generation workflows and gates. Transport checkpoint 6f4d557 is preserved; exact-head CI 37384848037 and preview passed. Functional waiting, safe cancel/retry, recovery and polite announcements are implemented directly from existing application patterns. 860 tests passed (459 client, 401 server), including 35 new UI/loader regressions. Independent review found no remaining blockers. Clean-install format, lint, types, tests, builds and audit passed. Browser QA confirms delayed role=status/aria-live=polite read feedback, Cancel, Retry loading and recovered status; sign-in cancellation retires a late response. No overflow at 390/768/1440 pixels. Known existing development script warning remains tracked for integration QA. Final CI/release verification remains. No paid service or production data change.

## Delivery boundary

A draft transport checkpoint may be committed/pushed for review after validation. Do not merge KAN-10 or mark it Done until its functional UI/QA acceptance is met. No production data writes, seed/reset, new service/cost, hosting/database/auth architecture change or automatic keepalive.

## Read-only slow-start evidence

2026-10-06 at 11:50 UTC: live readiness returned 200 ready after31.535s; follow-up returned200ready after0.189s. No account/data writes or seed. Demo access/recovery strategy is documented in [release runbook](../release-runbook.md).

## Dependency gate remediation

October 6 audit feed added GHSA-68fv-2mgg-jv7q and GHSA-hp3w-g68c-fv3c to existing dependency versions. source-map-js is patched to 1.2.2. sprintf-js has no patched release; a scoped @istanbuljs/load-nyc-config override to js-yaml 4.3.2 removes its argparse 1 path. The actual loader uses the compatible load API; a real YAML configuration probe passed. Clean npm ci and npm audit passed with zero vulnerabilities. No exception, test-tool downgrade or weakened gate.

## Completed release

PR #21 merged as 0452df252840928ce444750c7e4a3fe07b681c0c. Required exact-head CI37461555830 and main CI37461926731 passed. Client deployment6883632517/API6883627528 succeeded; both live build identities matched, health/readiness passed. Jira Done; no production writes. Independent review/QA recorded on the PR.
