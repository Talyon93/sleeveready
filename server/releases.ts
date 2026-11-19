import { upstreamSignal } from './upstream.ts';
import type { CardExpansion } from '../shared/model.ts';
import { readFile } from 'node:fs/promises';
import { Queue } from './cache.ts';
const publicQueue = new Queue(5000);

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
function decode(text: string)
{
  return text
    .replace(
      /&#(x[0-9a-f]+|\d+);/gi,
      (_, code: string) =>
        String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)),
    )
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
export const releaseKey = (name: string) =>
  decode(name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function parseReleaseDates(html: string): Map<string, string>
{
  const dates = new Map<string, string>();
  const ambiguous = new Set<string>();
  // Each public expansion has a name heading followed by item count and release date.
  // Stop at the enclosing summary div so a missing date never inherits the next set's date.
  const entries = html.matchAll(/<b\s+class="h6 text-tertiary">([^<]+)<\/b>([\s\S]*?)<\/div>/g);
  for (const entry of entries)
  {
    const match = entry[2].match(/<b\s+class="h6 mt-2 d-block">(\d{1,2}) ([A-Za-z]+) (\d{4})<\/b>/);
    if (!match) continue;
    const month = months.indexOf(match[2]);
    if (month < 0) continue;
    const year = Number(match[3]), day = Number(match[1]);
    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCMonth() !== month || date.getUTCDate() !== day || year < 1990 || year > 2100) continue;
    const key = releaseKey(entry[1]), iso = date.toISOString().slice(0, 10);
    if (dates.has(key) && dates.get(key) !== iso) ambiguous.add(key);
    else dates.set(key, iso);
  }
  for (const key of ambiguous) dates.delete(key);
  return dates;
}
export function releaseSlug(gameName: string): string | null
{
  if (/magic/i.test(gameName)) return 'magic';
  if (/yu-gi-oh/i.test(gameName)) return 'yu-gi-oh';
  if (/pok[eé]mon/i.test(gameName)) return 'pokemon';
  if (/flesh and blood/i.test(gameName)) return 'flesh-and-blood';
  if (/digimon/i.test(gameName)) return 'digimon';
  if (/dragon ball/i.test(gameName)) return 'dragon-ball-super';
  if (/vanguard/i.test(gameName)) return 'vanguard';
  if (/one\s*piece/i.test(gameName)) return 'one-piece';
  if (/lorcana/i.test(gameName)) return 'lorcana';
  if (/star wars/i.test(gameName)) return 'star-wars';
  if (/union arena/i.test(gameName)) return 'union-arena';
  if (/riftbound/i.test(gameName)) return 'riftbound';
  if (/gundam/i.test(gameName)) return 'gundam';
  if (/sorcery/i.test(gameName)) return 'sorcery';
  if (/palworld/i.test(gameName)) return 'palworld';
  if (/cyberpunk/i.test(gameName)) return 'cyberpunk';
  return null;
}
export async function fetchReleaseDates(slug: string, refresh = false): Promise<Map<string, string>>
{
  if (
    ![
      'magic',
      'yu-gi-oh',
      'pokemon',
      'flesh-and-blood',
      'digimon',
      'dragon-ball-super',
      'vanguard',
      'one-piece',
      'lorcana',
      'star-wars',
      'union-arena',
      'riftbound',
      'gundam',
      'sorcery',
      'palworld',
      'cyberpunk',
    ]
      .includes(slug)
  ) throw new Error('Unsupported game');
  if (!refresh)
  {
    try
    {
      const stored = JSON.parse(await readFile(new URL('./data/releases.json', import.meta.url), 'utf8'));
      if (stored[slug]?.dates) return new Map(Object.entries(stored[slug].dates));
    }
    catch
    {
      /* First run can fetch the current page. */
    }
  }
  const dates = new Map<string, string>();
  let lastPage = 1;
  for (let page = 1; page <= lastPage; page++)
  {
    const html = await publicQueue.run(async () =>
    {
      for (let attempt = 0; attempt < 3; attempt++)
      {
        let url = new URL(
          `https://www.cardtrader.com/en/games/${slug}/expansions${page === 1 ? '' : '?embedded=%2A&page=' + page}`,
        );
        let response: Response | undefined;
        for (let redirect = 0; redirect < 4; redirect++)
        {
          response = await fetch(url, {
            signal: upstreamSignal(20000),
            headers: { Accept: 'text/html' },
            redirect: 'manual',
          });
          if (![301, 302, 303, 307, 308].includes(response.status)) break;
          const next = new URL(response.headers.get('location') ?? '', url);
          await response.body?.cancel();
          if (next.protocol !== 'https:' || !['cardtrader.com', 'www.cardtrader.com'].includes(next.hostname))
          {
            throw new Error('Unexpected release page redirect');
          }
          url = next;
        }
        if (!response) throw new Error('Release page unavailable');
        if (response.status === 429 && attempt < 2)
        {
          await response.body?.cancel();
          await new Promise(r => setTimeout(r, 30000));
          continue;
        }
        if (!response.ok) throw new Error(`Release dates unavailable (${response.status})`);
        const text = await response.text();
        if (text.length > 12_000_000) throw new Error('Release page too large');
        return text;
      }
      throw new Error('Release dates unavailable');
    });
    if (refresh && page === 1)
    {
      const pages = [...html.matchAll(/(?:\?|&|&amp;)page=(\d+)/g)].map(x => Number(x[1]));
      lastPage = Math.min(40, Math.max(1, ...pages));
    }
    for (const [name, date] of parseReleaseDates(html)) dates.set(name, date);
  }
  if (!dates.size) throw new Error('Release dates not found');
  return dates;
}
export function withReleaseDates(sets: CardExpansion[], dates: Map<string, string>): CardExpansion[]
{
  return sets
    .map(set => ({ ...set, releaseDate: dates.get(releaseKey(set.name)) ?? null }))
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || a.name.localeCompare(b.name));
}
