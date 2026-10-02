# Phase 2: AI Workforce

**Status: IN PROGRESS (foundation only).** No AI capability exists: nothing runs an agent or calls a model. The Work + Projects foundation (PR #9), the Agent Registry (persistent agent definitions), and the Workforce summary (PR #10) are complete and merged. Task → Agent Assignment is the next planned checkpoint. AI execution, agent runs, permission enforcement, the provider abstraction, handoffs, and approvals are still planned. Item-level status lives in [roadmap.md](../roadmap.md#phase-2-ai-workforce-details).

## Foundation: Work + Projects (complete)

Projects are the first post-Phase-1 domain object (PR #9, merged). They give Phase 2 something concrete to build on:

- **Work organization:** tasks can belong to a project, and each project shows its own tasks, progress, and activity.
- **Agent assignment, later:** agents will be assigned to tasks in a project, and project ownership will bound what an agent can see and change, the same way task ownership does today.
- **Command Center:** active projects and their progress already appear there.
- **Knowledge, Career, and Learning, later:** project-level knowledge (Phase 3) and learning or portfolio projects (Phase 6) can attach to the same project records instead of inventing parallel structures.

Nothing here registers agents, runs anything, or calls an AI provider.

## Foundation: Agent Registry (complete)

The Agent Registry (PR #10, merged) makes agents a persistent, user-owned domain object. **It stores agent definitions only.**

- **Built:** an `Agent` model (name, role, description, status `active`/`paused`/`disabled`, skills, permissions, owner, timestamps); owner-scoped CRUD at `/api/agents`; the Workforce page as a real registry (list, create, edit, delete); an agent detail page at `/workforce/:id`; and a Workforce summary on the Command Center.
- **Skills:** lowercase slug strings on the agent (for example `research`, `software-development`). No separate Skill collection; that can come later if matching needs more than tags.
- **Permissions:** identifiers from a fixed catalog (`task.read`, `task.update`, `project.read`, `project.update`, `artifact.draft`). They are metadata for the future permission boundary. **Nothing enforces them yet**, because nothing executes.
- **Privacy:** the same rules as Projects. Another user's agent looks exactly like a missing one (`404`), and `owner` can't be set from a request.
- **Not built (still planned):** AI execution, model calls, the provider abstraction, agent runs, task assignment, handoffs, approvals, the audit trail, and permission enforcement. The agent detail page lists Assignments, Runs, and Approvals only as labeled "Planned" placeholders, with no data.
- **Deferred:** a `tools` field. It will be added when there are real tools to describe.

## Objective

Turn TaskForge from a task manager into a workspace where AI agents can be registered, given tasks, run with context, hand work to each other, and have their output approved or rejected by a human, with a full audit trail.

## Why it matters

This is the core of the "personal AI orchestration platform" direction. Phases 3 through 8 all depend on agents, runs, permissions, and the provider abstraction defined here.

## Scope

**In scope:** the agent data model, the run lifecycle, the human approval loop, the provider abstraction, one local provider, three starter agents, and the audit trail.

**Out of scope:** knowledge retrieval/RAG (Phase 3), scheduled briefings (Phase 4), and autonomous code changes (Phase 8).

## Planned capabilities

### Agent Registry

Each agent has a `role`, `description`, `skills`, `permissions`, `tools`, and `status`. Agents are owned per user, just like tasks. The registry part (everything except `tools`, with statuses active, paused, and disabled) is being built on the foundation branch above.

### Task assignment

A TaskForge task can be assigned to an agent. Assigning it creates an agent run.

### Agent run model

- Fields: `input`, `context`, `result`, and `status` (`queued` → `running` → `awaiting-approval` → `approved` / `rejected` / `failed`).
- Each run links to its task, its agent, and its owner.

### Handoffs

A run can hand off to another agent, which creates a child run. The chain stays visible in the run history.

### Approval/rejection workflow

Agent output is never applied automatically. A human approves or rejects it, with an optional note.

### Agent activity UI

A list and detail view of runs, statuses, handoffs, and approvals.

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

TaskForge must not be hard-wired to any one AI vendor. Every AI call goes through one interface:

```ts
// Concept only. Not implemented.
interface AIProvider {
  chat(messages, options): Promise<ChatResult>;
  embed(texts): Promise<number[][]>;
  structuredOutput<T>(messages, schema): Promise<T>;
}
```

- Possible providers: **local/Ollama** (default, $0), OpenAI, Claude, Gemini, and future ones.
- The provider is chosen by configuration (env var) per environment, never by changing code.
- A paid provider is only ever enabled with explicit approval and the user's own key.
- Free-tier hosting cannot run a local model. In production, AI features must degrade gracefully when no provider is configured (for example, a "demo mode" with canned responses).

## Dependencies

- Phase 1 complete: stable auth, ownership scoping, deployment
- Work + Projects foundation: user-owned projects that tasks (and later, agent assignments) can belong to
- A local Ollama install for development
- A decision on how the deployed demo behaves without a hosted model

## Definition of done

- [x] Agents can be registered, edited, and disabled. Every agent is scoped to its owner. (Agent Registry, PR #10.)
- [ ] A task can be assigned to an agent, and the run moves through every state.
- [ ] Handoffs create linked child runs.
- [ ] Every agent result needs human approval. Rejections are recorded.
- [ ] `AIProvider` exists with a working local provider and a no-provider/demo fallback.
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
