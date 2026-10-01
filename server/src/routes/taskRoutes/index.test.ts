import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import {
  createTask,
  deleteTaskById,
  findTasksByOwner,
  updateTaskById,
} from '../../services/taskService';

jest.mock('../../services/taskService', () => ({
  createTask: jest.fn(),
  deleteTaskById: jest.fn(),
  findTasksByOwner: jest.fn(),
  updateTaskById: jest.fn(),
}));

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

  it('returns 404 when deleting an unavailable task', async () => {
    mockedDeleteTaskById.mockResolvedValue(null);
    const response = await request(app)
      .delete('/api/tasks/' + taskId)
      .set(authorization);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Task not found' });
  });
});
