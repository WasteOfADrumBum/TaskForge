# Project Status

A short, living snapshot of where TaskForge is right now. For the full plan, see [roadmap.md](roadmap.md).

**Last updated:** 2026-10-01

## Checkpoint

| Item                      | Value                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Current phase             | Phase 1: Stabilize TaskForge (Phase 4 Command Center foundation started)                                                  |
| Current branch            | `feat/taskforge-v2-shell`                                                                                                 |
| Current checkpoint        | TaskForge v2 authenticated shell, Command Center foundation, Work page, Workforce placeholder, due-date calendar-date fix |
| Last completed checkpoint | Portfolio documentation (PR #5, merged to `main` as `3b50914`)                                                            |
| Next recommended          | `chore/production-verification`: live smoke test of the v2 shell, then capture screenshots                                |

## Known blockers

- None in the code.
- Screenshots must be captured by hand from the live app (see below). The v2 shell changes how the app looks, so capture them after this branch merges.
- The live smoke test (register, login, task CRUD, session expiry) has not been run yet.

## Design reference

The v2 shell and Command Center UX came from a separate TaskForge v2 prototype built on the Sites platform. The production app keeps its existing architecture: React + Vite + Chakra UI, Express + MongoDB, JWT auth, Vercel + Render. No part of the prototype's runtime was adopted.

## Production URLs

Verified 2026-10-01: both URLs return HTTP 200, the API health check returns `{"status":"ok"}`, the live client bundle calls the Render API, and the API's CORS allows the Vercel origin.

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

## Documentation

| Item             | Status                                                          |
| ---------------- | --------------------------------------------------------------- |
| README           | Rewritten for portfolio readers; updated for the v2 shell       |
| Architecture doc | Done: [architecture.md](architecture.md), with Mermaid diagrams |
| Screenshots      | **TODO.** None captured yet; see the list below                 |

### Screenshot TODO

Capture these into `docs/images/` (guidelines in [images/README.md](images/README.md)), then add them to the README:

- [ ] `landing-page.png`: `/`
- [ ] `login.png`: `/login`
- [ ] `dashboard.png`: `/home` (Command Center) with sample data (don't run `seed:demo` against production; see the warning in images/README.md)
- [ ] `settings.png`: `/settings`

## Validation status

Run on `feat/taskforge-v2-shell` on 2026-10-01 (local, before PR):

| Check                  | Result                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run format:check` | Pass                                                                                                        |
| `npm run lint`         | Pass (0 warnings)                                                                                           |
| `npm test`             | Pass: client 118/118 (14 files), server 22/22 (4 suites)                                                    |
| Time-zone independence | Client suite passes under `TZ` = UTC−12, Los Angeles, New York, UTC, Kolkata, and UTC+14                    |
| `npm run build`        | Pass (client + server)                                                                                      |
| `npm audit`            | Pass (0 vulnerabilities)                                                                                    |
| `git diff --check`     | Pass                                                                                                        |
| Browser layout check   | No horizontal overflow at 390px or 1440px on `/home`, `/work`, `/workforce`, `/settings` (Edge, mocked API) |
