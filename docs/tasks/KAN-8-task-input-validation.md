# KAN-8: Task input validation

- Jira: https://taskforgejms.atlassian.net/browse/KAN-8
- Branch: `codex/KAN-8-task-input-validation`
- Approved milestone: release readiness and bounded Phase 2.
- Starting source: `0275740` (KAN-7, PR #18, client/API deployment identity verified).

## Acceptance and implementation boundary

1. Malformed task IDs return the same 404 Task not found as missing/foreign IDs, before database access.
2. Title is a nonempty string after trimming, limited to 120 code units. Description is an optional string, limited to 2000 after trimming. Match the existing project text conventions and client input limits.
3. Every supplied status/priority must be a supported enum, including falsy values; reject invalid types with 400 before database access.
4. Accept real calendar dates in YYYY-MM-DD or the API's exact UTC-midnight shape YYYY-MM-DDT00:00:00.000Z. Reject invalid dates, times, offsets and nonstrings. Null clears the date; omission preserves it. Model validation must prevent calendar rollover and non-midnight values while retaining valid UTC-midnight Date instances used by the seed.
5. Preserve owner scoping, project/agent resolution, assignment retention and deletion-race reconciliation. Preserve the existing no-body update behavior.
6. Test calendar/leap-year/year-1-to-99 boundaries, ownership/assignment regressions, model errors and client bounds.

## Design and deployment

Existing task form layout, tokens and assignment reference remain the baseline. Only native text length limits change; no design-dependent layout or product direction change. No schema expansion, data migration, seed, production writes or new infrastructure is authorized by this ticket.

Use local synthetic QA and mocked request tests. Required gates: formatting, lint, client/server types and builds, full tests, full audit, independent final review, exact-head PR CI, main CI and deployed source identity. No completion or deployment is claimed until verified.

## Local validation

- 679 tests passed (278 client, 401 server); targeted task/date/model/assignment server 149 and client form/date 10 passed.
- Format, lint, client/server types, both builds, full audit (0 vulnerabilities) and whitespace checks passed.
- Local synthetic API browser QA: native title/description truncate at 120/2000; February 29 creates and displays without a day shift. Boundary-length task has no horizontal overflow at 390/768/1440.
- Independent implementation review found no blockers; final docs review, exact-head PR CI and post-merge main CI/deployment checks remain gates. Existing local React script warning stays tracked under KAN-13. No production task writes or MongoDB use.

## Delivery verified

PR [#19](https://github.com/WasteOfADrumBum/TaskForge/pull/19) merged as `d6ad789`. PR CI 37379240456 and main CI 37379480987 passed; Vercel 6870309148 and Render 6870305902 succeeded. Live client/API commits matched; health/readiness passed. Jira is Done. No authenticated production task CRUD or database migration.
