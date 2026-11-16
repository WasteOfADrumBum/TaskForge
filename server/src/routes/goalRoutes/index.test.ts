import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import {
  createGoal,
  deleteGoalById,
  findGoalsByOwner,
  updateGoalById,
} from '../../services/goalService';

jest.mock('../../services/goalService', () => ({
  createGoal: jest.fn(),
  deleteGoalById: jest.fn(),
  findGoalsByOwner: jest.fn(),
  updateGoalById: jest.fn(),
}));

const mockedCreate = jest.mocked(createGoal);
const mockedDelete = jest.mocked(deleteGoalById);
const mockedFind = jest.mocked(findGoalsByOwner);
const mockedUpdate = jest.mocked(updateGoalById);
const userId = '507f1f77bcf86cd799439011';
const goalId = '507f1f77bcf86cd799439041';
const authorization = { Authorization: 'Bearer ' + jwt.sign({ id: userId }, 'test-jwt-secret') };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('goal routes', () => {
  it.each([
    ['get', '/api/goals'],
    ['post', '/api/goals'],
    ['patch', '/api/goals/' + goalId],
    ['delete', '/api/goals/' + goalId],
  ] as const)('requires authentication for %s %s', async (method, path) => {
    expect((await request(app)[method](path)).status).toBe(401);
  });

  it('lists the signed-in user’s goals', async () => {
    mockedFind.mockResolvedValue([{ _id: goalId }] as never);
    const response = await request(app).get('/api/goals').set(authorization);
    expect(response.body).toEqual({ goals: [{ _id: goalId }] });
    expect(mockedFind).toHaveBeenCalledWith(userId);
  });

  it('creates a goal from allowed fields only, trimmed and with a normalized date', async () => {
    mockedCreate.mockResolvedValue({ _id: goalId } as never);
    const response = await request(app).post('/api/goals').set(authorization).send({
      title: '  Ship v1  ',
      description: 'Release TaskForge',
      area: 'career',
      targetDate: '2026-12-31',
      owner: 'someone-else',
      achievedAt: '2020-01-01T00:00:00.000Z',
      _id: goalId,
    });
    expect(response.status).toBe(201);
    expect(mockedCreate).toHaveBeenCalledWith(userId, {
      title: 'Ship v1',
      description: 'Release TaskForge',
      area: 'career',
      targetDate: '2026-12-31T00:00:00.000Z',
    });
  });

  it.each([
    [{}, 'Goal title is required'],
    [{ title: '   ' }, 'Goal title is required'],
    [{ title: 't'.repeat(121) }, 'Goal title is too long'],
    [{ title: 'Ok', description: 5 }, 'Invalid goal description'],
    [{ title: 'Ok', description: 'd'.repeat(2001) }, 'Goal description is too long'],
    [{ title: 'Ok', status: 'paused' }, 'Invalid goal status'],
    [{ title: 'Ok', area: 'health' }, 'Invalid goal area'],
    [{ title: 'Ok', area: { $ne: 'general' } }, 'Invalid goal area'],
    [{ title: 'Ok', targetDate: '2026-02-30' }, 'Invalid target date'],
    [{ title: 'Ok', targetDate: '2026-12-31T12:00:00.000Z' }, 'Invalid target date'],
    [{ title: 'Ok', targetDate: 20261231 }, 'Invalid target date'],
  ])('rejects %j on create', async (body, message) => {
    const response = await request(app).post('/api/goals').set(authorization).send(body);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('updates only the fields sent, and clears the target date with null or empty', async () => {
    mockedUpdate.mockResolvedValue({ _id: goalId } as never);
    await request(app)
      .patch('/api/goals/' + goalId)
      .set(authorization)
      .send({ status: 'achieved' });
    expect(mockedUpdate).toHaveBeenLastCalledWith(userId, goalId, { status: 'achieved' });
    await request(app)
      .patch('/api/goals/' + goalId)
      .set(authorization)
      .send({ area: 'learning' });
    expect(mockedUpdate).toHaveBeenLastCalledWith(userId, goalId, { area: 'learning' });
    const invalid = await request(app)
      .patch('/api/goals/' + goalId)
      .set(authorization)
      .send({ area: ['career'] });
    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({ message: 'Invalid goal area' });
    for (const targetDate of [null, '']) {
      await request(app)
        .patch('/api/goals/' + goalId)
        .set(authorization)
        .send({ targetDate });
      expect(mockedUpdate).toHaveBeenLastCalledWith(userId, goalId, { targetDate: null });
    }
  });

  it('gives 404 for a missing or another user’s goal, and for malformed ids without a query', async () => {
    mockedUpdate.mockResolvedValue(null);
    mockedDelete.mockResolvedValue(null);
    expect(
      (
        await request(app)
          .patch('/api/goals/' + goalId)
          .set(authorization)
          .send({ title: 'X' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete('/api/goals/' + goalId)
          .set(authorization)
      ).status,
    ).toBe(404);
    mockedUpdate.mockClear();
    mockedDelete.mockClear();
    expect((await request(app).patch('/api/goals/not-an-id').set(authorization)).status).toBe(404);
    expect((await request(app).delete('/api/goals/not-an-id').set(authorization)).status).toBe(404);
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('deletes the owner’s goal', async () => {
    mockedDelete.mockResolvedValue({ _id: goalId } as never);
    const response = await request(app)
      .delete('/api/goals/' + goalId)
      .set(authorization);
    expect(response.status).toBe(204);
    expect(mockedDelete).toHaveBeenCalledWith(userId, goalId);
  });
});
