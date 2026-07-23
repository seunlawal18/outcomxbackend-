// ─── Alchemy deposit webhooks ───────────────────────────────────────────────
//
// Public endpoint (no requireAuth — Alchemy isn't a logged-in user) that
// Alchemy's "Address Activity" webhook POSTs to whenever one of our
// deposit_addresses receives an on-chain transfer. Protected instead by
// HMAC signature verification, since without it anyone who found this URL
// could POST a fake "deposit" and get credited.

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import config from '../config';
import db from '../db/client';
import { DbDepositAddress } from '../types';
import { STABLECOIN_CONTRACTS, creditCryptoDeposit } from '../services/depositService';

const router = Router();

interface AlchemyActivity {
  fromAddress: string;
  toAddress: string;
  hash: string;
  value: number;
  asset: string;
  category: string;
  rawContract?: { address?: string; decimals?: number };
}

function verifySignature(rawBody: Buffer | undefined, signature: string | undefined): boolean {
  if (!rawBody || !signature || !config.alchemyWebhookSigningKey) return false;
  const expected = crypto
    .createHmac('sha256', config.alchemyWebhookSigningKey)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false; // length mismatch, malformed header, etc.
  }
}

router.post('/alchemy/deposit', async (req: Request, res: Response): Promise<void> => {
  const signature = req.header('x-alchemy-signature');
  const rawBody   = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!verifySignature(rawBody, signature)) {
    res.status(401).json({ success: false, error: 'Invalid signature' });
    return;
  }

  const network  = req.body?.event?.network as string | undefined;
  const activity = (req.body?.event?.activity ?? []) as AlchemyActivity[];
  const knownContracts = network ? (STABLECOIN_CONTRACTS[network] ?? {}) : {};

  for (const item of activity) {
    if (item.category !== 'token') continue; // only ERC20 transfers — not native MATIC

    const contract = item.rawContract?.address?.toLowerCase();
    const asset = contract ? knownContracts[contract] : undefined;
    if (!asset) continue; // not one of our accepted stablecoins on this network

    const deposit = await db
      .prepare<DbDepositAddress>('SELECT * FROM deposit_addresses WHERE address = ?')
      .get(item.toAddress);
    if (!deposit) continue; // transfer to an address we don't recognize

    // Same crediting path reconcileDeposits() uses — idempotent on tx hash
    // either way, so it doesn't matter which one sees a given deposit first.
    await creditCryptoDeposit({
      userId:  deposit.user_id,
      amount:  item.value,
      asset,
      network: network ?? 'unknown',
      txHash:  item.hash,
    });
  }

  res.status(200).json({ success: true });
});

export default router;
