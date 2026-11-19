import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { findSeoSet, seoSetSnapshot, staticSeoPaths, upcomingSetPaths } from '../shared/seo-sets.ts';
import { renderSeoPage } from '../shared/seo-page.ts';
import { affiliateConfig } from '../shared/affiliate.ts';

const origin = (process.env.PUBLIC_APP_ORIGIN || process.env.URL || 'https://sleeveready.com').replace(/\/$/, '');
const options = {
  origin,
  affiliate: affiliateConfig(process.env),
  findSet: findSeoSet,
  gameSets: (game: keyof typeof seoSetSnapshot.games) => seoSetSnapshot.games[game] ?? [],
  script: '<script type="module" src="/src/main.tsx"></script>',
};

for (const path of staticSeoPaths)
{
  const target = resolve('.' + path, 'index.html');
  await mkdir(resolve('.' + path), { recursive: true });
  await writeFile(target, renderSeoPage(path, options), 'utf8');
}
// Upcoming sets are served fresh by the server function: drop static copies left by earlier builds.
for (const path of upcomingSetPaths) await rm(resolve('.' + path), { recursive: true, force: true });
console.log(
  `Generated ${staticSeoPaths.length} SEO pages for ${origin} (${upcomingSetPaths.size} upcoming set pages served live)`,
);
