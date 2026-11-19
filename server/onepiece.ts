import { retryWithin, upstreamSignal } from './upstream.ts';
import { z } from 'zod';
import { Cache, Queue } from './cache.ts';
import { ApiError } from './api-error.ts';
import { decodeHtml } from './native-source.ts';
import type { CardDetails, CardExpansion, CardFact, CatalogCard } from '../shared/model.ts';
import releases from './data/releases.json' with { type: 'json' };

export const ONE_PIECE_GAME_ID = 9_000_000_003;
export const ONE_PIECE_GAME = {
  id: ONE_PIECE_GAME_ID,
  name: 'One Piece',
  displayName: 'One Piece',
  printLanguages: ['en', 'fr', 'th'],
  hasCardText: true,
} as const;
export const ONE_PIECE_LANGUAGES = ['en', 'fr', 'th'] as const;
export const ONE_PIECE_EXPANSION_ID_MIN = 30_000_000_000;
export const ONE_PIECE_EXPANSION_ID_MAX = 34_294_967_295;
type OnePieceLanguage = typeof ONE_PIECE_LANGUAGES[number];

// The official card lists (Bandai) per language: a series menu, then one page per series with every card it contains.
// English series ids are the expansion ids' source, so ids stay stable; other languages match series by their code.
const officialOrigins = {
  en: 'https://en.onepiece-cardgame.com',
  fr: 'https://fr.onepiece-cardgame.com',
  th: 'https://asia-th.onepiece-cardgame.com',
} as const;
type Series = { id: string; prefix: string; title: string; label: string };
type OfficialCard = {
  cardId: string;
  code: string;
  rarity: string | null;
  category: string | null;
  name: string;
  back: Record<string, { label: string; value: string }>;
};

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
function codeOrder(code: string)
{
  const upper = code.toUpperCase();
  const family = upper.startsWith('OP')
    ? 4
    : upper.startsWith('EB')
    ? 3
    : upper.startsWith('PRB')
    ? 2
    : upper.startsWith('ST')
    ? 1
    : 0;
  const number = Number(upper.match(/\d+/)?.[0] ?? 0);
  return family * 1000 + number;
}
// Menu entries read "BOOSTER PACK <br class="spInline">-TITLE- [OP-16]", with the line break HTML-escaped inside the option.
const plainText = (html: string) => decodeHtml(decodeHtml(html));
// The card's back panel: <div class="cost"><h3>Life</h3>5</div>, <div class="text"><h3>Effect</h3>…</div>, the
// attribute as <i>Strike</i>. Values keep their line breaks; "-" means none.
export function parseOnePieceBack(block: string)
{
  const back: Record<string, { label: string; value: string }> = {};
  for (const [, name, label, body] of block.matchAll(
    /<div class="(cost|attribute|power|counter|color|block|feature|text|trigger)">\s*<h3>([\s\S]*?)<\/h3>([\s\S]*?)<\/div>/g,
  ))
  {
    const value = (name === 'attribute' ? /<i>([^<]*)<\/i>/.exec(body)?.[1] ?? '' : body)
      .split(/<br\s*\/?>/i)
      .map(plainText)
      .filter(Boolean)
      .join('\n');
    if (value && value !== '-') back[name] = { label: plainText(label), value };
  }
  return back;
}
export function parseOnePieceSeries(html: string): Series[]
{
  const select = html.match(/<select[^>]*name="series"[^>]*>([\s\S]*?)<\/select>/)?.[1] ?? '';
  return [...select.matchAll(/<option value="(\d+)"[^>]*>([\s\S]*?)<\/option>|<option value="(\d+)"[^>]*>([^<]*)/g)]
    .flatMap(match =>
    {
      const id = match[1] ?? match[3];
      const text = plainText(match[2] ?? match[4] ?? '');
      const parts = /^(.*?)\s*-(.+)-\s*\[([^\]]+)\]\s*$/.exec(text);
      return id && parts
        ? [{ id, prefix: parts[1].trim(), title: parts[2].trim(), label: parts[3].trim().toUpperCase() }]
        : [];
    });
}
export function parseOnePieceCards(html: string): OfficialCard[]
{
  const seen = new Set<string>();
  return [...html.matchAll(/<dl class="modalCol" id="([^"]+)">([\s\S]*?)<\/dl>/g)].flatMap(([, cardId, block]) =>
  {
    const info = [
      ...(block.match(/<div class="infoCol">([\s\S]*?)<\/div>/)?.[1] ?? '').matchAll(/<span>([^<]*)<\/span>/g),
    ]
      .map(match => plainText(match[1]));
    const name = plainText(block.match(/<div class="cardName">([\s\S]*?)<\/div>/)?.[1] ?? '');
    if (!/^[A-Za-z0-9!_-]{1,60}$/.test(cardId) || !name || seen.has(cardId)) return [];
    seen.add(cardId);
    return [{
      cardId,
      code: info[0] || cardId.replace(/_p\d+$/i, ''),
      rarity: info[1] || null,
      category: info[2] || null,
      name,
      back: parseOnePieceBack(block),
    }];
  });
}
// "BOOSTER PACK -THE DOMINANCE OF GOD- [OP-18]" with <time datetime="2026-11-20">: code without dashes → date.
const compactCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');
export function parseOnePieceReleaseDates(html: string)
{
  const dates = new Map<string, string>();
  for (const match of html.matchAll(
    /<h4 class="linkListColTitle">([^<]*)<\/h4>\s*<p class="linkListColDate">[\s\S]*?datetime="(\d{4}-\d{2}-\d{2})"/g,
  ))
  {
    const code = /\[([A-Z0-9-]+)\]\s*$/i.exec(plainText(match[1]).trim())?.[1];
    if (code && !dates.has(compactCode(code))) dates.set(compactCode(code), match[2]);
  }
  return dates;
}
// Merged English releases ("OP15-EB04") take the date of their first part.
export const releaseDateFor = (label: string, dates: Map<string, string>) =>
  dates.get(compactCode(label)) ?? dates.get(compactCode(label.split('-').slice(0, 1).join('')))
    ?? storedReleaseDate(label);
