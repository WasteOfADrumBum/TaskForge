# AGENTS.md

This file guides Codex (Codex.ai/code) when working in this repository.

## Project

TaskForge is a full-stack task manager built as a public portfolio app. It is an npm workspaces monorepo:

- `client/`: React 19 + TypeScript + Vite, Chakra UI v3, Redux Toolkit, React Router v7. Deployed to **Vercel**.
- `server/`: Express 5 + TypeScript (ESM), Mongoose/MongoDB, JWT auth with bcrypt. Deployed to **Render** (`render.yaml`, free plan, health check at `/health`).

TaskForge is growing into a personal AI orchestration platform. `README.md` is the public, portfolio-facing overview; `docs/architecture.md` describes the system and deployment. Check `docs/roadmap.md` for what actually exists before describing a feature.

## Commands

Run these from the repo root. Node >= 24 and npm >= 11 are required (`.nvmrc`).

```bash
npm run dev            # client (Vite :5173) + server (Node watch :5000) together
npm run build          # client vite build + server tsc --noEmit && tsup
npm test               # client (Vitest) then server (Jest)
npm run lint           # ESLint for both workspaces (root eslint.config.mjs)
npm run typecheck      # client tsc --noEmit (the server typechecks in its build)
npm run format:check   # Prettier check (CI fails on this)
npm run format         # Prettier write
```

Single workspace / single test:

```bash
npm --workspace client run test -- src/api/tasks.test.ts     # Vitest, one file
npm --workspace client run test:watch
npm --workspace server run test -- src/routes/taskRoutes      # Jest, path pattern
npm --workspace server run test -- -t "lists tasks"          # Jest, by test name
npm --workspace server run seed:demo                         # resets demo password/tasks/projects/agents; development database only
```

CI (`.github/workflows/ci.yml`, on push/PR to `main`) runs, in order: `npm ci` → `format:check` → `lint` → `typecheck` → `test` → `build` → `npm audit`. Run the same checks locally before pushing.

## Environment

- `server/.env` (see `.env.example`): `MONGO_URI`, `JWT_SECRET` (both required, server exits without them), `PORT`, `CLIENT_ORIGIN` (comma-separated CORS allowlist), `DEMO_EMAIL`, `DEMO_PASSWORD`.
- `client/.env` (see `.env.example`): `VITE_API_URL` (defaults to `http://localhost:5000`), `VITE_LINKEDIN_URL`.
- Server tests set `JWT_SECRET=test-jwt-secret` in `server/jest.setup.ts`. Test tokens must be signed with that value.

## Server architecture

The request flow is `routes → controllers → services → models`:

- `src/app.ts` builds the Express app (CORS, JSON, `/health`, `/api/auth`, `/api/tasks`, `/api/projects`, `/api/agents`). It does not connect to Mongo, so tests import it directly with supertest.
- `src/server.ts` is the entry point: it checks env vars, connects Mongoose, listens on `0.0.0.0`, and handles graceful shutdown.
- **Controllers** validate input and map results to HTTP status codes. Errors return `{ message }`, and unexpected errors return a generic `500 Server error`.
- **Services** are thin Mongoose wrappers. Every task, project, and agent query is scoped by `owner`. Keep that scoping on new resource queries and validate referenced resource ownership.
- `middleware/auth` (`requireAuth`) checks the `Authorization: Bearer <jwt>` header and sets `req.userId` (typed in `src/types/express.d.ts`). All `/api/tasks`, `/api/projects`, and `/api/agents` routes use it.
- JWTs are signed as `{ id }` and expire in `7d`. Logout is stateless: the server does nothing and the client drops the token.
- Task enums live in `models/taskModel` (`TASK_STATUSES`, `TASK_PRIORITIES`). Controllers validate against them.
- Route tests mock the service layer with `jest.mock('../../services/...')`. They do not use a real database.
- Use `requireEnv(name)` from `config/env.ts` to read required env vars at call time.
- The `index.ts` barrels in `controllers/`, `services/`, `routes/`, and `utils/` are empty. Import from the specific module folder.

## Client architecture

- `App.tsx` exports `AppRoutes` and lazy-loads pages from `src/pages/<Name>/index.tsx`.
  - Public: `/` (landing), `/login`, `/register`.
  - Authenticated, behind `ProtectedRoute` inside `components/layout/AppShell`: `/home` (`CommandCenterPage`), `/work` (`WorkPage`, the task workspace), `/work/projects`, `/work/projects/:id`, `/workforce` (Agent Registry definitions only), `/workforce/:id`, and `/settings`. AI execution is not built.
