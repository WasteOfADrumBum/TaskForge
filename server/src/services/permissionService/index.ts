import { Run } from '../../models/runModel';
import { Task } from '../../models/taskModel';
import { Agent, AGENT_PERMISSIONS } from '../../models/agentModel';
import { Project } from '../../models/projectModel';

export type DraftDenialReason =
  | 'run-not-found'
  | 'task-not-assigned'
  | 'agent-not-active'
  | 'missing-permission'
  | 'invalid-permission'
  | 'project-not-found';
export const authorizeRunDraft = async (owner: string, runId: string, includeProject = false) => {
  const run = await Run.findOne({ _id: runId, owner });
  if (!run) return { allowed: false as const, reason: 'run-not-found' as const };
  const agent = await Agent.findOne({ _id: run.agent, owner, status: 'active' });
  if (!agent) return { allowed: false as const, reason: 'agent-not-active' as const };
  // Read current persisted permissions only. Unknown identifiers never expand authority.
  if (
    !Array.isArray(agent.permissions) ||
    agent.permissions.some((permission) => !AGENT_PERMISSIONS.includes(permission as never))
  )
    return { allowed: false as const, reason: 'invalid-permission' as const };
  const required = ['task.read', 'artifact.draft', ...(includeProject ? ['project.read'] : [])];
  if (required.some((permission) => !new Set<string>(agent.permissions).has(permission)))
    return { allowed: false as const, reason: 'missing-permission' as const };
  const task = await Task.findOne({
    _id: run.task,
    owner,
    assigneeType: 'agent',
    assigneeAgent: run.agent,
  });
  if (!task) return { allowed: false as const, reason: 'task-not-assigned' as const };
  const project =
    includeProject && task.project ? await Project.findOne({ _id: task.project, owner }) : null;
  if (includeProject && task.project && !project)
    return { allowed: false as const, reason: 'project-not-found' as const };
  return { allowed: true as const, run, task, agent, project };
};
