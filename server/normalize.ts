import { z } from 'zod';
import { cardTraderImageUrl } from '../shared/images.ts';
import type { CardGame, CardExpansion, CatalogCard, MarketplaceOffer } from '../shared/model.ts';
const id = z.number().int().positive();
const game = z.object({ id, name: z.string(), display_name: z.string().optional() });
const expansion = z.object({ id, game_id: id, code: z.string().nullish(), name: z.string() });
const imageVariant = z.object({ url: z.string().nullish() }).nullish();
const blueprint = z.object({
  id,
  game_id: id,
  category_id: id,
  expansion_id: id.nullish(),
  name: z.string(),
  version: z.string().nullish(),
  fixed_properties: z.record(z.unknown()).optional().default({}),
  image_url: z.string().nullish(),
  image: z.object({ url: z.string().nullish(), show: imageVariant, preview: imageVariant }).nullish(),
  scryfall_id: z.string().nullish(),
  card_market_ids: z.array(z.number()).nullish(),
  tcg_player_id: z.union([z.string(), z.number()]).nullish(),
});
export function games(raw: unknown): CardGame[]
{
  return z.union([z.array(game), z.object({ array: z.array(game) }).transform(value => value.array)]).parse(raw).map(
    g => ({ id: g.id, name: g.name, displayName: g.display_name ?? g.name }),
  );
}
export function expansions(raw: unknown): CardExpansion[]
{
  return z.array(expansion).parse(raw).map(e => ({ id: e.id, gameId: e.game_id, code: e.code ?? null, name: e.name }));
}
export function cards(raw: unknown): CatalogCard[]
{
  return z.array(blueprint).parse(raw).map(c =>
  {
    const imageUrls = [
      ...new Set(
        [c.image?.url, c.image?.show?.url, c.image_url, c.image?.preview?.url].map(cardTraderImageUrl).filter((
          url,
        ): url is string => url !== null),
      ),
    ];
    const property = (pattern: RegExp) =>
      Object
        .entries(c.fixed_properties)
        .find(([key, value]) => pattern.test(key) && (typeof value === 'string' || typeof value === 'number'))
        ?.[1];
    const collectorNumber = property(/collector.*number|card.*number|(^|_)number$/i);
    const rarity = property(/rarity/i);
    return {
      id: c.id,
      gameId: c.game_id,
      categoryId: c.category_id,
      expansionId: c.expansion_id ?? null,
      name: c.name,
      version: c.version ?? null,
      collectorNumber: collectorNumber == null ? null : String(collectorNumber),
      rarity: rarity == null ? null : String(rarity),
      imageUrl: imageUrls[0] ?? null,
      imageUrls,
      scryfallId: c.scryfall_id,
      cardmarketIds: c.card_market_ids ?? [],
      tcgplayerId: c.tcg_player_id == null ? null : String(c.tcg_player_id),
    };
  });
}
const product = z.object({
  id,
  blueprint_id: id,
  quantity: z.number().int().nonnegative(),
  price: z.object({ cents: z.number().int().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/) }),
  on_vacation: z.boolean().optional(),
  properties_hash: z.record(z.unknown()).optional(),
  user: z.object({
    username: z.string().optional(),
    country_code: z.string().optional(),
    user_type: z.string().optional(),
    can_sell_via_hub: z.boolean().optional(),
    on_vacation: z.boolean().optional(),
  }),
});
export function offers(raw: unknown, blueprintId: number): MarketplaceOffer[]
{
  const rows = z.record(z.array(z.unknown())).parse(raw)[String(blueprintId)] ?? [];
  return rows
    .flatMap(row =>
    {
      const p = product.safeParse(row);
      if (!p.success) return [];
      const o = p.data;
      if (o.on_vacation || o.user.on_vacation || o.quantity === 0 || o.blueprint_id !== blueprintId) return [];
      const props = o.properties_hash ?? {};
      const language = Object.entries(props).find(([k, v]) => /(^|_)language$/.test(k) && typeof v === 'string')?.[1];
      const foil = Object.entries(props).find(([k]) => /(^|_)foil$/.test(k))?.[1];
      return [{
        productId: o.id,
        blueprintId: o.blueprint_id,
        quantity: o.quantity,
        priceCents: o.price.cents,
        currency: o.price.currency,
        condition: typeof props.condition === 'string' ? props.condition : undefined,
        language: typeof language === 'string' ? language : undefined,
        foil: foil === true || foil === 'true',
        sellerName: o.user.username ?? 'Venditore',
        sellerCountry: o.user.country_code,
        sellerType: o.user.user_type,
        availableViaCardTraderZero: o.user.can_sell_via_hub === true,
      }];
    })
    .sort((a, b) => a.currency.localeCompare(b.currency) || a.priceCents - b.priceCents);
}
