import { retryWithin, upstreamSignal } from './upstream.ts';
import { z } from 'zod';
import { Cache, Queue } from './cache.ts';
import { ApiError } from './api-error.ts';
import type { CardExpansion, CatalogCard } from '../shared/model.ts';

export const STAR_WARS_GAME_ID = 9_000_000_007;
export const STAR_WARS_LANGUAGES = ['en', 'it', 'de', 'fr', 'es'] as const;
export const STAR_WARS_GAME = {
  id: STAR_WARS_GAME_ID,
  name: 'Star Wars',
  displayName: 'Star Wars Unlimited',
  printLanguages: [...STAR_WARS_LANGUAGES],
} as const;
export const STAR_WARS_EXPANSION_ID_MIN = 65_000_000_000;
export const STAR_WARS_EXPANSION_ID_MAX = 69_294_967_295;

const officialOrigin = 'https://admin.starwarsunlimited.com';
const setsOrigin = 'https://api.swu-db.com';
const setSchema = z.object({
  setId: z.string().min(1),
  fullName: z.string().min(1),
  releaseDate: z.string().nullish(),
  numberCards: z.number().int().nonnegative(),
  isBaseSet: z.boolean().optional(),
})
  .passthrough();
const mediaSchema = z.object({
  data: z.object({
    attributes: z.object({
      url: z.string().url(),
      formats: z.object({
        card: z.object({ url: z.string().url() }).optional(),
        xsmall: z.object({ url: z.string().url() }).optional(),
      })
        .passthrough()
        .optional(),
    })
      .passthrough(),
  })
    .nullable(),
});
const relationSchema = <T extends z.ZodTypeAny>(attributes: T) =>
  z.object({ data: z.object({ attributes }).nullable() });
