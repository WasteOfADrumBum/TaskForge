# KAN-19: Human approval and rejection

- Jira: https://taskforgejms.atlassian.net/browse/KAN-19
- Branch: `codex/KAN-19-human-approval`
- Source: verified live `bb660e2` (KAN-18 Done, PR #28).
- Approved milestone: bounded Phase 2; original assignment WIP remains untouched.

Owner review accepts/rejects an exact text draft with an optional bounded plain-text note. Bind the decision to the displayed Run version and server-computed result digest; reject stale, repeated or foreign decisions. Record review metadata and lifecycle audit atomically; omit raw notes, prompts and output from audit. No task/project writes or new tools, migration, architecture or paid service.

Use existing Agent Detail patterns for a bounded pending-draft review panel, explicit simulation/local labels, proposed input/output, note, approve/reject controls, read recovery and honest uncertain-write handling. Approval does not apply content to tasks. Full run history/execution controls remain KAN-21.

Implementation in progress. Required validation: decision matrix, exact-result binding, owner boundaries, replay/races, note limits, safe audit, sessions/uncertain writes/accessibility, isolated real Mongo/API/browser, full static/unit/build/audit gates and independent review. PR/main CI and matching served identities required before Done. No Figma workflows or production test writes.

## Working checkpoint

Server owner-filtered pending approvals and review routes are implemented with canonical result digests, exact stored-result/version CAS and review metadata; notes remain outside audit. 62 real API cases and 66 targeted server tests passed, plus server build/static checks. Client API/types and Agent Detail review panel are implemented. 18 API tests, 16 panel tests and 18 existing Agent Detail tests passed; lint/types passed. The actual native selector is locked during pending/uncertain decisions. Independent review, actual browser approval flow and full final validation remain pending; no commit/PR/merge or production changes.

## Final local validation

1096 units (508 client, 588 server), 70 real API, 7 safety, 5 Chromium flows, format/lint/types/builds/diff and audit0 passed. Actual browser approval/rejection verifies persisted exact review/note/audit, unchanged task, replay rejection and reload persistence. Review found generic JSON query semantics; literal whole-value comparison and eight fresh Mongo regressions now preserve exact result/type binding. The unsupported Chakra select prop was replaced with enclosing Field disabled context without weakening assertions. Normal independent final review, PR/main CI and deployment identity verification remain required before Done.
