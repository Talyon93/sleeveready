// The lowest CardTrader listing for a card of a native catalogue: the CardTrader game by name, the expansion by code
// or name, the blueprint by Scryfall id (Magic) or collector number, then the median of the five cheapest regular copies.
import type { CardExpansion, CardPrice, CatalogCard } from '../shared/model.ts';
import type { CardTrader } from './cardtrader.ts';
import { lowMedian } from '../shared/card-extras.ts';

const words = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const code = (value: string | null | undefined) => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
// "001", "1" and "OP01-064" against "OP01064": letters and digits only, no leading zeros.
const number = (value: string | null | undefined) =>
  (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+(?=.)/, '');

export async function cardTraderPrice(
  client: CardTrader,
  gameName: string,
  expansion: CardExpansion,
  card: CatalogCard,
  englishName: string,
): Promise<CardPrice | null>
{
  const game = (await client.games()).data.find(item =>
  {
    const name = words(item.name);
    return name.length > 2 && ` ${words(gameName)} `.includes(` ${name} `);
  });
  if (!game) return null;
  const sets = (await client.expansions()).data.filter(set => set.gameId === game.id);
  const wanted = words(expansion.name);
  const set = sets.find(item => expansion.code && code(item.code) === code(expansion.code))
    ?? sets.find(item => words(item.name) === wanted)
    ?? sets.find(item => wanted.length > 4 && words(item.name).includes(wanted));
  if (!set) return null;
  const blueprints = (await client.cards(set.id)).data;
  const byId = card.scryfallId ? blueprints.find(item => item.scryfallId === card.scryfallId) : undefined;
  const sameNumber = card.collectorNumber
    ? blueprints.filter(item => number(item.collectorNumber) === number(card.collectorNumber))
    : [];
  const named = sameNumber.filter(item => words(item.name) === words(englishName));
  const blueprint = byId
    ?? [...named, ...sameNumber]
      .sort((a, b) =>
        Number(Boolean(a.version && !/^\d+\/\d+$/.test(a.version)))
        - Number(Boolean(b.version && !/^\d+\/\d+$/.test(b.version)))
      )[0];
  if (!blueprint) return null;
  const offers = (await client.offers(blueprint.id)).data.filter(offer => offer.quantity > 0);
  const regular = offers.filter(offer => !offer.foil);
  const pool = regular.length ? regular : offers;
  const currency = pool.sort((a, b) => a.priceCents - b.priceCents)[0]?.currency;
  if (!currency || !/^(EUR|USD)$/.test(currency)) return null;
  const amount = lowMedian(pool.filter(offer => offer.currency === currency).map(offer => offer.priceCents));
  if (amount === null) return null;
  return {
    market: 'CardTrader',
    currency: currency as CardPrice['currency'],
    amount: Math.round(amount) / 100,
    foil: !regular.length,
    updated: new Date().toISOString().slice(0, 10),
    from: true,
  };
}
