# Branch task

Use one Jira ticket per branch. This usage-efficient policy was configured once under KAN-43;
do not repeat setup on continuations unless instructions are missing, incomplete or explicitly changed.

## Goal and traceability

- Jira key/URL; branch `codex/KAN-<number>-<short-name>`; approved milestone and acceptance outcomes.
- Relevant roadmap/code/decisions; product UI/accessibility and safe QA/deployment boundaries.
- Concise checkpoint: branch/worktree and edits, last implementation, applicable verified checks,
  outstanding gates/blockers/approvals and exact next action.

## Start or resume safely

Inspect current status, local/remote branch and uncommitted work before edits. Read relevant Jira
criteria/history, PR/CI/review evidence and checkpoint; do not assume conversation history is latest.
Reuse verified unchanged context and load only task-relevant files/diffs/docs. Prefer targeted searches
and short output over repeated repository scans, unchanged docs or planning loops.

Preserve unrelated work. Reuse a suitable clean managed worktree; isolate from `origin/main` when
necessary. Never stash, reset, discard, clean or delete user work. Locate the appropriate Jira ticket
(create only when approved work lacks one); avoid duplicate tickets and repeated issue searches.
Move to In Progress when implementation begins and maintain criteria, branch/PR traceability.

## Implement efficiently

Use the smallest coherent solution meeting every acceptance criterion. Reuse architecture/components/
utilities; avoid speculative abstractions, unrelated refactors and regenerating working code.
Preserve React/TypeScript/Node/Express/MongoDB/Vercel/Render and $0 additional recurring cost unless
explicitly approved. Keep owner-scoped queries and shared types aligned.

Implement UI from Jira and existing TaskForge theme/interaction patterns. Figma, its MCP/agents,
design generation and their limits remain excluded from implementation, approval, QA and delivery
unless Josh explicitly requests them again.

Use efficient models and moderate reasoning for routine implementation/docs/Jira/fixes when controls
are available; stronger reasoning for architecture, security, concurrency, complex debugging and
important independent review. Escalate uncertainty/repeated failures instead of costly retry loops.
Keep the selected model if switching is unavailable; do not interrupt productive work just to switch.
No additional paid services/subscriptions.

Update only docs affected by actual changes: roadmap/status, architecture/ADRs and notable behavior
in Unreleased. Distinguish planned/local validation from shipped features; link evidence instead of
repeatedly rewriting docs or creating unnecessary artifacts/reports.

## Progressive validation

During implementation, run meaningful targeted tests for changed behavior and affected lint/types.
Fix failures and rerun relevant checks, rather than the whole suite after every minor correction.
The implementer handles routine tests; use a separate tester when complexity, risk or coverage gaps
justify it. Coordinate fixture ownership and avoid unnecessary simultaneous reviewer/tester agents.

Once implementation is stable, run required full local quality validation from the root:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm audit
npm run test:qa-safety
npm run test:integration
npm run test:e2e
git diff --check
```

Real MongoDB/browser checks apply to functionality requiring them; mocks cannot replace necessary
integration evidence. Documentation-only changes use relevant documentation/static checks locally;
required GitHub CI remains mandatory. After final corrections rerun affected validation, repeating
full validation when the changes/risk require it. Record which exact code each successful check
validates; prior results do not validate changed code automatically. Never skip a release gate,
weaken assertions, hide failures or relax audit policy. Retain failure/correction evidence; document
pre-existing failures and continue independent approved work when a specific ticket is blocked.

## Independent review and delivery

1. After stabilization, have a separate reviewer inspect the final relevant diff and necessary
   surrounding code. Focus security scrutiny on auth/ownership/permissions, data integrity,
   concurrency and sensitive operations; avoid repeated reviews of incomplete or unrelated work.
2. Resolve findings, re-review affected changes and repeat affected checks. Record concise evidence.
3. Commit with Jira key, push and create/update the PR with acceptance, QA/review, accessibility,
   deployment implications and material limitations. Move Jira to In Review.
4. Verify current-main/exact-final-head required CI and resolved conversations. Merge within approved
   scope using `--match-head-commit`, never an administrator bypass or weakened branch protection.
5. Verify merge SHA, main CI, provider deployments, live availability/relevant behavior and matching
   frontend/API release identities. Preserve auth/ownership/audit controls and production data safety;
   report source-identity limits accurately. Zero GitHub votes never replaces independent review.
6. Mark Jira Done only when all acceptance/release conditions pass; add one concise completion summary
   linking PR/test/review/CI/merge/deployment evidence. Avoid redundant status/comments and long reports.
7. Check available usage before the next substantial approved task. Continue when a useful safe
   checkpoint is feasible; do not start work likely to exhaust usage before one. Finish active work
   before unrelated work; never use budget limits to bypass validation.

## Approval and stopping boundaries

Preserve [delivery policy](../../docs/delivery.md) and existing approval authority. Stop before new
unapproved functionality, material ticket/milestone/UX expansion, meaningful cost, major architecture
or hosting/database/auth/core security changes, destructive/risky data operations or Phases 3–8.
Present Proposal / Why / Benefit / Risk / Cost / Alternatives / Recommendation and wait for Josh.
Normal approved implementation/tests/docs/Jira/commit/push/PR/protected merge/deployment are authorized.

Stop also at an unavoidable blocker or when remaining usage prevents safe continuation. Save the
concise restart checkpoint above, including exact next action and applicable checks. Never purchase,
upgrade or bypass required security/CI to extend usage.

## Completion record

- Jira ticket and PR
- Feature/change delivered
- Validation and independent review, with evidence links
- Merge/deployment result and live release identity
- Next approved ticket or precise stopping checkpoint
