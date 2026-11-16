import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import {
  changeKnowledge,
  createKnowledge,
  denyKnowledge,
  getKnowledge,
  knowledgeAudit,
  knowledgeDenials,
  KnowledgeError,
  listKnowledge,
  searchKnowledge,
} from '../../services/knowledgeService';

// KAN-77: the HTTP contract of /api/knowledge (status codes, input checks, denial records and
// error mapping) with the database-backed service functions mocked. Real database behaviour is
// covered by the integration suite.
jest.mock('../../services/knowledgeService', () => {
  const actual = jest.requireActual('../../services/knowledgeService');
  return {
    ...actual,
    createKnowledge: jest.fn(),
    getKnowledge: jest.fn(),
    listKnowledge: jest.fn(),
    searchKnowledge: jest.fn(),
    changeKnowledge: jest.fn(),
    knowledgeAudit: jest.fn(),
    knowledgeDenials: jest.fn(),
    denyKnowledge: jest.fn(),
  };
});

const userId = '507f1f77bcf86cd799439011';
const id = '507f1f77bcf86cd799439061';
const project = '507f1f77bcf86cd799439071';
const digest = 'a'.repeat(64);
const key = 'knowledge-key-0001';
const auth = { Authorization: 'Bearer ' + jwt.sign({ id: userId }, 'test-jwt-secret') };
const body = { title: 'Release notes', content: 'Synthetic notes.', kind: 'note', project: null };

beforeEach(() => {
  jest.clearAllMocks();
  // The real denyKnowledge records the denial, then throws the error for the response.
  jest
    .mocked(denyKnowledge)
    .mockImplementation(async (_owner, _source, _action, _reason, status, message) => {
      throw new KnowledgeError(status, message);
    });
});

