// ─── OUTCOMX Price Tick Service ────────────────────────────────────────────────
//
// Scheduled every 15s from index.ts. For every open live-price market:
//   1. Records a real price snapshot (market_price_history.asset_price)
//   2. If the market has just expired, auto-resolves it using trend-based
//      resolution (see trendResolution.ts) over the full recorded tick
//      series, then settles through the exact same settleMarket() path
//      admin-triggered resolution uses.
//
// Kept as its own file (rather than living in marketHistoryService.ts) to
// avoid a circular import — tradeService already depends on
// marketHistoryService, so marketHistoryService cannot depend back on
// tradeService for settleMarket.

import db from '../db/client';
import { getOpenLivePriceMarkets, insertPriceSnapshot, getAssetPriceSeries, getLatestPrice } from './marketHistoryService';
import { fetchPrices } from './priceFeedService';
import { settleMarket } from './tradeService';
import { resolveTrendDirection } from './trendResolution';
import { emitter } from '../events';

export async function runPriceTick(): Promise<void> {
  const markets = await getOpenLivePriceMarkets();
  if (markets.length === 0) return;

  const coinIds = markets.map(m => m.price_asset_id);

  let prices: Record<string, number>;
  try {
    prices = await fetchPrices(coinIds);
  } catch (err) {
    console.error('Price tick: fetch failed, skipping this tick:', (err as Error).message);
    return;
  }

  for (const market of markets) {
    const price = prices[market.price_asset_id];
    if (price === undefined) continue; // this coin didn't resolve this tick — try again next tick

    const options = JSON.parse(market.options) as string[];

    // Read the live (trade-driven) probabilities rather than assuming — the
    // price tick never changes odds, it only records the real asset price
    // alongside whatever the current odds already are.
    const row = await db.prepare<{ probabilities: string }>('SELECT probabilities FROM markets WHERE id = ?').get(market.id);
    if (!row) continue;
    const probabilities = JSON.parse(row.probabilities) as Record<string, number>;

    await insertPriceSnapshot(db, market.id, options, probabilities, 0, price);

    // Push the new tick straight to clients watching this market's chart —
    // replaces the frontend's 5s history poll (see LivePriceChart.tsx).
    const pricePoint = await getLatestPrice(market.id);
    if (pricePoint) emitter.priceTick({ marketId: market.id, pricePoint });

    // ── Auto-resolve if this market has just expired ─────────────────────
    if (market.opening_price === null || market.is_expired !== 1) continue;

    // Trend-based resolution over the full recorded tick series (the
    // snapshot inserted above is the close). Up/Down markets always store
    // options as ["Up", "Down"] (enforced at creation).
    const series = await getAssetPriceSeries(market.id);
    const { direction, reason } = resolveTrendDirection(
      series.length > 0 ? series : [market.opening_price, price],
      market.opening_price,
    );
    const result = direction === 'up' ? options[0] : options[1];

    try {
      await settleMarket(market.id, result);
      console.log(
        `✓ Auto-resolved market ${market.id} (${market.price_asset_id}): ${result} — ${reason}`,
      );
    } catch (err) {
      console.error(`Price tick: auto-resolve failed for market ${market.id}:`, (err as Error).message);
    }
  }
}
