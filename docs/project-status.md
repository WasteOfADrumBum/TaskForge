# Project Status

A short, living snapshot of where TaskForge is right now. For the full plan, see [roadmap.md](roadmap.md).

**Last updated:** 2026-10-08

## Checkpoint

| Item                      | Value                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Phase 1 status            | **COMPLETE** (closed 2026-10-02; [closure summary](phases/phase-1-stabilize.md#closure-summary-2026-10-02)) |
| Current phase             | Phase 2 COMPLETE; bounded Phase 3 approved/in progress                                                      |
| Current branch            | `codex/KAN-45-knowledge-workspace`; original assignment WIP preserved on `feat/agent-task-assignment`       |
| Current checkpoint        | Approved bounded Phase3: storage/keyword retrieval first                                                    |
| Last completed checkpoint | KAN-44 owned Knowledge API (PR #38, `7fe3aaf`); CI/live verified                                            |
| Next recommended          | KAN-45 private knowledge UI; validation/protected delivery pending                                          |

## Known verification gaps

- Real local MongoDB integration and Chromium smoke are required CI checks and shipped under KAN-13. They do not establish production CRUD, Atlas behavior, multi-request concurrency, exhaustive browser/accessibility coverage, or private backup/restore readiness.

## Delivery pipeline stabilization (2026-10-05)

- **KAN-1 complete:** PR #12 merged as `48aae59`; 361 tests, audit, final-head/main CI, successful deployment status, and live availability/auth guards passed. Evidence is recorded in [KAN-1](https://taskforgejms.atlassian.net/browse/KAN-1).
- **KAN-4 complete:** PR #13 merged as `882e134`; required PR/main CI, effective protection, deployment status, and live health passed. Main requires PRs/current quality CI/resolved conversations, including administrators; force pushes/deletions are blocked. See [delivery policy](delivery.md).
- **KAN-5 complete:** PR #14 merged as `fc00e80`; docs/link checks, independent review, required PR/main CI, deployment status, and live health passed.
- The existing task-assignment work is preserved separately on `feat/agent-task-assignment` and tracked in [KAN-2](https://taskforgejms.atlassian.net/browse/KAN-2); PR #15 merged as `16628b0`, with 471 tests, independent review and PR/main CI passed. Provider deployment success and live health passed; matching client/API merge identity was verified under KAN-11. KAN-2 and KAN-3 are Done.
- Josh approved autonomous delivery through release readiness and bounded Phase 2. Normal scoped tickets may merge after validation and independent review. New scope, paid cost, major architecture/core security changes, risky data operations, and Phases 3–8 require a decision.

## Release readiness (KAN-11, complete)

- PR #16 merged as `f727b69`. Independent review, 491 tests, PR/main CI and provider deployments passed. Live client `/release.json` and API `/release` matched that commit; `/ready` returned 200. Separate liveness, bounded DB readiness and build-derived release identity are shipped. See the [release/idle recovery runbook](release-runbook.md). No hosting changes, production data operations, paid service or automatic cluster administration.
- Free-tier manual recovery is documented; an actual private backup/isolated Mongo restore is not yet verified. Simulated outage/recovery tests do not establish production restore readiness.

## Infrastructure verification (2026-10-02)

| Check             | Status   | Evidence                                                                                                                                                                                                                                   |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MongoDB Atlas     | Complete | Atlas dashboard (project owner): cluster `Cluster0`, database `taskforge`, Free tier, AWS N. Virginia `us-east-1`, connectivity working                                                                                                    |
| Render Blueprint  | Complete | Render dashboard (project owner): TaskForge Blueprint connected to `WasteOfADrumBum/TaskForge` on `main`, latest sync succeeded, `taskforge-api` synced to `main`                                                                          |
| Vercel production | Complete | The PR #7 favicon, logo, self-hosted font, and pre-paint theme script are served by the live app                                                                                                                                           |
| CI on `main`      | Complete | GitHub Actions green on the PR #7 merge (`84c506d`)                                                                                                                                                                                        |
| API cold start    | Complete | After 20 minutes idle on 2026-10-02, a failed-login probe with a non-existent email took 32.9 s (a cold start) and returned the correct `401 Invalid credentials`, which requires a successful Atlas lookup. The next request took 0.43 s. |
| Production data   | Complete | Smoke-test accounts removed in Atlas (project owner); the users collection holds only the intended real accounts                                                                                                                           |

## Production verification (2026-10-01)

**Result:** 62/62 automated checks passed against the live app.

- **Browser:** Microsoft Edge driven by Playwright, set to the America/New_York time zone.
- **Accounts:** throwaway `smoke-test-*@example.com` accounts (two, because the first run's password wasn't kept). Their tasks were deleted after the run, and the accounts were removed from Atlas on 2026-10-02. The demo account and its data were not touched, and `seed:demo` was not run.

| Area             | Verified                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public pages     | Landing page, login, register (new account), signed-out `/work` redirects to `/login`                                                                                 |
| Shell pages      | Command Center, Work, Workforce placeholder (since replaced by the Agent Registry), Settings                                                                          |
| Tasks            | Create, edit (due date kept), delete, status To Do → In Progress → Done → To Do, search, priority filter, due-date sort                                               |
| Due dates        | Due today shows "Due today" and today's date, not Overdue; due yesterday is Overdue; "was due 1 day ago" wording                                                      |
| Shell actions    | New Task focuses the form; refresh reloads tasks; logout clears the session with no session-expired message                                                           |
| Expired sessions | A server-rejected token and an expired token both return to `/login` with the session-expired message                                                                 |
| Theme            | Dark is the initial default; Light, System (follows the OS), and Dark all apply                                                                                       |
| Responsive       | No horizontal overflow at 390, 768, and 1440px on 6 pages; drawer focus moves in, Escape closes and returns focus, navigating closes it; persistent sidebar at 1440px |
| Errors           | No uncaught page errors                                                                                                                                               |

## Production URLs

Reverified after PR #23 on 2026-10-06: client `/release.json` and API `/release` matched `3a8e3c5`; API `/health` and `/ready` returned 200. The client metadata names the production Render API. Earlier full production smoke evidence is historical above; this milestone used no production test writes.

| Service      | URL                                            |
| ------------ | ---------------------------------------------- |
| App (Vercel) | https://taskforge-alpha-six.vercel.app         |
| API (Render) | https://taskforge-api-rp2m.onrender.com        |
| API health   | https://taskforge-api-rp2m.onrender.com/health |

## Infrastructure

| Service        | Role                                    | Tier | Config                                               |
| -------------- | --------------------------------------- | ---- | ---------------------------------------------------- |
| Vercel         | Hosts the client SPA                    | Free | `client/vercel.json`                                 |
| Render         | Hosts the Express API (`taskforge-api`) | Free | `render.yaml` Blueprint, synced to `main`            |
| MongoDB Atlas  | Database `taskforge` on `Cluster0`      | Free | AWS `us-east-1`; `MONGO_URI` set as a Render env var |
| GitHub Actions | CI on push/PR to `main`                 | Free | `.github/workflows/ci.yml`                           |

Free-tier note: Render free services sleep when idle, so the first request after a sleep is slow. The API recovers correctly. Delayed waiting, safe read cancellation/manual retry, and honest write uncertainty shipped in KAN-10. Months of unattended availability are not guaranteed; manual recovery and backup limits remain documented in the [runbook](release-runbook.md). Full details: [architecture.md](architecture.md).

## Deferred maintenance (non-blocking)

The remaining items are tracked in the [roadmap](roadmap.md#phase-1-maintenance-deferred-does-not-block-phase-1).

These three Phase 1 items were moved to maintenance at closure:

- **Demo reliability:** waiting/recovery shipped in KAN-10. No automatic production demo reseeding is planned by this release.
- **Screenshot recapture:** active in KAN-14, using verified release source and synthetic local fixtures.
- **CHANGELOG backfill:** work before PR #4.

These are known minor polish issues from PR #7. They were never Phase 1 items:

- **Greeting refresh:** the Command Center greeting only updates when the day changes.
- **Hero logo contrast:** resolved in KAN-12 with the existing asset on a suitable light surface.

## Design reference

The v2 shell and Command Center UX originally came from a separate TaskForge v2 prototype built on the Sites platform. The authoritative [TaskForge Figma file](https://www.figma.com/design/2l4DJJigN7aa4Fk6S5zu8M/TaskForge) was inspected on 2026-10-05: initially one empty page, no design nodes. KAN-2 adds a [source-matched assignee state reference](https://www.figma.com/design/2l4DJJigN7aa4Fk6S5zu8M/TaskForge?node-id=10-59): eight editable component variants, Figtree styles, and bound dark theme tokens. It reconciles the existing field behavior and browser styling; it does not establish full-app design parity. The production app keeps its existing architecture: React + Vite + Chakra UI, Express + MongoDB, JWT auth, Vercel + Render.

## Documentation

| Item             | Status                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| README           | Portfolio README with current application screenshots and explicit local/synthetic provenance                       |
| Architecture doc | Done: [architecture.md](architecture.md), with Mermaid diagrams                                                     |
| Screenshots      | Current release recapture tracked in KAN-14; provenance and source recorded in [images/README.md](images/README.md) |

## Validation status (verified release `3a8e3c5`, 2026-10-06)

| Check                                             | Result                             |
| ------------------------------------------------- | ---------------------------------- |
| Format, lint, client/server/QA types              | Pass                               |
| Application units                                 | Pass: 875 (474 client, 401 server) |
| Fixture safety                                    | Pass: 3                            |
| Real MongoDB/API integration                      | Pass: 16                           |
| Chromium critical flows                           | Pass: 3                            |
| Clean installation and production builds          | Pass                               |
| Full dependency audit                             | Pass: 0 vulnerabilities            |
| Independent review and required PR/main CI        | Pass                               |
| Live client/API source identity; health/readiness | Pass                               |

Existing development theme-script and unit jsdom diagnostics are recorded, not hidden. Passing these suites does not establish a console-clean production experience or full accessibility certification.

## Authentication validation (KAN-6, complete)

- Malformed input rejection, email normalization, duplicate-race handling, and Unicode-aware registration limits are implemented. Existing account login remains compatible. PR #17 merged as `bf888c6`. Local 579 tests, format/lint/types/build/audit, independent review, PR/main CI and deployments passed. Live client/API source matched the merge; health/readiness and malformed query-object rejection passed.
- The existing registration layout is retained. A [source-matched Figma reference](https://www.figma.com/design/2l4DJJigN7aa4Fk6S5zu8M/TaskForge?node-id=14-71) records default, too-short and too-long password states.

## Authentication abuse protection (KAN-7, complete)

- Clean branch created from verified merged main. The [branch task](tasks/KAN-7-auth-abuse-protection.md) records account/capacity limiting and Render proxy boundaries. Middleware is implemented; 593 tests and local checks passed, with independent review finding no blockers. PR #18 merged as `0275740`; PR/main CI and deployments passed. Live client/API commit matched, readiness passed and expected limiter headers were verified. Proxy trust stays disabled; no per-client IP guarantee is claimed.

## Task input validation (KAN-8, complete)

- [Branch task](tasks/KAN-8-task-input-validation.md) records strict IDs, content bounds and calendar-date validation. Implementation and 679 tests are validated locally, with all checks and audit passed. Synthetic browser QA verifies native limits, leap-date display and responsive layout; ownership and assignment regressions pass. PR #19 merged as `d6ad789`; PR/main CI and deployments passed, both live release commits matched, and health/readiness passed. No production data changes.

## Local logout (KAN-9, complete)

- [Branch task](tasks/KAN-9-immediate-local-logout.md) records immediate local clearing and delayed-response protection. Implementation and 786 tests are validated locally, with all checks/audit passed. API-body and final-consumer/navigation race regressions pass; actual offline browser logout clears immediately with no request or expiry message. PR #20 merged as `39c5ec6`; PR/main CI and deployments passed. Both live release commits matched; health/readiness passed. Existing JWT/stateless auth behavior and page layout remain unchanged.

## Cold-start feedback (KAN-10, complete)

- [Branch task](tasks/KAN-10-cold-start-feedback.md): bounded transport and delayed waiting/cancel/retry/recovery UI are implemented. Clean-install validation passed: 860 tests, formatting, lint, types, builds and audit (0 vulnerabilities). Independent review found no remaining blockers. Browser QA confirms delayed polite feedback, read cancel/manual retry/recovery and sign-in cancellation; no production writes. PR #21 merged as `0452df2`; PR CI37461555830/main CI37461926731 and deployments passed. Both live client/API commits matched; health/readiness passed.
- October 6 user direction removes all design-tool workflows/gates. Functional waiting, safe cancel/retry and accessibility QA use existing application patterns. KAN-10 is Done.

## Settings and public accessibility (KAN-12, complete)

Settings planned sections, accessible theme selection, public heading semantics and hero logo contrast are implemented using existing application patterns. 875 tests and local checks/audit0, independent review, and keyboard/persistence/responsive browser checks pass; PR #22 merged as `401a7d1`; required PR/main CI and live client/API release identities, health and readiness passed after Josh-approved corrective cache-cleared API redeploy. Jira Done. Account profile/deletion APIs remain planned and outside this ticket.

## Reproducible critical verification (KAN-13, complete)

[PR #23](https://github.com/WasteOfADrumBum/TaskForge/pull/23) merged as `3a8e3c5`. Sixteen real MongoDB/API cases and three Chromium flows run in fresh loopback-only temporary databases. Ownership mutation failed as expected, then exact source restoration returned green. Three startup safety tests prevent browser traffic reaching an unrelated occupied service. Fast unit suites remain separate; all suites run in the existing protected quality job.

- [Final PR CI](https://github.com/WasteOfADrumBum/TaskForge/actions/runs/37508713490) and [main CI](https://github.com/WasteOfADrumBum/TaskForge/actions/runs/37509241938) passed, including 875 units, 3 safety tests, 16 real API cases, 3 browser flows, and audit0.
- Vercel deployment `6891689707` and Render deployment `6891682887` reported success. Both live release identities matched the merge; health/readiness passed.
- [Testing boundaries](testing.md): no production test writes, no data reset, and no new recurring service or architecture change.

## Release evidence (KAN-14, complete)

The [release walkthrough](release-walkthrough.md) connects an approved requirement to Jira, existing patterns, PR, QA, review, and deployment evidence. The gallery uses production-equivalent `3a8e3c5` source with synthetic local fixtures, not production account data. Capture verification, independent review, PR/main CI and deployed source checks passed; KAN-14 is Done. This closes the readiness portion only; bounded Phase 2 execution remains approved work ahead, with Phases 3–8 outside the milestone.

## Verified portfolio release and approved provider decision

KAN-14 is Done: PR #24 merged as `a84f216`; PR CI `37511837148`/main CI `37512380619`, deployments, matching served client/API identities, health/readiness and unauthenticated guards passed. KAN-15 is Done. Josh approved disabled-by-default production AI with explicit, clearly labelled simulation; local developer Ollama inference is active under KAN-16. No paid API calls; execution/run UI and approvals remain later tickets.

## Provider contract (KAN-15, complete)

[Branch task](tasks/KAN-15-ai-provider.md) records the approved production decision and server-only contract. Authenticated read-only status reports safe capabilities; no execution endpoint or model call is added. Independent review identified and corrected a final result cancellation/deadline boundary. Monotonic deadline and public promise checks reject pending interruption and overdue validation; 915 unit tests (474 client, 441 server), 3 fixture safety, 16 real API cases and 3 Chromium flows passed. Static/build/audit gates and independent review passed; PR #25 merged as `dacbd882`; PR CI `37551262614`/main CI `37551649229` passed. Client/API served identities match, health/readiness pass, new status route rejects missing/invalid auth; Jira Done. Production stays disabled; no model/paid calls. No paid service or production writes.

## Local provider (KAN-16, complete)

[Branch task](tasks/KAN-16-local-provider.md) defines server-only loopback inference, cloud rejection, bounded safe protocol and an explicit local smoke. Actual local chat and structured smoke passed with a checksum-verified portable Ollama 0.40.0/qwen3:0.6b, cloud disabled, synthetic inputs and owned loopback listener. Runtime stopped and port closed. 977 units, 7 safety tests, 16 real API and 3 Chromium flows passed; static/build/audit0 and independent code review passed. PR #26 merged as `fda3d1a`; PR CI `37553172384`/main CI `37553541711` passed. Both live identities match; health/readiness and status auth guards pass, Jira Done. No machine-wide service or production calls. Runs, permission enforcement, audit and approvals remain later tickets.

## Agent runs (KAN-17, complete)

[Branch task](tasks/KAN-17-agent-runs.md) records persisted owner-scoped run states, idempotent creation and version/attempt/expiry fencing using existing MongoDB. Model execution remains gated until KAN-18; no worker, provider call, task write or approval UI is enabled. No new infrastructure or production migration. Local validation passed 1018 units, 7 safety tests, 32 real API cases, 3 Chromium flows, static/build checks and audit0; index-readiness review correction is covered. PR #27 merged as `9149a81`; PR CI `37555852459`/main CI `37556345853`, deployments, matching live source identities, health/readiness and run auth/no-store guards passed. Jira Done.

## Permissions and audit (KAN-18, complete)

[Branch task](tasks/KAN-18-permissions-audit.md) records shipped least-privilege checks, atomic lifecycle audit, immutable safe denials and bounded explicit drafts. PR #28 merged as `bb660e2`; 1055 units, 49 real API, 7 safety, 3 Chromium, all static/build/audit checks and independent review passed. PR CI `37622851265`, main CI `37623387663`, Vercel `6910280380`, Render `6910275252`, matching live client/API identities, health/readiness and auth/no-store guards passed. Jira Done. No task/application writes, actual production model calls or paid service.

## Human review (KAN-19, complete)

PR #29 merged as `978c623`. 1096 units, 70 isolated API cases, 7 safety tests,
5 Chromium flows, all static/build/audit checks and independent review passed.
Literal-result equality was corrected with real Mongo regressions. The first browser CI
failure was retained and fixed by waiting for Login's unique heading before credentials,
with no timeout/retry changes. Revised PR CI `37655921992`, main CI `37656435346`,
Vercel `6915874391`, Render `6915869378` and matching live identities passed. Jira Done.
Approval records the exact draft decision; it does not apply task/project changes.

## KAN-20 delivery complete / KAN-21 active

KAN-20 is Done: PR #30 merged as `c06dc63`, after 1104 units, 89 isolated API cases,
7 safety tests, 5 Chromium flows, static/build/audit0 and independent review.
Exact-head CI `37660100734` and main CI `37661029030` passed. Vercel `6916638371`
and Render `6916634960` succeeded; both served identities match, health/readiness
are 200 and run authentication rejects signed-out access with no-store.

KAN-21 starts from this verified build on `codex/KAN-21-run-activity`. Owned run
list/detail, explicit creation/execution and human review controls are implemented and
locally validated from existing application patterns. No production writes, paid AI, handoff worker,
new infrastructure or Figma workflow. Full QA passed 1141 units, 89 API cases, 7 safety tests and 8 Chromium flows, all static/build/audit0 checks; independent review reports no findings. Protected PR/main CI, merge and live deployment remain pending.

## Run activity complete / KAN-22 active

KAN-21 is Done: PR #31 merged as `9a6ec94`, after 1141 units, 89 API cases, 7 safety,
8 Chromium flows, static/build/audit0 and independent review. Exact-head CI `37691691372`
and main CI `37692077100` passed. Vercel `6921729060` and Render `6921725234` succeeded;
both served identities match, health/readiness and signed-out guards pass, SPA run route is 200.

KAN-22 begins from this verified build. Explicit approved-parent queued children preserve
assignments, bind exact source version/digest, derive owned bounded ancestry and keep separate
execution/review. No transaction, automatic model call, task/project write, paid service or
Figma gate. Implementation and full local validation passed: 1233 units, 101 real API cases, 7 safety tests, 9 Chromium flows, static/build/audit0 and independent review. Protected CI/merge/live verification remain pending; no delivery claim yet.

## Handoffs complete / KAN-23 active

KAN-22 is Done: PR #32 merged `ff1393e`; 1233 units,101 realAPI,7 safety,9 Chromium,
static/build/audit0 and independent review passed. Exact-head CI `37694886733` and main CI
`37695477556` passed. Vercel `6922259119` and Render `6922255006` succeeded; both served
identities match, health/readiness200 and invalid-auth handoff history401/no-store.

KAN-23 implements explicit bounded Chief of Staff draft recommendations. No task changes
are applied by review. 1291 units, 110 real API cases, 7 safety and full browser artifact
passed; local Ollama Chief structured smoke passed with no database/production calls and owned
runtime shutdown. Initial independent code review passed. Final affected review and protected
CI/merge/live deployment remain before Done; implementation checkpoint is `3b37766`.

## One-time delivery optimization (KAN-43, 2026-10-08)

Complete: PR #33 merged `a76feed` after docs/static checks, independent review, PR CI
`37782581764`/main CI `37783095581` and matching live frontend/API identities. No production
code/data, hosting/security or cost change. The preserved KAN-23 work resumes under this policy;
do not repeat the one-time setup on continuations.

## KAN-23 complete / KAN-25 active

KAN-23/PR #34 is Done, merge `1c7d784`: independent review, PR/main CI and matching
live client/API identity passed; availability and invalid-token guards verified read-only.
KAN-25 extends the existing explicit Run workflow with supplied-source research. Up to3
labelled text excerpts plus owned notes/approved parent output are frozen under16KiB;
reference URLs are metadata only. Quotes must match captured text, while interpretations
and inferences remain unverified and subject to human review. No task writes, paid calls,
new service, production inference or Figma. QA/review/protected delivery are pending.

## KAN-25 complete / KAN-26 active

Research shipped as PR #35/`faf2c6c`, with1310 units/120 real API/11 browser/7 safety,
static/types/build/audit0, actual local Ollama smoke and independent review passed.
PR/main CI, provider statuses and matching served identities passed; health/ready200,
invalid-auth research401/no-store. Original assignment WIP and production data preserved.

KAN-26 Developer proposes bounded technical plans/code suggestions as unexecuted text,
with existing explicit mode/current permission/exact human review controls. Targeted schema,
real API (including the separately approved Chief→Research→Developer handoff chain) and
browser passed. Actual local Ollama all-three starter smoke passed, simulationfalse,
database/productioncalls0; owned runtime66112 stopped. Full units/127 real API/12 browser/7 safety/static/types/build/audit0 and independent review
passed. Protected delivery remains pending. Owner milestone closure is required afterward; Phases3–8 remain unapproved.

## Phase 2 formally closed (owner acceptance, 2026-10-08)

Josh explicitly approved: "Formally close Phase 2 — AI Workforce." [KAN-26](https://taskforgejms.atlassian.net/browse/KAN-26)
is Done; earlier checkpoints above are historical. [PR #36](https://github.com/WasteOfADrumBum/TaskForge/pull/36)
shipped Developer text plans and final acceptance as `13d34d117dc369119ec15786afeab476b783187a`.
[Phase closure evidence and limits](phases/phase-2-ai-workforce.md#closure-summary-2026-10-08)
retain tests/review/PR-main CI/provider/release proof. Documentation closure is a separate
reviewed PR; application behavior is unchanged. Phases3–8 remain unapproved.

Keep the KAN-43 optimized delivery procedure, $0 additional recurring cost, production real-AI
disabled/explicit labelled simulation, original assignment WIP and Figma exclusion. Free-tier
sleep/cold-start/resource limits and manual recovery remain; no paid uptime guarantee. Actual
inference requires a trusted local Ollama daemon; Render cannot reach an owner's localhost.
Quotes establish attribution, not factual truth; generated code is unexecuted/unverified text.
No autonomous repository/data action is enabled. Production CRUD and private restore are not
established by the read-only live probes or isolated local fixtures.

## Phase 3 approved / KAN-44 active (2026-10-08)

Josh approved bounded Knowledge & Cited Retrieval; [KAN-27](https://taskforgejms.atlassian.net/browse/KAN-27)
is active with seven coherent tickets KAN-44–50 and dependency links. Phases4–8 remain unapproved.
Actual Atlas FREE/version8.0.34/search workflow eligibility verified read-only; no index/service
or production data change. See [Phase3 checkpoint](phases/phase-3-knowledge.md).

KAN-44 source/query validation and pure keyword matching have18 targeted passing tests and
format/lint checks. No API/storage/UI is shipped. Continue owner-scoped persistence, atomic
version/bounds/deletion, routes and real Mongo QA, then required full validation/independent
review/protected PR-main CI/deployment. Pause at insufficient usage, preserving the checkpoint.
Original assignment WIP, KAN43 optimized delivery, $0 recurring cost and Figma exclusion remain.

## KAN-44 resumed: private storage and cited keyword API

Current branch preserves fbb0cc0 and its18 tests. Source persistence/API, exact version/digest
CAS, atomic safe mutation audit,50 active slots, deletion invalidation and bounded literal
keyword results are implemented;22 targeted units/26 real Mongo cases and full local QA pass. Independent review
verified two concurrency corrections; no outstanding findings. Protected delivery remains before Done. [Knowledge API](knowledge.md)
documents private owner/project boundaries and retained metadata/free-tier limits. KAN-45 UI
follows; no model, paid call, Figma or Phase4–8 work is enabled.

## Phase3 private knowledge checkpoint

KAN-44 is Done: PR #38 (`7fe3aaf`), independent review, 1,352 unit tests, 153 real API tests,
12 browser checks, 7 fixture safeguards and exact-head/main CI passed. Vercel/Render succeeded;
frontend/API release identities match `7fe3aaf`; health/readiness and invalid-token guards passed.
KAN-45 implements the hosted private workspace on its branch; final delivery gates are pending.
Atlas Free eligibility is verified, not an executed Search/Vector Search index benchmark.
No production test records/model calls, new cost, Figma or Phase4–8 implementation.
