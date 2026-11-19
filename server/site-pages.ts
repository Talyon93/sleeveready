import type { Express } from 'express';
import { allIndexablePaths, upcomingSetPaths } from '../shared/seo-sets.ts';
import { seoGames, type SeoGameSlug } from '../shared/seo.ts';
import { legalHref, legalLanguages } from '../shared/legal.ts';
import { privacyText, termsText } from './legal-pages.ts';
import { cachedIndexReader, cardIndexStore, recentCardPaths, type GameIndex } from './card-index.ts';
import { liveSetPaths } from './live-sets.ts';
import { blockedBots } from './bots.ts';
import { cardPagesIndexed } from '../shared/games.ts';
import type { NativeCatalog } from './native-source.ts';

type SitePageOptions = {
  siteOrigin: string;
  privacyController?: string;
  privacyEmail?: string;
  readIndex?: (game: SeoGameSlug) => Promise<GameIndex>;
};
// Sitemaps hold at most 50,000 URLs; card sitemaps are split well below that.
export const SITEMAP_CHUNK = 40_000;
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]!),
  );
const page = (title: string, body: string, language = 'en') =>
  `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} — SleeveReady</title><link rel="stylesheet" href="/legal.css"></head><body><main><p><a href="/">← SleeveReady</a></p>${body}</main></body></html>`;

export function registerSitePages(app: Express, options: SitePageOptions)
{
  const siteOrigin = options.siteOrigin.replace(/\/$/, '');
  const controller = escapeHtml(options.privacyController?.trim() || 'SleeveReady publisher');
  const email = escapeHtml(options.privacyEmail?.trim() || 'privacy contact not configured');
  // Crawlers that train AI models or sell SEO data bring no visitors and every page they open costs a function run:
  // they are kept out. Search engines and AI search assistants (which send visitors) stay welcome, but not on /api/.
  app.get(
    '/robots.txt',
    (_req, res) =>
      res
        .set('Cache-Control', 'public, max-age=86400')
        .set('Netlify-CDN-Cache-Control', 'public, durable, s-maxage=86400')
        .type('text/plain')
        .send(
          `${
            blockedBots.map(bot => `User-agent: ${bot}\nDisallow: /\n`).join('\n')
          }\nUser-agent: *\nDisallow: /api/\nCrawl-delay: 5\nAllow: /\n\nSitemap: ${siteOrigin}/sitemap.xml\n`,
        ),
  );
  // Home pages, then game pages, then expansion pages.
  const url = (path: string, lastmod?: string) =>
  {
    const depth = path.split('/').filter(Boolean).length;
    return `<url><loc>${siteOrigin}${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>${
      depth === 1 ? 'daily' : 'weekly'
    }</changefreq><priority>${depth === 1 ? '1.0' : depth === 2 ? '0.8' : '0.6'}</priority></url>`;
  };
  // Snapshot pages plus expansions the snapshot does not know yet (live; off with SITEMAP_LIVE=0, e.g. in tests).
  const catalogs = () => (app.locals.catalogs as NativeCatalog[] | undefined) ?? [];
  const pagePaths = async () =>
  {
    const live = process.env.SITEMAP_LIVE === '0' ? [] : await liveSetPaths(catalogs()).catch(() => []);
    return { paths: [...new Set([...allIndexablePaths, ...live])], fresh: new Set([...upcomingSetPaths, ...live]) };
  };
  // A sitemap index: static pages in one file, then the card pages of every indexed expansion in numbered files per game.
  const readIndex = options.readIndex ?? cachedIndexReader(cardIndexStore());
  // Only expansions of the last year: every card page a crawler opens costs a function run.
  // Games whose card pages are kept out of search engines (shared/games.ts) get no card sitemap.
  const cardPaths = async (game: SeoGameSlug) => cardPagesIndexed(game) ? recentCardPaths(await readIndex(game)) : [];
  const xml = (res: import('express').Response, body: string) =>
    res
      .set('Cache-Control', 'public, max-age=3600')
      .set('Netlify-CDN-Cache-Control', 'public, durable, s-maxage=86400, stale-while-revalidate=86400')
      .type('application/xml')
      .send('<?xml version="1.0" encoding="UTF-8"?>' + body);
  app.get('/sitemap.xml', async (_req, res) =>
  {
    const files = ['pages'];
    for (const game of seoGames)
    {
      const count = Math.ceil((await cardPaths(game.slug)).length / SITEMAP_CHUNK);
      for (let part = 1; part <= count; part++) files.push(`cards-${game.slug}-${part}`);
    }
    xml(
      res,
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
        files.map(name => `<sitemap><loc>${siteOrigin}/sitemap-${name}.xml</loc></sitemap>`).join('')
      }</sitemapindex>`,
    );
  });
  // Pages rendered live (coming sets in their preview season, sets newer than the snapshot) change every day: their
  // lastmod is today, so crawlers come back for the cards revealed since.
  app.get('/sitemap-pages.xml', async (_req, res) =>
  {
    const { paths, fresh } = await pagePaths();
    const today = new Date().toISOString().slice(0, 10);
    xml(
      res,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
        paths.map(path => url(path, fresh.has(path) ? today : undefined)).join('')
      }</urlset>`,
    );
  });
  app.get(/^\/sitemap-cards-([a-z0-9-]+)-(\d{1,3})\.xml$/, async (req, res) =>
  {
    const game = seoGames.find(item => item.slug === req.params[0]);
    const part = Number(req.params[1]);
    const paths = game ? (await cardPaths(game.slug)).slice((part - 1) * SITEMAP_CHUNK, part * SITEMAP_CHUNK) : [];
    if (!paths.length)
    {
      res.status(404).type('text/plain').send('Not found');
      return;
    }
    xml(
      res,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
        paths.map(path => `<url><loc>${siteOrigin}${path}</loc></url>`).join('')
      }</urlset>`,
    );
  });
  // Privacy notice and terms in English (/privacy, /terms) and Italian (/privacy/it, /terms/it), each linking the other.
  for (const [path, texts] of [['privacy', privacyText], ['terms', termsText]] as const)
  {
    for (const language of legalLanguages)
    {
      const other = language === 'it' ? 'en' : 'it';
      app.get(
        language === 'en' ? `/${path}` : `/${path}/${language}`,
        (_req, res) =>
          res.type('html').send(
            page(
              texts[language].title,
              `<p class="legal-switch"><a href="${legalHref(path, other)}" hreflang="${other}">${
                texts[language].switchLabel
              }</a></p>${texts[language].body({ controller, email })}`,
              language,
            ),
          ),
      );
    }
  }
}
