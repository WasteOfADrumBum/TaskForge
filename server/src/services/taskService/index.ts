import { Agent } from '../../models/agentModel';
import { Task } from '../../models/taskModel';

export interface TaskInput {
  title: string;
  description?: string;
  status?: 'todo' | 'in-progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string | null;
  // A project the owner owns, or null for no project. The controller checks ownership.
  project?: string | null;
  // The controller checks that an agent assignee is the owner's own agent.
  assigneeType?: 'user' | 'agent' | null;
  assigneeAgent?: string | null;
}

export type TaskUpdate = Partial<TaskInput>;

// A controller's ownership check can finish before an agent is deleted. Recheck after
// writing, and clear only the exact assignment we just observed so a concurrent edit wins.
// Status is deliberately ignored: paused and disabled agents retain existing assignments.
const reconcileAgentAssignment = async (
  ownerId: string,
  task: InstanceType<typeof Task> | null,
) => {
  if (!task || task.assigneeType !== 'agent' || !task.assigneeAgent) return task;
  const agentId = task.assigneeAgent;
  if (await Agent.exists({ _id: agentId, owner: ownerId })) return task;
  const cleared = await Task.findOneAndUpdate(
    { _id: task._id, owner: ownerId, assigneeType: 'agent', assigneeAgent: agentId },
    { $set: { assigneeType: null, assigneeAgent: null } },
    { new: true, runValidators: true },
  );
  // Another request may have changed or deleted this task while we checked the agent.
  return cleared ?? Task.findOne({ _id: task._id, owner: ownerId });
};

export const createTask = async (ownerId: string, taskData: TaskInput) => {
  const task = await Task.create({
    ...taskData,
    owner: ownerId,
    completedAt: taskData.status === 'done' ? new Date() : null,
  });
  return reconcileAgentAssignment(ownerId, task);
};

export const findTasksByOwner = async (ownerId: string) => {
  return Task.find({ owner: ownerId }).sort({ createdAt: -1 });
};

const updateOptions = { new: true, runValidators: true };

// completedAt follows status: it is stamped when a task moves into done, kept when a task that
// is already done is saved as done again, and cleared when it leaves done. Each write filters on
// the status it expects, so a concurrent reopen between the two writes cannot leave a done task
// without a time; if both writes miss because status changed underneath, try once more.
const writeUpdate = async (ownerId: string, taskId: string, updates: TaskUpdate) => {
  const owned = { _id: taskId, owner: ownerId };
  if (updates.status === undefined) return Task.findOneAndUpdate(owned, updates, updateOptions);
  if (updates.status !== 'done') {
    return Task.findOneAndUpdate(owned, { ...updates, completedAt: null }, updateOptions);
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const newlyDone = await Task.findOneAndUpdate(
      { ...owned, status: { $ne: 'done' } },
      { ...updates, completedAt: new Date() },
      updateOptions,
    );
    if (newlyDone) return newlyDone;
    // Already done: keep the original completion time.
    const stillDone = await Task.findOneAndUpdate(
      { ...owned, status: 'done' },
      updates,
      updateOptions,
    );
    if (stillDone) return stillDone;
    if (!(await Task.exists(owned))) return null;
  }
  return Task.findOne(owned);
};

export const updateTaskById = async (ownerId: string, taskId: string, updates: TaskUpdate) => {
  const task = await writeUpdate(ownerId, taskId, updates);
  return reconcileAgentAssignment(ownerId, task);
};

export const deleteTaskById = async (ownerId: string, taskId: string) => {
  return Task.findOneAndDelete({ _id: taskId, owner: ownerId });
};

// Whether the owner's task is currently assigned to this agent.
export const isTaskAssignedToAgent = async (ownerId: string, taskId: string, agentId: string) => {
  return (
    (await Task.exists({
      _id: taskId,
      owner: ownerId,
      assigneeType: 'agent',
      assigneeAgent: agentId,
    })) !== null
  );
};