// When the official products page gives no date (it lists recent products only, and its layout changes), the stored
// release list (server/data/releases.json, keyed by "op17theworldsstrongestwarriors") still knows most sets.
const storedDates = Object
  .entries((releases as Record<string, { dates?: Record<string, string> }>)['one-piece']?.dates ?? {})
  .filter(([key]) => !/promos?$/.test(key));
export function storedReleaseDate(label: string)
{
  const code = compactCode(
    label.split('-').length > 2
      ? label.split('-').slice(0, 1).join('')
      : /^[A-Z]+-?\d+-[A-Z]/i.test(label)
      ? label.split('-')[0]
      : label,
  )
    .toLowerCase();
  return storedDates.find(([key]) => key.startsWith(code) && !/\d/.test(key.charAt(code.length)))?.[1] ?? null;
}
export const isOnePieceExpansionId = (value: number) =>
  value >= ONE_PIECE_EXPANSION_ID_MIN && value <= ONE_PIECE_EXPANSION_ID_MAX;

export class OnePieceCatalog
{
  readonly cache = new Cache();
  readonly queue = new Queue(80);
  constructor(
    private transport: typeof fetch = fetch,
    private pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  )
  {}

  // Official pages only, from the language's own site; the bare card list redirects to the newest series on the same site.
  private async page(language: OnePieceLanguage, path: string): Promise<string>
  {
    const origin = officialOrigins[language];
    const url = new URL(path, origin);
    if (url.origin !== origin || !/^\/(cardlist|products)\//.test(url.pathname))
    {
      throw new ApiError(502, 'The One Piece source returned an unexpected address.');
    }
    return this.queue.run(async () =>
    {
      const started = Date.now();
      for (let attempt = 0; attempt < 3; attempt++)
      {
        try
        {
          const response = await this.transport(url, {
            headers: { Accept: 'text/html', 'User-Agent': 'SleeveReady/0.1 (+https://sleeveready.com)' },
            signal: upstreamSignal(20000, started),
            redirect: 'follow',
          });
          if (response.url && new URL(response.url).origin !== origin)
          {
            await response.body?.cancel();
            throw new ApiError(502, 'The One Piece source returned an unexpected address.');
          }
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
                ? 'One Piece data not available in this language.'
                : 'The One Piece catalog is temporarily unavailable.',
            );
          }
          if (!(response.headers.get('content-type') ?? '').includes('text/html'))
          {
            await response.body?.cancel();
            throw new ApiError(502, 'The One Piece source returned an invalid response.');
          }
          return await response.text();
        }
        catch (error)
        {
          if (error instanceof ApiError) throw error;
          if (retryWithin(started, attempt))
          {
            await this.pause(400 * 2 ** attempt);
            continue;
          }
          throw new ApiError(502, 'Connection to One Piece lost. Try again.');
        }
      }
      throw new ApiError(502, 'One Piece catalog unavailable.');
    });
  }

  async image(language: string, cardId: string, extension: string)
  {
    const parsedLanguage = z.enum(ONE_PIECE_LANGUAGES).parse(language);
    const parsedCardId = z.string().regex(/^[A-Za-z0-9!_-]{1,60}$/).parse(cardId);
    const parsedExtension = z.enum(['png', 'webp']).parse(extension);
    const origin = officialOrigins[parsedLanguage];
    const url = new URL(`/images/cardlist/card/${encodeURIComponent(parsedCardId)}.${parsedExtension}`, origin);
    try
    {
      const response = await this.transport(url, {
        headers: {
          Accept: 'image/avif,image/webp,image/png,image/*',
          'User-Agent': 'SleeveReady/0.1 (+https://sleeveready.com)',
          Referer: origin + '/cardlist/',
        },
        signal: upstreamSignal(15000),
        redirect: 'error',
      });
      const contentType = (response.headers.get('content-type') ?? '').split(';')[0].toLowerCase();
      if (!response.ok || !['image/png', 'image/webp', 'image/jpeg'].includes(contentType))
      {
        await response.body?.cancel();
        throw new ApiError(response.status === 404 ? 404 : 502, 'One Piece image unavailable.');
      }
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 6_000_000) throw new ApiError(502, 'One Piece image too large.');
      return { bytes: Buffer.from(bytes), contentType };
    }
    catch (error)
    {
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, 'One Piece image temporarily unavailable.');
    }
  }

  private series(language: OnePieceLanguage)
  {
    return this.cache.get(
      `one-piece-series:${language}`,
      86_400_000,
      async () => parseOnePieceSeries(await this.page(language, '/cardlist/')),
    );
  }
  private seriesCards(language: OnePieceLanguage, seriesId: string)
  {
    return this.cache.get(
      `one-piece-series-cards:${language}:${seriesId}`,
      21_600_000,
      async () => parseOnePieceCards(await this.page(language, `/cardlist/?series=${encodeURIComponent(seriesId)}`)),
    );
  }

  // Release dates from the official products page, which lists recent and upcoming products only; older sets stay undated.
  private async releaseDates()
  {
    return (await this
      .cache
      .get(
        'one-piece-release-dates',
        86_400_000,
        async () => parseOnePieceReleaseDates(await this.page('en', '/products/')),
      )
      .catch(() => ({ data: new Map<string, string>() })))
      .data;
  }

  private async canonicalExpansion(expansionId: number)
  {
    const expansion = (await this.sets()).data.find(set => set.id === expansionId);
    if (!expansion?.code) throw new ApiError(404, 'One Piece set not found.');
    return expansion;
  }

  async sets()
  {
    return this.cache.get('one-piece-sets', 86_400_000, async () =>
    {
      const dates = await this.releaseDates();
      const sets: CardExpansion[] = (await this.series('en'))
        .data
        .map(series => ({
          id: stableNumericId(series.id, ONE_PIECE_EXPANSION_ID_MIN),
          gameId: ONE_PIECE_GAME_ID,
          code: series.label,
          name: series.title,
          releaseDate: releaseDateFor(series.label, dates),
        }))
        .sort((a, b) => codeOrder(b.code ?? '') - codeOrder(a.code ?? '') || a.name.localeCompare(b.name));
      const ids = new Set<number>();
      for (const set of sets)
      {
        if (ids.has(set.id)) throw new ApiError(502, 'One Piece set id collision.');
        ids.add(set.id);
      }
      return sets;
    });
  }

  // English merges some releases ("OP14-EB04") that other regions sell apart (OP-14 and EB-04): then both pages are read.
  private async localizedSeries(expansionId: number, language: OnePieceLanguage)
  {
    const expansion = await this.canonicalExpansion(expansionId);
    const series = (await this.series(language)).data;
    const exact = series.find(item => item.label === expansion.code);
    if (exact) return [exact];
    const parts = /^([A-Z]+)(\d+)-([A-Z]+)(\d+)$/.exec(expansion.code ?? '');
    if (!parts) return [];
    const split = [`${parts[1]}-${parts[2]}`, `${parts[3]}-${parts[4]}`].map(label =>
      series.find(item => item.label === label)
    );
    return split.every(Boolean) ? split as Series[] : [];
  }

  async cards(expansionId: number, language = 'en')
  {
    const requested = z.enum(ONE_PIECE_LANGUAGES).parse(language);
    return this.cache.get(`one-piece-cards:${expansionId}:${requested}`, 21_600_000, async () =>
    {
      const pages = async (activeLanguage: OnePieceLanguage) =>
      {
        const series = await this.localizedSeries(expansionId, activeLanguage);
        if (!series.length) return null;
        const cards = [];
        for (const item of series) cards.push(...(await this.seriesCards(activeLanguage, item.id)).data);
        return { cards, split: series.length > 1 };
      };
      const load = async (activeLanguage: OnePieceLanguage) =>
      {
        const found = await pages(activeLanguage);
        if (!found) return null;
        let cards = found.cards;
        // Split pages also hold the other half of the English release: keep only this set's cards, in English order.
        if (found.split)
        {
          const english = (await pages('en'))?.cards ?? [];
          const byId = new Map(cards.map(card => [card.cardId, card]));
          cards = english.flatMap(card => byId.get(card.cardId) ?? []);
        }
        return cards.map<CatalogCard>(card =>
        {
          const base = `/api/catalog/one-piece-image/${activeLanguage}/${encodeURIComponent(card.cardId)}`; // ?v=2: a new address for every image, past the corrupted copies the CDN and browsers cached before the binary fix.
          const imageUrls = activeLanguage === 'fr'
            ? [`${base}.webp?v=2`, `${base}.png?v=2`]
            : [`${base}.png?v=2`, `${base}.webp?v=2`];
          return {
            id: stableNumericId(card.cardId, 40_000_000_000),
            gameId: ONE_PIECE_GAME_ID,
            categoryId: 1,
            expansionId,
            name: card.name,
            version: null,
            collectorNumber: card.code,
            rarity: card.rarity,
            language: activeLanguage,
            imageUrl: imageUrls[0],
            imageUrls,
          };
        });
      };
      // A language without this series (or with an empty page) falls back to English.
      const localized = requested === 'en' ? null : await load(requested);
      if (localized?.length) return localized;
      const english = await load('en');
      if (!english) throw new ApiError(404, 'One Piece set not found.');
      return english;
    });
  }

  // Card page data from the official back panel: cost or life, power, counter, attribute, colour, block, type, effect.
  async details(card: CatalogCard, expansion: CardExpansion): Promise<CardDetails | null>
  {
    const language = z.enum(ONE_PIECE_LANGUAGES).catch('en').parse(card.language ?? 'en');
    const find = async (active: OnePieceLanguage) =>
    {
      for (const series of await this.localizedSeries(expansion.id, active))
      {
        const found = (await this.seriesCards(active, series.id)).data.find(item =>
          stableNumericId(item.cardId, 40_000_000_000) === card.id
        );
        if (found) return found;
      }
      return null;
    };
    const official = await find(language) ?? (language === 'en' ? null : await find('en'));
    if (!official) return null;
    const back = official.back;
    const facts: CardFact[] = [];
    if (back.cost)
    {
      facts.push({ key: /life|vie|vida|leben|vita/i.test(back.cost.label) ? 'life' : 'cost', value: back.cost.value });
    }
    for (const key of ['power', 'counter', 'attribute', 'color', 'block'] as const)
    {
      if (back[key]) facts.push({ key, value: back[key].value });
    }
    const blocks = [back.text?.value, back.trigger?.value].filter((text): text is string => Boolean(text)).map(
      text => ({ text }),
    );
    return {
      kind: [
        official.category ? official.category[0] + official.category.slice(1).toLowerCase() : null,
        back.feature?.value,
      ]
        .filter(Boolean)
        .join(' · ') || null,
      rarity: official.rarity,
      facts,
      blocks,
    };
  }

  async languages(expansionId: number)
  {
    return this.cache.get(`one-piece-languages:${expansionId}`, 86_400_000, async () =>
    {
      const available: OnePieceLanguage[] = [];
      for (const language of ONE_PIECE_LANGUAGES)
      {
        if ((await this.localizedSeries(expansionId, language)).length)
        {
          available.push(language);
        }
      }
      return available;
    });
  }
}
