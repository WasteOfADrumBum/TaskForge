# KAN-7: Authentication abuse protection

- Jira: https://taskforgejms.atlassian.net/browse/KAN-7
- Branch: `codex/KAN-7-auth-abuse-protection`
- Approved milestone: release readiness and bounded Phase 2.
- Starting source: `bf888c6` (KAN-6, PR #17, deployed and verified).

## Acceptance

1. Login and registration are bounded, with 429 and useful retry feedback.
2. Independent ordinary clients remain usable behind Render and in local tests.
3. Forged forwarded headers cannot bypass limits; do not enable blanket proxy trust.
4. Test limit/recovery, independent clients, proxy handling and UI error feedback.
5. Preserve existing auth architecture and $0 cost; document single-process/reset limitations. A shared store or hosting change requires separate approval.

## Inspection and current decision

The existing API has no rate limiter or proxy trust setting. Login/register errors already surface the API message in the UI. Implementation now uses maintained express-rate-limit with separate account and process capacity buckets. Proxy trust remains disabled; forwarded headers are ignored by the limit keys. No shared store, paid service, or authentication architecture change.

Render documents Cloudflare and its load balancers forwarding X-Forwarded-For, but that alone does not establish the exact chain or header sanitation for this service. A guessed hop count can turn a client limit into a shared proxy limit or allow spoofing. Therefore no per-client IP guarantee is claimed. Account keys are supplemented by process-wide capacity to bound attacks that rotate email addresses.

Primary references:

- https://render.com/articles/how-render-handles-ddos-attacks
- https://expressjs.com/en/guide/behind-proxies/
- https://express-rate-limit.mintlify.app/guides/troubleshooting-proxy-issues
- https://express-rate-limit.mintlify.app/reference/configuration

## Selected bounded policy

- Login: 10 failed attempts per normalized account in 15 minutes; successful responses do not consume that account quota. Process capacity: 120 requests per minute.
- Registration: 5 attempts per normalized account per hour. Process capacity: 20 requests per 15 minutes.
- Hash normalized email for storage keys; malformed account values share a bounded invalid bucket. Passwords are never keys or logs.
- Return 429 with retry seconds in the API message and Retry-After. Existing form error feedback surfaces this message, with no new layout or design-dependent change.
- Separate limiter factories keep test state isolated. No production or NODE_ENV test bypass.
- Counts are process-local and reset at restart; no multi-instance coordination. Targeted attempts can temporarily exhaust a victim account quota. Under sustained attack, shared capacity can block other users until recovery. This is bounded free-tier protection, not complete distributed abuse prevention.

## QA and delivery boundary

Use local synthetic requests for repeated-limit tests. Do not exhaust production limits or create production accounts. Existing login/register layouts remain the baseline; reconcile Figma before any design-dependent change. Required gates: formatting, lint, client/server types and builds, all tests, full audit, independent final-diff review, exact-head PR CI, main CI and deployed source identity.

Implementation and test work are in progress. No PR, merge, deployment, or completion is claimed at this checkpoint. Original assignment checkout remains untouched.

## Local validation

- 593 tests passed (276 client, 317 server); targeted auth server 91 and client API 6 passed.
- Format, lint, client/server types, both builds, full audit (0 vulnerabilities) and whitespace checks passed.
- Independent review found no blockers. Local synthetic 429 browser QA verifies retry feedback and a usable form; no production load or account writes.
- Final-head PR CI, main CI, deployment status and live commit/availability checks remain delivery gates.
