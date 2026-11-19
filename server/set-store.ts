// Card lists of settled expansions, kept in Netlify Blobs between function instances: an instance starts with an empty
// memory, and reading a whole expansion from Scryfall again costs seconds of billed function time per page. Outside
// Netlify (tests, scripts, local development) nothing is kept.
import { gunzipSync, gzipSync } from 'node:zlib';
import { getStore } from '@netlify/blobs';

export type SetStore = {
  read: <T>(key: string) => Promise<T | null>;
  write: (key: string, value: unknown) => Promise<void>;
};
const MAX_AGE = 30 * 86_400_000;
// Compressed: a list reads like a small page, however Netlify counts what a function takes from Blobs.
export const packSet = (savedAt: number, value: unknown) =>
{
  const bytes = gzipSync(JSON.stringify({ savedAt, value }));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};
export const unpackSet = <T>(bytes: ArrayBuffer) =>
  JSON.parse(gunzipSync(Buffer.from(bytes)).toString('utf8')) as { savedAt: number; value: T };
const available = () =>
  Boolean(process.env.NETLIFY_BLOBS_CONTEXT || (globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext);

export function blobSetStore(now = Date.now): SetStore
{
  const store = () => getStore('catalog-sets');
  return {
    // A store outage only means the slow way: the source is read as if nothing were kept.
    read: async <T>(key: string) =>
    {
      if (!available()) return null;
      try
      {
        const bytes = await store().get(key, { type: 'arrayBuffer' });
        if (!bytes) return null;
        const stored = unpackSet<T>(bytes);
        return now() - stored.savedAt < MAX_AGE ? stored.value : null;
      }
      catch
      {
        return null;
      }
    },
    write: async (key, value) =>
    {
      if (available())
      {
        await store().set(key, packSet(now(), value)).catch(() =>
        {});
      }
    },
  };
}
// Expansions out for two weeks stop changing; newer and coming ones still gain cards.
export const isSettled = (releaseDate: string | null | undefined, now = Date.now()) =>
  Boolean(releaseDate && releaseDate < new Date(now - 14 * 86_400_000).toISOString().slice(0, 10));
