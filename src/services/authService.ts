import jwt from 'jsonwebtoken';
import db from '../db/client';
import config from '../config';

// ─── Region data ─────────────────────────────────────────────────────────────

const REGION_STARTING_BALANCES: Record<string, number> = {
  nigeria:      50000,
  ghana:         1000,
  kenya:        10000,
  uk:             500,
  usa:            500,
  europe:         500,
  southafrica:   5000,
  other:          500,
};

const REGION_MIN_STAKES: Record<string, number> = {
  nigeria:     1500,
  ghana:         15,
  kenya:        130,
  uk:          0.79,
  usa:         0.99,
  europe:      0.92,
  southafrica:   18,
  other:       0.99,
};

// ─── Exported helpers ─────────────────────────────────────────────────────────

export function getStartingBalance(region: string): number {
  return REGION_STARTING_BALANCES[region.toLowerCase()] ?? REGION_STARTING_BALANCES['other'];
}

export function getMinStake(region: string): number {
  return REGION_MIN_STAKES[region.toLowerCase()] ?? REGION_MIN_STAKES['other'];
}

export function generateToken(userId: number, isAdmin: boolean): string {
  return jwt.sign(
    { sub: userId, isAdmin },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions,
  );
}

export function blacklistToken(token: string, expiresAt: Date): void {
  // Insert the token into the blacklist
  db.prepare(`
    INSERT OR IGNORE INTO token_blacklist (token, expires_at)
    VALUES (?, datetime(?, 'unixepoch'))
  `).run(token, Math.floor(expiresAt.getTime() / 1000));

  // Clean up expired tokens while we're here
  db.prepare(`
    DELETE FROM token_blacklist WHERE expires_at < datetime('now')
  `).run();
}
