import { retryWithin, upstreamSignal } from './upstream.ts';
import { z } from 'zod';
import { Cache, Queue } from './cache.ts';
import { ApiError } from './api-error.ts';
import type {
  CardDetails,
  CardExpansion,
  CardFormat,
  CardPrice,
  CardRuling,
  CardTextBlock,
  CatalogCard,
} from '../shared/model.ts';
import type { DeckEntry } from '../shared/decklist.ts';
import { normaliseCardName } from '../shared/decklist.ts';
import { mergeImported, type ImportedItem } from './deck-import.ts';
import { blobSetStore, isSettled, type SetStore } from './set-store.ts';

export const MAGIC_GAME_ID = 9_000_000_001;
export const MAGIC_GAME = {
  id: MAGIC_GAME_ID,
  name: 'Magic',
  displayName: 'Magic: The Gathering',
  printLanguages: ['en', 'it', 'de', 'fr', 'es', 'pt', 'ja', 'ko', 'ru', 'zhs', 'zht'],
  hasCardText: true,
} as const;
export const MAGIC_LANGUAGES = ['en', 'it', 'de', 'fr', 'es', 'pt', 'ja', 'ko', 'ru', 'zhs', 'zht'] as const;

const apiOrigin = 'https://api.scryfall.com';
const setSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  name: z.string(),
  set_type: z.string(),
  released_at: z.string().nullish(),
  card_count: z.number().int().nonnegative(),
  digital: z.boolean(),
  parent_set_code: z.string().nullish(),
});
const imageSchema = z.object({
  normal: z.string().url().nullish(),
  large: z.string().url().nullish(),
  png: z.string().url().nullish(),
})
  .partial();
const faceSchema = z.object({
  printed_name: z.string().nullish(),
  image_uris: imageSchema.nullish(),
  colors: z.array(z.string()).nullish(),
});
const cardSchema = z.object({
  id: z.string().uuid(),
  colors: z.array(z.string()).nullish(),
  lang: z.string().min(2),
  name: z.string(),
  printed_name: z.string().nullish(),
  collector_number: z.string(),
  rarity: z.string(),
  type_line: z.string().nullish(),
  set_id: z.string().uuid(),
  image_uris: imageSchema.nullish(),
  card_faces: z.array(faceSchema).nullish(),
  tcgplayer_id: z.number().int().positive().nullish(),
  cardmarket_id: z.number().int().positive().nullish(),
  digital: z.boolean().nullish(),
  all_parts: z.array(z.object({ id: z.string(), component: z.string(), name: z.string() })).nullish(),
});
const listSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: z.array(item), has_more: z.boolean().default(false), next_page: z.string().url().optional() });
const excludedSetTypes = new Set(['token', 'memorabilia', 'minigame', 'alchemy']);

function stableNumericId(value: string)
{
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++)
  {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return 4_000_000_000 + (hash >>> 0);
}

function expansionFromSet(set: z.infer<typeof setSchema>): CardExpansion
{
  return {
    id: stableNumericId(set.id),
    gameId: MAGIC_GAME_ID,
    code: set.code.toUpperCase(),
    name: set.name,
    releaseDate: set.released_at ?? null,
  };
}

function toCatalogCard(card: z.infer<typeof cardSchema>, expansionId = stableNumericId(card.set_id)): CatalogCard
{
  const images = card.image_uris ?? card.card_faces?.[0]?.image_uris;
  const imageUrls = [images?.large, images?.normal, images?.png].filter((url): url is string => Boolean(url));
  return {
    id: stableNumericId(card.id),
    gameId: MAGIC_GAME_ID,
    categoryId: 1,
    expansionId,
    name: card.printed_name ?? card.card_faces?.[0]?.printed_name ?? card.name,
    version: null,
    collectorNumber: card.collector_number,
    rarity: card.rarity,
    language: card.lang,
    imageUrl: imageUrls[0] ?? null,
    imageUrls: [...new Set(imageUrls)],
    scryfallId: card.id,
    cardmarketIds: card.cardmarket_id ? [card.cardmarket_id] : [],
    tcgplayerId: card.tcgplayer_id ? String(card.tcgplayer_id) : null,
  };
}
const detailFace = {
  name: z.string().nullish(),
  printed_name: z.string().nullish(),
  mana_cost: z.string().nullish(),
  type_line: z.string().nullish(),
  printed_type_line: z.string().nullish(),
  oracle_text: z.string().nullish(),
  printed_text: z.string().nullish(),
  power: z.string().nullish(),
  toughness: z.string().nullish(),
  loyalty: z.string().nullish(),
  defense: z.string().nullish(),
};
const priceSchema = z.object({
  usd: z.string().nullish(),
  usd_foil: z.string().nullish(),
  eur: z.string().nullish(),
  eur_foil: z.string().nullish(),
})
  .partial();
