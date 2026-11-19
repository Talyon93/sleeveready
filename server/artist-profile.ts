// Artist profile for illustrator pages. Two layers:
// - catalogue facts, true for every artist: years in print, expansions, the expansion with most of their cards and,
//   for Magic, the colours and card type they illustrate most and how many rares and mythics;
// - Wikidata facts (CC0) only when exactly one item has the artist's exact name and an artistic occupation:
//   nationality, official website and Wikipedia link. Birth dates are left out: they are often wrong for TCG artists.
import { z } from 'zod';
import { Cache } from './cache.ts';
import { normaliseCardName } from '../shared/decklist.ts';
import type { CardPrinting } from '../shared/model.ts';
import { seoLanguages, type SeoLanguage } from '../shared/seo.ts';

export type ColourCode = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
export type MainType =
  | 'Creature'
  | 'Planeswalker'
  | 'Instant'
  | 'Sorcery'
  | 'Enchantment'
  | 'Artifact'
  | 'Land'
  | 'Battle';
export type ArtistStats = {
  firstYear: number | null;
  lastYear: number | null;
  sets: number;
  topSet: { name: string; count: number } | null;
  colours: ColourCode[];
  type: MainType | null;
  rares: number | null;
};
const MAIN_TYPES: MainType[] = [
  'Creature',
  'Planeswalker',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Land',
  'Battle',
];
// Shares below these thresholds say nothing about the artist, so the row is left out.
const MIN_SAMPLE = 5;
const COLOUR_SHARE = 0.25;
const TYPE_SHARE = 0.4;

export function artistStats(cards: CardPrinting[], releaseDates: Map<string, string | null>): ArtistStats
{
  const years = cards
    .map(item => releaseDates.get(item.set)?.slice(0, 4))
    .filter((year): year is string => Boolean(year))
    .map(Number);
  const perSet = new Map<string, { name: string; count: number }>();
  for (const item of cards)
  {
    const entry = perSet.get(item.set) ?? { name: item.setName, count: 0 };
    entry.count++;
    perSet.set(item.set, entry);
  }
  const top = [...perSet.values()].sort((a, b) => b.count - a.count)[0];
  // Magic only: the illustrator search carries colours and type lines.
  const coloured = cards.filter(item => Array.isArray(item.card.colors) && item.card.typeLine);
  const colourCount = new Map<ColourCode, number>();
  for (const item of coloured)
  {
    const colours = item.card.colors!.length ? item.card.colors! : ['C'];
    for (const colour of colours)
    {
      colourCount.set(colour as ColourCode, (colourCount.get(colour as ColourCode) ?? 0) + 1);
    }
  }
  const colours = coloured.length >= MIN_SAMPLE
    ? [...colourCount.entries()]
      .filter(([, count]) => count / coloured.length >= COLOUR_SHARE)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([colour]) => colour)
    : [];
  const typeCount = new Map<MainType, number>();
  for (const item of coloured)
  {
    const main = MAIN_TYPES.find(type => item.card.typeLine!.split('—')[0].includes(type));
    if (main) typeCount.set(main, (typeCount.get(main) ?? 0) + 1);
  }
  const [topType] = [...typeCount.entries()].sort((a, b) => b[1] - a[1]);
  const magicRarity = cards.some(item => ['common', 'uncommon', 'rare', 'mythic'].includes(item.card.rarity ?? ''));
  return {
    // Years only when every expansion is dated: a calendar missing the oldest expansions would give a wrong first year.
    ...([...perSet.keys()].every(set => releaseDates.get(set)) && years.length
      ? { firstYear: Math.min(...years), lastYear: Math.max(...years) }
      : { firstYear: null, lastYear: null }),
    sets: perSet.size,
    topSet: top && top.count >= 2 && perSet.size > 1 ? top : null,
    colours,
    type: topType && coloured.length >= MIN_SAMPLE && topType[1] / coloured.length >= TYPE_SHARE ? topType[0] : null,
    rares: magicRarity
      ? cards.filter(item => item.card.rarity === 'rare' || item.card.rarity === 'mythic').length
      : null,
  };
}

