import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import {
  CareerUnavailableError,
  createJob,
  createSkill,
  deleteJobById,
  deleteSkillById,
  DuplicateSkillError,
  findJobsByOwner,
  findSkillsByOwner,
  updateJobById,
  updateSkillById,
} from '../../services/careerService';

jest.mock('../../services/careerService', () => {
  class CareerUnavailableError extends Error {}
  class DuplicateSkillError extends Error {}
  return {
    CareerUnavailableError,
    DuplicateSkillError,
    createJob: jest.fn(),
    createSkill: jest.fn(),
    deleteJobById: jest.fn(),
    deleteSkillById: jest.fn(),
    findJobsByOwner: jest.fn(),
    findSkillsByOwner: jest.fn(),
    updateJobById: jest.fn(),
    updateSkillById: jest.fn(),
  };
});

const userId = '507f1f77bcf86cd799439011';
const id = '507f1f77bcf86cd799439051';
const authorization = { Authorization: 'Bearer ' + jwt.sign({ id: userId }, 'test-jwt-secret') };

// Reset implementations too, so a rejection or null set by one test never leaks into the next.
beforeEach(() => {
  jest.resetAllMocks();
});

describe('career routes', () => {
  it.each([
    ['get', '/api/skills'],
    ['post', '/api/skills'],
    ['patch', '/api/skills/' + id],
    ['delete', '/api/skills/' + id],
    ['get', '/api/jobs'],
    ['post', '/api/jobs'],
    ['patch', '/api/jobs/' + id],
    ['delete', '/api/jobs/' + id],
  ] as const)('requires authentication for %s %s', async (method, path) => {
    expect((await request(app)[method](path)).status).toBe(401);
  });

  it('lists the owner’s skills and jobs', async () => {
    jest.mocked(findSkillsByOwner).mockResolvedValue([] as never);
    jest.mocked(findJobsByOwner).mockResolvedValue([] as never);
    expect((await request(app).get('/api/skills').set(authorization)).body).toEqual({ skills: [] });
    expect((await request(app).get('/api/jobs').set(authorization)).body).toEqual({ jobs: [] });
    expect(findSkillsByOwner).toHaveBeenCalledWith(userId);
    expect(findJobsByOwner).toHaveBeenCalledWith(userId);
  });

  it('creates a skill with a slug name and ignores other fields', async () => {
    jest.mocked(createSkill).mockResolvedValue({ _id: id } as never);
    const response = await request(app)
      .post('/api/skills')
      .set(authorization)
      .send({ name: '  Node JS ', level: 'strong', owner: 'x' });
    expect(response.status).toBe(201);
    expect(createSkill).toHaveBeenCalledWith(userId, { name: 'node-js', level: 'strong' });
  });

  it.each([
    [{}, 'Invalid skill name'],
    [{ name: 'C++' }, 'Invalid skill name'],
    [{ name: 's'.repeat(41) }, 'Invalid skill name'],
    [{ name: 'react', level: 'guru' }, 'Invalid skill level'],
  ])('rejects the skill %j', async (body, message) => {
    const response = await request(app).post('/api/skills').set(authorization).send(body);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(createSkill).not.toHaveBeenCalled();
  });

  it('reports a duplicate skill as 409 and an unconfirmed index as 503', async () => {
    jest.mocked(createSkill).mockRejectedValueOnce(new DuplicateSkillError());
    const duplicate = await request(app)
      .post('/api/skills')
      .set(authorization)
      .send({ name: 'react' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ message: 'That skill is already in your list' });
    jest.mocked(updateSkillById).mockRejectedValueOnce(new CareerUnavailableError());
    const unavailable = await request(app)
      .patch('/api/skills/' + id)
      .set(authorization)
      .send({ name: 'vue' });
    expect(unavailable.status).toBe(503);
  });

  it('creates a job from allowed fields, with unique slug skills and a normalized https link', async () => {
    jest.mocked(createJob).mockResolvedValue({ _id: id } as never);
    const response = await request(app)
      .post('/api/jobs')
      .set(authorization)
      .send({
        title: '  Frontend Engineer ',
        company: ' Acme ',
        url: 'https://jobs.example.com/123',
        requiredSkills: ['React', 'react', 'Type Script'],
        notes: 'Remote',
        owner: 'x',
      });
    expect(response.status).toBe(201);
    expect(createJob).toHaveBeenCalledWith(userId, {
      title: 'Frontend Engineer',
      company: 'Acme',
      url: 'https://jobs.example.com/123',
      requiredSkills: ['react', 'type-script'],
      notes: 'Remote',
    });
  });

  it.each([
    [{}, 'Invalid job title'],
    [{ title: '  ' }, 'Job title is required'],
    [{ title: 't'.repeat(121) }, 'Job title is too long'],
    [{ title: 'Dev', url: 'http://jobs.example.com' }, 'Job link must be an https address'],
    [{ title: 'Dev', url: 'javascript:alert(1)' }, 'Job link must be an https address'],
    [{ title: 'Dev', url: 'https://user:pass@example.com' }, 'Job link must be an https address'],
    [{ title: 'Dev', url: 'not a url' }, 'Invalid job link'],
    [{ title: 'Dev', status: 'hired' }, 'Invalid job status'],
    [{ title: 'Dev', requiredSkills: 'react' }, 'Skills must be a list'],
    [{ title: 'Dev', requiredSkills: ['C++'] }, 'Invalid skill name'],
    [
      { title: 'Dev', requiredSkills: Array.from({ length: 31 }, (_, i) => 'skill-' + i) },
      'Too many skills',
    ],
    [{ title: 'Dev', notes: 'n'.repeat(2001) }, 'Notes are too long'],
    [{ title: 'Dev', company: 'c'.repeat(121) }, 'Company name is too long'],
    // Spaces are percent-encoded, so this link grows past the limit only once normalized.
    [{ title: 'Dev', url: 'https://example.com/' + ' x'.repeat(660) }, 'Invalid job link'],
  ])('rejects the job %j', async (body, message) => {
    const response = await request(app).post('/api/jobs').set(authorization).send(body);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(createJob).not.toHaveBeenCalled();
  });

  it('updates only the sent job fields and clears the link with an empty value', async () => {
    jest.mocked(updateJobById).mockResolvedValue({ _id: id } as never);
    await request(app)
      .patch('/api/jobs/' + id)
      .set(authorization)
      .send({ status: 'applied', url: '' });
    expect(updateJobById).toHaveBeenCalledWith(userId, id, { status: 'applied', url: '' });
  });

  it('gives 404 for missing or another user’s records and for malformed ids without a query', async () => {
    jest.mocked(updateSkillById).mockResolvedValue(null);
    jest.mocked(deleteJobById).mockResolvedValue(null);
    expect(
      (
        await request(app)
          .patch('/api/skills/' + id)
          .set(authorization)
          .send({ level: 'expert' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete('/api/jobs/' + id)
          .set(authorization)
      ).status,
    ).toBe(404);
    jest.clearAllMocks();
    for (const path of ['/api/skills/bad', '/api/jobs/bad']) {
      expect((await request(app).patch(path).set(authorization)).status).toBe(404);
      expect((await request(app).delete(path).set(authorization)).status).toBe(404);
    }
    expect(updateSkillById).not.toHaveBeenCalled();
    expect(deleteSkillById).not.toHaveBeenCalled();
    expect(updateJobById).not.toHaveBeenCalled();
    expect(deleteJobById).not.toHaveBeenCalled();
  });

  // KAN-77: the success and failure paths the cases above don't reach.
  it('updates a skill for its owner', async () => {
    jest.mocked(updateSkillById).mockResolvedValue({ name: 'react' } as never);
    const res = await request(app)
      .patch('/api/skills/' + id)
      .set(authorization)
      .send({ level: 'expert' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ skill: { name: 'react' } });
    expect(updateSkillById).toHaveBeenCalledWith(userId, id, { level: 'expert' });
  });

  it('deletes a skill for its owner', async () => {
    jest.mocked(deleteSkillById).mockResolvedValue({ name: 'react' } as never);
    const res = await request(app)
      .delete('/api/skills/' + id)
      .set(authorization);
    expect(res.status).toBe(204);
    expect(deleteSkillById).toHaveBeenCalledWith(userId, id);
  });

  it('updates a job for its owner', async () => {
    jest.mocked(updateJobById).mockResolvedValue({ title: 'Engineer' } as never);
    const res = await request(app)
      .patch('/api/jobs/' + id)
      .set(authorization)
      .send({ status: 'applied' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ job: { title: 'Engineer' } });
    expect(updateJobById).toHaveBeenCalledWith(userId, id, { status: 'applied' });
  });

  it('deletes a job for its owner', async () => {
    jest.mocked(deleteJobById).mockResolvedValue({ title: 'Engineer' } as never);
    const res = await request(app)
      .delete('/api/jobs/' + id)
      .set(authorization);
    expect(res.status).toBe(204);
    expect(deleteJobById).toHaveBeenCalledWith(userId, id);
  });

  it('answers 404 when the owner has no such job or skill', async () => {
    jest.mocked(updateJobById).mockResolvedValue(null);
    jest.mocked(deleteSkillById).mockResolvedValue(null);
    const update = await request(app)
      .patch('/api/jobs/' + id)
      .set(authorization)
      .send({ status: 'applied' });
    expect(update.status).toBe(404);
    const remove = await request(app)
      .delete('/api/skills/' + id)
      .set(authorization);
    expect(remove.status).toBe(404);
    expect(updateJobById).toHaveBeenCalledWith(userId, id, { status: 'applied' });
    expect(deleteSkillById).toHaveBeenCalledWith(userId, id);
  });

  it('rejects invalid update bodies before calling the service', async () => {
    expect(
      (
        await request(app)
          .patch('/api/skills/' + id)
          .set(authorization)
          .send({ level: 'wizard' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .patch('/api/jobs/' + id)
          .set(authorization)
          .send({ status: 'hired?' })
      ).status,
    ).toBe(400);
    expect(updateSkillById).not.toHaveBeenCalled();
    expect(updateJobById).not.toHaveBeenCalled();
  });

  it.each([
    [
      'an unconfirmed index',
      () => new CareerUnavailableError(),
      503,
      'Skills are temporarily unavailable',
    ],
    ['an unexpected error', () => new Error('socket hang up'), 500, 'Server error'],
  ])(
    'maps %s on every route to %i without leaking details',
    async (_case, error, status, message) => {
      for (const fn of [
        findSkillsByOwner,
        findJobsByOwner,
        createJob,
        updateSkillById,
        deleteSkillById,
        updateJobById,
        deleteJobById,
      ]) {
        jest.mocked(fn).mockRejectedValue(error());
      }
      const calls = [
        request(app).get('/api/skills').set(authorization),
        request(app).get('/api/jobs').set(authorization),
        request(app).post('/api/jobs').set(authorization).send({ title: 'Engineer' }),
        request(app)
          .patch('/api/skills/' + id)
          .set(authorization)
          .send({ level: 'expert' }),
        request(app)
          .delete('/api/skills/' + id)
          .set(authorization),
        request(app)
          .patch('/api/jobs/' + id)
          .set(authorization)
          .send({ status: 'applied' }),
        request(app)
          .delete('/api/jobs/' + id)
          .set(authorization),
      ];
      for (const res of await Promise.all(calls)) {
        expect(res.status).toBe(status);
        expect(res.body).toEqual({ message });
      }
    },
  );
});
