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

### Changed

- Login tokens (JWTs) now last 7 days instead of 1 hour. Tokens stay in `localStorage` and logout is stateless, so a leaked token stays valid until it expires.
