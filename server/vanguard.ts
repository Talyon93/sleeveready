import { z } from 'zod';
import { Cache } from './cache.ts';
import { ApiError } from './api-error.ts';
import { byNewest, decodeHtml, idRange, SourceClient, stableNumericId, type NativeCatalog } from './native-source.ts';
import type { CardExpansion, CatalogCard } from '../shared/model.ts';

export const VANGUARD_GAME_ID = 9_000_000_014;
export const VANGUARD_GAME = {
  id: VANGUARD_GAME_ID,
  name: 'Cardfight!! Vanguard',
  displayName: 'Cardfight!! Vanguard',
  printLanguages: ['en'],
};
const ids = idRange(6);
export const isVanguardExpansionId = ids.isExpansionId;

// Official Bushiroad English card list. Since November 2026 the site renders it in the browser from a JSON API:
// /products lists every product with its release date, /cards returns 24 cards per page for one product.
const siteOrigin = 'https://en.cf-vanguard.com';
const apiBase = '/manage/en-api';
const imageBase = '/wordpress/wp-content/images/cardlist/';
const maxPages = 60;

const productsSchema = z.object({
  items: z.array(
    z.object({
      id: z.coerce.string(),
      name: z.string(),
      category_type: z.string().optional().default(''),
      release_date: z.string().nullish(),
    }),
  ),
});
const cardsSchema = z.object({
  total: z.coerce.number().optional().default(0),
  per_page: z.coerce.number().optional().default(24),
  items: z.array(
    z.object({
      card_number: z.string(),
      card_name: z.string().nullish(),
      rare: z.string().nullish(),
      picture: z.string().nullish(),
    }),
  ),
});

type Entry = { product: string; expansion: CardExpansion };

export function parseVanguardSets(body: unknown): Entry[]
{
  const entries = new Map<string, Entry>();
  for (const item of productsSchema.parse(body).items)
  {
    const title = decodeHtml(item.name).trim();
    // Promo cards are not a set people print from.
    if (!title || item.category_type === 'pr' || entries.has(item.id)) continue;
    const code = /^\[(?:VGE-)?([^\]]+)\]/.exec(title)?.[1] ?? null;
    const releaseDate = /^\d{4}-\d{2}-\d{2}$/.test(item.release_date ?? '') ? item.release_date! : null;
    entries.set(item.id, {
      product: item.id,
      expansion: {
        id: stableNumericId(item.id, ids.expansionBase),
        gameId: VANGUARD_GAME_ID,
        code,
        name: title.replace(/^\[[^\]]+\]\s*/, '').replace(/^Cardfight!! Vanguard\s*/i, ''),
        releaseDate,
      },
    });
  }
  return [...entries.values()].sort(
    (a, b) => byNewest(a.expansion, b.expansion) || Number(b.product) - Number(a.product),
  );
}

export function parseVanguardCards(body: unknown, expansionId: number): CatalogCard[]
{
  const cards: CatalogCard[] = [];
  for (const item of cardsSchema.parse(body).items)
  {
    if (!item.picture || !/^[A-Za-z0-9_./-]+\.(?:png|jpg)$/.test(item.picture) || item.picture.includes('..')) continue;
    // Same path as the old HTML list, so card ids stay stable for saved lists.
    const path = imageBase + item.picture;
    const imageUrl = new URL(path, siteOrigin).href;
    const collectorNumber = decodeHtml(item.card_number);
    cards.push({
      id: stableNumericId(`${expansionId}:${collectorNumber}:${path}`, ids.cardBase),
      gameId: VANGUARD_GAME_ID,
      categoryId: 1,
      expansionId,
      name: decodeHtml(item.card_name ?? '') || collectorNumber,
      version: null,
      collectorNumber,
      rarity: item.rare || null,
      language: 'en',
      imageUrl,
      imageUrls: [imageUrl],
    });
  }
  return cards;
}

function apiUrl(path: string, params: Record<string, string> = {})
{
  const url = new URL(`${apiBase}/${path}`, siteOrigin);
  url.search = new URLSearchParams(params).toString();
  return url;
}

export class VanguardCatalog implements NativeCatalog
{
  readonly game = VANGUARD_GAME;
  readonly isExpansionId = isVanguardExpansionId;
  readonly cache = new Cache();
  private source: SourceClient;

  constructor(transport: typeof fetch = fetch, pause?: (ms: number) => Promise<unknown>)
  {
    this.source = new SourceClient('Cardfight!! Vanguard', [siteOrigin], transport, pause);
  }

  private catalog()
  {
    return this.cache.get('vanguard-catalog', 86_400_000, async () =>
    {
      const sets = parseVanguardSets(await this.source.json(apiUrl('products')));
      if (!sets.length) throw new ApiError(502, 'Vanguard set list not recognised.');
      return sets;
    });
  }

  private async product(expansionId: number)
  {
    const entry = (await this.catalog()).data.find((set) => set.expansion.id === expansionId);
    if (!entry) throw new ApiError(404, 'Vanguard set not found.');
    return entry.product;
  }

  async sets()
  {
    const result = await this.catalog();
    return { ...result, data: result.data.map((set) => set.expansion) };
  }

  async cards(expansionId: number, language = 'en')
  {
    z.literal('en').parse(language);
    return this.cache.get(`vanguard-cards:${expansionId}`, 21_600_000, async () =>
    {
      const product = await this.product(expansionId);
      const first = cardsSchema.parse(await this.source.json(apiUrl('cards', { expansion: product, page: '1' })));
      const pages = Math.min(maxPages, Math.max(1, Math.ceil(first.total / Math.max(1, first.per_page))));
      const rest = Array.from(
        { length: pages - 1 },
        (_, index) => apiUrl('cards', { expansion: product, page: String(index + 2) }),
      );
      const parts = [first, ...(await this.source.jsons(rest))];
      const seen = new Set<number>();
      return parts
        .flatMap((part) => parseVanguardCards(part, expansionId))
        .filter((card) => !seen.has(card.id) && Boolean(seen.add(card.id)));
    });
  }

  async languages(expansionId: number)
  {
    return this.cache.get(`vanguard-languages:${expansionId}`, 86_400_000, async () =>
    {
      await this.product(expansionId);
      return ['en'];
    });
  }
}
