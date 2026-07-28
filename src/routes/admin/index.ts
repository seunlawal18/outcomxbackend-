import { Router, Request, Response } from 'express';
import db from '../../db/client';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/adminAuth';
import { searchCoins } from '../../services/priceFeedService';
import marketsAdminRouter from './markets';
import resolveRouter from './resolve';
import usersAdminRouter from './users';
import withdrawalsAdminRouter from './withdrawals';
import slidesAdminRouter from './slides';

const router = Router();

// Apply auth + admin guard to ALL routes under /api/admin
router.use(requireAuth, requireAdmin);

// ─── Sub-routers ──────────────────────────────────────────────────────────────

router.use('/markets',     marketsAdminRouter);
router.use('/resolve',     resolveRouter);
router.use('/users',       usersAdminRouter);
router.use('/withdrawals', withdrawalsAdminRouter);
router.use('/slides',      slidesAdminRouter);

// ─── GET /stats ───────────────────────────────────────────────────────────────
// COUNT(*) returns bigint in Postgres (parsed as a JS string by the driver) —
// cast to ::int so these stay plain numbers, matching the old SQLite shape.

router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  const totalMarkets = (
    (await db.prepare<{ count: number }>('SELECT COUNT(*)::int as count FROM markets').get())!
  ).count;

  const openMarkets = (
    (await db.prepare<{ count: number }>("SELECT COUNT(*)::int as count FROM markets WHERE status = 'open'").get())!
  ).count;

  const closedMarkets = (
    (await db.prepare<{ count: number }>("SELECT COUNT(*)::int as count FROM markets WHERE status = 'closed'").get())!
  ).count;

  const settledMarkets = (
    (await db.prepare<{ count: number }>("SELECT COUNT(*)::int as count FROM markets WHERE status = 'settled'").get())!
  ).count;

  const totalTrades = (
    (await db.prepare<{ count: number }>('SELECT COUNT(*)::int as count FROM trades').get())!
  ).count;

  const activeTrades = (
    (await db.prepare<{ count: number }>("SELECT COUNT(*)::int as count FROM trades WHERE status = 'active'").get())!
  ).count;

  const totalVolumeRow = (
    await db.prepare<{ total: number }>('SELECT COALESCE(SUM(volume), 0) as total FROM markets').get()
  )!;

  const totalUsers = (
    (await db.prepare<{ count: number }>('SELECT COUNT(*)::int as count FROM users').get())!
  ).count;

  const activeTraders = (
    (await db.prepare<{ count: number }>('SELECT COUNT(DISTINCT user_id)::int as count FROM trades').get())!
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

router.get('/income', async (_req: Request, res: Response): Promise<void> => {
  const total = (await db.prepare<{ total_income: number; settled_markets: number }>(`
    SELECT
      COALESCE(SUM(platform_fee), 0) as total_income,
      COUNT(*)::int as settled_markets
    FROM markets
    WHERE status = 'settled' AND platform_fee IS NOT NULL
  `).get())!;

  const recent = await db.prepare<{
    id: number;
    title: string;
    platform_fee: number;
    prize_pool: number;
    volume: number;
    result: string | null;
    created_at: string;
    resolved_by_username: string | null;
  }>(`
    SELECT m.id, m.title, m.platform_fee, m.prize_pool, m.volume, m.result, m.created_at,
           admin.username as resolved_by_username
    FROM markets m
    LEFT JOIN users admin ON admin.id = m.resolved_by
    WHERE m.status = 'settled' AND m.platform_fee IS NOT NULL
    ORDER BY m.created_at DESC
    LIMIT 10
  `).all();

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
        // null means auto-resolved (live-price market) rather than an admin call
        resolvedBy:  m.resolved_by_username,
      })),
    },
  });
});

// ─── GET /coins/search ────────────────────────────────────────────────────────
// Coin lookup for the "track a live price" market-creation flow — lets the
// admin pick a valid CoinGecko id instead of typing one freehand.

router.get('/coins/search', async (req: Request, res: Response): Promise<void> => {
  const query = (req.query.q as string | undefined) ?? '';
  if (query.trim().length < 2) {
    res.status(200).json({ success: true, data: [] });
    return;
  }

  try {
    const results = await searchCoins(query);
    res.status(200).json({ success: true, data: results });
  } catch (err) {
    const error = err as Error;
    res.status(502).json({ success: false, error: `Coin lookup failed: ${error.message}` });
  }
});

export default router;
