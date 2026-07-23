"use client";
import { useState, useEffect, useRef } from "react";
import { Bell, TrendingUp, CheckCircle2, XCircle, Clock, X, Check, DollarSign } from "lucide-react";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/themeStore";
import { getSocket } from "@/lib/socket";
import { Trade, Market, parseApiDate } from "@/lib/types";
import { apiGetBalance } from "@/lib/api";
import { toast } from "@/lib/toastStore";

interface Notification {
  id: string;
  type: "trade_won" | "trade_lost" | "market_closing" | "welcome";
  title: string;
  message: string;
  time: string;
  read: boolean;
  payout?: number;
}

function buildNotifications(
  trades: Trade[],
  markets: Market[],
  isLoggedIn: boolean
): Notification[] {
  const notifs: Notification[] = [];
  if (!isLoggedIn) return notifs;

  // Won trades — timed by settlement, not placement: "won 2m ago" should
  // mean the market resolved 2 minutes ago, not that the trade was placed then.
  trades
    .filter(t => t.status === "won")
    .slice(0, 5)
    .forEach(t => {
      notifs.push({
        id:      `won-${t.id}`,
        type:    "trade_won",
        title:   "🎉 Trade Won!",
        message: `Your ${t.option} trade on "${t.marketTitle}" won${t.payoutAmount ? ` · Payout pending` : ""}`,
        time:    t.settledAt ?? t.timestamp,
        read:    false,
        payout:  t.payoutAmount ?? undefined,
      });
    });

  // Lost trades
  trades
    .filter(t => t.status === "lost")
    .slice(0, 3)
    .forEach(t => {
      notifs.push({
        id:      `lost-${t.id}`,
        type:    "trade_lost",
        title:   "Trade Settled",
        message: `Your ${t.option} trade on "${t.marketTitle}" did not win.`,
        time:    t.settledAt ?? t.timestamp,
        read:    false,
      });
    });

  // Markets closing soon (within 30 min)
  markets
    .filter(m => {
      if (m.status !== "open") return false;
      const msLeft = parseApiDate(m.expiresAt).getTime() - Date.now();
      return msLeft > 0 && msLeft < 30 * 60 * 1000;
    })
    .slice(0, 2)
    .forEach(m => {
      notifs.push({
        id:      `closing-${m.id}`,
        type:    "market_closing",
        title:   "⏱ Market Closing Soon",
        message: `"${m.title}" closes in less than 30 minutes.`,
        time:    m.expiresAt,
        read:    false,
      });
    });

  return notifs.sort((a, b) => parseApiDate(b.time).getTime() - parseApiDate(a.time).getTime());
}

