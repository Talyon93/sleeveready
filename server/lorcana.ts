import { retryWithin, upstreamSignal } from './upstream.ts';
import { z } from 'zod';
import { Cache, Queue } from './cache.ts';
import { ApiError } from './api-error.ts';
import type { CardDetails, CardExpansion, CardFact, CatalogCard } from '../shared/model.ts';

export const LORCANA_GAME_ID = 9_000_000_004;
export const LORCANA_GAME = {
  id: LORCANA_GAME_ID,
  name: 'Lorcana',
  displayName: 'Disney Lorcana',
  printLanguages: ['en', 'it', 'de', 'fr'],
  hasCardText: true,
} as const;
export const LORCANA_LANGUAGES = ['en', 'it', 'de', 'fr'] as const;
export const LORCANA_EXPANSION_ID_MIN = 50_000_000_000;
export const LORCANA_EXPANSION_ID_MAX = 54_294_967_295;

const dataOrigin = 'https://lorcanajson.org';
const imageSchema = z.object({ full: z.string().url().nullish(), thumbnail: z.string().url().nullish() }).passthrough();
// Quest sets list some cards without a collector number (the "Vine Tendril" of Illumineer's Quest 3): one such card used
// to fail the whole set.
const cardSchema = z.object({
  id: z.number().int().positive(),
  fullName: z.string().min(1),
  name: z.string().min(1),
  version: z.string().nullish(),
  number: z.union([z.number(), z.string()]).nullish(),
  rarity: z.string().nullish(),
  setCode: z.union([z.number(), z.string()]).nullish(),
  images: imageSchema,
});
const setSchema = z.object({
  name: z.string().min(1),
  releaseDate: z.string().nullish(),
  type: z.string().nullish(),
  number: z.union([z.number(), z.string()]).nullish(),
  cardCounts: z.object({ total: z.number().int().nonnegative() }).partial().optional(),
})
  .passthrough();
const allCardsSchema = z.object({ sets: z.record(setSchema) });
const localizedSetSchema = setSchema.extend({
  code: z.union([z.number(), z.string()]).nullish(),
  cards: z.array(cardSchema).default([]),
});

function stableNumericId(value: string, base: number)
{
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++)
  {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return base + (hash >>> 0);
}
// Card page data, read from the same set files: abilities, ink and stats, ink colour, formats, artist.
const detailCardSchema = z.object({
  id: z.number(),
  type: z.string().nullish(),
  color: z.string().nullish(),
  cost: z.number().nullish(),
  inkwell: z.boolean().nullish(),
  strength: z.number().nullish(),
  willpower: z.number().nullish(),
  lore: z.number().nullish(),
  moveCost: z.number().nullish(),
  subtypesText: z.string().nullish(),
  artistsText: z.string().nullish(),
  fullText: z.string().nullish(),
  abilities: z.array(
    z.object({
      name: z.string().nullish(),
      effect: z.string().nullish(),
      fullText: z.string().nullish(),
      type: z.string().nullish(),
    }),
  )
    .nullish(),
  allowedInFormats: z.record(z.object({ allowed: z.boolean() }).passthrough()).nullish(),
})
  .passthrough();
const detailSetSchema = z.object({ cards: z.array(detailCardSchema).default([]) }).passthrough();
const hasImages = (set: z.infer<typeof localizedSetSchema>) => set.cards.some(card => Boolean(card.images.full));
export const isLorcanaExpansionId = (value: number) =>
  value >= LORCANA_EXPANSION_ID_MIN && value <= LORCANA_EXPANSION_ID_MAX;

export class LorcanaCatalog
{
  readonly cache = new Cache();
  readonly queue = new Queue(80);
  constructor(
    private transport: typeof fetch = fetch,
    private pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  )
  {}

  private async request(path: string): Promise<unknown>
  {
    const url = new URL(path, dataOrigin);
    if (url.origin !== dataOrigin || !url.pathname.startsWith('/files/current/'))
    {
      throw new ApiError(502, 'LorcanaJSON returned an unexpected address.');
    }
    return this.queue.run(async () =>
    {
      const started = Date.now();
      for (let attempt = 0; attempt < 3; attempt++)
      {
        try
        {
          const response = await this.transport(url, {
            headers: { Accept: 'application/json', 'User-Agent': 'SleeveReady/0.1 (+https://sleeveready.com)' },
            signal: upstreamSignal(20000, started),
            redirect: 'error',
          });
          if (!response.ok)
          {
            if ((response.status === 429 || response.status >= 500) && retryWithin(started, attempt))
            {
              await response.body?.cancel();
              await this.pause(400 * 2 ** attempt);
              continue;
            }
            await response.body?.cancel();
            throw new ApiError(
              response.status === 404 ? 404 : 502,
              response.status === 404
                ? 'Lorcana data not available in this language.'
                : 'LorcanaJSON is temporarily unavailable.',
            );
          }
          if (!(response.headers.get('content-type') ?? '').includes('json'))
          {
            await response.body?.cancel();
            throw new ApiError(502, 'LorcanaJSON returned an invalid response.');
          }
          return response.json();
        }
        catch (error)
        {
          if (error instanceof ApiError) throw error;
          if (retryWithin(started, attempt))
          {
            await this.pause(400 * 2 ** attempt);
            continue;
          }
          throw new ApiError(502, 'Connection to LorcanaJSON lost. Try again.');
        }
      }
      throw new ApiError(502, 'Lorcana catalog unavailable.');
    });
  }

