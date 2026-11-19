// Build-time and server-only: imports the expansion snapshot, so the client bundle must not depend on this module.
import snapshot from './data/seo-sets.json' with { type: 'json' };
import {
  cardPath,
  featurePaths,
  indexableSeoPaths,
  isUpcomingSet,
  seoLanguages,
  seoPath,
  type SeoGameSlug,
} from './seo.ts';
import type { SeoSet } from './seo-page.ts';
import { gameOnline } from './games.ts';
export type { SeoSet };

export type SeoSetSnapshot = { generatedAt: string; games: Partial<Record<SeoGameSlug, SeoSet[]>> };

export const seoSetSnapshot = snapshot as SeoSetSnapshot;

// An expansion page exists in English and in every page language its cards are really printed in.
export function seoSetPages()
{
  return Object.entries(seoSetSnapshot.games).filter(([game]) => gameOnline(game)).flatMap(([game, sets]) =>
    (sets ?? []).flatMap(set =>
      seoLanguages.filter(language => set.cards[language]?.length).map(language => ({
        language,
        game: game as SeoGameSlug,
        set,
      }))
    )
  );
}
// Card pages listed in the sitemaps: every card of each snapshot expansion, in the languages of its expansion pages.
export function seoCardPaths(game: SeoGameSlug)
{
  return (seoSetSnapshot.games[game] ?? []).flatMap(set =>
    seoLanguages.filter(language => set.cards[language]?.length).flatMap(language =>
      (set.cardSlugs ?? []).map(card => cardPath(language, game, set.slug, card))
    )
  );
}
export const findSeoSet = (game: SeoGameSlug, slug: string) =>
  seoSetSnapshot.games[game]?.find(set => set.slug === slug);
export const allIndexablePaths = [
  ...indexableSeoPaths,
  ...featurePaths,
  ...seoSetPages().map(page => seoPath(page.language, page.game, page.set.slug)),
];
// Upcoming sets' pages are rendered by the server function (fresh revealed count, spoiler until release), not built.
export const upcomingSetPaths = new Set(
  seoSetPages().filter(page => isUpcomingSet(page.set)).map(page => seoPath(page.language, page.game, page.set.slug)),
);
export const staticSeoPaths = allIndexablePaths.filter(path => !upcomingSetPaths.has(path));
