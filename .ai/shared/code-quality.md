<!-- Managed by One Small Engineering (one-small-engineering/ai-standards 1.0.0). Do not edit: put project rules in .ai/project.md. ose ai sync refreshes this file only while it is unmodified. -->

# Code quality

## Core rules

- Follow the project's conventions, lint and format config; match surrounding code. Use TypeScript and strong types where the project does; never force a language or framework on it.
- Small focused functions, reusable utilities over copy-paste, clear names, explicit error handling (no empty catches).
- Minimal dependencies, no rewrites without a stated reason.
- Dependency upgrades: stay on the latest version with a narrow, documented workaround (and a note to recheck it) rather than holding back, as long as nothing breaks.

## Details

- Remove dead code and debug output you introduce; leave unrelated code alone.
- Keep public interfaces stable; when one must change, update every caller in the same change.
- Avoid `any` and unchecked casts in TypeScript; narrow types at boundaries.
- Comments explain why, not what.
- Keep diffs reviewable: one concern per change where practical.
