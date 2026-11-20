<!-- Managed by One Small Engineering (one-small-engineering/ai-standards 1.0.0). Do not edit: put project rules in .ai/project.md. ose ai sync refreshes this file only while it is unmodified. -->

# Persistent project learning

## Core rules

- When a correction is likely to recur, turn it into a stable rule after checking that no existing rule covers it.
- Project rules go in `.ai/project.md`. Never edit `.ai/shared/` or managed blocks; shared policies change only in One Small Engineering.
- Do not promote a one-off preference to a shared rule; propose a shared-policy change when a correction applies across projects.

## Details

- Validate after changing instructions (`ose ai validate --target .` when One Small Engineering is available).
- A rule belongs to the narrowest layer that is always true: shared, project, or just the current task.

Examples of where a rule belongs:

- Shared: never claim tests passed without running them.
- Project: this project uses its existing component system and must not add a second UI framework.
- Task: update the finance dashboard using the current data model.
