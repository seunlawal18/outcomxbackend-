import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db, { SQL_NOW } from '../db/client';
import config from '../config';

// ─── Global USD ledger ──────────────────────────────────────────────────────
// Every account is denominated in USD regardless of region — region is
// locale/profile metadata only and no longer drives any money calculation.

export const STARTING_BALANCE_USD = 0;
export const MIN_STAKE_USD        = 0.99;
export const MAX_DEPOSIT_USD      = 50000;

// ─── Exported helpers ─────────────────────────────────────────────────────────

export function getStartingBalance(): number {
  return STARTING_BALANCE_USD;
}

export function getMinStake(): number {
  return MIN_STAKE_USD;
}

export function generateToken(userId: number, isAdmin: boolean): string {
  return jwt.sign(
    { sub: userId, isAdmin },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions,
  );
}

// ─── Wallet sign-in nonces ──────────────────────────────────────────────────
// A nonce is a one-time random challenge the wallet must sign to prove
// address ownership. 5-minute expiry keeps a captured signature from being
// replayed later.

const NONCE_TTL_MS = 5 * 60 * 1000;

export async function createWalletNonce(address: string): Promise<{ nonce: string; message: string }> {
  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString();

  await db.prepare(`
    INSERT INTO wallet_nonces (address, nonce, expires_at) VALUES (?, ?, ?)
  `).run(address.toLowerCase(), nonce, expiresAt);

  const message = [
    'Sign in to OutcomX',
    '',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join('\n');

  return { nonce, message };
}

interface WalletNonceRow {
  id: number;
  address: string;
  nonce: string;
  expires_at: string;
  used: number;
}

// Verifies the nonce embedded in `message` was actually issued for this
// address, hasn't expired, and hasn't already been consumed. Marks it used.
export async function consumeWalletNonce(address: string, message: string): Promise<boolean> {
  const row = await db.prepare<WalletNonceRow>(`
    SELECT * FROM wallet_nonces
    WHERE address = ? AND used = 0 AND expires_at > ${SQL_NOW}
    ORDER BY created_at DESC
    LIMIT 1
  `).get(address.toLowerCase());

  if (!row || !message.includes(`Nonce: ${row.nonce}`)) return false;

  await db.prepare('UPDATE wallet_nonces SET used = 1 WHERE id = ?').run(row.id);
  return true;
}

export async function blacklistToken(token: string, expiresAt: Date): Promise<void> {
  // Insert the token into the blacklist
  await db.prepare(`
    INSERT INTO token_blacklist (token, expires_at)
    VALUES (?, to_char(to_timestamp(?), 'YYYY-MM-DD HH24:MI:SS'))
    ON CONFLICT (token) DO NOTHING
  `).run(token, Math.floor(expiresAt.getTime() / 1000));

  // Clean up expired tokens while we're here
  await db.prepare(`
    DELETE FROM token_blacklist WHERE expires_at < ${SQL_NOW}
  `).run();
}
