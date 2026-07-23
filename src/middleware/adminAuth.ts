import { Request, Response, NextFunction } from 'express';
import db from '../db/client';

/**
 * Must run AFTER requireAuth.
 * Re-queries the DB for is_admin — never trusts the JWT payload.
 * This prevents privilege escalation if a token is stolen or tampered with.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  // Always re-read is_admin from DB — never trust req.user.isAdmin from token
  const row = await db
    .prepare<{ is_admin: number }>('SELECT is_admin FROM users WHERE id = ?')
    .get(req.user.id);

  if (!row || row.is_admin !== 1) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }

  next();
}