const cardSchema = z.object({
  id: z.number().int().positive(),
  attributes: z.object({
    title: z.string().min(1),
    subtitle: z.string().nullish(),
    cardNumber: z.union([z.number(), z.string()]),
    cardId: z.string().nullish(),
    cardUid: z.string().nullish(),
    locale: z.string().min(2),
    artFrontHorizontal: z.boolean().nullish(),
    artFront: mediaSchema,
    artBack: mediaSchema,
    rarity: relationSchema(z.object({ name: z.string().nullish() }).passthrough()),
    expansion: relationSchema(z.object({ code: z.string().min(1) }).passthrough()),
  })
    .passthrough(),
});
const listSchema = z.object({
  data: z.array(cardSchema),
  meta: z.object({
    pagination: z.object({
      page: z.number().int().positive(),
      pageCount: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
  }),
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
function releaseDate(value: string | null | undefined)
{
  if (!value) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value);
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}
function mediaUrls(media: z.infer<typeof mediaSchema>)
{
  const data = media.data?.attributes;
  if (!data) return [];
  return [
    ...new Set(
      [data.formats?.card?.url, data.url, data.formats?.xsmall?.url].filter((value): value is string => Boolean(value)),
    ),
  ];
}
export const isStarWarsExpansionId = (value: number) =>
  value >= STAR_WARS_EXPANSION_ID_MIN && value <= STAR_WARS_EXPANSION_ID_MAX;

export class StarWarsCatalog
{
  readonly cache = new Cache();
  readonly queue = new Queue(180);
  constructor(
    private transport: typeof fetch = fetch,
    private pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  )
  {}

  private async request(url: URL)
  {
    if (![officialOrigin, setsOrigin].includes(url.origin))
    {
      throw new ApiError(502, 'The Star Wars Unlimited source returned an unexpected address.');
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
            signal: upstreamSignal(30_000, started),
            redirect: 'error',
          });
          if (!response.ok)
          {
            if ((response.status === 429 || response.status >= 500) && retryWithin(started, attempt))
            {
              await response.body?.cancel();
              await this.pause(600 * 2 ** attempt);
              continue;
            }
            await response.body?.cancel();
            throw new ApiError(
              response.status === 404 ? 404 : 502,
              response.status === 404
                ? 'Star Wars Unlimited data not found.'
                : 'The Star Wars Unlimited catalog is temporarily unavailable.',
            );
          }
          if (!(response.headers.get('content-type') ?? '').includes('json'))
          {
            await response.body?.cancel();
            throw new ApiError(502, 'The Star Wars Unlimited source returned an invalid response.');
          }
          return response.json();
        }
        catch (error)
        {
          if (error instanceof ApiError) throw error;
          if (retryWithin(started, attempt))
          {
            await this.pause(600 * 2 ** attempt);
            continue;
          }
          throw new ApiError(502, 'Connection to Star Wars Unlimited lost. Try again.');
        }
      }
      throw new ApiError(502, 'Star Wars Unlimited catalog unavailable.');
    });
  }

  private async expansion(expansionId: number)
  {
    const expansion = (await this.sets()).data.find(set => set.id === expansionId);
    if (!expansion?.code) throw new ApiError(404, 'Star Wars Unlimited set not found.');
    return expansion;
  }
  private async page(code: string, language: typeof STAR_WARS_LANGUAGES[number], page: number)
  {
    const url = new URL('/api/card-list', officialOrigin);
    url.search = new URLSearchParams({
      locale: language,
      'filters[variantOf][id][$null]': 'true',
      'filters[expansion][code][$eq]': code,
      'pagination[page]': String(page),
      'pagination[pageSize]': '250',
    })
      .toString();
    return listSchema.parse(await this.request(url));
  }
  private async localizedRows(code: string, language: typeof STAR_WARS_LANGUAGES[number])
  {
    return this.cache.get(`star-wars-source:${code}:${language}`, 21_600_000, async () =>
    {
      const first = await this.page(code, language, 1);
      const pages = [first];
      for (let page = 2; page <= first.meta.pagination.pageCount; page++)
      {
        pages.push(await this.page(code, language, page));
      }
      return pages.flatMap(result => result.data).filter(card =>
        card.attributes.locale === language && card.attributes.expansion.data?.attributes.code === code
      );
    });
  }

  async sets()
  {
    return this.cache.get('star-wars-sets', 86_400_000, async () =>
    {
      const rows = z.array(setSchema).parse(await this.request(new URL('/sets', setsOrigin)));
      return rows
        .filter(set => set.isBaseSet && set.numberCards > 0)
        .map<CardExpansion>(set => ({
          id: stableNumericId(set.setId.toUpperCase(), STAR_WARS_EXPANSION_ID_MIN),
          gameId: STAR_WARS_GAME_ID,
          code: set.setId.toUpperCase(),
          name: set.fullName,
          releaseDate: releaseDate(set.releaseDate),
        }))
        .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || a.name.localeCompare(b.name));
    });
  }

  async cards(expansionId: number, language = 'en')
  {
    const requested = z.enum(STAR_WARS_LANGUAGES).parse(language);
    return this.cache.get(`star-wars-cards:${expansionId}:${requested}`, 21_600_000, async () =>
    {
      const expansion = await this.expansion(expansionId);
      let resolved: typeof STAR_WARS_LANGUAGES[number] = requested;
      let rows = (await this.localizedRows(expansion.code!, resolved)).data;
      if (
        !rows.some(card => mediaUrls(card.attributes.artFront).length || mediaUrls(card.attributes.artBack).length)
        && resolved !== 'en'
      )
      {
        resolved = 'en';
        rows = (await this.localizedRows(expansion.code!, 'en')).data;
      }
      const cards: CatalogCard[] = [];
      for (const card of rows)
      {
        const value = card.attributes;
        const sourceId = value.cardId ?? value.cardUid ?? String(card.id);
        const title = value.subtitle ? `${value.title}, ${value.subtitle}` : value.title;
        const front = mediaUrls(value.artFront);
        const back = mediaUrls(value.artBack);
        const common = {
          gameId: STAR_WARS_GAME_ID,
          categoryId: 1,
          expansionId,
          rarity: value.rarity.data?.attributes.name ?? null,
          language: resolved,
        };
        if (back.length)
        {
          cards.push({
            id: stableNumericId(`${resolved}:${sourceId}:back`, 75_000_000_000),
            ...common,
            name: title,
            version: 'Back',
            collectorNumber: String(value.cardNumber),
            imageUrl: back[0],
            imageUrls: back,
          });
        }
        if (front.length)
        {
          cards.push({
            id: stableNumericId(`${resolved}:${sourceId}:front`, 75_000_000_000),
            ...common,
            name: title,
            version: back.length ? 'Front' : null,
            collectorNumber: String(value.cardNumber),
            imageUrl: front[0],
            imageUrls: front,
          });
        }
      }
      return cards;
    });
  }

  // Decklists name cards as "Title, Subtitle"; the official API filters on both, across every expansion.
  async locateByName(name: string)
  {
    const [title, ...rest] = name.split(', ');
    const subtitle = rest.join(', ');
    return this
      .cache
      .get(`star-wars-locate:${name.toLowerCase()}`, 86_400_000, async () =>
      {
        const url = new URL('/api/card-list', officialOrigin);
        url.search = new URLSearchParams({
          locale: 'en',
          'filters[title][$eqi]': title,
          ...(subtitle ? { 'filters[subtitle][$eqi]': subtitle } : {}),
          'filters[variantOf][id][$null]': 'true',
          'pagination[pageSize]': '20',
        })
          .toString();
        const codes = listSchema
          .parse(await this.request(url))
          .data
          .map(card => card.attributes.expansion.data?.attributes.code)
          .filter((code): code is string => Boolean(code));
        const sets = (await this.sets()).data;
        return [...new Set(codes)].map(code => sets.find(set => set.code === code.toUpperCase())?.id).filter((
          id,
        ): id is number => id != null);
      })
      .then(result => result.data);
  }

  async languages(expansionId: number)
  {
    return this.cache.get(`star-wars-languages:${expansionId}`, 86_400_000, async () =>
    {
      const expansion = await this.expansion(expansionId);
      const available: (typeof STAR_WARS_LANGUAGES[number])[] = [];
      for (const language of STAR_WARS_LANGUAGES)
      {
        try
        {
          const rows = (await this.localizedRows(expansion.code!, language)).data;
          if (
            rows.some(card => mediaUrls(card.attributes.artFront).length || mediaUrls(card.attributes.artBack).length)
          ) available.push(language);
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
