# KAN-20: Minimal permission-scoped task/project context

- Jira: https://taskforgejms.atlassian.net/browse/KAN-20
- Branch: `codex/KAN-20-bounded-context`
- Source: verified deployed `978c623` (KAN-19 Done, PR #29).
- Approved scope: bounded Phase 2; original assignment checkout preserved.

Snapshot only owned permitted task/project title/name/notes, with source IDs/updatedAt for reproducibility, within existing 16KiB context limit. Task reads require saved task.read and artifact.draft. Project is opt-in via includeProject boolean (default false) and requires saved project.read before query; use the owned task's owned project only. Caller context/owner/permissions cannot expand authority.

Persist snapshot/digest atomically in the audited claim before inference, retain it after completion/review, and block ordinary replacement after claim. Keep prompt roles/instructions fixed; stored text remains untrusted data. Tests prove structural boundaries, not general model immunity. Audit includes safe metadata/digest rather than raw notes/context/input/output.

No RAG, ingestion, queue, paid provider, new service, risky migration/backfill or task/project changes. Preserve production real inference disabled, explicit labelled simulation and exact human review. Full run/activity UI remains KAN-21; no Figma.

Implementation in progress. Required checks: owner/reference/capability/missing/deleted/size/hostile-data boundaries, reproducible immutable snapshot and audit failure before calls; full format/lint/types/units/build/audit/safety/isolated API/browser, independent review, PR/main CI and deployed identity before Done.

## Local validation

1104 units (508 client/596 server),89 real API,7 safety,5 Chromium,format/lint/types/builds/diff and audit0 passed. Seventeen initial real context cases cover ownership, missing/deleted sources, permission checks before queries and at four boundaries, exact UTF-8 limits, hostile JSON role separation and immutable audited snapshots. Two review-driven cases cover opted-in project addition rejection and task-only allowance without querying unrequested project data. Final independent review and normal PR/main CI/live source verification remain pending.
