# AI provider contract

KAN-15 adds the server contract; KAN-16 adds explicitly configured local developer inference. Neither implements agent execution. Production stays disabled and no paid API is called. User run controls, ownership/permission enforcement, audit and human approval are subsequent Phase 2 tickets.

## Production default and explicit simulation

Josh approved production execution disabled by default on 2026-10-06. `AI_PROVIDER` is optional; missing, empty or `disabled` configuration disables execution. `demo` configuration also leaves the default disabled: the server caller must explicitly select `mode: 'demo'`. This selection does not persist a preference or silently replace failed inference. Unknown configuration is invalid. Outside production, `AI_PROVIDER=ollama` selects the local adapter with `OLLAMA_MODEL` and an optional loopback `OLLAMA_BASE_URL`. In production, Ollama configuration resolves to disabled. A previously constructed local adapter also rejects calls after an environment switch to production. No paid API key, cloud model or external provider URL is accepted.

```ts
import { resolveConfiguredProvider } from '../ai/provider';

const disabled = resolveConfiguredProvider({ configuredProvider: 'disabled' });
const demo = resolveConfiguredProvider({ configuredProvider: 'disabled', mode: 'demo' });
const result = await demo.chat([{ role: 'user', content: 'Show a demonstration' }]);
// result.simulation === true; result.label says no AI model was called.
```

Demo output is fixed canned text, unrelated to the input. Structured demo output is `{ summary: string, simulated: true }`; a requested schema that does not accept that shape is rejected. Consumers must retain/display the simulation flag and label, never represent canned output as model inference, and never apply results automatically. Selection by users will be wired with run/permission/approval controls in the later tickets.

## Capabilities and errors

`AIProvider` exposes chat, structured output and embeddings. Structured output requires a caller-supplied runtime type validator; TypeScript types alone do not validate model data. Adapter errors are sanitized, and invalid/mismatched output is rejected before returning results. Embeddings require explicit pinned developer-local configuration under KAN-46 (branch delivery pending); disabled and demo providers remain unsupported. No retrieval/indexing endpoint is added here.

Calls accept an AbortSignal and a bounded deadline (30 seconds by default, allowed range 1–120,000 milliseconds). The signal reaches the adapter, and interrupted results cannot be returned to the caller. A reusable provider instance holds its BUSY guard until underlying adapter work settles, even if the adapter ignores cancellation. Reuse the instance; do not create a new one for every retry. An uncooperative adapter may require restarting that instance/process; the contract cannot kill arbitrary adapter work or preempt synchronous code. There is no automatic retry.

Errors have safe `AIProviderError.code` values: DISABLED, INVALID_CONFIGURATION, UNAVAILABLE, INVALID_REQUEST, INVALID_OUTPUT, UNSUPPORTED, CANCELLED, TIMEOUT and BUSY. Internal provider failures never expose credentials, raw response bodies or prompts.

## Read-only status

Authenticated `GET /api/ai/status` returns safe default/capability metadata with `Cache-Control: no-store`. Unknown environment values are normalized to `invalid`, not echoed. Query parameters cannot enable execution. The route does not access user data, create runs, write MongoDB or contact a model. Explicit execution and human review are available through the owned Run API; see [run controls](agent-runs.md). Local configuration reports `not_verified`; status never probes, records runtime availability or promises a model is online. Render cannot reach an owner's localhost.

## Boundaries

The contract is independent of client UI and vendor SDKs. Future providers plug into a trusted server adapter boundary; configuration does not load arbitrary code. Production remains at $0 paid AI API calls. This work does not add hosting, auth or database architecture, external services, background jobs, or Phases 3–8 functionality.

## Local Ollama setup and trust

