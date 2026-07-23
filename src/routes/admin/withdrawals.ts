import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  listWithdrawalRequests, approveWithdrawal, rejectWithdrawal, completeWithdrawal,
} from '../../services/withdrawalService';

const router = Router();

// ─── GET / ────────────────────────────────────────────────────────────────────
// ?status=pending|approved|rejected|completed — omit for all, newest first.

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const status = req.query.status as string | undefined;
  const requests = await listWithdrawalRequests(status);
  res.status(200).json({
    success: true,
    data: requests.map(r => ({
      id:                  r.id,
      userId:              r.user_id,
      userEmail:           r.user_email,
      username:            r.username,
      amount:              r.amount,
      destinationAddress:  r.destination_address,
      chain:               r.chain,
      status:              r.status,
      adminNote:           r.admin_note,
      txHash:              r.tx_hash,
      createdAt:           r.created_at,
      resolvedAt:          r.resolved_at,
      resolvedByUsername:  r.resolved_by_username,
    })),
  });
});

const resolveSchema = z.object({
  adminNote: z.string().optional(),
});

// ─── PATCH /:id/approve ─────────────────────────────────────────────────────
// Marks the request reviewed and ready — does NOT move funds. Actually
// sending the on-chain transfer is a separate, not-yet-built step (needs a
// custody-provider decision).

router.patch('/:id/approve', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid withdrawal request ID' }); return; }

  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.errors[0].message }); return; }

  const updated = await approveWithdrawal(id, req.user!.id, parsed.data.adminNote);
  res.status(200).json({ success: true, data: { id: updated.id, status: updated.status } });
});

// ─── PATCH /:id/reject ──────────────────────────────────────────────────────
// Refunds the locked balance back to the user.

router.patch('/:id/reject', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid withdrawal request ID' }); return; }

  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.errors[0].message }); return; }

  const updated = await rejectWithdrawal(id, req.user!.id, parsed.data.adminNote);
  res.status(200).json({ success: true, data: { id: updated.id, status: updated.status } });
});

// ─── PATCH /:id/complete ────────────────────────────────────────────────────
// Records proof that the admin manually sent the funds — pass the tx hash
// from the treasury wallet's outgoing transfer. Only valid from 'approved'.

const completeSchema = z.object({
  txHash: z.string().min(1, 'Transaction hash is required'),
});

router.patch('/:id/complete', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid withdrawal request ID' }); return; }

  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.errors[0].message }); return; }

  const updated = await completeWithdrawal(id, req.user!.id, parsed.data.txHash.trim());
  res.status(200).json({ success: true, data: { id: updated.id, status: updated.status, txHash: updated.tx_hash } });
});

export default router;