- `AppShell` owns the sidebar (`Sidebar`; a drawer below `lg`), `TopBar`, and task/project/agent loading (`hooks/useTaskLoader`, `useProjectLoader`, `useAgentLoader`). List pages read resources from Redux; detail pages may load their requested resource.
- Command Center insights are pure functions in `utils/commandCenter.ts`. They are rule-based; never present them as AI.
- Theme: `assets/theme/theme.ts` overrides Chakra's dark semantic tokens (`bg.*`, `fg.*`, `border.*`) with the v2 palette and adds `accent.{teal,orange,violet}` and `shell.*`. Use these tokens, not hex values. Dark is the default color mode.
- Tests: `src/test/renderApp.tsx` renders `AppRoutes` with in-memory task, project, and agent API stubs. jsdom applies only base (mobile) styles, so shell tests navigate through the drawer.
- Redux store (`redux/store.ts`, `rootreducer.ts`) has four slices:
  - `authSlice`: `token` (seeded from `localStorage.token`), `loading`, `error`.
  - `taskSlice`: `items`, `loading`, `error`.
  - `projectSlice` and `agentSlice`: `items`, `loading`, `error`, `loaded`.
  - All resource slices reset on `clearAuth` and `sessionExpired`.
- Use the typed hooks `useAppDispatch` / `useAppSelector` from `redux/hooks/typedHooks.ts`.
- The API layer is in `src/api/`. It uses plain `fetch` with no axios. Functions take the token explicitly and throw `Error(message)` with the server's `message`. Task, project, and agent calls go through `authenticatedFetch`, which also reads the global `store`. Component tests that call authenticated resource APIs must use that store, not a separate `configureStore`.
- **Session expiration:**
  - Authenticated calls go through `api/authenticatedFetch.ts`.
  - On a 401 it calls `expireSession` (`utils/session.ts`), which clears `localStorage` and dispatches `sessionExpired`. It then throws `SessionExpiredError`.
  - It also throws if the token changed mid-request. A stale request must never sign out a newly logged-in user.
  - Callers should ignore `SessionExpiredError` and not show it as a normal error (see `WorkPage` and `hooks/useTaskLoader.ts`).
  - `ProtectedRoute` also checks the JWT `exp` client-side (UI-only) with `isTokenExpired`.
- Tasks may come back with `_id` or `id`. Always use `getTaskId(task)` from `types/task.ts`.
- **Due dates are calendar dates.** The API returns them as UTC midnight (`YYYY-MM-DDT00:00:00.000Z`). Never pass a `dueDate` to `new Date()` to compare or display it, because that shifts the day west of UTC. Use `utils/dates.ts` (`toCalendarDate`, `daysUntilDueDate`, `formatCalendarDate`). In tests, build due dates in that API shape and keep them independent of the time zone.
- Filtering, sorting, and summary logic lives in `utils/tasks.ts` as pure, tested functions. Keep that logic out of components.
- UI is Chakra UI v3. `components/ui/*` are Chakra CLI snippets (provider, toaster, color-mode, tooltip). Show user feedback with `toaster`.
- `client/src/types/task.ts` duplicates the server task types by hand. Update both sides when the task shape changes.
- `client/vercel.json` rewrites every path to `index.html` for SPA routing.

## Conventions

- Prettier: single quotes, semicolons, trailing commas, 100 columns, LF line endings.
- ESLint: `no-console` warns in the client and is off in the server. Prefix unused args with `_`.
- Tests sit next to the code they cover (`*.test.ts(x)`). The client uses Vitest + Testing Library (jsdom, `src/setupTests.ts`). The server uses Jest with ts-jest ESM.
- The server is ESM with extensionless relative imports. This works because `ts-node/esm` handles dev and `tsup` bundles the build.

## Project workflow

Work in this pattern: Jira ticket → branch → implementation → tests/QA → independent review → PR → required CI → merge → deployment verification → Done. See [delivery policy](docs/delivery.md) for approved autonomous authority and approval boundaries.

- `docs/roadmap.md` is the roadmap source of truth. `docs/project-status.md` tracks the current checkpoint. Phase details live in `docs/phases/`.
- Every feature or fix branch updates the roadmap and status docs when they are affected.
- Mark a roadmap item COMPLETE only after it is implemented **and** validated.
- Docs must never claim a feature exists when it is only planned.
- Add an entry to `CHANGELOG.md` under `Unreleased` for every notable behavior change.
- For substantial branches, start from `.codex/templates/branch-task.md`. It holds the full validation list, stop conditions, and report format.
- The `reviewer` and `tester` agents (`.codex/agents/*.toml`) are available for branch review.
- **$0 extra cost:** add no recurring infrastructure or API cost without explicit approval. Stay on free tiers. All AI goes through a provider abstraction, never a single hard-wired paid provider (see `docs/phases/phase-2-ai-workforce.md`).
