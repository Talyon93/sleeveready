import type { Language } from './i18n';

// Sharing a print sheet as a link, and opening a shared one (components/SharedArrival.tsx).
type ShareCopy = {
  share: string;
  done: string;
  failed: string;
  loaded: (copies: number) => string;
  missing: (lines: number) => string;
  kicker: (game: string) => string;
  title: (copies: number) => string;
  lead: string;
  print: string;
  printOnly: string;
  add: string;
  sheetStarted: (copies: number) => string;
  close: string;
};

export const shareCopy: Record<Language, ShareCopy> = {
  en: {
    share: 'Share list',
    done: 'Link copied',
    failed: 'The link could not be copied.',
    loaded: copies => `Shared list added: ${copies} copies.`,
    missing: lines => `${lines} ${lines === 1 ? 'card is' : 'cards are'} no longer available.`,
    kicker: game => game ? `Shared list · ${game}` : 'Shared list',
    title: copies => `Someone sent you ${copies} ${copies === 1 ? 'card' : 'cards'}`,
    lead: 'SleeveReady prints playtest proxies sized for sleeves, on A4 or Letter paper. Free, no account needed.',
    print: 'Print these cards',
    printOnly: 'Print only these',
    add: 'Add to my sheet',
    sheetStarted: copies =>
      `Your sheet already has ${copies} ${
        copies === 1 ? 'copy' : 'copies'
      }. “Print only these” replaces it; Undo brings it back.`,
    close: 'Close',
  },
  it: {
    share: 'Condividi lista',
    done: 'Link copiato',
    failed: 'Non è stato possibile copiare il link.',
    loaded: copies => `Lista condivisa aggiunta: ${copies} copie.`,
    missing: lines => `${lines} ${lines === 1 ? 'carta non è più disponibile' : 'carte non sono più disponibili'}.`,
    kicker: game => game ? `Lista condivisa · ${game}` : 'Lista condivisa',
    title: copies => `Ti hanno mandato ${copies === 1 ? 'una carta' : copies + ' carte'}`,
    lead: 'SleeveReady stampa proxy da playtest a misura di bustina, su fogli A4 o Letter. Gratis, senza account.',
    print: 'Stampa queste carte',
    printOnly: 'Stampa solo queste',
    add: 'Aggiungi al mio foglio',
    sheetStarted: copies =>
      `Nel tuo foglio ci sono già ${
        copies === 1 ? 'una copia' : copies + ' copie'
      }. «Stampa solo queste» lo sostituisce: con Annulla lo ritrovi com’era.`,
    close: 'Chiudi',
  },
  de: {
    share: 'Liste teilen',
    done: 'Link kopiert',
    failed: 'Der Link konnte nicht kopiert werden.',
    loaded: copies => `Geteilte Liste hinzugefügt: ${copies} Kopien.`,
    missing: lines => `${lines} ${lines === 1 ? 'Karte ist' : 'Karten sind'} nicht mehr verfügbar.`,
    kicker: game => game ? `Geteilte Liste · ${game}` : 'Geteilte Liste',
    title: copies => `Dir wurden ${copies} ${copies === 1 ? 'Karte' : 'Karten'} geschickt`,
    lead: 'SleeveReady druckt Playtest-Proxys in Hüllengröße auf A4- oder Letter-Papier. Kostenlos, ohne Konto.',
    print: 'Diese Karten drucken',
    printOnly: 'Nur diese drucken',
    add: 'Zu meinem Bogen hinzufügen',
    sheetStarted: copies =>
      `Dein Bogen hat schon ${copies} ${
        copies === 1 ? 'Kopie' : 'Kopien'
      }. „Nur diese drucken“ ersetzt ihn; mit Rückgängig ist er wieder da.`,
    close: 'Schließen',
  },
  fr: {
    share: 'Partager la liste',
    done: 'Lien copié',
    failed: 'Impossible de copier le lien.',
    loaded: copies => `Liste partagée ajoutée : ${copies} copies.`,
    missing: lines => `${lines} ${lines === 1 ? 'carte n’est plus disponible' : 'cartes ne sont plus disponibles'}.`,
    kicker: game => game ? `Liste partagée · ${game}` : 'Liste partagée',
    title: copies => `On vous a envoyé ${copies} ${copies === 1 ? 'carte' : 'cartes'}`,
    lead:
      'SleeveReady imprime des proxys de playtest à la taille des pochettes, sur papier A4 ou Letter. Gratuit, sans compte.',
    print: 'Imprimer ces cartes',
    printOnly: 'Imprimer seulement celles-ci',
    add: 'Ajouter à ma feuille',
    sheetStarted: copies =>
      `Votre feuille contient déjà ${copies} ${
        copies === 1 ? 'copie' : 'copies'
      }. « Imprimer seulement celles-ci » la remplace ; Annuler la rétablit.`,
    close: 'Fermer',
  },
  es: {
    share: 'Compartir lista',
    done: 'Enlace copiado',
    failed: 'No se pudo copiar el enlace.',
    loaded: copies => `Lista compartida añadida: ${copies} copias.`,
    missing: lines => `${lines} ${lines === 1 ? 'carta ya no está disponible' : 'cartas ya no están disponibles'}.`,
    kicker: game => game ? `Lista compartida · ${game}` : 'Lista compartida',
    title: copies => `Te han enviado ${copies} ${copies === 1 ? 'carta' : 'cartas'}`,
    lead:
      'SleeveReady imprime proxies de playtest a la medida de las fundas, en papel A4 o Letter. Gratis, sin cuenta.',
    print: 'Imprimir estas cartas',
    printOnly: 'Imprimir solo estas',
    add: 'Añadir a mi hoja',
    sheetStarted: copies =>
      `Tu hoja ya tiene ${copies} ${
        copies === 1 ? 'copia' : 'copias'
      }. «Imprimir solo estas» la sustituye; con Deshacer vuelve como estaba.`,
    close: 'Cerrar',
  },
  pt: {
    share: 'Partilhar lista',
    done: 'Link copiado',
    failed: 'Não foi possível copiar o link.',
    loaded: copies => `Lista partilhada adicionada: ${copies} cópias.`,
    missing: lines => `${lines} ${lines === 1 ? 'carta já não está disponível' : 'cartas já não estão disponíveis'}.`,
    kicker: game => game ? `Lista partilhada · ${game}` : 'Lista partilhada',
    title: copies => `Enviaram-lhe ${copies} ${copies === 1 ? 'carta' : 'cartas'}`,
    lead: 'O SleeveReady imprime proxies de playtest à medida das capas, em papel A4 ou Letter. Grátis, sem conta.',
    print: 'Imprimir estas cartas',
    printOnly: 'Imprimir só estas',
    add: 'Adicionar à minha folha',
    sheetStarted: copies =>
      `A sua folha já tem ${copies} ${
        copies === 1 ? 'cópia' : 'cópias'
      }. «Imprimir só estas» substitui-a; Desfazer repõe-na.`,
    close: 'Fechar',
  },
  nl: {
    share: 'Lijst delen',
    done: 'Link gekopieerd',
    failed: 'De link kon niet worden gekopieerd.',
    loaded: copies => `Gedeelde lijst toegevoegd: ${copies} exemplaren.`,
    missing: lines => `${lines} ${lines === 1 ? 'kaart is' : 'kaarten zijn'} niet meer beschikbaar.`,
    kicker: game => game ? `Gedeelde lijst · ${game}` : 'Gedeelde lijst',
    title: copies => `Iemand stuurde je ${copies} ${copies === 1 ? 'kaart' : 'kaarten'}`,
    lead: 'SleeveReady drukt playtest-proxy’s op hoesmaat af, op A4- of Letter-papier. Gratis, zonder account.',
    print: 'Deze kaarten afdrukken',
    printOnly: 'Alleen deze afdrukken',
    add: 'Aan mijn vel toevoegen',
    sheetStarted: copies =>
      `Je vel heeft al ${copies} ${
        copies === 1 ? 'exemplaar' : 'exemplaren'
      }. ‘Alleen deze afdrukken’ vervangt het; met Ongedaan maken is het terug.`,
    close: 'Sluiten',
  },
  pl: {
    share: 'Udostępnij listę',
    done: 'Link skopiowany',
    failed: 'Nie udało się skopiować linku.',
    loaded: copies => `Dodano udostępnioną listę, kopie: ${copies}.`,
    missing: lines => `Karty niedostępne: ${lines}.`,
    kicker: game => game ? `Udostępniona lista · ${game}` : 'Udostępniona lista',
    title: copies => `Ktoś wysłał ci karty: ${copies}`,
    lead: 'SleeveReady drukuje proxy do testów w rozmiarze koszulek, na papierze A4 lub Letter. Za darmo, bez konta.',
    print: 'Drukuj te karty',
    printOnly: 'Drukuj tylko te',
    add: 'Dodaj do mojego arkusza',
    sheetStarted: copies => `Twój arkusz ma już kopie: ${copies}. „Drukuj tylko te” go zastąpi, a Cofnij go przywróci.`,
    close: 'Zamknij',
  },
};
