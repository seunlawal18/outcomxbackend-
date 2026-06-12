import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../../db/client';
import { settleMarket } from '../../services/tradeService';
import { DbMarket, DbMarketOutcome, toApiMarket } from '../../types';

const router = Router();

const resolveSchema = z.object({
  result: z.string().min(1, 'result is required'),
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────────

router.patch('/:id', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ success: false, error: 'Invalid market ID' });
    return;
  }

  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { result } = parsed.data;

  try {
    const { settledCount, totalPool, platformFee, prizePool } = settleMarket(id, result);

    const market   = db.prepare('SELECT * FROM markets WHERE id = ?').get(id) as DbMarket;
    const outcomes = db.prepare(
      'SELECT * FROM market_outcomes WHERE market_id = ? ORDER BY id ASC',
    ).all(id) as DbMarketOutcome[];

    res.status(200).json({
      success: true,
      data: {
        market:       toApiMarket(market, outcomes),
        settledTrades: settledCount,
        // Fee breakdown — for admin dashboard + analytics
        settlement: {
          totalPool,
          platformFee,
          platformFeeRate: 0.03,
          prizePool,
          winningOutcome: result,
        },
      },
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number };
    res.status(error.statusCode ?? 500).json({ success: false, error: error.message });
  }
});

export default router;