const detailSchema = z.object({
  ...detailFace,
  id: z.string().optional(),
  lang: z.string(),
  artist: z.string().nullish(),
  prices: priceSchema.nullish(),
  rulings_uri: z.string().nullish(),
  legalities: z.record(z.string(), z.string()).nullish(),
  card_faces: z.array(z.object(detailFace)).nullish(),
});
const LEGAL_FORMATS = ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'commander', 'pauper'] as const;
const collectionSchema = z.object({ data: z.array(cardSchema) });
const printingKey = (set: string, number: string) => set.toLowerCase() + '|' + number.toLowerCase();

export class Scryfall
{
  readonly cache = new Cache();
  readonly queue = new Queue(120);
  // Scryfall allows about 2 requests a second on search and collection endpoints, 10 on the others.
  readonly searchQueue = new Queue(550);
  private knownLanguages = new Map<number, Set<string>>();
  // Token sets ("thob") are excluded from the picker but printed with their parent expansion ("hob").
  private tokenSets = new Map<string, string[]>();
  constructor(
    private transport: typeof fetch = fetch,
    private pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
    private store: SetStore = blobSetStore(),
  )
  {}

  private async request(urlValue: string, body?: unknown): Promise<unknown>
  {
    const url = new URL(urlValue, apiOrigin);
    if (url.origin !== apiOrigin) throw new ApiError(502, 'Scryfall returned an unexpected address.');
    const queue = /^\/cards\/(search|collection|named|random)/.test(url.pathname) ? this.searchQueue : this.queue;
    return queue.run(async () =>
    {
      const started = Date.now();
      for (let attempt = 0; attempt < 3; attempt++)
      {
        try
        {
          const response = await this.transport(url, {
            method: body === undefined ? 'GET' : 'POST',
            body: body === undefined ? undefined : JSON.stringify(body),
            headers: {
              Accept: 'application/json;q=0.9,*/*;q=0.8',
              'User-Agent': 'SleeveReady/0.1 (+https://sleeveready.com)',
              ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            },
            signal: upstreamSignal(15000, started),
            redirect: 'error',
          });
          if (!response.ok)
          {
            if ((response.status === 429 || response.status >= 500) && retryWithin(started, attempt))
            {
              await response.body?.cancel();
              const retry = Number(response.headers.get('retry-after'));
              await this.pause(Number.isFinite(retry) && retry > 0 ? Math.min(retry * 1000, 5000) : 500 * 2 ** attempt);
              continue;
            }
            await response.body?.cancel();
            throw new ApiError(
              response.status === 404 ? 404 : 502,
              response.status === 404 ? 'Magic item not found.' : 'Scryfall is temporarily unavailable.',
            );
          }
          const contentType = response.headers.get('content-type') ?? '';
          if (!contentType.includes('application/json'))
          {
            await response.body?.cancel();
            throw new ApiError(502, 'Scryfall returned an invalid response.');
          }
          return response.json();
        }
        catch (error)
        {
          if (error instanceof ApiError) throw error;
          if (retryWithin(started, attempt))
          {
            await this.pause(500 * 2 ** attempt);
            continue;
          }
          throw new ApiError(502, 'Connection to Scryfall lost. Try again.');
        }
      }
      throw new ApiError(502, 'Scryfall unavailable.');
    });
  }

