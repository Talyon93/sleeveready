// What a card page adds around the catalogue card, shared by the server-rendered page and /api/catalog/card-info:
// alternative versions, game data of the shown printing and the card's name in the other page languages.
import { seoLanguages, type SeoLanguage } from '../shared/seo.ts';
import type { CardExpansion, CardInfo, CardMarket, CardPrice, CatalogCard } from '../shared/model.ts';
import type { NativeCatalog } from './native-source.ts';
import { alternativePrintings, linkPrintings } from './printings.ts';
import { samePrinting } from './deck-import.ts';
import { cardTraderPrice } from './cardtrader-price.ts';
import { ebayConfigured, ebayPrice } from './ebay-price.ts';
import { archidektDecks } from './archidekt-decks.ts';
import { tcgplayerCategory, tcgplayerPrice } from './tcgplayer-price.ts';
import { MAGIC_GAME_ID } from './scryfall.ts';
import type { CardTrader } from './cardtrader.ts';

// The card itself: versions, game data and names. Cheap enough for server-rendered pages, which the CDN keeps.
// allNames:false leaves out the names in other languages: without a source that answers per card they take the whole
// expansion once per printed language, seconds of function time on a page the crawlers read and people rarely do.
export async function cardInfo(
  catalog: NativeCatalog,
  expansion: CardExpansion,
  english: CatalogCard[],
  target: CatalogCard,
  shown: CatalogCard,
  { allNames = true }: { allNames?: boolean } = {},
): Promise<CardInfo>
{
  // Extra data must never take the page down: each part falls back to empty on a source error.
  const details = catalog.details ? catalog.details(shown, expansion).catch(() => null) : Promise.resolve(null);
  const printed = (catalog.game.printLanguages?.length ?? 0) > 1
    ? await catalog.languages(expansion.id).then(result => result.data, () => [] as string[])
    : [];
  const others = seoLanguages.filter(language =>
    language !== (shown.language ?? 'en') && (language === 'en' || printed.includes(language))
  );
  const names = !allNames && !catalog.localNames
    ? Promise.resolve([])
    : catalog.localNames
    ? catalog.localNames(target, expansion).then(
      rows => rows.filter(row => (others as string[]).includes(row.language) && row.name !== shown.name),
      () => [],
    )
    : Promise
      .all(others.map(async language =>
      {
        try
        {
          const list = language === 'en' ? english : (await catalog.cards(expansion.id, language)).data;
          const card = language === 'en' ? target : samePrinting(english, list, target);
          return card && (card.language ?? 'en') === language && card.name !== shown.name
            ? [{ language, name: card.name }]
            : [];
        }
        catch
        {
          return [];
        }
      }))
      .then(rows => rows.flat());
  // Versions in this expansion only: other expansions need a source search, loaded with the extras (cardMarket).
  const [versions, found, localNames] = await Promise.all([
    alternativePrintings(catalog, expansion, english, target, false),
    details,
    names,
  ]);
  return {
    card: shown,
    englishName: target.name,
    versions,
    details: found,
    names: localNames,
    illustrated: [],
    printedWith: [],
    decks: [],
  };
}

// What costs outside calls (shops, deck sites, Supabase, the illustrator's other cards): asked for only by visitors'
// browsers, after a person interacts, and kept a day by the CDN. Prices add to those the card source already gives.
export async function cardMarket(
  catalog: NativeCatalog,
  expansion: CardExpansion,
  english: CatalogCard[],
  target: CatalogCard,
  shown: CatalogCard,
  options: {
    cardTrader?: CardTrader;
    pageLanguage?: SeoLanguage;
    illustrator?: string | null;
    hasTcgplayer?: boolean;
  } = {},
): Promise<CardMarket>
{
  const within = <T>(task: Promise<T>, fallback: T, ms: number) =>
    Promise.race([task.catch(() => fallback), new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);
  const gameName = catalog.game.name + ' ' + catalog.game.displayName;
  // The illustrator comes from the card data; their other cards leave out this card and its versions (same name).
  const sameCard = (item: CatalogCard) => item.name === target.name || item.name === shown.name;
  const illustrated = options.illustrator && catalog.byIllustrator
    ? within(
      (async () =>
        (await linkPrintings(
          catalog,
          (await catalog.byIllustrator!(options.illustrator!)).filter(item => !sameCard(item)),
        ))
          .slice(0, 12))(),
      [] as CardInfo['illustrated'],
      5000,
    )
    : Promise.resolve([] as CardInfo['illustrated']);
  const listing = options.cardTrader
    ? within(cardTraderPrice(options.cardTrader, gameName, expansion, target, target.name), null, 4000)
    : Promise.resolve(null);
  const ebay = options.pageLanguage && ebayConfigured()
    ? within(ebayPrice(options.pageLanguage, { name: target.name, set: expansion.name }), null, 4000)
    : Promise.resolve(null);
  // TCGplayer from tcgcsv for the games whose source has no price for the card (Magic and Pokémon carry their own).
  const tcgplayer = !options.hasTcgplayer && tcgplayerCategory(gameName)
    ? within(tcgplayerPrice(gameName, expansion, target, target.name), null, 4500)
    : Promise.resolve(null);
  const decks = catalog.game.id === MAGIC_GAME_ID ? within(archidektDecks(target.name), [], 5000) : Promise.resolve([]);
  const versions = catalog.otherPrintings
    ? within(alternativePrintings(catalog, expansion, english, target), undefined, 5000)
    : Promise.resolve(undefined);
  const rulings = catalog.rulingsFor ? within(catalog.rulingsFor(shown, expansion), [], 4000) : Promise.resolve([]);
  const [byArtist, together, cheapest, onEbay, market, publicDecks, allVersions, cardRulings] = await Promise.all([
    illustrated,
    within(printedWith(catalog, [target.id, shown.id]), [], 3000),
    listing,
    ebay,
    tcgplayer,
    decks,
    versions,
    rulings,
  ]);
  return {
    prices: [market, cheapest, onEbay].filter((price): price is CardPrice => Boolean(price)),
    illustrated: byArtist,
    printedWith: together ?? [],
    decks: publicDecks,
    versions: allVersions,
    rulings: cardRulings,
  };
}

// "Often printed with", from the anonymous print pairs in Supabase (public read function, the site's public key).
// Without Supabase, or when it is slow, the section is simply left out.
async function printedWith(catalog: NativeCatalog, ids: number[]): Promise<CardInfo['printedWith']>
{
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return [];
  try
  {
    const response = await fetch(new URL('/rest/v1/rpc/printed_with', url), {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: catalog.game.id, cards: [...new Set(ids)], lim: 12 }),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return [];
    const rows = await response.json() as { card?: CatalogCard; together?: number }[];
    const valid = rows.filter(row =>
      row.card && typeof row.card.name === 'string' && typeof row.card.id === 'number'
      && typeof row.together === 'number'
    );
    // Linked to their card pages, in the order of how often they were printed together.
    const linked = new Map(
      (await linkPrintings(catalog, valid.map(row => row.card!))).map(item => [item.card.id, item]),
    );
    return valid.flatMap(row =>
    {
      const item = linked.get(row.card!.id);
      return item ? [{ ...item, together: row.together! }] : [];
    });
  }
  catch
  {
    return [];
  }
}
