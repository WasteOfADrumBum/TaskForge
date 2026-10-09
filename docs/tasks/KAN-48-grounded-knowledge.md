# KAN-48: Bounded local grounded knowledge Runs

Jira: https://taskforgejms.atlassian.net/browse/KAN-48  
Branch: `codex/KAN-48-grounded-knowledge`, base `23268b2` (KAN-47/PR #41).
Approved Phase3; no Figma, paid service, architecture migration or production writes.

## Behavior and bounds

Explicit knowledge workflow requires local mode, assigned owned active agent, task.read,
artifact.draft and new opt-in knowledge.read. Project retrieval additionally requires project.read
and the current task project. Notes-only Mongo reads exclude project-associated text. No default
grants. Existing Run claim/audit precedes inference. Hosted production remains disabled; hosted
keyword search remains available independently. Ask UI is KAN-49.

Pinned384-dimensional query embedding scores current owned indexes (50sources/2,400chunks).
Question480UTF8bytes, three hits max, minimum cosine0.3, quote240UTF16units without split surrogate.
Full source version/digest, model identity, chunk digest and exact offsets are checked before
model generation, publication and approval. Provider receives only question and labeled untrusted
quotes. No tools, automatic task changes, fallback, replay or model downloads. Existing guarded
provider/Run cancellation, deadline, capacity and bounded Mongo safeguards remain.

Model returns bounded answer and server-issued citation keys only; consumer revalidates output.
Exact quotes/provenance are attached to the digest-bound Run result. Citations establish source
provenance, not independent factual truth. Local draft is labeled unverified and requires exact
human review. Source edits/deletes/revoked permissions block publication or approval; owner can
reject stale drafts. Historical quotes remain in private Run history after source deletion; current
retrieval/approval invalidates. Current checks are snapshots, not multi-document mutation locks.

## Validation and review

1,458units (606client/852server),192real-Mongo tests (174existing+18grounded),14browser scenarios,
14fixture guards, format/lint/types/build and audit0. Actual cloud-disabled Ollama0.40.0/qwen3:0.6b,
pinned all-minilm:l6-v2 and fresh Mongo passed: exact cited quote, human approval, task unchanged,
productionCalls0/paidCalls0. Exact-owned daemon stopped; harness owns fresh synthetic databases.
Local tests do not imply hosted inference or production CRUD verification.

Independent review resolved consumer output revalidation and denial-audit failure cleanup.
Regressions reject malformed custom output and prove a failed denial audit still fences the Run
with embedded failure audit, no result/model continuation. A missing fixture digest was corrected
without weakening assertions; failure/correction logs retained. Final affected types/lint/42units
and server build passed. Review has no outstanding findings.

Final audit found new Handlebars advisories through development-only ts-jest. Compatible lock-only
4.7.9 to4.7.10 patch restores audit0; affected Jest units/full Mongo suites rerun. No policy exception.
See [critical advisory and patched version](https://github.com/advisories/GHSA-8r5x-fm3f-whwj).

Remaining: PR/current-head requiredCI, protected merge/mainCI/provider deployments/matching live
identities/read-only auth checks/JiraDone. KAN-49 UI and KAN-50 retrieval evaluations follow;
Phase3 closure requires owner acceptance. Phases4-8 remain unapproved.
