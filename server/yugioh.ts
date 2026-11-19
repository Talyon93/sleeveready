import { retryWithin, upstreamSignal } from './upstream.ts';
import { z } from 'zod';
import { Cache, Queue } from './cache.ts';
import { ApiError } from './api-error.ts';
import type { CardDetails, CardExpansion, CardFact, CardFormat, CardPrice, CatalogCard } from '../shared/model.ts';
import { normaliseCardName, type DeckEntry } from '../shared/decklist.ts';
import { mergeImported } from './deck-import.ts';

export const YUGIOH_GAME_ID = 9_000_000_006;
export const YUGIOH_LANGUAGES = ['en'] as const;
export const YUGIOH_GAME = {
  id: YUGIOH_GAME_ID,
  name: 'Yu-Gi-Oh!',
  displayName: 'Yu-Gi-Oh!',
  printLanguages: [...YUGIOH_LANGUAGES],
  hasCardText: true,
} as const;
export const YUGIOH_EXPANSION_ID_MIN = 60_000_000_000;
export const YUGIOH_EXPANSION_ID_MAX = 64_294_967_295;

const origin = 'https://db.ygoprodeck.com';
const setSchema = z.object({
  set_name: z.string().min(1),
  set_code: z.string().min(1),
  num_of_cards: z.number().int().positive(),
  tcg_date: z.string().nullish(),
})
  .passthrough();
const printingSchema = z.object({ set_name: z.string(), set_code: z.string(), set_rarity: z.string().nullish() })
  .passthrough();
const imageSchema = z.object({
  id: z.number().int().positive(),
  image_url: z.string().url(),
  image_url_small: z.string().url().optional(),
})
  .passthrough();
const cardSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  type: z.string().nullish(),
  card_sets: z.array(printingSchema).default([]),
  card_images: z.array(imageSchema).min(1),
})
  .passthrough();
const cardsSchema = z.object({ data: z.array(cardSchema) });
const detailRowSchema = z.object({
  name: z.string(),
  type: z.string().nullish(),
  humanReadableCardType: z.string().nullish(),
  frameType: z.string().nullish(),
  desc: z.string().nullish(),
  pend_desc: z.string().nullish(),
  monster_desc: z.string().nullish(),
  race: z.string().nullish(),
  atk: z.number().nullish(),
  def: z.number().nullish(),
  level: z.number().nullish(),
  linkval: z.number().nullish(),
  scale: z.number().nullish(),
  attribute: z.string().nullish(),
  archetype: z.string().nullish(),
  ygoprodeck_url: z.string().nullish(),
  banlist_info: z.object({ ban_tcg: z.string().optional(), ban_ocg: z.string().optional() }).passthrough().nullish(),
  card_sets: z.array(
    z.object({
      set_name: z.string(),
      set_code: z.string(),
      set_rarity: z.string().nullish(),
      set_price: z.string().nullish(),
    }),
  )
    .nullish(),
});
const detailsSchema = z.object({ data: z.array(detailRowSchema) });
const setInfoSchema = z.object({
  id: z.number().int().positive(),
  set_name: z.string().min(1),
  set_code: z.string().min(1),
})
  .passthrough();

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
// An alternate-art passcode selects that artwork first; otherwise the card's main image leads.
function toCatalogCard(card: z.infer<typeof cardSchema>, expansion: CardExpansion | null, artwork?: number): CatalogCard
{
  const printing = expansion ? card.card_sets.find(value => value.set_name === expansion.name) : undefined;
  const ordered = [...card.card_images].sort((a, b) => Number(b.id === artwork) - Number(a.id === artwork));
  const images = [
    ...new Set(
      ordered.flatMap(image => [image.image_url, image.image_url_small]).filter((value): value is string =>
        Boolean(value)
      ),
    ),
  ];
  return {
    id: stableNumericId(
      `${expansion?.name ?? 'card'}:${printing?.set_code ?? card.id}${
        artwork && artwork !== card.id ? ':' + artwork : ''
      }`,
      70_000_000_000,
    ),
    gameId: YUGIOH_GAME_ID,
    categoryId: 1,
    expansionId: expansion?.id ?? null,
    name: card.name,
    version: card.type ?? null,
    collectorNumber: printing?.set_code ?? String(card.id),
    rarity: printing?.set_rarity ?? null,
    language: 'en',
    imageUrl: images[0] ?? null,
    imageUrls: images,
  };
}
export const isYugiohExpansionId = (value: number) =>
  value >= YUGIOH_EXPANSION_ID_MIN && value <= YUGIOH_EXPANSION_ID_MAX;

export class YugiohCatalog
{
  readonly cache = new Cache();
  readonly queue = new Queue(55);
  constructor(
    private transport: typeof fetch = fetch,
    private pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  )
  {}

