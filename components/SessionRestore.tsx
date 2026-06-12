"use client";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { apiGetMe, apiGetMyTrades, apiValidateAdminToken, getToken, getAdminToken } from "@/lib/api";

/**
 * Runs once on app load.
 * - Always fetches fresh markets
 * - Restores user session from JWT if token exists and is valid
 * - Restores admin session from admin JWT independently
 * - Never lets user auth logic touch admin state and vice versa
 */
export default function SessionRestore() {
  const { fetchMarkets } = useStore();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const restore = async () => {
      // Always fetch fresh markets regardless of auth state
      await fetchMarkets();

      // ── Restore user session ──────────────────────────────────
      const userToken = getToken();
      if (userToken) {
        const meRes = await apiGetMe();
        if (meRes.ok && meRes.data) {
          const user = meRes.data;
          const tradesRes = await apiGetMyTrades();
          useStore.setState({
            isLoggedIn: true,
            userEmail:  user.email,
            balance:    user.balance,
            apiOnline:  true,
            trades: tradesRes.ok && tradesRes.data
              ? tradesRes.data.map((t) => ({
                  id:          t.id,
                  marketId:    t.marketId,
                  marketTitle: t.marketTitle,
                  option:      t.option,
                  amount:      t.amount,
                  timestamp:   t.timestamp,
                  status:      t.status as "active" | "won" | "lost",
                }))
              : [],
            userProfile: {
              name:     user.name,
              username: user.username,
              bio:      user.bio,
              avatar:   user.avatar,
              joinedAt: user.joinedAt,
              region:   user.region,
            },
          });
        } else {
          // User token invalid/expired — clear user session only
          useStore.setState({ isLoggedIn: false, userEmail: "", trades: [] });
          localStorage.removeItem("outcomx_token");
        }
      } else {
        // No user token — ensure user is logged out
        useStore.setState({ isLoggedIn: false, userEmail: "", trades: [] });
      }

      // ── Restore admin session — completely independent ────────
      const adminToken = getAdminToken();
      if (adminToken) {
        // Validate admin token against backend
        const adminUser = await apiValidateAdminToken();
        if (adminUser) {
          // Token valid and user is admin — keep logged in
          useStore.setState({ isAdminLoggedIn: true, apiOnline: true });
        } else {
          // Token invalid/expired — clear admin session
          useStore.setState({ isAdminLoggedIn: false });
          localStorage.removeItem("outcomx_admin_token");
        }
      }
      // If no admin token: leave isAdminLoggedIn as-is from persisted store
      // (covers offline mode where admin123 was used — no token but state persisted)
    };

    restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
