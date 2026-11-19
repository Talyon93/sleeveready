import { upstreamSignal } from './upstream.ts';
import { z } from 'zod';
import { Cache, Queue } from './cache.ts';
import * as normalize from './normalize.ts';
import type { CatalogCard } from '../shared/model.ts';
import { fetchReleaseDates, releaseSlug, withReleaseDates } from './releases.ts';
import { ApiError } from './api-error.ts';
export { ApiError } from './api-error.ts';
const READ_PATHS = new Set([
  '/info',
  '/games',
  '/categories',
  '/expansions',
  '/blueprints/export',
  '/marketplace/products',
  '/cart',
]);
const messages: Record<number, string> = {
  401: 'Invalid CardTrader token. Check .env.local and restart the server.',
  403: 'The token lacks the required permissions.',
  429: 'CardTrader rate limit reached. Try again shortly.',
};
function isPrimaryExpansion(gameName: string, set: { name: string; code: string | null })
{
  const code = (set.code ?? '').toLowerCase();
  const name = set.name.toLowerCase();
  if (/lorcana/i.test(gameName)) return /^lor\d+$/.test(code);
  if (/one\s*piece/i.test(gameName)) return /^(op-?\d+|eb-\d+)$/.test(code);
  if (/magic/i.test(gameName))
  {
    return !/^sld(?:-|$)/.test(code)
      && !/secret lair|commander|collector|promo|mystery booster|starter|jumpstart|masters|remastered|art series|bundle|box topper/
        .test(name);
  }
  if (/pok[eé]mon/i.test(gameName)) return !/promo|starter|league|battle deck|collection|box|tin|mcdonald/.test(name);
  return !/\b(starter|structure|theme|battle|commander|preconstructed|intro|demo|promo|promotional|prerelease|gift|collector|holiday|anniversary|championship|tournament|league|box|tin|bundle|collection|kit|deck|case|sleeve|playmat|booster display)\b/
    .test(name);
}
export class CardTrader
{
  readonly cache = new Cache();
  readonly marketplaceQueue = new Queue();
  diagnostics = {
    infoOk: false,
    gamesCount: 0,
    expansionsCount: 0,
    lastRequest: null as string | null,
    error: null as string | null,
  };
  constructor(
    private token: string,
    private transport: typeof fetch = fetch,
    private pause = (ms: number) => new Promise(r => setTimeout(r, ms)),
  )
  {}
  async request(
    path: string,
    params: Record<string, string> = {},
    body?: { product_id: number; quantity: number; via_cardtrader_zero: boolean },
  ): Promise<unknown>
  {
    if (!(body ? path === '/cart/add' : READ_PATHS.has(path))) throw new ApiError(400, 'Endpoint not allowed.');
    if (!this.token) throw new ApiError(503, 'CardTrader token not configured.');
    const url = new URL('https://api.cardtrader.com/api/v2' + path);
    url.search = new URLSearchParams(params).toString();
    // Mutations are never retried: a timeout may hide a successful addition.
    for (let attempt = 0; attempt < (body ? 1 : 3); attempt++)
    {
      this.diagnostics.lastRequest = new Date().toISOString();
      try
      {
        const response = await this.transport(url, {
          method: body ? 'POST' : 'GET',
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: upstreamSignal(12000),
          redirect: 'error',
        });
        if (!response.ok)
        {
          if (!body && (response.status === 429 || response.status >= 500) && attempt < 2)
          {
            await response.body?.cancel();
            const retry = Number(response.headers.get('retry-after'));
            await this.pause(
              Number.isFinite(retry) && retry > 0 ? Math.max(1050, Math.min(retry * 1000, 5000)) : 1050 * 2 ** attempt,
            );
            continue;
          }
          await response.body?.cancel();
          throw new ApiError(
            response.status,
            messages[response.status] ?? 'CardTrader temporarily unavailable. Try again.',
          );
        }
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json'))
        {
          const body = await response.text();
          if (/we'?ll be back soon|maintenance/i.test(body))
          {
            throw new ApiError(
              503,
              'CardTrader API is temporarily unavailable for maintenance. Please try again shortly.',
            );
          }
          throw new ApiError(502, 'CardTrader returned an unexpected response. Please try again shortly.');
        }
        const data: unknown = await response.json();
        this.diagnostics.error = null;
        return data;
      }
      catch (error)
      {
        if (!(error instanceof ApiError) && !body && attempt < 2)
        {
          await this.pause(1050 * 2 ** attempt);
          continue;
        }
        const safe = error instanceof ApiError
          ? error
          : new ApiError(
            502,
            body
              ? 'Could not confirm the item was added. Check the CardTrader cart before trying again.'
              : 'CardTrader connection lost or invalid response. Try again.',
          );
        this.diagnostics.error = safe.message;
        throw safe;
      }
    }
    throw new ApiError(502, 'CardTrader unavailable.');
  }
  async info()
  {
    try
    {
      await this.cache.get('info', 60000, () => this.request('/info'));
      this.diagnostics.infoOk = true;
      return true;
    }
    catch
    {
      this.diagnostics.infoOk = false;
      return false;
    }
  }
  async games()
  {
    return this.cache.get('games', 86400000, async () =>
    {
      const data = normalize.games(await this.request('/games'));
      this.diagnostics.gamesCount = data.length;
      return data;
    });
  }
  async expansions()
  {
    return this.cache.get('expansions', 86400000, async () =>
    {
      const data = normalize.expansions(await this.request('/expansions'));
      this.diagnostics.expansionsCount = data.length;
      return data;
    });
  }
  async expansionsForGame(gameId: number)
  {
    return this.cache.get('catalog-expansions:' + gameId, 21600000, async () =>
    {
      const result = await this.expansions();
      const game = (await this.games()).data.find(g => g.id === gameId);
      const slug = game ? releaseSlug(game.name) : null;
      let dates = new Map<string, string>();
      if (slug)
      {
        try
        {
          dates = (await this.cache.get('releases:' + slug, 86400000, () => fetchReleaseDates(slug))).data;
        }
        catch
        {
          /* Catalog remains usable; undated sets are explicitly shown last. */
        }
      }
      const allSets = withReleaseDates(result.data.filter(e => e.gameId === gameId), dates);
      const primarySets = allSets.filter(set => isPrimaryExpansion(game?.name ?? '', set));
      const sets = primarySets.length ? primarySets : allSets;
      // CardTrader lists announced releases before their individual cards arrive. Check only future
      // releases here, with a small concurrency limit, so the picker never offers an empty set.
      const future = sets.filter(set => set.releaseDate && set.releaseDate > new Date().toISOString().slice(0, 10));
      if (!future.length) return sets;
      const usable = new Set<number>();
      for (let offset = 0; offset < future.length; offset += 4)
      {
        const checks = await Promise.all(
          future.slice(offset, offset + 4).map(async set =>
          {
            try
            {
              return (await this.cards(set.id)).data.length > 0 ? set.id : null;
            }
            catch
            {
              return set.id;
            }
          }),
        );
        for (const id of checks) if (id) usable.add(id);
      }
      return sets.filter(set => !future.some(futureSet => futureSet.id === set.id) || usable.has(set.id));
    });
  }
  async cards(expansionId: number)
  {
    return this.cache.get('cards:' + expansionId, 21600000, async () =>
    {
      const expansion = (await this.expansions()).data.find(e => e.id === expansionId);
      if (!expansion) throw new ApiError(404, 'Set not found.');
      const categories = await this.cache.get(
        'categories:' + expansion.gameId,
        86400000,
        () => this.request('/categories', { game_id: String(expansion.gameId) }),
      );
      const rows = z.array(z.object({ id: z.number(), name: z.string() })).parse(categories.data);
      const allowed = new Set(
        rows
          .filter(c =>
            /single|token|card\b/i.test(c.name) && !/box|pack|sleeve|binder|deck|case|booster|accessor/i.test(c.name)
          )
          .map(c => c.id),
      );
      const data: CatalogCard[] = normalize.cards(
        await this.request('/blueprints/export', { expansion_id: String(expansionId) }),
      );
      // Riftbound: before public launch, verify artwork against Riot Developer Policy
      // and preferably replace it with artwork from the official Riot API.
      return data.filter(c => c.gameId === expansion.gameId && allowed.has(c.categoryId));
    });
  }
  async offers(blueprintId: number, language = '')
  {
    return this.cache.get(
      `offers:${blueprintId}:${language}`,
      60000,
      () =>
        this.marketplaceQueue.run(async () =>
          normalize.offers(
            await this.request('/marketplace/products', {
              blueprint_id: String(blueprintId),
              ...(language ? { language } : {}),
            }),
            blueprintId,
          )
        ),
    );
  }
}
