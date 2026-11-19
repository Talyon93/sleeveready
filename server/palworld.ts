import { z } from 'zod';
import { Cache } from './cache.ts';
import { ApiError } from './api-error.ts';
import { byNewest, idRange, SourceClient, stableNumericId, type NativeCatalog } from './native-source.ts';
import type { CardExpansion, CatalogCard } from '../shared/model.ts';

export const PALWORLD_GAME_ID = 9_000_000_015;
export const PALWORLD_GAME = {
  id: PALWORLD_GAME_ID,
  name: 'Palworld',
  displayName: 'Palworld Official Card Game',
  printLanguages: ['en'],
};
const ids = idRange(7);
export const isPalworldExpansionId = ids.isExpansionId;

// Official Bushiroad card manager behind the English card list.
const siteOrigin = 'https://en.palworld-official-cardgame.com';
const imageBase = `${siteOrigin}/wordpress/wp-content/images/cardlist/`;
const productsSchema = z.object({
  products: z.array(
    z.object({
      items: z.array(
        z.object({
          code: z.string().regex(/^[A-Z0-9-]+$/),
          name: z.string().min(1),
          type: z.string(),
          date: z.string().nullish(),
        })
          .passthrough(),
      ),
    }),
  ),
});
const listSchema = z.object({
  total: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      picture: z.string().regex(/^[A-Za-z0-9_./-]+\.(?:png|webp|jpg)$/).refine(value => !value.includes('..')),
      card_number: z.string().min(1),
      card_name: z.string().min(1),
      rare: z.string().nullish(),
    })
      .passthrough(),
  ),
});

export class PalworldCatalog implements NativeCatalog
{
  readonly game = PALWORLD_GAME;
  readonly isExpansionId = isPalworldExpansionId;
  readonly cache = new Cache();
  private source: SourceClient;
  constructor(transport: typeof fetch = fetch, pause?: (ms: number) => Promise<unknown>)
  {
    this.source = new SourceClient('Palworld Official Card Game', [siteOrigin], transport, pause);
  }

  private async expansion(expansionId: number)
  {
    const expansion = (await this.sets()).data.find(set => set.id === expansionId);
    if (!expansion?.code) throw new ApiError(404, 'Palworld set not found.');
    return expansion;
  }
  async sets()
  {
    return this.cache.get('palworld-sets', 86_400_000, async () =>
    {
      const result = productsSchema.parse(
        await this.source.json(new URL('/manage/card-list-user/products', siteOrigin)),
      );
      // "pr" groups hold promotional cards, not releases.
      return result
        .products
        .flatMap(group => group.items)
        .filter(item => item.type !== 'pr')
        .map<CardExpansion>(item => ({
          id: stableNumericId(item.code, ids.expansionBase),
          gameId: PALWORLD_GAME_ID,
          code: item.code,
          name: item.name,
          releaseDate: /^\d{4}\.\d{2}\.\d{2}$/.test(item.date ?? '') ? item.date!.replaceAll('.', '-') : null,
        }))
        .sort((a, b) => byNewest(a, b) || a.name.localeCompare(b.name));
    });
  }
  async cards(expansionId: number, language = 'en')
  {
    z.literal('en').parse(language);
    return this.cache.get(`palworld-cards:${expansionId}`, 21_600_000, async () =>
    {
      const expansion = await this.expansion(expansionId);
      const rows: z.infer<typeof listSchema>['items'] = [];
      for (let page = 1; page <= 20; page++)
      {
        const url = new URL('/manage/card-list-user/list', siteOrigin);
        url.search = new URLSearchParams({ expansion: expansion.code!, page: String(page), per_page: '100' })
          .toString();
        const result = listSchema.parse(await this.source.json(url));
        rows.push(...result.items);
        if (!result.items.length || rows.length >= result.total) break;
      }
      return rows.map<CatalogCard>(row =>
      {
        const imageUrl = new URL(row.picture, imageBase).href;
        const number = /^[A-Z0-9]+-\d+/.exec(row.card_number)?.[0] ?? row.card_number;
        return {
          id: stableNumericId(`${expansion.code}:${row.card_number}`, ids.cardBase),
          gameId: PALWORLD_GAME_ID,
          categoryId: 1,
          expansionId,
          name: row.card_name,
          version: number !== row.card_number ? row.card_number.slice(number.length) : null,
          collectorNumber: number,
          rarity: row.rare ?? null,
          language: 'en',
          imageUrl,
          imageUrls: [imageUrl],
        };
      });
    });
  }
  async languages(expansionId: number)
  {
    return this.cache.get(`palworld-languages:${expansionId}`, 86_400_000, async () =>
    {
      await this.expansion(expansionId);
      return ['en'];
    });
  }
}
