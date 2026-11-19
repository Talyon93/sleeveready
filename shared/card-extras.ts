import type { CardFormat, CardPrice } from './model.ts';
import type { SeoLanguage } from './seo.ts';
import { shopRel, type ShopLink } from './affiliate.ts';

// Card page sections around the card itself: price guide, cards printed with it and official rulings.
type ExtrasCopy = {
  prices: string;
  priceNote: (date: string) => string;
  market: Record<CardPrice['market'], string>;
  from: string;
  foil: string;
  search: string;
  printedWith: string;
  printedWithNote: string;
  together: (sheets: number) => string;
  rulings: string;
  formats: string;
  status: Record<CardFormat['status'], string>;
  formatsNote: string;
};
export const cardExtrasCopy: Record<SeoLanguage, ExtrasCopy> = {
  en: {
    formats: 'Formats',
    status: {
      legal: 'Legal',
      not_legal: 'Not legal',
      banned: 'Banned',
      restricted: 'Restricted',
      limited: 'Limited',
      semi_limited: 'Semi-limited',
    },
    formatsNote:
      'Status of the original card. Proxies are for playtesting and casual games; sanctioned tournaments require the original.',
    prices: 'Price guide',
    priceNote: date => `Indicative prices, ${date} · proxies are for playtesting`,
    market: {
      TCGplayer: 'market price',
      Cardmarket: 'price trend',
      CardTrader: 'cheapest listing',
      eBay: 'cheapest Buy It Now',
    },
    from: 'from',
    foil: 'foil',
    search: 'Search',
    printedWith: 'Often printed with',
    printedWithNote: 'Cards that shared a print sheet with this one on SleeveReady, counted anonymously.',
    together: sheets => `${sheets} sheets`,
    rulings: 'Rulings',
  },
  it: {
    formats: 'Formati',
    status: {
      legal: 'Legale',
      not_legal: 'Non legale',
      banned: 'Bandita',
      restricted: 'Ristretta',
      limited: 'Limitata',
      semi_limited: 'Semi-limitata',
    },
    formatsNote:
      'Stato della carta originale. I proxy servono per il playtest e le partite tra amici; nei tornei ufficiali serve l’originale.',
    prices: 'Prezzi indicativi',
    priceNote: date => `Prezzi indicativi al ${date} · i proxy sono per il playtest`,
    market: {
      TCGplayer: 'prezzo di mercato',
      Cardmarket: 'andamento prezzo',
      CardTrader: 'offerta più bassa',
      eBay: 'Compralo Subito più basso',
    },
    from: 'da',
    foil: 'foil',
    search: 'Cerca',
    printedWith: 'Spesso stampata con',
    printedWithNote: 'Carte finite sullo stesso foglio di stampa di questa su SleeveReady, contate in forma anonima.',
    together: sheets => `${sheets} fogli`,
    rulings: 'Ruling',
  },
  de: {
    formats: 'Formate',
    status: {
      legal: 'Legal',
      not_legal: 'Nicht legal',
      banned: 'Gebannt',
      restricted: 'Eingeschränkt',
      limited: 'Limitiert',
      semi_limited: 'Semi-limitiert',
    },
    formatsNote:
      'Status der Originalkarte. Proxys sind zum Testen und für Freundesrunden; offizielle Turniere verlangen das Original.',
    prices: 'Preisübersicht',
    priceNote: date => `Richtpreise, Stand ${date} · Proxys sind zum Testen`,
    market: {
      TCGplayer: 'Marktpreis',
      Cardmarket: 'Preistrend',
      CardTrader: 'günstigstes Angebot',
      eBay: 'günstigstes Sofort-Kaufen',
    },
    from: 'ab',
    foil: 'Foil',
    search: 'Suchen',
    printedWith: 'Oft gedruckt mit',
    printedWithNote: 'Karten, die auf SleeveReady mit dieser auf einem Druckbogen standen, anonym gezählt.',
    together: sheets => `${sheets} Bögen`,
    rulings: 'Regelhinweise',
  },
  fr: {
    formats: 'Formats',
    status: {
      legal: 'Légale',
      not_legal: 'Non légale',
      banned: 'Bannie',
      restricted: 'Restreinte',
      limited: 'Limitée',
      semi_limited: 'Semi-limitée',
    },
    formatsNote:
      'Statut de la carte originale. Les proxys servent aux tests et aux parties entre amis ; les tournois officiels exigent l’original.',
    prices: 'Guide des prix',
    priceNote: date => `Prix indicatifs au ${date} · les proxys servent aux tests`,
    market: {
      TCGplayer: 'prix du marché',
      Cardmarket: 'tendance',
      CardTrader: 'offre la moins chère',
      eBay: 'Achat immédiat le moins cher',
    },
    from: 'dès',
    foil: 'foil',
    search: 'Rechercher',
    printedWith: 'Souvent imprimée avec',
    printedWithNote: 'Cartes imprimées sur la même feuille que celle-ci sur SleeveReady, comptées anonymement.',
    together: sheets => `${sheets} feuilles`,
    rulings: 'Règles',
  },
  es: {
    formats: 'Formatos',
    status: {
      legal: 'Legal',
      not_legal: 'No legal',
      banned: 'Prohibida',
      restricted: 'Restringida',
      limited: 'Limitada',
      semi_limited: 'Semilimitada',
    },
    formatsNote:
      'Estado de la carta original. Los proxies son para probar y jugar con amigos; los torneos oficiales exigen el original.',
    prices: 'Guía de precios',
    priceNote: date => `Precios orientativos al ${date} · los proxies son para probar`,
    market: {
      TCGplayer: 'precio de mercado',
      Cardmarket: 'tendencia',
      CardTrader: 'oferta más barata',
      eBay: 'Cómpralo ya más barato',
    },
    from: 'desde',
    foil: 'foil',
    search: 'Buscar',
    printedWith: 'Impresa a menudo con',
    printedWithNote: 'Cartas que compartieron hoja de impresión con esta en SleeveReady, contadas de forma anónima.',
    together: sheets => `${sheets} hojas`,
    rulings: 'Rulings',
  },
};

