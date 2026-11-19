// Alternative versions of a card for its page: the same card elsewhere in its expansion (another number or the
// same number reprinted), then, where the source can search by name, its printings in other expansions.
import { cardSlugs, collectorSlug, expansionSlug } from '../shared/seo.ts';
import { normaliseCardName } from '../shared/decklist.ts';
import type { CardExpansion, CardPrinting, CatalogCard } from '../shared/model.ts';
import type { NativeCatalog } from './native-source.ts';

const LIMIT = 24;

// elsewhere: also search other expansions (one source search); server-rendered pages keep to the expansion itself.
export async function alternativePrintings(
  catalog: NativeCatalog,
  expansion: CardExpansion,
  english: CatalogCard[],
  target: CatalogCard,
  elsewhere = true,
): Promise<CardPrinting[]>
{
  const name = normaliseCardName(target.name);
  const slugs = cardSlugs(english);
  const own = (item: CatalogCard): CardPrinting => ({
    card: item,
    set: expansionSlug(expansion),
    setName: expansion.name,
    setCode: expansion.code,
    slug: slugs.get(item.id)!,
  });
  const token = (item: CatalogCard) => item.rarity === 'Token' || item.rarity === 'Emblem';
  const inSet = english
    .filter(item =>
      item !== target && token(item) === token(target)
      && ((item.collectorNumber && item.collectorNumber === target.collectorNumber)
        || normaliseCardName(item.name) === name)
    )
    .map(own);
  if (!catalog.otherPrintings || !elsewhere) return inSet.slice(0, LIMIT);
  // A missing search must not take the card page down with it: the in-set versions are still worth showing.
  let found: CatalogCard[] = [];
  try
  {
    found = await catalog.otherPrintings(target);
  }
  catch
  {
    found = [];
  }
  const others = (await linkPrintings(catalog, found)).filter(item => item.card.expansionId !== expansion.id);
  return [...inSet, ...others].slice(0, LIMIT);
}

// Cards found by a source search, linked to their card pages: expansions the catalogue lists, newest first. Other
// expansions are linked by collector number, which is the card slug unless a set repeats a number.
export async function linkPrintings(catalog: NativeCatalog, found: CatalogCard[]): Promise<CardPrinting[]>
{
  const sets = new Map((await catalog.sets()).data.map(set => [set.id, set]));
  const order = [...sets.keys()];
  return found
    .flatMap(item =>
    {
      const set = item.expansionId === null ? undefined : sets.get(item.expansionId);
      const slug = item.collectorNumber ? collectorSlug(item.collectorNumber) : '';
      return set && slug ? [{ card: item, set: expansionSlug(set), setName: set.name, setCode: set.code, slug }] : [];
    })
    .sort((a, b) => order.indexOf(a.card.expansionId!) - order.indexOf(b.card.expansionId!));
}
