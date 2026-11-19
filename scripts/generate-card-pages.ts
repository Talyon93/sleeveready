// Card pages as static files, written by the Netlify build: Netlify serves a file before any redirect, so a written
// page never runs the function (which bills every second it waits on the card sources). Covers the expansions of the
// last year (the ones in the sitemaps), newest first, every game at once, within a time budget; pages are kept in
// .card-pages/, which the build cache carries to the next build (netlify/plugins/card-pages-cache), so each build only
// writes new pages and refreshes the oldest. Pages it does not reach get the app shell (dist/card-shell.html).
// Runs on Netlify, or anywhere with CARD_PAGES=1; CARD_PAGES_BUDGET_SECONDS sets the budget (default 7 minutes).
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

if (process.env.NETLIFY !== 'true' && process.env.CARD_PAGES !== '1')
{
  console.log('Card pages: skipped (set CARD_PAGES=1 to write them).');
  process.exit(0);
}
// Whole expansions stay in memory while their pages are written.
process.env.CACHE_MAX_ENTRIES ??= '50000';

const { buildCatalogs } = await import('../server/catalogs.ts');
const { renderCardPage } = await import('../server/card-pages.ts');
const { pageLanguagesOf } = await import('../server/card-index.ts');
const { cardPath, cardSlugs, expansionSlug, seoSlugForGame } = await import('../shared/seo.ts');
const { offlineGamePath, unindexedCardPath } = await import('../shared/games.ts');
type SeoGameSlug = import('../shared/seo.ts').SeoGameSlug;
type NativeCatalog = import('../server/native-source.ts').NativeCatalog;

const started = Date.now();
const budgetMs = Number(process.env.CARD_PAGES_BUDGET_SECONDS ?? 420) * 1000;
const outOfTime = () => Date.now() - started > budgetMs;
const keep = new URL('../.card-pages/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const manifestFile = join(keep, 'manifest.json');
// Pages are rewritten after a month, oldest first, once every new page is written.
const REFRESH_MS = 30 * 86_400_000;
const origin = (process.env.PUBLIC_APP_ORIGIN ?? 'https://sleeveready.com').split(',')[0].trim().replace(/\/+$/, '');
const since = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);

const manifest: Record<string, number> = await readFile(manifestFile, 'utf8').then(
  text => JSON.parse(text) as Record<string, number>,
  () => ({}),
);
const { catalogs } = buildCatalogs();
let written = 0;
let failed = 0;
let saved = Date.now();
const save = async () =>
{
  await mkdir(keep, { recursive: true });
  await writeFile(manifestFile, JSON.stringify(manifest));
  saved = Date.now();
};

type Page = { game: SeoGameSlug; language: string; set: string; card: string; path: string };
// One game: its recent expansions newest first, a few pages at a time (each source has its own request queue).
async function game(catalog: NativeCatalog, refresh: boolean)
{
  const slug = seoSlugForGame(catalog.game.name + ' ' + catalog.game.displayName) as SeoGameSlug | null;
  if (!slug) return;
  const sets = (await catalog.sets()).data.filter(set => set.releaseDate && set.releaseDate >= since).sort((a, b) =>
    (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '')
  );
  for (const expansion of sets)
  {
    if (outOfTime()) return;
    try
    {
      const english = (await catalog.cards(expansion.id, 'en')).data;
      const slugs = cardSlugs(english);
      const printed = (catalog.game.printLanguages?.length ?? 0) > 1
        ? (await catalog.languages(expansion.id)).data
        : ['en'];
      const set = expansionSlug(expansion);
      const pages: Page[] = pageLanguagesOf(printed).flatMap(language =>
        english.map(card => slugs.get(card.id)).filter((card): card is string => Boolean(card)).map(card => ({
          game: slug,
          language,
          set,
          card,
          path: cardPath(language as never, slug, set, card),
        }))
      );
      const due = pages.filter(page =>
        refresh ? (manifest[page.path] ?? 0) < Date.now() - REFRESH_MS : !manifest[page.path]
      );
      if (!due.length) continue;
      if (catalog.primeExpansion)
      {
        await catalog.primeExpansion(expansion).catch(() =>
        {});
      }
      for (let offset = 0; offset < due.length && !outOfTime(); offset += 4)
      {
        await Promise.all(due.slice(offset, offset + 4).map(write));
      }
    }
    catch (error)
    {
      failed++;
      console.warn(
        `Card pages: ${slug} ${expansion.code ?? expansion.id} failed: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}

async function write(page: Page)
{
  try
  {
    const result = await renderCardPage(
      { language: page.language as never, game: page.game, set: page.set, card: page.card },
      catalogs,
      origin,
      false,
      { allNames: true },
    );
    if (result.status !== 200) return;
    const file = join(keep, page.path, 'index.html');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, result.html);
    manifest[page.path] = Date.now();
    written++;
    if (Date.now() - saved > 30_000)
    {
      await save();
      console.log(`Card pages: ${written} written, ${Math.round((Date.now() - started) / 1000)} s.`);
    }
  }
  catch (error)
  {
    failed++;
    if (failed <= 20)
    {
      console.warn(`Card pages: ${page.path} failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}

try
{
  await Promise.all(
    catalogs.map(catalog =>
      game(catalog, false).catch(error =>
        console.warn(`Card pages: ${catalog.game.name} skipped: ${error instanceof Error ? error.message : error}`)
      )
    ),
  );
  if (!outOfTime())
  {
    await Promise.all(catalogs.map(catalog =>
      game(catalog, true).catch(() =>
      {})
    ));
  }
}
finally
{
  await save();
  // Every kept page goes out with the site, older expansions included: a static page costs nothing to serve.
  await cp(keep, dist, {
    recursive: true,
    filter: source => !source.endsWith('manifest.json') && !offlineGamePath(source),
  });
  // Pages kept from earlier builds still say index,follow: those of games kept out of search engines are switched to
  // noindex on the way out, so the change reaches every page at once instead of over a month of refreshes.
  let switched = 0;
  for (const file of await readdir(dist, { recursive: true }).catch(() => [] as string[]))
  {
    if (!file.endsWith('index.html') || !unindexedCardPath('/' + file)) continue;
    const path = join(dist, file);
    const html = await readFile(path, 'utf8');
    const next = html.replace(
      '<meta name="robots" content="index,follow"/>',
      '<meta name="robots" content="noindex,follow"/>',
    );
    if (next !== html)
    {
      await writeFile(path, next);
      switched++;
    }
  }
  if (switched) console.log(`Card pages: ${switched} kept pages switched to noindex.`);
  console.log(
    `Card pages: ${written} written this build, ${Object.keys(manifest).length} in total, ${failed} failed, ${
      Math.round((Date.now() - started) / 1000)
    } s.`,
  );
}
process.exit(0);
