import { Agent } from '../../models/agentModel';
import { Task } from '../../models/taskModel';
import { createTask, isTaskAssignedToAgent, updateTaskById } from './index';

jest.mock('../../models/agentModel', () => ({ Agent: { exists: jest.fn() } }));
jest.mock('../../models/taskModel', () => ({
  Task: {
    exists: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
  },
}));

const mockedTask = jest.mocked(Task);
const mockedAgent = jest.mocked(Agent);
const ownerId = '507f1f77bcf86cd799439011';
const taskId = '507f1f77bcf86cd799439012';
const agentId = '507f1f77bcf86cd799439031';
const assigned = { _id: taskId, title: 'Build', assigneeType: 'agent', assigneeAgent: agentId };
const unassigned = { ...assigned, assigneeType: null, assigneeAgent: null };

beforeEach(() => {
  jest.resetAllMocks();
});

describe('taskService.isTaskAssignedToAgent', () => {
  it('checks the owner’s task for that agent and assignment type', async () => {
    mockedTask.exists.mockResolvedValue({ _id: taskId } as never);
    await expect(isTaskAssignedToAgent(ownerId, taskId, agentId)).resolves.toBe(true);
    expect(mockedTask.exists).toHaveBeenCalledWith({
      _id: taskId,
      owner: ownerId,
      assigneeType: 'agent',
      assigneeAgent: agentId,
    });
  });

  it('is false when no such task exists for the owner', async () => {
    mockedTask.exists.mockResolvedValue(null);
    await expect(isTaskAssignedToAgent(ownerId, taskId, agentId)).resolves.toBe(false);
  });
});

