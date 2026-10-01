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

### Changed

- Login tokens (JWTs) now last 7 days instead of 1 hour. Tokens stay in `localStorage` and logout is stateless, so a leaked token stays valid until it expires.
- README rewritten for portfolio readers: live demo, CI badge, features, stack, architecture, auth/session behavior, testing, deployment, local setup, and environment variables. Replaces the outdated idea brainstorm.
- Web app manifest now names the app "TaskForge" instead of the Create React App sample name. (The PWA icons `logo192.png`/`logo512.png` are still the stock React logo; tracked as a follow-up.)
