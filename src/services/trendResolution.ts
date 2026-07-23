// ─── OUTCOMX Trend Resolution ─────────────────────────────────────────────────
//
// Resolution rule for live-price (crypto) markets — applies ONLY to markets
// with price_asset_id set; all other market types are resolved manually.
//
// Rule (as specified):
//   1. Close above the last significant high  → "up"   (pump / breakout)
//   2. Close below the last significant low   → "down" (dump / breakdown)
//   3. Close inside the range (consolidation) → the last clear trend before
//      the consolidation. No new trend is counted until a breakout.
//
// "Significant" is defined with a ZigZag pivot model — the standard way
// trading systems separate real swings from noise:
//   • A swing high/low only becomes a confirmed pivot once price reverses
//     away from it by at least REVERSAL_FRACTION of the market's observed
//     price range. Small consolidation wiggles never form pivots, so they
//     can never flip the trend — exactly the "no new trend until breakout"
//     requirement.
//   • Trend = market structure over pivots: a pivot high above the previous
//     pivot high → uptrend; a pivot low below the previous pivot low →
//     downtrend. If no such comparison exists, the direction of the last
//     completed zigzag leg (the move between the final two pivots) is used.
//   • Fallback: flat/short series with no pivots resolves close-vs-open;
//     a tie resolves "down" (the platform's existing tie rule).
//
// This is a pure function over the recorded tick series, so any settlement
// can be re-derived from market_price_history after the fact (auditable).

const REVERSAL_FRACTION = 0.3; // pivot confirmation: 30% of observed range

export type Direction = 'up' | 'down';

export interface TrendResolution {
  direction: Direction;
  reason: string; // human-readable audit trail, logged at settlement
}

interface Pivot {
  price: number;
  kind: 'high' | 'low';
}

export function resolveTrendDirection(
  prices: number[],
  openingPrice: number,
): TrendResolution {
  const close = prices[prices.length - 1];

  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const range = max - min;

  // Flat or near-flat series — nothing to analyse
  if (prices.length < 3 || range === 0) {
    return {
      direction: close > openingPrice ? 'up' : 'down',
      reason: `flat/short series — resolved close ${close} vs open ${openingPrice}`,
    };
  }

  const threshold = range * REVERSAL_FRACTION;

  // ── ZigZag pivot detection ────────────────────────────────────────────
  const pivots: Pivot[] = [];
  let dir: Direction | null = null;
  // Undecided phase: track both running extremes until price commits
  let runMax = prices[0];
  let runMin = prices[0];
  let ext = prices[0]; // current leg extreme once direction is known

  for (let i = 1; i < prices.length; i++) {
    const p = prices[i];
    if (dir === null) {
      if (p > runMax) runMax = p;
      if (p < runMin) runMin = p;
      if (p >= runMin + threshold) {
        pivots.push({ price: runMin, kind: 'low' });
        dir = 'up';
        ext = p;
      } else if (p <= runMax - threshold) {
        pivots.push({ price: runMax, kind: 'high' });
        dir = 'down';
        ext = p;
      }
    } else if (dir === 'up') {
      if (p > ext) ext = p;
      else if (p <= ext - threshold) {
        pivots.push({ price: ext, kind: 'high' });
        dir = 'down';
        ext = p;
      }
    } else {
      if (p < ext) ext = p;
      else if (p >= ext + threshold) {
        pivots.push({ price: ext, kind: 'low' });
        dir = 'up';
        ext = p;
      }
    }
  }

  // ── Trend from pivot structure ────────────────────────────────────────
  // Higher pivot-high → uptrend event; lower pivot-low → downtrend event.
  // The most recent event is the "last clear trend".
  let trend: Direction | null = null;
  let lastHighSeen: number | undefined;
  let lastLowSeen: number | undefined;
  for (const pv of pivots) {
    if (pv.kind === 'high') {
      if (lastHighSeen !== undefined && pv.price > lastHighSeen) trend = 'up';
      lastHighSeen = pv.price;
    } else {
      if (lastLowSeen !== undefined && pv.price < lastLowSeen) trend = 'down';
      lastLowSeen = pv.price;
    }
  }
  // No higher-high / lower-low comparison available — use the direction of
  // the last completed zigzag leg (the move between the final two pivots).
  if (trend === null && pivots.length >= 2) {
    const a = pivots[pivots.length - 2];
    const b = pivots[pivots.length - 1];
    trend = b.price > a.price ? 'up' : 'down';
  }

  const lastHigh = [...pivots].reverse().find(p => p.kind === 'high')?.price;
  const lastLow  = [...pivots].reverse().find(p => p.kind === 'low')?.price;

  // ── Resolution ────────────────────────────────────────────────────────
  if (lastHigh !== undefined && close > lastHigh) {
    return { direction: 'up', reason: `close ${close} broke above last significant high ${lastHigh}` };
  }
  if (lastLow !== undefined && close < lastLow) {
    return { direction: 'down', reason: `close ${close} broke below last significant low ${lastLow}` };
  }
  if (trend !== null) {
    return {
      direction: trend,
      reason: `close ${close} inside range (sig. high ${lastHigh ?? 'n/a'} / sig. low ${lastLow ?? 'n/a'}) — last clear trend was ${trend}`,
    };
  }
  return {
    direction: close > openingPrice ? 'up' : 'down',
    reason: `no significant swings formed — resolved close ${close} vs open ${openingPrice}`,
  };
}
