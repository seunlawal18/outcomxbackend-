import { Router, Request, Response } from 'express';
import db from '../db/client';
import { autoCloseExpiredMarkets } from '../services/marketService';
import { getMarketHistory } from '../services/marketHistoryService';
import { DbMarket, DbMarketOutcome, toApiMarket } from '../types';

const router = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

function getOutcomes(marketId: number): DbMarketOutcome[] {
  return db.prepare(
    'SELECT * FROM market_outcomes WHERE market_id = ? ORDER BY id ASC',
  ).all(marketId) as DbMarketOutcome[];
}

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', (req: Request, res: Response): void => {
  autoCloseExpiredMarkets();

  const { category, duration, status, search, trending, new: isNew } = req.query;

  let query = 'SELECT * FROM markets WHERE 1=1';
  const params: unknown[] = [];

  if (category)         { query += ' AND category = ?';                          params.push(category); }
  if (duration)         { query += ' AND duration = ?';                          params.push(duration); }
  // Default to open only — only show all statuses when explicitly requested
  if (status)           { query += ' AND status = ?';                            params.push(status); }
  else                  { query += " AND status = 'open'"; }
  if (search)           { query += ' AND title LIKE ? COLLATE NOCASE';           params.push(`%${search}%`); }
  if (trending === 'true') { query += ' AND trending = 1'; }
  if (isNew === 'true') { query += ` AND created_at >= datetime('now', '-48 hours')`; }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params) as DbMarket[];

  res.status(200).json({
    success: true,
    data: rows.map(r => toApiMarket(r, getOutcomes(r.id))),
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

router.get('/:id', (req: Request, res: Response): void => {
  autoCloseExpiredMarkets();

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid market ID' }); return; }

  const market = db.prepare('SELECT * FROM markets WHERE id = ?').get(id) as DbMarket | undefined;
  if (!market) { res.status(404).json({ success: false, error: 'Market not found' }); return; }

  res.status(200).json({ success: true, data: toApiMarket(market, getOutcomes(id)) });
});

// ─── GET /:id/history ─────────────────────────────────────────────────────────
//
// Returns probability history for charts.
// Each point: { probabilities, yesPrice, noPrice, tradeVolume, timestamp }
// yesPrice = first-option decimal price, noPrice = second-option decimal price.
// For MULTI markets with 3+ options, use probabilities object for all curves.
//
// Query params:
//   limit — max rows (default 200, max 1000)

router.get('/:id/history', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid market ID' }); return; }

  const exists = db.prepare('SELECT id FROM markets WHERE id = ?').get(id);
  if (!exists) { res.status(404).json({ success: false, error: 'Market not found' }); return; }

  const limit = Math.min(parseInt((req.query.limit as string) || '200', 10), 1000);
  const history = getMarketHistory(id, limit);

  res.status(200).json({ success: true, data: history });
});

// ─── GET /:id/trades ──────────────────────────────────────────────────────────
// Public recent activity feed for a market. Trader names are anonymised.

router.get('/:id/trades', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid market ID' }); return; }

  const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);

  interface TradeRow {
    id: number; option: string; amount: number;
    status: string; timestamp: string; username: string;
  }

  const rows = db.prepare(`
    SELECT t.id, t.option, t.amount, t.status, t.timestamp, u.username
    FROM trades t
    JOIN users u ON u.id = t.user_id
    WHERE t.market_id = ?
    ORDER BY t.timestamp DESC
    LIMIT ?
  `).all(id, limit) as TradeRow[];

  const data = rows.map(r => ({
    id:        r.id,
    option:    r.option,
    amount:    r.amount,
    status:    r.status,
    timestamp: r.timestamp,
    trader:    r.username.slice(0, 3) + '***',
  }));

  res.status(200).json({ success: true, data });
});

export default router;
