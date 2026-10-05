# KAN-10: Cold-start feedback

- Jira: https://taskforgejms.atlassian.net/browse/KAN-10
- Branch: `codex/KAN-10-cold-start-feedback`
- Approved milestone: release readiness and bounded Phase 2.
- Starting source: `39c5ec6` (KAN-9, PR #20, both deployed release commits verified).

## Acceptance

1. Fast requests retain the current experience; delayed service has truthful waiting feedback, retry/cancel for safe reads/sign-in, and accessible announcements.
2. Failure cannot hang indefinitely; the full request lifetime includes response body parsing.
3. No automatic write replay or mutation Retry control. Unconfirmed writes instruct refresh/verification before any new submission. Cancellation does not imply server rollback; manual resubmission is not claimed duplicate-free.
4. Loading, delayed, failed and recovery states exist in authoritative Figma and match the implementation. Include an unconfirmed-write state to avoid misleading saved/cancelled claims.
5. Test fast/slow/failed/header/body/cancel/retry/accessibility, retain session-generation protection, and collect safe cold-start evidence. Document demo access/data strategy without production resets.

## Current implementation checkpoint

Transport/API work is implemented: one 90-second deadline covers fetch and JSON; optional caller signals, typed timeout/cancellation, timer/listener/unread-stream cleanup, and no automatic replay. Writes use clear uncertainty feedback on unconfirmed timeout/cancel/network/body failures. Login is safely repeatable; registration remains a write. Original token/sessionVersion metadata and final consumer guards are preserved.

825 tests passed (424 client, 401 server), including a regression for an unhandled late JSON rejection after deadline. Format, lint, types, both builds, full audit (0 vulnerabilities) and whitespace checks passed. Independent review found no transport blockers; this is sufficient for a partial draft checkpoint, not ticket completion.

## Design blocker: Figma MCP usage limit

The authoritative file and its existing TaskForge tokens/Figtree styles were inspected. The scoped inventory is one request-feedback family: Loading, Delayed, Failed, Recovered, ChangeUnconfirmed. Planned styles reuse dark panel/foreground/border, spacing and radius variables; safe actions use Cancel/Retry, writes get no replay action.

Figma rejected the construction call with: “You've reached the Figma MCP tool call limit on the Starter plan.” No created node IDs were returned and no request-state design/UI completion is claimed. No paid upgrade is authorized or performed. UI work is not started; no design gate is skipped.

Resume when Figma MCP access is available, then create/validate the variants, get design context, implement feedback/cancel/retry, finish accessibility/browser/cold-start/demo QA, and run all delivery gates. Transport-only tests do not satisfy the complete ticket.

## Delivery boundary

A draft transport checkpoint may be committed/pushed for review after validation. Do not merge KAN-10 or mark it Done until its UI/Figma/QA acceptance is met. No production data writes, seed/reset, new service/cost, hosting/database/auth architecture change or automatic keepalive.
