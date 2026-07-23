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

// Shared by the REST middleware below and the Socket.IO handshake
// (src/socket.ts) — both need the same "is this token still valid" check.
export async function verifyAuthToken(token: string): Promise<DbUser | null> {
  const blacklisted = await db
    .prepare('SELECT token FROM token_blacklist WHERE token = ?')
    .get(token);
  if (blacklisted) return null;

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as unknown as JwtPayload;
  } catch {
    return null;
  }

  const user = await db
    .prepare<DbUser>('SELECT * FROM users WHERE id = ?')
    .get(payload.sub);

  return user ?? null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication token required' });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix
  const user  = await verifyAuthToken(token);

  if (!user) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }

  req.user = toApiUser(user);
  next();
}
