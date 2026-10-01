# Project Status

A short, living snapshot of where TaskForge is right now. For the full plan, see [roadmap.md](roadmap.md).

**Last updated:** 2026-10-01

## Checkpoint

| Item                      | Value                                                                            |
| ------------------------- | -------------------------------------------------------------------------------- |
| Current phase             | Phase 1: Stabilize TaskForge                                                     |
| Current branch            | `fix/session-expiration-handling`                                                |
| Current checkpoint        | Session-expiration handling plus project workflow docs (PR open for review)      |
| Last completed checkpoint | Enterprise UI polish (PR #3, merged to `main`)                                   |
| Next recommended          | `docs/readme-rewrite`: README, screenshots, architecture diagram, live-demo link |

## Known blockers

- None in the code. The session-expiration PR needs human review, a decision on JWT lifetime (7d vs. something shorter), and a merge.
- The production URLs are not recorded in the repo yet. Add them below to unblock "live-demo link" and "production verification".

## Production URLs

| Service         | URL                                    |
| --------------- | -------------------------------------- |
| Client (Vercel) | _TODO: add production URL_             |
| API (Render)    | _TODO: add production URL_ (`/health`) |

## Infrastructure

| Service        | Role                                    | Tier | Config                     |
| -------------- | --------------------------------------- | ---- | -------------------------- |
| Vercel         | Hosts the client SPA                    | Free | `client/vercel.json`       |
| Render         | Hosts the Express API (`taskforge-api`) | Free | `render.yaml`              |
| MongoDB Atlas  | Database (`MONGO_URI`)                  | Free | Render env var             |
| GitHub Actions | CI on push/PR to `main`                 | Free | `.github/workflows/ci.yml` |

Free-tier note: Render free services sleep when idle, so the first request after a sleep is slow (cold start). This is tracked under "demo reliability".

## Validation status

Run on `fix/session-expiration-handling` on 2026-10-01 (local, before PR; CI result pending):

| Check                  | Result                                                 |
| ---------------------- | ------------------------------------------------------ |
| `npm run format:check` | Pass                                                   |
| `npm run lint`         | Pass (0 warnings)                                      |
| `npm test`             | Pass: client 51/51 (10 files), server 22/22 (4 suites) |
| `npm run build`        | Pass (client + server)                                 |
| `npm audit`            | Pass (0 vulnerabilities)                               |
| `git diff --check`     | Pass                                                   |
