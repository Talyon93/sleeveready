import { z } from 'zod';
import { Cache } from './cache.ts';
import { ApiError } from './api-error.ts';
import {
  assignDates,
  decodeHtml,
  ENGLISH_DATE,
  englishDate,
  idRange,
  pageText,
  SourceClient,
  stableNumericId,
  type NativeCatalog,
} from './native-source.ts';
import type { CardExpansion, CatalogCard } from '../shared/model.ts';

export const UNION_ARENA_GAME_ID = 9_000_000_013;
export const UNION_ARENA_GAME = {
  id: UNION_ARENA_GAME_ID,
  name: 'Union Arena',
  displayName: 'Union Arena',
  printLanguages: ['en'],
};
const ids = idRange(5);
export const isUnionArenaExpansionId = ids.isExpansionId;

// Official Bandai North American card list. Series 5919xx are promo buckets.
const siteOrigin = 'https://www.unionarena-tcg.com';
const listUrl = (series = '591001') =>
{
  const url = new URL('/na/cardlist/', siteOrigin);
  url.search = new URLSearchParams({ search: 'true', series }).toString();
  return url;
};
type Entry = { category: string; expansion: CardExpansion };

export function parseUnionArenaSets(html: string): Entry[]
{
  const entries = new Map<string, Entry>();
  for (const match of html.matchAll(/<option value="(591[0-8]\d\d)"[^>]*>([^<]+)/g))
  {
    if (entries.has(match[1])) continue;
    const label = decodeHtml(match[2]);
    const code = /\[([A-Z0-9 -]+)\]\s*$/.exec(label)?.[1] ?? null;
    entries.set(match[1], {
      category: match[1],
      expansion: {
        id: stableNumericId(match[1], ids.expansionBase),
        gameId: UNION_ARENA_GAME_ID,
        code,
        name: label.replace(/\s*\[[A-Z0-9 -]+\]\s*$/, ''),
        releaseDate: null,
      },
    });
  }
  // Families: 5911 boosters, 5912 Vol.2 boosters, 5910 starters, then minor reprint products; newest first within each.
  const rank = (category: string) =>
  {
    const index = ['5911', '5912', '5910'].indexOf(category.slice(0, 4));
    return index < 0 ? 3 : index;
  };
  return [...entries.values()].sort((a, b) =>
    rank(a.category) - rank(b.category) || b.category.localeCompare(a.category)
  );
}
// "Booster Pack Re:ZERO -Starting Life in Another World- Release Date May 8, 2026": matched on title and product type
// (booster codes end in BT, starter decks in ST).
export function unionArenaProductDates(html: string, entries: Entry[])
{
  const key = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
  const dates: { code: string; date: string }[] = [];
  for (
    const match of pageText(html).matchAll(
      new RegExp('(Booster Pack|Starter Deck) (.{3,120}?) Release Date ' + ENGLISH_DATE, 'g'),
    )
  )
  {
    const date = englishDate(match[3]);
    const suffix = match[1] === 'Booster Pack' ? 'BT' : 'ST';
    if (!date) continue;
    const entry = entries.find(item =>
      key(item.expansion.name) === key(match[2]) && item.expansion.code?.toUpperCase().endsWith(suffix)
    );
    if (entry?.expansion.code) dates.push({ code: entry.expansion.code, date });
  }
  return dates;
}
export function parseUnionArenaCards(html: string, expansionId: number, series: string): CatalogCard[]
{
  const cards: CatalogCard[] = [];
  for (const match of html.matchAll(
    /card_no=([^"&]+)"><img[^>]*data-src="(\/na\/images\/cardlist\/card\/([A-Za-z0-9_-]+)\.png(?:\?[^"]*)?)" alt="([^"]*)"/g,
  ))
  {
    const [, number, path, file, alt] = match;
    const parallel = /_p(\d+)$/.exec(file)?.[1];
    const imageUrl = new URL(path, siteOrigin).href;
    cards.push({
      id: stableNumericId(`${series}:${file}`, ids.cardBase),
      gameId: UNION_ARENA_GAME_ID,
      categoryId: 1,
      expansionId,
      name: decodeHtml(alt).replace(/^\S+\s+/, '') || file,
      version: parallel ? `Parallel ${parallel}` : null,
      collectorNumber: decodeHtml(number),
      rarity: null,
      language: 'en',
      imageUrl,
      imageUrls: [imageUrl],
    });
  }
  return cards;
}

export class UnionArenaCatalog implements NativeCatalog
{
  readonly game = UNION_ARENA_GAME;
  readonly isExpansionId = isUnionArenaExpansionId;
  readonly cache = new Cache();
  private source: SourceClient;
  constructor(transport: typeof fetch = fetch, pause?: (ms: number) => Promise<unknown>)
  {
    this.source = new SourceClient('Union Arena', [siteOrigin], transport, pause);
  }

  private catalog()
  {
    return this.cache.get('union-arena-catalog', 86_400_000, async () =>
    {
      const sets = parseUnionArenaSets(await this.source.text(listUrl()));
      if (!sets.length) throw new ApiError(502, 'Union Arena set list not recognised.');
      let dates: { code: string; date: string }[] = [];
      try
      {
        dates = unionArenaProductDates(await this.source.text(new URL('/na/products/', siteOrigin)), sets);
      }
      catch
      {
        /* Dates are optional; the card list works without them. */
      }
      return assignDates(sets, dates);
    });
  }
  private async category(expansionId: number)
  {
    const entry = (await this.catalog()).data.find(set => set.expansion.id === expansionId);
    if (!entry) throw new ApiError(404, 'Union Arena set not found.');
    return entry.category;
  }

  async sets()
  {
    const result = await this.catalog();
    return { ...result, data: result.data.map(set => set.expansion) };
  }
  async cards(expansionId: number, language = 'en')
  {
    z.literal('en').parse(language);
    return this.cache.get(`union-arena-cards:${expansionId}`, 21_600_000, async () =>
    {
      const series = await this.category(expansionId);
      return parseUnionArenaCards(await this.source.text(listUrl(series)), expansionId, series);
    });
  }
  async languages(expansionId: number)
  {
    return this.cache.get(`union-arena-languages:${expansionId}`, 86_400_000, async () =>
    {
      await this.category(expansionId);
      return ['en'];
    });
  }
}
