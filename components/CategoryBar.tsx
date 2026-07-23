"use client";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/themeStore";
import { MarketCategory, parseApiDate } from "@/lib/types";
import { CATEGORY_ICONS } from "@/lib/categoryIcons";
import { useScrollDirection } from "@/lib/useScrollDirection";

const categories: { id: MarketCategory; label: string; badge?: string }[] = [
  { id: "all",           label: "All" },
  { id: "new",           label: "New", badge: "NEW" },
  { id: "sports",        label: "Sports" },
  { id: "crypto",        label: "Crypto" },
  { id: "politics",      label: "Politics" },
  { id: "finance",       label: "Finance" },
  { id: "esports",       label: "Esports" },
  { id: "entertainment", label: "Entertainment" },
  { id: "economy",       label: "Economy" },
];

export default function CategoryBar() {
  const { activeCategory, setActiveCategory, markets } = useStore();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const scrollDir = useScrollDirection();

  // On mobile: hide when scrolling down, show when scrolling up or at top
  // translateY(-100%) slides the bar up behind the navbar
  // The duration bar is 46px tall, so we shift by that amount
  const mobileHidden = scrollDir === "down";

  const newCount = markets.filter((m) => {
    const created = parseApiDate(m.createdAt).getTime();
    return Date.now() - created < 48 * 60 * 60 * 1000 && m.status === "open";
  }).length;

  return (
    <div
      className={`category-bar-wrap${mobileHidden ? " mobile-hidden" : ""}`}
      style={{
        background: isDark ? "#13161e" : "#ffffff",
        borderBottom: `1px solid ${isDark ? "#2a2d3a" : "#e2e8f0"}`,
        transition: "background 0.25s, border-color 0.25s, transform 0.28s ease",
        position: "sticky",
        top: 60,
        zIndex: 95,
      }}
    >
      {/* Desktop: evenly spread across full width */}
      <div className="category-bar-desktop" style={{
        maxWidth: 1400, margin: "0 auto",
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        height: 46,
        justifyContent: "space-between",
      }}>
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          const Icon = CATEGORY_ICONS[cat.id];
          return (
            <button
              key={cat.id}
              className={`category-pill ${isActive ? "active" : ""}`}
              onClick={() => setActiveCategory(cat.id)}
              style={{ position: "relative", flex: 1, justifyContent: "center", display: "flex", alignItems: "center" }}
            >
              <Icon size={14} style={{ marginRight: 5 }} />
              {cat.label}
              {cat.id === "new" && newCount > 0 && (
                <span style={{
                  marginLeft: 5, fontSize: 10, fontWeight: 800,
                  background: isActive ? "rgba(255,255,255,0.25)" : "#ef4444",
                  color: "#fff", padding: "1px 5px", borderRadius: 10, lineHeight: 1.4,
                }}>
                  {newCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mobile: scrollable row */}
      <div className="category-bar-mobile" style={{
        display: "none",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none" as const,
      }}>
        <div style={{
          padding: "0 12px",
          display: "flex", gap: 4,
          alignItems: "center", height: 46,
          minWidth: "max-content",
        }}>
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            const Icon = CATEGORY_ICONS[cat.id];
            return (
              <button
                key={cat.id}
                className={`category-pill ${isActive ? "active" : ""}`}
                onClick={() => setActiveCategory(cat.id)}
                style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
              >
                <Icon size={14} style={{ marginRight: 5 }} />
                {cat.label}
                {cat.id === "new" && newCount > 0 && (
                  <span style={{
                    marginLeft: 5, fontSize: 10, fontWeight: 800,
                    background: isActive ? "rgba(255,255,255,0.25)" : "#ef4444",
                    color: "#fff", padding: "1px 5px", borderRadius: 10, lineHeight: 1.4,
                  }}>
                    {newCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .category-bar-desktop { display: none !important; }
          .category-bar-mobile  { display: block !important; }
          /* Slide both bars up together when scrolling down */
          .category-bar-wrap.mobile-hidden {
            transform: translateY(-100%);
          }
        }
      `}</style>
    </div>
  );
}
