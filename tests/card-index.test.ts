import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  indexedCardPaths,
  pageLanguagesOf,
  refreshCardIndex,
  searchIndex,
  type GameIndex,
  type IndexStore,
} from '../server/card-index.ts';
import type { NativeCatalog } from '../server/native-source.ts';
import type { CardExpansion, CatalogCard } from '../shared/model.ts';

const memoryStore = () =>
{
  const data = new Map<string, GameIndex>();
  const store: IndexStore = {
    get: async game => structuredClone(data.get(game)) ?? null,
    set: async index =>
    {
      data.set(index.game, structuredClone(index));
    },
  };
  return { store, data };
};
const card = (id: number, name: string, number: string, expansionId: number): CatalogCard => ({
  id,
  gameId: 1,
  categoryId: 1,
  expansionId,
  name,
  version: null,
  collectorNumber: number,
  rarity: null,
  language: 'en',
  imageUrl: null,
});
const catalog = (
  name: string,
  displayName: string,
  sets: CardExpansion[],
  cards: Record<number, CatalogCard[]>,
  calls: number[],
  fail = new Set<number>(),
): NativeCatalog => ({
  game: { id: 1, name, displayName, printLanguages: ['en', 'it'] },
  isExpansionId: () => true,
  sets: async () => ({ data: sets, updatedAt: '' }),
  cards: async (id) =>
  {
    calls.push(id);
    if (fail.has(id)) throw new Error('source down');
    return { data: cards[id] ?? [], updatedAt: '' };
  },
  languages: async (id) => ({ data: id === 11 ? ['en', 'it', 'ja'] : ['en'], updatedAt: '' }),
});

test('card index: new sets first, rotating between games, within budget, resuming on the next run', async () =>
{
  const pokemonSets = [
    { id: 11, gameId: 1, code: 'ME05', name: 'Pitch Black', releaseDate: '2026-09-01' },
    { id: 12, gameId: 1, code: 'SV06', name: 'Twilight Masquerade', releaseDate: '2024-05-24' },
    { id: 13, gameId: 1, code: 'FUT', name: 'Future', releaseDate: '2099-01-01' },
  ];
  const lorcanaSets = [
    { id: 21, gameId: 1, code: '10', name: 'Whispers in the Well', releaseDate: '2025-08-01' },
    { id: 22, gameId: 1, code: '10', name: 'Whispers in the Well', releaseDate: '2025-08-01' },
  ];
  const calls: number[] = [];
  const pokemon = catalog('Pokemon', 'Pokémon', pokemonSets, {
    11: [card(1, 'Poltchageist', '005', 11), card(2, 'Sinistcha', '006', 11)],
    12: [card(3, 'Poltchageist', '020', 12)],
  }, calls);
  const lorcana = catalog(
    'Lorcana',
    'Disney Lorcana',
    lorcanaSets,
    { 21: [card(4, 'Elsa - Snow Queen', '53', 21)] },
    calls,
  );
  const { store, data } = memoryStore();
  let clock = Date.parse('2026-10-02T10:00:00Z');
  const now = () => clock;
  // Each indexed expansion costs 5 s of a 6 s budget: the first run fits two (one per game, round robin).
  const slow: NativeCatalog[] = [pokemon, lorcana].map(item => ({
    ...item,
    cards: async (id, language) =>
    {
      const result = await item.cards(id, language);
      clock += 5000;
      return result;
    },
  }));
  const first = await refreshCardIndex(slow, store, { budgetMs: 6000, now });
  assert.deepEqual(calls, [11, 21]);
  assert.equal(first.stopped, 'budget');
  assert.equal(first.indexed, 2);
  const pokemonIndex = data.get('pokemon')!;
  assert.deepEqual(pokemonIndex.known.map(set => set.id), [11, 12], 'future expansions wait for their release');
  assert.deepEqual(
    data.get('disney-lorcana')!.known.map(set => set.id),
    [21],
    'a repeated slug keeps the first expansion, as card pages do',
  );
  assert.deepEqual(pokemonIndex.sets[0].cards, [['005', 'Poltchageist', '005'], ['006', 'Sinistcha', '006']]);
  assert.deepEqual(pokemonIndex.sets[0].languages, ['en', 'it', 'ja']);
  const second = await refreshCardIndex(slow, store, { budgetMs: 6000, now });
  assert.deepEqual(calls.slice(2), [12]);
  assert.equal(second.stopped, 'done');
  assert.deepEqual(data.get('pokemon')!.sets.map(set => set.id), [11, 12]);
  // A week later the stalest expansions come back; the expansion list itself is re-read every six hours.
  clock += 8 * 86_400_000;
  calls.length = 0;
  await refreshCardIndex([pokemon, lorcana], store, { budgetMs: 60_000, now });
  assert.deepEqual(calls.sort(), [11, 12, 21]);
});

