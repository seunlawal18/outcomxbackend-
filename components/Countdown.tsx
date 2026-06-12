"use client";
import { useState, useEffect } from "react";
import { formatCountdown, DURATION_LABELS, MarketDuration } from "@/lib/types";
import { Clock, Timer } from "lucide-react";

interface Props {
  expiresAt: string;
  duration: MarketDuration;
  compact?: boolean;
}

export default function Countdown({ expiresAt, duration, compact = false }: Props) {
  // mounted prevents SSR/client mismatch — server renders nothing, client renders the live timer
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Render a stable placeholder on the server and before hydration completes
  if (!mounted) {
    if (compact) return <span style={{ display: "inline-flex", width: 60, height: 20 }} />;
    return <div style={{ height: 48 }} />;
  }

  const { label, urgent, expired } = formatCountdown(expiresAt);

  if (compact) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          fontWeight: 700,
          padding: "2px 7px",
          borderRadius: 20,
          background: expired
            ? "rgba(239,68,68,0.15)"
            : urgent
            ? "rgba(239,68,68,0.12)"
            : "rgba(16,185,129,0.1)",
          color: expired || urgent ? "#ef4444" : "#10b981",
          border: `1px solid ${expired || urgent ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.25)"}`,
          letterSpacing: "0.2px",
          whiteSpace: "nowrap",
        }}
      >
        <Timer size={9} />
        {label}
      </span>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 10,
        background: expired
          ? "rgba(239,68,68,0.08)"
          : urgent
          ? "rgba(239,68,68,0.08)"
          : "rgba(16,185,129,0.07)",
        border: `1px solid ${expired || urgent ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.2)"}`,
      }}
    >
      <Clock
        size={15}
        color={expired || urgent ? "#ef4444" : "#10b981"}
        style={urgent && !expired ? { animation: "pulse-icon 1s infinite" } : undefined}
      />
      <div>
        <p style={{ fontSize: 10, color: "var(--text-secondary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {DURATION_LABELS[duration]} · {expired ? "Expired" : "Closes in"}
        </p>
        <p
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: expired || urgent ? "#ef4444" : "#10b981",
            margin: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
