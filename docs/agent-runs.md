# Owned agent runs and draft permissions

KAN-17 introduced owned run records; KAN-18 adds server-enforced text drafting and append-only application audit. KAN-18 is shipped (PR #28, `bb660e2`). KAN-19 shipped exact-draft human review on Agent Detail (PR #29, `978c623`). KAN-20 adds locally validated minimal context; delivery verification is pending. Full run/activity and execution controls remain KAN-21. No task or project mutation tool is enabled.

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
