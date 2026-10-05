# Project Status

A short, living snapshot of where TaskForge is right now. For the full plan, see [roadmap.md](roadmap.md).

**Last updated:** 2026-10-05

## Checkpoint

| Item                      | Value                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Phase 1 status            | **COMPLETE** (closed 2026-10-02; [closure summary](phases/phase-1-stabilize.md#closure-summary-2026-10-02))                    |
| Current phase             | Phase 2: AI Workforce, foundation work (no AI execution yet)                                                                   |
| Current branch            | `codex/KAN-2-agent-task-assignment`; original WIP preserved on `feat/agent-task-assignment`                                    |
| Current checkpoint        | Release/delivery readiness followed by task → agent assignment and bounded Phase 2                                             |
| Last completed checkpoint | Docs/workflow (PR #14, `fc00e80`); delivery gates (PR #13); audit recovery (PR #12)                                            |
| Next recommended          | Finish KAN-2 assignment QA, independent review, PR/CI/deployment; then security/reliability readiness and bounded AI execution |

## Known verification gaps

- Exact Render API source identity remains to be confirmed under KAN-11; successful provider deployment status and healthy routes do not establish a served commit.

## Delivery pipeline stabilization (2026-10-05)

- **KAN-1 complete:** PR #12 merged as `48aae59`; 361 tests, audit, final-head/main CI, successful deployment status, and live availability/auth guards passed. Evidence is recorded in [KAN-1](https://taskforgejms.atlassian.net/browse/KAN-1).
- **KAN-4 complete:** PR #13 merged as `882e134`; required PR/main CI, effective protection, deployment status, and live health passed. Main requires PRs/current quality CI/resolved conversations, including administrators; force pushes/deletions are blocked. See [delivery policy](delivery.md).
- **KAN-5 complete:** PR #14 merged as `fc00e80`; docs/link checks, independent review, required PR/main CI, deployment status, and live health passed.
- The existing task-assignment work is preserved separately on `feat/agent-task-assignment` and tracked in [KAN-2](https://taskforgejms.atlassian.net/browse/KAN-2); its preserved implementation is being validated on the active KAN-2 delivery branch, with PR/CI/deployment pending.
- Josh approved autonomous delivery through release readiness and bounded Phase 2. Normal scoped tickets may merge after validation and independent review. New scope, paid cost, major architecture/core security changes, risky data operations, and Phases 3–8 require a decision.

## Infrastructure verification (2026-10-02)

| Check             | Status   | Evidence                                                                                                                                                                                                                                   |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MongoDB Atlas     | Complete | Atlas dashboard (project owner): cluster `Cluster0`, database `taskforge`, Free tier, AWS N. Virginia `us-east-1`, connectivity working                                                                                                    |
| Render Blueprint  | Complete | Render dashboard (project owner): TaskForge Blueprint connected to `WasteOfADrumBum/TaskForge` on `main`, latest sync succeeded, `taskforge-api` synced to `main`                                                                          |
| Vercel production | Complete | The PR #7 favicon, logo, self-hosted font, and pre-paint theme script are served by the live app                                                                                                                                           |
| CI on `main`      | Complete | GitHub Actions green on the PR #7 merge (`84c506d`)                                                                                                                                                                                        |
| API cold start    | Complete | After 20 minutes idle on 2026-10-02, a failed-login probe with a non-existent email took 32.9 s (a cold start) and returned the correct `401 Invalid credentials`, which requires a successful Atlas lookup. The next request took 0.43 s. |
| Production data   | Complete | Smoke-test accounts removed in Atlas (project owner); the users collection holds only the intended real accounts                                                                                                                           |

## Production verification (2026-10-01)

**Result:** 62/62 automated checks passed against the live app.

- **Browser:** Microsoft Edge driven by Playwright, set to the America/New_York time zone.
- **Accounts:** throwaway `smoke-test-*@example.com` accounts (two, because the first run's password wasn't kept). Their tasks were deleted after the run, and the accounts were removed from Atlas on 2026-10-02. The demo account and its data were not touched, and `seed:demo` was not run.

| Area             | Verified                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public pages     | Landing page, login, register (new account), signed-out `/work` redirects to `/login`                                                                                 |
| Shell pages      | Command Center, Work, Workforce placeholder (since replaced by the Agent Registry), Settings                                                                          |
| Tasks            | Create, edit (due date kept), delete, status To Do → In Progress → Done → To Do, search, priority filter, due-date sort                                               |
| Due dates        | Due today shows "Due today" and today's date, not Overdue; due yesterday is Overdue; "was due 1 day ago" wording                                                      |
| Shell actions    | New Task focuses the form; refresh reloads tasks; logout clears the session with no session-expired message                                                           |
| Expired sessions | A server-rejected token and an expired token both return to `/login` with the session-expired message                                                                 |
| Theme            | Dark is the initial default; Light, System (follows the OS), and Dark all apply                                                                                       |
| Responsive       | No horizontal overflow at 390, 768, and 1440px on 6 pages; drawer focus moves in, Escape closes and returns focus, navigating closes it; persistent sidebar at 1440px |
| Errors           | No uncaught page errors                                                                                                                                               |

## Production URLs

Verified 2026-10-01: both URLs return HTTP 200, the API health check returns `{"status":"ok"}`, the live client bundle calls the Render API, and the API's CORS allows the Vercel origin. Re-confirmed live on 2026-10-02.

| Service      | URL                                            |
| ------------ | ---------------------------------------------- |
| App (Vercel) | https://taskforge-alpha-six.vercel.app         |
| API (Render) | https://taskforge-api-rp2m.onrender.com        |
| API health   | https://taskforge-api-rp2m.onrender.com/health |

## Infrastructure

| Service        | Role                                    | Tier | Config                                               |
| -------------- | --------------------------------------- | ---- | ---------------------------------------------------- |
| Vercel         | Hosts the client SPA                    | Free | `client/vercel.json`                                 |
| Render         | Hosts the Express API (`taskforge-api`) | Free | `render.yaml` Blueprint, synced to `main`            |
| MongoDB Atlas  | Database `taskforge` on `Cluster0`      | Free | AWS `us-east-1`; `MONGO_URI` set as a Render env var |
| GitHub Actions | CI on push/PR to `main`                 | Free | `.github/workflows/ci.yml`                           |

Free-tier note: Render free services sleep when idle, so the first request after a sleep is slow. The API recovers correctly. A clearer waiting experience is tracked as "demo reliability" maintenance. Full details: [architecture.md](architecture.md).

## Deferred maintenance (non-blocking)

All five are tracked in the [roadmap](roadmap.md#phase-1-maintenance-deferred-does-not-block-phase-1).

These three Phase 1 items were moved to maintenance at closure:

- **Demo reliability:** a waking-up state during cold starts, and keeping the demo account seeded.
- **Screenshot recapture:** the current set shows the older, smaller logos from before PR #7.
- **CHANGELOG backfill:** work before PR #4.

These are known minor polish issues from PR #7. They were never Phase 1 items:

- **Greeting refresh:** the Command Center greeting only updates when the day changes.
- **Hero logo contrast:** the dark "Task" wordmark is hard to read on the dark background.

## Design reference

The v2 shell and Command Center UX originally came from a separate TaskForge v2 prototype built on the Sites platform. The authoritative [TaskForge Figma file](https://www.figma.com/design/2l4DJJigN7aa4Fk6S5zu8M/TaskForge) was inspected on 2026-10-05: initially one empty page, no design nodes. KAN-2 adds a [source-matched assignee state reference](https://www.figma.com/design/2l4DJJigN7aa4Fk6S5zu8M/TaskForge?node-id=10-59): eight editable component variants, Figtree styles, and bound dark theme tokens. It reconciles the existing field behavior and browser styling; it does not establish full-app design parity. The production app keeps its existing architecture: React + Vite + Chakra UI, Express + MongoDB, JWT auth, Vercel + Render.

## Documentation

| Item             | Status                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| README           | Portfolio README with real production screenshots                                                                                   |
| Architecture doc | Done: [architecture.md](architecture.md), with Mermaid diagrams                                                                     |
| Screenshots      | 6 captured from production ([images/README.md](images/README.md)); recapture is a maintenance item, needed only for the newer logos |

## Validation status

Run on `feat/agent-registry-foundation` on 2026-10-02 (local, before PR #10). The PR #10 CI `quality` check also passed before the merge to `main` (`3ccb585`).

| Check                  | Result                                                      |
| ---------------------- | ----------------------------------------------------------- |
| `npm run format:check` | Pass                                                        |
| `npm run lint`         | Pass (0 warnings)                                           |
| `npm run typecheck`    | Pass (0 errors)                                             |
| `npm test`             | Pass: client 208/208 (25 files), server 153/153 (11 suites) |
| `npm run build`        | Pass (client + server)                                      |
| `npm audit`            | Pass (0 vulnerabilities)                                    |
| `git diff --check`     | Pass                                                        |

Note: the server suite sometimes prints Jest's `A worker process has failed to exit gracefully` warning. This happened in 2 of 3 runs. All tests still pass, the exit code is 0, and `--detectOpenHandles` reports no open handles. It already existed on `main` before this branch and is tracked as maintenance in the roadmap.