test('card index: sets coming within three months get pages for revealed cards, re-read daily', async () =>
{
  const sets = [
    { id: 41, gameId: 1, code: 'NXT', name: 'Next Wave', releaseDate: '2026-11-01' },
    { id: 42, gameId: 1, code: 'FAR', name: 'Far Away', releaseDate: '2027-06-01' },
    { id: 43, gameId: 1, code: 'OLD', name: 'Old Wave', releaseDate: '2026-01-10' },
  ];
  const calls: number[] = [];
  const cards: Record<number, CatalogCard[]> = {
    41: [card(6, 'Spoiled One', '001', 41)],
    43: [card(7, 'Old One', '001', 43)],
  };
  const pokemon = catalog('Pokemon', 'Pokémon', sets, cards, calls);
  const { store, data } = memoryStore();
  let clock = Date.parse('2026-10-02T10:00:00Z');
  const now = () => clock;
  await refreshCardIndex([pokemon], store, { budgetMs: 60_000, now });
  assert.deepEqual(
    data.get('pokemon')!.known.map(set => set.id),
    [41, 43],
    'coming within 90 days: yes; next year: not yet',
  );
  const { recentCardPaths } = await import('../server/card-index.ts');
  assert.ok(
    recentCardPaths(data.get('pokemon')!, clock).includes('/en/pokemon/nxt/001/'),
    'its revealed cards go in the sitemap',
  );
  // A day later more cards are out: the coming set is read again, the old one waits for its week.
  cards[41] = [...cards[41], card(8, 'Spoiled Two', '002', 41)];
  clock += 86_400_000 + 3_600_000;
  calls.length = 0;
  await refreshCardIndex([pokemon], store, { budgetMs: 60_000, now });
  assert.deepEqual(calls, [41]);
  assert.equal(data.get('pokemon')!.sets.find(set => set.id === 41)!.cards.length, 2);
});

test('card index: a released set still without images is re-read daily, even after two weeks', async () =>
{
  const sets = [
    { id: 51, gameId: 1, code: 'ME06', name: 'Delta Reign', releaseDate: '2026-11-06' },
    { id: 52, gameId: 1, code: 'ME05', name: 'Pitch Black', releaseDate: '2026-07-17' },
  ];
  const calls: number[] = [];
  const cards: Record<number, CatalogCard[]> = { 52: [card(9, 'Old One', '001', 52)] };
  const pokemon = catalog('Pokemon', 'Pokémon', sets, cards, calls);
  const { store, data } = memoryStore();
  let clock = Date.parse('2026-11-25T10:00:00Z');
  const now = () => clock;
  await refreshCardIndex([pokemon], store, { budgetMs: 60_000, now });
  assert.equal(data.get('pokemon')!.sets.find(set => set.id === 51)!.cards.length, 0);
  cards[51] = [card(10, 'Heracross', '001', 51)];
  clock += 86_400_000 + 3_600_000;
  calls.length = 0;
  await refreshCardIndex([pokemon], store, { budgetMs: 60_000, now });
  assert.deepEqual(calls, [51], 'the empty set is read again the next day, the full one waits for its week');
  assert.equal(data.get('pokemon')!.sets.find(set => set.id === 51)!.cards.length, 1);
});

test('sitemap: new sets missing from the snapshot, in every language they are printed in', async () =>
{
  const { liveSetPaths } = await import('../server/live-sets.ts');
  const sets = [{ id: 11, gameId: 1, code: 'ZZ9', name: 'Brand New Wave', releaseDate: '2026-10-20' }];
  const pokemon = catalog('Pokemon', 'Pokémon', sets, {
    11: Array.from({ length: 25 }, (_, index) => card(100 + index, 'Card ' + index, String(index), 11)),
  }, []);
  const paths = await liveSetPaths([pokemon], 2000, Date.parse('2026-10-28T12:00:00Z'));
  assert.deepEqual(paths, ['/en/pokemon/zz9/', '/it/pokemon/zz9/']);
});

