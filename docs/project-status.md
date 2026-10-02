# Project Status

A short, living snapshot of where TaskForge is right now. For the full plan, see [roadmap.md](roadmap.md).

**Last updated:** 2026-10-01

## Checkpoint

| Item                      | Value                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Current phase             | Phase 1: Stabilize TaskForge (Phase 4 Command Center foundation started)                    |
| Current branch            | `chore/v2-production-verification`                                                          |
| Current checkpoint        | Production verification of the v2 shell, screenshots, and small production polish           |
| Last completed checkpoint | TaskForge v2 shell + due-date calendar fix (PR #6, merged to `main` as `5c67c99`)           |
| Next recommended          | Confirm Atlas and Render in their dashboards, then close Phase 1 and start Phase 2 planning |

## Known blockers

- None in the code.
- These two need a person with dashboard access:
  - **MongoDB Atlas:** record the production cluster name and confirm the free tier.
  - **Render:** confirm the `taskforge-api` service is synced to the `render.yaml` Blueprint.

## Production verification (2026-10-01)

**Result:** 62/62 automated checks passed against the live app.

- **Browser:** Microsoft Edge driven by Playwright, set to the America/New_York time zone.
- **Accounts:** throwaway `smoke-test-*@example.com` accounts (two, because the first run's password wasn't kept); their tasks were deleted afterwards. The demo account and its data were not touched, and `seed:demo` was not run.

| Area             | Verified                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public pages     | Landing page, login, register (new account), signed-out `/work` redirects to `/login`                                                                                 |
| Shell pages      | Command Center, Work, Workforce placeholder, Settings                                                                                                                 |
| Tasks            | Create, edit (due date kept), delete, status To Do → In Progress → Done → To Do, search, priority filter, due-date sort                                               |
| Due dates        | Due today shows "Due today" and today's date, not Overdue; due yesterday is Overdue; "was due 1 day ago" wording                                                      |
| Shell actions    | New Task focuses the form; refresh reloads tasks; logout clears the session with no session-expired message                                                           |
| Expired sessions | A server-rejected token and an expired token both return to `/login` with the session-expired message                                                                 |
| Theme            | Dark is the initial default; Light, System (follows the OS), and Dark all apply                                                                                       |
| Responsive       | No horizontal overflow at 390, 768, and 1440px on 6 pages; drawer focus moves in, Escape closes and returns focus, navigating closes it; persistent sidebar at 1440px |
| Errors           | No uncaught page errors                                                                                                                                               |

Two throwaway accounts named `smoke-test-<timestamp>@example.com` now exist in production, each with 0 tasks. There is no delete-account API, so they stay unless removed in Atlas.

## Production URLs

Verified 2026-10-01: both URLs return HTTP 200, the API health check returns `{"status":"ok"}`, the live client bundle calls the Render API, and the API's CORS allows the Vercel origin. The v2 smoke test above re-confirmed both URLs on the same day.

| Service      | URL                                            |
| ------------ | ---------------------------------------------- |
| App (Vercel) | https://taskforge-alpha-six.vercel.app         |
| API (Render) | https://taskforge-api-rp2m.onrender.com        |
| API health   | https://taskforge-api-rp2m.onrender.com/health |

## Infrastructure

| Service        | Role                                    | Tier | Config                     |
| -------------- | --------------------------------------- | ---- | -------------------------- |
| Vercel         | Hosts the client SPA                    | Free | `client/vercel.json`       |
| Render         | Hosts the Express API (`taskforge-api`) | Free | `render.yaml`              |
| MongoDB Atlas  | Database (`MONGO_URI`)                  | Free | Render env var             |
| GitHub Actions | CI on push/PR to `main`                 | Free | `.github/workflows/ci.yml` |

Free-tier note: Render free services sleep when idle, so the first request after a sleep is slow (cold start). This is tracked under "demo reliability". Full details: [architecture.md](architecture.md).

## Design reference

The v2 shell and Command Center UX came from a separate TaskForge v2 prototype built on the Sites platform. The production app keeps its existing architecture: React + Vite + Chakra UI, Express + MongoDB, JWT auth, Vercel + Render.

## Documentation

| Item             | Status                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| README           | Portfolio README with real production screenshots                                                                                |
| Architecture doc | Done: [architecture.md](architecture.md), with Mermaid diagrams                                                                  |
| Screenshots      | 6 captured from production ([images/README.md](images/README.md)); recapture after this branch deploys to show the cropped logos |

## Validation status

Run on `chore/v2-production-verification` on 2026-10-01 (local, before PR):

| Check                  | Result                                                   |
| ---------------------- | -------------------------------------------------------- |
| `npm run format:check` | Pass                                                     |
| `npm run lint`         | Pass (0 warnings)                                        |
| `npm run typecheck`    | Pass (client `tsc --noEmit`, 0 errors; now also in CI)   |
| `npm test`             | Pass: client 128/128 (16 files), server 22/22 (4 suites) |
| `npm run build`        | Pass (client + server)                                   |
| `npm audit`            | Pass (0 vulnerabilities)                                 |
| `git diff --check`     | Pass                                                     |
