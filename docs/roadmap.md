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

**Status: COMPLETE** (closed 2026-10-02; see the [closure summary](phases/phase-1-stabilize.md#closure-summary-2026-10-02))

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
- [x] **COMPLETE**: Production visual polish (TaskForge app icons and favicon, cropped and smaller logos, self-hosted Figtree, no white flash before the dark theme, midnight rollover, client typecheck in CI; PR #7 merged, CI green, and verified live on 2026-10-02: the new favicon, logo, font, and theme script are served from production)
- [x] **COMPLETE**: MongoDB Atlas (verified in the Atlas dashboard by the project owner on 2026-10-02: cluster `Cluster0`, database `taskforge`, Free tier, AWS N. Virginia `us-east-1`; production connectivity working)
- [x] **COMPLETE**: Render Blueprint sync (verified in the Render dashboard by the project owner on 2026-10-02: the TaskForge Blueprint is connected to `WasteOfADrumBum/TaskForge` on `main`, the latest sync succeeded, and `taskforge-api` is synced to `main`)
- [x] **COMPLETE**: Smoke-test account cleanup (the two `smoke-test-*@example.com` accounts were removed in Atlas by the project owner on 2026-10-02; the users collection holds only the intended real accounts)
- [x] **COMPLETE**: Phase 1 infrastructure verification (Vercel app and Render API live, Atlas and Render Blueprint confirmed, CI green on `main`, and the API recovers from a free-tier cold start: after 20 minutes idle on 2026-10-02, a failed-login probe with a non-existent email took 32.9 s (a cold start) and returned the correct `401 Invalid credentials`, which requires a successful Atlas lookup. The next request took 0.43 s.)
- [x] **COMPLETE**: Documentation cleanup for current docs (stale README, manifest names, and phase/status docs corrected; the CHANGELOG backfill for work before PR #4 is deferred to maintenance below)

### Delivery readiness (approved 2026-10-05)

- [x] **COMPLETE**: [KAN-1](https://taskforgejms.atlassian.net/browse/KAN-1): restore the full dependency audit through Jest 30 and Node watch mode. PR #12 merged as `48aae59`; 361 tests, full audit, final-head/main CI, deployment status, and live availability/auth guards passed. No audit exception.
- [ ] **IN PROGRESS**: [KAN-4](https://taskforgejms.atlassian.net/browse/KAN-4): enforce PR and current CI checks on main, block force pushes/deletions, and document independent review and approved merge authority. Settings applied; policy PR validation pending. See [delivery policy](delivery.md).

### Phase 1 maintenance (deferred; does not block Phase 1)

Decided at Phase 1 closure (2026-10-02). These are tracked as ongoing maintenance, not Phase 1 scope.

- [ ] **PLANNED**: Demo reliability. Show a clear "waking up the server" state during Render cold starts, and keep the demo account seeded. The API's recovery from a cold start was verified at closure; this item is about the waiting experience.
- [ ] **PLANNED**: Recapture README screenshots. The current set is accurate except that it shows the older, smaller logos from before PR #7.
- [ ] **PLANNED**: CHANGELOG backfill for work before PR #4. Build it from git history; never invent entries.

These are known minor polish issues found during PR #7. They were never Phase 1 items:

- [ ] **PLANNED**: Greeting refresh. The Command Center greeting (morning/afternoon/evening) only updates when the day changes.
- [ ] **PLANNED**: Server test teardown. Jest sometimes warns that a worker `failed to exit gracefully`. This happened in 2 of 3 runs on 2026-10-02. All tests pass, and `--detectOpenHandles` finds no open handles, so it doesn't fail CI.
- [ ] **PLANNED**: Hero logo contrast. The dark "Task" wordmark in `taskforge-logo.png` is hard to read on the dark background.

## Phase 2: AI Workforce ([details](phases/phase-2-ai-workforce.md))

**Status: IN PROGRESS** (foundation only). Work + Projects (PR #9) and the Agent Registry (PR #10) are merged. Agents are saved definitions only: no AI execution, model calls, runs, assignments, handoffs, approvals, or permission enforcement exist.

- [x] **COMPLETE**: Work + Projects foundation: user-owned projects (model, owner-scoped CRUD API, optional task → project link, delete keeps tasks), a Projects area in Work, and Active projects on the Command Center (PR #9, merged to `main` as `493f0c3`). A prerequisite only: no agent or AI feature.
- [x] **COMPLETE**: Agent Registry: persistent, user-owned agent definitions (name, role, description, status active/paused/disabled, skills, permission identifiers) with owner-scoped CRUD at `/api/agents`, the Workforce registry page (`/workforce`), an agent detail page (`/workforce/:id`), and a Workforce summary on the Command Center. PR #10, CI green, merged to `main` as `3ccb585`. Definitions only: nothing runs an agent or enforces its permissions. A `tools` field is deferred until there are tools to describe.
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

- [ ] **IN PROGRESS**: Unified home dashboard (Command Center at `/home`; data sources so far are tasks, projects, and agent definitions)
- [ ] **IN PROGRESS**: Today's priorities (derived from tasks: overdue, due today, high priority, due soon)
- [ ] **IN PROGRESS**: Tasks (open, in-progress, completed, and overdue metrics; completion summary; recent task changes from task timestamps)
- [x] **COMPLETE**: Projects (an Active projects panel with real open-task counts and completion; merged in PR #9)
- [x] **COMPLETE**: Workforce summary (active, paused, and disabled agent counts, shown only when agents exist; merged in PR #10)
- [ ] **PLANNED**: Agent activity (depends on agent runs in Phase 2)
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
