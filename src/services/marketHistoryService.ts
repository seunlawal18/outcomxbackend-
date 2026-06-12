import db from '../db/client';
import { DbPriceHistory, ApiPricePoint, toApiPricePoint } from '../types';

// ─── Price helpers ────────────────────────────────────────────────────────────

/**
 * Convert a probability percentage (0–100) to a decimal price (0.00–1.00).
 * Mirrors Polymarket: 55% probability = $0.55 price.
 */
export function probToPrice(pct: number): number {
  return Math.round((pct / 100) * 100) / 100;
}

/**
 * Derive yes_price and no_price from a probabilities object.
 *
 * NO hardcoded "Yes"/"No"/"Up"/"Down" keys.
 * Instead: yes_price = price of the FIRST option, no_price = price of the SECOND.
 * This works for all market types:
 *   YES_NO:   first="Yes",  second="No"
 *   UP_DOWN:  first="Up",   second="Down"
 *   MULTI:    first=Team A, second=Team B  (third+ options have no convenience field)
 *
 * For single-option markets (shouldn't exist but guard anyway): both null.
 */
export function extractBinaryPrices(
  probabilities: Record<string, number>,
  options: string[],
): { yes_price: number | null; no_price: number | null } {
  if (options.length < 2) return { yes_price: null, no_price: null };

  const firstLabel  = options[0];
  const secondLabel = options[1];

  return {
    yes_price: probToPrice(probabilities[firstLabel]  ?? 50),
    no_price:  probToPrice(probabilities[secondLabel] ?? 50),
  };
}

// ─── Insert a snapshot ────────────────────────────────────────────────────────

/**
 * Insert one price history row.
 * Must be called INSIDE an existing transaction (from tradeService).
 */
export function insertPriceSnapshot(
  marketId: number,
  options: string[],
  probabilities: Record<string, number>,
  tradeVolume: number,
): void {
  const { yes_price, no_price } = extractBinaryPrices(probabilities, options);

  db.prepare(`
    INSERT INTO market_price_history
      (market_id, probabilities, yes_price, no_price, trade_volume)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    marketId,
    JSON.stringify(probabilities),
    yes_price,
    no_price,
    tradeVolume,
  );
}

/**
 * Seed the opening price snapshot for a market at creation time (volume = 0).
 */
export function seedInitialSnapshot(
  marketId: number,
  options: string[],
  probabilities: Record<string, number>,
): void {
  insertPriceSnapshot(marketId, options, probabilities, 0);
}

// ─── Read history ─────────────────────────────────────────────────────────────

/**
 * Get the full price history for a market, oldest first.
 * Default limit 200, max 1000.
 */
export function getMarketHistory(
  marketId: number,
  limit = 200,
): ApiPricePoint[] {
  const safeLimit = Math.min(limit, 1000);

  const rows = db.prepare(`
    SELECT *
    FROM market_price_history
    WHERE market_id = ?
    ORDER BY recorded_at ASC, id ASC
    LIMIT ?
  `).all(marketId, safeLimit) as DbPriceHistory[];

  return rows.map(toApiPricePoint);
}

/**
 * Get the latest price point for a market (for live display).
 */
export function getLatestPrice(marketId: number): ApiPricePoint | null {
  const row = db.prepare(`
    SELECT *
    FROM market_price_history
    WHERE market_id = ?
    ORDER BY recorded_at DESC, id DESC
    LIMIT 1
  `).get(marketId) as DbPriceHistory | undefined;

  return row ? toApiPricePoint(row) : null;
}

/**
 * Create a manual snapshot for all open markets.
 * Useful for periodic snapshots (cron job) to fill gaps when no trades occur.
 */
export function createMarketHistorySnapshot(): void {
  const markets = db.prepare(`
    SELECT id, options, probabilities
    FROM markets
    WHERE status = 'open'
  `).all() as { id: number; options: string; probabilities: string }[];

  const insert = db.prepare(`
    INSERT INTO market_price_history
      (market_id, probabilities, yes_price, no_price, trade_volume)
    VALUES (?, ?, ?, ?, 0)
  `);

  db.transaction(() => {
    for (const m of markets) {
      const opts  = JSON.parse(m.options)  as string[];
      const probs = JSON.parse(m.probabilities) as Record<string, number>;
      const { yes_price, no_price } = extractBinaryPrices(probs, opts);
      insert.run(m.id, m.probabilities, yes_price, no_price);
    }
  })();
}
