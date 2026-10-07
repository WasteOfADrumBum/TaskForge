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
- [x] **COMPLETE**: [KAN-4](https://taskforgejms.atlassian.net/browse/KAN-4): enforce PR and current CI checks on main, block force pushes/deletions, and document independent review and approved merge authority. PR #13 merged as `882e134`; effective settings, 361 tests, required PR/main CI, deployment status, and live health verified. See [delivery policy](delivery.md).

- [x] **COMPLETE**: [KAN-5](https://taskforgejms.atlassian.net/browse/KAN-5): reconcile current docs and restore project guidance/branch workflow. PR #14 merged as `fc00e80`; documentation checks, independent review, PR/main CI, deployment status, and live health passed.

- [x] **COMPLETE**: [KAN-11](https://taskforgejms.atlassian.net/browse/KAN-11): bounded DB readiness, build-derived release identity, preview isolation and free-tier recovery runbook. PR #16 merged as `f727b69`; 491 tests, independent review, PR/main CI and deployment status passed. Live client/API commits matched the merge; readiness returned 200.
- [x] **COMPLETE**: [KAN-6](https://taskforgejms.atlassian.net/browse/KAN-6): authentication input validation and registration feedback. PR #17 merged as `bf888c6`; 579 tests, all checks, independent review, responsive/accessibility QA, PR/main CI and deployments passed. Live client/API identity matched; health/readiness and rejected malformed-input responses verified.
- [x] **COMPLETE**: [KAN-7](https://taskforgejms.atlassian.net/browse/KAN-7): bounded authentication abuse protection. PR #18 merged as `0275740`; 593 tests, local checks, independent review, synthetic browser QA, PR/main CI and deployments passed. Live client/API commit matched; readiness and limiter headers verified. [Policy and limits](tasks/KAN-7-auth-abuse-protection.md).
- [x] **COMPLETE**: [KAN-8](https://taskforgejms.atlassian.net/browse/KAN-8): strict task IDs, bounded content and calendar dates. PR #19 merged as `d6ad789`; 679 tests, local checks, independent review, synthetic browser QA, PR/main CI and deployments passed. Live client/API commit matched, health/readiness verified.
- [x] **COMPLETE**: [KAN-9](https://taskforgejms.atlassian.net/browse/KAN-9): immediate local logout and stale-session safeguards including repeated JWTs. PR #20 merged as `39c5ec6`; 786 tests, all checks, independent review, offline browser QA, PR/main CI and deployments passed. Live client/API identity matched; health/readiness verified.
- [x] **COMPLETE**: [KAN-10](https://taskforgejms.atlassian.net/browse/KAN-10): bounded transport and accessible delayed waiting/cancel/manual retry/recovery. PR #21 merged as `0452df2`; 860 tests, clean local checks/audit0, independent review, browser QA, required PR/main CI and deployments passed. Both live build commits matched; health/readiness passed. No production data reset or new cost.

- [x] **COMPLETE**: [KAN-12](https://taskforgejms.atlassian.net/browse/KAN-12): truthful Settings controls, public headings and existing hero contrast. PR #22 merged as `401a7d1`; 875 tests, local checks/audit0, independent review/browser QA, PR/main CI and deployments passed. Both live release identities matched after an explicitly approved corrective cache-cleared API redeploy. No account-management APIs or added cost.

- [x] **COMPLETE**: [KAN-13](https://taskforgejms.atlassian.net/browse/KAN-13): required isolated real MongoDB/API and browser critical-flow checks. PR #23 merged as `3a8e3c5`; 875 units, 3 safety tests, 16 real database/API cases, 3 browser flows, audit0, independent review, PR/main CI and provider deployments passed. Both live release identities matched; health/readiness passed.
- [x] **COMPLETE**: [KAN-14](https://taskforgejms.atlassian.net/browse/KAN-14): release walkthrough, current screenshot provenance, and accurate shipped/planned documentation. Eight synthetic local captures and release documentation validated; PR #24 merged as `a84f216`, with independent review, PR/main CI and matching live client/API release identities passed.

### Phase 1 maintenance (deferred; does not block Phase 1)

Decided at Phase 1 closure (2026-10-02). These are tracked as ongoing maintenance, not Phase 1 scope.

- [x] **COMPLETE**: Demo waiting/recovery experience (KAN-10, PR #21). Delayed waiting and safe recovery are shipped; demo access/data strategy is documented without automatic production reseeding.
- [ ] **IN PROGRESS**: README screenshot recapture and release evidence (KAN-14). Current production-equivalent source and synthetic local data; final capture/review evidence remains.
- [ ] **PLANNED**: CHANGELOG backfill for work before PR #4. Build it from git history; never invent entries.

These are known minor polish issues found during PR #7. They were never Phase 1 items:

- [ ] **PLANNED**: Greeting refresh. The Command Center greeting (morning/afternoon/evening) only updates when the day changes.
- [ ] **PLANNED**: Server test teardown. Jest sometimes warns that a worker `failed to exit gracefully`. This happened in 2 of 3 runs on 2026-10-02. All tests pass, and `--detectOpenHandles` finds no open handles, so it doesn't fail CI.
- [x] **COMPLETE**: Hero logo contrast (KAN-12, PR #22): unchanged asset on a suitable light surface.

## Phase 2: AI Workforce ([details](phases/phase-2-ai-workforce.md))

**Status: IN PROGRESS** (foundation only). Work + Projects (PR #9) and the Agent Registry (PR #10) are merged. Agents are saved definitions only: no agent execution, runs, handoffs, approvals, or permission enforcement exist. KAN-16 adds local developer model calls; production stays disabled. Task assignment is shipped; live client/API source identity is verified. Synthetic browser QA passed; real MongoDB integration and browser critical-flow QA shipped under KAN-13 (PR #23).

- [x] **COMPLETE**: Work + Projects foundation: user-owned projects (model, owner-scoped CRUD API, optional task → project link, delete keeps tasks), a Projects area in Work, and Active projects on the Command Center (PR #9, merged to `main` as `493f0c3`). A prerequisite only: no agent or AI feature.
- [x] **COMPLETE**: Agent Registry: persistent, user-owned agent definitions (name, role, description, status active/paused/disabled, skills, permission identifiers) with owner-scoped CRUD at `/api/agents`, the Workforce registry page (`/workforce`), an agent detail page (`/workforce/:id`), and a Workforce summary on the Command Center. PR #10, CI green, merged to `main` as `3ccb585`. Definitions only: nothing runs an agent or enforces its permissions. A `tools` field is deferred until there are tools to describe.
- [x] **COMPLETE**: [KAN-2](https://taskforgejms.atlassian.net/browse/KAN-2): assign TaskForge tasks to agents. Preserved local work is carried into `codex/KAN-2-agent-task-assignment`, with assignment validation, deletion race reconciliation, workload UI, and source-matched Figma states. PR #15 merged as `16628b0`; 471 tests and independent review plus PR/main CI passed. Matching live client/API source identity verified under KAN-11. KAN-3 synthetic browser QA passed; original uncommitted work remains untouched.
- [ ] **PLANNED**: Shared agent knowledge
- [ ] **IN PROGRESS**: Agent run model (KAN-17): owned persisted states, idempotent creation and bounded attempt/version/lease transitions. Model execution waits for KAN-18 safeguards.
- [ ] **PLANNED**: Agent handoffs
- [ ] **PLANNED**: Approval/rejection workflow
- [ ] **PLANNED**: Agent activity UI
- [x] **COMPLETE**: AI provider contract (KAN-15): disabled default, explicit labelled simulation, validated structured output and unsupported embeddings. PR #25 merged as `dacbd882`; 915 units, all QA/static/audit/CI/review/deployment gates passed. No real model calls.
- [x] **COMPLETE**: Local Ollama provider (KAN-16): numeric loopback, production disabled and bounded validated output. PR #26 merged as `fda3d1a`; 977 units, real local smoke, full QA/audit/CI/review/deployment pass. Trusted cloud-disabled local daemon; no paid calls.
- [ ] **PLANNED**: Chief of Staff MVP
- [ ] **PLANNED**: Research Agent
- [ ] **PLANNED**: Developer Agent
- [ ] **PLANNED**: Audit trail
- [ ] **PLANNED**: Permission boundaries

Release readiness is followed by the approved bounded Phase 2 work above. Phases 3–8 remain future roadmap context and require a separate milestone approval before new implementation.

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

## Active bounded Phase 2 work

KAN-14 verified release evidence is complete (PR #24, a84f216). KAN-15 is Done (PR #25, `dacbd882`). KAN-16 is Done (PR #26, `fda3d1a`); KAN-17 owned run state foundation is active with model execution gated until KAN-18. Josh approved production execution disabled by default with explicitly selected labelled simulation, real inference local through Ollama (KAN-16), and $0 paid AI API calls. Runs, permission enforcement, audit and human approval remain planned.
