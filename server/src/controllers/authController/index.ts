import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail } from '../../services/authService';
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  isResetTokenShape,
  setUserPassword,
} from '../../services/passwordResetService';
import { getResetEmailConfig, sendPasswordResetEmail } from '../../services/mailService';
import { requireEnv } from '../../config/env';

type Credentials = { email: string; password: string };

// The same policy applies to a new account and to a reset password.
const newPasswordError = (password: string): string | null => {
  // bcrypt only hashes the first 72 bytes; avoid silently accepting a truncated password.
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return 'Password must be no more than 72 UTF-8 bytes';
  }
  if ([...password].length < 15) return 'Password must be at least 15 characters';
  return null;
};

const readNormalizedEmail = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalizedEmail = value.trim().toLowerCase();
  if (
    normalizedEmail.length > 254 ||
    [...normalizedEmail].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    return null;
  }
  return normalizedEmail;
};

// Read untrusted JSON as unknown; never send a query object to Mongoose or bcrypt.
// Passwords stay verbatim so Unicode and intentional whitespace remain valid credentials.
const validateCredentials = (
  body: unknown,
  mode: 'register' | 'login',
): Credentials | { error: string } => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Email and password are required' };
  }
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return { error: 'Email and password are required' };
  }
  const normalizedEmail = readNormalizedEmail(email);
  if (!normalizedEmail) return { error: 'Invalid email address' };
  const passwordBytes = Buffer.byteLength(password, 'utf8');
  if (mode === 'register') {
    const policyError = newPasswordError(password);
    if (policyError) return { error: policyError };
  } else if (passwordBytes > 4096) {
    // Login retains support for pre-policy accounts, while bounding comparison input.
    return { error: 'Password is too long' };
  }
  return { email: normalizedEmail, password };
};
export const register = async (req: Request, res: Response) => {
  const credentials = validateCredentials(req.body, 'register');
  if ('error' in credentials) return res.status(400).json({ message: credentials.error });
  const { email, password } = credentials;

  try {
    const userExists = await findUserByEmail(email);

    if (userExists) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await createUser({ email, password: hashedPassword });

    return res.status(201).json({
      message: 'User created',
      user: { id: newUser.id, email: newUser.email },
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return res.status(409).json({ message: 'User already exists' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  const credentials = validateCredentials(req.body, 'login');
  if ('error' in credentials) return res.status(400).json({ message: credentials.error });
  const { email, password } = credentials;

  try {
    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id }, requireEnv('JWT_SECRET'), { expiresIn: '7d' });

    return res.json({ message: 'Logged in successfully', token });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const logout = async (_req: Request, res: Response) => {
  return res.status(200).json({ message: 'Logged out successfully' });
};

export const FORGOT_PASSWORD_MESSAGE =
  'If an account uses that email, a reset link is on its way. It works once and expires in 30 minutes.';
export const RESET_EMAIL_UNAVAILABLE_MESSAGE =
  'Password reset by email is not set up yet. Ask the site owner for a reset link.';
export const INVALID_RESET_LINK_MESSAGE =
  'This reset link is invalid, used or expired. Ask for a new one.';

// Looks up the account and sends the email after the response is sent, so the reply's
// content and timing are the same whether or not the account exists.
const deliverResetEmail = async (email: string) => {
  const config = getResetEmailConfig();
  if (!config) return;
  const user = await findUserByEmail(email);
  if (!user) return;
  const token = await createPasswordResetToken(String(user.id));
  await sendPasswordResetEmail(config, user.email, token);
};

export const forgotPassword = async (req: Request, res: Response) => {
  const body: unknown = req.body;
  const email =
    body && typeof body === 'object' && !Array.isArray(body)
      ? readNormalizedEmail((body as Record<string, unknown>).email)
      : null;
  if (!email) return res.status(400).json({ message: 'Enter a valid email address' });
  res.set('Cache-Control', 'no-store');
  // Unconfigured email is a site-wide state, the same for every address, so it reveals nothing.
  if (!getResetEmailConfig()) {
    return res.status(503).json({ message: RESET_EMAIL_UNAVAILABLE_MESSAGE });
  }
  res.status(202).json({ message: FORGOT_PASSWORD_MESSAGE });
  void deliverResetEmail(email).catch(() => {
    // Never log the address or token. The owner sees provider failures in the Resend dashboard.
    console.error('Password reset email could not be sent');
  });
  return undefined;
};

export const resetPassword = async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const body: unknown = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ message: INVALID_RESET_LINK_MESSAGE });
  }
  const { token, password } = body as Record<string, unknown>;
  if (!isResetTokenShape(token)) {
    return res.status(400).json({ message: INVALID_RESET_LINK_MESSAGE });
  }
  if (typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'Enter a new password' });
  }
  const policyError = newPasswordError(password);
  // Check the policy before claiming the token, so a rejected password keeps the link usable.
  if (policyError) return res.status(400).json({ message: policyError });

  try {
    // Hash first: a failure here must not burn the one-time link.
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = await consumePasswordResetToken(token);
    if (!userId) return res.status(400).json({ message: INVALID_RESET_LINK_MESSAGE });
    const updated = await setUserPassword(userId, passwordHash);
    if (!updated) return res.status(400).json({ message: INVALID_RESET_LINK_MESSAGE });
    return res.status(200).json({ message: 'Password updated. Sign in with your new password.' });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};
