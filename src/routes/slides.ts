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

interface PromoSlideItem {
  type: 'promo';
  id: number;
  slideOrder: number;
  tag: string | null;
  headline: string | null;
  subheadline: string | null;
  ctaText: string | null;
  ctaHref: string | null;
  bannerImage: string | null;
  accentColor: string;
  createdAt: string;
}

interface MarketSlideItem {
  type: 'market';
  featuredOrder: number;
  [key: string]: unknown;
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

  const [promoRows, marketRows] = await Promise.all([
    db.prepare<DbPromoSlide>(
      'SELECT * FROM promo_slides WHERE active = true ORDER BY slide_order ASC',
    ).all(),
    db.prepare<DbMarket>(
      "SELECT * FROM markets WHERE featured = true AND status = 'open' ORDER BY featured_order ASC",
    ).all(),
  ]);

  const promoSlides: PromoSlideItem[] = promoRows.map(s => ({
    type:        'promo',
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
    // frontend aliases (NewsSlideshow promoToSlide reads these)
    title:       s.headline,
    subtitle:    s.subheadline,
    ctaLabel:    s.cta_text,
    gradient:    null,
  }));

  const marketSlides: MarketSlideItem[] = await Promise.all(
    marketRows.map(async m => ({
      ...toApiMarket(m, await getOutcomes(m.id)),
      type: 'market' as const,
    })),
  );

  // Merge and sort — use type discriminator to pick the right order field
  const all = ([...promoSlides, ...marketSlides]).sort((a, b) => {
    const aOrder = a.type === 'promo'
      ? (a as PromoSlideItem).slideOrder
      : (a as MarketSlideItem).featuredOrder ?? 0;
    const bOrder = b.type === 'promo'
      ? (b as PromoSlideItem).slideOrder
      : (b as MarketSlideItem).featuredOrder ?? 0;
    return aOrder - bOrder;
  });

  res.status(200).json({ success: true, data: all });
});

export default router;
