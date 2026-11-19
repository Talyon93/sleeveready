import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cardSummary,
  cardSlugs,
  expansionSlug,
  featurePaths,
  gameSetsInfo,
  indexableSeoPaths,
  seoGames,
  parseSeoPath,
  seoFeatureCopy,
  seoPageCopy,
  seoPath,
  seoSetCopy,
  seoSlugForGame,
} from '../shared/seo.ts';
import { renderCardPage } from '../server/card-pages.ts';
import { packSet, unpackSet } from '../server/set-store.ts';
import { alternativePrintings } from '../server/printings.ts';
import { allIndexablePaths, seoSetPages } from '../shared/seo-sets.ts';
import { once } from 'node:events';
import { archidektLines, deckLinkOf, moxfieldLines } from '../server/deck-links.ts';
import { games, expansions, cards, offers } from '../server/normalize.ts';
import { Cache, Queue } from '../server/cache.ts';
import { CardTrader, ApiError } from '../server/cardtrader.ts';
import { MAGIC_GAME_ID, Scryfall } from '../server/scryfall.ts';
import { POKEMON_GAME_ID, TCGdex } from '../server/tcgdex.ts';
import { ONE_PIECE_GAME_ID, OnePieceCatalog, parseOnePieceReleaseDates, releaseDateFor } from '../server/onepiece.ts';
import { LORCANA_GAME_ID, LorcanaCatalog } from '../server/lorcana.ts';
import { RIFTBOUND_GAME_ID, RiftboundCatalog } from '../server/riftbound.ts';
import { SORCERY_GAME_ID, SorceryCatalog } from '../server/sorcery.ts';
import { FAB_GAME_ID, FleshAndBloodCatalog } from '../server/fleshandblood.ts';
import { parseDigimonCards, parseDigimonProductDates, parseDigimonSets } from '../server/digimon.ts';
import { assignDates, englishDate } from '../server/native-source.ts';
import {
  parseDragonBallSets,
  parseFusionWorldCards,
  parseFusionWorldProductDates,
  parseMastersCards,
} from '../server/dragonball.ts';
import { parseGundamCards, parseGundamSets } from '../server/gundam.ts';
import { parseUnionArenaCards, parseUnionArenaSets, unionArenaProductDates } from '../server/unionarena.ts';
import { parseVanguardCards, parseVanguardSets } from '../server/vanguard.ts';
import { PALWORLD_GAME_ID, PalworldCatalog } from '../server/palworld.ts';
import { CyberpunkCatalog } from '../server/cyberpunk.ts';
import { createApp } from '../server/app.ts';
import { filterOffers, estimateDeck, paginateTray } from '../shared/model.ts';
import { safeImageUrl, cardTraderImageUrl, imageResolution } from '../shared/images.ts';
import { demoCards } from '../server/demo.ts';
import { setIconGlyph } from '../src/lib/setIcons.ts';
import {
  cardRects,
  clampSpacing,
  cropLines,
  cutSvg,
  defaultPaper,
  defaultSettings,
  markRects,
  normalizeSettings,
  pageLayout,
  type PrintSettings,
} from '../src/lib/printSettings.ts';
import { parseDecklist, parseDecklistLine } from '../shared/decklist.ts';
import { basicEnergy, codeCoversPrefix, importDecklist, mergeImported } from '../server/deck-import.ts';
import { YugiohCatalog } from '../server/yugioh.ts';
const product = (id: number, cents: number, quantity = 1, zero = false, language = 'en') => ({
  id,
  blueprint_id: 89,
  quantity,
  price: { cents, currency: 'EUR' },
  properties_hash: { mtg_language: language, condition: 'Near Mint', mtg_foil: false },
  user: { username: 'Seller', can_sell_via_hub: zero, country_code: 'IT' },
});
test('official set symbols for the game names used by the UI', () =>
{
  assert.ok(setIconGlyph('riftbound', 'ven'));
  assert.ok(setIconGlyph('magic', 'hob'));
  assert.ok(setIconGlyph('one-piece', 'op18'));
  assert.equal(setIconGlyph('riftbound', 'missing-set'), '');
});
test('images: API original before show and thumbnail, without inventing URLs', () =>
{
  const base = {
    id: 1,
    game_id: 1,
    category_id: 1,
    name: 'Card',
    image_url: 'https://cardtrader.com/uploads/blueprints/image/1/preview_card.jpg',
  };
  const c = cards([{
    ...base,
    image: {
      url: '/uploads/blueprints/image/1/card.jpg',
      show: { url: '/uploads/blueprints/image/1/show_card.jpg' },
    },
  }])[0];
  assert.equal(c.imageUrl, 'https://cardtrader.com/uploads/blueprints/image/1/card.jpg');
  assert.equal(c.imageUrls?.length, 3);
  assert.match(c.imageUrls![1], /show_card/);
  assert.equal(cards([base])[0].imageUrl, base.image_url);
  assert.equal(cardTraderImageUrl('//evil.example/card.jpg'), null);
  assert.equal(cardTraderImageUrl('/other/path'), null);
  assert.equal(imageResolution(745, 1040).dpi, 300);
  assert.equal(imageResolution(180, 251).dpi, 72);
});
test('normalisation of games, sets and optional fields', () =>
{
  assert.equal(
    games({ array: [{ id: 22, name: 'Riftbound', display_name: 'Riftbound | League of Legends' }] })[0].id,
    22,
  );
  assert.deepEqual(
    games([{ id: 1, name: 'Magic', display_name: 'Magic: The Gathering' }, { id: 2, name: 'Unrelated' }]),
    [
      { id: 1, name: 'Magic', displayName: 'Magic: The Gathering' },
      { id: 2, name: 'Unrelated', displayName: 'Unrelated' },
    ],
  );
  assert.equal(expansions([{ id: 1, game_id: 1, name: 'Set' }])[0].code, null);
  const c = cards([{
    id: 1,
    game_id: 1,
    category_id: 1,
    name: 'Card',
    tcg_player_id: 12,
    fixed_properties: { collector_number: '001m', yugioh_rarity: 'Grand Master Rare' },
  }])[0];
  assert.equal(c.imageUrl, null);
  assert.equal(c.expansionId, null);
  assert.equal(c.tcgplayerId, '12');
  assert.equal(c.collectorNumber, '001m');
  assert.equal(c.rarity, 'Grand Master Rare');
  assert.throws(() => cards({ bad: true }));
});
test('offers sorted; sellers on holiday, zero stock and malformed data excluded', () =>
{
  const result = offers({
    '89': [product(1, 200), product(2, 100, 3, true), { ...product(3, 1), on_vacation: true }, product(4, 0, 0), {
      id: 5,
    }],
  }, 89);
  assert.deepEqual(result.map(o => o.productId), [2, 1]);
  assert.equal(result[0].language, 'en');
  assert.equal(result[0].sellerCountry, 'IT');
  assert.equal(filterOffers(result, '', true).length, 1);
  assert.equal(filterOffers(result, 'it').length, 0);
  assert.deepEqual(offers({}, 89), []);
});
test('estimate respects quantities, filters, stock and currencies', () =>
{
  const card = { ...demoCards(1)[0], id: 89 };
  const os = offers({
    '89': [product(1, 100, 2, true), product(2, 200, 1, false), {
      ...product(3, 50, 1),
      price: { cents: 50, currency: 'USD' },
    }],
  }, 89);
  assert.deepEqual(estimateDeck([{ card, quantity: 4 }], { 89: os }), {
    totals: { EUR: 400 },
    available: 3,
    requested: 4,
  });
  assert.deepEqual(estimateDeck([{ card, quantity: 4 }], { 89: os }, '', true), {
    totals: { EUR: 200 },
    available: 2,
    requested: 4,
  });
  assert.equal(estimateDeck([{ card, quantity: 4 }], { 89: os }, 'it').available, 0);
});
test('A4 pages repeat quantities in order', () =>
{
  const cs = demoCards(1);
  const pages = paginateTray([{ card: cs[0], quantity: 10 }, { card: cs[1], quantity: 2 }]);
  assert.deepEqual(pages.map(p => p.length), [9, 3]);
  assert.equal(pages[1][0].id, cs[0].id);
  assert.equal(pages[1][1].id, cs[1].id);
});
test('cache expires and shares simultaneous requests without storing errors', async () =>
{
  let now = 0, calls = 0;
  const cache = new Cache(() => now);
  const loader = async () => ++calls;
  await Promise.all([cache.get('x', 100, loader), cache.get('x', 100, loader)]);
  assert.equal(calls, 1);
  now = 99;
  await cache.get('x', 100, loader);
  assert.equal(calls, 1);
  now = 101;
  await cache.get('x', 100, loader);
  assert.equal(calls, 2);
  await assert.rejects(cache.get('bad', 100, async () =>
  {
    throw Error('fail');
  }));
  assert.equal((await cache.get('bad', 100, loader)).data, 3);
});
test('queue limits concurrency to one', async () =>
{
  const q = new Queue(1);
  let concurrent = 0, peak = 0;
  await Promise.all(Array.from({ length: 4 }, () =>
    q.run(async () =>
    {
      peak = Math.max(peak, ++concurrent);
      await new Promise(r => setTimeout(r, 3));
      concurrent--;
    })));
  assert.equal(peak, 1);
});
test('invalid token: sanitised 401 and no retry', async () =>
{
  let calls = 0;
  const client = new CardTrader('never-print-this', async () =>
  {
    calls++;
    return new Response('sensitive upstream', { status: 401 });
  });
  await assert.rejects(
    client.games(),
    (e: unknown) => e instanceof ApiError && e.status === 401 && !e.message.includes('sensitive'),
  );
  assert.equal(calls, 1);
});
test('429 and timeouts have limited retries; mutations are never retried', async () =>
{
  let calls = 0;
  const transport = async () =>
  {
    calls++;
    return new Response('{}', { status: 429 });
  };
  const c = new CardTrader('token', transport, async () =>
  {});
  await assert.rejects(c.games());
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(c.request('/cart/add', {}, { product_id: 1, quantity: 1, via_cardtrader_zero: false }));
  assert.equal(calls, 1);
  let failures = 0;
  const timeout = new CardTrader('token', async () =>
  {
    failures++;
    throw new DOMException('timeout', 'TimeoutError');
  }, async () =>
  {});
  await assert.rejects(timeout.games());
  assert.equal(failures, 3);
});
test('client allows explicit endpoints only', async () =>
{
  let calls = 0;
  const c = new CardTrader('token', async () =>
  {
    calls++;
    return new Response('{}');
  });
  await assert.rejects(c.request('/unknown'));
  await assert.rejects(c.request('/games', {}, { product_id: 1, quantity: 1, via_cardtrader_zero: false }));
  assert.equal(calls, 0);
});
test('Scryfall normalises Magic sets, printings and languages, with cache', async () =>
{
  const urls: string[] = [];
  const setId = '00000000-0000-4000-8000-000000000001';
  const cardId = '00000000-0000-4000-8000-000000000002';
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    urls.push(url.toString());
    if (url.pathname === '/sets')
    {
      return new Response(
        JSON.stringify({
          data: [{
            id: setId,
            code: 'tst',
            name: 'Test Set',
            set_type: 'expansion',
            released_at: '2026-01-02',
            card_count: 1,
            digital: false,
          }],
          has_more: false,
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }
    const language = /lang%3A(\w+)/.exec(url.search)?.[1] ?? /lang:(\w+)/.exec(decodeURIComponent(url.search))?.[1];
    if (language && !['en', 'it', 'any'].includes(language))
    {
      return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
    }
    return new Response(
      JSON.stringify({
        data: (language === 'any' ? ['en', 'it'] : [language ?? 'it']).map(lang => ({
          id: cardId,
          lang,
          name: 'Test Card',
          printed_name: 'Carta di prova',
          collector_number: '001',
          rarity: 'rare',
          set_id: setId,
          image_uris: { large: 'https://cards.scryfall.io/large/front/test.jpg' },
          tcgplayer_id: 12,
          cardmarket_id: 34,
        })),
        has_more: false,
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  };
  const client = new Scryfall(transport as typeof fetch, async () =>
  {});
  const sets = await client.sets();
  assert.equal(sets.data[0].gameId, MAGIC_GAME_ID);
  assert.equal(sets.data[0].code, 'TST');
  const result = await client.cards(sets.data[0].id, 'it');
  assert.equal(result.data[0].name, 'Carta di prova');
  assert.equal(result.data[0].language, 'it');
  assert.match(result.data[0].imageUrl ?? '', /cards\.scryfall\.io/);
  const languages = await client.languages(sets.data[0].id);
  assert.deepEqual(languages.data, ['en', 'it']);
  assert.equal(urls.filter(url => url.endsWith('/sets')).length, 1);
  const italianRequest = urls.find(url => decodeURIComponent(url).includes('lang:it'));
  assert.match(italianRequest ?? '', /include_multilingual=true/);
});
test('stored sets: compressed and read back unchanged', () =>
{
  const value = Array.from({ length: 300 }, (_, id) => ({
    id,
    name: 'Card ' + id,
    imageUrl: 'https://cards.scryfall.io/normal/front/' + id + '.jpg',
  }));
  const packed = packSet(1234, value);
  assert.ok(packed.byteLength < JSON.stringify(value).length / 3);
  assert.deepEqual(unpackSet(packed), { savedAt: 1234, value });
});
test('Scryfall: settled sets survive a new instance, the newest do not', async () =>
{
  const today = new Date();
  const date = (days: number) => new Date(today.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  const setIds = ['00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000012'];
  let searches = 0;
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    if (url.pathname === '/sets')
    {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: setIds[0],
              code: 'old',
              name: 'Old',
              set_type: 'expansion',
              released_at: date(90),
              card_count: 1,
              digital: false,
            },
            {
              id: setIds[1],
              code: 'new',
              name: 'New',
              set_type: 'expansion',
              released_at: date(3),
              card_count: 1,
              digital: false,
            },
          ],
          has_more: false,
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }
    searches++;
    return new Response(
      JSON.stringify({
        data: [{
          id: '00000000-0000-4000-8000-000000000013',
          set_id: /e%3Aold|e:old/.test(url.search) ? setIds[0] : setIds[1],
          lang: 'en',
          name: 'Card',
          collector_number: '1',
          rarity: 'common',
          image_uris: { normal: 'https://cards.scryfall.io/normal/a.jpg' },
        }],
        has_more: false,
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  };
  const kept = new Map<string, unknown>();
  const store = {
    read: async <T>(key: string) => (kept.get(key) ?? null) as T | null,
    write: async (key: string, value: unknown) =>
    {
      kept.set(key, value);
    },
  };
  const first = new Scryfall(transport as typeof fetch, async () =>
  {}, store);
  const sets = (await first.sets()).data;
  const settled = sets.find(set => set.code === 'OLD')!;
  const recent = sets.find(set => set.code === 'NEW')!;
  await first.cards(settled.id, 'en');
  await first.languages(settled.id);
  await first.cards(recent.id, 'en');
  assert.deepEqual([...kept.keys()].sort(), ['magic/cards/OLD/en', 'magic/languages/OLD']);
  const fresh = new Scryfall(transport as typeof fetch, async () =>
  {}, store);
  await fresh.sets();
  searches = 0;
  assert.equal((await fresh.cards(settled.id, 'en')).data[0].name, 'Card');
  assert.ok((await fresh.languages(settled.id)).data.includes('en'));
  assert.equal(searches, 0, 'read from the store, not from Scryfall');
  await fresh.cards(recent.id, 'en');
  assert.equal(searches, 1, 'a recent expansion is read again');
});
test('TCGdex normalises localised Pokémon sets and cards, with high-quality images', async () =>
{
  const urls: string[] = [];
  const languagesWithSet = new Set(['en', 'it']);
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    urls.push(url.toString());
    if (url.pathname === '/v2/en/sets')
    {
      return new Response(
        JSON.stringify([
          { id: 'sv01', name: 'Scarlet & Violet', cardCount: { total: 2, official: 2 } },
          { id: 'promo', name: 'Promos', cardCount: { total: 2, official: 0 } },
        ]),
        { headers: { 'content-type': 'application/json' } },
      );
    }
    const language = url.pathname.split('/')[2];
    if (!languagesWithSet.has(language))
    {
      return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
    }
    return new Response(
      JSON.stringify({
        id: 'sv01',
        name: language === 'it' ? 'Scarlatto e Violetto' : 'Scarlet & Violet',
        releaseDate: '2023-03-31',
        cards: [{
          id: 'sv01-001',
          localId: '001',
          name: language === 'it' ? 'Sprigatito IT' : 'Sprigatito',
          image: `https://assets.tcgdex.net/${language}/sv/sv01/001`,
        }],
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  };
  const client = new TCGdex(transport as typeof fetch, async () =>
  {});
  const sets = await client.sets();
  assert.equal(sets.data.length, 1);
  assert.equal(sets.data[0].gameId, POKEMON_GAME_ID);
  const italian = await client.cards(sets.data[0].id, 'it');
  assert.equal(italian.data[0].name, 'Sprigatito IT');
  assert.equal(italian.data[0].language, 'it');
  assert.match(italian.data[0].imageUrl ?? '', /high\.webp$/);
  const languages = await client.languages(sets.data[0].id);
  assert.deepEqual(languages.data, ['en', 'it']);
  assert.equal(urls.filter(url => url.endsWith('/v2/en/sets')).length, 1);
});
test('TCGdex: older sets survive a new instance, the six newest do not', async () =>
{
  const recentDate = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  const ids = ['old', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6'];
  let setReads = 0;
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    if (url.pathname === '/v2/en/sets')
    {
      return json(ids.map(id => ({ id, name: id.toUpperCase(), cardCount: { total: 1, official: 1 } })));
    }
    const [, , language, , id] = url.pathname.split('/');
    if (!['en', 'it'].includes(language)) return json({}, 404);
    setReads++;
    return json({
      id,
      name: id,
      releaseDate: id === 'old' ? '2011-02-09' : recentDate,
      cards: [{
        id: `${id}-001`,
        localId: '001',
        name: `${id} ${language}`,
        image: `https://assets.tcgdex.net/${language}/x/${id}/001`,
      }],
    });
  };
  const kept = new Map<string, unknown>();
  const store = {
    read: async <T>(key: string) => (kept.get(key) ?? null) as T | null,
    write: async (key: string, value: unknown) =>
    {
      kept.set(key, value);
    },
  };
  const first = new TCGdex(transport as typeof fetch, async () =>
  {}, store);
  const sets = (await first.sets()).data;
  const settled = sets.find(set => set.code === 'OLD')!;
  const recent = sets.find(set => set.code === 'N6')!;
  await first.cards(settled.id, 'it');
  await first.languages(settled.id);
  await first.cards(recent.id, 'en');
  await first.languages(recent.id);
  assert.deepEqual([...kept.keys()].sort(), ['pokemon/cards/old/en', 'pokemon/cards/old/it', 'pokemon/languages/old']);
  const fresh = new TCGdex(transport as typeof fetch, async () =>
  {}, store);
  await fresh.sets();
  setReads = 0;
  assert.equal((await fresh.cards(settled.id, 'it')).data[0].name, 'old it');
  assert.deepEqual((await fresh.languages(settled.id)).data, ['en', 'it']);
  assert.equal(setReads, 0, 'read from the store, not from TCGdex');
  await fresh.cards(recent.id, 'en');
  assert.equal(setReads, 1, 'a recent set is read again');
});
test('TCGdex does not store an older set until TCGdex has all its images', async () =>
{
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
  let scanned = false;
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    if (url.pathname === '/v2/en/sets')
    {
      return json(
        ['old', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6'].map(id => ({ id, name: id, cardCount: { total: 2, official: 2 } })),
      );
    }
    const language = url.pathname.split('/')[2];
    if (language !== 'en') return json({}, 404);
    return json({
      id: 'old',
      name: 'old',
      releaseDate: '2011-02-09',
      cards: [
        { id: 'old-001', localId: '001', name: 'A', image: 'https://assets.tcgdex.net/en/x/old/001' },
        { id: 'old-002', localId: '002', name: 'B', image: scanned ? 'https://assets.tcgdex.net/en/x/old/002' : null },
      ],
    });
  };
  const kept = new Map<string, unknown>();
  const store = {
    read: async <T>(key: string) => (kept.get(key) ?? null) as T | null,
    write: async (key: string, value: unknown) =>
    {
      kept.set(key, value);
    },
  };
  const partial = new TCGdex(transport as typeof fetch, async () =>
  {}, store);
  const old = (await partial.sets()).data.find(set => set.code === 'OLD')!;
  assert.equal((await partial.cards(old.id, 'en')).data.length, 2);
  await partial.languages(old.id);
  assert.deepEqual([...kept.keys()], [], 'a half-scanned list is not kept');
  scanned = true;
  const complete = new TCGdex(transport as typeof fetch, async () =>
  {}, store);
  await complete.cards(old.id, 'en');
  await complete.languages(old.id);
  assert.deepEqual([...kept.keys()].sort(), ['pokemon/cards/old/en', 'pokemon/languages/old']);
});
test('Pokémon: a new set without TCGdex scans takes images from the Pokémon TCG API, older sets do not', async () =>
{
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
  let fallbackCalls = 0;
  let fallbackQuery = '';
  const ids = ['old', 'n1', 'n2', 'n3', 'n4', 'n5', 'me06'];
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    if (url.hostname === 'api.pokemontcg.io')
    {
      fallbackCalls++;
      fallbackQuery = url.searchParams.get('q') ?? '';
      if (fallbackCalls === 1) return json({}, 500);
      return json({
        data: [
          {
            number: '1',
            set: { name: 'Delta Reign' },
            images: {
              small: 'https://images.scrydex.com/pokemon/me6-1/small',
              large: 'https://images.scrydex.com/pokemon/me6-1/large',
            },
          },
          {
            number: '2',
            set: { name: 'Delta Reign' },
            images: {
              small: 'https://images.scrydex.com/pokemon/me6-2/small',
              large: 'https://images.scrydex.com/pokemon/me6-2/large',
            },
          },
          {
            number: '1',
            set: { name: 'Delta Reign Promos' },
            images: { large: 'https://images.scrydex.com/pokemon/wrong/large' },
          },
        ],
      });
    }
    if (url.pathname === '/v2/en/sets')
    {
      return json(
        ids.map(id => ({ id, name: id === 'me06' ? 'Delta Reign' : id, cardCount: { total: 2, official: 2 } })),
      );
    }
    const [, , language, , id] = url.pathname.split('/');
    if (language !== 'en') return json({}, 404);
    return json({
      id,
      name: id === 'me06' ? 'Delta Reign' : id,
      releaseDate: id === 'old' ? '2011-02-09' : '2026-11-06',
      cards: [
        { id: `${id}-001`, localId: '001', name: 'Heracross' },
        { id: `${id}-002`, localId: '002', name: 'Surskit' },
      ],
    });
  };
  const kept = new Map<string, unknown>();
  const store = {
    read: async <T>(key: string) => (kept.get(key) ?? null) as T | null,
    write: async (key: string, value: unknown) =>
    {
      kept.set(key, value);
    },
  };
  const client = new TCGdex(transport as typeof fetch, async () =>
  {}, store);
  const sets = (await client.sets()).data;
  const delta = sets.find(set => set.code === 'ME06')!;
  const old = sets.find(set => set.code === 'OLD')!;
  const cards = (await client.cards(delta.id, 'it')).data;
  assert.deepEqual(cards.map(card => [card.collectorNumber, card.language, card.imageUrl]), [
    ['001', 'en', 'https://images.scrydex.com/pokemon/me6-1/large'],
    ['002', 'en', 'https://images.scrydex.com/pokemon/me6-2/large'],
  ], 'matched by number, only the same set, in English');
  assert.equal(fallbackQuery, 'set.name:"Delta Reign"');
  assert.equal(fallbackCalls, 2, 'a failed answer is tried again');
  assert.deepEqual((await client.languages(delta.id)).data, ['en']);
  assert.deepEqual((await client.cards(old.id, 'en')).data, [], 'an old set without scans stays out, with no request');
  assert.equal(fallbackCalls, 2);
  const another = new TCGdex(transport as typeof fetch, async () =>
  {}, store);
  await another.sets();
  assert.equal((await another.cards(delta.id, 'en')).data.length, 2);
  assert.equal(fallbackCalls, 2, 'a new instance reads the kept images');
  assert.ok(
    ![...kept.keys()].some(key => key.startsWith('pokemon/cards/')),
    'borrowed images are never kept as the card list',
  );
});
test('TCGdex excludes sets and languages without printable images', async () =>
{
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    if (url.pathname === '/v2/en/sets')
    {
      return new Response(JSON.stringify([{ id: 'empty', name: 'No artwork', cardCount: { total: 1, official: 1 } }]), {
        headers: { 'content-type': 'application/json' },
      });
    }
    const language = url.pathname.split('/')[2];
    if (!['en', 'it'].includes(language))
    {
      return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
    }
    return new Response(
      JSON.stringify({
        id: 'empty',
        name: 'No artwork',
        cards: [{ id: 'empty-001', localId: '001', name: 'Missing', image: null }],
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  };
  const client = new TCGdex(transport as typeof fetch, async () =>
  {});
  const expansion = (await client.sets()).data[0];
  assert.deepEqual((await client.cards(expansion.id, 'it')).data, []);
  assert.deepEqual((await client.languages(expansion.id)).data, []);
});
test('Magic import: when the number points to another card, the name wins within the same set', async () =>
{
  const setId = '00000000-0000-4000-8000-000000000001';
  const card = (id: string, name: string, number: string) => ({
    id: `00000000-0000-4000-8000-00000000000${id}`,
    lang: 'en',
    name,
    collector_number: number,
    rarity: 'uncommon',
    set_id: setId,
    image_uris: { large: 'https://cards.scryfall.io/large/front/x.jpg' },
  });
  const transport = async (input: URL | RequestInfo, init?: RequestInit) =>
  {
    const url = new URL(String(input));
    const json = (value: unknown) =>
      new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
    if (url.pathname === '/sets')
    {
      return json({
        data: [{
          id: setId,
          code: 'cmm',
          name: 'Commander Masters',
          set_type: 'masters',
          released_at: '2023-08-04',
          card_count: 2,
          digital: false,
        }],
        has_more: false,
      });
    }
    const identifiers = JSON.parse(String(init?.body ?? '{}')).identifiers as Record<string, string>[];
    return json({
      data: identifiers.flatMap(item =>
        item.collector_number === '400'
          ? [card('2', 'Myr Sire', '400')]
          : item.name === 'Sol Ring'
          ? [card('3', 'Sol Ring', '410')]
          : []
      ),
    });
  };
  const result = await new Scryfall(transport as typeof fetch, async () =>
  {})
    .importCards(parseDecklist('1 Sol Ring (CMM) 400\n1 Myr Sire (CMM) 400'), 'en');
  assert.deepEqual(result.items.map(item => [item.card.name, item.card.collectorNumber]), [
    ['Sol Ring', '410'],
    ['Myr Sire', '400'],
  ]);
});
test('One Piece catalog matches sets and official images in the languages actually available', async () =>
{
  const menu = (options: string) => '<select name="series">' + options + '</select>';
  const card = (id: string, name: string) =>
    '<dl class="modalCol" id="' + id
    + '"><dt><div class="infoCol"><span>OP13-001</span> | <span>L</span> | <span>LEADER</span></div><div class="cardName">'
    + name + '</div></dt></dl>';
  const html = (body: string) => new Response(body, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    if (url.pathname.startsWith('/images/'))
    {
      return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } });
    }
    const series = url.searchParams.get('series');
    if (url.hostname === 'en.onepiece-cardgame.com')
    {
      return html(
        series === '569113'
          ? card('OP13-001', 'Portgas.D.Ace') + card('OP13-001_p1', 'Portgas.D.Ace')
          : menu(
            '<option value="569113" selected>BOOSTER PACK &lt;br class=&quot;spInline&quot;&gt;-CARRYING ON HIS WILL- [OP-13]</option><option value="">ALL</option>',
          ),
      );
    }
    if (url.hostname === 'fr.onepiece-cardgame.com')
    {
      return html(
        series === '622113'
          ? card('OP13-001', 'Portgas D. Ace')
          : menu('<option value="622113">BOOSTER -SUCCESSEURS- [OP-13]</option>'),
      );
    }
    return html(menu(''));
  };
  const client = new OnePieceCatalog(transport as typeof fetch, async () =>
  {});
  const sets = await client.sets();
  assert.equal(sets.data[0].gameId, ONE_PIECE_GAME_ID);
  assert.equal(sets.data[0].code, 'OP-13');
  assert.equal(sets.data[0].name, 'CARRYING ON HIS WILL');
  const english = (await client.cards(sets.data[0].id, 'en')).data;
  assert.deepEqual(english.map(item => [item.collectorNumber, item.rarity]), [['OP13-001', 'L'], ['OP13-001', 'L']]);
  assert.notEqual(english[0].id, english[1].id);
  const french = await client.cards(sets.data[0].id, 'fr');
  assert.equal(french.data[0].language, 'fr');
  assert.equal(french.data[0].name, 'Portgas D. Ace');
  assert.match(french.data[0].imageUrl ?? '', /^\/api\/catalog\/one-piece-image\/fr\/.+\.webp\?v=2$/);
  assert.equal((await client.cards(sets.data[0].id, 'th')).data[0].language, 'en');
  assert.deepEqual((await client.languages(sets.data[0].id)).data, ['en', 'fr']);
  const image = await client.image('en', 'OP13-001', 'png');
  assert.equal(image.contentType, 'image/png');
  assert.equal(image.bytes.length, 4);
  await assert.rejects(client.image('en', '../secret', 'png'));
});
test('LorcanaJSON loads sets, official images and the languages actually available', async () =>
{
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    if (url.pathname === '/files/current/en/allCards.json')
    {
      return new Response(
        JSON.stringify({
          sets: {
            '1': {
              name: 'The First Chapter',
              releaseDate: '2023-09-01',
              type: 'expansion',
              number: 1,
              cardCounts: { total: 2 },
            },
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }
    const match = /\/files\/current\/(\w+)\/sets\/setdata\.1\.json/.exec(url.pathname);
    if (!match || !['en', 'it'].includes(match[1]))
    {
      return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
    }
    const language = match[1];
    return new Response(
      JSON.stringify({
        name: language === 'it' ? 'Capitolo Primo' : 'The First Chapter',
        releaseDate: '2023-09-01',
        type: 'expansion',
        number: 1,
        code: '1',
        cards: [{
          id: 1,
          fullName: language === 'it' ? 'Ariel - Con gambe umane' : 'Ariel - On Human Legs',
          name: 'Ariel',
          version: language === 'it' ? 'Con gambe umane' : 'On Human Legs',
          number: 1,
          rarity: 'Uncommon',
          setCode: '1',
          images: {
            full: `https://api.lorcana.ravensburger.com/images/${language}/set1/1.jpg`,
            thumbnail: `https://api.lorcana.ravensburger.com/images/${language}/set1/1-thumb.jpg`,
          },
        }],
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  };
  const client = new LorcanaCatalog(transport as typeof fetch, async () =>
  {});
  const expansion = (await client.sets()).data[0];
  assert.equal(expansion.gameId, LORCANA_GAME_ID);
  assert.equal(expansion.code, '1');
  const italian = (await client.cards(expansion.id, 'it')).data;
  assert.equal(italian[0].name, 'Ariel - Con gambe umane');
  assert.equal(italian[0].language, 'it');
  assert.match(italian[0].imageUrl ?? '', /api\.lorcana\.ravensburger\.com/);
  assert.deepEqual((await client.languages(expansion.id)).data, ['en', 'it']);
});
test("LorcanaJSON: one card without a number does not fail the whole set (Illumineer's Quest)", async () =>
{
  const card = (id: number, name: string, number: number | null) => ({
    id,
    fullName: name,
    name,
    number,
    images: { full: `https://api.lorcana.ravensburger.com/images/en/quest3/${id}.jpg` },
  });
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    if (url.pathname === '/files/current/en/allCards.json')
    {
      return json({
        sets: {
          Q3: {
            name: "Illumineer's Quest: The Great Hunny Rescue",
            releaseDate: '2026-10-02',
            type: 'quest',
            number: 3,
            cardCounts: { total: 2 },
          },
        },
      });
    }
    if (url.pathname === '/files/current/en/sets/setdata.Q3.json')
    {
      return json({
        name: "Illumineer's Quest: The Great Hunny Rescue",
        releaseDate: '2026-10-02',
        type: 'quest',
        number: 3,
        cards: [card(3514, 'Mickey Mouse - Rescued from the Entrance', 1), card(3551, 'Vine Tendril', null)],
      });
    }
    return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
  };
  const client = new LorcanaCatalog(transport as typeof fetch, async () =>
  {});
  const expansion = (await client.sets()).data[0];
  const cards = (await client.cards(expansion.id, 'en')).data;
  assert.deepEqual(cards.map(item => [item.name, item.collectorNumber]), [
    ['Mickey Mouse - Rescued from the Entrance', '1'],
    ['Vine Tendril', null],
  ]);
});
test('Riot gallery loads Riftbound sets and images in the languages actually printed', async () =>
{
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    const locale = url.pathname.split('/')[1];
    const language = locale === 'zh-cn' ? 'zh-cn' : locale === 'zh-tw' ? 'zh-tw' : locale === 'ko-kr' ? 'ko' : 'en';
    const localized = language === 'en'
      ? 'Jinx, Demolitionist'
      : language === 'ko'
      ? '징크스, 폭파 전문가'
      : language === 'zh-cn'
      ? '金克丝, 爆破专家'
      : '吉茵珂絲, 爆破專家';
    const page = {
      props: {
        pageProps: {
          page: {
            blades: [{
              sets: { items: [{ id: 'VEN', name: 'Vendetta' }] },
              cards: {
                items: [{
                  id: 'ven-001-166',
                  collectorNumber: 1,
                  name: localized.split(', ')[0],
                  subtitle: localized.split(', ')[1],
                  publicCode: 'VEN-001/166',
                  set: { value: { id: 'VEN', label: 'Vendetta' } },
                  rarity: { value: { label: 'Common' } },
                  cardImage: { url: `https://cmsassets.rgpub.io/${language}/ven-001.png` },
                }],
              },
            }],
          },
        },
      },
    };
    return new Response(
      `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(page)}</script></html>`,
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  };
  const client = new RiftboundCatalog(transport as typeof fetch, async () =>
  {});
  const expansion = (await client.sets()).data[0];
  assert.equal(expansion.gameId, RIFTBOUND_GAME_ID);
  assert.equal(expansion.code, 'VEN');
  const chinese = (await client.cards(expansion.id, 'zh-cn')).data;
  assert.equal(chinese[0].language, 'zh-cn');
  assert.match(chinese[0].name, /金克丝/);
  assert.match(chinese[0].imageUrl ?? '', /cmsassets\.rgpub\.io/);
  assert.deepEqual((await client.languages(expansion.id)).data, ['en', 'zh-cn', 'zh-tw', 'ko']);
});
const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
test('Sorcery derives sets and cards from printings, without duplicating foils', async () =>
{
  const printing = (slug: string, code: string, finish: string, printedAt: string) => ({
    slug,
    printedAt,
    set: { name: code === '001' ? 'Alpha' : 'Beta', code },
    meta: { finish, product: 'Booster' },
  });
  const transport = async () =>
    json([{
      name: 'Seer',
      slug: 'seer',
      engine: { rarity: 'Ordinary' },
      printings: [
        printing('001-seer-b-s', '001', 'Standard', '2023-04-01T00:00:00Z'),
        printing('001-seer-b-f', '001', 'Foil', '2023-04-01T00:00:00Z'),
        printing('002-seer-b-s', '002', 'Standard', '2023-11-01T00:00:00Z'),
      ],
    }]);
  const client = new SorceryCatalog(transport as typeof fetch, async () =>
  {});
  const sets = (await client.sets()).data;
  assert.deepEqual(sets.map(set => [set.code, set.releaseDate]), [['002', '2023-11-01'], ['001', '2023-04-01']]);
  assert.equal(sets[0].gameId, SORCERY_GAME_ID);
  const cards = (await client.cards(sets[1].id, 'en')).data;
  assert.equal(cards.length, 1);
  assert.match(cards[0].imageUrl ?? '', /\/cards\/001-seer-b-s\.png$/);
  assert.deepEqual((await client.languages(sets[1].id)).data, ['en']);
});
test('Flesh and Blood uses official products per language and fixes swapped languages', async () =>
{
  const product = (slug: string, name: string, printed_language: string) => ({
    slug,
    product_name: name,
    printed_language,
    release_date: '2026-11-14',
  });
  const cardUrls: string[] = [];
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/product-groups-products/'))
    {
      return json({
        next: null,
        results: [
          {
            slug: 'mastery-pack',
            group_name: 'Mastery Pack',
            product_type: 'booster',
            release_date: '2026-11-14',
            products: [
              product('mastery-pack', 'Mastery Pack', 'en'),
              product('mastery-pack-fr', 'Mastery Pack [FR]', 'ja'),
            ],
          },
          {
            slug: 'judge-promo',
            group_name: 'Judge',
            product_type: 'promo',
            products: [product('judge', 'Judge', 'en')],
          },
        ],
      });
    }
    cardUrls.push(url.pathname);
    const language = url.pathname.includes('-fr/') ? 'FR' : 'EN';
    return json({
      cards: [{
        print_id: `${language}_MPA001`,
        printed_name: language === 'FR' ? 'Arakni FR' : 'Arakni',
        faces: [
          {
            image: {
              large:
                `https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/${language}_MPA001.webp`,
            },
            layout_position: 10,
          },
          {
            image: {
              large:
                `https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/${language}_MPA001_BACK.webp`,
            },
            layout_position: 20,
          },
        ],
      }],
    });
  };
  const client = new FleshAndBloodCatalog(transport as typeof fetch, async () =>
  {});
  const sets = (await client.sets()).data;
  assert.equal(sets.length, 1);
  assert.equal(sets[0].gameId, FAB_GAME_ID);
  assert.deepEqual((await client.languages(sets[0].id)).data, ['en', 'fr']);
  const french = (await client.cards(sets[0].id, 'fr')).data;
  assert.equal(french[0].name, 'Arakni FR');
  assert.equal(french[0].language, 'fr');
  assert.equal(french[0].collectorNumber, 'MPA001');
  assert.deepEqual(french.map(card => card.version), ['Front', 'Back']);
  assert.equal((await client.cards(sets[0].id, 'it')).data[0].language, 'en');
  assert.deepEqual(cardUrls, [
    '/carddb/api/v1/product-cards/mastery-pack-fr/',
    '/carddb/api/v1/product-cards/mastery-pack/',
  ]);
});
test('official Bandai lists: sets, parallel variants and leader backs', () =>
{
  const digimonSets = parseDigimonSets(
    '<option value="522039" selected>EXTRA BOOSTER CHIVALROUS XIII [EX-13］</option><option value="522101">Starter Deck GAIA RED [ST-1]</option><option value="522901">Promo Cards (P-Numbered)</option>',
  );
  assert.deepEqual(digimonSets.map(set => [set.category, set.expansion.code, set.expansion.name]), [
    ['522039', 'EX-13', 'EXTRA BOOSTER CHIVALROUS XIII'],
    ['522101', 'ST-1', 'Starter Deck GAIA RED'],
  ]);
  const digimon = parseDigimonCards(
    '<li class="image_lists_item data page-1"><a data-src="#EX13-001_P1"><img src="../images/cardlist/card/EX13-001_P1.png?260529" alt="EX13-001Gigimon"></a><li class="cardNo">EX13-001</li><li class="cardRarity">U</li><div class="cardTitle">Gigimon</div>',
    1,
    '522039',
  );
  assert.equal(digimon[0].imageUrl, 'https://world.digimoncard.com/images/cardlist/card/EX13-001_P1.png?260529');
  assert.equal(digimon[0].version, 'Parallel 1');
  assert.equal(digimon[0].rarity, 'U');
  assert.deepEqual(
    parseDragonBallSets(
      '<li data-val="583011" class="is-active">BOOSTER PACK -BRIGHTNESS OF HOPE- [FB11]</li><li data-val="583901" class="">Promotion Card</li>',
      'fw',
    )
      .map(set => set.expansion.code),
    ['FB11'],
  );
  const fusion = parseFusionWorldCards(
    '<li class="cardItem"><a data-src="detail.php?card_no=FB11-001"><img class="lazy" src="../../images/cards/card/noimage.webp" data-src="../../images/cards/card/en/FB11-001_f.webp" alt="FB11-001 Son Goku"></a></li>',
    1,
  );
  assert.deepEqual(fusion.map(card => [card.name, card.version, card.imageUrl]), [
    ['Son Goku', 'Front', 'https://www.dbs-cardgame.com/fw/images/cards/card/en/FB11-001_f.webp'],
    ['Son Goku', 'Back', 'https://www.dbs-cardgame.com/fw/images/cards/card/en/FB11-001_b.webp'],
  ]);
  const masters = parseMastersCards(
    '<dl class="cardListCol cardColorRed csrdTypeLEADER cardBack"><dt class="cardNumber">BT1-001</dt><dd class="cardName">Champa</dd><img src="../../images/cardlist/cardimg/BT1-001_b.png" alt="Champa"><dl class="rarityCol"><dt>Rarity</dt><dd>Rare[R]</dd></dl></dl>',
    1,
  );
  assert.equal(masters[0].version, 'Back');
  assert.equal(masters[0].imageUrl, 'https://www.dbs-cardgame.com/images/cardlist/cardimg/BT1-001_b.png');
  assert.deepEqual(
    parseGundamSets(
      '<a data-val="616101">Newtype Rising [GD01]</a><a data-val="616105">Freedom Ascension [GD05]</a><a data-val="616901">Promotion card</a>',
    )
      .map(set => set.expansion.code),
    ['GD05', 'GD01'],
  );
  const gundam = parseGundamCards(
    '<a data-fancybox="cards" data-src="detail.php?detailSearch=GD05-001_p1" class="cardStr">\n<img class="lazy" src="../images/cards/parts/dummy.gif" data-src="../images/cards/card/GD05-001_p1.webp?260917" alt="V2 Gundam">',
    1,
    '616105',
  );
  assert.deepEqual(
    [gundam[0].name, gundam[0].collectorNumber, gundam[0].imageUrl],
    ['V2 Gundam', 'GD05-001', '/api/catalog/gundam-image/GD05-001_p1.webp?v=260917'],
  );
  assert.deepEqual(
    parseUnionArenaSets(
      '<option value="591001">BLEACH [UE01ST]</option><option value="591124">Re:ZERO [UE24BT]</option><option value="591901">Promotion card</option>',
    )
      .map(set => set.expansion.code),
    ['UE24BT', 'UE01ST'],
  );
  const union = parseUnionArenaCards(
    '<a href="./detail_iframe.php?card_no=UE24BT/REZ-1-003"><img class="lazy" src="/na/images/cardlist/parts/dummy.gif" data-src="/na/images/cardlist/card/UE24BT_REZ-1-003_p1.png?v3" alt="UE24BT/REZ-1-003 Emilia"></a>',
    1,
    '591124',
  );
  assert.deepEqual(
    [union[0].name, union[0].collectorNumber, union[0].version],
    ['Emilia', 'UE24BT/REZ-1-003', 'Parallel 1'],
  );
});
test('release dates from Bandai product pages', () =>
{
  const digimon = parseDigimonProductDates(
    '<li>Booster Pack <b>TIMELESS BONDS [BT-26]</b> Pre-Release date August 28, 2026 Release date September 4, 2026</li><li>RELEASE SPECIAL BOOSTER Ver.1.5 [BT01-03] Release date March 12, 2021</li><li>RELEASE SPECIAL BOOSTER Ver.1.0 [BT01-03] Release date February 12, 2021</li>',
  );
  assert.deepEqual(digimon, [
    { code: 'BT-26', date: '2026-09-04' },
    { code: 'BT01-03', date: '2021-03-12' },
    { code: 'BT01-03', date: '2021-02-12' },
  ]);
  const entry = (category: string, code: string, name = 'Set') => ({
    category,
    expansion: { id: Number(category), gameId: 1, code, name, releaseDate: null as string | null },
  });
  const sets = assignDates([
    entry('522002', 'BT01-03'),
    entry('522001', 'BT01-03'),
    entry('522038', 'BT-26'),
    entry('522101', 'ST-1'),
  ], digimon);
  assert.deepEqual(sets.map(item => item.expansion.releaseDate), ['2021-03-12', '2021-02-12', '2026-09-04', null]);
  assert.deepEqual(
    parseFusionWorldProductDates('<p>BOOSTER PACK -CROSS FORCE- [FB10] RELEASE June 12, 2026 MSRP 4.99</p>'),
    [{ code: 'FB10', date: '2026-06-12' }],
  );
  const union = [
    entry('591124', 'UE24BT', 'Re:ZERO -Starting Life in Another World-'),
    entry('591024', 'UE24ST', 'Re:ZERO -Starting Life in Another World-'),
  ];
  assert.deepEqual(
    unionArenaProductDates(
      '<div>Booster Pack Re:ZERO -Starting Life in Another World- Release Date May 8, 2026</div><div>Starter Deck Re:ZERO -Starting Life in Another World- Release Date May 1, 2026</div>',
      union,
    ),
    [{ code: 'UE24BT', date: '2026-05-08' }, { code: 'UE24ST', date: '2026-05-01' }],
  );
  assert.equal(englishDate('February 30, 2026'), null);
  assert.equal(englishDate('March 9, 2026'), '2026-03-09');
  assert.equal(englishDate('Smarch 3, 2026'), null);
});
test('Vanguard reads release dates from the products API and skips promos', () =>
{
  const sets = parseVanguardSets({
    items: [
      {
        id: '256',
        name: '[VGE-DZ-SS15] Cardfight!! Vanguard Special Series 15',
        category_type: 'booster',
        release_date: '2026-07-31',
      },
      {
        id: '257',
        name: '[VGE-DZ-BT15] Cardfight!! Vanguard Booster Pack 15',
        category_type: 'booster',
        release_date: '2026-08-28',
      },
      { id: '9', name: 'PR cards', category_type: 'pr', release_date: '' },
    ],
  });
  assert.deepEqual(sets.map(set => [set.product, set.expansion.code, set.expansion.name, set.expansion.releaseDate]), [
    ['257', 'DZ-BT15', 'Booster Pack 15', '2026-08-28'],
    ['256', 'DZ-SS15', 'Special Series 15', '2026-07-31'],
  ]);
  const cards = parseVanguardCards({
    page: 1,
    per_page: 24,
    total: 1,
    items: [
      {
        card_number: 'DZ-BT15/001EN',
        card_name: 'Hellfire Dragon Emperor, Wirbel Kenig',
        rare: 'RRR',
        picture: 'dzbt15/dzbt15_001.png',
      },
      { card_number: 'X/1', card_name: 'Bad path', picture: '../etc/passwd.png' },
    ],
  }, 1);
  assert.deepEqual(cards.map(card => [card.collectorNumber, card.name, card.rarity, card.imageUrl]), [[
    'DZ-BT15/001EN',
    'Hellfire Dragon Emperor, Wirbel Kenig',
    'RRR',
    'https://en.cf-vanguard.com/wordpress/wp-content/images/cardlist/dzbt15/dzbt15_001.png',
  ]]);
});
test('Palworld pages through the official card manager and skips promos', async () =>
{
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/products'))
    {
      return json({
        products: [
          { year: '2026', items: [{ code: 'EBP01', name: 'Dawn of Palpagos', type: 'pack', date: '2026.07.30' }] },
          { year: 'pr', items: [{ code: 'PR2026', name: 'PR Cards', type: 'pr', date: '' }] },
        ],
      });
    }
    const page = Number(url.searchParams.get('page'));
    return json({
      total: 101,
      items: page === 1
        ? Array.from({ length: 100 }, (_, index) => ({
          picture: `EBP01/EBP01-${String(index + 1).padStart(3, '0')}.png`,
          card_number: `EBP01-${String(index + 1).padStart(3, '0')}`,
          card_name: 'Pal',
          rare: 'C',
        }))
        : [{ picture: 'EBP01/EBP01-001OSR.png', card_number: 'EBP01-001OSR', card_name: 'Pal', rare: 'OSR' }],
    });
  };
  const client = new PalworldCatalog(transport as typeof fetch, async () =>
  {});
  const sets = (await client.sets()).data;
  assert.deepEqual(sets.map(set => [set.code, set.releaseDate, set.gameId]), [[
    'EBP01',
    '2026-07-30',
    PALWORLD_GAME_ID,
  ]]);
  const cards = (await client.cards(sets[0].id, 'en')).data;
  assert.equal(cards.length, 101);
  assert.deepEqual([cards[100].collectorNumber, cards[100].version], ['EBP01-001', 'OSR']);
  assert.equal(
    cards[0].imageUrl,
    'https://en.palworld-official-cardgame.com/wordpress/wp-content/images/cardlist/EBP01/EBP01-001.png',
  );
});
test('Cyberpunk offers French only where it exists and serves signed images through the proxy', async () =>
{
  const id = '3fc63c58-5954-4744-a5af-047bfc5cb159';
  const imageRequests: string[] = [];
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    if (url.hostname === 'dstcynss47vun.cloudfront.net')
    {
      imageRequests.push(url.search);
      return new Response(new Uint8Array([82, 73, 70, 70]), { headers: { 'content-type': 'image/webp' } });
    }
    if (url.pathname.endsWith('/filters'))
    {
      return json({
        filters: [{
          key: 'set',
          options: [
            { code: 'wnc', name: 'Welcome to Night City' },
            { code: 'wnc-fr', name: 'Welcome to Night City FR' },
            { code: 'demo', name: 'Demo Deck' },
            { code: 'PRM01', name: 'Set 1 Promos' },
          ],
        }],
      });
    }
    const set = url.searchParams.get('set')!;
    return json({
      total: 1,
      items: [{
        display_name: 'V: Streetkid',
        printings: [
          {
            id,
            collector_number: '005a',
            image_url: `https://dstcynss47vun.cloudfront.net/prod/${id}/render.webp?Expires=1&Signature=x`,
            set: { code: set },
            rarity: 'Rare',
            language: set.endsWith('-fr') ? 'fr' : 'en',
            localized_name: set.endsWith('-fr') ? 'V : Gosse des rues' : null,
          },
          {
            id: '00000000-0000-4000-8000-000000000000',
            image_url: 'https://dstcynss47vun.cloudfront.net/other.webp',
            set: { code: 'other' },
          },
        ],
      }],
    });
  };
  const client = new CyberpunkCatalog(transport as typeof fetch, async () =>
  {});
  const sets = (await client.sets()).data;
  assert.deepEqual(sets.map(set => set.code), ['wnc', 'demo']);
  assert.deepEqual((await client.languages(sets[0].id)).data, ['en', 'fr']);
  assert.deepEqual((await client.languages(sets[1].id)).data, ['en']);
  const french = (await client.cards(sets[0].id, 'fr')).data;
  assert.equal(french.length, 1);
  assert.equal(french[0].name, 'V : Gosse des rues');
  assert.equal(french[0].imageUrl, `/api/catalog/cyberpunk-image/wnc-fr/${id}.webp?v=2`);
  assert.equal(safeImageUrl(french[0].imageUrl), french[0].imageUrl);
  const image = await client.image('wnc-fr', id);
  assert.equal(image.contentType, 'image/webp');
  assert.equal(imageRequests.length, 1);
  await assert.rejects(client.image('unknown', id));
  await assert.rejects(client.image('wnc', '../secret'));
});
test('images: dangerous protocols, credentials and local addresses excluded', () =>
{
  for (const url of [
    'http://example.com/a',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://127.0.0.1/a',
    'https://169.254.169.254/a',
    'https://[::1]/a',
    'https://localhost/a',
    'https://host.local/a',
    'https://user:pass@cdn.example.com/a',
    'https://cdn.example.com:444/a',
  ]) assert.equal(safeImageUrl(url), null, url);
  assert.equal(safeImageUrl('https://cdn.example.com/card.jpg'), 'https://cdn.example.com/card.jpg');
  assert.equal(
    safeImageUrl('/api/catalog/one-piece-image/en/OP13-001_p1.png'),
    '/api/catalog/one-piece-image/en/OP13-001_p1.png',
  );
  assert.equal(safeImageUrl('/api/catalog/one-piece-image/en/../../secret.png'), null);
});
test('demo API, credential isolation, origins and disabled cart', async (t) =>
{
  const server = createApp({ development: true }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const status = await (await fetch(base + '/api/catalog/status')).json();
  assert.equal(status.mode, 'demo');
  assert.equal(status.tokenPresent, false);
  const gs = await (await fetch(base + '/api/catalog/games')).json();
  assert.equal(gs.data.length, 16);
  assert.equal(gs.data[0].id, MAGIC_GAME_ID);
  assert.equal(new Set(gs.data.map((game: { id: number }) => game.id)).size, 16);
  assert.equal((await fetch(base + '/api/catalog/cards?expansionId=1')).status, 200);
  assert.equal((await fetch(base + '/api/catalog/cards?expansionId=bad')).status, 400);
  assert.equal((await fetch(base + '/api/cardtrader/cart/add', { method: 'POST' })).status, 404);
  assert.equal(
    (await fetch(base + '/api/catalog/status', { headers: { Origin: 'https://evil.example' } })).status,
    403,
  );
  // No image proxy is exposed: arbitrary URLs cannot trigger any server fetch.
  assert.equal((await fetch(base + '/api/cardtrader/image?url=https://169.254.169.254')).status, 404);
  assert.equal((await fetch(base + '/.env.local')).status, 404);
});
test('production allows only the configured public origin', async (t) =>
{
  const probe = createApp().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const cyberpunk = {
    image: async () => ({ bytes: Buffer.from([82, 73, 70, 70]), contentType: 'image/webp' }),
  } as unknown as CyberpunkCatalog;
  const server = createApp({ appOrigins: [origin], cyberpunk, newerCatalogs: [] }).listen(address.port, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const url = origin + '/api/cardtrader/status';
  assert.equal((await fetch(url, { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await fetch(url, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await fetch(url, { headers: { Origin: origin } })).status, 200);
  // Card images are public: an <img> on another site gets them even before the CDN has cached them.
  const image = await fetch(origin + '/api/catalog/cyberpunk-image/wnc/3fc63c58-5954-4744-a5af-047bfc5cb159.webp?v=2', {
    headers: { 'Sec-Fetch-Site': 'cross-site' },
  });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/webp');
});
test('decklist: Arena, Pokémon TCG Live, printed ids, SWU and FaB formats', () =>
{
  const entries = parseDecklist(
    'Deck\n4 Lightning Bolt (M11) 149 *F*\n4x Counterspell\n\nPokémon: 2\n3 Charizard ex OBF 125\n1xOP13-001\n1 | Darth Vader | Dark Lord of the Sith\n(3) Command and Conquer (red)\n// comment\nSideboard\nPyroblast x2\n0 Nothing',
  );
  assert.deepEqual(entries.map(entry => [entry.quantity, entry.name, entry.setCode, entry.number, entry.cardId]), [
    [4, 'Lightning Bolt', 'M11', '149', null],
    [4, 'Counterspell', null, null, null],
    [3, 'Charizard ex', 'OBF', '125', null],
    [1, null, 'OP13', '001', 'OP13-001'],
    [1, 'Darth Vader, Dark Lord of the Sith', null, null, null],
    [3, 'Command and Conquer (red)', null, null, null],
    [2, 'Pyroblast', null, null, null],
  ]);
  assert.equal(parseDecklistLine('999 Too Many')!.quantity, 100);
  assert.equal(parseDecklist(Array.from({ length: 400 }, () => '1 Card').join('\n')).length, 250);
  assert.ok(codeCoversPrefix('BT01-03', 'BT1'));
  assert.ok(codeCoversPrefix('BT-26', 'BT26'));
  assert.ok(codeCoversPrefix('OP-13', 'OP13'));
  assert.ok(!codeCoversPrefix('BT01-03', 'BT4'));
  assert.ok(!codeCoversPrefix('EX-13', 'BT13'));
});
test('decklist: codes with a slash, one-digit Lorcana sets, Yu-Gi-Oh! codes and Fabrary/Riftbound exports', () =>
{
  const entries = parseDecklist(
    'Name: Nuu Blitz\nHero: Nuu, Alluring Desire\nFormat: Blitz\nDeck cards\n4x UE01BT/JJK-1-001_p1\n3 DZ-BT15/022EN\n2 Circle of Life (9) 26\n1 Called by the Grave (RA01) RA01-EN066\nChampion:\n1 Fire/Ice',
  );
  assert.deepEqual(entries.map(entry => [entry.quantity, entry.name, entry.setCode, entry.number, entry.cardId]), [
    [1, 'Nuu, Alluring Desire', null, null, null],
    [4, null, 'UE01BT', 'JJK-1-001', 'UE01BT/JJK-1-001_P1'],
    [3, null, 'DZ-BT15', '022EN', 'DZ-BT15/022EN'],
    [2, 'Circle of Life', '9', '26', null],
    [1, 'Called by the Grave', 'RA01', 'RA01-EN066', null],
    [1, 'Fire/Ice', null, null, null],
  ]);
});
test('generic import: number, printed id, name, language and sheet limits', async () =>
{
  const card = (
    id: number,
    expansionId: number,
    name: string,
    number: string,
    language = 'en',
    version: string | null = null,
  ) => ({
    id,
    gameId: 1,
    categoryId: 1,
    expansionId,
    name,
    version,
    collectorNumber: number,
    rarity: null,
    language,
    imageUrl: null,
  });
  const cards: Record<string, ReturnType<typeof card>[]> = {
    '2:en': [card(21, 2, 'Elsa - Snow Queen', '53'), card(22, 2, 'Elsa - Snow Queen', '53', 'en', 'Parallel 1')],
    '2:it': [
      card(31, 2, 'Elsa - Regina delle Nevi', '53', 'it'),
      card(32, 2, 'Elsa - Regina delle Nevi', '53', 'it', 'Parallela 1'),
    ],
    '1:en': [card(11, 1, 'Agumon', 'BT1-010')],
    '1:it': [],
  };
  const loads: string[] = [];
  const catalog = {
    game: { id: 1, name: 'Test', displayName: 'Test', printLanguages: ['en', 'it'] },
    isExpansionId: () => true,
    sets: async () => ({
      data: [
        { id: 2, gameId: 1, code: 'SET-2', name: 'New', releaseDate: '2026-01-01' },
        { id: 1, gameId: 1, code: 'BT01-03', name: 'Old', releaseDate: '2020-01-01' },
      ],
      updatedAt: '',
    }),
    cards: async (id: number, language: string) =>
    {
      loads.push(`${id}:${language}`);
      return { data: cards[`${id}:${language}`] ?? [], updatedAt: '' };
    },
    languages: async () => ({ data: ['en'], updatedAt: '' }),
  };
  const result = await importDecklist(
    catalog,
    parseDecklist('4 Elsa - Snow Queen\n60 Elsa (SET-2) 53\n4 BT1-010\n1 Missing Card\n1 Missing (SET-2) 999'),
    'it',
  );
  assert.deepEqual(result.items.map(item => [item.card.id, item.quantity]), [[31, 64], [11, 4]]);
  assert.deepEqual(result.unresolved, ['1 Missing Card', '1 Missing (SET-2) 999']);
  assert.deepEqual(
    mergeImported([{ card: card(1, 1, 'A', '1'), quantity: 80 }, { card: card(1, 1, 'A', '1'), quantity: 80 }]).map(
      item => item.quantity,
    ),
    [100],
  );
  const full = mergeImported(
    Array.from({ length: 10 }, (_, index) => ({ card: card(index + 1, 1, 'Card', '1'), quantity: 100 })),
  );
  assert.equal(full.length, 9);
  assert.equal(full.reduce((sum, item) => sum + item.quantity, 0), 900);
  const slow = await importDecklist(catalog, parseDecklist('1 Missing Card'), 'en', { budgetMs: -1 });
  assert.deepEqual(slow.pending, ['1 Missing Card']);
  assert.equal(slow.scanFrom, 0);
  // The card index sends a name straight to the set holding it: the newer set is never loaded.
  loads.length = 0;
  const index = {
    game: 'digimon' as const,
    known: [],
    setsCheckedAt: null,
    sets: [{
      id: -5,
      slug: 'old',
      code: 'BT01-03',
      name: 'Old',
      releaseDate: null,
      languages: ['en'],
      cards: [['agumon', 'Agumon', 'BT1-010'] as [string, string, string]],
      refreshedAt: '',
    }],
  };
  const indexed = await importDecklist(catalog, parseDecklist('2 Agumon'), 'en', { index });
  assert.deepEqual(indexed.items.map(item => item.card.id), [11]);
  assert.deepEqual(loads, ['1:en']);
});
test('Yu-Gi-Oh! YDK import and Pokémon TCG Live basic energies', async () =>
{
  const requests: string[] = [];
  const transport = async (input: URL | RequestInfo) =>
  {
    const url = new URL(String(input));
    requests.push(url.search);
    if (url.pathname.endsWith('cardsets.php'))
    {
      return json([
        { set_name: 'Old Set', set_code: 'OLD', num_of_cards: 10, tcg_date: '2002-01-01' },
        { set_name: 'New Set', set_code: 'NEW', num_of_cards: 10, tcg_date: '2025-01-01' },
      ]);
    }
    return json({
      data: [{
        id: 89631139,
        name: 'Blue-Eyes White Dragon',
        type: 'Normal Monster',
        card_sets: [{ set_name: 'Old Set', set_code: 'OLD-001' }, { set_name: 'New Set', set_code: 'NEW-001' }],
        card_images: [
          { id: 89631139, image_url: 'https://images.ygoprodeck.com/images/cards/89631139.jpg' },
          { id: 89631146, image_url: 'https://images.ygoprodeck.com/images/cards/89631146.jpg' },
        ],
      }],
    });
  };
  const client = new YugiohCatalog(transport as typeof fetch, async () =>
  {});
  const result = await client.importCards(parseDecklist('#main\n89631139\n89631139\n89631146\n12345678\n!side'));
  assert.deepEqual(
    result.items.map(item => [item.card.collectorNumber, item.quantity, item.card.imageUrl?.slice(-12)]),
    [['NEW-001', 2, '89631139.jpg'], ['NEW-001', 1, '89631146.jpg']],
  );
  assert.deepEqual(result.unresolved, ['12345678']);
  assert.equal(requests.filter(search => search.includes('id=')).length, 1);
  assert.deepEqual(
    ['Basic {R} Energy SVE 2', 'Basic Water Energy SVE 3', 'Energy Switch SVI 173'].map(line =>
      basicEnergy(parseDecklistLine('4 ' + line)!).name
    ),
    ['Fire Energy', 'Water Energy', 'Energy Switch'],
  );
});
test('card pages: stable slugs across languages, limited hreflang and 404', async () =>
{
  const card = (id: number, name: string, number: string | null, language = 'en', version: string | null = null) => ({
    id,
    gameId: 9_000_000_004,
    categoryId: 1,
    expansionId: 7,
    name,
    version,
    collectorNumber: number,
    rarity: 'Rare',
    language,
    imageUrl: `https://api.lorcana.ravensburger.com/images/${language}/${id}.jpg`,
  });
  assert.deepEqual(
    [
      ...cardSlugs([
        card(1, 'Elsa', '1'),
        card(2, 'Elsa', '1', undefined, 'Parallel'),
        card(3, 'Anna', 'OP13-001'),
        card(4, 'Seer', null),
      ])
        .values(),
    ],
    ['1', '1-2', 'op13-001', 'seer'],
  );
  const lists: Record<string, ReturnType<typeof card>[]> = {
    en: [card(1, 'Elsa - Snow Queen', '53'), card(2, 'Anna - Heir', '54')],
    it: [card(11, 'Elsa - Regina delle Nevi', '53', 'it'), card(12, 'Anna - Erede', '54', 'it')],
  };
  const catalog = {
    game: {
      id: 9_000_000_004,
      name: 'Lorcana',
      displayName: 'Disney Lorcana',
      printLanguages: ['en', 'it', 'de', 'fr'],
    },
    isExpansionId: () => true,
    sets: async () => ({
      data: [{ id: 7, gameId: 9_000_000_004, code: '10', name: 'Whispers in the Well', releaseDate: '2025-08-29' }],
      updatedAt: '',
    }),
    cards: async (_id: number, language: string) => ({ data: lists[language] ?? [], updatedAt: '' }),
    languages: async () => ({ data: ['en', 'it'], updatedAt: '' }),
  };
  const page = await renderCardPage(
    { language: 'it', game: 'disney-lorcana', set: 'whispers-in-the-well', card: '53' },
    [catalog],
    'https://sleeveready.example',
    false,
  );
  assert.equal(page.status, 200);
  if (page.status !== 200) return;
  assert.match(
    page.html,
    /<title>Elsa - Regina delle Nevi \(Whispers in the Well #53\) – Carta e proxy da stampare<\/title>/,
  );
  assert.match(
    page.html,
    /<meta name="description" content="Elsa - Regina delle Nevi è la carta 53 di Whispers in the Well\. Stampala gratis come proxy/,
  );
  assert.match(page.html, /<h1 id="card-title">Elsa - Regina delle Nevi<\/h1>/);
  assert.match(page.html, /data-game="lorcana"/);
  assert.match(page.html, /href="\/app\.css"/);
  assert.match(page.html, /class="cp-chip is-current">italiano</);
  assert.match(page.html, /images\/it\/11\.jpg/);
  assert.deepEqual([...page.html.matchAll(/<link rel="alternate" hreflang="([a-z-]+)"/g)].map(match => match[1]), [
    'en',
    'it',
    'x-default',
  ]);
  assert.match(
    page.html,
    /<meta name="robots" content="noindex,follow"\/>/,
    'Lorcana card pages stay out of search engines',
  );
  assert.match(page.html, /href="\/it\/disney-lorcana\/whispers-in-the-well\/54\/">.*?Anna - Erede</);
  assert.match(page.html, /src="\/app-loader\.js"/);
  assert.deepEqual(
    await renderCardPage(
      { language: 'de', game: 'disney-lorcana', set: 'whispers-in-the-well', card: '53' },
      [catalog],
      'https://sleeveready.example',
      false,
    ),
    { status: 302, location: '/en/disney-lorcana/whispers-in-the-well/53/' },
  );
  assert.equal(
    (await renderCardPage(
      { language: 'it', game: 'disney-lorcana', set: 'whispers-in-the-well', card: '999' },
      [catalog],
      'https://sleeveready.example',
      false,
    ))
      .status,
    404,
  );
  assert.equal(
    (await renderCardPage(
      { language: 'en', game: 'disney-lorcana', set: 'unknown', card: '53' },
      [catalog],
      'https://sleeveready.example',
      true,
    ))
      .status,
    404,
  );
});
test('alternate versions: same name or number in the set, then other sets in catalog order', async () =>
{
  const card = (id: number, name: string, number: string, expansionId = 7) => ({
    id,
    gameId: 9_000_000_002,
    categoryId: 1,
    expansionId,
    name,
    version: null,
    collectorNumber: number,
    rarity: null,
    language: 'en',
    imageUrl: null,
  });
  const english = [card(1, 'Poltchageist', '5'), card(2, 'Sinistcha', '6'), card(3, 'Poltchageist', '171'), {
    ...card(4, 'Cadet', '5'),
    rarity: 'Token',
  }];
  const sets = [
    { id: 7, gameId: 9_000_000_002, code: 'ME05', name: 'Pitch Black' },
    { id: 9, gameId: 9_000_000_002, code: 'SV06', name: 'Twilight Masquerade' },
    { id: 8, gameId: 9_000_000_002, code: 'SV05', name: 'Temporal Forces' },
  ];
  let failing = false;
  const catalog = {
    game: { id: 9_000_000_002, name: 'Pokemon', displayName: 'Pokémon' },
    isExpansionId: () => true,
    sets: async () => ({ data: sets, updatedAt: '' }),
    cards: async () => ({ data: english, updatedAt: '' }),
    languages: async () => ({ data: ['en'], updatedAt: '' }),
    otherPrintings: async () =>
    {
      if (failing) throw new Error('down');
      return [
        card(20, 'Poltchageist', '020', 8),
        card(21, 'Poltchageist', '021', 9),
        card(1, 'Poltchageist', '5'),
        card(30, 'Poltchageist', '1', 404),
      ];
    },
  };
  const found = await alternativePrintings(catalog, sets[0], english, english[0]);
  assert.deepEqual(found.map(item => item.set + '/' + item.slug), ['me05/171', 'sv06/021', 'sv05/020']);
  failing = true;
  assert.deepEqual((await alternativePrintings(catalog, sets[0], english, english[0])).map(item => item.slug), ['171']);
});
test('card pages: summary sentence from real data, text and names in other languages', async () =>
{
  assert.equal(
    cardSummary('it', {
      name: 'Poltchageist',
      set: 'Pitch Black',
      number: '005',
      kind: 'Pokémon · Base · Erba',
      hp: '30',
      illustrator: 'Mousho',
      otherSets: ['Twilight Masquerade', 'Pitch Black', 'Twilight Masquerade'],
    }),
    'Poltchageist è la carta 005 di Pitch Black (Pokémon · Base · Erba), 30 PS. Illustrazione di Mousho. Stampata anche in Twilight Masquerade.',
  );
  assert.equal(
    cardSummary('en', { name: 'Elsa', set: 'The First Chapter', number: null, otherSets: [] }),
    'Elsa is a card from The First Chapter.',
  );
  const card = (id: number, name: string, language = 'en') => ({
    id,
    gameId: 9_000_000_002,
    categoryId: 1,
    expansionId: 7,
    name,
    version: null,
    collectorNumber: '5',
    rarity: null,
    language,
    imageUrl: null,
  });
  const catalog = {
    game: { id: 9_000_000_002, name: 'Pokemon', displayName: 'Pokémon', printLanguages: ['en', 'it', 'de'] },
    isExpansionId: () => true,
    sets: async () => ({ data: [{ id: 7, gameId: 9_000_000_002, code: 'ME05', name: 'Pitch Black' }], updatedAt: '' }),
    cards: async (_: number, language: string) => ({
      data: [card(1, { en: 'Poltchageist', it: 'Poltchageist', de: 'Mortcha' }[language] ?? 'Poltchageist', language)],
      updatedAt: '',
    }),
    languages: async () => ({ data: ['en', 'it', 'de'], updatedAt: '' }),
    details: async () => ({
      kind: 'Pokémon · Base · Erba',
      hp: '30',
      illustrator: 'Mousho',
      retreat: '0',
      blocks: [{ title: 'Lascito Furtivo', meta: 'Incolore', text: 'Metti un segnalino <danno>.' }],
    }),
  };
  const page = await renderCardPage(
    { language: 'it', game: 'pokemon', set: 'me05', card: '5' },
    [catalog],
    'https://sleeveready.example',
    false,
    { allNames: true },
  );
  assert.equal(page.status, 200);
  if (page.status !== 200) return;
  assert.match(page.html, /<meta name="robots" content="index,follow"\/>/);
  // The function does not load every language for one page; only the build writes the names.
  const loaded: string[] = [];
  const lean = await renderCardPage(
    { language: 'it', game: 'pokemon', set: 'me05', card: '5' },
    [{
      ...catalog,
      cards: (id: number, language: string) =>
      {
        loaded.push(language);
        return catalog.cards(id, language);
      },
    }],
    'https://sleeveready.example',
    false,
  );
  assert.equal(lean.status, 200);
  if (lean.status !== 200) return;
  assert.doesNotMatch(lean.html, /Mortcha/);
  assert.deepEqual(loaded, ['en', 'it']);
  assert.match(
    page.html,
    /<meta name="description" content="Poltchageist è la carta 5 di Pitch Black \(Pokémon · Base · Erba\), 30 PS\. Illustrazione di Mousho\./,
  );
  assert.match(page.html, /<strong>Lascito Furtivo<\/strong><span>Incolore<\/span>/);
  assert.match(page.html, /segnalino &lt;danno&gt;/);
  assert.match(page.html, /<span lang="de">Mortcha<\/span>/);
  assert.doesNotMatch(page.html, /<span lang="en">/, 'same name as shown is not repeated');
  assert.match(page.html, /"@type":"FAQPage"/);
  assert.match(
    page.html,
    /<summary>Chi ha illustrato Poltchageist\?<\/summary><p>L&#39;illustrazione di questa stampa è di Mousho\.<\/p>/,
  );
  assert.doesNotMatch(page.html, /In quali altre espansioni/, 'a question without its fact is left out');
});
test('dedicated pages: tokens for Magic only, most printed for every game', () =>
{
  assert.deepEqual(parseSeoPath('/it/magic-the-gathering/tokens/'), {
    language: 'it',
    game: 'magic-the-gathering',
    feature: 'tokens',
  });
  assert.deepEqual(parseSeoPath('/de/pokemon/top-proxies/'), {
    language: 'de',
    game: 'pokemon',
    feature: 'top-proxies',
  });
  assert.deepEqual(
    parseSeoPath('/it/pokemon/tokens/'),
    { language: 'it', game: 'pokemon' },
    'tokens is reserved, not an expansion',
  );
  assert.deepEqual(parseSeoPath('/it/magic-the-gathering/tokens/1/'), { language: 'it', game: 'magic-the-gathering' });
  assert.equal(featurePaths.length, 5 * (seoGames.length + 1));
  assert.ok(featurePaths.includes('/es/cyberpunk/top-proxies/'));
  assert.ok(!featurePaths.includes('/en/pokemon/tokens/'));
  assert.equal(
    seoFeatureCopy('it', 'magic-the-gathering', 'tokens').title,
    'Token ed emblemi Magic da stampare | SleeveReady',
  );
  assert.match(seoFeatureCopy('fr', 'one-piece', 'top-proxies').h1, /les plus imprimés/);
  assert.ok(allIndexablePaths.includes('/it/magic-the-gathering/tokens/'));
});
test('default paper size by country and centred grid with bleed', () =>
{
  assert.equal(defaultPaper(['en-US']), 'letter');
  assert.equal(defaultPaper(['es-MX', 'en']), 'letter');
  assert.equal(defaultPaper(['it-IT']), 'a4');
  assert.equal(defaultPaper(['en-GB']), 'a4');
  assert.equal(defaultPaper(['bad tag', 'fr-CA']), 'letter');
  const base = (change: Partial<PrintSettings>): PrintSettings => ({ ...defaultSettings(['it-IT']), ...change });
  assert.equal(clampSpacing(1.26), 1.5);
  assert.equal(clampSpacing(40), 12);
  const letter = pageLayout(base({ paper: 'letter', spacingX: 2, spacingY: 2, bleed: 1 }));
  assert.equal(letter.slotWidth, 65);
  assert.equal(letter.slotHeight, 90);
  assert.ok(Math.abs(letter.padX - 10.45) < 1e-9);
  assert.ok(Math.abs(letter.padY - 4.7) < 1e-9);
  assert.equal(letter.bleedSize, 1);
  assert.equal(letter.perPage, 9);
  // Bleed widens the spacing it needs; A4 portrait 3 × 3, landscape 4 × 2.
  assert.deepEqual([pageLayout(base({ bleed: 3 })).spacingX, pageLayout(base({ bleed: 3 })).spacingY], [6, 6]);
  assert.deepEqual(
    [pageLayout(base({})).padX, pageLayout(base({})).padY, pageLayout(base({})).perPage],
    [10.5, 16.5, 9],
  );
  const landscape = pageLayout(base({ orientation: 'landscape' }));
  assert.deepEqual([landscape.width, landscape.height, landscape.columns, landscape.rows], [297, 210, 4, 2]);
  // Silhouette marks need room: A4 portrait drops to 2 × 3, landscape keeps 4 × 2.
  const marked = pageLayout(base({ marks: 'silhouette' }));
  assert.ok(marked.margin >= 13.5);
  assert.deepEqual([marked.columns, marked.rows], [2, 3]);
  const markedLandscape = pageLayout(base({ orientation: 'landscape', marks: 'silhouette' }));
  assert.deepEqual([markedLandscape.columns, markedLandscape.rows], [4, 2]);
  assert.deepEqual(markRects(markedLandscape)[0], { x: 10, y: 10, width: 5, height: 5 });
  assert.equal(markRects(pageLayout(base({}))).length, 0);
  // No card overlaps a mark.
  for (const layout of [marked, markedLandscape, pageLayout(base({ paper: 'letter', marks: 'silhouette', bleed: 2 }))])
  {
    for (const mark of markRects(layout))
    {
      for (const card of cardRects(layout))
      {
        assert.ok(
          card.x - 3 >= mark.x + mark.width || card.x + 63 + 3 <= mark.x || card.y - 3 >= mark.y + mark.height
            || card.y + 88 + 3 <= mark.y,
          'card clear of the marks',
        );
      }
    }
  }
  assert.ok(cropLines(pageLayout(base({}))).length > 0);
  const svg = cutSvg(markedLandscape);
  assert.match(svg, /width="297mm" height="210mm" viewBox="0 0 297 210"/);
  assert.equal((svg.match(/rx="3"/g) ?? []).length, 8);
  assert.match(svg, /id="registration-marks"/);
  assert.equal((cutSvg(pageLayout(base({ rounded: false }))).match(/rx="0"/g) ?? []).length, 9);
  // Saved settings from before the cutter options: bleed on meant 1 mm.
  assert.deepEqual(
    normalizeSettings({ paper: 'letter', spacing: 2, bleed: true, guides: 'corners' } as never, base({})),
    { ...base({ paper: 'letter' }), spacingX: 2, spacingY: 2, bleed: 1, cardGuides: 'none', pageGuides: 'margins' },
  );
});
test('SEO: a game page names the latest set and the upcoming one with cards already revealed', () =>
{
  const sets = [
    { name: 'Far Future', releaseDate: '2027-03-01', revealed: 0 },
    { name: 'Star Trek', releaseDate: '2026-11-13', revealed: 491 },
    { name: 'Reality Fracture', releaseDate: '2026-10-02', revealed: 290 },
    { name: 'Older', releaseDate: '2026-06-01' },
  ];
  const info = gameSetsInfo(sets, '2026-10-28');
  assert.deepEqual(info, {
    latest: { name: 'Reality Fracture', date: '2026-10-02' },
    coming: { name: 'Star Trek', date: '2026-11-13', revealed: 491 },
  });
  const faq = seoPageCopy('it', 'magic-the-gathering', info).faq;
  const latest = faq.find(item => item.question === 'Qual è l’ultima espansione di Magic: The Gathering?');
  assert.equal(
    latest?.answer,
    'L’ultima espansione è Reality Fracture, uscita il 2 ottobre 2026: qui puoi stamparne tutte le carte. Star Trek esce il 13 novembre 2026 e le 491 carte rivelate finora sono già stampabili.',
  );
  assert.equal(
    seoPageCopy('en', 'cyberpunk', gameSetsInfo([{ name: 'Welcome to Night City', releaseDate: null }], '2026-10-28'))
      .faq
      .find(item => /latest/.test(item.question))
      ?.answer,
    'The latest set is Welcome to Night City: every card in it can be printed here.',
  );
  assert.equal(
    seoPageCopy('en', 'pokemon').faq.some(item => /latest/.test(item.question)),
    false,
    'no sets known, no question',
  );
});

test('SEO routes have stable language and game paths', () =>
{
  assert.equal(seoPath('it', 'pokemon'), '/it/pokemon/');
  assert.deepEqual(parseSeoPath('/en/magic-the-gathering/'), { language: 'en', game: 'magic-the-gathering' });
  assert.equal(indexableSeoPaths.length, 5 * (seoGames.length + 1));
  assert.deepEqual(parseSeoPath('/de/disney-lorcana/'), { language: 'de', game: 'disney-lorcana' });
  assert.match(seoPageCopy('de', 'pokemon').title, /auf Deutsch/);
  assert.doesNotMatch(seoPageCopy('de', 'gundam').title, /Deutsch/);
  assert.match(seoPageCopy('fr', 'one-piece').h1, /en français/);
  assert.doesNotMatch(seoPageCopy('es', 'one-piece').h1, /español/);
  assert.match(seoPageCopy('it', 'disney-lorcana').faq.at(-1)!.answer, /inglese, italiano, tedesco e francese/);
  assert.deepEqual(parseSeoPath('/it/pokemon/sv09/'), { language: 'it', game: 'pokemon', set: 'sv09' });
  assert.equal(seoPath('de', 'one-piece', 'op-13'), '/de/one-piece/op-13/');
  assert.equal(expansionSlug({ code: 'ME02.5', name: 'Ascended Heroes' }), 'me02-5');
  assert.equal(expansionSlug({ code: '10', name: 'Whispers in the Well' }), 'whispers-in-the-well');
  const setCopy = seoSetCopy('it', 'disney-lorcana', {
    name: 'Whispers in the Well',
    code: '10',
    releaseDate: '2025-08-29',
    cardCount: 255,
    languages: ['en', 'it'],
  });
  assert.equal(setCopy.title, 'Proxy Whispers in the Well in italiano da stampare – Disney Lorcana | SleeveReady');
  assert.match(setCopy.description, /29 agosto 2025/);
  // Expansion pages exist only in languages the set is printed in.
  for (const page of seoSetPages())
  {
    assert.ok(page.language === 'en' || (page.set.cards[page.language]?.length ?? 0) > 0);
  }
  assert.ok(allIndexablePaths.length > indexableSeoPaths.length);
  assert.equal(new Set(allIndexablePaths).size, allIndexablePaths.length);
  assert.deepEqual(parseSeoPath('/it/digimon/'), { language: 'it', game: 'digimon' });
  assert.equal(parseSeoPath('/it/riftbound/').game, undefined, 'Riftbound is off (shared/games.ts)');
  assert.deepEqual(parseSeoPath('/en/flesh-and-blood/'), { language: 'en', game: 'flesh-and-blood' });
  assert.equal(seoSlugForGame('Dragon Ball Super Dragon Ball Super Card Game'), 'dragon-ball-super');
  assert.equal(seoSlugForGame('Cardfight!! Vanguard'), 'cardfight-vanguard');
  assert.equal(seoSlugForGame('Pokemon Pokémon'), 'pokemon');
  const copy = seoPageCopy('it', 'disney-lorcana');
  assert.match(copy.title, /Lorcana/);
  assert.deepEqual(copy.faq.map(item => item.question), [
    'Come stampo i proxy Disney Lorcana?',
    'In quali lingue sono disponibili le carte Disney Lorcana?',
  ], 'game pages keep only their own questions');
  assert.equal(seoPageCopy('it').faq.length, 4, 'the general questions stay on the home page');
});
test('One Piece: release dates from the official products page', () =>
{
  const html =
    '<h4 class="linkListColTitle">BOOSTER PACK  -THE DOMINANCE OF GOD- [OP-18]</h4><p class="linkListColDate"><span class="head">Release Date</span><time class="newsDate" datetime="2026-11-20">November 20, 2026</time></p><h4 class="linkListColTitle">Limited Card Sleeve</h4><p class="linkListColPrice">USD</p><h4 class="linkListColTitle">EXTRA BOOSTER -HEROINES vol.2- [EB-05]</h4>\n<p class="linkListColDate"><time datetime="2026-10-30">October 30, 2026</time></p>';
  const dates = parseOnePieceReleaseDates(html);
  assert.equal(releaseDateFor('OP-18', dates), '2026-11-20');
  assert.equal(releaseDateFor('EB-05', dates), '2026-10-30');
  assert.equal(dates.size, 2);
  // Sets the page no longer lists take their date from the stored release list (OP-17 is not OP-1).
  assert.equal(releaseDateFor('OP-17', dates), '2026-08-28');
  assert.equal(releaseDateFor('OP15-EB04', new Map()), '2026-04-03');
});
test('shared list: compact encoding, and decoding that drops invalid entries', async () =>
{
  const { encodeSharedList, decodeSharedList } = await import('../shared/shareList.ts');
  const entries = [
    { expansionId: 34176186293, cardId: 41234567890, quantity: 4, language: 'en' },
    { expansionId: 11580231882, cardId: 12345, quantity: 1, language: 'pt-br' },
  ];
  const text = encodeSharedList(entries);
  assert.match(text, /^[0-9a-z.\-_]+$/);
  assert.deepEqual(decodeSharedList(text), entries);
  assert.deepEqual(decodeSharedList(text + '_bad.entry_1.2.999.en_<script>'), entries);
  assert.deepEqual(decodeSharedList(null), []);
  assert.equal(decodeSharedList(Array.from({ length: 400 }, () => 'a.b.1.en').join('_')).length, 250);
});
test('set pages: an upcoming set becomes the spoiler page, then turns normal after release', async () =>
{
  const { seoSetCopy, isUpcomingSet } = await import('../shared/seo.ts');
  const future = { name: 'Radiance', code: 'RAD', releaseDate: '2099-10-23', cardCount: 130, languages: ['en'] };
  const it = seoSetCopy('it', 'digimon', future);
  assert.match(it.title, /^Spoiler Radiance \(RAD\): 130 carte rivelate/);
  assert.match(it.h1, /^Spoiler/);
  assert.match(it.faq[0].question, /^Quando esce Radiance/);
  assert.match(seoSetCopy('en', 'digimon', future).title, /Spoilers: 130 Cards Revealed/);
  const released = seoSetCopy('it', 'digimon', { ...future, releaseDate: '2020-01-01' });
  assert.doesNotMatch(released.title, /Spoiler/);
  assert.equal(isUpcomingSet({ releaseDate: '2026-10-23' }, '2026-10-22'), true);
  assert.equal(isUpcomingSet({ releaseDate: '2026-10-23' }, '2026-10-23'), false);
  assert.equal(isUpcomingSet({ releaseDate: null }), false);
});
test('upcoming set pages: in the sitemap but served live, not generated at build', async () =>
{
  const { allIndexablePaths, staticSeoPaths, upcomingSetPaths } = await import('../shared/seo-sets.ts');
  for (const path of upcomingSetPaths)
  {
    assert.ok(allIndexablePaths.includes(path));
    assert.ok(!staticSeoPaths.includes(path));
  }
  assert.equal(staticSeoPaths.length + upcomingSetPaths.size, allIndexablePaths.length);
});
test('live sitemap: adds new or upcoming sets the snapshot does not know', async () =>
{
  const { liveSetPaths } = await import('../server/live-sets.ts');
  const now = Date.parse('2026-10-05T12:00:00Z');
  const set = (id: number, code: string, name: string, releaseDate: string) => ({
    id,
    gameId: 5,
    code,
    name,
    releaseDate,
  });
  const sizes: Record<number, number> = { 1: 25, 2: 5, 3: 40, 4: 30 };
  const catalog = {
    game: { id: 5, name: 'Digimon', displayName: 'Digimon Card Game' },
    isExpansionId: () => true,
    sets: async () => ({
      data: [
        set(1, 'NXT', 'Next Set', '2026-12-01'),
        set(2, 'TNY', 'Tiny Promo', '2026-11-01'),
        set(3, 'OLD', 'Old Set', '2025-01-01'),
        set(4, 'VEN', 'Vendetta', '2026-07-31'),
      ],
      updatedAt: '',
    }),
    cards: async (id: number) => ({
      data: Array.from({ length: sizes[id] }, (_, index) => ({ id: index })),
      updatedAt: '',
    }),
    languages: async () => ({ data: ['en'], updatedAt: '' }),
  };
  const paths = await liveSetPaths([catalog as never], 2000, now);
  assert.deepEqual(paths, ['/en/digimon/nxt/']);
});

test('link import: Moxfield and Archidekt become list lines, without maybeboard', () =>
{
  assert.deepEqual(deckLinkOf(' https://moxfield.com/decks/Bb-rVdt3Wki4Q8HqKq09QA '), {
    source: 'moxfield',
    id: 'Bb-rVdt3Wki4Q8HqKq09QA',
  });
  assert.deepEqual(deckLinkOf('archidekt.com/decks/123456/my_deck?x=1'), { source: 'archidekt', id: '123456' });
  assert.equal(deckLinkOf('4 Lightning Bolt'), null);
  assert.equal(deckLinkOf('https://moxfield.com/decks/abc def'), null);
  assert.deepEqual(
    moxfieldLines({
      boards: {
        commanders: { cards: { a: { quantity: 1, card: { name: 'Atraxa', set: 'one', cn: '196' } } } },
        mainboard: { cards: { b: { quantity: 4, card: { name: 'Sol Ring', set: 'cmm', cn: '400' } } } },
        maybeboard: { cards: { c: { quantity: 1, card: { name: 'Nope' } } } },
      },
    })
      .map(line => line.name),
    ['Atraxa', 'Sol Ring'],
  );
  assert.deepEqual(
    archidektLines({
      categories: [{ name: 'Maybeboard', includedInDeck: false }, { name: 'Ramp', includedInDeck: true }],
      cards: [
        {
          quantity: 1,
          categories: ['Ramp'],
          card: { collectorNumber: '400', edition: { editioncode: 'cmm' }, oracleCard: { name: 'Sol Ring' } },
        },
        { quantity: 1, categories: ['Maybeboard'], card: { oracleCard: { name: 'Nope' } } },
      ],
    }),
    [{ quantity: 1, name: 'Sol Ring', set: 'cmm', number: '400' }],
  );
});

test('SEO: short card titles led by the name, proxy question only for less-served games', async () =>
{
  const { cardTitle } = await import('../shared/seo.ts');
  assert.equal(
    cardTitle('en', { name: 'Sol Ring', setName: 'Commander Masters', setCode: 'cmm', number: '400' }),
    'Sol Ring (Commander Masters #400) – Card & Printable Proxy | SleeveReady',
  );
  assert.equal(
    cardTitle('en', {
      name: 'Avacyn, Angel of Horror',
      setName: 'Shadows over Innistrad Remastered',
      setCode: 'sir',
      number: '101',
    }),
    'Avacyn, Angel of Horror (SIR #101) – Card & Printable Proxy | SleeveReady',
  );
  assert.equal(
    cardTitle('en', {
      name: 'Kozilek, the Great Distortion',
      setName: 'Oath of the Gatewatch',
      setCode: 'ogw',
      number: '4',
    }),
    'Kozilek, the Great Distortion (OGW #4) – Card & Printable Proxy',
  );
  assert.match(seoPageCopy('en', 'cyberpunk').faq[0].question, /How do I print Cyberpunk TCG proxies\?/);
  assert.match(seoPageCopy('it', 'digimon').faq[0].answer, /EX13-015/);
  assert.equal(seoPageCopy('en', 'pokemon').faq.length, 1);
});

test('card page: deck links, price rows and EDHREC slug', async () =>
{
  const { deckSites, edhrecSlug } = await import('../shared/deck-sites.ts');
  const { shopTiles } = await import('../shared/card-extras.ts');
  assert.equal(edhrecSlug('Archangel Avacyn // Avacyn, the Purifier'), 'archangel-avacyn');
  assert.equal(edhrecSlug("Lim-Dûl's Vault"), 'lim-duls-vault');
  assert.deepEqual(
    deckSites('magic-the-gathering', { englishName: 'Sol Ring', number: '400' }).map(site => site.site),
    ['EDHREC', 'MTGTop8'],
  );
  assert.equal(
    deckSites('one-piece', { englishName: 'Nami', number: 'OP01-016_p1' })[0].url,
    'https://onepiece.limitlesstcg.com/cards/OP01-016',
  );
  assert.deepEqual(deckSites('gundam', { englishName: 'Gundam', number: 'GD01-001' }), []);
  const tiles = shopTiles(
    'it',
    [
      { market: 'CardTrader', currency: 'EUR', amount: 0.55, foil: false, updated: '2026-10-06', from: true },
      { market: 'TCGplayer', currency: 'USD', amount: 3.36, foil: true, updated: '2026-10-06' },
      { market: 'Cardmarket', currency: 'EUR', amount: 1.62, foil: false, updated: '2026-10-06' },
    ],
    [
      { shop: 'eBay', url: 'https://www.ebay.it/', sponsored: false },
      { shop: 'CardTrader', url: 'https://www.cardtrader.com/', sponsored: false },
      { shop: 'TCGplayer', url: 'https://www.tcgplayer.com/', sponsored: false },
    ],
  );
  assert.deepEqual(tiles.map(tile => tile.shop), ['TCGplayer', 'CardTrader', 'eBay']);
  assert.match(tiles[1].value, /^da 0,55\s€$/);
  assert.equal(tiles[2].value, 'Cerca');
  assert.ok(tiles[0].foil);
});

test('eBay price: the lowest Buy It Now with the card name, without graded cards, lots or proxies', async () =>
{
  const { ebayPrice } = await import('../server/ebay-price.ts');
  const original = globalThis.fetch;
  process.env.EBAY_CLIENT_ID = 'test-id';
  process.env.EBAY_CLIENT_SECRET = 'test-secret';
  globalThis.fetch = (async (input: string | URL) =>
  {
    const url = String(input);
    if (url.includes('/oauth2/token')) return new Response(JSON.stringify({ access_token: 't', expires_in: 7200 }));
    return new Response(JSON.stringify({
      itemSummaries: [
        { title: 'PSA 10 Sol Ring Commander Masters', price: { value: '1.00', currency: 'EUR' } },
        { title: '4x Sol Ring Commander Masters', price: { value: '1.50', currency: 'EUR' } },
        { title: 'Sol Ring proxy', price: { value: '0.50', currency: 'EUR' } },
        { title: 'Arcane Signet Commander Masters', price: { value: '0.80', currency: 'EUR' } },
        { title: 'MTG Sol Ring - Commander Masters 400 NM', price: { value: '2.10', currency: 'EUR' } },
      ],
    }));
  }) as typeof fetch;
  try
  {
    const price = await ebayPrice('it', { name: 'Sol Ring', set: 'Commander Masters' });
    assert.deepEqual(
      { market: price?.market, amount: price?.amount, currency: price?.currency, from: price?.from },
      { market: 'eBay', amount: 2.1, currency: 'EUR', from: true },
    );
    const { lowMedian } = await import('../shared/card-extras.ts');
    assert.equal(lowMedian([1, 2, 3, 10, 20, 99]), 3);
    assert.equal(lowMedian([0.5, 1.5]), 1);
    assert.equal(lowMedian([]), null);
  }
  finally
  {
    globalThis.fetch = original;
    delete process.env.EBAY_CLIENT_ID;
    delete process.env.EBAY_CLIENT_SECRET;
  }
});

test('Archidekt decks: public, with format, author and images from Archidekt only', async () =>
{
  const { archidektDecks } = await import('../server/archidekt-decks.ts');
  const { deckMeta } = await import('../shared/deck-sites.ts');
  const original = globalThis.fetch;
  let asked = '';
  globalThis.fetch = (async (input: string | URL) =>
  {
    asked = String(input);
    return new Response(JSON.stringify({
      results: [
        {
          id: 1,
          name: 'Kaalia of the Vast',
          deckFormat: 3,
          viewCount: 2987,
          owner: { username: 'Maynette' },
          featured: 'https://storage.googleapis.com/archidekt-card-images/soi/x.jpg',
        },
        { id: 2, name: 'Secret', deckFormat: 3, viewCount: 9, private: true },
        { id: 3, name: 'Odd art', deckFormat: 99, viewCount: 5, featured: 'https://evil.example/x.jpg' },
      ],
    }));
  }) as typeof fetch;
  try
  {
    const decks = await archidektDecks('Archangel Avacyn // Avacyn, the Purifier');
    assert.match(asked, /cardName=Archangel\+Avacyn\+%2F%2F\+Avacyn%2C\+the\+Purifier/);
    assert.deepEqual(
      decks.map(
        deck => [
          deck.name,
          deck.url,
          deck.format,
          deck.image?.startsWith('https://storage.googleapis.com/archidekt-card-images/') ?? null,
        ],
      ),
      [
        ['Kaalia of the Vast', 'https://archidekt.com/decks/1', 'Commander', true],
        ['Odd art', 'https://archidekt.com/decks/3', null, null],
      ],
    );
    assert.equal(deckMeta('it', decks[0]), 'Commander · Maynette · 3K visualizzazioni');
  }
  finally
  {
    globalThis.fetch = original;
  }
});

test('card data per game: One Piece backs, Riftbound text, symbols and tags in text', async () =>
{
  const { parseOnePieceBack } = await import('../server/onepiece.ts');
  const { riftboundText } = await import('../server/riftbound.ts');
  const { textParts } = await import('../shared/card-symbols.ts');
  const back = parseOnePieceBack(
    '<div class="cost"><h3>Life</h3>5</div> <div class="attribute"> <h3>Attribute</h3> <img src="x" alt="Special"><i>Special</i> </div><div class="counter"><h3>Counter</h3>-</div><div class="text"><h3>Effect</h3>[On Play] Draw 1.<br>[Once Per Turn] Give &amp; take.</div>',
  );
  assert.deepEqual(back, {
    cost: { label: 'Life', value: '5' },
    attribute: { label: 'Attribute', value: 'Special' },
    text: { label: 'Effect', value: '[On Play] Draw 1.\n[Once Per Turn] Give & take.' },
  });
  assert.equal(
    riftboundText('<p>When I conquer, buff me.</p><p>(+1 :rb_might: &amp; more)</p>'),
    'When I conquer, buff me.\n(+1 :rb_might: & more)',
  );
  assert.deepEqual(textParts('[On Play] Draw', 'one-piece'), [{ tag: 'On Play' }, { text: ' Draw' }]);
  assert.equal(
    (textParts('+1 :rb_might: buff', 'riftbound')[1] as { url: string }).url,
    'https://assetcdn.rgpub.io/public/live/riot-shared/player-experiences/riot-glyphs/rb/latest/might.svg',
  );
  assert.deepEqual(textParts('Lore ◊', 'disney-lorcana'), [{ text: 'Lore ◊' }]);
});

test('print and cut: mirrored backs for duplex, Cricut 2 × 2 without bleed, Brother with gap', async () =>
{
  const { backSlot, defaultSettings: defaults, pageLayout: layoutOf } = await import('../src/lib/printSettings.ts');
  const portrait = { columns: 3, rows: 3, orientation: 'portrait' as const };
  const landscape = { columns: 4, rows: 2, orientation: 'landscape' as const };
  // Long edge of a portrait page: columns swap (0 1 2 → 2 1 0); short edge: rows swap.
  assert.deepEqual([0, 1, 2, 3].map(index => backSlot(index, portrait, 'long')), [2, 1, 0, 5]);
  assert.deepEqual([0, 1, 2].map(index => backSlot(index, portrait, 'short')), [6, 7, 8]);
  // Landscape: the long edge is the top, so rows swap; the short edge swaps columns.
  assert.deepEqual([0, 3].map(index => backSlot(index, landscape, 'long')), [4, 7]);
  assert.deepEqual([0, 3].map(index => backSlot(index, landscape, 'short')), [3, 0]);
  const cricut = layoutOf({ ...defaults(['it-IT']), marks: 'cricut', bleed: 2 });
  assert.deepEqual([cricut.columns, cricut.rows, cricut.bleedSize, cricut.spacingX], [2, 2, 0, 3]);
  const brother = layoutOf({ ...defaults(['it-IT']), marks: 'brother' });
  assert.equal(brother.spacingY, 3);
  assert.deepEqual([brother.columns, brother.rows], [3, 3]);
});

test('advanced layout: Yu-Gi-Oh! size, X/Y gaps, manual grid, offset, guides and 4-point markers', async () =>
{
  const {
    defaultSettings: defaults,
    pageLayout: layoutOf,
    cardGuideShapes,
    pageGuideLines,
    markRects: marksOf,
    cardDimensions,
    normalizeSettings: normalize,
  } = await import('../src/lib/printSettings.ts');
  const base = { ...defaults(['it-IT']) };
  // Automatic size: 59 × 86 when every card is Yu-Gi-Oh!; custom sizes are kept within 20–200 mm.
  assert.deepEqual(cardDimensions(base, true), { width: 59, height: 86 });
  assert.deepEqual(cardDimensions(base, false), { width: 63, height: 88 });
  assert.deepEqual(cardDimensions({ ...base, cardSize: 'custom', cardWidth: 70, cardHeight: 120 }), {
    width: 70,
    height: 120,
  });
  const small = layoutOf(base, true);
  assert.deepEqual([small.cardWidth, small.cardHeight, small.columns, small.rows], [59, 86, 3, 3]);
  // Separate spacing per axis, a manual 2 × 2 grid (never more than fits) and a shift of the whole grid.
  const manual = layoutOf({ ...base, spacingX: 4, spacingY: 1, columns: 2, rows: 2, offsetX: 1.5 });
  assert.deepEqual([manual.slotWidth, manual.slotHeight, manual.columns, manual.rows], [67, 89, 2, 2]);
  assert.equal(manual.padX, (210 - 134) / 2 + 1.5);
  assert.equal(layoutOf({ ...base, columns: 9 }).columns, 3);
  // Custom and A3 paper; landscape always uses the long side across.
  assert.deepEqual([layoutOf({ ...base, paper: 'a3' }).columns, layoutOf({ ...base, paper: 'a3' }).rows], [4, 4]);
  assert.equal(
    layoutOf({ ...base, paper: 'custom', paperWidth: 300, paperHeight: 200, orientation: 'portrait' }).width,
    200,
  );
  // Guides: full outline rectangles (rounded when asked), corner ticks (8 per card), placement inside/outside.
  const outline = cardGuideShapes(layoutOf(base), {
    ...base,
    cardGuides: 'full',
    guideRounded: true,
    guidePlacement: 'center',
  });
  assert.equal(outline.rects.length, 9);
  assert.equal(outline.rects[0].radius, 3);
  assert.equal(cardGuideShapes(layoutOf(base), { ...base, cardGuides: 'corners' }).lines.length, 72);
  const inside = cardGuideShapes(layoutOf(base), {
    ...base,
    cardGuides: 'full',
    guidePlacement: 'inside',
    guideWidth: 0.4,
  });
  assert.ok(Math.abs(inside.rects[0].width - (63 - 0.4)) < 1e-9);
  assert.equal(pageGuideLines(layoutOf(base), 'full').length, 8);
  assert.equal(pageGuideLines(layoutOf({ ...base, spacingX: 2, spacingY: 2 }), 'full').length, 12);
  assert.equal(pageGuideLines(layoutOf(base), 'full')[0].y2, 297);
  // Silhouette marks: length and thickness as set, a fourth corner with four points.
  const marked = layoutOf({ ...base, marks: 'silhouette', markPoints: 4, markLength: 12, markThickness: 0.8 });
  const marks = marksOf(marked);
  assert.equal(marks.length, 7);
  assert.deepEqual([marks[1].width, marks[1].height], [12, 0.8]);
  assert.deepEqual(normalize({ markLength: 500, markThickness: 0, guideColor: 'red', columns: -2 } as never, base), {
    ...base,
    markLength: 30,
    markThickness: 0.2,
    columns: 0,
  });
});

test('lists: per-line language with lang:, language: or l:, rest of the line unchanged', () =>
{
  const one = parseDecklist(
    '1x Sol Ring (C19) 221 l:ja\n2 Lightning Bolt lang:FR\n4 Counterspell language:de\n1 Island',
  );
  assert.deepEqual(
    one.map(entry => [entry.name, entry.setCode, entry.number, entry.language ?? null, entry.quantity]),
    [
      ['Sol Ring', 'C19', '221', 'ja', 1],
      ['Lightning Bolt', null, null, 'fr', 2],
      ['Counterspell', null, null, 'de', 4],
      ['Island', null, null, null, 1],
    ],
  );
  assert.equal(one[1].line, '2 Lightning Bolt lang:FR');
});

test('costs: catalog GETs are cached on the CDN, errors never; robots.txt excludes AI crawlers and /api/', async (t) =>
{
  const { registerSitePages } = await import('../server/site-pages.ts');
  const probe = createApp({}).listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const free = probe.address();
  assert.ok(free && typeof free === 'object');
  probe.close();
  const base = `http://127.0.0.1:${free.port}`;
  const app = createApp({ development: false, appOrigins: [base] });
  registerSitePages(app, {
    siteOrigin: 'https://sleeveready.example',
    readIndex: async game => ({ game, known: [], setsCheckedAt: null, sets: [] }),
  });
  const server = app.listen(free.port, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const games = await fetch(base + '/api/catalog/games');
  assert.equal(games.status, 200);
  assert.match(games.headers.get('netlify-cdn-cache-control') ?? '', /durable, s-maxage=86400/);
  const status = await fetch(base + '/api/catalog/status');
  assert.match(status.headers.get('netlify-cdn-cache-control') ?? '', /s-maxage=86400/);
  const missing = await fetch(base + '/api/catalog/cards?expansionId=999999999999');
  assert.equal(missing.headers.get('cache-control'), 'no-store');
  assert.equal(missing.headers.get('netlify-cdn-cache-control'), null);
  assert.equal(missing.headers.get('cloudflare-cdn-cache-control'), null);
  assert.match(games.headers.get('cloudflare-cdn-cache-control') ?? '', /^public, s-maxage=86400/);
  const robots = await (await fetch(base + '/robots.txt')).text();
  assert.match(robots, /User-agent: GPTBot\nDisallow: \//);
  assert.match(robots, /User-agent: \*\nDisallow: \/api\//);
  assert.match(robots, /Sitemap: https:\/\/sleeveready\.example\/sitemap\.xml/);
  const exa = { headers: { 'user-agent': 'Mozilla/5.0 (compatible; ExaSearchBot/1.0)' } };
  assert.equal((await fetch(base + '/api/catalog/games', exa)).status, 403);
  assert.equal((await fetch(base + '/robots.txt', exa)).status, 200);
  assert.match(robots, /User-agent: ExaSearchBot\nDisallow: \//);
});
test('card pages kept out of search: only cards of the chosen games, not game and set pages', async () =>
{
  const { cardPagesIndexed, unindexedCardPath } = await import('../shared/games.ts');
  assert.ok(cardPagesIndexed('pokemon'));
  assert.ok(cardPagesIndexed('magic-the-gathering'));
  assert.ok(!cardPagesIndexed('disney-lorcana'));
  assert.ok(unindexedCardPath('/en/disney-lorcana/whispers-in-the-well/53/'));
  assert.ok(unindexedCardPath(String.raw`\it\star-wars-unlimited\sor\12\index.html`), 'Windows separators');
  assert.ok(!unindexedCardPath('/en/disney-lorcana/whispers-in-the-well/index.html'), 'the set page stays indexed');
  assert.ok(!unindexedCardPath('/en/disney-lorcana/'));
  assert.ok(!unindexedCardPath('/en/pokemon/me05/5/'));
});
