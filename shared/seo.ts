import type { CardFact } from './model.ts';
import { factRows } from './card-facts.ts';
import { gameOnline } from './games.ts';
export type SeoLanguage = 'en' | 'it' | 'de' | 'fr' | 'es';
export type SeoGameSlug =
  | 'magic-the-gathering'
  | 'pokemon'
  | 'one-piece'
  | 'disney-lorcana'
  | 'riftbound'
  | 'yu-gi-oh'
  | 'star-wars-unlimited'
  | 'flesh-and-blood'
  | 'digimon'
  | 'dragon-ball-super'
  | 'cardfight-vanguard'
  | 'union-arena'
  | 'gundam'
  | 'sorcery'
  | 'palworld'
  | 'cyberpunk';

export const seoLanguages: SeoLanguage[] = ['en', 'it', 'de', 'fr', 'es'];
export const isSeoLanguage = (value: string): value is SeoLanguage => (seoLanguages as string[]).includes(value);
// printLanguages: card-image languages the native source really has, so pages only promise what we can print.
// Games switched off in shared/games.ts are left out, so nothing on the site lists or answers for them.
const allSeoGames: { slug: SeoGameSlug; label: string; pattern: RegExp; printLanguages: string[] }[] = [
  {
    slug: 'magic-the-gathering',
    label: 'Magic: The Gathering',
    pattern: /magic/i,
    printLanguages: ['en', 'it', 'de', 'fr', 'es', 'pt', 'ja', 'ko', 'ru', 'zh'],
  },
  {
    slug: 'pokemon',
    label: 'Pokémon',
    pattern: /pok[eé]mon/i,
    printLanguages: ['en', 'it', 'de', 'fr', 'es', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh', 'id', 'th'],
  },
  { slug: 'one-piece', label: 'One Piece Card Game', pattern: /one\s*piece/i, printLanguages: ['en', 'fr', 'th'] },
  { slug: 'disney-lorcana', label: 'Disney Lorcana', pattern: /lorcana/i, printLanguages: ['en', 'it', 'de', 'fr'] },
  { slug: 'riftbound', label: 'Riftbound', pattern: /riftbound/i, printLanguages: ['en', 'zh', 'ko'] },
  { slug: 'yu-gi-oh', label: 'Yu-Gi-Oh!', pattern: /yu-?gi-?oh/i, printLanguages: ['en'] },
  {
    slug: 'star-wars-unlimited',
    label: 'Star Wars Unlimited',
    pattern: /star\s*wars/i,
    printLanguages: ['en', 'it', 'de', 'fr', 'es'],
  },
  {
    slug: 'flesh-and-blood',
    label: 'Flesh and Blood',
    pattern: /flesh\s*and\s*blood/i,
    printLanguages: ['en', 'it', 'de', 'fr', 'es', 'ja'],
  },
  { slug: 'digimon', label: 'Digimon Card Game', pattern: /digimon/i, printLanguages: ['en'] },
  {
    slug: 'dragon-ball-super',
    label: 'Dragon Ball Super Card Game',
    pattern: /dragon\s*ball/i,
    printLanguages: ['en'],
  },
  { slug: 'cardfight-vanguard', label: 'Cardfight!! Vanguard', pattern: /vanguard/i, printLanguages: ['en'] },
  { slug: 'union-arena', label: 'Union Arena', pattern: /union\s*arena/i, printLanguages: ['en'] },
  { slug: 'gundam', label: 'Gundam Card Game', pattern: /gundam/i, printLanguages: ['en'] },
  { slug: 'sorcery', label: 'Sorcery: Contested Realm', pattern: /sorcery/i, printLanguages: ['en'] },
  { slug: 'palworld', label: 'Palworld Card Game', pattern: /palworld/i, printLanguages: ['en'] },
  { slug: 'cyberpunk', label: 'Cyberpunk TCG', pattern: /cyberpunk/i, printLanguages: ['en', 'fr'] },
];
export const seoGames = allSeoGames.filter(game => gameOnline(game.slug));

export const seoPath = (language: SeoLanguage, game?: SeoGameSlug, set?: string) =>
  `/${language}/${game ? game + '/' : ''}${game && set ? set + '/' : ''}`;
// Home and game pages exist in every language; expansion pages are listed from the snapshot in shared/seo-sets.ts.
export const indexableSeoPaths = seoLanguages.flatMap(language => [
  seoPath(language),
  ...seoGames.map(game => seoPath(language, game.slug)),
]);
// URL segment for an expansion: its printed code when it has one ("sv09", "op-13"), otherwise its name.
// Bare numbers (Lorcana "10") say nothing in a URL, so those use the name too.
const meaningfulCode = (code: string | null) => code && /[a-z]/i.test(code) ? code : null;
export const expansionSlug = (expansion: { code: string | null; name: string }) =>
  (meaningfulCode(expansion.code) ?? expansion.name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

// Game feature pages share the third URL segment with expansions; these slugs are reserved for them.
export type SeoFeature = 'top-proxies' | 'tokens';
export const seoFeatures: Record<SeoFeature, (game: SeoGameSlug) => boolean> = {
  'top-proxies': () => true,
  tokens: game => game === 'magic-the-gathering',
};
export const featurePaths = seoLanguages.flatMap(language =>
  seoGames.flatMap(game =>
    (Object.keys(seoFeatures) as SeoFeature[]).filter(feature => seoFeatures[feature](game.slug)).map(feature =>
      `/${language}/${game.slug}/${feature}/`
    )
  )
);
export function parseSeoPath(
  pathname: string,
): { language?: SeoLanguage; game?: SeoGameSlug; set?: string; card?: string; feature?: SeoFeature }
{
  const parts = pathname.split('/').filter(Boolean);
  const language = isSeoLanguage(parts[0] ?? '') ? parts[0] as SeoLanguage : undefined;
  const game = seoGames.some(item => item.slug === parts[1]) ? parts[1] as SeoGameSlug : undefined;
  const feature = game && parts.length === 3 && parts[2] in seoFeatures && seoFeatures[parts[2] as SeoFeature](game)
    ? parts[2] as SeoFeature
    : undefined;
  if (feature) return { language, game, feature };
  const set = game && /^[a-z0-9-]{1,60}$/.test(parts[2] ?? '') && !(parts[2] in seoFeatures) ? parts[2] : undefined;
  const card = set && /^[a-z0-9-]{1,80}$/.test(parts[3] ?? '') ? parts[3] : undefined;
  return card ? { language, game, set, card } : set ? { language, game, set } : { language, game };
}
export const cardPath = (language: SeoLanguage, game: SeoGameSlug, set: string, card: string) =>
  `/${language}/${game}/${set}/${card}/`;
const slugify = (value: string) =>
  value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(
    0,
    80,
  );
export const collectorSlug = (number: string) => slugify(number);
// URL segment for each card of a set: its collector number ("125", "op13-001"), or its name when unnumbered.
// Printings sharing a number (parallels, backs) get -2, -3… in set order, which is the same in every language,
// so the slug is identical across languages and hreflang alternates line up.
export function cardSlugs<T extends { id: number; name: string; collectorNumber?: string | null }>(cards: T[])
{
  const seen = new Map<string, number>();
  const slugs = new Map<number, string>();
  for (const card of cards)
  {
    const base = slugify(card.collectorNumber || card.name) || 'card';
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    slugs.set(card.id, count === 1 ? base : `${base}-${count}`);
  }
  return slugs;
}

export function seoSlugForGame(name: string): SeoGameSlug | undefined
{
  return seoGames.find(game => game.pattern.test(name))?.slug;
}

export function gameMatchesSeoSlug(slug: SeoGameSlug, name: string)
{
  return seoSlugForGame(name) === slug;
}

export const seoUi: Record<SeoLanguage, { faq: string; games: string }> = {
  en: { faq: 'Frequently asked questions', games: 'Supported games' },
  it: { faq: 'Domande frequenti', games: 'Giochi supportati' },
  de: { faq: 'Häufige Fragen', games: 'Unterstützte Spiele' },
  fr: { faq: 'Questions fréquentes', games: 'Jeux pris en charge' },
  es: { faq: 'Preguntas frecuentes', games: 'Juegos compatibles' },
};

type Faq = { question: string; answer: string };
export type SeoCopy = { title: string; description: string; h1: string; intro: string; facts: string[]; faq: Faq[] };

const commonFaq: Record<SeoLanguage, Faq[]> = {
  en: [
    {
      question: 'How many cards fit on one page?',
      answer:
        'Nine cards fit on one A4 or US Letter page in a 3 × 3 layout. Each card prints at 63 × 88 mm, with optional cut guides, spacing and bleed.',
    },
    {
      question: 'Can I import a decklist?',
      answer:
        'Yes. Paste the list exported by Moxfield, Arena, Pokémon TCG Live, Limitless or most deck builders. Set codes and card numbers select the exact printing.',
    },
    {
      question: 'Do I need an account to print?',
      answer:
        'No. You can browse sets, prepare a sheet and print without an account. Sign-in is only needed to save lists across devices.',
    },
    {
      question: 'Can I save the sheet as a PDF?',
      answer:
        'Yes. Open Preview and print, choose Save as PDF, use 100% scale and disable browser headers and footers.',
    },
  ],
  it: [
    {
      question: 'Quante carte entrano in una pagina?',
      answer:
        'In una pagina A4 o US Letter entrano nove carte in una griglia 3 × 3. Ogni carta viene stampata a 63 × 88 mm, con guide di taglio, spazio e abbondanza opzionali.',
    },
    {
      question: 'Posso importare una lista?',
      answer:
        'Sì. Incolla la lista esportata da Moxfield, Arena, Pokémon TCG Live, Limitless o dalla maggior parte dei deck builder. Codice set e numero scelgono la stampa esatta.',
    },
    {
      question: 'Serve un account per stampare?',
      answer:
        'No. Puoi consultare le espansioni, preparare il foglio e stampare senza account. L’accesso serve solo per salvare le liste su più dispositivi.',
    },
    {
      question: 'Posso salvare il foglio come PDF?',
      answer:
        'Sì. Apri Anteprima e stampa, scegli Salva come PDF, usa la scala al 100% e disattiva intestazioni e piè di pagina del browser.',
    },
  ],
  de: [
    {
      question: 'Wie viele Karten passen auf eine Seite?',
      answer:
        'Auf eine A4- oder US-Letter-Seite passen neun Karten im 3 × 3-Raster. Jede Karte wird in 63 × 88 mm gedruckt, optional mit Schnittmarken, Abstand und Beschnitt.',
    },
    {
      question: 'Kann ich eine Deckliste importieren?',
      answer:
        'Ja. Füge die Liste aus Moxfield, Arena, Pokémon TCG Live, Limitless oder den meisten Deckbuildern ein. Set-Code und Kartennummer wählen den genauen Druck.',
    },
    {
      question: 'Brauche ich ein Konto zum Drucken?',
      answer:
        'Nein. Du kannst Erweiterungen durchsuchen, einen Bogen vorbereiten und ohne Konto drucken. Ein Konto brauchst du nur, um Listen geräteübergreifend zu speichern.',
    },
    {
      question: 'Kann ich den Bogen als PDF speichern?',
      answer:
        'Ja. Öffne Vorschau und Drucken, wähle „Als PDF speichern“, 100 % Skalierung und deaktiviere Kopf- und Fußzeilen des Browsers.',
    },
  ],
  fr: [
    {
      question: 'Combien de cartes tiennent sur une page ?',
      answer:
        'Neuf cartes tiennent sur une page A4 ou US Letter, en grille 3 × 3. Chaque carte est imprimée en 63 × 88 mm, avec repères de coupe, espacement et fond perdu en option.',
    },
    {
      question: 'Puis-je importer une liste de deck ?',
      answer:
        'Oui. Collez la liste exportée par Moxfield, Arena, Pokémon TCG Live, Limitless ou la plupart des deck builders. Le code d’extension et le numéro choisissent l’impression exacte.',
    },
    {
      question: 'Faut-il un compte pour imprimer ?',
      answer:
        'Non. Vous pouvez parcourir les extensions, préparer une feuille et imprimer sans compte. La connexion sert seulement à enregistrer vos listes sur plusieurs appareils.',
    },
    {
      question: 'Puis-je enregistrer la feuille en PDF ?',
      answer:
        'Oui. Ouvrez Aperçu et impression, choisissez « Enregistrer au format PDF », une échelle de 100 % et désactivez les en-têtes et pieds de page du navigateur.',
    },
  ],
  es: [
    {
      question: '¿Cuántas cartas caben en una página?',
      answer:
        'En una página A4 o US Letter caben nueve cartas en una cuadrícula de 3 × 3. Cada carta se imprime a 63 × 88 mm, con guías de corte, espaciado y sangrado opcionales.',
    },
    {
      question: '¿Puedo importar una lista de mazo?',
      answer:
        'Sí. Pega la lista exportada por Moxfield, Arena, Pokémon TCG Live, Limitless o la mayoría de deck builders. El código de expansión y el número eligen la impresión exacta.',
    },
    {
      question: '¿Necesito una cuenta para imprimir?',
      answer:
        'No. Puedes consultar expansiones, preparar una hoja e imprimir sin cuenta. Solo necesitas iniciar sesión para guardar listas en varios dispositivos.',
    },
    {
      question: '¿Puedo guardar la hoja como PDF?',
      answer:
        'Sí. Abre Vista previa e impresión, elige «Guardar como PDF», escala al 100 % y desactiva los encabezados y pies de página del navegador.',
    },
  ],
};

// Page copy per language. "native" means the game's cards really exist printed in the page language.
const gameCopy: Record<
  SeoLanguage,
  (label: string, native: boolean, languages: string) => Omit<SeoCopy, 'faq'> & { languageFaq: Faq }
> = {
  en: (label, _native, languages) => ({
    title: `Printable ${label} Proxies & Playtest Sheets | SleeveReady`,
    description:
      `Print ${label} proxies for playtesting: browse official expansions, add cards or import a decklist, and build a 3 × 3 sheet on A4 or US Letter. Cards in ${languages}.`,
    h1: `Printable ${label} proxies`,
    intro:
      `Choose a ${label} expansion or paste your decklist, then print a sheet at 100% scale. Cards come from official sources, in every language they are printed in.`,
    facts: ['9 cards per A4 or Letter page', '63 × 88 mm, optional bleed', 'No account required to print'],
    languageFaq: {
      question: `Which languages are ${label} cards available in?`,
      answer:
        `${label} cards are available in ${languages}. When a set is not printed in your language, the English card is used.`,
    },
  }),
  it: (label, native, languages) => ({
    title: native ? `Proxy ${label} in italiano da stampare | SleeveReady` : `Proxy ${label} da stampare | SleeveReady`,
    description: native
      ? `Stampa proxy ${label} con le carte in italiano: scegli l’espansione, aggiungi le carte o importa la lista e prepara un foglio 3 × 3 su A4 o Letter.`
      : `Stampa proxy ${label} per il playtest: scegli l’espansione, aggiungi le carte o importa la lista e prepara un foglio 3 × 3 su A4 o Letter. Carte in ${languages}.`,
    h1: native ? `Proxy ${label} in italiano da stampare` : `Proxy ${label} da stampare`,
    intro:
      `Scegli un’espansione ${label} o incolla la tua lista, poi stampa il foglio al 100%. Le carte arrivano da fonti ufficiali, in tutte le lingue in cui sono stampate.`,
    facts: [
      native ? 'Carte stampate in italiano' : '9 carte per pagina A4 o Letter',
      '63 × 88 mm, abbondanza opzionale',
      'Nessun account richiesto per stampare',
    ],
    languageFaq: {
      question: `In quali lingue sono disponibili le carte ${label}?`,
      answer:
        `Le carte ${label} sono disponibili in ${languages}. Se un’espansione non è stampata nella tua lingua viene usata la carta inglese.`,
    },
  }),
  de: (label, native, languages) => ({
    title: native
      ? `${label} Proxy-Karten auf Deutsch drucken | SleeveReady`
      : `${label} Proxy-Karten drucken | SleeveReady`,
    description: native
      ? `Drucke ${label}-Proxys mit deutschen Karten: Erweiterung wählen, Karten hinzufügen oder Deckliste importieren und einen 3 × 3-Bogen auf A4 oder Letter erstellen.`
      : `Drucke ${label}-Proxys zum Testen: Erweiterung wählen, Karten hinzufügen oder Deckliste importieren und einen 3 × 3-Bogen auf A4 oder Letter erstellen. Karten auf ${languages}.`,
    h1: native ? `${label} Proxy-Karten auf Deutsch drucken` : `${label} Proxy-Karten drucken`,
    intro:
      `Wähle eine ${label}-Erweiterung oder füge deine Deckliste ein und drucke den Bogen mit 100 % Skalierung. Die Karten stammen aus offiziellen Quellen, in jeder Sprache, in der sie gedruckt wurden.`,
    facts: [
      native ? 'Karten auf Deutsch gedruckt' : '9 Karten pro A4- oder Letter-Seite',
      '63 × 88 mm, optionaler Beschnitt',
      'Kein Konto zum Drucken nötig',
    ],
    languageFaq: {
      question: `In welchen Sprachen gibt es ${label}-Karten?`,
      answer:
        `${label}-Karten gibt es auf ${languages}. Ist eine Erweiterung nicht in deiner Sprache erschienen, wird die englische Karte verwendet.`,
    },
  }),
  fr: (label, native, languages) => ({
    title: native ? `Proxys ${label} en français à imprimer | SleeveReady` : `Proxys ${label} à imprimer | SleeveReady`,
    description: native
      ? `Imprimez des proxys ${label} avec les cartes en français : choisissez l’extension, ajoutez des cartes ou importez votre liste et préparez une feuille 3 × 3 en A4 ou Letter.`
      : `Imprimez des proxys ${label} pour vos tests : choisissez l’extension, ajoutez des cartes ou importez votre liste et préparez une feuille 3 × 3 en A4 ou Letter. Cartes en ${languages}.`,
    h1: native ? `Proxys ${label} en français à imprimer` : `Proxys ${label} à imprimer`,
    intro:
      `Choisissez une extension ${label} ou collez votre liste, puis imprimez la feuille à l’échelle 100 %. Les cartes proviennent de sources officielles, dans toutes les langues où elles sont imprimées.`,
    facts: [
      native ? 'Cartes imprimées en français' : '9 cartes par page A4 ou Letter',
      '63 × 88 mm, fond perdu en option',
      'Aucun compte requis pour imprimer',
    ],
    languageFaq: {
      question: `Dans quelles langues les cartes ${label} sont-elles disponibles ?`,
      answer:
        `Les cartes ${label} sont disponibles en ${languages}. Si une extension n’existe pas dans votre langue, la carte anglaise est utilisée.`,
    },
  }),
  es: (label, native, languages) => ({
    title: native
      ? `Proxies de ${label} en español para imprimir | SleeveReady`
      : `Proxies de ${label} para imprimir | SleeveReady`,
    description: native
      ? `Imprime proxies de ${label} con las cartas en español: elige la expansión, añade cartas o importa tu lista y prepara una hoja de 3 × 3 en A4 o Letter.`
      : `Imprime proxies de ${label} para probar mazos: elige la expansión, añade cartas o importa tu lista y prepara una hoja de 3 × 3 en A4 o Letter. Cartas en ${languages}.`,
    h1: native ? `Proxies de ${label} en español para imprimir` : `Proxies de ${label} para imprimir`,
    intro:
      `Elige una expansión de ${label} o pega tu lista y luego imprime la hoja al 100 %. Las cartas proceden de fuentes oficiales, en todos los idiomas en que se imprimen.`,
    facts: [
      native ? 'Cartas impresas en español' : '9 cartas por página A4 o Letter',
      '63 × 88 mm, sangrado opcional',
      'No necesitas cuenta para imprimir',
    ],
    languageFaq: {
      question: `¿En qué idiomas están disponibles las cartas de ${label}?`,
      answer:
        `Las cartas de ${label} están disponibles en ${languages}. Si una expansión no está impresa en tu idioma, se usa la carta en inglés.`,
    },
  }),
};

// What is specific about printing each less-served game, so their pages are more than the shared template.
const gameFacts: Partial<Record<SeoGameSlug, Record<SeoLanguage, string>>> = {
  sorcery: {
    en: 'Landscape Sites are rotated to fill the 63 × 88 mm slot',
    it: 'I Site orizzontali vengono ruotati per riempire lo spazio 63 × 88 mm',
    de: 'Querformat-Sites werden gedreht und füllen das 63 × 88 mm-Feld',
    fr: 'Les Sites à l’horizontale sont pivotés pour remplir l’emplacement 63 × 88 mm',
    es: 'Los Sites horizontales se giran para ocupar el espacio de 63 × 88 mm',
  },
  'dragon-ball-super': {
    en: 'Fusion World and Masters sets in one catalogue, leaders with both faces',
    it: 'Espansioni Fusion World e Masters in un unico catalogo, leader con entrambi i lati',
    de: 'Fusion World- und Masters-Sets in einem Katalog, Leader mit beiden Seiten',
    fr: 'Extensions Fusion World et Masters dans un seul catalogue, leaders recto verso',
    es: 'Expansiones Fusion World y Masters en un solo catálogo, líderes con ambas caras',
  },
  'union-arena': {
    en: 'Every Union Arena title and its parallel arts, from the official card list',
    it: 'Tutti i titoli Union Arena e le loro illustrazioni parallele, dalla lista carte ufficiale',
    de: 'Alle Union-Arena-Titel mit Parallel-Artworks aus der offiziellen Kartenliste',
    fr: 'Tous les titres Union Arena et leurs illustrations parallèles, depuis la liste officielle',
    es: 'Todos los títulos de Union Arena y sus ilustraciones paralelas, de la lista oficial',
  },
  'disney-lorcana': {
    en: 'Each character version is its own card: name and subtitle, as deck lists write them',
    it: 'Ogni versione di un personaggio è una carta a sé: nome e sottotitolo, come nelle liste',
    de: 'Jede Charakterversion ist eine eigene Karte: Name und Untertitel, wie in Decklisten',
    fr: 'Chaque version d’un personnage est une carte à part : nom et sous-titre, comme dans les listes',
    es: 'Cada versión de un personaje es una carta propia: nombre y subtítulo, como en las listas',
  },
  digimon: {
    en: 'Boosters, extra boosters and starter decks, by official card number',
    it: 'Booster, extra booster e starter deck, per numero ufficiale della carta',
    de: 'Booster, Extra-Booster und Starterdecks nach offizieller Kartennummer',
    fr: 'Boosters, extra boosters et starter decks, par numéro officiel de carte',
    es: 'Sobres, extra boosters y mazos de inicio, por número oficial de carta',
  },
  'cardfight-vanguard': {
    en: 'Main boosters, title boosters and special series, numbered as printed',
    it: 'Booster principali, title booster e special series, numerati come sulla carta',
    de: 'Haupt-Booster, Title-Booster und Special Series, nummeriert wie gedruckt',
    fr: 'Boosters principaux, title boosters et special series, numérotés comme imprimés',
    es: 'Sobres principales, title boosters y special series, numerados como en la carta',
  },
  cyberpunk: {
    en: 'Retail, Beta and French printings of Welcome to Night City',
    it: 'Stampe Retail, Beta e francesi di Welcome to Night City',
    de: 'Retail-, Beta- und französische Drucke von Welcome to Night City',
    fr: 'Impressions Retail, Bêta et françaises de Welcome to Night City',
    es: 'Impresiones Retail, Beta y francesas de Welcome to Night City',
  },
};

// The newer and smaller games have little competition on "[game] proxies": their pages answer that question with what
// is specific to printing them (how their lists are written, what the catalogue covers), never a shared template.
const proxyQuestion: Record<SeoLanguage, (label: string) => string> = {
  en: label => `How do I print ${label} proxies?`,
  it: label => `Come stampo i proxy ${label}?`,
  de: label => `Wie drucke ich ${label}-Proxys?`,
  fr: label => `Comment imprimer des proxys ${label} ?`,
  es: label => `¿Cómo imprimo proxies de ${label}?`,
};
const proxyClosing: Record<SeoLanguage, string> = {
  en: 'Then open Preview and print at 100% scale: nine cards per A4 or US Letter page, free and with no account.',
  it: 'Poi apri l’anteprima e stampa al 100%: nove carte per pagina A4 o US Letter, gratis e senza account.',
  de: 'Dann Vorschau öffnen und mit 100 % drucken: neun Karten pro A4- oder US-Letter-Seite, kostenlos und ohne Konto.',
  fr:
    'Ouvrez ensuite l’aperçu et imprimez à 100 % : neuf cartes par page A4 ou US Letter, gratuitement et sans compte.',
  es: 'Luego abre la vista previa e imprime al 100 %: nueve cartas por página A4 o US Letter, gratis y sin cuenta.',
};
const proxyHowTo: Partial<Record<SeoGameSlug, Record<SeoLanguage, string>>> = {
  riftbound: {
    en:
      'Pick a Riftbound set, or paste your deck with one card per line by name, such as "3 Jinx, Demolitionist". Sets that are still being revealed show their spoilers, so you can test new cards before release.',
    it:
      'Scegli un set Riftbound oppure incolla il mazzo con una carta per riga per nome, ad esempio "3 Jinx, Demolitionist". I set ancora in rivelazione mostrano gli spoiler, così provi le carte nuove prima dell’uscita.',
    de:
      'Wähle ein Riftbound-Set oder füge dein Deck mit einer Karte pro Zeile nach Namen ein, etwa „3 Jinx, Demolitionist“. Sets, die noch enthüllt werden, zeigen ihre Spoiler, so testest du neue Karten vor dem Release.',
    fr:
      'Choisissez un set Riftbound ou collez votre deck avec une carte par ligne, par nom, par exemple « 3 Jinx, Demolitionist ». Les sets encore en révélation affichent leurs spoilers : vous testez les nouvelles cartes avant la sortie.',
    es:
      'Elige un set de Riftbound o pega tu mazo con una carta por línea por nombre, por ejemplo «3 Jinx, Demolitionist». Los sets que aún se están revelando muestran sus spoilers, así pruebas las cartas nuevas antes del lanzamiento.',
  },
  cyberpunk: {
    en:
      'Choose Welcome to Night City in its Retail, Beta or French printing, or paste your deck by card name, such as "1 Adam Smasher: Metal Over Meat".',
    it:
      'Scegli Welcome to Night City nella stampa Retail, Beta o francese, oppure incolla il mazzo per nome delle carte, ad esempio "1 Adam Smasher: Metal Over Meat".',
    de:
      'Wähle Welcome to Night City im Retail-, Beta- oder französischen Druck oder füge dein Deck nach Kartennamen ein, etwa „1 Adam Smasher: Metal Over Meat“.',
    fr:
      'Choisissez Welcome to Night City en impression Retail, Bêta ou française, ou collez votre deck par nom de carte, par exemple « 1 Adam Smasher: Metal Over Meat ».',
    es:
      'Elige Welcome to Night City en su impresión Retail, Beta o francesa, o pega tu mazo por nombre de carta, por ejemplo «1 Adam Smasher: Metal Over Meat».',
  },
  gundam: {
    en:
      'Pick a booster or starter deck, or paste your list by card number, such as "4 GD01-001" or "4 ST01-001": the number selects the exact card.',
    it:
      'Scegli un booster o uno starter deck, oppure incolla la lista per numero di carta, ad esempio "4 GD01-001" o "4 ST01-001": il numero sceglie la carta esatta.',
    de:
      'Wähle ein Booster- oder Starter-Deck oder füge deine Liste nach Kartennummer ein, etwa „4 GD01-001“ oder „4 ST01-001“: Die Nummer wählt die genaue Karte.',
    fr:
      'Choisissez un booster ou un starter deck, ou collez votre liste par numéro de carte, par exemple « 4 GD01-001 » ou « 4 ST01-001 » : le numéro choisit la carte exacte.',
    es:
      'Elige un booster o un starter deck, o pega tu lista por número de carta, por ejemplo «4 GD01-001» o «4 ST01-001»: el número elige la carta exacta.',
  },
  'union-arena': {
    en:
      'Choose a title and set, or paste your list by card number, such as "4 UE03BT/JJK-1-009"; write the parallel number ("…-009_p1") to print the parallel art.',
    it:
      'Scegli un titolo e un set, oppure incolla la lista per numero di carta, ad esempio "4 UE03BT/JJK-1-009"; scrivi il numero della parallela ("…-009_p1") per stampare l’illustrazione parallela.',
    de:
      'Wähle einen Titel und ein Set oder füge deine Liste nach Kartennummer ein, etwa „4 UE03BT/JJK-1-009“; mit der Parallel-Nummer („…-009_p1“) druckst du das Parallel-Artwork.',
    fr:
      'Choisissez un titre et un set, ou collez votre liste par numéro de carte, par exemple « 4 UE03BT/JJK-1-009 » ; indiquez le numéro parallèle (« …-009_p1 ») pour imprimer l’illustration parallèle.',
    es:
      'Elige un título y un set, o pega tu lista por número de carta, por ejemplo «4 UE03BT/JJK-1-009»; escribe el número paralelo («…-009_p1») para imprimir la ilustración paralela.',
  },
  sorcery: {
    en:
      'Pick a Sorcery set or paste your deck by card name, such as "2 Highland Princess". Landscape Sites are rotated so they fill a standard card slot and fit normal sleeves.',
    it:
      'Scegli un set di Sorcery o incolla il mazzo per nome delle carte, ad esempio "2 Highland Princess". I Site orizzontali vengono ruotati per riempire lo spazio di una carta standard ed entrare nelle bustine normali.',
    de:
      'Wähle ein Sorcery-Set oder füge dein Deck nach Kartennamen ein, etwa „2 Highland Princess“. Querformat-Sites werden gedreht, damit sie ein Standardkartenfeld füllen und in normale Hüllen passen.',
    fr:
      'Choisissez un set Sorcery ou collez votre deck par nom de carte, par exemple « 2 Highland Princess ». Les Sites à l’horizontale sont pivotés pour remplir un emplacement de carte standard et entrer dans des pochettes normales.',
    es:
      'Elige un set de Sorcery o pega tu mazo por nombre de carta, por ejemplo «2 Highland Princess». Los Sites horizontales se giran para ocupar el espacio de una carta estándar y caber en fundas normales.',
  },
  'disney-lorcana': {
    en:
      'Pick a Lorcana set, or paste your deck with each card’s name and subtitle, such as "4 Pete - Suave Showoff", the way Lorcana deck builders export it. Every version prints as its own card, in English, Italian, German or French.',
    it:
      'Scegli un set di Lorcana oppure incolla il mazzo con nome e sottotitolo di ogni carta, ad esempio "4 Pete - Suave Showoff", come lo esportano i deck builder di Lorcana. Ogni versione si stampa come carta a sé, in inglese, italiano, tedesco o francese.',
    de:
      'Wähle ein Lorcana-Set oder füge dein Deck mit Name und Untertitel jeder Karte ein, etwa „4 Pete - Suave Showoff“, so wie Lorcana-Deckbuilder es exportieren. Jede Version wird als eigene Karte gedruckt, auf Englisch, Italienisch, Deutsch oder Französisch.',
    fr:
      'Choisissez un set Lorcana ou collez votre deck avec le nom et le sous-titre de chaque carte, par exemple « 4 Pete - Suave Showoff », comme l’exportent les deck builders Lorcana. Chaque version s’imprime comme une carte à part, en anglais, italien, allemand ou français.',
    es:
      'Elige un set de Lorcana o pega tu mazo con el nombre y el subtítulo de cada carta, por ejemplo «4 Pete - Suave Showoff», como lo exportan los deck builders de Lorcana. Cada versión se imprime como carta propia, en inglés, italiano, alemán o francés.',
  },
  digimon: {
    en:
      'Pick a booster or starter deck, or paste your list by card number, such as "4 EX13-015", or by name, such as "4 Gallantmon": the number selects the exact card.',
    it:
      'Scegli un booster o uno starter deck, oppure incolla la lista per numero di carta, ad esempio "4 EX13-015", o per nome, ad esempio "4 Gallantmon": il numero sceglie la carta esatta.',
    de:
      'Wähle einen Booster oder ein Starterdeck oder füge deine Liste nach Kartennummer ein, etwa „4 EX13-015“, oder nach Namen, etwa „4 Gallantmon“: Die Nummer wählt die genaue Karte.',
    fr:
      'Choisissez un booster ou un starter deck, ou collez votre liste par numéro de carte, par exemple « 4 EX13-015 », ou par nom, par exemple « 4 Gallantmon » : le numéro choisit la carte exacte.',
    es:
      'Elige un sobre o un mazo de inicio, o pega tu lista por número de carta, por ejemplo «4 EX13-015», o por nombre, por ejemplo «4 Gallantmon»: el número elige la carta exacta.',
  },
  'cardfight-vanguard': {
    en:
      'Pick a booster or title booster, or paste your list by card name with its subtitle in brackets, such as "4 Kasumi Toyama [Our CiRCLE]", or by number, such as "4 DZ-TBP01/001EN".',
    it:
      'Scegli un booster o un title booster, oppure incolla la lista per nome della carta con il sottotitolo tra parentesi, ad esempio "4 Kasumi Toyama [Our CiRCLE]", o per numero, ad esempio "4 DZ-TBP01/001EN".',
    de:
      'Wähle einen Booster oder Title-Booster oder füge deine Liste nach Kartennamen mit Untertitel in Klammern ein, etwa „4 Kasumi Toyama [Our CiRCLE]“, oder nach Nummer, etwa „4 DZ-TBP01/001EN“.',
    fr:
      'Choisissez un booster ou un title booster, ou collez votre liste par nom de carte avec son sous-titre entre crochets, par exemple « 4 Kasumi Toyama [Our CiRCLE] », ou par numéro, par exemple « 4 DZ-TBP01/001EN ».',
    es:
      'Elige un sobre o un title booster, o pega tu lista por nombre de carta con su subtítulo entre corchetes, por ejemplo «4 Kasumi Toyama [Our CiRCLE]», o por número, por ejemplo «4 DZ-TBP01/001EN».',
  },
  'dragon-ball-super': {
    en:
      'Fusion World and Masters sets share one catalogue: pick a set or paste your list by card number, such as "4 FB01-010". Leaders print with both faces.',
    it:
      'Le espansioni Fusion World e Masters stanno in un unico catalogo: scegli un set o incolla la lista per numero di carta, ad esempio "4 FB01-010". I leader si stampano con entrambi i lati.',
    de:
      'Fusion-World- und Masters-Sets teilen sich einen Katalog: Wähle ein Set oder füge deine Liste nach Kartennummer ein, etwa „4 FB01-010“. Leader werden mit beiden Seiten gedruckt.',
    fr:
      'Les extensions Fusion World et Masters partagent un catalogue : choisissez un set ou collez votre liste par numéro de carte, par exemple « 4 FB01-010 ». Les leaders s’impriment recto verso.',
    es:
      'Las expansiones Fusion World y Masters comparten catálogo: elige un set o pega tu lista por número de carta, por ejemplo «4 FB01-010». Los líderes se imprimen con ambas caras.',
  },
};

const homeCopy: Record<SeoLanguage, Omit<SeoCopy, 'faq'>> = {
  en: {
    title: 'Printable TCG Proxies in Your Language | SleeveReady',
    description:
      'Print playtest proxies for Magic, Pokémon, Lorcana, One Piece and 12 more card games. Cards in the languages they are printed in, decklist import, A4 and US Letter.',
    h1: 'Print TCG proxies in your language',
    intro:
      'SleeveReady builds printable playtest sheets from official card data: choose a game and expansion or paste a decklist, and print cards in the language they were printed in.',
    facts: ['16 card games supported', 'Cards in up to 14 languages', '9 cards per A4 or Letter page'],
  },
  it: {
    title: 'Proxy TCG da stampare in italiano | SleeveReady',
    description:
      'Stampa proxy per il playtest di Magic, Pokémon, Lorcana, One Piece e altri 12 giochi. Carte nelle lingue in cui sono stampate, import delle liste, A4 e US Letter.',
    h1: 'Stampa proxy TCG nella tua lingua',
    intro:
      'SleeveReady crea fogli di playtest dai dati ufficiali delle carte: scegli gioco ed espansione o incolla una lista e stampa le carte nella lingua in cui sono state pubblicate.',
    facts: ['16 giochi di carte supportati', 'Carte in fino a 14 lingue', '9 carte per pagina A4 o Letter'],
  },
  de: {
    title: 'TCG Proxy-Karten auf Deutsch drucken | SleeveReady',
    description:
      'Drucke Playtest-Proxys für Magic, Pokémon, Lorcana, One Piece und 12 weitere Kartenspiele. Karten in ihren Drucksprachen, Decklisten-Import, A4 und US Letter.',
    h1: 'TCG Proxy-Karten in deiner Sprache drucken',
    intro:
      'SleeveReady erstellt druckfertige Playtest-Bögen aus offiziellen Kartendaten: Spiel und Erweiterung wählen oder Deckliste einfügen und Karten in ihrer Drucksprache drucken.',
    facts: ['16 Kartenspiele unterstützt', 'Karten in bis zu 14 Sprachen', '9 Karten pro A4- oder Letter-Seite'],
  },
  fr: {
    title: 'Proxys TCG à imprimer en français | SleeveReady',
    description:
      'Imprimez des proxys de test pour Magic, Pokémon, Lorcana, One Piece et 12 autres jeux de cartes. Cartes dans leurs langues d’impression, import de listes, A4 et US Letter.',
    h1: 'Imprimez des proxys TCG dans votre langue',
    intro:
      'SleeveReady prépare des feuilles de test imprimables à partir des données officielles : choisissez un jeu et une extension ou collez une liste, et imprimez les cartes dans leur langue de publication.',
    facts: ['16 jeux de cartes pris en charge', 'Cartes dans jusqu’à 14 langues', '9 cartes par page A4 ou Letter'],
  },
  es: {
    title: 'Proxies TCG para imprimir en español | SleeveReady',
    description:
      'Imprime proxies de prueba para Magic, Pokémon, Lorcana, One Piece y 12 juegos de cartas más. Cartas en los idiomas en que se imprimen, importación de listas, A4 y US Letter.',
    h1: 'Imprime proxies TCG en tu idioma',
    intro:
      'SleeveReady crea hojas de prueba imprimibles con datos oficiales de las cartas: elige juego y expansión o pega una lista, e imprime las cartas en el idioma en que se publicaron.',
    facts: ['16 juegos de cartas compatibles', 'Cartas en hasta 14 idiomas', '9 cartas por página A4 o Letter'],
  },
};

// Language names in the page language, e.g. "English, Italian and German" or "inglese, italiano e tedesco".
export function languageList(language: SeoLanguage, codes: string[])
{
  const names = new Intl.DisplayNames([language], { type: 'language' });
  const labels = codes.map(code => names.of(code) ?? code);
  return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(labels);
}

export type SeoSetInfo = {
  name: string;
  code: string | null;
  releaseDate: string | null;
  cardCount: number;
  languages: string[];
};
const setCopy: Record<
  SeoLanguage,
  (
    set: { name: string; game: string; count: number; date: string | null; languages: string; native: boolean },
  ) => Omit<SeoCopy, 'faq'>
> = {
  en: ({ name, game, count, date, languages }) => ({
    title: `${name} Proxies to Print – ${game} | SleeveReady`,
    description: `All ${count} cards of ${name}, the ${game} expansion${
      date ? ` released on ${date}` : ''
    }. Add cards or import a list and print a 3 × 3 sheet on A4 or Letter. Cards in ${languages}.`,
    h1: `Print ${name} proxies`,
    intro:
      `Browse the ${count} cards of ${name}, add them to your sheet or paste a decklist, then print at 100% scale.`,
    facts: [`${count} cards in the set`, date ? `Released on ${date}` : 'Official card list', `Cards in ${languages}`],
  }),
  it: ({ name, game, count, date, languages, native }) => ({
    title: native
      ? `Proxy ${name} in italiano da stampare – ${game} | SleeveReady`
      : `Proxy ${name} da stampare – ${game} | SleeveReady`,
    description: `Tutte le ${count} carte di ${name}, espansione ${game}${
      date ? ` uscita il ${date}` : ''
    }. Aggiungi le carte o importa la lista e stampa un foglio 3 × 3 su A4 o Letter. Carte in ${languages}.`,
    h1: native ? `Proxy ${name} in italiano da stampare` : `Proxy ${name} da stampare`,
    intro: `Sfoglia le ${count} carte di ${name}, aggiungile al foglio o incolla una lista, poi stampa al 100%.`,
    facts: [
      `${count} carte nell’espansione`,
      date ? `Uscita il ${date}` : 'Lista carte ufficiale',
      `Carte in ${languages}`,
    ],
  }),
  de: ({ name, game, count, date, languages, native }) => ({
    title: native
      ? `${name} Proxy-Karten auf Deutsch drucken – ${game} | SleeveReady`
      : `${name} Proxy-Karten drucken – ${game} | SleeveReady`,
    description: `Alle ${count} Karten aus ${name}, der ${game}-Erweiterung${
      date ? ` vom ${date}` : ''
    }. Karten hinzufügen oder Liste importieren und einen 3 × 3-Bogen auf A4 oder Letter drucken. Karten auf ${languages}.`,
    h1: native ? `${name} Proxy-Karten auf Deutsch drucken` : `${name} Proxy-Karten drucken`,
    intro:
      `Durchsuche die ${count} Karten aus ${name}, füge sie deinem Bogen hinzu oder füge eine Deckliste ein und drucke mit 100 % Skalierung.`,
    facts: [
      `${count} Karten in der Erweiterung`,
      date ? `Erschienen am ${date}` : 'Offizielle Kartenliste',
      `Karten auf ${languages}`,
    ],
  }),
  fr: ({ name, game, count, date, languages, native }) => ({
    title: native
      ? `Proxys ${name} en français à imprimer – ${game} | SleeveReady`
      : `Proxys ${name} à imprimer – ${game} | SleeveReady`,
    description: `Les ${count} cartes de ${name}, extension ${game}${
      date ? ` sortie le ${date}` : ''
    }. Ajoutez des cartes ou importez une liste et imprimez une feuille 3 × 3 en A4 ou Letter. Cartes en ${languages}.`,
    h1: native ? `Proxys ${name} en français à imprimer` : `Proxys ${name} à imprimer`,
    intro:
      `Parcourez les ${count} cartes de ${name}, ajoutez-les à votre feuille ou collez une liste, puis imprimez à l’échelle 100 %.`,
    facts: [
      `${count} cartes dans l’extension`,
      date ? `Sortie le ${date}` : 'Liste officielle des cartes',
      `Cartes en ${languages}`,
    ],
  }),
  es: ({ name, game, count, date, languages, native }) => ({
    title: native
      ? `Proxies de ${name} en español para imprimir – ${game} | SleeveReady`
      : `Proxies de ${name} para imprimir – ${game} | SleeveReady`,
    description: `Las ${count} cartas de ${name}, expansión de ${game}${
      date ? ` publicada el ${date}` : ''
    }. Añade cartas o importa una lista e imprime una hoja de 3 × 3 en A4 o Letter. Cartas en ${languages}.`,
    h1: native ? `Proxies de ${name} en español para imprimir` : `Proxies de ${name} para imprimir`,
    intro: `Explora las ${count} cartas de ${name}, añádelas a tu hoja o pega una lista e imprime al 100 %.`,
    facts: [
      `${count} cartas en la expansión`,
      date ? `Publicada el ${date}` : 'Lista oficial de cartas',
      `Cartas en ${languages}`,
    ],
  }),
};
// Upcoming sets during preview season: people search for "<set> spoilers" and the revealed card list, so the page
// says so, with the release date and how many cards are out; it becomes a normal expansion page once released.
type SpoilerInput = { name: string; game: string; count: number; date: string | null };
const spoilerCopy: Record<
  SeoLanguage,
  (set: SpoilerInput) => Omit<SeoCopy, 'faq'> & { faq: { question: string; answer: string } }
> = {
  en: ({ name, game, count, date }) => ({
    title: `${name} Spoilers: ${count} Cards Revealed – ${game} Proxies | SleeveReady`,
    description: `Every ${name} card revealed so far (${count}), the ${game} set${
      date ? ` releasing ${date}` : ''
    }. Updated through preview season: add spoilers to your sheet and playtest them as printable proxies before release.`,
    h1: `${name} spoilers: revealed cards`,
    intro: `${count} cards of ${name} have been revealed so far${
      date ? ` ahead of the ${date} release` : ''
    }. Add the ones you want to try, print at 100% and test them before release.`,
    facts: [
      `${count} cards revealed so far`,
      date ? `Releases ${date}` : 'Release date to be announced',
      'Updated during preview season',
    ],
    faq: {
      question: `When does ${name} come out?`,
      answer: `${
        date ? `${name} releases on ${date}.` : `${name} has no release date yet.`
      } ${count} cards have been revealed so far, and new ones are added here as they are revealed.`,
    },
  }),
  it: ({ name, game, count, date }) => ({
    title: `Spoiler ${name}: ${count} carte rivelate – proxy ${game} | SleeveReady`,
    description: `Tutte le carte di ${name} rivelate finora (${count}), l’espansione ${game}${
      date ? ` in uscita il ${date}` : ''
    }. Aggiornata durante la preview: aggiungi gli spoiler al foglio e provali in anticipo con proxy da stampare.`,
    h1: `Spoiler ${name}: le carte rivelate`,
    intro: `Finora sono state rivelate ${count} carte di ${name}${
      date ? `, in uscita il ${date}` : ''
    }. Aggiungi quelle che vuoi provare, stampa al 100% e testale prima dell’uscita.`,
    facts: [
      `${count} carte rivelate finora`,
      date ? `Esce il ${date}` : 'Data di uscita da annunciare',
      'Aggiornata durante la preview',
    ],
    faq: {
      question: `Quando esce ${name}?`,
      answer: `${
        date ? `${name} esce il ${date}.` : `${name} non ha ancora una data di uscita.`
      } Finora sono state rivelate ${count} carte, e quelle nuove vengono aggiunte qui man mano che escono.`,
    },
  }),
  de: ({ name, game, count, date }) => ({
    title: `${name} Spoiler: ${count} enthüllte Karten – ${game} Proxys | SleeveReady`,
    description: `Alle bisher enthüllten Karten aus ${name} (${count}), der ${game}-Erweiterung${
      date ? `, die am ${date} erscheint` : ''
    }. Während der Preview aktualisiert: Spoiler zum Bogen hinzufügen und vor dem Release als druckbare Proxys testen.`,
    h1: `${name} Spoiler: enthüllte Karten`,
    intro: `Bisher wurden ${count} Karten aus ${name} enthüllt${
      date ? `, Erscheinungstermin ${date}` : ''
    }. Füge die gewünschten hinzu, drucke mit 100 % und teste sie vor dem Release.`,
    facts: [
      `${count} Karten bisher enthüllt`,
      date ? `Erscheint am ${date}` : 'Erscheinungstermin folgt',
      'Während der Preview aktualisiert',
    ],
    faq: {
      question: `Wann erscheint ${name}?`,
      answer: `${
        date ? `${name} erscheint am ${date}.` : `Für ${name} gibt es noch keinen Termin.`
      } Bisher wurden ${count} Karten enthüllt; neue kommen hier hinzu, sobald sie enthüllt werden.`,
    },
  }),
  fr: ({ name, game, count, date }) => ({
    title: `Spoilers ${name} : ${count} cartes dévoilées – proxys ${game} | SleeveReady`,
    description: `Toutes les cartes de ${name} dévoilées à ce jour (${count}), l’extension ${game}${
      date ? ` qui sort le ${date}` : ''
    }. Mise à jour pendant la preview : ajoutez les spoilers à votre feuille et testez-les avant la sortie avec des proxys à imprimer.`,
    h1: `Spoilers ${name} : les cartes dévoilées`,
    intro: `${count} cartes de ${name} ont été dévoilées à ce jour${
      date ? `, avant la sortie du ${date}` : ''
    }. Ajoutez celles à essayer, imprimez à 100 % et testez-les avant la sortie.`,
    facts: [
      `${count} cartes dévoilées à ce jour`,
      date ? `Sortie le ${date}` : 'Date de sortie à venir',
      'Mise à jour pendant la preview',
    ],
    faq: {
      question: `Quand sort ${name} ?`,
      answer: `${
        date ? `${name} sort le ${date}.` : `${name} n’a pas encore de date de sortie.`
      } ${count} cartes ont été dévoilées à ce jour, et les nouvelles sont ajoutées ici au fur et à mesure.`,
    },
  }),
  es: ({ name, game, count, date }) => ({
    title: `Spoilers de ${name}: ${count} cartas reveladas – proxies de ${game} | SleeveReady`,
    description: `Todas las cartas de ${name} reveladas hasta ahora (${count}), la expansión de ${game}${
      date ? ` que sale el ${date}` : ''
    }. Actualizada durante la preview: añade los spoilers a tu hoja y pruébalos antes del lanzamiento con proxies para imprimir.`,
    h1: `Spoilers de ${name}: cartas reveladas`,
    intro: `Hasta ahora se han revelado ${count} cartas de ${name}${
      date ? `, que sale el ${date}` : ''
    }. Añade las que quieras probar, imprime al 100 % y pruébalas antes del lanzamiento.`,
    facts: [
      `${count} cartas reveladas hasta ahora`,
      date ? `Sale el ${date}` : 'Fecha de salida por anunciar',
      'Actualizada durante la preview',
    ],
    faq: {
      question: `¿Cuándo sale ${name}?`,
      answer: `${
        date ? `${name} sale el ${date}.` : `${name} aún no tiene fecha de salida.`
      } Hasta ahora se han revelado ${count} cartas, y las nuevas se añaden aquí a medida que se revelan.`,
    },
  }),
};
export const isUpcomingSet = (set: { releaseDate: string | null }, today = new Date().toISOString().slice(0, 10)) =>
  Boolean(set.releaseDate && set.releaseDate > today);

export function seoSetCopy(language: SeoLanguage, game: SeoGameSlug, set: SeoSetInfo): SeoCopy
{
  if (isUpcomingSet(set))
  {
    const item = seoGames.find(entry => entry.slug === game)!;
    const date = new Date(set.releaseDate + 'T12:00:00Z').toLocaleDateString(language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const code = meaningfulCode(set.code);
    const name = code && !set.name.includes(code) ? `${set.name} (${code})` : set.name;
    const languages = languageList(language, set.languages.length ? set.languages : ['en']);
    const { faq, ...copy } = spoilerCopy[language]({ name, game: item.label, count: set.cardCount, date });
    return { ...copy, faq: [faq, setLanguageFaq[language](name, languages)] };
  }
  const item = seoGames.find(entry => entry.slug === game)!;
  const languages = languageList(language, set.languages.length ? set.languages : ['en']);
  const date = set.releaseDate
    ? new Date(set.releaseDate + 'T12:00:00Z').toLocaleDateString(language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    : null;
  const code = meaningfulCode(set.code);
  const name = code && !set.name.includes(code) ? `${set.name} (${code})` : set.name;
  const copy = setCopy[language]({
    name,
    game: item.label,
    count: set.cardCount,
    date,
    languages,
    native: language !== 'en' && set.languages.includes(language),
  });
  return { ...copy, faq: [setLanguageFaq[language](name, languages)] };
}

export type SeoCardInfo = {
  name: string;
  setName: string;
  setCode?: string | null;
  number: string | null;
  rarity: string | null;
  languages: string[];
};
type CardLabels = {
  set: string;
  number: string;
  rarity: string;
  printedIn: string;
  add: string;
  more: (set: string) => string;
  back: (set: string) => string;
  details: string;
  otherLanguages: string;
  version: string;
  shownIn: string;
  numberOf: (number: string, total: number) => string;
  languagesTitle: string;
  printTitle: string;
  copies: string;
  addCopies: (count: number) => string;
  addShort: (count: number) => string;
  inSheet: (count: number) => string;
  sheet: (copies: number, pages: number) => string;
  preview: string;
  printNote: string;
  previous: string;
  next: string;
  versions: string;
  breadcrumb: string;
  loading: string;
};
const extraCardLabels: Record<
  SeoLanguage,
  Omit<CardLabels, 'set' | 'number' | 'rarity' | 'printedIn' | 'add' | 'more' | 'back' | 'details' | 'otherLanguages'>
> = {
  en: {
    version: 'Version',
    shownIn: 'Shown in',
    numberOf: (number, total) => `${number} of ${total}`,
    languagesTitle: 'Printed languages',
    printTitle: 'Print this card',
    copies: 'Copies',
    addShort: count => `Add ${count}`,
    addCopies: count => count === 1 ? 'Add 1 copy to the sheet' : `Add ${count} copies to the sheet`,
    inSheet: count => `${count} in your sheet`,
    sheet: (copies, pages) =>
      `Your sheet: ${copies} ${copies === 1 ? 'copy' : 'copies'} on ${pages} ${pages === 1 ? 'page' : 'pages'}`,
    preview: 'Preview and print',
    printNote: '63 × 88 mm, 9 per A4 or Letter page.',
    previous: 'Previous card',
    next: 'Next card',
    versions: 'Alternative versions',
    breadcrumb: 'Breadcrumb',
    loading: 'Loading the card…',
  },
  it: {
    version: 'Versione',
    shownIn: 'Mostrata in',
    numberOf: (number, total) => `${number} di ${total}`,
    languagesTitle: 'Lingue stampate',
    printTitle: 'Stampa questa carta',
    copies: 'Copie',
    addShort: count => `Aggiungi ${count}`,
    addCopies: count => count === 1 ? 'Aggiungi 1 copia al foglio' : `Aggiungi ${count} copie al foglio`,
    inSheet: count => `${count} nel tuo foglio`,
    sheet: (copies, pages) =>
      `Il tuo foglio: ${copies} ${copies === 1 ? 'copia' : 'copie'} su ${pages} ${pages === 1 ? 'pagina' : 'pagine'}`,
    preview: 'Anteprima e stampa',
    printNote: '63 × 88 mm, 9 per pagina A4 o Letter.',
    previous: 'Carta precedente',
    next: 'Carta successiva',
    versions: 'Versioni alternative',
    breadcrumb: 'Percorso',
    loading: 'Caricamento della carta…',
  },
  de: {
    version: 'Version',
    shownIn: 'Angezeigt auf',
    numberOf: (number, total) => `${number} von ${total}`,
    languagesTitle: 'Drucksprachen',
    printTitle: 'Diese Karte drucken',
    copies: 'Exemplare',
    addShort: count => `${count} hinzufügen`,
    addCopies: count => count === 1 ? '1 Exemplar zum Bogen hinzufügen' : `${count} Exemplare zum Bogen hinzufügen`,
    inSheet: count => `${count} in deinem Bogen`,
    sheet: (copies, pages) =>
      `Dein Bogen: ${copies} ${copies === 1 ? 'Exemplar' : 'Exemplare'} auf ${pages} ${
        pages === 1 ? 'Seite' : 'Seiten'
      }`,
    preview: 'Vorschau und Drucken',
    printNote: '63 × 88 mm, 9 pro A4- oder Letter-Seite.',
    previous: 'Vorherige Karte',
    next: 'Nächste Karte',
    versions: 'Alternative Versionen',
    breadcrumb: 'Navigationspfad',
    loading: 'Karte wird geladen…',
  },
  fr: {
    version: 'Version',
    shownIn: 'Affichée en',
    numberOf: (number, total) => `${number} sur ${total}`,
    languagesTitle: 'Langues imprimées',
    printTitle: 'Imprimer cette carte',
    copies: 'Exemplaires',
    addShort: count => `Ajouter ${count}`,
    addCopies: count => count === 1 ? 'Ajouter 1 exemplaire à la feuille' : `Ajouter ${count} exemplaires à la feuille`,
    inSheet: count => `${count} dans votre feuille`,
    sheet: (copies, pages) =>
      `Votre feuille : ${copies} ${copies === 1 ? 'exemplaire' : 'exemplaires'} sur ${pages} ${
        pages === 1 ? 'page' : 'pages'
      }`,
    preview: 'Aperçu et impression',
    printNote: '63 × 88 mm, 9 par page A4 ou Letter.',
    previous: 'Carte précédente',
    next: 'Carte suivante',
    versions: 'Versions alternatives',
    breadcrumb: 'Fil d’Ariane',
    loading: 'Chargement de la carte…',
  },
  es: {
    version: 'Versión',
    shownIn: 'Mostrada en',
    numberOf: (number, total) => `${number} de ${total}`,
    languagesTitle: 'Idiomas impresos',
    printTitle: 'Imprimir esta carta',
    copies: 'Copias',
    addShort: count => `Añadir ${count}`,
    addCopies: count => count === 1 ? 'Añadir 1 copia a la hoja' : `Añadir ${count} copias a la hoja`,
    inSheet: count => `${count} en tu hoja`,
    sheet: (copies, pages) =>
      `Tu hoja: ${copies} ${copies === 1 ? 'copia' : 'copias'} en ${pages} ${pages === 1 ? 'página' : 'páginas'}`,
    preview: 'Vista previa e impresión',
    printNote: '63 × 88 mm, 9 por página A4 o Letter.',
    previous: 'Carta anterior',
    next: 'Carta siguiente',
    versions: 'Versiones alternativas',
    breadcrumb: 'Ruta de navegación',
    loading: 'Cargando la carta…',
  },
};
const baseCardLabels: Record<SeoLanguage, Omit<CardLabels, keyof typeof extraCardLabels.en>> = {
  en: {
    set: 'Expansion',
    number: 'Number',
    rarity: 'Rarity',
    printedIn: 'Printed in',
    add: 'Add to print sheet',
    more: set => `More cards from ${set}`,
    back: set => `All cards of ${set}`,
    details: 'Card details',
    otherLanguages: 'This card in',
  },
  it: {
    set: 'Espansione',
    number: 'Numero',
    rarity: 'Rarità',
    printedIn: 'Stampata in',
    add: 'Aggiungi al foglio di stampa',
    more: set => `Altre carte di ${set}`,
    back: set => `Tutte le carte di ${set}`,
    details: 'Dettagli carta',
    otherLanguages: 'Questa carta in',
  },
  de: {
    set: 'Erweiterung',
    number: 'Nummer',
    rarity: 'Seltenheit',
    printedIn: 'Gedruckt auf',
    add: 'Zum Druckbogen hinzufügen',
    more: set => `Weitere Karten aus ${set}`,
    back: set => `Alle Karten aus ${set}`,
    details: 'Kartendetails',
    otherLanguages: 'Diese Karte auf',
  },
  fr: {
    set: 'Extension',
    number: 'Numéro',
    rarity: 'Rareté',
    printedIn: 'Imprimée en',
    add: 'Ajouter à la feuille',
    more: set => `Autres cartes de ${set}`,
    back: set => `Toutes les cartes de ${set}`,
    details: 'Détails de la carte',
    otherLanguages: 'Cette carte en',
  },
  es: {
    set: 'Expansión',
    number: 'Número',
    rarity: 'Rareza',
    printedIn: 'Impresa en',
    add: 'Añadir a la hoja',
    more: set => `Más cartas de ${set}`,
    back: set => `Todas las cartas de ${set}`,
    details: 'Detalles de la carta',
    otherLanguages: 'Esta carta en',
  },
};
export const cardLabels = Object.fromEntries(
  seoLanguages.map(language => [language, { ...baseCardLabels[language], ...extraCardLabels[language] }]),
) as Record<SeoLanguage, CardLabels>;
// Labels of the game data rows and the summary sentence that opens each card page, built only from real facts.
export type CardDetailLabels = {
  kind: string;
  hp: string;
  cost: string;
  stats: string;
  illustrator: string;
  regulation: string;
  weakness: string;
  resistance: string;
  retreat: string;
  legal: string;
  names: string;
  text: string;
  tabs: { text: string; data: string; languages: string; versions: string };
  previewing: string;
  printLanguage: string;
};
export const cardDetailLabels: Record<SeoLanguage, CardDetailLabels> = {
  en: {
    kind: 'Type',
    hp: 'HP',
    cost: 'Mana cost',
    stats: 'Power / toughness',
    illustrator: 'Illustrator',
    regulation: 'Regulation mark',
    weakness: 'Weakness',
    resistance: 'Resistance',
    retreat: 'Retreat cost',
    legal: 'Legal in',
    names: 'Name in other languages',
    text: 'Card text',
    tabs: { text: 'Text', data: 'Data', languages: 'Languages', versions: 'Versions' },
    previewing: 'Preview',
    printLanguage: 'Language',
  },
  it: {
    kind: 'Tipo',
    hp: 'PS',
    cost: 'Costo di mana',
    stats: 'Forza / costituzione',
    illustrator: 'Illustratore',
    regulation: 'Simbolo di regolamento',
    weakness: 'Debolezza',
    resistance: 'Resistenza',
    retreat: 'Costo di ritirata',
    legal: 'Legale in',
    names: 'Nome in altre lingue',
    text: 'Testo della carta',
    tabs: { text: 'Testo', data: 'Dati', languages: 'Lingue', versions: 'Versioni' },
    previewing: 'Anteprima',
    printLanguage: 'Lingua',
  },
  de: {
    kind: 'Typ',
    hp: 'KP',
    cost: 'Manakosten',
    stats: 'Stärke / Widerstandskraft',
    illustrator: 'Illustration',
    regulation: 'Regelzeichen',
    weakness: 'Schwäche',
    resistance: 'Resistenz',
    retreat: 'Rückzugskosten',
    legal: 'Legal in',
    names: 'Name in anderen Sprachen',
    text: 'Kartentext',
    tabs: { text: 'Text', data: 'Daten', languages: 'Sprachen', versions: 'Versionen' },
    previewing: 'Vorschau',
    printLanguage: 'Sprache',
  },
  fr: {
    kind: 'Type',
    hp: 'PV',
    cost: 'Coût de mana',
    stats: 'Force / endurance',
    illustrator: 'Illustration',
    regulation: 'Marque de règlement',
    weakness: 'Faiblesse',
    resistance: 'Résistance',
    retreat: 'Coût de retraite',
    legal: 'Légale en',
    names: 'Nom dans d’autres langues',
    text: 'Texte de la carte',
    tabs: { text: 'Texte', data: 'Données', languages: 'Langues', versions: 'Versions' },
    previewing: 'Aperçu',
    printLanguage: 'Langue',
  },
  es: {
    kind: 'Tipo',
    hp: 'PS',
    cost: 'Coste de maná',
    stats: 'Fuerza / resistencia',
    illustrator: 'Ilustración',
    regulation: 'Marca de regulación',
    weakness: 'Debilidad',
    resistance: 'Resistencia',
    retreat: 'Coste de retirada',
    legal: 'Legal en',
    names: 'Nombre en otros idiomas',
    text: 'Texto de la carta',
    tabs: { text: 'Texto', data: 'Datos', languages: 'Idiomas', versions: 'Versiones' },
    previewing: 'Vista previa',
    printLanguage: 'Idioma',
  },
};
export type CardSummaryFacts = {
  name: string;
  set: string;
  number: string | null;
  kind?: string | null;
  hp?: string | null;
  illustrator?: string | null;
  otherSets: string[];
};
const summaryParts: Record<
  SeoLanguage,
  {
    lead: (name: string, number: string | null, set: string) => string;
    hp: (hp: string) => string;
    by: (name: string) => string;
    also: (sets: string) => string;
  }
> = {
  en: {
    lead: (name, number, set) => number ? `${name} is card ${number} of ${set}` : `${name} is a card from ${set}`,
    hp: hp => `, ${hp} HP`,
    by: name => ` Illustrated by ${name}.`,
    also: sets => ` Also printed in ${sets}.`,
  },
  it: {
    lead: (name, number, set) => number ? `${name} è la carta ${number} di ${set}` : `${name} è una carta di ${set}`,
    hp: hp => `, ${hp} PS`,
    by: name => ` Illustrazione di ${name}.`,
    also: sets => ` Stampata anche in ${sets}.`,
  },
  de: {
    lead: (name, number, set) =>
      number ? `${name} ist Karte ${number} aus ${set}` : `${name} ist eine Karte aus ${set}`,
    hp: hp => `, ${hp} KP`,
    by: name => ` Illustriert von ${name}.`,
    also: sets => ` Auch erschienen in ${sets}.`,
  },
  fr: {
    lead: (name, number, set) =>
      number ? `${name} est la carte ${number} de ${set}` : `${name} est une carte de ${set}`,
    hp: hp => `, ${hp} PV`,
    by: name => ` Illustrée par ${name}.`,
    also: sets => ` Aussi imprimée dans ${sets}.`,
  },
  es: {
    lead: (name, number, set) => number ? `${name} es la carta ${number} de ${set}` : `${name} es una carta de ${set}`,
    hp: hp => `, ${hp} PS`,
    by: name => ` Ilustrada por ${name}.`,
    also: sets => ` También impresa en ${sets}.`,
  },
};
export function cardSummary(language: SeoLanguage, facts: CardSummaryFacts)
{
  const parts = summaryParts[language];
  const sets = [...new Set(facts.otherSets.filter(set => set !== facts.set))].slice(0, 4);
  return parts.lead(facts.name, facts.number, facts.set) + (facts.kind ? ` (${facts.kind})` : '')
    + (facts.hp ? parts.hp(facts.hp) : '') + '.' + (facts.illustrator ? parts.by(facts.illustrator) : '')
    + (sets.length ? parts.also(new Intl.ListFormat(language, { type: 'conjunction' }).format(sets)) : '');
}
// People search a card by name to see it: the title leads with the card and its printing, the proxy comes second.
// Titles stay short enough to show whole; the brand is added only when it fits.
const cardCopy: Record<
  SeoLanguage,
  { tail: string; description: (card: { name: string; set: string; game: string; number: string }) => string }
> = {
  en: {
    tail: 'Card & Printable Proxy',
    description: ({ name, set, game, number }) =>
      `${name}${number} from ${set} (${game}): card image, text and other printings. Print it as a free proxy on A4 or Letter, no account needed.`,
  },
  it: {
    tail: 'Carta e proxy da stampare',
    description: ({ name, set, game, number }) =>
      `${name}${number} da ${set} (${game}): immagine, testo e altre stampe della carta. Stampala gratis come proxy su A4 o Letter, senza account.`,
  },
  de: {
    tail: 'Karte & Proxy zum Drucken',
    description: ({ name, set, game, number }) =>
      `${name}${number} aus ${set} (${game}): Kartenbild, Text und weitere Drucke. Kostenlos als Proxy auf A4 oder Letter drucken, ohne Konto.`,
  },
  fr: {
    tail: 'Carte et proxy à imprimer',
    description: ({ name, set, game, number }) =>
      `${name}${number} de ${set} (${game}) : image, texte et autres impressions de la carte. Imprimez-la gratuitement en proxy sur A4 ou Letter, sans compte.`,
  },
  es: {
    tail: 'Carta y proxy para imprimir',
    description: ({ name, set, game, number }) =>
      `${name}${number} de ${set} (${game}): imagen, texto y otras impresiones de la carta. Imprímela gratis como proxy en A4 o Letter, sin cuenta.`,
  },
};
export const cardProxyLine: Record<SeoLanguage, string> = {
  en: 'Print it as a free proxy on A4 or Letter.',
  it: 'Stampala gratis come proxy su A4 o Letter.',
  de: 'Kostenlos als Proxy auf A4 oder Letter drucken.',
  fr: 'Imprimez-la gratuitement en proxy sur A4 ou Letter.',
  es: 'Imprímela gratis como proxy en A4 o Letter.',
};
export function cardTitle(
  language: SeoLanguage,
  card: { name: string; setName: string; setCode?: string | null; number: string | null },
)
{
  const number = card.number && card.number.length <= 8 ? ` #${card.number}` : '';
  const build = (set: string) => `${card.name} (${set}${number}) – ${cardCopy[language].tail}`;
  // The set's name when the title still fits, otherwise its code when it reads as one ("SOI", not Lorcana's "10").
  const code = card.setCode && /[a-z]/i.test(card.setCode) && card.setCode.length <= 8 ? card.setCode : null;
  const title = build(card.setName).length > 62 && code ? build(code.toUpperCase()) : build(card.setName);
  return title.length <= 62 ? `${title} | SleeveReady` : title;
}
export function seoCardCopy(language: SeoLanguage, game: SeoGameSlug, card: SeoCardInfo): SeoCopy
{
  const label = seoGames.find(entry => entry.slug === game)!.label;
  const description = cardCopy[language].description({
    name: card.name,
    set: card.setName,
    game: label,
    number: card.number ? ` #${card.number}` : '',
  });
  return { title: cardTitle(language, card), description, h1: card.name, intro: description, facts: [], faq: [] };
}

const featureCopy: Record<SeoFeature, Record<SeoLanguage, (game: string) => Omit<SeoCopy, 'faq' | 'facts'>>> = {
  'top-proxies': {
    en: game => ({
      title: `Most Printed ${game} Proxies | SleeveReady`,
      description:
        `The ${game} cards SleeveReady players print most often, counted anonymously from real print sheets. Add them to your sheet in one click.`,
      h1: `Most printed ${game} proxies`,
      intro: `The ${game} cards printed most often on SleeveReady, counted anonymously from real print sheets.`,
    }),
    it: game => ({
      title: `Proxy ${game} più stampati | SleeveReady`,
      description:
        `Le carte ${game} che i giocatori stampano più spesso su SleeveReady, contate in forma anonima dai fogli di stampa reali. Aggiungile al tuo foglio con un clic.`,
      h1: `Proxy ${game} più stampati`,
      intro: `Le carte ${game} stampate più spesso su SleeveReady, contate in forma anonima dai fogli di stampa reali.`,
    }),
    de: game => ({
      title: `Meistgedruckte ${game} Proxys | SleeveReady`,
      description:
        `Die ${game}-Karten, die auf SleeveReady am häufigsten gedruckt werden – anonym aus echten Druckbögen gezählt. Mit einem Klick zum Bogen hinzufügen.`,
      h1: `Meistgedruckte ${game} Proxys`,
      intro: `Die am häufigsten gedruckten ${game}-Karten auf SleeveReady, anonym aus echten Druckbögen gezählt.`,
    }),
    fr: game => ({
      title: `Proxys ${game} les plus imprimés | SleeveReady`,
      description:
        `Les cartes ${game} les plus imprimées sur SleeveReady, comptées anonymement à partir de vraies feuilles d’impression. Ajoutez-les en un clic.`,
      h1: `Proxys ${game} les plus imprimés`,
      intro:
        `Les cartes ${game} les plus imprimées sur SleeveReady, comptées anonymement à partir de vraies feuilles d’impression.`,
    }),
    es: game => ({
      title: `Proxies de ${game} más impresos | SleeveReady`,
      description:
        `Las cartas de ${game} que más se imprimen en SleeveReady, contadas de forma anónima a partir de hojas reales. Añádelas a tu hoja con un clic.`,
      h1: `Proxies de ${game} más impresos`,
      intro: `Las cartas de ${game} más impresas en SleeveReady, contadas de forma anónima a partir de hojas reales.`,
    }),
  },
  tokens: {
    en: () => ({
      title: 'Printable Magic Tokens & Emblems | SleeveReady',
      description:
        'Print Magic: The Gathering tokens and emblems from every expansion, in the languages they were printed in. 9 per A4 or Letter page.',
      h1: 'Printable Magic tokens and emblems',
      intro: 'Choose an expansion: its tokens and emblems are listed on their own, ready for your sheet.',
    }),
    it: () => ({
      title: 'Token ed emblemi Magic da stampare | SleeveReady',
      description:
        'Stampa token ed emblemi di Magic: The Gathering di ogni espansione, nelle lingue in cui sono stati stampati. 9 per pagina A4 o Letter.',
      h1: 'Token ed emblemi Magic da stampare',
      intro: 'Scegli un’espansione: i suoi token ed emblemi compaiono da soli, pronti per il foglio.',
    }),
    de: () => ({
      title: 'Magic Token & Embleme drucken | SleeveReady',
      description:
        'Drucke Token und Embleme für Magic: The Gathering aus jeder Erweiterung, in ihren Drucksprachen. 9 pro A4- oder Letter-Seite.',
      h1: 'Magic Token und Embleme drucken',
      intro: 'Wähle eine Erweiterung: Ihre Token und Embleme werden allein angezeigt, bereit für deinen Bogen.',
    }),
    fr: () => ({
      title: 'Jetons et emblèmes Magic à imprimer | SleeveReady',
      description:
        'Imprimez les jetons et emblèmes de Magic: The Gathering de chaque extension, dans leurs langues d’impression. 9 par page A4 ou Letter.',
      h1: 'Jetons et emblèmes Magic à imprimer',
      intro: 'Choisissez une extension : ses jetons et emblèmes s’affichent seuls, prêts pour votre feuille.',
    }),
    es: () => ({
      title: 'Fichas y emblemas de Magic para imprimir | SleeveReady',
      description:
        'Imprime fichas y emblemas de Magic: The Gathering de cada expansión, en los idiomas en que se imprimieron. 9 por página A4 o Letter.',
      h1: 'Fichas y emblemas de Magic para imprimir',
      intro: 'Elige una expansión: sus fichas y emblemas aparecen solos, listos para tu hoja.',
    }),
  },
};
export function seoFeatureCopy(language: SeoLanguage, game: SeoGameSlug, feature: SeoFeature): SeoCopy
{
  const base = seoPageCopy(language, game);
  return {
    ...featureCopy[feature][language](seoGames.find(item => item.slug === game)!.label),
    facts: base.facts,
    faq: base.faq,
  };
}
type FeatureLabels = {
  catalogLink: string;
  printed: (count: number) => string;
  addAll: string;
  empty: string;
  unavailable: string;
  tokensOnly: string;
  topLink: string;
  tokensLink: string;
};
export const featureLabels: Record<SeoLanguage, FeatureLabels> = {
  en: {
    catalogLink: 'Expansions',
    printed: count => `printed ${count} ${count === 1 ? 'time' : 'times'}`,
    addAll: 'Add all to print sheet',
    empty: 'No prints counted yet for this game. Print a sheet and it will appear here.',
    unavailable: 'The ranking is not available right now.',
    tokensOnly: 'Tokens and emblems',
    topLink: 'Most printed',
    tokensLink: 'Tokens and emblems',
  },
  it: {
    catalogLink: 'Espansioni',
    printed: count => `stampata ${count} ${count === 1 ? 'volta' : 'volte'}`,
    addAll: 'Aggiungi tutte al foglio',
    empty: 'Nessuna stampa ancora conteggiata per questo gioco. Stampa un foglio e comparirà qui.',
    unavailable: 'La classifica non è disponibile in questo momento.',
    tokensOnly: 'Token ed emblemi',
    topLink: 'Più stampate',
    tokensLink: 'Token ed emblemi',
  },
  de: {
    catalogLink: 'Erweiterungen',
    printed: count => `${count}× gedruckt`,
    addAll: 'Alle zum Druckbogen hinzufügen',
    empty: 'Für dieses Spiel wurden noch keine Drucke gezählt. Drucke einen Bogen, dann erscheint er hier.',
    unavailable: 'Die Rangliste ist gerade nicht verfügbar.',
    tokensOnly: 'Token und Embleme',
    topLink: 'Meistgedruckt',
    tokensLink: 'Token und Embleme',
  },
  fr: {
    catalogLink: 'Extensions',
    printed: count => `imprimée ${count} fois`,
    addAll: 'Tout ajouter à la feuille',
    empty: 'Aucune impression comptée pour ce jeu. Imprimez une feuille et elle apparaîtra ici.',
    unavailable: 'Le classement n’est pas disponible pour le moment.',
    tokensOnly: 'Jetons et emblèmes',
    topLink: 'Les plus imprimées',
    tokensLink: 'Jetons et emblèmes',
  },
  es: {
    catalogLink: 'Expansiones',
    printed: count => `impresa ${count} ${count === 1 ? 'vez' : 'veces'}`,
    addAll: 'Añadir todas a la hoja',
    empty: 'Todavía no hay impresiones contadas para este juego. Imprime una hoja y aparecerá aquí.',
    unavailable: 'La clasificación no está disponible ahora mismo.',
    tokensOnly: 'Fichas y emblemas',
    topLink: 'Más impresas',
    tokensLink: 'Fichas y emblemas',
  },
};

// The one question an expansion page answers about itself: the languages its cards are printed in.
const setLanguageFaq: Record<SeoLanguage, (name: string, languages: string) => Faq> = {
  en: (name, languages) => ({
    question: `In which languages can I print ${name}?`,
    answer:
      `${name} is printed in ${languages}. Pick the card language above the catalogue before adding cards to the sheet.`,
  }),
  it: (name, languages) => ({
    question: `In quali lingue posso stampare ${name}?`,
    answer:
      `${name} è stampata in ${languages}. Scegli la lingua delle carte sopra il catalogo prima di aggiungerle al foglio.`,
  }),
  de: (name, languages) => ({
    question: `In welchen Sprachen kann ich ${name} drucken?`,
    answer:
      `${name} erscheint auf ${languages}. Wähle die Kartensprache über dem Katalog, bevor du Karten zum Bogen hinzufügst.`,
  }),
  fr: (name, languages) => ({
    question: `Dans quelles langues puis-je imprimer ${name} ?`,
    answer:
      `${name} est imprimée en ${languages}. Choisissez la langue des cartes au-dessus du catalogue avant de les ajouter à la feuille.`,
  }),
  es: (name, languages) => ({
    question: `¿En qué idiomas puedo imprimir ${name}?`,
    answer:
      `${name} está impresa en ${languages}. Elige el idioma de las cartas sobre el catálogo antes de añadirlas a la hoja.`,
  }),
};

// The game's newest sets, for the question people search ("latest Lorcana set"): the last one out and, when cards
// of the next one are already revealed, that one too. The static page passes them from the snapshot, the app from
// the live catalogue.
export type GameSetsInfo = {
  latest?: { name: string; date: string | null };
  coming?: { name: string; date: string; revealed: number };
};
const dateLocale: Record<SeoLanguage, string> = { en: 'en-US', it: 'it-IT', de: 'de-DE', fr: 'fr-FR', es: 'es-ES' };
const longDate = (language: SeoLanguage, date: string) =>
  new Date(date + 'T12:00:00Z').toLocaleDateString(dateLocale[language], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
type LatestCopy = {
  question: (game: string) => string;
  latest: (set: string, date: string | null) => string;
  coming: (set: string, date: string, count: number) => string;
};
const latestCopy: Record<SeoLanguage, LatestCopy> = {
  en: {
    question: game => `What is the latest ${game} set?`,
    latest: (set, date) =>
      `The latest set is ${set}${date ? `, released on ${date}` : ''}: every card in it can be printed here.`,
    coming: (set, date, count) =>
      `${set} comes out on ${date}, and the ${count} cards revealed so far are already printable.`,
  },
  it: {
    question: game => `Qual è l’ultima espansione di ${game}?`,
    latest: (set, date) =>
      `L’ultima espansione è ${set}${date ? `, uscita il ${date}` : ''}: qui puoi stamparne tutte le carte.`,
    coming: (set, date, count) => `${set} esce il ${date} e le ${count} carte rivelate finora sono già stampabili.`,
  },
  de: {
    question: game => `Welches ist das neueste Set von ${game}?`,
    latest: (set, date) =>
      `Das neueste Set ist ${set}${date ? `, erschienen am ${date}` : ''}: Alle seine Karten kannst du hier drucken.`,
    coming: (set, date, count) =>
      `${set} erscheint am ${date}, und die ${count} bisher enthüllten Karten sind schon druckbar.`,
  },
  fr: {
    question: game => `Quelle est la dernière extension de ${game} ?`,
    latest: (set, date) =>
      `La dernière extension est ${set}${
        date ? `, sortie le ${date}` : ''
      } : toutes ses cartes peuvent être imprimées ici.`,
    coming: (set, date, count) =>
      `${set} sort le ${date}, et les ${count} cartes révélées jusqu’ici sont déjà imprimables.`,
  },
  es: {
    question: game => `¿Cuál es la última expansión de ${game}?`,
    latest: (set, date) =>
      `La última expansión es ${set}${date ? `, publicada el ${date}` : ''}: aquí puedes imprimir todas sus cartas.`,
    coming: (set, date, count) =>
      `${set} sale el ${date} y las ${count} cartas reveladas hasta ahora ya se pueden imprimir.`,
  },
};
function latestFaq(language: SeoLanguage, label: string, sets?: GameSetsInfo)
{
  if (!sets?.latest) return [];
  const copy = latestCopy[language];
  const answer = [
    copy.latest(sets.latest.name, sets.latest.date ? longDate(language, sets.latest.date) : null),
    sets.coming ? copy.coming(sets.coming.name, longDate(language, sets.coming.date), sets.coming.revealed) : '',
  ]
    .filter(Boolean)
    .join(' ');
  return [{ question: copy.question(label), answer }];
}
// From a game's sets, newest first: the first one out (or undated) and the nearest coming one with at least 20 cards
// revealed, as in the app's coming-soon strip.
export function gameSetsInfo(
  sets: { name: string; releaseDate?: string | null; revealed?: number }[],
  today = new Date().toISOString().slice(0, 10),
): GameSetsInfo
{
  const out = sets.find(set => !set.releaseDate || set.releaseDate <= today);
  const coming = sets
    .filter(set => set.releaseDate && set.releaseDate > today && (set.revealed ?? 0) >= 20)
    .sort((a, b) => a.releaseDate!.localeCompare(b.releaseDate!))[0];
  return {
    ...(out ? { latest: { name: out.name, date: out.releaseDate ?? null } } : {}),
    ...(coming ? { coming: { name: coming.name, date: coming.releaseDate!, revealed: coming.revealed ?? 0 } } : {}),
  };
}

export function seoPageCopy(language: SeoLanguage, game?: SeoGameSlug, sets?: GameSetsInfo): SeoCopy
{
  const item = game ? seoGames.find(entry => entry.slug === game) : undefined;
  if (!item) return { ...homeCopy[language], faq: commonFaq[language] };
  const { languageFaq, ...copy } = gameCopy[language](
    item.label,
    language !== 'en' && item.printLanguages.includes(language),
    languageList(language, item.printLanguages),
  );
  const fact = gameFacts[item.slug]?.[language];
  const howTo = proxyHowTo[item.slug]?.[language];
  const faq = [
    ...(howTo ? [{ question: proxyQuestion[language](item.label), answer: `${howTo} ${proxyClosing[language]}` }] : []),
    ...latestFaq(language, item.label, sets),
    languageFaq,
  ];
  return { ...copy, facts: fact ? [...copy.facts, fact] : copy.facts, faq };
}

// Game data rows below the card text; identity rows (type, illustrator) sit in the record at the top instead.
export function cardGameRows(
  language: SeoLanguage,
  details: {
    hp?: string | null;
    cost?: string | null;
    stats?: string | null;
    weakness?: string | null;
    resistance?: string | null;
    retreat?: string | null;
    regulation?: string | null;
    legal?: string[];
    facts?: CardFact[];
  },
)
{
  const labels = cardDetailLabels[language];
  return ([
    [labels.hp, details.hp],
    [labels.cost, details.cost],
    [labels.stats, details.stats],
    [labels.weakness, details.weakness],
    [labels.resistance, details.resistance],
    [labels.retreat, details.retreat],
    [labels.regulation, details.regulation],
    [labels.legal, details.legal?.length ? details.legal.join(', ') : null],
  ] as [string, string | null | undefined][])
    .filter((row): row is [string, string] => Boolean(row[1]))
    .concat(factRows(language, details.facts));
}

const rarityNames: Record<SeoLanguage, Record<string, string>> = {
  en: {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    mythic: 'Mythic rare',
    special: 'Special',
    bonus: 'Bonus',
    Token: 'Token',
    Emblem: 'Emblem',
  },
  it: {
    common: 'Comune',
    uncommon: 'Non comune',
    rare: 'Rara',
    mythic: 'Rara mitica',
    special: 'Speciale',
    bonus: 'Bonus',
    Token: 'Pedina',
    Emblem: 'Emblema',
  },
  de: {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Selten',
    mythic: 'Sagenhaft selten',
    special: 'Spezial',
    bonus: 'Bonus',
    Token: 'Spielstein',
    Emblem: 'Emblem',
  },
  fr: {
    common: 'Commune',
    uncommon: 'Inhabituelle',
    rare: 'Rare',
    mythic: 'Rare mythique',
    special: 'Spéciale',
    bonus: 'Bonus',
    Token: 'Jeton',
    Emblem: 'Emblème',
  },
  es: {
    common: 'Común',
    uncommon: 'Infrecuente',
    rare: 'Rara',
    mythic: 'Mítica',
    special: 'Especial',
    bonus: 'Bonus',
    Token: 'Ficha',
    Emblem: 'Emblema',
  },
};
// Source rarity keys (Scryfall's "mythic", the catalogue's "Token") in the page language; other values pass through.
export const rarityName = (language: SeoLanguage, rarity: string | null) =>
  rarity ? rarityNames[language][rarity] ?? rarity : null;

// Questions about one card, answered only from facts the page already shows (a question without its fact is left out).
export type CardFaqFacts = {
  name: string;
  set: string;
  languages: string[];
  otherSets: string[];
  illustrator?: string | null;
  legal?: string[];
};
type FaqCopy = {
  print: (name: string) => [string, string];
  languages: (name: string, set: string, list: string) => [string, string];
  otherSets: (name: string, list: string) => [string, string];
  illustrator: (name: string, artist: string) => [string, string];
  legal: (name: string, list: string) => [string, string];
  title: (name: string) => string;
  illustrated: (artist: string) => string;
};
const faqCopy: Record<SeoLanguage, FaqCopy> = {
  en: {
    print: name => [
      `How do I print a ${name} proxy?`,
      'Choose the language and 1 to 4 copies, then add them to the sheet: SleeveReady lays out 9 cards per A4 or Letter page at 63 × 88 mm, the size of the real cards. Open the preview to print or save a PDF.',
    ],
    languages: (name, set, list) => [
      `In which languages can I print ${name}?`,
      `${set} is printed in ${list}. Pick the language of the image before adding the card to the sheet.`,
    ],
    otherSets: (name, list) => [`Which other expansions print ${name}?`, `${name} also appears in ${list}.`],
    illustrator: (name, artist) => [`Who illustrated ${name}?`, `The artwork of this printing is by ${artist}.`],
    legal: (name, list) => [
      `Is ${name} legal in tournaments?`,
      `The original card is legal in ${list}. Proxies are for playtesting and casual games: official tournaments require original cards.`,
    ],
    title: name => `Questions about ${name}`,
    illustrated: artist => `More art by ${artist}`,
  },
  it: {
    print: name => [
      `Come stampo il proxy di ${name}?`,
      "Scegli la lingua e da 1 a 4 copie, poi aggiungile al foglio: SleeveReady impagina 9 carte per pagina A4 o Letter a 63 × 88 mm, la misura delle carte originali. Apri l'anteprima per stampare o salvare il PDF.",
    ],
    languages: (name, set, list) => [
      `In quali lingue posso stampare ${name}?`,
      `${set} è stampata in ${list}. Scegli la lingua dell'immagine prima di aggiungere la carta al foglio.`,
    ],
    otherSets: (name, list) => [`In quali altre espansioni c'è ${name}?`, `${name} compare anche in ${list}.`],
    illustrator: (name, artist) => [`Chi ha illustrato ${name}?`, `L'illustrazione di questa stampa è di ${artist}.`],
    legal: (name, list) => [
      `${name} è legale nei tornei?`,
      `La carta originale è legale in ${list}. I proxy servono per il playtest e le partite tra amici: nei tornei ufficiali servono le carte originali.`,
    ],
    title: name => `Domande su ${name}`,
    illustrated: artist => `Altre illustrazioni di ${artist}`,
  },
  de: {
    print: name => [
      `Wie drucke ich einen Proxy von ${name}?`,
      'Wähle die Sprache und 1 bis 4 Exemplare und füge sie dem Bogen hinzu: SleeveReady setzt 9 Karten pro A4- oder Letter-Seite in 63 × 88 mm, der Größe echter Karten. In der Vorschau druckst du oder speicherst ein PDF.',
    ],
    languages: (name, set, list) => [
      `In welchen Sprachen kann ich ${name} drucken?`,
      `${set} erscheint auf ${list}. Wähle die Sprache des Bildes, bevor du die Karte zum Bogen hinzufügst.`,
    ],
    otherSets: (name, list) => [
      `In welchen anderen Erweiterungen gibt es ${name}?`,
      `${name} erscheint auch in ${list}.`,
    ],
    illustrator: (name, artist) => [
      `Wer hat ${name} illustriert?`,
      `Die Illustration dieses Drucks stammt von ${artist}.`,
    ],
    legal: (name, list) => [
      `Ist ${name} in Turnieren legal?`,
      `Die Originalkarte ist legal in ${list}. Proxys sind zum Testen und für freie Partien gedacht: Offizielle Turniere verlangen Originalkarten.`,
    ],
    title: name => `Fragen zu ${name}`,
    illustrated: artist => `Weitere Illustrationen von ${artist}`,
  },
  fr: {
    print: name => [
      `Comment imprimer un proxy de ${name} ?`,
      'Choisissez la langue et de 1 à 4 exemplaires, puis ajoutez-les à la feuille : SleeveReady place 9 cartes par page A4 ou Letter en 63 × 88 mm, la taille des vraies cartes. Ouvrez l’aperçu pour imprimer ou enregistrer un PDF.',
    ],
    languages: (name, set, list) => [
      `Dans quelles langues puis-je imprimer ${name} ?`,
      `${set} est imprimée en ${list}. Choisissez la langue de l’image avant d’ajouter la carte à la feuille.`,
    ],
    otherSets: (name, list) => [
      `Dans quelles autres extensions trouve-t-on ${name} ?`,
      `${name} apparaît aussi dans ${list}.`,
    ],
    illustrator: (name, artist) => [`Qui a illustré ${name} ?`, `L’illustration de cette impression est de ${artist}.`],
    legal: (name, list) => [
      `${name} est-elle légale en tournoi ?`,
      `La carte originale est légale en ${list}. Les proxies servent aux tests et aux parties amicales : les tournois officiels exigent des cartes originales.`,
    ],
    title: name => `Questions sur ${name}`,
    illustrated: artist => `Autres illustrations de ${artist}`,
  },
  es: {
    print: name => [
      `¿Cómo imprimo un proxy de ${name}?`,
      'Elige el idioma y de 1 a 4 copias y añádelas a la hoja: SleeveReady coloca 9 cartas por página A4 o Letter a 63 × 88 mm, el tamaño de las cartas originales. Abre la vista previa para imprimir o guardar un PDF.',
    ],
    languages: (name, set, list) => [
      `¿En qué idiomas puedo imprimir ${name}?`,
      `${set} está impresa en ${list}. Elige el idioma de la imagen antes de añadir la carta a la hoja.`,
    ],
    otherSets: (name, list) => [`¿En qué otras expansiones aparece ${name}?`, `${name} también aparece en ${list}.`],
    illustrator: (name, artist) => [`¿Quién ilustró ${name}?`, `La ilustración de esta impresión es de ${artist}.`],
    legal: (name, list) => [
      `¿${name} es legal en torneos?`,
      `La carta original es legal en ${list}. Los proxies sirven para probar mazos y partidas entre amigos: los torneos oficiales exigen cartas originales.`,
    ],
    title: name => `Preguntas sobre ${name}`,
    illustrated: artist => `Más ilustraciones de ${artist}`,
  },
};
export const cardFaqLabels = (language: SeoLanguage) => ({
  title: faqCopy[language].title,
  illustrated: faqCopy[language].illustrated,
});
export function cardFaq(language: SeoLanguage, facts: CardFaqFacts)
{
  const copy = faqCopy[language];
  const list = (items: string[]) => new Intl.ListFormat(language, { type: 'conjunction' }).format(items);
  const otherSets = [...new Set(facts.otherSets.filter(set => set !== facts.set))].slice(0, 6);
  return [
    copy.print(facts.name),
    ...(facts.languages.length ? [copy.languages(facts.name, facts.set, list(facts.languages))] : []),
    ...(otherSets.length ? [copy.otherSets(facts.name, list(otherSets))] : []),
    ...(facts.illustrator ? [copy.illustrator(facts.name, facts.illustrator)] : []),
    ...(facts.legal?.length ? [copy.legal(facts.name, list(facts.legal))] : []),
  ]
    .map(([question, answer]) => ({ question, answer }));
}

// Illustrator pages: /it/pokemon/illustratori/mousho/. The segment is translated; the artist slug is shared by all languages.
export const illustratorSegment: Record<SeoLanguage, string> = {
  en: 'illustrators',
  it: 'illustratori',
  de: 'illustratoren',
  fr: 'illustrateurs',
  es: 'ilustradores',
};
export const artistSlug = (name: string) => slugify(name);
export const artistPath = (language: SeoLanguage, game: SeoGameSlug, name: string) =>
  `/${language}/${game}/${illustratorSegment[language]}/${artistSlug(name)}/`;
export type ArtistPageFacts = { artist: string; game: string; count: number; newest: string; oldest: string };
type ArtistCopy = {
  crumb: string;
  title: (artist: string, game: string, count: number) => string;
  intro: (facts: ArtistPageFacts) => string;
  seeAll: (artist: string) => string;
};
const span = (
  from: string,
  to: string,
  between: (from: string, to: string) => string,
  single: (set: string) => string,
) => from === to ? single(from) : between(from, to);
export const artistCopy: Record<SeoLanguage, ArtistCopy> = {
  en: {
    crumb: 'Illustrators',
    title: (artist, game, count) =>
      `${artist}: ${count} ${game} ${count === 1 ? 'card' : 'cards'} illustrated | SleeveReady`,
    seeAll: artist => `All cards by ${artist}`,
    intro: ({ artist, game, count, newest, oldest }) =>
      `${count} ${game} ${count === 1 ? 'card' : 'cards'} illustrated by ${artist}, ${
        span(oldest, newest, (a, b) => `from ${a} to ${b}`, set => `in ${set}`)
      }. Open a card to print its proxy at 63 × 88 mm, 9 per A4 or Letter page.`,
  },
  it: {
    crumb: 'Illustratori',
    title: (artist, game, count) =>
      `${artist}: ${count} ${count === 1 ? 'carta' : 'carte'} ${game} ${
        count === 1 ? 'illustrata' : 'illustrate'
      } | SleeveReady`,
    seeAll: artist => `Tutte le carte di ${artist}`,
    intro: ({ artist, game, count, newest, oldest }) =>
      `${count} ${count === 1 ? 'carta' : 'carte'} ${game} ${count === 1 ? 'illustrata' : 'illustrate'} da ${artist}, ${
        span(oldest, newest, (a, b) => `da ${a} a ${b}`, set => `in ${set}`)
      }. Apri una carta per stamparne il proxy a 63 × 88 mm, 9 per pagina A4 o Letter.`,
  },
  de: {
    crumb: 'Illustratoren',
    title: (artist, game, count) =>
      `${artist}: ${count} illustrierte ${game}-${count === 1 ? 'Karte' : 'Karten'} | SleeveReady`,
    seeAll: artist => `Alle Karten von ${artist}`,
    intro: ({ artist, game, count, newest, oldest }) =>
      `${count} ${game}-${count === 1 ? 'Karte' : 'Karten'}, illustriert von ${artist}, ${
        span(oldest, newest, (a, b) => `von ${a} bis ${b}`, set => `in ${set}`)
      }. Öffne eine Karte, um ihren Proxy in 63 × 88 mm zu drucken, 9 pro A4- oder Letter-Seite.`,
  },
  fr: {
    crumb: 'Illustrateurs',
    title: (artist, game, count) =>
      `${artist} : ${count} ${count === 1 ? 'carte' : 'cartes'} ${game} ${
        count === 1 ? 'illustrée' : 'illustrées'
      } | SleeveReady`,
    seeAll: artist => `Toutes les cartes de ${artist}`,
    intro: ({ artist, game, count, newest, oldest }) =>
      `${count} ${count === 1 ? 'carte' : 'cartes'} ${game} ${
        count === 1 ? 'illustrée' : 'illustrées'
      } par ${artist}, ${
        span(oldest, newest, (a, b) => `de ${a} à ${b}`, set => `dans ${set}`)
      }. Ouvrez une carte pour imprimer son proxy en 63 × 88 mm, 9 par page A4 ou Letter.`,
  },
  es: {
    crumb: 'Ilustradores',
    title: (artist, game, count) =>
      `${artist}: ${count} ${count === 1 ? 'carta' : 'cartas'} de ${game} ${
        count === 1 ? 'ilustrada' : 'ilustradas'
      } | SleeveReady`,
    seeAll: artist => `Todas las cartas de ${artist}`,
    intro: ({ artist, game, count, newest, oldest }) =>
      `${count} ${count === 1 ? 'carta' : 'cartas'} de ${game} ${
        count === 1 ? 'ilustrada' : 'ilustradas'
      } por ${artist}, ${
        span(oldest, newest, (a, b) => `de ${a} a ${b}`, set => `en ${set}`)
      }. Abre una carta para imprimir su proxy a 63 × 88 mm, 9 por página A4 o Letter.`,
  },
};

// The artist profile on illustrator pages: facts computed from the catalogue, plus Wikidata facts when the match is certain.
type ArtistProfileCopy = {
  heading: string;
  years: string;
  sets: string;
  topSetLabel: string;
  topSet: (name: string, count: number) => string;
  colors: string;
  type: string;
  rares: string;
  country: string;
  website: string;
  wikipedia: string;
  alsoIn: string;
  source: string;
  colorNames: Record<'W' | 'U' | 'B' | 'R' | 'G' | 'C', string>;
  typeNames: Record<
    'Creature' | 'Planeswalker' | 'Instant' | 'Sorcery' | 'Enchantment' | 'Artifact' | 'Land' | 'Battle',
    string
  >;
};
export const artistProfileCopy: Record<SeoLanguage, ArtistProfileCopy> = {
  en: {
    heading: 'Profile',
    years: 'Years in print',
    sets: 'Expansions',
    topSetLabel: 'Most cards in',
    topSet: (name, count) => `${name} (${count} cards)`,
    colors: 'Most illustrated colours',
    type: 'Most illustrated type',
    rares: 'Rares and mythics',
    country: 'Nationality',
    website: 'Official website',
    wikipedia: 'Wikipedia',
    alsoIn: 'Also illustrates for',
    source: 'Nationality, website and Wikipedia link from Wikidata.',
    colorNames: { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colourless' },
    typeNames: {
      Creature: 'Creatures',
      Planeswalker: 'Planeswalkers',
      Instant: 'Instants',
      Sorcery: 'Sorceries',
      Enchantment: 'Enchantments',
      Artifact: 'Artifacts',
      Land: 'Lands',
      Battle: 'Battles',
    },
  },
  it: {
    heading: 'Profilo',
    years: 'Anni di uscita',
    sets: 'Espansioni',
    topSetLabel: 'Più carte in',
    topSet: (name, count) => `${name} (${count} carte)`,
    colors: 'Colori più illustrati',
    type: 'Tipo più illustrato',
    rares: 'Rare e mitiche',
    country: 'Nazionalità',
    website: 'Sito ufficiale',
    wikipedia: 'Wikipedia',
    alsoIn: 'Illustra anche per',
    source: 'Nazionalità, sito e link a Wikipedia da Wikidata.',
    colorNames: { W: 'Bianco', U: 'Blu', B: 'Nero', R: 'Rosso', G: 'Verde', C: 'Incolore' },
    typeNames: {
      Creature: 'Creature',
      Planeswalker: 'Planeswalker',
      Instant: 'Istantanei',
      Sorcery: 'Stregonerie',
      Enchantment: 'Incantesimi',
      Artifact: 'Artefatti',
      Land: 'Terre',
      Battle: 'Battaglie',
    },
  },
  de: {
    heading: 'Profil',
    years: 'Erscheinungsjahre',
    sets: 'Erweiterungen',
    topSetLabel: 'Die meisten Karten in',
    topSet: (name, count) => `${name} (${count} Karten)`,
    colors: 'Häufigste Farben',
    type: 'Häufigster Kartentyp',
    rares: 'Seltene und sagenhaft seltene',
    country: 'Staatsangehörigkeit',
    website: 'Offizielle Website',
    wikipedia: 'Wikipedia',
    alsoIn: 'Illustriert auch für',
    source: 'Staatsangehörigkeit, Website und Wikipedia-Link aus Wikidata.',
    colorNames: { W: 'Weiß', U: 'Blau', B: 'Schwarz', R: 'Rot', G: 'Grün', C: 'Farblos' },
    typeNames: {
      Creature: 'Kreaturen',
      Planeswalker: 'Planeswalker',
      Instant: 'Spontanzauber',
      Sorcery: 'Hexereien',
      Enchantment: 'Verzauberungen',
      Artifact: 'Artefakte',
      Land: 'Länder',
      Battle: 'Schlachten',
    },
  },
  fr: {
    heading: 'Profil',
    years: 'Années de parution',
    sets: 'Extensions',
    topSetLabel: 'Le plus de cartes dans',
    topSet: (name, count) => `${name} (${count} cartes)`,
    colors: 'Couleurs les plus illustrées',
    type: 'Type le plus illustré',
    rares: 'Rares et mythiques',
    country: 'Nationalité',
    website: 'Site officiel',
    wikipedia: 'Wikipédia',
    alsoIn: 'Illustre aussi pour',
    source: 'Nationalité, site et lien Wikipédia issus de Wikidata.',
    colorNames: { W: 'Blanc', U: 'Bleu', B: 'Noir', R: 'Rouge', G: 'Vert', C: 'Incolore' },
    typeNames: {
      Creature: 'Créatures',
      Planeswalker: 'Planeswalkers',
      Instant: 'Éphémères',
      Sorcery: 'Rituels',
      Enchantment: 'Enchantements',
      Artifact: 'Artefacts',
      Land: 'Terrains',
      Battle: 'Batailles',
    },
  },
  es: {
    heading: 'Perfil',
    years: 'Años de publicación',
    sets: 'Expansiones',
    topSetLabel: 'Más cartas en',
    topSet: (name, count) => `${name} (${count} cartas)`,
    colors: 'Colores más ilustrados',
    type: 'Tipo más ilustrado',
    rares: 'Raras y míticas',
    country: 'Nacionalidad',
    website: 'Sitio oficial',
    wikipedia: 'Wikipedia',
    alsoIn: 'También ilustra para',
    source: 'Nacionalidad, sitio y enlace a Wikipedia de Wikidata.',
    colorNames: { W: 'Blanco', U: 'Azul', B: 'Negro', R: 'Rojo', G: 'Verde', C: 'Incoloro' },
    typeNames: {
      Creature: 'Criaturas',
      Planeswalker: 'Planeswalkers',
      Instant: 'Instantáneos',
      Sorcery: 'Conjuros',
      Enchantment: 'Encantamientos',
      Artifact: 'Artefactos',
      Land: 'Tierras',
      Battle: 'Batallas',
    },
  },
};
