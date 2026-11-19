// Refreshes shared/data/seo-sets.json: the newest expansions of every game, with card names in each language
// they are really printed in. Expansion pages are generated from this snapshot, so builds never call the sources.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Scryfall } from '../server/scryfall.ts';
import { TCGdex } from '../server/tcgdex.ts';
import { OnePieceCatalog } from '../server/onepiece.ts';
import { LorcanaCatalog } from '../server/lorcana.ts';
import { RiftboundCatalog } from '../server/riftbound.ts';
import { YugiohCatalog } from '../server/yugioh.ts';
import { StarWarsCatalog } from '../server/starwars.ts';
import { SorceryCatalog } from '../server/sorcery.ts';
import { FleshAndBloodCatalog } from '../server/fleshandblood.ts';
import { DigimonCatalog } from '../server/digimon.ts';
import { DragonBallCatalog } from '../server/dragonball.ts';
import { GundamCatalog } from '../server/gundam.ts';
import { UnionArenaCatalog } from '../server/unionarena.ts';
import { VanguardCatalog } from '../server/vanguard.ts';
import { PalworldCatalog } from '../server/palworld.ts';
import { CyberpunkCatalog } from '../server/cyberpunk.ts';
import {
  cardSlugs,
  expansionSlug,
  seoLanguages,
  seoSlugForGame,
  type SeoGameSlug,
  type SeoLanguage,
} from '../shared/seo.ts';
import type { SeoSetSnapshot } from '../shared/seo-sets.ts';
import type { CardExpansion, CardGame, CatalogCard } from '../shared/model.ts';

type Catalog = {
  game: CardGame;
  sets: () => Promise<{ data: CardExpansion[] }>;
  cards: (id: number, language: string) => Promise<{ data: CatalogCard[] }>;
  languages: (id: number) => Promise<{ data: string[] }>;
};
const withGame = (game: CardGame, catalog: Omit<Catalog, 'game'>): Catalog => ({
  game,
  sets: () => catalog.sets(),
  cards: (id, language) => catalog.cards(id, language),
  languages: id => catalog.languages(id),
});
const scryfall = new Scryfall();
const tcgdex = new TCGdex();
const onePiece = new OnePieceCatalog();
const lorcana = new LorcanaCatalog();
const riftbound = new RiftboundCatalog();
const yugioh = new YugiohCatalog();
const starWars = new StarWarsCatalog();
const catalogs: Catalog[] = [
  withGame({ id: 1, name: 'Magic', displayName: 'Magic: The Gathering' }, scryfall),
  withGame({ id: 2, name: 'Pokemon', displayName: 'Pokémon' }, tcgdex),
  withGame({ id: 3, name: 'One Piece', displayName: 'One Piece' }, onePiece),
  withGame({ id: 4, name: 'Lorcana', displayName: 'Disney Lorcana' }, lorcana),
  withGame({ id: 5, name: 'Riftbound', displayName: 'Riftbound' }, riftbound),
  withGame({ id: 6, name: 'Yu-Gi-Oh!', displayName: 'Yu-Gi-Oh!' }, yugioh),
  withGame({ id: 7, name: 'Star Wars', displayName: 'Star Wars Unlimited' }, starWars),
  new SorceryCatalog(),
  new FleshAndBloodCatalog(),
  new DigimonCatalog(),
  new DragonBallCatalog(),
  new GundamCatalog(),
  new UnionArenaCatalog(),
  new VanguardCatalog(),
  new PalworldCatalog(),
  new CyberpunkCatalog(),
];

const previous: SeoSetSnapshot = await readFile(new URL('../shared/data/seo-sets.json', import.meta.url), 'utf8')
  .then(text => JSON.parse(text) as SeoSetSnapshot)
  .catch(() => ({ generatedAt: '', games: {} }));
const SETS_PER_GAME = Number(process.env.SEO_SETS_PER_GAME ?? 8);
const MIN_CARDS = 30;
// Plus the soonest upcoming sets with enough revealed cards: their pages are the spoiler pages of preview season.
const UPCOMING_PER_GAME = 2;
const MIN_REVEALED = 20;
const NAMES_PER_LANGUAGE = 40;
// Card-language codes as sources spell them, mapped to the page language they serve.
const pageLanguage = (code: string): SeoLanguage | null =>
{
  const base = code.toLowerCase().split('-')[0];
  return (seoLanguages as string[]).includes(base) ? base as SeoLanguage : null;
};
const displayCode = (code: string) => ({ zhs: 'zh-Hans', zht: 'zh-Hant' } as Record<string, string>)[code] ?? code;
// Names of the set's first cards, aligned with their URL slugs so expansion pages can link each card page.
const namesBySlug = (cards: CatalogCard[], wanted: string[]) =>
{
  const slugs = cardSlugs(cards);
  const names = new Map(cards.map(card => [slugs.get(card.id)!, card.name]));
  return wanted.map(slug => names.get(slug) ?? '');
};

