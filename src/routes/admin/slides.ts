import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../../db/client';

const router = Router();

// ─── DB row type ──────────────────────────────────────────────────────────────

interface DbPromoSlide {
  id: number;
  slide_order: number;
  tag: string | null;
  headline: string | null;
  subheadline: string | null;
  cta_text: string | null;
  cta_href: string | null;
  banner_image: string | null;
  accent_color: string;
  active: boolean;
  created_at: string;
}

function toApiSlide(row: DbPromoSlide) {
  return {
    id:          row.id,
    slideOrder:  row.slide_order,
    tag:         row.tag,
    headline:    row.headline,
    subheadline: row.subheadline,
    ctaText:     row.cta_text,
    ctaHref:     row.cta_href,
    bannerImage: row.banner_image,
    accentColor: row.accent_color,
    active:      Boolean(row.active),
    createdAt:   row.created_at,
  };
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

// Required: slideOrder, accentColor, active
// Optional: headline, tag, subheadline, ctaText, ctaHref, bannerImage
// Reject only if BOTH headline and bannerImage are absent/empty

const createSlideSchema = z.object({
  slideOrder:  z.number().int().min(0),
  accentColor: z.string().min(1, 'accentColor is required').max(30),
  active:      z.union([z.boolean(), z.number()]).transform(v => Boolean(v)),
  headline:    z.string().max(200).nullish().transform(v => v || null),
  subheadline: z.string().max(300).nullish().transform(v => v ?? null),
  tag:         z.string().max(100).nullish().transform(v => v ?? null),
  ctaText:     z.string().max(100).nullish().transform(v => v ?? null),
  ctaHref:     z.string().max(500).nullish().transform(v => v ?? null),
  bannerImage: z.string().nullish().transform(v => v ?? null),
}).refine(
  data => !!(data.headline?.trim() || data.bannerImage?.trim()),
  { message: 'At least one of headline or bannerImage is required' },
);

const updateSlideSchema = z.object({
  slideOrder:  z.number().int().min(0).optional(),
  accentColor: z.string().min(1).max(30).optional(),
  active:      z.union([z.boolean(), z.number()]).transform(v => Boolean(v)).optional(),
  headline:    z.string().max(200).nullish().transform(v => v || null),
  subheadline: z.string().max(300).nullish().transform(v => v ?? null),
  tag:         z.string().max(100).nullish().transform(v => v ?? null),
  ctaText:     z.string().max(100).nullish().transform(v => v ?? null),
  ctaHref:     z.string().max(500).nullish().transform(v => v ?? null),
  bannerImage: z.string().nullish().transform(v => v ?? null),
});

// ─── GET / — all slides ───────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.prepare<DbPromoSlide>(
    'SELECT * FROM promo_slides ORDER BY slide_order ASC, created_at DESC',
  ).all();
  res.status(200).json({ success: true, data: rows.map(toApiSlide) });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = createSlideSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { slideOrder, accentColor, active, headline, subheadline, tag, ctaText, ctaHref, bannerImage } = parsed.data;

  const row = (await db.prepare<DbPromoSlide>(`
    INSERT INTO promo_slides (slide_order, tag, headline, subheadline, cta_text, cta_href, banner_image, accent_color, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `).get(
    slideOrder,
    tag         ?? null,
    headline    ?? null,
    subheadline ?? null,
    ctaText     ?? null,
    ctaHref     ?? null,
    bannerImage ?? null,
    accentColor,
    active,
  ))!;

  res.status(201).json({ success: true, data: toApiSlide(row) });
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────────

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid slide ID' }); return; }

  const parsed = updateSlideSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const slide = await db.prepare<DbPromoSlide>('SELECT * FROM promo_slides WHERE id = ?').get(id);
  if (!slide) { res.status(404).json({ success: false, error: 'Slide not found' }); return; }

  const { slideOrder, accentColor, active, headline, subheadline, tag, ctaText, ctaHref, bannerImage } = parsed.data;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (slideOrder  !== undefined) { fields.push('slide_order = ?');  values.push(slideOrder); }
  if (accentColor !== undefined) { fields.push('accent_color = ?'); values.push(accentColor); }
  if (active      !== undefined) { fields.push('active = ?');       values.push(active); }
  if (headline    !== undefined) { fields.push('headline = ?');     values.push(headline); }
  if (subheadline !== undefined) { fields.push('subheadline = ?');  values.push(subheadline); }
  if (tag         !== undefined) { fields.push('tag = ?');          values.push(tag); }
  if (ctaText     !== undefined) { fields.push('cta_text = ?');     values.push(ctaText); }
  if (ctaHref     !== undefined) { fields.push('cta_href = ?');     values.push(ctaHref); }
  if (bannerImage !== undefined) { fields.push('banner_image = ?'); values.push(bannerImage); }

  if (fields.length === 0) {
    res.status(400).json({ success: false, error: 'No fields provided to update' });
    return;
  }

  values.push(id);
  const updated = (await db.prepare<DbPromoSlide>(
    `UPDATE promo_slides SET ${fields.join(', ')} WHERE id = ? RETURNING *`,
  ).get(...values))!;

  res.status(200).json({ success: true, data: toApiSlide(updated) });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid slide ID' }); return; }

  const slide = await db.prepare('SELECT id FROM promo_slides WHERE id = ?').get(id);
  if (!slide) { res.status(404).json({ success: false, error: 'Slide not found' }); return; }

  await db.prepare('DELETE FROM promo_slides WHERE id = ?').run(id);
  res.status(200).json({ success: true });
});

export default router;

