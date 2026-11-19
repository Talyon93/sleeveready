import type { Language } from './i18n';

type ImportCopy = {
  open: string;
  title: (game: string) => string;
  intro: (tools: string | null) => string;
  submit: string;
  searching: string;
  searchingOlder: string;
  added: (cards: number, copies: number) => string;
  notFound: (lines: number) => string;
  nothing: string;
  close: string;
  languageNote: (language: string) => string;
  link: string;
};
const examples = '4 Card name\n4 Card name (SET) 123';
// Deck builders whose export the importer reads as is, named in the dialog for the games that have well-known ones.
export function importTools(gameName: string)
{
  if (/magic/i.test(gameName)) return 'Moxfield, Archidekt, MTG Arena';
  if (/pok[eé]mon/i.test(gameName)) return 'Pokémon TCG Live, Limitless';
  if (/yu-?gi-?oh/i.test(gameName)) return 'YGOPRODeck, .ydk';
  return null;
}
// Placeholder lines in the format each game's usual deck builders export.
export function importExamples(gameName: string)
{
  if (/magic/i.test(gameName)) return '4 Lightning Bolt\n4 Lightning Bolt (M11) 149\n1 Sol Ring (CMM) 400';
  if (/pok[eé]mon/i.test(gameName)) return '3 Charizard ex OBF 125\n4 Iono PAL 185\n4 Rare Candy';
  if (/one\s*piece/i.test(gameName)) return '1xOP13-001\n4xOP01-016\n4 Nami';
  if (/lorcana/i.test(gameName)) return '4 Elsa - Snow Queen\n2 Mickey Mouse - Brave Little Tailor';
  if (/star\s*wars/i.test(gameName))
  {
    return '1 | Darth Vader | Dark Lord of the Sith\n3 | Luke Skywalker | Faithful Friend';
  }
  if (/flesh/i.test(gameName)) return '(3) Command and Conquer (red)\n(1) Nuu, Alluring Desire';
  if (/digimon/i.test(gameName)) return '4 BT1-010\n4 Agumon';
  if (/dragon\s*ball/i.test(gameName)) return '1 FB01-001\n4 FB01-010';
  if (/gundam/i.test(gameName)) return '4 GD01-001\n4 ST01-001';
  if (/sorcery/i.test(gameName)) return '2 Highland Princess\n1 Rimland Nomads';
  if (/cyberpunk/i.test(gameName)) return '1 Adam Smasher: Metal Over Meat\n3 Sandevistan';
  if (/riftbound/i.test(gameName)) return '3 Jinx, Demolitionist';
  if (/union\s*arena/i.test(gameName)) return '4 UE03BT/JJK-1-009\n4 Satoru Gojo';
  if (/vanguard/i.test(gameName)) return '4 DZ-BT01/001EN\n4 Dragonic Overlord';
  if (/yu-?gi-?oh/i.test(gameName)) return '3 Ash Blossom & Joyous Spring\n1 RA01-EN066';
  return examples;
}