  async sets()
  {
    return this.cache.get('magic-sets', 86_400_000, async () =>
    {
      const parsed = listSchema(setSchema).parse(await this.request('/sets'));
      this.tokenSets = new Map();
      for (const set of parsed.data)
      {
        if (set.set_type === 'token' && set.parent_set_code)
        {
          const parent = set.parent_set_code.toUpperCase();
          this.tokenSets.set(parent, [...(this.tokenSets.get(parent) ?? []), set.code]);
        }
      }
      const sets = parsed
        .data
        .filter(set => !set.digital && set.card_count > 0 && !excludedSetTypes.has(set.set_type))
        .map(set => ({ ...expansionFromSet(set), hasTokens: this.tokenSets.has(set.code.toUpperCase()) }))
        .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || a.name.localeCompare(b.name));
      const ids = new Set<number>();
      for (const set of sets)
      {
        if (ids.has(set.id)) throw new ApiError(502, 'Magic set id collision.');
        ids.add(set.id);
      }
      return sets;
    });
  }

  async cards(expansionId: number, language = 'en')
  {
    const requestedLanguage = z.enum(MAGIC_LANGUAGES).parse(language);
    return this.cache.get(`magic-cards:${expansionId}:${requestedLanguage}`, 21_600_000, async () =>
    {
      const expansion = (await this.sets()).data.find(set => set.id === expansionId);
      if (!expansion?.code) throw new ApiError(404, 'Magic set not found.');
      const setCode = expansion.code;
      const settled = isSettled(expansion.releaseDate);
      const storeKey = `magic/cards/${setCode}/${requestedLanguage}`;
      const stored = settled ? await this.store.read<CatalogCard[]>(storeKey) : null;
      if (stored?.length)
      {
        const seen = this.knownLanguages.get(expansionId) ?? new Set<string>();
        for (const card of stored) if (card.language) seen.add(card.language);
        this.knownLanguages.set(expansionId, seen);
        return stored;
      }
      const loadSet = async (code: string, cardLanguage: string) =>
      {
        const query = new URL('/cards/search', apiOrigin);
        query.searchParams.set('q', `e:${code.toLowerCase()} lang:${cardLanguage}`);
        query.searchParams.set('unique', 'prints');
        query.searchParams.set('order', 'set');
        query.searchParams.set('dir', 'asc');
        query.searchParams.set('include_multilingual', 'true');
        const rows: z.infer<typeof cardSchema>[] = [];
        let next: string | undefined = query.toString();
        while (next)
        {
          const page = listSchema(cardSchema).parse(await this.request(next));
          rows.push(...page.data);
          next = page.has_more ? page.next_page : undefined;
          if (page.has_more && !next) throw new ApiError(502, 'Scryfall pagination incomplete.');
        }
        return rows;
      };
      const loadLanguage = async (code: string, optional = false) =>
      {
        for (const cardLanguage of requestedLanguage === 'en' ? ['en'] : [requestedLanguage, 'en'])
        {
          try
          {
            return await loadSet(code, cardLanguage);
          }
          catch (error)
          {
            if (!(error instanceof ApiError) || error.status !== 404) throw error;
          }
        }
        if (optional) return [];
        throw new ApiError(404, 'Magic set not found.');
      };
      const rows = await loadLanguage(setCode);
      // Tokens and emblems print in the requested language where available, otherwise in English.
      const tokens: z.infer<typeof cardSchema>[] = [];
      for (const code of this.tokenSets.get(setCode) ?? []) tokens.push(...await loadLanguage(code, true));
      const known = this.knownLanguages.get(expansionId) ?? new Set<string>();
      for (const card of rows) known.add(card.lang);
      this.knownLanguages.set(expansionId, known);
      const cards: CatalogCard[] = [
        ...rows.map(card => toCatalogCard(card, expansionId)),
        ...tokens.map(card => ({
          ...toCatalogCard(card, expansionId),
          rarity: /emblem/i.test(card.type_line ?? '') ? 'Emblem' : 'Token',
        })),
      ];
      const ids = new Set<number>();
      for (const card of cards)
      {
        if (ids.has(card.id)) throw new ApiError(502, 'Magic card id collision.');
        ids.add(card.id);
      }
      if (settled) await this.store.write(storeKey, cards);
      return cards;
    });
  }

  // Decklists: resolve names or set + collector number in batches of 75, then swap in the requested language where printed.
  async importCards(
    entries: DeckEntry[],
    language = 'en',
    options: { tokens?: boolean } = {},
  ): Promise<{ items: ImportedItem[]; unresolved: string[] }>
  {
    // Lines that ask for their own language ("lang:fr") are imported in groups, one per language.
    const groups = new Map<string, DeckEntry[]>();
    for (const entry of entries)
    {
      const key = entry.language ?? language;
      groups.set(key, [...groups.get(key) ?? [], entry]);
    }
    if (groups.size > 1)
    {
      const results = [];
      for (const [code, group] of groups)
      {
        results.push(await this.importCards(group.map(entry => ({ ...entry, language: null })), code));
      }
      const merged = {
        items: mergeImported(results.flatMap(result => result.items)),
        unresolved: results.flatMap(result => result.unresolved),
      };
      return options.tokens
        ? { ...merged, items: mergeImported([...merged.items, ...await this.tokensFor(merged.items)]) }
        : merged;
    }
    if (entries[0]?.language) language = entries[0].language;
    const requested = (MAGIC_LANGUAGES as readonly string[]).includes(language) ? language : 'en';
    // Lines with set, number and name also ask for the name in that set: "Sol Ring (CMM) 400" names a card that is number 410.
    const identifiers = (entry: DeckEntry): Record<string, string>[] =>
    {
      const name = entry.name?.split(' // ')[0];
      if (entry.setCode && entry.number)
      {
        return [
          { set: entry.setCode.toLowerCase(), collector_number: entry.number },
          ...name ? [{ name, set: entry.setCode.toLowerCase() }] : [],
        ];
      }
      return name ? [{ name }] : [];
    };
    const found: z.infer<typeof cardSchema>[] = [];
    const wanted = entries.flatMap(identifiers);
    for (let offset = 0; offset < wanted.length; offset += 75)
    {
      found.push(
        ...collectionSchema
          .parse(await this.request('/cards/collection', { identifiers: wanted.slice(offset, offset + 75) }))
          .data,
      );
    }
    const bySetCode = new Map<string, z.infer<typeof cardSchema>>();
    const byName = new Map<string, z.infer<typeof cardSchema>>();
    const bySetName = new Map<string, z.infer<typeof cardSchema>>();
    const setCodes = new Map((await this.sets()).data.map(set => [set.id, set.code!.toLowerCase()]));
    const namesOf = (card: z.infer<typeof cardSchema>) =>
      [card.name, ...card.name.split(' // ')].map(normaliseCardName);
    for (const card of found)
    {
      const code = setCodes.get(stableNumericId(card.set_id));
      if (code) bySetCode.set(printingKey(code, card.collector_number), card);
      for (const name of namesOf(card))
      {
        if (!byName.has(name)) byName.set(name, card);
        if (code && !bySetName.has(`${code}|${name}`)) bySetName.set(`${code}|${name}`, card);
      }
    }
    const match = (entry: DeckEntry) =>
    {
      const name = entry.name ? normaliseCardName(entry.name.split(' // ')[0]) : null;
      const printed = entry.setCode && entry.number
        ? bySetCode.get(printingKey(entry.setCode, entry.number))
        : undefined;
      if (printed && (!name || namesOf(printed).includes(name))) return printed;
      // The number names another card (or nothing): the name in that set, then anywhere; Arena-only names keep the number's card.
      const named = name
        ? (entry.setCode ? bySetName.get(`${entry.setCode.toLowerCase()}|${name}`) : undefined) ?? byName.get(name)
          ?? byName.get(normaliseCardName(entry.name!))
        : undefined;
      return named ?? printed;
    };
    const localised = new Map<string, z.infer<typeof cardSchema>>();
    const byLocalisedName = new Map<string, z.infer<typeof cardSchema>>();
    if (requested !== 'en')
    {
      const printings = [...new Map(found.map(card => [card.id, card])).values()]
        .map(card => ({ card, code: setCodes.get(stableNumericId(card.set_id)) }))
        .filter((item): item is { card: z.infer<typeof cardSchema>; code: string } => Boolean(item.code));
      for (let offset = 0; offset < printings.length; offset += 15)
      {
        const query = new URL('/cards/search', apiOrigin);
        query.searchParams.set(
          'q',
          `lang:${requested} (${
            printings
              .slice(offset, offset + 15)
              .map(item => `(e:${item.code} cn:"${item.card.collector_number}")`)
              .join(' or ')
          })`,
        );
        query.searchParams.set('unique', 'prints');
        query.searchParams.set('include_multilingual', 'true');
        try
        {
          for (const card of listSchema(cardSchema).parse(await this.request(query.toString())).data)
          {
            localised.set(printingKey(card.set_id, card.collector_number), card);
          }
        }
        catch (error)
        {
          if (!(error instanceof ApiError) || error.status !== 404) throw error;
        }
      }
      // Name-only lines resolve to the newest printing, often English-only: take the newest printing in the requested language instead.
      const missing = [
        ...new Map(
          entries
            .filter(entry => !entry.setCode && entry.name)
            .map(match)
            .filter((card): card is z.infer<typeof cardSchema> =>
              Boolean(card) && !localised.has(printingKey(card!.set_id, card!.collector_number))
            )
            .map(card => [card.name, card]),
        )
          .values(),
      ];
      for (let offset = 0; offset < missing.length; offset += 10)
      {
        const query = new URL('/cards/search', apiOrigin);
        query.searchParams.set(
          'q',
          `lang:${requested} (${
            missing.slice(offset, offset + 10).map(card => `!"${card.name.split(' // ')[0].replaceAll('"', '')}"`).join(
              ' or ',
            )
          })`,
        );
        query.searchParams.set('unique', 'prints');
        query.searchParams.set('order', 'released');
        query.searchParams.set('dir', 'desc');
        query.searchParams.set('include_multilingual', 'true');
        try
        {
          for (const card of listSchema(cardSchema).parse(await this.request(query.toString())).data)
          {
            if (!byLocalisedName.has(card.name)) byLocalisedName.set(card.name, card);
          }
        }
        catch (error)
        {
          if (!(error instanceof ApiError) || error.status !== 404) throw error;
        }
      }
    }
    // Arena and MTGO-only printings are swapped for the newest paper printing of the same card.
    const resolved = new Map(entries.map(entry => [entry, match(entry)]));
    const digital = [
      ...new Set(
        [...resolved.values()]
          .filter((card): card is z.infer<typeof cardSchema> =>
            Boolean(card) && (card!.digital === true || !setCodes.has(stableNumericId(card!.set_id)))
          )
          .map(card => card.name.split(' // ')[0]),
      ),
    ];
    const paper = new Map<string, z.infer<typeof cardSchema>>();
    for (let offset = 0; offset < digital.length; offset += 10)
    {
      const query = new URL('/cards/search', apiOrigin);
      query.searchParams.set(
        'q',
        `game:paper (${digital.slice(offset, offset + 10).map(name => `!"${name.replaceAll('"', '')}"`).join(' or ')})`,
      );
      query.searchParams.set('unique', 'prints');
      query.searchParams.set('order', 'released');
      query.searchParams.set('dir', 'desc');
      try
      {
        for (const card of listSchema(cardSchema).parse(await this.request(query.toString())).data)
        {
          const name = card.name.split(' // ')[0];
          if (!paper.has(name) && setCodes.has(stableNumericId(card.set_id))) paper.set(name, card);
        }
      }
      catch (error)
      {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
      }
    }
    for (const [entry, card] of resolved)
    {
      if (
        card && paper.has(card.name.split(' // ')[0])
        && (card.digital === true || !setCodes.has(stableNumericId(card.set_id)))
      ) resolved.set(entry, paper.get(card.name.split(' // ')[0])!);
    }
    const items: ImportedItem[] = [];
    const unresolved: string[] = [];
    for (const entry of entries)
    {
      const card = resolved.get(entry);
      if (!card)
      {
        unresolved.push(entry.line);
        continue;
      }
      items.push({
        card: toCatalogCard(
          localised.get(printingKey(card.set_id, card.collector_number))
            ?? (entry.setCode ? undefined : byLocalisedName.get(card.name)) ?? card,
        ),
        quantity: entry.quantity,
      });
    }
    const merged = mergeImported(items);
    return { items: options.tokens ? mergeImported([...merged, ...await this.tokensFor(merged)]) : merged, unresolved };
  }

  // The tokens a list's cards make (Scryfall's related parts), one copy each, in English: two collection requests.
  async tokensFor(items: ImportedItem[]): Promise<ImportedItem[]>
  {
    const ids = [...new Set(items.map(item => item.card.scryfallId).filter((id): id is string => Boolean(id)))];
    const tokenIds = new Set<string>();
    for (let offset = 0; offset < ids.length; offset += 75)
    {
      for (
        const card of collectionSchema
          .parse(
            await this.request('/cards/collection', {
              identifiers: ids.slice(offset, offset + 75).map(id => ({ id })),
            }),
          )
          .data
      )
      {
        for (const part of card.all_parts ?? [])
        {
          if (part.component === 'token' && part.id !== card.id) tokenIds.add(part.id);
        }
      }
    }
    const tokens: ImportedItem[] = [];
    const list = [...tokenIds].slice(0, 60);
    for (let offset = 0; offset < list.length; offset += 75)
    {
      for (
        const card of collectionSchema
          .parse(
            await this.request('/cards/collection', {
              identifiers: list.slice(offset, offset + 75).map(id => ({ id })),
            }),
          )
          .data
      ) tokens.push({ card: toCatalogCard(card), quantity: 1 });
    }
    return tokens;
  }

  // Game data of the shown printing: printed (localised) type and text where Scryfall has them, oracle text otherwise.
  // One search returns this printing in every language: the card page reads its game data and names from it,
  // instead of loading the whole expansion once per language (Scryfall asks for fewer than 10 requests a second).
  private async printingInAllLanguages(card: CatalogCard, expansion: CardExpansion)
  {
    if (!expansion.code || !card.collectorNumber) return [];
    const code = expansion.code.toLowerCase();
    const number = card.collectorNumber.replaceAll('"', '');
    return (await this.cache.get(`magic-printing:${code}:${number}`, 86_400_000, async () =>
    {
      const query = new URL('/cards/search', apiOrigin);
      query.searchParams.set('q', `e:${code} cn:"${number}" lang:any`);
      query.searchParams.set('unique', 'prints');
      query.searchParams.set('include_multilingual', 'true');
      try
      {
        return listSchema(detailSchema).parse(await this.request(query.toString())).data;
      }
      catch (error)
      {
        if (error instanceof ApiError && error.status === 404) return [];
        throw error;
      }
    }))
      .data;
  }

  // Every printing of an expansion in every language, a few searches for the whole set: the build fills the per-card
  // cache with them, so writing thousands of card pages costs one search per 175 printings instead of one per card.
  async primeExpansion(expansion: CardExpansion)
  {
    if (!expansion.code) return;
    const code = expansion.code.toLowerCase();
    const byNumber = new Map<string, z.infer<typeof detailSchema>[]>();
    const query = new URL('/cards/search', apiOrigin);
    query.searchParams.set('q', `e:${code} lang:any`);
    query.searchParams.set('unique', 'prints');
    query.searchParams.set('order', 'set');
    query.searchParams.set('include_multilingual', 'true');
    let next: string | undefined = query.toString();
    while (next)
    {
      let page;
      try
      {
        page = listSchema(detailSchema.extend({ collector_number: z.string() })).parse(await this.request(next));
      }
      catch (error)
      {
        if (error instanceof ApiError && error.status === 404) return;
        throw error;
      }
      for (const row of page.data)
      {
        byNumber.set(row.collector_number, [...byNumber.get(row.collector_number) ?? [], row]);
      }
      next = page.has_more ? page.next_page : undefined;
    }
    for (const [number, rows] of byNumber)
    {
      this.cache.set(`magic-printing:${code}:${number.replaceAll('"', '')}`, 86_400_000, rows);
    }
  }

  async localNames(card: CatalogCard, expansion: CardExpansion)
  {
    return (await this.printingInAllLanguages(card, expansion))
      .map(row => ({
        language: row.lang,
        name: row.printed_name ?? row.card_faces?.[0]?.printed_name ?? row.name ?? '',
      }))
      .filter(row => row.name);
  }

  async details(card: CatalogCard, expansion: CardExpansion): Promise<CardDetails | null>
  {
    const rows = await this.printingInAllLanguages(card, expansion);
    const row = rows.find(item => item.lang === (card.language ?? 'en')) ?? rows.find(item => item.lang === 'en')
      ?? rows[0];
    if (!row) return null;
    const faces = row.card_faces?.length ? row.card_faces : [row];
    const localised = row.lang !== 'en';
    const typeOf = (face: { type_line?: string | null; printed_type_line?: string | null }) =>
      localised ? face.printed_type_line ?? null : face.type_line ?? null;
    const textOf = (face: { oracle_text?: string | null; printed_text?: string | null }) =>
      (localised ? face.printed_text : null) ?? face.oracle_text ?? null;
    const statsOf = (
      face: { power?: string | null; toughness?: string | null; loyalty?: string | null; defense?: string | null },
    ) => face.power && face.toughness ? `${face.power}/${face.toughness}` : face.loyalty ?? face.defense ?? null;
    const blocks: CardTextBlock[] = faces.length > 1
      ? faces.map(face => ({
        title: face.printed_name ?? face.name ?? null,
        meta: [face.mana_cost, typeOf(face)].filter(Boolean).join(' · ') || null,
        text: textOf(face),
      }))
      : [{ text: textOf(row) }];
    // Prices and rulings live on the English printing (localised printings have no prices of their own).
    const english = rows.find(item => item.lang === 'en');
    const today = new Date().toISOString().slice(0, 10);
    const price = (
      market: CardPrice['market'],
      currency: CardPrice['currency'],
      regular?: string | null,
      foil?: string | null,
    ): CardPrice[] =>
    {
      const amount = Number(regular ?? foil);
      return Number.isFinite(amount) && amount > 0
        ? [{ market, currency, amount, foil: !regular, updated: today }]
        : [];
    };
    const prices = english?.prices
      ? [
        ...price('TCGplayer', 'USD', english.prices.usd, english.prices.usd_foil),
        ...price('Cardmarket', 'EUR', english.prices.eur, english.prices.eur_foil),
      ]
      : [];
    // Rulings cost a request of their own: they load with the other extras (rulingsFor), not with the page.
    const rulings: CardRuling[] = [];
    const formats = LEGAL_FORMATS.map((format): CardFormat =>
    {
      const status = row.legalities?.[format];
      return {
        format: format[0].toUpperCase() + format.slice(1),
        status: status === 'legal' || status === 'banned' || status === 'restricted' ? status : 'not_legal',
      };
    });
    return {
      prices,
      rulings,
      formats,
      kind: faces.length > 1 ? faces.map(typeOf).filter(Boolean).join(' // ') : typeOf(row),
      cost: faces.map(face => face.mana_cost).filter(Boolean).join(' // ') || null,
      stats: faces.map(statsOf).filter(Boolean).join(' // ') || null,
      illustrator: row.artist ?? null,
      legal: LEGAL_FORMATS.filter(format => row.legalities?.[format] === 'legal').map(format =>
        format[0].toUpperCase() + format.slice(1)
      ),
      blocks: blocks.filter(block => block.text || block.title),
    };
  }

  // Rulings of a printing, from its English printing's Scryfall id (the same cached search as the card data).
  async rulingsFor(card: CatalogCard, expansion: CardExpansion): Promise<CardRuling[]>
  {
    const english = (await this.printingInAllLanguages(card, expansion)).find(row => row.lang === 'en');
    return english?.id ? this.rulings(english.id).catch(() => []) : [];
  }

  // Official rulings and notes, oldest first, as Scryfall lists them; kept a week (they rarely change).
  private async rulings(id: string): Promise<CardRuling[]>
  {
    return (await this.cache.get(
      `magic-rulings:${id}`,
      604_800_000,
      async () =>
        z.object({ data: z.array(z.object({ published_at: z.string(), comment: z.string() })) })
          .parse(await this.request(`/cards/${encodeURIComponent(id)}/rulings`))
          .data
          .slice(0, 12)
          .map(row => ({ date: row.published_at, text: row.comment })),
    ))
      .data;
  }

  // One printing per distinct artwork, newest first; Scryfall's first page (175) is plenty for a card page.
  async otherPrintings(card: CatalogCard)
  {
    const name = (card.language === 'en' ? card.name : '').split(' // ')[0].trim().replaceAll('"', '');
    const key = name ? `name:${name.toLowerCase()}` : `id:${card.scryfallId ?? ''}`;
    if (!name && !card.scryfallId) return [];
    const rows = await this.cache.get(`magic-printings:${key}`, 86_400_000, async () =>
    {
      // Localised cards carry a printed name; the oracle name comes from the card itself.
      const oracle = !name && card.scryfallId
        ? cardSchema
          .parse(await this.request(`/cards/${encodeURIComponent(card.scryfallId)}`))
          .name
          .split(' // ')[0]
          .replaceAll('"', '')
        : name;
      const query = new URL('/cards/search', apiOrigin);
      query.searchParams.set('q', `!"${oracle}" game:paper`);
      query.searchParams.set('unique', 'art');
      query.searchParams.set('order', 'released');
      query.searchParams.set('dir', 'desc');
      try
      {
        return listSchema(cardSchema).parse(await this.request(query.toString())).data;
      }
      catch (error)
      {
        if (error instanceof ApiError && error.status === 404) return [];
        throw error;
      }
    });
    return rows.data.map(row => toCatalogCard(row));
  }

  async illustrators()
  {
    return (await this.cache.get(
      'magic-illustrators',
      86_400_000,
      async () => z.object({ data: z.array(z.string()) }).parse(await this.request('/catalog/artist-names')).data,
    ))
      .data;
  }

  // One printing per artwork by an illustrator, newest first: up to four pages (700 artworks) for the artist page.
  async byIllustrator(artist: string)
  {
    const name = artist.trim().replaceAll('"', '');
    if (!name || name.length > 80) return [];
    const rows = await this.cache.get(`magic-illustrator:${name.toLowerCase()}`, 86_400_000, async () =>
    {
      const query = new URL('/cards/search', apiOrigin);
      query.searchParams.set('q', `a:"${name}" game:paper`);
      query.searchParams.set('unique', 'art');
      query.searchParams.set('order', 'released');
      query.searchParams.set('dir', 'desc');
      const rows: z.infer<typeof cardSchema>[] = [];
      let next: string | undefined = query.toString();
      for (let page = 0; next && page < 4; page++)
      {
        try
        {
          const result = listSchema(cardSchema).parse(await this.request(next));
          rows.push(...result.data);
          next = result.has_more ? result.next_page : undefined;
        }
        catch (error)
        {
          if (error instanceof ApiError && error.status === 404) break;
          throw error;
        }
      }
      return rows;
    });
    return rows.data.map(row => ({
      ...toCatalogCard(row),
      colors: row.colors ?? row.card_faces?.[0]?.colors ?? [],
      typeLine: row.type_line ?? null,
    }));
  }

  async languages(expansionId: number)
  {
    return this.cache.get(`magic-languages:${expansionId}`, 86_400_000, async () =>
    {
      const expansion = (await this.sets()).data.find(set => set.id === expansionId);
      if (!expansion?.code) throw new ApiError(404, 'Magic set not found.');
      const settled = isSettled(expansion.releaseDate);
      const storeKey = `magic/languages/${expansion.code}`;
      const stored = settled ? await this.store.read<(typeof MAGIC_LANGUAGES[number])[]>(storeKey) : null;
      if (stored?.length)
      {
        this.knownLanguages.set(expansionId, new Set(stored));
        return stored;
      }
      const known = this.knownLanguages.get(expansionId) ?? new Set<string>();
      const available: (typeof MAGIC_LANGUAGES[number])[] = [];
      // One search over every language: the first page, in set order, holds the first cards in each printed language.
      const query = new URL('/cards/search', apiOrigin);
      query.searchParams.set('q', `e:${expansion.code!.toLowerCase()} lang:any`);
      query.searchParams.set('unique', 'prints');
      query.searchParams.set('order', 'set');
      query.searchParams.set('include_multilingual', 'true');
      try
      {
        for (const card of listSchema(cardSchema).parse(await this.request(query.toString())).data)
        {
          known.add(card.lang);
        }
      }
      catch (error)
      {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
      }
      for (const language of MAGIC_LANGUAGES) if (known.has(language)) available.push(language);
      this.knownLanguages.set(expansionId, new Set(available));
      if (settled) await this.store.write(storeKey, available);
      return available;
    });
  }
}
