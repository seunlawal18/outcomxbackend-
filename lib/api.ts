// ── OUTCOMX API Client ────────────────────────────────────────────
// Connects the Next.js frontend to the Express backend at localhost:4000
// All requests automatically attach the JWT token from localStorage.
// Falls back gracefully if the backend is unreachable.

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "outcomx_token";

// ── User token helpers ────────────────────────────────────────────
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

// ── Core fetch wrapper ────────────────────────────────────────────
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const token = getToken();

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });

    const json = await res.json();

    if (!res.ok) {
      return { ok: false, error: json.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, error: "Cannot connect to server. Using offline mode." };
  }
}

// ── Auth ──────────────────────────────────────────────────────────
export async function apiLogin(email: string, password: string) {
  const res = await apiFetch<{ token: string; user: ApiUser }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
  if (res.ok && res.data) setToken(res.data.token);
  return res;
}

export async function apiRegister(
  email: string, password: string, name: string, region: string
) {
  const res = await apiFetch<{ token: string; user: ApiUser }>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify({ email, password, name, region }) }
  );
  if (res.ok && res.data) setToken(res.data.token);
  return res;
}

// ── Wallet auth ───────────────────────────────────────────────────
export async function apiWalletNonce(address: string) {
  return apiFetch<{ message: string }>("/api/auth/wallet/nonce", {
    method: "POST",
    body: JSON.stringify({ address }),
  });
}

export async function apiWalletVerify(address: string, message: string, signature: string) {
  const res = await apiFetch<{ token: string; user: ApiUser }>(
    "/api/auth/wallet/verify",
    { method: "POST", body: JSON.stringify({ address, message, signature }) }
  );
  if (res.ok && res.data) setToken(res.data.token);
  return res;
}

export async function apiLogout() {
  await apiFetch("/api/auth/logout", { method: "POST" });
  clearToken();
}

export async function apiGetMe() {
  return apiFetch<ApiUser>("/api/auth/me");
}

export async function apiUpdateProfile(updates: Partial<ApiUser>) {
  return apiFetch<ApiUser>("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

// ── Markets ───────────────────────────────────────────────────────
export async function apiGetMarkets(params?: {
  category?: string;
  duration?: string;
  status?: string;
  search?: string;
  trending?: boolean;
  new?: boolean;
}) {
  const q = new URLSearchParams();
  if (params?.category && params.category !== "all") q.set("category", params.category);
  if (params?.duration && params.duration !== "all") q.set("duration", params.duration);
  if (params?.status)   q.set("status", params.status);
  if (params?.search)   q.set("search", params.search);
  if (params?.trending) q.set("trending", "true");
  if (params?.new)      q.set("new", "true");
  const qs = q.toString();
  return apiFetch<ApiMarket[]>(`/api/markets${qs ? `?${qs}` : ""}`);
}

export async function apiGetMarket(id: number) {
  return apiFetch<ApiMarket>(`/api/markets/${id}`);
}

// ── Trades ────────────────────────────────────────────────────────
export async function apiPlaceTrade(marketId: number, option: string, amount: number) {
  return apiFetch<{
    trade: ApiTrade;
    newBalance: number;
    updatedProbabilities: Record<string, number>;
  }>("/api/trades", {
    method: "POST",
    body: JSON.stringify({ marketId, option, amount }),
  });
}

export async function apiGetMyTrades() {
  return apiFetch<ApiTrade[]>("/api/trades/my");
}

// ── Wallet ────────────────────────────────────────────────────────
export async function apiGetBalance() {
  return apiFetch<{ balance: number; region: string }>("/api/wallet/balance");
}

export async function apiDeposit(amount: number) {
  return apiFetch<{ balance: number }>("/api/wallet/deposit", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

// Real crypto deposit address (Polygon, USDT/USDC) — distinct from the
// self-credit demo apiDeposit above. Creates one on first request.
export async function apiGetDepositAddress() {
  return apiFetch<{ address: string; chain: string }>("/api/wallet/deposit-address");
}

// ── Withdrawals ──────────────────────────────────────────────────
export interface ApiWithdrawalRequest {
  id: number;
  amount: number;
  destinationAddress: string;
  status: "pending" | "approved" | "rejected" | "completed";
  adminNote: string | null;
  txHash: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export async function apiRequestWithdrawal(amount: number, destinationAddress: string) {
  return apiFetch<{ id: number; amount: number; destinationAddress: string; status: string; createdAt: string }>(
    "/api/wallet/withdraw",
    { method: "POST", body: JSON.stringify({ amount, destinationAddress }) },
  );
}

export async function apiGetMyWithdrawals() {
  return apiFetch<ApiWithdrawalRequest[]>("/api/wallet/withdrawals");
}

// ── API Response Types (camelCase from backend) ───────────────────
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
  walletAddress: string | null;
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
  platformFee: number | null;
  prizePool: number | null;
  trending: boolean;
  priceAssetId: string | null;
  priceAssetSymbol: string | null;
  openingPrice: number | null;
  createdAt: string;
  outcomes: ApiMarketOutcome[];
}

export interface ApiMarketOutcome {
  id: number;
  marketId: number;
  label: string;
  probability: number;
  poolAmount: number;
  createdAt: string;
}

export interface ApiTrade {
  id: number;
  marketId: number;
  marketTitle: string;
  option: string;
  amount: number;
  status: 'active' | 'won' | 'lost';
  payoutAmount: number | null;
  lockedPayout?: number | null;
  /** When the trade was settled (won/lost) — null while still active */
  settledAt?: string | null;
  timestamp: string;
}

export interface ApiPriceHistory {
  probabilities: Record<string, number>;
  assetPrice?: number | null;
  recordedAt: string;
}

// ── Email verification ────────────────────────────────────────────
export async function apiVerifyEmail(code: string) {
  return apiFetch<ApiUser>("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function apiResendVerification() {
  return apiFetch("/api/auth/resend-verification", { method: "POST" });
}

// ── Market price history ──────────────────────────────────────────
export async function apiGetMarketHistory(id: number) {
  return apiFetch<ApiPriceHistory[]>(`/api/markets/${id}/history`);
}

// ── Market recent trades (public — anonymised) ────────────────────
export interface ApiMarketTrade {
  id: number;
  option: string;
  amount: number;
  status: string;
  timestamp: string;
  trader: string; // anonymised e.g. "joh***"
}

export async function apiGetMarketTrades(id: number) {
  return apiFetch<ApiMarketTrade[]>(`/api/markets/${id}/trades`);
}
