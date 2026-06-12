// ─── Raw DB row types ─────────────────────────────────────────────────────────

export interface DbUser {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  username: string;
  region: string;
  balance: number;
  is_admin: number;
  is_demo: number;
  is_verified: number;
  bio: string;
  avatar: string;
  joined_at: string;
  created_at: string;
}

export interface DbMarket {
  id: number;
  title: string;
  category: string;
  type: string;
  options: string;           // JSON array of outcome labels
  status: string;
  result: string | null;
  volume: number;
  probabilities: string;     // JSON object { label: pct (0-100) }
  duration: string;
  expires_at: string;
  image: string | null;
  banner: string | null;
  resolution_source: string | null;
  platform_fee: number | null;  // 3% of total pool, set at settlement
  prize_pool: number | null;    // 97% of total pool, set at settlement
  trending: number;
  created_at: string;
}

export interface DbMarketOutcome {
  id: number;
  market_id: number;
  label: string;
  probability: number;   // decimal 0.00–1.00
  pool_amount: number;   // total staked on this outcome
  created_at: string;
}

export interface DbTrade {
  id: number;
  user_id: number;
  market_id: number;
  market_title: string;
  option: string;
  amount: number;
  status: string;
  payout_amount: number | null;
  locked_payout: number | null;
  timestamp: string;
}

export interface DbPriceHistory {
  id: number;
  market_id: number;
  probabilities: string; // JSON
  yes_price: number | null;
  no_price: number | null;
  trade_volume: number;
  recorded_at: string;
}

// ─── API response types (camelCase, no password_hash) ─────────────────────────

export interface ApiUser {
  id: number;
  email: string;
  name: string;
  username: string;
  region: string;
  balance: number;
  isAdmin: boolean;
  isDemo: boolean;
  isVerified: boolean;
  bio: string;
  avatar: string;
  joinedAt: string;
}

export interface ApiMarketOutcome {
  id: number;
  marketId: number;
  label: string;
  probability: number;   // decimal 0.00–1.00
  poolAmount: number;
  createdAt: string;
}

export interface ApiMarket {
  id: number;
  title: string;
  category: string;
  type: string;
  options: string[];
  status: string;
  result: string | null;
  volume: number;
  probabilities: Record<string, number>;
  duration: string;
  expiresAt: string;
  image: string | null;
  banner: string | null;
  resolutionSource: string | null;
  platformFee: number | null;   // 3% of total pool — null until settled
  prizePool: number | null;     // 97% of total pool — null until settled
  trending: boolean;
  createdAt: string;
  outcomes?: ApiMarketOutcome[];
}

export interface ApiTrade {
  id: number;
  marketId: number;
  marketTitle: string;
  option: string;
  amount: number;
  status: string;
  payoutAmount: number | null;
  lockedPayout?: number | null;
  timestamp: string;
}

export interface ApiPricePoint {
  probabilities: Record<string, number>;
  yesPrice: number | null;
  noPrice: number | null;
  tradeVolume: number;
  recordedAt: string;
}

// ─── Helper converters ────────────────────────────────────────────────────────

export function toApiUser(row: DbUser): ApiUser {
  return {
    id:         row.id,
    email:      row.email,
    name:       row.name,
    username:   row.username,
    region:     row.region,
    balance:    row.balance,
    isAdmin:    row.is_admin    === 1,
    isDemo:     row.is_demo     === 1,
    isVerified: row.is_verified === 1,
    bio:        row.bio,
    avatar:     row.avatar,
    joinedAt:   row.joined_at,
  };
}

export function toApiMarket(row: DbMarket, outcomes?: DbMarketOutcome[]): ApiMarket {
  return {
    id:               row.id,
    title:            row.title,
    category:         row.category,
    type:             row.type,
    options:          JSON.parse(row.options) as string[],
    status:           row.status,
    result:           row.result,
    volume:           row.volume,
    probabilities:    JSON.parse(row.probabilities) as Record<string, number>,
    duration:         row.duration,
    expiresAt:        row.expires_at,
    image:            row.image,
    banner:           row.banner,
    resolutionSource: row.resolution_source,
    platformFee:      row.platform_fee ?? null,
    prizePool:        row.prize_pool   ?? null,
    trending:         row.trending === 1,
    createdAt:        row.created_at,
    outcomes:         outcomes?.map(toApiMarketOutcome),
  };
}

export function toApiMarketOutcome(row: DbMarketOutcome): ApiMarketOutcome {
  return {
    id:          row.id,
    marketId:    row.market_id,
    label:       row.label,
    probability: row.probability,
    poolAmount:  row.pool_amount,
    createdAt:   row.created_at,
  };
}

export function toApiTrade(row: DbTrade): ApiTrade {
  return {
    id:           row.id,
    marketId:     row.market_id,
    marketTitle:  row.market_title,
    option:       row.option,
    amount:       row.amount,
    status:       row.status,
    payoutAmount: row.payout_amount ?? null,
    lockedPayout: row.locked_payout ?? null,
    timestamp:    row.timestamp,
  };
}

export function toApiPricePoint(row: DbPriceHistory): ApiPricePoint {
  return {
    probabilities: JSON.parse(row.probabilities) as Record<string, number>,
    yesPrice:      row.yes_price,
    noPrice:       row.no_price,
    tradeVolume:   row.trade_volume,
    recordedAt:    row.recorded_at,
  };
}

// ─── Express augmentation ─────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: ApiUser;
    }
  }
}
