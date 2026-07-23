import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import db from '../db/client';
import { requireAuth } from '../middleware/auth';
import { getMinStake, MAX_DEPOSIT_USD } from '../services/authService';
import { insertLedgerEntry, getLedgerForUser } from '../services/ledgerService';
import { getOrCreateDepositAddress } from '../services/depositService';
import { requestWithdrawal, getUserWithdrawalRequests } from '../services/withdrawalService';

const router = Router();

// All wallet routes require authentication
router.use(requireAuth);

// Withdrawal requests are a rare, deliberate action — no legitimate reason
// to submit many in a short window. Keyed by user id, same reasoning as
// tradeLimiter in routes/trades.ts.
const withdrawLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => String(req.user!.id),
  message: { success: false, error: 'Too many withdrawal requests — please try again later' },
});

// ─── Zod schema ───────────────────────────────────────────────────────────────

const depositSchema = z.object({
  amount: z.number().positive('Amount must be a positive number'),
});

const withdrawSchema = z.object({
  amount: z.number().positive('Amount must be a positive number'),
  destinationAddress: z.string().min(1, 'Destination address is required'),
});

// ─── GET /balance ─────────────────────────────────────────────────────────────

router.get('/balance', async (req: Request, res: Response): Promise<void> => {
  const row = await db
    .prepare<{ balance: number; region: string }>('SELECT balance, region FROM users WHERE id = ?')
    .get(req.user!.id);

  if (!row) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  res.status(200).json({ success: true, data: { balance: row.balance, region: row.region } });
});

// ─── POST /deposit ────────────────────────────────────────────────────────────

router.post('/deposit', async (req: Request, res: Response): Promise<void> => {
  const parsed = depositSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { amount } = parsed.data;

  const minStake = getMinStake();
  if (amount < minStake) {
    res.status(400).json({
      success: false,
      error: `Minimum deposit is $${minStake}`,
    });
    return;
  }

  if (amount > MAX_DEPOSIT_USD) {
    res.status(400).json({
      success: false,
      error: `Maximum single deposit is $${MAX_DEPOSIT_USD}`,
    });
    return;
  }

  const newBalance = await db.transaction(async (tx) => {
    await tx.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, req.user!.id);
    const updated = (await tx.prepare<{ balance: number }>('SELECT balance FROM users WHERE id = ?').get(req.user!.id))!;
    await insertLedgerEntry(tx, {
      userId: req.user!.id, type: 'deposit', amount, balanceAfter: updated.balance,
      note: 'Self-credit demo deposit — not real funds',
    });
    return updated.balance;
  });

  res.status(200).json({ success: true, data: { balance: newBalance } });
});

// ─── GET /deposit-address ──────────────────────────────────────────────────────
// Real crypto deposit address (Polygon, USDT/USDC) — distinct from the
// self-credit demo /deposit endpoint above. Creates one on first request.

router.get('/deposit-address', async (req: Request, res: Response): Promise<void> => {
  const result = await getOrCreateDepositAddress(req.user!.id);
  res.status(200).json({ success: true, data: result });
});

// ─── POST /withdraw ─────────────────────────────────────────────────────────
// Locks the balance immediately and creates a pending request — an admin
// must approve or reject it (see routes/admin/withdrawals.ts). Actually
// sending funds on-chain is a separate, not-yet-built step gated on a
// custody-provider decision.

router.post('/withdraw', withdrawLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { amount, destinationAddress } = parsed.data;
  const request = await requestWithdrawal(req.user!.id, amount, destinationAddress);

  res.status(201).json({
    success: true,
    data: {
      id:                  request.id,
      amount:              request.amount,
      destinationAddress:  request.destination_address,
      status:              request.status,
      createdAt:           request.created_at,
    },
  });
});

// ─── GET /withdrawals ───────────────────────────────────────────────────────
// The logged-in user's own withdrawal request history.

router.get('/withdrawals', async (req: Request, res: Response): Promise<void> => {
  const requests = await getUserWithdrawalRequests(req.user!.id);
  res.status(200).json({
    success: true,
    data: requests.map(r => ({
      id:                  r.id,
      amount:              r.amount,
      destinationAddress:  r.destination_address,
      status:              r.status,
      adminNote:           r.admin_note,
      txHash:              r.tx_hash,
      createdAt:           r.created_at,
      resolvedAt:          r.resolved_at,
    })),
  });
});

// ─── GET /ledger ──────────────────────────────────────────────────────────────
// Full transaction history for the logged-in user — every deposit, stake,
// and payout, in order, each showing the balance right after it applied.

router.get('/ledger', async (req: Request, res: Response): Promise<void> => {
  const entries = await getLedgerForUser(req.user!.id);
  res.status(200).json({
    success: true,
    data: entries.map(e => ({
      id:           e.id,
      type:         e.type,
      amount:       e.amount,
      balanceAfter: e.balance_after,
      marketId:     e.market_id,
      tradeId:      e.trade_id,
      note:         e.note,
      createdAt:    e.created_at,
    })),
  });
});

export default router;
