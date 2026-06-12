"use client";
import { useStore } from "@/lib/store";
import Link from "next/link";
import {
  LayoutDashboard, TrendingUp, BarChart3, CheckCircle2,
  Clock4, DollarSign, Activity, Flame, Users,
  ArrowUpRight, CircleDot, Timer,
} from "lucide-react";
import { DURATION_LABELS } from "@/lib/types";
import { useCurrency } from "@/lib/useCurrency";

export default function AdminDashboard() {
  const { markets, trades } = useStore();
  const { fmt } = useCurrency();

  const openMarkets    = markets.filter((m) => m.status === "open");
  const settledMarkets = markets.filter((m) => m.status === "settled");
  const totalVolume    = markets.reduce((sum, m) => sum + m.volume, 0);
  const activeTrades   = trades.filter((t) => t.status === "active");

  const stats = [
    { label: "Total Markets",   value: markets.length,        color: "#6366f1", bg: "rgba(99,102,241,0.1)",   icon: <BarChart3 size={22} /> },
    { label: "Open Markets",    value: openMarkets.length,    color: "#10b981", bg: "rgba(16,185,129,0.1)",   icon: <Activity size={22} /> },
    { label: "Settled",         value: settledMarkets.length, color: "#8b8fa8", bg: "rgba(139,143,168,0.1)",  icon: <CheckCircle2 size={22} /> },
    { label: "Total Trades",    value: trades.length,         color: "#f59e0b", bg: "rgba(245,158,11,0.1)",   icon: <TrendingUp size={22} /> },
    { label: "Active Trades",   value: activeTrades.length,   color: "#ec4899", bg: "rgba(236,72,153,0.1)",   icon: <Clock4 size={22} /> },
    { label: "Total Volume",    value: fmt(totalVolume, true), color: "#10b981", bg: "rgba(16,185,129,0.1)", icon: <DollarSign size={22} /> },
  ];

  const catBreakdown = ["sports","crypto","politics","finance","esports","entertainment","economy"].map((cat) => ({
    cat, count: markets.filter((m) => m.category === cat).length,
  }));

  const durationBreakdown = (["5min","15min","1hour","4hours","daily","weekly","monthly","yearly"] as const).map((d) => ({
    d, label: DURATION_LABELS[d], count: markets.filter((m) => m.duration === d).length,
  }));

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg, #10b981, #059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <LayoutDashboard size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Dashboard</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Platform overview & analytics</p>
          </div>
        </div>
        <Link href="/admin/create" style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "9px 18px", borderRadius: 10,
          background: "var(--emerald)", color: "#fff",
          textDecoration: "none", fontSize: 13, fontWeight: 700,
          transition: "opacity 0.2s",
        }}>
          <Flame size={15} /> New Market
        </Link>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14, marginBottom: 28 }}>
        {stats.map((s) => (
          <div key={s.label} className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {s.label}
                </p>
                <p style={{ fontSize: 26, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
              </div>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: s.bg, display: "flex", alignItems: "center", justifyContent: "center",
                color: s.color,
              }}>
                {s.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {/* Category breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart3 size={16} color="#6366f1" />
            </div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>By Category</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {catBreakdown.map(({ cat, count }) => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 90, textTransform: "capitalize" }}>{cat}</span>
                <div style={{ flex: 1, height: 5, background: "var(--bg-card-hover)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    width: `${markets.length ? (count / markets.length) * 100 : 0}%`,
                    height: "100%", background: "linear-gradient(90deg, #10b981, #059669)", borderRadius: 3,
                  }} />
                </div>
                <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700, minWidth: 18, textAlign: "right" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Duration breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Timer size={16} color="#f59e0b" />
            </div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>By Duration</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {durationBreakdown.filter(d => d.count > 0).map(({ d, label, count }) => (
              <div key={d} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 70 }}>{label}</span>
                <div style={{ flex: 1, height: 5, background: "var(--bg-card-hover)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    width: `${markets.length ? (count / markets.length) * 100 : 0}%`,
                    height: "100%", background: "linear-gradient(90deg, #f59e0b, #d97706)", borderRadius: 3,
                  }} />
                </div>
                <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700, minWidth: 18, textAlign: "right" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent markets */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CircleDot size={16} color="#10b981" />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Recent Markets</h2>
            </div>
            <Link href="/admin/manage" style={{ fontSize: 12, color: "var(--emerald)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {markets.slice(0, 6).map((m) => (
              <div key={m.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", borderBottom: "1px solid var(--border)",
              }}>
                <span style={{ fontSize: 12, color: "var(--text-primary)", flex: 1, marginRight: 10 }}>
                  {m.title.length > 38 ? m.title.slice(0, 38) + "…" : m.title}
                </span>
                <span className={`badge-${m.status}`} style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 7px",
                  borderRadius: 20, textTransform: "uppercase", flexShrink: 0,
                }}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Users quick stat */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(236,72,153,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={16} color="#ec4899" />
            </div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Users</h2>
          </div>
          {[
            { label: "Total Users",    value: 7,                  color: "#6366f1" },
            { label: "Active Traders", value: 6,                  color: "#10b981" },
            { label: "Total Trades",   value: trades.length,      color: "#f59e0b" },
            { label: "Active Trades",  value: activeTrades.length, color: "#ec4899" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
