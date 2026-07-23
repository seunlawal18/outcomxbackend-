import { Market, MarketDuration, calcExpiresAt } from "./types";

// Helper: create expiresAt relative to "now" so countdowns are always live
function exp(duration: MarketDuration, offsetHours = 0): string {
  const base = Date.now() + offsetHours * 60 * 60 * 1000;
  const from = new Date(base).toISOString();
  return calcExpiresAt(duration, from);
}

// Today and yesterday for "New" tab
const today     = new Date().toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

export const mockMarkets: Market[] = [
  {
    id: 1,
    title: "Arsenal vs Newcastle — Who wins?",
    category: "sports",
    type: "MULTI",
    options: ["Arsenal", "Draw", "Newcastle"],
    status: "open",
    result: null,
    volume: 381_800_000,
    createdAt: "2026-04-20",
    probabilities: { Arsenal: 55, Draw: 25, Newcastle: 20 },
    trending: true,
    duration: "daily",
    expiresAt: exp("daily", 6),
  },
  {
    id: 2,
    title: "BTC Up or Down in 5 Min?",
    category: "crypto",
    type: "UP_DOWN",
    options: ["Up", "Down"],
    status: "open",
    result: null,
    volume: 26000000,
    createdAt: today,
    probabilities: { Up: 49, Down: 51 },
    trending: true,
    duration: "5min",
    expiresAt: exp("5min", 0),
  },
  {
    id: 3,
    title: "Will Democrats sweep the 2026 Midterms?",
    category: "politics",
    type: "YES_NO",
    options: ["Yes", "No"],
    status: "open",
    result: null,
    volume: 6000000,
    createdAt: "2026-04-10",
    probabilities: { Yes: 50, No: 50 },
    trending: true,
    duration: "monthly",
    expiresAt: exp("monthly", 0),
  },
  {
    id: 4,
    title: "Fed Decision in July — No Change?",
    category: "economy",
    type: "YES_NO",
    options: ["Yes", "No"],
    status: "open",
    result: null,
    volume: 4000000,
    createdAt: "2026-04-15",
    probabilities: { Yes: 85, No: 15 },
    trending: false,
    duration: "weekly",
    expiresAt: exp("weekly", 12),
  },
  {
    id: 5,
    title: "Will MicroStrategy announce a BTC purchase April 28?",
    category: "crypto",
    type: "YES_NO",
    options: ["Yes", "No"],
    status: "open",
    result: null,
    volume: 84000,
    createdAt: today,
    probabilities: { Yes: 77, No: 23 },
    trending: true,
    duration: "15min",
    expiresAt: exp("15min", 0),
  },
  {
    id: 6,
    title: "Largest Company end of May 2026?",
    category: "finance",
    type: "MULTI",
    options: ["NVIDIA", "Apple", "Alphabet", "Microsoft"],
    status: "open",
    result: null,
    volume: 161000,
    createdAt: "2026-04-18",
    probabilities: { NVIDIA: 97, Apple: 1, Alphabet: 1, Microsoft: 1 },
    trending: false,
    duration: "monthly",
    expiresAt: exp("monthly", 24),
  },
  {
    id: 7,
    title: "T1 vs Team Liquid — Who wins Worlds?",
    category: "esports",
    type: "MULTI",
    options: ["T1", "Team Liquid", "Other"],
    status: "open",
    result: null,
    volume: 520000,
    createdAt: "2026-04-22",
    probabilities: { T1: 62, "Team Liquid": 28, Other: 10 },
    trending: true,
    duration: "weekly",
    expiresAt: exp("weekly", 48),
  },
  {
    id: 8,
    title: "Will Ethereum hit $2,600 in April?",
    category: "crypto",
    type: "YES_NO",
    options: ["Yes", "No"],
    status: "open",
    result: null,
    volume: 840000,
    createdAt: "2026-04-20",
    probabilities: { Yes: 3, No: 97 },
    trending: false,
    duration: "1hour",
    expiresAt: exp("1hour", 0),
  },
  {
    id: 9,
    title: "Will Avengers: Doomsday break $1B opening weekend?",
    category: "entertainment",
    type: "YES_NO",
    options: ["Yes", "No"],
    status: "open",
    result: null,
    volume: 230000,
    createdAt: "2026-04-21",
    probabilities: { Yes: 68, No: 32 },
    trending: true,
    duration: "weekly",
    expiresAt: exp("weekly", 72),
  },
  {
    id: 10,
    title: "ECB Interest Rates April 2026 — No Change?",
    category: "economy",
    type: "YES_NO",
    options: ["Yes", "No"],
    status: "open",
    result: null,
    volume: 840000,
    createdAt: "2026-04-19",
    probabilities: { Yes: 98, No: 2 },
    trending: false,
    duration: "monthly",
    expiresAt: exp("monthly", 48),
  },
  {
    id: 11,
    title: "Man City vs Real Madrid — Champions League Final",
    category: "sports",
    type: "MULTI",
    options: ["Man City", "Draw", "Real Madrid"],
    status: "open",
    result: null,
    volume: 1200000,
    createdAt: yesterday,
    probabilities: { "Man City": 45, Draw: 22, "Real Madrid": 33 },
    trending: true,
    duration: "4hours",
    expiresAt: exp("4hours", 2),
  },
  {
    id: 12,
    title: "Will inflation drop below 3% by June 2026?",
    category: "economy",
    type: "YES_NO",
    options: ["Yes", "No"],
    status: "open",
    result: null,
    volume: 3200000,
    createdAt: "2026-04-17",
    probabilities: { Yes: 42, No: 58 },
    trending: false,
    duration: "yearly",
    expiresAt: exp("yearly", 0),
  },
  {
    id: 13,
    title: "Will Pro Football OBJ sign with a team in 2026?",
    category: "sports",
    type: "YES_NO",
    options: ["Yes", "No"],
    status: "closed",
    result: null,
    volume: 44000,
    createdAt: "2026-04-14",
    probabilities: { Yes: 44, No: 56 },
    trending: false,
    duration: "weekly",
    expiresAt: exp("weekly", -24),
  },
  {
    id: 14,
    title: "Bank of Brazil Decision in April — Decrease?",
    category: "finance",
    type: "YES_NO",
    options: ["Yes", "No"],
    status: "settled",
    result: "Yes",
    volume: 383000,
    createdAt: "2026-04-12",
    probabilities: { Yes: 96, No: 4 },
    trending: false,
    duration: "monthly",
    expiresAt: exp("monthly", -48),
  },
  {
    id: 15,
    title: "Valorant Champions 2026 — Sentinels win?",
    category: "esports",
    type: "YES_NO",
    options: ["Yes", "No"],
    status: "open",
    result: null,
    volume: 190000,
    createdAt: yesterday,
    probabilities: { Yes: 38, No: 62 },
    trending: false,
    duration: "weekly",
    expiresAt: exp("weekly", 96),
  },
];

