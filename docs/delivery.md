# Delivery policy

TaskForge delivery is tracked in Jira project KAN. Each implementation ticket has a branch, commits, PR, validation, independent review, and deployment evidence.

## Main branch protection

The approved KAN-4 policy is applied to `main`:

- Changes require a pull request.
- The `quality` check must pass from GitHub Actions (app ID 15368).
- The branch must include current `main` before merging.
- Review conversations must be resolved.
- Administrators follow the same requirements.
- Force pushes and branch deletion are blocked.

The reproducible policy is [main-protection.json](../.github/main-protection.json). It is a reference file, not an automatic settings sync. Inspect current settings before applying it so future policy changes are preserved.

```powershell
gh api repos/WasteOfADrumBum/TaskForge/branches/main/protection
gh api --method PUT repos/WasteOfADrumBum/TaskForge/branches/main/protection --input .github/main-protection.json
```

## Independent review and merge authority

This is a solo-owner repository. GitHub requires zero approval votes because the PR author cannot approve their own PR. This does **not** remove the independent review requirement: a reviewer separate from the implementer must inspect the final diff, with findings and their resolution recorded on the PR. GitHub branch protection does not enforce that evidence; the delivery operator checks it before every merge.

Josh approved autonomous merges within release readiness/bounded Phase2 on2026-10-05 and bounded Phase3 Knowledge & Cited Retrieval on2026-10-08. Phase2 is owner-closed; Phase3 authority is recorded in KAN-27. Merge only after ticket acceptance, automated validation, relevant QA, independent review, and the exact final head's required checks pass. Use the final head SHA to prevent merging an unreviewed later push:

```powershell
gh pr checks <PR_NUMBER> --required
gh pr merge <PR_NUMBER> --merge --match-head-commit <REVIEWED_HEAD_SHA>
```

Do not use `--admin`, weaken checks, or bypass a failed gate. Re-review changed code and repeat affected validation after corrections. A new scope, meaningful cost, major architecture or core security change, risky data operation, material UX direction change, or Phases4–8 needs Josh's decision before implementation.

## Deployment boundaries

Vercel builds client previews from feature branches and production from `main`. The preview client uses its configured API URL; a preview must not be assumed to have an isolated database. Verify that boundary before any QA that writes data.

Render runs the API with the existing free-tier Blueprint. Merging to `main` can trigger production deployments; pre-merge checks protect the release. Post-merge CI and deployment verification remain required. This policy does not add a new deployment service or change hosting.

Record the merge SHA, main CI run, deployment result, live availability, and relevant behavior in Jira before Done. A provider reporting success is distinct from proving the exact source served by the API. Render's GitHub deployment metadata still names an older branch/SHA. Verify the actual client /release.json and API /release against the merged commit; matching served identities were established under KAN-11 and subsequent tickets. Do not infer a source mismatch or successful source update from deployment metadata alone.

Production QA must avoid changing existing data. Use read-only checks unless an approved ticket explicitly requires a safe write. Production data migrations and destructive operations require a separate decision.

## Validated dependency baseline

KAN-1 merged in [PR #12](https://github.com/WasteOfADrumBum/TaskForge/pull/12) as `48aae59`. Both final-head and main CI passed Node 24; all 361 tests passed and the full audit reported zero vulnerabilities. Vercel and Render reported successful deployment; the live frontend and API health returned 200, and unauthenticated task/project/agent routes returned 401. No audit exception was needed.
