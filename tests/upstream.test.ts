import test from 'node:test';
import assert from 'node:assert/strict';

// The budget is read when the module loads, so it is set before the dynamic imports below.
process.env.UPSTREAM_BUDGET_MS = '2500';

test('a source that hangs is given up within the budget, retries included', async () =>
{
  const { SourceClient } = await import('../server/native-source.ts');
  const { ApiError } = await import('../server/api-error.ts');
  let calls = 0;
  // Never answers; only the abort signal ends each attempt.
  const hanging = ((_url: URL, init: RequestInit) =>
  {
    calls++;
    return new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
  }) as typeof fetch;
  const client = new SourceClient('Slow source', ['https://slow.example'], hanging, () => Promise.resolve());
  const started = Date.now();
  // AbortSignal.timeout does not keep Node alive on its own (a server would).
  const keepAlive = setInterval(() =>
  {}, 1_000);
  try
  {
    await assert.rejects(
      client.json(new URL('https://slow.example/sets')),
      (error) => error instanceof ApiError && error.status === 502,
    );
  }
  finally
  {
    clearInterval(keepAlive);
  }
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 4_000, `took ${elapsed} ms`);
  assert.ok(calls <= 2, `${calls} attempts`);
});

test('retryWithin stops after the third attempt or when the budget is nearly spent', async () =>
{
  const { retryWithin } = await import('../server/upstream.ts');
  const now = Date.now();
  assert.equal(retryWithin(now, 0), true);
  assert.equal(retryWithin(now, 2), false);
  assert.equal(retryWithin(now - 1_000, 0), false);
});
