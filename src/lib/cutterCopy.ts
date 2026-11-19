import type { Language } from './i18n';

// Print layout options for cutters: orientation, margin, bleed in mm, guide style, registration marks, cut file.
type CutterCopy = {
  orientation: string;
  portrait: string;
  landscape: string;
  grid: (columns: number, rows: number) => string;
  margin: string;
  marginHint: string;
  bleedHint: string;
  guides: { outline: string; corners: string; none: string };
  cutter: string;
  marks: string;
  markNone: string;
  markInset: string;
  marksHint: string;
  rounded: string;
  cutFile: string;
  cutFileHint: string;
  cricutHint: string;
  brotherHint: string;
  png: (page: number) => string;
  pngHint: (width: string, height: string) => string;
  exporting: string;
  missing: string;
  exportFailed: string;
  duplex: string;
  backs: string;
  backImage: string;
  backHint: string;
  flip: string;
  flipLong: string;
  flipShort: string;
  backOffset: string;
  backOffsetHint: string;
  backPage: string;
};
export const cutterCopy: Record<Language, CutterCopy> = {
  en: {
    cricutHint:
      'Print Then Cut fits 2 × 2 cards. Download each page as a PNG, upload it to Design Space, keep it at the size shown and let Design Space add its own marks and bleed.',
    brotherHint:
      'ScanNCut scans the printed sheet: the cards keep a 3 mm gap so each one is found as a separate shape. You can also import the cut file.',
    png: page => `PNG page ${page}`,
    pngHint: (width, height) => `Transparent background, 300 dpi. Size in Design Space: ${width} × ${height} mm.`,
    exporting: 'Preparing…',
    missing: 'image not available',
    exportFailed: 'The PNG could not be prepared. Try again.',
    duplex: 'Front and back',
    backs: 'Print card backs',
    backImage: 'Back image',
    backHint:
      'Choose an image for the back (it stays on this device). After every page of fronts comes its page of backs, mirrored for double-sided printing.',
    flip: 'Duplex flips on',
    flipLong: 'Long edge',
    flipShort: 'Short edge',
    backOffset: 'Back shift',
    backOffsetHint: 'If the backs come out shifted, move them here (− left/up, + right/down) and print a test sheet.',
    backPage: 'Backs',
    orientation: 'Orientation',
    portrait: 'Portrait',
    landscape: 'Landscape',
    grid: (columns, rows) => `${columns} × ${rows} · ${columns * rows} per page`,
    margin: 'Page margin',
    marginHint: 'Distance from the paper edge kept free of cards.',
    bleedHint:
      'Extends the artwork past the cut line (0–3 mm), so small cutting errors leave no white edge. Widens the space between cards when needed.',
    guides: { outline: 'Dashed outline', corners: 'Crop marks in the margins', none: 'No guides' },
    cutter: 'Print and cut',
    marks: 'Registration marks',
    markNone: 'None',
    markInset: 'Mark inset',
    marksHint:
      'Silhouette’s standard marks (square and two corners). Use the same inset in Silhouette Studio; the margin grows so no card comes near them.',
    rounded: 'Rounded corners in the cut file',
    cutFile: 'Download cut file (SVG)',
    cutFileHint:
      'Card outlines and marks in millimetres, at the same positions on every page: open it in your cutter’s software over the printed sheet.',
  },
  it: {
    cricutHint:
      'Il Print Then Cut contiene 2 × 2 carte. Scarica ogni pagina in PNG, caricala in Design Space, lasciala alla misura indicata e fai aggiungere a Design Space i suoi marcatori e la sua abbondanza.',
    brotherHint:
      'ScanNCut scansiona il foglio stampato: tra le carte restano 3 mm così ognuna viene riconosciuta come forma separata. Puoi anche importare il file di taglio.',
    png: page => `PNG pagina ${page}`,
    pngHint: (width, height) => `Sfondo trasparente, 300 dpi. Misura in Design Space: ${width} × ${height} mm.`,
    exporting: 'Preparazione…',
    missing: 'immagine non disponibile',
    exportFailed: 'Impossibile preparare il PNG. Riprova.',
    duplex: 'Fronte e retro',
    backs: 'Stampa i dorsi',
    backImage: 'Immagine del dorso',
    backHint:
      'Scegli un’immagine per il dorso (resta su questo dispositivo). Dopo ogni pagina di fronti arriva la sua pagina di dorsi, già specchiata per la stampa fronte/retro.',
    flip: 'Il fronte/retro gira sul',
    flipLong: 'Lato lungo',
    flipShort: 'Lato corto',
    backOffset: 'Spostamento del retro',
    backOffsetHint:
      'Se i dorsi escono spostati, correggili qui (− sinistra/su, + destra/giù) e stampa un foglio di prova.',
    backPage: 'Dorsi',
    orientation: 'Orientamento',
    portrait: 'Verticale',
    landscape: 'Orizzontale',
    grid: (columns, rows) => `${columns} × ${rows} · ${columns * rows} per pagina`,
    margin: 'Margine della pagina',
    marginHint: 'Distanza dal bordo del foglio lasciata libera dalle carte.',
    bleedHint:
      'Estende l’immagine oltre la linea di taglio (0–3 mm): un taglio impreciso non lascia bordi bianchi. Se serve allarga lo spazio tra le carte.',
    guides: { outline: 'Contorno tratteggiato', corners: 'Segni di taglio nei margini', none: 'Nessuna guida' },
    cutter: 'Stampa e taglia',
    marks: 'Marcatori di registrazione',
    markNone: 'Nessuno',
    markInset: 'Distanza dei marcatori dal bordo',
    marksHint:
      'I marcatori standard Silhouette (quadrato e due angoli). Usa la stessa distanza in Silhouette Studio; il margine cresce perché nessuna carta li tocchi.',
    rounded: 'Angoli arrotondati nel file di taglio',
    cutFile: 'Scarica il file di taglio (SVG)',
    cutFileHint:
      'Contorni delle carte e marcatori in millimetri, nelle stesse posizioni su ogni pagina: aprilo nel programma del plotter sopra il foglio stampato.',
  },
  de: {
    cricutHint:
      'Print Then Cut fasst 2 × 2 Karten. Lade jede Seite als PNG herunter, lade sie in Design Space hoch, behalte die angegebene Größe und lass Design Space eigene Marken und Beschnitt hinzufügen.',
    brotherHint:
      'ScanNCut scannt den gedruckten Bogen: Zwischen den Karten bleiben 3 mm, damit jede als eigene Form erkannt wird. Du kannst auch die Schnittdatei importieren.',
    png: page => `PNG Seite ${page}`,
    pngHint: (width, height) => `Transparenter Hintergrund, 300 dpi. Größe in Design Space: ${width} × ${height} mm.`,
    exporting: 'Wird vorbereitet…',
    missing: 'Bild nicht verfügbar',
    exportFailed: 'Das PNG konnte nicht erstellt werden. Versuche es erneut.',
    duplex: 'Vorder- und Rückseite',
    backs: 'Kartenrückseiten drucken',
    backImage: 'Bild der Rückseite',
    backHint:
      'Wähle ein Bild für die Rückseite (es bleibt auf diesem Gerät). Nach jeder Seite mit Vorderseiten folgt ihre Seite mit Rückseiten, gespiegelt für den Duplexdruck.',
    flip: 'Duplex wendet an der',
    flipLong: 'Langen Kante',
    flipShort: 'Kurzen Kante',
    backOffset: 'Versatz der Rückseite',
    backOffsetHint:
      'Wenn die Rückseiten verschoben sind, korrigiere sie hier (− links/oben, + rechts/unten) und drucke einen Testbogen.',
    backPage: 'Rückseiten',
    orientation: 'Ausrichtung',
    portrait: 'Hochformat',
    landscape: 'Querformat',
    grid: (columns, rows) => `${columns} × ${rows} · ${columns * rows} pro Seite`,
    margin: 'Seitenrand',
    marginHint: 'Abstand zum Papierrand, der frei von Karten bleibt.',
    bleedHint:
      'Verlängert das Motiv über die Schnittlinie (0–3 mm), damit kleine Schnittfehler keinen weißen Rand hinterlassen. Vergrößert bei Bedarf den Kartenabstand.',
    guides: { outline: 'Gestrichelte Kontur', corners: 'Schnittmarken im Rand', none: 'Keine Hilfslinien' },
    cutter: 'Drucken und Schneiden',
    marks: 'Passermarken',
    markNone: 'Keine',
    markInset: 'Abstand der Marken vom Rand',
    marksHint:
      'Die Standardmarken von Silhouette (Quadrat und zwei Ecken). Nutze denselben Abstand in Silhouette Studio; der Rand wächst, damit keine Karte sie berührt.',
    rounded: 'Abgerundete Ecken in der Schnittdatei',
    cutFile: 'Schnittdatei herunterladen (SVG)',
    cutFileHint:
      'Kartenkonturen und Marken in Millimetern, auf jeder Seite an derselben Stelle: in der Software deines Plotters über den gedruckten Bogen legen.',
  },
  fr: {
    cricutHint:
      'Print Then Cut contient 2 × 2 cartes. Téléchargez chaque page en PNG, importez-la dans Design Space, gardez la taille indiquée et laissez Design Space ajouter ses repères et son fond perdu.',
    brotherHint:
      'ScanNCut scanne la feuille imprimée : 3 mm séparent les cartes pour que chacune soit reconnue comme une forme. Vous pouvez aussi importer le fichier de découpe.',
    png: page => `PNG page ${page}`,
    pngHint: (width, height) => `Fond transparent, 300 dpi. Taille dans Design Space : ${width} × ${height} mm.`,
    exporting: 'Préparation…',
    missing: 'image indisponible',
    exportFailed: 'Impossible de préparer le PNG. Réessayez.',
    duplex: 'Recto et verso',
    backs: 'Imprimer les dos',
    backImage: 'Image du dos',
    backHint:
      'Choisissez une image pour le dos (elle reste sur cet appareil). Après chaque page de faces vient sa page de dos, inversée pour l’impression recto verso.',
    flip: 'Le recto verso tourne sur le',
    flipLong: 'Bord long',
    flipShort: 'Bord court',
    backOffset: 'Décalage du verso',
    backOffsetHint:
      'Si les dos sont décalés, corrigez ici (− gauche/haut, + droite/bas) et imprimez une feuille d’essai.',
    backPage: 'Dos',
    orientation: 'Orientation',
    portrait: 'Portrait',
    landscape: 'Paysage',
    grid: (columns, rows) => `${columns} × ${rows} · ${columns * rows} par page`,
    margin: 'Marge de la page',
    marginHint: 'Distance au bord du papier laissée libre de cartes.',
    bleedHint:
      'Prolonge l’illustration au-delà du trait de coupe (0–3 mm) : une petite erreur de découpe ne laisse pas de bord blanc. Élargit l’espace entre les cartes si besoin.',
    guides: { outline: 'Contour pointillé', corners: 'Traits de coupe dans les marges', none: 'Aucun repère' },
    cutter: 'Imprimer et découper',
    marks: 'Repères d’alignement',
    markNone: 'Aucun',
    markInset: 'Distance des repères au bord',
    marksHint:
      'Les repères standard Silhouette (carré et deux angles). Utilisez la même distance dans Silhouette Studio ; la marge s’agrandit pour qu’aucune carte ne les touche.',
    rounded: 'Coins arrondis dans le fichier de découpe',
    cutFile: 'Télécharger le fichier de découpe (SVG)',
    cutFileHint:
      'Contours des cartes et repères en millimètres, aux mêmes positions sur chaque page : ouvrez-le dans le logiciel de votre traceur sur la feuille imprimée.',
  },
  es: {
    cricutHint:
      'Print Then Cut admite 2 × 2 cartas. Descarga cada página en PNG, súbela a Design Space, mantén el tamaño indicado y deja que Design Space añada sus marcas y su sangrado.',
    brotherHint:
      'ScanNCut escanea la hoja impresa: entre las cartas quedan 3 mm para que cada una se detecte como una forma aparte. También puedes importar el archivo de corte.',
    png: page => `PNG página ${page}`,
    pngHint: (width, height) => `Fondo transparente, 300 ppp. Tamaño en Design Space: ${width} × ${height} mm.`,
    exporting: 'Preparando…',
    missing: 'imagen no disponible',
    exportFailed: 'No se pudo preparar el PNG. Inténtalo de nuevo.',
    duplex: 'Anverso y reverso',
    backs: 'Imprimir los dorsos',
    backImage: 'Imagen del dorso',
    backHint:
      'Elige una imagen para el dorso (se queda en este dispositivo). Tras cada página de anversos llega su página de dorsos, reflejada para imprimir a doble cara.',
    flip: 'La doble cara gira por el',
    flipLong: 'Borde largo',
    flipShort: 'Borde corto',
    backOffset: 'Desplazamiento del reverso',
    backOffsetHint:
      'Si los dorsos salen desplazados, corrígelos aquí (− izquierda/arriba, + derecha/abajo) e imprime una hoja de prueba.',
    backPage: 'Dorsos',
    orientation: 'Orientación',
    portrait: 'Vertical',
    landscape: 'Horizontal',
    grid: (columns, rows) => `${columns} × ${rows} · ${columns * rows} por página`,
    margin: 'Margen de la página',
    marginHint: 'Distancia al borde del papel que queda libre de cartas.',
    bleedHint:
      'Extiende la imagen más allá de la línea de corte (0–3 mm), así un corte impreciso no deja bordes blancos. Si hace falta, amplía el espacio entre cartas.',
    guides: { outline: 'Contorno discontinuo', corners: 'Marcas de corte en los márgenes', none: 'Sin guías' },
    cutter: 'Imprimir y cortar',
    marks: 'Marcas de registro',
    markNone: 'Ninguna',
    markInset: 'Distancia de las marcas al borde',
    marksHint:
      'Las marcas estándar de Silhouette (cuadrado y dos esquinas). Usa la misma distancia en Silhouette Studio; el margen crece para que ninguna carta las toque.',
    rounded: 'Esquinas redondeadas en el archivo de corte',
    cutFile: 'Descargar archivo de corte (SVG)',
    cutFileHint:
      'Contornos de las cartas y marcas en milímetros, en la misma posición en cada página: ábrelo en el programa de tu plóter sobre la hoja impresa.',
  },
  pt: {
    cricutHint:
      'O Print Then Cut leva 2 × 2 cartas. Descarregue cada página em PNG, carregue-a no Design Space, mantenha o tamanho indicado e deixe o Design Space juntar as suas marcas e sangria.',
    brotherHint:
      'O ScanNCut digitaliza a folha impressa: ficam 3 mm entre as cartas para cada uma ser reconhecida como forma separada. Também pode importar o ficheiro de corte.',
    png: page => `PNG página ${page}`,
    pngHint: (width, height) => `Fundo transparente, 300 dpi. Tamanho no Design Space: ${width} × ${height} mm.`,
    exporting: 'A preparar…',
    missing: 'imagem indisponível',
    exportFailed: 'Não foi possível preparar o PNG. Tente novamente.',
    duplex: 'Frente e verso',
    backs: 'Imprimir os versos',
    backImage: 'Imagem do verso',
    backHint:
      'Escolha uma imagem para o verso (fica neste dispositivo). Depois de cada página de frentes vem a sua página de versos, espelhada para impressão frente e verso.',
    flip: 'O frente e verso vira pelo',
    flipLong: 'Lado comprido',
    flipShort: 'Lado curto',
    backOffset: 'Desvio do verso',
    backOffsetHint:
      'Se os versos saírem desviados, corrija aqui (− esquerda/cima, + direita/baixo) e imprima uma folha de teste.',
    backPage: 'Versos',
    orientation: 'Orientação',
    portrait: 'Vertical',
    landscape: 'Horizontal',
    grid: (columns, rows) => `${columns} × ${rows} · ${columns * rows} por página`,
    margin: 'Margem da página',
    marginHint: 'Distância à borda do papel deixada livre de cartas.',
    bleedHint:
      'Prolonga a imagem para lá da linha de corte (0–3 mm), para que um corte impreciso não deixe margens brancas. Alarga o espaço entre cartas quando necessário.',
    guides: { outline: 'Contorno tracejado', corners: 'Marcas de corte nas margens', none: 'Sem guias' },
    cutter: 'Imprimir e cortar',
    marks: 'Marcas de registo',
    markNone: 'Nenhuma',
    markInset: 'Distância das marcas à borda',
    marksHint:
      'As marcas padrão da Silhouette (quadrado e dois cantos). Use a mesma distância no Silhouette Studio; a margem cresce para nenhuma carta lhes tocar.',
    rounded: 'Cantos arredondados no ficheiro de corte',
    cutFile: 'Descarregar ficheiro de corte (SVG)',
    cutFileHint:
      'Contornos das cartas e marcas em milímetros, na mesma posição em todas as páginas: abra-o no software do plotter sobre a folha impressa.',
  },
  nl: {
    cricutHint:
      'Print Then Cut past 2 × 2 kaarten. Download elke pagina als PNG, upload die in Design Space, houd de aangegeven maat aan en laat Design Space eigen tekens en afloop toevoegen.',
    brotherHint:
      'ScanNCut scant het geprinte vel: tussen de kaarten blijft 3 mm zodat elke kaart als aparte vorm wordt herkend. Je kunt ook het snijbestand importeren.',
    png: page => `PNG pagina ${page}`,
    pngHint: (width, height) => `Transparante achtergrond, 300 dpi. Maat in Design Space: ${width} × ${height} mm.`,
    exporting: 'Voorbereiden…',
    missing: 'afbeelding niet beschikbaar',
    exportFailed: 'De PNG kon niet worden gemaakt. Probeer het opnieuw.',
    duplex: 'Voor- en achterkant',
    backs: 'Kaartruggen printen',
    backImage: 'Afbeelding van de rug',
    backHint:
      'Kies een afbeelding voor de rug (die blijft op dit apparaat). Na elke pagina met voorkanten komt de pagina met ruggen, gespiegeld voor dubbelzijdig printen.',
    flip: 'Dubbelzijdig keert om de',
    flipLong: 'Lange zijde',
    flipShort: 'Korte zijde',
    backOffset: 'Verschuiving achterkant',
    backOffsetHint:
      'Komen de ruggen verschoven uit, corrigeer dan hier (− links/omhoog, + rechts/omlaag) en print een testvel.',
    backPage: 'Ruggen',
    orientation: 'Oriëntatie',
    portrait: 'Staand',
    landscape: 'Liggend',
    grid: (columns, rows) => `${columns} × ${rows} · ${columns * rows} per pagina`,
    margin: 'Paginamarge',
    marginHint: 'Afstand tot de papierrand die vrij blijft van kaarten.',
    bleedHint:
      'Laat de afbeelding voorbij de snijlijn doorlopen (0–3 mm), zodat kleine snijfouten geen witte rand geven. Vergroot zo nodig de ruimte tussen kaarten.',
    guides: { outline: 'Gestippelde omtrek', corners: 'Snijtekens in de marges', none: 'Geen hulplijnen' },
    cutter: 'Printen en snijden',
    marks: 'Registratietekens',
    markNone: 'Geen',
    markInset: 'Afstand van de tekens tot de rand',
    marksHint:
      'De standaardtekens van Silhouette (vierkant en twee hoeken). Gebruik dezelfde afstand in Silhouette Studio; de marge groeit zodat geen kaart ze raakt.',
    rounded: 'Afgeronde hoeken in het snijbestand',
    cutFile: 'Snijbestand downloaden (SVG)',
    cutFileHint:
      'Kaartomtrekken en tekens in millimeters, op elke pagina op dezelfde plek: open het in de software van je snijplotter over het geprinte vel.',
  },
  pl: {
    cricutHint:
      'Print Then Cut mieści 2 × 2 karty. Pobierz każdą stronę jako PNG, wgraj do Design Space, zachowaj podany rozmiar i pozwól Design Space dodać własne znaczniki i spad.',
    brotherHint:
      'ScanNCut skanuje wydrukowany arkusz: między kartami zostają 3 mm, by każda była rozpoznana jako osobny kształt. Możesz też zaimportować plik cięcia.',
    png: page => `PNG strona ${page}`,
    pngHint: (width, height) => `Przezroczyste tło, 300 dpi. Rozmiar w Design Space: ${width} × ${height} mm.`,
    exporting: 'Przygotowywanie…',
    missing: 'obraz niedostępny',
    exportFailed: 'Nie udało się przygotować PNG. Spróbuj ponownie.',
    duplex: 'Awers i rewers',
    backs: 'Drukuj rewersy kart',
    backImage: 'Obraz rewersu',
    backHint:
      'Wybierz obraz rewersu (zostaje na tym urządzeniu). Po każdej stronie awersów jest strona rewersów, odbita lustrzanie do druku dwustronnego.',
    flip: 'Druk dwustronny obraca wzdłuż',
    flipLong: 'Dłuższej krawędzi',
    flipShort: 'Krótszej krawędzi',
    backOffset: 'Przesunięcie rewersu',
    backOffsetHint:
      'Jeśli rewersy są przesunięte, popraw je tutaj (− w lewo/w górę, + w prawo/w dół) i wydrukuj arkusz próbny.',
    backPage: 'Rewersy',
    orientation: 'Orientacja',
    portrait: 'Pionowo',
    landscape: 'Poziomo',
    grid: (columns, rows) => `${columns} × ${rows} · ${columns * rows} na stronę`,
    margin: 'Margines strony',
    marginHint: 'Odległość od krawędzi papieru wolna od kart.',
    bleedHint:
      'Przedłuża grafikę poza linię cięcia (0–3 mm), więc drobne błędy cięcia nie zostawiają białej krawędzi. W razie potrzeby zwiększa odstęp między kartami.',
    guides: { outline: 'Przerywany obrys', corners: 'Znaczniki cięcia na marginesach', none: 'Bez linii' },
    cutter: 'Drukuj i tnij',
    marks: 'Znaczniki pasowania',
    markNone: 'Brak',
    markInset: 'Odległość znaczników od krawędzi',
    marksHint:
      'Standardowe znaczniki Silhouette (kwadrat i dwa narożniki). Ustaw tę samą odległość w Silhouette Studio; margines rośnie, by żadna karta ich nie dotykała.',
    rounded: 'Zaokrąglone rogi w pliku cięcia',
    cutFile: 'Pobierz plik cięcia (SVG)',
    cutFileHint:
      'Obrysy kart i znaczniki w milimetrach, w tym samym miejscu na każdej stronie: otwórz go w programie plotera na wydrukowanym arkuszu.',
  },
};