export const generateChartData = (marketId: number) => {
  const seed = marketId * 13;
  const points = 30;
  const data: number[] = [];
  let val = 40 + (seed % 30);
  for (let i = 0; i < points; i++) {
    val += (Math.random() - 0.48) * 5;
    val = Math.max(5, Math.min(95, val));
    data.push(Math.round(val));
  }
  return {
    labels: Array.from({ length: points }, (_, i) => {
      const d = new Date("2026-04-01");
      d.setDate(d.getDate() + i);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }),
    data,
  };
};

/**
 * Generates detailed simulated chart data with many micro-movements per option.
 * Uses a seeded pseudo-random walk so it's deterministic per market.
 * Each option line starts near its current probability and wanders realistically.
 */
export const generateDetailedChartData = (
  marketId: number,
  options: string[],
  probabilities: Record<string, number>
): { labels: string[]; datasets: Record<string, number[]> } => {
  const POINTS = 120; // lots of ticks = dense, detailed chart
  const now = Date.now();
  const windowMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  const stepMs = windowMs / POINTS;

  // Seeded pseudo-random using a simple LCG so output is stable per marketId
  let seed = marketId * 9301 + 49297;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const labels = Array.from({ length: POINTS }, (_, i) => {
    const ts = now - windowMs + i * stepMs;
    const d = new Date(ts);
    if (i % 24 === 0) {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  });

  const datasets: Record<string, number[]> = {};

  options.slice(0, 4).forEach((opt) => {
    const target = probabilities[opt] ?? 50;
    // Start further from the target so the walk is interesting
    const startOffset = (rand() - 0.5) * 20;
    let val = Math.max(5, Math.min(95, target + startOffset));

    const data: number[] = [];
    for (let i = 0; i < POINTS; i++) {
      // Mean-revert gently toward the current target over time
      const progress = i / POINTS;
      const pull = (target - val) * 0.03 * progress;
      // Random noise: small frequent ticks + occasional larger jumps
      const noise = (rand() - 0.5) * 4;
      const spike = rand() > 0.93 ? (rand() - 0.5) * 10 : 0; // ~7% chance of a spike
      val += pull + noise + spike;
      val = Math.max(2, Math.min(98, val));
      data.push(parseFloat(val.toFixed(1)));
    }
    // Nail the last point to the actual current probability
    data[POINTS - 1] = target;
    datasets[opt] = data;
  });

  return { labels, datasets };
};
