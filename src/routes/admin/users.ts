import { Router, Request, Response } from 'express';
import db from '../../db/client';
import { DbUser, toApiUser } from '../../types';

const router = Router();

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const users = await db
    .prepare<DbUser>('SELECT * FROM users ORDER BY created_at DESC')
    .all();

  // toApiUser strips password_hash
  res.status(200).json({ success: true, data: users.map(u => toApiUser(u)) });
});

// ─── GET /stats ───────────────────────────────────────────────────────────────
// COUNT(*) returns bigint in Postgres (parsed as a JS string by the driver) —
// cast to ::int so these stay plain numbers, matching the old SQLite shape.

router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  const totalUsers = (
    (await db.prepare<{ count: number }>('SELECT COUNT(*)::int as count FROM users').get())!
  ).count;

  // Active traders: users who have placed at least one trade
  const activeTraders = (
    (await db.prepare<{ count: number }>('SELECT COUNT(DISTINCT user_id)::int as count FROM trades').get())!
  ).count;

  const totalTrades = (
    (await db.prepare<{ count: number }>('SELECT COUNT(*)::int as count FROM trades').get())!
  ).count;

  const activeTrades = (
    (await db.prepare<{ count: number }>("SELECT COUNT(*)::int as count FROM trades WHERE status = 'active'").get())!
  ).count;

  res.status(200).json({
    success: true,
    data: {
      totalUsers,
      activeTraders,
      totalTrades,
      activeTrades,
    },
  });
});

export default router;
