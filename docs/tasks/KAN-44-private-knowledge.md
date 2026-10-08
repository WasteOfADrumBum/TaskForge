# KAN-44: Private knowledge source API and bounded keyword retrieval

Jira: https://taskforgejms.atlassian.net/browse/KAN-44, epicKAN-27. Branch
`codex/KAN-44-private-knowledge`, base77d8adc/PR37. Approved bounded Phase3, $0 additional
recurring cost, original WIP preserved, Figma excluded; Phases4–8 unapproved.

Actual Atlas dashboard FREE/MongoDB8.0.34/search eligibility verified metadata-only. No production
write/index/model call; actual index build/query benchmark not established. First storage/search
uses canonical owned records and bounded literal keywords; indexing design stays simple/free.

## Saved implementation checkpoint

Pure input/digest/query/excerpt helpers and18 targeted unit tests passed; affected ESLint,
Prettier and diffcheck passed. Helpers preserve exact content and source version/digest/quote
offsets, escape regex operators, filter foreign/deleted candidates, reject corrupt digests and
bound bytes/window/results. They do not implement storage/API/UI, quotas, authorization or audit.

Exact next action: add owner-scoped KnowledgeSource persistence with acknowledged ordinary
indexes, atomic source version/digest updates, durable bounds and safe deletion/invalidation;
project ownership validation, controllers/routes and real Mongo/security/concurrency tests.
Then full required QA, stable independent review, PR/protected CI/main CI/live identity and Done.
KAN-45 UI follows this API. No model call or agent knowledge access is enabled by these helpers.

Current window usage92% before foundation edits; save this checkpoint rather than rush release
gates. No Jira completion or deployment claim. Preserve all remaining acceptance requirements.
