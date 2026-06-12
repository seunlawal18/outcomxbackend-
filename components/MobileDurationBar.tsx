"use client";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/themeStore";
import { MarketDuration } from "@/lib/types";
import { useScrollDirection } from "@/lib/useScrollDirection";
import {
  LayoutGrid, AlignJustify, Clock3, Clock4, Clock,
  CalendarDays, BarChart3, TrendingUp, CalendarRange,
} from "lucide-react";

const items: { id: MarketDuration | "all"; label: string; icon: React.ReactNode }[] = [
  { id: "all",     label: "All",     icon: <LayoutGrid size={13} /> },
  { id: "5min",    label: "5 Min",   icon: <AlignJustify size={13} /> },
  { id: "15min",   label: "15 Min",  icon: <Clock3 size={13} /> },
  { id: "1hour",   label: "1 Hour",  icon: <Clock4 size={13} /> },
  { id: "4hours",  label: "4 Hours", icon: <Clock size={13} /> },
  { id: "daily",   label: "Daily",   icon: <CalendarDays size={13} /> },
  { id: "weekly",  label: "Weekly",  icon: <BarChart3 size={13} /> },
  { id: "monthly", label: "Monthly", icon: <TrendingUp size={13} /> },
  { id: "yearly",  label: "Yearly",  icon: <CalendarRange size={13} /> },
];

export default function MobileDurationBar() {
  const { markets, activeDuration, setActiveDuration } = useStore();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const scrollDir = useScrollDirection();

  const mobileHidden = scrollDir === "down";

  const countFor = (id: MarketDuration | "all") =>
    id === "all"
      ? markets.filter((m) => m.status === "open").length
      : markets.filter((m) => m.duration === id && m.status === "open").length;

  return (
    <div
      className={`mobile-duration-bar${mobileHidden ? " mobile-hidden" : ""}`}
      style={{
        background: isDark ? "#13161e" : "#ffffff",
        borderBottom: `1px solid ${isDark ? "#2a2d3a" : "#e2e8f0"}`,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none" as const,
        // Sticky — sits right below CategoryBar (60 navbar + 46 category = 106)
        position: "sticky",
        top: 106,
        zIndex: 90,
        transition: "background 0.25s, border-color 0.25s, transform 0.28s ease",
        display: "none", // shown via CSS on mobile only
      }}
    >
      <div style={{
        display: "flex",
        gap: 6,
        padding: "8px 12px",
        minWidth: "max-content",
        alignItems: "center",
      }}>
        {items.map(({ id, label, icon }) => {
          const active = activeDuration === id;
          const count = countFor(id);
          return (
            <button
              key={id}
              onClick={() => setActiveDuration(id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 12px",
                borderRadius: 20,
                border: active
                  ? "1px solid var(--emerald)"
                  : `1px solid ${isDark ? "#2a2d3a" : "#e2e8f0"}`,
                background: active ? "var(--emerald-bg)" : "transparent",
                color: active ? "var(--emerald)" : isDark ? "#8b8fa8" : "#64748b",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                flexShrink: 0,
              }}
            >
              {icon}
              {label}
              {count > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: active ? "var(--emerald)" : isDark ? "#555870" : "#94a3b8",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-duration-bar { display: block !important; }
          /* Slides up by its own height (46px) + category bar (46px) = 92px
             so both bars disappear together behind the navbar */
          .mobile-duration-bar.mobile-hidden {
            transform: translateY(-92px);
          }
        }
      `}</style>
    </div>
  );
}
