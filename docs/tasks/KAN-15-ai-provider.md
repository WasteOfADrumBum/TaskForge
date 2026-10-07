# KAN-15: AI provider contract and production fallback

- Jira: https://taskforgejms.atlassian.net/browse/KAN-15
- Branch: `codex/KAN-15-ai-provider`
- Source: verified deployed `a84f216` (KAN-14, PR #24).
- Approved milestone: bounded Phase 2; no Phases 3–8 expansion.

## Authorized contract scope

Configuration selects a provider behind a UI-independent AIProvider interface. Support chat and validated structured output, with an explicit embeddings capability contract; no unused RAG implementation. Disabled/unavailable/timeout/error behavior must be honest, canned demonstration output must be clearly labelled, and default configuration must make no paid calls. Local Ollama integration follows under KAN-16 and must not assume Render can reach the owner's localhost.

## Approved production decision

Josh approved on 2026-10-06: production AI stays disabled by default, with explicitly selected, clearly labelled demo/simulation mode available. Real inference remains local through Ollama (KAN-16); production makes $0 paid AI calls. Jira comment 10059 records the decision. This resolves the prior prerequisite.

## Acceptance and implementation boundaries

1. A server-only AIProvider supports chat, validated structured output, and an explicit embeddings capability. No UI/provider coupling or vendor SDK.
2. Missing configuration disables execution. Canned simulation is selected explicitly and labelled as simulation with no model used; unavailable/invalid configuration never silently falls back.
3. Provider work has bounded deadlines, cancellation and safe typed errors. Structured output is validated at runtime; unsupported embeddings fail honestly.
4. Authenticated read-only `/api/ai/status` reports safe availability/capabilities without secrets or prompts. There is no execution endpoint, task mutation or model network call in this ticket.
5. Local Ollama adapter, user run controls, permission enforcement, audit and human approval remain subsequent approved tickets. Nothing runs an assigned agent yet.

## Validation and delivery

Run provider/route success and failure cases, full format/lint/types/units/build/audit, fixture safety, isolated real database and browser regressions. Independent review and final-head/main CI plus served deployment identities and live auth/status behavior precede Done. No production data writes or new service/dependency cost. Preserve original assignment checkout. No Figma workflows or gates.

## Review corrections

Independent review found that a result could pass after synchronous validation exceeded the deadline or cancellation occurred during public promise adoption. Added a monotonic elapsed deadline/final interruption check and returned the checked promise directly. Regression tests measure actual public pending/fulfilled state: cancellation while pending rejects; an abort after fulfillment does not retroactively invalidate completion. Tests also cover late adapter settlement/rejection and guard cleanup. Final validation and review remain delivery gates.

## Local acceptance evidence

- 34 provider and 6 authenticated status tests pass; full units total 915 (474 client, 441 server).
- Fixture safety 3, isolated real API 16 and Chromium smoke 3 pass; no production writes and fixture cleanup verified.
- Types, lint, build, formatting, audit (0 vulnerabilities) and diff checks pass.
- Independent reviewer: no remaining findings. Red/green probes verified overdue synchronous validation and the previous public promise-adoption cancellation gap; current tests distinguish pending interruption from abort after fulfillment.
- No dependency, model download, vendor key, paid service or production configuration change. Commit/PR/current-head CI/merge/deployment evidence follows in Jira before Done.