test('card index: a failing set keeps its known cards and retries after a day', async () =>
{
  const sets = [{ id: 31, gameId: 1, code: 'OP13', name: 'Carrying On His Will', releaseDate: '2025-11-07' }];
  const calls: number[] = [];
  const fail = new Set<number>();
  const onePiece = catalog(
    'One Piece',
    'One Piece Card Game',
    sets,
    { 31: [card(5, 'Monkey.D.Luffy', 'OP13-001', 31)] },
    calls,
    fail,
  );
  const { store, data } = memoryStore();
  let clock = Date.parse('2026-10-02T10:00:00Z');
  const now = () => clock;
  await refreshCardIndex([onePiece], store, { budgetMs: 60_000, now });
  clock += 8 * 86_400_000;
  fail.add(31);
  const failed = await refreshCardIndex([onePiece], store, { budgetMs: 60_000, now });
  assert.equal(failed.failed, 1);
  assert.deepEqual(data.get('one-piece')!.sets[0].cards, [['op13-001', 'Monkey.D.Luffy', 'OP13-001']]);
  calls.length = 0;
  clock += 3_600_000;
  await refreshCardIndex([onePiece], store, { budgetMs: 60_000, now });
  assert.deepEqual(calls, [], 'no retry within the day');
  clock += 86_400_000;
  fail.clear();
  await refreshCardIndex([onePiece], store, { budgetMs: 60_000, now });
  assert.deepEqual(calls, [31]);
});

test('name search: words in any order, exact matches first, printings grouped, pages in printed languages', () =>
{
  const index: GameIndex = {
    game: 'pokemon',
    known: [],
    setsCheckedAt: null,
    sets: [
      {
        id: 11,
        slug: 'me05',
        code: 'ME05',
        name: 'Pitch Black',
        releaseDate: '2026-09-01',
        languages: ['en', 'it', 'pt-br'],
        cards: [['005', 'Poltchageist', '005'], ['130', 'Salamence ex', '130']],
        refreshedAt: '',
      },
      {
        id: 12,
        slug: 'sv06',
        code: 'SV06',
        name: 'Twilight Masquerade',
        releaseDate: '2024-05-24',
        languages: ['en'],
        cards: [
          ['020', 'Poltchageist', '020'],
          ['021', 'Poltchageist', '021'],
          ['050', 'Dark Poltchageist Crew', '050'],
        ],
        refreshedAt: '',
      },
    ],
  };
  const found = searchIndex(index, 'poltchageist');
  assert.equal(found.total, 2);
  assert.equal(found.results[0].name, 'Poltchageist');
  assert.deepEqual(found.results[0].printings.map(item => `${item.set}/${item.slug}×${item.count}`), [
    'me05/005×1',
    'sv06/020×2',
  ]);
  assert.equal(found.results[1].name, 'Dark Poltchageist Crew');
  assert.deepEqual(searchIndex(index, 'EX salamence').results.map(item => item.name), ['Salamence ex']);
  assert.equal(searchIndex(index, ' ').total, 0);
  assert.equal(searchIndex(index, 'zz').total, 0);
  assert.deepEqual(pageLanguagesOf(['en', 'it', 'pt-br', 'ja']), ['en', 'it']);
  assert.deepEqual(indexedCardPaths({ ...index, sets: [index.sets[0]] }), [
    '/en/pokemon/me05/005/',
    '/en/pokemon/me05/130/',
    '/it/pokemon/me05/005/',
    '/it/pokemon/me05/130/',
  ]);
});

