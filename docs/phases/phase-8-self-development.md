# Phase 8: TaskForge Builds TaskForge

**Status: PLANNED**

## Objective

A TaskForge Engineer Agent that turns TaskForge tasks into issues, branches, tested code changes, and pull requests, always behind a human approval gate.

## Why it matters

It is the end goal of the orchestration platform: the system helps build itself, using the same one-prompt → one-branch workflow defined in `.claude/templates/branch-task.md`.

## Scope

The Engineer Agent, repository access, issue creation, branch creation, code changes, tests, PR creation, the human approval gate, and the audit trail.

## Planned capabilities

- TaskForge Engineer Agent
- Scoped repository access
- Issue creation
- Branch creation
- Code changes
- Tests
- PR creation
- Human approval gate
- Audit trail

## Guardrails (non-negotiable)

- **No unrestricted production access.** The agent works through branches and PRs only.
- **No automatic merging to `main`.** A human reviews and merges every PR.
- Use least-privilege tokens, and log every action to the audit trail.

## Dependencies

- Phase 2 (agents, approvals, audit, permissions)
- Phase 3 (knowledge of the codebase)
- The GitHub API

## Definition of done

The agent can take a task and open a PR with a passing CI run. A human must approve before merging. Every step is audited.

## Portfolio/career value

Shows agentic software engineering with real safety controls, a strong senior and tech-lead talking point.

## Cost constraints

$0 by default. Use the GitHub API and Actions free tiers. Model calls go through `AIProvider`, and any paid provider is opt-in.

## Notes/decisions

- The reviewer and tester agents in `.claude/agents/` are early prototypes of this workflow.
