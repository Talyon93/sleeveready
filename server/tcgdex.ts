import { retryWithin, upstreamSignal } from './upstream.ts';
import { z } from 'zod';
import { Cache, Queue } from './cache.ts';
import { ApiError } from './api-error.ts';
import { decodeHtml } from './native-source.ts';
import { blobSetStore, isSettled, type SetStore } from './set-store.ts';
import type { CardDetails, CardExpansion, CardPrice, CardTextBlock, CatalogCard } from '../shared/model.ts';

export const POKEMON_GAME_ID = 9_000_000_002;
export const POKEMON_GAME = {
  id: POKEMON_GAME_ID,
  name: 'Pokemon',
  displayName: 'Pokémon',
  printLanguages: [
    'en',
    'it',
    'de',
    'fr',
    'es',
    'pt-br',
    'ja',
    'zh-tw',
    'id',
    'th',
    'pt',
    'pt-pt',
    'nl',
    'pl',
    'ru',
    'ko',
    'zh-cn',
  ],
  hasCardText: true,
} as const;
export const POKEMON_LANGUAGES = [
  'en',
  'it',
  'de',
  'fr',
  'es',
  'pt-br',
  'ja',
  'zh-tw',
  'id',
  'th',
  'pt',
  'pt-pt',
  'nl',
  'pl',
  'ru',
  'ko',
  'zh-cn',
] as const;
export const POKEMON_EXPANSION_ID_MIN = 10_000_000_000;

const apiOrigin = 'https://api.tcgdex.net';
const setBriefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cardCount: z.object({ total: z.number().int().nonnegative(), official: z.number().int().nonnegative() })
    .partial()
    .optional(),
});
const cardBriefSchema = z.object({
  id: z.string().min(1),
  localId: z.string().min(1),
  name: z.string().min(1),
  image: z.string().url().nullish(),
});
const setSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  releaseDate: z.string().nullish(),
  cards: z.array(cardBriefSchema).default([]),
});
// TCGdex leaves the modern ability label in English in every language.
const cardText = (value: string | null | undefined) =>
  value ? decodeHtml(value.replace(/<span[^>]*\btitle="([^"]*)"[^>]*>[^<]*<\/span>/g, '$1')) : null;
