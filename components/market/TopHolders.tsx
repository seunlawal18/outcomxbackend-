"use client";
import { useState, useEffect } from "react";
import { useCurrency } from "@/lib/useCurrency";
import { Trophy } from "lucide-react";

interface Holder {
  username: string;
  avatar: string;
  option: string;
  totalStaked: number;
}

async function apiGetHolders(marketId: number): Promise<Holder[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/markets/${marketId}/holders`);
    const json = await res.json();
    return json.success ? json.data : [];
  } catch { return []; }
}

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32"];

interface Props { marketId: number; }

export default function TopHolders({ marketId }: Props) {
  const { fmt } = useCurrency();
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGetHolders(marketId).then(data => {
      setHolders(data);
      setLoading(false);
    });
  }, [marketId]);

  const initials = (name: string) => name.slice(0, 2).toUpperCase();

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
        <Trophy size={15} color="#f59e0b" />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          Top Holders
        </h3>
      </div>

      {loading ? (
        <div style={{ padding: "24px 18px", textAlign: "center" }}>
          <span style={{ width: 18, height: 18, border: "2px solid var(--border)", borderTopColor: "var(--emerald)", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : holders.length === 0 ? (
        <div style={{ padding: "32px 18px", textAlign: "center" }}>
          <Trophy size={28} style={{ margin: "0 auto 10px", opacity: 0.2, display: "block" }} />
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            No positions yet
          </p>
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 80px 80px", padding: "8px 18px", background: "var(--bg-card-hover)", borderBottom: "1px solid var(--border)" }}>
            {["#", "Trader", "Position", "Staked"].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</span>
            ))}
          </div>

          {holders.map((h, i) => {
            const rankColor = RANK_COLORS[i] ?? "var(--text-muted)";
            const isYes = h.option === "Yes" || h.option === "Up";
            return (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "28px 1fr 80px 80px",
                padding: "11px 18px", borderBottom: "1px solid var(--border)",
                alignItems: "center", transition: "background 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* Rank */}
                <span style={{ fontSize: 13, fontWeight: 800, color: rankColor }}>
                  {i + 1}
                </span>

                {/* Trader */}
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: h.avatar ? "transparent" : "linear-gradient(135deg, #6366f1, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {h.avatar
                      ? <img src={h.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 10, fontWeight: 800, color: "#fff" }}>{initials(h.username)}</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "monospace" }}>
                    {h.username.slice(0, 3)}***
                  </span>
                </div>

                {/* Position */}
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  background: isYes ? "var(--emerald-bg)" : "var(--red-bg)",
                  color: isYes ? "var(--emerald)" : "var(--red)",
                  border: `1px solid ${isYes ? "var(--emerald-border)" : "var(--red-border)"}`,
                  display: "inline-block",
                }}>
                  {h.option}
                </span>

                {/* Staked */}
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textAlign: "right" }}>
                  {fmt(h.totalStaked)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