describe('taskService assignment reconciliation', () => {
  it('clears an assignment created after agent deletion completed', async () => {
    const calls: string[] = [];
    mockedTask.create.mockImplementation((async () => {
      calls.push('write');
      return assigned;
    }) as never);
    mockedAgent.exists.mockImplementation((async () => {
      calls.push('recheck');
      return null;
    }) as never);
    mockedTask.findOneAndUpdate.mockResolvedValue(unassigned as never);

    await expect(
      createTask(ownerId, { title: 'Build', assigneeType: 'agent', assigneeAgent: agentId }),
    ).resolves.toEqual(unassigned);
    expect(calls).toEqual(['write', 'recheck']);
    expect(mockedTask.create).toHaveBeenCalledWith({
      title: 'Build',
      assigneeType: 'agent',
      assigneeAgent: agentId,
      owner: ownerId,
      completedAt: null,
    });
    expect(mockedAgent.exists).toHaveBeenCalledWith({ _id: agentId, owner: ownerId });
    expect(mockedTask.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: taskId, owner: ownerId, assigneeType: 'agent', assigneeAgent: agentId },
      { $set: { assigneeType: null, assigneeAgent: null } },
      { new: true, runValidators: true },
    );
  });

  it('clears a dangling assignment after an update without losing its other changes', async () => {
    mockedTask.findOneAndUpdate
      .mockResolvedValueOnce({ ...assigned, title: 'Renamed', status: 'done' } as never)
      .mockResolvedValueOnce({ ...unassigned, title: 'Renamed', status: 'done' } as never);
    mockedAgent.exists.mockResolvedValue(null);
    await expect(
      updateTaskById(ownerId, taskId, { title: 'Renamed', status: 'done' }),
    ).resolves.toEqual({ ...unassigned, title: 'Renamed', status: 'done' });
    expect(mockedTask.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { _id: taskId, owner: ownerId, status: { $ne: 'done' } },
      { title: 'Renamed', status: 'done', completedAt: expect.any(Date) },
      { new: true, runValidators: true },
    );
  });

  it('does not overwrite a concurrent reassignment when conditional cleanup misses', async () => {
    const reassigned = { ...assigned, assigneeAgent: '507f1f77bcf86cd799439032' };
    mockedTask.findOneAndUpdate
      .mockResolvedValueOnce(assigned as never)
      .mockResolvedValueOnce(null);
    mockedAgent.exists.mockResolvedValue(null);
    mockedTask.findOne.mockResolvedValue(reassigned as never);
    await expect(updateTaskById(ownerId, taskId, { title: 'Build' })).resolves.toEqual(reassigned);
    expect(mockedTask.findOne).toHaveBeenCalledWith({ _id: taskId, owner: ownerId });
  });

  it('returns null if a newly created task is deleted during assignment reconciliation', async () => {
    mockedTask.create.mockResolvedValue(assigned as never);
    mockedAgent.exists.mockResolvedValue(null);
    mockedTask.findOneAndUpdate.mockResolvedValue(null);
    mockedTask.findOne.mockResolvedValue(null);
    await expect(
      createTask(ownerId, { title: 'Build', assigneeType: 'agent', assigneeAgent: agentId }),
    ).resolves.toBeNull();
    expect(mockedTask.findOne).toHaveBeenCalledWith({ _id: taskId, owner: ownerId });
  });
  it('returns null if a task was concurrently deleted while cleanup was pending', async () => {
    mockedTask.findOneAndUpdate
      .mockResolvedValueOnce(assigned as never)
      .mockResolvedValueOnce(null);
    mockedAgent.exists.mockResolvedValue(null);
    mockedTask.findOne.mockResolvedValue(null);
    await expect(updateTaskById(ownerId, taskId, { title: 'Build' })).resolves.toBeNull();
  });

  it.each(['active', 'paused', 'disabled'])(
    'retains an existing %s agent assignment',
    async (status) => {
      mockedTask.findOneAndUpdate.mockResolvedValue(assigned as never);
      mockedAgent.exists.mockResolvedValue({ _id: agentId, status } as never);
      await expect(updateTaskById(ownerId, taskId, { title: 'Build' })).resolves.toEqual(assigned);
      expect(mockedTask.findOneAndUpdate).toHaveBeenCalledTimes(1);
      // Existence rather than status preserves paused/disabled assignments.
      expect(mockedAgent.exists).toHaveBeenCalledWith({ _id: agentId, owner: ownerId });
    },
  );

  it.each([null, 'user'] as const)(
    'skips the agent lookup for %s assignment',
    async (assigneeType) => {
      const task = { ...unassigned, assigneeType };
      mockedTask.create.mockResolvedValue(task as never);
      await expect(createTask(ownerId, { title: 'Build', assigneeType })).resolves.toEqual(task);
      expect(mockedAgent.exists).not.toHaveBeenCalled();
    },
  );

  it('does not query agents or clear tasks when the owner-scoped update misses', async () => {
    mockedTask.findOneAndUpdate.mockResolvedValue(null);
    await expect(updateTaskById(ownerId, taskId, { title: 'Build' })).resolves.toBeNull();
    expect(mockedAgent.exists).not.toHaveBeenCalled();
    expect(mockedTask.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('propagates failed reconciliation rather than returning a dangling assignment', async () => {
    mockedTask.create.mockResolvedValue(assigned as never);
    mockedAgent.exists.mockResolvedValue(null);
    mockedTask.findOneAndUpdate.mockRejectedValue(new Error('cleanup failed'));
    await expect(createTask(ownerId, { title: 'Build' })).rejects.toThrow('cleanup failed');
  });
});

describe('taskService completion time', () => {
  const options = { new: true, runValidators: true };
  const now = new Date('2026-11-15T23:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers({ now, doNotFake: ['nextTick', 'setImmediate'] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('stamps a task created as done and leaves other new tasks without one', async () => {
    mockedTask.create.mockResolvedValue(unassigned as never);
    await createTask(ownerId, { title: 'Ship', status: 'done' });
    expect(mockedTask.create).toHaveBeenLastCalledWith({
      title: 'Ship',
      status: 'done',
      owner: ownerId,
      completedAt: now,
    });
    await createTask(ownerId, { title: 'Plan', status: 'in-progress' });
    expect(mockedTask.create).toHaveBeenLastCalledWith({
      title: 'Plan',
      status: 'in-progress',
      owner: ownerId,
      completedAt: null,
    });
  });

  it('stamps a task when it moves into done, in one status-filtered write', async () => {
    const done = { ...unassigned, status: 'done', completedAt: now };
    mockedTask.findOneAndUpdate.mockResolvedValue(done as never);
    await expect(updateTaskById(ownerId, taskId, { status: 'done' })).resolves.toEqual(done);
    expect(mockedTask.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockedTask.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: taskId, owner: ownerId, status: { $ne: 'done' } },
      { status: 'done', completedAt: now },
      options,
    );
  });

  it('keeps the original time when a task that is already done is saved as done', async () => {
    const earlier = { ...unassigned, status: 'done', completedAt: '2026-11-01T10:00:00.000Z' };
    mockedTask.findOneAndUpdate.mockResolvedValueOnce(null).mockResolvedValueOnce(earlier as never);
    await expect(
      updateTaskById(ownerId, taskId, { title: 'Renamed', status: 'done' }),
    ).resolves.toEqual(earlier);
    expect(mockedTask.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { _id: taskId, owner: ownerId },
      { title: 'Renamed', status: 'done' },
      options,
    );
  });

  it('returns null when the task is not the owner’s', async () => {
    mockedTask.findOneAndUpdate.mockResolvedValue(null);
    await expect(updateTaskById(ownerId, taskId, { status: 'done' })).resolves.toBeNull();
    expect(mockedTask.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it.each(['todo', 'in-progress'] as const)(
    'clears the time when a task moves to %s',
    async (status) => {
      mockedTask.findOneAndUpdate.mockResolvedValue({ ...unassigned, status } as never);
      await updateTaskById(ownerId, taskId, { status });
      expect(mockedTask.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: taskId, owner: ownerId },
        { status, completedAt: null },
        options,
      );
    },
  );

  it('leaves the time alone when status is not part of the update', async () => {
    mockedTask.findOneAndUpdate.mockResolvedValue(unassigned as never);
    await updateTaskById(ownerId, taskId, { title: 'Renamed' });
    expect(mockedTask.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: taskId, owner: ownerId },
      { title: 'Renamed' },
      options,
    );
  });
});
