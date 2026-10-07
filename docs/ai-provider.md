# AI provider contract

KAN-15 adds a server-only contract, not agent execution. No model or paid API is called. User run controls, ownership/permission enforcement, audit and human approval are subsequent Phase 2 tickets.

## Production default and explicit simulation

Josh approved production execution disabled by default on 2026-10-06. `AI_PROVIDER` is optional; missing, empty or `disabled` configuration disables execution. `demo` configuration also leaves the default disabled: the server caller must explicitly select `mode: 'demo'`. This selection does not persist a preference or silently replace failed inference. Unknown configuration is invalid; `ollama` is unavailable until its KAN-16 adapter is implemented. No provider URL or paid API key is accepted in this ticket.

```ts
import { resolveConfiguredProvider } from '../ai/provider';

const disabled = resolveConfiguredProvider(); // chat rejects with DISABLED
const demo = resolveConfiguredProvider({ mode: 'demo' });
const result = await demo.chat([{ role: 'user', content: 'Show a demonstration' }]);
// result.simulation === true; result.label says no AI model was called.
```

Demo output is fixed canned text, unrelated to the input. Structured demo output is `{ summary: string, simulated: true }`; a requested schema that does not accept that shape is rejected. Consumers must retain/display the simulation flag and label, never represent canned output as model inference, and never apply results automatically. Selection by users will be wired with run/permission/approval controls in the later tickets.

## Capabilities and errors

`AIProvider` exposes chat, structured output and embeddings. Structured output requires a caller-supplied runtime type validator; TypeScript types alone do not validate model data. Adapter errors are sanitized, and invalid/mismatched output is rejected before returning results. Embeddings are explicitly unsupported for the current adapters; there is no unused retrieval/RAG implementation.

Calls accept an AbortSignal and a bounded deadline (30 seconds by default, allowed range 1–120,000 milliseconds). The signal reaches the adapter, and interrupted results cannot be returned to the caller. A reusable provider instance holds its BUSY guard until underlying adapter work settles, even if the adapter ignores cancellation. Reuse the instance; do not create a new one for every retry. An uncooperative adapter may require restarting that instance/process; the contract cannot kill arbitrary adapter work or preempt synchronous code. There is no automatic retry.

Errors have safe `AIProviderError.code` values: DISABLED, INVALID_CONFIGURATION, UNAVAILABLE, INVALID_REQUEST, INVALID_OUTPUT, UNSUPPORTED, CANCELLED, TIMEOUT and BUSY. Internal provider failures never expose credentials, raw response bodies or prompts.

## Read-only status

Authenticated `GET /api/ai/status` returns safe default/capability metadata with `Cache-Control: no-store`. Unknown environment values are normalized to `invalid`, not echoed. Query parameters cannot enable execution. The route does not access user data, create runs, write MongoDB or contact a model. There is no AI execution endpoint yet. Local Ollama inference follows under KAN-16; Render cannot reach an owner's localhost.

## Boundaries

The contract is independent of client UI and vendor SDKs. Future providers plug into a trusted server adapter boundary; configuration does not load arbitrary code. Production remains at $0 paid AI API calls. This work does not add hosting, auth or database architecture, external services, background jobs, or Phases 3–8 functionality.
