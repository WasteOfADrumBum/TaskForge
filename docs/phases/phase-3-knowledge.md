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
Source/query validation and pure bounded owner-filtered keyword-excerpt matching are implemented
with18 targeted unit cases and affected formatting/lint passed. Content≤20000UTF8bytes,
title≤120chars, query≤120UTF8bytes/8terms, candidate window≤50, results≤10; exact source
version/digest/offset excerpts, escaped literal regex and title-only match attribution are tested.
These helpers do not fetch data, enforce durable corpus quotas or ship a knowledge API/UI.
Owner-scoped persistence, atomic source version/limit/deletion handling, routes/controllers,
real Mongo QA, full validation, independent review, PR/CI/live and JiraDone remain required.

Implementation continues from this checkpoint when usage permits; formal Phase3 closure will
require owner acceptance after complete engineering evidence.

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
