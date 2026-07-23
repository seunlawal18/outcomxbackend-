import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Market, Trade, MarketCategory, MarketStatus, MarketDuration, UserProfile } from "./types";
import {
  DEFAULT_REGION,
  STARTING_BALANCE_CREDITS, MIN_STAKE_CREDITS,
  DisplayCurrencyCode,
} from "./credits";
import {
  apiLogin, apiRegister, apiLogout, apiGetMe,
  apiGetMarkets, apiPlaceTrade, apiGetMyTrades,
  apiDeposit, apiUpdateProfile,
  apiWalletVerify,
  clearToken, setToken, getToken,
  ApiMarket, ApiTrade, ApiUser,
} from "./api";
import { reconnectSocketAuth } from "./socket";
import { findDemoUser, DEMO_EMAIL, DEMO_PASSWORD } from "./demoUsers";

// Re-export for any existing imports
export { DEMO_EMAIL, DEMO_PASSWORD };

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
    priceAssetId:     m.priceAssetId ?? null,
    priceAssetSymbol: m.priceAssetSymbol ?? null,
    openingPrice:     m.openingPrice ?? null,
  };
}

// ── Convert API trade → frontend Trade type ───────────────────────
// Exported so every call site (login, register, session restore) uses
// the same mapping — a hand-duplicated copy is exactly how settledAt/
// payoutAmount previously went missing on page-refresh session restore.
export function toTrade(t: ApiTrade): Trade {
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
    settledAt:     t.settledAt ?? undefined,
  };
}

// ── Convert API user → UserProfile ───────────────────────────────
// displayCurrency is a pure client-side preference, independent of
// region — callers should preserve any already-chosen value rather
// than letting this default clobber it (see userLogin/userRegister).
export function toProfile(u: ApiUser): UserProfile {
  return {
    name:            u.name,
    username:        u.username,
    bio:             u.bio,
    avatar:          u.avatar,
    joinedAt:        u.joinedAt,
    region:          u.region,
    isVerified:      u.isVerified,
    displayCurrency: "USD",
  };
}

// ── Offline probability shift (used when backend unreachable) ─────
// Divisor kept in sync with the backend's SHIFT_DIVISOR in marketService.ts —
// calibrated for USD quick-stake amounts ($5/$20/$50/$100), not the old
// Naira-scale trades.
const OFFLINE_SHIFT_DIVISOR = 20;

