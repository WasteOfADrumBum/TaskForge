import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import {
  findResumeByOwner,
  ResumeUnavailableError,
  saveResume,
} from '../../services/resumeService';

jest.mock('../../services/resumeService', () => {
  class ResumeUnavailableError extends Error {}
  return { ResumeUnavailableError, findResumeByOwner: jest.fn(), saveResume: jest.fn() };
});

const userId = '507f1f77bcf86cd799439011';
const authorization = { Authorization: 'Bearer ' + jwt.sign({ id: userId }, 'test-jwt-secret') };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resume routes', () => {
  it.each([
    ['get', '/api/resume'],
    ['put', '/api/resume'],
  ] as const)('requires authentication for %s %s', async (method, path) => {
    expect((await request(app)[method](path)).status).toBe(401);
  });

  it('returns the owner’s resume, or null when there is none', async () => {
    jest.mocked(findResumeByOwner).mockResolvedValueOnce(null);
    expect((await request(app).get('/api/resume').set(authorization)).body).toEqual({
      resume: null,
    });
    expect(findResumeByOwner).toHaveBeenCalledWith(userId);
  });

  it('saves only the three text fields, trimming the headline and summary', async () => {
    jest.mocked(saveResume).mockResolvedValue({ headline: 'Dev' } as never);
    const response = await request(app).put('/api/resume').set(authorization).send({
      headline: '  Full-stack developer ',
      summary: ' Builds things ',
      body: '  Experience\n- Acme  ',
      owner: 'someone-else',
      _id: 'x',
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ resume: { headline: 'Dev' } });
    expect(saveResume).toHaveBeenCalledWith(userId, {
      headline: 'Full-stack developer',
      summary: 'Builds things',
      body: '  Experience\n- Acme  ',
    });
  });

  it('treats missing or null fields as empty', async () => {
    jest.mocked(saveResume).mockResolvedValue({} as never);
    await request(app).put('/api/resume').set(authorization).send({ headline: null });
    expect(saveResume).toHaveBeenCalledWith(userId, { headline: '', summary: '', body: '' });
  });

  it.each([
    [{ headline: 'h'.repeat(121) }, 'Headline is too long'],
    [{ summary: 's'.repeat(2001) }, 'Summary is too long'],
    [{ body: 'b'.repeat(20001) }, 'Resume is too long'],
    [{ headline: 5 }, 'Invalid headline'],
    [{ summary: { $ne: '' } }, 'Invalid summary'],
    [{ body: ['x'] }, 'Invalid resume'],
  ])('rejects %j', async (body, message) => {
    const response = await request(app).put('/api/resume').set(authorization).send(body);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(saveResume).not.toHaveBeenCalled();
  });

  it('reports an unconfirmed index as 503 and other failures as 500', async () => {
    jest.mocked(saveResume).mockRejectedValueOnce(new ResumeUnavailableError());
    const unavailable = await request(app).put('/api/resume').set(authorization).send({});
    expect(unavailable.status).toBe(503);
    expect(unavailable.body).toEqual({ message: 'Your resume is temporarily unavailable' });
    jest.mocked(findResumeByOwner).mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).get('/api/resume').set(authorization)).status).toBe(500);
  });
});
