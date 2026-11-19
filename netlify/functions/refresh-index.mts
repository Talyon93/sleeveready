// Scheduled refresh of the card index (sitemaps and name search): once an hour it indexes as many expansions as fit in
// its time budget, new ones first, then the stalest, rotating across games. Scheduled functions stop at 30 s and a
// failed run is retried, so a run never throws, keeps well under the limit, and a lock makes overlapping or repeated
// runs of the same slot leave at once.
import { getStore } from '@netlify/blobs';
import { buildCatalogs } from '../../server/catalogs.ts';
import { blobIndexStore, refreshCardIndex } from '../../server/card-index.ts';

const LOCK_KEY = 'refresh-lock';
// A run ends within about 20 s; a lock older than this belongs to a run that died.
const LOCK_MS = 10 * 60_000;

export default async () =>
{
  const started = Date.now();
  try
  {
    const store = getStore({ name: 'card-index', consistency: 'strong' });
    const lock = await store.get(LOCK_KEY, { type: 'json' }).catch(() => null) as { at?: number } | null;
    if (lock?.at && started - lock.at < LOCK_MS)
    {
      console.log('Card index: another run holds the lock, nothing to do.');
      return new Response('locked');
    }
    await store.setJSON(LOCK_KEY, { at: started });
    const result = await refreshCardIndex(buildCatalogs().catalogs, blobIndexStore(), {
      budgetMs: 12_000,
      log: line => console.warn(line),
    });
    console.log(
      `Card index: ${result.indexed} expansions indexed, ${result.failed} failed, ${result.remaining} waiting (${result.stopped}), ${
        Math.round((Date.now() - started) / 1000)
      } s.`,
    );
    // The lock stays until it expires, so a retry of this slot does not run the work again.
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  }
  catch (error)
  {
    console.error('Card index refresh failed:', error instanceof Error ? error.message : error);
    return new Response('failed');
  }
};

export const config = { schedule: '17 * * * *' };
