import { z } from 'zod';
import { Cache } from './cache.ts';
import { ApiError } from './api-error.ts';
import { byNewest, idRange, SourceClient, stableNumericId, type NativeCatalog } from './native-source.ts';
import type { CardExpansion, CatalogCard } from '../shared/model.ts';

export const SORCERY_GAME_ID = 9_000_000_008;
export const SORCERY_GAME = {
  id: SORCERY_GAME_ID,
  name: 'Sorcery',
  displayName: 'Sorcery: Contested Realm',
  printLanguages: ['en'],
};
const ids = idRange(0);
export const isSorceryExpansionId = ids.isExpansionId;

const apiOrigin = 'https://api.sorcerytcg.com';
const imageOrigin = 'https://d27a44hjr9gen3.cloudfront.net';
const printingSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_-]+$/),
  printedAt: z.string().nullish(),
  set: z.object({ name: z.string().min(1), code: z.string().min(1) }),
  meta: z.object({ finish: z.string().nullish(), product: z.string().nullish() }).passthrough(),
})
  .passthrough();
const cardSchema = z.object({
  name: z.string().min(1),
  slug: z.string(),
  engine: z.object({ type: z.string().nullish(), rarity: z.string().nullish() }).passthrough(),
  printings: z.array(printingSchema).default([]),
})
  .passthrough();

export class SorceryCatalog implements NativeCatalog
{
  readonly game = SORCERY_GAME;
  readonly isExpansionId = isSorceryExpansionId;
  readonly cache = new Cache();
  private source: SourceClient;
  constructor(transport: typeof fetch = fetch, pause?: (ms: number) => Promise<unknown>)
  {
    this.source = new SourceClient('Sorcery', [apiOrigin], transport, pause);
  }

  private all()
  {
    return this.cache.get(
      'sorcery-all',
      86_400_000,
      async () => z.array(cardSchema).parse(await this.source.json(new URL('/api/cards', apiOrigin))),
    );
  }
  private async expansion(expansionId: number)
  {
    const expansion = (await this.sets()).data.find(set => set.id === expansionId);
    if (!expansion?.code) throw new ApiError(404, 'Sorcery set not found.');
    return expansion;
  }

  async sets()
  {
    return this.cache.get('sorcery-sets', 86_400_000, async () =>
    {
      const sets = new Map<string, CardExpansion>();
      for (const card of (await this.all()).data)
      {
        for (const printing of card.printings)
        {
          const printed = printing.printedAt?.slice(0, 10) ?? null;
          const existing = sets.get(printing.set.code);
          if (!existing)
          {
            sets.set(printing.set.code, {
              id: stableNumericId(printing.set.code, ids.expansionBase),
              gameId: SORCERY_GAME_ID,
              code: printing.set.code,
              name: printing.set.name,
              releaseDate: printed,
            });
          }
          else if (printed && (!existing.releaseDate || printed < existing.releaseDate)) existing.releaseDate = printed;
        }
      }
      return [...sets.values()].sort((a, b) => byNewest(a, b) || a.name.localeCompare(b.name));
    });
  }

  async cards(expansionId: number, language = 'en')
  {
    z.literal('en').parse(language);
    return this.cache.get(`sorcery-cards:${expansionId}`, 21_600_000, async () =>
    {
      const expansion = await this.expansion(expansionId);
      const cards: CatalogCard[] = [];
      for (const card of (await this.all()).data)
      {
        const printings = card.printings.filter(printing => printing.set.code === expansion.code);
        // Foil and rainbow printings reuse the standard artwork; keep them only when no standard printing exists.
        const standard = printings.filter(printing => printing.meta.finish === 'Standard');
        for (const printing of standard.length ? standard : printings)
        {
          const imageUrl = `${imageOrigin}/cards/${printing.slug}.png`;
          const product = printing.meta.product;
          cards.push({
            id: stableNumericId(printing.slug, ids.cardBase),
            gameId: SORCERY_GAME_ID,
            categoryId: 1,
            expansionId,
            name: card.name,
            version: product && product !== 'Booster' ? product.replace(/([a-z])([A-Z])/g, '$1 $2') : null,
            collectorNumber: null,
            rarity: card.engine.rarity ?? null,
            language: 'en',
            imageUrl,
            imageUrls: [imageUrl],
          });
        }
      }
      return cards.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  async languages(expansionId: number)
  {
    return this.cache.get(`sorcery-languages:${expansionId}`, 86_400_000, async () =>
    {
      await this.expansion(expansionId);
      return ['en'];
    });
  }
}
