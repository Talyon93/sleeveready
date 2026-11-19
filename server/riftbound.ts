import { retryWithin, upstreamSignal } from './upstream.ts';
import { z } from 'zod';
import { Cache, Queue } from './cache.ts';
import { ApiError } from './api-error.ts';
import type { CardDetails, CardExpansion, CardFact, CatalogCard } from '../shared/model.ts';

export const RIFTBOUND_GAME_ID = 9_000_000_005;
export const RIFTBOUND_GAME = {
  id: RIFTBOUND_GAME_ID,
  name: 'Riftbound',
  displayName: 'Riftbound',
  printLanguages: ['en', 'zh-cn', 'zh-tw', 'ko'],
  hasCardText: true,
} as const;
export const RIFTBOUND_LANGUAGES = ['en', 'zh-cn', 'zh-tw', 'ko'] as const;
export const RIFTBOUND_EXPANSION_ID_MIN = 55_000_000_000;
export const RIFTBOUND_EXPANSION_ID_MAX = 59_294_967_295;

const siteOrigin = 'https://playriftbound.com';
const localeFor = { en: 'en-us', 'zh-cn': 'zh-cn', 'zh-tw': 'zh-tw', ko: 'ko-kr' } as const;
const releaseDates: Record<string, string> = {
  OGN: '2025-10-31',
  OGS: '2025-10-31',
  SFD: '2026-02-13',
  UNL: '2026-05-08',
  VEN: '2026-07-31',
  RAD: '2026-10-23',
};
const imageSchema = z.object({ url: z.string().url() }).passthrough();
const cardSchema = z.object({
  id: z.string().min(1),
  collectorNumber: z.union([z.number(), z.string()]),
  name: z.string().min(1),
  subtitle: z.string().nullish(),
  publicCode: z.string().min(1),
  set: z.object({ value: z.object({ id: z.string().min(1), label: z.string().min(1) }) }),
  rarity: z.object({ value: z.object({ label: z.string().min(1) }) }).nullish(),
  cardImage: imageSchema,
})
  .passthrough();
const setSchema = z.object({ id: z.string().min(1), name: z.string().min(1) }).passthrough();
type Gallery = { sets: z.infer<typeof setSchema>[]; cards: z.infer<typeof cardSchema>[] };

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
function findGallery(value: unknown): Gallery | null
{
  const stack: unknown[] = [value];
  while (stack.length)
  {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    const record = current as Record<string, unknown>;
    const cardsRecord = record.cards && typeof record.cards === 'object'
      ? record.cards as Record<string, unknown>
      : null;
    const setsRecord = record.sets && typeof record.sets === 'object' ? record.sets as Record<string, unknown> : null;
    if (cardsRecord && setsRecord)
    {
      const cards = z.array(cardSchema).safeParse(cardsRecord.items);
      const sets = z.array(setSchema).safeParse(setsRecord.items);
      if (cards.success && sets.success && cards.data.length && sets.data.length)
      {
        return { cards: cards.data, sets: sets.data };
      }
    }
    if (Array.isArray(current)) stack.push(...current);
    else stack.push(...Object.values(record));
  }
  return null;
}
function extractGallery(html: string): Gallery
{
  const match = /<script\s+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match) throw new ApiError(502, 'The official Riftbound gallery returned an unrecognised page.');
  let data: unknown;
  try
  {
    data = JSON.parse(match[1]);
  }
  catch
  {
    throw new ApiError(502, 'The official Riftbound gallery returned invalid data.');
  }
  const gallery = findGallery(data);
  if (!gallery) throw new ApiError(502, 'The Riftbound catalog is missing from the official page.');
  return gallery;
}

// Card page data from the gallery entry: type, domains, energy / might / power, tags, ability text and artist.
const labelled = z.object({
  value: z.object({ label: z.string() }).passthrough().nullish(),
  values: z.array(z.object({ label: z.string() }).passthrough()).nullish(),
  type: z.array(z.object({ label: z.string() }).passthrough()).nullish(),
  tags: z.array(z.string()).nullish(),
})
  .passthrough();
