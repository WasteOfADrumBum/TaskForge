# KAN-45: Private knowledge workspace

Jira: https://taskforgejms.atlassian.net/browse/KAN-45  
Branch: `codex/KAN-45-knowledge-workspace`, based on KAN-44 merge `7fe3aaf` (PR #38).
Approved bounded Phase3 under KAN-27; no Phase4–8, Figma or paid services.

## Acceptance

Private note/text CRUD and optional owned project association; bounded manual plain-text paste;
source-linked literal keyword search and exact version/excerpt provenance. Current displayed
version/digest on edits/deletes, explicit delete confirmation, refresh on conflict/uncertainty,
stable creation key for manual retry, route/session retirement and private plain text.
Hosted keyword capabilities are honest and call no model. Developer-local embeddings/Ask follow
in later tickets. Preserve KAN-44 audit/authorization and original assignment WIP.

## Implementation and checkpoint

Authenticated `/knowledge` and `/knowledge/:id` use existing Chakra/session/request patterns.
At most 50 active sources, 20,000 UTF8 bytes per source, 120 title characters, 120 query bytes/
8 terms, 10 search results and 100 source versions; server remains authoritative. Sources are
rendered as inert text. Citation links verify current source ID/version/digest and exact offsets.
An uncertain create freezes the original input/key; a successful source refresh is required
before an explicit same-save retry. Starting another source is an explicit user action with
an earlier-save warning. Edit/deletion failures lock changes until explicit detail refresh,
which discards unsaved text. No auto retry, ingestion URL fetching or model request.

Targeted API/bounds/provenance tests pass (19). Two real local MongoDB/browser scenarios passed:
mobile create/project/text/search/current+stale citation/edit/delete/missing source, and concurrent
edit conflicts/foreign owner routes/search. A component test caught a Windows punctuation
encoding regression; repaired. Test-only invalid role options were also corrected; assertions
retained. Remaining: final targeted components/types, required full local validation, independent
review, PR/current protected CI/merge/main CI/providers/read-only production identity/QA, Jira Done.

## Stable validation and independent review

Full local formatting/lint/typecheck, 1,383 baseline unit tests (605 client/778 server), build,
audit zero, 7 fixture safeguards, 153 real API tests and all 14 browser checks passed.
The added heading/unknown-count regression also passes (32 knowledge-targeted tests total).
Affected component tests/lint/types passed after narrow review corrections. Independent final
review has no outstanding findings; its h1/unknown-count suggestions were resolved and re-reviewed.
Earlier test-only fixture typing/fake-timer ordering failures were fixed; assertions retained.
React checklist: lazy route loading, session-keyed private lifetimes, primitive effect dependencies,
single-flight request guards, native disabled/labelled controls, plain text and mobile wrapping;
no speculative memoization/framework changes. Local logs are saved with the delivery checkpoint.
Remaining: PR/protected exact-head CI, merge/main CI, provider deployments, read-only live identity/
auth checks and Jira Done. No production writes or hidden model calls.
