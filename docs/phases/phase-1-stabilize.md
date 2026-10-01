# Phase 1: Stabilize TaskForge

**Status: IN PROGRESS.** Item-level status lives in [roadmap.md](../roadmap.md#phase-1-stabilize-taskforge).

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
- Render (`render.yaml`) and Vercel (`vercel.json`) deployment config

### In progress

- **Session-expiration handling** (`fix/session-expiration-handling`):
  - `authenticatedFetch` catches a 401 from the API.
  - It clears the token and task state, then redirects to `/login` with a "session expired" message.
  - A stale request never signs out a newly logged-in user.
  - `ProtectedRoute` also checks the JWT `exp` claim client-side.
  - The JWT lifetime goes from 1h to 7d, so demo users are not signed out mid-session.
- **Production config confirmation:** record the Atlas cluster, the Vercel `VITE_API_URL`, and the Render `CLIENT_ORIGIN`.

### Remaining

- Demo reliability: handle Render cold starts gracefully, keep the demo account seeded, and show a clear loading state
- README rewrite, screenshots, architecture diagram, live-demo link
- Production verification: a smoke test against the live URLs (register, login, task CRUD, expiry)
- Documentation cleanup: backfill CHANGELOG and remove stale docs

## Dependencies

- MongoDB Atlas free cluster, Render free web service, Vercel free project, GitHub Actions
- The production URLs must be recorded before the live-demo and production-verification items can be done.

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
