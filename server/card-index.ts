// The card index: every released expansion of every game with its cards' names, numbers and URL slugs, plus the
// languages it is printed in. A scheduled function fills and refreshes it a slice at a time (new expansions first,
// then the stalest), and the sitemaps and the name search read it. It lives in Netlify Blobs, or in a local folder
// outside Netlify.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { getStore } from '@netlify/blobs';
import { cardPath, cardSlugs, expansionSlug, seoLanguages, seoSlugForGame, type SeoGameSlug } from '../shared/seo.ts';
import { seoSetSnapshot } from '../shared/seo-sets.ts';
import { normaliseCardName } from '../shared/decklist.ts';
import type { NativeCatalog } from './native-source.ts';

// Cards as [slug, name, collector number] to keep the largest index (Magic) a few megabytes.
export type IndexedCard = [slug: string, name: string, number: string | null];
export type IndexedSet = {
  id: number;
  slug: string;
  code: string | null;
  name: string;
  releaseDate: string | null;
  languages: string[];
  cards: IndexedCard[];
  refreshedAt: string;
};
export type KnownSet = { id: number; slug: string; code: string | null; name: string; releaseDate: string | null };
export type GameIndex = { game: SeoGameSlug; known: KnownSet[]; setsCheckedAt: string | null; sets: IndexedSet[] };
export type IndexStore = {
  get: (game: SeoGameSlug) => Promise<GameIndex | null>;
  set: (index: GameIndex) => Promise<void>;
};

