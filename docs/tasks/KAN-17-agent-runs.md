# KAN-17: Owned agent runs and state machine

- Jira: https://taskforgejms.atlassian.net/browse/KAN-17
- Branch: `codex/KAN-17-agent-runs`
- Source: verified deployed `fda3d1a` (KAN-16 Done, PR #26).
- Approved milestone: bounded Phase 2; preserve original assignment WIP.

## Acceptance and chosen persistence strategy

Persist owned task/agent/input/context/result/status and enforce queued → running → awaiting-approval → approved/rejected/failed, with failure paths, immutable terminal states and validated concurrent transitions. Retried create requests with the same idempotency key return the same record; mismatched payloads conflict. Atomic version/attempt fences prevent duplicate claims and stale completion. Bounded work deadlines/leases let an explicitly owner-scoped expired running attempt become failed after process loss; never automatically replay it or resume ambiguous work.

Use the existing MongoDB/Mongoose process and a new run collection. No new queue, scheduler, paid service, transaction architecture, infrastructure or migration. Do not run bulk startup recovery or modify existing task/user/project/agent records. This is a durable state foundation, not a guarantee of exactly-once inference or automatic restart delivery.

## Execution and product boundary

**Model execution must wait for KAN-18 safeguards.** This branch imports/calls no AIProvider from the run subsystem, starts no worker and makes no task writes. Authenticated `/api/runs` create/list/detail expose owned queued records only; execute requests perform an owner lookup then return safeguards-required 503. Another user's run looks missing. No public state mutation, approval, delete or result application endpoint is added. Approval UI/audit/permissions/context/activity are subsequent approved tickets.

Create requires the owner's task assigned to the owner's active agent, a bounded text input and stable Idempotency-Key. Owner, context, result, status, version and execution fields are server-controlled. Default context is empty until the context ticket. Private service transition helpers are not publicly callable and preserve version/attempt ownership.

## Validation and safe persistence QA

Test validation, model invariants, owner/reference boundaries, idempotency/retry races, atomic claims/transitions, expired work and stale completion. Use a separate fresh `${TEST_MONGO_URI}_runs` child database after strict loopback taskforge_qa_ URI and zero-existing-collections checks. Initialize only fixture collections/indexes; disconnect only, never reset/drop pre-existing data or use application/production credentials. Preserve the earlier API suite's independent freshness guard.

Required format/lint/types/units/build/audit/safety/integration/browser, independent review, exact-head/main CI and matching served source/availability/auth gates precede Done. No production test writes. No Figma/design tooling or Phases 3–8 expansion. Next: KAN-18 permission/audit safeguards.

## Review correction and persistence evidence

Review found that first-deployment requests could race the asynchronous unique-index build. Run creation now awaits a native exact owner/key unique index acknowledgement before any lookup/write, with five-second caller/server limits, single-flight pending work and generic fail-closed 503. No forced schema autoIndex, import/startup writes or data deduplication. Red/green probes prove lookup/write cannot proceed before acknowledgement; delayed, failed and timed-out readiness are covered. Private responses use no-store.

The real `_runs` suite deliberately starts without the unique index; concurrent first requests produce one 201/two 200 responses, one stored record, and the full non-sparse/non-partial unique owner/key index. Thirty-two integration cases pass (16 original API plus 16 run cases), alongside 41 run unit cases. Ownership, payload conflicts, active assignment, concurrent claims/completion/recovery, terminal immutability, expired/stale attempts, and disabled execution/no task writes are covered. Full validation/review/PR/CI/deployment gates remain.

## Local validation checkpoint

Independent QA passed 1018 unit tests (474 client, 544 server), 41 run targets, 7 fixture safety tests, 32 real API cases across two fresh databases, and 3 Chromium flows. Formatting, lint, types, both builds, full audit (0 vulnerabilities), diff checks and fixture cleanup pass. No model invocation or production writes occurred. Final independent documentation review, PR/current-head CI, merge and deployed identity/auth verification remain before Done.