function timeAgo(iso: string): string {
  const diff = Date.now() - parseApiDate(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const iconFor = (type: Notification["type"]) => {
  switch (type) {
    case "trade_won":      return <CheckCircle2 size={15} color="#10b981" />;
    case "trade_lost":     return <XCircle size={15} color="#ef4444" />;
    case "market_closing": return <Clock size={15} color="#f59e0b" />;
    default:               return <Bell size={15} color="#8b8fa8" />;
  }
};

export default function NotificationBell() {
  const { trades, markets, isLoggedIn } = useStore();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [open, setOpen]       = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  // Private per-user push — the backend only sends this to the socket that
  // authenticated as this user (see src/socket.ts), so no other client ever
  // sees it. Replaces the old 30s apiGetMyTrades() poll used to detect
  // settlements (e.g. admin resolving a market) while the user was browsing.
  useEffect(() => {
    if (!isLoggedIn) return;
    const socket = getSocket();

    const onTradeSettled = (payload: {
      tradeId: number; marketId: number; marketTitle: string;
      status: "won" | "lost"; payoutAmount: number;
    }) => {
      const trade = useStore.getState().trades.find(t => t.id === payload.tradeId);
      if (!trade || trade.status !== "active") return; // already applied, or not ours to show

      useStore.getState().patchTradeSettled(payload);

      if (payload.status === "won" && "Notification" in window && Notification.permission === "granted") {
        new Notification("🎉 Trade Won — OUTCOMX", {
          body: `Your ${trade.option} trade on "${payload.marketTitle}" won!`,
          icon: "/favicon.ico",
        });
      }
    };

    socket.on("trade:settled", onTradeSettled);
    return () => { socket.off("trade:settled", onTradeSettled); };
  }, [isLoggedIn]);

  // Private per-user push for withdrawal status changes (approved/rejected/
  // completed) — an admin can act on a request while the user is elsewhere
  // in the app, so this replaces having to reopen the Withdraw tab to find out.
  useEffect(() => {
    if (!isLoggedIn) return;
    const socket = getSocket();

    const onWithdrawalUpdated = (payload: {
      withdrawalId: number; status: "approved" | "rejected" | "completed";
      amount: number; txHash?: string | null;
    }) => {
      if (payload.status === "approved") {
        toast(`Withdrawal request approved — funds will be sent shortly`, "success");
      } else if (payload.status === "rejected") {
        toast(`Withdrawal request rejected — amount refunded to your balance`, "info");
      } else if (payload.status === "completed") {
        toast(`Withdrawal sent! Funds are on their way to your wallet`, "success");
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("💸 Withdrawal Sent — OUTCOMX", {
            body: `Your withdrawal has been sent to your wallet.`,
            icon: "/favicon.ico",
          });
        }
      }
      // Rejection refunds the balance server-side — re-sync rather than
      // guessing the new number client-side.
      apiGetBalance().then(res => {
        if (res.ok && res.data) useStore.setState({ balance: res.data.balance });
      });
    };

    socket.on("withdrawal:updated", onWithdrawalUpdated);
    return () => { socket.off("withdrawal:updated", onWithdrawalUpdated); };
  }, [isLoggedIn]);

  // Request browser notification permission on first login
  useEffect(() => {
    if (isLoggedIn && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [isLoggedIn]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allNotifs = buildNotifications(trades, markets, isLoggedIn);
  const unread    = allNotifs.filter(n => !readIds.has(n.id)).length;

  const markAllRead = () => setReadIds(new Set(allNotifs.map(n => n.id)));
  const markRead    = (id: string) => setReadIds(prev => new Set([...prev, id]));

  const bg     = isDark ? "#1a1d27" : "#ffffff";
  const border = isDark ? "#2a2d3a" : "#e2e8f0";
  const text   = isDark ? "#f0f2f5" : "#0f172a";
  const sub    = isDark ? "#8b8fa8" : "#64748b";
  const iconBg = isDark ? "#1f2333" : "#f1f5f9";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        style={{
          width: 36, height: 36, borderRadius: 8,
          background: open ? "var(--emerald-bg)" : iconBg,
          border: `1px solid ${open ? "var(--emerald-border)" : border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: open ? "var(--emerald)" : sub,
          position: "relative", transition: "all 0.15s", flexShrink: 0,
        }}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            width: 16, height: 16, borderRadius: "50%",
            background: "#ef4444", color: "#fff",
            fontSize: 10, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `2px solid ${isDark ? "#0d0f14" : "#f4f6fb"}`,
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="fade-in" style={{
          position: "absolute", right: 0, top: 44,
          width: 320, background: bg,
          border: `1px solid ${border}`, borderRadius: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          zIndex: 300, overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", borderBottom: `1px solid ${border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={15} color="var(--emerald)" />
              <span style={{ fontSize: 14, fontWeight: 700, color: text }}>Notifications</span>
              {unread > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, background: "var(--emerald-bg)", color: "var(--emerald)", border: "1px solid var(--emerald-border)", padding: "1px 7px", borderRadius: 10 }}>
                  {unread} new
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--emerald)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "2px 6px", borderRadius: 6 }}>
                  <Check size={12} /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ width: 24, height: 24, borderRadius: 6, background: iconBg, border: `1px solid ${border}`, color: sub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={12} />
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {allNotifs.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <Bell size={28} style={{ margin: "0 auto 10px", opacity: 0.2, display: "block" }} />
                <p style={{ fontSize: 13, color: sub, margin: 0 }}>No notifications yet</p>
                <p style={{ fontSize: 12, color: sub, margin: "4px 0 0", opacity: 0.7 }}>Trade on markets to get updates</p>
              </div>
            ) : (
              allNotifs.map(n => {
                const isRead = readIds.has(n.id);
                return (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    style={{
                      display: "flex", gap: 12, padding: "12px 16px",
                      borderBottom: `1px solid ${border}`,
                      background: isRead ? "transparent" : isDark ? "rgba(16,185,129,0.04)" : "rgba(5,150,105,0.03)",
                      cursor: "pointer", transition: "background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = isDark ? "#1f2333" : "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = isRead ? "transparent" : isDark ? "rgba(16,185,129,0.04)" : "rgba(5,150,105,0.03)")}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: iconBg, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {iconFor(n.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: isRead ? 500 : 700, color: text, margin: 0 }}>{n.title}</p>
                        <span style={{ fontSize: 11, color: sub, flexShrink: 0 }}>{timeAgo(n.time)}</span>
                      </div>
                      <p style={{ fontSize: 12, color: sub, margin: "3px 0 0", lineHeight: 1.4 }}>{n.message}</p>
                      {/* Show payout for won trades */}
                      {n.type === "trade_won" && n.payout && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                          <DollarSign size={11} color="#10b981" />
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>
                            Payout credited to your balance
                          </span>
                        </div>
                      )}
                    </div>
                    {!isRead && (
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--emerald)", flexShrink: 0, marginTop: 4 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {allNotifs.length > 0 && (
            <div style={{ padding: "10px 16px", borderTop: `1px solid ${border}`, textAlign: "center" }}>
              <span style={{ fontSize: 12, color: sub }}>
                Updates every 30 seconds
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
