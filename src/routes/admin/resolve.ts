import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../../db/client';
import { settleMarket } from '../../services/tradeService';
import { DbMarket, DbMarketOutcome, toApiMarket } from '../../types';

const router = Router();

const resolveSchema = z.object({
  // Plain markets: a single winning option name.
  // MULTI_YESNO: a Yes/No result for every outcome, keyed by outcome label —
  // set independently per outcome (see settleMarket / OutcomeResults).
  result: z.union([
    z.string().min(1, 'result is required'),
    z.record(z.enum(['Yes', 'No'])),
  ]),
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────────

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
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
    const { settledCount, totalPool, platformFee, prizePool, resultLabel } = await settleMarket(id, result, req.user!.id);

    const market   = await db.prepare<DbMarket>('SELECT * FROM markets WHERE id = ?').get(id);
    const outcomes = await db.prepare<DbMarketOutcome>(
      'SELECT * FROM market_outcomes WHERE market_id = ? ORDER BY id ASC',
    ).all(id);

    res.status(200).json({
      success: true,
      data: {
        market:       toApiMarket(market!, outcomes),
        settledTrades: settledCount,
        // Fee breakdown — for admin dashboard + analytics
        settlement: {
          totalPool,
          platformFee,
          platformFeeRate: 0.03,
          prizePool,
          winningOutcome: resultLabel,
        },
      },
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number };
    res.status(error.statusCode ?? 500).json({ success: false, error: error.message });
  }
});

export default router;
