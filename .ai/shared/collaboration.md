<!-- Managed by One Small Engineering (one-small-engineering/ai-standards 1.0.0). Do not edit: put project rules in .ai/project.md. ose ai sync refreshes this file only while it is unmodified. -->

# Multi-agent collaboration and handoffs

## Core rules

- Roles: Architect (assess, design, plan), Developer (build), QA (test, accessibility, regression), Reviewer (review, security, acceptance).
- Parallel agents only on independent work, never on the same files; use worktrees or branches where supported, otherwise run the roles in sequence with the same checks.
- No agent approves its own work. Hand off with done, remaining, branch and commit, checks and results, blockers and the next step; follow the project's continuity contract if it has one.

## Details

- The Architect's plan names files and owners per role before parallel work starts.
- Merge parallel results one at a time, re-running checks after each.
- A previous agent's notes are claims to check against the repository, not verified facts.
