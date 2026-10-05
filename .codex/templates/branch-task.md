# Branch task

Use one Jira ticket per branch. Fill in the fields before implementation.

## Goal and traceability

- Jira: KAN-<number> and URL
- Branch: `codex/KAN-<number>-<short-name>`
- Approved milestone: release readiness and bounded Phase 2
- Acceptance criteria: numbered, testable outcomes
- Context: roadmap item, related code, existing decisions
- Figma: relevant node links, or why no design change applies
- Deployment implications: preview/API/database boundaries and safe QA plan

## Start safely

Read `AGENTS.md`, the ticket, and [delivery policy](../../docs/delivery.md). Inspect status, current branch, and uncommitted work first.

Preserve unrelated work. Reuse a suitable clean managed worktree, or create an isolated one from `origin/main` if the current checkout has unrelated edits. Do not stash, reset, discard, clean, or delete the user's work. If continuing an existing feature, inspect and preserve its edits before changing anything.

Move Jira to In Progress. Inspect the existing implementation; extend working functionality with the smallest coherent change. Keep all resource queries scoped by owner and keep shared client/server types aligned.

## Design and implementation

When UI changes need design, inspect the authoritative Figma file and reconcile it with existing implementation before editing. Add the applicable design when practical and link it to Jira. An empty file does not prove design parity; use the existing intended UX as the baseline.

Add meaningful tests for changed behavior: success, failure, sessions, and ownership as applicable. No tests are needed solely to mirror reversible documentation edits. Keep tests next to code.

Update roadmap/status docs when affected and add notable behavior to Unreleased in the changelog. Never describe local or planned features as shipped.

## Required validation

Run from the repository root, fix failures within ticket scope, and retain evidence:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm audit
git diff --check
```

Do not hide failures, skip checks, weaken assertions, or alter the audit policy just to pass. Document pre-existing failures; continue independent approved work when a specific ticket is blocked.

## Review, PR, and merge

1. Have a reviewer separate from the implementer inspect the final diff and relevant surrounding code. Record findings and corrections on the PR.
2. Commit with the Jira key, push, and create a PR with acceptance evidence, QA, Figma applicability, deployment implications, and known limitations.
3. Move Jira to In Review. Re-review changed code after corrections and repeat affected validation.
4. Confirm the final head has passed required CI and is current with main. Merge within the approved milestone using `--match-head-commit`; never use an administrator bypass.
5. Verify merge SHA, main CI, deployments, live availability, and relevant behavior. Record any source-identity limitation precisely.
6. Mark Jira Done only after acceptance and validation are satisfied. Update completion evidence in the next affected docs change.
7. Continue automatically to the next approved ticket.

Zero required GitHub votes supports the solo-owner repository; it does not replace independent review.

## Approval boundaries

Stop before implementing new functionality outside the approved plan, material ticket/milestone expansion, a meaningful cost, major architecture or hosting/database/auth/core security changes, destructive or risky data operations, material UX direction changes, or Phases 3–8. Present:

- Proposal:
- Why:
- Benefit:
- Risk:
- Cost:
- Alternatives:
- Recommendation:

Wait for Josh's decision on that condition. Routine approved tickets, commits, pushes, PRs, merges, QA, and delivery verification are authorized.

## Completion record

- Jira:
- PR:
- What changed:
- Tests/QA:
- Figma:
- Deployment:
- Result:
