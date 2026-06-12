"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useCurrency } from "@/lib/useCurrency";
import { Market } from "@/lib/types";
import {
  BarChart2, TrendingUp, TrendingDown, Clock,
  CheckCircle2, XCircle, Wallet,
} from "lucide-react";

interface Props {
  market: Market;
}

export default function PositionSummary({ market }: Props) {
  const { trades, isLoggedIn } = useStore();
  const { fmt } = useCurrency();

  const myTrades = trades.filter(t => t.marketId === market.id);

  if (!isLoggedIn || myTrades.length === 0) return null;

  const totalStaked  = myTrades.reduce((s, t) => s + t.amount, 0);
  const activeTrades = myTrades.filter(t => t.status === "active");
  const wonTrades    = myTrades.filter(t => t.status === "won");
  const lostTrades   = myTrades.filter(t => t.status === "lost");
  const totalPayout  = wonTrades.reduce((s, t) => s + (t.payoutAmount ?? 0), 0);
  const realizedPnL  = totalPayout - wonTrades.reduce((s, t) => s + t.amount, 0)
                       - lostTrades.reduce((s, t) => s + t.amount, 0);

  // Group active positions by option
  const positions: Record<string, number> = {};
  activeTrades.forEach(t => {
    positions[t.option] = (positions[t.option] ?? 0) + t.amount;
  });

  const OPTION_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1"];

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <BarChart2 size={15} color="var(--emerald)" />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          My Position
        </h3>
        <Link href="/portfolio" style={{
          marginLeft: "auto", fontSize: 12, color: "var(--emerald)",
          textDecoration: "none", display: "flex", alignItems: "center", gap: 3,
        }}>
          Portfolio →
        </Link>
      </div>

      <div style={{ padding: 16 }}>
        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[
            { label: "Total Staked",  value: fmt(totalStaked),      color: "#f59e0b",        icon: <Wallet size={13} /> },
            { label: "Active",        value: activeTrades.length,   color: "#6366f1",        icon: <Clock size={13} /> },
            { label: "Won",           value: wonTrades.length,      color: "var(--emerald)", icon: <TrendingUp size={13} /> },
            { label: "Lost",          value: lostTrades.length,     color: "var(--red)",     icon: <TrendingDown size={13} /> },
          ].map(s => (
            <div key={s.label} style={{
              padding: "10px 12px", borderRadius: 10,
              background: "var(--bg-card-hover)", border: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, color: s.color }}>
                {s.icon}
                <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  {s.label}
                </span>
              </div>
              <p style={{ fontSize: 16, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Active positions breakdown */}
        {Object.keys(positions).length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Active Positions
            </p>
            {Object.entries(positions).map(([opt, staked], i) => {
              const prob = market.probabilities[opt] ?? 50;
              const color = OPTION_COLORS[market.options.indexOf(opt) % OPTION_COLORS.length] || OPTION_COLORS[i % 4];
              const potReturn = staked * (100 / Math.max(prob, 1));
              return (
                <div key={opt} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 9, marginBottom: 6,
                  background: `${color}0d`, border: `1px solid ${color}30`,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>{opt}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                        {fmt(staked)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {prob}% chance
                      </span>
                      <span style={{ fontSize: 11, color: "var(--emerald)" }}>
                        → {fmt(potReturn)} if wins
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Realized P&L */}
        {(wonTrades.length > 0 || lostTrades.length > 0) && (
          <div style={{
            padding: "10px 14px", borderRadius: 10,
            background: realizedPnL >= 0 ? "var(--emerald-bg)" : "var(--red-bg)",
            border: `1px solid ${realizedPnL >= 0 ? "var(--emerald-border)" : "var(--red-border)"}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {realizedPnL >= 0
                ? <CheckCircle2 size={14} color="var(--emerald)" />
                : <XCircle size={14} color="var(--red)" />}
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Realized P&L</span>
            </div>
            <span style={{
              fontSize: 15, fontWeight: 800,
              color: realizedPnL >= 0 ? "var(--emerald)" : "var(--red)",
            }}>
              {realizedPnL >= 0 ? "+" : ""}{fmt(realizedPnL)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
