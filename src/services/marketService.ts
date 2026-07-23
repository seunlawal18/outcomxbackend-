import db, { SQL_NOW, TxDb } from '../db/client';
import { emitter } from '../events';

// ─── Auto-close expired markets ───────────────────────────────────────────────

export async function autoCloseExpiredMarkets(): Promise<void> {
  // RETURNING + .all() (not .run()) so every closed market gets its own
  // market:closed emit — a bulk UPDATE's rowcount alone can't tell the
  // socket layer which specific markets just flipped.
  const closed = await db.prepare<{ id: number }>(`
    UPDATE markets
    SET status = 'closed'
    WHERE status = 'open'
      AND expires_at <= ${SQL_NOW}
    RETURNING id
  `).all();

  const timestamp = new Date().toISOString();
  for (const row of closed) {
    emitter.marketClosed({ marketId: row.id, reason: 'expired', timestamp });
  }
}

// ─── Probability shifting after a trade ──────────────────────────────────────
//
// Generic — works for any number of outcomes with any labels.
// No hardcoded "Yes"/"No"/"Up"/"Down" assumptions.
//
// Algorithm (Polymarket-style):
//   1. Calculate shift = min(floor(amount / SHIFT_DIVISOR), 3) — max 3 pct points per trade
//   2. Add shift to the traded option (capped at 99)
//   3. Subtract proportionally from all other options (floor at 1 each)
//   4. Normalise so sum === 100
//
// SHIFT_DIVISOR is calibrated against the app's USD quick-stake presets
// ($5/$20/$50/$100, see lib/credits.ts on the frontend): a $20 trade moves
// ~1pt, $50 ~2pt, $100+ hits the 3pt cap. Trades below $20 don't move the
// price, matching the original design intent where sub-threshold trades
// had zero effect (the old divisor of 5000 was calibrated for Naira-scale
// amounts before the global-USD-ledger refactor).
const SHIFT_DIVISOR = 20;

export function shiftProbabilities(
  probabilities: Record<string, number>,
  option: string,
  amount: number,
  // +1 = money backing this outcome (probability rises) — the default.
  // -1 = money against it (MULTI_YESNO "No" side — probability falls).
  direction: 1 | -1 = 1,
): Record<string, number> {
  const shift = Math.min(Math.floor(amount / SHIFT_DIVISOR), 3) * direction;
  if (shift === 0) return { ...probabilities };

  const updated: Record<string, number> = { ...probabilities };
  updated[option] = Math.min(99, Math.max(1, (updated[option] ?? 50) + shift));

  const otherKeys   = Object.keys(updated).filter(k => k !== option);
  const totalOthers = otherKeys.reduce((s, k) => s + (probabilities[k] ?? 0), 0);

  if (totalOthers > 0) {
    for (const key of otherKeys) {
      const share = (probabilities[key] ?? 0) / totalOthers;
      updated[key] = Math.min(99, Math.max(1, Math.round((probabilities[key] ?? 0) - shift * share)));
    }
  }

  // Normalise to exactly 100
  const total = Object.values(updated).reduce((s, v) => s + v, 0);
  if (total !== 100) {
    updated[option] = Math.min(99, Math.max(1, updated[option] + (100 - total)));
  }

  return updated;
}

// ─── Calculate expires_at from duration string ────────────────────────────────

export async function calcExpiresAt(duration: string): Promise<string> {
  const offsetMap: Record<string, string> = {
    '5min':    '5 minutes',
    '15min':   '15 minutes',
    '1hour':   '1 hour',
    '4hours':  '4 hours',
    'daily':   '1 day',
    'weekly':  '7 days',
    'monthly': '30 days',
    'yearly':  '365 days',
  };

  const offset = offsetMap[duration];
  if (!offset) throw new Error(`Unknown duration: ${duration}`);

  const row = await db
    .prepare<{ result: string }>(`SELECT to_char((NOW() AT TIME ZONE 'UTC') + $1::interval, 'YYYY-MM-DD HH24:MI:SS') as result`)
    .get(offset);

  return row!.result;
}

