"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { apiGetMarketHistory, ApiPriceHistory } from "@/lib/api";
import {
  bucketHistory, extendHistoryToNow, fmtChartLabel,
  TIMEFRAMES, Timeframe,
} from "@/lib/chartUtils";
import { MarketDuration } from "@/lib/types";
import Countdown from "@/components/Countdown";
import { getSocket } from "@/lib/socket";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  marketId: number;
  openingPrice: number;
  assetSymbol: string;
  expiresAt: string;
  duration: MarketDuration;
}

// Hard cap on the live-pushed buffer — a tick arrives every 15s per market;
// over a long-duration market or a tab left open for hours this would
// otherwise grow forever. A fresh page load still gets the full history
// from the server; this only bounds the in-memory buffer for this session.
const MAX_LIVE_POINTS = 1000;

function fmtPrice(v: number): string {
  // Crypto prices span wildly different magnitudes ($0.0001 DOGE to $100K+ BTC)
  if (v >= 1000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (v >= 1)    return `$${v.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  return `$${v.toPrecision(4)}`;
}

export default function LivePriceChart({ marketId, openingPrice, assetSymbol, expiresAt, duration }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const [allHistory, setAllHistory] = useState<ApiPriceHistory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>("1H");

  const fetchHistory = useCallback(() => {
    return apiGetMarketHistory(marketId).then(res => {
      const withPrice = res.ok && res.data ? res.data.filter(h => h.assetPrice != null) : [];
      setAllHistory(withPrice.length >= 1 ? withPrice : null);
      return withPrice;
    });
  }, [marketId]);

  useEffect(() => {
    setLoading(true);
    fetchHistory().then(() => setLoading(false));
  }, [fetchHistory]);

  // Backend records one real tick per market every 15s (priceTickService.ts)
  // and pushes it here directly — replaces the old 5s history re-fetch poll.
  useEffect(() => {
    const socket = getSocket();
    const onPriceTick = (payload: { marketId: number; pricePoint: ApiPriceHistory }) => {
      if (payload.marketId !== marketId || payload.pricePoint.assetPrice == null) return;
      setAllHistory(prev => {
        const next = prev ? [...prev, payload.pricePoint] : [payload.pricePoint];
        return next.length > MAX_LIVE_POINTS ? next.slice(next.length - MAX_LIVE_POINTS) : next;
      });
    };
    socket.on("price:tick", onPriceTick);
    return () => { socket.off("price:tick", onPriceTick); };
  }, [marketId]);

  const hasAnyHistory = !!allHistory && allHistory.length >= 1;
  const currentPrice = hasAnyHistory ? (allHistory![allHistory!.length - 1].assetPrice ?? openingPrice) : openingPrice;
  const isUp = currentPrice >= openingPrice;
  const delta = currentPrice - openingPrice;
  const deltaPct = openingPrice !== 0 ? (delta / openingPrice) * 100 : 0;
  const lineColor = isUp ? "#10b981" : "#ef4444";

  // ── Build chart from scratch on timeframe/market change ──
  useEffect(() => {
    if (loading || !hasAnyHistory) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    import("chart.js/auto").then(({ default: Chart }) => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { labels, prices } = buildSeries(allHistory!, timeframe, openingPrice);
      const grad = ctx.createLinearGradient(0, 0, 0, 260);
      grad.addColorStop(0, `${lineColor}28`);
      grad.addColorStop(1, `${lineColor}00`);

      chartRef.current = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: assetSymbol,
            data: prices,
            borderColor: lineColor,
            backgroundColor: grad,
            borderWidth: 2,
            fill: true,
            tension: 0.15,
            pointRadius: (c: any) => c.dataIndex === prices.length - 1 ? 5 : 0,
            pointBackgroundColor: lineColor,
            pointBorderColor: "#0d0f14",
            pointBorderWidth: 2,
            pointHoverRadius: 4,
          }],
        },
        options: chartOptions(),
        plugins: [priceToBeatPlugin(openingPrice)],
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, hasAnyHistory, timeframe, marketId]);

  // ── Update data in place on each poll — smooth, no redraw flash ──
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || loading || !hasAnyHistory) return;

    const { labels, prices } = buildSeries(allHistory!, timeframe, openingPrice);
    chart.data.labels = labels;
    chart.data.datasets[0].data = prices;
    chart.data.datasets[0].borderColor = lineColor;
    chart.data.datasets[0].pointBackgroundColor = lineColor;
    chart.update("active");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allHistory]);

  return (
    <div className="card" style={{ padding: 20 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {fmtPrice(currentPrice)}
            </span>
            <span style={{
              display: "flex", alignItems: "center", gap: 3, fontSize: 13, fontWeight: 700,
              color: isUp ? "var(--emerald)" : "var(--red)",
            }}>
              {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {isUp ? "+" : ""}{deltaPct.toFixed(2)}%
            </span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>
            Price to beat: {fmtPrice(openingPrice)} · {assetSymbol}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Countdown expiresAt={expiresAt} duration={duration} compact />
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
            <span>Waiting for the first price tick…</span>
          </div>
        ) : (
          <canvas ref={canvasRef} style={{ opacity: loading ? 0 : 1, transition: "opacity 0.3s" }} />
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────

function buildSeries(history: ApiPriceHistory[], timeframe: Timeframe, openingPrice: number) {
  const bucketed = bucketHistory(history, timeframe);
  const extended = extendHistoryToNow(bucketed);
  return {
    labels: extended.map(h => fmtChartLabel(new Date(h.recordedAt).getTime(), timeframe)),
    prices: extended.map(h => h.assetPrice ?? openingPrice),
  };
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400, easing: "easeOutQuart" as const },
    interaction: { intersect: false, mode: "index" as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1a1d27",
        borderColor: "#2a2d3a", borderWidth: 1,
        titleColor: "#8b8fa8", bodyColor: "#f0f2f5",
        padding: 12, cornerRadius: 8,
        callbacks: {
          label: (c: any) => ` ${fmtPrice(c.parsed.y)}`,
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
          callback: (v: any) => fmtPrice(v),
          maxTicksLimit: 5,
        },
      },
    },
  };
}

/**
 * Small inline Chart.js plugin — draws a dashed horizontal line + label at
 * the "price to beat" (opening price), matching Polymarket's target line.
 * Kept as a plain plugin object rather than pulling in chartjs-plugin-annotation
 * (not a project dependency) for one line.
 */
function priceToBeatPlugin(openingPrice: number) {
  return {
    id: "priceToBeat",
    afterDraw(chart: any) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales?.y) return;
      const y = scales.y.getPixelForValue(openingPrice);
      if (y < chartArea.top || y > chartArea.bottom) return;

      ctx.save();
      ctx.strokeStyle = "rgba(139,143,168,0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();

      const label = "Target";
      ctx.setLineDash([]);
      ctx.font = "10px sans-serif";
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(139,143,168,0.9)";
      ctx.fillRect(chartArea.right - textWidth - 10, y - 14, textWidth + 8, 14);
      ctx.fillStyle = "#0d0f14";
      ctx.fillText(label, chartArea.right - textWidth - 6, y - 3);
      ctx.restore();
    },
  };
}