test('illustrator pages: exact name from the slug, newest cards first, hreflang and 404', async () =>
{
  const { renderArtistPage } = await import('../server/artist-pages.ts');
  const sets = [
    { id: 11, gameId: 1, code: 'ME05', name: 'Pitch Black', releaseDate: '2026-09-01' },
    { id: 12, gameId: 1, code: 'SV06', name: 'Twilight Masquerade', releaseDate: '2024-05-24' },
  ];
  const byArtist = [card(2, 'Golbat', '050', 12), card(1, 'Poltchageist', '005', 11), card(3, 'Ghost', '001', 99)];
  const pokemon: NativeCatalog = {
    ...catalog('Pokemon', 'Pokémon', sets, {}, []),
    illustrators: async () => ['Mousho', '5ban Graphics'],
    byIllustrator: async artist => artist === 'Mousho' ? byArtist : [],
  };
  const wiki = async () => ({
    id: 'Q1',
    country: { it: 'Giappone', en: 'Japan' },
    website: 'https://www.mousho.example/gallery',
    wikipedia: { en: 'https://en.wikipedia.org/wiki/Mousho_(artist)' },
  });
  const page = await renderArtistPage(
    { language: 'it', game: 'pokemon', artist: 'mousho' },
    [pokemon],
    'https://sleeveready.example',
    false,
    wiki,
  );
  assert.equal(page.status, 200);
  if (page.status !== 200) return;
  assert.match(page.html, /<title>Mousho: 2 carte Pokémon illustrate \| SleeveReady<\/title>/);
  assert.match(
    page.html,
    /<meta name="robots" content="noindex,follow"\/>/,
    'an illustrator with fewer than 5 cards stays out of search engines',
  );
  assert.match(
    page.html,
    /<p class="artist-intro">2 carte Pokémon illustrate da Mousho, da Twilight Masquerade a Pitch Black\./,
    'expansions outside the catalogue are left out',
  );
  assert.deepEqual([...page.html.matchAll(/class="cp-tile" href="([^"]+)"/g)].map(match => match[1]), [
    '/it/pokemon/me05/005/',
    '/it/pokemon/sv06/050/',
  ]);
  assert.match(
    page.html,
    /<link rel="alternate" hreflang="de" href="https:\/\/sleeveready\.example\/de\/pokemon\/illustratoren\/mousho\/"\/>/,
  );
  assert.ok(page.html.includes('"@type":"Person","name":"Mousho","nationality":{"@type":"Country","name":"Japan"}'));
  assert.ok(page.html.includes('<dt>Anni di uscita</dt><dd>2024–2026</dd>'));
  assert.ok(page.html.includes('<dt>Espansioni</dt><dd>2</dd>'));
  assert.ok(page.html.includes('<dt>Nazionalità</dt><dd>Giappone</dd>'));
  assert.ok(
    page.html.includes('<a href="https://www.mousho.example/gallery" rel="nofollow noopener">mousho.example</a>'),
  );
  assert.ok(page.html.includes('>Mousho (artist)</a>'));
  assert.ok(page.html.includes('class="artist-source"'));
  assert.ok(!page.html.includes('Colori più illustrati'), 'no Magic rows for Pokémon');
  assert.equal(
    (await renderArtistPage(
      { language: 'it', game: 'pokemon', artist: 'nobody' },
      [pokemon],
      'https://sleeveready.example',
      false,
      async () => null,
    ))
      .status,
    404,
  );
  assert.equal(
    (await renderArtistPage(
      { language: 'it', game: 'pokemon', artist: '5ban-graphics' },
      [pokemon],
      'https://sleeveready.example',
      false,
      async () => null,
    ))
      .status,
    404,
    'an artist without cards has no page',
  );
});

test('artist profile: Magic colours and types only with a large enough sample, rares and mythics', async () =>
{
  const { artistStats } = await import('../server/artist-profile.ts');
  const printing = (set: string, colors: string[], typeLine: string, rarity: string) => ({
    card: { ...card(1, 'X', '1', 1), colors, typeLine, rarity },
    set,
    setName: set.toUpperCase(),
    setCode: null,
    slug: '1',
  });
  const cards = [
    printing('a', ['G'], 'Creature — Elf', 'rare'),
    printing('a', ['G'], 'Creature — Elf', 'common'),
    printing('a', ['G', 'B'], 'Legendary Creature — Elf', 'mythic'),
    printing('b', ['B'], 'Instant', 'uncommon'),
    printing('b', [], 'Artifact', 'common'),
    printing('c', ['G'], 'Sorcery', 'common'),
  ];
  const stats = artistStats(cards, new Map([['a', '2019-07-12'], ['b', '2021-02-05'], ['c', '2026-01-01']]));
  assert.deepEqual(stats, {
    firstYear: 2019,
    lastYear: 2026,
    sets: 3,
    topSet: { name: 'A', count: 3 },
    colours: ['G', 'B'],
    type: 'Creature',
    rares: 2,
  });
  assert.deepEqual(
    artistStats(cards, new Map([['c', '2026-01-01']])).firstYear,
    null,
    'years need every expansion dated',
  );
  const few = artistStats(cards.slice(0, 3), new Map());
  assert.deepEqual(
    [few.colours, few.type, few.topSet],
    [[], null, null],
    'under 5 cards no colour or type; one set has no top set',
  );
});

