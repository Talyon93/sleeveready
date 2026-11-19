// The site's error pages (404, 503): the dark header bar, a short explanation and the ways back in (home and the
// main games), in the language of the address. The same markup serves the static public/404.html (written by
// scripts/write-404.ts, checked by a test) and the pages the function answers itself. Styles live in
// public/error.css: the function's Content-Security-Policy does not allow inline styles.

export type ErrorLanguage = 'en' | 'it' | 'de' | 'fr' | 'es';
export type ErrorKind = 'page' | 'card' | 'set' | 'artist' | 'unavailable';

type Text = { title: string; message: string };
type Copy = { home: string; games: string; back: string } & Record<ErrorKind, Text>;

const copy: Record<ErrorLanguage, Copy> = {
  en: {
    home: 'Go to the home page',
    games: 'Or open a game',
    back: 'SleeveReady home',
    page: {
      title: 'Page not found',
      message: 'This page does not exist or is no longer available. Start again from the home page or a game.',
    },
    card: { title: 'Card not found', message: 'This card is not in the catalogue, or its address has changed.' },
    set: { title: 'Set not found', message: 'This set is not in the catalogue, or its address has changed.' },
    artist: { title: 'Illustrator not found', message: 'There are no cards by this illustrator in the catalogue.' },
    unavailable: {
      title: 'Temporarily unavailable',
      message: 'The card catalogue is not responding. Please try again in a few minutes.',
    },
  },
  it: {
    home: 'Vai alla home',
    games: 'Oppure apri un gioco',
    back: 'Home di SleeveReady',
    page: {
      title: 'Pagina non trovata',
      message: 'Questa pagina non esiste o non è più disponibile. Riparti dalla home o da un gioco.',
    },
    card: {
      title: 'Carta non trovata',
      message: 'Questa carta non è nel catalogo, oppure il suo indirizzo è cambiato.',
    },
    set: {
      title: 'Espansione non trovata',
      message: 'Questa espansione non è nel catalogo, oppure il suo indirizzo è cambiato.',
    },
    artist: { title: 'Illustratore non trovato', message: 'Nel catalogo non ci sono carte di questo illustratore.' },
    unavailable: {
      title: 'Momentaneamente non disponibile',
      message: 'Il catalogo delle carte non risponde. Riprova fra qualche minuto.',
    },
  },
  de: {
    home: 'Zur Startseite',
    games: 'Oder öffne ein Spiel',
    back: 'SleeveReady Startseite',
    page: {
      title: 'Seite nicht gefunden',
      message: 'Diese Seite gibt es nicht oder nicht mehr. Starte erneut auf der Startseite oder bei einem Spiel.',
    },
    card: {
      title: 'Karte nicht gefunden',
      message: 'Diese Karte ist nicht im Katalog, oder ihre Adresse hat sich geändert.',
    },
    set: {
      title: 'Erweiterung nicht gefunden',
      message: 'Diese Erweiterung ist nicht im Katalog, oder ihre Adresse hat sich geändert.',
    },
    artist: {
      title: 'Illustrator nicht gefunden',
      message: 'Im Katalog gibt es keine Karten dieses Illustrators.',
    },
    unavailable: {
      title: 'Vorübergehend nicht verfügbar',
      message: 'Der Kartenkatalog antwortet nicht. Bitte versuche es in ein paar Minuten erneut.',
    },
  },
  fr: {
    home: 'Aller à l’accueil',
    games: 'Ou ouvrez un jeu',
    back: 'Accueil SleeveReady',
    page: {
      title: 'Page introuvable',
      message: 'Cette page n’existe pas ou n’est plus disponible. Repartez de l’accueil ou d’un jeu.',
    },
    card: {
      title: 'Carte introuvable',
      message: 'Cette carte n’est pas dans le catalogue, ou son adresse a changé.',
    },
    set: {
      title: 'Extension introuvable',
      message: 'Cette extension n’est pas dans le catalogue, ou son adresse a changé.',
    },
    artist: { title: 'Illustrateur introuvable', message: 'Aucune carte de cet illustrateur dans le catalogue.' },
    unavailable: {
      title: 'Temporairement indisponible',
      message: 'Le catalogue des cartes ne répond pas. Réessayez dans quelques minutes.',
    },
  },
  es: {
    home: 'Ir a la página de inicio',
    games: 'O abre un juego',
    back: 'Inicio de SleeveReady',
    page: {
      title: 'Página no encontrada',
      message: 'Esta página no existe o ya no está disponible. Vuelve a empezar desde el inicio o desde un juego.',
    },
    card: {
      title: 'Carta no encontrada',
      message: 'Esta carta no está en el catálogo, o su dirección ha cambiado.',
    },
    set: {
      title: 'Expansión no encontrada',
      message: 'Esta expansión no está en el catálogo, o su dirección ha cambiado.',
    },
    artist: { title: 'Ilustrador no encontrado', message: 'No hay cartas de este ilustrador en el catálogo.' },
    unavailable: {
      title: 'No disponible por el momento',
      message: 'El catálogo de cartas no responde. Vuelve a intentarlo en unos minutos.',
    },
  },
};

const games: [slug: string, name: string][] = [
  ['magic-the-gathering', 'Magic'],
  ['pokemon', 'Pokémon'],
  ['one-piece', 'One Piece'],
  ['disney-lorcana', 'Lorcana'],
  ['yu-gi-oh', 'Yu-Gi-Oh!'],
  ['star-wars-unlimited', 'Star Wars Unlimited'],
];

const escape = (value: string) =>
  value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));

/** The language of an address's first segment (/it/…), English otherwise. */
export const errorLanguage = (value: string | undefined): ErrorLanguage =>
  value && Object.hasOwn(copy, value) ? value as ErrorLanguage : 'en';

/** The HTTP status that goes with each kind of error page. */
export const errorStatus = (kind: ErrorKind) => kind === 'unavailable' ? 503 : 404;

export function errorPage(kind: ErrorKind, language: ErrorLanguage = 'en')
{
  const text = copy[language];
  const { title, message } = text[kind];
  const links = games
    .map(([slug, name]) => `<li><a href="/${language}/${slug}/">${escape(name)}</a></li>`)
    .join('');
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>${escape(title)} — SleeveReady</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
<link rel="stylesheet" href="/error.css"/>
</head>
<body>
<header class="error-bar"><a class="error-brand" href="/${language}/" aria-label="${
  escape(text.back)
}"><img src="/favicon.svg" alt="" width="34" height="34"/><span>Sleeve<b>Ready</b></span></a></header>
<main class="error-main">
<p class="error-code">${errorStatus(kind)}</p>
<h1>${escape(title)}</h1>
<p class="error-message">${escape(message)}</p>
<p><a class="error-home" href="/${language}/">${escape(text.home)}</a></p>
<nav aria-label="${escape(text.games)}"><h2>${escape(text.games)}</h2><ul class="error-games">${links}</ul></nav>
</main>
</body>
</html>
`;
}

/** The static page Netlify serves for any unknown address (English: it cannot know the visitor's language). */
export const notFoundPage = () => errorPage('page');
