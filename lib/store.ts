import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Market, Trade, MarketCategory, MarketStatus, MarketDuration, UserProfile, calcExpiresAt } from "./types";
import { REGION_CURRENCIES, DEFAULT_REGION, Region } from "./currency";
import {
  apiLogin, apiRegister, apiLogout, apiGetMe,
  apiGetMarkets, apiPlaceTrade, apiGetMyTrades,
  apiDeposit, apiAdminLogin, apiAdminCreateMarket,
  apiAdminUpdateMarket, apiAdminDeleteMarket,
  apiAdminToggleMarket, apiAdminResolveMarket,
  apiAdminGetMarkets, apiUpdateProfile,
  clearToken, setToken, getToken,
  clearAdminToken, apiValidateAdminToken,
  ApiMarket, ApiTrade, ApiUser,
} from "./api";

// ── Demo credentials (kept for offline fallback) ──────────────────
export const DEMO_EMAIL    = "demo@outcomx.com";
export const DEMO_PASSWORD = "demo123";

// ── Convert API market → frontend Market type ─────────────────────
function toMarket(m: ApiMarket): Market {
  const poolAmounts: Record<string, number> = {};
  if (m.outcomes?.length) {
    m.outcomes.forEach(o => { poolAmounts[o.label] = o.poolAmount; });
  }
  return {
    id:               m.id,
    title:            m.title,
    category:         m.category as MarketCategory,
    type:             m.type as Market["type"],
    options:          m.options,
    status:           m.status as MarketStatus,
    result:           m.result,
    volume:           m.volume,
    createdAt:        m.createdAt,
    probabilities:    m.probabilities,
    trending:         m.trending,
    duration:         m.duration as MarketDuration,
    expiresAt:        m.expiresAt,
    image:            m.image ?? undefined,
    banner:           m.banner ?? undefined,
    resolutionSource: m.resolutionSource ?? undefined,
    platformFee:      m.platformFee ?? null,
    prizePool:        m.prizePool ?? null,
    poolAmounts:      Object.keys(poolAmounts).length ? poolAmounts : undefined,
  };
}

// ── Convert API trade → frontend Trade type ───────────────────────
function toTrade(t: ApiTrade): Trade {
  return {
    id:            t.id,
    marketId:      t.marketId,
    marketTitle:   t.marketTitle,
    option:        t.option,
    amount:        t.amount,
    timestamp:     t.timestamp,
    status:        t.status as Trade["status"],
    payoutAmount:  t.payoutAmount ?? undefined,
    lockedPayout:  t.lockedPayout ?? undefined,
  };
}

// ── Convert API user → UserProfile ───────────────────────────────
function toProfile(u: ApiUser): UserProfile {
  return {
    name:       u.name,
    username:   u.username,
    bio:        u.bio,
    avatar:     u.avatar,
    joinedAt:   u.joinedAt,
    region:     u.region,
    isVerified: u.isVerified,
  };
}

// ── Offline probability shift (used when backend unreachable) ─────
function shiftProbabilities(
  probs: Record<string, number>,
  option: string,
  amount: number
): Record<string, number> {
  const keys = Object.keys(probs);
  if (keys.length < 2) return probs;
  const shift = Math.min(Math.floor(amount / 5000), 3);
  if (shift === 0) return probs;
  const updated = { ...probs };
  updated[option] = Math.min(99, (updated[option] ?? 50) + shift);
  const others = keys.filter((k) => k !== option);
  const totalOthers = others.reduce((s, k) => s + (updated[k] ?? 0), 0);
  others.forEach((k) => {
    const share = totalOthers > 0 ? (updated[k] ?? 0) / totalOthers : 1 / others.length;
    updated[k] = Math.max(1, Math.round((updated[k] ?? 0) - shift * share));
  });
  const total = Object.values(updated).reduce((s, v) => s + v, 0);
  if (total !== 100) updated[option] = Math.max(1, Math.min(99, updated[option] + (100 - total)));
  return updated;
}

