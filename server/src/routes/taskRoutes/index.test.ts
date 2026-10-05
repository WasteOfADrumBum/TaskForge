import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { findAgentStatus } from '../../services/agentService';
import { ownsProject } from '../../services/projectService';
import {
  createTask,
  deleteTaskById,
  findTasksByOwner,
  isTaskAssignedToAgent,
  updateTaskById,
} from '../../services/taskService';

jest.mock('../../services/taskService', () => ({
  createTask: jest.fn(),
  deleteTaskById: jest.fn(),
  findTasksByOwner: jest.fn(),
  isTaskAssignedToAgent: jest.fn(),
  updateTaskById: jest.fn(),
}));
jest.mock('../../services/projectService', () => ({ ownsProject: jest.fn() }));
jest.mock('../../services/agentService', () => ({ findAgentStatus: jest.fn() }));

const mockedFindAgentStatus = jest.mocked(findAgentStatus);
const mockedIsTaskAssignedToAgent = jest.mocked(isTaskAssignedToAgent);
const agentId = '507f1f77bcf86cd799439031';

const mockedOwnsProject = jest.mocked(ownsProject);
const projectId = '507f1f77bcf86cd799439021';

const mockedCreateTask = jest.mocked(createTask);
const mockedDeleteTaskById = jest.mocked(deleteTaskById);
const mockedFindTasksByOwner = jest.mocked(findTasksByOwner);
const mockedUpdateTaskById = jest.mocked(updateTaskById);
const userId = '507f1f77bcf86cd799439011';
const taskId = '507f1f77bcf86cd799439012';
const token = jwt.sign({ id: userId }, 'test-jwt-secret');
const authorization = { Authorization: 'Bearer ' + token };

