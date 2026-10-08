# Changelog

All notable changes to TaskForge are recorded here.

## Unreleased

- Formally close Phase2 after owner acceptance; preserve QA/review/CI/deployment evidence and
  document free-tier/local-AI limits. Phases3–8 remain unapproved; no application behavior change.

- KAN-26: explicit Developer workflow drafts a bounded technical plan, optional code text,
  proposed checks and limitations for human review. Code is never executed or applied;
  repository access and task changes stay disabled. Three-starter handoff acceptance added.

- KAN-25: explicit supplied-source research drafts cite captured verbatim text and separate
  interpretations/inferences/limitations. Optional reference URLs are never fetched; existing
  permission, simulation/local mode and exact human-review controls remain.

- Add explicit Chief of Staff triage proposals with bounded owned context, strict structured output and human review without automatic task changes (KAN-23; shipped in PR #34).

- Document usage-efficient delivery: targeted implementation checks, stable final validation/review, concise Jira checkpoints and usage budgeting without weakening release gates (KAN-43).

- Add explicit approved-parent queued handoffs with bounded owned lineage, idempotent retries, target permissions and independent child execution/review (KAN-22; shipped in PR #32).

- Add owned run activity and detail views with explicit creation/execution, context and audit display, and human review using the existing permission and session safeguards (KAN-21; shipped in PR #31).

### Documentation

- **KAN-14 — release evidence:** reconcile shipped assignment and readiness status, publish a concise Jira-to-deployment walkthrough, and refresh the application gallery with explicitly synthetic local capture provenance. AI execution, providers, runs, enforced agent permissions, audit and approvals remain planned; no runtime behavior or production data changes.

### Changed

- **KAN-20 — minimal context:** snapshot permitted task/project title/name/notes with source IDs/update times and a 16KiB serialized bound in the audited run claim. Explicit project context requires saved permission before reads and at each use boundary; complete source-set changes fail closed. Snapshot/digest stay immutable, context is serialized untrusted user data, and audit contains metadata rather than notes. No RAG, ingestion, task/project writes or paid service.

- **KAN-19 — human draft review:** add owner review of exact draft version/result digest with optional bounded note, atomic decision/audit and stale/replay rejection. Agent Detail displays pending input/output, simulation labels and keyboard-accessible approval/rejection controls, with session isolation and refresh required after uncertain decisions. Approval records acceptance only; no task/project content is applied. Delivery validation is in progress.

- **KAN-18 — draft permissions and audit:** require persisted owned assignment/active-agent/read-and-draft capabilities for explicitly selected simulation or local-only inference. Audit lifecycle transitions atomically, retain immutable safe denial records, fail closed before inference, fence cancellation/late output and expose owned audit reads. Output awaits human approval; no task writes, paid service, cloud fallback or production local inference. Run controls and approval UI remain later tickets.

- **KAN-17 — owned run foundation:** persist owner/task/agent/input/context/result/status with idempotent creation, an acknowledged unique retry-key index, atomic version/attempt/deadline fencing and explicit expiry failure. Add authenticated no-store queued create/read APIs; execution stays blocked until permission/audit safeguards. No worker, provider call, automatic replay, task writes or approval endpoint.

- **KAN-16 — local inference:** add the server-only Ollama adapter for explicitly configured local development, with numeric loopback destinations, cloud/remote model preflight rejection, bounded JSON bodies/deadlines/cancellation and strict normal-completion/runtime-schema validation. Production always stays disabled. Add an explicit local-only synthetic smoke command; no paid provider, download inside the application, execution endpoint or user run controls.

- **KAN-15 — provider boundary:** add a server-only AIProvider contract with disabled-by-default execution, explicitly selected labelled canned simulation, runtime structured-output validation, bounded cancellation/deadlines and unsupported embeddings errors. Authenticated read-only capability status exposes no model credentials or prompts. Local inference and user run/approval controls remain later Phase 2 tickets; no model calls, paid service or production data writes.

- **KAN-13 — reproducible critical verification:** add separate isolated real MongoDB/API tests and browser smoke for persistence, assignment, owner isolation, session expiry and mobile navigation. Required CI runs both after fast unit checks. Test runners create only fresh loopback databases, refuse pre-existing data and verify API listener ownership before browser traffic. Keep the full audit gate with a scoped shell-quote patch for the existing build tool.

- **KAN-12 — Settings and accessibility:** replace inert Settings navigation with clearly planned account/deletion information. Expose selected theme state on keyboard-accessible buttons using existing device persistence. Give public pages one primary heading and logical section headings; place the unchanged hero logo on a light token surface for legibility.

- **KAN-10 — cold-start recovery:** show polite waiting feedback after eight seconds, with cancel/manual retry for workspace reads and sign-in, plus read recovery status. Retire cancelled, replaced and unmounted requests; bound connection and body parsing to one 90-second deadline. Send writes once and show honest uncertainty without a mutation Retry control. Patch source-map-js and scope a compatible YAML loader override to remove newly reported vulnerable test-tool dependencies; retain the full audit gate.

- **KAN-9 — local logout reliability:** clear the token and all user resources immediately, even offline, without waiting for a stateless server acknowledgement. Discard old authenticated network failures and response bodies after logout or a new login; retain current-session error handling and JWT behavior. A client session counter also rejects old work when re-login reuses the same JWT.

- **KAN-8 — task input validation:** reject malformed IDs as 404 and invalid field types, enum values, oversized text and calendar dates as 400 before database work. Limit titles/descriptions to 120/2000 characters with matching form bounds; preserve null date clearing and assignment/ownership behavior. Validate model dates before casting and preserve calendar years 1–99 in client arithmetic.

- **KAN-7 — authentication abuse protection:** add separate login/registration account quotas and process capacity limits with clear 429 retry feedback. Keep proxy trust disabled and ignore forwarded headers in limit keys. Storage is process-local, resets on restart, and can temporarily block an account or shared capacity under attack; no paid store or hosting change.

- **KAN-6 — authentication input validation:** reject malformed credentials and query objects before database or bcrypt work, normalize email, and handle duplicate registration races as 409. New passwords require 15 Unicode characters and at most 72 UTF-8 bytes; existing account login stays compatible. Registration shows limits and focuses inline errors without changing the page layout.

- **KAN-4 — delivery gates:** protect main with PRs, current GitHub Actions quality checks, resolved review conversations, and administrator enforcement; block force pushes and branch deletion. Document independent review and approved autonomous merge boundaries.

- **KAN-1 — dependency audit:** upgrade server Jest and its types to version 30 and use Node's built-in watch mode for API development. This removes the vulnerable braces dependency paths through Jest 29 and nodemon while retaining the full audit gate.

### Milestones

- **Phase 1 (Stabilize TaskForge) closed on 2026-10-02.** The production app and API are live, MongoDB Atlas (free tier) and the Render Blueprint (synced to `main`) are confirmed, CI is green, and the production smoke test passed 62/62. Demo reliability, a screenshot recapture, and a CHANGELOG backfill were moved to maintenance. See the [Phase 1 closure summary](docs/phases/phase-1-stabilize.md#closure-summary-2026-10-02).

### Added

- **KAN-11 — release readiness:** separate bounded database readiness and build-derived API release identity from the existing liveness check. Client builds publish their commit and public API target in `release.json`. Document read-only deployment verification, preview boundaries, and free-tier idle/backup recovery; no production data operations or hosting changes.

- **KAN-2 — Task → Agent Assignment (Phase 2 foundation).** A task can be assigned to you, to one of your agents, or to nobody. An assignment only records who owns the task: agents still don't run, and no agent run is created.
  - **API:** tasks gain `assigneeType` (`user`, `agent`, or `null`) and `assigneeAgent`. You can assign only to yourself or your own agents; another user's agent gets the same `400 Agent not found` as a missing one, and malformed values are rejected. Leaving both fields out of an update keeps the current assignee.
  - **Agent status:** only active agents can take a new task. A paused or disabled agent keeps the tasks it already has, and they show its status.
  - **Deleting an agent keeps its tasks:** they become unassigned first, then the agent is deleted. The delete dialog shows a known count or safe unknown-count wording while tasks load or fail.
  - **Work:** an Assignee field on the task form (Unassigned, Me, or an active agent), the assignee on every task card (linked to the agent), and an assignee filter. Editing other fields preserves assignment input, even while agents are loading or failed to load; the server reconciles and clears a deleted-agent reference on every task write.
  - **Workforce:** each agent card shows its assigned and open task counts after a successful task load, and the agent detail page lists its assigned tasks (status, priority, project, due date) in place of the "Planned" Assignments placeholder, with an "Assign a new task" shortcut for active agents.
  - **Command Center:** the Workforce panel adds agents with open tasks, open tasks on agents, open tasks on you, and unassigned open tasks. These are fixed counts from task data, not AI.
  - **Demo data:** the seed script assigns demo tasks to the demo user and to both demo agents.

- **KAN-5 — project workflow:** restore Codex project guidance and the Jira-to-deployment branch template; correct current architecture, session, CI, and destructive seed documentation without presenting local assignment as shipped.

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