export type WikidataProfile = {
  id: string;
  country: Partial<Record<SeoLanguage, string>>;
  website: string | null;
  wikipedia: Partial<Record<SeoLanguage, string>>;
};
// Illustrator, painter, comics artist, graphic artist, artist, visual artist, cartoonist, manga artist.
const ARTISTIC = new Set(['Q644687', 'Q1028181', 'Q715301', 'Q1925963', 'Q483501', 'Q3391743', 'Q1114448', 'Q191633']);
const origin = 'https://www.wikidata.org';
const searchSchema = z.object({
  search: z.array(z.object({ id: z.string(), label: z.string().optional() })).default([]),
});
const claim = z.object({ mainsnak: z.object({ datavalue: z.object({ value: z.unknown() }).optional() }) });
const entitySchema = z.object({
  entities: z.record(
    z.string(),
    z.object({
      id: z.string(),
      labels: z.record(z.string(), z.object({ value: z.string() })).optional(),
      claims: z.record(z.string(), z.array(claim)).optional(),
      sitelinks: z.record(z.string(), z.object({ url: z.string().optional() })).optional(),
    }),
  ),
});
const cache = new Cache(Date.now, 500);

async function wikidata(params: Record<string, string>, transport: typeof fetch)
{
  const url = new URL('/w/api.php', origin);
  for (const [key, value] of Object.entries({ ...params, format: 'json' })) url.searchParams.set(key, value);
  const response = await transport(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'SleeveReady/0.1 (+https://sleeveready.com)' },
    signal: AbortSignal.timeout(8000),
    redirect: 'error',
  });
  if (!response.ok)
  {
    await response.body?.cancel();
    throw new Error(`Wikidata ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}
const ids = (claims: Record<string, z.infer<typeof claim>[]> | undefined, property: string) =>
  (claims?.[property] ?? []).map(item => (item.mainsnak.datavalue?.value as { id?: string } | undefined)?.id).filter((
    id,
  ): id is string => Boolean(id));
const strings = (claims: Record<string, z.infer<typeof claim>[]> | undefined, property: string) =>
  (claims?.[property] ?? []).map(item => item.mainsnak.datavalue?.value).filter((value): value is string =>
    typeof value === 'string'
  );

// Cached for a week per name; any error or ambiguity gives no Wikidata facts rather than possibly wrong ones.
export async function wikidataProfile(artist: string, transport: typeof fetch = fetch): Promise<WikidataProfile | null>
{
  try
  {
    return (await cache.get(`wikidata:${artist.toLowerCase()}`, 7 * 86_400_000, async () =>
    {
      const wanted = normaliseCardName(artist);
      const found = searchSchema
        .parse(
          await wikidata(
            { action: 'wbsearchentities', search: artist, language: 'en', type: 'item', limit: '7' },
            transport,
          ),
        )
        .search
        .filter(item => normaliseCardName(item.label ?? '') === wanted);
      if (!found.length) return null;
      const entities = Object.values(
        entitySchema
          .parse(
            await wikidata({
              action: 'wbgetentities',
              ids: found.map(item => item.id).join('|'),
              props: 'claims|sitelinks/urls',
            }, transport),
          )
          .entities,
      );
      const artists = entities.filter(entity => ids(entity.claims, 'P106').some(id => ARTISTIC.has(id)));
      if (artists.length !== 1) return null;
      const person = artists[0];
      const countryId = ids(person.claims, 'P27')[0];
      const country: WikidataProfile['country'] = {};
      if (countryId)
      {
        const labels = Object
          .values(
            entitySchema
              .parse(
                await wikidata({
                  action: 'wbgetentities',
                  ids: countryId,
                  props: 'labels',
                  languages: seoLanguages.join('|'),
                }, transport),
              )
              .entities,
          )[0]
          ?.labels ?? {};
        for (const language of seoLanguages) if (labels[language]) country[language] = labels[language].value;
      }
      const website = strings(person.claims, 'P856').find(value => /^https?:\/\//.test(value)) ?? null;
      const wikipedia: WikidataProfile['wikipedia'] = {};
      for (const language of seoLanguages)
      {
        const url = person.sitelinks?.[`${language}wiki`]?.url;
        if (url?.startsWith(`https://${language}.wikipedia.org/`)) wikipedia[language] = url;
      }
      return { id: person.id, country, website, wikipedia };
    }))
      .data;
  }
  catch
  {
    return null;
  }
}
