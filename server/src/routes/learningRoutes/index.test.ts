import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import {
  createLearningItem,
  deleteLearningItemById,
  findLearningByOwner,
  updateLearningItemById,
} from '../../services/learningService';

jest.mock('../../services/learningService', () => ({
  createLearningItem: jest.fn(),
  deleteLearningItemById: jest.fn(),
  findLearningByOwner: jest.fn(),
  updateLearningItemById: jest.fn(),
}));

const userId = '507f1f77bcf86cd799439011';
const id = '507f1f77bcf86cd799439061';
const authorization = { Authorization: 'Bearer ' + jwt.sign({ id: userId }, 'test-jwt-secret') };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('learning routes', () => {
  it.each([
    ['get', '/api/learning'],
    ['post', '/api/learning'],
    ['patch', '/api/learning/' + id],
    ['delete', '/api/learning/' + id],
  ] as const)('requires authentication for %s %s', async (method, path) => {
    expect((await request(app)[method](path)).status).toBe(401);
  });

  it('lists the owner’s items', async () => {
    jest.mocked(findLearningByOwner).mockResolvedValue([] as never);
    expect((await request(app).get('/api/learning').set(authorization)).body).toEqual({
      items: [],
    });
    expect(findLearningByOwner).toHaveBeenCalledWith(userId);
  });

  it('creates an item from allowed fields only, with a slug skill and a normalized link', async () => {
    jest.mocked(createLearningItem).mockResolvedValue({ _id: id } as never);
    const response = await request(app).post('/api/learning').set(authorization).send({
      title: '  GraphQL course ',
      skill: ' GraphQL ',
      kind: 'course',
      url: 'https://learn.example.com/graphql',
      status: 'in_progress',
      targetDate: '2026-12-31',
      notes: ' Weekends ',
      owner: 'x',
      completedAt: '2020-01-01',
    });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ item: { _id: id } });
    expect(createLearningItem).toHaveBeenCalledWith(userId, {
      title: 'GraphQL course',
      skill: 'graphql',
      kind: 'course',
      url: 'https://learn.example.com/graphql',
      status: 'in_progress',
      targetDate: '2026-12-31T00:00:00.000Z',
      notes: 'Weekends',
    });
  });

  it.each([
    [{}, 'Learning title is required'],
    [{ title: '  ' }, 'Learning title is required'],
    [{ title: 't'.repeat(121) }, 'Learning title is too long'],
    [{ title: 'A', skill: 'C++' }, 'Invalid skill name'],
    [{ title: 'A', skill: '   ' }, 'Invalid skill name'],
    [{ title: 'A', kind: 'podcast' }, 'Invalid learning kind'],
    [{ title: 'A', status: 'started' }, 'Invalid learning status'],
    [{ title: 'A', url: 'http://example.com' }, 'Link must be an https address'],
    [{ title: 'A', url: 'javascript:alert(1)' }, 'Link must be an https address'],
    [{ title: 'A', url: 'https://user:pass@example.com' }, 'Link must be an https address'],
    [{ title: 'A', url: 'not a url' }, 'Invalid link'],
    [{ title: 'A', url: 'https://example.com/' + ' x'.repeat(660) }, 'Invalid link'],
    [{ title: 'A', targetDate: '2026-02-30' }, 'Invalid target date'],
    [{ title: 'A', notes: 'n'.repeat(2001) }, 'Notes are too long'],
    [{ title: 'A', notes: 5 }, 'Invalid notes'],
  ])('rejects the item %j', async (body, message) => {
    const response = await request(app).post('/api/learning').set(authorization).send(body);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(createLearningItem).not.toHaveBeenCalled();
  });

  it('updates only the sent fields and clears the skill, link and target date', async () => {
    jest.mocked(updateLearningItemById).mockResolvedValue({ _id: id } as never);
    const response = await request(app)
      .patch('/api/learning/' + id)
      .set(authorization)
      .send({ status: 'done', skill: '', url: '', targetDate: null });
    expect(response.status).toBe(200);
    expect(updateLearningItemById).toHaveBeenCalledWith(userId, id, {
      status: 'done',
      skill: '',
      url: '',
      targetDate: null,
    });
  });

  it('gives 404 for missing or another user’s items and for malformed ids without a query', async () => {
    jest.mocked(updateLearningItemById).mockResolvedValue(null);
    jest.mocked(deleteLearningItemById).mockResolvedValue(null);
    expect(
      (
        await request(app)
          .patch('/api/learning/' + id)
          .set(authorization)
          .send({ status: 'done' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete('/api/learning/' + id)
          .set(authorization)
      ).status,
    ).toBe(404);
    jest.clearAllMocks();
    expect((await request(app).patch('/api/learning/bad').set(authorization)).status).toBe(404);
    expect((await request(app).delete('/api/learning/bad').set(authorization)).status).toBe(404);
    expect(updateLearningItemById).not.toHaveBeenCalled();
    expect(deleteLearningItemById).not.toHaveBeenCalled();
  });

  it('deletes an owned item with 204 and reports a failure as 500', async () => {
    jest.mocked(deleteLearningItemById).mockResolvedValue({ _id: id } as never);
    expect(
      (
        await request(app)
          .delete('/api/learning/' + id)
          .set(authorization)
      ).status,
    ).toBe(204);
    jest.mocked(findLearningByOwner).mockRejectedValue(new Error('db down'));
    const failed = await request(app).get('/api/learning').set(authorization);
    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({ message: 'Server error' });
  });
});
