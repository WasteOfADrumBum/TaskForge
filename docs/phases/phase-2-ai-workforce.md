# Phase 2: AI Workforce

**Status: IN PROGRESS.** Work + Projects, Agent Registry, assignment, provider abstraction,
developer-local Ollama, owned runs, server permissions/audit, human review and bounded
context are shipped (through PR #30, `c06dc63`). KAN-21 run activity
and execution UI is shipped (PR #31, `9a6ec94`); bounded handoffs are active under KAN-22 and starter agents remain planned. Production real AI is disabled;
simulation requires explicit selection. Assignment alone starts no work. Item status lives in
[roadmap.md](../roadmap.md#phase-2-ai-workforce-details).

## Foundation: Work + Projects (complete)

Projects are the first post-Phase-1 domain object (PR #9, merged). They give Phase 2 something concrete to build on:

- **Work organization:** tasks can belong to a project, and each project shows its own tasks, progress, and activity.
- **Agent assignment:** tasks can now be assigned to an agent (see below). Later, project ownership will bound what an agent can see and change, the same way task ownership does today.
- **Command Center:** active projects and their progress already appear there.
- **Knowledge, Career, and Learning, later:** project-level knowledge (Phase 3) and learning or portfolio projects (Phase 6) can attach to the same project records instead of inventing parallel structures.

Nothing here registers agents, runs anything, or calls an AI provider.

## Foundation: Agent Registry (complete)

The Agent Registry (PR #10, merged) makes agents a persistent, user-owned domain object. **It stores agent definitions only.**

- **Built:** an `Agent` model (name, role, description, status `active`/`paused`/`disabled`, skills, permissions, owner, timestamps); owner-scoped CRUD at `/api/agents`; the Workforce page as a real registry (list, create, edit, delete); an agent detail page at `/workforce/:id`; and a Workforce summary on the Command Center.
- **Skills:** lowercase slug strings on the agent (for example `research`, `software-development`). No separate Skill collection; that can come later if matching needs more than tags.
- **Permissions:** identifiers from a fixed catalog (`task.read`, `task.update`, `project.read`, `project.update`, `artifact.draft`). KAN-18 checks current `task.read` and `artifact.draft` for explicit text drafts; project content additionally requires `project.read`. No write tool is enabled.
- **Privacy:** the same rules as Projects. Another user's agent looks exactly like a missing one (`404`), and `owner` can't be set from a request.
- **Not built (still planned):** starter specializations; KAN-22 bounded handoffs are in progress. KAN-18 server draft execution, permissions and audit are shipped; KAN-19 shipped pending-draft review on Agent Detail. Full run/execution controls are shipped under KAN-21. (Task assignment came next; see below.)
- **Deferred:** a `tools` field. It will be added when there are real tools to describe.

## Foundation: Task → Agent Assignment (complete)

Merged in PR #15 as `16628b0`; client/API source identity is verified, and KAN-13 (PR #23) verifies persisted assignment and deletion cleanup against real local MongoDB. **An assignment is a record of who owns a task. Nothing runs the agent, and no run is created.**

- **Model:** `Task.assigneeType` is `user`, `agent`, or `null` (Unassigned), and `Task.assigneeAgent` holds the agent id when the type is `agent`. `user` always means the task's owner; there is no way to assign a task to another user.
- **Rules:** a task can be assigned to its owner, to one of the owner's own agents, or to nobody. Another user's agent gets the same `400 Agent not found` as a missing one. Only an **active** agent can take a new task. A paused or disabled agent keeps the tasks it already has, and they stay visible with the agent's status.
- **Deleting an agent** keeps its tasks: they become unassigned first, then the agent is deleted with post-write agent-existence reconciliation to close the normal concurrent-assignment window. Database failure can still leave a stale reference; see the architecture notes.
- **UI:** an Assignee field on the task form (Unassigned, Me, or an active agent), the assignee on every task card, an assignee filter on Work, the agent's assigned tasks on its detail page, assigned and open counts on each Workforce card, and open-assignment counts in the Command Center Workforce panel. All counts are derived from the task list; they are workload counts, not performance. Pending or failed task loads show unknown assignment state instead of zero.
- **Assignment alone:** creates no run or model call. Owned run records are implemented; KAN-18 permission/audit draft execution is shipped. KAN-19 human review is shipped; handoffs remain planned.

## Approved delivery boundary

Release readiness and the assignment foundation are shipped. The current approved milestone continues with bounded Phase 2 execution: provider abstraction, a free local provider, runs, server-enforced permissions, an audit trail, human approval, and starter-agent handoffs. The provider contract is implemented under KAN-15; the local adapter is implemented under KAN-16, with run execution/approval/context APIs and KAN-21 UI shipped. Phases 3–8 require a separate milestone decision; the existing task-driven Command Center does not authorize their expansion.

## Objective

Turn TaskForge from a task manager into a workspace where AI agents can be registered, given tasks, run with context, hand work to each other, and have their output approved or rejected by a human, with a full audit trail.

## Why it matters

This is the core of the "personal AI orchestration platform" direction. Phases 3 through 8 all depend on agents, runs, permissions, and the provider abstraction defined here.

## Scope

**In scope:** the agent data model, the run lifecycle, the human approval loop, the provider abstraction, one local provider, three starter agents, and the audit trail.

**Out of scope:** knowledge retrieval/RAG (Phase 3), scheduled briefings (Phase 4), and autonomous code changes (Phase 8).

## Planned capabilities

### Agent Registry

Each agent has a `role`, `description`, `skills`, `permissions`, `tools`, and `status`. Agents are owned per user, just like tasks. The registry part (everything except `tools`, with statuses active, paused, and disabled) is complete in the foundation described above.

### Task assignment

A TaskForge task can be assigned to an agent. The assignment itself is complete (see above) and only records ownership. **Planned:** starting work on an assigned task creates an agent run.

### Agent run model (KAN-17 foundation)

- Fields: `input`, `context`, `result`, and `status` (`queued` → `running` → `awaiting-approval` → `approved` / `rejected` / `failed`).
- Each run links to its owned task, assigned active agent, and owner.
- [Run foundation](../agent-runs.md) implements owned queued create/read APIs, retry identity and private atomic state transitions, attempt/deadline fencing and explicit expiry failure. KAN-18 shipped explicitly selected draft execution, cancellation and owned audit reads. KAN-19 adds exact-result/version owner review and its shipped Agent Detail UI. No worker or task/project mutation is enabled.

### Handoffs

KAN-22 is implementing explicit approved-parent queued children for an owned task already assigned to the target active agent. Ancestry is bounded to three edges with no repeated agents; immutable source version/digest and visible parent/child links preserve history. Each child requires separate execution and human review; no assignment changes or automatic cascade. Full QA and delivery are pending.

### Approval/rejection workflow

Shipped under KAN-19: a human approves or rejects the exact owned result/version with an optional bounded note. The decision and safe audit are atomic; stale/repeated/foreign decisions fail. Approval does not apply content to tasks/projects. PR #29, main CI and matching live builds are verified.

### Agent activity UI

KAN-21 shipped owned run list/detail, statuses, input/output, frozen context, audit and review display with explicit creation/execution controls. Handoffs are active under KAN-22; no synthetic activity or performance claims.

### Shared agent knowledge

Agents can read a minimal shared context (task and project notes). Full RAG comes in Phase 3.

### Starter agents

- **Chief of Staff MVP:** triages tasks and suggests which agent should handle each one.
- **Research Agent:** gathers and summarizes information for a task.
- **Developer Agent:** drafts technical plans and code suggestions as text only. It has no repo access; that is Phase 8.

### Audit trail

An append-only record of who or what did what, and when: run created, handoff, approval, rejection, permission denied.

### Permission boundaries

An agent can only use the tools and data its registry entry allows. Everything stays scoped to the owning user.

### AI provider abstraction

The server contract is implemented under KAN-15 in `server/src/ai/provider.ts`: chat, runtime-validated structured output, and an explicit unsupported embeddings capability. [Provider behavior](../ai-provider.md) documents configuration, safe errors, deadlines/cancellation and consumer constraints.

Josh approved the production default: disabled execution, with explicitly selected, clearly labelled canned simulation. Even demo configuration does not select simulation automatically. KAN-16 supplies local-only developer Ollama inference; no paid API or production model call is made. Free-tier Render cannot reach an owner's localhost or host a local model. Paid vendors require a separate explicit decision; no vendor SDK or key is accepted here.

KAN-18 server draft permissions/audit are shipped. KAN-19 human review is shipped. KAN-20 bounded context is shipped. Full run controls are shipped under KAN-21 after CI/live verification. Assignment alone does not execute an agent.

## Dependencies

- Phase 1 complete: stable auth, ownership scoping, deployment
- Work + Projects foundation: user-owned projects that tasks (and later, agent assignments) can belong to
- A local Ollama install for development
- Production fallback decision resolved: disabled default and explicitly selected labelled simulation (Josh, 2026-10-06)

## Definition of done

- [x] Agents can be registered, edited, and disabled. Every agent is scoped to its owner. (Agent Registry, PR #10.)
- [x] A task can be assigned to an agent (PR #15; source verification KAN-11; real database/browser validation PR #23). Assignment alone does not execute work.
- [ ] An agent run moves through every planned lifecycle state.
- [ ] Handoffs create linked child runs.
- [ ] Every agent result needs human approval. Rejections are recorded.
- [x] `AIProvider` exists with a working local provider and a no-provider/demo fallback (KAN-15/16, PR #25/#26). Production disabled; explicit simulation; actual local smoke validated.
- [ ] The Chief of Staff, Research, and Developer agents work end to end locally.
- [ ] The audit trail records every state change.
- [ ] Permission boundaries are enforced on the server and tested.
- [ ] Recurring cost is still $0.

## Portfolio/career value

Shows practical AI engineering: a provider-agnostic design, human-in-the-loop control, auditability, and permission modeling. These are the hard parts of shipping AI in enterprise and government settings.

## Cost constraints

$0 by default. Use local inference (Ollama) for development. Paid APIs are optional, opt-in, and never required for the app to work.

## Notes/decisions

- Human approval is mandatory in this phase. Agents never write to user data without it.
- Keep it to a few starter agents. Prove the run, handoff, and approval loop before adding more agents.
