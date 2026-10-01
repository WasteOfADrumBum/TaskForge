# Changelog

All notable changes to TaskForge are recorded here.

## Unreleased

### Added

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

### Changed

- Login tokens (JWTs) now last 7 days instead of 1 hour. Tokens stay in `localStorage` and logout is stateless, so a leaked token stays valid until it expires.
- README rewritten for portfolio readers: live demo, CI badge, features, stack, architecture, auth/session behavior, testing, deployment, local setup, and environment variables. Replaces the outdated idea brainstorm.
- Web app manifest now names the app "TaskForge" instead of the Create React App sample name. (The PWA icons `logo192.png`/`logo512.png` are still the stock React logo; tracked as a follow-up.)
- The task workspace moved from `/home` to `/work`. Create, edit, delete, status changes, search, filters, sorting, and session handling work as before. Its summary metric cards moved to the Command Center (the "Total" count is no longer shown), and Settings and Log out moved to the sidebar.
- Tasks now load once for the whole signed-in session, with a refresh button in the top bar, instead of on every visit to the task page.
- New dark "v2" visual theme with teal, orange, and violet accents. The default color mode is now dark (previously it followed the system); light and system modes are still available in Settings.
- The Figtree font is now loaded (it was already configured but never loaded).