// ─── Equal probability distribution ──────────────────────────────────────────
//
// Distributes 100% equally across N options.
// First option absorbs any rounding remainder.
// e.g. 3 options → { A: 34, B: 33, C: 33 }

export function calcEqualProbabilities(options: string[]): Record<string, number> {
  const n         = options.length;
  const base      = Math.floor(100 / n);
  const remainder = 100 - base * n;

  const result: Record<string, number> = {};
  options.forEach((opt, i) => {
    result[opt] = i === 0 ? base + remainder : base;
  });

  return result;
}

// ─── Validate and normalise admin-supplied opening probabilities ──────────────
//
// Rules:
//   - Every option must have an entry
//   - All values must be positive integers
//   - Sum must be exactly 100 (we normalise if close, reject if wildly off)

export function validateAndNormaliseProbs(
  options: string[],
  supplied: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const opt of options) {
    const val = supplied[opt];
    if (val === undefined || val === null) {
      throw Object.assign(
        new Error(`Missing probability for option "${opt}"`),
        { statusCode: 400 },
      );
    }
    if (typeof val !== 'number' || val <= 0) {
      throw Object.assign(
        new Error(`Probability for "${opt}" must be a positive number`),
        { statusCode: 400 },
      );
    }
    result[opt] = val;
  }

  const total = Object.values(result).reduce((s, v) => s + v, 0);

  // Allow small floating-point drift (±2), normalise to 100
  if (Math.abs(total - 100) > 2) {
    throw Object.assign(
      new Error(`Probabilities must sum to 100 (got ${total})`),
      { statusCode: 400 },
    );
  }

  if (total !== 100) {
    // Normalise: scale all values so they sum to exactly 100
    const scale = 100 / total;
    let runningSum = 0;
    const keys = Object.keys(result);
    keys.forEach((k, i) => {
      if (i === keys.length - 1) {
        result[k] = 100 - runningSum;
      } else {
        result[k] = Math.round(result[k] * scale);
        runningSum += result[k];
      }
    });
  }

  return result;
}

// ─── Sync market_outcomes pool amounts after a trade ─────────────────────────
//
// Called inside the trade transaction.
// Updates the pool_amount for the traded outcome and recalculates
// probability decimals for all outcomes based on pool share.

export async function syncOutcomePools(
  conn: TxDb,
  marketId: number,
  tradedOption: string,
  tradeAmount: number,
  updatedProbabilities: Record<string, number>,
): Promise<void> {
  const labels = Object.keys(updatedProbabilities);
  if (labels.length === 0) return;

  // Single bulk UPDATE covering every outcome's probability plus the
  // pool_amount increment for the traded one — was 1 (pool increment) +
  // 1 (select outcomes) + N (one UPDATE per outcome) round-trips to Neon;
  // now exactly 1, regardless of how many outcomes the market has. Each
  // round-trip on this connection costs ~350ms, so this was the single
  // largest contributor to trade-placement latency.
  const valuesSql = labels.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}::real)`).join(', ');
  const params: unknown[] = [];
  labels.forEach(label => params.push(label, (updatedProbabilities[label] ?? 0) / 100));

  const tradedOptionIdx = labels.length * 2 + 1;
  const tradeAmountIdx  = labels.length * 2 + 2;
  const marketIdIdx     = labels.length * 2 + 3;
  params.push(tradedOption, tradeAmount, marketId);

  await conn.prepare(`
    UPDATE market_outcomes AS mo
    SET probability = v.probability,
        pool_amount = mo.pool_amount + CASE WHEN mo.label = $${tradedOptionIdx} THEN $${tradeAmountIdx}::real ELSE 0 END
    FROM (VALUES ${valuesSql}) AS v(label, probability)
    WHERE mo.market_id = $${marketIdIdx} AND mo.label = v.label
  `).run(...params);
}
