import { Router, Request, Response } from 'express';
import db from '../db/client';

const router = Router();

interface DbPromoSlide {
  id: number;
  slide_order: number;
  tag: string | null;
  headline: string;
  subheadline: string | null;
  cta_text: string | null;
  cta_href: string | null;
  banner_image: string | null;
  accent_color: string;
  active: boolean;
  created_at: string;
}

// ─── GET / ────────────────────────────────────────────────────────────────────
// Public — returns active promo slides only, ordered by slide_order.

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.prepare<DbPromoSlide>(
    'SELECT * FROM promo_slides WHERE active = true ORDER BY slide_order ASC',
  ).all();

  const data = rows.map(s => ({
    id:          s.id,
    slideOrder:  s.slide_order,
    tag:         s.tag,
    headline:    s.headline,
    subheadline: s.subheadline,
    ctaText:     s.cta_text,
    ctaHref:     s.cta_href,
    bannerImage: s.banner_image,
    accentColor: s.accent_color,
    createdAt:   s.created_at,
  }));

  res.status(200).json({ success: true, data });
});

export default router;
