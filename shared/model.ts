// hasCardText: the source gives card text (abilities, attacks, rules) for the card pages.
export type CardGame = {
  id: number;
  name: string;
  displayName: string;
  printLanguages?: readonly string[];
  hasCardText?: boolean;
};
export type CardExpansion = {
  id: number;
  gameId: number;
  code: string | null;
  name: string;
  releaseDate?: string | null;
  hasTokens?: boolean;
};
export type CatalogCard = {
  id: number;
  gameId: number;
  categoryId: number;
  expansionId: number | null;
  name: string;
  version: string | null;
  collectorNumber?: string | null;
  rarity?: string | null;
  language?: string | null;
  imageUrl: string | null;
  imageUrls?: string[];
  scryfallId?: string | null;
  colors?: string[] | null;
  typeLine?: string | null;
  cardmarketIds?: number[];
  tcgplayerId?: string | null;
};
// Another version of a card, linked to its card page: set and slug are the URL parts under the game.
export type CardPrinting = { card: CatalogCard; set: string; setName: string; setCode: string | null; slug: string };
// Game data of one printing, in the language the source printed it in. Blocks are abilities, attacks or rules text.
export type CardTextBlock = { title?: string | null; meta?: string | null; text?: string | null };
export type CardDetails = {
  kind?: string | null;
  rarity?: string | null;
  hp?: string | null;
  cost?: string | null;
  stats?: string | null;
  illustrator?: string | null;
  regulation?: string | null;
  weakness?: string | null;
  resistance?: string | null;
  retreat?: string | null;
  legal?: string[];
  blocks: CardTextBlock[];
  prices?: CardPrice[];
  rulings?: CardRuling[];
  formats?: CardFormat[];
  facts?: CardFact[];
  // The card's own page on a deck site, when the source gives it (YGOPRODeck lists the decks that play it).
  deckLinks?: { site: string; url: string }[];
};
// Market prices the card source publishes once a day (TCGplayer in dollars, Cardmarket in euros) and the cheapest
// CardTrader and eBay listings (from: a starting price); foil only when there is no regular one.
export type CardPrice = {
  market: 'TCGplayer' | 'Cardmarket' | 'CardTrader' | 'eBay';
  currency: 'USD' | 'EUR';
  amount: number;
  foil: boolean;
  updated: string;
  from?: boolean;
};
export type CardRuling = { date: string; text: string };
// Every format the source tracks, with the card's status in it (legal is also kept above for the FAQ).
export type CardFormat = {
  format: string;
  status: 'legal' | 'not_legal' | 'banned' | 'restricted' | 'limited' | 'semi_limited';
};
// Game data with its own label on the page (ink cost, ATK, counter…): the key picks the label in the page language.
export type CardFactKey =
  | 'cost'
  | 'life'
  | 'power'
  | 'counter'
  | 'attribute'
  | 'color'
  | 'block'
  | 'traits'
  | 'trigger'
  | 'ink'
  | 'inkable'
  | 'strength'
  | 'willpower'
  | 'lore'
  | 'classifications'
  | 'level'
  | 'rank'
  | 'link'
  | 'scale'
  | 'atk'
  | 'def'
  | 'archetype'
  | 'energy'
  | 'might'
  | 'domain'
  | 'tags';
export type CardFact = { key: CardFactKey; value: string };
// Everything a card page adds around the catalogue card: versions, game data and the card's name in other languages.
// printedWith: cards most often printed on the same sheet (anonymous counts), each with the times they shared one.
export type CardInfo = {
  card: CatalogCard;
  englishName: string;
  versions: CardPrinting[];
  details: CardDetails | null;
  names: { language: string; name: string }[];
  illustrated: CardPrinting[];
  printedWith?: (CardPrinting & { together: number })[];
  decks?: CardDeck[];
};
// The costly extras of a card page (shops, deck sites, Supabase, the illustrator's other cards), loaded apart.
export type CardMarket = {
  prices: CardPrice[];
  illustrated: CardPrinting[];
  printedWith: (CardPrinting & { together: number })[];
  decks: CardDeck[];
  versions?: CardPrinting[];
  rulings?: CardRuling[];
};
// A public deck on another site that plays the card (Archidekt for Magic), linked to it.
export type CardDeck = {
  name: string;
  url: string;
  format: string | null;
  views: number;
  owner: string | null;
  image: string | null;
};
export type MarketplaceOffer = {
  productId: number;
  blueprintId: number;
  quantity: number;
  priceCents: number;
  currency: string;
  condition?: string;
  language?: string;
  foil?: boolean;
  sellerName: string;
  sellerCountry?: string;
  sellerType?: string;
  availableViaCardTraderZero: boolean;
};
export type TrayItem = { card: CatalogCard; quantity: number };
export type Envelope<T> = { data: T; updatedAt: string; mode: 'demo' | 'live' };
export type Status = {
  mode: 'demo' | 'live';
  connected: boolean;
  cartEnabled: boolean;
  development: boolean;
  tokenPresent: boolean;
  diagnostics?: {
    infoOk: boolean;
    gamesCount: number;
    expansionsCount: number;
    lastRequest: string | null;
    error: string | null;
  };
};
export function filterOffers(offers: MarketplaceOffer[], language = '', zero = false)
{
  return offers
    .filter(o => o.quantity > 0 && (!language || o.language === language) && (!zero || o.availableViaCardTraderZero))
    .sort((a, b) => a.currency.localeCompare(b.currency) || a.priceCents - b.priceCents);
}
export function estimateDeck(items: TrayItem[], offers: Record<number, MarketplaceOffer[]>, language = '', zero = false)
{
  const totals: Record<string, number> = {};
  let available = 0;
  for (const item of items)
  {
    const compatible = filterOffers(offers[item.card.id] ?? [], language, zero);
    // Do not add different currencies together. One currency per card, no implicit FX conversion.
    const currency = compatible[0]?.currency;
    let remaining = item.quantity;
    for (const o of compatible.filter(o => o.currency === currency))
    {
      const n = Math.min(remaining, o.quantity);
      if (!n) break;
      totals[o.currency] = (totals[o.currency] ?? 0) + n * o.priceCents;
      available += n;
      remaining -= n;
    }
  }
  return { totals, available, requested: items.reduce((n, i) => n + i.quantity, 0) };
}
// Copies in sheet order, split into pages of perPage cards (9 for the 3 × 3 grid of an A4 or Letter page).
export function paginateTray(items: TrayItem[], perPage = 9)
{
  const size = Math.max(1, Math.floor(perPage));
  const copies = items.flatMap(i => Array.from({ length: i.quantity }, () => i.card));
  return Array.from({ length: Math.ceil(copies.length / size) }, (_, i) => copies.slice(i * size, i * size + size));
}
