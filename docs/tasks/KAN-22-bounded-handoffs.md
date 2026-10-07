# KAN-22: Bounded explicit handoffs

- Jira: https://taskforgejms.atlassian.net/browse/KAN-22
- Branch: `codex/KAN-22-bounded-handoffs`, verified live base `9a6ec94` (PR #31).
- Milestone: release readiness and bounded Phase 2; no Phase 3–8 expansion.
- Original assignment WIP remains preserved in the primary checkout.

## Acceptance and implementation boundary

1. An owned approved parent with exact version/result digest creates an explicitly
   requested queued child. The selected owned task must already be assigned to the
   selected active agent with Read tasks and Draft artifacts. No assignment is changed.
2. Server derives an immutable owned ancestor chain, maximum three edges and no repeated
   agents. Fingerprints include the full source and target request, distinct from normal
   run creation. Same owner/key/payload retry returns one child, including concurrent calls.
3. Child creation and safe parent/digest audit metadata are atomic in the child document.
   Parent remains terminal and unchanged; each child needs its own execution and review.
4. Existing draft permissions apply to the target task. Every execution boundary additionally
   revalidates owned approved ancestry and source digest. Snapshot only approved result.text,
   safe source attribution and permitted target task/project notes, under total 16KiB.
   Source input, review notes, private fields and source context are not copied.
5. UI shows parent/child linkage and latest 100 direct children, explicit target/request,
   loading/errors, native keyboard locks, stable manual retry identity and session retirement.
   No automatic model call, task write, approval inheritance or failure/cancellation cascade.

## Architecture and operational boundaries

Reuse Run, JWT, MongoDB and provider abstractions. No new queue, worker, paid provider,
hosting/auth architecture, migration/backfill or production test writes. Production real AI
stays disabled; simulation explicit and labelled; actual inference developer-local only.
No Figma/design-generation workflow or gate. Existing nontransactional permission race limits
remain; terminal parent records are immutable through ordinary application mutations.

## Required validation

Mocked routes/services/ancestry, actual fetch/session/uncertain UI cases, isolated real API
and browser lifecycle. Full format/lint/client+QA/server types/units/build/audit/diff/safety,
independent final review, protected exact-head/main CI and matching live deployment before Done.

## Checkpoint

Implementation in progress. Server/client types/build passed. Independent design review found
no approval boundary. Implementation review identified malformed request denial audit gaps;
recording now awaited with fail-closed 503, tests in progress. No commit/PR/delivery claim yet.

Review correction: a failed outer detail refresh could remove the handoff panel and lose
its retry key. The keyed DetailContent now owns retry identity through explicit callbacks;
it survives transient panel removal, and route/session replacement still retires it.
Integrated regression proves an identical retry uses the original key. Temporary lint/type
failures during correction are retained and must be followed by final green checks.

## Final local validation

- 1233 units (570 client / 663 server), 101 isolated real API cases across 6 suites,
  7 fixture safety tests and 9 Chromium flows passed on the frozen implementation.
- Format/lint/client + QA types/server types/both builds/diff passed; audit 0 vulnerabilities.
- Independent final review: no implementation findings, ready for human review.
- Awaited denial audits and the integrated refresh-failure/key-remount scenario are covered.
  Existing permission/context/review regressions remain green. No hidden/skipped failures.
- Test-only initial error expectations were aligned to existing safe 503 behavior and
  absent controls after failed detail refresh; assertions still require no replay/leakage.
- All fixture listeners/processes shut down. No production data tests or model calls.

Protected PR/main CI, merge and matching live deployment remain before Jira Done.