export const importCopy: Record<Language, ImportCopy> = {
  en: {
    open: 'Import list',
    title: game => `Import a ${game} list`,
    intro: tools =>
      `Paste one card per line, as your deck builder exports it${
        tools ? ` (${tools} work as they are)` : ''
      }. Set codes and card numbers pick the exact printing.`,
    submit: 'Add to print sheet',
    searching: 'Searching the catalogue…',
    searchingOlder: 'Still searching older expansions…',
    added: (cards, copies) => `Added ${copies} copies of ${cards} ${cards === 1 ? 'card' : 'cards'}.`,
    notFound: lines => `${lines} ${lines === 1 ? 'line' : 'lines'} not found:`,
    nothing: 'No cards were recognised. Check the list and try again.',
    close: 'Close import',
    languageNote: language => `Cards are imported in ${language} where that printing exists, otherwise in English.`,
    link: 'You can also paste a public Archidekt deck link.',
  },
  it: {
    open: 'Importa lista',
    title: game => `Importa una lista ${game}`,
    intro: tools =>
      `Incolla una carta per riga, come la esporta il tuo deck builder${
        tools ? ` (${tools} vanno bene così come sono)` : ''
      }. Codice set e numero scelgono la stampa esatta.`,
    submit: 'Aggiungi al foglio',
    searching: 'Ricerca nel catalogo…',
    searchingOlder: 'Sto cercando nelle espansioni più vecchie…',
    added: (cards, copies) => `Aggiunte ${copies} copie di ${cards} ${cards === 1 ? 'carta' : 'carte'}.`,
    notFound: lines => `${lines} ${lines === 1 ? 'riga non trovata' : 'righe non trovate'}:`,
    nothing: 'Nessuna carta riconosciuta. Controlla la lista e riprova.',
    close: 'Chiudi importazione',
    languageNote: language =>
      `Le carte vengono importate in ${language} quando la stampa esiste, altrimenti in inglese.`,
    link: 'Puoi anche incollare il link di un mazzo pubblico Archidekt.',
  },
  de: {
    open: 'Liste importieren',
    title: game => `${game}-Liste importieren`,
    intro: tools =>
      `Füge eine Karte pro Zeile ein, so wie dein Deckbuilder sie exportiert${
        tools ? ` (${tools} funktionieren direkt)` : ''
      }. Set-Code und Kartennummer wählen den genauen Druck.`,
    submit: 'Zum Druckbogen hinzufügen',
    searching: 'Katalog wird durchsucht…',
    searchingOlder: 'Ältere Erweiterungen werden durchsucht…',
    added: (cards, copies) => `${copies} Exemplare von ${cards} ${cards === 1 ? 'Karte' : 'Karten'} hinzugefügt.`,
    notFound: lines => `${lines} ${lines === 1 ? 'Zeile' : 'Zeilen'} nicht gefunden:`,
    nothing: 'Keine Karten erkannt. Prüfe die Liste und versuche es erneut.',
    close: 'Import schließen',
    languageNote: language =>
      `Karten werden auf ${language} importiert, wenn es diesen Druck gibt, sonst auf Englisch.`,
    link: 'Du kannst auch den Link zu einem öffentlichen Archidekt-Deck einfügen.',
  },
  fr: {
    open: 'Importer une liste',
    title: game => `Importer une liste ${game}`,
    intro: tools =>
      `Collez une carte par ligne, comme l’exporte votre deck builder${
        tools ? ` (${tools} fonctionnent tels quels)` : ''
      }. Le code d’extension et le numéro choisissent l’impression exacte.`,
    submit: 'Ajouter à la feuille',
    searching: 'Recherche dans le catalogue…',
    searchingOlder: 'Recherche dans les extensions plus anciennes…',
    added: (cards, copies) => `${copies} exemplaires de ${cards} ${cards === 1 ? 'carte ajoutés' : 'cartes ajoutés'}.`,
    notFound: lines => `${lines} ${lines === 1 ? 'ligne introuvable' : 'lignes introuvables'} :`,
    nothing: 'Aucune carte reconnue. Vérifiez la liste et réessayez.',
    close: 'Fermer l’import',
    languageNote: language =>
      `Les cartes sont importées en ${language} lorsque cette impression existe, sinon en anglais.`,
    link: 'Vous pouvez aussi coller le lien d’un deck public Archidekt.',
  },
  es: {
    open: 'Importar lista',
    title: game => `Importar una lista de ${game}`,
    intro: tools =>
      `Pega una carta por línea, tal como la exporta tu deck builder${
        tools ? ` (${tools} funcionan tal cual)` : ''
      }. El código de expansión y el número eligen la impresión exacta.`,
    submit: 'Añadir a la hoja',
    searching: 'Buscando en el catálogo…',
    searchingOlder: 'Buscando en expansiones más antiguas…',
    added: (cards, copies) => `Añadidas ${copies} copias de ${cards} ${cards === 1 ? 'carta' : 'cartas'}.`,
    notFound: lines => `${lines} ${lines === 1 ? 'línea no encontrada' : 'líneas no encontradas'}:`,
    nothing: 'No se reconoció ninguna carta. Revisa la lista e inténtalo de nuevo.',
    close: 'Cerrar importación',
    languageNote: language => `Las cartas se importan en ${language} cuando existe esa impresión; si no, en inglés.`,
    link: 'También puedes pegar el enlace de un mazo público de Archidekt.',
  },
  pt: {
    open: 'Importar lista',
    title: game => `Importar uma lista de ${game}`,
    intro: tools =>
      `Cole uma carta por linha, tal como o seu deck builder a exporta${
        tools ? ` (${tools} funcionam tal como estão)` : ''
      }. O código da expansão e o número escolhem a impressão exata.`,
    submit: 'Adicionar à folha',
    searching: 'A procurar no catálogo…',
    searchingOlder: 'A procurar em expansões mais antigas…',
    added: (cards, copies) => `Adicionadas ${copies} cópias de ${cards} ${cards === 1 ? 'carta' : 'cartas'}.`,
    notFound: lines => `${lines} ${lines === 1 ? 'linha não encontrada' : 'linhas não encontradas'}:`,
    nothing: 'Nenhuma carta reconhecida. Verifique a lista e tente novamente.',
    close: 'Fechar importação',
    languageNote: language =>
      `As cartas são importadas em ${language} quando essa impressão existe; caso contrário, em inglês.`,
    link: 'Também pode colar o link de um deck público do Archidekt.',
  },
  nl: {
    open: 'Lijst importeren',
    title: game => `${game}-lijst importeren`,
    intro: tools =>
      `Plak één kaart per regel, zoals je deckbuilder die exporteert${
        tools ? ` (${tools} werken zoals ze zijn)` : ''
      }. Setcode en kaartnummer kiezen de exacte druk.`,
    submit: 'Toevoegen aan afdrukvel',
    searching: 'Catalogus doorzoeken…',
    searchingOlder: 'Oudere uitbreidingen doorzoeken…',
    added: (cards, copies) => `${copies} exemplaren van ${cards} ${cards === 1 ? 'kaart' : 'kaarten'} toegevoegd.`,
    notFound: lines => `${lines} ${lines === 1 ? 'regel' : 'regels'} niet gevonden:`,
    nothing: 'Geen kaarten herkend. Controleer de lijst en probeer het opnieuw.',
    close: 'Import sluiten',
    languageNote: language =>
      `Kaarten worden in het ${language} geïmporteerd als die druk bestaat, anders in het Engels.`,
    link: 'Je kunt ook de link van een openbaar Archidekt-deck plakken.',
  },
  pl: {
    open: 'Importuj listę',
    title: game => `Importuj listę ${game}`,
    intro: tools =>
      `Wklej jedną kartę w wierszu, tak jak eksportuje ją twój deck builder${
        tools ? ` (${tools} działają bez zmian)` : ''
      }. Kod dodatku i numer karty wybierają dokładny druk.`,
    submit: 'Dodaj do arkusza',
    searching: 'Przeszukiwanie katalogu…',
    searchingOlder: 'Przeszukiwanie starszych dodatków…',
    added: (cards, copies) => `Dodano ${copies} egz. ${cards} kart.`,
    notFound: lines => `Nie znaleziono wierszy: ${lines}.`,
    nothing: 'Nie rozpoznano żadnej karty. Sprawdź listę i spróbuj ponownie.',
    close: 'Zamknij import',
    languageNote: language =>
      `Karty są importowane w języku: ${language}, gdy taki druk istnieje, w przeciwnym razie po angielsku.`,
    link: 'Możesz też wkleić link do publicznej talii z Archidekt.',
  },
};
