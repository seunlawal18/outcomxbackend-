"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCurrency } from "@/lib/useCurrency";
import { parseApiDate } from "@/lib/types";
import AuthGuard from "@/components/AuthGuard";
import { ArrowLeft, TrendingUp, TrendingDown, Clock, Wallet } from "lucide-react";

export default function PortfolioPage() {
  return (
    <AuthGuard>
      <PortfolioContent />
    </AuthGuard>
  );
}

function PortfolioContent() {
  const { trades, balance } = useStore();
  const { fmtUSD } = useCurrency();

  const totalInvested = trades.reduce((sum, t) => sum + t.amount, 0);
  const wonTrades     = trades.filter((t) => t.status === "won");
  const lostTrades    = trades.filter((t) => t.status === "lost");
  const activeTrades  = trades.filter((t) => t.status === "active");
  const totalPayout   = wonTrades.reduce((sum, t) => sum + (t.payoutAmount ?? 0), 0);
  const totalPnL      = totalPayout - wonTrades.reduce((sum, t) => sum + t.amount, 0)
                        - lostTrades.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: 900, margin: "0 auto", width: "100%", padding: "24px 16px" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", textDecoration: "none", fontSize: 14, marginBottom: 24 }}>
          <ArrowLeft size={16} /> Back to Markets
        </Link>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 24 }}>My Portfolio</h1>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Balance",        value: fmtUSD(balance),        color: "var(--emerald)", icon: <Wallet size={17} /> },
            { label: "Total Invested", value: fmtUSD(totalInvested),  color: "#f59e0b",        icon: <TrendingUp size={17} /> },
            { label: "Active Trades",  value: activeTrades.length,    color: "#6366f1",        icon: <Clock size={17} /> },
            { label: "Won",            value: wonTrades.length,       color: "var(--emerald)", icon: <TrendingUp size={17} /> },
            { label: "Lost",           value: lostTrades.length,      color: "var(--red)",     icon: <TrendingDown size={17} /> },
            { label: "Net P&L",        value: `${totalPnL >= 0 ? "+" : ""}${fmtUSD(totalPnL)}`, color: totalPnL >= 0 ? "var(--emerald)" : "var(--red)", icon: totalPnL >= 0 ? <TrendingUp size={17} /> : <TrendingDown size={17} /> },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: stat.color }}>
                {stat.icon}
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{stat.label}</span>
              </div>
              <p style={{ fontSize: 22, fontWeight: 700, color: stat.color, margin: 0 }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Trades list */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Trade History</h2>
          </div>

          {trades.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
              <TrendingUp size={32} style={{ margin: "0 auto 12px", opacity: 0.25 }} />
              <p style={{ fontSize: 15, color: "var(--text-primary)" }}>No trades yet</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Start trading on the markets!</p>
              <Link href="/" style={{ color: "var(--emerald)", fontSize: 14, marginTop: 12, display: "inline-block" }}>Browse Markets →</Link>
            </div>
          ) : (
            trades.map((trade) => {
              const pnl = trade.status === "won"
                ? (trade.payoutAmount ?? 0) - trade.amount
                : trade.status === "lost"
                ? -trade.amount
                : null;

              return (
                <div key={trade.id} style={{ padding: "13px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <Link href={`/market/${trade.marketId}`} style={{ color: "var(--text-primary)", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>
                      {trade.marketTitle}
                    </Link>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>
                      {parseApiDate(trade.timestamp).toLocaleString()}
                    </p>
                  </div>

                  <span style={{ fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 6, background: trade.option === "Yes" || trade.option === "Up" ? "var(--emerald-bg)" : "var(--red-bg)", color: trade.option === "Yes" || trade.option === "Up" ? "var(--emerald)" : "var(--red)" }}>
                    {trade.option}
                  </span>

                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                      {fmtUSD(trade.amount)}
                    </p>
                    {/* Show locked payout for active trades */}
                    {trade.status === "active" && trade.lockedPayout && (
                      <p style={{ fontSize: 11, fontWeight: 700, margin: "2px 0 0", color: "var(--emerald)" }}>
                        🔒 Win: {fmtUSD(trade.lockedPayout)}
                      </p>
                    )}
                    {pnl !== null && (
                      <p style={{ fontSize: 12, fontWeight: 700, margin: "2px 0 0", color: pnl >= 0 ? "var(--emerald)" : "var(--red)" }}>
                        {pnl >= 0 ? "+" : ""}{fmtUSD(pnl)}
                      </p>
                    )}
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", ...(trade.status === "active" ? { background: "rgba(99,102,241,0.15)", color: "#6366f1" } : trade.status === "won" ? { background: "var(--emerald-bg)", color: "var(--emerald)" } : { background: "var(--red-bg)", color: "var(--red)" }) }}>
                      {trade.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