async function refresh(catalog: Catalog)
{
  const slug = seoSlugForGame(catalog.game.name + ' ' + catalog.game.displayName);
  if (!slug) throw new Error('No SEO page for ' + catalog.game.displayName);
  const today = new Date().toISOString().slice(0, 10);
  const all = (await catalog.sets()).data;
  const upcoming = all
    .filter(set => set.releaseDate && set.releaseDate > today)
    .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))
    .slice(0, 6);
  const sets = [...upcoming, ...all.filter(set => !set.releaseDate || set.releaseDate <= today)];
  const pages: SeoSetSnapshot['games'][SeoGameSlug] = [];
  const slugs = new Set<string>();
  let upcomingPages = 0;
  for (const set of sets)
  {
    const future = upcoming.includes(set);
    if (future ? upcomingPages >= UPCOMING_PER_GAME : pages.length - upcomingPages >= SETS_PER_GAME) continue;
    // Sources rate-limit bursts (Scryfall in particular): retry a failed expansion twice after a pause.
    for (let attempt = 0; attempt < 3; attempt++)
    {
      try
      {
        const english = (await catalog.cards(set.id, 'en')).data;
        if (english.length < (future ? MIN_REVEALED : MIN_CARDS)) break;
        const languages = (await catalog.languages(set.id)).data;
        const englishSlugs = cardSlugs(english);
        const slugList = english.map(card => englishSlugs.get(card.id)!);
        const listed = slugList.slice(0, NAMES_PER_LANGUAGE);
        const cards: Partial<Record<SeoLanguage, string[]>> = { en: namesBySlug(english, listed) };
        for (const code of languages)
        {
          const page = pageLanguage(code);
          if (!page || page === 'en' || cards[page]) continue;
          const localised = (await catalog.cards(set.id, code)).data;
          if (localised.length && localised[0].language === code)
          {
            cards[page] = namesBySlug(localised, listed).map((name, index) => name || cards.en![index]);
          }
        }
        let setSlug = expansionSlug(set);
        if (slugs.has(setSlug)) setSlug = `${setSlug}-${set.id % 1000}`;
        slugs.add(setSlug);
        pages.push({
          slug: setSlug,
          code: set.code,
          name: set.name,
          releaseDate: set.releaseDate ?? null,
          cardCount: english.length,
          languages: languages.map(displayCode),
          cards,
          cardSlugs: slugList,
        });
        if (future) upcomingPages++;
        console.log(`${slug}: ${set.name} — ${english.length} cards, pages in ${Object.keys(cards).join(', ')}`);
        break;
      }
      catch (error)
      {
        if (attempt < 2)
        {
          await new Promise(resolve => setTimeout(resolve, 5000 * (attempt + 1)));
          continue;
        }
        // Keep the previous snapshot's page rather than dropping an expansion because of a temporary outage.
        const kept = previous.games[slug]?.find(item => item.slug === expansionSlug(set));
        if (kept && !slugs.has(kept.slug))
        {
          pages.push(kept);
          slugs.add(kept.slug);
          console.warn(`${slug}: kept previous data for ${set.name}`);
        }
        else console.warn(`${slug}: skipped ${set.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  return [slug, pages] as const;
}

const results = await Promise.all(catalogs.map(catalog =>
  refresh(catalog).catch(error =>
  {
    console.warn(`${catalog.game.displayName}: ${error instanceof Error ? error.message : error}`);
    return null;
  })
));
const snapshot: SeoSetSnapshot = {
  generatedAt: new Date().toISOString(),
  games: Object.fromEntries(results.filter(result => result !== null)),
};
await mkdir(new URL('../shared/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../shared/data/seo-sets.json', import.meta.url), JSON.stringify(snapshot) + '\n');
console.log(`Saved ${Object.values(snapshot.games).reduce((sum, sets) => sum + (sets?.length ?? 0), 0)} expansions.`);
