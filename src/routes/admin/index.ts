import { Router, Request, Response } from 'express';
import db from '../../db/client';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/adminAuth';
import marketsAdminRouter from './markets';
import resolveRouter from './resolve';
import usersAdminRouter from './users';

const router = Router();

// Apply auth + admin guard to ALL routes under /api/admin
router.use(requireAuth, requireAdmin);

// ─── Sub-routers ──────────────────────────────────────────────────────────────

router.use('/markets', marketsAdminRouter);
router.use('/resolve', resolveRouter);
router.use('/users',   usersAdminRouter);

// ─── GET /stats ───────────────────────────────────────────────────────────────

router.get('/stats', (_req: Request, res: Response): void => {
  const totalMarkets = (
    db.prepare('SELECT COUNT(*) as count FROM markets').get() as { count: number }
  ).count;

  const openMarkets = (
    db.prepare("SELECT COUNT(*) as count FROM markets WHERE status = 'open'").get() as { count: number }
  ).count;

  const closedMarkets = (
    db.prepare("SELECT COUNT(*) as count FROM markets WHERE status = 'closed'").get() as { count: number }
  ).count;

  const settledMarkets = (
    db.prepare("SELECT COUNT(*) as count FROM markets WHERE status = 'settled'").get() as { count: number }
  ).count;

  const totalTrades = (
    db.prepare('SELECT COUNT(*) as count FROM trades').get() as { count: number }
  ).count;

  const activeTrades = (
    db.prepare("SELECT COUNT(*) as count FROM trades WHERE status = 'active'").get() as { count: number }
  ).count;

  const totalVolumeRow = (
    db.prepare('SELECT COALESCE(SUM(volume), 0) as total FROM markets').get() as { total: number }
  );

  const totalUsers = (
    db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  ).count;

  const activeTraders = (
    db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM trades').get() as { count: number }
  ).count;

  res.status(200).json({
    success: true,
    data: {
      totalMarkets,
      openMarkets,
      closedMarkets,
      settledMarkets,
      totalTrades,
      activeTrades,
      totalVolume: totalVolumeRow.total,
      totalUsers,
      activeTraders,
    },
  });
});

// ─── GET /income ──────────────────────────────────────────────────────────────
// Platform fee income from all settled markets.
// totalIncome     = sum of all platform_fee values
// settledMarkets  = count of settled markets with a fee recorded
// recentSettlements = last 10 settled markets with fee breakdown

router.get('/income', (_req: Request, res: Response): void => {
  const total = db.prepare(`
    SELECT
      COALESCE(SUM(platform_fee), 0) as total_income,
      COUNT(*) as settled_markets
    FROM markets
    WHERE status = 'settled' AND platform_fee IS NOT NULL
  `).get() as { total_income: number; settled_markets: number };

  const recent = db.prepare(`
    SELECT id, title, platform_fee, prize_pool, volume, result, created_at
    FROM markets
    WHERE status = 'settled' AND platform_fee IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 10
  `).all() as {
    id: number;
    title: string;
    platform_fee: number;
    prize_pool: number;
    volume: number;
    result: string | null;
    created_at: string;
  }[];

  res.status(200).json({
    success: true,
    data: {
      totalIncome:       total.total_income,
      settledMarkets:    total.settled_markets,
      recentSettlements: recent.map(m => ({
        id:          m.id,
        title:       m.title,
        platformFee: m.platform_fee,
        prizePool:   m.prize_pool,
        volume:      m.volume,
        result:      m.result,
        createdAt:   m.created_at,
      })),
    },
  });
});

export default router;
