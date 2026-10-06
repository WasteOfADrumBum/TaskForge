# KAN-13: Reproducible critical verification

- Jira: https://taskforgejms.atlassian.net/browse/KAN-13
- Branch: `codex/KAN-13-integration-smoke`
- Source: verified deployed `401a7d1` (KAN-12, PR #22).
- Milestone: approved release readiness and bounded Phase 2.

## Scoped test design

Preserve the fast mocked unit suites. Separate integration tests use real Mongoose models/services/Express and a real MongoDB 8.2.6 process managed by mongodb-memory-server-core. This is test-only tooling, not a replacement for MongoDB Atlas or an application database architecture change. The runner downloads the official binary once into a local cache and validates its checksum; no paid infrastructure is introduced.

Each run owns a temporary mongod bound to127.0.0.1 and a fresh taskforge_qa_ UUID namespace. Raw integration configuration rejects remote/SRV/credentialed URIs and pre-existing collections before creating test records. No production environment file, Atlas URI, demo seed, collection reset or database drop is used. Only the harness's own child processes and temporary database are stopped/cleaned. Docker is optional and not required; its local engine was unavailable during inspection.

Three startup safety tests confirm that only the owned API IPC readiness message enables Vite, early API exit fails startup, and an occupied5051 service receives zero requests while Vite never starts. The regression initially failed because an Express listen callback also ran on bind errors; readiness now uses the HTTP server listening event. No assertion was weakened.

The browser harness bundles a test-only server entry that also binds to loopback, checks fresh database configuration, and never imports dotenv. Vite uses only the local API. Playwright owns the temporary environment and refuses to reuse an existing server. Test accounts/records are unique and synthetic. API/browser tests run in the existing protected CI quality job on pinned Ubuntu24.04; the public repository uses existing free CI.

## Coverage and evidence

- 16 real database/API cases: password hashing/auth/JWT; task/project/agent persisted CRUD; owner-only lists/detail/update/delete; foreign references rejected; calendar/assignment round trip; paused assignment retention and deleting an agent unassigns tasks.
- 3 real browser flows: UI registration/login, agent/task assignment and edited status surviving reload plus deletion; two-user isolation and actual API401 session clearing;390px drawer navigation and expired JWT handling.
- Ownership proof: temporarily removing the task-list owner filter caused the isolated ownership test to fail with another user's task. Restoring the original source bytes returned green. No final production-code mutation remains.

Final local validation passes:875 application units (474 client,401 server),3 fixture safety tests,16 real database/API tests and3 browser flows. Format, lint, client/server/QA types, both builds, clean installation, full audit0 and whitespace checks pass. Independent review has no remaining findings after the listener ownership correction and scoped dependency patch. Final PR CI/release verification remains. Existing development next-themes script warning and unit jsdom diagnostics are reported, not hidden; these tests do not claim console-clean or full accessibility certification.

## Limits

Single-process standalone MongoDB checks do not prove Atlas/free-tier behavior, replica-set transactions, production backups/restores, load or concurrent deletion races. Browser smoke is Chromium critical-path coverage, not exhaustive cross-browser testing. No production test writes.

## Build-tool advisory remediation

The October6 audit feed added [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv) for the existing shell-quote1.9.0 dependency pinned by concurrently. A scoped concurrently/shell-quote1.12.0 override removes that vulnerable version without a major build-tool upgrade or audit exception. Clean installation, actual concurrent builds and audit0 pass; the advisory payload is rejected without execution and ordinary command tokens survive a quote/parse round trip. No exception or major build-tool upgrade.
