# KAN-25: Supplied-source Research Agent

- Jira: https://taskforgejms.atlassian.net/browse/KAN-25
- Branch: `codex/KAN-25-supplied-research`; base `1c7d784` (verified live PR #34).
- Approved bounded Phase2. Original assignment WIP preserved. No Figma or paid APIs.

## Acceptance and boundaries

Explicit research workflow uses assigned owned task notes, optionally permitted project notes,
approved parent output and up to3 labelled excerpts (4000 characters each). Optional HTTP(S)
reference URLs are metadata only, never fetched. Allowlisted source contents, provenance and
content-derived supplied IDs freeze with the existing16KiB audited snapshot. Missing/unsupported/
oversized sources fail before claim/model invocation with safe audit evidence.

Native structured local output and consumer validation require captured kind:id source references,
exact verbatim quotes (native generation chooses the first400 nonblank-start characters per source) and bounded strict summary/evidence/inferences/limitations. A quote match
establishes attribution only, not factual truth: findings are labelled interpretations and inferences
are not established facts. Simulation uses deterministic excerpts, clearly labelled, no model.
Read/draft and optional project.read permissions are checked at existing authority boundaries.
Exact version/result review records a decision without task changes. No retrieval/RAG/tools/new
provider/hosting/auth/database architecture. Production real AI disabled; actual inference local.

## Validation checkpoint

- Full client574 passed; initial server full734 had2 legacy controller-call failures, fixed
  by forwarding supplied-source args only when present. Final full server736 passed. All125 affected route/provider/schema
  cases then passed; later43 research/execution cases passed after final quotation constraints.
- Full fresh Mongo120 cases/8 suites and Chromium11 flows passed; builds, audit0 and7 safety
  checks passed. Final affected static/types/build/Mongo research and native smoke changes are checked.
- Actual cached Ollama0.40.0/qwen3:0.6b chat/structured/Chief/Research smoke passed with
  simulationfalse and database/production calls0. Owned runtime14184 stopped. Earlier research
  output hit256-token truncation, then invented a quote; both failed closed. Structured output
  now has512-token bound (chat256), exact captured excerpt enums plus runtime attribution checks.
- Independent review found and verified a leading-whitespace simulation-quote fix. Final
  affected quote/prompt review found no blockers. Protected PR/main CI/live delivery remain before Done.

Native generation quotes bounded source openings; it is not exhaustive document citation or
factual verification. Larger/invalid local responses still fail closed under existing deadlines,
without automatic replay, quote repair, tool calls or task changes.
