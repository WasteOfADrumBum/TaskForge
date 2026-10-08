# Bounded private knowledge API (KAN-44)

Implemented on the active branch; protected delivery is pending. The hosted API performs real
keyword retrieval without models, embeddings or simulation. KAN-45 supplies its UI; agent
knowledge permissions and local semantic/grounded drafts follow under KAN-46–49.

## Owned sources and exact writes

All `/api/knowledge` endpoints require the existing human-owner JWT and return no-store.
Every lookup/write scopes owner server-side; request owner/audit/slot fields are rejected.
Optional project IDs must currently belong to that owner. A deleted project does not delete
owned knowledge; project-filtered access fails until the association is changed or removed.
No agent executor/tool receives access in this ticket.

- POST `/api/knowledge`: full `{title,content,kind,project?}` plus Idempotency-Key. Kind is
  note or text; retry same key/payload returns the current owned source without another insert.
  Changed payload/deleted source conflicts; no resurrection or automatic retry.
- GET `/api/knowledge`: up to50 active source summaries, optional owned project filter.
- GET `/api/knowledge/:id`: current exact source text/version/contentDigest.
- PUT `/api/knowledge/:id`: full source input plus exact version/contentDigest shown to the owner.
  Atomic compare-and-set advances version/digest with its metadata audit event; stale writes409.
- DELETE `/api/knowledge/:id`: exact `{version,contentDigest}`. Soft deletion atomically clears
  title/content/project and frees its active slot. Only minimal tombstone/audit metadata remains;
  source reads/search exclude it. No source-content restore/purge operation is provided.
- GET `/api/knowledge/:id/audit`: owned metadata lifecycle, including deleted-source history.
- GET `/api/knowledge/audit/denials`: latest100 owned safe denial metadata, never raw input/query.

Creation acknowledges ordinary unique owner/slot and owner/retry-key indexes before insertion.
At most50 active sources per owner is enforced by bounded unique slots, including concurrent
creates. Three bounded allocation attempts then an explicit retry conflict, never a hidden loop.
Edits are bounded to version100; final audited deletion is still possible at version101. Model
hooks reject ordinary unaudited writes, identity replacement and audit edits. Direct database
administrators are outside the application boundary. New collections/indexes are additive;
no existing production records are migrated or modified by deployment.

## Keyword results and provenance

GET `/api/knowledge/search?q=...&project=...` returns `{mode:'keyword',modelUsed:false,results}`.
Boundaries: content≤20000 UTF8 bytes, title≤120 characters, query≤120UTF8 bytes/8 literal terms,
≤50 current source candidates, ≤10 results and ≤240-code-unit excerpts. Five-second DB/index
budgets and bounded index acknowledgement limit each request. Unique active slots enforce the
candidate bound without relying on a silently truncated arbitrary corpus.

Literal case-insensitive matches rank title hits twice body hits with stable ID tie ordering.
Title-only matches are explicitly marked; a body excerpt is not claimed to contain the query.
Each result carries sourceId/version/contentDigest and exact content offsets/quote. Fetch the
current owned source to check the version/digest and exact substring; changed/deleted sources
invalidate a prior result. Results reflect the canonical read snapshot, not a durable citation
or factual verification. Concurrent later edits require a refreshed source. No external URLs,
Atlas Search/vector index, paid automated embeddings/reranking, model or network retrieval occurs.

## Limits and validation

Actual Atlas FREE/MongoDB8.0.34/search eligibility was inspected read-only before this design.
Ordinary indexes/current-source matching avoid search-index propagation dependency; local real
Mongo tests verify actual native indexes/queries and concurrency. Atlas UI eligibility alone is
not an executed Atlas Search-index benchmark. Semantic indexing remains a later approved ticket.

Tombstone and append-only denial metadata accumulate and count toward shared free-tier storage;
no automatic purge, paid scaling, uptime guarantee or production backup proof is implied.
Optional project references may become orphaned during independent project deletion, but project
filters revalidate ownership/existence and never dereference foreign project content. Sources and
quotes are untrusted plain data. Body/query/metadata corruption fails closed with safe errors.

