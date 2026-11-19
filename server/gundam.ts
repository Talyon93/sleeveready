import { z } from 'zod';
import { Cache } from './cache.ts';
import { ApiError } from './api-error.ts';
import {
  decodeHtml,
  idRange,
  officialOrder,
  SourceClient,
  stableNumericId,
  type NativeCatalog,
} from './native-source.ts';
import type { CardExpansion, CatalogCard } from '../shared/model.ts';

export const GUNDAM_GAME_ID = 9_000_000_012;
export const GUNDAM_GAME = {
  id: GUNDAM_GAME_ID,
  name: 'Gundam',
  displayName: 'Gundam Card Game',
  printLanguages: ['en'],
};
const ids = idRange(4);
export const isGundamExpansionId = ids.isExpansionId;

// Official Bandai English card list. Package 6169xx is the promo bucket.
const siteOrigin = 'https://www.gundam-gcg.com';
// The official site sends Cross-Origin-Resource-Policy: same-site, so browsers refuse its images on other sites:
// they go through /api/catalog/gundam-image/ (cached by the CDN), like One Piece and Cyberpunk.
export const gundamImagePath = (file: string, version?: string | null) =>
  `/api/catalog/gundam-image/${file}${version ? `?v=${version}` : ''}`;
const imageFile = /^[A-Za-z0-9_-]{1,40}\.webp$/;
const listUrl = (pkg?: string) =>
{
  const url = new URL('/en/cards/index.php', siteOrigin);
  if (pkg) url.search = new URLSearchParams({ package: pkg }).toString();
  return url;
};
type Entry = { category: string; expansion: CardExpansion };

export function parseGundamSets(html: string): Entry[]
{
  const entries = new Map<string, Entry>();
  for (const match of html.matchAll(/data-val="(616[0-8]\d\d)">([^<]+)/g))
  {
    if (entries.has(match[1])) continue;
    const label = decodeHtml(match[2]);
    const code = /\[([A-Z0-9-]+)\]\s*$/.exec(label)?.[1] ?? null;
    entries.set(match[1], {
      category: match[1],
      expansion: {
        id: stableNumericId(match[1], ids.expansionBase),
        gameId: GUNDAM_GAME_ID,
        code,
        name: label.replace(/\s*\[[A-Z0-9-]+\]\s*$/, ''),
        releaseDate: null,
      },
    });
  }
  return officialOrder([...entries.values()], 4);
}
export function parseGundamCards(html: string, expansionId: number, pkg: string): CatalogCard[]
{
  const cards: CatalogCard[] = [];
  for (const match of html.matchAll(
    /data-src="detail\.php\?detailSearch=([A-Za-z0-9_-]+)"[^>]*>\s*<img[^>]*data-src="(\.\.\/images\/cards\/card\/[A-Za-z0-9_-]+\.webp(?:\?[^"]*)?)" alt="([^"]*)"/g,
  ))
  {
    const [, key, path, alt] = match;
    const parallel = /_p(\d+)$/.exec(key)?.[1];
    const source = new URL(path, listUrl());
    const imageUrl = gundamImagePath(
      source.pathname.split('/').pop()!,
      source.search.slice(1).replace(/\D/g, '').slice(0, 8) || null,
    );
    cards.push({
      id: stableNumericId(`${pkg}:${key}`, ids.cardBase),
      gameId: GUNDAM_GAME_ID,
      categoryId: 1,
      expansionId,
      name: decodeHtml(alt) || key,
      version: parallel ? `Parallel ${parallel}` : null,
      collectorNumber: key.replace(/_p\d+$/, ''),
      rarity: null,
      language: 'en',
      imageUrl,
      imageUrls: [imageUrl],
    });
  }
  return cards;
}

export class GundamCatalog implements NativeCatalog
{
  readonly game = GUNDAM_GAME;
  readonly isExpansionId = isGundamExpansionId;
  readonly cache = new Cache();
  private source: SourceClient;
  constructor(transport: typeof fetch = fetch, pause?: (ms: number) => Promise<unknown>)
  {
    this.source = new SourceClient('Gundam Card Game', [siteOrigin], transport, pause);
  }

  private catalog()
  {
    return this.cache.get('gundam-catalog', 86_400_000, async () =>
    {
      const sets = parseGundamSets(await this.source.text(listUrl()));
      if (!sets.length) throw new ApiError(502, 'Gundam set list not recognised.');
      return sets;
    });
  }
  private async category(expansionId: number)
  {
    const entry = (await this.catalog()).data.find(set => set.expansion.id === expansionId);
    if (!entry) throw new ApiError(404, 'Gundam set not found.');
    return entry.category;
  }

  async sets()
  {
    const result = await this.catalog();
    return { ...result, data: result.data.map(set => set.expansion) };
  }
  async cards(expansionId: number, language = 'en')
  {
    z.literal('en').parse(language);
    return this.cache.get(`gundam-cards:${expansionId}`, 21_600_000, async () =>
    {
      const pkg = await this.category(expansionId);
      return parseGundamCards(await this.source.text(listUrl(pkg)), expansionId, pkg);
    });
  }
  async languages(expansionId: number)
  {
    return this.cache.get(`gundam-languages:${expansionId}`, 86_400_000, async () =>
    {
      await this.category(expansionId);
      return ['en'];
    });
  }
  async image(file: string)
  {
    if (!imageFile.test(file)) throw new ApiError(400, 'Invalid Gundam image.');
    return this.source.bytes(new URL('/en/images/cards/card/' + file, siteOrigin));
  }
}
