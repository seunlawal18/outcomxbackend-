import db from '../db/client';

// ─── Auto-close expired markets ───────────────────────────────────────────────

export function autoCloseExpiredMarkets(): void {
  db.prepare(`
    UPDATE markets
    SET status = 'closed'
    WHERE status = 'open'
      AND expires_at <= datetime('now')
  `).run();
}

// ─── Probability shifting after a trade ──────────────────────────────────────
//
// Generic — works for any number of outcomes with any labels.
// No hardcoded "Yes"/"No"/"Up"/"Down" assumptions.
//
// Algorithm (Polymarket-style):
//   1. Calculate shift = min(floor(amount / 5000), 3) — max 3 pct points per trade
//   2. Add shift to the traded option (capped at 99)
//   3. Subtract proportionally from all other options (floor at 1 each)
//   4. Normalise so sum === 100

export function shiftProbabilities(
  probabilities: Record<string, number>,
  option: string,
  amount: number,
): Record<string, number> {
  const shift = Math.min(Math.floor(amount / 5000), 3);
  if (shift === 0) return { ...probabilities };

  const updated: Record<string, number> = { ...probabilities };
  updated[option] = Math.min(99, (updated[option] ?? 50) + shift);

  const otherKeys   = Object.keys(updated).filter(k => k !== option);
  const totalOthers = otherKeys.reduce((s, k) => s + (probabilities[k] ?? 0), 0);

  if (totalOthers > 0) {
    for (const key of otherKeys) {
      const share = (probabilities[key] ?? 0) / totalOthers;
      updated[key] = Math.max(1, Math.round((probabilities[key] ?? 0) - shift * share));
    }
  }

  // Normalise to exactly 100
  const total = Object.values(updated).reduce((s, v) => s + v, 0);
  if (total !== 100) {
    updated[option] = updated[option] + (100 - total);
  }

  return updated;
}

// ─── Calculate expires_at from duration string ────────────────────────────────

export function calcExpiresAt(duration: string): string {
  const offsetMap: Record<string, string> = {
    '5min':    '+5 minutes',
    '15min':   '+15 minutes',
    '1hour':   '+1 hour',
    '4hours':  '+4 hours',
    'daily':   '+1 day',
    'weekly':  '+7 days',
    'monthly': '+30 days',
    'yearly':  '+365 days',
  };

  const offset = offsetMap[duration];
  if (!offset) throw new Error(`Unknown duration: ${duration}`);

  const row = db
    .prepare(`SELECT datetime('now', ?) as result`)
    .get(offset) as { result: string };

  return row.result;
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

export function syncOutcomePools(
  marketId: number,
  tradedOption: string,
  tradeAmount: number,
  updatedProbabilities: Record<string, number>,
): void {
  // Increment pool for the traded outcome
  db.prepare(`
    UPDATE market_outcomes
    SET pool_amount = pool_amount + ?
    WHERE market_id = ? AND label = ?
  `).run(tradeAmount, marketId, tradedOption);

  // Update probability decimals for all outcomes from the shifted probabilities
  const outcomes = db.prepare(
    'SELECT id, label FROM market_outcomes WHERE market_id = ?',
  ).all(marketId) as { id: number; label: string }[];

  for (const outcome of outcomes) {
    const pct = updatedProbabilities[outcome.label] ?? 0;
    db.prepare(
      'UPDATE market_outcomes SET probability = ? WHERE id = ?',
    ).run(pct / 100, outcome.id);
  }
}
