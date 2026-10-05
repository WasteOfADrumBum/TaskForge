import { Agent } from '../../models/agentModel';
import { Task } from '../../models/taskModel';
import {
  createAgent,
  deleteAgentById,
  findAgentById,
  findAgentStatus,
  findAgentsByOwner,
  updateAgentById,
} from './index';

jest.mock('../../models/agentModel', () => ({
  AGENT_STATUSES: ['active', 'paused', 'disabled'],
  AGENT_PERMISSIONS: [
    'task.read',
    'task.update',
    'project.read',
    'project.update',
    'artifact.draft',
  ],
  Agent: {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  },
}));
jest.mock('../../models/taskModel', () => ({
  Task: { updateMany: jest.fn() },
}));

const mockedAgent = jest.mocked(Agent);
const mockedTask = jest.mocked(Task);
const ownerId = '507f1f77bcf86cd799439011';
const agentId = '507f1f77bcf86cd799439031';

describe('agentService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('creates an agent owned by the user, overriding any owner in the data', async () => {
    mockedAgent.create.mockResolvedValue({ name: 'Scout' } as never);
    await createAgent(ownerId, {
      name: 'Scout',
      role: 'Researcher',
      owner: 'someone-else',
    } as never);
    expect(mockedAgent.create).toHaveBeenCalledWith({
      name: 'Scout',
      role: 'Researcher',
      owner: ownerId,
    });
  });

  it('lists only the owner’s agents, most recently updated first', async () => {
    const sort = jest.fn().mockResolvedValue([]);
    mockedAgent.find.mockReturnValue({ sort } as never);
    await findAgentsByOwner(ownerId);
    expect(mockedAgent.find).toHaveBeenCalledWith({ owner: ownerId });
    expect(sort).toHaveBeenCalledWith({ updatedAt: -1 });
  });

  it('scopes reads, updates, and deletes to the owner', async () => {
    mockedAgent.findOne.mockResolvedValue(null);
    mockedAgent.findOneAndUpdate.mockResolvedValue(null);

    await expect(findAgentById(ownerId, agentId)).resolves.toBeNull();
    expect(mockedAgent.findOne).toHaveBeenCalledWith({ _id: agentId, owner: ownerId });

    await updateAgentById(ownerId, agentId, { status: 'paused' });
    expect(mockedAgent.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: agentId, owner: ownerId },
      { status: 'paused' },
      { new: true, runValidators: true },
    );

    await expect(deleteAgentById(ownerId, agentId)).resolves.toBeNull();
    expect(mockedAgent.findOne).toHaveBeenLastCalledWith({ _id: agentId, owner: ownerId });
  });

  it('reads only the status of the owner’s agent', async () => {
    mockedAgent.findOne.mockResolvedValue({ status: 'paused' } as never);
    await expect(findAgentStatus(ownerId, agentId)).resolves.toBe('paused');
    expect(mockedAgent.findOne).toHaveBeenCalledWith(
      { _id: agentId, owner: ownerId },
      { status: 1 },
    );
  });

  it('has no status for a missing or another user’s agent', async () => {
    mockedAgent.findOne.mockResolvedValue(null);
    await expect(findAgentStatus(ownerId, agentId)).resolves.toBeNull();
  });

  describe('deleteAgentById', () => {
    it('unassigns the owner’s tasks before and after deleting the agent', async () => {
      const calls: string[] = [];
      mockedAgent.findOne.mockResolvedValue({ _id: agentId } as never);
      mockedTask.updateMany.mockImplementation((() => {
        calls.push('unassign');
        return Promise.resolve({ modifiedCount: 2 });
      }) as never);
      mockedAgent.deleteOne.mockImplementation((() => {
        calls.push('delete');
        return Promise.resolve({ deletedCount: 1 });
      }) as never);

      await expect(deleteAgentById(ownerId, agentId)).resolves.toEqual({ _id: agentId });
      expect(calls).toEqual(['unassign', 'delete', 'unassign']);
      // Tasks are kept: only their assignment is cleared, and only for this owner's tasks.
      expect(mockedTask.updateMany).toHaveBeenCalledWith(
        { owner: ownerId, assigneeAgent: agentId },
        { $set: { assigneeType: null, assigneeAgent: null } },
      );
      expect(mockedAgent.deleteOne).toHaveBeenCalledWith({ _id: agentId, owner: ownerId });
    });

    it('changes nothing when the agent is not the owner’s', async () => {
      mockedAgent.findOne.mockResolvedValue(null);
      await expect(deleteAgentById(ownerId, agentId)).resolves.toBeNull();
      expect(mockedTask.updateMany).not.toHaveBeenCalled();
      expect(mockedAgent.deleteOne).not.toHaveBeenCalled();
    });

    it('still reports success if only the post-delete cleanup fails', async () => {
      mockedAgent.findOne.mockResolvedValue({ _id: agentId } as never);
      mockedAgent.deleteOne.mockResolvedValue({ deletedCount: 1 } as never);
      mockedTask.updateMany
        .mockResolvedValueOnce({ modifiedCount: 1 } as never)
        .mockRejectedValueOnce(new Error('cleanup failed') as never);
      await expect(deleteAgentById(ownerId, agentId)).resolves.toEqual({ _id: agentId });
    });

    it('reports a delete failure after cleanup and keeps the agent available for retry', async () => {
      mockedAgent.findOne.mockResolvedValue({ _id: agentId } as never);
      mockedTask.updateMany.mockResolvedValue({ modifiedCount: 2 } as never);
      mockedAgent.deleteOne.mockRejectedValue(new Error('delete failed'));
      await expect(deleteAgentById(ownerId, agentId)).rejects.toThrow('delete failed');
      expect(mockedTask.updateMany).toHaveBeenCalledTimes(1);
      expect(mockedAgent.deleteOne).toHaveBeenCalledWith({ _id: agentId, owner: ownerId });
    });

    it('finishes cleanup when a concurrent request already deleted the agent', async () => {
      mockedAgent.findOne.mockResolvedValue({ _id: agentId } as never);
      mockedTask.updateMany.mockResolvedValue({ modifiedCount: 1 } as never);
      mockedAgent.deleteOne.mockResolvedValue({ deletedCount: 0 } as never);
      await expect(deleteAgentById(ownerId, agentId)).resolves.toEqual({ _id: agentId });
      expect(mockedTask.updateMany).toHaveBeenCalledTimes(2);
    });
    it('leaves the agent in place if unassigning its tasks fails', async () => {
      mockedAgent.findOne.mockResolvedValue({ _id: agentId } as never);
      mockedTask.updateMany.mockRejectedValue(new Error('write failed') as never);
      await expect(deleteAgentById(ownerId, agentId)).rejects.toThrow('write failed');
      expect(mockedAgent.deleteOne).not.toHaveBeenCalled();
    });
  });
});
