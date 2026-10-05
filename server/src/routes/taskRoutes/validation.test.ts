import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { createTask, updateTaskById, deleteTaskById } from '../../services/taskService';
import { ownsProject } from '../../services/projectService';
import { findAgentStatus } from '../../services/agentService';

jest.mock('../../services/taskService', () => ({
  createTask: jest.fn(),
  updateTaskById: jest.fn(),
  deleteTaskById: jest.fn(),
  findTasksByOwner: jest.fn(),
  isTaskAssignedToAgent: jest.fn(),
}));
jest.mock('../../services/projectService', () => ({ ownsProject: jest.fn() }));
jest.mock('../../services/agentService', () => ({ findAgentStatus: jest.fn() }));
const owner = '507f1f77bcf86cd799439011';
const id = '507f1f77bcf86cd799439012';
const auth = { Authorization: 'Bearer ' + jwt.sign({ id: owner }, 'test-jwt-secret') };
const create = (body: unknown) =>
  request(app)
    .post('/api/tasks')
    .set(auth)
    .send(body as object);
const update = (body: unknown, taskId = id) =>
  request(app)
    .patch('/api/tasks/' + taskId)
    .set(auth)
    .send(body as object);
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(createTask).mockResolvedValue({ id, owner } as never);
  jest.mocked(updateTaskById).mockResolvedValue({ id, owner } as never);
});
const expectNoServices = () => {
  expect(createTask).not.toHaveBeenCalled();
  expect(updateTaskById).not.toHaveBeenCalled();
  expect(deleteTaskById).not.toHaveBeenCalled();
  expect(ownsProject).not.toHaveBeenCalled();
  expect(findAgentStatus).not.toHaveBeenCalled();
};

describe('strict task input validation', () => {
  it.each(['not-an-id', '123', '507f1f77bcf86cd79943901g'])(
    'rejects malformed ID %s before body validation or database access',
    async (taskId) => {
      expect((await update({ title: false }, taskId)).status).toBe(404);
      const deletion = await request(app)
        .delete('/api/tasks/' + taskId)
        .set(auth);
      expect(deletion.status).toBe(404);
      expect(deletion.body).toEqual({ message: 'Task not found' });
      expectNoServices();
    },
  );
  it.each([[], ['task'], 'string', 42, false])(
    'rejects non-object body %j on create and update',
    async (body) => {
      const encoded = JSON.stringify(body);
      for (const method of ['post', 'patch'] as const) {
        const response = await request(app)
          [method](method === 'post' ? '/api/tasks' : '/api/tasks/' + id)
          .set(auth)
          .set('Content-Type', 'application/json')
          .send(encoded);
        expect(response.status).toBe(400);
      }
      expectNoServices();
    },
  );
  it.each(['status', 'priority'])(
    'rejects every invalid present %s including falsy values before services',
    async (field) => {
      for (const value of [false, null, 0, '', [], {}, 'invalid']) {
        expect((await create({ title: 'Task', [field]: value })).status).toBe(400);
        expect((await update({ [field]: value })).status).toBe(400);
      }
      expectNoServices();
    },
  );
  it.each([null, false, 0, [], {}])(
    'rejects non-string description %j before services',
    async (description) => {
      expect((await create({ title: 'Task', description })).status).toBe(400);
      expect((await update({ description })).status).toBe(400);
      expectNoServices();
    },
  );
  it('trims content and accepts exact title/description boundaries with authenticated owner only', async () => {
    const body = {
      title: '  ' + 't'.repeat(120) + '  ',
      description: '  ' + 'd'.repeat(2000) + '  ',
      owner: 'attacker',
    };
    expect((await create(body)).status).toBe(201);
    expect(createTask).toHaveBeenCalledWith(
      owner,
      expect.objectContaining({ title: 't'.repeat(120), description: 'd'.repeat(2000) }),
    );
    expect((await update(body)).status).toBe(200);
    expect(updateTaskById).toHaveBeenCalledWith(owner, id, {
      title: 't'.repeat(120),
      description: 'd'.repeat(2000),
    });
  });
  it.each([
    [{ title: 't'.repeat(121) }, 'Task title must be at most 120 characters'],
    [{ description: 'd'.repeat(2001) }, 'Task description must be at most 2000 characters'],
  ])('rejects overlong content on both write paths', async (body, message) => {
    expect((await create({ title: 'Task', ...body })).body).toEqual({ message });
    expect((await update(body)).body).toEqual({ message });
    expectNoServices();
  });
  it.each([
    '2024-02-29',
    '2000-02-29',
    '0001-01-01',
    '0099-12-31',
    '9999-12-31',
    '2026-10-05T00:00:00.000Z',
  ])('accepts and canonicalizes calendar %s', async (dueDate) => {
    expect((await create({ title: 'Task', dueDate })).status).toBe(201);
    const canonical = dueDate.length === 10 ? dueDate + 'T00:00:00.000Z' : dueDate;
    expect(createTask).toHaveBeenCalledWith(owner, expect.objectContaining({ dueDate: canonical }));
    expect((await update({ dueDate })).status).toBe(200);
    expect(updateTaskById).toHaveBeenCalledWith(owner, id, { dueDate: canonical });
  });
  it.each([
    '1900-02-29',
    '2025-02-29',
    '2024-02-30',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-01-00',
    '0000-01-01',
    '2026-1-01',
    '2026-10-05T12:00:00.000Z',
    '2026-10-05T00:00:00Z',
    '2026-10-05T00:00:00.000+00:00',
    '',
    ' 2026-10-05 ',
    false,
    0,
    {},
    [],
  ])('rejects invalid due date %j before services', async (dueDate) => {
    expect((await create({ title: 'Task', dueDate })).body).toEqual({
      message: 'Invalid due date',
    });
    expect((await update({ dueDate })).body).toEqual({ message: 'Invalid due date' });
    expectNoServices();
  });
  it('clears with null while omitted date and absent update body leave fields unchanged', async () => {
    expect((await update({ dueDate: null })).status).toBe(200);
    expect(updateTaskById).toHaveBeenLastCalledWith(owner, id, { dueDate: null });
    expect((await update({})).status).toBe(200);
    expect(updateTaskById).toHaveBeenLastCalledWith(owner, id, {});
    expect(
      (
        await request(app)
          .patch('/api/tasks/' + id)
          .set(auth)
      ).status,
    ).toBe(200);
    expect(updateTaskById).toHaveBeenLastCalledWith(owner, id, {});
  });
});
