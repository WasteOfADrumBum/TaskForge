import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import app from '../../app';
import { createUser, findUserByEmail } from '../../services/authService';

jest.mock('../../services/authService', () => ({
  createUser: jest.fn(),
  findUserByEmail: jest.fn(),
}));
jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
const create = jest.mocked(createUser);
const find = jest.mocked(findUserByEmail);
const hash = jest.mocked(bcrypt.hash);
const compare = jest.mocked(bcrypt.compare);
const password = 'long enough password';
const user = { id: 'user-id', email: 'test@example.com', password: 'private-hash' };

beforeEach(() => {
  jest.resetAllMocks();
  find.mockResolvedValue(null);
  create.mockResolvedValue(user as never);
  hash.mockImplementation((async () => 'private-hash') as never);
  compare.mockImplementation((async () => true) as never);
});

const expectNoCredentialWork = () => {
  expect(find).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
  expect(hash).not.toHaveBeenCalled();
  expect(compare).not.toHaveBeenCalled();
};

for (const endpoint of ['register', 'login']) {
  describe(endpoint + ' input boundaries', () => {
    it('rejects a missing body safely', async () => {
      const response = await request(app).post('/api/auth/' + endpoint);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Email and password are required' });
      expectNoCredentialWork();
    });

    it.each([
      {},
      [],
      { email: 'test@example.com' },
      { password },
      { email: 42, password },
      { email: { $ne: null }, password },
      { email: ['test@example.com'], password },
      { email: 'test@example.com', password: 42 },
      { email: 'test@example.com', password: { $ne: null } },
      { email: 'test@example.com', password: ['valid'] },
      { email: 'test@example.com', password: '' },
      { email: '   ', password },
    ])('rejects missing or non-string credentials %j without downstream work', async (body) => {
      const response = await request(app)
        .post('/api/auth/' + endpoint)
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Email and password are required' });
      expectNoCredentialWork();
    });

    it.each([null, true, 42, 'body'])('rejects a primitive JSON body %j safely', async (body) => {
      const response = await request(app)
        .post('/api/auth/' + endpoint)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(body));
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.text).not.toMatch(/stack|TypeError/);
      expectNoCredentialWork();
    });

    it.each([
      'invalid',
      'a@b',
      'a@@example.com',
      'a b@example.com',
      'a@example .com',
      'a\n@example.com',
      'a'.repeat(243) + '@example.com',
    ])('rejects invalid or oversized email %s', async (email) => {
      const response = await request(app)
        .post('/api/auth/' + endpoint)
        .send({ email, password });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Invalid email address' });
      expectNoCredentialWork();
    });

    it('returns generic unexpected errors without exposing password hashes or database details', async () => {
      find.mockRejectedValue(new Error('private-hash database credentials internal stack'));
      const response = await request(app)
        .post('/api/auth/' + endpoint)
        .send({ email: 'test@example.com', password });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Server error' });
    });
  });
}

describe('registration password and email policy', () => {
  it.each([
    'a'.repeat(15),
    'a'.repeat(72),
    '\u{1f600}'.repeat(15),
    '\u{1f600}'.repeat(18),
    ' '.repeat(15),
  ])('accepts bounded Unicode passwords verbatim (%s)', async (value) => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: ' TEST@EXAMPLE.COM ', password: value });
    expect(response.status).toBe(201);
    expect(find).toHaveBeenCalledWith('test@example.com');
    expect(hash).toHaveBeenCalledWith(value, 10);
    expect(create).toHaveBeenCalledWith({ email: 'test@example.com', password: 'private-hash' });
    expect(response.body).toEqual({
      message: 'User created',
      user: { id: 'user-id', email: 'test@example.com' },
    });
  });

  it.each(['a'.repeat(14), '\u{1f600}'.repeat(8)])(
    'rejects fewer than 15 codepoints, independent of UTF16 length',
    async (value) => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: value });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Password must be at least 15 characters' });
      expectNoCredentialWork();
    },
  );

  it.each(['a'.repeat(73), '\u{1f600}'.repeat(19), '\u00e9'.repeat(37)])(
    'rejects more than 72 UTF8 bytes',
    async (value) => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: value });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Password must be no more than 72 UTF-8 bytes' });
      expectNoCredentialWork();
    },
  );

  it('preserves meaningful leading and trailing password whitespace', async () => {
    const value = '  long password space  ';
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: value });
    expect(hash).toHaveBeenCalledWith(value, 10);
  });

  it('accepts an email at 254 characters', async () => {
    const email = 'a'.repeat(242) + '@example.com';
    const response = await request(app).post('/api/auth/register').send({ email, password });
    expect(response.status).toBe(201);
    expect(find).toHaveBeenCalledWith(email);
  });

  it('maps a unique-index race to a conflict without leaking the database error', async () => {
    create.mockRejectedValue({ code: 11000, message: 'private Mongo duplicate detail' });
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: 'User already exists' });
  });

  it('keeps a non-duplicate create failure generic', async () => {
    create.mockRejectedValue({ code: 42, message: 'private Mongo detail' });
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password });
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Server error' });
  });
});

describe('legacy login compatibility', () => {
  it.each(['short', 'a'.repeat(80), 'a'.repeat(4096), '\u{1f600}'.repeat(1024), '  short  '])(
    'accepts nonempty legacy password within request bound',
    async (value) => {
      find.mockResolvedValue(user as never);
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: ' TEST@EXAMPLE.COM ', password: value });
      expect(response.status).toBe(200);
      expect(find).toHaveBeenCalledWith('test@example.com');
      expect(compare).toHaveBeenCalledWith(value, 'private-hash');
      const token = jwt.verify(response.body.token, 'test-jwt-secret') as JwtPayload;
      expect(token.id).toBe('user-id');
      expect(token.exp! - token.iat!).toBe(7 * 24 * 60 * 60);
      expect(response.body).not.toHaveProperty('user');
    },
  );

  it.each(['a'.repeat(4097), '\u{1f600}'.repeat(1025)])(
    'rejects passwords exceeding 4096 UTF8 bytes before lookup or comparison',
    async (value) => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: value });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Password is too long' });
      expectNoCredentialWork();
    },
  );
});

it('returns the same invalid credentials response for a wrong password as for a missing user', async () => {
  find.mockResolvedValue(user as never);
  compare.mockImplementation((async () => false) as never);
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'test@example.com', password: 'wrong' });
  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Invalid credentials' });
});
