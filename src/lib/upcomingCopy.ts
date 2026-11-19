import type { Language } from './i18n';

// Upcoming expansions with cards already revealed: the strip at the top of a game's catalogue and the tab badge.
type UpcomingCopy = {
  spoiler: string;
  title: string;
  badge: string;
  releases: (date: string) => string;
  revealed: (count: number) => string;
  open: string;
  viewing: string;
  fresh: string;
  freshReveals: (count: number) => string;
};

export const upcomingCopy: Record<Language, UpcomingCopy> = {
  en: {
    spoiler: 'Spoilers',
    title: 'Coming soon',
    badge: 'Coming',
    releases: date => `Out ${date}`,
    revealed: count => `${count} cards revealed so far`,
    open: 'See the revealed cards',
    viewing: 'Showing now',
    fresh: 'New',
    freshReveals: count => `+${count} new`,
  },
  it: {
    spoiler: 'Spoiler',
    title: 'In arrivo',
    badge: 'In arrivo',
    releases: date => `Esce il ${date}`,
    revealed: count => `${count} carte già rivelate`,
    open: 'Guarda le carte rivelate',
    viewing: 'Lo stai guardando',
    fresh: 'Nuova',
    freshReveals: count => `+${count} ${count === 1 ? 'nuova' : 'nuove'}`,
  },
  de: {
    spoiler: 'Spoiler',
    title: 'Demnächst',
    badge: 'Demnächst',
    releases: date => `Erscheint am ${date}`,
    revealed: count => `${count} Karten bereits enthüllt`,
    open: 'Enthüllte Karten ansehen',
    viewing: 'Wird angezeigt',
    fresh: 'Neu',
    freshReveals: count => `+${count} neue`,
  },
  fr: {
    spoiler: 'Spoilers',
    title: 'Bientôt disponible',
    badge: 'Bientôt',
    releases: date => `Sortie le ${date}`,
    revealed: count => `${count} cartes déjà dévoilées`,
    open: 'Voir les cartes dévoilées',
    viewing: 'Affiché',
    fresh: 'Nouvelle',
    freshReveals: count => `+${count} ${count === 1 ? 'nouvelle' : 'nouvelles'}`,
  },
  es: {
    spoiler: 'Spoilers',
    title: 'Próximamente',
    badge: 'Próximo',
    releases: date => `Sale el ${date}`,
    revealed: count => `${count} cartas ya reveladas`,
    open: 'Ver las cartas reveladas',
    viewing: 'Mostrando',
    fresh: 'Nueva',
    freshReveals: count => `+${count} ${count === 1 ? 'nueva' : 'nuevas'}`,
  },
  pt: {
    spoiler: 'Spoilers',
    title: 'Em breve',
    badge: 'Em breve',
    releases: date => `Sai a ${date}`,
    revealed: count => `${count} cartas já reveladas`,
    open: 'Ver as cartas reveladas',
    viewing: 'A mostrar',
    fresh: 'Nova',
    freshReveals: count => `+${count} ${count === 1 ? 'nova' : 'novas'}`,
  },
  nl: {
    spoiler: 'Spoilers',
    title: 'Binnenkort',
    badge: 'Binnenkort',
    releases: date => `Verschijnt op ${date}`,
    revealed: count => `${count} kaarten al onthuld`,
    open: 'Bekijk de onthulde kaarten',
    viewing: 'Wordt getoond',
    fresh: 'Nieuw',
    freshReveals: count => `+${count} nieuwe`,
  },
  pl: {
    spoiler: 'Spoilery',
    title: 'Wkrótce',
    badge: 'Wkrótce',
    releases: date => `Premiera ${date}`,
    revealed: count => `Odsłonięte karty: ${count}`,
    open: 'Zobacz odsłonięte karty',
    viewing: 'Wyświetlane',
    fresh: 'Nowy',
    freshReveals: count =>
      `+${count} ${
        count === 1
          ? 'nowa'
          : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)
          ? 'nowe'
          : 'nowych'
      }`,
  },
};