function shiftProbabilities(
  probs: Record<string, number>,
  option: string,
  amount: number
): Record<string, number> {
  const keys = Object.keys(probs);
  if (keys.length < 2) return probs;
  const shift = Math.min(Math.floor(amount / OFFLINE_SHIFT_DIVISOR), 3);
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
  balance:         number;
  trades:          Trade[];
  markets:         Market[];
  /** True once the first fetchMarkets() attempt has completed (success or fail) — gates skeleton loaders */
  marketsLoaded:   boolean;
  activeCategory:  MarketCategory;
  activeDuration:  MarketDuration | "all";
  searchQuery:     string;
  userProfile:     UserProfile;
  apiOnline:       boolean; // tracks if backend is reachable

  // Auth
  userLogin:      (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  userLogout:     () => Promise<void>;
  userRegister:   (email: string, password: string, name: string, region: string) => Promise<{ ok: boolean; error?: string }>;
  userWalletLogin: (address: string, message: string, signature: string) => Promise<{ ok: boolean; error?: string }>;

  // Markets
  fetchMarkets:  () => Promise<void>;
  // Applies a real-time update (trade placed / settled / closed) to one
  // already-loaded market in place — see components/RealtimeSync.tsx.
  patchMarket:   (marketId: number, updates: Partial<Market>) => void;
  setActiveCategory: (cat: MarketCategory) => void;
  setActiveDuration: (d: MarketDuration | "all") => void;
  setSearchQuery:    (q: string) => void;
  setDisplayCurrency: (code: DisplayCurrencyCode) => void;
  checkExpiredMarkets: () => void;

  // Trading
  placeTrade: (marketId: number, option: string, amount: number) => Promise<boolean>;
  // Applies a private trade:settled push (see components/NotificationBell.tsx)
  // to one already-loaded trade + the user's balance, in place — replaces
  // the old 30s apiGetMyTrades() poll.
  patchTradeSettled: (update: {
    tradeId: number; status: "won" | "lost"; payoutAmount: number;
  }) => void;

  // Wallet
  depositFunds: (amount: number) => Promise<boolean>;

  // Profile
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

// ── Store ─────────────────────────────────────────────────────────
export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      isLoggedIn:      false,
      userEmail:       "",
      apiOnline:       true,
      balance:         STARTING_BALANCE_CREDITS,
      trades:          [],
      markets:         [],
      marketsLoaded:   false,
      activeCategory:  "all",
      activeDuration:  "all",
      searchQuery:     "",
      userProfile: {
        name:            "Guest",
        username:        "guest",
        bio:             "",
        avatar:          "",
        joinedAt:        "",
        region:          DEFAULT_REGION,
        displayCurrency: "USD",
      },

      setActiveCategory:   (cat) => set({ activeCategory: cat }),
      setActiveDuration:   (d)   => set({ activeDuration: d }),
      setSearchQuery:      (q)   => set({ searchQuery: q }),
      setDisplayCurrency:  (code) => set((state) => ({
        userProfile: { ...state.userProfile, displayCurrency: code },
      })),

      // ── Fetch markets from backend ─────────────────────────────
      fetchMarkets: async () => {
        const res = await apiGetMarkets();
        if (res.ok && res.data) {
          set({ markets: res.data.map(toMarket), apiOnline: true, marketsLoaded: true });
        } else {
          set((state) => ({ apiOnline: false, markets: state.markets, marketsLoaded: true }));
        }
      },

      patchMarket: (marketId, updates) => {
        set((state) => ({
          markets: state.markets.map(m => m.id === marketId ? { ...m, ...updates } : m),
        }));
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
          // Preserve any already-chosen local display-currency preference
          // instead of letting toProfile()'s default clobber it.
          const existingCurrency = get().userProfile.displayCurrency;
          // Fetch trades from backend
          const tradesRes = await apiGetMyTrades();
          set({
            isLoggedIn:  true,
            userEmail:   user.email,
            balance:     user.balance,
            apiOnline:   true,
            trades:      tradesRes.ok && tradesRes.data ? tradesRes.data.map(toTrade) : [],
            userProfile: { ...toProfile(user), displayCurrency: existingCurrency ?? "USD" },
          });
          // Refresh markets
          const marketsRes = await apiGetMarkets();
          if (marketsRes.ok && marketsRes.data) {
            set({ markets: marketsRes.data.map(toMarket) });
          }
          reconnectSocketAuth();
          return { ok: true };
        }
        // Offline fallback — check demo credentials (all 7 demo accounts)
        const demoUser = findDemoUser(email);
        if (demoUser && password === demoUser.password) {
          set({
            isLoggedIn: true,
            userEmail:  demoUser.email,
            balance:    demoUser.balance,
            apiOnline:  false,
            trades:     [],
            userProfile: {
              ...demoUser.profile,
              displayCurrency: get().userProfile.displayCurrency ?? "USD",
            },
          });
          return { ok: true };
        }
        return { ok: false, error: res.error ?? "Invalid email or password." };
      },

      // ── Auth: Wallet login ─────────────────────────────────────
      // Mirrors userLogin's post-auth bookkeeping — the wallet-specific
      // part (connect + sign) happens in WalletConnectModal before this
      // is called with the resulting signature.
      userWalletLogin: async (address, message, signature) => {
        const res = await apiWalletVerify(address, message, signature);
        if (res.ok && res.data) {
          const { user } = res.data;
          const existingCurrency = get().userProfile.displayCurrency;
          const tradesRes = await apiGetMyTrades();
          set({
            isLoggedIn:  true,
            userEmail:   user.email,
            balance:     user.balance,
            apiOnline:   true,
            trades:      tradesRes.ok && tradesRes.data ? tradesRes.data.map(toTrade) : [],
            userProfile: { ...toProfile(user), displayCurrency: existingCurrency ?? "USD" },
          });
          const marketsRes = await apiGetMarkets();
          if (marketsRes.ok && marketsRes.data) {
            set({ markets: marketsRes.data.map(toMarket) });
          }
          reconnectSocketAuth();
          return { ok: true };
        }
        return { ok: false, error: res.error ?? "Wallet sign-in failed." };
      },

      // ── Auth: Logout ──────────────────────────────────────────
      userLogout: async () => {
        await apiLogout();
        set({
          isLoggedIn:      false,
          userEmail:       "",
          trades:          [],
          balance:         STARTING_BALANCE_CREDITS,
          userProfile: {
            name: "Guest", username: "guest",
            bio: "", avatar: "", joinedAt: "",
            region: DEFAULT_REGION,
            displayCurrency: "USD",
          },
        });
        reconnectSocketAuth();
      },

      // ── Auth: Register ────────────────────────────────────────
      userRegister: async (email, password, name, region) => {
        const res = await apiRegister(email, password, name, region);
        if (res.ok && res.data) {
          const { user } = res.data;
          const existingCurrency = get().userProfile.displayCurrency;
          set({
            isLoggedIn:  true,
            userEmail:   user.email,
            balance:     user.balance,
            apiOnline:   true,
            trades:      [],
            userProfile: { ...toProfile(user), displayCurrency: existingCurrency ?? "USD" },
          });
          const marketsRes = await apiGetMarkets();
          if (marketsRes.ok && marketsRes.data) {
            set({ markets: marketsRes.data.map(toMarket) });
          }
          reconnectSocketAuth();
          return { ok: true };
        }
        return { ok: false, error: res.error ?? "Registration failed." };
      },

      // ── Place trade ───────────────────────────────────────────
      // amount is ALWAYS in credits (converted by TradePanel before calling)
      placeTrade: async (marketId, option, amount) => {
        const { isLoggedIn, balance, markets, apiOnline } = get();
        if (!isLoggedIn) return false;

        // Validate in credits
        if (amount < MIN_STAKE_CREDITS || amount > balance) return false;

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

      patchTradeSettled: ({ tradeId, status, payoutAmount }) => {
        set((state) => ({
          trades: state.trades.map(t =>
            t.id === tradeId
              ? { ...t, status, payoutAmount, settledAt: new Date().toISOString() }
              : t
          ),
          // Balance already reflects the payout server-side by the time this
          // push arrives (settlement happens before the event fires) — apply
          // the same credit here so the UI doesn't wait for a full refetch.
          balance: status === "won" ? state.balance + payoutAmount : state.balance,
        }));
      },

      // ── Deposit ───────────────────────────────────────────────
      // amount is in credits
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
      // ── Update profile ────────────────────────────────────────
      updateProfile: async (updates) => {
        const { apiOnline } = get();
        if (apiOnline) {
          const res = await apiUpdateProfile(updates as Record<string, unknown>);
          if (res.ok && res.data) {
            set((state) => ({
              // displayCurrency has no backend field — preserve the local preference
              userProfile: { ...toProfile(res.data!), displayCurrency: state.userProfile.displayCurrency },
              balance: res.data!.balance,
            }));
            return;
          }
        }
        // Offline fallback — just update profile fields, no balance change
        set((state) => ({
          userProfile: { ...state.userProfile, ...updates },
        }));
      },
    }),
    {
      name: "outcomx-v6",
      partialize: (state) => ({
        isLoggedIn:      state.isLoggedIn,
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
