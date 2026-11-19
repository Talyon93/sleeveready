import { z } from 'zod';
import { Cache } from './cache.ts';
import { ApiError } from './api-error.ts';
import {
  assignDates,
  decodeHtml,
  ENGLISH_DATE,
  englishDate,
  idRange,
  officialOrder,
  pageText,
  SourceClient,
  stableNumericId,
  type NativeCatalog,
} from './native-source.ts';
import type { CardExpansion, CatalogCard } from '../shared/model.ts';

export const DRAGON_BALL_GAME_ID = 9_000_000_011;
export const DRAGON_BALL_GAME = {
  id: DRAGON_BALL_GAME_ID,
  name: 'Dragon Ball Super',
  displayName: 'Dragon Ball Super Card Game',
  printLanguages: ['en'],
};
const ids = idRange(3);
export const isDragonBallExpansionId = ids.isExpansionId;

// Official Bandai card lists: Fusion World (current) and Masters (the original game). Categories ending in 9xx are promos.
const siteOrigin = 'https://www.dbs-cardgame.com';
type Line = 'fw' | 'masters';
const listUrl = (line: Line, category: string) =>
{
  const url = new URL(line === 'fw' ? '/fw/en/cardlist/' : '/us-en/cardlist/', siteOrigin);
  url.search = new URLSearchParams(
    line === 'fw' ? { search: 'true', 'category[0]': category } : { search: 'true', category },
  )
    .toString();
  return url;
};
type Entry = { line: Line; category: string; expansion: CardExpansion };

export function parseDragonBallSets(html: string, line: Line): Entry[]
{
  const pattern = line === 'fw' ? /(583[0-8]\d\d)"[^>]*>([^<]+)/g : /value="(428[0-8]\d\d)"[^>]*>([^<]+)/g;
  const entries = new Map<string, Entry>();
  for (const match of html.matchAll(pattern))
  {
    if (entries.has(match[1])) continue;
    const label = decodeHtml(match[2]);
    const code = /\[([A-Z0-9-]+)\]\s*$/.exec(label)?.[1] ?? null;
    entries.set(match[1], {
      line,
      category: match[1],
      expansion: {
        id: stableNumericId(`${line}:${match[1]}`, ids.expansionBase),
        gameId: DRAGON_BALL_GAME_ID,
        code,
        name: `${line === 'fw' ? 'Fusion World' : 'Masters'} · ${label.replace(/\s*\[[A-Z0-9-]+\]\s*$/, '')}`,
        releaseDate: null,
      },
    });
  }
  return [...entries.values()];
}
// "BOOSTER PACK -CROSS FORCE- [FB10] RELEASE June 12, 2026"
export function parseFusionWorldProductDates(html: string)
{
  return [...pageText(html).matchAll(new RegExp('\\[([A-Z]{2}\\d{2})\\]\\s*RELEASE ' + ENGLISH_DATE, 'g'))]
    .map(match => ({ code: match[1], date: englishDate(match[2]) }))
    .filter((item): item is { code: string; date: string } => Boolean(item.date));
}
export function parseFusionWorldCards(html: string, expansionId: number): CatalogCard[]
{
  const cards: CatalogCard[] = [];
  for (const match of html.matchAll(
    /<li class="cardItem">[\s\S]*?data-src="(\.\.\/\.\.\/images\/cards\/card\/en\/([A-Za-z0-9_-]+)\.webp)" alt="([^"]*)"/g,
  ))
  {
    const [, path, file, alt] = match;
    const number = /^[A-Z0-9]+-\d+/.exec(file)?.[0] ?? file;
    const name = decodeHtml(alt).replace(/^\S+\s+/, '');
    const parallel = /_p(\d+)$/.exec(file)?.[1];
    const base = {
      gameId: DRAGON_BALL_GAME_ID,
      categoryId: 1,
      expansionId,
      name,
      collectorNumber: number,
      rarity: null,
      language: 'en',
    };
    const front = new URL(path, listUrl('fw', '')).href;
    cards.push({
      ...base,
      id: stableNumericId(`fw:${file}`, ids.cardBase),
      version:
        [/_f(?:_|$)/.test(file) ? 'Front' : null, parallel ? `Parallel ${parallel}` : null].filter(Boolean).join(' · ')
        || null,
      imageUrl: front,
      imageUrls: [front],
    });
    // Leader cards list only the front face; the back uses the same name with _b.
    if (/_f(?:_|$)/.test(file))
    {
      const back = front.replace(/_f(_p\d+)?\.webp$/, '_b$1.webp');
      cards.push({
        ...base,
        id: stableNumericId(`fw:${file}:back`, ids.cardBase),
        version: ['Back', parallel ? `Parallel ${parallel}` : null].filter(Boolean).join(' · '),
        imageUrl: back,
        imageUrls: [back],
      });
    }
  }
  return cards;
}
export function parseMastersCards(html: string, expansionId: number): CatalogCard[]
{
  const cards: CatalogCard[] = [];
  for (const block of html.split('<dl class="cardListCol').slice(1))
  {
    const image = /<img src="(\.\.\/\.\.\/images\/cardlist\/cardimg\/([A-Za-z0-9_-]+)\.png)"/.exec(block);
    const number = decodeHtml(/<dt class="cardNumber">([\s\S]*?)<\/dt>/.exec(block)?.[1] ?? '');
    const name = decodeHtml(/<dd class="cardName">([\s\S]*?)<\/dd>/.exec(block)?.[1] ?? '');
    if (!image || !name) continue;
    const imageUrl = new URL(image[1], listUrl('masters', '')).href;
    const back = /^[^>]*cardBack/.test(block);
    cards.push({
      id: stableNumericId(`masters:${image[2]}`, ids.cardBase),
      gameId: DRAGON_BALL_GAME_ID,
      categoryId: 1,
      expansionId,
      name,
      version: back ? 'Back' : /^[^>]*cardFront/.test(block) ? 'Front' : null,
      collectorNumber: number || image[2],
      rarity: decodeHtml(/<dl class="rarityCol">[\s\S]*?<dd>([\s\S]*?)<\/dd>/.exec(block)?.[1] ?? '') || null,
      language: 'en',
      imageUrl,
      imageUrls: [imageUrl],
    });
  }
  return cards;
}

