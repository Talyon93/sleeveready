import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { registerSharePreview } from '../server/share-preview.ts';
import { rateLimit } from '../server/rate-limit.ts';
import { encodeSharedList } from '../shared/shareList.ts';

async function serve(app: express.Express)
{
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return { origin: `http://127.0.0.1:${port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

test('rateLimit answers 429 past the limit and lets a route degrade instead', async () =>
{
  const app = express();
  app.get('/strict', rateLimit(2, 60_000), (_req, res) =>
  {
    res.send('ok');
  });
  app.get('/soft', rateLimit(1, 60_000, (_req, _res, next) => next('route')), (_req, res) =>
  {
    res.send('full');
  });
  app.get('/soft', (_req, res) =>
  {
    res.send('plain');
  });
  const { origin, close } = await serve(app);
  try
  {
    const strict = [];
    for (let i = 0; i < 3; i++) strict.push((await fetch(`${origin}/strict`)).status);
    assert.deepEqual(strict, [200, 200, 429]);
    const soft = [await (await fetch(`${origin}/soft`)).text(), await (await fetch(`${origin}/soft`)).text()];
    assert.deepEqual(soft, ['full', 'plain']);
  }
  finally
  {
    await close();
  }
});

test('a shared list loads at most six sets for its picture, however many it names', async () =>
{
  const requested = new Set<number>();
  const app = express();
  registerSharePreview(app, {
    catalogFor: () => ({
      cards: async (expansionId: number) =>
      {
        requested.add(expansionId);
        return { data: [] };
      },
    }),
    // Nothing listens here: the fallback picture fails fast and the route answers 500, which is fine for this test.
    origin: 'http://127.0.0.1:9',
  });
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
  {
    res.status(500).end();
  });
  const { origin, close } = await serve(app);
  try
  {
    const entries = Array.from({ length: 200 }, (_, index) => ({
      expansionId: index + 1,
      cardId: 1,
      quantity: 1,
      language: 'en',
    }));
    await fetch(`${origin}/api/catalog/share-image?list=${encodeSharedList(entries)}`);
    assert.equal(requested.size, 6);
  }
  finally
  {
    await close();
  }
});

test('share-image is limited per visitor', async () =>
{
  const app = express();
  registerSharePreview(app, { catalogFor: () => undefined, origin: 'http://127.0.0.1:9' });
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
  {
    res.status(500).end();
  });
  const { origin, close } = await serve(app);
  try
  {
    const statuses = [];
    for (let i = 0; i < 21; i++) statuses.push((await fetch(`${origin}/api/catalog/share-image`)).status);
    assert.ok(statuses.slice(0, 20).every((status) => status !== 429));
    assert.equal(statuses[20], 429);
  }
  finally
  {
    await close();
  }
});
