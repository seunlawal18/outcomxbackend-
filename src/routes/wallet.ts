import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../db/client';
import { requireAuth } from '../middleware/auth';
import { getMinStake, getStartingBalance } from '../services/authService';

const router = Router();

// All wallet routes require authentication
router.use(requireAuth);

// ─── Zod schema ───────────────────────────────────────────────────────────────

const depositSchema = z.object({
  amount: z.number().positive('Amount must be a positive number'),
});

// ─── GET /balance ─────────────────────────────────────────────────────────────

router.get('/balance', (req: Request, res: Response): void => {
  const row = db
    .prepare('SELECT balance, region FROM users WHERE id = ?')
    .get(req.user!.id) as { balance: number; region: string } | undefined;

  if (!row) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  res.status(200).json({ success: true, data: { balance: row.balance, region: row.region } });
});

// ─── POST /deposit ────────────────────────────────────────────────────────────

router.post('/deposit', (req: Request, res: Response): void => {
  const parsed = depositSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { amount } = parsed.data;
  const region = req.user!.region;

  const minStake = getMinStake(region);
  if (amount < minStake) {
    res.status(400).json({
      success: false,
      error: `Minimum deposit for your region is ${minStake}`,
    });
    return;
  }

  const maxDeposit = getStartingBalance(region) * 200;
  if (amount > maxDeposit) {
    res.status(400).json({
      success: false,
      error: `Maximum single deposit for your region is ${maxDeposit}`,
    });
    return;
  }

  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, req.user!.id);

  const updated = db
    .prepare('SELECT balance FROM users WHERE id = ?')
    .get(req.user!.id) as { balance: number };

  res.status(200).json({ success: true, data: { balance: updated.balance } });
});

export default router;
