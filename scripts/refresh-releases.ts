import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fetchReleaseDates } from '../server/releases.ts';
const file = new URL('../server/data/releases.json', import.meta.url);
await mkdir(new URL('../server/data/', import.meta.url), { recursive: true });
let data: Record<string, unknown> = {};
try
{
  data = JSON.parse(await readFile(file, 'utf8'));
}
catch
{
  /* First run. */
}
for (const slug of ['riftbound', 'lorcana', 'one-piece', 'magic', 'pokemon'])
{
  const dates = await fetchReleaseDates(slug, true);
  data[slug] = {
    source: `https://www.cardtrader.com/en/games/${slug}/expansions`,
    updatedAt: new Date().toISOString(),
    dates: Object.fromEntries(dates),
  };
  await writeFile(file, JSON.stringify(data, null, 2) + '\n');
  console.log(slug + ': ' + dates.size + ' release dates saved');
}
