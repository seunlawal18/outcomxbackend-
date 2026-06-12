import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/client';
import config from '../config';
import { DbUser, toApiUser } from '../types';

interface JwtPayload {
  sub: number;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication token required' });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  // Check token blacklist
  const blacklisted = db
    .prepare('SELECT token FROM token_blacklist WHERE token = ?')
    .get(token);

  if (blacklisted) {
    res.status(401).json({ success: false, error: 'Token has been revoked' });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as unknown as JwtPayload;
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }

  // Load fresh user from DB
  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(payload.sub) as DbUser | undefined;

  if (!user) {
    res.status(401).json({ success: false, error: 'User not found' });
    return;
  }

  req.user = toApiUser(user);
  next();
}
