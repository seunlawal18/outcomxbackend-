"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { apiGetMarketHistory, ApiPriceHistory } from "@/lib/api";
import {
  bucketHistory, extendHistoryToNow, fmtChartLabel,
  TIMEFRAMES, Timeframe,
} from "@/lib/chartUtils";

interface Props {
  marketId: number;
  options: string[];
  probabilities: Record<string, number>;
}

const OPTION_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1", "#3b82f6", "#8b5cf6"];

// How often to nudge the chart forward to "now" during quiet periods
// (no real trades) so the line never looks frozen/stale.
const KEEPALIVE_MS = 15_000;

// Hard cap on the live-pushed buffer — without this, a long-duration market
// (weekly/monthly/yearly) or a tab left open for hours accumulates points
// forever (every trade + every 15s keepalive tick), degrading render
// performance over time. A fresh page load still gets the full history from
// the server; this only bounds what accumulates in this one live session.
const MAX_LIVE_POINTS = 1000;

export default function ProbabilityChart({ marketId, options, probabilities }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keep a stable ref to the live chart instance so we can push points without destroying it
  const chartRef = useRef<any>(null);
  const [allHistory, setAllHistory] = useState<ApiPriceHistory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>("ALL");
  // Track previous probabilities to detect real changes
  const prevProbRef = useRef<string>("");
  const lastPushedAtRef = useRef<number>(Date.now());
  const probKey = JSON.stringify(probabilities);

  const fetchHistory = useCallback(() => {
    return apiGetMarketHistory(marketId).then(res => {
      // Keep even a single real point — we synthesize a flat line from it
      // rather than falling back to fabricated data.
      if (res.ok && res.data && res.data.length >= 1) {
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
  // No real trade history yet at all (not even the opening snapshot) — render
  // an honest empty state instead of a chart; see JSX below.
  const hasAnyHistory = !!allHistory && allHistory.length >= 1;

  useEffect(() => {
    if (loading || !hasAnyHistory) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    import("chart.js/auto").then(({ default: Chart }) => {
      // Destroy previous instance
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const bucketed = bucketHistory(allHistory!, timeframe);
      const history  = extendHistoryToNow(bucketed);

      const labels = history.map(h => fmtChartLabel(new Date(h.recordedAt).getTime(), timeframe));
      const datasets = options.slice(0, 4).map((opt, i) => {
        const data = history.map(h => h.probabilities[opt] ?? 50);
        const color = OPTION_COLORS[i % OPTION_COLORS.length];
        const grad = ctx.createLinearGradient(0, 0, 0, 260);
        grad.addColorStop(0, `${color}28`);
        grad.addColorStop(1, `${color}00`);
        return buildDataset(opt, data, color, grad, options.length === 1);
      });

      chartRef.current = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: chartOptions(),
      });

      // Record current probs so first push doesn't double-add
      prevProbRef.current = probKey;
      lastPushedAtRef.current = Date.now();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, hasAnyHistory, timeframe, marketId, options.join(",")]);

  // Push a new point onto the live chart — shared by both the "real trade
  // happened" path and the "quiet period keepalive" path below.
  const pushPoint = useCallback((probs: Record<string, number>) => {
    const chart = chartRef.current;
    if (!chart) return;

    const now = Date.now();
    chart.data.labels.push(fmtChartLabel(now, timeframe));
    if (chart.data.labels.length > MAX_LIVE_POINTS) chart.data.labels.shift();

    options.slice(0, 4).forEach((opt, i) => {
      const ds = chart.data.datasets[i];
      if (!ds) return;
      const data = ds.data as number[];
      data.push(probs[opt] ?? 50);
      if (data.length > MAX_LIVE_POINTS) data.shift();
      // Move the "endpoint dot" to the last point only
      ds.pointRadius = (c: any) => c.dataIndex === data.length - 1 ? 5 : 0;
    });

    chart.update("active");
    lastPushedAtRef.current = now;
  }, [options, timeframe]);

  // ── Push a new point when probabilities change (a trade happened) ──
  // This keeps the chart alive and animates the new point in — no full redraw
  useEffect(() => {
    if (loading) return;
    if (probKey === prevProbRef.current) return; // same probs, skip
    prevProbRef.current = probKey;
    pushPoint(probabilities);
    // Also silently re-fetch history so full data stays accurate in the background
    fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probKey]);

  // ── Keepalive: during quiet periods (no trades), nudge the line forward
  // to "now" every KEEPALIVE_MS so it never looks frozen — same behavior
  // as extendHistoryToNow on the initial load, but for the live instance.
  useEffect(() => {
    if (loading || !hasAnyHistory) return;
    const id = setInterval(() => {
      if (Date.now() - lastPushedAtRef.current >= KEEPALIVE_MS) {
        pushPoint(probabilities);
      }
    }, KEEPALIVE_MS);
    return () => clearInterval(id);
  }, [loading, hasAnyHistory, probabilities, pushPoint]);

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
              {tf === "ALL" ? "MAX" : tf}
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
        {!loading && !hasAnyHistory ? (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 6, color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "0 20px",
          }}>
            <span>No trade history yet</span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>The chart appears once the first trade is placed</span>
          </div>
        ) : (
          <canvas ref={canvasRef} style={{ opacity: loading ? 0 : 1, transition: "opacity 0.3s" }} />
        )}
        {!loading && hasAnyHistory && allHistory!.length < 2 && (
          <div style={{
            position: "absolute", bottom: 6, right: 6,
            fontSize: 10, color: "var(--text-muted)",
            background: "var(--bg-card)", padding: "2px 7px", borderRadius: 4,
            border: "1px solid var(--border)",
          }}>
            Opening price — place a trade to start the live chart
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
        // Fixed 0-100% — probabilities are inherently bounded, and
        // auto-scaling to whatever's visible exaggerates small swings
        // (e.g. 49%→52% filling the whole chart height).
        min: 0,
        max: 100,
        grid: { color: "rgba(42,45,58,0.4)", drawTicks: false },
        border: { color: "#2a2d3a", dash: [4, 4] },
        ticks: {
          color: "#4a4d5a", font: { size: 11 },
          callback: (v: any) => `${v}%`,
          stepSize: 25,
        },
      },
    },
  };
}
