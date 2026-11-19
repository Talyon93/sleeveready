import type { Language } from './i18n';

// Phone layout: the filters toggle beside the search and the print-sheet bar fixed at the bottom of the screen.
type MobileCopy = { filters: string; sheet: string; print: string; summary: (copies: number, pages: number) => string };

export const mobileCopy: Record<Language, MobileCopy> = {
  en: {
    filters: 'Filters',
    sheet: 'Sheet',
    print: 'Print',
    summary: (copies, pages) =>
      `${copies} ${copies === 1 ? 'copy' : 'copies'} · ${pages} ${pages === 1 ? 'page' : 'pages'}`,
  },
  it: {
    filters: 'Filtri',
    sheet: 'Foglio',
    print: 'Stampa',
    summary: (copies, pages) =>
      `${copies} ${copies === 1 ? 'copia' : 'copie'} · ${pages} ${pages === 1 ? 'pagina' : 'pagine'}`,
  },
  de: {
    filters: 'Filter',
    sheet: 'Bogen',
    print: 'Drucken',
    summary: (copies, pages) =>
      `${copies} ${copies === 1 ? 'Kopie' : 'Kopien'} · ${pages} ${pages === 1 ? 'Seite' : 'Seiten'}`,
  },
  fr: {
    filters: 'Filtres',
    sheet: 'Feuille',
    print: 'Imprimer',
    summary: (copies, pages) =>
      `${copies} ${copies === 1 ? 'copie' : 'copies'} · ${pages} ${pages === 1 ? 'page' : 'pages'}`,
  },
  es: {
    filters: 'Filtros',
    sheet: 'Hoja',
    print: 'Imprimir',
    summary: (copies, pages) =>
      `${copies} ${copies === 1 ? 'copia' : 'copias'} · ${pages} ${pages === 1 ? 'página' : 'páginas'}`,
  },
  pt: {
    filters: 'Filtros',
    sheet: 'Folha',
    print: 'Imprimir',
    summary: (copies, pages) =>
      `${copies} ${copies === 1 ? 'cópia' : 'cópias'} · ${pages} ${pages === 1 ? 'página' : 'páginas'}`,
  },
  nl: {
    filters: 'Filters',
    sheet: 'Vel',
    print: 'Afdrukken',
    summary: (copies, pages) =>
      `${copies} ${copies === 1 ? 'exemplaar' : 'exemplaren'} · ${pages} ${pages === 1 ? 'pagina' : 'pagina’s'}`,
  },
  pl: {
    filters: 'Filtry',
    sheet: 'Arkusz',
    print: 'Drukuj',
    summary: (copies, pages) => `Kopie: ${copies} · strony: ${pages}`,
  },
};
