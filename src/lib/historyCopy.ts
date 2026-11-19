import type { Language } from './i18n';

// Undo / redo on the print sheet, and the import options added with them (tokens, a language per line).
type HistoryCopy = { undo: string; redo: string; tokens: string; tokensHint: string; lineLanguage: string };
export const historyCopy: Record<Language, HistoryCopy> = {
  en: {
    undo: 'Undo',
    redo: 'Redo',
    tokens: 'Add the tokens these cards make',
    tokensHint: 'One of each token, from Scryfall.',
    lineLanguage: 'Add lang:fr (or de, it, ja…) at the end of a line to print that card in another language.',
  },
  it: {
    undo: 'Annulla',
    redo: 'Ripeti',
    tokens: 'Aggiungi le pedine che creano queste carte',
    tokensHint: 'Una per tipo, da Scryfall.',
    lineLanguage: 'Aggiungi lang:fr (o de, it, ja…) in fondo a una riga per stampare quella carta in un’altra lingua.',
  },
  de: {
    undo: 'Rückgängig',
    redo: 'Wiederholen',
    tokens: 'Spielsteine dieser Karten hinzufügen',
    tokensHint: 'Je einer pro Art, von Scryfall.',
    lineLanguage: 'Hänge lang:fr (oder de, it, ja…) an eine Zeile, um diese Karte in einer anderen Sprache zu drucken.',
  },
  fr: {
    undo: 'Annuler',
    redo: 'Rétablir',
    tokens: 'Ajouter les jetons créés par ces cartes',
    tokensHint: 'Un de chaque, depuis Scryfall.',
    lineLanguage: 'Ajoutez lang:fr (ou de, it, ja…) en fin de ligne pour imprimer cette carte dans une autre langue.',
  },
  es: {
    undo: 'Deshacer',
    redo: 'Rehacer',
    tokens: 'Añadir las fichas que crean estas cartas',
    tokensHint: 'Una de cada, desde Scryfall.',
    lineLanguage: 'Añade lang:fr (o de, it, ja…) al final de una línea para imprimir esa carta en otro idioma.',
  },
  pt: {
    undo: 'Desfazer',
    redo: 'Refazer',
    tokens: 'Adicionar as fichas que estas cartas criam',
    tokensHint: 'Uma de cada, do Scryfall.',
    lineLanguage: 'Acrescente lang:fr (ou de, it, ja…) no fim de uma linha para imprimir essa carta noutro idioma.',
  },
  nl: {
    undo: 'Ongedaan maken',
    redo: 'Opnieuw',
    tokens: 'Tokens toevoegen die deze kaarten maken',
    tokensHint: 'Eén van elk, van Scryfall.',
    lineLanguage: 'Zet lang:fr (of de, it, ja…) achter een regel om die kaart in een andere taal te printen.',
  },
  pl: {
    undo: 'Cofnij',
    redo: 'Ponów',
    tokens: 'Dodaj żetony tworzone przez te karty',
    tokensHint: 'Po jednym z każdego, ze Scryfall.',
    lineLanguage: 'Dodaj lang:fr (lub de, it, ja…) na końcu wiersza, aby wydrukować tę kartę w innym języku.',
  },
};