test('Wikidata: only an exact namesake with an artistic occupation, otherwise nothing', async () =>
{
  const { wikidataProfile } = await import('../server/artist-profile.ts');
  const occupation = (id: string) => ({ mainsnak: { datavalue: { value: { id } } } });
  const reply = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  const transport = (entities: Record<string, unknown>, labels: string[]) =>
    (async (input: URL | RequestInfo) =>
    {
      const url = new URL(String(input));
      if (url.searchParams.get('action') === 'wbsearchentities')
      {
        return reply({ search: labels.map((label, index) => ({ id: 'Q' + (index + 1), label })) });
      }
      if (url.searchParams.get('props') === 'labels')
      {
        return reply({
          entities: { Q30: { id: 'Q30', labels: { it: { value: 'Stati Uniti' }, en: { value: 'United States' } } } },
        });
      }
      return reply({ entities });
    }) as typeof fetch;
  const painter = {
    id: 'Q1',
    claims: {
      P106: [occupation('Q1028181')],
      P27: [occupation('Q30')],
      P856: [{ mainsnak: { datavalue: { value: 'https://example.com' } } }],
    },
    sitelinks: {
      enwiki: { url: 'https://en.wikipedia.org/wiki/Test_Artist' },
      itwiki: { url: 'https://evil.example/wiki/x' },
    },
  };
  const researcher = { id: 'Q2', claims: { P106: [occupation('Q1650915')] } };
  assert.deepEqual(
    await wikidataProfile('Test Artist', transport({ Q1: painter, Q2: researcher }, ['Test Artist', 'Test Artist'])),
    {
      id: 'Q1',
      country: { it: 'Stati Uniti', en: 'United States' },
      website: 'https://example.com',
      wikipedia: { en: 'https://en.wikipedia.org/wiki/Test_Artist' },
    },
  );
  assert.equal(
    await wikidataProfile(
      'Two Painters',
      transport({ Q1: painter, Q2: { ...painter, id: 'Q2' } }, ['Two Painters', 'Two Painters']),
    ),
    null,
    'two artists with the name: ambiguous',
  );
  assert.equal(await wikidataProfile('Only Researcher', transport({ Q2: researcher }, ['Only Researcher'])), null);
  assert.equal(await wikidataProfile('Nobody Here', transport({}, ['Somebody Else'])), null);
});

