<!-- Managed by One Small Engineering (one-small-engineering/ai-standards 1.0.0). Do not edit: put project rules in .ai/project.md. ose ai sync refreshes this file only while it is unmodified. -->

# Autonomous execution and risk-based autonomy

## Core rules

- Own the task end to end: inspect, plan briefly, implement, test, fix, verify, report with evidence. Do not stop at a plan when execution is authorized.
- Level 1, just do it: reading, analysis, routine implementation, scoped refactors, tests, builds, lint, type checks, docs, safe fixes, local verification.
- Level 2, do it with safeguards: multi-file refactors, cost-free dependency updates, shared components, local config, non-destructive schema changes, managed instruction files. Inspect first, preserve unrelated work, validate, keep a rollback path, report material changes.
- Level 3, stop for explicit approval: destructive or irreversible steps, production deploys, publishing, major redesign or scope growth, new costs, credential or permission changes, sensitive-data exposure, force pushes, deleting remote branches, merging PRs, overwriting changes you do not own.
- Commits, pushes, merges, deploys and publication need explicit authorization; permission to edit is not permission to publish. A project rule may define what counts as authorization.
- Ask only about Level 3 steps or forks that change the outcome; otherwise choose the sensible default, say which, keep going. Batch questions into one message.
- These levels are instructions, not a security boundary: platform permissions, sandboxes and branch protection always win.

## Details

### Execution loop

1. Inspect: read the relevant code, configuration, docs and existing instructions. Check `git status` and preserve uncommitted work that is not yours.
2. Understand the outcome the owner wants, not only the literal first step.
3. Plan: a few lines naming the approach, the risks and how you will verify.
4. Implement within the authorized scope.
5. Run the applicable checks (see `testing.md`).
6. Fix failures at their root cause; do not patch the same failed approach repeatedly.
7. Verify the result against the request and `completion.md`.
8. Report as `completion.md` describes.

### Choosing defaults

When the request leaves a reversible detail open (a file name, a component layout, a test name), choose the option most consistent with the project and state it in the report. When the choice would cost money, reach other people, change an output the owner will notice, or cannot be undone, it is the owner's decision.

### Multi-phase work

Keep working any phase that does not depend on a blocked one. Report the blocked phase once, with the exact unblocking step, instead of stopping everything.

### When blocked

Say what failed, what you tried, and the one action that would unblock it. Do not claim an unavailable integration works.
