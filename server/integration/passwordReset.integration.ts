import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app';
import { User } from '../src/models/userModel';
import { PasswordReset } from '../src/models/passwordResetModel';
import { createPasswordResetToken, hashResetToken } from '../src/services/passwordResetService';

const parent = process.env.TEST_MONGO_URI;
if (
  !parent ||
  parent !== parent.trim() ||
  !/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d{1,5}\/taskforge_qa_[a-zA-Z0-9_]{8,}$/.test(parent)
)
  throw new Error('Password reset requires a fresh loopback QA namespace');

const email = 'reset-owner@taskforge-qa.example';
const oldPassword = 'Synthetic old password 2026!';
const newPassword = 'Synthetic new password 2026!';
let userId: string;

beforeAll(async () => {
  await mongoose.connect(parent + '_password_reset', {
    serverSelectionTimeoutMS: 5000,
    autoCreate: false,
    autoIndex: false,
  });
  const db = mongoose.connection.db;
  if (!db || (await db.listCollections().toArray()).length)
    throw new Error('Refusing pre-existing password reset collections');
  for (const model of [User, PasswordReset]) {
    await model.createCollection();
    await model.createIndexes();
  }
  const registration = await request(app)
    .post('/api/auth/register')
    .send({ email, password: oldPassword });
  expect(registration.status).toBe(201);
  userId = registration.body.user.id;
});

afterAll(async () => {
  await mongoose.disconnect();
});

const reset = (token: string, password = newPassword) =>
  request(app).post('/api/auth/reset-password').send({ token, password });
const login = (password: string) => request(app).post('/api/auth/login').send({ email, password });

it('stores only a hash with a TTL index, and a new link replaces the old one', async () => {
  const first = await createPasswordResetToken(userId);
  const second = await createPasswordResetToken(userId);
  const records = await PasswordReset.find({ user: userId }).lean();
  expect(records).toHaveLength(1);
  expect(records[0].tokenHash).toBe(hashResetToken(second));
  expect(JSON.stringify(records)).not.toContain(second);
  const indexes = await PasswordReset.collection.indexes();
  expect(indexes.find((index) => index.key.expiresAt === 1)?.expireAfterSeconds).toBe(0);
  expect(indexes.find((index) => index.key.user === 1)?.unique).toBe(true);
  expect((await reset(first)).status).toBe(400);
});

it('resets the password once, then the same link stops working', async () => {
  const token = await createPasswordResetToken(userId);
  const response = await reset(token);
  expect(response.status).toBe(200);
  expect((await login(oldPassword)).status).toBe(401);
  expect((await login(newPassword)).status).toBe(200);
  expect(await PasswordReset.countDocuments({ user: userId })).toBe(0);
  expect((await reset(token, 'Synthetic third password 2026!')).status).toBe(400);
  expect((await login(newPassword)).status).toBe(200);
});

it('rejects an expired link even before the TTL sweep removes it', async () => {
  const token = await createPasswordResetToken(userId, new Date(Date.now() - 31 * 60_000));
  expect(await PasswordReset.countDocuments({ user: userId })).toBe(1);
  expect((await reset(token, 'Synthetic expired password 2026!')).status).toBe(400);
  expect((await login(newPassword)).status).toBe(200);
});

it('lets only one of two simultaneous uses of a link succeed', async () => {
  const token = await createPasswordResetToken(userId);
  const results = await Promise.all([
    reset(token, 'Synthetic race password A 2026!'),
    reset(token, 'Synthetic race password B 2026!'),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
});
