# Owned agent runs and draft permissions

KAN-17 introduced owned run records; KAN-18 adds server-enforced text drafting and append-only application audit. KAN-18 is shipped (PR #28, `bb660e2`). KAN-19 shipped exact-draft human review on Agent Detail (PR #29, `978c623`). KAN-20 shipped bounded minimal context (PR #30, `c06dc63`), with full QA, independent review, PR/main CI and matching live builds. Full run/activity and execution controls shipped under KAN-21 (PR #31, `9a6ec94`), after protected CI and matching live deployment verification. No task or project mutation tool is enabled.

## Owned API

All routes require the existing JWT and return `Cache-Control: no-store`. Another owner's run is indistinguishable from a missing run.

| Route                                  | Behavior                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| POST `/api/runs`                       | Create an owned queued record; same retry key/input returns it                                                                          |
| GET `/api/runs`                        | Latest 100 owned records, newest first                                                                                                  |
| GET `/api/runs/approvals?agentId=<id>` | Latest 100 owned awaiting-approval drafts, optionally filtered by agent                                                                 |
| POST `/api/runs/:id/review`            | Human approval/rejection bound to the reviewed version and result digest                                                                |
| GET `/api/runs/:id`                    | Owned detail or 404                                                                                                                     |
| POST `/api/runs/:id/execute`           | Explicit demo/local mode with optional boolean includeProject (default false); permitted queued work produces a draft awaiting approval |
| POST `/api/runs/:id/cancel`            | Fail owned queued/running work; terminal work cannot be cancelled                                                                       |
| GET `/api/runs/:id/audit`              | Owned lifecycle metadata                                                                                                                |
| GET `/api/runs/audit/denials`          | Latest 100 owned denial events                                                                                                          |

Create accepts `taskId`, `agentId`, and a nonblank input up to 8000 characters, plus a stable `Idempotency-Key` header (16–128 letters/digits/dot/underscore/hyphen, beginning with a letter or digit). The task must be owned and assigned to that owner's active agent. Reusing a key with different input/references returns 409. Uppercase ObjectId spelling is normalized for retry identity.

Owner, status, version, context, result and execution fields are server-controlled. Context begins as `{}`; result begins null. Context/result limits are 16KiB/64KiB with depth/node limits. Fingerprints and attempt IDs are omitted from public JSON. There are no PATCH, DELETE or result-application endpoints. Approval records the human decision; it does not change tasks or projects.

## Permissions and provider modes

Execution checks the current persisted owned task assignment, active owned agent, and both `task.read` and `artifact.draft`. Unknown or missing permissions deny access. Caller-provided owner, permissions and context cannot grant authority. Checks repeat after claiming and before draft persistence; changed assignment or revoked permission rejects the draft.

KAN-20 adds only permitted owned task/project notes in an attributable snapshot. Project inclusion is opt-in and requires `project.read` before any project lookup, plus current permission rechecks. The input and snapshot are serialized user-role JSON under fixed draft-only instructions. Write permissions do not enable automatic changes.

Simulation requires explicit `demo` selection and stores the provider's clear canned-response label. Missing/invalid mode is rejected. Actual inference requires explicitly configured local Ollama outside production; production local mode returns unavailable. There is no paid/cloud fallback. Successful output stores `{ text, provider, simulation, label }` and stops at `awaiting-approval`.

The executor defaults to 30 seconds (trusted internal configuration may reduce it or increase it to at most 60 seconds). Provider instances are reused per mode, with at most one active call per mode; configuration changes require process restart so a hung adapter cannot be replaced to bypass its guard. Provider deadlines and cancellation remain enforced.

## State, cancellation and concurrency

Each state update requires owner, current status and version. Running completion/failure also requires its attempt token. Claiming rechecks assignment/active agent; completion requires unexpired work deadline and lease. A cancellation that wins the atomic update fences out later completion before aborting local inference. A draft already committed may win a concurrent cancellation; terminal work is immutable.

Disconnected execution requests abort the local attempt and attempt an audited failed transition. Cancellation/failure persistence errors cannot produce a successful response; explicit inspection/recovery is needed for ambiguous state. Expired work can be explicitly marked failed without replay. No startup recovery, automatic restart, retry or background worker is added.

Task, agent and run checks occur at use boundaries in separate MongoDB queries. They do not provide transactional revocation across collections. Output remains a read-only draft requiring later human approval; no write tools are enabled.

## Audit boundary

New run creation and every lifecycle transition append safe actor/action/time/status/version metadata in the same atomic insert/update. Standalone denial records never advance a running version or attempt fence. Audit persistence failure stops execution before a model call. Input, context, task/project content, output and tokens are excluded from audit metadata.

Ordinary application model mutations that remove or replace audit history are blocked, including bulk operations. The interface is append-only; trusted raw database administrators remain outside that guarantee. Previously created runs receive no fabricated history or backfill.

## Persistence and verification

The unique `{ owner, idempotencyKey }` index is acknowledged before create lookup/write. A lazy single-flight native operation works with autoIndex disabled; caller/server index deadlines are five seconds. Errors fail closed with generic 503; a later explicit request can try again. No automatic retry, data deduplication or startup bulk recovery occurs.

Use existing JWT/MongoDB/Mongoose and the API process. No queue, scheduler, transaction architecture, hosted service, production migration or paid cost is added. Real API suites use fresh loopback child databases with zero-existing-collections guards; no production credentials, resets or drops. Production QA is read-only identity/availability/auth verification.

## Human review (KAN-19)

Agent Detail shows up to 100 pending drafts for that agent, with requested work, proposed output, explicit simulation/local label and an optional note. Approve/reject sends the exact displayed Run version and server-computed canonical result digest. Saving locks the selection and decision controls; uncertain/stale decisions require a fresh read before another attempt. Session changes, unmounts and cancelled/replaced reads cannot update a new view. No write is automatically retried.

`POST /api/runs/:id/review` accepts `decision` (`approved` or `rejected`), `version`, `resultDigest` and optional plain-text `note` up to 2000 characters. The atomic owner/status/version/result comparison uses literal whole-value equality, so query-shaped JSON, scalar/array changes and strings beginning with `$` cannot weaken the result fence. Stale, duplicate and concurrent losing decisions return 409; missing/foreign runs return 404. Review/audit failures do not approve work.

The owned Run stores decision, note, time, reviewed version and result digest. Lifecycle audit stores decision/version/digest metadata without raw note/input/output. Approval does not delegate agent write permissions or apply any task/project content. Full history and execution controls follow in KAN-21.

## Minimal context (KAN-20)

New mode-selected claims persist `context` and `contextDigest` in the same atomic lifecycle update. Context has `schemaVersion: 1`, `untrusted: true` and up to two `sources`: task (`kind`, `id`, `updatedAt`, `title`, `description`) and optionally project (`kind`, `id`, `updatedAt`, `name`, `description`). Only an owned assigned task and its owned project may supply these fields. Owner/email/agent fields, unrelated records and caller-supplied context are excluded.

The serialized UTF-8 snapshot must fit the existing 16KiB JSON/depth/node limits. Invalid or oversized sources fail before model invocation; safe denial reasons never contain raw notes. The claim audit holds only the context digest. Ordinary application mutations cannot replace the snapshot, its digest or nested fields after claim. Old runs/private mode-null state helpers receive no fabricated snapshots or backfill.

`includeProject` must be a boolean and defaults to false. Explicit selection requires current task.read, artifact.draft and project.read. Missing/deleted/foreign records or revoked permissions fail closed. Checks run initially, during the fresh claim, before invocation and before output persistence. Compare the full task/project source identity set, including no-project state: an opted-in null-to-project change or project switch rejects the attempt. Unrequested project changes remain irrelevant to task-only runs.

Edits to notes on the same source retain the captured as-of content and source update time for reproducibility. Separate MongoDB checks do not provide transactional revocation or a latest-data guarantee. Stored text remains untrusted user data; fixed roles and absent tools prevent privilege promotion/execution, but no general LLM prompt-immunity claim is made. No RAG, ingestion or task/project mutation is added. Full run/context activity UI follows in KAN-21.

## Run activity UI (KAN-21, shipped)

The Workforce and Agent Detail pages link to `/workforce/runs`; each recorded attempt
opens `/workforce/runs/:id`. The list is the latest 100 owned records, not an exhaustive
history. A client agent filter is labelled a subset of that latest-100 window.

Create a queued run for a task assigned to an active agent. Creating or assigning work
calls no provider. Open its detail, choose a mode explicitly, and request execution.
Simulation is canned output with no model call; local inference appears only where the
server reports a configured local capability, with availability explicitly unverified.
Project notes default off and still require persisted server permission.

Detail shows the stored request/output, frozen as-of context, status/failure reason,
review decision and lifecycle audit. Stored text is escaped plain text. Approval records
a decision, with no task/project changes. Safe reads can be cancelled and manually
refreshed. Uncertain writes do not replay automatically: refresh before another action;
an identical manual creation retry retains the same key within that page/session.
Navigating away retires the request; it does not promise to roll back persisted work.

Full QA and independent review passed: 1141 units, 89 API cases, 7 safety tests, 8 Chromium flows and static/build/audit0 checks. PR #31, main CI and matching live builds are verified.

## Explicit handoffs (KAN-22, shipped)

POST `/api/runs/:id/handoff` binds the exact approved parent version/result digest,
selected target task/agent, request and Idempotency-Key. GET `/api/runs/:id/handoffs`
returns the latest 100 owned direct children; foreign parents remain indistinguishable
from missing ones. Run Detail shows parent/child links and explicit queued creation.

The target task already belongs to the owner and is assigned to the selected active agent.
This can be another owned task or the same task after an explicit user reassignment;
the handoff changes no assignment. Three edges maximum, no repeated ancestor agents.
Every child starts queued with no result or review, waits for explicit execution mode,
and needs separate human review. Cancellation/failure affects only the selected run.

Immutable server-derived handoff metadata and the child creation audit retain parent,
source version/digest and ancestry. Execution revalidates those owned approved records at
existing permission boundaries. Only approved output text is added to bounded untrusted
context, never source input, review notes or entire source context. Oversize fails closed
before child creation or model use; ordinary mutations cannot replace the lineage.

Same-owner/key/complete payload returns one child. Uncertain UI creation freezes native
fields and requires successful read refresh before an identical manual retry. No automatic
writes/model calls, queue, migration or paid service is introduced. Full local QA/review passed 1233 units, 101 API cases, 7 safety, 9 Chromium and static/build/audit0. Protected CI, PR #32/`ff1393e` and matching live builds passed.

## Chief of Staff workflow (KAN-23, shipped)

Explicit execute requests may choose workflow chief-of-staff; omitted workflow stays draft.
The audited claim freezes selection. Chief snapshots task priority/status and a deterministic
first-20 owned active read/draft candidate window, filtered for known permissions after the limit,
with field allowlisting and current permission/source
rechecks. Structured proposals are restricted to that task, captured candidate IDs or null,
known priorities and bounded exact-key text. Local inference uses structured output; explicit
rule-based simulation calls no model. Proposal review records a decision, never applies priority
or assignment changes. Actual local Ollama proposal smoke, local QA, protected PR #34/`1c7d784`
and matching live builds passed. The bounded window is not exhaustive; corrupt/legacy definitions can consume
slots. A proposal never grants permission to reassign, run or hand off work.

## Supplied-source Research (KAN-25, shipped) / Developer (KAN-26, active)

Execute selects workflow research or developer; omitted workflow is still draft. Research accepts
up to3 explicit title/text/optional HTTP(S) referenceUrl excerpts, each text≤4000 characters,
under the same16KiB immutable context. URLs are metadata only, never fetched. Native quote enums
use source openings≤400 characters after leading whitespace; consumer validation checks captured
source IDs and exact text. Matching a quote establishes attribution, not factual correctness.

Developer returns strict bounded summary/plan/codeSuggestion/checks/limitations as data. Its
formatted output labels code unexecuted/unverified and checks as proposed, not run. No repository
read/write, execution, tool, task/project write or automatic action exists. Both workflows require
current owned active read/draft permissions, optional project.read, structured capability, explicit
simulation/local mode and exact human review. Production real inference stays disabled. Local
structured output is bounded512 tokens/chat256; truncation/invalid output fails without replay.
