# Phase 1: Stabilize TaskForge

**Status: COMPLETE** (closed 2026-10-02). Item-level status lives in [roadmap.md](../roadmap.md#phase-1-stabilize-taskforge-details).

## Closure summary (2026-10-02)

Every check below was done on production or on `main` before closing. Checks marked **(owner)** were confirmed by the project owner in a dashboard. The rest were checked directly against production, CI, or the repo.

- **Production app live:** https://taskforge-alpha-six.vercel.app is served by Vercel, and the PR #7 assets on it match `main`.
- **Production API live:** https://taskforge-api-rp2m.onrender.com, with `/health` returning `{"status":"ok"}`.
- **Database (owner):** MongoDB Atlas `Cluster0`, database `taskforge`, Free tier, AWS `us-east-1`, with production connectivity working.
- **Render (owner):** the Blueprint is synced to `main`. The TaskForge Blueprint is connected to `WasteOfADrumBum/TaskForge`, the latest sync succeeded, and `taskforge-api` follows `main`.
- **Vercel production deployment:** working. The PR #7 assets (favicon, logos, self-hosted font, pre-paint theme script) are served live.
- **CI:** green on `main` (PR #7 merge, `84c506d`).
- **Cold start:** the API recovers from a free-tier cold start through the auth and database path. After 20 minutes idle on 2026-10-02, a failed-login probe with a non-existent email took 32.9 s (a cold start) and returned the correct `401 Invalid credentials`, which requires a successful Atlas lookup. The next request took 0.43 s.
- **Production smoke test passed:** 62/62 automated checks on 2026-10-01. Details are in [project-status.md](../project-status.md#production-verification-2026-10-01).
- **Session handling verified live:** logout, a server-rejected token, and an expired token each behave correctly.
- **Responsive verification complete:** no horizontal overflow at 390, 768, or 1440px, and the mobile drawer's focus and Escape handling work.
- **Screenshots captured:** 6 real production captures in the README.
- **Quality gates clean:** format, lint, typecheck, test, build, and `npm audit` (0 vulnerabilities).
- **Production data hygiene (owner):** the smoke-test accounts were removed from Atlas, and the users collection holds only the intended real accounts.

### Deferred maintenance (does not block Phase 1)

These three Phase 1 items were moved to maintenance at closure:

- **Demo reliability:** show a clear "waking up the server" state during Render cold starts, and keep the demo account seeded.
- **Screenshot recapture:** the current README screenshots are accurate except for the older, smaller logos from before PR #7.
- **CHANGELOG backfill:** work before PR #4, built from git history.

These are known minor polish issues from PR #7. They were never Phase 1 items:

- **Greeting refresh:** the Command Center greeting only updates when the day changes.
- **Hero logo contrast:** the dark "Task" wordmark is hard to read on the dark background.

All five are tracked in the [roadmap](../roadmap.md#phase-1-maintenance-deferred-does-not-block-phase-1).

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
- Production visual polish (PR #7):
  - TaskForge icons and favicon;
  - logos cropped to their content (hero 818 → 139 KB, alt logo 410 → 48 KB);
  - self-hosted Figtree, now used for body text;
  - no white flash before the dark theme;
  - midnight rollover of the Command Center, the Work page Overdue badges, and the top bar date;
  - client typecheck clean and in CI.
- Infrastructure verified: MongoDB Atlas, the Render Blueprint, and a cold-start recovery. See the closure summary above.

## Dependencies

- MongoDB Atlas free cluster, Render free web service, Vercel free project, GitHub Actions
- Production URLs are recorded in [project-status.md](../project-status.md).

## Definition of done

Amended at closure (2026-10-02). See the closure decision under [Notes/decisions](#notesdecisions).

- [x] Every Phase 1 roadmap item is COMPLETE. Items explicitly deferred to the maintenance list at closure are excluded.
- [x] CI is green on `main`.
- [x] The live client and API are reachable, and the login path works after a cold start. This was verified with a failed-login probe against a cold API, so no account was needed. Logging in with the demo account itself was not tested.
- [x] The README describes only real features and includes screenshots, an architecture diagram, and a live link.
- [x] `docs/project-status.md` has the real production URLs.

## Portfolio/career value

Shows end-to-end ownership: auth and security boundaries, testing, CI/CD, cloud deployment, and production polish. This is the baseline a senior full-stack reviewer expects to see.

## Cost constraints

$0. Every service stays on its free tier. Accept free-tier limits such as cold starts and design around them instead of upgrading.

## Notes/decisions

- **Closure decision (2026-10-02, project owner):** Phase 1 closes with three items moved to maintenance: demo reliability, screenshot recapture, and the CHANGELOG backfill. None of them affects whether the app is live, correct, or secure.
  - The original criterion "the demo login works after a cold start" became "the login path works after a cold start". It was verified with a failed-login probe, so no account had to be created on the cleaned production database.
  - The demo-account experience during a cold start is the "demo reliability" maintenance item.

- JWTs are stored in `localStorage` and logout is stateless. This is acceptable for portfolio scope; revisit if refresh tokens are added.
- The session-expiry check on the client is UI-only. The server stays the authority on signature and expiry.
- Task types are written separately on the client and the server. Update both sides when the task shape changes.
- The v2 shell's UX came from a separate TaskForge v2 prototype built on the Sites platform. Only the visual and product ideas were ported. The production app keeps its React/Vite/Chakra client, Express/MongoDB API, JWT auth, and Vercel/Render hosting.
- Due dates are calendar dates. The form sends `YYYY-MM-DD`, MongoDB stores it as UTC midnight, and the client reads the UTC date part through `client/src/utils/dates.ts`. That code used to parse it as a local timestamp, so west of UTC a task due today showed as overdue and displayed the previous day. Fixed in PR #6; the API and database are unchanged.
