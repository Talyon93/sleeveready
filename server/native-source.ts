import { Queue } from './cache.ts';
import { ApiError } from './api-error.ts';
import { upstreamBudgetMs, upstreamSignal } from './upstream.ts';
import type { CardDetails, CardExpansion, CardGame, CatalogCard } from '../shared/model.ts';
import type { DeckEntry } from '../shared/decklist.ts';

export type Cached<T> = { data: T; updatedAt: string };
export type NativeCatalog = {
  game: CardGame;
  isExpansionId: (value: number) => boolean;
  sets: () => Promise<Cached<CardExpansion[]>>;
  cards: (expansionId: number, language: string) => Promise<Cached<CatalogCard[]>>;
  languages: (expansionId: number) => Promise<Cached<string[]>>;
  // Optional decklist hooks: map a printed set code (e.g. Pokémon TCG Live "OBF") or replace the generic import.
  expansionForCode?: (code: string) => Promise<number | null>;
  // Sources with a name search return the expansions printing that card, so imports skip the set-by-set scan.
  locateByName?: (name: string) => Promise<number[]>;
  // Sources with a name search return the card's printings in other expansions, for its page.
  otherPrintings?: (card: CatalogCard) => Promise<CatalogCard[]>;
  // Game data (type, text, illustrator…) of the shown printing, for its card page.
  details?: (card: CatalogCard, expansion: CardExpansion) => Promise<CardDetails | null>;
  primeExpansion?: (expansion: CardExpansion) => Promise<void>;
  rulingsFor?: (card: CatalogCard, expansion: CardExpansion) => Promise<import('../shared/model.ts').CardRuling[]>;
  // Other cards by an illustrator, newest first, for the card page.
  byIllustrator?: (artist: string) => Promise<CatalogCard[]>;
  // Every illustrator name the source credits, so an artist page can map its URL slug back to the exact name.
  illustrators?: () => Promise<string[]>;
  // The printing's name in each language it exists in, when the source can answer in one request.
  localNames?: (card: CatalogCard, expansion: CardExpansion) => Promise<{ language: string; name: string }[]>;
  importCards?: (
    entries: DeckEntry[],
    language: string,
    options?: { tokens?: boolean },
  ) => Promise<{ items: { card: CatalogCard; quantity: number }[]; unresolved: string[] }>;
};

export function stableNumericId(value: string, base: number)
{
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++)
  {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return base + (hash >>> 0);
}
// Each newer native game owns a 10-billion block: expansions use the first half, cards the second.
export const idRange = (block: number) =>
{
  const expansionBase = 100_000_000_000 + block * 10_000_000_000;
  return {
    expansionBase,
    cardBase: expansionBase + 5_000_000_000,
    isExpansionId: (value: number) => value >= expansionBase && value < expansionBase + 5_000_000_000,
  };
};

