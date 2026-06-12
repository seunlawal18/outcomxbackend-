"use client";
import { useEffect, useRef, useState } from "react";
import { apiGetMarketHistory, ApiPriceHistory } from "@/lib/api";
import { generateChartData } from "@/lib/mockData";

interface Props {
  marketId: number;
  options: string[];
  probabilities: Record<string, number>;
}

const OPTION_COLORS = [
  "#10b981", "#6366f1", "#f59e0b", "#ec4899", "#3b82f6", "#8b5cf6",
];

export default function PriceChart({ marketId, options, probabilities }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [history, setHistory] = useState<ApiPriceHistory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const probKey = JSON.stringify(probabilities);

  // Fetch real history on mount and when marketId changes
  useEffect(() => {
    setLoading(true);
    apiGetMarketHistory(marketId).then((res) => {
      if (res.ok && res.data && res.data.length > 1) {
        setHistory(res.data);
      } else {
        setHistory(null); // fall back to generated
      }
      setLoading(false);
    });
  }, [marketId]);

  useEffect(() => {
    if (loading) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    import("chart.js/auto").then(({ default: Chart }) => {
      const existing = Chart.getChart(canvas);
      if (existing) existing.destroy();

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let labels: string[];
      let datasets: any[];

      if (history && history.length > 1) {
        // ── Real data path ────────────────────────────────────────
        labels = history.map((h) => {
          const d = new Date(h.recordedAt);
          return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
        });

        datasets = options.slice(0, 4).map((opt, i) => {
          const data = history.map((h) => h.probabilities[opt] ?? 50);
          const color = OPTION_COLORS[i % OPTION_COLORS.length];
          const gradient = ctx.createLinearGradient(0, 0, 0, 260);
          gradient.addColorStop(0, `${color}30`);
          gradient.addColorStop(1, `${color}00`);

          return {
            label: opt,
            data,
            borderColor: color,
            backgroundColor: options.length === 1 ? gradient : "transparent",
            borderWidth: 2,
            fill: options.length === 1,
            tension: 0.4,
            pointRadius: history.length < 20 ? 3 : 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: "#13161e",
            pointHoverBorderWidth: 2,
          };
        });
      } else {
        // ── Fallback: generated data ──────────────────────────────
        const { labels: genLabels } = generateChartData(marketId);
        labels = genLabels;

        datasets = options.slice(0, 4).map((opt, i) => {
          const { data: baseData } = generateChartData(marketId + opt.charCodeAt(0));
          const currentProb = probabilities[opt] ?? 50;
          const data = baseData.map((v, idx) => {
            if (idx >= baseData.length - 5) {
              const blend = (idx - (baseData.length - 5)) / 5;
              return Math.round(v + (currentProb - v) * blend * 0.6);
            }
            return v;
          });
          data[data.length - 1] = currentProb;

          const color = OPTION_COLORS[i % OPTION_COLORS.length];
          const gradient = ctx.createLinearGradient(0, 0, 0, 260);
          gradient.addColorStop(0, `${color}30`);
          gradient.addColorStop(1, `${color}00`);

          return {
            label: opt,
            data,
            borderColor: color,
            backgroundColor: options.length === 1 ? gradient : "transparent",
            borderWidth: 2,
            fill: options.length === 1,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: "#13161e",
            pointHoverBorderWidth: 2,
          };
        });
      }

      new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 600, easing: "easeInOutQuart" },
          interaction: { intersect: false, mode: "index" },
          plugins: {
            legend: {
              display: options.length > 1,
              position: "top",
              labels: {
                color: "#8b8fa8",
                font: { size: 12 },
                boxWidth: 12,
                boxHeight: 2,
                padding: 16,
                usePointStyle: true,
                pointStyle: "line",
              },
            },
            tooltip: {
              backgroundColor: "#1a1d27",
              borderColor: "#2a2d3a",
              borderWidth: 1,
              titleColor: "#8b8fa8",
              bodyColor: "#f0f2f5",
              padding: 10,
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%`,
              },
            },
          },
          scales: {
            x: {
              grid: { color: "#1a1d27", drawTicks: false },
              border: { color: "#2a2d3a" },
              ticks: { color: "#4a4d5a", maxTicksLimit: 7, font: { size: 11 }, maxRotation: 0 },
            },
            y: {
              min: 0,
              max: 100,
              grid: { color: "#1a1d27", drawTicks: false },
              border: { color: "#2a2d3a", dash: [4, 4] },
              ticks: { color: "#4a4d5a", font: { size: 11 }, callback: (v) => `${v}%`, stepSize: 25 },
            },
          },
        },
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, marketId, options.join(","), probKey]);

  return (
    <div style={{ height: 280, position: "relative", width: "100%" }}>
      {loading && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-muted)", fontSize: 13,
        }}>
          Loading chart…
        </div>
      )}
      <canvas ref={canvasRef} style={{ opacity: loading ? 0 : 1, transition: "opacity 0.3s" }} />
      {!loading && !history && (
        <div style={{
          position: "absolute", bottom: 8, right: 8,
          fontSize: 10, color: "var(--text-muted)",
          background: "var(--bg-card)", padding: "2px 6px", borderRadius: 4,
          border: "1px solid var(--border)",
        }}>
          Simulated history
        </div>
      )}
    </div>
  );
}
