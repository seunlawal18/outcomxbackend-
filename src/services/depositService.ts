// ─── Crypto deposit addresses ──────────────────────────────────────────────
//
// Each user gets one Polygon address, derived from TREASURY_XPUB at index =
// their user id (m/44'/60'/0'/<user_id> off the account-level xpub). This
// server only ever holds the xpub — public-key-only, so it can derive and
// watch addresses but can never sign a transaction or move funds. The
// matching seed phrase lives offline, on paper, outside this codebase
// entirely.

import { HDKey } from '@scure/bip32';
import { secp256k1 } from '@noble/curves/secp256k1';
import { publicKeyToAddress } from 'viem/utils';
import { bytesToHex } from 'viem';
import db from '../db/client';
import config from '../config';
import { DbDepositAddress } from '../types';
import { insertLedgerEntry } from './ledgerService';
import { getIncomingTokenTransfers, alchemyNetworkLabel, getConfirmations, addAddressToWebhook } from './alchemyClient';

// Neither the webhook nor the reconciliation poller trust their own
// timing — both go through creditCryptoDeposit, which independently checks
// the chain before crediting. A transaction seen too early (still
// reorg-able) is simply left uncredited; the reconciliation poller re-checks
// it on its next 60s tick until it clears this bar.
const MIN_CONFIRMATIONS = 12;

// Verified Polygon PoS mainnet contract addresses for the two stablecoins we
// accept. Amoy testnet only has USDC — Circle maintains an official testnet
// deployment there; Tether does not publish an official Amoy USDT
// deployment, so testnet testing is USDC-only (USDT is verified against the
// well-documented mainnet address instead, e.g. a small real-value test).
// Shared between the webhook route and the reconciliation poller below —
// both need to agree on what counts as a real deposit.
export const STABLECOIN_CONTRACTS: Record<string, Record<string, string>> = {
  MATIC_MAINNET: {
    '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': 'USDC',
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 'USDT',
  },
  MATIC_AMOY: {
    '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582': 'USDC',
  },
};

// Parsed lazily (not at module load) so a server without deposits
// configured yet doesn't crash on import — only a request that actually
// needs an address does.
let treasuryAccount: HDKey | null = null;
function getTreasuryAccount(): HDKey {
  if (!config.treasuryXpub) {
    throw Object.assign(new Error('Crypto deposits are not configured yet'), { statusCode: 503 });
  }
  if (!treasuryAccount) {
    treasuryAccount = HDKey.fromExtendedKey(config.treasuryXpub);
  }
  return treasuryAccount;
}

function deriveAddress(index: number): string {
  const child = getTreasuryAccount().deriveChild(index);
  const uncompressed = secp256k1.ProjectivePoint.fromHex(child.publicKey!).toRawBytes(false);
  return publicKeyToAddress(bytesToHex(uncompressed));
}

export async function getOrCreateDepositAddress(
  userId: number,
): Promise<{ address: string; chain: string }> {
  const existing = await db
    .prepare<DbDepositAddress>('SELECT * FROM deposit_addresses WHERE user_id = ?')
    .get(userId);
  if (existing) return { address: existing.address, chain: existing.chain };

  const address = deriveAddress(userId);

  // ON CONFLICT DO NOTHING + fallback SELECT handles two concurrent first
  // requests for the same user racing each other — the loser's INSERT
  // returns no row instead of erroring on the UNIQUE constraint.
  const inserted = await db
    .prepare<DbDepositAddress>(`
      INSERT INTO deposit_addresses (user_id, address, derivation_index, chain)
      VALUES (?, ?, ?, 'polygon')
      ON CONFLICT (user_id) DO NOTHING
      RETURNING *
    `)
    .get(userId, address, userId);

  if (inserted) {
    // Fire-and-forget: the user gets their address either way. If Alchemy's
    // Notify API is unreachable or not configured, reconcileDeposits()
    // still finds this address's deposits on its own within 60s — this
    // registration only buys the instant push on top of that.
    addAddressToWebhook(inserted.address).catch((err) => {
      console.error(`[depositService] Failed to register ${inserted.address} with Alchemy webhook:`, (err as Error).message);
    });
    return { address: inserted.address, chain: inserted.chain };
  }

  const afterRace = await db
    .prepare<DbDepositAddress>('SELECT * FROM deposit_addresses WHERE user_id = ?')
    .get(userId);
  return { address: afterRace!.address, chain: afterRace!.chain };
}

// Shared by both the webhook route (src/routes/webhooks.ts) and
// reconcileDeposits() below — same idempotency-key-on-tx-hash guard either
// way, so a deposit credited by one path is a safe no-op if the other path
// also sees it later.
export async function creditCryptoDeposit(params: {
  userId: number; amount: number; asset: string; network: string; txHash: string;
}): Promise<void> {
  const alreadyProcessed = await db
    .prepare('SELECT 1 FROM ledger_entries WHERE idempotency_key = ?')
    .get(params.txHash);
  if (alreadyProcessed) return;

  // Not reorg-safe yet — leave uncredited (not an error, not "processed")
  // so the reconciliation poller naturally re-evaluates it next tick.
  const confirmations = await getConfirmations(params.txHash);
  if (confirmations < MIN_CONFIRMATIONS) return;

  try {
    await db.transaction(async (tx) => {
      const updated = (await tx
        .prepare<{ balance: number }>('UPDATE users SET balance = balance + ? WHERE id = ? RETURNING balance')
        .get(params.amount, params.userId))!;
      await insertLedgerEntry(tx, {
        userId:         params.userId,
        type:           'crypto_deposit',
        amount:         params.amount,
        balanceAfter:   updated.balance,
        idempotencyKey: params.txHash,
        note: `${params.asset} deposit on ${params.network}, tx ${params.txHash}`,
      });
    });
  } catch (err) {
    // 23505 = unique_violation — a concurrent path (webhook vs reconciler,
    // or two reconciler ticks racing) beat us to this tx hash; already
    // credited, nothing more to do.
    if ((err as { code?: string }).code !== '23505') throw err;
  }
}

// Safety net for the webhook above: polls the chain directly for deposits
// that never arrived via webhook (Alchemy's free-tier dashboard showed zero
// delivery logs for a real transaction during testing — reliability isn't
// guaranteed). Cheap at current scale (one RPC call per known deposit
// address per tick); would need a smarter batched approach if this ever
// has to watch thousands of addresses.
export async function reconcileDeposits(): Promise<void> {
  if (!config.alchemyApiKey) return;

  const network = alchemyNetworkLabel();
  const knownContracts = STABLECOIN_CONTRACTS[network] ?? {};
  const contractAddresses = Object.keys(knownContracts);
  if (contractAddresses.length === 0) return;

  const addresses = await db.prepare<DbDepositAddress>('SELECT * FROM deposit_addresses').all();

  for (const dep of addresses) {
    const transfers = await getIncomingTokenTransfers(dep.address, contractAddresses);
    for (const t of transfers) {
      const contract = t.rawContract.address?.toLowerCase();
      const asset = contract ? knownContracts[contract] : undefined;
      if (!asset || t.value == null) continue;

      await creditCryptoDeposit({
        userId:  dep.user_id,
        amount:  t.value,
        asset,
        network,
        txHash:  t.hash,
      });
    }
  }
}
