import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import db from './client';
import { applySchema } from './schema';
import config from '../config';
import { extractBinaryPrices } from '../services/marketHistoryService';

interface MarketSeed {
  title:             string;
  category:          string;
  type:              string;
  options:           string[];
  probabilities:     Record<string, number>;
  duration:          string;
  expiresOffset:     string;
  volume:            number;
  trending:          number;
  status?:           string;
  result?:           string;
  resolution_source?: string;
}

const MARKETS: MarketSeed[] = [
  {
    title: 'Arsenal vs Newcastle — Who wins?',
    category: 'sports', type: 'MULTI',
    options: ['Arsenal', 'Draw', 'Newcastle'],
    probabilities: { Arsenal: 55, Draw: 25, Newcastle: 20 },
    duration: 'daily', expiresOffset: '+6 hours',
    volume: 381800000, trending: 1,
    resolution_source: 'Official Premier League match result',
  },
  {
    title: 'BTC Up or Down in 5 Min?',
    category: 'crypto', type: 'UP_DOWN',
    options: ['Up', 'Down'],
    probabilities: { Up: 49, Down: 51 },
    duration: '5min', expiresOffset: '+0 minutes',
    volume: 26000000, trending: 1,
    resolution_source: 'Binance BTC/USDT spot price',
  },
  {
    title: 'Will Democrats sweep the 2026 Midterms?',
    category: 'politics', type: 'YES_NO',
    options: ['Yes', 'No'],
    probabilities: { Yes: 50, No: 50 },
    duration: 'monthly', expiresOffset: '+720 hours',
    volume: 6000000, trending: 1,
    resolution_source: 'Official US election results',
  },
  {
    title: 'Fed Decision in July — No Change?',
    category: 'economy', type: 'YES_NO',
    options: ['Yes', 'No'],
    probabilities: { Yes: 85, No: 15 },
    duration: 'weekly', expiresOffset: '+180 hours',
    volume: 4000000, trending: 0,
    resolution_source: 'Federal Reserve official statement',
  },
  {
    title: 'Will MicroStrategy announce a BTC purchase April 28?',
    category: 'crypto', type: 'YES_NO',
    options: ['Yes', 'No'],
    probabilities: { Yes: 77, No: 23 },
    duration: '15min', expiresOffset: '+15 minutes',
    volume: 84000, trending: 1,
  },
  {
    title: 'Largest Company end of May 2026?',
    category: 'finance', type: 'MULTI',
    options: ['NVIDIA', 'Apple', 'Alphabet', 'Microsoft'],
    probabilities: { NVIDIA: 97, Apple: 1, Alphabet: 1, Microsoft: 1 },
    duration: 'monthly', expiresOffset: '+744 hours',
    volume: 161000, trending: 0,
    resolution_source: 'Bloomberg market cap data',
  },
  {
    title: 'T1 vs Team Liquid — Who wins Worlds?',
    category: 'esports', type: 'MULTI',
    options: ['T1', 'Team Liquid', 'Other'],
    probabilities: { T1: 62, 'Team Liquid': 28, Other: 10 },
    duration: 'weekly', expiresOffset: '+48 hours',
    volume: 520000, trending: 1,
    resolution_source: 'Riot Games official Worlds bracket',
  },
  {
    title: 'Will Ethereum hit $2,600 in April?',
    category: 'crypto', type: 'YES_NO',
    options: ['Yes', 'No'],
    probabilities: { Yes: 3, No: 97 },
    duration: '1hour', expiresOffset: '+1 hour',
    volume: 840000, trending: 0,
    resolution_source: 'Coinbase ETH/USD spot price',
  },
  {
    title: 'Will Avengers: Doomsday break $1B opening weekend?',
    category: 'entertainment', type: 'YES_NO',
    options: ['Yes', 'No'],
    probabilities: { Yes: 68, No: 32 },
    duration: 'weekly', expiresOffset: '+72 hours',
    volume: 230000, trending: 1,
    resolution_source: 'Box Office Mojo opening weekend gross',
  },
  {
    title: 'ECB Interest Rates April 2026 — No Change?',
    category: 'economy', type: 'YES_NO',
    options: ['Yes', 'No'],
    probabilities: { Yes: 98, No: 2 },
    duration: 'monthly', expiresOffset: '+480 hours',
    volume: 840000, trending: 0,
    resolution_source: 'European Central Bank official press release',
  },
  {
    title: 'Man City vs Real Madrid — Champions League Final',
    category: 'sports', type: 'MULTI',
    options: ['Man City', 'Draw', 'Real Madrid'],
    probabilities: { 'Man City': 45, Draw: 22, 'Real Madrid': 33 },
    duration: '4hours', expiresOffset: '+4 hours',
    volume: 1200000, trending: 1,
    resolution_source: 'UEFA official Champions League result',
  },
  {
    title: 'Will inflation drop below 3% by June 2026?',
    category: 'economy', type: 'YES_NO',
    options: ['Yes', 'No'],
    probabilities: { Yes: 42, No: 58 },
    duration: 'yearly', expiresOffset: '+8760 hours',
    volume: 3200000, trending: 0,
    resolution_source: 'US Bureau of Labor Statistics CPI report',
  },
  {
    title: 'Will Pro Football OBJ sign with a team in 2026?',
    category: 'sports', type: 'YES_NO',
    options: ['Yes', 'No'],
    probabilities: { Yes: 44, No: 56 },
    duration: 'weekly', expiresOffset: '-1 hour',
    volume: 44000, trending: 0,
    status: 'closed',
  },
  {
    title: 'Bank of Brazil Decision in April — Decrease?',
    category: 'finance', type: 'YES_NO',
    options: ['Yes', 'No'],
    probabilities: { Yes: 96, No: 4 },
    duration: 'monthly', expiresOffset: '-1 hour',
    volume: 383000, trending: 0,
    status: 'settled', result: 'Yes',
    resolution_source: 'Banco Central do Brasil official statement',
  },
  {
    title: 'Valorant Champions 2026 — Sentinels win?',
    category: 'esports', type: 'YES_NO',
    options: ['Yes', 'No'],
    probabilities: { Yes: 38, No: 62 },
    duration: 'weekly', expiresOffset: '+96 hours',
    volume: 190000, trending: 0,
    resolution_source: 'Riot Games official Valorant Champions bracket',
  },
];