export class DragonBallCatalog implements NativeCatalog
{
  readonly game = DRAGON_BALL_GAME;
  readonly isExpansionId = isDragonBallExpansionId;
  readonly cache = new Cache();
  private source: SourceClient;
  constructor(transport: typeof fetch = fetch, pause?: (ms: number) => Promise<unknown>)
  {
    this.source = new SourceClient('Dragon Ball Super Card Game', [siteOrigin], transport, pause);
  }

  // Fusion World's products page lists recent releases with dates; Masters has none, so those sets stay undated.
  private async productDates()
  {
    try
    {
      return parseFusionWorldProductDates(await this.source.text(new URL('/fw/en/products/', siteOrigin)));
    }
    catch
    {
      return [];
    }
  }
  private catalog()
  {
    return this.cache.get('dragon-ball-catalog', 86_400_000, async () =>
    {
      const fusionWorld = assignDates(
        parseDragonBallSets(await this.source.text(listUrl('fw', '583001')), 'fw'),
        await this.productDates(),
      );
      const masters = parseDragonBallSets(await this.source.text(listUrl('masters', '428001')), 'masters');
      if (!fusionWorld.length && !masters.length) throw new ApiError(502, 'Dragon Ball Super set list not recognised.');
      return [...officialOrder(fusionWorld, 4), ...officialOrder(masters, 4)];
    });
  }
  private async entry(expansionId: number)
  {
    const entry = (await this.catalog()).data.find(set => set.expansion.id === expansionId);
    if (!entry) throw new ApiError(404, 'Dragon Ball Super set not found.');
    return entry;
  }

  async sets()
  {
    const result = await this.catalog();
    return { ...result, data: result.data.map(set => set.expansion) };
  }
  async cards(expansionId: number, language = 'en')
  {
    z.literal('en').parse(language);
    return this.cache.get(`dragon-ball-cards:${expansionId}`, 21_600_000, async () =>
    {
      const entry = await this.entry(expansionId);
      const html = await this.source.text(listUrl(entry.line, entry.category));
      return entry.line === 'fw' ? parseFusionWorldCards(html, expansionId) : parseMastersCards(html, expansionId);
    });
  }
  async languages(expansionId: number)
  {
    return this.cache.get(`dragon-ball-languages:${expansionId}`, 86_400_000, async () =>
    {
      await this.entry(expansionId);
      return ['en'];
    });
  }
}
