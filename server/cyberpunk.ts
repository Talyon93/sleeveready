import { z } from 'zod';
import { Cache } from './cache.ts';
import { ApiError } from './api-error.ts';
import { idRange, SourceClient, stableNumericId, type NativeCatalog } from './native-source.ts';
import type { CardExpansion, CatalogCard } from '../shared/model.ts';

export const CYBERPUNK_GAME_ID = 9_000_000_016;
export const CYBERPUNK_LANGUAGES = ['en', 'fr'] as const;
export const CYBERPUNK_GAME = {
  id: CYBERPUNK_GAME_ID,
  name: 'Cyberpunk',
  displayName: 'Cyberpunk TCG',
  printLanguages: [...CYBERPUNK_LANGUAGES],
};
const ids = idRange(8);
export const isCyberpunkExpansionId = ids.isExpansionId;

// The official cyberpunktcg.com card gallery is served by the netdeck.gg API. Localised printings live in "<set>-fr" sets.
const apiOrigin = 'https://api.netdeck.gg';
const imageOrigin = 'https://dstcynss47vun.cloudfront.net';
const setCode = /^[A-Za-z0-9-]{1,80}$/;
const printingId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const filtersSchema = z.object({
  filters: z.array(z.object({ key: z.string(), options: z.array(z.unknown()).default([]) }).passthrough()),
});
const setOptionSchema = z.object({ code: z.string().regex(setCode), name: z.string().min(1) });
const printingSchema = z.object({
  id: z.string().regex(printingId),
  collector_number: z.string().nullish(),
  image_url: z.string().url().nullish(),
  set: z.object({ code: z.string() }),
  rarity: z.string().nullish(),
  language: z.string().nullish(),
  localized_name: z.string().nullish(),
})
  .passthrough();
const pageSchema = z.object({
  total: z.number().int().nonnegative(),
  items: z.array(
    z.object({ display_name: z.string().min(1), printings: z.array(printingSchema).default([]) }).passthrough(),
  ),
});
type Language = typeof CYBERPUNK_LANGUAGES[number];
const localizedCode = (code: string, language: Language) => language === 'en' ? code : `${code}-${language}`;
export const cyberpunkImagePath = (set: string, printing: string) =>
  `/api/catalog/cyberpunk-image/${set}/${printing}.webp?v=2`;

export class CyberpunkCatalog implements NativeCatalog
{
  readonly game = CYBERPUNK_GAME;
  readonly isExpansionId = isCyberpunkExpansionId;
  readonly cache = new Cache();
  private source: SourceClient;
  private images: SourceClient;
  constructor(transport: typeof fetch = fetch, pause?: (ms: number) => Promise<unknown>)
  {
    this.source = new SourceClient('Cyberpunk TCG', [apiOrigin], transport, pause);
    this.images = new SourceClient('Cyberpunk TCG', [imageOrigin], transport, pause, 0);
  }

  private setOptions()
  {
    return this.cache.get('cyberpunk-set-options', 86_400_000, async () =>
    {
      const filters =
        filtersSchema.parse(await this.source.json(new URL('/api/cards/cyberpunk/filters', apiOrigin))).filters;
      return z.array(setOptionSchema).parse(filters.find(filter => filter.key === 'set')?.options ?? []);
    });
  }
  private async expansion(expansionId: number)
  {
    const expansion = (await this.sets()).data.find(set => set.id === expansionId);
    if (!expansion?.code) throw new ApiError(404, 'Cyberpunk set not found.');
    return expansion;
  }
  private async printings(code: string)
  {
    const rows: z.infer<typeof printingSchema>[] = [];
    const names = new Map<string, string>();
    for (let offset = 0; offset < 2000; offset += 100)
    {
      const url = new URL('/api/cards/cyberpunk', apiOrigin);
      url.search = new URLSearchParams({ set: code, limit: '100', offset: String(offset) }).toString();
      const page = pageSchema.parse(await this.source.json(url));
      for (const item of page.items)
      {
        for (const printing of item.printings)
        {
          if (printing.set.code === code)
          {
            rows.push(printing);
            names.set(printing.id, printing.localized_name || item.display_name);
          }
        }
      }
      if (offset + 100 >= page.total) break;
    }
    return rows.map(printing => ({ ...printing, name: names.get(printing.id)! }));
  }
  // Image URLs are signed for a few minutes only, so this listing is never cached for long.
  private signed(code: string)
  {
    return this.cache.get(
      `cyberpunk-signed:${code}`,
      120_000,
      async () => new Map((await this.printings(code)).map(printing => [printing.id, printing.image_url])),
    );
  }

  async sets()
  {
    return this.cache.get('cyberpunk-sets', 86_400_000, async () =>
    {
      const options = (await this.setOptions()).data;
      const rank = (name: string) => /beta/i.test(name) ? 1 : /retail|starter/i.test(name) ? 0 : 2;
      return options
        .filter(option => !/-[a-z]{2}$/.test(option.code) && !/promo/i.test(option.name))
        .map<CardExpansion>(option => ({
          id: stableNumericId(option.code, ids.expansionBase),
          gameId: CYBERPUNK_GAME_ID,
          code: option.code,
          name: option.name,
          releaseDate: null,
        }))
        .sort((a, b) => rank(a.name) - rank(b.name) || b.name.localeCompare(a.name));
    });
  }
  async cards(expansionId: number, language = 'en')
  {
    const requested = z.enum(CYBERPUNK_LANGUAGES).parse(language);
    return this.cache.get(`cyberpunk-cards:${expansionId}:${requested}`, 21_600_000, async () =>
    {
      const expansion = await this.expansion(expansionId);
      const resolved: Language = (await this.languages(expansionId)).data.includes(requested) ? requested : 'en';
      const code = localizedCode(expansion.code!, resolved);
      return (await this.printings(code)).filter(printing => printing.image_url).map<CatalogCard>(printing =>
      {
        const imageUrl = cyberpunkImagePath(code, printing.id);
        return {
          id: stableNumericId(printing.id, ids.cardBase),
          gameId: CYBERPUNK_GAME_ID,
          categoryId: 1,
          expansionId,
          name: printing.name,
          version: null,
          collectorNumber: printing.collector_number ?? null,
          rarity: printing.rarity ?? null,
          language: resolved,
          imageUrl,
          imageUrls: [imageUrl],
        };
      });
    });
  }
  async languages(expansionId: number)
  {
    return this.cache.get(`cyberpunk-languages:${expansionId}`, 86_400_000, async () =>
    {
      const expansion = await this.expansion(expansionId);
      const codes = new Set((await this.setOptions()).data.map(option => option.code));
      return CYBERPUNK_LANGUAGES.filter(language => codes.has(localizedCode(expansion.code!, language)));
    });
  }

  async image(code: string, id: string)
  {
    if (
      !setCode.test(code) || !printingId.test(id)
      || !(await this.setOptions()).data.some(option => option.code === code)
    ) throw new ApiError(400, 'Invalid Cyberpunk image.');
    const url = (await this.signed(code)).data.get(id);
    if (!url) throw new ApiError(404, 'Cyberpunk image not found.');
    return this.images.bytes(new URL(url));
  }
}
