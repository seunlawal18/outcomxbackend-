"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { apiGetMarketHistory, ApiPriceHistory } from "@/lib/api";
import { generateDetailedChartData } from "@/lib/mockData";

interface Props {
  marketId: number;
  options: string[];
  probabilities: Record<string, number>;
}

const OPTION_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1", "#3b82f6", "#8b5cf6"];
const TIMEFRAMES = ["1H", "6H", "1D", "1W", "ALL"] as const;
type Timeframe = typeof TIMEFRAMES[number];

function filterByTimeframe(history: ApiPriceHistory[], tf: Timeframe): ApiPriceHistory[] {
  if (tf === "ALL") return history;
  const now = Date.now();
  const cutoffs: Record<Timeframe, number> = {
    "1H":  60 * 60 * 1000,
    "6H":  6 * 60 * 60 * 1000,
    "1D":  24 * 60 * 60 * 1000,
    "1W":  7 * 24 * 60 * 60 * 1000,
    "ALL": 0,
  };
  const cutoff = now - cutoffs[tf];
  const filtered = history.filter(h => new Date(h.recordedAt).getTime() >= cutoff);
  return filtered.length >= 2 ? filtered : history.slice(-2);
}

function fmtLabel(ts: number, tf: Timeframe) {
  const d = new Date(ts);
  if (tf === "ALL" || tf === "1W") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function ProbabilityChart({ marketId, options, probabilities }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keep a stable ref to the live chart instance so we can push points without destroying it
  const chartRef = useRef<any>(null);
  const [allHistory, setAllHistory] = useState<ApiPriceHistory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>("ALL");
  // Track previous probabilities to detect real changes
  const prevProbRef = useRef<string>("");
  const probKey = JSON.stringify(probabilities);

  const fetchHistory = useCallback(() => {
    return apiGetMarketHistory(marketId).then(res => {
      if (res.ok && res.data && res.data.length > 1) {
        setAllHistory(res.data);
        return res.data;
      }
      setAllHistory(null);
      return null;
    });
  }, [marketId]);

  // Initial load — build the chart from scratch
  useEffect(() => {
    setLoading(true);
    fetchHistory().then(() => setLoading(false));
  }, [fetchHistory]);

  // ── Build chart from scratch whenever timeframe changes or on initial load ──
  useEffect(() => {
    if (loading) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    import("chart.js/auto").then(({ default: Chart }) => {
      // Destroy previous instance
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let labels: string[];
      let datasets: any[];
      const history = allHistory ? filterByTimeframe(allHistory, timeframe) : null;

      if (history && history.length > 1) {
        labels = history.map(h => fmtLabel(new Date(h.recordedAt).getTime(), timeframe));
        datasets = options.slice(0, 4).map((opt, i) => {
          const data = history.map(h => h.probabilities[opt] ?? 50);
          const color = OPTION_COLORS[i % OPTION_COLORS.length];
          const grad = ctx.createLinearGradient(0, 0, 0, 260);
          grad.addColorStop(0, `${color}28`);
          grad.addColorStop(1, `${color}00`);
          return buildDataset(opt, data, color, grad, options.length === 1);
        });
      } else {
        const gen = generateDetailedChartData(marketId, options, probabilities);
        labels = gen.labels;
        datasets = options.slice(0, 4).map((opt, i) => {
          const data = gen.datasets[opt] ?? [];
          const color = OPTION_COLORS[i % OPTION_COLORS.length];
          const grad = ctx.createLinearGradient(0, 0, 0, 260);
          grad.addColorStop(0, `${color}28`);
          grad.addColorStop(1, `${color}00`);
          return buildDataset(opt, data, color, grad, options.length === 1);
        });
      }

      chartRef.current = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: chartOptions(),
      });

      // Record current probs so first push doesn't double-add
      prevProbRef.current = probKey;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, timeframe, marketId, options.join(",")]);

  // ── Push a new point when probabilities change (trade happened) ──
  // This keeps the chart alive and animates the new point in — no full redraw
  useEffect(() => {
    if (loading) return;
    if (probKey === prevProbRef.current) return; // same probs, skip
    prevProbRef.current = probKey;

    const chart = chartRef.current;
    if (!chart) return;

    const now = Date.now();
    const label = fmtLabel(now, timeframe);

    // Add the new label
    chart.data.labels.push(label);

    // Update each dataset with the new probability value
    options.slice(0, 4).forEach((opt, i) => {
      const ds = chart.data.datasets[i];
      if (!ds) return;
      const newVal = probabilities[opt] ?? 50;
      (ds.data as number[]).push(newVal);

      // Move the "endpoint dot" to the last point only
      ds.pointRadius = (c: any) => c.dataIndex === (ds.data as number[]).length - 1 ? 5 : 0;
    });

    // Smooth slide-in animation for the new point
    chart.update("active");

    // Also silently re-fetch history so full data stays accurate in the background
    fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probKey]);

  return (
    <div className="card" style={{ padding: 20 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {options.map((opt, i) => {
            const prob = probabilities[opt] ?? 0;
            const color = OPTION_COLORS[i % OPTION_COLORS.length];
            return (
              <div key={opt} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 12, height: 3, borderRadius: 2, background: color, display: "inline-block" }} />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{opt}</span>
                <span style={{
                  fontSize: 14, fontWeight: 800, color, fontVariantNumeric: "tabular-nums",
                  transition: "color 0.3s",
                }}>
                  {prob}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Timeframe selector */}
        <div style={{ display: "flex", gap: 3 }}>
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)} style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor: "pointer", border: "1px solid",
              borderColor: timeframe === tf ? "var(--emerald)" : "transparent",
              background: timeframe === tf ? "var(--emerald-bg)" : "transparent",
              color: timeframe === tf ? "var(--emerald)" : "var(--text-muted)",
              transition: "all 0.15s",
            }}>
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 260, position: "relative" }}>
        {loading && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-muted)", fontSize: 13, gap: 8,
          }}>
            <span style={{ width: 16, height: 16, border: "2px solid var(--border)", borderTopColor: "var(--emerald)", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
            Loading chart…
          </div>
        )}
        <canvas ref={canvasRef} style={{ opacity: loading ? 0 : 1, transition: "opacity 0.3s" }} />
        {!loading && !allHistory && (
          <div style={{
            position: "absolute", bottom: 6, right: 6,
            fontSize: 10, color: "var(--text-muted)",
            background: "var(--bg-card)", padding: "2px 7px", borderRadius: 4,
            border: "1px solid var(--border)",
          }}>
            Simulated history — place trades to generate real data
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────

function buildDataset(opt: string, data: number[], color: string, gradient: any, fill: boolean) {
  return {
    label: opt,
    data,
    borderColor: color,
    backgroundColor: fill ? gradient : "transparent",
    borderWidth: 2,
    fill,
    tension: 0,
    pointRadius: (c: any) => c.dataIndex === data.length - 1 ? 5 : 0,
    pointBackgroundColor: color,
    pointBorderColor: "#0d0f14",
    pointBorderWidth: 2,
    pointHoverRadius: 4,
    pointHoverBackgroundColor: color,
    pointHoverBorderColor: "#0d0f14",
    pointHoverBorderWidth: 2,
  };
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400, easing: "easeOutQuart" as const },
    interaction: { intersect: false, mode: "index" as const },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: {
          color: "#8b8fa8", font: { size: 12 },
          boxWidth: 14, boxHeight: 2, padding: 16,
          usePointStyle: true, pointStyle: "line" as const,
        },
      },
      tooltip: {
        backgroundColor: "#1a1d27",
        borderColor: "#2a2d3a", borderWidth: 1,
        titleColor: "#8b8fa8", bodyColor: "#f0f2f5",
        padding: 12, cornerRadius: 8,
        callbacks: {
          label: (c: any) => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}%`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(42,45,58,0.4)", drawTicks: false },
        border: { color: "#2a2d3a" },
        ticks: { color: "#4a4d5a", maxTicksLimit: 6, font: { size: 11 }, maxRotation: 0 },
      },
      y: {
        grid: { color: "rgba(42,45,58,0.4)", drawTicks: false },
        border: { color: "#2a2d3a", dash: [4, 4] },
        ticks: {
          color: "#4a4d5a", font: { size: 11 },
          callback: (v: any) => `${v}%`,
          maxTicksLimit: 5,
        },
      },
    },
  };
}