export function decodeHtml(text: string)
{
  return text
    .replace(/<[^>]*>/g, '')
    .replace(
      /&#(x[0-9a-f]+|\d+);/gi,
      (_, code: string) =>
        String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
// Bandai category ids encode product family then release order; keep families in page order, newest first within each.
export function officialOrder<T extends { category: string }>(entries: T[], familyLength: number)
{
  const families: string[] = [];
  for (const entry of entries)
  {
    const family = entry.category.slice(0, familyLength);
    if (!families.includes(family)) families.push(family);
  }
  return [...entries].sort((a, b) =>
    families.indexOf(a.category.slice(0, familyLength)) - families.indexOf(b.category.slice(0, familyLength))
    || b.category.localeCompare(a.category)
  );
}
// Product pages print dates as "September 4, 2026".
const englishMonths = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
export const ENGLISH_DATE =
  '((?:January|February|March|April|May|June|July|August|September|October|November|December) \\d{1,2}, \\d{4})';
export function englishDate(value: string)
{
  const match = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(value.trim());
  const month = match ? englishMonths.indexOf(match[1].toLowerCase()) : -1;
  if (!match || month < 0) return null;
  const date = new Date(Date.UTC(Number(match[3]), month, Number(match[2])));
  return date.getUTCMonth() === month ? date.toISOString().slice(0, 10) : null;
}
export const pageText = (html: string) =>
  decodeHtml(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
// Assigns dates found on a product page to expansions sharing a code; repeated codes (two "BT01-03" releases)
// get their dates in release order, matched to the expansions in catalogue order.
export function assignDates<T extends { category: string; expansion: CardExpansion }>(
  entries: T[],
  dates: { code: string; date: string }[],
)
{
  const byCode = new Map<string, string[]>();
  for (const item of dates)
  {
    const code = item.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    byCode.set(code, [...(byCode.get(code) ?? []), item.date].sort());
  }
  const seen = new Map<string, number>();
  for (const entry of [...entries].sort((a, b) => a.category.localeCompare(b.category)))
  {
    const code = entry.expansion.code?.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) continue;
    const list = byCode.get(code);
    if (!list?.length) continue;
    const index = seen.get(code) ?? 0;
    seen.set(code, index + 1);
    entry.expansion.releaseDate = list[Math.min(index, list.length - 1)];
  }
  return entries;
}
export const byNewest = (a: CardExpansion, b: CardExpansion) =>
  (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');

type Kind = 'json' | 'text' | 'bytes';
export class SourceClient
{
  readonly queue: Queue;
  constructor(
    private label: string,
    private origins: string[],
    private transport: typeof fetch = fetch,
    private pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
    gap = 100,
  )
  {
    this.queue = new Queue(gap);
  }

  json(url: URL, init: RequestInit = {}): Promise<unknown>
  {
    return this.request(url, 'json', init) as Promise<unknown>;
  }
  text(url: URL, init: RequestInit = {}): Promise<string>
  {
    return this.request(url, 'text', init) as Promise<string>;
  }
  bytes(url: URL): Promise<{ bytes: Buffer; contentType: string }>
  {
    return this.request(url, 'bytes', {}) as Promise<{ bytes: Buffer; contentType: string }>;
  }
  // Paginated sources: a few pages at a time instead of one queued request after another.
  async texts(urls: URL[], concurrency = 3)
  {
    const pages: string[] = [];
    for (let offset = 0; offset < urls.length; offset += concurrency)
    {
      pages.push(
        ...await Promise.all(
          urls.slice(offset, offset + concurrency).map(url => this.fetch(url, 'text', {}) as Promise<string>),
        ),
      );
    }
    return pages;
  }
  async jsons(urls: URL[], concurrency = 3)
  {
    const pages: unknown[] = [];
    for (let offset = 0; offset < urls.length; offset += concurrency)
    {
      pages.push(
        ...await Promise.all(urls.slice(offset, offset + concurrency).map(url => this.fetch(url, 'json', {}))),
      );
    }
    return pages;
  }

  private request(url: URL, kind: Kind, init: RequestInit)
  {
    return this.queue.run(() => this.fetch(url, kind, init));
  }
  private async fetch(url: URL, kind: Kind, init: RequestInit)
  {
    if (!this.origins.includes(url.origin)) throw new ApiError(502, `${this.label}: unexpected address.`);
    const accept = kind === 'json' ? 'application/json' : kind === 'text' ? 'text/html' : 'image/*';
    // Retries share one deadline (see upstream.ts), so a slow source cannot hold the function for three full timeouts.
    const deadline = Date.now() + upstreamBudgetMs;
    const canRetry = (attempt: number) => attempt < 2 && deadline - Date.now() > 500 * 2 ** attempt + 1000;
    for (let attempt = 0; attempt < 3; attempt++)
    {
      try
      {
        const response = await this.transport(url, {
          ...init,
          headers: {
            Accept: accept,
            'User-Agent': 'Mozilla/5.0 (compatible; SleeveReady/0.1; +https://sleeveready.com)',
            ...init.headers,
          },
          signal: upstreamSignal(Math.min(25_000, Math.max(1000, deadline - Date.now()))),
          redirect: 'error',
        });
        if (!response.ok)
        {
          await response.body?.cancel();
          if ((response.status === 429 || response.status >= 500) && canRetry(attempt))
          {
            await this.pause(500 * 2 ** attempt);
            continue;
          }
          throw new ApiError(
            response.status === 404 ? 404 : 502,
            response.status === 404 ? `${this.label}: data not found.` : `${this.label} is temporarily unavailable.`,
          );
        }
        const contentType = response.headers.get('content-type') ?? '';
        if (kind === 'json' && !contentType.includes('json'))
        {
          await response.body?.cancel();
          throw new ApiError(502, `${this.label} returned an invalid response.`);
        }
        if (kind === 'bytes')
        {
          if (!/^image\/(png|webp|jpeg)$/.test(contentType.split(';')[0].trim()))
          {
            await response.body?.cancel();
            throw new ApiError(502, `${this.label} returned an invalid image.`);
          }
          return { bytes: Buffer.from(await response.arrayBuffer()), contentType: contentType.split(';')[0].trim() };
        }
        return kind === 'json' ? response.json() : response.text();
      }
      catch (error)
      {
        if (error instanceof ApiError) throw error;
        if (canRetry(attempt))
        {
          await this.pause(500 * 2 ** attempt);
          continue;
        }
        throw new ApiError(502, `Connection to ${this.label} lost. Try again.`);
      }
    }
    throw new ApiError(502, `${this.label} unavailable.`);
  }
}
