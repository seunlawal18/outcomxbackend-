"use client";
import { useMemo, useEffect } from "react";
import { useStore } from "@/lib/store";
import Navbar from "@/components/Navbar";
import CategoryBar from "@/components/CategoryBar";
import MarketCard from "@/components/MarketCard";
import Footer from "@/components/Footer";
import DurationSidebar from "@/components/DurationSidebar";
import MobileDurationBar from "@/components/MobileDurationBar";
import NewsSlideshow from "@/components/NewsSlideshow";
import { MarketGridSkeleton } from "@/components/MarketCardSkeleton";
import { parseApiDate } from "@/lib/types";
import { Flame, TrendingUp, ChevronDown } from "lucide-react";

export default function HomePage() {
  const { markets, marketsLoaded, activeCategory, activeDuration, searchQuery, checkExpiredMarkets } = useStore();

  useEffect(() => {
    // Client-side safety net only — real closes/settlements now arrive live
    // via RealtimeSync (Socket.IO), this just catches the rare case where an
    // expiry passes while the socket happens to be disconnected. No API call.
    checkExpiredMarkets();
    const expiredId = setInterval(checkExpiredMarkets, 30_000);
    return () => clearInterval(expiredId);
  }, [checkExpiredMarkets]);

  const filtered = useMemo(() => {
    return markets.filter((m) => {
      // Only show open markets on the home page
      if (m.status !== "open") return false;

      const matchCat = activeCategory === "all"
        ? true
        : activeCategory === "new"
        ? Date.now() - parseApiDate(m.createdAt).getTime() < 48 * 60 * 60 * 1000
        : m.category === activeCategory;
      const matchDur    = activeDuration === "all" || m.duration === activeDuration;
      const matchSearch = !searchQuery ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchDur && matchSearch;
    });
  }, [markets, activeCategory, activeDuration, searchQuery]);

  const trending = useMemo(
    () => markets.filter((m) => m.trending && m.status === "open"),
    [markets]
  );

  const showTrending = activeCategory === "all" && activeDuration === "all" && !searchQuery && trending.length > 0;

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <Navbar />
      <CategoryBar />
      {/* Mobile duration bar — sticky, part of the header stack */}
      <MobileDurationBar />
      <NewsSlideshow />

      {/* Body row: sidebar flush left, main content centred */}
      <div style={{ display: "flex", width: "100%" }}>

        {/* Duration sidebar — desktop only, sticky, flush to left edge */}
        <div className="duration-sidebar-wrap">
          <DurationSidebar />
        </div>

        {/* Main content — centred with max-width */}
        <main style={{ flex: 1, minWidth: 0, padding: "20px 20px 48px", maxWidth: 1200, margin: "0 auto" }}>

            {/* Trending */}
            {showTrending && (
              <section style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Flame size={17} color="#f59e0b" />
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                    Trending
                  </h2>
                  <span style={{
                    fontSize: 12, color: "var(--text-secondary)",
                    background: "var(--bg-card-hover)", border: "1px solid var(--border)",
                    padding: "1px 8px", borderRadius: 20,
                  }}>
                    {trending.length}
                  </span>
                </div>
                <div className="markets-grid">
                  {trending.slice(0, 4).map((m) => (
                    <MarketCard key={m.id} market={m} />
                  ))}
                </div>
              </section>
            )}

            {/* All / filtered */}
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <TrendingUp size={17} color="var(--emerald)" />
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  {searchQuery
                    ? `Results for "${searchQuery}"`
                    : activeCategory === "new"
                    ? "New Markets"
                    : activeCategory !== "all"
                    ? activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)
                    : activeDuration !== "all"
                    ? `${activeDuration.toUpperCase()} Markets`
                    : "All Markets"}
                </h2>
                <span style={{
                  fontSize: 12, color: "var(--text-secondary)",
                  background: "var(--bg-card-hover)", border: "1px solid var(--border)",
                  padding: "1px 8px", borderRadius: 20,
                }}>
                  {filtered.length}
                </span>
              </div>

              {!marketsLoaded ? (
                <MarketGridSkeleton />
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
                  <TrendingUp size={40} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
                  <p style={{ fontSize: 16, color: "var(--text-primary)" }}>No markets found</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>Try a different filter or search term</p>
                </div>
              ) : (
                <div className="markets-grid fade-in">
                  {filtered.map((m) => (
                    <MarketCard key={m.id} market={m} />
                  ))}
                </div>
              )}
            </section>

            {filtered.length > 0 && (
              <div style={{ textAlign: "center", marginTop: 36 }}>
                <button
                  style={{
                    padding: "10px 28px", borderRadius: 24,
                    background: "transparent", border: "1px solid var(--border)",
                    color: "var(--text-primary)", fontSize: 14, fontWeight: 500,
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--emerald)";
                    (e.currentTarget as HTMLElement).style.color = "var(--emerald)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                  }}
                >
                  See more markets <ChevronDown size={14} />
                </button>
              </div>
            )}
          </main>
        </div>

      <Footer />

      <style>{`
        /* Duration sidebar — sticky, scrolls with page */
        .duration-sidebar-wrap {
          width: 160px;
          flex-shrink: 0;
          position: sticky;
          top: 106px;
          height: calc(100vh - 106px);
          overflow-y: auto;
          align-self: flex-start;
        }
        @media (max-width: 768px) {
          .duration-sidebar-wrap { display: none !important; }
          main { padding: 12px 12px 48px !important; }
        }
      `}</style>
    </div>
  );
}
