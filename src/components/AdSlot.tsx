import type { ReactNode } from 'react';
import type { Language } from '../lib/i18n';
import { adsEnabled } from '../../shared/ads';

// The places kept for advertising, empty for now: each one holds its final size so nothing moves when an ad fills it,
// and none of them reaches the print page or a printed sheet. 'card' takes one cell of a card grid (a band across the row on phones), 'sheet' a strip
// under the sheet panel's buttons (desktop only), 'strip' a band at the top of the home board (also drawn by the
// static home page, shared/seo-page.ts, so it is there from the first paint) where the screen has no room at the
// sides, and 'rail' a column in a side margin on wide screens: one each side of the home (replacing the band), one left of
// the catalogue (replacing the place in the card grid).
type Kind = 'card' | 'sheet' | 'strip' | 'rail';
const label: Record<Language, string> = {
  en: 'Advertisement',
  it: 'Pubblicità',
  de: 'Anzeige',
  fr: 'Publicité',
  es: 'Publicidad',
  pt: 'Publicidade',
  nl: 'Advertentie',
  pl: 'Reklama',
};
const size: Record<Kind, string> = {
  card: '1 carta · 300×420 · 320×100',
  sheet: '300×100',
  strip: '728×90 · 320×100',
  rail: '160×600',
};

export function AdSlot(
  { kind, language, as = 'div', side, place }: {
    kind: Kind;
    language: Language;
    as?: 'div' | 'li';
    side?: 'left' | 'right';
    place?: 'home' | 'catalog';
  },
)
{
  if (!adsEnabled) return null;
  const Tag = as;
  return (
    <Tag
      className={'ad-slot ad-' + kind + (side ? ' ad-' + side : '') + (place ? ' ad-' + place : '')}
      aria-label={label[language]}
    >
      <span>{label[language]}</span>
      <small>{size[kind]}</small>
    </Tag>
  );
}

// One advertising place in a card grid, after its first eight cards (src/components/AdSlot.tsx).
export const withAd = (items: ReactNode[], language: Language, as: 'div' | 'li' = 'div') =>
  adsEnabled && items.length > 8
    ? [...items.slice(0, 8), <AdSlot key="ad-card" kind="card" language={language} as={as} />, ...items.slice(8)]
    : items;
