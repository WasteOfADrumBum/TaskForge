# KAN-49: Ask TaskForge and verifiable source citations

Jira: https://taskforgejms.atlassian.net/browse/KAN-49
Branch: `claude/KAN-49-ask-taskforge`, base `699dbaf` (after KAN-51/PR #48 and KAN-52/PR #49).
Approved Phase 3 (epic KAN-27). No Figma, paid service, server or schema change, or production writes.

## Behavior

`/knowledge/ask` (linked from Knowledge) offers two explicitly labelled modes in a radio group:

- **Find cited sources (keyword, no AI):** the existing hosted keyword search. Results are exact
  source excerpts rendered as inert text. Each links to the owned source with its citation, and the
  detail page rechecks ID, version, digest and offsets against the current source before calling it
  verified. Empty, error, waiting and cancel states are explicit.
- **Grounded answer (local AI, human review):** enabled only when `/api/ai/status` reports a
  local provider with structured output and embeddings. Otherwise it is disabled with the reason
  (hosted deployment, missing capability or unreadable status). It creates a queued Run (idempotent,
  same-key manual retry after an uncertain create) for a task assigned to an active agent with
  `task.read`, `artifact.draft` and `knowledge.read`, then opens Run detail with the knowledge
  workflow preselected. Nothing executes until the owner chooses local mode and Execute.
  Without the project option, retrieval covers only sources with no project; with it, only the
  task's project sources (the existing KAN-48 server rule).

Run detail offers the knowledge workflow only when local grounded capability exists (or Ask
preselected it, in which case execution stays blocked without capability). Simulation is never
offered for knowledge. A grounded draft shows the question, the bounded answer and each retrieved
excerpt marked cited or not cited, with links that recheck the current source. The result is
parsed defensively; any malformed shape falls back to the recorded text and no citation is
invented. Approval keeps the existing server-side current-source, permission and digest checks.

There is no simulation for grounded answers. The hosted deployment does not run AI models, so
production users see keyword citations and a clear explanation of what local AI adds.

## Validation

- 30 new client tests: capability fail-closed states, 480-byte UTF8 and lone-surrogate question
  bounds, eligibility and project-permission rules, defensive result parsing (11 malformed cases),
  citation compatibility with current-source verification, page flows, uncertain-create retry
  identity, workflow preselection without auto-execution and grounded citation rendering.
- New Chromium scenario `e2e/ask.spec.ts`: mobile keyboard keyword ask, verified citation,
  disabled grounded mode against the AI-free QA API, foreign-owner isolation, no overflow.
- Full client suite, lint, types, format and build locally; required CI runs the full gate.
- Accessibility: native radio group with legend and per-option descriptions, labelled fields,
  helper and error text tied to inputs, status and alert regions, ordered result lists,
  blockquote excerpts, keyboard-only flow covered in the browser scenario.

## Limits

Local grounded execution was not re-run in this ticket: no local model runs in this environment.
KAN-48's actual local Mongo and Ollama evidence covers the server workflow this UI drives. KAN-50
adds evaluations and negative security evidence.
