"use client";
import { useStore } from "@/lib/store";
import { useCurrency } from "@/lib/useCurrency";
import { Users, TrendingUp, DollarSign, Activity, UserCheck } from "lucide-react";

const mockUsers = [
  { id: 1, name: "Alex Thompson",   email: "alex@example.com",    joined: "2026-01-15", trades: 24 },
  { id: 2, name: "Sarah Chen",      email: "sarah@example.com",   joined: "2026-02-03", trades: 47 },
  { id: 3, name: "Marcus Williams", email: "marcus@example.com",  joined: "2026-02-18", trades: 12 },
  { id: 4, name: "Priya Patel",     email: "priya@example.com",   joined: "2026-03-01", trades: 89 },
  { id: 5, name: "Jordan Lee",      email: "jordan@example.com",  joined: "2026-03-22", trades: 31 },
  { id: 6, name: "Emma Rodriguez",  email: "emma@example.com",    joined: "2026-04-05", trades: 56 },
  { id: 7, name: "Demo User",       email: "demo@outcomx.io",     joined: "2026-04-27", trades: 0  },
];

const avatarColors = [
  "#6366f1","#10b981","#f59e0b","#ec4899","#3b82f6","#8b5cf6","#059669",
];

export default function UsersPage() {
  const { trades, balance } = useStore();
  const { fmt, symbol } = useCurrency();

  const users = mockUsers.map((u) => {
    if (u.id === 7) return { ...u, trades: trades.length, balance };
    return { ...u, balance: 10000 - u.trades * 45 + u.trades * 52 };
  });

  const totalTrades  = users.reduce((s, u) => s + u.trades, 0);
  const avgBalance   = Math.round(users.reduce((s, u) => s + u.balance, 0) / users.length);
  const activeTraders = users.filter((u) => u.trades > 0).length;

  const stats = [
    { label: "Total Users",    value: users.length,  color: "#6366f1", icon: <Users size={20} /> },
    { label: "Total Trades",   value: totalTrades,   color: "var(--emerald)", icon: <Activity size={20} /> },
    { label: "Avg Balance",    value: `${symbol}${avgBalance.toLocaleString()}`, color: "#f59e0b", icon: <DollarSign size={20} /> },
    { label: "Active Traders", value: activeTraders, color: "#ec4899", icon: <UserCheck size={20} /> },
  ];

  return (
    <div style={{ padding: "28px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "linear-gradient(135deg, #ec4899, #db2777)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Users size={22} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Users</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Mock user accounts for simulation</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14, marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.label} className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
                  {s.label}
                </p>
                <p style={{ fontSize: 24, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
              </div>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `${s.color}18`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: s.color,
              }}>
                {s.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden", padding: 0 }}>
        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 200px 100px 70px 110px",
          padding: "11px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-primary)",
        }}>
          {["User", "Email", "Joined", "Trades", "Balance"].map((h) => (
            <span key={h} style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>
              {h}
            </span>
          ))}
        </div>

        {users.map((user, i) => (
          <div
            key={user.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 200px 100px 70px 110px",
              padding: "13px 20px",
              borderBottom: "1px solid var(--border)",
              alignItems: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {/* Name + avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: avatarColors[i % avatarColors.length],
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "white", flexShrink: 0,
              }}>
                {user.name.charAt(0)}
              </div>
              <div>
                <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0, fontWeight: 600 }}>
                  {user.name}
                  {user.id === 7 && (
                    <span style={{
                      marginLeft: 7, fontSize: 10,
                      background: "var(--emerald-bg)", color: "var(--emerald)",
                      padding: "1px 6px", borderRadius: 4, fontWeight: 700,
                    }}>
                      YOU
                    </span>
                  )}
                </p>
              </div>
            </div>

            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{user.email}</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{user.joined}</span>
            <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{user.trades}</span>
            <span style={{ fontSize: 13, color: "var(--emerald)", fontWeight: 700 }}>
              {fmt(user.balance)}
            </span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14, textAlign: "center" }}>
        Mock user data for simulation purposes only
      </p>
    </div>
  );
}
