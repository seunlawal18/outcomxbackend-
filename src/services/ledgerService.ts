import db, { TxDb } from '../db/client';

export type LedgerEntryType =
  | 'deposit'
  | 'crypto_deposit'
  | 'trade_stake'
  | 'trade_payout'
  | 'platform_fee'
  | 'balance_carryforward'
  | 'withdrawal_pending'
  | 'withdrawal_rejected';

interface InsertLedgerEntryParams {
  userId: number;
  type: LedgerEntryType;
  amount: number;        // signed — positive credits, negative debits
  balanceAfter: number;
  marketId?: number;
  tradeId?: number;
  idempotencyKey?: string;
  note?: string;
}

// Call with the `tx` from inside the same db.transaction() as the balance
// UPDATE it documents, so the entry and the balance change commit or roll
// back together — never a balance change with no explanation, or vice versa.
export async function insertLedgerEntry(conn: TxDb, params: InsertLedgerEntryParams): Promise<void> {
  await conn.prepare(`
    INSERT INTO ledger_entries (user_id, type, amount, balance_after, market_id, trade_id, idempotency_key, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.userId,
    params.type,
    params.amount,
    params.balanceAfter,
    params.marketId ?? null,
    params.tradeId ?? null,
    params.idempotencyKey ?? null,
    params.note ?? null,
  );
}

export interface DbLedgerEntry {
  id: number;
  user_id: number;
  type: string;
  amount: number;
  balance_after: number;
  market_id: number | null;
  trade_id: number | null;
  idempotency_key: string | null;
  note: string | null;
  created_at: string;
}

export async function getLedgerForUser(userId: number): Promise<DbLedgerEntry[]> {
  return db.prepare<DbLedgerEntry>(`
    SELECT * FROM ledger_entries WHERE user_id = ? ORDER BY created_at DESC, id DESC
  `).all(userId);
}
