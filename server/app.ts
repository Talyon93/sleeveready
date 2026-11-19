import express from 'express';
import { isBlockedBot } from './bots.ts';
import { z } from 'zod';
import { CardTrader, ApiError } from './cardtrader.ts';
import { buildCatalogs, type CatalogOptions } from './catalogs.ts';
import { GundamCatalog } from './gundam.ts';
import { cachedIndexReader, cardIndexStore, gameSlugOf, searchIndex, type IndexStore } from './card-index.ts';
import { importDecklist, samePrinting } from './deck-import.ts';
import { parseDecklist } from '../shared/decklist.ts';
import { deckLinkOf, fetchDeckLink, DeckLinkError } from './deck-links.ts';
import { cardSlugs, isSeoLanguage, parseSeoPath, seoGames } from '../shared/seo.ts';
import { cardInfo, cardMarket } from './card-info.ts';
import { renderCardPage } from './card-pages.ts';
import { registerSharePreview } from './share-preview.ts';
import { renderSetPage } from './set-pages.ts';
import { isIllustratorSegment, renderArtistPage } from './artist-pages.ts';
import type { CardGame, CatalogCard } from '../shared/model.ts';
import { demoGames, demoExpansions, demoCards } from './demo.ts';
import { rateLimit } from './rate-limit.ts';
import { errorLanguage, errorPage, type ErrorKind } from '../shared/error-page.ts';
type AppOptions = CatalogOptions & {
  cardIndex?: IndexStore;
  token?: string;
  cartEnabled?: boolean;
  development?: boolean;
  client?: CardTrader;
  appOrigins?: string[];
  supabaseUrl?: string;
};
const localOrigins = ['http://localhost', 'http://127.0.0.1', 'http://[::1]'];
const normaliseOrigin = (value: string) =>
{
  try
  {
    const url = new URL(value);
    return url.origin;
  }
  catch
  {
    return '';
  }
};
export function createApp(options: AppOptions = {})
{
  const app = express();
  const token = options.token ?? '';
  const live = !!token;
  const mode = live ? 'live' : 'demo';
  const client = options.client ?? new CardTrader(token);
  const { catalogs, nativeGames, onePiece, cyberpunk } = buildCatalogs(options);
  const readIndex = cachedIndexReader(options.cardIndex ?? cardIndexStore());
  const gameKey = (value: string) =>
    value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isNativeGame = (game: CardGame) =>
  {
    const key = gameKey(game.name + ' ' + game.displayName);
    return nativeGames.some(item => key.includes(gameKey(item.name)));
  };
  const catalogFor = (expansionId: number) => catalogs.find(catalog => catalog.isExpansionId(expansionId));
  const supabaseOrigin = normaliseOrigin(options.supabaseUrl ?? '');
  if (options.appOrigins?.length) app.set('trust proxy', 1);
  const allowedOrigins = new Set(
    (options.appOrigins?.length ? options.appOrigins : localOrigins).map(normaliseOrigin).filter(Boolean),
  );
  const isAllowedOrigin = (origin: string) =>
  {
    const parsed = normaliseOrigin(origin);
    if (allowedOrigins.has(parsed)) return true;
    try
    {
      const host = new URL(parsed).hostname;
      return !options.appOrigins?.length && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);
    }
    catch
    {
      return false;
    }
  };
  app.disable('x-powered-by');
  // One log line per request (path, status, time, crawler name or "browser"): Netlify's own logs show neither the
  // path nor who asked, and both decide what to cache or keep out.
  app.use((req, res, next) =>
  {
    if (options.development)
    {
      next();
      return;
    }
    const started = Date.now();
    const agent = String(req.get('user-agent') ?? '');
    const who = /([A-Za-z-]*(?:bot|crawler|spider|slurp|agent|fetcher|preview)[A-Za-z-]*)/i.exec(agent)?.[1]
      ?? (/headless/i.test(agent) ? 'headless' : agent ? 'browser' : 'none');
    res.on(
      'finish',
      () =>
        console.log(
          `${req.method} ${req.originalUrl.slice(0, 140)} ${res.statusCode} ${Date.now() - started}ms ${who}`,
        ),
    );
    next();
  });
  // Cloudflare (in front of Netlify) caches what Netlify's CDN caches, for as long: every Netlify-CDN-Cache-Control
  // also goes out as Cloudflare-CDN-Cache-Control ("durable" is Netlify's own). Its cache is purged on each deploy
  // (netlify/functions/deploy-succeeded.mts), so pages never point at scripts of an older build.
  app.use((_req, res, next) =>
  {
    const setHeader = res.setHeader.bind(res);
    res.setHeader = (name, value) =>
    {
      if (name.toLowerCase() === 'netlify-cdn-cache-control')
      {
        setHeader('Cloudflare-CDN-Cache-Control', String(value).replace(/\s*durable,?/, ''));
      }
      return setHeader(name, value);
    };
    next();
  });
  // Blocked crawlers get a bare 403 before any work (robots.txt stays readable, so they can learn they are not welcome).
  // Never cached: the CDN keys on the URL, not on who asked.
  app.use((req, res, next) =>
  {
    if (req.path !== '/robots.txt' && isBlockedBot(String(req.get('user-agent') ?? '')))
    {
      res.status(403).set('Cache-Control', 'no-store').type('text/plain').send('Crawling not allowed, see /robots.txt');
      return;
    }
    next();
  });
  app.use((req, res, next) =>
  {
    const requestOrigin = normaliseOrigin(`${req.protocol}://${req.get('host')}`);
    if (!isAllowedOrigin(requestOrigin))
    {
      res.status(403).json({ error: 'Host not allowed.' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=()');
    if (options.appOrigins?.length)
    {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader(
        'Content-Security-Policy',
        `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https://svgs.scryfall.io https://assetcdn.rgpub.io https://storage.googleapis.com https://card-images.archidekt.com https://cardtrader.com https://www.cardtrader.com https://cards.scryfall.io https://assets.tcgdex.net https://images.scrydex.com https://api.lorcana.ravensburger.com https://cmsassets.rgpub.io https://images.ygoprodeck.com https://cdn.starwarsunlimited.com https://en.onepiece-cardgame.com https://fr.onepiece-cardgame.com https://asia-th.onepiece-cardgame.com https://d27a44hjr9gen3.cloudfront.net https://legendstory-production-s3-public.s3.amazonaws.com https://world.digimoncard.com https://www.dbs-cardgame.com https://www.gundam-gcg.com https://www.unionarena-tcg.com https://en.cf-vanguard.com https://en.palworld-official-cardgame.com; connect-src 'self'${
          supabaseOrigin ? ' ' + supabaseOrigin : ''
        };`,
      );
    }
    if (req.path.startsWith('/api/'))
    {
      res.setHeader('Cache-Control', 'no-store');
      const origin = req.get('origin');
      // The image proxies are public and cached by the CDN for every site alike: blocking other sites here only refused
      // the images the CDN had not cached yet (an <img> on another site sends Sec-Fetch-Site: cross-site).
      const publicImage = req.method === 'GET'
        && /^\/api\/catalog\/(?:one-piece|cyberpunk|gundam)-image\//.test(req.path);
      if (!publicImage && ((origin && !isAllowedOrigin(origin)) || req.get('sec-fetch-site') === 'cross-site'))
      {
        res.status(403).json({ error: 'Origin not allowed.' });
        return;
      }
    }
    next();
  });
  // Decklists need more room than the other small JSON bodies; everything else keeps the 4 kB limit.
  const smallJson = express.json({ limit: '4kb' });
  const decklistJson = express.json({ limit: '32kb' });
  app.use((req, res, next) => (req.path === '/api/catalog/import' ? decklistJson : smallJson)(req, res, next));
  // A shared list's link preview (?list=…): its picture, and its page with that picture in the preview tags.
  registerSharePreview(app, { catalogFor, origin: options.appOrigins?.[0]?.replace(/\/+$/, '') });
  app.get('/api/health', (_req, res) => res.json({ ok: true, mode, at: new Date().toISOString() }));
  app.get('/api/catalog/one-piece-image/:language/:file', rateLimit(240, 60_000), async (req, res) =>
  {
    const language = String(req.params.language);
    const file = String(req.params.file);
    const match = /^([A-Za-z0-9!_-]{1,60})\.(png|webp)$/.exec(file);
    if (!match) throw new ApiError(400, 'Invalid One Piece image.');
    const image = await onePiece.image(language, match[1], match[2]);
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Netlify-CDN-Cache-Control', 'public, durable, s-maxage=604800');
    res.send(image.bytes);
  });
  app.get('/api/catalog/cyberpunk-image/:set/:file', rateLimit(240, 60_000), async (req, res) =>
  {
    const match = /^([0-9a-f-]{36})\.webp$/.exec(String(req.params.file));
    if (!match) throw new ApiError(400, 'Invalid Cyberpunk image.');
    const image = await cyberpunk.image(String(req.params.set), match[1]);
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Netlify-CDN-Cache-Control', 'public, durable, s-maxage=604800');
    res.send(image.bytes);
  });
  app.get('/api/catalog/gundam-image/:file', rateLimit(240, 60_000), async (req, res) =>
  {
    const gundam = catalogs.find((item): item is GundamCatalog => item instanceof GundamCatalog);
    if (!gundam) throw new ApiError(404, 'Gundam image not found.');
    const image = await gundam.image(String(req.params.file));
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Netlify-CDN-Cache-Control', 'public, durable, s-maxage=604800');
    res.send(image.bytes);
  });
  app.use('/api/catalog', rateLimit(90, 60_000));
  app.use('/api/cardtrader', rateLimit(90, 60_000));
  const routes = (name: string) => new RegExp(`^/api/(?:catalog|cardtrader)/${name}$`);
  const legacyWithin = async <T>(task: Promise<T>, fallback: T, ms = 1500) =>
    Promise.race([task, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);
  const id = (value: unknown) =>
  {
    const parsed = z.string().regex(/^[1-9]\d{0,14}$/).safeParse(value);
    if (!parsed.success) throw new ApiError(400, 'Invalid id.');
    return Number(parsed.data);
  };
  const demo = <T>(data: T) => ({ data, updatedAt: new Date().toISOString(), mode });
  // Every page load asks for these: answers the CDN can keep for hours or days cost no function run for later visitors.
  // Only successful answers are cached (errors keep no-store from the middleware).
  const cdn = (res: express.Response, seconds: number, browser = Math.min(seconds, 3600)) =>
    res.set('Cache-Control', `public, max-age=${browser}`).set(
      'Netlify-CDN-Cache-Control',
      `public, durable, s-maxage=${seconds}, stale-while-revalidate=${seconds}`,
    );
  const HOUR = 3600;
  const DAY = 86_400;
  // No outside call here: the mode follows the token, and the app only needs to know whether data is live.
  app.get(routes('status'), async (_req, res) =>
  {
    if (options.development && live)
    {
      const connected = await legacyWithin(client.info(), false);
      res.json({
        mode,
        connected,
        cartEnabled: false,
        development: true,
        tokenPresent: live,
        diagnostics: client.diagnostics,
      });
      return;
    }
    if (options.development)
    {
      res.json({ mode, connected: false, cartEnabled: false, development: true, tokenPresent: live });
      return;
    }
    cdn(res, DAY).json({ mode, connected: live, cartEnabled: false, development: false });
  });
  app.get(routes('games'), async (_req, res) =>
  {
    let upstream = demo(live ? [] : demoGames);
    if (live)
    {
      try
      {
        const legacy = await legacyWithin(client.games(), null);
        if (legacy) upstream = { ...legacy, mode };
      }
      catch
      {
        /* Native providers remain available when a legacy provider is down. */
      }
    }
    cdn(res, DAY).json({
      ...upstream,
      data: [...nativeGames, ...upstream.data.filter(game => !isNativeGame(game))],
      mode,
    });
  });
  app.get(routes('expansions'), async (req, res) =>
  {
    const gameId = id(req.query.gameId);
    const catalog = catalogs.find(item => item.game.id === gameId);
    const result = catalog
      ? await catalog.sets()
      : live
      ? await client.expansionsForGame(gameId)
      : demoExpansions.filter(e => e.gameId === gameId);
    cdn(res, 6 * HOUR).json(Array.isArray(result) ? demo(result) : { ...result, mode });
  });
  app.get(routes('languages'), async (req, res) =>
  {
    const catalog = catalogFor(id(req.query.expansionId));
    cdn(res, DAY).json(catalog ? { ...await catalog.languages(id(req.query.expansionId)), mode } : demo(['en']));
  });
  // An empty list (a new set whose source has no card images yet) is kept for minutes, not hours: the cards show up
  // soon after the images do.
  app.get(routes('cards'), async (req, res) =>
  {
    const expansionId = id(req.query.expansionId);
    const language = z.string().max(8).regex(/^$|^[a-z]{2,3}(?:-[a-z]{2,4})?$/).parse(req.query.language ?? '');
    const catalog = catalogFor(expansionId);
    const result = catalog
      ? await catalog.cards(expansionId, language || 'en')
      : live
      ? await client.cards(expansionId)
      : demo(expansionId <= 5 ? demoCards(expansionId) : []);
    cdn(res, result.data.length ? 6 * HOUR : 600).json({ ...result, mode });
  });
  // Name search across every expansion of a game, from the card index (or the snapshot until the game is indexed).
  app.get(routes('search'), async (req, res) =>
  {
    const game = seoGames.find(item => item.slug === String(req.query.game ?? ''))?.slug;
    if (!game) throw new ApiError(400, 'Invalid game.');
    const query = z.string().trim().min(2).max(60).parse(req.query.q);
    cdn(res, 6 * HOUR).json({
      data: { query, ...searchIndex(await readIndex(game), query) },
      updatedAt: new Date().toISOString(),
      mode,
    });
  });
  // Card page extras for the app: the same data the server-rendered page shows, for the printing in 'language'.
  app.get(routes('card-info'), async (req, res) =>
  {
    const expansionId = id(req.query.expansionId);
    const slug = z.string().regex(/^[a-z0-9-]{1,80}$/).parse(req.query.card);
    const catalog = catalogFor(expansionId);
    if (!catalog)
    {
      res.json(demo(null));
      return;
    }
    const expansion = (await catalog.sets()).data.find(set => set.id === expansionId);
    if (!expansion) throw new ApiError(404, 'Set not found.');
    const english = (await catalog.cards(expansionId, 'en')).data;
    const slugs = cardSlugs(english);
    const target = english.find(card => slugs.get(card.id) === slug);
    if (!target) throw new ApiError(404, 'Card not found.');
    const language = z.string().max(8).regex(/^[a-z]{2,3}(?:-[a-z]{2,4})?$/).catch('en').parse(req.query.language);
    const shown = language === 'en'
      ? target
      : samePrinting(english, (await catalog.cards(expansionId, language)).data, target) ?? target;
    cdn(res, DAY).json({
      data: await cardInfo(catalog, expansion, english, target, shown),
      updatedAt: new Date().toISOString(),
      mode,
    });
  });
  // Prices, deck sites, cards printed together and the illustrator's other cards: outside calls, so only visitors'
  // browsers ask (after a person interacts) and the CDN keeps each answer a day.
  app.get(routes('card-market'), rateLimit(60, 60_000), async (req, res) =>
  {
    const expansionId = id(req.query.expansionId);
    const slug = z.string().regex(/^[a-z0-9-]{1,80}$/).parse(req.query.card);
    const catalog = catalogFor(expansionId);
    if (!catalog)
    {
      res.json(demo(null));
      return;
    }
    const expansion = (await catalog.sets()).data.find(set => set.id === expansionId);
    if (!expansion) throw new ApiError(404, 'Set not found.');
    const english = (await catalog.cards(expansionId, 'en')).data;
    const slugs = cardSlugs(english);
    const target = english.find(card => slugs.get(card.id) === slug);
    if (!target) throw new ApiError(404, 'Card not found.');
    const language = z.string().max(8).regex(/^[a-z]{2,3}(?:-[a-z]{2,4})?$/).catch('en').parse(req.query.language);
    const shown = language === 'en'
      ? target
      : samePrinting(english, (await catalog.cards(expansionId, language)).data, target) ?? target;
    const illustrator = z.string().max(120).optional().catch(undefined).parse(req.query.illustrator) ?? null;
    const hasTcgplayer = req.query.tcgplayer === '1';
    cdn(res, DAY).json({
      data: await cardMarket(catalog, expansion, english, target, shown, {
        cardTrader: live ? client : undefined,
        pageLanguage: isSeoLanguage(language) ? language : 'en',
        illustrator,
        hasTcgplayer,
      }),
      updatedAt: new Date().toISOString(),
      mode,
    });
  });
  // Upcoming expansions of a game with cards already revealed (preview seasons), soonest first, with the count revealed.
  // Sets with few cards (event promos, sleeve bundles) are left out.
  app.get(routes('upcoming'), async (req, res) =>
  {
    const gameId = id(req.query.gameId);
    const catalog = catalogs.find(item => item.game.id === gameId);
    const today = new Date().toISOString().slice(0, 10);
    const future = catalog
      ? (await catalog.sets())
        .data
        .filter(set => set.releaseDate && set.releaseDate > today)
        .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))
        .slice(0, 4)
      : [];
    const counted = await Promise.all(
      future.map(async set => ({
        id: set.id,
        revealed: (await catalog!.cards(set.id, 'en').catch(() => ({ data: [] as CatalogCard[] }))).data.length,
      })),
    );
    res.set('Cache-Control', 'public, max-age=3600').set(
      'Netlify-CDN-Cache-Control',
      'public, durable, s-maxage=21600, stale-while-revalidate=86400',
    );
    res.json({ data: counted.filter(item => item.revealed >= 20), updatedAt: new Date().toISOString(), mode });
  });
  // Game text of one card, for print sheets whose image is missing: the sheet prints a text proxy instead.
  app.get(routes('card-text'), rateLimit(90, 60_000), async (req, res) =>
  {
    const expansionId = id(req.query.expansionId);
    const cardId = id(req.query.cardId);
    const catalog = catalogFor(expansionId);
    if (!catalog?.details)
    {
      res.json({ data: null, updatedAt: new Date().toISOString(), mode });
      return;
    }
    const expansion = (await catalog.sets()).data.find(set => set.id === expansionId);
    if (!expansion) throw new ApiError(404, 'Set not found.');
    const language = z.string().max(8).regex(/^[a-z]{2,3}(?:-[a-z]{2,4})?$/).catch('en').parse(req.query.language);
    const find = async (code: string) =>
      (await catalog.cards(expansionId, code).catch(() => ({ data: [] as CatalogCard[] }))).data.find(card =>
        card.id === cardId
      );
    const card = await find(language) ?? await find('en');
    if (!card) throw new ApiError(404, 'Card not found.');
    cdn(res, 7 * DAY).json({
      data: await catalog.details(card, expansion).catch(() => null),
      updatedAt: new Date().toISOString(),
      mode,
    });
  });
  app.post('/api/catalog/import', rateLimit(12, 60_000), async (req, res) =>
  {
    const body = z.object({
      gameId: z.number().int().positive(),
      language: z.string().max(8).regex(/^[a-z]{2,3}(?:-[a-z]{2,4})?$/).default('en'),
      list: z.string().min(1).max(30_000),
      scanFrom: z.number().int().min(0).max(10_000).optional(),
      tokens: z.boolean().optional(),
    })
      .parse(req.body);
    const catalog = catalogs.find(item => item.game.id === body.gameId);
    if (!catalog) throw new ApiError(404, 'Import is not available for this game.');
    // A Moxfield or Archidekt link instead of a list: read the public deck and import its cards.
    const link = deckLinkOf(body.list);
    let list = body.list;
    if (link)
    {
      try
      {
        list = await fetchDeckLink(link);
      }
      catch (e)
      {
        throw e instanceof DeckLinkError ? new ApiError(e.status, e.message) : e;
      }
    }
    const entries = parseDecklist(list);
    if (!entries.length) throw new ApiError(400, 'No card recognised in the list.');
    const slug = gameSlugOf(catalog);
    const index = slug ? await readIndex(slug).catch(() => null) : null;
    res.json({
      data: await importDecklist(catalog, entries, body.language, {
        scanFrom: body.scanFrom,
        index,
        tokens: body.tokens,
      }),
      updatedAt: new Date().toISOString(),
      mode,
    });
  });
  app.get(routes('offers'), rateLimit(24, 60_000), async (req, res) =>
  {
    const blueprintId = id(req.query.blueprintId);
    const language = z.string().regex(/^([a-z]{2}(-[A-Za-z]{2,4})?)?$/).parse(req.query.language ?? '');
    res.json(live ? { ...await client.offers(blueprintId, language), mode } : demo([]));
  });
  // Card pages (/it/pokemon/sv09/125/) and illustrator pages (/it/pokemon/illustratori/mousho/): rendered here, cached by the CDN for a month (they hold no prices; those load in the browser).
  // Error pages in the site's look and the page's language (shared/error-page.ts).
  const simplePage = (req: express.Request, kind: ErrorKind) => errorPage(kind, errorLanguage(req.path.split('/')[1]));
  // Expansion pages without a static file (upcoming sets, kept fresh): rendered from the live catalogue. Upcoming
  // sets are cached for a few hours, so the revealed count and the spoiler wording follow the preview season.
  app.get(/^\/(?:en|it|de|fr|es)\/[a-z0-9-]+\/[a-z0-9-]{1,80}\/?$/, rateLimit(120, 60_000), async (req, res, next) =>
  {
    const route = parseSeoPath(req.path.endsWith('/') ? req.path : req.path + '/');
    if (!route.language || !route.game || !route.set || route.feature)
    {
      next();
      return;
    }
    if (!req.path.endsWith('/'))
    {
      res.redirect(301, req.path + '/');
      return;
    }
    const origin = options.appOrigins?.[0] ?? `${req.protocol}://${req.get('host')}`;
    try
    {
      const page = await renderSetPage(
        { language: route.language, game: route.game, set: route.set },
        catalogs,
        origin,
        !!options.development,
      );
      if (page.status === 302)
      {
        res
          .set('Cache-Control', 'public, max-age=3600')
          .set('Netlify-CDN-Cache-Control', 'public, durable, s-maxage=604800')
          .redirect(302, page.location);
        return;
      }
      if (page.status === 404)
      {
        res.status(404).set('Cache-Control', 'public, max-age=600').type('html').send(
          simplePage(req, 'set'),
        );
        return;
      }
      res
        .set('Cache-Control', 'public, max-age=600')
        .set(
          'Netlify-CDN-Cache-Control',
          page.upcoming
            ? 'public, durable, s-maxage=21600, stale-while-revalidate=3600'
            : 'public, durable, s-maxage=86400, stale-while-revalidate=86400',
        )
        .type('html')
        .send(page.html);
    }
    catch
    {
      res.status(503).set('Cache-Control', 'no-store').type('html').send(
        simplePage(req, 'unavailable'),
      );
    }
  });
  app.get(
    /^\/(?:en|it|de|fr|es)\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]{1,80}\/?$/,
    rateLimit(120, 60_000),
    async (req, res) =>
    {
      if (!req.path.endsWith('/'))
      {
        res.redirect(301, req.path + '/');
        return;
      }
      const route = parseSeoPath(req.path);
      if (!route.language || !route.game || !route.set || !route.card)
      {
        res.status(404).type('html').send(simplePage(req, 'page'));
        return;
      }
      const origin = options.appOrigins?.[0] ?? `${req.protocol}://${req.get('host')}`;
      try
      {
        if (isIllustratorSegment(route.language, route.set))
        {
          const artistPage = await renderArtistPage(
            { language: route.language, game: route.game, artist: route.card },
            catalogs,
            origin,
            !!options.development,
          );
          if (artistPage.status === 404)
          {
            res.status(404).set('Cache-Control', 'public, max-age=600').type('html').send(
              simplePage(req, 'artist'),
            );
            return;
          }
          res
            .set('Cache-Control', 'public, max-age=3600')
            .set('Netlify-CDN-Cache-Control', 'public, durable, s-maxage=2592000, stale-while-revalidate=604800')
            .type('html')
            .send(artistPage.html);
          return;
        }
        const page = await renderCardPage(
          { language: route.language, game: route.game, set: route.set, card: route.card },
          catalogs,
          origin,
          !!options.development,
        );
        if (page.status === 302)
        {
          res
            .set('Cache-Control', 'public, max-age=3600')
            .set('Netlify-CDN-Cache-Control', 'public, durable, s-maxage=604800')
            .redirect(302, page.location);
          return;
        }
        if (page.status === 404)
        {
          res.status(404).set('Cache-Control', 'public, max-age=600').type('html').send(
            simplePage(req, 'card'),
          );
          return;
        }
        res
          .set('Cache-Control', 'public, max-age=3600')
          .set('Netlify-CDN-Cache-Control', 'public, durable, s-maxage=2592000, stale-while-revalidate=604800')
          .type('html')
          .send(page.html);
      }
      catch
      {
        // A source outage must not be cached as the page.
        res.status(503).set('Cache-Control', 'no-store').set('Retry-After', '120').type('html').send(
          simplePage(req, 'unavailable'),
        );
      }
    },
  );
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not available.' }));
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
  {
    void _next; // Express identifies error handlers by their four-argument signature.
    // An error is never cached, whatever headers the route had already set.
    if (!res.headersSent)
    {
      res.set('Cache-Control', 'no-store');
      res.removeHeader('Netlify-CDN-Cache-Control');
      res.removeHeader('Cloudflare-CDN-Cache-Control');
    }
    if (err instanceof ApiError)
    {
      res.status(err.status >= 400 && err.status <= 599 ? err.status : 502).json({ error: err.message });
    }
    else if (err instanceof z.ZodError)
    {
      res.status(400).json({ error: 'Invalid data, or a catalog response that was not recognised.' });
    }
    else res.status(500).json({ error: 'The request could not be completed. Try again.' });
  });
  // The site pages (sitemaps) read the live catalogues for expansions the snapshot does not know yet.
  app.locals.catalogs = catalogs;
  return app;
}
