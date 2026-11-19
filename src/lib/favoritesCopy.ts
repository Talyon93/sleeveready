import type { Language } from './i18n';

// Favourite games, for signed-in users: first in the header, and the home page opens on the first one.
type FavoritesCopy = { title: string; hint: string; saving: string; failed: string };

export const favoritesCopy: Record<Language, FavoritesCopy> = {
  en: {
    title: 'Favourite games',
    hint: 'Pick up to 5, in order: they come first in the header and the site opens on the first one.',
    saving: 'Saving…',
    failed: 'Couldn’t save your favourites. Try again.',
  },
  it: {
    title: 'Giochi preferiti',
    hint: 'Scegline fino a 5, in ordine: compaiono per primi in alto e il sito si apre sul primo.',
    saving: 'Salvataggio…',
    failed: 'Impossibile salvare i preferiti. Riprova.',
  },
  de: {
    title: 'Lieblingsspiele',
    hint: 'Wähle bis zu 5 in Reihenfolge: Sie stehen oben an erster Stelle und die Seite öffnet sich mit dem ersten.',
    saving: 'Wird gespeichert…',
    failed: 'Favoriten konnten nicht gespeichert werden. Versuche es erneut.',
  },
  fr: {
    title: 'Jeux favoris',
    hint: 'Choisissez-en jusqu’à 5, dans l’ordre : ils passent en premier en haut et le site s’ouvre sur le premier.',
    saving: 'Enregistrement…',
    failed: 'Impossible d’enregistrer vos favoris. Réessayez.',
  },
  es: {
    title: 'Juegos favoritos',
    hint: 'Elige hasta 5, en orden: aparecen primero arriba y el sitio se abre en el primero.',
    saving: 'Guardando…',
    failed: 'No se pudieron guardar tus favoritos. Inténtalo de nuevo.',
  },
  pt: {
    title: 'Jogos favoritos',
    hint: 'Escolha até 5, por ordem: aparecem primeiro no topo e o site abre no primeiro.',
    saving: 'A guardar…',
    failed: 'Não foi possível guardar os favoritos. Tente novamente.',
  },
  nl: {
    title: 'Favoriete spellen',
    hint: 'Kies er maximaal 5, op volgorde: ze staan bovenaan als eerste en de site opent op de eerste.',
    saving: 'Opslaan…',
    failed: 'Je favorieten konden niet worden opgeslagen. Probeer het opnieuw.',
  },
  pl: {
    title: 'Ulubione gry',
    hint: 'Wybierz do 5, w kolejności: pojawią się pierwsze na górze, a strona otworzy się na pierwszej.',
    saving: 'Zapisywanie…',
    failed: 'Nie udało się zapisać ulubionych. Spróbuj ponownie.',
  },
};