const galleryDetails = z.object({
  cardType: labelled.nullish(),
  domain: labelled.nullish(),
  energy: labelled.nullish(),
  might: labelled.nullish(),
  power: labelled.nullish(),
  tags: labelled.nullish(),
  illustrator: labelled.nullish(),
  text: z.object({ richText: z.object({ body: z.string() }).passthrough().nullish() }).passthrough().nullish(),
  effect: z.object({ richText: z.object({ body: z.string() }).passthrough().nullish() }).passthrough().nullish(),
})
  .passthrough();
// The ability HTML as text: one line per paragraph or line break, tags dropped, entities decoded.
export function riftboundText(html: string)
{
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\n{2,}/g, '\n')
    .trim();
}
export const isRiftboundExpansionId = (value: number) =>
  value >= RIFTBOUND_EXPANSION_ID_MIN && value <= RIFTBOUND_EXPANSION_ID_MAX;

export class RiftboundCatalog
{
  readonly cache = new Cache();
  readonly queue = new Queue(120);
  constructor(
    private transport: typeof fetch = fetch,
    private pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  )
  {}

  private async request(language: typeof RIFTBOUND_LANGUAGES[number])
  {
    const locale = localeFor[language];
    const url = new URL(`/${locale}/card-gallery/`, siteOrigin);
    if (url.origin !== siteOrigin) throw new ApiError(502, 'The Riftbound source returned an unexpected address.');
    return this.queue.run(async () =>
    {
      const started = Date.now();
      for (let attempt = 0; attempt < 3; attempt++)
      {
        try
        {
          const response = await this.transport(url, {
            headers: { Accept: 'text/html', 'User-Agent': 'SleeveReady/0.1 (+https://sleeveready.com)' },
            signal: upstreamSignal(25000, started),
            redirect: 'error',
          });
          if (!response.ok)
          {
            if ((response.status === 429 || response.status >= 500) && retryWithin(started, attempt))
            {
              await response.body?.cancel();
              await this.pause(500 * 2 ** attempt);
              continue;
            }
            await response.body?.cancel();
            throw new ApiError(
              response.status === 404 ? 404 : 502,
              response.status === 404
                ? 'Riftbound catalog not available in this language.'
                : 'The official Riftbound gallery is temporarily unavailable.',
            );
          }
          const contentType = response.headers.get('content-type') ?? '';
          if (!contentType.includes('text/html'))
          {
            await response.body?.cancel();
            throw new ApiError(502, 'The Riftbound source returned an invalid response.');
          }
          const declared = Number(response.headers.get('content-length') ?? 0);
          if (declared > 8_000_000)
          {
            await response.body?.cancel();
            throw new ApiError(502, 'The Riftbound response is larger than allowed.');
          }
          const html = await response.text();
          if (html.length > 8_000_000) throw new ApiError(502, 'The Riftbound response is larger than allowed.');
          return extractGallery(html);
        }
        catch (error)
        {
          if (error instanceof ApiError) throw error;
          if (retryWithin(started, attempt))
          {
            await this.pause(500 * 2 ** attempt);
            continue;
          }
          throw new ApiError(502, 'Connection to Riftbound lost. Try again.');
        }
      }
      throw new ApiError(502, 'Riftbound catalog unavailable.');
    });
  }
  private gallery(language: typeof RIFTBOUND_LANGUAGES[number])
  {
    return this.cache.get(`riftbound-gallery:${language}`, 21_600_000, () => this.request(language));
  }
  private async expansion(expansionId: number)
  {
    const expansion = (await this.sets()).data.find(set => set.id === expansionId);
    if (!expansion?.code) throw new ApiError(404, 'Riftbound set not found.');
    return expansion;
  }
  // The gallery occasionally repeats a card across page sections; keep the first copy of each id.
  private rows(gallery: Gallery, code: string)
  {
    const seen = new Set<string>();
    return gallery.cards.filter(card =>
      card.set.value.id.toUpperCase() === code && Boolean(card.cardImage.url) && !seen.has(card.id)
      && Boolean(seen.add(card.id))
    );
  }
  private hasLocalizedImages(english: z.infer<typeof cardSchema>[], candidate: z.infer<typeof cardSchema>[])
  {
    if (!english.length || !candidate.length) return false;
    const englishImages = new Map(english.map(card => [card.id, card.cardImage.url]));
    const localized = candidate.filter(card => englishImages.get(card.id) !== card.cardImage.url).length;
    return localized / candidate.length >= 0.8;
  }

