// ─── OUTCOMX Price Feed Service ────────────────────────────────────────────────
//
// Wraps CoinGecko's free public API for live-price markets ("BTC Up or Down
// in 5 min?" style). Two operations:
//   fetchPrices  — batched current-price lookup, used by the scheduler tick
//   searchCoins  — coin lookup for the admin coin-picker
//
// No API key required for CoinGecko's public tier. Calls are batched (one
// request covers every tracked coin) and lightly cached so a busy scheduler
// tick never exceeds the free-tier rate limit.

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CACHE_TTL_MS = 10_000;

let priceCache: { data: Record<string, number>; fetchedAt: number } | null = null;

/**
 * Batched current-price lookup in USD. One HTTP call covers every id
 * passed, regardless of how many live-price markets are open.
 */
export async function fetchPrices(coinIds: string[]): Promise<Record<string, number>> {
  const uniqueIds = Array.from(new Set(coinIds)).filter(Boolean);
  if (uniqueIds.length === 0) return {};

  if (priceCache && Date.now() - priceCache.fetchedAt < CACHE_TTL_MS) {
    if (uniqueIds.every(id => id in priceCache!.data)) return priceCache.data;
  }

  const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(uniqueIds.join(','))}&vs_currencies=usd`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CoinGecko price fetch failed: HTTP ${res.status}`);
  }

  const json = await res.json() as Record<string, { usd?: number }>;
  const prices: Record<string, number> = {};
  for (const id of uniqueIds) {
    const usd = json[id]?.usd;
    if (typeof usd === 'number') prices[id] = usd;
  }

  priceCache = { data: prices, fetchedAt: Date.now() };
  return prices;
}

/** Single-coin convenience wrapper — used at market creation time. */
export async function fetchPrice(coinId: string): Promise<number | null> {
  const prices = await fetchPrices([coinId]);
  return prices[coinId] ?? null;
}

export interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
}

/** Coin lookup for the admin coin-picker — avoids typo'd/invalid ids reaching market creation. */
export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const url = `${COINGECKO_BASE}/search?query=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CoinGecko search failed: HTTP ${res.status}`);
  }

  const json = await res.json() as { coins?: { id: string; symbol: string; name: string }[] };
  return (json.coins ?? []).slice(0, 15).map(c => ({
    id:     c.id,
    symbol: c.symbol.toUpperCase(),
    name:   c.name,
  }));
}
