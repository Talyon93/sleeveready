import { test } from 'node:test';
import assert from 'node:assert/strict';

const event = (path: string) => ({
  httpMethod: 'GET',
  path,
  rawUrl: 'https://sleeveready.com' + path,
  rawQuery: '',
  headers: { host: 'sleeveready.com', 'x-forwarded-proto': 'https' },
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: null,
  isBase64Encoded: false,
  requestContext: { identity: { sourceIp: '127.0.0.1' } },
});

test('Netlify adapter serves the API and legal pages on the same origin', async () =>
{
  process.env.URL = 'https://sleeveready.com';
  process.env.CARD_INDEX_DIR = '.cache/card-index-test-empty';
  delete process.env.PUBLIC_APP_ORIGIN;
  process.env.SITEMAP_LIVE = '0';
  delete process.env.CARDTRADER_API_TOKEN;
  const module = await import('../netlify/functions/api.ts');
  const handler = module.handler as unknown as (
    event: unknown,
    context: unknown,
  ) => Promise<{ statusCode: number; headers: Record<string, string>; body: string }>;
  const health = await handler(event('/api/health'), {});
  assert.equal(health.statusCode, 200);
  assert.equal(JSON.parse(health.body).mode, 'demo');
  assert.equal(health.headers['x-powered-by'], undefined);
  const privacy = await handler(event('/privacy'), {});
  assert.equal(privacy.statusCode, 200);
  assert.match(privacy.body, /Privacy notice/);
  for (const path of ['/privacy/it', '/terms/it'])
  {
    const italian = await handler(event(path), {});
    assert.equal(italian.statusCode, 200);
    assert.match(italian.body, /lang="it"/);
  }
  const index = await handler(event('/sitemap.xml'), {});
  assert.equal(index.statusCode, 200);
  assert.match(index.body, /<sitemapindex/);
  assert.match(index.body, /sitemap-pages\.xml/);
  assert.match(index.body, /sitemap-cards-pokemon-1\.xml/);
  assert.doesNotMatch(
    index.body,
    /sitemap-cards-disney-lorcana/,
    'no card sitemap for a game kept out of search engines',
  );
  assert.equal((await handler(event('/sitemap-cards-disney-lorcana-1.xml'), {})).statusCode, 404);
  const cards = await handler(event('/sitemap-cards-pokemon-1.xml'), {});
  assert.equal(cards.statusCode, 200);
  assert.match(cards.body, /<loc>https:\/\/sleeveready.com\/[a-z]{2}\/pokemon\/[a-z0-9.-]+\/[a-z0-9-]+\/<\/loc>/);
  assert.equal((await handler(event('/sitemap-cards-unknown-1.xml'), {})).statusCode, 404);
  const sitemap = await handler(event('/sitemap-pages.xml'), {});
  assert.equal(sitemap.statusCode, 200);
  assert.match(sitemap.body, /\/en\/pokemon\//);
  assert.match(sitemap.body, /\/it\/disney-lorcana\//);
  assert.match(sitemap.body, /\/de\/flesh-and-blood\//);
  assert.match(sitemap.body, /\/es\/star-wars-unlimited\//);
  assert.doesNotMatch(sitemap.body, /<loc>[^<]*\/privacy<\/loc>/);
});