  private allCards(language: typeof LORCANA_LANGUAGES[number])
  {
    return this.cache.get(
      `lorcana-all:${language}`,
      86_400_000,
      async () => allCardsSchema.parse(await this.request(`/files/current/${language}/allCards.json`)),
    );
  }
  private async expansion(expansionId: number)
  {
    const expansion = (await this.sets()).data.find(set => set.id === expansionId);
    if (!expansion?.code) throw new ApiError(404, 'Lorcana set not found.');
    return expansion;
  }
  private async localizedSet(expansionId: number, language: typeof LORCANA_LANGUAGES[number])
  {
    const expansion = await this.expansion(expansionId);
    return localizedSetSchema.parse(
      await this.request(`/files/current/${language}/sets/setdata.${encodeURIComponent(expansion.code!)}.json`),
    );
  }

  async sets()
  {
    return this.cache.get('lorcana-sets', 86_400_000, async () =>
    {
      const source = (await this.allCards('en')).data;
      const sets: CardExpansion[] = Object
        .entries(source.sets)
        .filter(([, set]) => (set.cardCounts?.total ?? 0) > 0)
        .map(([code, set]) => ({
          id: stableNumericId(code, LORCANA_EXPANSION_ID_MIN),
          gameId: LORCANA_GAME_ID,
          code: code.toUpperCase(),
          name: set.name,
          releaseDate: set.releaseDate ?? null,
        }))
        .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || a.name.localeCompare(b.name));
      const ids = new Set<number>();
      for (const set of sets)
      {
        if (ids.has(set.id)) throw new ApiError(502, 'Lorcana set id collision.');
        ids.add(set.id);
      }
      return sets;
    });
  }

  async cards(expansionId: number, language = 'en')
  {
    const requested = z.enum(LORCANA_LANGUAGES).parse(language);
    return this.cache.get(`lorcana-cards:${expansionId}:${requested}`, 21_600_000, async () =>
    {
      let resolved: typeof LORCANA_LANGUAGES[number] = requested;
      let set: z.infer<typeof localizedSetSchema>;
      try
      {
        set = await this.localizedSet(expansionId, resolved);
      }
      catch (error)
      {
        if (!(error instanceof ApiError) || error.status !== 404 || resolved === 'en') throw error;
        resolved = 'en';
        set = await this.localizedSet(expansionId, 'en');
      }
      if (!hasImages(set) && resolved !== 'en')
      {
        resolved = 'en';
        set = await this.localizedSet(expansionId, 'en');
      }
      if (!hasImages(set)) return [];
      const expansion = await this.expansion(expansionId);
      return set
        .cards
        .filter(card => card.setCode == null || String(card.setCode).toUpperCase() === expansion.code)
        .map<CatalogCard>(card =>
        {
          const imageUrls = [card.images.full, card.images.thumbnail].filter((url): url is string => Boolean(url));
          return {
            id: 60_000_000_000 + card.id,
            gameId: LORCANA_GAME_ID,
            categoryId: 1,
            expansionId,
            name: card.fullName,
            version: card.version ?? null,
            collectorNumber: card.number == null ? null : String(card.number),
            rarity: card.rarity ?? null,
            language: resolved,
            imageUrl: imageUrls[0] ?? null,
            imageUrls: [...new Set(imageUrls)],
          };
        });
    });
  }

  async details(card: CatalogCard, expansion: CardExpansion): Promise<CardDetails | null>
  {
    const language = z.enum(LORCANA_LANGUAGES).catch('en').parse(card.language ?? 'en');
    const set = await this.cache.get(
      `lorcana-details:${expansion.id}:${language}`,
      21_600_000,
      async () =>
        detailSetSchema.parse(
          await this.request(
            `/files/current/${language}/sets/setdata.${encodeURIComponent(expansion.code ?? '')}.json`,
          ),
        ),
    );
    const row = set.data.cards.find(item => item.id === card.id - 60_000_000_000);
    if (!row) return null;
    const facts: CardFact[] = [];
    const add = (key: CardFact['key'], value: unknown) =>
    {
      if (value !== undefined && value !== null && value !== '') facts.push({ key, value: String(value) });
    };
    add('ink', row.cost);
    if (row.inkwell != null) add('inkable', row.inkwell ? 'yes' : 'no');
    add('strength', row.strength);
    add('willpower', row.willpower);
    add('lore', row.lore);
    add('color', row.color);
    add('classifications', row.subtypesText);
    // Named abilities show their name as the block title; keywords ("Evasive", "Shift 5") read as they are printed.
    const blocks = (row.abilities ?? [])
      .map(ability =>
        ability.type === 'keyword' || !ability.name
          ? { text: ability.fullText ?? ability.effect ?? null }
          : { title: ability.name, text: ability.effect ?? null }
      )
      .filter(block => block.text);
    const formats = Object.entries(row.allowedInFormats ?? {}).map(([format, value]) => ({
      format,
      status: value.allowed ? 'legal' as const : 'not_legal' as const,
    }));
    return {
      kind: row.type ?? null,
      illustrator: row.artistsText ?? null,
      facts,
      formats,
      legal: formats.filter(item => item.status === 'legal').map(item => item.format),
      blocks: blocks.length ? blocks : row.fullText ? [{ text: row.fullText }] : [],
    };
  }

  async languages(expansionId: number)
  {
    return this.cache.get(`lorcana-languages:${expansionId}`, 86_400_000, async () =>
    {
      const available: (typeof LORCANA_LANGUAGES[number])[] = [];
      for (const language of LORCANA_LANGUAGES)
      {
        try
        {
          const set = await this.localizedSet(expansionId, language);
          if (hasImages(set)) available.push(language);
        }
        catch (error)
        {
          if (!(error instanceof ApiError) || error.status !== 404) throw error;
        }
      }
      return available;
    });
  }
}
