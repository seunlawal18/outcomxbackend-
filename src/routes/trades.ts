import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { placeTrade } from '../services/tradeService';
import db from '../db/client';
import { DbTrade, toApiTrade } from '../types';

const router = Router();

// All trade routes require authentication
router.use(requireAuth);

// ─── Zod schema ───────────────────────────────────────────────────────────────

const tradeSchema = z.object({
  marketId: z.number().int('marketId must be an integer').positive('marketId must be positive'),
  option:   z.string().min(1, 'option is required'),
  amount:   z.number().positive('amount must be a positive number'),
});

// ─── POST / ───────────────────────────────────────────────────────────────────

router.post('/', (req: Request, res: Response): void => {
  const parsed = tradeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { marketId, option, amount } = parsed.data;

  try {
    const result = placeTrade(req.user!.id, marketId, option, amount);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    const error = err as Error & { statusCode?: number };
    res.status(error.statusCode ?? 500).json({ success: false, error: error.message });
  }
});

// ─── GET /my ──────────────────────────────────────────────────────────────────

router.get('/my', (req: Request, res: Response): void => {
  const trades = db
    .prepare('SELECT * FROM trades WHERE user_id = ? ORDER BY timestamp DESC')
    .all(req.user!.id) as DbTrade[];

  res.status(200).json({ success: true, data: trades.map(toApiTrade) });
});

export default router;
