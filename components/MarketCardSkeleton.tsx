// ── Skeleton placeholder for MarketCard ─────────────────────────────
// Shown only during the very first market fetch (see marketsLoaded in
// lib/store.ts) so first paint shows structure instead of an empty grid
// that pops into content a moment later.

function Bone({ width, height = 12, radius = 6 }: { width: string | number; height?: number; radius?: number }) {
  return (
    <div
      className="skeleton-bone"
      style={{ width, height, borderRadius: radius, background: "var(--bg-card-hover)" }}
    />
  );
}

export default function MarketCardSkeleton() {
  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Bone width={40} height={40} radius={9} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <Bone width="90%" height={13} />
          <Bone width="60%" height={13} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Bone width="100%" height={38} radius={8} />
        <Bone width="100%" height={38} radius={8} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
        <Bone width={70} height={10} />
        <Bone width={50} height={10} />
      </div>
    </div>
  );
}

export function MarketGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="markets-grid">
      {Array.from({ length: count }, (_, i) => (
        <MarketCardSkeleton key={i} />
      ))}
    </div>
  );
}
