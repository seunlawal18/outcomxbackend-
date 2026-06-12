"use client";
import { useEffect, useState } from "react";
import { apiGetMarketTrades, ApiMarketTrade } from "@/lib/api";
import { useCurrency } from "@/lib/useCurrency";
import { Activity, TrendingUp, TrendingDown, Clock, RefreshCw } from "lucide-react";

interface Props {
  marketId: number;
}

const OPTION_COLORS: Record<string, string> = {
  Yes: "#10b981", No: "#ef4444",
  Up:  "#10b981", Down: "#ef4444",
};

function getColor(option: string, index: number): string {
  if (OPTION_COLORS[option]) return OPTION_COLORS[option];
  const fallbacks = ["#10b981", "#ef4444", "#f59e0b", "#6366f1"];
  return fallbacks[index % fallbacks.length];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function RecentTrades({ marketId }: Props) {
  const { fmt } = useCurrency();
  const [trades, setTrades] = useState<ApiMarketTrade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = () => {
    setLoading(true);
    apiGetMarketTrades(marketId).then(res => {
      if (res.ok && res.data) setTrades(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchTrades();
    // Poll every 30s for near-live feel (replace with Socket.IO later)
    const id = setInterval(fetchTrades, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId]);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <Activity size={15} color="var(--emerald)" />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          Recent Trades
        </h3>
        {trades.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            background: "var(--emerald-bg)", color: "var(--emerald)",
            border: "1px solid var(--emerald-border)",
            padding: "1px 7px", borderRadius: 10,
          }}>
            {trades.length}
          </span>
        )}
        <button
          onClick={fetchTrades}
          title="Refresh"
          style={{
            marginLeft: "auto", background: "none", border: "none",
            color: "var(--text-muted)", cursor: "pointer", padding: 4,
            display: "flex", alignItems: "center",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "28px 18px", textAlign: "center" }}>
          <span style={{
            width: 20, height: 20, border: "2px solid var(--border)",
            borderTopColor: "var(--emerald)", borderRadius: "50%",
            display: "inline-block", animation: "spin 0.8s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : trades.length === 0 ? (
        <div style={{ padding: "32px 18px", textAlign: "center" }}>
          <Activity size={28} style={{ margin: "0 auto 10px", opacity: 0.2, display: "block" }} />
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            No trades yet on this market
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            Be the first to trade
          </p>
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 80px 90px 70px",
            padding: "7px 18px", borderBottom: "1px solid var(--border)",
            background: "var(--bg-card-hover)",
          }}>
            {["Trader", "Outcome", "Amount", "Time"].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {h}
              </span>
            ))}
          </div>

          {trades.map((trade, i) => {
            const color = getColor(trade.option, i);
            const isWon  = trade.status === "won";
            const isLost = trade.status === "lost";

            return (
              <div
                key={trade.id}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 80px 90px 70px",
                  alignItems: "center", padding: "10px 18px",
                  borderBottom: "1px solid var(--border)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* Trader */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                    background: isWon ? "var(--emerald-bg)" : isLost ? "var(--red-bg)" : `${color}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isWon
                      ? <TrendingUp size={12} color="var(--emerald)" />
                      : isLost
                      ? <TrendingDown size={12} color="var(--red)" />
                      : <Clock size={12} color={color} />}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                    {trade.trader}
                  </span>
                </div>

                {/* Option */}
                <span style={{
                  fontSize: 12, fontWeight: 700, color,
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  {trade.option}
                </span>

                {/* Amount */}
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                  {fmt(trade.amount)}
                </span>

                {/* Time */}
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {timeAgo(trade.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
