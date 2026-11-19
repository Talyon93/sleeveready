import type { Language } from './i18n';

// "Your prints": the history of printed sheets, and the line under the download after a print.
type PrintHistoryCopy = {
  title: string;
  onDevice: string;
  empty: string;
  reprint: string;
  remove: string;
  more: (count: number) => string;
  copies: (count: number) => string;
  methods: Record<'browser' | 'pdf' | 'png', string>;
  saved: string;
  keep: string;
  keepAction: string;
  dismiss: string;
};

export const printHistoryCopy: Record<Language, PrintHistoryCopy> = {
  en: {
    title: 'Your prints',
    onDevice: 'Kept on this device. Sign in to find them on your phone and other computers too.',
    empty: 'Nothing printed yet. Every sheet you print or download shows up here.',
    reprint: 'Print again',
    remove: 'Remove',
    more: n => `All ${n} prints`,
    copies: n => n === 1 ? '1 card' : `${n} cards`,
    methods: { browser: 'Printed', pdf: 'PDF', png: 'PNG' },
    saved: 'Saved to your prints.',
    keep: 'Sign in to find it on your phone and other computers too.',
    keepAction: 'Sign in',
    dismiss: 'Not now',
  },
  it: {
    title: 'Le tue stampe',
    onDevice: 'Salvate su questo dispositivo. Accedi per ritrovarle anche su telefono e altri PC.',
    empty: 'Ancora nessuna stampa. Ogni foglio che stampi o scarichi compare qui.',
    reprint: 'Ristampa',
    remove: 'Rimuovi',
    more: n => `Tutte le ${n} stampe`,
    copies: n => n === 1 ? '1 carta' : `${n} carte`,
    methods: { browser: 'Stampata', pdf: 'PDF', png: 'PNG' },
    saved: 'Salvata nelle tue stampe.',
    keep: 'Accedi per ritrovarla anche su telefono e altri PC.',
    keepAction: 'Accedi',
    dismiss: 'Non ora',
  },
  de: {
    title: 'Deine Drucke',
    onDevice: 'Auf diesem Gerät gespeichert. Melde dich an, um sie auch auf Handy und anderen Computern zu finden.',
    empty: 'Noch nichts gedruckt. Jeder Bogen, den du druckst oder herunterlädst, erscheint hier.',
    reprint: 'Erneut drucken',
    remove: 'Entfernen',
    more: n => `Alle ${n} Drucke`,
    copies: n => n === 1 ? '1 Karte' : `${n} Karten`,
    methods: { browser: 'Gedruckt', pdf: 'PDF', png: 'PNG' },
    saved: 'In deinen Drucken gespeichert.',
    keep: 'Melde dich an, um ihn auch auf Handy und anderen Computern zu finden.',
    keepAction: 'Anmelden',
    dismiss: 'Nicht jetzt',
  },
  fr: {
    title: 'Vos impressions',
    onDevice:
      'Gardées sur cet appareil. Connectez-vous pour les retrouver aussi sur votre téléphone et vos autres ordinateurs.',
    empty: 'Rien d’imprimé pour l’instant. Chaque feuille imprimée ou téléchargée apparaît ici.',
    reprint: 'Réimprimer',
    remove: 'Retirer',
    more: n => `Les ${n} impressions`,
    copies: n => n === 1 ? '1 carte' : `${n} cartes`,
    methods: { browser: 'Imprimée', pdf: 'PDF', png: 'PNG' },
    saved: 'Enregistrée dans vos impressions.',
    keep: 'Connectez-vous pour la retrouver aussi sur votre téléphone et vos autres ordinateurs.',
    keepAction: 'Se connecter',
    dismiss: 'Plus tard',
  },
  es: {
    title: 'Tus impresiones',
    onDevice: 'Guardadas en este dispositivo. Inicia sesión para encontrarlas también en el móvil y otros ordenadores.',
    empty: 'Aún no has impreso nada. Cada hoja que imprimas o descargues aparece aquí.',
    reprint: 'Reimprimir',
    remove: 'Quitar',
    more: n => `Las ${n} impresiones`,
    copies: n => n === 1 ? '1 carta' : `${n} cartas`,
    methods: { browser: 'Impresa', pdf: 'PDF', png: 'PNG' },
    saved: 'Guardada en tus impresiones.',
    keep: 'Inicia sesión para encontrarla también en el móvil y otros ordenadores.',
    keepAction: 'Iniciar sesión',
    dismiss: 'Ahora no',
  },
  pt: {
    title: 'As suas impressões',
    onDevice:
      'Guardadas neste dispositivo. Inicie sessão para as encontrar também no telemóvel e noutros computadores.',
    empty: 'Ainda nada impresso. Cada folha que imprimir ou descarregar aparece aqui.',
    reprint: 'Reimprimir',
    remove: 'Remover',
    more: n => `As ${n} impressões`,
    copies: n => n === 1 ? '1 carta' : `${n} cartas`,
    methods: { browser: 'Impressa', pdf: 'PDF', png: 'PNG' },
    saved: 'Guardada nas suas impressões.',
    keep: 'Inicie sessão para a encontrar também no telemóvel e noutros computadores.',
    keepAction: 'Iniciar sessão',
    dismiss: 'Agora não',
  },
  nl: {
    title: 'Je prints',
    onDevice: 'Bewaard op dit apparaat. Log in om ze ook op je telefoon en andere computers te vinden.',
    empty: 'Nog niets geprint. Elk vel dat je print of downloadt, verschijnt hier.',
    reprint: 'Opnieuw printen',
    remove: 'Verwijderen',
    more: n => `Alle ${n} prints`,
    copies: n => n === 1 ? '1 kaart' : `${n} kaarten`,
    methods: { browser: 'Geprint', pdf: 'PDF', png: 'PNG' },
    saved: 'Bewaard bij je prints.',
    keep: 'Log in om hem ook op je telefoon en andere computers te vinden.',
    keepAction: 'Inloggen',
    dismiss: 'Niet nu',
  },
  pl: {
    title: 'Twoje wydruki',
    onDevice: 'Zapisane na tym urządzeniu. Zaloguj się, aby mieć je też na telefonie i innych komputerach.',
    empty: 'Nic jeszcze nie wydrukowano. Każdy wydrukowany lub pobrany arkusz pojawi się tutaj.',
    reprint: 'Drukuj ponownie',
    remove: 'Usuń',
    more: n => `Wszystkie wydruki (${n})`,
    copies: n => n === 1 ? '1 karta' : `${n} kart`,
    methods: { browser: 'Wydrukowano', pdf: 'PDF', png: 'PNG' },
    saved: 'Zapisano w Twoich wydrukach.',
    keep: 'Zaloguj się, aby mieć go też na telefonie i innych komputerach.',
    keepAction: 'Zaloguj się',
    dismiss: 'Nie teraz',
  },
};
