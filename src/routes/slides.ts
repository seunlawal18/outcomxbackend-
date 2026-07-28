import { Router, Request, Response } from 'express';
import db from '../db/client';
import { autoCloseExpiredMarkets } from '../services/marketService';
import { DbMarket, DbMarketOutcome, toApiMarket } from '../types';

const router = Router();

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

async function getOutcomes(marketId: number): Promise<DbMarketOutcome[]> {
  return db.prepare<DbMarketOutcome>(
    'SELECT * FROM market_outcomes WHERE market_id = ? ORDER BY id ASC',
  ).all(marketId);
}

// ─── GET / ────────────────────────────────────────────────────────────────────
// Returns all active promo slides AND featured open markets merged and sorted
// by their respective order fields. The frontend renders each type differently
// based on the `type` discriminator field.

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  await autoCloseExpiredMarkets();

  // Fetch both in parallel
  const [promoRows, marketRows] = await Promise.all([
    db.prepare<DbHeroSlide>(
      'SELECT * FROM hero_slides WHERE active = true ORDER BY slide_order ASC',
    ).all(),
    db.prepare<DbMarket>(
      "SELECT * FROM markets WHERE featured = true AND status = 'open' ORDER BY featured_order ASC",
    ).all(),
  ]);

  // Build promo slide objects
  const promoSlides = promoRows.map(s => ({
    type:        'promo' as const,
    id:          s.id,
    title:       s.title,
    subtitle:    s.subtitle,
    tag:         s.tag,
    ctaLabel:    s.cta_label,
    ctaHref:     s.cta_href,
    bannerImage: s.banner_image,
    accentColor: s.accent_color,
    gradient:    s.gradient,
    slideOrder:  s.slide_order,
  }));

  // Build market slide objects (full ApiMarket + type discriminator)
  const marketSlides = await Promise.all(
    marketRows.map(async m => ({
      type: 'market' as const,
      ...toApiMarket(m, await getOutcomes(m.id)),
    })),
  );

  // Merge and sort by their respective order fields
  const all = [...promoSlides, ...marketSlides].sort((a, b) => {
    const aOrder = 'slideOrder' in a ? (a.slideOrder ?? 0) : (a.featuredOrder ?? 0);
    const bOrder = 'slideOrder' in b ? (b.slideOrder ?? 0) : (b.featuredOrder ?? 0);
    return aOrder - bOrder;
  });

  res.status(200).json({ success: true, data: all });
});

export default router;
