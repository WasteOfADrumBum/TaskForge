# KAN-47: Bounded versioned knowledge index

Jira: https://taskforgejms.atlassian.net/browse/KAN-47  
Branch: `codex/KAN-47-versioned-knowledge-index`, base `f45fb86` (shipped KAN-46/PR #40).
Approved bounded Phase3/KAN-27. Existing Mongo/ownership/security, $0 extra recurring cost,
Figma exclusion and Phase4–8 approval boundary preserved. Original assignment WIP untouched.

## Design and acceptance

Use one optional private embedding index co-located with each KnowledgeSource. Native MongoDB
compare-and-set atomically installs source version/digest/chunks/vectors and an indexed audit event;
normal edits/deletes atomically unset the field while updating source/audit. No separate stale
completion can replace newer content. Ordinary reads exclude vectors by schema projection and DTO.
No migration, production test writes, hosted worker, paid service or Atlas Search dependency.
Actual Atlas Free8.0.34 metadata eligibility was verified previously; it is not a live Search index
benchmark. This choice uses ordinary free-compatible BSON/index/query/update capabilities proven
with actual isolated MongoDB. Semantic scoring/agent permissions/Ask remain KAN-48/49 scope.

Deterministic nonblank chunks:480UTF8bytes,48max per20kbyte source; exact UTF16 source offsets,
no split surrogate pair, SHA256 text digest. One pinned manifest/dimension from KAN-46. Up to50
active sources/2,400chunks per owner; only one current index per source, no old-vector generations.
Bounded explicit local indexer batches4chunks, checks total60second default/120second max budget,
propagates cancellation and uses a reusable guarded provider; all Mongo work uses bounded maxTimeMS.
Cached indexes require full current source/model/chunk provenance; wrong/stale/malformed data fails
closed. Source/project owner checks precede input and repeat before commit; corpus reads exclude
indexes whose project is no longer owned. Final semantic/citation publication must recheck current
source/permission state under KAN-48; a validated read is a snapshot, not a lock against later edits.

At most one successful index audit per source version; up to100source versions plus100index events
and final deletion =201bounded metadata events. Source edit limit remains100. Full100version index/
edit lifecycle then delete was tested. Owner corpus bounds do not increase the shared Atlas512MB
quota: vectors increase per-owner disk use, no automatic cleanup/admin resizing or paid upgrade.

## Targeted evidence and checkpoint

13chunk/provenance tests plus preserved22Knowledge units passed.20new actualMongo index/race/bounds/
project/cancellation/metadata-negative tests and all26preservedKnowledge API tests passed.
The preserved digest-negative fixture now includes required index invalidation; its original
matching-digest rejection assertion is unchanged. Fixture-only virtual-ID/Jest inference/unique-key
setup issues were fixed without weakening assertions.
Actual guarded `--local-only --index-only` smoke passed using isolated fresh MongoDB and real
cloud-disabled Ollama0.40.0/pinned384model:2chunks,2embedding calls, matching persisted identity,
owner isolation and edit/delete invalidation. No hidden retry/download, production/test-account/data
writes or paidcall. Temporary exact-owned daemon stopped; synthetic Mongo namespace owned by harness.
No local inference availability or production CRUD quality is inferred from isolated tests.
Remaining: newsmokeguards/static checks, full stable QA, independent final review, PR/protectedCI/
merge/mainCI/provider/live read-only identity/authorization, JiraDone; then approved KAN-48.

## Final provenance correction

A targeted realAPI regression demonstrated that malformed lone UTF16 surrogates were accepted201;
BSON round-trip replaced them, breaking exact text/digest provenance. Source normalization now
rejects malformed Unicode title/content before storage, and chunking rejects it too; valid paired
emoji is preserved. New source/chunk units and API400/no-record regression retain the failure proof.
This is within the untrusted-source/provenance requirement, not a new product direction. Priorfull
localQA passed; final affected serverunits/build/knowledgeAPI-index/browser/static reruns and narrow
independent re-review validate this correction. No production malformed records were created.

## Stable final QA and review

Full baseline format/lint/types,1,439units (606client/833server),173realAPI,14browser,12fixtureguards,
build/audit0 passed. After the Unicode fix, all835serverunits,serverbuild/lint/roottypes,
47affectedrealKnowledgeAPI-index tests and2affectedKnowledgebrowser scenarios passed;
current test totals1,441units/174realAPI. Independent stable review plus narrow Unicode re-review
has no outstanding findings. Actual local Mongo+Ollama smoke passed; validUnicode/model paths remain
unchanged. No tester agent or unrelated revalidation. Remaining protected PR/current-headCI/merge/
mainCI/providers/matchingservedidentity/authread-only/JiraDone; then bounded KAN-48.
