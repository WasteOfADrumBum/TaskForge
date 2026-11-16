import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import {
  findReviewsByOwner,
  ownsAllTasks,
  ReviewUnavailableError,
  saveReview,
} from '../../services/reviewService';

jest.mock('../../services/reviewService', () => {
  class ReviewUnavailableError extends Error {}
  return {
    findReviewsByOwner: jest.fn(),
    ownsAllTasks: jest.fn(),
    saveReview: jest.fn(),
    ReviewUnavailableError,
  };
});

const mockedSave = jest.mocked(saveReview);
const mockedFind = jest.mocked(findReviewsByOwner);
const mockedOwns = jest.mocked(ownsAllTasks);
const userId = '507f1f77bcf86cd799439011';
const taskA = '507f1f77bcf86cd799439012';
const taskB = '507f1f77bcf86cd799439013';
const authorization = { Authorization: 'Bearer ' + jwt.sign({ id: userId }, 'test-jwt-secret') };

beforeEach(() => {
  jest.clearAllMocks();
  mockedOwns.mockResolvedValue(true);
});

describe('review routes', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/reviews')).status).toBe(401);
    expect((await request(app).put('/api/reviews/daily/2026-11-15').send({})).status).toBe(401);
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it('saves a daily review for the signed-in owner with trimmed text and unique focus tasks', async () => {
    const review = { _id: 'r1', kind: 'daily', period: '2026-11-15' };
    mockedSave.mockResolvedValue(review as never);
    const response = await request(app)
      .put('/api/reviews/daily/2026-11-15')
      .set(authorization)
      .send({
        reflection: '  Shipped analytics.  ',
        focusTasks: [taskA, taskB, taskA],
        owner: 'x',
      });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ review });
    expect(mockedOwns).toHaveBeenCalledWith(userId, [taskA, taskB]);
    expect(mockedSave).toHaveBeenCalledWith(userId, 'daily', '2026-11-15', {
      reflection: 'Shipped analytics.',
      focusTasks: [taskA, taskB],
    });
  });

  it('accepts an empty body as an empty review', async () => {
    mockedSave.mockResolvedValue({} as never);
    const response = await request(app).put('/api/reviews/weekly/2026-11-09').set(authorization);
    expect(response.status).toBe(200);
    expect(mockedSave).toHaveBeenCalledWith(userId, 'weekly', '2026-11-09', {
      reflection: '',
      focusTasks: [],
    });
  });

  it.each([
    ['/api/reviews/monthly/2026-11-15', {}, 'Invalid review kind'],
    ['/api/reviews/daily/2026-02-30', {}, 'Invalid review date'],
    ['/api/reviews/daily/2026-11-15T00:00:00.000Z', {}, 'Invalid review date'],
    ['/api/reviews/daily/26-11-15', {}, 'Invalid review date'],
    ['/api/reviews/weekly/2026-11-15', {}, 'A weekly review period must be a Monday'],
    ['/api/reviews/daily/2026-11-15', { reflection: 42 }, 'Invalid reflection'],
    ['/api/reviews/daily/2026-11-15', { reflection: 'r'.repeat(2001) }, 'Reflection is too long'],
    ['/api/reviews/daily/2026-11-15', { focusTasks: 'one' }, 'Invalid focus tasks'],
    ['/api/reviews/daily/2026-11-15', { focusTasks: ['not-an-id'] }, 'Invalid focus tasks'],
    [
      '/api/reviews/daily/2026-11-15',
      {
        focusTasks: [taskA, taskB, '507f1f77bcf86cd799439014', '507f1f77bcf86cd799439015'],
      },
      'Choose at most 3 focus tasks',
    ],
  ])('rejects %s with %j', async (path, body, message) => {
    const response = await request(app).put(path).set(authorization).send(body);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it('allows five focus tasks on a weekly review and a reflection at the limit', async () => {
    mockedSave.mockResolvedValue({} as never);
    const ids = [12, 13, 14, 15, 16].map((n) => '507f1f77bcf86cd7994390' + n);
    const response = await request(app)
      .put('/api/reviews/weekly/2026-11-09')
      .set(authorization)
      .send({ focusTasks: ids, reflection: 'r'.repeat(2000) });
    expect(response.status).toBe(200);
  });

  it('rejects another user’s tasks without saving', async () => {
    mockedOwns.mockResolvedValue(false);
    const response = await request(app)
      .put('/api/reviews/daily/2026-11-15')
      .set(authorization)
      .send({ focusTasks: [taskA] });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Task not found' });
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it('reports 503 when the review index cannot be confirmed', async () => {
    mockedSave.mockRejectedValue(new ReviewUnavailableError());
    const response = await request(app).put('/api/reviews/daily/2026-11-15').set(authorization);
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ message: 'Reviews are temporarily unavailable' });
  });

  it('lists the owner’s reviews with a bounded limit and optional kind', async () => {
    mockedFind.mockResolvedValue([] as never);
    expect((await request(app).get('/api/reviews').set(authorization)).body).toEqual({
      reviews: [],
    });
    expect(mockedFind).toHaveBeenLastCalledWith(userId, undefined, 14);
    await request(app).get('/api/reviews?kind=weekly&limit=30').set(authorization);
    expect(mockedFind).toHaveBeenLastCalledWith(userId, 'weekly', 30);
  });

  it.each([
    ['kind=monthly', 'Invalid review kind'],
    ['limit=0', 'Invalid review limit'],
    ['limit=31', 'Invalid review limit'],
    ['limit=abc', 'Invalid review limit'],
    ['limit=1&limit=2', 'Invalid review limit'],
    ['kind=daily&kind=weekly', 'Invalid review kind'],
  ])('rejects the list query %s', async (query, message) => {
    const response = await request(app)
      .get('/api/reviews?' + query)
      .set(authorization);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(mockedFind).not.toHaveBeenCalled();
  });
});
