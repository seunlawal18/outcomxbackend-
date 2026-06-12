import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../../db/client';
import {
  calcEqualProbabilities,
  calcExpiresAt,
  validateAndNormaliseProbs,
} from '../../services/marketService';
import { seedInitialSnapshot } from '../../services/marketHistoryService';
import { DbMarket, DbMarketOutcome, toApiMarket } from '../../types';

const router = Router();

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'sports', 'crypto', 'politics', 'finance',
  'esports', 'entertainment', 'economy',
] as const;

const TYPES = ['YES_NO', 'UP_DOWN', 'MULTI', 'MULTI_YESNO'] as const;

const DURATIONS = [
  '5min', '15min', '1hour', '4hours',
  'daily', 'weekly', 'monthly', 'yearly',
] as const;

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const createMarketSchema = z.object({
  title:             z.string().min(10, 'Title must be at least 10 characters').max(300),
  category:          z.enum(CATEGORIES, { errorMap: () => ({ message: 'Invalid category' }) }),
  type:              z.enum(TYPES,      { errorMap: () => ({ message: 'Invalid type' }) }),
  // options: any array of 2–10 non-empty unique strings — no label enforcement
  options:           z.array(z.string().min(1)).min(2).max(10),
  duration:          z.enum(DURATIONS,  { errorMap: () => ({ message: 'Invalid duration' }) }),
  // probabilities: optional — admin can supply opening probs or let system equalise
  probabilities:     z.record(z.string(), z.number().positive()).optional(),
  image:             z.string().url('Image must be a valid URL').optional(),
  banner:            z.string().url('Banner must be a valid URL').optional(),
  resolution_source: z.string().max(500).optional(),
});

