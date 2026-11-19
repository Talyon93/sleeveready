// Games taken off the site, by their slug in shared/seo.ts: no catalogue, header tab, page, sitemap entry or kept card
// page, so their old addresses answer 404 and search engines drop them. Taking a game out of this list brings it back.
// Riftbound: Riot's policy allows its cards only through the Riot API, and the key for SleeveReady is still pending.
const offlineGames: { slug: string; pattern: RegExp }[] = [{ slug: 'riftbound', pattern: /riftbound/i }];

// Games whose card pages stay on the site but out of search engines (noindex, no card sitemap): from 4 October to
// 7 November their ~20,000 card pages earned about 1% of the site's impressions, and a mass of near-identical pages
// nobody searches for weighs on how Google rates the whole site. Their game and set pages stay indexed. Magic and
// Pokémon carry the card searches; Cyberpunk and Gundam have few pages and rising searches.
const unindexedCardGames = [
  'disney-lorcana',
  'star-wars-unlimited',
  'flesh-and-blood',
  'cardfight-vanguard',
  'union-arena',
  'one-piece',
  'digimon',
  'dragon-ball-super',
  'yu-gi-oh',
  'sorcery',
  'palworld',
];
export const cardPagesIndexed = (slug: string) => !unindexedCardGames.includes(slug);
// True for a card page path of such a game ("/en/disney-lorcana/<set>/<card>/" or its …/index.html file), with / or \
// separators; the set page (…/<set>/index.html) is not one.
export const unindexedCardPath = (path: string) =>
  unindexedCardGames.some(game =>
    new RegExp(`[\\\\/](?:en|it|de|fr|es)[\\\\/]${game}[\\\\/][^\\\\/]+[\\\\/][^\\\\/]+[\\\\/]`).test(path)
  );

// Takes a slug ("riftbound") or a game's name as the catalogues give it ("Riftbound").
export const gameOnline = (slugOrName: string) =>
  !offlineGames.some(game => game.slug === slugOrName || game.pattern.test(slugOrName));
// True for a site path inside an offline game ("/en/riftbound/…"), with / or \ separators.
export const offlineGamePath = (path: string) =>
  offlineGames.some(game => new RegExp(`[\\\\/](?:en|it|de|fr|es)[\\\\/]${game.slug}(?:[\\\\/]|$)`).test(path));
