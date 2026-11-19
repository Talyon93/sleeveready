// Expansion pages the snapshot does not know yet (sets announced or released since it was taken), read from the
// live catalogue for the sitemap, so new sets are listed without running the snapshot script or deploying.
import { expansionSlug, seoPath, seoSlugForGame } from '../shared/seo.ts';
import { pageLanguagesOf } from './card-index.ts';
import { seoSetSnapshot } from '../shared/seo-sets.ts';
import type { NativeCatalog } from './native-source.ts';

const DAY = 86_400_000;
const PER_GAME = 4;
const MIN_CARDS = 20;
let cached: { paths: string[]; expires: number } | null = null;

// Pages of each recent or upcoming set, in English and every page language it is printed in (45 days back, 90 ahead) with enough cards; whatever the sources
// answer within the time budget. A complete result is kept six hours per function instance, a partial one (some
// source too slow) ten minutes, so the next request, with the sources' answers cached, completes it.
export async function liveSetPaths(catalogs: NativeCatalog[], budgetMs = 5000, now = Date.now()): Promise<string[]>
{
  if (cached && cached.expires > now) return cached.paths;
  const from = new Date(now - 45 * DAY).toISOString().slice(0, 10);
  const to = new Date(now + 90 * DAY).toISOString().slice(0, 10);
  const found: string[] = [];
  const perGame = catalogs
    .map(async catalog =>
    {
      const game = seoSlugForGame(catalog.game.name + ' ' + catalog.game.displayName);
      if (!game) return;
      const known = new Set((seoSetSnapshot.games[game] ?? []).map(set => set.slug));
      const candidates = (await catalog.sets())
        .data
        .filter(set =>
          set.releaseDate && set.releaseDate >= from && set.releaseDate <= to && !known.has(expansionSlug(set))
        )
        .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
        .slice(0, PER_GAME * 2);
      let added = 0;
      for (const set of candidates)
      {
        if (added >= PER_GAME) break;
        const cards = (await catalog.cards(set.id, 'en').catch(() => ({ data: [] }))).data;
        if (cards.length < MIN_CARDS) continue;
        const printed = (catalog.game.printLanguages?.length ?? 0) > 1
          ? (await catalog.languages(set.id).catch(() => ({ data: ['en'] }))).data
          : ['en'];
        for (const language of pageLanguagesOf(printed)) found.push(seoPath(language, game, expansionSlug(set)));
        added++;
      }
    })
    .map(work => work.catch(() => undefined));
  const complete = await Promise.race([
    Promise.all(perGame).then(() => true),
    new Promise<boolean>(resolve => setTimeout(() => resolve(false), budgetMs)),
  ]);
  const paths = [...new Set(found)].sort();
  cached = { paths, expires: now + (complete ? 6 * 3_600_000 : 600_000) };
  return paths;
}
