import { Agent } from '../../models/agentModel';
import {
  createAgent,
  deleteAgentById,
  findAgentById,
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
    findOneAndDelete: jest.fn(),
  },
}));

const mockedAgent = jest.mocked(Agent);
const ownerId = '507f1f77bcf86cd799439011';
const agentId = '507f1f77bcf86cd799439031';

describe('agentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    mockedAgent.findOneAndDelete.mockResolvedValue(null);

    await expect(findAgentById(ownerId, agentId)).resolves.toBeNull();
    expect(mockedAgent.findOne).toHaveBeenCalledWith({ _id: agentId, owner: ownerId });

    await updateAgentById(ownerId, agentId, { status: 'paused' });
    expect(mockedAgent.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: agentId, owner: ownerId },
      { status: 'paused' },
      { new: true, runValidators: true },
    );

    await expect(deleteAgentById(ownerId, agentId)).resolves.toBeNull();
    expect(mockedAgent.findOneAndDelete).toHaveBeenCalledWith({ _id: agentId, owner: ownerId });
  });
});