describe('knowledge routes', () => {
  it.each([
    ['get', '/api/knowledge'],
    ['post', '/api/knowledge'],
    ['get', '/api/knowledge/search?q=notes'],
    ['get', '/api/knowledge/audit/denials'],
    ['get', `/api/knowledge/${id}`],
    ['get', `/api/knowledge/${id}/audit`],
    ['put', `/api/knowledge/${id}`],
    ['delete', `/api/knowledge/${id}`],
  ] as const)('requires authentication for %s %s and is never cached', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  describe('create', () => {
    it('answers 201 for a new source and 200 for a repeated idempotency key', async () => {
      jest
        .mocked(createKnowledge)
        .mockResolvedValueOnce({ created: true, source: { id } } as never);
      const created = await request(app)
        .post('/api/knowledge')
        .set(auth)
        .set('Idempotency-Key', key)
        .send(body);
      expect(created.status).toBe(201);
      expect(created.body).toEqual({ source: { id } });
      expect(createKnowledge).toHaveBeenCalledWith(userId, body, key);

      jest
        .mocked(createKnowledge)
        .mockResolvedValueOnce({ created: false, source: { id } } as never);
      const repeated = await request(app)
        .post('/api/knowledge')
        .set(auth)
        .set('Idempotency-Key', key)
        .send(body);
      expect(repeated.status).toBe(200);
    });

    it.each([
      ['missing', undefined],
      ['too short', 'short'],
      ['too long', 'k'.repeat(129)],
      ['with a bad character', 'knowledge key 0001!'],
    ])('rejects an idempotency key that is %s and records the denial', async (_case, value) => {
      const req = request(app).post('/api/knowledge').set(auth);
      const res = await (value === undefined ? req : req.set('Idempotency-Key', value)).send(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Invalid or excessive knowledge input' });
      expect(denyKnowledge).toHaveBeenCalledWith(
        userId,
        null,
        'create',
        'invalid-input',
        400,
        'Invalid or excessive knowledge input',
      );
      expect(createKnowledge).not.toHaveBeenCalled();
    });

    it('answers 503 when the denial itself cannot be recorded', async () => {
      jest
        .mocked(denyKnowledge)
        .mockRejectedValueOnce(
          new KnowledgeError(503, 'Knowledge audit is temporarily unavailable'),
        );
      const res = await request(app).post('/api/knowledge').set(auth).send(body);
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ message: 'Knowledge audit is temporarily unavailable' });
    });

    it('passes a service error through with its own status', async () => {
      jest.mocked(createKnowledge).mockRejectedValueOnce(new KnowledgeError(409, 'Conflict'));
      const res = await request(app)
        .post('/api/knowledge')
        .set(auth)
        .set('Idempotency-Key', key)
        .send(body);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ message: 'Conflict' });
    });

    it('hides an unexpected failure behind a generic 503', async () => {
      jest.mocked(createKnowledge).mockRejectedValueOnce(new Error('connection reset'));
      const res = await request(app)
        .post('/api/knowledge')
        .set(auth)
        .set('Idempotency-Key', key)
        .send(body);
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ message: 'Knowledge is temporarily unavailable' });
    });
  });

  describe('list and search', () => {
    it('lists the owner’s sources, optionally for one project', async () => {
      jest.mocked(listKnowledge).mockResolvedValue([] as never);
      expect((await request(app).get('/api/knowledge').set(auth)).body).toEqual({ sources: [] });
      expect(listKnowledge).toHaveBeenLastCalledWith(userId, undefined);
      await request(app).get(`/api/knowledge?project=${project}`).set(auth);
      expect(listKnowledge).toHaveBeenLastCalledWith(userId, project);
    });

    it.each([
      ['an unknown query parameter', '/api/knowledge?sort=title'],
      ['a malformed project', '/api/knowledge?project=nope'],
      ['an unknown search parameter', '/api/knowledge/search?q=notes&page=2'],
      ['an empty search', '/api/knowledge/search?q=%20'],
      ['no search text', '/api/knowledge/search'],
      ['a search over the byte limit', `/api/knowledge/search?q=${'a'.repeat(121)}`],
    ])('rejects %s with 400', async (_case, path) => {
      const res = await request(app).get(path).set(auth);
      expect(res.status).toBe(400);
      expect(listKnowledge).not.toHaveBeenCalled();
      expect(searchKnowledge).not.toHaveBeenCalled();
    });

    it('searches by keyword without using a model', async () => {
      jest.mocked(searchKnowledge).mockResolvedValue([{ id }] as never);
      const res = await request(app)
        .get(`/api/knowledge/search?q=notes&project=${project}`)
        .set(auth);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ mode: 'keyword', modelUsed: false, results: [{ id }] });
      expect(searchKnowledge).toHaveBeenCalledWith(userId, 'notes', project);
    });
  });

  describe('read', () => {
    it('returns one source, its audit and the owner’s denials', async () => {
      jest.mocked(getKnowledge).mockResolvedValue({ id } as never);
      jest.mocked(knowledgeAudit).mockResolvedValue({ events: [] } as never);
      jest.mocked(knowledgeDenials).mockResolvedValue([] as never);
      expect((await request(app).get(`/api/knowledge/${id}`).set(auth)).body).toEqual({
        source: { id },
      });
      expect((await request(app).get(`/api/knowledge/${id}/audit`).set(auth)).body).toEqual({
        events: [],
      });
      expect((await request(app).get('/api/knowledge/audit/denials').set(auth)).body).toEqual({
        events: [],
      });
      expect(getKnowledge).toHaveBeenCalledWith(userId, id);
      expect(knowledgeAudit).toHaveBeenCalledWith(userId, id);
      expect(knowledgeDenials).toHaveBeenCalledWith(userId);
    });

    it('answers 404 for a malformed id and records it as not found', async () => {
      const res = await request(app).get('/api/knowledge/not-an-id').set(auth);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Knowledge source not found' });
      expect(denyKnowledge).toHaveBeenCalledWith(
        userId,
        null,
        'read',
        'source-not-found',
        404,
        'Knowledge source not found',
      );
      expect(getKnowledge).not.toHaveBeenCalled();
    });
  });

  describe('update and delete', () => {
    it('updates with the expected version and normalized input', async () => {
      jest.mocked(changeKnowledge).mockResolvedValue({ id, version: 2 } as never);
      const res = await request(app)
        .put(`/api/knowledge/${id}`)
        .set(auth)
        .send({ ...body, title: '  Release notes  ', project, version: 1, contentDigest: digest });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ source: { id, version: 2 } });
      expect(changeKnowledge).toHaveBeenCalledWith(userId, id, 1, digest, {
        title: 'Release notes',
        content: 'Synthetic notes.',
        kind: 'note',
        project,
      });
    });

    it('deletes with only a version and digest, answering 204', async () => {
      jest.mocked(changeKnowledge).mockResolvedValue({ id } as never);
      const res = await request(app)
        .delete(`/api/knowledge/${id}`)
        .set(auth)
        .send({ version: 3, contentDigest: digest });
      expect(res.status).toBe(204);
      expect(changeKnowledge).toHaveBeenCalledWith(userId, id, 3, digest, null);
    });

    it.each([
      ['an array body', 'put', [1]],
      ['a missing version', 'put', { ...body, contentDigest: digest }],
      ['a fractional version', 'put', { ...body, version: 1.5, contentDigest: digest }],
      ['a short digest', 'put', { ...body, version: 1, contentDigest: 'abc' }],
      ['an unknown field', 'put', { ...body, pinned: true, version: 1, contentDigest: digest }],
      ['extra fields on delete', 'delete', { title: 'x', version: 1, contentDigest: digest }],
    ] as const)(
      'rejects %s with 400 and records the denial against the source',
      async (_c, m, sent) => {
        const res = await request(app)
          [m](`/api/knowledge/${id}`)
          .set(auth)
          .send(sent as object);
        expect(res.status).toBe(400);
        expect(denyKnowledge).toHaveBeenCalledWith(
          userId,
          id,
          m === 'put' ? 'update' : 'delete',
          'invalid-input',
          400,
          'Invalid or excessive knowledge input',
        );
        expect(changeKnowledge).not.toHaveBeenCalled();
      },
    );

    it('answers 404 for a malformed id before reading the body', async () => {
      const res = await request(app)
        .put('/api/knowledge/not-an-id')
        .set(auth)
        .send({ ...body, version: 1, contentDigest: digest });
      expect(res.status).toBe(404);
      expect(changeKnowledge).not.toHaveBeenCalled();
    });
  });
});