// ─── Demo users seeded on every startup (upserted) ───────────────────────────
const DEMO_USERS = [
  { email: 'demo@outcomx.com',        password: 'demo123',   name: 'Demo User',      username: 'demo_trader',  region: 'nigeria', balance: 500,   bio: 'Demo Account – Simulated Trading',                         verified: true  },
  { email: 'alex@demo.outcomx.com',   password: 'Demo1234!', name: 'Alex Rivera',    username: 'alex_rivera',  region: 'usa',     balance: 2500,  bio: 'Crypto & politics prediction specialist.',                 verified: true  },
  { email: 'sarah@demo.outcomx.com',  password: 'Demo1234!', name: 'Sarah Chen',     username: 'sarah_chen',   region: 'uk',      balance: 1800,  bio: 'Sports market analyst. I live for the underdog picks.',    verified: true  },
  { email: 'marcus@demo.outcomx.com', password: 'Demo1234!', name: 'Marcus Johnson', username: 'marcus_j',     region: 'nigeria', balance: 500,   bio: 'Just getting started. Learning prediction markets.',       verified: false },
  { email: 'priya@demo.outcomx.com',  password: 'Demo1234!', name: 'Priya Sharma',   username: 'priya_sharma', region: 'europe',  balance: 4200,  bio: 'Finance & economics trader. Former investment analyst.',   verified: true  },
  { email: 'kofi@demo.outcomx.com',   password: 'Demo1234!', name: 'Kofi Mensah',    username: 'kofi_m',       region: 'ghana',   balance: 750,   bio: 'Esports and entertainment markets are my playground.',     verified: true  },
  { email: 'isabella@demo.outcomx.com', password: 'Demo1234!', name: 'Isabella Costa', username: 'isa_costa', region: 'europe',  balance: 15000, bio: 'Big positions, big conviction. Long-term market thinker.', verified: true  },
  { email: 'david@demo.outcomx.com',  password: 'Demo1234!', name: 'David Okafor',   username: 'david_ok',     region: 'nigeria', balance: 300,   bio: 'Weekend trader. Just here for the vibes.',                 verified: false },
] as const;

