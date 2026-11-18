jest.mock('../../models/passwordResetModel', () => ({
  PasswordReset: {
    deleteMany: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
}));
jest.mock('../../models/userModel', () => ({ User: { findByIdAndUpdate: jest.fn() } }));

import { PasswordReset } from '../../models/passwordResetModel';
import { User } from '../../models/userModel';
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  hashResetToken,
  isResetTokenShape,
  setUserPassword,
} from '.';

describe('passwordResetService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('issues a 256-bit token, stores only its hash, expires in 30 minutes and replaces the old one in one upsert', async () => {
    const now = new Date('2026-11-18T07:00:00.000Z');
    const token = await createPasswordResetToken('u1', now);
    expect(isResetTokenShape(token)).toBe(true);
    expect(PasswordReset.findOneAndUpdate).toHaveBeenCalledWith(
      { user: 'u1' },
      {
        $set: {
          tokenHash: hashResetToken(token),
          expiresAt: new Date('2026-11-18T07:30:00.000Z'),
        },
      },
      { upsert: true },
    );
    expect(JSON.stringify(jest.mocked(PasswordReset.findOneAndUpdate).mock.calls)).not.toContain(
      token,
    );
    expect(await createPasswordResetToken('u1', now)).not.toBe(token);
  });

  it('claims a token atomically and only while it is unexpired', async () => {
    const now = new Date('2026-11-18T07:10:00.000Z');
    jest.mocked(PasswordReset.findOneAndDelete).mockResolvedValueOnce({ user: 'u1' } as never);
    await expect(consumePasswordResetToken('b'.repeat(64), now)).resolves.toBe('u1');
    expect(PasswordReset.findOneAndDelete).toHaveBeenCalledWith({
      tokenHash: hashResetToken('b'.repeat(64)),
      expiresAt: { $gt: now },
    });
    jest.mocked(PasswordReset.findOneAndDelete).mockResolvedValueOnce(null);
    await expect(consumePasswordResetToken('b'.repeat(64), now)).resolves.toBeNull();
  });

  it('updates the password and removes every outstanding token for that user', async () => {
    jest.mocked(User.findByIdAndUpdate).mockResolvedValueOnce({ id: 'u1' } as never);
    await expect(setUserPassword('u1', 'hash')).resolves.toBe(true);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('u1', { password: 'hash' });
    expect(PasswordReset.deleteMany).toHaveBeenCalledWith({ user: 'u1' });
    jest.mocked(User.findByIdAndUpdate).mockResolvedValueOnce(null);
    await expect(setUserPassword('gone', 'hash')).resolves.toBe(false);
  });

  it('accepts only 64 lowercase hex characters as a token', () => {
    expect(isResetTokenShape('a'.repeat(64))).toBe(true);
    for (const value of ['A'.repeat(64), 'a'.repeat(63), 'g'.repeat(64), 42, null, { $ne: 1 }]) {
      expect(isResetTokenShape(value)).toBe(false);
    }
  });
});
