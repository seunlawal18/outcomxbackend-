// ── Demo User Credentials ─────────────────────────────────────────
// 7 demo accounts for investor presentations and showcases.
// These are used as an offline fallback when the backend is unreachable,
// AND are seeded into the backend database by the backend seed script.

import { DEFAULT_REGION } from "./credits";
import type { UserProfile } from "./types";

export interface DemoUser {
  email:    string;
  password: string;
  profile:  Omit<UserProfile, "displayCurrency">;
  balance:  number; // in credits (USD)
  label:    string; // short display label for the login picker
  emoji:    string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    email:    "alex@demo.outcomx.com",
    password: "Demo1234!",
    label:    "Alex — Power Trader",
    emoji:    "⚡",
    balance:  2500,
    profile: {
      name:       "Alex Rivera",
      username:   "alex_rivera",
      bio:        "Crypto & politics prediction specialist. 3 years on prediction markets.",
      avatar:     "",
      joinedAt:   "2025-01-15",
      region:     "usa",
      isVerified: true,
    },
  },
  {
    email:    "sarah@demo.outcomx.com",
    password: "Demo1234!",
    label:    "Sarah — Sports Analyst",
    emoji:    "🏆",
    balance:  1800,
    profile: {
      name:       "Sarah Chen",
      username:   "sarah_chen",
      bio:        "Sports market analyst. I live for the underdog picks.",
      avatar:     "",
      joinedAt:   "2025-03-22",
      region:     "uk",
      isVerified: true,
    },
  },
  {
    email:    "marcus@demo.outcomx.com",
    password: "Demo1234!",
    label:    "Marcus — New Trader",
    emoji:    "🚀",
    balance:  500,
    profile: {
      name:       "Marcus Johnson",
      username:   "marcus_j",
      bio:        "Just getting started. Learning the ropes of prediction markets.",
      avatar:     "",
      joinedAt:   "2026-05-01",
      region:     "nigeria",
      isVerified: false,
    },
  },
  {
    email:    "priya@demo.outcomx.com",
    password: "Demo1234!",
    label:    "Priya — Finance Expert",
    emoji:    "📈",
    balance:  4200,
    profile: {
      name:       "Priya Sharma",
      username:   "priya_sharma",
      bio:        "Finance & economics trader. Former investment analyst.",
      avatar:     "",
      joinedAt:   "2024-11-10",
      region:     "europe",
      isVerified: true,
    },
  },
  {
    email:    "kofi@demo.outcomx.com",
    password: "Demo1234!",
    label:    "Kofi — Esports Fan",
    emoji:    "🎮",
    balance:  750,
    profile: {
      name:       "Kofi Mensah",
      username:   "kofi_m",
      bio:        "Esports and entertainment markets are my playground.",
      avatar:     "",
      joinedAt:   "2025-08-30",
      region:     "ghana",
      isVerified: true,
    },
  },
  {
    email:    "isabella@demo.outcomx.com",
    password: "Demo1234!",
    label:    "Isabella — Whale",
    emoji:    "🐋",
    balance:  15000,
    profile: {
      name:       "Isabella Costa",
      username:   "isa_costa",
      bio:        "Big positions, big conviction. Long-term market thinker.",
      avatar:     "",
      joinedAt:   "2024-06-01",
      region:     "europe",
      isVerified: true,
    },
  },
  {
    email:    "david@demo.outcomx.com",
    password: "Demo1234!",
    label:    "David — Casual Bettor",
    emoji:    "😎",
    balance:  300,
    profile: {
      name:       "David Okafor",
      username:   "david_ok",
      bio:        "Weekend trader. Just here for the vibes and a little profit.",
      avatar:     "",
      joinedAt:   "2026-04-10",
      region:     "nigeria",
      isVerified: false,
    },
  },
];

// Quick lookup by email (case-insensitive)
export function findDemoUser(email: string): DemoUser | undefined {
  return DEMO_USERS.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
}

// Legacy single demo alias — kept for backward compatibility
export const DEMO_EMAIL    = DEMO_USERS[0].email;
export const DEMO_PASSWORD = DEMO_USERS[0].password;
