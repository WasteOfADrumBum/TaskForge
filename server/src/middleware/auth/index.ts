import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../../config/env';

interface AuthTokenPayload {
  id: string;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authorization = req.header('Authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, requireEnv('JWT_SECRET'));

    if (typeof decoded === 'string' || !decoded.id) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.userId = (decoded as AuthTokenPayload).id;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