const localeOf: Record<SeoLanguage, string> = { en: 'en-US', it: 'it-IT', de: 'de-DE', fr: 'fr-FR', es: 'es-ES' };
export const formatPrice = (language: SeoLanguage, price: CardPrice) =>
  new Intl.NumberFormat(localeOf[language], {
    style: 'currency',
    currency: price.currency,
    currencyDisplay: 'narrowSymbol',
  })
    .format(price.amount);
export const formatDay = (language: SeoLanguage, day: string, month: 'long' | 'short' = 'long') =>
  new Date(day.slice(0, 10) + 'T12:00:00Z').toLocaleDateString(localeOf[language], {
    day: 'numeric',
    month,
    year: 'numeric',
    timeZone: 'UTC',
  });

// The single-card shops as buttons, each with its price when a source gives one (priced shops first), the others
// as a plain search. Prices of shops without a button are not shown.
export type ShopTile = { shop: string; url: string; rel: string; value: string; priced: boolean; foil: boolean };
export function shopTiles(language: SeoLanguage, prices: CardPrice[], links: ShopLink[]): ShopTile[]
{
  const copy = cardExtrasCopy[language];
  const order = ['TCGplayer', 'CardTrader'];
  return links
    .map(link =>
    {
      const price = prices.find(item => item.market === link.shop);
      return {
        shop: link.shop,
        url: link.url,
        rel: shopRel(link),
        value: price ? `${price.from ? copy.from + ' ' : ''}${formatPrice(language, price)}` : copy.search,
        priced: Boolean(price),
        foil: Boolean(price?.foil),
      };
    })
    .sort((a, b) =>
      Number(b.priced) - Number(a.priced) || (order.indexOf(a.shop) + 1 || 9) - (order.indexOf(b.shop) + 1 || 9)
    );
}
// Prices shown on the page: only those of shops with a button (no Cardmarket).
export const shownPrices = (prices: CardPrice[]) => prices.filter(price => price.market !== 'Cardmarket');
// The median of the five lowest asking prices: one stray bargain (a damaged copy, another language) does not set
// the price shown, while it stays a price people actually ask. Values must be sorted from lowest.
export function lowMedian(sorted: number[])
{
  const low = sorted.slice(0, 5);
  if (!low.length) return null;
  const middle = Math.floor(low.length / 2);
  return low.length % 2 ? low[middle] : (low[middle - 1] + low[middle]) / 2;
}
export const latestPriceDay = (prices: CardPrice[]) => prices.map(price => price.updated).sort().at(-1) ?? '';
