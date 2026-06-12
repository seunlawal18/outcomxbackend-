// ── OUTCOMX API Client ────────────────────────────────────────────
// Connects the Next.js frontend to the Express backend at localhost:4000
// All requests automatically attach the JWT token from localStorage.
// Falls back gracefully if the backend is unreachable.

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY       = "outcomx_token";
const ADMIN_TOKEN_KEY = "outcomx_admin_token";

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

// ── Admin token helpers ───────────────────────────────────────────
export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}
export function setAdminToken(token: string): void {
  if (typeof window !== "undefined") localStorage.setItem(ADMIN_TOKEN_KEY, token);
}
export function clearAdminToken(): void {
  if (typeof window !== "undefined") localStorage.removeItem(ADMIN_TOKEN_KEY);
}

// ── Core fetch wrapper ────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const token = path.startsWith("/api/admin")
      ? (getAdminToken() ?? getToken())
      : getToken();

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });

    const json = await res.json();

    // If admin token is rejected, clear it so the UI redirects to login
    if (res.status === 401 && path.startsWith("/api/admin")) {
      clearAdminToken();
      // Dispatch a custom event so the layout can catch it and redirect
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("admin-token-expired"));
      }
    }

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

// ── Admin ─────────────────────────────────────────────────────────
export async function apiAdminGetMarkets(params?: { search?: string; status?: string; category?: string }) {
  const q = new URLSearchParams();
  if (params?.search)   q.set("search", params.search);
  if (params?.status)   q.set("status", params.status);
  if (params?.category) q.set("category", params.category);
  const qs = q.toString();
  return apiFetch<ApiMarket[]>(`/api/admin/markets${qs ? `?${qs}` : ""}`);
}

export async function apiAdminCreateMarket(data: {
  title: string; category: string; type: string;
  options: string[]; duration: string;
  image?: string; banner?: string;
  probabilities?: Record<string, number>;
  resolution_source?: string;
}) {
  return apiFetch<ApiMarket>("/api/admin/markets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiAdminUpdateMarket(id: number, updates: {
  title?: string; category?: string; image?: string;
  banner?: string; resolution_source?: string; status?: string;
}) {
  return apiFetch<ApiMarket>(`/api/admin/markets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function apiAdminDeleteMarket(id: number) {
  return apiFetch(`/api/admin/markets/${id}`, { method: "DELETE" });
}

export async function apiAdminToggleMarket(id: number) {
  return apiFetch<ApiMarket>(`/api/admin/markets/${id}/toggle`, { method: "PATCH" });
}

export async function apiAdminResolveMarket(id: number, result: string) {
  return apiFetch<{
    market:        ApiMarket;
    settledTrades: number;
    settlement:    SettlementBreakdown;
  }>(
    `/api/admin/resolve/${id}`,
    { method: "PATCH", body: JSON.stringify({ result }) }
  );
}

export async function apiAdminGetStats() {
  return apiFetch<{
    totalMarkets: number; openMarkets: number; settledMarkets: number;
    totalTrades: number; activeTrades: number; totalVolume: number; totalUsers: number;
  }>("/api/admin/stats");
}

export async function apiAdminGetIncome() {
  return apiFetch<{
    totalIncome: number;
    settledMarkets: number;
    recentSettlements: {
      id: number; title: string;
      platformFee: number; prizePool: number;
      volume: number; result: string | null;
      createdAt: string;
    }[];
  }>("/api/admin/income");
}

export async function apiAdminGetUsers() {
  return apiFetch<ApiUser[]>("/api/admin/users");
}

export async function apiAdminLogin(email: string, password: string) {
  const res = await apiFetch<{ token: string; user: ApiUser }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
  if (res.ok && res.data) {
    if (!res.data.user.isAdmin) return { ok: false, error: "Not an admin account." };
    // Store in the ADMIN token key — separate from the user token
    setAdminToken(res.data.token);
  }
  return res;
}

// Validates the stored admin token against the backend
// Returns the user if valid and is admin, null otherwise
export async function apiValidateAdminToken(): Promise<ApiUser | null> {
  const token = getAdminToken();
  if (!token) return null;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const user = json.data as ApiUser;
    return user?.isAdmin ? user : null;
  } catch {
    return null;
  }
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

export interface SettlementBreakdown {
  totalPool:       number;
  platformFee:     number;
  platformFeeRate: number;
  prizePool:       number;
  winningOutcome:  string;
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
  timestamp: string;
}

export interface ApiPriceHistory {
  probabilities: Record<string, number>;
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
