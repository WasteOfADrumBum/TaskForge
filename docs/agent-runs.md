# Owned agent run foundation

KAN-17 adds persisted run records and private server state transitions. It does not execute an agent, invoke AIProvider, start a worker, apply task changes or expose human approval controls. Model execution waits for KAN-18 permission/audit safeguards; the approval workflow follows in KAN-19.

## Owned API

All routes require the existing JWT authentication and return `Cache-Control: no-store`. Another owner's run is indistinguishable from a missing run.

| Route                        | Current behavior                                                                |
| ---------------------------- | ------------------------------------------------------------------------------- |
| POST `/api/runs`             | Create an owned queued record; same retry key/input returns the existing record |
| GET `/api/runs`              | Latest 100 owned records, newest first                                          |
| GET `/api/runs/:id`          | Owned detail or 404                                                             |
| POST `/api/runs/:id/execute` | Owned lookup then 503 until safeguards exist; foreign/missing 404               |

Create accepts `taskId`, `agentId`, and a nonblank input up to 8000 characters, plus a stable `Idempotency-Key` header (16–128 letters/digits/dot/underscore/hyphen, beginning with a letter or digit). The task must be owned and assigned to that owner's active agent. Reusing a key with different input/references returns 409. Uppercase ObjectId spelling is normalized for retry identity.

Owner, status, version, context, result and execution fields are server-controlled; client attempts to set them are ignored. Context begins as `{}` until the context ticket; result begins null. JSON context/result limits are 16KiB/64KiB, with depth and node limits. Fingerprints and attempt IDs are omitted from public JSON. There are no PATCH, DELETE, approval or result-application endpoints.

## State and concurrency

Private helpers implement queued → running → awaiting-approval → approved/rejected. Queued or running work can fail; approved, rejected and failed are terminal. Every update requires the owner, current status and version. Running completion/failure also requires its specific attempt token; stale actors cannot overwrite a later transition. Claiming rechecks current task assignment and active agent state.

The private claim has a work deadline of at most 120 seconds and a lease five seconds longer. Completion requires both unexpired. Explicit owner-scoped recovery can mark expired running work failed, using the current version/attempt fence. No work is automatically restarted, resumed or replayed. Interrupted/ambiguous inference must not be described as successful.

These are state-machine primitives, not authorization to execute or a durable job-delivery guarantee. The later permission/audit executor must enforce its safeguards before using them; human review must precede any application of output.

## Index readiness and free-tier strategy

The unique `{ owner, idempotencyKey }` index is acknowledged before any create lookup or write. A lazy single-flight native index operation works even with Mongoose autoIndex disabled; caller and server-side index deadlines are five seconds. Errors/timeouts fail closed with a generic 503. Unfinished driver work remains shared until it settles; a later explicit request can try again. No automatic retry, data deduplication or startup bulk recovery is performed.

Use existing MongoDB/Mongoose and the API process; no new queue, scheduler, transaction architecture, hosted service or migration. This adds a new run collection and its indexes, with no changes to existing task/project/agent/user data. The real persistence suite starts its own fresh loopback `_runs` child database, checks zero existing collections before writing, and proves concurrent first creation without a prebuilt unique index. Production QA uses read-only identity/availability/auth checks.
