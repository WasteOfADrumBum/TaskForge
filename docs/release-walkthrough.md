# TaskForge release walkthrough

TaskForge ships through a traceable, approved delivery loop. This walkthrough describes the current task/project/agent foundation and release-readiness work. AI execution is still planned.

## From requirement to verified release

1. **Define the bounded requirement.** Record behavior, acceptance checks, risks, and dependencies in [Jira KAN](https://taskforgejms.atlassian.net/browse/KAN-13). Check the [roadmap](roadmap.md) and existing implementation before changing working behavior.
2. **Use the existing patterns.** Start a ticket branch and [branch task](../.codex/templates/branch-task.md). Keep the layered Express API, owner-scoped services, typed client state, Chakra patterns, and calendar-date rules. Preserve unrelated uncommitted work.
3. **Implement and open a PR.** Link Jira, branch, commits, and PR. Record what changed and the relevant checks, rather than treating planned features as shipped.
4. **Validate behavior and review independently.** Run formatting, lint, types, units, builds, full audit, fixture-safety checks, real database integration, and Chromium smoke. Use fresh local synthetic data for writes. Resolve independent review findings and rerun affected checks; do not weaken failing assertions.
5. **Apply the approval boundary.** Approved tickets may merge after the final reviewed head passes protected CI. New scope, meaningful cost, major architecture/security changes, risky data operations, materially different UX directions, and Phases 3–8 require an owner decision. The current approval covers bounded Phase 2, not unrestricted autonomous production actions.
6. **Verify the served release.** Check main CI and provider deployment results, then compare client `/release.json` and API `/release` with the merge SHA. Confirm `/health` and database `/ready`. Record evidence in Jira before Done, then select the next approved ticket.

The [delivery policy](delivery.md) defines merge rules; [architecture](architecture.md) explains the existing system; [testing](testing.md) and the [release runbook](release-runbook.md) document safe verification.

## Concrete evidence: KAN-13

[Required isolated verification](https://taskforgejms.atlassian.net/browse/KAN-13) shipped in [PR #23](https://github.com/WasteOfADrumBum/TaskForge/pull/23), merged as `3a8e3c5`.

- **Checks:** 875 units, 3 fixture-safety tests, 16 real MongoDB/API cases, 3 Chromium flows, builds, types, lint, formatting, and audit0.
- **Regression proof:** removing the task-list owner filter temporarily exposed another user's synthetic task and failed the integration test. Exact source restoration returned green; no production mutation remained.
- **CI:** [final PR run](https://github.com/WasteOfADrumBum/TaskForge/actions/runs/37508713490) and [main run](https://github.com/WasteOfADrumBum/TaskForge/actions/runs/37509241938) passed.
- **Deployment:** Vercel `6891689707` and Render `6891682887` succeeded. The live client/API identities both matched the merge; health and readiness passed. Provider status alone is insufficient evidence of source identity.

## Current product and limits

Tasks, projects, agent definitions, and task assignment are implemented. Assignment records responsibility; it does not run an agent. Command Center recommendations are rule-based. AI providers, runs, permission enforcement, audit, handoffs, and human approval are future Phase 2 implementation work.

The [gallery](images/README.md) uses synthetic local records from production-equivalent `3a8e3c5` source. It does not expose production accounts or establish full design parity. No production seed/reset was used.

The existing free tiers are retained. Render cold starts and manual recovery after prolonged idle are accepted; Atlas backup/restore and unattended availability are not guaranteed. Local standalone MongoDB and Chromium checks do not prove Atlas behavior, concurrent deletion races, exhaustive accessibility, or recovery of production backups. See the [runbook](release-runbook.md) for those boundaries.