Install the [official Windows CLI](https://docs.ollama.com/windows) or use its portable release; keep the daemon on numeric loopback. Enable `OLLAMA_NO_CLOUD=1` in the daemon process before startup, as documented in [Ollama local-only configuration](https://docs.ollama.com/faq). Pull a small local model explicitly; the application never installs, pulls or downloads one. Example PowerShell developer settings:

```powershell
$env:NODE_ENV = 'development'
$env:AI_PROVIDER = 'ollama'
$env:OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
$env:OLLAMA_MODEL = 'qwen3:0.6b'
npm run test:local-ai -- --local-only
```

The separate daemon must already be running with cloud disabled and that model installed. The smoke command sends synthetic inputs, loads no dotenv/database credentials, verifies real chat and schema-guided structured output, and rejects production or missing opt-in settings before model traffic. It uses the existing bundled QA tooling. Production should retain `AI_PROVIDER=disabled`; the adapter additionally enforces production disabling. The provider foundation itself added no UI; run controls subsequently shipped under KAN-21.

Only `http://127.0.0.1`, `http://[::1]` or the `localhost` alias (pinned to 127.0.0.1 before fetching) are accepted. Optional ports are allowed; credentials, query/fragment, non-root paths, alternate IP aliases and redirects are rejected. Before sending messages, the adapter checks local GGUF/completion model metadata and rejects cloud names or remote model/host metadata. The daemon and model storage are **trusted local operator resources**: keep cloud disabled and do not remap/replace a model concurrently with a call. Metadata preflight cannot prevent a malicious local proxy from lying or forwarding prompts; it is not a sandbox or remote-attestation boundary.

Local calls use non-streaming JSON, thinking disabled, temperature 0, 256 generated chat tokens / 512 structured-output tokens and a 2048-token context. Only a normal `stop` completion is returned; truncated/incomplete results fail even if they contain valid JSON. Read both metadata and inference bodies within the same caller deadline/signal and a 1MiB per-response limit. Optional JSON-schema metadata guides generation, and the caller's synchronous runtime validator still checks the returned data. Chat behavior is unchanged. Optional pinned embeddings follow the separate contract below; there is no retry or silent simulation fallback.

Actual QA used a checksum-verified portable Ollama 0.40.0 process bound to 127.0.0.1:11435 with cloud disabled and an isolated model cache. Synthetic chat and structured output passed with qwen3:0.6b; this small fixture is not a quality benchmark or production model recommendation. The portable archive is approximately 1.5GB compressed, with additional binary/model disk and memory needs; [official resource guidance](https://docs.ollama.com/windows) explains installation requirements. QA starts no permanent service or cloud account.

## Pinned developer-local embeddings (KAN-46, delivery pending)

Explicitly set `OLLAMA_EMBEDDING_MODEL=all-minilm:l6-v2` only after manually provisioning the
[official model](https://ollama.com/library/all-minilm:l6-v2). The application never pulls/downloads
models. Missing/empty setting leaves embeddings unsupported; other model names fail configuration.
Production remains disabled, including a previously constructed provider and mid-call environment
switches. Simulation never produces fake embeddings. Chat/structured behavior stays unchanged.

Actual isolated Ollama0.40.0 QA verified GGUF/BERT, 46MB stored model, 512 context and 384 dimensions.
The required full manifest digest is
`1b226e2802dbb772b5fc32a58f103ca1804ef7501331012de126ab22f67475ef`.
Before document traffic, `/api/tags` verifies that exact manifest and `/api/show` verifies local
embedding capability/architecture/context/dimensions. Wrong/remote/missing metadata fails closed;
no auto download, retry, alternate model or hosted fallback. The local daemon/storage remains a
trusted operator resource; do not rename/replace tags while calls run. Metadata is not attestation.

`AIProvider.embed` accepts1–4 nonblank texts, at most2,000UTF8bytes each/8,000total. Caller input is
snapshotted before awaiting. [Ollama `/api/embed`](https://docs.ollama.com/api/embed) uses
`truncate:false`,512context and `keep_alive:0`; over-token-budget inputs fail rather than silently
truncate. Byte bounds do not guarantee tokenizer fit. Response bodies remain capped at1MiB.
The vector count/dimension must match, every coordinate/norm must be finite and vectors nonzero.
Both metadata and inference share the existing deadline/cancellation/BUSY guard, including late
uncooperative settlement and chat contention. Reuse one provider instance; no automatic retries.

Embed results include immutable `embedding:{model,digest,dimensions}` and the actual non-simulation
provider label. KAN-47 chunk storage must persist/compare this full identity for indexing and queries;
this provider ticket adds no database vectors, ingestion jobs, API permissions or semantic UI.
Read-only status reports configured local capability as `not_verified`, never online availability;
production and demo continue to report embeddings false without calling any model.

Explicit synthetic verification (daemon already running/cloud disabled, model manually installed):

```powershell
$env:NODE_ENV = 'development'
$env:AI_PROVIDER = 'ollama'
$env:OLLAMA_BASE_URL = 'http://127.0.0.1:11435'
$env:OLLAMA_MODEL = 'qwen3:0.6b'
$env:OLLAMA_EMBEDDING_MODEL = 'all-minilm:l6-v2'
npm run test:local-ai -- --local-only --embeddings-only
```

The existing chat model setting remains required to construct the combined local provider, but this
smoke makes only embedding calls. It loads no dotenv/database credentials and uses synthetic text.
Actual smoke returned3 finite normalized384-vectors: related cosine0.8335, unrelated0.0843 and same-text1.0.
This is a capability/sanity check, not the Phase3 relevance evaluation or a production quality claim.
Hosted keyword retrieval remains available without any model; semantic/Ask follows later tickets.
$0 paidcalls/new recurringcost; no Figma/Phase4–8 expansion.
