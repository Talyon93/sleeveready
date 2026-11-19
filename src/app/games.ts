import type { CardGame } from '../../shared/model';

// How each game is themed and iconised, and which games lead the header.
export const gameTheme = (name: string) =>
  /magic/i.test(name)
    ? 'magic'
    : /pok[eé]mon/i.test(name)
    ? 'pokemon'
    : /one\s*piece/i.test(name)
    ? 'one-piece'
    : /lorcana/i.test(name)
    ? 'lorcana'
    : 'riftbound';
export const gameIcon = (name: string) =>
  /magic/i.test(name)
    ? 'magic'
    : /yu-?gi-?oh/i.test(name)
    ? 'yugioh'
    : /pok[eé]mon/i.test(name)
    ? 'pokemon'
    : /flesh.*blood/i.test(name)
    ? 'fab'
    : /digimon/i.test(name)
    ? 'digimon'
    : /dragon.*ball/i.test(name)
    ? 'dragon-ball'
    : /vanguard/i.test(name)
    ? 'vanguard'
    : /one\s*piece/i.test(name)
    ? 'one-piece'
    : /lorcana/i.test(name)
    ? 'lorcana'
    : /star\s*wars/i.test(name)
    ? 'star-wars'
    : /union\s*arena/i.test(name)
    ? 'union-arena'
    : /riftbound/i.test(name)
    ? 'riftbound'
    : /gundam/i.test(name)
    ? 'gundam'
    : /sorcery/i.test(name)
    ? 'sorcery'
    : /palworld/i.test(name)
    ? 'palworld'
    : /cyberpunk/i.test(name)
    ? 'cyberpunk'
    : '';
// Games shown in the header on phones, as icons; the same number is used by the static header (shared/seo-page.ts).
export const PHONE_GAME_COUNT = 3;
export const primaryGames = [
  { pattern: /magic/i, label: 'Magic' },
  { pattern: /pok[eé]mon/i, label: 'Pokémon' },
  { pattern: /one\s*piece/i, label: 'One Piece' },
  { pattern: /lorcana/i, label: 'Lorcana' },
  { pattern: /riftbound/i, label: 'Riftbound' },
];
export const magicGame: CardGame = { id: 9_000_000_001, name: 'Magic', displayName: 'Magic: The Gathering' };
export const pokemonGame: CardGame = { id: 9_000_000_002, name: 'Pokemon', displayName: 'Pokémon' };
