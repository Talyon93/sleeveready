import type { Language } from './i18n';

// The home page: the release board of every game (upcoming sets with revealed cards, and the latest releases).
type HomeCopy = {
  title: string;
  lead: string;
  paste: string;
  build: string;
  allGames: string;
  sheet: string;
  columns: { date: string; when: string; game: string; set: string; cards: string };
  when: (days: number) => string;
  today: (date: string) => string;
  revealed: (count: number | null) => string;
  printableNow: string;
  outNow: string;
  printable: string;
  imagesComing: string;
  upcomingNote: (count: number | null, date: string) => string;
  releasedNote: (date: string) => string;
  imagesNote: (date: string) => string;
  others: string;
  undated: string;
  latest: string;
  preorder: string;
  buy: string;
  details: string;
  add: string;
  close: string;
  previous: string;
  next: string;
  addRevealed: string;
  addSet: string;
  open: (set: string) => string;
  earlier: string;
  loading: string;
  unavailable: string;
  addCard: (name: string) => string;
};

export const homeCopy: Record<Language, HomeCopy> = {
  en: {
    preorder: 'Preorder',
    buy: 'Buy the original',
    details: 'Card details',
    add: 'Add to sheet',
    close: 'Close',
    previous: 'Previous card',
    next: 'Next card',
    others: 'Latest set of the other games',
    undated: 'date not listed',
    latest: 'Latest set',
    title: 'Latest and upcoming sets',
    lead:
      'Print playtest proxies of any card: pick cards or paste a decklist, then download a PDF with 9 cards per A4 or Letter page, ready to cut.',
    paste: 'Paste a list or a deck link',
    build: 'Build sheet',
    allGames: 'All games',
    sheet: 'Your sheet',
    columns: { date: 'Date', when: 'When', game: 'Game', set: 'Set', cards: 'Cards' },
    when: days =>
      days > 1
        ? `in ${days} days`
        : days === 1
        ? 'tomorrow'
        : days === 0
        ? 'today'
        : days === -1
        ? 'yesterday'
        : `${-days} days ago`,
    today: date => `Today · ${date}`,
    revealed: count => count ? `${count} revealed` : 'Revealing',
    printableNow: 'printable now',
    outNow: 'Out now',
    printable: 'every card printable',
    imagesComing: 'card images coming',
    upcomingNote: (count, date) =>
      `${count ?? 'The first'} cards revealed so far. More arrive here as they are shown, until ${date}.`,
    releasedNote: date => `Released ${date}. Pick cards or take the whole set.`,
    imagesNote: date => `Released ${date}. The card images are not out yet: the cards appear here as soon as they are.`,
    addRevealed: 'Add all revealed',
    addSet: 'Add the whole set',
    open: set => `Open ${set}`,
    earlier: 'Earlier releases',
    loading: 'Loading the releases…',
    unavailable: 'The releases could not be loaded. Try again in a few minutes.',
    addCard: name => `Add ${name} to the sheet`,
  },
  it: {
    preorder: 'Preordina',
    buy: 'Compra l’originale',
    details: 'Dettagli della carta',
    add: 'Aggiungi al foglio',
    close: 'Chiudi',
    previous: 'Carta precedente',
    next: 'Carta successiva',
    others: 'Ultima espansione degli altri giochi',
    undated: 'data non indicata',
    latest: 'Ultima espansione',
    title: 'Ultime e prossime espansioni',
    lead:
      'Stampa proxy da playtest di qualsiasi carta: scegli le carte o incolla una lista, poi scarica un PDF con 9 carte per pagina A4 o Letter, pronto da ritagliare.',
    paste: 'Incolla una lista o un link al mazzo',
    build: 'Crea il foglio',
    allGames: 'Tutti i giochi',
    sheet: 'Il tuo foglio',
    columns: { date: 'Data', when: 'Quando', game: 'Gioco', set: 'Espansione', cards: 'Carte' },
    when: days =>
      days > 1
        ? `tra ${days} giorni`
        : days === 1
        ? 'domani'
        : days === 0
        ? 'oggi'
        : days === -1
        ? 'ieri'
        : `${-days} giorni fa`,
    today: date => `Oggi · ${date}`,
    revealed: count => count ? `${count} rivelate` : 'In rivelazione',
    printableNow: 'già stampabili',
    outNow: 'Uscita',
    printable: 'tutte le carte stampabili',
    imagesComing: 'immagini in arrivo',
    upcomingNote: (count, date) =>
      `${
        count ?? 'Le prime'
      } carte rivelate finora. Le altre arrivano qui man mano che vengono mostrate, fino al ${date}.`,
    releasedNote: date => `Uscita il ${date}. Scegli le carte o prendi tutta l’espansione.`,
    imagesNote: date =>
      `Uscita il ${date}. Le immagini delle carte non sono ancora disponibili: le carte compaiono qui appena escono.`,
    addRevealed: 'Aggiungi tutte le rivelate',
    addSet: 'Aggiungi tutta l’espansione',
    open: set => `Apri ${set}`,
    earlier: 'Uscite precedenti',
    loading: 'Carico le uscite…',
    unavailable: 'Impossibile caricare le uscite. Riprova tra qualche minuto.',
    addCard: name => `Aggiungi ${name} al foglio`,
  },
  de: {
    preorder: 'Vorbestellen',
    buy: 'Original kaufen',
    details: 'Kartendetails',
    add: 'Zum Bogen hinzufügen',
    close: 'Schließen',
    previous: 'Vorherige Karte',
    next: 'Nächste Karte',
    others: 'Neueste Erweiterung der anderen Spiele',
    undated: 'Datum nicht angegeben',
    latest: 'Neueste Erweiterung',
    title: 'Neueste und kommende Erweiterungen',
    lead:
      'Drucke Playtest-Proxys jeder Karte: Karten auswählen oder eine Deckliste einfügen, dann ein PDF mit 9 Karten pro A4- oder Letter-Seite herunterladen, fertig zum Ausschneiden.',
    paste: 'Liste oder Decklink einfügen',
    build: 'Bogen erstellen',
    allGames: 'Alle Spiele',
    sheet: 'Dein Bogen',
    columns: { date: 'Datum', when: 'Wann', game: 'Spiel', set: 'Erweiterung', cards: 'Karten' },
    when: days =>
      days > 1
        ? `in ${days} Tagen`
        : days === 1
        ? 'morgen'
        : days === 0
        ? 'heute'
        : days === -1
        ? 'gestern'
        : `vor ${-days} Tagen`,
    today: date => `Heute · ${date}`,
    revealed: count => count ? `${count} enthüllt` : 'Wird enthüllt',
    printableNow: 'jetzt druckbar',
    outNow: 'Erschienen',
    printable: 'alle Karten druckbar',
    imagesComing: 'Kartenbilder folgen',
    upcomingNote: (count, date) =>
      `${
        count ?? 'Die ersten'
      } Karten bisher enthüllt. Weitere erscheinen hier, sobald sie gezeigt werden, bis zum ${date}.`,
    releasedNote: date => `Erschienen am ${date}. Wähle Karten oder nimm die ganze Erweiterung.`,
    imagesNote: date =>
      `Erschienen am ${date}. Die Kartenbilder sind noch nicht verfügbar: Die Karten erscheinen hier, sobald es sie gibt.`,
    addRevealed: 'Alle enthüllten hinzufügen',
    addSet: 'Ganze Erweiterung hinzufügen',
    open: set => `${set} öffnen`,
    earlier: 'Frühere Erscheinungen',
    loading: 'Erscheinungen werden geladen…',
    unavailable: 'Die Erscheinungen konnten nicht geladen werden. Versuche es in ein paar Minuten erneut.',
    addCard: name => `${name} zum Bogen hinzufügen`,
  },
  fr: {
    preorder: 'Précommander',
    buy: 'Acheter l’original',
    details: 'Détails de la carte',
    add: 'Ajouter à la planche',
    close: 'Fermer',
    previous: 'Carte précédente',
    next: 'Carte suivante',
    others: 'Dernière extension des autres jeux',
    undated: 'date non indiquée',
    latest: 'Dernière extension',
    title: 'Dernières et prochaines extensions',
    lead:
      'Imprimez des proxys de playtest de n’importe quelle carte : choisissez les cartes ou collez une liste, puis téléchargez un PDF de 9 cartes par page A4 ou Letter, prêt à découper.',
    paste: 'Collez une liste ou un lien de deck',
    build: 'Créer la planche',
    allGames: 'Tous les jeux',
    sheet: 'Votre planche',
    columns: { date: 'Date', when: 'Quand', game: 'Jeu', set: 'Extension', cards: 'Cartes' },
    when: days =>
      days > 1
        ? `dans ${days} jours`
        : days === 1
        ? 'demain'
        : days === 0
        ? 'aujourd’hui'
        : days === -1
        ? 'hier'
        : `il y a ${-days} jours`,
    today: date => `Aujourd’hui · ${date}`,
    revealed: count => count ? `${count} révélées` : 'En cours de révélation',
    printableNow: 'déjà imprimables',
    outNow: 'Sortie',
    printable: 'toutes les cartes imprimables',
    imagesComing: 'images bientôt disponibles',
    upcomingNote: (count, date) =>
      `${
        count ?? 'Les premières'
      } cartes révélées pour l’instant. Les suivantes arrivent ici au fil des révélations, jusqu’au ${date}.`,
    releasedNote: date => `Sortie le ${date}. Choisissez des cartes ou prenez toute l’extension.`,
    imagesNote: date =>
      `Sortie le ${date}. Les images des cartes ne sont pas encore disponibles : les cartes apparaissent ici dès leur sortie.`,
    addRevealed: 'Ajouter toutes les révélées',
    addSet: 'Ajouter toute l’extension',
    open: set => `Ouvrir ${set}`,
    earlier: 'Sorties précédentes',
    loading: 'Chargement des sorties…',
    unavailable: 'Impossible de charger les sorties. Réessayez dans quelques minutes.',
    addCard: name => `Ajouter ${name} à la planche`,
  },
  es: {
    preorder: 'Reservar',
    buy: 'Comprar el original',
    details: 'Detalles de la carta',
    add: 'Añadir a la hoja',
    close: 'Cerrar',
    previous: 'Carta anterior',
    next: 'Carta siguiente',
    others: 'Última expansión de los demás juegos',
    undated: 'fecha no indicada',
    latest: 'Última expansión',
    title: 'Últimas y próximas expansiones',
    lead:
      'Imprime proxies de playtest de cualquier carta: elige las cartas o pega una lista y descarga un PDF con 9 cartas por página A4 o Letter, listo para recortar.',
    paste: 'Pega una lista o un enlace de mazo',
    build: 'Crear hoja',
    allGames: 'Todos los juegos',
    sheet: 'Tu hoja',
    columns: { date: 'Fecha', when: 'Cuándo', game: 'Juego', set: 'Expansión', cards: 'Cartas' },
    when: days =>
      days > 1
        ? `en ${days} días`
        : days === 1
        ? 'mañana'
        : days === 0
        ? 'hoy'
        : days === -1
        ? 'ayer'
        : `hace ${-days} días`,
    today: date => `Hoy · ${date}`,
    revealed: count => count ? `${count} reveladas` : 'Revelándose',
    printableNow: 'ya imprimibles',
    outNow: 'A la venta',
    printable: 'todas las cartas imprimibles',
    imagesComing: 'imágenes en camino',
    upcomingNote: (count, date) =>
      `${
        count ?? 'Las primeras'
      } cartas reveladas hasta ahora. Las demás llegan aquí a medida que se muestran, hasta el ${date}.`,
    releasedNote: date => `Salió el ${date}. Elige cartas o llévate toda la expansión.`,
    imagesNote: date =>
      `Salió el ${date}. Las imágenes de las cartas aún no están disponibles: las cartas aparecen aquí en cuanto salgan.`,
    addRevealed: 'Añadir todas las reveladas',
    addSet: 'Añadir toda la expansión',
    open: set => `Abrir ${set}`,
    earlier: 'Lanzamientos anteriores',
    loading: 'Cargando los lanzamientos…',
    unavailable: 'No se pudieron cargar los lanzamientos. Inténtalo en unos minutos.',
    addCard: name => `Añadir ${name} a la hoja`,
  },
  pt: {
    preorder: 'Pré-encomendar',
    buy: 'Comprar o original',
    details: 'Detalhes da carta',
    add: 'Adicionar à folha',
    close: 'Fechar',
    previous: 'Carta anterior',
    next: 'Carta seguinte',
    others: 'Última expansão dos outros jogos',
    undated: 'data não indicada',
    latest: 'Última expansão',
    title: 'Últimas e próximas expansões',
    lead:
      'Imprima proxies de playtest de qualquer carta: escolha as cartas ou cole uma lista e obtenha um PDF com 9 cartas por página A4 ou Letter, pronto para recortar.',
    paste: 'Cole uma lista ou um link de baralho',
    build: 'Criar folha',
    allGames: 'Todos os jogos',
    sheet: 'A sua folha',
    columns: { date: 'Data', when: 'Quando', game: 'Jogo', set: 'Expansão', cards: 'Cartas' },
    when: days =>
      days > 1
        ? `daqui a ${days} dias`
        : days === 1
        ? 'amanhã'
        : days === 0
        ? 'hoje'
        : days === -1
        ? 'ontem'
        : `há ${-days} dias`,
    today: date => `Hoje · ${date}`,
    revealed: count => count ? `${count} reveladas` : 'A ser revelada',
    printableNow: 'já imprimíveis',
    outNow: 'À venda',
    printable: 'todas as cartas imprimíveis',
    imagesComing: 'imagens a caminho',
    upcomingNote: (count, date) =>
      `${
        count ?? 'As primeiras'
      } cartas reveladas até agora. As restantes chegam aqui à medida que são mostradas, até ${date}.`,
    releasedNote: date => `Lançada a ${date}. Escolha cartas ou leve a expansão inteira.`,
    imagesNote: date =>
      `Lançada a ${date}. As imagens das cartas ainda não estão disponíveis: as cartas aparecem aqui assim que saírem.`,
    addRevealed: 'Adicionar todas as reveladas',
    addSet: 'Adicionar a expansão inteira',
    open: set => `Abrir ${set}`,
    earlier: 'Lançamentos anteriores',
    loading: 'A carregar os lançamentos…',
    unavailable: 'Não foi possível carregar os lançamentos. Tente novamente daqui a uns minutos.',
    addCard: name => `Adicionar ${name} à folha`,
  },
  nl: {
    preorder: 'Pre-order',
    buy: 'Origineel kopen',
    details: 'Kaartdetails',
    add: 'Aan het vel toevoegen',
    close: 'Sluiten',
    previous: 'Vorige kaart',
    next: 'Volgende kaart',
    others: 'Nieuwste uitbreiding van de andere spellen',
    undated: 'datum niet vermeld',
    latest: 'Nieuwste uitbreiding',
    title: 'Nieuwste en komende uitbreidingen',
    lead:
      'Print playtest-proxy’s van elke kaart: kies kaarten of plak een decklijst en download een pdf met 9 kaarten per A4- of Letter-pagina, klaar om te knippen.',
    paste: 'Plak een lijst of een decklink',
    build: 'Vel maken',
    allGames: 'Alle spellen',
    sheet: 'Jouw vel',
    columns: { date: 'Datum', when: 'Wanneer', game: 'Spel', set: 'Uitbreiding', cards: 'Kaarten' },
    when: days =>
      days > 1
        ? `over ${days} dagen`
        : days === 1
        ? 'morgen'
        : days === 0
        ? 'vandaag'
        : days === -1
        ? 'gisteren'
        : `${-days} dagen geleden`,
    today: date => `Vandaag · ${date}`,
    revealed: count => count ? `${count} onthuld` : 'Wordt onthuld',
    printableNow: 'nu te printen',
    outNow: 'Uit',
    printable: 'alle kaarten te printen',
    imagesComing: 'kaartafbeeldingen volgen',
    upcomingNote: (count, date) =>
      `${
        count ?? 'De eerste'
      } kaarten tot nu toe onthuld. Nieuwe verschijnen hier zodra ze getoond worden, tot ${date}.`,
    releasedNote: date => `Verschenen op ${date}. Kies kaarten of neem de hele uitbreiding.`,
    imagesNote: date =>
      `Verschenen op ${date}. De kaartafbeeldingen zijn er nog niet: de kaarten verschijnen hier zodra ze er zijn.`,
    addRevealed: 'Alle onthulde toevoegen',
    addSet: 'Hele uitbreiding toevoegen',
    open: set => `${set} openen`,
    earlier: 'Eerdere uitgaven',
    loading: 'Uitgaven laden…',
    unavailable: 'De uitgaven konden niet worden geladen. Probeer het over een paar minuten opnieuw.',
    addCard: name => `${name} aan het vel toevoegen`,
  },
  pl: {
    preorder: 'Zamów w przedsprzedaży',
    buy: 'Kup oryginał',
    details: 'Szczegóły karty',
    add: 'Dodaj do arkusza',
    close: 'Zamknij',
    previous: 'Poprzednia karta',
    next: 'Następna karta',
    others: 'Najnowszy dodatek pozostałych gier',
    undated: 'data nieznana',
    latest: 'Najnowszy dodatek',
    title: 'Najnowsze i nadchodzące dodatki',
    lead:
      'Drukuj proxy do testów dowolnej karty: wybierz karty lub wklej listę i pobierz PDF z 9 kartami na stronę A4 lub Letter, gotowy do wycięcia.',
    paste: 'Wklej listę lub link do talii',
    build: 'Utwórz arkusz',
    allGames: 'Wszystkie gry',
    sheet: 'Twój arkusz',
    columns: { date: 'Data', when: 'Kiedy', game: 'Gra', set: 'Dodatek', cards: 'Karty' },
    when: days =>
      days > 1
        ? `za ${days} dni`
        : days === 1
        ? 'jutro'
        : days === 0
        ? 'dziś'
        : days === -1
        ? 'wczoraj'
        : `${-days} dni temu`,
    today: date => `Dziś · ${date}`,
    revealed: count => count ? `Ujawniono: ${count}` : 'Ujawnianie',
    printableNow: 'już do druku',
    outNow: 'Wydany',
    printable: 'wszystkie karty do druku',
    imagesComing: 'obrazy kart wkrótce',
    upcomingNote: (count, date) =>
      `Ujawniono dotąd: ${count ?? 'pierwsze'} kart. Kolejne pojawiają się tu na bieżąco, aż do ${date}.`,
    releasedNote: date => `Wydany ${date}. Wybierz karty lub weź cały dodatek.`,
    imagesNote: date =>
      `Wydany ${date}. Obrazów kart jeszcze nie ma: karty pojawią się tutaj, gdy tylko będą dostępne.`,
    addRevealed: 'Dodaj wszystkie ujawnione',
    addSet: 'Dodaj cały dodatek',
    open: set => `Otwórz ${set}`,
    earlier: 'Wcześniejsze wydania',
    loading: 'Wczytywanie wydań…',
    unavailable: 'Nie udało się wczytać wydań. Spróbuj ponownie za kilka minut.',
    addCard: name => `Dodaj ${name} do arkusza`,
  },
};
