# KAN-46: Guarded local embedding provider

Jira: https://taskforgejms.atlassian.net/browse/KAN-46  
Branch `codex/KAN-46-local-embeddings`, base `aea061a` (shipped KAN-45/PR #39).
Approved bounded Phase3/KAN-27; no new infrastructure, paid SDK/API, Figma or Phase4–8.

## Acceptance and implementation

Extend existing AIProvider optional embedding capability using explicit local Ollama setting;
pin verified all-minilm:l6-v2 manifest/dimension and return immutable model/digest/dimension identity
for later chunk persistence. Local metadata preflight, exact manifest,512context/384dimension,
1–4texts/2,000UTF8bytes each/8,000total, finite nonzero matched vectors,1MiBbody, no truncation/pulls.
Reuse existing loopback/cloud/production/deadline/cancellation/capacity guards and safe errors.
No public embedding endpoint, production model, simulated embedding or index/storage change.

Actual isolated Ollama0.40.0/cloud-disabled/owned11435 verification:46MBmodel, manifest
`1b226e2802dbb772b5fc32a58f103ca1804ef7501331012de126ab22f67475ef`, GGUF/BERT/512context/384dimensions.
Explicit synthetic provider smoke passed:3normalizedfinitevectors; related cosine0.8334856,
unrelated0.0842829, repeated identical text1.0. This is capability QA, not final retrieval evaluation.
The application never provisions models; the operator explicitly downloaded this official QA model.
No production/data/model writes, account/service or extra recurringcost. Temporary owned process
must be stopped after verification; model/cache retained. Original assignment WIP untouched.

## Targeted validation and checkpoint

139provider tests (97existing+42embedding) and10fixture guards passed. Production/remote/digest/
capability/context/vector/output/UTF8/batch/timeout/cancellation/sharedBUSY/no-model smoke negatives.
Server build passed. Test-only Jest array fixture shape/late-settlement ordering were corrected;
all assertions preserved. Remaining: full local stable validation, independent final review, PR/
exact-headCI/protectedmerge/mainCI/provider+servedidentity/read-onlyproductionstatus and JiraDone.
Then approved KAN-47 versioned chunk/indexing fences; no Phase4–8.

## Stable QA and review

Full local formatting/lint/typecheck,1,426units (606client/820server),build/audit0,
10fixture safeguards,153real Mongo/API tests and14browser checks passed. Final actual provider
embedding smoke passed; temporary process24152 was stopped only after path/start-time verification
(an ISO timestamp parsing mismatch initially refused cleanup; corrected verification matched exactly).
Separate independent final review has no findings. Logs/synthetic output and review are retained in
the delivery checkpoint artifacts. Remaining: protected PR/exact-headCI/merge/mainCI/provider+served
identity/read-onlyproductiondisabledstatus/JiraDone. Do not repeat passing stable local QA.
