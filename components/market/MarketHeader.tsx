"use client";
import Link from "next/link";
import { Market, DURATION_LABELS } from "@/lib/types";
import { useCurrency } from "@/lib/useCurrency";
import Countdown from "@/components/Countdown";
import {
  ArrowLeft, Share2, Bookmark, Tag, Activity,
  TrendingUp, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import { getCategoryIcon } from "@/lib/categoryIcons";

interface Props {
  market: Market;
}

export default function MarketHeader({ market }: Props) {
  const { fmtVol } = useCurrency();
  const CategoryIcon = getCategoryIcon(market.category);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: market.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Breadcrumb */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        marginBottom: 14, fontSize: 13, color: "var(--text-secondary)",
      }}>
        <Link href="/" style={{
          color: "var(--text-secondary)", textDecoration: "none",
          display: "flex", alignItems: "center", gap: 4,
          transition: "color 0.15s",
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
        >
          <ArrowLeft size={14} /> Markets
        </Link>
        <span style={{ color: "var(--border)" }}>›</span>
        <span style={{ textTransform: "capitalize" }}>{market.category}</span>
        <span style={{ color: "var(--border)" }}>›</span>
        <span style={{
          maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: "var(--text-primary)",
        }}>
          {market.title}
        </span>
      </div>

      {/* Main header card */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>

        {/* Banner image — shown if admin set one */}
        {market.banner && (
          <div style={{ width: "100%", height: 140, overflow: "hidden", position: "relative" }}>
            <img
              src={market.banner}
              alt="Market banner"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(13,15,20,0.8))" }} />
          </div>
        )}

        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          {/* Category icon */}
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: "var(--bg-card-hover)", border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {market.image
              ? <img src={market.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }} />
              : <CategoryIcon size={24} color="var(--text-secondary)" />}
          </div>

          {/* Title + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              fontSize: 20, fontWeight: 800, color: "var(--text-primary)",
              margin: "0 0 10px", lineHeight: 1.3, letterSpacing: "-0.3px",
            }}>
              {market.title}
            </h1>

            {/* Meta row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {/* Category */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 12, color: "var(--text-secondary)",
                background: "var(--bg-card-hover)", border: "1px solid var(--border)",
                padding: "3px 9px", borderRadius: 20, textTransform: "capitalize",
              }}>
                <Tag size={10} /> {market.category}
              </span>

              {/* Status */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                textTransform: "uppercase", letterSpacing: "0.4px",
                ...(market.status === "open"
                  ? { background: "var(--emerald-bg)", color: "var(--emerald)", border: "1px solid var(--emerald-border)" }
                  : market.status === "settled"
                  ? { background: "rgba(100,116,139,0.12)", color: "var(--text-secondary)", border: "1px solid rgba(100,116,139,0.25)" }
                  : { background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)" }),
              }}>
                {market.status === "open" && <span className="live-dot" style={{ width: 6, height: 6 }} />}
                {market.status === "open" ? "Live" : market.status}
              </span>

              {/* Duration */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 12, color: "var(--text-secondary)",
                background: "var(--bg-card-hover)", border: "1px solid var(--border)",
                padding: "3px 9px", borderRadius: 20,
              }}>
                <Clock size={10} /> {DURATION_LABELS[market.duration]}
              </span>

              {/* Volume */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 12, color: "var(--text-secondary)",
                background: "var(--bg-card-hover)", border: "1px solid var(--border)",
                padding: "3px 9px", borderRadius: 20,
              }}>
                <Activity size={10} /> {fmtVol(market.volume)} Vol.
              </span>

              {/* Countdown */}
              {market.status === "open" && (
                <Countdown expiresAt={market.expiresAt} duration={market.duration} compact />
              )}

              {/* Result badge */}
              {market.status === "settled" && market.result && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                  background: "var(--emerald-bg)", color: "var(--emerald)",
                  border: "1px solid var(--emerald-border)",
                }}>
                  <CheckCircle2 size={11} /> Result: {market.result}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={handleShare}
              title="Share"
              style={{
                width: 34, height: 34, borderRadius: 8,
                background: "var(--bg-card-hover)", border: "1px solid var(--border)",
                color: "var(--text-secondary)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
            >
              <Share2 size={15} />
            </button>
            <button
              title="Bookmark"
              style={{
                width: 34, height: 34, borderRadius: 8,
                background: "var(--bg-card-hover)", border: "1px solid var(--border)",
                color: "var(--text-secondary)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--emerald)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--emerald-border)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
            >
              <Bookmark size={15} />
            </button>
          </div>
        </div>

        {/* Probability summary bar */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
            {market.options.map((opt, i) => {
              const prob = market.probabilities[opt] ?? 0;
              const colors = ["#10b981", "#ef4444", "#f59e0b", "#6366f1"];
              const color = colors[i % colors.length];
              return (
                <div key={opt} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{opt}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>
                    {prob}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Visual probability bar */}
          <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", gap: 1 }}>
            {market.options.map((opt, i) => {
              const prob = market.probabilities[opt] ?? 0;
              const colors = ["#10b981", "#ef4444", "#f59e0b", "#6366f1"];
              return (
                <div key={opt} style={{
                  width: `${prob}%`, height: "100%",
                  background: colors[i % colors.length],
                  transition: "width 0.5s ease",
                  borderRadius: i === 0 ? "3px 0 0 3px" : i === market.options.length - 1 ? "0 3px 3px 0" : 0,
                }} />
              );
            })}
          </div>
        </div>
        </div>{/* end padding wrapper */}
      </div>{/* end card */}
    </div>
  );
}