const updateMarketSchema = z.object({
  title:             z.string().min(10).max(300).optional(),
  category:          z.enum(CATEGORIES).optional(),
  image:             z.string().url().optional(),
  banner:            z.string().url().optional(),
  resolution_source: z.string().max(500).optional(),
  status:            z.enum(['open', 'closed']).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOutcomes(marketId: number): DbMarketOutcome[] {
  return db.prepare(
    'SELECT * FROM market_outcomes WHERE market_id = ? ORDER BY id ASC',
  ).all(marketId) as DbMarketOutcome[];
}

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', (req: Request, res: Response): void => {
  const { search, status, category } = req.query;

  let query = `
    SELECT m.*, COUNT(t.id) as trade_count
    FROM markets m
    LEFT JOIN trades t ON t.market_id = m.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (search)   { query += ' AND m.title LIKE ? COLLATE NOCASE'; params.push(`%${search}%`); }
  if (status)   { query += ' AND m.status = ?';                  params.push(status); }
  if (category) { query += ' AND m.category = ?';                params.push(category); }

  query += ' GROUP BY m.id ORDER BY m.created_at DESC';

  const rows = db.prepare(query).all(...params) as DbMarket[];

  res.status(200).json({
    success: true,
    data: rows.map(r => toApiMarket(r, getOutcomes(r.id))),
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

router.post('/', (req: Request, res: Response): void => {
  const parsed = createMarketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const {
    title, category, type, options, duration,
    image, banner, resolution_source,
  } = parsed.data;

  // ── Validate options uniqueness ──────────────────────────────────────────
  const trimmed = options.map(o => o.trim());
  const unique  = new Set(trimmed.map(o => o.toLowerCase()));
  if (unique.size !== trimmed.length) {
    res.status(400).json({ success: false, error: 'All outcome labels must be unique' });
    return;
  }

  // ── Validate minimum option counts per type ──────────────────────────────
  if ((type === 'YES_NO' || type === 'UP_DOWN') && trimmed.length !== 2) {
    res.status(400).json({
      success: false,
      error: `${type} markets must have exactly 2 outcomes`,
    });
    return;
  }
  if ((type === 'MULTI' || type === 'MULTI_YESNO') && trimmed.length < 2) {
    res.status(400).json({ success: false, error: 'Markets must have 2-10 unique non-empty options' });
    return;
  }

  // ── MULTI_YESNO: options are stored exactly as entered (base labels only) ──
  // e.g. ["Chelsea", "Draw", "Man United"] — NO :Yes/:No expansion here.
  // The :Yes/:No suffix only appears in the trades.option column when a user
  // places a trade. It must never appear in markets.options.
  const finalOptions = trimmed;

  // ── Resolve opening probabilities ────────────────────────────────────────
  // Probabilities are always keyed by the option labels as stored (base labels).
  // This works for all types — including MULTI_YESNO.
  let probabilities: Record<string, number>;
  try {
    probabilities = parsed.data.probabilities
      ? validateAndNormaliseProbs(trimmed, parsed.data.probabilities)
      : calcEqualProbabilities(trimmed);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 400).json({ success: false, error: e.message });
    return;
  }

  const expiresAt = calcExpiresAt(duration);

  // ── Insert market + outcomes atomically ──────────────────────────────────
  let marketId!: number;

  db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO markets
        (title, category, type, options, probabilities, duration,
         expires_at, image, banner, resolution_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      category,
      type,
      JSON.stringify(finalOptions),
      JSON.stringify(probabilities),
      duration,
      expiresAt,
      image             ?? null,
      banner            ?? null,
      resolution_source ?? null,
    );

    marketId = result.lastInsertRowid as number;

    // Insert one market_outcomes row per outcome
    const insertOutcome = db.prepare(`
      INSERT INTO market_outcomes (market_id, label, probability, pool_amount)
      VALUES (?, ?, ?, 0)
    `);

    for (const label of finalOptions) {
      const pct = probabilities[label] ?? 0;
      insertOutcome.run(marketId, label, pct / 100);
    }

    // Seed opening price history snapshot
    seedInitialSnapshot(marketId, finalOptions, probabilities);
  })();

  const market   = db.prepare('SELECT * FROM markets WHERE id = ?').get(marketId) as DbMarket;
  const outcomes = getOutcomes(marketId);

  res.status(201).json({ success: true, data: toApiMarket(market, outcomes) });
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────────

router.patch('/:id', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid market ID' }); return; }

  const parsed = updateMarketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const market = db.prepare('SELECT * FROM markets WHERE id = ?').get(id) as DbMarket | undefined;
  if (!market) { res.status(404).json({ success: false, error: 'Market not found' }); return; }

  const { title, category, image, banner, resolution_source, status } = parsed.data;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (title             !== undefined) { fields.push('title = ?');             values.push(title); }
  if (category          !== undefined) { fields.push('category = ?');          values.push(category); }
  if (image             !== undefined) { fields.push('image = ?');             values.push(image); }
  if (banner            !== undefined) { fields.push('banner = ?');            values.push(banner); }
  if (resolution_source !== undefined) { fields.push('resolution_source = ?'); values.push(resolution_source); }
  if (status            !== undefined) { fields.push('status = ?');            values.push(status); }

  if (fields.length === 0) {
    res.status(400).json({ success: false, error: 'No fields provided to update' });
    return;
  }

  values.push(id);
  db.prepare(`UPDATE markets SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated  = db.prepare('SELECT * FROM markets WHERE id = ?').get(id) as DbMarket;
  const outcomes = getOutcomes(id);

  res.status(200).json({ success: true, data: toApiMarket(updated, outcomes) });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
// Admin can delete any market regardless of status.
// FK cascade handles trades, market_outcomes, and price_history.

router.delete('/:id', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid market ID' }); return; }

  const market = db.prepare('SELECT * FROM markets WHERE id = ?').get(id) as DbMarket | undefined;
  if (!market) { res.status(404).json({ success: false, error: 'Market not found' }); return; }

  db.prepare('DELETE FROM markets WHERE id = ?').run(id);

  res.status(200).json({ success: true });
});

// ─── PATCH /:id/toggle ────────────────────────────────────────────────────────

router.patch('/:id/toggle', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid market ID' }); return; }

  const market = db.prepare('SELECT * FROM markets WHERE id = ?').get(id) as DbMarket | undefined;
  if (!market) { res.status(404).json({ success: false, error: 'Market not found' }); return; }

  if (market.status === 'settled') {
    res.status(400).json({ success: false, error: 'Cannot toggle a settled market' });
    return;
  }

  const newStatus = market.status === 'open' ? 'closed' : 'open';
  db.prepare('UPDATE markets SET status = ? WHERE id = ?').run(newStatus, id);

  const updated  = db.prepare('SELECT * FROM markets WHERE id = ?').get(id) as DbMarket;
  const outcomes = getOutcomes(id);

  res.status(200).json({ success: true, data: toApiMarket(updated, outcomes) });
});

export default router;