const ABILITY: Partial<Record<string, string>> = {
  it: 'Abilità',
  de: 'Fähigkeit',
  fr: 'Talent',
  es: 'Habilidad',
  pt: 'Habilidade',
  'pt-br': 'Habilidade',
  nl: 'Vaardigheid',
  pl: 'Zdolność',
};
const typePair = z.object({ type: z.string().nullish(), value: z.string().nullish() });
const cardDetailSchema = z.object({
  category: z.string().nullish(),
  rarity: z.string().nullish(),
  illustrator: z.string().nullish(),
  hp: z.union([z.number(), z.string()]).nullish(),
  types: z.array(z.string()).nullish(),
  stage: z.string().nullish(),
  trainerType: z.string().nullish(),
  energyType: z.string().nullish(),
  effect: z.string().nullish(),
  regulationMark: z.string().nullish(),
  retreat: z.number().nullish(),
  abilities: z.array(z.object({ type: z.string().nullish(), name: z.string(), effect: z.string().nullish() }))
    .nullish(),
  attacks: z.array(
    z.object({
      cost: z.array(z.string()).nullish(),
      name: z.string(),
      effect: z.string().nullish(),
      damage: z.union([z.number(), z.string()]).nullish(),
    }),
  )
    .nullish(),
  weaknesses: z.array(typePair).nullish(),
  resistances: z.array(typePair).nullish(),
  legal: z.record(z.string(), z.boolean()).nullish(),
  pricing: z.object({
    cardmarket: z.record(z.string(), z.unknown()).nullish(),
    tcgplayer: z.record(z.string(), z.unknown()).nullish(),
  })
    .nullish(),
});
// TCGdex prices: Cardmarket trend (holo only when there is no regular one), TCGplayer market price of the first finish listed.
function pokemonPrices(pricing: z.infer<typeof cardDetailSchema>['pricing']): CardPrice[]
{
  const prices: CardPrice[] = [];
  const number = (value: unknown) => typeof value === 'number' && value > 0 ? value : null;
  const day = (value: unknown) =>
    typeof value === 'string' ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const market = pricing?.cardmarket;
  if (market)
  {
    const regular = number(market.trend) ?? number(market.avg);
    const holo = number(market['trend-holo']) ?? number(market['avg-holo']);
    const amount = regular ?? holo;
    if (amount)
    {
      prices.push({ market: 'Cardmarket', currency: 'EUR', amount, foil: !regular, updated: day(market.updated) });
    }
  }
  const player = pricing?.tcgplayer;
  if (player)
  {
    const finish = Object.entries(player).find(([key, value]) =>
      key !== 'unit' && key !== 'updated' && value && typeof value === 'object'
      && number((value as Record<string, unknown>).marketPrice)
    );
    if (finish)
    {
      prices.push({
        market: 'TCGplayer',
        currency: 'USD',
        amount: number((finish[1] as Record<string, unknown>).marketPrice)!,
        foil: finish[0] !== 'normal',
        updated: day(player.updated),
      });
    }
  }
  return prices;
}
// A language counts as printable when at least half of the English set has artwork in it: TCGdex lists some sets in a
// language with only a couple of scanned cards, and offering that language would empty the set on screen.
const hasCardImages = (set: z.infer<typeof setSchema>, englishCount = set.cards.length) =>
  set.cards.length > 0
  && set.cards.filter(card => Boolean(card.image)).length * 2 >= Math.max(set.cards.length, englishCount);

// TCGdex lists a new set days or weeks before its scans. Until they arrive, the newest sets take their English card
// images from the Pokémon TCG API (pokemontcg.io, images on images.scrydex.com), matched by set name and card number.
// Only the image addresses are used, never stored files; one request per set and day, kept in Blobs between instances.
const fallbackOrigin = 'https://api.pokemontcg.io';
const fallbackSchema = z.object({
  data: z.array(
    z.object({
      number: z.string(),
      set: z.object({ name: z.string() }).passthrough(),
      images: z.object({ small: z.string().url().nullish(), large: z.string().url().nullish() }).passthrough(),
    })
      .passthrough(),
  ),
});
type FallbackImages = { checkedAt: number; images: Record<string, string[]> };
const FALLBACK_TTL = 86_400_000;
const FALLBACK_MISS_TTL = 6 * 3_600_000;
export const cardNumberKey = (value: string) => value.trim().toLowerCase().replace(/^0+(?=\d)/, '');

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

export const isPokemonExpansionId = (value: number) => value >= POKEMON_EXPANSION_ID_MIN;

export class TCGdex
{
  readonly cache = new Cache();
  readonly queue = new Queue(80);
  private knownLanguages = new Map<number, Set<string>>();
  constructor(
    private transport: typeof fetch = fetch,
    private pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
    private store: SetStore = blobSetStore(),
  )
  {}

