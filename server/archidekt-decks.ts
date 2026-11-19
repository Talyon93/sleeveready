// The most viewed public Archidekt decks that play a Magic card, by its exact English name ("A // B" for two faces).
// Archidekt answers slowly or not at all for the commonest cards (Sol Ring): those get no list, only the links.
import type { CardDeck } from '../shared/model.ts';
import { Cache } from './cache.ts';

const decks = new Cache(Date.now, 400);
// Archidekt's format ids for the formats a reader would recognise; others show no format.
const formats: Record<number, string> = {
  1: 'Standard',
  2: 'Modern',
  3: 'Commander',
  4: 'Legacy',
  5: 'Vintage',
  6: 'Pauper',
  13: 'Brawl',
  14: 'Oathbreaker',
  15: 'Pioneer',
  24: 'Timeless',
};
type Row = {
  id: number;
  name: string;
  deckFormat?: number | null;
  viewCount?: number | null;
  featured?: string | null;
  customFeatured?: string | null;
  owner?: { username?: string | null } | null;
  private?: boolean;
  unlisted?: boolean;
};
const safeImage = (value: string | null | undefined) =>
  value && /^https:\/\/(storage\.googleapis\.com\/archidekt-card-images|card-images\.archidekt\.com)\//.test(value)
    ? value
    : null;

export async function archidektDecks(cardName: string): Promise<CardDeck[]>
{
  const name = cardName.trim();
  if (!name) return [];
  return (await decks.get(`decks:${name.toLowerCase()}`, 86_400_000, async () =>
  {
    const url = new URL('https://archidekt.com/api/decks/v3/');
    url.searchParams.set('cardName', name);
    url.searchParams.set('orderBy', '-viewCount');
    url.searchParams.set('pageSize', '12');
    try
    {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'SleeveReady/1.0 (+https://sleeveready.com)', Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return [];
      const rows = ((await response.json()) as { results?: Row[] }).results ?? [];
      return rows.filter(row => row.id && row.name && !row.private && !row.unlisted).slice(0, 8).map(row => ({
        name: row.name.slice(0, 90),
        url: `https://archidekt.com/decks/${row.id}`,
        format: row.deckFormat ? formats[row.deckFormat] ?? null : null,
        views: row.viewCount ?? 0,
        owner: row.owner?.username?.slice(0, 40) ?? null,
        image: safeImage(row.customFeatured) ?? safeImage(row.featured),
      }));
    }
    catch
    {
      return [];
    }
  }))
    .data;
}
