"use client";
import { useState, useEffect } from "react";
import { apiAdminGetIncome } from "@/lib/api";
import { useCurrency } from "@/lib/useCurrency";
import { TrendingUp, DollarSign, CheckCircle2, BarChart3, RefreshCw } from "lucide-react";

interface Settlement {
  id: number;
  title: string;
  platformFee: number;
  prizePool: number;
  volume: number;
  result: string | null;
  createdAt: string;
}

interface IncomeData {
  totalIncome: number;
  settledMarkets: number;
  recentSettlements: Settlement[];
}

export default function PlatformIncomePage() {
  const { fmt } = useCurrency();
  const [data, setData]         = useState<IncomeData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState("");

  const fetchIncome = async () => {
    const res = await apiAdminGetIncome();
    if (res.ok && res.data) {
      setData(res.data);
      setError("");
    } else {
      setError(res.error ?? "Failed to load income data");
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchIncome(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchIncome();
  };

  const feeRate = 3; // 3% platform fee

  return (
    <div style={{ padding: "28px 24px", maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DollarSign size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Platform Income</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              {feeRate}% fee on settled market pools
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "var(--bg-card-hover)", border: "1px solid var(--border)",
            color: "var(--text-secondary)", cursor: refreshing ? "not-allowed" : "pointer",
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 20, background: "var(--red-bg)", border: "1px solid var(--red-border)", color: "var(--red)", fontSize: 13 }}>
          {error} — make sure the backend has the `/api/admin/income` route added.
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <span style={{ width: 24, height: 24, border: "3px solid var(--border)", borderTopColor: "var(--emerald)", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : data ? (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
            {[
              {
                label: "Total Platform Income",
                value: fmt(data.totalIncome),
                color: "var(--emerald)",
                icon: <TrendingUp size={20} />,
                sub: `${feeRate}% of all settled pools`,
              },
              {
                label: "Settled Markets",
                value: data.settledMarkets,
                color: "#6366f1",
                icon: <CheckCircle2 size={20} />,
                sub: "Markets fully resolved",
              },
              {
                label: "Avg Fee per Market",
                value: data.settledMarkets > 0 ? fmt(data.totalIncome / data.settledMarkets) : fmt(0),
                color: "#f59e0b",
                icon: <BarChart3 size={20} />,
                sub: "Average per settled market",
              },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: s.color }}>
                  {s.icon}
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    {s.label}
                  </span>
                </div>
                <p style={{ fontSize: 24, fontWeight: 800, color: s.color, margin: "0 0 4px" }}>{s.value}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Recent settlements */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color="var(--emerald)" />
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                Recent Settlements
              </h2>
            </div>

            {data.recentSettlements.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
                <CheckCircle2 size={32} style={{ margin: "0 auto 12px", opacity: 0.2, display: "block" }} />
                <p style={{ fontSize: 14, margin: 0 }}>No settled markets yet</p>
                <p style={{ fontSize: 13, margin: "4px 0 0", color: "var(--text-muted)" }}>
                  Income will appear here after markets are resolved
                </p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px 80px", padding: "9px 20px", background: "var(--bg-primary)", borderBottom: "1px solid var(--border)" }}>
                  {["Market", "Volume", "Platform Fee", "Prize Pool", "Result"].map(h => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</span>
                  ))}
                </div>

                {data.recentSettlements.map((s, i) => (
                  <div key={s.id} style={{
                    display: "grid", gridTemplateColumns: "1fr 100px 100px 100px 80px",
                    padding: "13px 20px", borderBottom: "1px solid var(--border)",
                    alignItems: "center", transition: "background 0.15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 2px" }}>
                        {s.title.length > 42 ? s.title.slice(0, 42) + "…" : s.title}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                        {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fmt(s.volume)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--emerald)" }}>+{fmt(s.platformFee)}</span>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fmt(s.prizePool)}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                      background: "var(--emerald-bg)", color: "var(--emerald)",
                      border: "1px solid var(--emerald-border)", display: "inline-block",
                    }}>
                      {s.result ?? "—"}
                    </span>
                  </div>
                ))}

                {/* Total row */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 100px 100px 100px 80px",
                  padding: "12px 20px", background: "var(--emerald-bg)",
                  borderTop: "2px solid var(--emerald-border)",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Total (all time)</span>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}></span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "var(--emerald)" }}>+{fmt(data.totalIncome)}</span>
                  <span></span><span></span>
                </div>
              </>
            )}
          </div>
        </>
      ) : null}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