export async function runSeed(): Promise<void> {
  const userCount = (
    (await db.prepare<{ count: number }>('SELECT COUNT(*)::int as count FROM users').get())!
  ).count;

  // ── Always upsert demo users (idempotent) ──────────────────────────────
  for (const u of DEMO_USERS) {
    const existing = await db.prepare<{ id: number }>('SELECT id FROM users WHERE email = ?').get(u.email);
    if (existing) continue;
    const hash = await bcrypt.hash(u.password, config.bcryptRounds);
    await db.prepare(`
      INSERT INTO users (email, password_hash, name, username, region, balance, is_demo, is_verified, bio)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(u.email, hash, u.name, u.username, u.region, u.balance, u.verified ? 1 : 0, u.bio);
    console.log(`  ✓ Demo user seeded: ${u.email}`);
  }

  if (userCount > 0) {
    console.log('✓ Seed data ready');
    return;
  }

  console.log('  Seeding database...');

  const adminHash = await bcrypt.hash('admin123', config.bcryptRounds);

  await db.transaction(async (tx) => {

    // ── Admin user ─────────────────────────────────────────────────────────
    await tx.prepare(`
      INSERT INTO users (email, password_hash, name, username, region, balance, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('admin@outcomx.com', adminHash, 'OUTCOMX Admin', 'outcomx_admin',
           'nigeria', 0, 1);

    // ── Markets + outcomes + history ───────────────────────────────────────
    // expiresOffset (e.g. '+6 hours', '-1 hour') is passed straight through
    // as a Postgres interval literal — its sign and unit text are valid
    // interval syntax as-is, no reformatting needed.
    for (const m of MARKETS) {
      const r = await tx.prepare(`
        INSERT INTO markets
          (title, category, type, options, probabilities, duration,
           expires_at, volume, trending, status, result, resolution_source)
        VALUES
          (?, ?, ?, ?, ?, ?, to_char((NOW() AT TIME ZONE 'UTC') + ?::interval, 'YYYY-MM-DD HH24:MI:SS'), ?, ?, ?, ?, ?)
        RETURNING id
      `).run(
        m.title, m.category, m.type,
        JSON.stringify(m.options),
        JSON.stringify(m.probabilities),
        m.duration, m.expiresOffset,
        m.volume, m.trending,
        m.status  ?? 'open',
        m.result  ?? null,
        m.resolution_source ?? null,
      );

      const marketId = r.lastInsertRowid as number;

      // Insert one outcome row per option
      for (const label of m.options) {
        const pct = m.probabilities[label] ?? 0;
        await tx.prepare(`
          INSERT INTO market_outcomes (market_id, label, probability, pool_amount)
          VALUES (?, ?, ?, 0)
        `).run(marketId, label, pct / 100);
      }

      // Seed opening price history snapshot
      const { yes_price, no_price } = extractBinaryPrices(m.probabilities, m.options);
      await tx.prepare(`
        INSERT INTO market_price_history
          (market_id, probabilities, yes_price, no_price, trade_volume)
        VALUES (?, ?, ?, ?, 0)
      `).run(marketId, JSON.stringify(m.probabilities), yes_price, no_price);
    }

  });

  console.log('✓ Seed data ready');
}

// Allow running directly: tsx src/db/seed.ts
if (require.main === module) {
  applySchema()
    .then(() => runSeed())
    .then(() => process.exit(0))
    .catch(err => { console.error('Seed failed:', err); process.exit(1); });
}
