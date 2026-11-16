# Phase 5: Reviews

**Status: IN PROGRESS**

## Objective

Built-in daily and weekly reviews that show progress, goals, and skill growth, with recommendations from agents.

## Why it matters

Reflection turns task tracking into steady progress, and it keeps long-term goals visible.

## Scope

Daily review, weekly review, progress analytics, agent recommendations, goal review, and skill-growth review.

## Implemented

- Progress analytics (KAN-58): the Progress page (`/progress`) counts tasks completed in the last 7 days (one row per day) or 28 days (one row per week), compares with the previous window, and shows tasks created, the share finished on or before their due date, the average per day and completions by project. It is computed in the client from recorded completion times and labelled rule-based. The breakdown is a captioned table with the count as text; bars are decorative.

## Planned capabilities

- Daily review
- Weekly review
- Agent recommendations
- Goal review
- Skill-growth review

## Dependencies

- Phase 4 (Command Center data)
- Phase 2 (agents)
- A goals model, which does not exist yet

## Definition of done

The user can complete a guided daily and weekly review. Analytics reflect real task history. Agent suggestions can be accepted or dismissed.

## Portfolio/career value

Shows analytics, data visualization, and AI-assisted UX.

## Cost constraints

$0. Compute analytics in the app and generate recommendations with the local provider.

## Notes/decisions

- Tasks record `completedAt` (KAN-57): the server stamps it when a task becomes done, keeps it when a done task is saved as done again, and clears it when the task is reopened. Request input never sets it. Tasks completed before KAN-57 keep `null`, and analytics count them as "completion date unknown" rather than guessing from `updatedAt`.
