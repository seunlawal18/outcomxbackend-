import { Router, Request, Response } from 'express';
import db from '../../db/client';
import { DbUser, toApiUser } from '../../types';

const router = Router();

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', (_req: Request, res: Response): void => {
  const users = db
    .prepare('SELECT * FROM users ORDER BY created_at DESC')
    .all() as DbUser[];

  // toApiUser strips password_hash
  res.status(200).json({ success: true, data: users.map(toApiUser) });
});

// ─── GET /stats ───────────────────────────────────────────────────────────────

router.get('/stats', (_req: Request, res: Response): void => {
  const totalUsers = (
    db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  ).count;

  // Active traders: users who have placed at least one trade
  const activeTraders = (
    db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM trades').get() as { count: number }
  ).count;

  const totalTrades = (
    db.prepare('SELECT COUNT(*) as count FROM trades').get() as { count: number }
  ).count;

  const activeTrades = (
    db.prepare("SELECT COUNT(*) as count FROM trades WHERE status = 'active'").get() as { count: number }
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
