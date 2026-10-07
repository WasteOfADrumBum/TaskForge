# KAN-18: Permission enforcement and append-only audit

- Jira: https://taskforgejms.atlassian.net/browse/KAN-18
- Branch: `codex/KAN-18-permissions-audit`
- Source: verified deployed `9149a81` (KAN-17 Done, PR #27).
- Approved milestone: bounded Phase 2; preserve original assignment checkout.

## Acceptance and implementation boundaries

Enforce the registry permission catalog on the server, deny by default, and scope all task/project/agent/run data by the authenticated owner. Ignore request-provided permission/owner/context assertions. Direct endpoint attempts must not bypass checks. Sensitive prompts, context, results and tokens must not be copied into audit/log metadata.

Use the existing JWT/Mongoose/MongoDB architecture. Append lifecycle events in the same atomic Run state update; store immutable owner-scoped denial events separately when a run cannot be owned/resolved. Denial logging must not change an in-flight run's version/attempt fence. No transactions, external queue/service, new paid cost, risky migration, startup bulk recovery or historical audit backfill.

Audit is append-only through the application, not tamper-proof against a trusted database administrator. Record actor/action/time/status/version and safe fixed reason/capability metadata. Audit failure must stop execution before any model call. Existing ownership, retry index readiness, deadlines, leases and stale-attempt guards remain enforced.

Text draft execution requires task.read and artifact.draft; project data additionally needs project.read. No task/project mutation tools or arbitrary tool/code execution are enabled. Production local inference stays disabled; simulation is explicit and clearly labelled. Human approval/application routes remain KAN-19; output is never applied automatically.

## Current safe checkpoint

Permission/audit foundations and draft execution/cancel/audit routes are implemented on this branch. Delivery remains gated on complete safeguards, validation and independent review. Local tests use synthetic simulation/provider fixtures; no actual model smoke or production test writes occur. API/activity/approval UI and full context assembly remain later tickets. Do not claim enforcement or execution is shipped before validation/merge/deployment.

## Required verification

Denied/allowed capabilities, owner/reference isolation, spoofed direct requests, atomic state/audit consistency, immutable history, denial metadata privacy, audit failure, concurrent attempts and stale completion. Fresh loopback child integration namespace with zero-existing-collections checks; no application database credentials, resets or drops. Full format/lint/types/units/build/audit/safety/API/browser, independent review, exact-head/main CI and served deployment verification precede Done. No Figma workflows or gates.

## Local validation and independent review

1055 units (474 client, 581 server), 78 targeted server checks, 7 safety tests, 49 real API cases, 3 Chromium flows, format/lint/types/builds/diff and audit0 passed. Three independent QA regressions cover cancellation-denial ordering, audit failure and timer expiry under a held wall clock. The expiry case failed before the fix and passed after the executor latched its first abort cause. Bulk audit mutations are blocked and tested against persisted records. Independent final review found no remaining issues. PR/main CI and live release identity verification remain required before Done.
