<!-- Managed by One Small Engineering (one-small-engineering/ai-standards 1.0.0). Do not edit: put project rules in .ai/project.md. ose ai sync refreshes this file only while it is unmodified. -->

# Architecture

## Core rules

- The existing stack and architecture are authoritative. Extend existing modules and patterns before creating new ones.
- Never add a second framework, UI kit, state library, test runner or build tool that duplicates one in use.
- Small modules, clear boundaries, no circular dependencies.
- Significant redesign, new services or data stores are Level 3: propose with trade-offs first. Record non-obvious decisions where the project keeps them.

## Details

- Read the project's README, architecture docs and `.ai/project.md` before structural changes.
- Prefer composition and small interfaces over inheritance and large shared objects.
- Keep configuration in one place; avoid scattering magic values.
- Design for the current requirement with a clear extension point, not for speculative futures.
- When two parts of the codebase solve the same problem differently, follow the newer documented pattern and note the inconsistency rather than rewriting both.
