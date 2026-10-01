<!--
Reusable prompt template for one TaskForge branch.
Copy it, fill in every section, and paste it into Claude Code.
Workflow: one prompt → one branch → implementation → tests → validation → review → commit/push
-->

# Goal

<!-- One sentence: what this branch delivers and why. -->

# Branch

`<type>/<short-name>` (for example `feat/agent-registry`, `fix/task-due-dates`)

Before you create the branch:

1. Inspect the repository first: `git status`, the current branch, and any stashes or uncommitted work.
2. If the working tree is clean, sync safely from `origin/main` and branch from there:
   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c <branch>
   ```
3. If the working tree is **not** clean, stop and report what is there. Never stash, reset, or discard work you did not create.

# Context

<!-- Roadmap phase and item (docs/roadmap.md), related files, and decisions already made. -->

# Requirements

<!-- Numbered, testable requirements. -->

1.

# Implementation Rules

- Read and follow `CLAUDE.md`.
- Inspect the existing code before editing. Fix and extend it; do not rebuild it.
- One feature or fix per branch. Park unrelated findings in the final report.
- Never destroy unrelated user work: no reset, force-push, branch deletion, or `git clean`.
- Keep the $0-extra-cost rule. Add no paid services or providers without explicit approval.
- Keep every task query scoped by `owner`.

# Tests

- Add or update tests for every behavior change: the happy path, the failure path, and any auth or ownership edge cases.
- Put tests next to the code (`*.test.ts(x)`).

# Validation

Run all of these and fix any failure this branch caused:

```bash
npm run format:check
npm run lint
npm test
npm run build
npm audit
git diff --check
```

Report failures that already existed before this branch. Do not hide them, and do not fix them on this branch unless asked.

Optional: run the `tester` and `reviewer` agents (`.claude/agents/`) before the final report.

# Documentation Updates

- `docs/roadmap.md`: update item status. Mark an item COMPLETE only after it is implemented **and** validated.
- `docs/project-status.md`: update the current and last checkpoint, the validation status, and the date.
- `CHANGELOG.md`: add an entry for any notable behavior change.
- `CLAUDE.md`: update it only when commands, architecture, or conventions change.
- Never let docs claim a feature exists when it is only planned.

# Stop Conditions

- Stop before committing or pushing unless this prompt explicitly allows it.
- Never merge, force-push, or reset.
- Stop and ask if finishing would mean guessing about user intent, a destructive change, or a new cost.

# Final Report

Keep it short:

1. Branch
2. Files changed
3. Behavior implemented
4. Tests (added or updated, with pass counts)
5. Validation (each command: pass/fail)
6. Documentation updated
7. Known issues
8. Ready for human review: yes / no
