// The native catalogue of every supported game, shared by the API and the scheduled card index refresh.
import { MAGIC_GAME, Scryfall } from './scryfall.ts';
import { isPokemonExpansionId, POKEMON_GAME, TCGdex } from './tcgdex.ts';
import { isOnePieceExpansionId, ONE_PIECE_GAME, OnePieceCatalog } from './onepiece.ts';
import { isLorcanaExpansionId, LORCANA_GAME, LorcanaCatalog } from './lorcana.ts';
import { isRiftboundExpansionId, RIFTBOUND_GAME, RiftboundCatalog } from './riftbound.ts';
import { gameOnline } from '../shared/games.ts';
import { isYugiohExpansionId, YUGIOH_GAME, YugiohCatalog } from './yugioh.ts';
import { isStarWarsExpansionId, STAR_WARS_GAME, StarWarsCatalog } from './starwars.ts';
import { SorceryCatalog } from './sorcery.ts';
import { FleshAndBloodCatalog } from './fleshandblood.ts';
import { DigimonCatalog } from './digimon.ts';
import { DragonBallCatalog } from './dragonball.ts';
import { GundamCatalog } from './gundam.ts';
import { UnionArenaCatalog } from './unionarena.ts';
import { VanguardCatalog } from './vanguard.ts';
import { PalworldCatalog } from './palworld.ts';
import { CyberpunkCatalog } from './cyberpunk.ts';
import type { NativeCatalog } from './native-source.ts';
import type { CardGame } from '../shared/model.ts';

export type CatalogOptions = {
  scryfall?: Scryfall;
  tcgdex?: TCGdex;
  onePiece?: OnePieceCatalog;
  lorcana?: LorcanaCatalog;
  riftbound?: RiftboundCatalog;
  yugioh?: YugiohCatalog;
  starWars?: StarWarsCatalog;
  newerCatalogs?: NativeCatalog[];
  cyberpunk?: CyberpunkCatalog;
};

export function buildCatalogs(options: CatalogOptions = {})
{
  const scryfall = options.scryfall ?? new Scryfall();
  const tcgdex = options.tcgdex ?? new TCGdex();
  const onePiece = options.onePiece ?? new OnePieceCatalog();
  const lorcana = options.lorcana ?? new LorcanaCatalog();
  const riftbound = options.riftbound ?? new RiftboundCatalog();
  const yugioh = options.yugioh ?? new YugiohCatalog();
  const starWars = options.starWars ?? new StarWarsCatalog();
  const cyberpunk = options.cyberpunk ?? new CyberpunkCatalog();
  const native = (
    game: CardGame,
    isExpansionId: (value: number) => boolean,
    catalog: Omit<NativeCatalog, 'game' | 'isExpansionId'>,
  ): NativeCatalog => ({
    game,
    isExpansionId,
    sets: () => catalog.sets(),
    cards: (expansionId, language) => catalog.cards(expansionId, language),
    languages: expansionId => catalog.languages(expansionId),
    expansionForCode: catalog.expansionForCode?.bind(catalog),
    locateByName: catalog.locateByName?.bind(catalog),
    importCards: catalog.importCards?.bind(catalog),
    otherPrintings: catalog.otherPrintings?.bind(catalog),
    details: catalog.details?.bind(catalog),
    rulingsFor: catalog.rulingsFor?.bind(catalog),
    primeExpansion: catalog.primeExpansion?.bind(catalog),
    localNames: catalog.localNames?.bind(catalog),
    byIllustrator: catalog.byIllustrator?.bind(catalog),
    illustrators: catalog.illustrators?.bind(catalog),
  });
  const newerCatalogs = options.newerCatalogs
    ?? [
      new SorceryCatalog(),
      new FleshAndBloodCatalog(),
      new DigimonCatalog(),
      new DragonBallCatalog(),
      new GundamCatalog(),
      new UnionArenaCatalog(),
      new VanguardCatalog(),
      new PalworldCatalog(),
      cyberpunk,
    ];
  // Checked in order: Pokémon's range has no upper bound and Magic's is the widest, so they come last.
  const catalogs: NativeCatalog[] = [
    ...newerCatalogs,
    native(STAR_WARS_GAME, isStarWarsExpansionId, starWars),
    native(YUGIOH_GAME, isYugiohExpansionId, yugioh),
    ...(gameOnline('riftbound') ? [native(RIFTBOUND_GAME, isRiftboundExpansionId, riftbound)] : []),
    native(LORCANA_GAME, isLorcanaExpansionId, lorcana),
    native(ONE_PIECE_GAME, isOnePieceExpansionId, onePiece),
    native(POKEMON_GAME, isPokemonExpansionId, tcgdex),
    native(MAGIC_GAME, value => value >= 4_000_000_000, scryfall),
  ];
  const nativeGames: CardGame[] = [
    MAGIC_GAME,
    POKEMON_GAME,
    ONE_PIECE_GAME,
    LORCANA_GAME,
    ...(gameOnline('riftbound') ? [RIFTBOUND_GAME] : []),
    YUGIOH_GAME,
    STAR_WARS_GAME,
    ...newerCatalogs.map(catalog => catalog.game),
  ];
  return { catalogs, nativeGames, onePiece, cyberpunk };
}
