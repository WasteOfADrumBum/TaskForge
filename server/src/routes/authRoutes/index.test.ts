import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import app from '../../app';
import { createUser, findUserByEmail } from '../../services/authService';

jest.mock('../../services/authService', () => ({
  createUser: jest.fn(),
  findUserByEmail: jest.fn(),
}));

const mockedCreateUser = jest.mocked(createUser);
const mockedFindUserByEmail = jest.mocked(findUserByEmail);

describe('auth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects registration without an email and password', async () => {
    const response = await request(app).post('/api/auth/register').send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Email and password are required' });
  });

  it('registers a new user without returning the password hash', async () => {
    mockedFindUserByEmail.mockResolvedValue(null);
    mockedCreateUser.mockResolvedValue({
      id: 'user-id',
      email: 'test@example.com',
      password: 'hashed-password',
    } as never);

    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'Password123!' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      message: 'User created',
      user: { id: 'user-id', email: 'test@example.com' },
    });
    expect(response.body.user.password).toBeUndefined();
  });

  it('rejects registration when the user already exists', async () => {
    mockedFindUserByEmail.mockResolvedValue({
      id: 'user-id',
      email: 'test@example.com',
      password: 'hashed-password',
    } as never);

    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'Password123!' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: 'User already exists' });
  });

  it('rejects login with invalid credentials', async () => {
    mockedFindUserByEmail.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'missing@example.com', password: 'Password123!' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Invalid credentials' });
  });

  it('logs in a user with valid credentials', async () => {
    const password = 'Password123!';
    const hashedPassword = await bcrypt.hash(password, 10);
    mockedFindUserByEmail.mockResolvedValue({
      id: 'user-id',
      email: 'test@example.com',
      password: hashedPassword,
    } as never);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Logged in successfully');
    expect(response.body.token).toEqual(expect.any(String));
    const payload = jwt.verify(response.body.token, process.env.JWT_SECRET!) as JwtPayload;
    expect(payload.id).toBe('user-id');
    expect(payload.exp! - payload.iat!).toBe(7 * 24 * 60 * 60);
  });

  it('logs out successfully', async () => {
    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Logged out successfully' });
  });
});
