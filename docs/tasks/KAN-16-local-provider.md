# KAN-16: Local Ollama provider

- Jira: https://taskforgejms.atlassian.net/browse/KAN-16
- Branch: `codex/KAN-16-local-provider`
- Source: verified deployed `dacbd882` (KAN-15 Done, PR #25).
- Approved milestone: bounded Phase 2; no Phases 3–8 expansion.

## Acceptance

1. Real local inference uses AIProvider with server-only Ollama configuration; default missing configuration remains disabled.
2. Production never calls a model, even if Ollama is accidentally configured. Explicit labelled simulation remains separate; no paid/cloud fallback.
3. Allow only loopback model service URLs, reject redirects, reject cloud/remote models before sending messages, and validate protocol/output with bounded cancellation/deadline/body size.
4. Structured output uses runtime validation; embeddings remain explicitly unsupported. No RAG, model download inside the application, execution endpoint, user run/approval UI or production writes.
5. Mock protocol regression tests and actual explicitly local synthetic chat/structured-output smoke pass. Document resources and trusted local-process boundary.

## Local QA plan

No installed Ollama/service detected. Use the official portable Windows v0.40.0 release in ignored `node_modules/.cache/taskforge-ollama`, verify its published SHA-256 before use, bind a temporary owned process to 127.0.0.1:11435 with `OLLAMA_NO_CLOUD=1`, and keep model storage inside that isolated cache. Tiny local qwen3:0.6b is a QA fixture, not a quality claim or production deployment. Host resource read: 62GB RAM, 32 CPUs, over 1TB free disk. No machine-wide install, login, new paid service, public listener or permanent startup process. Stop only owned processes after smoke; preserve cache without deleting user files.

Official references: [Windows CLI](https://docs.ollama.com/windows), [cloud-disable and local trust](https://docs.ollama.com/faq), [chat protocol](https://docs.ollama.com/api/chat), [structured output](https://docs.ollama.com/capabilities/structured-outputs).

## Delivery gates

Format/lint/types/units/build/audit, fixture safety, isolated real API/browser regressions, independent review, protected exact-head PR/main CI, matching live release identities and production disabled/auth status verification precede Done. Preserve original assignment checkout. No Figma workflows or gates. KAN-17 run lifecycle follows only after this ticket completes.

## Implementation and actual local evidence

- Server adapter: native fetch, literal/numeric loopback only, no redirects or paid/cloud fallback. Check local GGUF/completion metadata before prompts; operator must keep daemon cloud-disabled and model mappings stable.
- Both metadata and inference bodies are bounded to 1MiB within one signal/deadline. Require normal `stop` completion; reject truncation even schema-valid JSON. Runtime validator is authoritative; optional JSON schema guides local generation. Thinking off, 256 generated tokens and 2048 context.
- Review found truncation acceptance and localhost DNS resolution; 11 regressions demonstrated red/green after strict completion and numeric normalization fixes. No remaining code findings.
- Actual smoke passed twice, including final frozen code: portable Ollama 0.40.0, qwen3:0.6b, owned 127.0.0.1:11435 listener, `OLLAMA_NO_CLOUD=1` confirmed. Real chat, schema-guided structured output and unsupported embeddings behavior passed using synthetic inputs only.
- Archive SHA-256 verified against the official release: `3623e256762ca89bd6fa99b0cc4106401919ce9df926411673e632e3ea287bb5`. Runtime/model cache is ignored by Git. Owned process tree stopped and model port closed; no persistent service/cloud login or production/database calls.
- Initial smoke module-loading failure was fixed only in the opted-in runner using existing esbuild; application startup unchanged. Four guard tests prove no model traffic with production/missing opt-in/disabled/unexpected settings.
- Independent QA: 977 units (474 client/503 server), 7 safety tests, 16 real API and 3 Chromium flows; static/build/audit0 gates pass. An initial fixture-port collision was resolved by sequential scheduling, with no code or assertion change. Final PR/CI/deployment gates remain.
