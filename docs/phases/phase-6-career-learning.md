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

## Planned capabilities

- Career: resume, skills inventory, job opportunities, saved jobs, applications, skill-gap analysis, career goals
- Learning: skills to develop, learning roadmap, courses/articles, portfolio-project recommendations
- Turn a skill gap into a learning task or project in TaskForge

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
