import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import {
  createAgent,
  deleteAgentById,
  findAgentById,
  findAgentsByOwner,
  updateAgentById,
} from '../../services/agentService';

jest.mock('../../services/agentService', () => ({
  createAgent: jest.fn(),
  deleteAgentById: jest.fn(),
  findAgentById: jest.fn(),
  findAgentsByOwner: jest.fn(),
  updateAgentById: jest.fn(),
}));

const mockedCreate = jest.mocked(createAgent);
const mockedDelete = jest.mocked(deleteAgentById);
const mockedFindOne = jest.mocked(findAgentById);
const mockedFindAll = jest.mocked(findAgentsByOwner);
const mockedUpdate = jest.mocked(updateAgentById);
const userId = '507f1f77bcf86cd799439011';
const agentId = '507f1f77bcf86cd799439031';
const authorization = { Authorization: 'Bearer ' + jwt.sign({ id: userId }, 'test-jwt-secret') };
const valid = { name: 'Scout', role: 'Researcher' };

describe('agent routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['get', '/api/agents'],
    ['post', '/api/agents'],
    ['get', '/api/agents/' + agentId],
    ['patch', '/api/agents/' + agentId],
    ['delete', '/api/agents/' + agentId],
  ] as const)('requires authentication for %s %s', async (method, path) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Authentication required' });
  });

  it('rejects a token signed with the wrong secret', async () => {
    const response = await request(app)
      .get('/api/agents')
      .set({ Authorization: 'Bearer ' + jwt.sign({ id: userId }, 'wrong-secret') });
    expect(response.status).toBe(401);
    expect(mockedFindAll).not.toHaveBeenCalled();
  });

  it('lists the authenticated user’s agents', async () => {
    const agents = [{ id: agentId, name: 'Scout', owner: userId }];
    mockedFindAll.mockResolvedValue(agents as never);
    const response = await request(app).get('/api/agents').set(authorization);
    expect(response.status).toBe(200);
    expect(mockedFindAll).toHaveBeenCalledWith(userId);
    expect(response.body.agents).toEqual(agents);
  });

  it('creates an agent with trimmed text, normalized skills, and deduplicated permissions', async () => {
    const agent = { id: agentId, name: 'Scout' };
    mockedCreate.mockResolvedValue(agent as never);
    const response = await request(app)
      .post('/api/agents')
      .set(authorization)
      .send({
        name: '  Scout  ',
        role: ' Researcher ',
        description: ' Finds sources ',
        status: 'paused',
        skills: ['Research', ' Software Development ', 'research', 'project_management'],
        permissions: ['task.read', 'artifact.draft', 'task.read'],
      });
    expect(response.status).toBe(201);
    expect(mockedCreate).toHaveBeenCalledWith(userId, {
      name: 'Scout',
      role: 'Researcher',
      description: 'Finds sources',
      status: 'paused',
      skills: ['research', 'software-development', 'project-management'],
      permissions: ['task.read', 'artifact.draft'],
    });
    expect(response.body.agent).toEqual(agent);
  });

  it('creates an agent from only a name and role', async () => {
    mockedCreate.mockResolvedValue({ id: agentId } as never);
    const response = await request(app).post('/api/agents').set(authorization).send(valid);
    expect(response.status).toBe(201);
    expect(mockedCreate).toHaveBeenCalledWith(userId, valid);
  });

  it.each([
    [{}, 'Agent name is required'],
    [{ role: 'Researcher' }, 'Agent name is required'],
    [{ name: '   ', role: 'Researcher' }, 'Agent name is required'],
    [{ name: 42, role: 'Researcher' }, 'Agent name is required'],
    [{ name: 'x'.repeat(81), role: 'Researcher' }, 'Agent name is too long'],
    [{ name: 'Scout' }, 'Agent role is required'],
    [{ name: 'Scout', role: '' }, 'Agent role is required'],
    [{ ...valid, role: 'x'.repeat(81) }, 'Agent role is too long'],
    [{ ...valid, description: 5 }, 'Invalid agent description'],
    [{ ...valid, description: 'x'.repeat(2001) }, 'Agent description is too long'],
    [{ ...valid, status: 'running' }, 'Invalid agent status'],
    [{ ...valid, status: 'ACTIVE' }, 'Invalid agent status'],
    [{ ...valid, skills: 'research' }, 'Skills must be a list'],
    [{ ...valid, skills: [42] }, 'Invalid skill'],
    [{ ...valid, skills: ['  '] }, 'Invalid skill'],
    [{ ...valid, skills: ['c++'] }, 'Invalid skill'],
    [{ ...valid, skills: ['x'.repeat(41)] }, 'Invalid skill'],
    [{ ...valid, skills: Array.from({ length: 21 }, (_, i) => 'skill-' + i) }, 'Too many skills'],
    [{ ...valid, permissions: 'task.read' }, 'Permissions must be a list'],
    [{ ...valid, permissions: ['task.delete'] }, 'Invalid agent permission'],
    [{ ...valid, permissions: ['task.read', 7] }, 'Invalid agent permission'],
    [{ ...valid, permissions: ['TASK.READ'] }, 'Invalid agent permission'],
  ])('rejects invalid agent input %j', async (body, message) => {
    const response = await request(app).post('/api/agents').set(authorization).send(body);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('accepts exactly the maximum number of skills', async () => {
    mockedCreate.mockResolvedValue({ id: agentId } as never);
    const skills = Array.from({ length: 20 }, (_, i) => 'skill-' + i);
    const response = await request(app)
      .post('/api/agents')
      .set(authorization)
      .send({ ...valid, skills });
    expect(response.status).toBe(201);
    expect(mockedCreate).toHaveBeenCalledWith(userId, { ...valid, skills });
  });

  it('ignores owner and other server-controlled fields on create and update', async () => {
    mockedCreate.mockResolvedValue({ id: agentId } as never);
    mockedUpdate.mockResolvedValue({ id: agentId } as never);
    const intruder = {
      owner: '507f1f77bcf86cd799439099',
      _id: '507f1f77bcf86cd799439098',
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    };
    await request(app)
      .post('/api/agents')
      .set(authorization)
      .send({ ...valid, ...intruder });
    await request(app)
      .patch('/api/agents/' + agentId)
      .set(authorization)
      .send({ name: 'Mine', ...intruder });
    expect(mockedCreate).toHaveBeenCalledWith(userId, valid);
    expect(mockedUpdate).toHaveBeenCalledWith(userId, agentId, { name: 'Mine' });
  });

  it('returns a JSON 400 when the request has no body', async () => {
    const response = await request(app).post('/api/agents').set(authorization);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Agent name is required' });
  });

  it('gets one of the user’s agents', async () => {
    mockedFindOne.mockResolvedValue({ id: agentId, name: 'Scout' } as never);
    const response = await request(app)
      .get('/api/agents/' + agentId)
      .set(authorization);
    expect(response.status).toBe(200);
    expect(mockedFindOne).toHaveBeenCalledWith(userId, agentId);
    expect(response.body.agent.name).toBe('Scout');
  });

  it('returns 404 for an agent that is missing or not the user’s', async () => {
    mockedFindOne.mockResolvedValue(null);
    const response = await request(app)
      .get('/api/agents/' + agentId)
      .set(authorization);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Agent not found' });
  });

  it.each(['get', 'patch', 'delete'] as const)(
    'returns 404 for a malformed id on %s without querying',
    async (method) => {
      for (const id of ['not-an-id', '123456789012', 'z'.repeat(24)]) {
        const response = await request(app)
          [method]('/api/agents/' + id)
          .set(authorization);
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ message: 'Agent not found' });
      }
      expect(mockedFindOne).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockedDelete).not.toHaveBeenCalled();
    },
  );

  it('updates only the provided fields, replacing skills and permissions', async () => {
    mockedUpdate.mockResolvedValue({ id: agentId, status: 'disabled' } as never);
    const response = await request(app)
      .patch('/api/agents/' + agentId)
      .set(authorization)
      .send({ status: 'disabled', skills: [], permissions: ['project.read'] });
    expect(response.status).toBe(200);
    expect(mockedUpdate).toHaveBeenCalledWith(userId, agentId, {
      status: 'disabled',
      skills: [],
      permissions: ['project.read'],
    });
  });

  it.each([
    { status: 'deleted' },
    { name: '' },
    { role: '   ' },
    { skills: ['bad skill!'] },
    { permissions: ['admin'] },
  ])('rejects invalid update %j', async (body) => {
    const response = await request(app)
      .patch('/api/agents/' + agentId)
      .set(authorization)
      .send(body);
    expect(response.status).toBe(400);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('treats an update with no recognized fields as a no-op that does not touch updatedAt', async () => {
    mockedFindOne.mockResolvedValue({ id: agentId, name: 'Scout' } as never);
    const response = await request(app)
      .patch('/api/agents/' + agentId)
      .set(authorization)
      .send({ owner: '507f1f77bcf86cd799439099', unknown: true });
    expect(response.status).toBe(200);
    expect(response.body.agent.name).toBe('Scout');
    expect(mockedFindOne).toHaveBeenCalledWith(userId, agentId);
    expect(mockedUpdate).not.toHaveBeenCalled();

    mockedFindOne.mockResolvedValue(null);
    const foreign = await request(app)
      .patch('/api/agents/' + agentId)
      .set(authorization)
      .send({});
    expect(foreign.status).toBe(404);
  });

  it('rejects an oversized skills list without walking all of it', async () => {
    // Large but still under the 100 KB JSON body limit, so it reaches the controller.
    const skills = Array.from({ length: 9_000 }, (_, i) => 's' + i);
    const response = await request(app)
      .post('/api/agents')
      .set(authorization)
      .send({ ...valid, skills });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Too many skills' });
  });

  it('counts duplicate skills once toward the limit', async () => {
    mockedCreate.mockResolvedValue({ id: agentId } as never);
    const skills = Array.from({ length: 100 }, () => 'research');
    const response = await request(app)
      .post('/api/agents')
      .set(authorization)
      .send({ ...valid, skills });
    expect(response.status).toBe(201);
    expect(mockedCreate).toHaveBeenCalledWith(userId, { ...valid, skills: ['research'] });
  });

  it('returns 404 when updating an agent that is not the user’s', async () => {
    mockedUpdate.mockResolvedValue(null);
    const response = await request(app)
      .patch('/api/agents/' + agentId)
      .set(authorization)
      .send({ name: 'Mine now' });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Agent not found' });
  });

  it('deletes the user’s agent', async () => {
    mockedDelete.mockResolvedValue({ id: agentId } as never);
    const response = await request(app)
      .delete('/api/agents/' + agentId)
      .set(authorization);
    expect(response.status).toBe(204);
    expect(mockedDelete).toHaveBeenCalledWith(userId, agentId);
  });

  it('returns 404 when deleting an agent that is not the user’s', async () => {
    mockedDelete.mockResolvedValue(null);
    const response = await request(app)
      .delete('/api/agents/' + agentId)
      .set(authorization);
    expect(response.status).toBe(404);
  });

  it.each([
    ['get', '/api/agents', () => mockedFindAll],
    ['post', '/api/agents', () => mockedCreate],
    ['get', '/api/agents/' + agentId, () => mockedFindOne],
    ['patch', '/api/agents/' + agentId, () => mockedUpdate],
    ['delete', '/api/agents/' + agentId, () => mockedDelete],
  ] as const)(
    'returns a generic JSON 500 when %s %s fails unexpectedly',
    async (method, path, mock) => {
      mock().mockRejectedValue(new Error('connection lost: mongodb://secret@host'));
      const response = await request(app)[method](path).set(authorization).send(valid);
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Server error' });
      expect(response.text).not.toMatch(/connection lost|secret/);
    },
  );
});