export function fileIndexStore(directory: string): IndexStore
{
  const path = (game: string) => `${directory}/${game}.json`;
  return {
    get: async game => readFile(path(game), 'utf8').then(text => JSON.parse(text) as GameIndex, () => null),
    set: async index =>
    {
      await mkdir(directory, { recursive: true });
      await writeFile(path(index.game), JSON.stringify(index));
    },
  };
}
export function blobIndexStore(options: { siteID?: string; token?: string } = {}): IndexStore
{
  const store = () =>
    getStore({
      name: 'card-index',
      consistency: 'strong',
      ...(options.siteID && options.token ? { siteID: options.siteID, token: options.token } : {}),
    });
  return {
    get: async game => (await store().get(game, { type: 'json' })) as GameIndex | null,
    set: async index =>
    {
      await store().setJSON(index.game, index);
    },
  };
}
// Netlify functions carry a Blobs context (functions v2 in the environment, v1 once connectLambda ran for the request),
// so the choice is made per call; anything else (local development, tests, scripts) uses a folder.
export function cardIndexStore(): IndexStore
{
  const blobs = blobIndexStore();
  const files = fileIndexStore(process.env.CARD_INDEX_DIR ?? '.cache/card-index');
  const pick = () =>
    process.env.NETLIFY_BLOBS_CONTEXT || (globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext
      ? blobs
      : files;
  return { get: game => pick().get(game), set: index => pick().set(index) };
}

export const gameSlugOf = (catalog: NativeCatalog) =>
  seoSlugForGame(catalog.game.name + ' ' + catalog.game.displayName);
const DAY = 86_400_000;
const UPCOMING_DAYS = 90;
// Coming expansions, and those out for less than two weeks, gain cards every few days: they are read again daily.
const FRESH_DAYS = 14;
const FRESH_STALE = DAY;
const isFresh = (set: { releaseDate: string | null }, now: number) =>
  Boolean(set.releaseDate && set.releaseDate >= new Date(now - FRESH_DAYS * DAY).toISOString().slice(0, 10));
type RefreshOptions = {
  budgetMs: number;
  now?: () => number;
  staleAfterMs?: number;
  setsEveryMs?: number;
  log?: (line: string) => void;
};
export type RefreshResult = {
  indexed: number;
  failed: number;
  checkedGames: number;
  remaining: number;
  stopped: 'budget' | 'done';
};

export async function refreshCardIndex(
  catalogs: NativeCatalog[],
  store: IndexStore,
  options: RefreshOptions,
): Promise<RefreshResult>
{
  const now = options.now ?? Date.now;
  const deadline = now() + options.budgetMs;
  const staleAfter = options.staleAfterMs ?? 7 * DAY;
  const setsEvery = options.setsEveryMs ?? 6 * 3_600_000;
  const log = options.log ?? (() =>
  {});
  const games = catalogs.flatMap(catalog =>
  {
    const game = gameSlugOf(catalog);
    return game ? [{ catalog, game }] : [];
  });
  const indexes = new Map<SeoGameSlug, GameIndex>();
  const dirty = new Set<SeoGameSlug>();
  let checkedGames = 0;
  for (const { game } of games)
  {
    indexes.set(game, await store.get(game) ?? { game, known: [], setsCheckedAt: null, sets: [] });
  }
  // The expansion list of each game is re-read every few hours; duplicate slugs keep the first expansion, as card pages do.
  for (const { catalog, game } of games)
  {
    const index = indexes.get(game)!;
    if (index.setsCheckedAt && now() - Date.parse(index.setsCheckedAt) < setsEvery) continue;
    if (now() > deadline) break;
    try
    {
      // Released expansions, and coming ones up to three months ahead: their revealed cards get pages (and sitemap
      // entries) during the preview season, when the big sites do not have them yet.
      const ahead = new Date(now() + UPCOMING_DAYS * DAY).toISOString().slice(0, 10);
      const seen = new Set<string>();
      index.known = (await catalog.sets()).data.filter(set => !set.releaseDate || set.releaseDate <= ahead).flatMap(
        set =>
        {
          const slug = expansionSlug(set);
          if (seen.has(slug)) return [];
          seen.add(slug);
          return [{ id: set.id, slug, code: set.code, name: set.name, releaseDate: set.releaseDate ?? null }];
        },
      );
      const known = new Set(index.known.map(set => set.id));
      index.sets = index.sets.filter(set => known.has(set.id));
      index.setsCheckedAt = new Date(now()).toISOString();
      dirty.add(game);
      checkedGames++;
    }
    catch (error)
    {
      log(`${game}: expansion list unavailable (${error instanceof Error ? error.message : error})`);
    }
  }
  // Work queue per game: expansions never indexed (newest first), then stale ones (oldest refresh first).
  const queues = games.map(({ catalog, game }) =>
  {
    const index = indexes.get(game)!;
    const indexed = new Map(index.sets.map(set => [set.id, set]));
    const missing = index.known.filter(set => !indexed.has(set.id));
    // A set indexed with no cards (listed by its source before the card images) is looked at daily, like a new one, so
    // its cards reach the sitemaps the day the images come out, however long that takes.
    const stale = index
      .sets
      .filter(set =>
        now() - Date.parse(set.refreshedAt)
        >= (isFresh(set, now()) || !set.cards.length ? Math.min(FRESH_STALE, staleAfter) : staleAfter)
      )
      .sort((a, b) => a.refreshedAt.localeCompare(b.refreshedAt))
      .map(set => index.known.find(item => item.id === set.id)!)
      .filter(Boolean);
    return { catalog, game, index, tasks: [...missing, ...stale] };
  });
  let indexed = 0;
  let failed = 0;
  let stopped: 'budget' | 'done' = 'done';
  // Round robin across games, so a large game (Magic) never starves the others.
  for (let round = 0; queues.some(queue => queue.tasks.length); round++)
  {
    for (const queue of queues)
    {
      const task = queue.tasks.shift();
      if (!task) continue;
      if (now() > deadline)
      {
        queue.tasks.unshift(task);
        stopped = 'budget';
        break;
      }
      const previous = queue.index.sets.find(set => set.id === task.id);
      try
      {
        const english = (await queue.catalog.cards(task.id, 'en')).data;
        const slugs = cardSlugs(english);
        const languages = (queue.catalog.game.printLanguages?.length ?? 0) > 1
          ? (await queue.catalog.languages(task.id)).data
          : ['en'];
        const entry: IndexedSet = {
          ...task,
          languages,
          cards: english.map(card => [slugs.get(card.id)!, card.name, card.collectorNumber ?? null]),
          refreshedAt: new Date(now()).toISOString(),
        };
        queue.index.sets = [...queue.index.sets.filter(set => set.id !== task.id), entry];
        indexed++;
      }
      catch (error)
      {
        // A failing expansion is retried in a day rather than at every run; known cards stay until then.
        const retry = new Date(now() - staleAfter + DAY).toISOString();
        queue.index.sets = [...queue.index.sets.filter(set => set.id !== task.id), {
          ...task,
          languages: previous?.languages ?? ['en'],
          cards: previous?.cards ?? [],
          refreshedAt: retry,
        }];
        failed++;
        log(`${queue.game}: ${task.name} failed (${error instanceof Error ? error.message : error})`);
      }
      dirty.add(queue.game);
    }
    if (stopped === 'budget') break;
  }
  for (const game of dirty)
  {
    const index = indexes.get(game)!;
    index.sets.sort((a, b) =>
      index.known.findIndex(set => set.id === a.id) - index.known.findIndex(set => set.id === b.id)
    );
    await store.set(index);
  }
  return {
    indexed,
    failed,
    checkedGames,
    remaining: queues.reduce((sum, queue) => sum + queue.tasks.length, 0),
    stopped,
  };
}

// Page languages a set's card pages exist in: English plus every page language it is printed in.
export const pageLanguagesOf = (languages: string[]) =>
  seoLanguages.filter(language =>
    language === 'en' || languages.some(code => code.toLowerCase().split('-')[0] === language)
  );
// Card pages of expansions released in the last year (by default): the cards people search for and print. Older
// cards keep their pages, reached through the expansion pages' links, without inviting crawlers to every one of them.
export const recentCardPaths = (index: GameIndex, now = Date.now(), days = 365) =>
{
  const since = new Date(now - days * 86_400_000).toISOString().slice(0, 10);
  return indexedCardPaths({ ...index, sets: index.sets.filter(set => set.releaseDate && set.releaseDate >= since) });
};
export const indexedCardPaths = (index: GameIndex) =>
  index.sets.flatMap(set =>
    pageLanguagesOf(set.languages).flatMap(language =>
      set.cards.map(([slug]) => cardPath(language, index.game, set.slug, slug))
    )
  );

// Name search: every query word must appear in the name; exact names, then names starting with the query, then
// names with a word starting with it. Printings group under their name, one entry per expansion (its first printing
// and how many it has), newest expansion first.
export type SearchPrinting = { set: string; setName: string; slug: string; number: string | null; count: number };
export type SearchResult = { name: string; printings: SearchPrinting[]; more: number };
// Normalised names per indexed set, computed once per loaded index.
const nameKeys = new WeakMap<IndexedSet, string[]>();
const normalisedNames = (set: IndexedSet) =>
{
  let keys = nameKeys.get(set);
  if (!keys)
  {
    keys = set.cards.map(([, name]) => normaliseCardName(name));
    nameKeys.set(set, keys);
  }
  return keys;
};
export function searchIndex(
  index: GameIndex,
  query: string,
  limit = 30,
  perName = 12,
): { total: number; results: SearchResult[] }
{
  const wanted = normaliseCardName(query);
  const words = wanted.split(' ').filter(Boolean);
  if (!words.length) return { total: 0, results: [] };
  const groups = new Map<string, { name: string; score: number; printings: SearchPrinting[] }>();
  for (const set of index.sets)
  {
    const keys = normalisedNames(set);
    set.cards.forEach(([slug, name, number], position) =>
    {
      const key = keys[position];
      if (!key || !words.every(word => key.includes(word))) return;
      const score = key === wanted
        ? 0
        : key.startsWith(wanted)
        ? 1
        : key.split(' ').some(part => part.startsWith(words[0]))
        ? 2
        : 3;
      const group = groups.get(key) ?? { name, score, printings: [] };
      const last = group.printings.at(-1);
      if (last?.set === set.slug) last.count++;
      else group.printings.push({ set: set.slug, setName: set.name, slug, number, count: 1 });
      groups.set(key, group);
    });
  }
  const ranked = [...groups.values()].sort((a, b) =>
    a.score - b.score || b.printings.length - a.printings.length || a.name.localeCompare(b.name)
  );
  return {
    total: ranked.length,
    results: ranked.slice(0, limit).map(group => ({
      name: group.name,
      printings: group.printings.slice(0, perName),
      more: Math.max(0, group.printings.length - perName),
    })),
  };
}

// Until the scheduled refresh has indexed a game, its snapshot (newest expansions, names of their first cards) stands in.
export function snapshotIndex(game: SeoGameSlug): GameIndex
{
  const sets = (seoSetSnapshot.games[game] ?? []).map((set, position) => ({
    id: -1 - position,
    slug: set.slug,
    code: set.code ?? null,
    name: set.name,
    releaseDate: set.releaseDate ?? null,
    languages: set.languages,
    cards: (set.cardSlugs ?? []).map((slug, row): IndexedCard => [slug, set.cards.en?.[row] ?? '', null]),
    refreshedAt: '',
  }));
  return {
    game,
    known: sets.map(({ id, slug, code, name, releaseDate }) => ({ id, slug, code, name, releaseDate })),
    setsCheckedAt: null,
    sets,
  };
}
// Indexes stay in memory for a few minutes per function instance; a store outage falls back to the snapshot.
export function cachedIndexReader(store: IndexStore, ttlMs = 600_000)
{
  const cache = new Map<SeoGameSlug, { index: GameIndex; expires: number }>();
  return async (game: SeoGameSlug) =>
  {
    const hit = cache.get(game);
    if (hit && hit.expires > Date.now()) return hit.index;
    const stored = await store.get(game).catch(() => null);
    const index = stored?.sets.length ? stored : snapshotIndex(game);
    cache.set(game, { index, expires: Date.now() + ttlMs });
    return index;
  };
}
