// TCGplayer market prices for the games whose card source has none, from tcgcsv.com (TCGplayer's catalogue and
// prices republished daily per set): the set by code or name, the product by collector number, its market price.
import type { CardExpansion, CardPrice, CatalogCard } from '../shared/model.ts';
import { Cache } from './cache.ts';

const categories: [RegExp, number][] = [
  [/yu-?gi-?oh/i, 2],
  [/one\s*piece/i, 68],
  [/lorcana/i, 71],
  [/riftbound/i, 89],
  [/digimon/i, 63],
  [/gundam/i, 86],
  [/union\s*arena/i, 81],
  [/star\s*wars/i, 79],
  [/flesh/i, 62],
  [/fusion\s*world|dragon\s*ball/i, 80],
  [/sorcery/i, 77],
];
export const tcgplayerCategory = (gameName: string) =>
  categories.find(([pattern]) => pattern.test(gameName))?.[1] ?? null;

type Group = { groupId: number; name: string; abbreviation?: string | null };
type Product = { productId: number; name: string; extendedData?: { name: string; value: string }[] };
type Price = { productId: number; marketPrice?: number | null; midPrice?: number | null; subTypeName?: string | null };
const cache = new Cache(Date.now, 300);
async function get<T>(path: string, ttl: number): Promise<T[]>
{
  return (await cache.get(path, ttl, async () =>
  {
    const response = await fetch(`https://tcgcsv.com/tcgplayer/${path}`, {
      headers: { 'User-Agent': 'SleeveReady/1.0 (+https://sleeveready.com)', Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('tcgcsv ' + response.status);
    return ((await response.json()) as { results?: T[] }).results ?? [];
  }))
    .data;
}
const words = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const code = (value: string | null | undefined) => (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// "150/204", "OP17-020", "056": the part before the slash, letters and digits, no leading zeros.
const number = (value: string | null | undefined) => code((value ?? '').split('/')[0]).replace(/^0+(?=.)/, '');
// Alternate printings TCGplayer lists under the same number; the regular one is preferred.
const alternate =
  /\b(parallel|alternate art|alt art|manga|full art|serialized|promo|foil|showcase|signature|overnumbered)\b/i;

export async function tcgplayerPrice(
  gameName: string,
  expansion: CardExpansion,
  card: CatalogCard,
  englishName: string,
): Promise<CardPrice | null>
{
  const category = tcgplayerCategory(gameName);
  if (!category || !card.collectorNumber) return null;
  const groups = await get<Group>(`${category}/groups`, 86_400_000);
  const wanted = words(expansion.name);
  const group =
    groups.find(item =>
      expansion.code && item.abbreviation && code(item.abbreviation) === code(expansion.code)
      && !/release event|promo/i.test(item.name)
    ) ?? groups.find(item => words(item.name) === wanted)
      ?? groups.find(item => wanted.length > 5 && words(item.name).includes(wanted));
  if (!group) return null;
  const products = (await get<Product>(`${category}/${group.groupId}/products`, 86_400_000)).filter(item =>
    number(item.extendedData?.find(data => data.name === 'Number')?.value) === number(card.collectorNumber)
  );
  const first = words(englishName).split(' ')[0] ?? '';
  const product = [...products]
    .sort((a, b) =>
      Number(alternate.test(a.name)) - Number(alternate.test(b.name))
      || Number(!words(a.name).startsWith(first)) - Number(!words(b.name).startsWith(first))
    )[0];
  if (!product) return null;
  const prices = (await get<Price>(`${category}/${group.groupId}/prices`, 21_600_000)).filter(item =>
    item.productId === product.productId
  );
  const regular = prices.find(item => /normal/i.test(item.subTypeName ?? '') && (item.marketPrice ?? 0) > 0)
    ?? prices.find(item => (item.marketPrice ?? 0) > 0);
  const amount = regular?.marketPrice ?? 0;
  if (!(amount > 0)) return null;
  return {
    market: 'TCGplayer',
    currency: 'USD',
    amount,
    foil: !/normal/i.test(regular?.subTypeName ?? 'normal'),
    updated: new Date().toISOString().slice(0, 10),
  };
}
