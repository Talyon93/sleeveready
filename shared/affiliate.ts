// Shop searches for the original cards and sealed products, with the site's partner ids when configured: Amazon
// Associates (one tag per store), eBay Partner Network (one campaign, a rotation id per site), TCGplayer (Impact
// partner link) and CardTrader (extra query parameters). Without an id a link is a plain search; links carrying an
// id are marked rel="sponsored"; the affiliate disclosure is in the terms of use.
import type { SeoLanguage } from './seo.ts';

// English is read on both sides of the Atlantic: visitors in the UK and Europe get the UK stores, everyone else the US ones.
export type EnglishRegion = 'us' | 'uk';
export type AffiliateConfig = {
  amazon: Partial<Record<SeoLanguage, string>>;
  amazonUk: string | null;
  englishRegion: EnglishRegion;
  ebayCampaign: string | null;
  tcgplayerPartner: string | null;
  cardtraderParams: string | null;
};
// Build-time values (VITE_ variables are public: they end up in the links anyway).
export function affiliateConfig(
  env: Record<string, string | undefined>,
  englishRegion: EnglishRegion = 'us',
): AffiliateConfig
{
  const value = (key: string) => env[key]?.trim() || null;
  return {
    amazon: {
      en: value('VITE_AMAZON_TAG_COM') ?? undefined,
      it: value('VITE_AMAZON_TAG_IT') ?? undefined,
      de: value('VITE_AMAZON_TAG_DE') ?? undefined,
      fr: value('VITE_AMAZON_TAG_FR') ?? undefined,
      es: value('VITE_AMAZON_TAG_ES') ?? undefined,
    },
    amazonUk: value('VITE_AMAZON_TAG_UK'),
    englishRegion,
    ebayCampaign: value('VITE_EBAY_CAMPAIGN_ID'),
    tcgplayerPartner: value('VITE_TCGPLAYER_PARTNER'),
    cardtraderParams: value('VITE_CARDTRADER_PARAMS'),
  };
}
// In the browser: British or Irish English, or a European time zone, means the UK stores (closest, and they ship to the EU).
export function englishRegionOf(languages: readonly string[], timeZone: string): EnglishRegion
{
  return languages.some(language => /^en-(gb|uk|ie)$/i.test(language)) || /^Europe\//.test(timeZone) ? 'uk' : 'us';
}

// The store of the page language; for English the region picks the US or UK store.
const amazonHost: Record<SeoLanguage, string> = {
  en: 'www.amazon.com',
  it: 'www.amazon.it',
  de: 'www.amazon.de',
  fr: 'www.amazon.fr',
  es: 'www.amazon.es',
};
type EbaySite = { host: string; rotation: string; siteId: string };
const ebaySite: Record<SeoLanguage, EbaySite> = {
  en: { host: 'www.ebay.com', rotation: '711-53200-19255-0', siteId: '0' },
  it: { host: 'www.ebay.it', rotation: '724-53478-19255-0', siteId: '101' },
  de: { host: 'www.ebay.de', rotation: '707-53477-19255-0', siteId: '77' },
  fr: { host: 'www.ebay.fr', rotation: '709-53476-19255-0', siteId: '71' },
  es: { host: 'www.ebay.es', rotation: '1185-53479-19255-0', siteId: '186' },
};
const ebayUk: EbaySite = { host: 'www.ebay.co.uk', rotation: '710-53481-19255-0', siteId: '3' };

// Amazon store and tag for a page: UK English uses Amazon.co.uk when there is a UK tag, or when it is the only English tag.
function amazonStore(language: SeoLanguage, config: AffiliateConfig)
{
  if (language === 'en' && config.amazonUk && (config.englishRegion === 'uk' || !config.amazon.en))
  {
    return { host: 'www.amazon.co.uk', tag: config.amazonUk };
  }
  return { host: amazonHost[language], tag: config.amazon[language] ?? null };
}
export function amazonSearch(language: SeoLanguage, query: string, config: AffiliateConfig)
{
  const store = amazonStore(language, config);
  const url = new URL('/s', `https://${store.host}`);
  url.searchParams.set('k', query);
  if (store.tag) url.searchParams.set('tag', store.tag);
  return url.href;
}
// customId tells the eBay reports which placement earned the click (card or sealed).
export function ebaySearch(language: SeoLanguage, query: string, config: AffiliateConfig, customId: string)
{
  const site = language === 'en' && config.englishRegion === 'uk' ? ebayUk : ebaySite[language];
  const url = new URL('/sch/i.html', `https://${site.host}`);
  url.searchParams.set('_nkw', query);
  if (config.ebayCampaign)
  {
    for (const [key, value] of Object.entries({
      mkcid: '1',
      mkrid: site.rotation,
      siteid: site.siteId,
      campid: config.ebayCampaign,
      customid: customId,
      toolid: '10001',
      mkevt: '1',
    })) url.searchParams.set(key, value);
  }
  return url.href;
}
export function tcgplayerSearch(query: string, config: AffiliateConfig)
{
  const search = new URL('https://www.tcgplayer.com/search/all/product');
  search.searchParams.set('q', query);
  if (!config.tcgplayerPartner) return search.href;
  const partner = new URL(`https://partner.tcgplayer.com/${encodeURIComponent(config.tcgplayerPartner)}`);
  partner.searchParams.set('u', search.href);
  return partner.href;
}
export function cardtraderSearch(language: SeoLanguage, query: string, config: AffiliateConfig)
{
  const url = new URL(`https://www.cardtrader.com/${language}/search`);
  url.searchParams.set('q', query);
  for (const [key, value] of new URLSearchParams(config.cardtraderParams ?? '')) url.searchParams.set(key, value);
  return url.href;
}