// ── State interface ───────────────────────────────────────────────
interface AppState {
  isLoggedIn:      boolean;
  userEmail:       string;
  isAdminLoggedIn: boolean;
  balance:         number;
  trades:          Trade[];
  markets:         Market[];
  activeCategory:  MarketCategory;
  activeDuration:  MarketDuration | "all";
  searchQuery:     string;
  userProfile:     UserProfile;
  apiOnline:       boolean; // tracks if backend is reachable

  // Auth
  userLogin:    (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  userLogout:   () => Promise<void>;
  userRegister: (email: string, password: string, name: string, region: string) => Promise<{ ok: boolean; error?: string }>;

  // Markets
  fetchMarkets:  () => Promise<void>;
  setActiveCategory: (cat: MarketCategory) => void;
  setActiveDuration: (d: MarketDuration | "all") => void;
  setSearchQuery:    (q: string) => void;
  checkExpiredMarkets: () => void;

  // Trading
  placeTrade: (marketId: number, option: string, amount: number) => Promise<boolean>;

  // Wallet
  depositFunds: (amount: number) => Promise<boolean>;

  // Admin
  adminLogin:         (password: string) => Promise<boolean>;
  adminLogout:        () => void;
  createMarket:       (market: Omit<Market, "id" | "createdAt" | "volume" | "expiresAt"> & { probabilities?: Record<string, number> }) => Promise<void>;
  updateMarket:       (id: number, updates: Partial<Market>) => Promise<void>;
  deleteMarket:       (id: number) => Promise<void>;
  resolveMarket:      (id: number, result: string) => Promise<import("./api").SettlementBreakdown | null>;
  toggleMarketStatus: (id: number) => Promise<void>;

  // Profile
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

// ── Store ─────────────────────────────────────────────────────────
export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      isLoggedIn:      false,
      userEmail:       "",
      isAdminLoggedIn: false,
      apiOnline:       true,
      balance:         REGION_CURRENCIES[DEFAULT_REGION].startBalance,
      trades:          [],
      markets:         [], // always fetched fresh from backend on load
      activeCategory:  "all",
      activeDuration:  "all",
      searchQuery:     "",
      userProfile: {
        name:     "Guest",
        username: "guest",
        bio:      "",
        avatar:   "",
        joinedAt: "",
        region:   DEFAULT_REGION,
      },

      setActiveCategory:   (cat) => set({ activeCategory: cat }),
      setActiveDuration:   (d)   => set({ activeDuration: d }),
      setSearchQuery:      (q)   => set({ searchQuery: q }),

      // ── Fetch markets from backend ─────────────────────────────
      fetchMarkets: async () => {
        const res = await apiGetMarkets();
        if (res.ok && res.data) {
          set((s) => {
            // Merge: keep any admin-fetched markets not in the public response
            // Public API only returns open markets, admin API returns all
            const publicIds = new Set(res.data!.map((m: ApiMarket) => m.id));
            const adminOnly = s.markets.filter(m => !publicIds.has(m.id));
            return { markets: [...res.data!.map(toMarket), ...adminOnly], apiOnline: true };
          });
        } else {
          set((state) => ({ apiOnline: false, markets: state.markets }));
        }
      },

      checkExpiredMarkets: () => {
        const now = Date.now();
        set((state) => ({
          markets: state.markets.map((m) => {
            // Normalise timestamp — add Z if missing so JS treats it as UTC
            const exp = m.expiresAt.endsWith("Z") || m.expiresAt.includes("+")
              ? m.expiresAt : m.expiresAt + "Z";
            if (m.status === "open" && new Date(exp).getTime() <= now) {
              return { ...m, status: "closed" as MarketStatus };
            }
            return m;
          }),
        }));
      },

      // ── Auth: Login ───────────────────────────────────────────
      userLogin: async (email, password) => {
        const res = await apiLogin(email, password);
        if (res.ok && res.data) {
          const { user } = res.data;
          const cfg = REGION_CURRENCIES[user.region as Region] ?? REGION_CURRENCIES[DEFAULT_REGION];
          // Fetch trades from backend
          const tradesRes = await apiGetMyTrades();
          set({
            isLoggedIn:  true,
            userEmail:   user.email,
            balance:     user.balance,
            apiOnline:   true,
            trades:      tradesRes.ok && tradesRes.data ? tradesRes.data.map(toTrade) : [],
            userProfile: toProfile(user),
          });
          // Refresh markets
          const marketsRes = await apiGetMarkets();
          if (marketsRes.ok && marketsRes.data) {
            set({ markets: marketsRes.data.map(toMarket) });
          }
          return { ok: true };
        }
        // Offline fallback — check demo credentials
        if (email.toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
          const cfg = REGION_CURRENCIES[DEFAULT_REGION];
          set({
            isLoggedIn: true,
            userEmail:  DEMO_EMAIL,
            balance:    cfg.startBalance,
            apiOnline:  false,
            trades:     [],
            userProfile: {
              name: "Demo User", username: "demo_trader",
              bio: "Demo Account – Simulated Trading",
              avatar: "", joinedAt: new Date().toISOString().split("T")[0],
              region: DEFAULT_REGION,
            },
          });
          return { ok: true };
        }
        return { ok: false, error: res.error ?? "Invalid email or password." };
      },

      // ── Auth: Logout ──────────────────────────────────────────
      userLogout: async () => {
        await apiLogout();
        set({
          isLoggedIn:      false,
          isAdminLoggedIn: false,
          userEmail:       "",
          trades:          [],
          balance:         REGION_CURRENCIES[DEFAULT_REGION].startBalance,
          userProfile: {
            name: "Guest", username: "guest",
            bio: "", avatar: "", joinedAt: "", region: DEFAULT_REGION,
          },
        });
      },

      // ── Auth: Register ────────────────────────────────────────
      userRegister: async (email, password, name, region) => {
        const res = await apiRegister(email, password, name, region);
        if (res.ok && res.data) {
          const { user } = res.data;
          set({
            isLoggedIn:  true,
            userEmail:   user.email,
            balance:     user.balance,
            apiOnline:   true,
            trades:      [],
            userProfile: toProfile(user),
          });
          const marketsRes = await apiGetMarkets();
          if (marketsRes.ok && marketsRes.data) {
            set({ markets: marketsRes.data.map(toMarket) });
          }
          return { ok: true };
        }
        return { ok: false, error: res.error ?? "Registration failed." };
      },

      // ── Place trade ───────────────────────────────────────────
      placeTrade: async (marketId, option, amount) => {
        const { isLoggedIn, balance, markets, userProfile, apiOnline } = get();
        if (!isLoggedIn) return false;

        const region   = (userProfile.region || DEFAULT_REGION) as Region;
        const minStake = REGION_CURRENCIES[region]?.minStake ?? 500;
        if (amount < minStake || amount > balance) return false;

        if (apiOnline) {
          const res = await apiPlaceTrade(marketId, option, amount);
          if (res.ok && res.data) {
            const { trade, newBalance, updatedProbabilities } = res.data;
            set((state) => ({
              balance: newBalance,
              trades:  [toTrade(trade), ...state.trades],
              markets: state.markets.map((m) =>
                m.id === marketId
                  ? { ...m, probabilities: updatedProbabilities, volume: m.volume + amount }
                  : m
              ),
            }));
            return true;
          }
          return false;
        }

        // Offline fallback
        const market = markets.find((m) => m.id === marketId);
        if (!market || market.status !== "open") return false;
        if (new Date(market.expiresAt).getTime() <= Date.now()) return false;

        const newProbs = shiftProbabilities(market.probabilities, option, amount);
        const trade: Trade = {
          id: Date.now(), marketId, marketTitle: market.title,
          option, amount, timestamp: new Date().toISOString(), status: "active",
        };
        set((state) => ({
          balance: state.balance - amount,
          trades:  [trade, ...state.trades],
          markets: state.markets.map((m) =>
            m.id === marketId
              ? { ...m, probabilities: newProbs, volume: m.volume + amount }
              : m
          ),
        }));
        return true;
      },

      // ── Deposit ───────────────────────────────────────────────
      depositFunds: async (amount) => {
        const { apiOnline } = get();
        if (apiOnline) {
          const res = await apiDeposit(amount);
          if (res.ok && res.data) {
            set({ balance: res.data.balance });
            return true;
          }
          return false;
        }
        // Offline fallback
        set((state) => ({ balance: state.balance + amount }));
        return true;
      },

      // ── Admin: Login ──────────────────────────────────────────
      // Tries backend first. Backend admin email: admin@outcomx.com
      // If backend rejects, falls back to offline mode with admin123
      adminLogin: async (password) => {
        // Try backend — the typed password IS the admin password
        const res = await apiAdminLogin("admin@outcomx.com", password);
        if (res.ok && res.data?.user?.isAdmin) {
          set({ isAdminLoggedIn: true, apiOnline: true });
          return true;
        }
        // Backend rejected — use offline mode (admin123 only)
        if (password === "admin123") {
          set({ isAdminLoggedIn: true, apiOnline: false });
          return true;
        }
        return false;
      },

      adminLogout: () => {
        clearToken();
        clearAdminToken();
        set({ isAdminLoggedIn: false });
      },

      // ── Admin: Create market ──────────────────────────────────
      createMarket: async (marketData) => {
        const { apiOnline, markets } = get();
        if (apiOnline) {
          const res = await apiAdminCreateMarket({
            title:             marketData.title,
            category:          marketData.category,
            type:              marketData.type,
            options:           marketData.options,
            duration:          marketData.duration,
            image:             marketData.image,
            banner:            marketData.banner,
            resolution_source: marketData.resolutionSource,
            probabilities:     marketData.probabilities,
          });
          if (res.ok && res.data) {
            set((state) => ({ markets: [toMarket(res.data!), ...state.markets] }));
            // Re-fetch ALL markets (not just open) so admin manage page sees the new one
            await new Promise(r => setTimeout(r, 300));
            const allRes = await apiAdminGetMarkets();
            if (allRes.ok && allRes.data) {
              set({ markets: allRes.data.map(toMarket) });
            }
            return;
          }
          console.warn("createMarket API failed:", res.error);
        }
        // Offline fallback
        const newId = Math.max(...markets.map((m) => m.id), 0) + 1;
        const probs: Record<string, number> = marketData.probabilities ?? {};
        if (Object.keys(probs).length === 0) {
          const equalShare = Math.floor(100 / marketData.options.length);
          marketData.options.forEach((opt, i) => {
            probs[opt] = i === 0 ? 100 - equalShare * (marketData.options.length - 1) : equalShare;
          });
        }
        const newMarket: Market = {
          ...marketData, id: newId,
          createdAt: new Date().toISOString().split("T")[0],
          volume: 0, probabilities: probs,
          expiresAt: calcExpiresAt(marketData.duration), trending: false,
        };
        set((state) => ({ markets: [newMarket, ...state.markets] }));
      },

      // ── Admin: Update market ──────────────────────────────────
      updateMarket: async (id, updates) => {
        const { apiOnline } = get();
        if (apiOnline) {
          const res = await apiAdminUpdateMarket(id, {
            title:             updates.title,
            category:          updates.category,
            image:             updates.image,
            banner:            updates.banner,
            resolution_source: updates.resolutionSource,
            status:            updates.status,
          });
          if (res.ok && res.data) {
            set((state) => ({
              markets: state.markets.map((m) => m.id === id ? toMarket(res.data!) : m),
            }));
            return;
          }
        }
        // Offline fallback
        set((state) => ({
          markets: state.markets.map((m) => {
            if (m.id !== id) return m;
            const updated = { ...m, ...updates };
            if (updates.duration && updates.duration !== m.duration) {
              updated.expiresAt = calcExpiresAt(updates.duration);
            }
            return updated;
          }),
        }));
      },

      // ── Admin: Delete market ──────────────────────────────────
      deleteMarket: async (id) => {
        const { apiOnline } = get();
        if (apiOnline) {
          const res = await apiAdminDeleteMarket(id);
          if (res.ok) {
            set((state) => ({ markets: state.markets.filter((m) => m.id !== id) }));
          }
          return;
        }
        set((state) => ({ markets: state.markets.filter((m) => m.id !== id) }));
      },

      // ── Admin: Resolve market ─────────────────────────────────
      resolveMarket: async (id, result) => {
        const { apiOnline } = get();
        if (apiOnline) {
          const res = await apiAdminResolveMarket(id, result);
          if (res.ok && res.data) {
            // Update market in store with full settled market from backend
            set((state) => ({
              markets: state.markets.map((m) =>
                m.id === id ? toMarket(res.data!.market) : m
              ),
              // Update trade statuses — backend has already credited balances
              trades: state.trades.map((t) => {
                if (t.marketId === id && t.status === "active") {
                  return { ...t, status: t.option === result ? "won" as const : "lost" as const };
                }
                return t;
              }),
            }));
            return res.data.settlement;
          }
        }
        // Offline fallback — no fee calculation, just mark status
        set((state) => ({
          markets: state.markets.map((m) =>
            m.id === id ? { ...m, result, status: "settled" as MarketStatus } : m
          ),
          trades: state.trades.map((t) => {
            if (t.marketId === id && t.status === "active") {
              return { ...t, status: t.option === result ? "won" as const : "lost" as const };
            }
            return t;
          }),
        }));
        return null;
      },

      // ── Admin: Toggle market status ───────────────────────────
      toggleMarketStatus: async (id) => {
        const { apiOnline, markets } = get();
        if (apiOnline) {
          const res = await apiAdminToggleMarket(id);
          if (res.ok && res.data) {
            set((state) => ({
              markets: state.markets.map((m) => m.id === id ? toMarket(res.data!) : m),
            }));
            return;
          }
        }
        // Offline fallback
        set((state) => ({
          markets: state.markets.map((m) => {
            if (m.id !== id) return m;
            const next: MarketStatus = m.status === "open" ? "closed" : "open";
            return { ...m, status: next };
          }),
        }));
      },

      // ── Update profile ────────────────────────────────────────
      updateProfile: async (updates) => {
        const { apiOnline } = get();
        if (apiOnline) {
          const res = await apiUpdateProfile(updates as Record<string, unknown>);
          if (res.ok && res.data) {
            const user = res.data;
            set((state) => ({
              userProfile: toProfile(user),
              balance: user.balance,
            }));
            return;
          }
        }
        // Offline fallback
        set((state) => {
          const newProfile = { ...state.userProfile, ...updates };
          if (updates.region && updates.region !== state.userProfile.region) {
            const cfg = REGION_CURRENCIES[updates.region as Region];
            if (cfg) return { userProfile: newProfile, balance: cfg.startBalance };
          }
          return { userProfile: newProfile };
        });
      },
    }),
    {
      name: "outcomx-v6",
      partialize: (state) => ({
        isLoggedIn:      state.isLoggedIn,
        isAdminLoggedIn: state.isAdminLoggedIn,
        userEmail:       state.userEmail,
        balance:         state.balance,
        trades:          state.trades,
        // NOTE: markets are NOT persisted — always fetched fresh from backend
        // This prevents stale/offline markets from overwriting backend data
        userProfile:     state.userProfile,
        // Persist UI preferences
        activeCategory:  state.activeCategory,
        activeDuration:  state.activeDuration,
      }),
    }
  )
);
