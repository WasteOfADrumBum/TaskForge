# KAN-50: Retrieval evaluation and Phase 3 engineering acceptance

Jira: https://taskforgejms.atlassian.net/browse/KAN-50
Branch: `claude/KAN-50-retrieval-evaluation`, base `736d334` (after KAN-49/PR #50).
Approved Phase 3 (epic KAN-27). No paid service, hosted inference, production data or Phase 4 work.

## Frozen evaluation (corpus `kan50-v1`)

`server/src/evaluation/knowledgeEvaluation.ts` holds 10 synthetic sources and 13 questions:
10 answerable (each with its relevant source) and 3 the corpus cannot answer. One source is
a deliberate prompt-injection note. The corpus is versioned; it is never edited to make a result
pass.

Metrics: hit@1 and hit@3 (a relevant source in the top results), mean reciprocal rank,
abstention rate (unanswerable questions that return nothing) and false-answer rate. Citation
correctness is checked separately: every returned excerpt must equal the current stored source
text at its offsets, with matching version and digest.

| Path                                       | How it runs                    | hit@1             | hit@3 | MRR | Abstention | Citations exact |
| ------------------------------------------ | ------------------------------ | ----------------- | ----- | --- | ---------- | --------------- |
| Hosted keyword search                      | Real API and MongoDB (CI)      | 1.0               | 1.0   | 1.0 | 1.0        | All             |
| Semantic pipeline, lexical fixture vectors | Real services and MongoDB (CI) | 0.8               | 0.8   | 0.8 | 1.0        | All             |
| Semantic, real pinned `all-minilm:l6-v2`   | Local only, owner machine      | Pending owner run |       |     |            |                 |

The fixture row measures pipeline correctness, not model quality. Its vectors are a
deterministic bag of words, so CI can exercise the real chunking, scoring, 0.3 threshold,
three-hit bound and provenance checks without a model.

### Failure cases (fixture semantic path)

- `q02` (release checklist) and `q03` (on-call rotation) score below the 0.3 threshold and
  return nothing. The pipeline abstains instead of guessing, which is the intended behavior for
  weak matches. A real embedding model is expected to match these, and the local run reports it.
- Keyword search returns the prompt-injection note second for `q09` ("draft"). Retrieved
  injection text is expected; the safety property is how it is handled (next section).

The pinned baselines live in `server/src/evaluation/baseline.ts`. A change there means retrieval
behavior changed and must be explained here.

### Real-model run (owner, local)

With Ollama running locally, cloud disabled, and the pinned models already pulled (see
[ai-provider.md](../ai-provider.md)):

```powershell
$env:AI_PROVIDER='ollama'; $env:OLLAMA_EMBEDDING_MODEL='all-minilm:l6-v2'
npm run test:local-ai -- --local-only --evaluate
```

It provisions a fresh loopback MongoDB, indexes the frozen corpus with real embeddings, runs
retrieval only (no generation, Runs or tasks) and prints one JSON line with the metrics, exact
citation check and any misses. It never reads production configuration. Paste that line into
Jira KAN-50.

## Negative security evidence

| Requirement                     | Evidence (required CI unless noted)                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cross-owner leakage             | `knowledgeEvaluation.integration.ts`: another owner gets 0 keyword and 0 semantic results for every answerable question, and 404 on every source. `knowledge.integration.ts`: cross-owner get, update, delete and audit match missing sources. `groundedKnowledge.integration.ts`: a foreign owner cannot read context or invoke models.                                       |
| Cross-permission leakage        | `groundedKnowledge.integration.ts`: missing `knowledge.read` blocks before claim or any model call; project knowledge requires explicit selection and current `project.read`; permission revoked during embedding sends no quotes to generation; revoked project access blocks approval.                                                                                       |
| Untrusted instructions          | `knowledgeEvaluation.integration.ts`: the injection note reaches generation only inside `untrustedExcerpts` (`key` and `quote` only) beside the fixed system instruction; the draft waits for review and the task is unchanged. `knowledge.integration.ts`: hostile and regex text is literal data. `e2e/knowledge.spec.ts` and `e2e/ask.spec.ts`: hostile text renders inert. |
| Source edits and deletions      | `knowledgeEvaluation.integration.ts`: an edited source leaves semantic retrieval until re-indexed and old quotes no longer match. `knowledge.integration.ts`: deletion removes current retrieval; edit and delete races leave no stale retrieval. `groundedKnowledge.integration.ts`: an edit during embedding blocks stale quote generation.                                  |
| Stale chunks and model mismatch | `knowledgeIndex.integration.ts`: edits and deletes clear vectors atomically; stale versions fail before text traffic; malformed model output leaves no index. `groundedKnowledgeService` checks the pinned model identity, chunk digest and offsets before generation, publication and approval.                                                                               |
| Invalid citations               | `groundedKnowledge.integration.ts`: invalid generated citations fail validation and custom provider output is revalidated. Client: `parseGroundedRun` rejects 11 malformed shapes and never invents a citation.                                                                                                                                                                |
| Bounded resource failures       | `knowledgeIndex.integration.ts`: deadline, cancellation, batch bound and over-capacity corpus checks. `knowledge.integration.ts`: source capacity, edit history and index acknowledgement failures. `groundedKnowledge.integration.ts`: an interrupted query leaves no answer and no replay.                                                                                   |

## Validation

- Server: 7 new evaluation unit tests (corpus bounds, deterministic vectors, metrics, frozen
  baselines). The full server suite passes (859 units).
- Integration: 5 new real MongoDB cases in `knowledgeEvaluation.integration.ts`. MongoDB is not
  available in the authoring environment, so required CI is the first run.
- `npm run test:local-ai -- --local-only --evaluate` adds the real-model retrieval run (owner).
- Independent review, protected CI and matching live identity before Done.

## Limits

- Real-model relevance is not measured until the owner runs the local evaluation.
- Ten synthetic sources is a small corpus. The numbers show the pipeline is correct and honest
  on known questions, not general retrieval quality.
- Hosted production keeps AI disabled; live users get keyword citations only.
- $0 operations: no new service, model download in CI, paid call or recurring cost.
