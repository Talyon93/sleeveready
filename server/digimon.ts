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

export const DIGIMON_GAME_ID = 9_000_000_010;
export const DIGIMON_GAME = {
  id: DIGIMON_GAME_ID,
  name: 'Digimon',
  displayName: 'Digimon Card Game',
  printLanguages: ['en'],
};
const ids = idRange(2);
export const isDigimonExpansionId = ids.isExpansionId;

// Official Bandai English card list. Categories 5229xx are promo buckets, not releases.
const siteOrigin = 'https://world.digimoncard.com';
// Any category page carries the full product selector; the bare /cards/ URL only redirects to the newest one.
// 522906 ("Other Products") is one of the smallest pages, so the set list loads quickly.
const listUrl = (category = '522906') =>
{
  const url = new URL('/cards/', siteOrigin);
  url.search = new URLSearchParams({ search: 'true', category }).toString();
  return url;
};
const trailingCode = /\s*[[［]([^\]］]+)[\]］]\s*$/;

export function parseDigimonSets(html: string)
{
  const sets = new Map<string, { category: string; expansion: CardExpansion }>();
  for (const match of html.matchAll(/<option value="(522[0-8]\d\d)"[^>]*>([^<]+)/g))
  {
    if (sets.has(match[1])) continue;
    const label = decodeHtml(match[2]);
    const code = trailingCode.exec(label)?.[1]?.trim() ?? null;
    sets.set(match[1], {
      category: match[1],
      expansion: {
        id: stableNumericId(match[1], ids.expansionBase),
        gameId: DIGIMON_GAME_ID,
        code,
        name: label.replace(trailingCode, ''),
        releaseDate: null,
      },
    });
  }
  return [...sets.values()];
}
// "TIMELESS BONDS [BT-26] Pre-Release date August 28, 2026 Release date September 4, 2026": the retail date wins.
export function parseDigimonProductDates(html: string)
{
  return [
    ...pageText(html).matchAll(
      new RegExp('\\[([A-Z]+-?\\d+(?:-\\d+)?)\\][^\\[]*?(?<!Pre-)Release date ' + ENGLISH_DATE, 'g'),
    ),
  ]
    .map(match => ({ code: match[1], date: englishDate(match[2]) }))
    .filter((item): item is { code: string; date: string } => Boolean(item.date));
}
export function parseDigimonCards(html: string, expansionId: number, category: string): CatalogCard[]
{
  const cards: CatalogCard[] = [];
  for (const block of html.split('<li class="image_lists_item').slice(1))
  {
    const key = /data-src="#([A-Za-z0-9_-]+)"/.exec(block)?.[1];
    const image = /<img src="([^"]+\/images\/cardlist\/card\/[^"]+)"/.exec(block)?.[1];
    const name = decodeHtml(/<div class="cardTitle">([\s\S]*?)<\/div>/.exec(block)?.[1] ?? '');
    if (!key || !image || !name) continue;
    const parallel = /_P(\d+)$/i.exec(key)?.[1];
    const imageUrl = new URL(image, listUrl()).href;
    cards.push({
      id: stableNumericId(`${category}:${key}`, ids.cardBase),
      gameId: DIGIMON_GAME_ID,
      categoryId: 1,
      expansionId,
      name,
      version: parallel ? `Parallel ${parallel}` : null,
      collectorNumber: decodeHtml(/<li class="cardNo">([\s\S]*?)<\/li>/.exec(block)?.[1] ?? key),
      rarity: decodeHtml(/<li class="cardRarity">([\s\S]*?)<\/li>/.exec(block)?.[1] ?? '') || null,
      language: 'en',
      imageUrl,
      imageUrls: [imageUrl],
    });
  }
  return cards;
}

export class DigimonCatalog implements NativeCatalog
{
  readonly game = DIGIMON_GAME;
  readonly isExpansionId = isDigimonExpansionId;
  readonly cache = new Cache();
  private source: SourceClient;
  constructor(transport: typeof fetch = fetch, pause?: (ms: number) => Promise<unknown>)
  {
    this.source = new SourceClient('Digimon Card Game', [siteOrigin], transport, pause);
  }

  private catalog()
  {
    return this.cache.get('digimon-catalog', 86_400_000, async () =>
    {
      const sets = parseDigimonSets(await this.source.text(listUrl()));
      if (!sets.length) throw new ApiError(502, 'Digimon set list not recognised.');
      return assignDates(sets, await this.productDates());
    });
  }
  // Release dates come from the products page; the card list still works if that page is unavailable.
  private async productDates()
  {
    try
    {
      return parseDigimonProductDates(await this.source.text(new URL('/products/', siteOrigin)));
    }
    catch
    {
      return [];
    }
  }
  private async category(expansionId: number)
  {
    const entry = (await this.catalog()).data.find(set => set.expansion.id === expansionId);
    if (!entry) throw new ApiError(404, 'Digimon set not found.');
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
    return this.cache.get(`digimon-cards:${expansionId}`, 21_600_000, async () =>
    {
      const category = await this.category(expansionId);
      return parseDigimonCards(await this.source.text(listUrl(category)), expansionId, category);
    });
  }
  async languages(expansionId: number)
  {
    return this.cache.get(`digimon-languages:${expansionId}`, 86_400_000, async () =>
    {
      await this.category(expansionId);
      return ['en'];
    });
  }
}
