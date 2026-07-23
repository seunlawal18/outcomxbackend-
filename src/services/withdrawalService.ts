// ─── Withdrawal requests ────────────────────────────────────────────────────
//
// The balance is debited the moment a request is created — funds are
// "locked" for the withdrawal immediately, same principle as a trade stake,
// so a user can't request a withdrawal and then also spend that money
// elsewhere while it's pending review. Admin approval/rejection is a manual
// step for now — actually signing and broadcasting the on-chain transfer
// needs a custody-provider decision not yet made (see project notes); that
// piece plugs in after approveWithdrawal(), where tx_hash/status='completed'
// would get set once it exists.

import db, { SQL_NOW } from '../db/client';
import { DbWithdrawalRequest } from '../types';
import { insertLedgerEntry } from './ledgerService';
import { emitter } from '../events';

export const MIN_WITHDRAWAL_USD = 10;

// Loose EVM address format check (0x + 40 hex chars) — not a checksum
// validation, just enough to catch an obvious typo before locking funds
// against a destination that could never be a real address.
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// Standard EVM transaction hash: 0x + 64 hex chars.
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export async function requestWithdrawal(
  userId: number,
  amount: number,
  destinationAddress: string,
): Promise<DbWithdrawalRequest> {
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_USD) {
    throw Object.assign(new Error(`Minimum withdrawal is $${MIN_WITHDRAWAL_USD}`), { statusCode: 400 });
  }
  if (!EVM_ADDRESS_RE.test(destinationAddress)) {
    throw Object.assign(new Error('Destination address is not a valid Polygon/EVM address'), { statusCode: 400 });
  }

  return db.transaction(async (tx) => {
    const user = await tx.prepare<{ balance: number }>('SELECT balance FROM users WHERE id = ?').get(userId);
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    if (amount > user.balance) throw Object.assign(new Error('Insufficient balance'), { statusCode: 400 });

    const updatedBalance = (await tx
      .prepare<{ balance: number }>('UPDATE users SET balance = balance - ? WHERE id = ? RETURNING balance')
      .get(amount, userId))!.balance;

    const request = (await tx.prepare<DbWithdrawalRequest>(`
      INSERT INTO withdrawal_requests (user_id, amount, destination_address, status)
      VALUES (?, ?, ?, 'pending')
      RETURNING *
    `).get(userId, amount, destinationAddress))!;

    await insertLedgerEntry(tx, {
      userId,
      type: 'withdrawal_pending',
      amount: -amount,
      balanceAfter: updatedBalance,
      note: `Withdrawal request #${request.id} to ${destinationAddress}`,
    });

    return request;
  });
}

export async function getUserWithdrawalRequests(userId: number): Promise<DbWithdrawalRequest[]> {
  return db.prepare<DbWithdrawalRequest>(
    'SELECT * FROM withdrawal_requests WHERE user_id = ? ORDER BY created_at DESC',
  ).all(userId);
}

export type WithdrawalRequestWithUser = DbWithdrawalRequest & {
  user_email: string; username: string; resolved_by_username: string | null;
};

export async function listWithdrawalRequests(status?: string): Promise<WithdrawalRequestWithUser[]> {
  const base = `
    SELECT w.*, u.email as user_email, u.username, admin.username as resolved_by_username
    FROM withdrawal_requests w
    JOIN users u ON u.id = w.user_id
    LEFT JOIN users admin ON admin.id = w.resolved_by
  `;
  if (status) {
    return db.prepare<WithdrawalRequestWithUser>(
      `${base} WHERE w.status = ? ORDER BY w.created_at ASC`,
    ).all(status);
  }
  return db.prepare<WithdrawalRequestWithUser>(`${base} ORDER BY w.created_at DESC`).all();
}

