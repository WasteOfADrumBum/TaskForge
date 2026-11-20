<!-- Managed by One Small Engineering (one-small-engineering/ai-standards 1.0.0). Do not edit: put project rules in .ai/project.md. ose ai sync refreshes this file only while it is unmodified. -->

# Testing and verification

## Core rules

- Never claim a check passed without running it. Report each check as passed, failed, or not run with the reason.
- Use the project's own commands (see `.ai/project.md`). Add or update tests for changed behavior; reproduce bugs with a failing test first where practical.
- Before finishing, run the relevant tests, type check, lint, format and build, plus e2e or accessibility suites for UI changes.
- Fix failures at the root cause. Never skip, weaken or delete tests to get green. Destructive scenarios use temporary fixtures only.

## Details

- Applicable checks can include unit, integration and end-to-end tests, type checking, linting, formatting, production builds, regression checks, data-integrity checks and security scans.
- If a check cannot run (missing tool, no network, CI unavailable), say so and mark the result unverified instead of guessing.
- A check that passed on a different commit, in a previous session or in another agent's report is not evidence for the current change; re-run it.
- Quote the command and the summary line of the result in the report.
