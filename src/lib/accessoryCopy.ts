import type { Language } from './i18n';
import type { Accessory } from '../../shared/affiliate';

// Sleeves and booster packs beside the print sheet.
type AccessoryCopy = {
  kicker: string;
  title: (cards: number) => string;
  body: string;
  items: Record<Accessory, string>;
  line: (cards: number) => string;
};

export const accessoryCopy: Record<Language, AccessoryCopy> = {
  en: {
    kicker: 'To play with them',
    title: cards => `${cards} ${cards === 1 ? 'card' : 'cards'} to sleeve`,
    body: 'Slide each proxy into a sleeve in front of a common card: it shuffles like a real one.',
    items: { sleeves: 'Card sleeves', boosters: 'Booster packs' },
    line: cards => `Sleeves for ${cards} ${cards === 1 ? 'card' : 'cards'}`,
  },
  it: {
    kicker: 'Per giocarci',
    title: cards => `${cards} ${cards === 1 ? 'carta' : 'carte'} da imbustare`,
    body: 'Infila ogni proxy in una sleeve davanti a una carta comune: si mescola come una carta vera.',
    items: { sleeves: 'Sleeve protettive', boosters: 'Bustine' },
    line: cards => `Sleeve per ${cards} ${cards === 1 ? 'carta' : 'carte'}`,
  },
  de: {
    kicker: 'Zum Spielen',
    title: cards => `${cards} ${cards === 1 ? 'Karte' : 'Karten'} zum Einhüllen`,
    body: 'Steck jeden Proxy vor einer Allerweltskarte in eine Hülle: Er mischt sich wie eine echte Karte.',
    items: { sleeves: 'Kartenhüllen', boosters: 'Booster' },
    line: cards => `Hüllen für ${cards} ${cards === 1 ? 'Karte' : 'Karten'}`,
  },
  fr: {
    kicker: 'Pour jouer avec',
    title: cards => `${cards} ${cards === 1 ? 'carte' : 'cartes'} à protéger`,
    body: 'Glissez chaque proxy dans une pochette devant une carte commune : il se mélange comme une vraie carte.',
    items: { sleeves: 'Protège-cartes', boosters: 'Boosters' },
    line: cards => `Pochettes pour ${cards} ${cards === 1 ? 'carte' : 'cartes'}`,
  },
  es: {
    kicker: 'Para jugar con ellas',
    title: cards => `${cards} ${cards === 1 ? 'carta' : 'cartas'} para enfundar`,
    body: 'Mete cada proxy en una funda delante de una carta común: se baraja como una carta de verdad.',
    items: { sleeves: 'Fundas para cartas', boosters: 'Sobres' },
    line: cards => `Fundas para ${cards} ${cards === 1 ? 'carta' : 'cartas'}`,
  },
  pt: {
    kicker: 'Para jogar com elas',
    title: cards => `${cards} ${cards === 1 ? 'carta' : 'cartas'} para proteger`,
    body: 'Coloque cada proxy numa capa à frente de uma carta comum: baralha-se como uma carta verdadeira.',
    items: { sleeves: 'Capas para cartas', boosters: 'Boosters' },
    line: cards => `Capas para ${cards} ${cards === 1 ? 'carta' : 'cartas'}`,
  },
  nl: {
    kicker: 'Om mee te spelen',
    title: cards => `${cards} ${cards === 1 ? 'kaart' : 'kaarten'} om te sleeven`,
    body: 'Steek elke proxy in een sleeve voor een gewone kaart: hij schudt als een echte kaart.',
    items: { sleeves: 'Kaarthoesjes', boosters: 'Boosters' },
    line: cards => `Hoesjes voor ${cards} ${cards === 1 ? 'kaart' : 'kaarten'}`,
  },
  pl: {
    kicker: 'Do gry',
    title: cards => `Karty do koszulek: ${cards}`,
    body: 'Włóż każde proxy do koszulki przed zwykłą kartą: tasuje się jak prawdziwa karta.',
    items: { sleeves: 'Koszulki na karty', boosters: 'Boostery' },
    line: cards => `Koszulki na karty: ${cards}`,
  },
};
