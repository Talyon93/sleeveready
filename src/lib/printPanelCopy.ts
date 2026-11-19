import type { Language } from './i18n';
import type { CutMethod } from './printSettings';

// The print panel's own structure: how the cards get cut first, then the sheet, the backs and the fine-tuning.
type PanelCopy = {
  method: string;
  methods: Record<CutMethod, { label: string; hint: string }>;
  back: string;
  hash: string;
  sheet: string;
  other: string;
  cards: string;
  fineTune: string;
  browserPrint: string;
  print: string;
};

export const printPanelCopy: Record<Language, PanelCopy> = {
  en: {
    back: 'Back to the cards',
    hash: 'print',
    method: 'How will you cut the cards?',
    methods: {
      scissors: { label: 'Scissors', hint: 'An outline around every card' },
      trimmer: { label: 'Paper trimmer', hint: 'Marks at the sheet edges, cards edge to edge' },
      cricut: { label: 'Cricut', hint: 'Print Then Cut, one PNG per page' },
      silhouette: { label: 'Silhouette', hint: 'Registration marks and 1 mm bleed' },
      brother: { label: 'ScanNCut', hint: 'A 3 mm gap the scanner can see' },
    },
    sheet: 'Sheet',
    other: 'Other',
    cards: 'Cards',
    fineTune: 'Fine-tuning',
    browserPrint: 'Printing from the browser',
    print: 'Print',
  },
  it: {
    back: 'Torna alle carte',
    hash: 'stampa',
    method: 'Come taglierai le carte?',
    methods: {
      scissors: { label: 'Forbici', hint: 'Un contorno attorno a ogni carta' },
      trimmer: { label: 'Taglierina', hint: 'Segni ai bordi del foglio, carte affiancate' },
      cricut: { label: 'Cricut', hint: 'Print Then Cut, un PNG per pagina' },
      silhouette: { label: 'Silhouette', hint: 'Segni di registrazione e 1 mm di abbondanza' },
      brother: { label: 'ScanNCut', hint: '3 mm di spazio che lo scanner riconosce' },
    },
    sheet: 'Foglio',
    other: 'Altro',
    cards: 'Carte',
    fineTune: 'Regolazioni fini',
    browserPrint: 'Se stampi dal browser',
    print: 'Stampa',
  },
  de: {
    back: 'Zurück zu den Karten',
    hash: 'drucken',
    method: 'Wie schneidest du die Karten?',
    methods: {
      scissors: { label: 'Schere', hint: 'Eine Kontur um jede Karte' },
      trimmer: { label: 'Schneidemaschine', hint: 'Marken am Bogenrand, Karten bündig' },
      cricut: { label: 'Cricut', hint: 'Print Then Cut, ein PNG pro Seite' },
      silhouette: { label: 'Silhouette', hint: 'Passermarken und 1 mm Beschnitt' },
      brother: { label: 'ScanNCut', hint: '3 mm Abstand, den der Scanner erkennt' },
    },
    sheet: 'Bogen',
    other: 'Andere',
    cards: 'Karten',
    fineTune: 'Feineinstellungen',
    browserPrint: 'Drucken aus dem Browser',
    print: 'Drucken',
  },
  fr: {
    back: 'Retour aux cartes',
    hash: 'imprimer',
    method: 'Comment allez-vous découper les cartes ?',
    methods: {
      scissors: { label: 'Ciseaux', hint: 'Un contour autour de chaque carte' },
      trimmer: { label: 'Massicot', hint: 'Repères aux bords de la feuille, cartes jointives' },
      cricut: { label: 'Cricut', hint: 'Print Then Cut, un PNG par page' },
      silhouette: { label: 'Silhouette', hint: 'Repères d’alignement et 1 mm de fond perdu' },
      brother: { label: 'ScanNCut', hint: 'Un espace de 3 mm que le scanner repère' },
    },
    sheet: 'Feuille',
    other: 'Autre',
    cards: 'Cartes',
    fineTune: 'Réglages fins',
    browserPrint: 'Imprimer depuis le navigateur',
    print: 'Imprimer',
  },
  es: {
    back: 'Volver a las cartas',
    hash: 'imprimir',
    method: '¿Cómo vas a cortar las cartas?',
    methods: {
      scissors: { label: 'Tijeras', hint: 'Un contorno alrededor de cada carta' },
      trimmer: { label: 'Cizalla', hint: 'Marcas en los bordes de la hoja, cartas juntas' },
      cricut: { label: 'Cricut', hint: 'Print Then Cut, un PNG por página' },
      silhouette: { label: 'Silhouette', hint: 'Marcas de registro y 1 mm de sangrado' },
      brother: { label: 'ScanNCut', hint: '3 mm de separación que el escáner detecta' },
    },
    sheet: 'Hoja',
    other: 'Otro',
    cards: 'Cartas',
    fineTune: 'Ajustes finos',
    browserPrint: 'Si imprimes desde el navegador',
    print: 'Imprimir',
  },
  pt: {
    back: 'Voltar às cartas',
    hash: 'imprimir',
    method: 'Como vai cortar as cartas?',
    methods: {
      scissors: { label: 'Tesoura', hint: 'Um contorno à volta de cada carta' },
      trimmer: { label: 'Guilhotina', hint: 'Marcas nas margens da folha, cartas encostadas' },
      cricut: { label: 'Cricut', hint: 'Print Then Cut, um PNG por página' },
      silhouette: { label: 'Silhouette', hint: 'Marcas de registo e 1 mm de sangria' },
      brother: { label: 'ScanNCut', hint: '3 mm de espaço que o scanner deteta' },
    },
    sheet: 'Folha',
    other: 'Outro',
    cards: 'Cartas',
    fineTune: 'Ajustes finos',
    browserPrint: 'Se imprimir a partir do navegador',
    print: 'Imprimir',
  },
  nl: {
    back: 'Terug naar de kaarten',
    hash: 'printen',
    method: 'Hoe snijd je de kaarten?',
    methods: {
      scissors: { label: 'Schaar', hint: 'Een omtrek rond elke kaart' },
      trimmer: { label: 'Snijmachine', hint: 'Markeringen aan de randen, kaarten aansluitend' },
      cricut: { label: 'Cricut', hint: 'Print Then Cut, één PNG per pagina' },
      silhouette: { label: 'Silhouette', hint: 'Registratietekens en 1 mm afloop' },
      brother: { label: 'ScanNCut', hint: '3 mm ruimte die de scanner ziet' },
    },
    sheet: 'Vel',
    other: 'Anders',
    cards: 'Kaarten',
    fineTune: 'Fijnafstelling',
    browserPrint: 'Printen vanuit de browser',
    print: 'Printen',
  },
  pl: {
    back: 'Wróć do kart',
    hash: 'drukuj',
    method: 'Jak przytniesz karty?',
    methods: {
      scissors: { label: 'Nożyczki', hint: 'Obrys wokół każdej karty' },
      trimmer: { label: 'Gilotyna', hint: 'Znaczniki na brzegach arkusza, karty stykają się' },
      cricut: { label: 'Cricut', hint: 'Print Then Cut, jeden PNG na stronę' },
      silhouette: { label: 'Silhouette', hint: 'Znaczniki rejestracyjne i 1 mm spadu' },
      brother: { label: 'ScanNCut', hint: '3 mm odstępu widocznego dla skanera' },
    },
    sheet: 'Arkusz',
    other: 'Inny',
    cards: 'Karty',
    fineTune: 'Ustawienia szczegółowe',
    browserPrint: 'Drukowanie z przeglądarki',
    print: 'Drukuj',
  },
};
// The print page is the app's own view at #print (#stampa…): any language's word opens it.
export const printHashes = new Set(Object.values(printPanelCopy).map(copy => copy.hash));
