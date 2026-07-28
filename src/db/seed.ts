import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import db from './client';
import { applySchema } from './schema';
import config from '../config';

export async function runSeed(): Promise<void> {
  // ── Admin user (upsert — no-op if already exists) ──────────────────────
  const existing = await db.prepare<{ id: number }>(
    "SELECT id FROM users WHERE email = 'admin@outcomx.com'",
  ).get();

  if (!existing) {
    const adminHash = await bcrypt.hash('admin123', config.bcryptRounds);
    await db.prepare(`
      INSERT INTO users (email, password_hash, name, username, region, balance, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('admin@outcomx.com', adminHash, 'OUTCOMX Admin', 'outcomx_admin', 'nigeria', 0, 1);
    console.log('  ✓ Admin user created: admin@outcomx.com');
  }

  console.log('✓ Seed complete');
}

// Allow running directly: tsx src/db/seed.ts
if (require.main === module) {
  applySchema()
    .then(() => runSeed())
    .then(() => process.exit(0))
    .catch(err => { console.error('Seed failed:', err); process.exit(1); });
}
