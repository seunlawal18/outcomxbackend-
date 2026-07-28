import { Router, Request, Response } from 'express';
import db from '../db/client';
import { autoCloseExpiredMarkets } from '../services/marketService';
import { DbMarket, DbMarketOutcome, toApiMarket } from '../types';

const router = Router();

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

async function getOutcomes(marketId: number): Promise<DbMarketOutcome[]> {
  return db.prepare<DbMarketOutcome>(
    'SELECT * FROM market_outcomes WHERE market_id = ? ORDER BY id ASC',
  ).all(marketId);
}

// ─── GET / ────────────────────────────────────────────────────────────────────
// Public — merges active promo slides (type: "promo") and featured open
// markets (type: "market") into one array sorted by slide_order / featuredOrder ASC.

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  await autoCloseExpiredMarkets();

  // Fetch both sources in parallel
  const [promoRows, marketRows] = await Promise.all([
    db.prepare<DbPromoSlide>(
      'SELECT * FROM promo_slides WHERE active = true ORDER BY slide_order ASC',
    ).all(),
    db.prepare<DbMarket>(
      "SELECT * FROM markets WHERE featured = true AND status = 'open' ORDER BY featured_order ASC",
    ).all(),
  ]);

  // Map promo slides to API shape
  const promoSlides = promoRows.map(s => ({
    type:        'promo' as const,
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

  // Map featured markets to API shape with type discriminator
  const marketSlides = await Promise.all(
    marketRows.map(async m => ({
      type: 'market' as const,
      ...toApiMarket(m, await getOutcomes(m.id)),
    })),
  );

  // Merge and sort by order field
  const all = ([...promoSlides, ...marketSlides] as Array<
    (typeof promoSlides)[number] | (typeof marketSlides)[number]
  >).sort((a, b) => {
    const aOrder = a.type === 'promo' ? (a.slideOrder ?? 0) : (a.featuredOrder ?? 0);
    const bOrder = b.type === 'promo' ? (b.slideOrder ?? 0) : (b.featuredOrder ?? 0);
    return aOrder - bOrder;
  });

  res.status(200).json({ success: true, data: all });
});

export default router;
