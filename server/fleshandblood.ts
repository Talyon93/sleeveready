import { z } from 'zod';
import { Cache } from './cache.ts';
import { ApiError } from './api-error.ts';
import { byNewest, idRange, SourceClient, stableNumericId, type NativeCatalog } from './native-source.ts';
import type { CardExpansion, CatalogCard } from '../shared/model.ts';

export const FAB_GAME_ID = 9_000_000_009;
export const FAB_LANGUAGES = ['en', 'it', 'de', 'fr', 'es', 'ja'] as const;
export const FAB_GAME = {
  id: FAB_GAME_ID,
  name: 'Flesh and Blood',
  displayName: 'Flesh and Blood',
  printLanguages: [...FAB_LANGUAGES],
};
const ids = idRange(1);
export const isFabExpansionId = ids.isExpansionId;

// Official Legend Story Studios card database: one product per printed language.
const apiOrigin = 'https://api.cardvault.fabtcg.com';
const apiPath = '/carddb/api/v1/';
const productSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  printed_language: z.string(),
  product_name: z.string(),
  release_date: z.string().nullish(),
})
  .passthrough();
const groupSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  group_name: z.string().min(1),
  product_type: z.string(),
  release_date: z.string().nullish(),
  products: z.array(productSchema).default([]),
})
  .passthrough();
const groupsSchema = z.object({ next: z.string().url().nullable(), results: z.array(groupSchema) });
const imageSchema = z.object({
  small: z.string().url().nullish(),
  normal: z.string().url().nullish(),
  large: z.string().url().nullish(),
});
const cardSchema = z.object({
  print_id: z.string().min(1),
  printed_name: z.string().min(1),
  printed_pitch: z.union([z.number(), z.string()]).nullish(),
  faces: z.array(z.object({ image: imageSchema, layout_position: z.number().nullish() })).default([]),
})
  .passthrough();
const productCardsSchema = z.object({ cards: z.array(cardSchema) });
type Language = typeof FAB_LANGUAGES[number];
// Pitch 1–3 is printed as the card's colour strip; decklists name it "(red)", "(yellow)", "(blue)".
const pitchColours: Record<number, string> = { 1: 'Red', 2: 'Yellow', 3: 'Blue' };
const isLanguage = (value: string): value is Language => (FAB_LANGUAGES as readonly string[]).includes(value);
// The name suffix ("[FR]") is authoritative: a few products carry a swapped printed_language.
const productLanguage = (product: z.infer<typeof productSchema>) =>
  /\[([A-Z]{2})\]\s*$/.exec(product.product_name)?.[1]?.toLowerCase() ?? 'en';

export class FleshAndBloodCatalog implements NativeCatalog
{
  readonly game = FAB_GAME;
  readonly isExpansionId = isFabExpansionId;
  readonly cache = new Cache();
  private source: SourceClient;
  constructor(transport: typeof fetch = fetch, pause?: (ms: number) => Promise<unknown>)
  {
    this.source = new SourceClient('Flesh and Blood', [apiOrigin], transport, pause);
  }

  // Booster groups are the playable releases; promo and organised-play products have no group.
  private groups()
  {
    return this.cache.get('fab-groups', 86_400_000, async () =>
    {
      const result = groupsSchema.parse(
        await this.source.json(new URL(apiPath + 'product-groups-products/?page_size=150', apiOrigin)),
      );
      return result
        .results
        .filter(group => group.product_type === 'booster')
        .map(group => ({
          ...group,
          products: group.products.map(product => ({ ...product, language: productLanguage(product) })).filter(
            product => isLanguage(product.language),
          ),
        }))
        .filter(group => group.products.length);
    });
  }
  private async groupProducts(expansionId: number)
  {
    const group = (await this.groups()).data.find(item =>
      stableNumericId(item.slug, ids.expansionBase) === expansionId
    );
    if (!group) throw new ApiError(404, 'Flesh and Blood set not found.');
    return group.products;
  }

  async sets()
  {
    return this.cache.get('fab-sets', 86_400_000, async () =>
    {
      return (await this.groups())
        .data
        .map<CardExpansion>(group => ({
          id: stableNumericId(group.slug, ids.expansionBase),
          gameId: FAB_GAME_ID,
          code: null,
          name: group.group_name,
          releaseDate: group.release_date ?? group.products[0].release_date ?? null,
        }))
        .sort((a, b) => byNewest(a, b) || a.name.localeCompare(b.name));
    });
  }

  async cards(expansionId: number, language = 'en')
  {
    const requested = z.enum(FAB_LANGUAGES).parse(language);
    return this.cache.get(`fab-cards:${expansionId}:${requested}`, 21_600_000, async () =>
    {
      const products = await this.groupProducts(expansionId);
      const product = products.find(row => row.language === requested) ?? products.find(row => row.language === 'en')
        ?? products[0];
      if (!product) return [];
      const resolved = product.language as Language;
      const rows = productCardsSchema
        .parse(await this.source.json(new URL(`${apiPath}product-cards/${product.slug}/`, apiOrigin)))
        .cards;
      const cards: CatalogCard[] = [];
      for (const card of rows)
      {
        const faces = [...card.faces].sort((a, b) => (a.layout_position ?? 0) - (b.layout_position ?? 0));
        faces.forEach((face, index) =>
        {
          const imageUrls = [face.image.large, face.image.normal, face.image.small].filter((url): url is string =>
            Boolean(url)
          );
          if (!imageUrls.length) return;
          cards.push({
            id: stableNumericId(`${card.print_id}:${index}`, ids.cardBase),
            gameId: FAB_GAME_ID,
            categoryId: 1,
            expansionId,
            name: card.printed_name,
            version:
              [pitchColours[Number(card.printed_pitch)], faces.length > 1 ? (index === 0 ? 'Front' : 'Back') : null]
                .filter(Boolean)
                .join(' · ') || null,
            collectorNumber: card.print_id.replace(/^[A-Z]{2}_/, ''),
            rarity: null,
            language: resolved,
            imageUrl: imageUrls[0],
            imageUrls: [...new Set(imageUrls)],
          });
        });
      }
      return cards;
    });
  }

  async languages(expansionId: number)
  {
    return this.cache.get(`fab-languages:${expansionId}`, 86_400_000, async () =>
    {
      const available = new Set((await this.groupProducts(expansionId)).map(row => row.language));
      return FAB_LANGUAGES.filter(language => available.has(language));
    });
  }
}
