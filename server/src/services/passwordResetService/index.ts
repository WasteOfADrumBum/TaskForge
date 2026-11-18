import { createHash, randomBytes } from 'node:crypto';
import { PasswordReset } from '../../models/passwordResetModel';
import { User } from '../../models/userModel';

export const RESET_TOKEN_TTL_MINUTES = 30;
const RESET_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const isResetTokenShape = (token: unknown): token is string =>
  typeof token === 'string' && RESET_TOKEN_PATTERN.test(token);

// Issues a new single-use token for the user and removes any older ones, so only the newest
// link works. Returns the raw token; only its hash is stored.
export const createPasswordResetToken = async (userId: string, now = new Date()) => {
  const token = randomBytes(32).toString('hex');
  await PasswordReset.deleteMany({ user: userId });
  await PasswordReset.create({
    user: userId,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60_000),
  });
  return token;
};

// Atomically claims the token so it cannot be used twice, even by concurrent requests.
// Returns the owning user id, or null for an unknown, used or expired token.
export const consumePasswordResetToken = async (token: string, now = new Date()) => {
  const record = await PasswordReset.findOneAndDelete({
    tokenHash: hashResetToken(token),
    expiresAt: { $gt: now },
  });
  return record ? String(record.user) : null;
};

export const setUserPassword = async (userId: string, passwordHash: string) => {
  const updated = await User.findByIdAndUpdate(userId, { password: passwordHash });
  await PasswordReset.deleteMany({ user: userId });
  return Boolean(updated);
};
