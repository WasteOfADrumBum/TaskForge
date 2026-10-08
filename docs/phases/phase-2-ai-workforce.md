# Phase 2: AI Workforce

**Status: COMPLETE — owner accepted 2026-10-08.** Work + Projects, registry, assignment,
provider abstraction, developer-local Ollama, owned runs, permissions/audit, human review,
bounded context, explicit handoffs and all three starter workflows are shipped through
PR #36 (`13d34d1`). Production real AI remains disabled; simulation requires explicit selection.
Assignment starts no work, review applies no task/repository changes, and no Phase3–8 approval
is implied. [Closure evidence](#closure-summary-2026-10-08) and [roadmap](../roadmap.md#phase-2-ai-workforce-details).

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
- **Starter workflows:** Chief of Staff and Research are shipped; Developer is shipped (PR #36). KAN-22 bounded handoffs are shipped. KAN-18 server draft execution, permissions and audit are shipped; KAN-19 shipped pending-draft review on Agent Detail. Full run/execution controls are shipped under KAN-21. (Task assignment came next; see below.)
- **Deferred:** a `tools` field. It will be added when there are real tools to describe.

## Foundation: Task → Agent Assignment (complete)

Merged in PR #15 as `16628b0`; client/API source identity is verified, and KAN-13 (PR #23) verifies persisted assignment and deletion cleanup against real local MongoDB. **An assignment is a record of who owns a task. Nothing runs the agent, and no run is created.**

- **Model:** `Task.assigneeType` is `user`, `agent`, or `null` (Unassigned), and `Task.assigneeAgent` holds the agent id when the type is `agent`. `user` always means the task's owner; there is no way to assign a task to another user.
- **Rules:** a task can be assigned to its owner, to one of the owner's own agents, or to nobody. Another user's agent gets the same `400 Agent not found` as a missing one. Only an **active** agent can take a new task. A paused or disabled agent keeps the tasks it already has, and they stay visible with the agent's status.
- **Deleting an agent** keeps its tasks: they become unassigned first, then the agent is deleted with post-write agent-existence reconciliation to close the normal concurrent-assignment window. Database failure can still leave a stale reference; see the architecture notes.
- **UI:** an Assignee field on the task form (Unassigned, Me, or an active agent), the assignee on every task card, an assignee filter on Work, the agent's assigned tasks on its detail page, assigned and open counts on each Workforce card, and open-assignment counts in the Command Center Workforce panel. All counts are derived from the task list; they are workload counts, not performance. Pending or failed task loads show unknown assignment state instead of zero.
- **Assignment alone:** creates no run or model call. Owned run records are implemented; KAN-18 permission/audit draft execution is shipped. KAN-19 human review and explicit approved-parent handoffs are shipped.

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

A TaskForge task can be assigned to an agent. The assignment itself is complete (see above) and only records ownership. Explicitly creating a run queues requested work; execution remains a separate selected-mode action.

### Agent run model (KAN-17 foundation)

- Fields: `input`, `context`, `result`, and `status` (`queued` → `running` → `awaiting-approval` → `approved` / `rejected` / `failed`).
- Each run links to its owned task, assigned active agent, and owner.
- [Run foundation](../agent-runs.md) implements owned queued create/read APIs, retry identity and private atomic state transitions, attempt/deadline fencing and explicit expiry failure. KAN-18 shipped explicitly selected draft execution, cancellation and owned audit reads. KAN-19 adds exact-result/version owner review and its shipped Agent Detail UI. No worker or task/project mutation is enabled.

### Handoffs

KAN-22 shipped explicit approved-parent queued children for an owned task already assigned to the target active agent. Ancestry is bounded to three edges with no repeated agents; immutable source version/digest and visible parent/child links preserve history. Each child requires separate execution and human review; no assignment changes or automatic cascade. Full QA and protected delivery passed in PR #32.

### Approval/rejection workflow

Shipped under KAN-19: a human approves or rejects the exact owned result/version with an optional bounded note. The decision and safe audit are atomic; stale/repeated/foreign decisions fail. Approval does not apply content to tasks/projects. PR #29, main CI and matching live builds are verified.

### Agent activity UI

KAN-21 shipped owned run list/detail, statuses, input/output, frozen context, audit and review display with explicit creation/execution controls. Handoffs shipped under KAN-22; no synthetic activity or performance claims.

### Shared agent knowledge

Agents can read a minimal shared context (task and project notes). Full RAG comes in Phase 3.

### Starter agents

- **Chief of Staff MVP (KAN-23, shipped):** proposes priority and eligible agent recommendations for one owned assigned task, without applying changes.
- **Research Agent (KAN-25, shipped):** summarizes supplied excerpts and owned notes with captured quote attribution, labelled interpretations/inferences and limitations. Optional URLs are metadata only; no browsing/retrieval. Native quotes use source opening≤400 chars, not exhaustive extraction or factual verification.
- **Developer Agent (KAN-26, shipped):** drafts bounded structured technical plans and optional code as unexecuted text, with proposed checks and limitations. It has no repository access or code execution; autonomous repository work remains Phase 8.

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
- [x] An agent run moves through every planned lifecycle state.
- [x] Handoffs create linked child runs.
- [x] Every agent result needs human approval. Rejections are recorded.
- [x] `AIProvider` exists with a working local provider and a no-provider/demo fallback (KAN-15/16, PR #25/#26). Production disabled; explicit simulation; actual local smoke validated.
- [x] The Chief of Staff, Research, and Developer agents work end to end locally (actual local Ollama structured smoke plus real Mongo separately approved three-agent handoff chain under KAN-26; protected delivery passed and owner closure accepted).
- [x] The audit trail records every state change.
- [x] Permission boundaries are enforced on the server and tested.
- [x] Recurring cost is still $0.

KAN-26 verified all three workflows and the separately approved handoff chain locally. Full
validation, independent review, protected delivery and owner milestone acceptance are complete.
No approved phase expansion follows automatically.

## Portfolio/career value

Shows practical AI engineering: a provider-agnostic design, human-in-the-loop control, auditability, and permission modeling. These are the hard parts of shipping AI in enterprise and government settings.

## Cost constraints

$0 by default. Use local inference (Ollama) for development. Paid APIs are optional, opt-in, and never required for the app to work.

## Notes/decisions

- Human approval is mandatory in this phase. Agents never write to user data without it.
- Keep it to a few starter agents. Prove the run, handoff, and approval loop before adding more agents.

## Closure summary (2026-10-08)

Owner acceptance: Josh explicitly approved formal Phase2 closure; [KAN-26](https://taskforgejms.atlassian.net/browse/KAN-26)
is Done. [PR #36](https://github.com/WasteOfADrumBum/TaskForge/pull/36) merged as
`13d34d117dc369119ec15786afeab476b783187a`. Research shipped in [PR #35](https://github.com/WasteOfADrumBum/TaskForge/pull/35)
(`faf2c6c`); Chief of Staff in [PR #34](https://github.com/WasteOfADrumBum/TaskForge/pull/34)
(`1c7d784`). Existing ticket histories and task checkpoints retain earlier evidence.

- QA:1330 units (574client/756server),127 real Mongo/API cases across9 suites,12 Chromium
  flows,7 fixture safeguards, format/lint/types/both builds and dependency audit0 passed.
- Actual cached Ollama0.40.0/qwen3:0.6b chat/structured/Chief/Research/Developer smoke passed,
  simulationfalse, database/productioncalls0; owned runtime stopped. The real Mongo approved
  three-agent chain used explicit simulation; it is distinct from the actual model smoke.
- [Independent review](https://github.com/WasteOfADrumBum/TaskForge/pull/36#issuecomment-6062256755)
  found no implementation issues; minor stale documentation corrected.
- [Exact-head PR CI](https://github.com/WasteOfADrumBum/TaskForge/actions/runs/37793805940)
  and [main CI](https://github.com/WasteOfADrumBum/TaskForge/actions/runs/37794532087) passed.
- Vercel6938571013/Render6938568845 succeeded. Served frontend `/release.json` and API
  `/release` matched `13d34d1`; health/readiness200 and invalidJWT Developer execute401/no-store.
  Probes made no production data/model writes. Render GitHub ref metadata remained stale;
  served build identity was verified independently.

### Remaining limits

Free-tier service sleep/cold starts, resource/storage limits and manual recovery remain; this
milestone does not provide paid uptime/SLA or prove private backup/restore. Local API/browser
fixtures do not establish production CRUD, Atlas concurrency or exhaustive accessibility.

Production real inference is disabled. Explicit labelled simulation calls no model; actual
inference requires a trusted, cloud-disabled loopback Ollama daemon and a suitable local model.
Render cannot access an owner's localhost. Invalid/truncated local output fails closed without
automatic replay; chat256/structured512 token ceilings and execution deadlines remain.

Research uses supplied text/owned notes only, never URL retrieval. Native quotes choose source
openings≤400 characters after leading whitespace; quote matching establishes attribution, not
truth or exhaustive extraction. Chief recommendations are bounded to a first20 candidate window.
Developer plans/code are unexecuted/unverified text. Approval records a decision, never applies
content to tasks or repositories. All handoffs require separate execution and human review.

KAN-43 usage-efficient delivery remains in force; no repeated setup, weakened validation or
additional recurring cost. Original assignment WIP is preserved; Figma remains excluded.
Phases3–8 require separate explicit approval; Phase3 discussion is proposal-only.
