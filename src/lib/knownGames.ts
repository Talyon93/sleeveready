import type { CardGame } from '../../shared/model';
import { gameOnline } from '../../shared/games';

// The sixteen games as the server lists them, so the header and the home board have them from the first render;
// the server's answer replaces this list as soon as it arrives.
export const knownGames: CardGame[] = [
  {
    id: 9_000_000_001,
    name: 'Magic',
    displayName: 'Magic: The Gathering',
    printLanguages: ['en', 'it', 'de', 'fr', 'es', 'pt', 'ja', 'ko', 'ru', 'zhs', 'zht'],
    hasCardText: true,
  },
  {
    id: 9_000_000_002,
    name: 'Pokemon',
    displayName: 'Pokémon',
    printLanguages: [
      'en',
      'it',
      'de',
      'fr',
      'es',
      'pt-br',
      'ja',
      'zh-tw',
      'id',
      'th',
      'pt',
      'pt-pt',
      'nl',
      'pl',
      'ru',
      'ko',
      'zh-cn',
    ],
    hasCardText: true,
  },
  {
    id: 9_000_000_003,
    name: 'One Piece',
    displayName: 'One Piece',
    printLanguages: ['en', 'fr', 'th'],
    hasCardText: true,
  },
  {
    id: 9_000_000_004,
    name: 'Lorcana',
    displayName: 'Disney Lorcana',
    printLanguages: ['en', 'it', 'de', 'fr'],
    hasCardText: true,
  },
  {
    id: 9_000_000_005,
    name: 'Riftbound',
    displayName: 'Riftbound',
    printLanguages: ['en', 'zh-cn', 'zh-tw', 'ko'],
    hasCardText: true,
  },
  { id: 9_000_000_006, name: 'Yu-Gi-Oh!', displayName: 'Yu-Gi-Oh!', printLanguages: ['en'], hasCardText: true },
  {
    id: 9_000_000_007,
    name: 'Star Wars',
    displayName: 'Star Wars Unlimited',
    printLanguages: ['en', 'it', 'de', 'fr', 'es'],
  },
  { id: 9_000_000_008, name: 'Sorcery', displayName: 'Sorcery: Contested Realm', printLanguages: ['en'] },
  {
    id: 9_000_000_009,
    name: 'Flesh and Blood',
    displayName: 'Flesh and Blood',
    printLanguages: ['en', 'it', 'de', 'fr', 'es', 'ja'],
  },
  { id: 9_000_000_010, name: 'Digimon', displayName: 'Digimon Card Game', printLanguages: ['en'] },
  { id: 9_000_000_011, name: 'Dragon Ball Super', displayName: 'Dragon Ball Super Card Game', printLanguages: ['en'] },
  { id: 9_000_000_012, name: 'Gundam', displayName: 'Gundam Card Game', printLanguages: ['en'] },
  { id: 9_000_000_013, name: 'Union Arena', displayName: 'Union Arena', printLanguages: ['en'] },
  { id: 9_000_000_014, name: 'Cardfight!! Vanguard', displayName: 'Cardfight!! Vanguard', printLanguages: ['en'] },
  { id: 9_000_000_015, name: 'Palworld', displayName: 'Palworld Official Card Game', printLanguages: ['en'] },
  { id: 9_000_000_016, name: 'Cyberpunk', displayName: 'Cyberpunk TCG', printLanguages: ['en', 'fr'] },
]
  .filter(game => gameOnline(game.name));
