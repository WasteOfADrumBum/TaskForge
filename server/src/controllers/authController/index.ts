import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail } from '../../services/authService';
import { requireEnv } from '../../config/env';

type Credentials = { email: string; password: string };

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
  const normalizedEmail = email.trim().toLowerCase();
  if (
    normalizedEmail.length > 254 ||
    [...normalizedEmail].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    return { error: 'Invalid email address' };
  }
  const passwordBytes = Buffer.byteLength(password, 'utf8');
  if (mode === 'register') {
    // bcrypt only hashes the first 72 bytes; avoid silently accepting a truncated password.
    if (passwordBytes > 72) return { error: 'Password must be no more than 72 UTF-8 bytes' };
    if ([...password].length < 15) return { error: 'Password must be at least 15 characters' };
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
