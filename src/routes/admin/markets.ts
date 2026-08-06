import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../../db/client';
import {
  calcEqualProbabilities,
  calcExpiresAt,
  validateAndNormaliseProbs,
} from '../../services/marketService';
import { seedInitialSnapshot } from '../../services/marketHistoryService';
import { fetchPrice } from '../../services/priceFeedService';
import { DbMarket, DbMarketOutcome, toApiMarket } from '../../types';
import { emitter } from '../../events';

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
  // Accept either a regular URL or a base64 data URL (data:image/...)
  banner:            z.string().refine(
    v => v.startsWith('data:image/') || /^https?:\/\//.test(v),
    { message: 'Banner must be a valid URL or a base64 data URL (data:image/...)' }
  ).optional(),
  resolution_source: z.string().max(500).optional(),
  // Live-price tracking — UP_DOWN markets only. Presence of price_asset_id
  // marks the market for automatic price-based resolution at expiry.
  price_asset_id:     z.string().min(1).optional(),
  price_asset_symbol: z.string().min(1).max(20).optional(),
});

const updateMarketSchema = z.object({
  title:             z.string().min(10).max(300).optional(),
  category:          z.enum(CATEGORIES).optional(),
  image:             z.string().url().optional(),
  // Accept either a regular URL or a base64 data URL (data:image/...)
  banner:            z.string().refine(
    v => v.startsWith('data:image/') || /^https?:\/\//.test(v),
    { message: 'Banner must be a valid URL or a base64 data URL (data:image/...)' }
  ).optional(),
  resolution_source: z.string().max(500).optional(),
  status:            z.enum(['open', 'closed']).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOutcomes(marketId: number): Promise<DbMarketOutcome[]> {
  return db.prepare<DbMarketOutcome>(
    'SELECT * FROM market_outcomes WHERE market_id = ? ORDER BY id ASC',
  ).all(marketId);
}

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { search, status, category } = req.query;

  let query = `
    SELECT m.*, COUNT(t.id) as trade_count
    FROM markets m
    LEFT JOIN trades t ON t.market_id = m.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (search)   { query += ' AND m.title ILIKE ?';   params.push(`%${search}%`); }
  if (status)   { query += ' AND m.status = ?';      params.push(status); }
  if (category) { query += ' AND m.category = ?';    params.push(category); }

  query += ' GROUP BY m.id ORDER BY m.created_at DESC';

  const rows = await db.prepare<DbMarket>(query).all(...params);

  const data = await Promise.all(rows.map(async r => toApiMarket(r, await getOutcomes(r.id))));
  res.status(200).json({ success: true, data });
});

// ─── GET /featured ────────────────────────────────────────────────────────────
// Admin view — all featured markets regardless of status, ordered by position.
// MUST be registered before /:id routes to avoid "featured" being parsed as an id.

router.get('/featured', async (req: Request, res: Response): Promise<void> => {
  const rows = await db.prepare<DbMarket>(
    'SELECT * FROM markets WHERE featured = true ORDER BY featured_order ASC',
  ).all();

  const data = await Promise.all(rows.map(async r => toApiMarket(r, await getOutcomes(r.id))));
  res.status(200).json({ success: true, data });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = createMarketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const {
    title, category, type, options, duration,
    image, banner, resolution_source,
    price_asset_id, price_asset_symbol,
  } = parsed.data;

  // ── Live-price tracking is UP_DOWN only ──────────────────────────────────
  if (price_asset_id && type !== 'UP_DOWN') {
    res.status(400).json({ success: false, error: 'Live price tracking is only available for Up/Down markets' });
    return;
  }

  // ── Fetch the real opening price before creating anything ───────────────
  // Done outside the DB transaction — if the fetch fails, reject rather
  // than create a half-configured market with no opening price to resolve against.
  let openingPrice: number | null = null;
  if (price_asset_id) {
    try {
      openingPrice = await fetchPrice(price_asset_id);
    } catch (err) {
      const error = err as Error;
      res.status(502).json({ success: false, error: `Could not fetch opening price: ${error.message}` });
      return;
    }
    if (openingPrice === null) {
      res.status(400).json({ success: false, error: `Unknown or unsupported coin id: "${price_asset_id}"` });
      return;
    }
  }

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

  const expiresAt = await calcExpiresAt(duration);

  // ── Insert market + outcomes atomically ──────────────────────────────────
  const marketId = await db.transaction(async (tx) => {
    const result = await tx.prepare(`
      INSERT INTO markets
        (title, category, type, options, probabilities, duration,
         expires_at, image, banner, resolution_source,
         price_asset_id, price_asset_symbol, opening_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
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
      price_asset_id     ?? null,
      price_asset_symbol ?? null,
      openingPrice,
    );

    const id = result.lastInsertRowid as number;

    // Insert one market_outcomes row per outcome
    for (const label of finalOptions) {
      const pct = probabilities[label] ?? 0;
      await tx.prepare(`
        INSERT INTO market_outcomes (market_id, label, probability, pool_amount)
        VALUES (?, ?, ?, 0)
      `).run(id, label, pct / 100);
    }

    // Seed opening price history snapshot
    await seedInitialSnapshot(tx, id, finalOptions, probabilities, openingPrice);

    return id;
  });

  const market   = await db.prepare<DbMarket>('SELECT * FROM markets WHERE id = ?').get(marketId);
  const outcomes = await getOutcomes(marketId);

  res.status(201).json({ success: true, data: toApiMarket(market!, outcomes) });
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────────

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid market ID' }); return; }

  const parsed = updateMarketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const market = await db.prepare<DbMarket>('SELECT * FROM markets WHERE id = ?').get(id);
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
  await db.prepare(`UPDATE markets SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated  = await db.prepare<DbMarket>('SELECT * FROM markets WHERE id = ?').get(id);
  const outcomes = await getOutcomes(id);

  res.status(200).json({ success: true, data: toApiMarket(updated!, outcomes) });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
// Admin can delete any market regardless of status.
// FK cascade handles trades, market_outcomes, and price_history.

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid market ID' }); return; }

  const market = await db.prepare('SELECT * FROM markets WHERE id = ?').get(id);
  if (!market) { res.status(404).json({ success: false, error: 'Market not found' }); return; }

  await db.prepare('DELETE FROM markets WHERE id = ?').run(id);

  res.status(200).json({ success: true });
});

// ─── PATCH /:id/trending ─────────────────────────────────────────────────────

const trendingSchema = z.object({
  trending:      z.boolean(),
  trendingOrder: z.number().int().min(0).default(0),
});

router.patch('/:id/trending', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid market ID' }); return; }

  const parsed = trendingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const market = await db.prepare<DbMarket>('SELECT * FROM markets WHERE id = ?').get(id);
  if (!market) { res.status(404).json({ success: false, error: 'Market not found' }); return; }

  const { trending, trendingOrder } = parsed.data;
  await db.prepare(`
    UPDATE markets SET trending = ?, trending_order = ? WHERE id = ?
  `).run(trending, trendingOrder, id);

  const updated  = await db.prepare<DbMarket>('SELECT * FROM markets WHERE id = ?').get(id);
  const outcomes = await getOutcomes(id);

  res.status(200).json({ success: true, data: toApiMarket(updated!, outcomes) });
});

// ─── PATCH /:id/feature ───────────────────────────────────────────────────────

const featureSchema = z.object({
  featured:      z.boolean(),
  featuredOrder: z.number().int().min(0).default(0),
  heroTag:       z.string().max(100).optional(),
  heroSub:       z.string().max(200).optional(),
  heroAccent:    z.string().max(20).optional(),
  // .optional() must come BEFORE .refine() so that undefined is passed
  // through without triggering the validation — otherwise Zod calls the
  // refine predicate on undefined and the check crashes / always fails.
  heroBanner:    z.string().optional().refine(
    v => !v || v.startsWith('data:image/') || /^https?:\/\//.test(v),
    { message: 'heroBanner must be a valid image URL or base64 data URL' },
  ),
  // z.string().url() rejects relative paths like "/" or "/?category=sports"
  // — use a plain string with a length cap so the admin can link to any
  // internal route without validation errors.
  heroHref:      z.string().max(500).optional(),
});

router.patch('/:id/feature', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid market ID' }); return; }

  const parsed = featureSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const market = await db.prepare<DbMarket>('SELECT * FROM markets WHERE id = ?').get(id);
  if (!market) { res.status(404).json({ success: false, error: 'Market not found' }); return; }

  const { featured, featuredOrder, heroTag, heroSub, heroAccent, heroBanner, heroHref } = parsed.data;
  await db.prepare(`
    UPDATE markets
    SET featured = ?, featured_order = ?, hero_tag = ?, hero_sub = ?, hero_accent = ?, hero_banner = ?, hero_href = ?
    WHERE id = ?
  `).run(featured, featuredOrder, heroTag ?? null, heroSub ?? null, heroAccent ?? null, heroBanner ?? null, heroHref ?? null, id);

  const updated  = await db.prepare<DbMarket>('SELECT * FROM markets WHERE id = ?').get(id);
  const outcomes = await getOutcomes(id);

  res.status(200).json({ success: true, data: toApiMarket(updated!, outcomes) });
});

// ─── PATCH /:id/toggle ────────────────────────────────────────────────────────

router.patch('/:id/toggle', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid market ID' }); return; }

  const market = await db.prepare<DbMarket>('SELECT * FROM markets WHERE id = ?').get(id);
  if (!market) { res.status(404).json({ success: false, error: 'Market not found' }); return; }

  if (market.status === 'settled') {
    res.status(400).json({ success: false, error: 'Cannot toggle a settled market' });
    return;
  }

  const newStatus = market.status === 'open' ? 'closed' : 'open';
  await db.prepare('UPDATE markets SET status = ? WHERE id = ?').run(newStatus, id);

  if (newStatus === 'closed') {
    emitter.marketClosed({ marketId: id, reason: 'manual', timestamp: new Date().toISOString() });
  }

  const updated  = await db.prepare<DbMarket>('SELECT * FROM markets WHERE id = ?').get(id);
  const outcomes = await getOutcomes(id);

  res.status(200).json({ success: true, data: toApiMarket(updated!, outcomes) });
});

export default router;
