import type { Language } from './i18n';

type PrintCopy = {
  preview: (paper: string) => string;
  summary: (cards: number, pages: number) => string;
  paper: string;
  spacing: string;
  bleed: string;
  bleedHint: string;
  guides: string;
  print: string;
  preparing: string;
  close: string;
  instructions: (paper: string) => string;
  settings: string;
  printer: string;
  steps: (paper: string, orientation: string) => string[];
  lowQuality: (count: number) => string;
  textProxies: (count: number) => string;
  refreshing: string;
  notReady: string;
  pageLabel: string;
  page: string;
};

const polish = (count: number, one: string, few: string, many: string) =>
  count === 1 ? one : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? few : many;

export const printCopy: Record<Language, PrintCopy> = {
  en: {
    settings: 'Layout',
    printer: 'In the print dialog',
    steps: (paper, orientation) => [
      `Paper ${paper}, ${orientation.toLowerCase()}`,
      'Scale 100%, not “fit to page”',
      'Margins: none',
      'Headers and footers off',
      'For a file: “Save as PDF”',
    ],
    lowQuality: count =>
      `${count} ${
        count === 1 ? 'image is' : 'images are'
      } below 300 dpi and may print slightly soft. They are marked with an amber dot.`,
    textProxies: count =>
      `${count} ${count === 1 ? 'card has' : 'cards have'} no image and ${
        count === 1 ? 'prints' : 'print'
      } as a text proxy.`,
    preview: paper => `${paper} preview`,
    summary: (cards, pages) => `${cards} cards · ${pages} ${pages === 1 ? 'page' : 'pages'} · 63 × 88 mm`,
    paper: 'Paper',
    spacing: 'Space between cards',
    bleed: 'Bleed',
    bleedHint: 'Extends the artwork up to 1 mm past the cut line, so small cutting errors leave no white edge.',
    guides: 'Cut guides',
    print: 'Print / Save PDF',
    preparing: 'Preparing…',
    close: 'Close preview',
    instructions: paper =>
      `Choose ${paper}, 100% scale and no margins, and turn off headers and footers. For a PDF choose “Save as PDF”. Missing images are replaced by the card name.`,
    refreshing: 'Loading the originals for saved cards…',
    notReady: 'Some images are not ready yet. Wait for them to load and print again.',
    pageLabel: 'PLAYTEST · not for sale · sleeveready.com',
    page: 'Page',
  },
  it: {
    settings: 'Impaginazione',
    printer: 'Nella finestra di stampa',
    steps: (paper, orientation) => [
      `Carta ${paper}, ${orientation.toLowerCase()}`,
      'Scala 100%, non “adatta alla pagina”',
      'Margini: nessuno',
      'Intestazioni e piè di pagina disattivati',
      'Per un file: “Salva come PDF”',
    ],
    lowQuality: count =>
      `${count} ${count === 1 ? 'immagine è' : 'immagini sono'} sotto i 300 dpi e in stampa ${
        count === 1 ? 'può' : 'possono'
      } risultare un po’ morbide. Sono segnate da un punto ambra.`,
    textProxies: count =>
      `${count} ${count === 1 ? 'carta non ha' : 'carte non hanno'} un’immagine: ${
        count === 1 ? 'viene stampata' : 'vengono stampate'
      } come proxy di testo.`,
    preview: paper => `Anteprima ${paper}`,
    summary: (cards, pages) => `${cards} carte · ${pages} ${pages === 1 ? 'pagina' : 'pagine'} · 63 × 88 mm`,
    paper: 'Carta',
    spacing: 'Spazio tra le carte',
    bleed: 'Abbondanza (bleed)',
    bleedHint: 'Estende l’immagine fino a 1 mm oltre la linea di taglio: un taglio impreciso non lascia bordi bianchi.',
    guides: 'Guide di taglio',
    print: 'Stampa / Salva PDF',
    preparing: 'Preparazione…',
    close: 'Chiudi anteprima',
    instructions: paper =>
      `Seleziona ${paper}, scala 100% e nessun margine, e disattiva intestazioni e piè di pagina. Per un PDF scegli “Salva come PDF”. Le immagini mancanti vengono sostituite dal nome della carta.`,
    refreshing: 'Caricamento degli originali per le carte salvate…',
    notReady: 'Alcune immagini non sono ancora pronte. Attendi il caricamento e riprova la stampa.',
    pageLabel: 'PLAYTEST · non destinato alla vendita · sleeveready.com',
    page: 'Pagina',
  },
  de: {
    settings: 'Layout',
    printer: 'Im Druckdialog',
    steps: (paper, orientation) => [
      `Papier ${paper}, ${orientation}`,
      'Skalierung 100 %, nicht „an Seite anpassen“',
      'Ränder: keine',
      'Kopf- und Fußzeilen aus',
      'Für eine Datei: „Als PDF speichern“',
    ],
    lowQuality: count =>
      `${count} ${count === 1 ? 'Bild liegt' : 'Bilder liegen'} unter 300 dpi und ${
        count === 1 ? 'kann' : 'können'
      } etwas weich drucken. Sie sind mit einem bernsteinfarbenen Punkt markiert.`,
    textProxies: count =>
      `${count} ${count === 1 ? 'Karte hat' : 'Karten haben'} kein Bild und ${
        count === 1 ? 'wird' : 'werden'
      } als Text-Proxy gedruckt.`,
    preview: paper => `${paper}-Vorschau`,
    summary: (cards, pages) => `${cards} Karten · ${pages} ${pages === 1 ? 'Seite' : 'Seiten'} · 63 × 88 mm`,
    paper: 'Papier',
    spacing: 'Abstand zwischen Karten',
    bleed: 'Beschnitt (Bleed)',
    bleedHint:
      'Verlängert das Motiv bis zu 1 mm über die Schnittlinie, damit kleine Schnittfehler keinen weißen Rand hinterlassen.',
    guides: 'Schnittmarken',
    print: 'Drucken / Als PDF speichern',
    preparing: 'Wird vorbereitet…',
    close: 'Vorschau schließen',
    instructions: paper =>
      `Wähle ${paper}, 100 % Skalierung und keine Ränder und deaktiviere Kopf- und Fußzeilen. Für ein PDF wähle „Als PDF speichern“. Fehlende Bilder werden durch den Kartennamen ersetzt.`,
    refreshing: 'Originale der gespeicherten Karten werden geladen…',
    notReady: 'Einige Bilder sind noch nicht geladen. Warte kurz und drucke erneut.',
    pageLabel: 'PLAYTEST · nicht zum Verkauf · sleeveready.com',
    page: 'Seite',
  },
  fr: {
    settings: 'Mise en page',
    printer: 'Dans la fenêtre d’impression',
    steps: (paper, orientation) => [
      `Papier ${paper}, ${orientation.toLowerCase()}`,
      'Échelle 100 %, pas « ajuster à la page »',
      'Marges : aucune',
      'En-têtes et pieds de page désactivés',
      'Pour un fichier : « Enregistrer au format PDF »',
    ],
    lowQuality: count =>
      `${count} ${count === 1 ? 'image est' : 'images sont'} sous 300 dpi et ${
        count === 1 ? 'peut' : 'peuvent'
      } sortir un peu floue${count === 1 ? '' : 's'}. Elles sont signalées par un point ambré.`,
    textProxies: count =>
      `${count} ${count === 1 ? 'carte n’a' : 'cartes n’ont'} pas d’image et ${
        count === 1 ? 's’imprime' : 's’impriment'
      } en proxy texte.`,
    preview: paper => `Aperçu ${paper}`,
    summary: (cards, pages) => `${cards} cartes · ${pages} ${pages === 1 ? 'page' : 'pages'} · 63 × 88 mm`,
    paper: 'Papier',
    spacing: 'Espace entre les cartes',
    bleed: 'Fond perdu',
    bleedHint:
      'Prolonge l’illustration jusqu’à 1 mm au-delà du trait de coupe : une petite erreur de découpe ne laisse pas de bord blanc.',
    guides: 'Repères de coupe',
    print: 'Imprimer / Enregistrer en PDF',
    preparing: 'Préparation…',
    close: 'Fermer l’aperçu',
    instructions: paper =>
      `Choisissez ${paper}, échelle 100 % et aucune marge, et désactivez les en-têtes et pieds de page. Pour un PDF, choisissez « Enregistrer au format PDF ». Les images manquantes sont remplacées par le nom de la carte.`,
    refreshing: 'Chargement des originaux des cartes enregistrées…',
    notReady: 'Certaines images ne sont pas encore prêtes. Attendez leur chargement et relancez l’impression.',
    pageLabel: 'PLAYTEST · ne peut être vendu · sleeveready.com',
    page: 'Page',
  },
  es: {
    settings: 'Diseño',
    printer: 'En el cuadro de impresión',
    steps: (paper, orientation) => [
      `Papel ${paper}, ${orientation.toLowerCase()}`,
      'Escala 100 %, no “ajustar a la página”',
      'Márgenes: ninguno',
      'Encabezados y pies de página desactivados',
      'Para un archivo: “Guardar como PDF”',
    ],
    lowQuality: count =>
      `${count} ${count === 1 ? 'imagen está' : 'imágenes están'} por debajo de 300 dpi y ${
        count === 1 ? 'puede' : 'pueden'
      } imprimirse algo suave${count === 1 ? '' : 's'}. Están marcadas con un punto ámbar.`,
    textProxies: count =>
      `${count} ${count === 1 ? 'carta no tiene' : 'cartas no tienen'} imagen y se ${
        count === 1 ? 'imprime' : 'imprimen'
      } como proxy de texto.`,
    preview: paper => `Vista previa ${paper}`,
    summary: (cards, pages) => `${cards} cartas · ${pages} ${pages === 1 ? 'página' : 'páginas'} · 63 × 88 mm`,
    paper: 'Papel',
    spacing: 'Espacio entre cartas',
    bleed: 'Sangrado',
    bleedHint:
      'Extiende la imagen hasta 1 mm más allá de la línea de corte, así un corte impreciso no deja bordes blancos.',
    guides: 'Guías de corte',
    print: 'Imprimir / Guardar PDF',
    preparing: 'Preparando…',
    close: 'Cerrar vista previa',
    instructions: paper =>
      `Elige ${paper}, escala 100 % y sin márgenes, y desactiva encabezados y pies de página. Para un PDF elige «Guardar como PDF». Las imágenes que faltan se sustituyen por el nombre de la carta.`,
    refreshing: 'Cargando los originales de las cartas guardadas…',
    notReady: 'Algunas imágenes aún no están listas. Espera a que carguen y vuelve a imprimir.',
    pageLabel: 'PLAYTEST · no destinado a la venta · sleeveready.com',
    page: 'Página',
  },
  pt: {
    settings: 'Paginação',
    printer: 'Na janela de impressão',
    steps: (paper, orientation) => [
      `Papel ${paper}, ${orientation.toLowerCase()}`,
      'Escala 100%, não “ajustar à página”',
      'Margens: nenhuma',
      'Cabeçalhos e rodapés desativados',
      'Para um ficheiro: “Guardar como PDF”',
    ],
    lowQuality: count =>
      `${count} ${count === 1 ? 'imagem está' : 'imagens estão'} abaixo de 300 dpi e ${
        count === 1 ? 'pode' : 'podem'
      } sair um pouco suave${count === 1 ? '' : 's'}. Estão marcadas com um ponto âmbar.`,
    textProxies: count =>
      `${count} ${count === 1 ? 'carta não tem' : 'cartas não têm'} imagem e ${
        count === 1 ? 'é impressa' : 'são impressas'
      } como proxy de texto.`,
    preview: paper => `Pré-visualização ${paper}`,
    summary: (cards, pages) => `${cards} cartas · ${pages} ${pages === 1 ? 'página' : 'páginas'} · 63 × 88 mm`,
    paper: 'Papel',
    spacing: 'Espaço entre cartas',
    bleed: 'Sangria',
    bleedHint:
      'Prolonga a imagem até 1 mm para lá da linha de corte, para que um corte impreciso não deixe margens brancas.',
    guides: 'Guias de corte',
    print: 'Imprimir / Guardar PDF',
    preparing: 'A preparar…',
    close: 'Fechar pré-visualização',
    instructions: paper =>
      `Escolha ${paper}, escala 100% e sem margens, e desative cabeçalhos e rodapés. Para um PDF escolha «Guardar como PDF». As imagens em falta são substituídas pelo nome da carta.`,
    refreshing: 'A carregar os originais das cartas guardadas…',
    notReady: 'Algumas imagens ainda não estão prontas. Aguarde o carregamento e imprima novamente.',
    pageLabel: 'PLAYTEST · não destinado à venda · sleeveready.com',
    page: 'Página',
  },
  nl: {
    settings: 'Opmaak',
    printer: 'In het afdrukvenster',
    steps: (paper, orientation) => [
      `Papier ${paper}, ${orientation.toLowerCase()}`,
      'Schaal 100%, niet “aanpassen aan pagina”',
      'Marges: geen',
      'Kop- en voetteksten uit',
      'Voor een bestand: “Opslaan als PDF”',
    ],
    lowQuality: count =>
      `${count} ${count === 1 ? 'afbeelding is' : 'afbeeldingen zijn'} lager dan 300 dpi en ${
        count === 1 ? 'kan' : 'kunnen'
      } iets zachter afdrukken. Ze zijn gemarkeerd met een amberkleurige stip.`,
    textProxies: count =>
      `${count} ${count === 1 ? 'kaart heeft' : 'kaarten hebben'} geen afbeelding en ${
        count === 1 ? 'wordt' : 'worden'
      } als tekstproxy afgedrukt.`,
    preview: paper => `${paper}-voorbeeld`,
    summary: (cards, pages) => `${cards} kaarten · ${pages} ${pages === 1 ? 'pagina' : 'pagina’s'} · 63 × 88 mm`,
    paper: 'Papier',
    spacing: 'Ruimte tussen kaarten',
    bleed: 'Afloop (bleed)',
    bleedHint:
      'Laat de afbeelding tot 1 mm voorbij de snijlijn doorlopen, zodat kleine snijfouten geen witte rand geven.',
    guides: 'Snijlijnen',
    print: 'Afdrukken / Opslaan als pdf',
    preparing: 'Voorbereiden…',
    close: 'Voorbeeld sluiten',
    instructions: paper =>
      `Kies ${paper}, schaal 100% en geen marges, en zet kop- en voetteksten uit. Kies voor een pdf „Opslaan als pdf”. Ontbrekende afbeeldingen worden vervangen door de kaartnaam.`,
    refreshing: 'Originelen van opgeslagen kaarten laden…',
    notReady: 'Sommige afbeeldingen zijn nog niet klaar. Wacht tot ze geladen zijn en druk opnieuw af.',
    pageLabel: 'PLAYTEST · niet voor verkoop · sleeveready.com',
    page: 'Pagina',
  },
  pl: {
    settings: 'Układ',
    printer: 'W oknie drukowania',
    steps: (paper, orientation) => [
      `Papier ${paper}, ${orientation.toLowerCase()}`,
      'Skala 100%, nie „dopasuj do strony”',
      'Marginesy: brak',
      'Nagłówki i stopki wyłączone',
      'Do pliku: „Zapisz jako PDF”',
    ],
    lowQuality: count =>
      `Obrazy poniżej 300 dpi: ${count}. Mogą wydrukować się nieco mniej ostro i są oznaczone bursztynową kropką.`,
    textProxies: count => `Karty bez obrazu: ${count}. Zostaną wydrukowane jako proxy tekstowe.`,
    preview: paper => `Podgląd ${paper}`,
    summary: (cards, pages) =>
      `${cards} ${polish(cards, 'karta', 'karty', 'kart')} · ${pages} ${
        polish(pages, 'strona', 'strony', 'stron')
      } · 63 × 88 mm`,
    paper: 'Papier',
    spacing: 'Odstęp między kartami',
    bleed: 'Spad (bleed)',
    bleedHint:
      'Przedłuża grafikę o maksymalnie 1 mm poza linię cięcia, więc drobne błędy cięcia nie zostawiają białej krawędzi.',
    guides: 'Linie cięcia',
    print: 'Drukuj / Zapisz PDF',
    preparing: 'Przygotowywanie…',
    close: 'Zamknij podgląd',
    instructions: paper =>
      `Wybierz ${paper}, skalę 100% i brak marginesów oraz wyłącz nagłówki i stopki. Aby uzyskać PDF, wybierz „Zapisz jako PDF”. Brakujące obrazy są zastępowane nazwą karty.`,
    refreshing: 'Wczytywanie oryginałów zapisanych kart…',
    notReady: 'Niektóre obrazy nie są jeszcze gotowe. Poczekaj na wczytanie i wydrukuj ponownie.',
    pageLabel: 'PLAYTEST · nie na sprzedaż · sleeveready.com',
    page: 'Strona',
  },
};
