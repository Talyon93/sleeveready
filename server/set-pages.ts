// Expansion pages rendered on request, from the live catalogue: upcoming sets (their static page is not built, so
// the revealed count and the spoiler wording stay current) and any expansion without a static page yet.
import {
  cardSlugs,
  expansionSlug,
  isUpcomingSet,
  seoLanguages,
  seoPath,
  seoSlugForGame,
  type SeoGameSlug,
  type SeoLanguage,
} from '../shared/seo.ts';
import { renderSeoPage, type SeoSet } from '../shared/seo-page.ts';
import { affiliateConfig } from '../shared/affiliate.ts';
import type { NativeCatalog } from './native-source.ts';
import { appScript, appStyles } from './card-pages.ts';
import { seoSetSnapshot } from '../shared/seo-sets.ts';

export type SetPageRequest = { language: SeoLanguage; game: SeoGameSlug; set: string };
export type SetPage = { status: 200; html: string; upcoming: boolean } | { status: 302; location: string } | {
  status: 404;
};
// Released sets list their first cards; a coming set lists every card revealed so far, each linking its page, so the
// whole spoiler list is one page (and crawlers find each new card from it).
const NAMES = 40;

export async function renderSetPage(
  request: SetPageRequest,
  catalogs: NativeCatalog[],
  origin: string,
  development: boolean,
): Promise<SetPage>
{
  const catalog = catalogs.find(item => seoSlugForGame(item.game.name + ' ' + item.game.displayName) === request.game);
  if (!catalog) return { status: 404 };
  const expansion = (await catalog.sets()).data.find(set => expansionSlug(set) === request.set);
  if (!expansion) return { status: 404 };
  const english = (await catalog.cards(expansion.id, 'en')).data;
  if (!english.length) return { status: 404 };
  const printed = (catalog.game.printLanguages?.length ?? 0) > 1
    ? (await catalog.languages(expansion.id)).data
    : ['en'];
  const printedPage = (language: SeoLanguage) => printed.some(code => code.toLowerCase().split('-')[0] === language);
  // Like the static pages: English, plus the page languages the set is printed in; others open the English page.
  const pageLanguages = seoLanguages.filter(language => language === 'en' || printedPage(language));
  if (!pageLanguages.includes(request.language))
  {
    return { status: 302, location: seoPath('en', request.game, request.set) };
  }
  const slugs = cardSlugs(english);
  const slugList = english.map(card => slugs.get(card.id)!);
  const upcoming = isUpcomingSet({ releaseDate: expansion.releaseDate ?? null });
  const listed = upcoming ? slugList : slugList.slice(0, NAMES);
  const namesFor = (cards: typeof english) =>
  {
    const own = cardSlugs(cards);
    const byslug = new Map(cards.map(card => [own.get(card.id)!, card.name]));
    return listed.map(slug => byslug.get(slug) ?? '');
  };
  const englishNames = namesFor(english);
  const cards: SeoSet['cards'] = {};
  for (const language of pageLanguages)
  {
    if (language === 'en' || language !== request.language)
    {
      cards[language] = englishNames;
      continue;
    }
    const code = printed.find(item => item.toLowerCase().split('-')[0] === language) ?? language;
    const localised = (await catalog.cards(expansion.id, code).catch(() => ({ data: [] as typeof english }))).data;
    cards[language] = localised.length
      ? namesFor(localised).map((name, index) => name || englishNames[index])
      : englishNames;
  }
  const set: SeoSet = {
    slug: request.set,
    code: expansion.code ?? null,
    name: expansion.name,
    releaseDate: expansion.releaseDate ?? null,
    cardCount: english.length,
    languages: printed,
    cards,
    cardSlugs: slugList,
  };
  const html = renderSeoPage(seoPath(request.language, request.game, request.set), {
    origin,
    affiliate: affiliateConfig(process.env),
    findSet: () => set,
    gameSets: game => seoSetSnapshot.games[game] ?? [],
    head: appStyles(development),
    script: appScript(development),
  });
  return { status: 200, html, upcoming: isUpcomingSet(set) };
}
