import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail } from '../../services/authService';
import { requireEnv } from '../../config/env';

export const register = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

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
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id }, requireEnv('JWT_SECRET'), { expiresIn: '1h' });

    return res.json({ message: 'Logged in successfully', token });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const logout = async (_req: Request, res: Response) => {
  return res.status(200).json({ message: 'Logged out successfully' });
};
