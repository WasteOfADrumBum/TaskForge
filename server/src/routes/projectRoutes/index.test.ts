import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import {
  createProject,
  deleteProjectById,
  findProjectById,
  findProjectsByOwner,
  updateProjectById,
} from '../../services/projectService';

jest.mock('../../services/projectService', () => ({
  createProject: jest.fn(),
  deleteProjectById: jest.fn(),
  findProjectById: jest.fn(),
  findProjectsByOwner: jest.fn(),
  updateProjectById: jest.fn(),
  ownsProject: jest.fn(),
}));

const mockedCreate = jest.mocked(createProject);
const mockedDelete = jest.mocked(deleteProjectById);
const mockedFindOne = jest.mocked(findProjectById);
const mockedFindAll = jest.mocked(findProjectsByOwner);
const mockedUpdate = jest.mocked(updateProjectById);
const userId = '507f1f77bcf86cd799439011';
const projectId = '507f1f77bcf86cd799439021';
const authorization = { Authorization: 'Bearer ' + jwt.sign({ id: userId }, 'test-jwt-secret') };

describe('project routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['get', '/api/projects'],
    ['post', '/api/projects'],
    ['get', '/api/projects/' + projectId],
    ['patch', '/api/projects/' + projectId],
    ['delete', '/api/projects/' + projectId],
  ] as const)('requires authentication for %s %s', async (method, path) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Authentication required' });
  });

  it('lists the authenticated user’s projects', async () => {
    const projects = [{ id: projectId, name: 'Launch', owner: userId }];
    mockedFindAll.mockResolvedValue(projects as never);
    const response = await request(app).get('/api/projects').set(authorization);
    expect(response.status).toBe(200);
    expect(mockedFindAll).toHaveBeenCalledWith(userId);
    expect(response.body.projects).toEqual(projects);
  });

  it('creates a project with a trimmed name', async () => {
    const project = { id: projectId, name: 'Launch', status: 'active', owner: userId };
    mockedCreate.mockResolvedValue(project as never);
    const response = await request(app)
      .post('/api/projects')
      .set(authorization)
      .send({ name: '  Launch  ', description: 'Ship v2', status: 'active' });
    expect(response.status).toBe(201);
    expect(mockedCreate).toHaveBeenCalledWith(userId, {
      name: 'Launch',
      description: 'Ship v2',
      status: 'active',
    });
    expect(response.body.project).toEqual(project);
  });

  it.each([
    [{}, 'Project name is required'],
    [{ name: '   ' }, 'Project name is required'],
    [{ name: 42 }, 'Project name is required'],
    [{ name: 'x'.repeat(121) }, 'Project name is too long'],
    [{ name: 'Launch', description: 5 }, 'Invalid project description'],
    [{ name: 'Launch', description: 'x'.repeat(2001) }, 'Project description is too long'],
    [{ name: 'Launch', status: 'paused' }, 'Invalid project status'],
  ])('rejects invalid project input %j', async (body, message) => {
    const response = await request(app).post('/api/projects').set(authorization).send(body);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('ignores an owner field in the body on create and update', async () => {
    mockedCreate.mockResolvedValue({ id: projectId } as never);
    mockedUpdate.mockResolvedValue({ id: projectId } as never);
    const intruder = '507f1f77bcf86cd799439099';
    await request(app)
      .post('/api/projects')
      .set(authorization)
      .send({ name: 'Mine', owner: intruder });
    await request(app)
      .patch('/api/projects/' + projectId)
      .set(authorization)
      .send({ name: 'Mine', owner: intruder });
    expect(mockedCreate).toHaveBeenCalledWith(userId, { name: 'Mine' });
    expect(mockedUpdate).toHaveBeenCalledWith(userId, projectId, { name: 'Mine' });
  });

  it('returns a JSON 400 when the request has no body', async () => {
    const response = await request(app).post('/api/projects').set(authorization);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Project name is required' });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('gets one of the user’s projects', async () => {
    mockedFindOne.mockResolvedValue({ id: projectId, name: 'Launch' } as never);
    const response = await request(app)
      .get('/api/projects/' + projectId)
      .set(authorization);
    expect(response.status).toBe(200);
    expect(mockedFindOne).toHaveBeenCalledWith(userId, projectId);
    expect(response.body.project.name).toBe('Launch');
  });

  it('returns 404 for a project that is missing or not the user’s', async () => {
    mockedFindOne.mockResolvedValue(null);
    const response = await request(app)
      .get('/api/projects/' + projectId)
      .set(authorization);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Project not found' });
  });

  it.each(['get', 'patch', 'delete'] as const)(
    'returns 404 for a malformed id on %s without querying',
    async (method) => {
      const response = await request(app)[method]('/api/projects/not-an-id').set(authorization);
      expect(response.status).toBe(404);
      expect(mockedFindOne).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockedDelete).not.toHaveBeenCalled();
    },
  );

  it('updates only the provided fields', async () => {
    mockedUpdate.mockResolvedValue({ id: projectId, status: 'completed' } as never);
    const response = await request(app)
      .patch('/api/projects/' + projectId)
      .set(authorization)
      .send({ status: 'completed' });
    expect(response.status).toBe(200);
    expect(mockedUpdate).toHaveBeenCalledWith(userId, projectId, { status: 'completed' });
  });

  it('rejects an invalid status or empty name on update', async () => {
    for (const body of [{ status: 'done' }, { name: '' }]) {
      const response = await request(app)
        .patch('/api/projects/' + projectId)
        .set(authorization)
        .send(body);
      expect(response.status).toBe(400);
    }
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when updating a project that is not the user’s', async () => {
    mockedUpdate.mockResolvedValue(null);
    const response = await request(app)
      .patch('/api/projects/' + projectId)
      .set(authorization)
      .send({ name: 'Mine now' });
    expect(response.status).toBe(404);
  });

  it('deletes the user’s project', async () => {
    mockedDelete.mockResolvedValue({ id: projectId } as never);
    const response = await request(app)
      .delete('/api/projects/' + projectId)
      .set(authorization);
    expect(response.status).toBe(204);
    expect(mockedDelete).toHaveBeenCalledWith(userId, projectId);
  });

  it('returns 404 when deleting a project that is not the user’s', async () => {
    mockedDelete.mockResolvedValue(null);
    const response = await request(app)
      .delete('/api/projects/' + projectId)
      .set(authorization);
    expect(response.status).toBe(404);
  });

  it('returns 500 without details when the database fails', async () => {
    mockedFindAll.mockRejectedValue(new Error('connection lost'));
    const response = await request(app).get('/api/projects').set(authorization);
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Server error' });
  });
});