test('shop links: plain searches without ids, partner ids per shop and language when configured', async () =>
{
  const { affiliateConfig, sealedShops, singleCardShops } = await import('../shared/affiliate.ts');
  const plain = affiliateConfig({});
  assert.deepEqual(
    singleCardShops('it', { name: 'Poltchageist', set: 'Pitch Black', number: '005' }, plain).map(link => link.url),
    [
      'https://www.ebay.it/sch/i.html?_nkw=Poltchageist+Pitch+Black',
      'https://www.cardtrader.com/it/search?q=Poltchageist',
      'https://www.tcgplayer.com/search/all/product?q=Poltchageist+Pitch+Black+005',
    ],
  );
  const partner = affiliateConfig({
    VITE_AMAZON_TAG_IT: 'sleeveready-21',
    VITE_AMAZON_TAG_COM: 'sleeveready-20',
    VITE_EBAY_CAMPAIGN_ID: '5338000000',
    VITE_TCGPLAYER_PARTNER: 'sleeveready',
    VITE_CARDTRADER_PARAMS: 'share_code=abc',
  });
  const [amazon, ebay] = sealedShops('it', { game: 'Pokémon', set: 'Pitch Black' }, partner);
  assert.equal(amazon.url, 'https://www.amazon.it/s?k=Pok%C3%A9mon+Pitch+Black&tag=sleeveready-21');
  const ebayUrl = new URL(ebay.url);
  assert.equal(ebayUrl.host, 'www.ebay.it');
  assert.deepEqual(['campid', 'mkrid', 'siteid', 'customid'].map(key => ebayUrl.searchParams.get(key)), [
    '5338000000',
    '724-53478-19255-0',
    '101',
    'sealed',
  ]);
  assert.match(
    sealedShops('en', { game: 'Magic: The Gathering', set: 'Foundations' }, partner)[0].url,
    /^https:\/\/www\.amazon\.com\/s\?k=.*&tag=sleeveready-20$/,
  );
  // English splits by region: US visitors get Amazon.com and eBay.com, UK and European ones Amazon.co.uk and eBay.co.uk.
  const product = { game: 'Pokémon', set: 'Ascended Heroes' };
  const both = { VITE_AMAZON_TAG_COM: 'us-20', VITE_AMAZON_TAG_UK: 'uk-21', VITE_EBAY_CAMPAIGN_ID: '5339170231' };
  const [usAmazon, usEbay] = sealedShops('en', product, affiliateConfig(both, 'us'));
  assert.match(usAmazon.url, /^https:\/\/www\.amazon\.com\/s\?k=.*&tag=us-20$/);
  assert.match(usEbay.url, /^https:\/\/www\.ebay\.com\/.*siteid=0/);
  const [ukAmazon, ukEbay] = sealedShops('en', product, affiliateConfig(both, 'uk'));
  assert.match(ukAmazon.url, /^https:\/\/www\.amazon\.co\.uk\/s\?k=.*&tag=uk-21$/);
  assert.ok(ukAmazon.sponsored);
  assert.match(ukEbay.url, /^https:\/\/www\.ebay\.co\.uk\/.*mkrid=710-53481-19255-0.*siteid=3/);
  // Only a UK tag: English pages go to Amazon.co.uk with it wherever the visitor is; other languages keep their own store.
  assert.match(
    sealedShops('en', product, affiliateConfig({ VITE_AMAZON_TAG_UK: 'uk-21' }, 'us'))[0].url,
    /^https:\/\/www\.amazon\.co\.uk\/s\?k=.*&tag=uk-21$/,
  );
  assert.match(
    sealedShops('it', product, affiliateConfig({ VITE_AMAZON_TAG_UK: 'uk-21' }, 'uk'))[0].url,
    /^https:\/\/www\.amazon\.it\/s\?k=[^&]*$/,
  );
  const { englishRegionOf } = await import('../shared/affiliate.ts');
  assert.equal(englishRegionOf(['en-GB'], 'America/New_York'), 'uk');
  assert.equal(englishRegionOf(['en-US'], 'Europe/Rome'), 'uk');
  assert.equal(englishRegionOf(['en-US', 'en'], 'America/Chicago'), 'us');
  assert.equal(englishRegionOf([], 'Asia/Tokyo'), 'us');
  assert.doesNotMatch(
    sealedShops('de', { game: 'Pokémon', set: 'Pitch Black' }, partner)[0].url,
    /tag=/,
    'no tag for a store without one',
  );
  assert.deepEqual(
    singleCardShops('it', { name: 'X', set: 'Y', number: null }, affiliateConfig({ VITE_EBAY_CAMPAIGN_ID: '1' })).map(
      link => link.sponsored,
    ),
    [true, false, false],
    'only links with a partner id are sponsored',
  );
  const [, cardtrader, tcgplayer] = singleCardShops(
    'en',
    { name: 'Sol Ring', set: 'Commander', number: null },
    partner,
  );
  assert.equal(cardtrader.url, 'https://www.cardtrader.com/en/search?q=Sol+Ring&share_code=abc');
  assert.equal(
    tcgplayer.url,
    'https://partner.tcgplayer.com/sleeveready?u='
      + encodeURIComponent('https://www.tcgplayer.com/search/all/product?q=Sol+Ring+Commander'),
  );
});

test('card sitemap: only sets released in the last year', async () =>
{
  const { recentCardPaths } = await import('../server/card-index.ts');
  const set = (slug: string, releaseDate: string | null) => ({
    id: slug.length,
    slug,
    code: null,
    name: slug,
    releaseDate,
    languages: ['en'],
    cards: [['1', 'Card', '1']] as [string, string, string][],
    refreshedAt: '2026-10-01T00:00:00Z',
  });
  const index = {
    game: 'pokemon' as const,
    known: [],
    setsCheckedAt: null,
    sets: [set('new', `2026-09-01`), set('edge', '2025-10-10'), set('old', '2023-05-01'), set('undated', null)],
  };
  assert.deepEqual(recentCardPaths(index, Date.parse('2026-10-10T12:00:00Z')), [
    '/en/pokemon/new/1/',
    '/en/pokemon/edge/1/',
  ]);
});
