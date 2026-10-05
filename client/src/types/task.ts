export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
// 'user' is always the signed-in owner; 'agent' is one of the owner's agents. Matches
// server/src/models/taskModel. Assigning to an agent only records it; nothing runs the agent.
export type TaskAssigneeType = 'user' | 'agent';

export interface Task {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  // Id of the owner's project, or null/absent when the task has no project.
  project?: string | null;
  // Absent or null on both means Unassigned. assigneeAgent is set only for an agent assignee.
  assigneeType?: TaskAssigneeType | null;
  assigneeAgent?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  project?: string | null;
  // Send both together; the server rejects an agent id without assigneeType 'agent'.
  assigneeType?: TaskAssigneeType | null;
  assigneeAgent?: string | null;
}

export type TaskUpdate = Partial<TaskInput>;

export const getTaskId = (task: Task) => task._id ?? task.id ?? '';
