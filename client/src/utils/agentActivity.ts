import type { Agent } from '../types/agent';
import { getAgentId } from '../types/agent';
import type { AgentRun } from '../types/run';
import { getRunId } from '../types/run';
import type { Task } from '../types/task';
import { getTaskId } from '../types/task';

export const RECENT_RUN_LIMIT = 5;
export const FAILURE_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RecentRun {
  id: string;
  status: AgentRun['status'];
  at: string;
  agentName: string;
  taskTitle: string;
}

export interface AgentActivity {
  awaitingReview: number;
  inProgress: number;
  recentFailures: number;
  total: number;
  recent: RecentRun[];
}

// The most recent moment a run changed, falling back to when it was created.
const lastChange = (run: AgentRun) => {
  const updated = run.updatedAt ? Date.parse(run.updatedAt) : Number.NaN;
  return Number.isFinite(updated) ? updated : Date.parse(run.createdAt);
};

// Owner-scoped run summary for the Command Center. Names come from the user's own agents and
// tasks; a run whose agent or task is no longer loaded is labelled rather than hidden.
export const getAgentActivity = (
  runs: AgentRun[],
  agents: Agent[],
  tasks: Task[],
  now: Date,
): AgentActivity => {
  const agentNames = new Map(agents.map((agent) => [getAgentId(agent), agent.name]));
  const taskTitles = new Map(tasks.map((task) => [getTaskId(task), task.title]));
  const failureCutoff = now.getTime() - FAILURE_WINDOW_DAYS * DAY_MS;
  const valid = runs.filter((run) => getRunId(run) && Number.isFinite(lastChange(run)));
  return {
    awaitingReview: valid.filter((run) => run.status === 'awaiting-approval').length,
    inProgress: valid.filter((run) => run.status === 'queued' || run.status === 'running').length,
    recentFailures: valid.filter(
      (run) => run.status === 'failed' && lastChange(run) >= failureCutoff,
    ).length,
    total: valid.length,
    recent: [...valid]
      .sort((a, b) => lastChange(b) - lastChange(a) || getRunId(a).localeCompare(getRunId(b)))
      .slice(0, RECENT_RUN_LIMIT)
      .map((run) => ({
        id: getRunId(run),
        status: run.status,
        at: new Date(lastChange(run)).toISOString(),
        agentName: agentNames.get(run.agent) ?? 'Unknown agent',
        taskTitle: taskTitles.get(run.task) ?? 'Task not loaded',
      })),
  };
};