export async function approveWithdrawal(id: number, adminId: number, adminNote?: string): Promise<DbWithdrawalRequest> {
  const request = await db.prepare<DbWithdrawalRequest>('SELECT * FROM withdrawal_requests WHERE id = ?').get(id);
  if (!request) throw Object.assign(new Error('Withdrawal request not found'), { statusCode: 404 });
  if (request.status !== 'pending') {
    throw Object.assign(new Error(`Cannot approve a request that is already ${request.status}`), { statusCode: 400 });
  }

  // No balance change here — the funds were already debited at request
  // time. Approval just marks it reviewed and ready for the (currently
  // manual, pending custody-provider decision) actual fund transfer.
  const updated = (await db.prepare<DbWithdrawalRequest>(`
    UPDATE withdrawal_requests SET status = 'approved', admin_note = ?, resolved_at = ${SQL_NOW}, resolved_by = ?
    WHERE id = ? RETURNING *
  `).get(adminNote ?? null, adminId, id))!;

  emitter.withdrawalUpdated({
    userId: updated.user_id, withdrawalId: updated.id, status: 'approved',
    amount: updated.amount, timestamp: new Date().toISOString(),
  });
  return updated;
}

export async function rejectWithdrawal(id: number, adminId: number, adminNote?: string): Promise<DbWithdrawalRequest> {
  const updated = await db.transaction(async (tx) => {
    const request = await tx.prepare<DbWithdrawalRequest>('SELECT * FROM withdrawal_requests WHERE id = ?').get(id);
    if (!request) throw Object.assign(new Error('Withdrawal request not found'), { statusCode: 404 });
    if (request.status !== 'pending') {
      throw Object.assign(new Error(`Cannot reject a request that is already ${request.status}`), { statusCode: 400 });
    }

    const updatedBalance = (await tx
      .prepare<{ balance: number }>('UPDATE users SET balance = balance + ? WHERE id = ? RETURNING balance')
      .get(request.amount, request.user_id))!.balance;

    await insertLedgerEntry(tx, {
      userId: request.user_id,
      type: 'withdrawal_rejected',
      amount: request.amount,
      balanceAfter: updatedBalance,
      note: `Withdrawal request #${id} rejected${adminNote ? `: ${adminNote}` : ''}`,
    });

    return (await tx.prepare<DbWithdrawalRequest>(`
      UPDATE withdrawal_requests SET status = 'rejected', admin_note = ?, resolved_at = ${SQL_NOW}, resolved_by = ?
      WHERE id = ? RETURNING *
    `).get(adminNote ?? null, adminId, id))!;
  });

  emitter.withdrawalUpdated({
    userId: updated.user_id, withdrawalId: updated.id, status: 'rejected',
    amount: updated.amount, timestamp: new Date().toISOString(),
  });
  return updated;
}

// Marks a request as actually sent on-chain — the admin manually broadcasts
// the transfer from the treasury wallet (no custody-provider automation
// exists yet, see project notes) and pastes the resulting tx hash back here.
// Balance was already debited at request time, so this step moves no funds
// in our own ledger — it just records proof-of-payment against the request.
export async function completeWithdrawal(id: number, adminId: number, txHash: string): Promise<DbWithdrawalRequest> {
  if (!TX_HASH_RE.test(txHash)) {
    throw Object.assign(new Error('Enter a valid transaction hash (0x + 64 hex characters)'), { statusCode: 400 });
  }
  const request = await db.prepare<DbWithdrawalRequest>('SELECT * FROM withdrawal_requests WHERE id = ?').get(id);
  if (!request) throw Object.assign(new Error('Withdrawal request not found'), { statusCode: 404 });
  if (request.status !== 'approved') {
    throw Object.assign(new Error(`Cannot complete a request that is ${request.status} — it must be approved first`), { statusCode: 400 });
  }

  // resolved_at/resolved_by move forward to reflect completion — the most
  // meaningful "who/when" for an audit trail is who actually sent the
  // funds, not just who approved the request earlier.
  const updated = (await db.prepare<DbWithdrawalRequest>(`
    UPDATE withdrawal_requests SET status = 'completed', tx_hash = ?, resolved_at = ${SQL_NOW}, resolved_by = ?
    WHERE id = ? RETURNING *
  `).get(txHash, adminId, id))!;

  emitter.withdrawalUpdated({
    userId: updated.user_id, withdrawalId: updated.id, status: 'completed',
    amount: updated.amount, txHash: updated.tx_hash, timestamp: new Date().toISOString(),
  });
  return updated;
}
