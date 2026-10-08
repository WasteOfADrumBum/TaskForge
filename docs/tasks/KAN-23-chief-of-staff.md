# KAN-23: Chief of Staff MVP

- Jira: https://taskforgejms.atlassian.net/browse/KAN-23
- Branch: `codex/KAN-23-chief-of-staff`, verified live base `ff1393e` (PR #32).
- Approved milestone: release readiness and bounded Phase 2; original assignment WIP preserved.

## Acceptance and implementation

Explicit `chief-of-staff` execution workflow proposes priority and an eligible agent for one
assigned owned task, with permitted optional project and approved handoff-source context.
The actor still requires current active/read/draft permissions. A deterministic first-20
window of eligible owned active definitions supplies only IDs, names, roles, skills/update
attribution; no instructions, secrets, owner data or descriptions. All context stays under16KiB.

Workflow/context/digest are frozen together with the audited claim; legacy/default text drafts
retain their behavior. Existing four permission checkpoints also revalidate candidate IDs.
Strict structured output accepts only captured task/candidate-or-null, priority enum, bounded
summary/reason and exact keys. Invalid model output fails closed with no fallback or task writes.

Local inference uses the provider structuredOutput abstraction. Explicit simulation validates
the existing canned result then generates a plainly labelled deterministic rule-based proposal;
it calls no model. Mode remains an explicit choice. The proposal and readable text are bound
by the existing exact-result/version human review; approval records a decision, applies nothing.

No email/calendar, bulk automatic assignment, scheduling, RAG, repository actions, worker/queue,
new provider/service/cost or hosting/auth/database architecture. Phases3–8 remain unapproved.
No Figma/design-generation workflow. Actual inference remains developer-local only.

## Validation and delivery

Representative schema/demo, getter-backed roster allowlist, candidate revocation/owner/privacy,
workflow immutability, invalid output, legacy API/UI and no-silent-change regressions. Fresh real
Mongo/API and local browser flow, plus actual Ollama structured triage smoke. Full static/types/
units/build/audit/safety/API/browser, independent review, protected CI/merge/main CI and matching
live deployment before Done. No production data testing or paid AI.

## Delivery complete

PR [#34](https://github.com/WasteOfADrumBum/TaskForge/pull/34) merged as
`1c7d784d98cb88a9d71ce9aedb63349b85a148c8`. Independent final review found no blockers;
1291 units, 110 real API cases, full browser suite, safety/static/types/build/audit and
actual local Ollama structured triage smoke passed. Exact-head/main CI and both provider
deployments succeeded. Live client/API identities matched the merge; health/readiness200
and invalid-token execution401 passed without production data/model calls. Jira is Done.

Roster is a stable first20 eligible definition window, then filters unsupported permissions;
legacy/corrupt definitions can consume slots. This remains advisory, not an exhaustive roster.
