# Project rules: TaskForge

This file belongs to this repository. `ose ai sync` creates it once and never overwrites it. The shared policies in `.ai/shared/` apply unless a rule here refines them. Edit freely; run `ose ai sync` afterwards so the ChatGPT instructions pick up the change.

## Existing project instructions

- `CLAUDE.md`: project text outside the managed blocks. It stays authoritative for this project; read it.
- `AGENTS.md`: project text outside the managed blocks. It stays authoritative for this project; read it.

## Stack

Detected at install from package metadata; check and correct it.

- Node.js with npm
- Jest
- Playwright
- TypeScript
- npm workspaces (monorepo)

## Commands

Detected at install from package scripts; these are the checks to run before reporting a change as done.

- `npm test`: tests
- `npm run lint`: lint
- `npm run typecheck`: type check
- `npm run build`: production build
- `npm run format:check`: formatting
- `npm run test:e2e`: end-to-end tests

## Project-specific rules

- Add rules that apply only to this project here, for example "use the existing component system; do not add a second UI framework".
