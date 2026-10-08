# Phase 3: Knowledge

**Status: IN PROGRESS — approved by Josh on2026-10-08.** [Epic KAN-27](https://taskforgejms.atlassian.net/browse/KAN-27)
tracks bounded Knowledge & Cited Retrieval. Phase4–8 remain unapproved. Hosted keyword/cited
retrieval is distinct from developer-local embeddings/inference; $0 additional recurring cost,
existing auth/ownership/permissions/audit/human review, optimized delivery and Figma exclusion remain.

## Approved delivery sequence

1. KAN-44: private source API/versioning and bounded source-linked keyword retrieval.
2. KAN-45: private notes/text workspace and honest hosted keyword-search UX.
3. KAN-46: guarded local AIProvider embeddings, one pinned compatible model.
4. KAN-47: bounded versioned chunk indexing; source edit/delete/model mismatch fences.
5. KAN-48: permission-scoped semantic retrieval and validated grounded/cited Run drafts.
6. KAN-49: Ask TaskForge and current verifiable source links; explicit capabilities/modes.
7. KAN-50: relevance/citation evaluations, negative security/end-to-end evidence and owner closure.

Jira contains the native dependency links. Source storage/search and UI precede AI work; no
unnecessary ticket count target. No crawlers/PDF/connectors, paid embeddings/reranking/vector
service, new hosting/auth/database architecture or Phase4–8 implementation.

## Atlas compatibility checkpoint (2026-10-08)

Actual signed-in Atlas Cluster0 dashboard: FREE, MongoDB8.0.34, AWSus-east-1,
replica set3nodes,461.62KB/512MB. Its Search & Vector Search page exposes index workflows
with matching version requirements. Verification was metadata-only; no document query,
index build, paid automated embedding/reranking enablement or production write occurred.
UI tier/version/eligibility is verified; an actual index/query benchmark is not yet established.

First keyword retrieval will use bounded current-source reads with ordinary owner indexes
and literal matching, avoiding an optional search-index dependency and stale indexed content.
Search/semantic storage suitability is evaluated further in KAN-47 before any index choice.
No search feature is enabled solely because a dashboard offers it.

## Current implementation checkpoint

KAN-44 branch `codex/KAN-44-private-knowledge`, base77d8adc/verified PR37.
Owned source persistence/API, atomic version/digest/audit and durable50-active-slot bounds are
implemented on this branch. Deleted text is cleared and excluded from current keyword retrieval;
exact source/version/digest/offset quotes support honest verification without model calls.
Targeted22 units (original18 preserved) and26 real Mongo/API cases pass. Full local QA and independent final review passed, with affected reruns after concurrency corrections. Protected delivery remains before Done; no knowledge UI or agent
knowledge access is shipped yet. [API semantics and limits](../knowledge.md).

Formal Phase3 closure requires owner acceptance after all engineering evidence.

## Objective

Give users and agents a shared, searchable knowledge base, and let them ask TaskForge questions grounded in their own content.

## Why it matters

Agents are only as useful as the context they get. Retrieval turns stored notes and documents into answers they can actually use.

## Scope

- Text documents, notes, and project knowledge
- An ingestion → chunking → embeddings → retrieval pipeline
- The "Ask TaskForge" Q&A
- Access scoped by owner and by agent permissions

## Planned capabilities

- Shared Knowledge system
- Text documents
- Notes
- Project knowledge
- Ingestion
- Chunking
- Embeddings
- Retrieval
- Ask TaskForge
- Permission-scoped knowledge access
- Local/free-first embeddings

## Dependencies

- Phase 2's `AIProvider.embed`
- Agent permissions

## Definition of done

- Users can add documents and notes, and they get chunked and embedded.
- Ask TaskForge answers with citations.
- An agent can only retrieve the knowledge its permissions allow.

## Portfolio/career value

Shows a real RAG pipeline with access control, not just a demo chatbot.

## Cost constraints

Use local embeddings (for example through Ollama). Store vectors in MongoDB Atlas (free tier, checking whether Atlas Vector Search is available) or in-process. Add no paid vector database.

## Notes/decisions

- Check the free-tier Atlas Vector Search limits before choosing where vectors are stored.

## Storage and workspace delivery

KAN-44 source API is shipped and Done (PR #38, `7fe3aaf`), with required QA, independent review,
protected CI and matching hosted identities. KAN-45 hosted private note/text workspace is shipped (PR #39, `aea061a`), with required QA/review/CI/live verification. Semantic retrieval, agent knowledge
permissions and Ask remain planned under KAN-46–50. No Phase4–8 authority is implied.

KAN-46 guarded pinned local embeddings are shipped (PR #40, `f45fb86`), with actual local QA, independent review, protected CI and matching live identities. It adds no public semantic endpoint or stored vectors.
KAN-47 must persist/validate full model manifest/dimension and current source/chunk provenance.

KAN-47 co-locates private current chunk vectors with source version/digest for atomic edit/delete
invalidation using existing native MongoDB. Targeted real Mongo races and actual local Mongo+Ollama
synthetic smoke pass; final QA/review/protected delivery pending. No public semantic endpoint or
hosted worker added. Owner/project/current citation enforcement continues under KAN-48.