  private async request(path: string, params: Record<string, string> = {})
  {
    const url = new URL(path, origin);
    url.search = new URLSearchParams(params).toString();
    if (url.origin !== origin || !url.pathname.startsWith('/api/v7/'))
    {
      throw new ApiError(502, 'YGOPRODeck returned an unexpected address.');
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
            signal: upstreamSignal(25_000, started),
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
              response.status === 404 ? 'Yu-Gi-Oh! set not found.' : 'YGOPRODeck is temporarily unavailable.',
            );
          }
          if (!(response.headers.get('content-type') ?? '').includes('json'))
          {
            await response.body?.cancel();
            throw new ApiError(502, 'YGOPRODeck returned an invalid response.');
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
          throw new ApiError(502, 'Connection to YGOPRODeck lost. Try again.');
        }
      }
      throw new ApiError(502, 'Yu-Gi-Oh! catalog unavailable.');
    });
  }

  private setRows()
  {
    return this.cache.get(
      'yugioh-source-sets',
      86_400_000,
      async () => z.array(setSchema).parse(await this.request('/api/v7/cardsets.php')),
    );
  }
  private async expansion(expansionId: number)
  {
    const expansion = (await this.sets()).data.find(set => set.id === expansionId);
    if (!expansion) throw new ApiError(404, 'Yu-Gi-Oh! set not found.');
    return expansion;
  }

  async sets()
  {
    return this.cache.get('yugioh-sets', 86_400_000, async () =>
    {
      const rows = (await this.setRows()).data;
      const sets: CardExpansion[] = rows
        .map(set => ({
          id: stableNumericId(set.set_name, YUGIOH_EXPANSION_ID_MIN),
          gameId: YUGIOH_GAME_ID,
          code: set.set_code.toUpperCase(),
          name: set.set_name,
          releaseDate: set.tcg_date ?? null,
        }))
        .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || a.name.localeCompare(b.name));
      return sets;
    });
  }

  async cards(expansionId: number, language = 'en')
  {
    z.enum(YUGIOH_LANGUAGES).parse(language);
    return this.cache.get(`yugioh-cards:${expansionId}`, 21_600_000, async () =>
    {
      const expansion = await this.expansion(expansionId);
      const rows = cardsSchema.parse(await this.request('/api/v7/cardinfo.php', { cardset: expansion.name })).data;
      return rows.map<CatalogCard>(card => toCatalogCard(card, expansion));
    });
  }

  // Decklists: YDK files list one passcode per copy; text lists use names. Both resolve in batched lookups,
  // printed from the newest expansion in the catalogue that contains the card.
  async importCards(entries: DeckEntry[], _language = 'en')
  {
    void _language;
    // Printed set codes ("BETB-EN095", alone or after the name) pick that exact printing: looked up one by one.
    const printedCode = (entry: DeckEntry) =>
      [entry.number, entry.name].find(value => value && /^[A-Z0-9]{2,6}-[A-Z]{0,2}\d{2,4}$/i.test(value))?.toUpperCase()
        ?? null;
    const printed = new Map<string, z.infer<typeof setInfoSchema>>();
    for (const code of [...new Set(entries.map(printedCode).filter((value): value is string => value !== null))].slice(
      0,
      80,
    ))
    {
      try
      {
        printed.set(code, setInfoSchema.parse(await this.request('/api/v7/cardsetsinfo.php', { setcode: code })));
      }
      catch (error)
      {
        if (!(error instanceof ApiError) && !(error instanceof z.ZodError)) throw error;
      }
    }
    const passcode = (entry: DeckEntry) =>
    {
      const code = printedCode(entry);
      if (code && printed.has(code)) return printed.get(code)!.id;
      return entry.name && /^\d{5,10}$/.test(entry.name) ? Number(entry.name) : null;
    };
    const ids = [...new Set(entries.map(passcode).filter((value): value is number => value !== null))];
    const names = [
      ...new Set(
        entries.filter(entry => entry.name && passcode(entry) === null && !printedCode({ ...entry, number: null })).map(
          entry => entry.name!.replace(/\|/g, ' '),
        ),
      ),
    ];
    const rows: z.infer<typeof cardSchema>[] = [];
    const lookup = async (params: Record<string, string>) =>
    {
      try
      {
        rows.push(...cardsSchema.parse(await this.request('/api/v7/cardinfo.php', params)).data);
      }
      catch (error)
      {
        if (!(error instanceof ApiError)) throw error;
      }
    };
    for (let offset = 0; offset < ids.length; offset += 50)
    {
      await lookup({ id: ids.slice(offset, offset + 50).join(',') });
    }
    for (let offset = 0; offset < names.length; offset += 20)
    {
      await lookup({ name: names.slice(offset, offset + 20).join('|') });
    }
    const sets = (await this.sets()).data;
    const byName = new Map(sets.map(set => [set.name, set]));
    const resolve = (entry: DeckEntry) =>
    {
      const code = passcode(entry);
      return code !== null
        ? rows.find(card => card.id === code || card.card_images.some(image => image.id === code))
        : rows.find(card => normaliseCardName(card.name) === normaliseCardName(entry.name ?? ''));
    };
    const items: { card: CatalogCard; quantity: number }[] = [];
    const unresolved: string[] = [];
    for (const entry of entries)
    {
      const card = resolve(entry);
      if (!card)
      {
        unresolved.push(entry.line);
        continue;
      }
      const code = printedCode(entry);
      const named = code ? byName.get(printed.get(code)?.set_name ?? '') : undefined;
      const expansion = named
        ?? card
          .card_sets
          .map(printing => byName.get(printing.set_name))
          .filter((set): set is CardExpansion => Boolean(set))
          .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))[0]
        ?? null;
      items.push({ card: toCatalogCard(card, expansion, passcode(entry) ?? undefined), quantity: entry.quantity });
    }
    return { items: mergeImported(items), unresolved };
  }

  // Card page data: text, monster stats, the TCG and OCG banlists, the printing's TCGplayer price and its YGOPRODeck page.
  async details(card: CatalogCard, expansion: CardExpansion): Promise<CardDetails | null>
  {
    const rows = await this.cache.get(`yugioh-card:${card.name.toLowerCase()}`, 86_400_000, async () =>
    {
      try
      {
        return detailsSchema.parse(await this.request('/api/v7/cardinfo.php', { name: card.name })).data;
      }
      catch (error)
      {
        if (error instanceof ApiError) return [];
        throw error;
      }
    });
    const row = rows.data.find(item => item.name === card.name) ?? rows.data[0];
    if (!row) return null;
    const monster = /monster/i.test(row.type ?? '');
    const frame = row.frameType ?? '';
    const facts: CardFact[] = [];
    const add = (key: CardFact['key'], value: unknown) =>
    {
      if (value !== undefined && value !== null && value !== '') facts.push({ key, value: String(value) });
    };
    add('attribute', row.attribute);
    if (frame.startsWith('xyz')) add('rank', row.level);
    else if (frame === 'link') add('link', row.linkval);
    else add('level', row.level);
    add('scale', row.scale);
    if (monster)
    {
      add('atk', row.atk);
      if (frame !== 'link') add('def', row.def);
    }
    add('archetype', row.archetype);
    const blocks = row.pend_desc
      ? [{ title: 'Pendulum Effect', text: row.pend_desc }, { text: row.monster_desc ?? row.desc ?? null }]
      : [{ text: row.desc ?? null }];
    const ban = row.banlist_info ?? {};
    const status = (value: string | undefined): CardFormat['status'] =>
      value === 'Forbidden'
        ? 'banned'
        : value === 'Limited'
        ? 'limited'
        : value === 'Semi-Limited'
        ? 'semi_limited'
        : 'legal';
    const formats: CardFormat[] = [
      { format: 'TCG', status: status(ban.ban_tcg) },
      { format: 'OCG', status: status(ban.ban_ocg) },
    ];
    const printing =
      row.card_sets?.find(item => item.set_code === card.collectorNumber && item.set_name === expansion.name)
        ?? row.card_sets?.find(item => item.set_code === card.collectorNumber);
    const amount = Number(printing?.set_price);
    const prices: CardPrice[] = Number.isFinite(amount) && amount > 0
      ? [{ market: 'TCGplayer', currency: 'USD', amount, foil: false, updated: new Date().toISOString().slice(0, 10) }]
      : [];
    return {
      kind: [row.humanReadableCardType ?? row.type, monster ? row.race : null].filter(Boolean).join(' · ') || null,
      rarity: printing?.set_rarity ?? null,
      facts,
      formats,
      legal: formats.filter(item => item.status !== 'banned').map(item => item.format),
      prices,
      blocks: blocks.filter(block => block.text).map(block => ({ ...block, text: block.text })),
      deckLinks: row.ygoprodeck_url && /^https:\/\/ygoprodeck\.com\//.test(row.ygoprodeck_url)
        ? [{ site: 'YGOPRODeck', url: row.ygoprodeck_url }]
        : [],
    };
  }

  async languages(expansionId: number)
  {
    return this.cache.get(`yugioh-languages:${expansionId}`, 86_400_000, async () =>
    {
      await this.expansion(expansionId);
      return ['en'] as (typeof YUGIOH_LANGUAGES[number])[];
    });
  }
}
