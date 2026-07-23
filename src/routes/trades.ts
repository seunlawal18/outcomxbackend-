import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { placeTrade } from '../services/tradeService';
import db from '../db/client';
import { DbTrade, toApiTrade } from '../types';

const router = Router();

// All trade routes require authentication
router.use(requireAuth);

// Keyed by user id (not IP) — the concern is one account hammering the
// endpoint, not shared-IP false positives. Generous enough for genuine
// active trading, tight enough to stop a runaway script or bot.
const tradeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => String(req.user!.id),
  message: { success: false, error: 'Too many trades placed — please slow down' },
});

// ─── Zod schema ───────────────────────────────────────────────────────────────

const tradeSchema = z.object({
  marketId: z.number().int('marketId must be an integer').positive('marketId must be positive'),
  option:   z.string().min(1, 'option is required'),
  amount:   z.number().positive('amount must be a positive number'),
});

// ─── POST / ───────────────────────────────────────────────────────────────────

router.post('/', tradeLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = tradeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { marketId, option, amount } = parsed.data;

  try {
    const result = await placeTrade(req.user!.id, marketId, option, amount);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    const error = err as Error & { statusCode?: number };
    res.status(error.statusCode ?? 500).json({ success: false, error: error.message });
  }
});

// ─── GET /my ──────────────────────────────────────────────────────────────────

router.get('/my', async (req: Request, res: Response): Promise<void> => {
  const trades = await db
    .prepare<DbTrade>('SELECT * FROM trades WHERE user_id = ? ORDER BY timestamp DESC')
    .all(req.user!.id);

  res.status(200).json({ success: true, data: trades.map(toApiTrade) });
});

export default router;
