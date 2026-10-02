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
- [x] **COMPLETE**: TaskForge v2 authenticated shell (persistent sidebar, top bar, mobile drawer, dark v2 theme; task workspace at `/work`; PR #6 merged and verified in production on 2026-10-01)
- [x] **COMPLETE**: Production verification (2026-10-01: 62/62 automated checks against the live app in Edge with the New York time zone, covering every page, register, login, task create/edit/delete, status progression, due today/overdue, filters and sort, refresh, theme modes, 390/768/1440px layouts, the mobile drawer, logout, and both expired-session paths; throwaway `smoke-test-*@example.com` accounts were used and their tasks deleted; production demo data was not touched)
- [x] **COMPLETE**: Screenshots (6 real captures from production in `docs/images/`, shown in the README)
- [ ] **IN PROGRESS**: Production visual polish (TaskForge app icons and favicon, cropped and smaller logos, self-hosted Figtree, no white flash before the dark theme, client typecheck in CI; branch `chore/v2-production-verification`, validated locally, waiting for review and merge)
- [ ] **PLANNED**: Recapture screenshots after the visual polish deploys (the current set shows the old, smaller logos)
- [ ] **PLANNED**: Remove the two smoke-test accounts (`smoke-test-*@example.com`, 0 tasks each) in Atlas; there is no delete-account API
- [ ] **IN PROGRESS**: MongoDB Atlas (production database per project owner; the live API is running, which requires a working database connection; record the cluster name and free tier from the Atlas dashboard to close this item. Not verifiable from the repo or a terminal.)
- [ ] **IN PROGRESS**: Render Blueprint sync (`render.yaml` defines the service; confirm in the Render dashboard that the live service is synced to it. Not verifiable from the repo or a terminal.)
- [ ] **IN PROGRESS**: Documentation cleanup (stale README and manifest names fixed; CHANGELOG backfill for work before PR #4 still open)
- [ ] **PLANNED**: Demo reliability (Render free-tier cold starts, demo account always seeded)

## Phase 2: AI Workforce ([details](phases/phase-2-ai-workforce.md))

**Status: PLANNED.** A `/workforce` placeholder page (merged in PR #6) describes these concepts and labels them as planned. Nothing below is implemented.

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

**Status: IN PROGRESS** (task-based foundation merged in PR #6)

- [ ] **IN PROGRESS**: Unified home dashboard (Command Center at `/home`; tasks are its only data source so far)
- [ ] **IN PROGRESS**: Today's priorities (derived from tasks: overdue, due today, high priority, due soon)
- [ ] **IN PROGRESS**: Tasks (open, in-progress, completed, and overdue metrics; completion summary; recent task changes from task timestamps)
- [ ] **PLANNED**: Projects (no projects model yet)
- [ ] **PLANNED**: Agent activity (depends on Phase 2)
- [ ] **PLANNED**: Calendar
- [ ] **PLANNED**: Email highlights
- [ ] **PLANNED**: Morning briefing (a fixed-text daily brief line exists; the agent-generated briefing is planned)
- [ ] **IN PROGRESS**: Recommendations (rule-based only, labeled as such; AI recommendations are planned)

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