  async sets()
  {
    return this.cache.get('riftbound-sets', 86_400_000, async () =>
    {
      const gallery = (await this.gallery('en')).data;
      const sets: CardExpansion[] = gallery
        .sets
        .map(set => ({
          id: stableNumericId(set.id.toUpperCase(), RIFTBOUND_EXPANSION_ID_MIN),
          gameId: RIFTBOUND_GAME_ID,
          code: set.id.toUpperCase(),
          name: set.name,
          releaseDate: releaseDates[set.id.toUpperCase()] ?? null,
        }))
        .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || a.name.localeCompare(b.name));
      const ids = new Set<number>();
      for (const set of sets)
      {
        if (ids.has(set.id)) throw new ApiError(502, 'Riftbound set id collision.');
        ids.add(set.id);
      }
      return sets;
    });
  }

  async cards(expansionId: number, language = 'en')
  {
    const requested = z.enum(RIFTBOUND_LANGUAGES).parse(language);
    return this.cache.get(`riftbound-cards:${expansionId}:${requested}`, 21_600_000, async () =>
    {
      const expansion = await this.expansion(expansionId);
      const english = this.rows((await this.gallery('en')).data, expansion.code!);
      let resolved: typeof RIFTBOUND_LANGUAGES[number] = requested;
      let rows = english;
      if (requested !== 'en')
      {
        const candidate = this.rows((await this.gallery(requested)).data, expansion.code!);
        if (this.hasLocalizedImages(english, candidate)) rows = candidate;
        else resolved = 'en';
      }
      const cards: CatalogCard[] = rows.map(card => ({
        id: stableNumericId(card.id, 65_000_000_000),
        gameId: RIFTBOUND_GAME_ID,
        categoryId: 1,
        expansionId,
        name: card.subtitle ? `${card.name}, ${card.subtitle}` : card.name,
        version: null,
        collectorNumber: String(card.collectorNumber),
        rarity: card.rarity?.value.label ?? null,
        language: resolved,
        imageUrl: card.cardImage.url,
        imageUrls: [card.cardImage.url],
      }));
      const ids = new Set<number>();
      for (const card of cards)
      {
        if (ids.has(card.id)) throw new ApiError(502, 'Riftbound card id collision.');
        ids.add(card.id);
      }
      return cards;
    });
  }

  async details(card: CatalogCard, expansion: CardExpansion): Promise<CardDetails | null>
  {
    const language = z.enum(RIFTBOUND_LANGUAGES).catch('en').parse(card.language ?? 'en');
    const rows = this.rows((await this.gallery(language)).data, expansion.code ?? '');
    const found = rows.find(item => stableNumericId(item.id, 65_000_000_000) === card.id)
      ?? this.rows((await this.gallery('en')).data, expansion.code ?? '').find(item =>
        stableNumericId(item.id, 65_000_000_000) === card.id
      );
    if (!found) return null;
    const row = galleryDetails.parse(found);
    const facts: CardFact[] = [];
    const add = (key: CardFact['key'], value: string | null | undefined) =>
    {
      if (value) facts.push({ key, value });
    };
    add('energy', row.energy?.value?.label);
    add('might', row.might?.value?.label);
    add('power', row.power?.value?.label);
    add('domain', row.domain?.values?.map(item => item.label).join(', '));
    add('tags', row.tags?.tags?.join(', '));
    const html = row.text?.richText?.body ?? row.effect?.richText?.body ?? '';
    const text = html ? riftboundText(html) : '';
    return {
      kind: row.cardType?.type?.map(item => item.label).join(' · ') || null,
      illustrator: row.illustrator?.values?.map(item => item.label).join(', ') || null,
      facts,
      blocks: text ? [{ text }] : [],
    };
  }

  async languages(expansionId: number)
  {
    return this.cache.get(`riftbound-languages:${expansionId}`, 86_400_000, async () =>
    {
      const expansion = await this.expansion(expansionId);
      const english = this.rows((await this.gallery('en')).data, expansion.code!);
      const available: (typeof RIFTBOUND_LANGUAGES[number])[] = english.length ? ['en'] : [];
      for (const language of RIFTBOUND_LANGUAGES.filter(value => value !== 'en'))
      {
        try
        {
          const candidate = this.rows((await this.gallery(language)).data, expansion.code!);
          if (this.hasLocalizedImages(english, candidate)) available.push(language);
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
