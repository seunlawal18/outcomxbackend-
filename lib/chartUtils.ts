import { parseApiDate } from "./types";

// ── Shared chart data helpers ───────────────────────────────────────
// Used by both ProbabilityChart (internal % history) and LivePriceChart
// (external asset $ history) so the two chart types behave identically
// for timeframe zoom and "stay live" continuity.

export interface HistoryPoint {
  recordedAt: string;
}

export const TIMEFRAMES = ["1H", "6H", "1D", "1W", "1M", "ALL"] as const;
export type Timeframe = typeof TIMEFRAMES[number];

const WINDOW_MS: Record<Timeframe, number> = {
  "1H":  60 * 60 * 1000,
  "6H":  6 * 60 * 60 * 1000,
  "1D":  24 * 60 * 60 * 1000,
  "1W":  7 * 24 * 60 * 60 * 1000,
  "1M":  30 * 24 * 60 * 60 * 1000,
  "ALL": 0,
};

// Aggregation granularity per timeframe. 0 = raw ticks, no bucketing.
// Short windows show every real point; wide windows bucket down so a
// year of data still renders as a clean, readable line (matches how
// Polymarket's MAX view looks) instead of thousands of raw points.
const BUCKET_MS: Record<Timeframe, number> = {
  "1H":  0,
  "6H":  0,
  "1D":  60 * 60 * 1000,        // hourly
  "1W":  60 * 60 * 1000,        // hourly
  "1M":  24 * 60 * 60 * 1000,   // daily
  "ALL": 24 * 60 * 60 * 1000,   // daily
};

/**
 * Filters to the selected time window, then buckets down to one point
 * per bucket (keeping the last real value in each bucket) for wider
 * timeframes. Always returns at least 2 points when the source has them,
 * so a line can render.
 */
export function bucketHistory<T extends HistoryPoint>(history: T[], tf: Timeframe): T[] {
  if (history.length === 0) return history;

  const cutoff = tf === "ALL" ? 0 : Date.now() - WINDOW_MS[tf];
  const inWindow = history.filter(h => parseApiDate(h.recordedAt).getTime() >= cutoff);
  const windowed = inWindow.length >= 2 ? inWindow : history.slice(-2);

  const bucketMs = BUCKET_MS[tf];
  if (bucketMs === 0) return windowed;

  const buckets = new Map<number, T>();
  for (const point of windowed) {
    const key = Math.floor(parseApiDate(point.recordedAt).getTime() / bucketMs);
    buckets.set(key, point); // later point in the same bucket wins — last value per bucket
  }

  const bucketed = Array.from(buckets.values()).sort(
    (a, b) => parseApiDate(a.recordedAt).getTime() - parseApiDate(b.recordedAt).getTime(),
  );
  return bucketed.length >= 2 ? bucketed : windowed;
}

/**
 * Appends a synthetic point at "now" carrying the last known values, so
 * the line always draws forward to the current time instead of stopping
 * at the last real trade/tick. Skips if the last point is already recent
 * enough that a new point wouldn't be visually meaningful.
 */
export function extendHistoryToNow<T extends HistoryPoint>(history: T[]): T[] {
  if (history.length === 0) return history;
  const last = history[history.length - 1];
  const gap = Date.now() - parseApiDate(last.recordedAt).getTime();
  if (gap < 5_000) return history;
  return [...history, { ...last, recordedAt: new Date().toISOString() }];
}

export function fmtChartLabel(ts: number, tf: Timeframe): string {
  const d = new Date(ts);
  if (tf === "1M" || tf === "ALL") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (tf === "1W") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}
