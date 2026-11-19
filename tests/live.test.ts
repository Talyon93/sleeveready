import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CardTrader } from '../server/cardtrader.ts';
const token = process.env.CARDTRADER_API_TOKEN?.trim();
test('live CardTrader: five games, sets, images and offers (read only)', { skip: !token, timeout: 240000 }, async () =>
{
  const client = new CardTrader(token!);
  assert.equal(await client.info(), true);
  const games = (await client.games()).data;
  const sets = (await client.expansions()).data;
  for (const pattern of [/magic/i, /pok[eé]mon/i, /one\s*piece/i, /lorcana/i, /riftbound/i])
  {
    const game = games.find(g => pattern.test(g.name + ' ' + g.displayName));
    assert.ok(game, `Game missing: ${pattern}`);
    const set = sets.find(s => s.gameId === game.id);
    assert.ok(set, `No set: ${game.displayName}`);
    const cards = (await client.cards(set.id)).data;
    assert.ok(cards.length, `Set without single cards: ${set.name}`);
    const card = cards.find(c => c.imageUrl);
    assert.ok(card, `No images: ${set.name}`);
    const image = await fetch(card.imageUrl!, { signal: AbortSignal.timeout(15000) });
    assert.ok(image.ok);
    assert.match(image.headers.get('content-type') ?? '', /^image\//);
    await image.body?.cancel();
    const offers = await client.offers(card.id);
    assert.ok(Array.isArray(offers.data));
    console.log(
      JSON.stringify({
        game: game.displayName,
        expansion: set.name,
        cards: cards.length,
        imageStatus: image.status,
        offers: offers.data.length,
      }),
    );
  }
  const invalid = new CardTrader('invalid-sleeveready-test-token');
  assert.equal(await invalid.info(), false);
  assert.match(invalid.diagnostics.error ?? '', /token|permissions/i);
});
