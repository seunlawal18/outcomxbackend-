import db, { TxDb } from '../db/client';
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
 * `conn` must be the same tx the caller is already inside (tradeService,
 * admin market creation), or the plain pooled `db` when called standalone
 * (priceTickService's scheduler, which isn't wrapped in a transaction).
 * assetPrice is only meaningful for live-price markets (markets.price_asset_id
 * set) — pass the real fetched price for those, omit otherwise.
 */
export async function insertPriceSnapshot(
  conn: TxDb,
  marketId: number,
  options: string[],
  probabilities: Record<string, number>,
  tradeVolume: number,
  assetPrice?: number | null,
): Promise<void> {
  const { yes_price, no_price } = extractBinaryPrices(probabilities, options);

  await conn.prepare(`
    INSERT INTO market_price_history
      (market_id, probabilities, yes_price, no_price, trade_volume, asset_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    marketId,
    JSON.stringify(probabilities),
    yes_price,
    no_price,
    tradeVolume,
    assetPrice ?? null,
  );
}

/**
 * Seed the opening price snapshot for a market at creation time (volume = 0).
 * assetPrice is the real opening price for live-price markets.
 */
export async function seedInitialSnapshot(
  conn: TxDb,
  marketId: number,
  options: string[],
  probabilities: Record<string, number>,
  assetPrice?: number | null,
): Promise<void> {
  await insertPriceSnapshot(conn, marketId, options, probabilities, 0, assetPrice);
}

// ─── Live-price markets ─────────────────────────────────────────────────────

export interface LivePriceMarket {
  id: number;
  price_asset_id: string;
  opening_price: number | null;
  options: string;
  is_expired: number; // 0 or 1 — computed in SQL, cast to int (Postgres comparisons are native bool)
}

/**
 * Not-yet-settled markets configured with a real price feed — used by the
 * price-tick scheduler. Matches 'open' AND 'closed' (not just 'open'):
 * the lazy autoCloseExpiredMarkets() check (fires on any GET /api/markets
 * request) can flip a market to 'closed' the instant it expires, racing
 * ahead of the next 15s price tick — if this query only matched 'open',
 * a market that lost that race would never be picked up again and would
 * sit unresolved forever.
 */
export async function getOpenLivePriceMarkets(): Promise<LivePriceMarket[]> {
  return db.prepare<LivePriceMarket>(`
    SELECT id, price_asset_id, opening_price, options,
           (expires_at <= to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))::int as is_expired
    FROM markets
    WHERE status IN ('open', 'closed') AND price_asset_id IS NOT NULL
  `).all();
}

/**
 * Full recorded asset-price tick series for a live-price market, oldest
 * first — the input to trend-based resolution (see trendResolution.ts).
 */
export async function getAssetPriceSeries(marketId: number): Promise<number[]> {
  const rows = await db.prepare<{ asset_price: number }>(`
    SELECT asset_price
    FROM market_price_history
    WHERE market_id = ? AND asset_price IS NOT NULL
    ORDER BY recorded_at ASC, id ASC
  `).all(marketId);
  return rows.map(r => r.asset_price);
}

// ─── Read history ─────────────────────────────────────────────────────────────

/**
 * Get the full price history for a market, oldest first.
 * Default limit 200, max 1000.
 */
export async function getMarketHistory(
  marketId: number,
  limit = 200,
): Promise<ApiPricePoint[]> {
  const safeLimit = Math.min(limit, 1000);

  const rows = await db.prepare<DbPriceHistory>(`
    SELECT *
    FROM market_price_history
    WHERE market_id = ?
    ORDER BY recorded_at ASC, id ASC
    LIMIT ?
  `).all(marketId, safeLimit);

  return rows.map(toApiPricePoint);
}

/**
 * Get the latest price point for a market (for live display).
 */
export async function getLatestPrice(marketId: number): Promise<ApiPricePoint | null> {
  const row = await db.prepare<DbPriceHistory>(`
    SELECT *
    FROM market_price_history
    WHERE market_id = ?
    ORDER BY recorded_at DESC, id DESC
    LIMIT 1
  `).get(marketId);

  return row ? toApiPricePoint(row) : null;
}

/**
 * Create a manual snapshot for all open markets.
 * Useful for periodic snapshots (cron job) to fill gaps when no trades occur.
 */
export async function createMarketHistorySnapshot(): Promise<void> {
  const markets = await db.prepare<{ id: number; options: string; probabilities: string }>(`
    SELECT id, options, probabilities
    FROM markets
    WHERE status = 'open'
  `).all();

  await db.transaction(async (tx) => {
    for (const m of markets) {
      const opts  = JSON.parse(m.options)  as string[];
      const probs = JSON.parse(m.probabilities) as Record<string, number>;
      const { yes_price, no_price } = extractBinaryPrices(probs, opts);
      await tx.prepare(`
        INSERT INTO market_price_history
          (market_id, probabilities, yes_price, no_price, trade_volume)
        VALUES (?, ?, ?, ?, 0)
      `).run(m.id, m.probabilities, yes_price, no_price);
    }
  });
}
