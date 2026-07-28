import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../../db/client';

const router = Router();

// ─── DB row type ──────────────────────────────────────────────────────────────

interface DbHeroSlide {
  id: number;
  title: string;
  subtitle: string | null;
  tag: string | null;
  cta_label: string | null;
  cta_href: string | null;
  banner_image: string | null;
  accent_color: string;
  gradient: string | null;
  slide_order: number;
  active: boolean;
  created_at: string;
}

function toApiSlide(row: DbHeroSlide) {
  return {
    id:          row.id,
    title:       row.title,
    subtitle:    row.subtitle,
    tag:         row.tag,
    ctaLabel:    row.cta_label,
    ctaHref:     row.cta_href,
    bannerImage: row.banner_image,
    accentColor: row.accent_color,
    gradient:    row.gradient,
    slideOrder:  row.slide_order,
    active:      row.active,
    createdAt:   row.created_at,
  };
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const slideSchema = z.object({
  title:       z.string().min(1, 'Title is required').max(200),
  subtitle:    z.string().max(300).optional(),
  tag:         z.string().max(100).optional(),
  ctaLabel:    z.string().max(100).optional(),
  ctaHref:     z.string().max(500).optional(),
  bannerImage: z.string().refine(
    v => v.startsWith('data:image/') || /^https?:\/\//.test(v),
    { message: 'bannerImage must be a valid URL or base64 data URL' },
  ).optional(),
  accentColor: z.string().max(30).optional(),
  gradient:    z.string().max(500).optional(),
  slideOrder:  z.number().int().min(0).optional(),
  active:      z.boolean().optional(),
});

const updateSlideSchema = slideSchema.partial();

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.prepare<DbHeroSlide>(
    'SELECT * FROM hero_slides ORDER BY slide_order ASC, created_at DESC',
  ).all();
  res.status(200).json({ success: true, data: rows.map(toApiSlide) });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = slideSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { title, subtitle, tag, ctaLabel, ctaHref, bannerImage, accentColor, gradient, slideOrder, active } = parsed.data;

  const row = (await db.prepare<DbHeroSlide>(`
    INSERT INTO hero_slides (title, subtitle, tag, cta_label, cta_href, banner_image, accent_color, gradient, slide_order, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `).get(
    title,
    subtitle    ?? null,
    tag         ?? null,
    ctaLabel    ?? null,
    ctaHref     ?? null,
    bannerImage ?? null,
    accentColor ?? '#6c63ff',
    gradient    ?? null,
    slideOrder  ?? 0,
    active      ?? true,
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

  const slide = await db.prepare<DbHeroSlide>('SELECT * FROM hero_slides WHERE id = ?').get(id);
  if (!slide) { res.status(404).json({ success: false, error: 'Slide not found' }); return; }

  const { title, subtitle, tag, ctaLabel, ctaHref, bannerImage, accentColor, gradient, slideOrder, active } = parsed.data;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (title       !== undefined) { fields.push('title = ?');        values.push(title); }
  if (subtitle    !== undefined) { fields.push('subtitle = ?');     values.push(subtitle); }
  if (tag         !== undefined) { fields.push('tag = ?');          values.push(tag); }
  if (ctaLabel    !== undefined) { fields.push('cta_label = ?');    values.push(ctaLabel); }
  if (ctaHref     !== undefined) { fields.push('cta_href = ?');     values.push(ctaHref); }
  if (bannerImage !== undefined) { fields.push('banner_image = ?'); values.push(bannerImage); }
  if (accentColor !== undefined) { fields.push('accent_color = ?'); values.push(accentColor); }
  if (gradient    !== undefined) { fields.push('gradient = ?');     values.push(gradient); }
  if (slideOrder  !== undefined) { fields.push('slide_order = ?');  values.push(slideOrder); }
  if (active      !== undefined) { fields.push('active = ?');       values.push(active); }

  if (fields.length === 0) {
    res.status(400).json({ success: false, error: 'No fields provided to update' });
    return;
  }

  values.push(id);
  const updated = (await db.prepare<DbHeroSlide>(
    `UPDATE hero_slides SET ${fields.join(', ')} WHERE id = ? RETURNING *`,
  ).get(...values))!;

  res.status(200).json({ success: true, data: toApiSlide(updated) });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid slide ID' }); return; }

  const slide = await db.prepare('SELECT id FROM hero_slides WHERE id = ?').get(id);
  if (!slide) { res.status(404).json({ success: false, error: 'Slide not found' }); return; }

  await db.prepare('DELETE FROM hero_slides WHERE id = ?').run(id);
  res.status(200).json({ success: true });
});

// ─── PATCH /:id/toggle ────────────────────────────────────────────────────────

router.patch('/:id/toggle', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid slide ID' }); return; }

  const slide = await db.prepare<DbHeroSlide>('SELECT * FROM hero_slides WHERE id = ?').get(id);
  if (!slide) { res.status(404).json({ success: false, error: 'Slide not found' }); return; }

  const updated = (await db.prepare<DbHeroSlide>(
    'UPDATE hero_slides SET active = ? WHERE id = ? RETURNING *',
  ).get(!slide.active, id))!;

  res.status(200).json({ success: true, data: toApiSlide(updated) });
});

export default router;
