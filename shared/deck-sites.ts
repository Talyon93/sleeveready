import type { SeoGameSlug, SeoLanguage } from './seo.ts';

// Where players publish decks with a card: links to the card's own page or search on those sites, never their data.
export type DeckSite = { site: string; url: string };

// EDHREC's card addresses: the front face's English name, lower case, accents and punctuation dropped, spaces as dashes.
export const edhrecSlug = (name: string) =>
  name
    .split(' // ')[0]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’,.!?:"()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function deckSites(game: SeoGameSlug, card: { englishName: string; number: string | null }): DeckSite[]
{
  const name = card.englishName.split(' // ')[0].trim();
  if (!name) return [];
  if (game === 'magic-the-gathering')
  {
    return [
      { site: 'EDHREC', url: `https://edhrec.com/cards/${edhrecSlug(name)}` },
      {
        site: 'MTGTop8',
        url: `https://www.mtgtop8.com/search?MD_check=1&SB_check=1&cards=${encodeURIComponent(name)}`,
      },
    ];
  }
  if (game === 'pokemon')
  {
    return [{ site: 'Limitless', url: `https://limitlesstcg.com/cards?q=${encodeURIComponent(name)}` }];
  }
  // One Piece card numbers (OP01-016) are Limitless's card addresses; parallels share the base card's page.
  if (game === 'one-piece' && card.number && /^[A-Z]{2,4}\d{0,2}-\d{3}/i.test(card.number))
  {
    return [{
      site: 'Limitless',
      url: `https://onepiece.limitlesstcg.com/cards/${
        encodeURIComponent(card.number.replace(/_.*$/, '').toUpperCase())
      }`,
    }];
  }
  return [];
}

export const deckSitesCopy: Record<
  SeoLanguage,
  { title: string; hint: string; source: string; more: string; views: (count: string) => string }
> = {
  en: {
    title: 'Decks with this card',
    hint: 'Tournament and community decklists that play it, on',
    source: 'Most viewed public decks on Archidekt',
    more: 'More decks on',
    views: count => `${count} views`,
  },
  it: {
    title: 'Mazzi con questa carta',
    hint: 'Liste da torneo e della community che la giocano, su',
    source: 'I mazzi pubblici più visti su Archidekt',
    more: 'Altri mazzi su',
    views: count => `${count} visualizzazioni`,
  },
  de: {
    title: 'Decks mit dieser Karte',
    hint: 'Turnier- und Community-Decklisten, die sie spielen, auf',
    source: 'Die meistgesehenen öffentlichen Decks auf Archidekt',
    more: 'Weitere Decks auf',
    views: count => `${count} Aufrufe`,
  },
  fr: {
    title: 'Decks avec cette carte',
    hint: 'Listes de tournoi et de la communauté qui la jouent, sur',
    source: 'Les decks publics les plus vus sur Archidekt',
    more: 'Plus de decks sur',
    views: count => `${count} vues`,
  },
  es: {
    title: 'Mazos con esta carta',
    hint: 'Listas de torneo y de la comunidad que la juegan, en',
    source: 'Los mazos públicos más vistos en Archidekt',
    more: 'Más mazos en',
    views: count => `${count} visitas`,
  },
};
const numberLocale: Record<SeoLanguage, string> = { en: 'en-US', it: 'it-IT', de: 'de-DE', fr: 'fr-FR', es: 'es-ES' };
// 2,987 → "3K", 11,300 → "11.3K": written out here, since engines disagree on compact notation per language.
const compact = (language: SeoLanguage, value: number) =>
  value >= 1000
    ? new Intl.NumberFormat(numberLocale[language], { maximumFractionDigits: 1 }).format(Math.round(value / 100) / 10)
      + 'K'
    : String(value);
export const deckMeta = (language: SeoLanguage, deck: { format: string | null; owner: string | null; views: number }) =>
  [deck.format, deck.owner, deckSitesCopy[language].views(compact(language, deck.views))].filter(Boolean).join(' · ');
