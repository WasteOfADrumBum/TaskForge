# Phase 2: AI Workforce

**Status: PLANNED.** Nothing in this phase is implemented yet. Item-level status lives in [roadmap.md](../roadmap.md#phase-2-ai-workforce).

## Objective

Turn TaskForge from a task manager into a workspace where AI agents can be registered, given tasks, run with context, hand work to each other, and have their output approved or rejected by a human, with a full audit trail.

## Why it matters

This is the core of the "personal AI orchestration platform" direction. Phases 3 through 8 all depend on agents, runs, permissions, and the provider abstraction defined here.

## Scope

**In scope:** the agent data model, the run lifecycle, the human approval loop, the provider abstraction, one local provider, three starter agents, and the audit trail.

**Out of scope:** knowledge retrieval/RAG (Phase 3), scheduled briefings (Phase 4), and autonomous code changes (Phase 8).

## Planned capabilities

### Agent Registry

Each agent has a `role`, `description`, `skills`, `permissions`, `tools`, and `status` (active or disabled). Agents are owned per user, just like tasks.

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
- A local Ollama install for development
- A decision on how the deployed demo behaves without a hosted model

## Definition of done

- [ ] Agents can be registered, edited, and disabled. Every agent is scoped to its owner.
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
