"use client";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { MarketDuration, DURATION_LABELS } from "@/lib/types";
import {
  LayoutGrid, AlignJustify, Clock3, Clock4, Clock,
  CalendarDays, BarChart3, TrendingUp, CalendarRange,
  LogOut, LogIn,
} from "lucide-react";

interface DurationItem {
  id: MarketDuration | "all";
  label: string;
  icon: React.ReactNode;
}

const items: DurationItem[] = [
  { id: "all",     label: "All",     icon: <LayoutGrid size={15} /> },
  { id: "5min",    label: "5 Min",   icon: <AlignJustify size={15} /> },
  { id: "15min",   label: "15 Min",  icon: <Clock3 size={15} /> },
  { id: "1hour",   label: "1 Hour",  icon: <Clock4 size={15} /> },
  { id: "4hours",  label: "4 Hours", icon: <Clock size={15} /> },
  { id: "daily",   label: "Daily",   icon: <CalendarDays size={15} /> },
  { id: "weekly",  label: "Weekly",  icon: <BarChart3 size={15} /> },
  { id: "monthly", label: "Monthly", icon: <TrendingUp size={15} /> },
  { id: "yearly",  label: "Yearly",  icon: <CalendarRange size={15} /> },
];

export default function DurationSidebar() {
  const { markets, activeDuration, setActiveDuration, isLoggedIn, userLogout } = useStore();
  const router = useRouter();

  const countFor = (id: MarketDuration | "all") =>
    id === "all"
      ? markets.filter(m => m.status === "open").length
      : markets.filter(m => m.duration === id && m.status === "open").length;

  const handleLogout = async () => {
    await userLogout();
    router.push("/");
  };

  return (
    <aside style={{
      width: "100%",
      height: "100%",
      background: "var(--bg-secondary)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      padding: "16px 10px",
      transition: "background 0.25s, border-color 0.25s",
    }}>
      {/* Section label */}
      <p style={{
        fontSize: 10, color: "var(--text-muted)", fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 4px 10px",
      }}>
        Duration
      </p>

      {/* Duration items */}
      <div style={{ flex: 1 }}>
        {items.map(({ id, label, icon }) => {
          const count = countFor(id);
          const active = activeDuration === id;
          return (
            <button
              key={id}
              onClick={() => setActiveDuration(id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                background: active ? "var(--emerald-bg)" : "transparent",
                color: active ? "var(--emerald)" : "var(--text-secondary)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                transition: "all 0.15s",
                textAlign: "left",
                marginBottom: 2,
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-card-hover)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                }
              }}
            >
              <span style={{ flexShrink: 0 }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {count > 0 && (
                <span style={{
                  fontSize: 11, color: active ? "var(--emerald)" : "var(--text-muted)",
                  fontWeight: 600, minWidth: 16, textAlign: "right",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom — logout or login */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 8 }}>
        {isLoggedIn ? (
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "var(--red)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              transition: "all 0.15s",
              textAlign: "left",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "var(--red-bg)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <LogOut size={15} />
            <span>Log Out</span>
          </button>
        ) : (
          <button
            onClick={() => router.push("/login")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "var(--emerald)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              transition: "all 0.15s",
              textAlign: "left",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "var(--emerald-bg)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <LogIn size={15} />
            <span>Log In</span>
          </button>
        )}
      </div>
    </aside>
  );
}
