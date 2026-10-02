# Phase 1: Stabilize TaskForge

**Status: IN PROGRESS.** Item-level status lives in [roadmap.md](../roadmap.md#phase-1-stabilize-taskforge-details).

## Objective

Make TaskForge a polished, reliable, publicly deployed full-stack app that stays up and demos well, even when nobody touches it for months.

## Why it matters

Every later phase (agents, knowledge, command center) builds on this base of auth, data ownership, CI, and deployment. A shaky foundation makes AI features risky and hard to trust.

## Scope

**In scope:** tooling, testing, CI, auth, task CRUD, task UI, deployment, demo experience, session handling, and public-facing docs.

**Out of scope:** projects, teams, roles, comments, and anything AI. Those belong to Phase 2 and later.

## Capabilities

### Done

- npm workspaces monorepo (`client/`, `server/`) with ESLint 9, Prettier, and TypeScript 5.9
- Client tests in Vitest + Testing Library; server tests in Jest + supertest (service layer mocked)
- GitHub Actions CI: format, lint, test, build, audit
- MongoDB/Mongoose users and tasks; bcrypt passwords; JWTs; `requireAuth` middleware
- Task CRUD API with every query scoped by `owner`
- Task workspace UI with filtering, search, sorting, and summary stats
- Enterprise UI polish, landing page, polished login and register pages
- Lazy-loaded routes and client bundle splitting
- Demo seed script (`seed:demo`)
- Render (`render.yaml`) and Vercel (`client/vercel.json`) deployment config, with production env config verified live
- Session-expiration handling (PR #4): a 401 clears the session and returns to `/login` with a message; stale requests never sign out a newer session; the JWT lifetime is 7d
- Portfolio README, [architecture doc](../architecture.md), and verified live-demo link
- TaskForge v2 authenticated shell (PR #6):
  - persistent sidebar and drawer, top bar, Command Center at `/home`, task workspace at `/work`, Workforce placeholder, and the dark v2 theme;
  - due dates treated as calendar dates.
- Production verification (2026-10-01): 62/62 live checks. Details are in [project-status.md](../project-status.md#production-verification-2026-10-01).
- Screenshots: 6 real production captures in `docs/images/`, shown in the README.

### In progress

- **Production visual polish** (`chore/v2-production-verification`, waiting for merge):
  - TaskForge app icons and favicon replace the React defaults.
  - Logos are cropped to their content; the hero is 818 → 139 KB and the alt logo 410 → 48 KB.
  - Figtree is self-hosted, and body text now uses it (it was limited to headings before).
  - The theme is applied before first paint, so there's no white flash.
  - The Command Center, Work page Overdue badges, and top bar date roll over at midnight.
  - The client typecheck is clean and now runs in CI.
- **MongoDB Atlas:** confirm the cluster and free tier in the Atlas dashboard.
- **Render Blueprint:** confirm the live service is synced to `render.yaml` in the Render dashboard.
- **Documentation cleanup:** backfill CHANGELOG entries for work before PR #4.

### Remaining

- Demo reliability: handle Render cold starts gracefully, keep the demo account seeded, and show a clear loading state

## Dependencies

- MongoDB Atlas free cluster, Render free web service, Vercel free project, GitHub Actions
- Production URLs are recorded in [project-status.md](../project-status.md).

## Definition of done

- [ ] Every Phase 1 roadmap item is COMPLETE.
- [ ] CI is green on `main`.
- [ ] The live client and API are reachable, and the demo login works after a cold start.
- [ ] The README describes only real features and includes screenshots, an architecture diagram, and a live link.
- [ ] `docs/project-status.md` has the real production URLs.

## Portfolio/career value

Shows end-to-end ownership: auth and security boundaries, testing, CI/CD, cloud deployment, and production polish. This is the baseline a senior full-stack reviewer expects to see.

## Cost constraints

$0. Every service stays on its free tier. Accept free-tier limits such as cold starts and design around them instead of upgrading.

## Notes/decisions

- JWTs are stored in `localStorage` and logout is stateless. This is acceptable for portfolio scope; revisit if refresh tokens are added.
- The session-expiry check on the client is UI-only. The server stays the authority on signature and expiry.
- Task types are written separately on the client and the server. Update both sides when the task shape changes.
- The v2 shell's UX came from a separate TaskForge v2 prototype built on the Sites platform. Only the visual and product ideas were ported. The production app keeps its React/Vite/Chakra client, Express/MongoDB API, JWT auth, and Vercel/Render hosting.
- Due dates are calendar dates. The form sends `YYYY-MM-DD`, MongoDB stores it as UTC midnight, and the client reads the UTC date part through `client/src/utils/dates.ts`. That code used to parse it as a local timestamp, so west of UTC a task due today showed as overdue and displayed the previous day. Fixed in PR #6; the API and database are unchanged.