Targeted22 units (original18 retained) and26 real Mongo/API scenarios pass, including bounds,
idempotency/capacity/atomic races, owner/project isolation, current/deleted/stale provenance,
audit storage/index failures and literal hostile text. Full local QA passed, with affected reruns after two independently reviewed concurrency fixes. Protected CI/live gates remain.

## Private workspace (shipped KAN-45, PR #39)

Use **Knowledge** in the sidebar to paste private notes or text documents and optionally associate
an owned project. Keyword search returns exact source excerpts and version-linked detail pages;
opening an excerpt rechecks its ID/version/digest/offsets against the current owned source.
An edit invalidates earlier citations. Text is untrusted plain data: no rendered HTML, fetched URLs,
hidden AI calls or simulation. Hosted semantic/AI answers remain unavailable until later delivery.

Edits/deletes send the displayed version/digest; conflicts require an explicit refresh that discards
unsaved edits. Delete requires confirmation and clears text while retaining audit metadata.
Uncertain saves require a successful list refresh and an explicit manual retry of the same input/key;
check existing sources before explicitly starting another source. There are no automatic retries.
Changing route/session retires pending operations and loaded private text. All server limits and
free-tier metadata-growth/local-only AI limitations above still apply.

## Versioned local indexes (KAN-47 branch, delivery pending)

Explicit developer-local indexing uses KAN-46's pinned384-dimensional embeddings. A source has
one private current index stored in the same MongoDB document, excluded from ordinary source/
keyword queries and API output. Native atomic source version/digest checks install chunks+vectors
and an indexed audit event; source edits/deletes clear vectors in the same update. Concurrent stale
completion fails; no historic vectors are retained. Wrong model/source/chunk provenance fails closed.

Chunking preserves exact source offsets/digests, Unicode code points and untrusted plain text. Malformed lone Unicode surrogates are rejected before BSON can silently replace them; valid paired emoji remains supported.
Each nonblank chunk is at most480UTF8bytes; at most48per20kbyte source,4per embedding batch,
50active sources/2,400chunks per owner. A reusable explicit local indexer has a60second default/
120second max operation budget and bounded Mongo work; cancellation/uncertain commit does not
trigger retry. Re-indexing an already valid current source reuses its vectors without a model call.
The source edit limit remains100; success audits are capped at201events including source versions,
one index per version and final deletion. Metadata tombstones continue to consume the shared quota.

This avoids a hosted worker/service and Atlas Search/Vector Search dependency. Actual Atlas Free
metadata eligibility is already verified; no live Search index was built/benchmarked. Native BSON,
owner indexes and atomic updates are exercised against real isolated MongoDB. Vectors increase
storage usage inside the existing512MB shared Free allowance, not the allowance itself. No automatic
cloud inference, downloads, pruning, production data migration, paid scaling or background indexing.

Current-index reads are owner/project scoped and validate full pinned identity and source text
provenance. They are snapshots; KAN-48 must recheck current source/permission/citation state before
publishing grounded results. Semantic scoring/agent knowledge permissions/Ask UI are still planned.
Actual synthetic local Mongo+Ollama end-to-end QA covers persistence/foreign owner/edit/delete
invalidation; it does not prove hosted inference or production CRUD. Figma remains excluded.

To verify locally with the pinned daemon already running/cloud disabled (same local environment
as [embedding smoke](ai-provider.md#pinned-developer-local-embeddings-shipped-kan-46-pr-40)):

```powershell
npm run test:local-ai -- --local-only --index-only
```

The harness provisions only a fresh loopback Mongo namespace, strips normal Mongo/demo credentials,
refuses existing collections and performs synthetic index/update/delete checks. It never reads
production configuration or resets an existing database. It starts no permanent daemon/service.