describe('task routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects requests without authentication', async () => {
    const response = await request(app).get('/api/tasks');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Authentication required' });
  });

  it.each([
    jwt.sign({ id: userId }, 'test-jwt-secret', { expiresIn: -1 }),
    jwt.sign({ id: userId }, 'wrong-secret', { expiresIn: '7d' }),
    'malformed',
  ])('rejects expired, incorrectly signed, and malformed JWTs', async (invalidToken) => {
    const response = await request(app)
      .get('/api/tasks')
      .set('Authorization', 'Bearer ' + invalidToken);
    expect(response.status).toBe(401);
    expect(mockedFindTasksByOwner).not.toHaveBeenCalled();
  });

  it('lists tasks owned by the authenticated user', async () => {
    const tasks = [{ id: taskId, title: 'First task', owner: userId }];
    mockedFindTasksByOwner.mockResolvedValue(tasks as never);
    const response = await request(app).get('/api/tasks').set(authorization);
    expect(response.status).toBe(200);
    expect(mockedFindTasksByOwner).toHaveBeenCalledWith(userId);
    expect(response.body.tasks).toEqual(tasks);
  });

  it('creates a task for the authenticated user', async () => {
    const task = {
      id: taskId,
      title: 'Build TaskForge',
      status: 'todo',
      priority: 'high',
      owner: userId,
    };
    mockedCreateTask.mockResolvedValue(task as never);
    const response = await request(app)
      .post('/api/tasks')
      .set(authorization)
      .send({ title: 'Build TaskForge', priority: 'high' });
    expect(response.status).toBe(201);
    expect(mockedCreateTask).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ title: 'Build TaskForge', priority: 'high' }),
    );
    expect(response.body.task).toEqual(task);
  });

  it('rejects a task without a title', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set(authorization)
      .send({ priority: 'high' });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Task title is required' });
  });

  it('returns a JSON 400, not a crash, when the request has no body', async () => {
    const response = await request(app).post('/api/tasks').set(authorization);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Task title is required' });
  });

  it('treats an update with no body as a no-op instead of crashing', async () => {
    mockedUpdateTaskById.mockResolvedValue({ id: taskId, title: 'Unchanged' } as never);
    const response = await request(app)
      .patch('/api/tasks/' + taskId)
      .set(authorization);
    expect(response.status).toBe(200);
    expect(mockedUpdateTaskById).toHaveBeenCalledWith(userId, taskId, {});
  });
  it('rejects an invalid task status', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set(authorization)
      .send({ title: 'Bad task', status: 'invalid' });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid task status' });
  });

  it('updates only a task owned by the authenticated user', async () => {
    const task = { id: taskId, title: 'Updated task', status: 'done', owner: userId };
    mockedUpdateTaskById.mockResolvedValue(task as never);
    const response = await request(app)
      .patch('/api/tasks/' + taskId)
      .set(authorization)
      .send({ title: 'Updated task', status: 'done' });
    expect(response.status).toBe(200);
    expect(mockedUpdateTaskById).toHaveBeenCalledWith(userId, taskId, {
      title: 'Updated task',
      status: 'done',
    });
    expect(response.body.task).toEqual(task);
  });

  it('returns 404 when updating an unavailable task', async () => {
    mockedUpdateTaskById.mockResolvedValue(null);
    const response = await request(app)
      .patch('/api/tasks/' + taskId)
      .set(authorization)
      .send({ status: 'done' });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Task not found' });
  });

  it('deletes only a task owned by the authenticated user', async () => {
    mockedDeleteTaskById.mockResolvedValue({ id: taskId } as never);
    const response = await request(app)
      .delete('/api/tasks/' + taskId)
      .set(authorization);
    expect(response.status).toBe(204);
    expect(mockedDeleteTaskById).toHaveBeenCalledWith(userId, taskId);
  });

  describe('project assignment', () => {
    it('creates a task in a project the user owns', async () => {
      mockedOwnsProject.mockResolvedValue(true);
      mockedCreateTask.mockResolvedValue({ id: taskId } as never);
      const response = await request(app)
        .post('/api/tasks')
        .set(authorization)
        .send({ title: 'In a project', project: projectId });
      expect(response.status).toBe(201);
      expect(mockedOwnsProject).toHaveBeenCalledWith(userId, projectId);
      expect(mockedCreateTask).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ project: projectId }),
      );
    });

    it('creates a task without a project and never checks ownership', async () => {
      mockedCreateTask.mockResolvedValue({ id: taskId } as never);
      const response = await request(app)
        .post('/api/tasks')
        .set(authorization)
        .send({ title: 'No project' });
      expect(response.status).toBe(201);
      expect(mockedOwnsProject).not.toHaveBeenCalled();
      expect(mockedCreateTask.mock.calls[0][1]).not.toHaveProperty('project');
    });

    it('rejects a project the user does not own', async () => {
      mockedOwnsProject.mockResolvedValue(false);
      const response = await request(app)
        .post('/api/tasks')
        .set(authorization)
        .send({ title: 'Sneaky', project: projectId });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Project not found' });
      expect(mockedCreateTask).not.toHaveBeenCalled();
    });

    it.each([['not-an-id'], [42], [{ $ne: null }], ['507f1f77bcf86cd79943901z']])(
      'rejects a malformed project reference %j without querying',
      async (project) => {
        const response = await request(app)
          .post('/api/tasks')
          .set(authorization)
          .send({ title: 'Bad ref', project });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: 'Invalid project' });
        expect(mockedOwnsProject).not.toHaveBeenCalled();
      },
    );

    it('moves a task to another owned project', async () => {
      mockedOwnsProject.mockResolvedValue(true);
      mockedUpdateTaskById.mockResolvedValue({ id: taskId, project: projectId } as never);
      const response = await request(app)
        .patch('/api/tasks/' + taskId)
        .set(authorization)
        .send({ project: projectId });
      expect(response.status).toBe(200);
      expect(mockedUpdateTaskById).toHaveBeenCalledWith(userId, taskId, { project: projectId });
    });

    it.each([[null], ['']])('removes a task from its project with %j', async (project) => {
      mockedUpdateTaskById.mockResolvedValue({ id: taskId, project: null } as never);
      const response = await request(app)
        .patch('/api/tasks/' + taskId)
        .set(authorization)
        .send({ project });
      expect(response.status).toBe(200);
      expect(mockedUpdateTaskById).toHaveBeenCalledWith(userId, taskId, { project: null });
      expect(mockedOwnsProject).not.toHaveBeenCalled();
    });

    it.each([['not-an-id'], [{ $ne: null }]])(
      'rejects a malformed project reference %j on update without querying',
      async (project) => {
        const response = await request(app)
          .patch('/api/tasks/' + taskId)
          .set(authorization)
          .send({ project });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: 'Invalid project' });
        expect(mockedOwnsProject).not.toHaveBeenCalled();
        expect(mockedUpdateTaskById).not.toHaveBeenCalled();
      },
    );

    it('returns a 500 without details when the ownership check fails', async () => {
      mockedOwnsProject.mockRejectedValue(new Error('connection lost'));
      const response = await request(app)
        .post('/api/tasks')
        .set(authorization)
        .send({ title: 'x', project: projectId });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Server error' });
      expect(mockedCreateTask).not.toHaveBeenCalled();
    });

    it('rejects moving a task to a project the user does not own', async () => {
      mockedOwnsProject.mockResolvedValue(false);
      const response = await request(app)
        .patch('/api/tasks/' + taskId)
        .set(authorization)
        .send({ project: projectId });
      expect(response.status).toBe(400);
      expect(mockedUpdateTaskById).not.toHaveBeenCalled();
    });
  });

  describe('assignee', () => {
    const create = (body: Record<string, unknown>) =>
      request(app)
        .post('/api/tasks')
        .set(authorization)
        .send({ title: 'Assigned', ...body });
    const update = (body: Record<string, unknown>) =>
      request(app)
        .patch('/api/tasks/' + taskId)
        .set(authorization)
        .send(body);

    beforeEach(() => {
      mockedCreateTask.mockResolvedValue({ id: taskId } as never);
      mockedUpdateTaskById.mockResolvedValue({ id: taskId } as never);
    });

    it('creates a task assigned to the user', async () => {
      const response = await create({ assigneeType: 'user' });
      expect(response.status).toBe(201);
      expect(mockedCreateTask).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ assigneeType: 'user', assigneeAgent: null }),
      );
      expect(mockedFindAgentStatus).not.toHaveBeenCalled();
    });

    it('creates a task assigned to an active agent the user owns', async () => {
      mockedFindAgentStatus.mockResolvedValue('active');
      const response = await create({ assigneeType: 'agent', assigneeAgent: agentId });
      expect(response.status).toBe(201);
      expect(mockedFindAgentStatus).toHaveBeenCalledWith(userId, agentId);
      expect(mockedCreateTask).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ assigneeType: 'agent', assigneeAgent: agentId }),
      );
    });

    it('creates an unassigned task when no assignee is sent', async () => {
      const response = await create({});
      expect(response.status).toBe(201);
      expect(mockedCreateTask.mock.calls[0][1]).not.toHaveProperty('assigneeType');
      expect(mockedCreateTask.mock.calls[0][1]).not.toHaveProperty('assigneeAgent');
    });

    it('rejects a missing or another user’s agent with the same response', async () => {
      // findAgentStatus is owner-scoped, so both cases look identical here.
      mockedFindAgentStatus.mockResolvedValue(null);
      const response = await create({ assigneeType: 'agent', assigneeAgent: agentId });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Agent not found' });
      expect(mockedCreateTask).not.toHaveBeenCalled();
    });

    it.each([['paused'], ['disabled']] as const)(
      'rejects a new assignment to a %s agent',
      async (status) => {
        mockedFindAgentStatus.mockResolvedValue(status);
        const created = await create({ assigneeType: 'agent', assigneeAgent: agentId });
        expect(created.status).toBe(400);
        expect(created.body).toEqual({ message: 'Only active agents can take new tasks' });
        expect(mockedCreateTask).not.toHaveBeenCalled();

        mockedIsTaskAssignedToAgent.mockResolvedValue(false);
        const updated = await update({ assigneeType: 'agent', assigneeAgent: agentId });
        expect(updated.status).toBe(400);
        expect(mockedIsTaskAssignedToAgent).toHaveBeenCalledWith(userId, taskId, agentId);
        expect(mockedUpdateTaskById).not.toHaveBeenCalled();
      },
    );

    it.each([['paused'], ['disabled']] as const)(
      'keeps a %s agent on a task that already has it',
      async (status) => {
        mockedFindAgentStatus.mockResolvedValue(status);
        mockedIsTaskAssignedToAgent.mockResolvedValue(true);
        const response = await update({
          title: 'Renamed',
          assigneeType: 'agent',
          assigneeAgent: agentId,
        });
        expect(response.status).toBe(200);
        expect(mockedUpdateTaskById).toHaveBeenCalledWith(userId, taskId, {
          title: 'Renamed',
          assigneeType: 'agent',
          assigneeAgent: agentId,
        });
      },
    );

    it.each([
      ['Me', { assigneeType: 'user' }, { assigneeType: 'user', assigneeAgent: null }],
      ['nobody (null)', { assigneeType: null }, { assigneeType: null, assigneeAgent: null }],
      ['nobody (empty)', { assigneeType: '' }, { assigneeType: null, assigneeAgent: null }],
      [
        'nobody (explicit null agent)',
        { assigneeType: null, assigneeAgent: null },
        { assigneeType: null, assigneeAgent: null },
      ],
      [
        'an agent',
        { assigneeType: 'agent', assigneeAgent: agentId },
        { assigneeType: 'agent', assigneeAgent: agentId },
      ],
    ])('reassigns a task to %s', async (_label, body, expected) => {
      mockedFindAgentStatus.mockResolvedValue('active');
      const response = await update(body);
      expect(response.status).toBe(200);
      // Both fields are always set together, so any previous assignee (nobody, the user, or
      // another agent) is fully replaced.
      expect(mockedUpdateTaskById).toHaveBeenCalledWith(userId, taskId, expected);
    });

    it('leaves the assignee unchanged when an update does not mention it', async () => {
      const response = await update({ title: 'Renamed', status: 'done' });
      expect(response.status).toBe(200);
      expect(mockedUpdateTaskById).toHaveBeenCalledWith(userId, taskId, {
        title: 'Renamed',
        status: 'done',
      });
      expect(mockedFindAgentStatus).not.toHaveBeenCalled();
    });

    it.each([
      [{ assigneeType: 'agent' }, 'Invalid agent'],
      [{ assigneeType: 'agent', assigneeAgent: 'not-an-id' }, 'Invalid agent'],
      [{ assigneeType: 'agent', assigneeAgent: { $ne: null } }, 'Invalid agent'],
      [{ assigneeType: 'agent', assigneeAgent: '507f1f77bcf86cd79943903z' }, 'Invalid agent'],
      [{ assigneeType: 'team' }, 'Invalid assignee'],
      [{ assigneeType: 'user', assigneeAgent: agentId }, 'Invalid assignee'],
      [{ assigneeType: null, assigneeAgent: agentId }, 'Invalid assignee'],
      [{ assigneeAgent: agentId }, 'Invalid assignee'],
      [{ assigneeType: { $ne: null } }, 'Invalid assignee'],
    ])('rejects %j without querying', async (body, message) => {
      for (const send of [create, update]) {
        const response = await send(body);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message });
      }
      expect(mockedFindAgentStatus).not.toHaveBeenCalled();
      expect(mockedCreateTask).not.toHaveBeenCalled();
      expect(mockedUpdateTaskById).not.toHaveBeenCalled();
    });

    it('rejects a paused agent for a malformed task id without querying the task', async () => {
      mockedFindAgentStatus.mockResolvedValue('paused');
      const response = await request(app)
        .patch('/api/tasks/not-a-task-id')
        .set(authorization)
        .send({ assigneeType: 'agent', assigneeAgent: agentId });
      expect(response.status).toBe(400);
      expect(mockedIsTaskAssignedToAgent).not.toHaveBeenCalled();
    });

    it('returns a 500 without details when the agent check fails', async () => {
      mockedFindAgentStatus.mockRejectedValue(new Error('connection lost'));
      const response = await create({ assigneeType: 'agent', assigneeAgent: agentId });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Server error' });
      expect(mockedCreateTask).not.toHaveBeenCalled();
    });
  });

  it('returns 404 when deleting an unavailable task', async () => {
    mockedDeleteTaskById.mockResolvedValue(null);
    const response = await request(app)
      .delete('/api/tasks/' + taskId)
      .set(authorization);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Task not found' });
  });
});
