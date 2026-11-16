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

- Reviews API (KAN-59): saved daily and weekly reviews, one per period, with a reflection and focus tasks for the next day or week.

- Guided daily and weekly reviews (KAN-60): the Reviews page (`/reviews`) walks through four steps: look back at tasks completed today (or Monday to Sunday), see what is overdue or coming due, choose up to 3 (or 5) focus tasks, and write a reflection. Saving stores today's (or this week's) review; reopening the page loads it. Rule-based and labelled as such.

- Goals API (KAN-61): the goals model that goal review depends on, with status and an optional target date.

- Goals page and weekly goal check-in (KAN-62): the Goals page (`/goals`) adds goals and marks them achieved, dropped or active again; an active goal past its target says so in text. The weekly review gains a step to check in on active goals.

- Skill-growth review (KAN-66): the weekly review gains a step that lists skills added this week, older skills updated this week (usually a new level; the previous level is not stored), learning tasks made from a saved job's skill gap and finished this week, and the skills most often missing across open saved jobs (saved, applied or interviewing), up to 5. It reads the Career page's skills and saved jobs (Phase 6) and is rule-based.

## Planned capabilities

- Agent recommendations

## Dependencies

- Phase 4 (Command Center data)
- Phase 2 (agents)
- The goals model (KAN-61) and the Phase 6 skills inventory and saved jobs (KAN-63)

## Definition of done

The user can complete a guided daily and weekly review. Analytics reflect real task history. Agent suggestions can be accepted or dismissed.

## Portfolio/career value

Shows analytics, data visualization, and AI-assisted UX.

## Cost constraints

$0. Compute analytics in the app and generate recommendations with the local provider.

## Notes/decisions

- Tasks record `completedAt` (KAN-57): the server stamps it when a task becomes done, keeps it when a done task is saved as done again, and clears it when the task is reopened. Request input never sets it. Tasks completed before KAN-57 keep `null`, and analytics count them as "completion date unknown" rather than guessing from `updatedAt`.
