# Changelog

All notable changes to TaskForge are recorded here.

## Unreleased

### Changed

- **KAN-1 — dependency audit:** upgrade server Jest and its types to version 30 and use Node's built-in watch mode for API development. This removes the vulnerable braces dependency paths through Jest 29 and nodemon while retaining the full audit gate.

### Milestones

- **Phase 1 (Stabilize TaskForge) closed on 2026-10-02.** The production app and API are live, MongoDB Atlas (free tier) and the Render Blueprint (synced to `main`) are confirmed, CI is green, and the production smoke test passed 62/62. Demo reliability, a screenshot recapture, and a CHANGELOG backfill were moved to maintenance. See the [Phase 1 closure summary](docs/phases/phase-1-stabilize.md#closure-summary-2026-10-02).

### Added

- **Agent Registry (Phase 2 foundation).** Persistent, user-owned agent definitions. Agents don't run: there is no AI execution, model call, run, assignment, handoff, or approval yet.
  - **API:** authenticated CRUD at `/api/agents`. An agent has a name, role, description, status (active, paused, or disabled), skills, and permissions. Every query is scoped to the signed-in user; another user's agent gets the same `404` as a missing one, and `owner` can't be set from a request.
  - **Skills** are lowercase tags (for example `software-development`); input is normalized and deduplicated. **Permissions** come from a fixed catalog (`task.read`, `task.update`, `project.read`, `project.update`, `artifact.draft`). They are stored as metadata only and are not enforced yet.
  - **Workforce:** `/workforce` is now the Agent Registry (list, create, edit, delete, with empty, loading, and error states), replacing the planned-concepts placeholder. The sidebar no longer marks Workforce as Planned.
  - **Agent detail:** `/workforce/:id` shows the agent's skills, permissions, and dates. Assignments, runs, and approvals appear only as labeled "Planned" placeholders with no data.
  - **Command Center:** a Workforce panel with active, paused, and disabled counts, shown only when agents exist.
  - **Session handling:** agent requests use the same session-expiry handling as tasks and projects, and agent data is cleared on logout and on session expiry.
  - **Demo data:** the seed script now also creates two demo agents.
- **Projects (Work + Projects foundation).**
  - **API:** user-owned projects (name, description, status: active, completed, or archived) with authenticated CRUD at `/api/projects`. Every query is scoped to the signed-in user.
  - **Tasks:** a task can belong to one of its owner's projects, move between projects, or be unassigned. A foreign, missing, or malformed project reference is rejected.
  - **Deleting a project keeps its tasks:** they become unassigned first, then the project is deleted.
  - **Work:** Tasks and Projects tabs; a Projects page (`/work/projects`) to create, edit, and delete projects with open-task counts and progress; and a project detail page (`/work/projects/:id`) with its tasks, details, and activity derived from timestamps.
  - **Task form:** a Project field (Unassigned by default). Task cards link to their project, and a project can start a new task already assigned to it.
  - **Command Center:** an Active projects panel with real open-task counts and completion.
  - **Demo data:** the seed script now also creates two demo projects.
- The API now answers malformed JSON with `400 { message: 'Malformed JSON body' }`, and unexpected errors with `500 { message: 'Server error' }`, instead of Express's HTML error page. Creating a task with no request body now returns the usual `400` validation message instead of a `500`, and an update with no body is a harmless no-op.

- Session-expiration handling:
  - An authenticated API call that gets a 401 clears the session and task data, then redirects to the login page with a "session expired" message.
  - Stale requests can't sign out a newly logged-in user.
  - Protected routes check the token's expiry before rendering.
  - The login page shows an inline "session expired" message. Other login errors still appear as toasts.
- Project workflow docs: `docs/roadmap.md`, `docs/project-status.md`, and the phase plans in `docs/phases/`.
- Claude Code project support: `CLAUDE.md`, the `reviewer` and `tester` agents, and a branch task template in `.claude/`.
- Architecture documentation (`docs/architecture.md`) with Mermaid diagrams for the system, API request flow, auth, deployment, and CI.
- Verified production links (app, API, health check) in the README and `docs/project-status.md`.
- Portfolio documentation structure: `docs/images/` with a screenshot shot list, plus a screenshot TODO in the project status.
- TaskForge v2 authenticated shell:
  - Persistent sidebar (Command Center, Work, Workforce, Settings, logout) that becomes a drawer on small screens.
  - Top bar with the current section, today's date, a refresh action, and New Task.
  - Skip-to-content link.
- Command Center at `/home`. It derives everything from task data, with no AI:
  - a daily brief;
  - open, in-progress, completed, and overdue metrics;
  - today's priorities and a task summary;
  - recent task changes;
  - rule-based recommendations.
- Workforce placeholder at `/workforce`. It states that AI Workforce is planned and not yet enabled, and shows the planned concepts, each labeled "Planned".
- README screenshots: 6 real captures from production (landing, sign in, Command Center, Work, Workforce, Settings).
- `npm run typecheck` (client `tsc --noEmit`), now also run in CI.

### Changed

- Login tokens (JWTs) now last 7 days instead of 1 hour. Tokens stay in `localStorage` and logout is stateless, so a leaked token stays valid until it expires.
- README rewritten for portfolio readers: live demo, CI badge, features, stack, architecture, auth/session behavior, testing, deployment, local setup, and environment variables. Replaces the outdated idea brainstorm.
- Web app manifest now names the app "TaskForge" instead of the Create React App sample name. (The stock React PWA icons were later replaced with TaskForge icons; see below.)
- The task workspace moved from `/home` to `/work`. Create, edit, delete, status changes, search, filters, sorting, and session handling work as before. Its summary metric cards moved to the Command Center (the "Total" count is no longer shown), and Settings and Log out moved to the sidebar.
- Tasks now load once for the whole signed-in session, with a refresh button in the top bar, instead of on every visit to the task page.
- New dark "v2" visual theme with teal, orange, and violet accents. The default color mode is now dark (previously it followed the system); light and system modes are still available in Settings.
- The Figtree font is now loaded (it was already configured but never loaded). It is self-hosted from `/fonts` (SIL Open Font License), so visitors make no requests to Google Fonts. Body text now actually uses Figtree; an old `index.css` rule had limited it to headings.
- TaskForge-branded app icons (`favicon.ico`, `logo192.png`, `logo512.png`) replace the default React icons. The manifest uses the dark theme colors.
- Logos are cropped to their visible content, so the sidebar and header logos are legible, and they are smaller files: `taskforge-logo.png` went from 818 to 139 KB and `taskforge-logo-alt.png` from 410 to 48 KB.
- The saved color mode (dark by default) is applied before the app loads, so pages no longer flash white first.

### Fixed

- Task due dates are now treated as calendar dates. Previously, in time zones west of UTC (all of the US):
  - a task due today was marked overdue;
  - every due date displayed as the day before.
- The API and database are unchanged. The demo seed script now writes due dates as calendar dates (UTC midnight), like the task form, so demo dates no longer shift when seeded in the evening.
- The Command Center, the Work page's Overdue badges, and the top bar date now roll over at local midnight. Previously, a tab left open overnight kept showing yesterday's priorities until it reloaded.
- Typecheck errors on the login, register, and task forms are fixed (`chakra.form` instead of `Box as="form"`).