export type ShopLink = { shop: string; url: string; sponsored: boolean };
// rel for a shop link: sponsored only when it carries a partner id.
export const shopRel = (link: ShopLink) => link.sponsored ? 'sponsored noopener' : 'noopener';
// Single cards search by English name, expansion and number: what every shop lists, whatever the page language.
export function singleCardShops(
  language: SeoLanguage,
  card: { name: string; set: string; number: string | null },
  config: AffiliateConfig,
): ShopLink[]
{
  const query = [card.name, card.set, card.number].filter(Boolean).join(' ');
  const short = [card.name, card.set].join(' ');
  return [
    { shop: 'eBay', url: ebaySearch(language, short, config, 'card'), sponsored: Boolean(config.ebayCampaign) },
    {
      shop: 'CardTrader',
      url: cardtraderSearch(language, card.name, config),
      sponsored: Boolean(config.cardtraderParams),
    },
    { shop: 'TCGplayer', url: tcgplayerSearch(query, config), sponsored: Boolean(config.tcgplayerPartner) },
  ];
}
export function sealedShops(
  language: SeoLanguage,
  product: { game: string; set: string },
  config: AffiliateConfig,
): ShopLink[]
{
  const query = `${product.game} ${product.set}`;
  return [
    {
      shop: 'Amazon',
      url: amazonSearch(language, query, config),
      sponsored: Boolean(amazonStore(language, config).tag),
    },
    { shop: 'eBay', url: ebaySearch(language, query, config, 'sealed'), sponsored: Boolean(config.ebayCampaign) },
  ];
}

// Game pages: the game's products in general ("Pokémon carte" on amazon.it).
const cardsWord: Record<SeoLanguage, string> = { en: 'cards', it: 'carte', de: 'Karten', fr: 'cartes', es: 'cartas' };
export function gameShops(language: SeoLanguage, game: string, config: AffiliateConfig): ShopLink[]
{
  const query = `${game} ${cardsWord[language]}`;
  return [
    {
      shop: 'Amazon',
      url: amazonSearch(language, query, config),
      sponsored: Boolean(amazonStore(language, config).tag),
    },
    { shop: 'eBay', url: ebaySearch(language, query, config, 'game'), sponsored: Boolean(config.ebayCampaign) },
  ];
}

export const shopCopy: Record<
  SeoLanguage,
  {
    title: string;
    sealedShort: string;
    game: (game: string) => string;
    singleShort: string;
    single: string;
    sealed: (set: string) => string;
  }
> = {
  en: {
    title: 'Buy the original',
    sealedShort: 'Sealed products',
    game: game => `${game} products`,
    singleShort: 'Single card',
    single: 'Find the original card',
    sealed: set => `Sealed products from ${set}`,
  },
  it: {
    title: "Compra l'originale",
    sealedShort: 'Prodotti sigillati',
    game: game => `Prodotti ${game}`,
    singleShort: 'Carta singola',
    single: 'Cerca la carta originale',
    sealed: set => `Prodotti sigillati di ${set}`,
  },
  de: {
    title: 'Original kaufen',
    sealedShort: 'Versiegelte Produkte',
    game: game => `${game}-Produkte`,
    singleShort: 'Einzelkarte',
    single: 'Originalkarte suchen',
    sealed: set => `Versiegelte Produkte von ${set}`,
  },
  fr: {
    title: 'Acheter l’original',
    sealedShort: 'Produits scellés',
    game: game => `Produits ${game}`,
    singleShort: 'Carte à l’unité',
    single: 'Trouver la carte originale',
    sealed: set => `Produits scellés de ${set}`,
  },
  es: {
    title: 'Comprar el original',
    sealedShort: 'Productos sellados',
    game: game => `Productos de ${game}`,
    singleShort: 'Carta suelta',
    single: 'Buscar la carta original',
    sealed: set => `Productos sellados de ${set}`,
  },
};

export const externalIcon =
  '<svg class="shop-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M6.5 3.5h-3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3"/></svg>';

// Beside the print sheet: sleeves for the proxies and booster packs of the game. Amazon searches in the page's store,
// so nothing goes stale when products change.
export type Accessory = 'sleeves' | 'boosters';
// Players search for "sleeves" in every language: the plain word finds card sleeves first.
const sleeveQuery: Record<SeoLanguage, string> = {
  en: 'sleeves',
  it: 'sleeves',
  de: 'sleeves',
  fr: 'sleeves',
  es: 'sleeves',
};
const boosterQuery: Record<SeoLanguage, (game: string) => string> = {
  en: game => `${game} booster packs`,
  it: game => `bustine ${game}`,
  de: game => `${game} Booster`,
  fr: game => `boosters ${game}`,
  es: game => `sobres ${game}`,
};
export function accessoryShops(
  language: SeoLanguage,
  game: string,
  config: AffiliateConfig,
): { item: Accessory; url: string; sponsored: boolean }[]
{
  const sponsored = Boolean(amazonStore(language, config).tag);
  return [
    { item: 'sleeves', url: amazonSearch(language, sleeveQuery[language], config), sponsored },
    { item: 'boosters', url: amazonSearch(language, boosterQuery[language](game), config), sponsored },
  ];
}
