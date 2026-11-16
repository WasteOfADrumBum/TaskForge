# Phase 6: Career + Learning

**Status: IN PROGRESS**

## Objective

Track career goals and learning in one place, and connect job-market skill gaps to concrete learning tasks and portfolio projects.

## Why it matters

It supports the goal of reaching senior engineer or tech lead by turning "skills I need" into scheduled, trackable work.

## Scope

**Career:** resume, skills inventory, job opportunities, saved jobs, applications, skill-gap analysis, career goals.

**Learning:** skills to develop, learning roadmap, courses and articles, portfolio-project recommendations, and links from job-market gaps to learning tasks and projects.

## Implemented

- Skills inventory and saved jobs API (KAN-63): skills with a level, one per name, and jobs saved by hand with required skills and an application status. Skill names are slugs so a job's requirements can be matched against your skills.

- Career page (KAN-64): the Career page (`/career`) manages skills and saved jobs. It shows each job's skill gap, meaning the required skills you have and those you are missing, matched by exact name and labelled rule-based. One press turns a missing skill into a To Do task, "Learn <skill> for <job>".

- Learning roadmap API (KAN-67): learning items (course, article, book, video, project, practice or other), each optionally tied to a skill, with an https link, a status (planned, in progress, done), a target date and notes. The server records when an item is done.

- Learning page (KAN-68): the Learning page (`/learning`) adds roadmap items, lists them by status (in progress, planned, done) with their kind, skill, target date (an unfinished item past its date says so in text) and link, moves them between statuses and deletes them after a confirming press. Its "From your skill gaps" section lists the skills open saved jobs need most and adds one to the roadmap with one press, or says it is already on the roadmap. Rule-based.

- Career goals (KAN-69): goals get an area (general, career or learning), set or changed on the Goals page, and the Career page lists active career goals with their targets and a link to Goals. They reuse the Phase 5 goals model.

- Resume (KAN-70): one plain-text resume per user (headline, summary and the rest) on the Career page, with a rule-based skill check that lists your skills it mentions, your skills it does not, and the skills open saved jobs need that it does not mention, matched by whole word.

- Portfolio project ideas (KAN-71): the Learning page suggests up to three projects, one for each skill open saved jobs need most. Each pairs the missing skill with the skill you have at working level or above that those jobs list most often (ties go to the higher level, then the name), names up to three of the jobs, and adds itself to the roadmap as a project with one press, or says a project for that skill is already there. Rule-based, client-only.

- Applications (KAN-72): saved jobs record when their status last changed (server-set). The Career page's Applications section counts applied, interviewing and offer, lists those applications longest unchanged first with the status and since when in words, and offers a follow-up task for one still "applied" after 14 days. Jobs saved before this show no date. Rule-based.

## Planned capabilities

- Career: job opportunities (needs an external job source)

## Dependencies

- Phase 2 (Research Agent)
- Phase 3 (knowledge, for resume and job data)
- Phase 5 (skill-growth review)

## Definition of done

The user can store a resume and skills, save jobs, see a skill-gap analysis, and turn a gap into tracked learning tasks.

## Portfolio/career value

A self-referential tool that also shows structured data modeling and AI-assisted analysis.

## Cost constraints

$0. Use manual job entry or free sources only. Use no paid job-board APIs.

## Notes/decisions

- Keep private career data out of the public demo account.
