# KAN-21: Run activity and result UI

- Jira: https://taskforgejms.atlassian.net/browse/KAN-21
- Branch: `codex/KAN-21-run-activity`, base `c06dc63` (verified live PR #30).
- Approved milestone: release readiness and bounded Phase 2.
- Source: A07 acceptance, existing run/permission/context/review APIs and theme patterns.
- Original assignment WIP remains untouched in the primary checkout.

## Acceptance

1. Latest 100 owned runs have real list/detail/status/error/context/review/audit display.
2. Empty/loading/failure, safe manual read refresh/cancel and stale/session guards work.
3. Explicit queued creation and selected execution mode use existing fenced APIs;
   no assignment auto-start, automatic write replay or task/project mutation.
4. Simulation is plainly labelled canned output; configured developer-local inference
   is distinct. Production real AI remains disabled, no paid calls.
5. Exact-result human review persists decisions; keyboard/mobile navigation works.

## Boundaries

No backend architecture, provider, worker, handoff execution, paid service, migration,
production test writes or Figma. Handoffs/starter specializations are subsequent tickets;
Phases 3–8 require approval. Serve stored context/output as plain text, never executable HTML.
Capture session version and route lifetime; uncertain creation retains retry identity,
other uncertain writes require an authoritative refresh before another action.

## Required validation and delivery

Targeted units, full format/lint/type/unit/build/audit/diff, QA safety, real API/browser,
and independent final review. Record corrections and evidence on PR. Exact-head protected
CI, normal merge, main CI, provider success and matching live source identity before Jira Done.

## Checkpoint

Implementation and local validation complete; PR/CI/deployment remain pending.

- 1141 units (545 client / 596 server), 89 real API cases, 7 fixture safety tests,
  8 Chromium flows; format/lint/client + QA types/server types/both builds/diff pass;
  audit reports zero vulnerabilities.
- Independent reviewer: no findings, ready for human review. Actual native selector
  disabling was fixed on enclosing Chakra fields; pending/uncertain regressions pass.
- Initial targeted 43/44 failure retained: unloaded Assigned task selector was enabled.
  Corrected field propagation, then expanded targeted validation passed 63/63.
- A failed-detail refresh test now correctly asserts controls absent, warning retained,
  and no mutation replay, rather than expecting disabled controls that cannot render.
- No production data changes, model calls, paid service, Figma or future-phase expansion.
