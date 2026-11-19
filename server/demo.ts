import type { CardGame, CardExpansion, CatalogCard } from '../shared/model.ts';
export const demoGames: CardGame[] = ['Magic: The Gathering', 'Pokémon', 'One Piece', 'Disney Lorcana', 'Riftbound']
  .map((name, i) => ({ id: i + 1, name, displayName: name }));
export const demoExpansions: CardExpansion[] = demoGames.map(g => ({
  id: g.id,
  gameId: g.id,
  code: 'DEMO',
  name: 'Playtest sample · ' + g.displayName,
}));
const names = [
  'Aurora Guardian',
  'Forest Wanderer',
  'Tidal Spirit',
  'Ember Scout',
  'Moonlit Oracle',
  'Stone Sentinel',
  'Skybound Herald',
  'Verdant Sage',
  'Twilight Ranger',
  'Crystal Keeper',
  'Dawn Voyager',
  'Storm Weaver',
];
export const demoCards = (expansionId: number): CatalogCard[] =>
  names.map((name, i) => ({
    id: expansionId * 100 + i + 1,
    gameId: expansionId,
    categoryId: 1,
    expansionId,
    name,
    version: i % 3 === 0 ? 'Demo · Alternate' : 'Demo · Standard',
    imageUrl: null,
  }));
