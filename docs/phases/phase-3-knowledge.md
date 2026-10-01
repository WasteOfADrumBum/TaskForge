# Phase 3: Knowledge

**Status: PLANNED**

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
