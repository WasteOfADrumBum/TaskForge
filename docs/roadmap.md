# TaskForge Roadmap

TaskForge is growing from a task manager into a personal AI orchestration platform.
This file is the **source of truth** for what is built and what is planned. For the current checkpoint, see [project-status.md](project-status.md).

## Status legend

| Marker                | Meaning                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `[x]` **COMPLETE**    | Implemented in this repository **and** validated (tests/CI/deploy) |
| `[ ]` **IN PROGRESS** | Work has started on a branch or is partly done                     |
| `[ ]` **PLANNED**     | Not started                                                        |
| `[ ]` **BLOCKED**     | Cannot proceed. The reason is given inline                         |

Rule: only mark an item COMPLETE after it is implemented and validated. Planned work must never be described as existing.

## Permanent constraint: $0 extra cost

TaskForge must add **$0 in recurring infrastructure or API cost** unless that cost is explicitly approved.
Free-first stack: React + Vite, Chakra UI, TypeScript, Node/Express, MongoDB Atlas (free tier), Vercel (free), Render (free), GitHub Actions, and local AI where practical.
AI features go through a provider abstraction and are never hard-wired to one paid provider. See [Phase 2](phases/phase-2-ai-workforce.md#ai-provider-abstraction).

---

## Phase 1: Stabilize TaskForge ([details](phases/phase-1-stabilize.md))

**Status: IN PROGRESS**

- [x] **COMPLETE**: Modernize repository/tooling (npm workspaces, ESLint 9 flat config, Prettier, TypeScript)
- [x] **COMPLETE**: Modernize testing (client Vitest + Testing Library, server Jest + supertest)
- [x] **COMPLETE**: CI pipeline (GitHub Actions: format, lint, test, build, audit)
- [x] **COMPLETE**: MongoDB authentication/data persistence (Mongoose user model)
- [x] **COMPLETE**: JWT authentication (bcrypt + JWT, `requireAuth` middleware)
- [x] **COMPLETE**: Protected routes (`ProtectedRoute`)
- [x] **COMPLETE**: Task database model/API (CRUD at `/api/tasks`)
- [x] **COMPLETE**: User-owned task data (every query scoped by `owner`)
- [x] **COMPLETE**: Task frontend (task workspace, create/edit/delete)
- [x] **COMPLETE**: Filtering/search/sorting (`utils/tasks.ts`)
- [x] **COMPLETE**: Productivity dashboard (task summary views)
- [x] **COMPLETE**: UI polish (enterprise UI, PR #3)
- [x] **COMPLETE**: Performance optimization (lazy-loaded routes, client bundle splitting)
- [x] **COMPLETE**: Landing page
- [x] **COMPLETE**: Portfolio login/register (polished auth pages)
- [x] **COMPLETE**: Demo-data tooling (`npm --workspace server run seed:demo`)
- [x] **COMPLETE**: Render deployment config (`render.yaml`, `/health` check)
- [x] **COMPLETE**: Vercel deployment config (`client/vercel.json` SPA rewrites)
- [x] **COMPLETE**: Production environment configuration (verified 2026-10-01: the live client calls the Render API via `VITE_API_URL`, and Render's `CLIENT_ORIGIN` allows the Vercel origin)
- [x] **COMPLETE**: Session-expiration handling, including the JWT lifetime change from 1h to 7d (PR #4, CI green, merged)
- [x] **COMPLETE**: README rewrite (portfolio-facing README with stack, architecture, auth, testing, deployment, and setup)
- [x] **COMPLETE**: Architecture diagram ([architecture.md](architecture.md), Mermaid)
- [x] **COMPLETE**: Live-demo link (https://taskforge-alpha-six.vercel.app, verified HTTP 200 on 2026-10-01)
- [ ] **IN PROGRESS**: MongoDB Atlas (production database per project owner; the live API is running, which requires a working database connection; record the cluster name and free tier from the Atlas dashboard to close this item)
- [ ] **IN PROGRESS**: Screenshots (folder and shot list in `docs/images/`; images not yet captured)
- [ ] **IN PROGRESS**: Production verification (URLs, health check, CORS, and API wiring verified; live smoke test of register, login, task CRUD, and session expiry not yet run)
- [ ] **IN PROGRESS**: Documentation cleanup (stale README and manifest names fixed; CHANGELOG backfill for earlier work still open)
- [ ] **PLANNED**: Demo reliability (Render free-tier cold starts, demo account always seeded)

## Phase 2: AI Workforce ([details](phases/phase-2-ai-workforce.md))

**Status: PLANNED**

- [ ] **PLANNED**: Agent Registry (role, description, skills, permissions, tools, status)
- [ ] **PLANNED**: Assign TaskForge tasks to agents
- [ ] **PLANNED**: Shared agent knowledge
- [ ] **PLANNED**: Agent run model (input, context, result, status)
- [ ] **PLANNED**: Agent handoffs
- [ ] **PLANNED**: Approval/rejection workflow
- [ ] **PLANNED**: Agent activity UI
- [ ] **PLANNED**: AI provider abstraction (`AIProvider`: chat, embed, structured output)
- [ ] **PLANNED**: Local provider (Ollama or another $0-extra-cost option)
- [ ] **PLANNED**: Chief of Staff MVP
- [ ] **PLANNED**: Research Agent
- [ ] **PLANNED**: Developer Agent
- [ ] **PLANNED**: Audit trail
- [ ] **PLANNED**: Permission boundaries

## Phase 3: Knowledge ([details](phases/phase-3-knowledge.md))

**Status: PLANNED**

- [ ] **PLANNED**: Shared Knowledge system
- [ ] **PLANNED**: Text documents
- [ ] **PLANNED**: Notes
- [ ] **PLANNED**: Project knowledge
- [ ] **PLANNED**: Ingestion
- [ ] **PLANNED**: Chunking
- [ ] **PLANNED**: Embeddings (local/free-first)
- [ ] **PLANNED**: Retrieval
- [ ] **PLANNED**: Ask TaskForge
- [ ] **PLANNED**: Permission-scoped knowledge access

## Phase 4: Command Center ([details](phases/phase-4-command-center.md))

**Status: PLANNED**

- [ ] **PLANNED**: Unified home dashboard
- [ ] **PLANNED**: Today's priorities
- [ ] **PLANNED**: Tasks
- [ ] **PLANNED**: Projects
- [ ] **PLANNED**: Agent activity
- [ ] **PLANNED**: Calendar
- [ ] **PLANNED**: Email highlights
- [ ] **PLANNED**: Morning briefing
- [ ] **PLANNED**: Recommendations

## Phase 5: Reviews ([details](phases/phase-5-reviews.md))

**Status: PLANNED**

- [ ] **PLANNED**: Daily review
- [ ] **PLANNED**: Weekly review
- [ ] **PLANNED**: Progress analytics
- [ ] **PLANNED**: Agent recommendations
- [ ] **PLANNED**: Goal review
- [ ] **PLANNED**: Skill-growth review

## Phase 6: Career + Learning ([details](phases/phase-6-career-learning.md))

**Status: PLANNED**

Career:

- [ ] **PLANNED**: Resume
- [ ] **PLANNED**: Skills inventory
- [ ] **PLANNED**: Job opportunities
- [ ] **PLANNED**: Saved jobs
- [ ] **PLANNED**: Applications
- [ ] **PLANNED**: Skill-gap analysis
- [ ] **PLANNED**: Career goals

Learning:

- [ ] **PLANNED**: Skills to develop
- [ ] **PLANNED**: Learning roadmap
- [ ] **PLANNED**: Courses/articles
- [ ] **PLANNED**: Portfolio-project recommendations
- [ ] **PLANNED**: Connect job-market gaps to learning tasks/projects

## Phase 7: Brand Studio ([details](phases/phase-7-brand-studio.md))

**Status: PLANNED**

- [ ] **PLANNED**: TaskForge brand
- [ ] **PLANNED**: Personal brand
- [ ] **PLANNED**: Colors
- [ ] **PLANNED**: Fonts
- [ ] **PLANNED**: Logos
- [ ] **PLANNED**: Brand voice
- [ ] **PLANNED**: Writing style
- [ ] **PLANNED**: Image prompts
- [ ] **PLANNED**: Generated assets
- [ ] **PLANNED**: LinkedIn/GitHub presentation support

## Phase 8: TaskForge Builds TaskForge ([details](phases/phase-8-self-development.md))

**Status: PLANNED**

- [ ] **PLANNED**: TaskForge Engineer Agent
- [ ] **PLANNED**: Repository access
- [ ] **PLANNED**: Issue creation
- [ ] **PLANNED**: Branch creation
- [ ] **PLANNED**: Code changes
- [ ] **PLANNED**: Tests
- [ ] **PLANNED**: PR creation
- [ ] **PLANNED**: Human approval gate
- [ ] **PLANNED**: Audit trail
- [ ] **PLANNED**: No unrestricted production access (guardrail)
- [ ] **PLANNED**: No automatic merging of `main` (guardrail)