  private async request(path: string): Promise<unknown>
  {
    const url = new URL(path, apiOrigin);
    if (url.origin !== apiOrigin) throw new ApiError(502, 'TCGdex returned an unexpected address.');
    return this.queue.run(async () =>
    {
      const started = Date.now();
      for (let attempt = 0; attempt < 3; attempt++)
      {
        try
        {
          const response = await this.transport(url, {
            headers: { Accept: 'application/json', 'User-Agent': 'SleeveReady/0.1 (+https://sleeveready.com)' },
            signal: upstreamSignal(15000, started),
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
                ? 'Pokémon set not available in this language.'
                : 'TCGdex is temporarily unavailable.',
            );
          }
          if (!(response.headers.get('content-type') ?? '').includes('application/json'))
          {
            await response.body?.cancel();
            throw new ApiError(502, 'TCGdex returned an invalid response.');
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
          throw new ApiError(502, 'Connection to TCGdex lost. Try again.');
        }
      }
      throw new ApiError(502, 'TCGdex unavailable.');
    });
  }

  async sets()
  {
    return this.cache.get('pokemon-sets', 86_400_000, async () =>
    {
      const rows = z.array(setBriefSchema).parse(await this.request('/v2/en/sets'));
      const listed = rows
        .filter(set => (set.cardCount?.total ?? 1) > 0 && (set.cardCount?.official ?? 1) > 0)
        .reverse();
      // The list has no dates; the newest sets' details do (enough for "coming soon" and the default set), one request each.
      const dates = new Map(
        await Promise.all(
          listed.slice(0, 6).map(async set =>
            [
              set.id,
              await this.request(`/v2/en/sets/${encodeURIComponent(set.id)}`).then(
                detail =>
                  z.object({ releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish() })
                    .passthrough()
                    .parse(detail)
                    .releaseDate ?? null,
                () => null,
              ),
            ] as const
          ),
        ),
      );
      const sets: CardExpansion[] = listed.map(set => ({
        id: stableNumericId(set.id, POKEMON_EXPANSION_ID_MIN),
        gameId: POKEMON_GAME_ID,
        code: set.id.toUpperCase(),
        name: set.name,
        releaseDate: dates.get(set.id) ?? null,
      }));
      const ids = new Set<number>();
      for (const set of sets)
      {
        if (ids.has(set.id)) throw new ApiError(502, 'Pokémon set id collision.');
        ids.add(set.id);
      }
      return sets;
    });
  }

  // Pokémon TCG Live decklists use the printed set abbreviation ("OBF"); TCGdex filters sets by it exactly.
  async expansionForCode(code: string)
  {
    const value = code.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,12}$/.test(value)) return null;
    const found = await this.cache.get(
      `pokemon-code:${value}`,
      86_400_000,
      async () =>
        z.array(setBriefSchema)
          .parse(await this.request(`/v2/en/sets?abbreviation.official=eq:${encodeURIComponent(value)}`))[0]
          ?.id ?? null,
    );
    if (!found.data) return null;
    const id = stableNumericId(found.data, POKEMON_EXPANSION_ID_MIN);
    return (await this.sets()).data.some(set => set.id === id) ? id : null;
  }

  // Every English printing with exactly this name; card ids are "<set>-<localId>".
  async otherPrintings(card: CatalogCard)
  {
    const name = card.name.trim();
    if (!name || name.length > 80) return [];
    const rows = await this.cache.get(
      `pokemon-printings:${name.toLowerCase()}`,
      86_400_000,
      async () =>
        z.array(cardBriefSchema).parse(await this.request(`/v2/en/cards?name=eq:${encodeURIComponent(name)}`)),
    );
    return this.briefCards(rows.data);
  }

  // Every card by an illustrator, as TCGdex credits them ("Mousho"), in English.
  async byIllustrator(artist: string)
  {
    const name = artist.trim();
    if (!name || name.length > 80) return [];
    const rows = await this.cache.get(
      `pokemon-illustrator:${name.toLowerCase()}`,
      86_400_000,
      async () =>
        z.array(cardBriefSchema).parse(await this.request(`/v2/en/cards?illustrator=eq:${encodeURIComponent(name)}`)),
    );
    return this.briefCards(rows.data);
  }

  async illustrators()
  {
    return (await this.cache.get(
      'pokemon-illustrators',
      86_400_000,
      async () => z.array(z.string()).parse(await this.request('/v2/en/illustrators')),
    ))
      .data;
  }

  // Search results are brief cards with ids "<set>-<localId>"; only those with artwork are useful to a card page.
  private briefCards(rows: z.infer<typeof cardBriefSchema>[])
  {
    return rows.filter(row => row.image && row.id.endsWith('-' + row.localId)).map(row =>
    {
      const base = row.image!.replace(/\/$/, '');
      const imageUrls = [`${base}/high.webp`, `${base}/high.png`, `${base}/low.webp`];
      return {
        id: stableNumericId(row.id, 20_000_000_000),
        gameId: POKEMON_GAME_ID,
        categoryId: 1,
        expansionId: stableNumericId(row.id.slice(0, -row.localId.length - 1), POKEMON_EXPANSION_ID_MIN),
        name: row.name,
        version: null,
        collectorNumber: row.localId,
        rarity: null,
        language: 'en',
        imageUrl: imageUrls[0],
        imageUrls,
      } satisfies CatalogCard;
    });
  }

  // Game data of one card in the language it is shown in; types, stages and texts come translated from TCGdex.
  async details(card: CatalogCard, expansion: CardExpansion): Promise<CardDetails | null>
  {
    if (!expansion.code || !card.collectorNumber) return null;
    const language = z.enum(POKEMON_LANGUAGES).catch('en').parse(card.language ?? 'en');
    const id = `${expansion.code.toLowerCase()}-${card.collectorNumber}`;
    const row = (await this.cache.get(`pokemon-card:${language}:${id}`, 86_400_000, async () =>
    {
      try
      {
        return cardDetailSchema.parse(await this.request(`/v2/${language}/cards/${encodeURIComponent(id)}`));
      }
      catch (error)
      {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    }))
      .data;
    if (!row) return null;
    const pair = (items: { type?: string | null; value?: string | null }[] | null | undefined) =>
      items?.length ? items.map(item => [item.type, item.value].filter(Boolean).join(' ')).join(', ') : null;
    const blocks: CardTextBlock[] = [
      ...(row.abilities ?? []).map(item => ({
        title: item.name,
        meta: item.type === 'Ability' ? ABILITY[language] ?? item.type : item.type ?? null,
        text: cardText(item.effect),
      })),
      ...(row.attacks ?? []).map(item => ({
        title: item.name,
        meta:
          [(item.cost ?? []).join(' '), item.damage === undefined || item.damage === null ? '' : String(item.damage)]
            .filter(Boolean)
            .join(' · ') || null,
        text: cardText(item.effect),
      })),
      ...(row.effect ? [{ text: cardText(row.effect) }] : []),
    ];
    return {
      kind: [row.category, row.stage ?? row.trainerType ?? row.energyType, (row.types ?? []).join(' / ')]
        .filter(Boolean)
        .join(' · ') || null,
      hp: row.hp ? String(row.hp) : null,
      rarity: row.rarity ?? null,
      illustrator: row.illustrator ?? null,
      regulation: row.regulationMark ?? null,
      weakness: pair(row.weaknesses),
      resistance: pair(row.resistances),
      retreat: row.retreat === undefined || row.retreat === null ? null : String(row.retreat),
      legal: Object.entries(row.legal ?? {}).filter(([, legal]) => legal).map(([format]) =>
        format[0].toUpperCase() + format.slice(1)
      ),
      blocks,
      prices: pokemonPrices(row.pricing),
      formats: Object.entries(row.legal ?? {}).map(([format, legal]) => ({
        format: format[0].toUpperCase() + format.slice(1),
        status: legal ? 'legal' as const : 'not_legal' as const,
      })),
    };
  }

  private async resolveSet(expansionId: number)
  {
    const expansion = (await this.sets()).data.find(set => set.id === expansionId);
    if (!expansion?.code) throw new ApiError(404, 'Pokémon set not found.');
    return expansion.code.toLowerCase();
  }

  private async localizedSet(expansionId: number, language: string)
  {
    const setId = await this.resolveSet(expansionId);
    return setSchema.parse(await this.request(`/v2/${encodeURIComponent(language)}/sets/${encodeURIComponent(setId)}`));
  }

  async cards(expansionId: number, language = 'en')
  {
    const requestedLanguage = z.enum(POKEMON_LANGUAGES).parse(language);
    return this.cache.get(`pokemon-cards:${expansionId}:${requestedLanguage}`, 21_600_000, async () =>
    {
      const code = await this.settledCode(expansionId);
      const storeKey = code ? `pokemon/cards/${code}/${requestedLanguage}` : null;
      const stored = storeKey ? await this.store.read<CatalogCard[]>(storeKey) : null;
      if (stored?.length)
      {
        const seen = this.knownLanguages.get(expansionId) ?? new Set<string>();
        for (const card of stored) if (card.language) seen.add(card.language);
        this.knownLanguages.set(expansionId, seen);
        return stored;
      }
      let resolvedLanguage: typeof POKEMON_LANGUAGES[number] = requestedLanguage;
      let set: z.infer<typeof setSchema>;
      try
      {
        set = await this.localizedSet(expansionId, requestedLanguage);
      }
      catch (error)
      {
        if (!(error instanceof ApiError) || error.status !== 404 || requestedLanguage === 'en') throw error;
        resolvedLanguage = 'en';
        set = await this.localizedSet(expansionId, 'en');
      }
      const englishCount = resolvedLanguage === 'en'
        ? set.cards.length
        : (await this.cards(expansionId, 'en')).data.length;
      if (!hasCardImages(set, englishCount) && resolvedLanguage !== 'en')
      {
        resolvedLanguage = 'en';
        set = await this.localizedSet(expansionId, 'en');
      }
      // English is the fallback: any artwork keeps the set, even a newly released one with few scans. A new set with no
      // scans at all takes the Pokémon TCG API's images, in English.
      let borrowed: Record<string, string[]> = {};
      if (!set.cards.some(card => Boolean(card.image)))
      {
        if (resolvedLanguage !== 'en')
        {
          resolvedLanguage = 'en';
          set = await this.localizedSet(expansionId, 'en');
        }
        borrowed = await this.fallbackImages(expansionId, set.name);
        if (!set.cards.some(card => borrowed[cardNumberKey(card.localId)])) return [];
      }
      const known = this.knownLanguages.get(expansionId) ?? new Set<string>();
      known.add(resolvedLanguage);
      this.knownLanguages.set(expansionId, known);
      const cards: CatalogCard[] = set.cards.map(card =>
      {
        const base = card.image?.replace(/\/$/, '') ?? null;
        const imageUrls = base
          ? [`${base}/high.webp`, `${base}/high.png`, `${base}/low.webp`]
          : borrowed[cardNumberKey(card.localId)] ?? [];
        return {
          id: stableNumericId(card.id, 20_000_000_000),
          gameId: POKEMON_GAME_ID,
          categoryId: 1,
          expansionId,
          name: card.name,
          version: null,
          collectorNumber: card.localId,
          rarity: null,
          language: resolvedLanguage,
          imageUrl: imageUrls[0] ?? null,
          imageUrls,
        };
      });
      const ids = new Set<number>();
      for (const card of cards)
      {
        if (ids.has(card.id)) throw new ApiError(502, 'Pokémon card id collision.');
        ids.add(card.id);
      }
      // Kept only once every card has TCGdex artwork: a set still being scanned (or shown with borrowed images) would
      // otherwise stay that way for 30 days.
      if (storeKey && !Object.keys(borrowed).length && cards.every(card => card.imageUrl))
      {
        await this.store.write(storeKey, cards);
      }
      return cards;
    });
  }

  // English images of a new set from the Pokémon TCG API, by card number; only for the six newest sets (older ones
  // without scans are promos and oddities TCGdex will not scan). An unavailable API means no images, as before.
  private async fallbackImages(expansionId: number, setName: string): Promise<Record<string, string[]>>
  {
    const sets = (await this.sets()).data;
    const index = sets.findIndex(set => set.id === expansionId);
    if (index < 0 || index >= 6 || !sets[index].code) return {};
    const key = `pokemon/fallback-images/${sets[index].code!.toLowerCase()}`;
    return (await this
      .cache
      .get(`pokemon-fallback:${expansionId}`, FALLBACK_MISS_TTL, async () =>
      {
        const kept = await this.store.read<FallbackImages>(key);
        if (kept && Date.now() - kept.checkedAt < (Object.keys(kept.images).length ? FALLBACK_TTL : FALLBACK_MISS_TTL))
        {
          return kept.images;
        }
        const url = new URL('/v2/cards', fallbackOrigin);
        url.searchParams.set('q', `set.name:"${setName.replace(/["\\]/g, '')}"`);
        url.searchParams.set('pageSize', '250');
        url.searchParams.set('select', 'number,images,set');
        // The API answers 500 now and then: a few tries, then nothing (the set stays without images until the next try).
        for (let attempt = 0; attempt < 4; attempt++)
        {
          try
          {
            const response = await this.transport(url, {
              headers: { Accept: 'application/json', 'User-Agent': 'SleeveReady/0.1 (+https://sleeveready.com)' },
              signal: upstreamSignal(15000),
              redirect: 'error',
            });
            if (!response.ok)
            {
              await response.body?.cancel();
              throw new Error(String(response.status));
            }
            const rows = fallbackSchema.parse(await response.json()).data.filter(row =>
              row.set.name.toLowerCase() === setName.toLowerCase()
            );
            const images: Record<string, string[]> = {};
            for (const row of rows)
            {
              const urls = [row.images.large, row.images.small].filter((value): value is string => Boolean(value));
              if (urls.length) images[cardNumberKey(row.number)] = urls;
            }
            await this.store.write(key, { checkedAt: Date.now(), images } satisfies FallbackImages);
            return images;
          }
          catch
          {
            if (attempt < 3) await this.pause(500 * 2 ** attempt);
          }
        }
        throw new Error('Pokémon TCG API unavailable');
      })
      .catch(() => ({ data: {} as Record<string, string[]> })))
      .data;
  }

  // Older expansions stop changing: their lists are kept in Blobs, so a new function instance reads one stored list
  // instead of TCGdex again (languages() alone asks for the set in every language, about 2 seconds). The list dates only
  // the newest six sets, so those count by date and every older one is settled.
  private async settledCode(expansionId: number)
  {
    const sets = (await this.sets()).data;
    const index = sets.findIndex(set => set.id === expansionId);
    if (index < 0 || !sets[index].code) return null;
    return index >= 6 || isSettled(sets[index].releaseDate) ? sets[index].code!.toLowerCase() : null;
  }

  async languages(expansionId: number)
  {
    return this.cache.get(`pokemon-languages:${expansionId}`, 86_400_000, async () =>
    {
      const code = await this.settledCode(expansionId);
      const storeKey = code ? `pokemon/languages/${code}` : null;
      const stored = storeKey ? await this.store.read<(typeof POKEMON_LANGUAGES[number])[]>(storeKey) : null;
      if (stored?.length)
      {
        this.knownLanguages.set(expansionId, new Set(stored));
        return stored;
      }
      const known = this.knownLanguages.get(expansionId) ?? new Set<string>();
      const available: (typeof POKEMON_LANGUAGES[number])[] = [];
      const english = (await this.cards(expansionId, 'en')).data;
      const englishCount = english.length;
      for (const language of POKEMON_LANGUAGES)
      {
        if (known.has(language))
        {
          available.push(language);
          continue;
        }
        try
        {
          const set = await this.localizedSet(expansionId, language);
          if (hasCardImages(set, englishCount)) available.push(language);
        }
        catch (error)
        {
          if (!(error instanceof ApiError) || error.status !== 404) throw error;
        }
      }
      this.knownLanguages.set(expansionId, new Set(available));
      if (storeKey && available.length && english.every(card => card.imageUrl))
      {
        await this.store.write(storeKey, available);
      }
      return available;
    });
  }
}
