"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useCurrency } from "@/lib/useCurrency";
import { parseApiDate } from "@/lib/types";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthGuard from "@/components/AuthGuard";
import MarketCard from "@/components/MarketCard";
import {
  TrendingUp, TrendingDown, Clock, Wallet, BarChart2,
  Award, ArrowRight, Flame, Activity, ChevronRight,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { userProfile, balance, trades, markets } = useStore();
  const { fmtUSD, cfg } = useCurrency();

  const wonTrades    = trades.filter(t => t.status === "won");
  const lostTrades   = trades.filter(t => t.status === "lost");
  const activeTrades = trades.filter(t => t.status === "active");
  const settled      = trades.filter(t => t.status !== "active");
  const winRate      = settled.length > 0 ? Math.round((wonTrades.length / settled.length) * 100) : 0;
  const totalPayout  = wonTrades.reduce((s, t) => s + (t.payoutAmount ?? 0), 0);
  const netPnL       = totalPayout - wonTrades.reduce((s, t) => s + t.amount, 0)
                       - lostTrades.reduce((s, t) => s + t.amount, 0);

  // Open markets the user has active trades on
  const myMarketIds = new Set(activeTrades.map(t => t.marketId));
  const myActiveMarkets = markets.filter(m => myMarketIds.has(m.id) && m.status === "open");

  // Trending open markets the user hasn't traded on
  const trendingMarkets = useMemo(() =>
    markets.filter(m => m.status === "open" && m.trending && !myMarketIds.has(m.id)).slice(0, 4),
  [markets, myMarketIds]);

  const initials = userProfile.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const pnlPositive = netPnL >= 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: 1100, margin: "0 auto", width: "100%", padding: "28px 16px 48px" }}>

        {/* Welcome header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
            background: userProfile.avatar ? "transparent" : "linear-gradient(135deg, #10b981, #059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", border: "2px solid var(--emerald-border)",
          }}>
            {userProfile.avatar
              ? <img src={userProfile.avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{initials}</span>}
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              Welcome back, {userProfile.name.split(" ")[0]} 👋
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "4px 0 0" }}>
              @{userProfile.username} · {cfg.flag} {cfg.name}
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <Link href="/portfolio" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: "var(--bg-card-hover)", border: "1px solid var(--border)",
              color: "var(--text-primary)", textDecoration: "none",
            }}>
              <BarChart2 size={14} /> Portfolio
            </Link>
            <Link href="/" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: "var(--emerald)", color: "#fff", textDecoration: "none",
            }}>
              <TrendingUp size={14} /> Browse Markets
            </Link>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, marginBottom: 32 }}>
          {[
            { label: "Balance",       value: fmtUSD(balance),        color: "var(--emerald)", icon: <Wallet size={18} /> },
            { label: "Active Trades", value: activeTrades.length,    color: "#6366f1",        icon: <Clock size={18} /> },
            { label: "Won",           value: wonTrades.length,       color: "var(--emerald)", icon: <TrendingUp size={18} /> },
            { label: "Lost",          value: lostTrades.length,      color: "var(--red)",     icon: <TrendingDown size={18} /> },
            { label: "Win Rate",      value: `${winRate}%`,          color: "#f59e0b",        icon: <Award size={18} /> },
            {
              label: "Net P&L",
              value: `${pnlPositive ? "+" : ""}${fmtUSD(netPnL)}`,
              color: pnlPositive ? "var(--emerald)" : "var(--red)",
              icon: <Activity size={18} />,
            },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: s.color }}>
                {s.icon}
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  {s.label}
                </span>
              </div>
              <p style={{ fontSize: 20, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>

          {/* My active positions */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={16} color="#6366f1" />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  My Active Positions
                </h2>
                {myActiveMarkets.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(99,102,241,0.12)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.3)", padding: "1px 7px", borderRadius: 10 }}>
                    {myActiveMarkets.length}
                  </span>
                )}
              </div>
              <Link href="/portfolio" style={{ fontSize: 12, color: "var(--emerald)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                View all <ChevronRight size={12} />
              </Link>
            </div>

            {myActiveMarkets.length === 0 ? (
              <div className="card" style={{ padding: 24, textAlign: "center" }}>
                <Clock size={28} style={{ margin: "0 auto 10px", opacity: 0.2, display: "block" }} />
                <p style={{ fontSize: 14, color: "var(--text-primary)", margin: "0 0 4px" }}>No active positions</p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 14px" }}>
                  Browse markets and place your first trade
                </p>
                <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "var(--emerald)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                  Browse Markets <ArrowRight size={13} />
                </Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {myActiveMarkets.slice(0, 3).map(m => {
                  const myTrades = activeTrades.filter(t => t.marketId === m.id);
                  const totalStaked = myTrades.reduce((s, t) => s + t.amount, 0);
                  return (
                    <Link key={m.id} href={`/market/${m.id}`} style={{ textDecoration: "none" }}>
                      <div className="card" style={{ padding: "12px 14px" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px" }}>
                          {m.title.length > 50 ? m.title.slice(0, 50) + "…" : m.title}
                        </p>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            {myTrades.map(t => (
                              <span key={t.id} style={{
                                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                                background: "var(--emerald-bg)", color: "var(--emerald)",
                                border: "1px solid var(--emerald-border)",
                              }}>
                                {t.option} · {fmtUSD(t.amount)}
                              </span>
                            ))}
                          </div>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            Total: {fmtUSD(totalStaked)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {myActiveMarkets.length > 3 && (
                  <Link href="/portfolio" style={{ fontSize: 13, color: "var(--emerald)", textDecoration: "none", textAlign: "center", padding: "8px" }}>
                    +{myActiveMarkets.length - 3} more positions →
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Recent trade history */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={16} color="var(--emerald)" />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  Recent Trades
                </h2>
              </div>
              <Link href="/portfolio" style={{ fontSize: 12, color: "var(--emerald)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                View all <ChevronRight size={12} />
              </Link>
            </div>

            {trades.length === 0 ? (
              <div className="card" style={{ padding: 24, textAlign: "center" }}>
                <Activity size={28} style={{ margin: "0 auto 10px", opacity: 0.2, display: "block" }} />
                <p style={{ fontSize: 14, color: "var(--text-primary)", margin: 0 }}>No trades yet</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {trades.slice(0, 6).map((t, i) => {
                  const pnl = t.status === "won" ? (t.payoutAmount ?? 0) - t.amount
                            : t.status === "lost" ? -t.amount : null;
                  return (
                    <div key={t.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 16px",
                      borderBottom: i < 5 ? "1px solid var(--border)" : "none",
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                        background: t.status === "won" ? "var(--emerald-bg)" : t.status === "lost" ? "var(--red-bg)" : "rgba(99,102,241,0.1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {t.status === "won" ? <TrendingUp size={13} color="var(--emerald)" />
                          : t.status === "lost" ? <TrendingDown size={13} color="var(--red)" />
                          : <Clock size={13} color="#6366f1" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.marketTitle}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 0" }}>
                          {t.option} · {parseApiDate(t.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{fmtUSD(t.amount)}</p>
                        {pnl !== null && (
                          <p style={{ fontSize: 11, fontWeight: 700, margin: "2px 0 0", color: pnl >= 0 ? "var(--emerald)" : "var(--red)" }}>
                            {pnl >= 0 ? "+" : ""}{fmtUSD(pnl)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Trending markets */}
        {trendingMarkets.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Flame size={16} color="#f59e0b" />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  Trending Markets
                </h2>
              </div>
              <Link href="/" style={{ fontSize: 12, color: "var(--emerald)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                All markets <ChevronRight size={12} />
              </Link>
            </div>
            <div className="markets-grid">
              {trendingMarkets.map(m => <MarketCard key={m.id} market={m} />)}
            </div>
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}
