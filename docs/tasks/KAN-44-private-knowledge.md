# KAN-44: Private knowledge source API and bounded keyword retrieval

Jira: https://taskforgejms.atlassian.net/browse/KAN-44, epicKAN-27. Branch
`codex/KAN-44-private-knowledge`, base77d8adc/PR37. Approved bounded Phase3, $0 additional
recurring cost, original WIP preserved, Figma excluded; Phases4–8 unapproved.

Actual Atlas dashboard FREE/MongoDB8.0.34/search eligibility verified metadata-only. No production
write/index/model call; actual index build/query benchmark not established. First storage/search
uses canonical owned records and bounded literal keywords; indexing design stays simple/free.

## Saved implementation checkpoint

Pure input/digest/query/excerpt helpers and18 targeted unit tests passed; affected ESLint,
Prettier and diffcheck passed. Helpers preserve exact content and source version/digest/quote
offsets, escape regex operators, filter foreign/deleted candidates, reject corrupt digests and
bound bytes/window/results. They do not implement storage/API/UI, quotas, authorization or audit.

Exact next action: add owner-scoped KnowledgeSource persistence with acknowledged ordinary
indexes, atomic source version/digest updates, durable bounds and safe deletion/invalidation;
project ownership validation, controllers/routes and real Mongo/security/concurrency tests.
Then full required QA, stable independent review, PR/protected CI/main CI/live identity and Done.
KAN-45 UI follows this API. No model call or agent knowledge access is enabled by these helpers.

Current window usage92% before foundation edits; save this checkpoint rather than rush release
gates. No Jira completion or deployment claim. Preserve all remaining acceptance requirements.

## Resumed implementation checkpoint

KnowledgeSource/KnowledgeDenial models and owner-scoped API are implemented with explicit input,
version/digest writes, atomic metadata audit, acknowledged ordinary indexes and50 active slots.
Deletion clears private content/frees capacity while retaining append-only metadata. Literal
keyword search uses current source records and verifiable version/digest/offset excerpts; no model.
Original18 tests remain passing;3 index-guard units and25 real Mongo/API tests added/passed.
Server build passed; initial Mongoose/test typing and caught-exception lint diagnostics corrected.
Full QA, independent final review, PR/protected CI/main CI/live identity remain before Done.
See [API semantics and limits](../knowledge.md). KAN-45 supplies UI after this ticket ships.

## Stable validation / delivery pending

Full local format/lint/types/units/both builds/audit0/7 safety/realMongo/12 browser passed.
Unit run:574 client/777 server before final extra regression; full real API152 before the final
case. After independent review, affected22 source/index units and26 real knowledge cases plus
server build/lint passed. Partial index failures now retain single-flight until all operations
settle; identical-key last-slot creates return the winner. No assertions weakened. Final
independent review has no outstanding findings. Required exact-head/main CI and matching live
provider release verification remain before JiraDone. No knowledge UI/model call in this ticket.
