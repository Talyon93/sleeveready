// Legal links and the affiliate notice shown in every footer (app, card and illustrator pages).
// Privacy notice and terms exist in English and Italian; the other languages link to the English text.
export type LegalLanguage = 'en' | 'it' | 'de' | 'fr' | 'es' | 'pt' | 'nl' | 'pl';
export type LegalPage = 'privacy' | 'terms';
export const legalLanguages = ['en', 'it'] as const;
export type LegalTextLanguage = typeof legalLanguages[number];

export const legalTextLanguage = (language: string): LegalTextLanguage => language === 'it' ? 'it' : 'en';
export const legalHref = (page: LegalPage, language: string) =>
  legalTextLanguage(language) === 'it' ? `/${page}/it` : `/${page}`;

// Amazon Associates asks for its statement wherever affiliate links appear; the wording follows each Amazon store.
// The site is a fan project: every footer says so in one line, as publishers' fan content policies ask (Ravensburger's,
// for Lorcana); the terms (server/legal-pages.ts) name the publishers.
export const legalCopy: Record<
  LegalLanguage,
  { privacy: string; terms: string; affiliate: string; accountNote: string; unofficial: string }
> = {
  en: {
    accountNote: 'Accounts are for people aged 14 or over.',
    privacy: 'Privacy',
    terms: 'Terms',
    affiliate:
      'Some shop links are affiliate links. As an Amazon Associate, SleeveReady earns from qualifying purchases, at no extra cost to you.',
    unofficial:
      'Unofficial fan site, not affiliated with or endorsed by the card games’ publishers. Artwork and trademarks belong to their owners. For personal playtesting.',
  },
  it: {
    accountNote: 'Gli account sono riservati a chi ha almeno 14 anni.',
    privacy: 'Privacy',
    terms: 'Termini',
    affiliate:
      'Alcuni link ai negozi sono affiliati. In qualità di Affiliato Amazon, SleeveReady riceve un guadagno dagli acquisti idonei, senza costi aggiuntivi per te.',
    unofficial:
      'Sito non ufficiale di appassionati, non affiliato né approvato dagli editori dei giochi di carte. Illustrazioni e marchi appartengono ai rispettivi titolari. Per il playtest personale.',
  },
  de: {
    accountNote: 'Konten sind für Personen ab 14 Jahren.',
    privacy: 'Datenschutz',
    terms: 'Nutzungsbedingungen',
    affiliate:
      'Einige Shop-Links sind Affiliate-Links. Als Amazon-Partner verdient SleeveReady an qualifizierten Verkäufen, ohne Mehrkosten für dich.',
    unofficial:
      'Inoffizielle Fanseite, nicht mit den Verlagen der Kartenspiele verbunden oder von ihnen unterstützt. Artwork und Marken gehören ihren Inhabern. Für persönliche Testspiele.',
  },
  fr: {
    accountNote: 'Les comptes sont réservés aux personnes de 14 ans ou plus.',
    privacy: 'Confidentialité',
    terms: 'Conditions',
    affiliate:
      'Certains liens vers des boutiques sont affiliés. En tant que Partenaire Amazon, SleeveReady réalise un bénéfice sur les achats remplissant les conditions requises, sans surcoût pour vous.',
    unofficial:
      'Site de fans non officiel, ni affilié ni approuvé par les éditeurs des jeux de cartes. Illustrations et marques appartiennent à leurs titulaires. Pour vos tests personnels.',
  },
  es: {
    accountNote: 'Las cuentas son para mayores de 14 años.',
    privacy: 'Privacidad',
    terms: 'Términos',
    affiliate:
      'Algunos enlaces a tiendas son de afiliado. Como Afiliado de Amazon, SleeveReady obtiene ingresos por las compras adscritas que cumplen los requisitos aplicables, sin coste adicional para ti.',
    unofficial:
      'Sitio no oficial de aficionados, sin afiliación ni respaldo de los editores de los juegos de cartas. Ilustraciones y marcas pertenecen a sus titulares. Para pruebas personales.',
  },
  pt: {
    accountNote: 'As contas destinam-se a pessoas com 14 anos ou mais.',
    privacy: 'Privacidade',
    terms: 'Termos',
    affiliate:
      'Alguns links para lojas são de afiliado. Como Associado da Amazon, o SleeveReady ganha com compras qualificadas, sem custo adicional para si.',
    unofficial:
      'Site não oficial de fãs, sem afiliação nem aprovação das editoras dos jogos de cartas. Ilustrações e marcas pertencem aos respetivos titulares. Para testes pessoais.',
  },
  nl: {
    accountNote: 'Accounts zijn voor personen van 14 jaar of ouder.',
    privacy: 'Privacy',
    terms: 'Voorwaarden',
    affiliate:
      'Sommige winkellinks zijn affiliatelinks. Als Amazon-partner verdient SleeveReady aan kwalificerende aankopen, zonder extra kosten voor jou.',
    unofficial:
      'Onofficiële fansite, niet verbonden aan of goedgekeurd door de uitgevers van de kaartspellen. Artwork en merken zijn van hun eigenaren. Voor persoonlijke testpotjes.',
  },
  pl: {
    accountNote: 'Konta są dla osób, które ukończyły 14 lat.',
    privacy: 'Prywatność',
    terms: 'Warunki',
    affiliate:
      'Niektóre linki do sklepów są partnerskie. Jako partner Amazon SleeveReady zarabia na kwalifikujących się zakupach, bez dodatkowych kosztów dla Ciebie.',
    unofficial:
      'Nieoficjalna strona fanów, niepowiązana z wydawcami gier karcianych i przez nich niezatwierdzona. Grafiki i znaki towarowe należą do ich właścicieli. Do prywatnych testów.',
  },
};
const copyFor = (language: string) => legalCopy[(language in legalCopy ? language : 'en') as LegalLanguage];

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]!),
  );
// The same footer as the app's, for pages rendered on the server.
export function legalFooterHtml(language: string)
{
  const copy = copyFor(language);
  return `<footer><span>SleeveReady</span><span>${escapeHtml(copy.unofficial)}</span><a href="${
    legalHref('privacy', language)
  }">${escapeHtml(copy.privacy)}</a><a href="${legalHref('terms', language)}">${
    escapeHtml(copy.terms)
  }</a><p class="footer-affiliate">${escapeHtml(copy.affiliate)}</p></footer>`;
}
