// The HTML of the SEO pages (home, game, feature and expansion pages): the readable fallback, metadata and schema
// the app takes over. Written as static files at build time, and rendered by the server function for expansion
// pages that must stay fresh (upcoming sets, whose revealed cards and status change every day).
import {
  cardPath,
  featureLabels,
  gameSetsInfo,
  parseSeoPath,
  seoFeatureCopy,
  seoFeatures,
  seoGames,
  seoLanguages,
  seoPageCopy,
  seoPath,
  seoSetCopy,
  seoUi,
  type SeoFeature,
  type SeoGameSlug,
  type SeoLanguage,
  type SeoSetInfo,
} from './seo.ts';
import {
  skeletonButton,
  skeletonCaption,
  skeletonCards,
  skeletonControls,
  skeletonTabs,
  skeletonTopCards,
  skeletonUpcoming,
} from './catalog-shell.ts';
import { adsEnabled } from './ads.ts';
import { gameOnline } from './games.ts';
import {
  externalIcon,
  gameShops,
  sealedShops,
  shopCopy,
  shopRel,
  type AffiliateConfig,
  type ShopLink,
} from './affiliate.ts';

// cards: names of the first cards per page language, aligned with the first entries of cardSlugs (all cards).
export type SeoSet = SeoSetInfo & { slug: string; cards: Partial<Record<SeoLanguage, string[]>>; cardSlugs?: string[] };
export type SeoPageOptions = {
  origin: string;
  affiliate: AffiliateConfig;
  findSet: (game: SeoGameSlug, slug: string) => SeoSet | undefined;
  gameSets: (game: SeoGameSlug) => SeoSet[];
  head?: string;
  script: string;
};

const escape = (value: string) =>
  value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));

// The home's first paint: the site header and an empty release board, the same shapes the app draws while the
// releases load, so the page does not show bare text first and then jump. The readable text follows below.
const boardTitle: Record<SeoLanguage, string> = {
  en: 'Latest and upcoming sets',
  it: 'Ultime e prossime espansioni',
  de: 'Neueste und kommende Erweiterungen',
  fr: 'Dernières et prochaines extensions',
  es: 'Últimas y próximas expansiones',
};
const boardLead: Record<SeoLanguage, string> = {
  en:
    'Print playtest proxies of any card: pick cards or paste a decklist, then download a PDF with 9 cards per A4 or Letter page, ready to cut.',
  it:
    'Stampa proxy da playtest di qualsiasi carta: scegli le carte o incolla una lista, poi scarica un PDF con 9 carte per pagina A4 o Letter, pronto da ritagliare.',
  de:
    'Drucke Playtest-Proxys jeder Karte: Karten auswählen oder eine Deckliste einfügen, dann ein PDF mit 9 Karten pro A4- oder Letter-Seite herunterladen, fertig zum Ausschneiden.',
  fr:
    'Imprimez des proxys de playtest de n’importe quelle carte : choisissez les cartes ou collez une liste, puis téléchargez un PDF de 9 cartes par page A4 ou Letter, prêt à découper.',
  es:
    'Imprime proxies de playtest de cualquier carta: elige las cartas o pega una lista y descarga un PDF con 9 cartas por página A4 o Letter, listo para recortar.',
};
const boardColumns: Record<SeoLanguage, string[]> = {
  en: ['Date', 'When', 'Game', 'Set', 'Cards'],
  it: ['Data', 'Quando', 'Gioco', 'Espansione', 'Carte'],
  de: ['Datum', 'Wann', 'Spiel', 'Erweiterung', 'Karten'],
  fr: ['Date', 'Quand', 'Jeu', 'Extension', 'Cartes'],
  es: ['Fecha', 'Cuándo', 'Juego', 'Expansión', 'Cartas'],
};
const headerCopy: Record<
  SeoLanguage,
  { home: string; games: string; more: string; account: string; language: string }
> = {
  en: { home: 'SleeveReady, home', games: 'Games', more: 'Other', account: 'Sign in', language: 'Language' },
  it: { home: 'SleeveReady, home', games: 'Giochi', more: 'Altri', account: 'Accedi', language: 'Lingua' },
  de: { home: 'SleeveReady, Startseite', games: 'Spiele', more: 'Weitere', account: 'Anmelden', language: 'Sprache' },
  fr: { home: 'SleeveReady, accueil', games: 'Jeux', more: 'Autres', account: 'Se connecter', language: 'Langue' },
  es: { home: 'SleeveReady, inicio', games: 'Juegos', more: 'Otros', account: 'Iniciar sesión', language: 'Idioma' },
};
const siteLanguages = [
  ['en', 'English'],
  ['it', 'Italiano'],
  ['de', 'Deutsch'],
  ['fr', 'Français'],
  ['es', 'Español'],
  ['pt', 'Português'],
  ['nl', 'Nederlands'],
  ['pl', 'Polski'],
];
// The site header as the app draws it on its first render (the five main games, then Other): real links, so the bar
// is whole from the first paint and the app only takes it over.
const headerGames: [SeoGameSlug, string, string][] = [
  ['magic-the-gathering', 'magic', 'Magic'],
  ['pokemon', 'pokemon', 'Pokémon'],
  ['one-piece', 'one-piece', 'One Piece'],
  ['disney-lorcana', 'lorcana', 'Lorcana'],
  ['riftbound', 'riftbound', 'Riftbound'],
  ['yu-gi-oh', 'yugioh', 'Yu-Gi-Oh!'],
  ['star-wars-unlimited', 'star-wars', 'Star Wars Unlimited'],
  ['sorcery', 'sorcery', 'Sorcery: Contested Realm'],
  ['flesh-and-blood', 'fab', 'Flesh and Blood'],
  ['digimon', 'digimon', 'Digimon Card Game'],
  ['dragon-ball-super', 'dragon-ball', 'Dragon Ball Super Card Game'],
  ['gundam', 'gundam', 'Gundam Card Game'],
  ['union-arena', 'union-arena', 'Union Arena'],
  ['cardfight-vanguard', 'vanguard', 'Cardfight!! Vanguard'],
  ['palworld', 'palworld', 'Palworld Official Card Game'],
  ['cyberpunk', 'cyberpunk', 'Cyberpunk TCG'],
]
  .filter(([game]) => gameOnline(game)) as [SeoGameSlug, string, string][];
// The app's own rule (src/main.tsx, fitGames): as many games as fit beside the brand and the actions, the rest under
// Other; three icons on phones. It runs inline right after the bar, so the first paint already shows the app's choice.
const fitScript =
  "<script>(function(){var bar=document.currentScript.previousElementSibling,tabs=bar.querySelectorAll('.header-game-tab'),more=bar.querySelector('.header-more'),count=3;if(innerWidth>760){var brand=bar.querySelector('.brand'),actions=bar.querySelector('.top-actions'),style=getComputedStyle(bar),gap=parseFloat(style.columnGap||style.gap)||0,available=bar.clientWidth-brand.offsetWidth-actions.offsetWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-gap*2-120,c=document.createElement('canvas').getContext('2d');if(c)c.font='700 12px system-ui';var widths=[].map.call(tabs,function(tab){var label=tab.textContent;return Math.ceil(c?c.measureText(label).width:label.length*7)+54;}),total=widths.reduce(function(sum,w){return sum+w+3;},0);if(total<=available)count=widths.length;else{var used=70;count=0;for(var i=0;i<widths.length;i++){if(used+widths[i]+3>available)break;used+=widths[i]+3;count++;}count=Math.max(1,count);}}for(var j=count;j<tabs.length;j++)tabs[j].style.display='none';if(count>=tabs.length&&more)more.style.display='none';var active=bar.querySelector('.header-game-tab.active');if(active&&active.style.display==='none'&&more){var trigger=more.querySelector('.header-more-trigger');trigger.classList.add('active');trigger.insertAdjacentHTML('afterbegin',active.querySelector('.game-mark').outerHTML);trigger.querySelector('strong').textContent=active.getAttribute('aria-label');}})();</script>";
const siteHeader = (language: SeoLanguage, activeGame?: SeoGameSlug) =>
{
  const copy = headerCopy[language];
  return `<header class="topbar shell-bar"><a class="brand" href="/${language}/" aria-label="${
    escape(copy.home)
  }"><img class="brand-icon" src="/favicon.svg" alt=""/>Sleeve<span>Ready</span></a><nav class="header-game-nav" aria-label="${
    escape(copy.games)
  }">${
    headerGames
      .map(([slug, mark, label]) =>
        `<a class="header-game-tab ${slug === activeGame ? 'active' : ''}" href="${
          seoPath(language, slug)
        }" aria-label="${escape(label)}"${
          slug === activeGame ? ' aria-current="page"' : ''
        }><span class="game-mark ${mark}" aria-hidden="true"></span><strong>${escape(label)}</strong></a>`
      )
      .join('')
  }<div class="game-switcher header-more"><button class="header-more-trigger " type="button"><strong>${
    escape(copy.more)
  }</strong><svg class="header-more-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"></path></svg></button></div></nav><div class="top-actions"><label class="language-select"><span class="sr-only">${
    escape(copy.language)
  }</span><span class="language-code" aria-hidden="true">${language.toUpperCase()}</span><select aria-label="${
    escape(copy.language)
  }">${
    siteLanguages
      .map(([code, label]) => `<option value="${code}"${code === language ? ' selected' : ''}>${label}</option>`)
      .join('')
  }</select></label><button class="account-button">${escape(copy.account)}</button></div></header>${fitScript}`;
};
// The advertising place at the top of the board (src/components/AdSlot.tsx draws the same once the app runs).
const adLabel: Record<SeoLanguage, string> = {
  en: 'Advertisement',
  it: 'Pubblicità',
  de: 'Anzeige',
  fr: 'Publicité',
  es: 'Publicidad',
};
const homeShell = (language: SeoLanguage) =>
  `${siteHeader(language)}<div class="shell-main"><section class="release-board rb-loading" aria-busy="true">${
    adsEnabled
      ? `<div class="ad-slot ad-strip" aria-label="${escape(adLabel[language])}"><span>${
        escape(adLabel[language])
      }</span><small>728×90 · 320×100</small></div>`
      : ''
  }<div class="rb-head"><div><h1>${escape(boardTitle[language])}</h1><p>${
    escape(boardLead[language])
  }</p></div><span class="shell-paste" aria-hidden="true"><b></b></span></div><div class="rb-controls" aria-hidden="true"><span class="shell-chip"></span><span class="shell-sheet"></span></div><div class="rb-cols" aria-hidden="true">${
    boardColumns[language].map(label => `<span>${escape(label)}</span>`).join('')
  }<span></span></div><ul class="rb-rows">${
    '<li class="rb-skel"><i></i><i></i><i></i><i></i></li>'.repeat(10)
  }</ul></section></div>`;
// A game or set page's first paint: the header with the game marked, then the catalogue as the app draws it while the
// sets and cards load (shared/catalog-shell.ts) and the empty sheet beside it. The site's stylesheet is linked in the
// head, so these boxes already have the app's sizes; upcoming sets with revealed cards get their places too.
const themeOf = (game: SeoGameSlug) =>
  ({
    'magic-the-gathering': 'magic',
    pokemon: 'pokemon',
    'one-piece': 'one-piece',
    'disney-lorcana': 'lorcana',
  } as Partial<Record<SeoGameSlug, string>>)[game] ?? 'riftbound';
const catalogShell = (
  language: SeoLanguage,
  game: SeoGameSlug,
  feature: SeoFeature | undefined,
  upcoming: number,
  title: string,
) =>
{
  const labels = featureLabels[language];
  const views = `<nav class="game-views"><a href="${seoPath(language, game)}"${feature ? '' : ' aria-current="page"'}>${
    escape(labels.catalogLink)
  }</a>${
    (Object.keys(seoFeatures) as SeoFeature[])
      .filter(item => seoFeatures[item](game))
      .map(item =>
        `<a href="/${language}/${game}/${item}/"${feature === item ? ' aria-current="page"' : ''}>${
          escape(item === 'tokens' ? labels.tokensLink : labels.topLink)
        }</a>`
      )
      .join('')
  }</nav>`;
  const tray =
    '<aside class="tray is-skel" aria-hidden="true"><div class="tray-heading"><div><span class="tray-kicker"><i></i></span><h2><b></b></h2></div><span class="tray-count"></span></div><div class="tray-summary"><div class="mini-sheet"><span class="mini-page"></span><div class="mini-sheet-copy"><p class="tray-meta"><i></i></p></div></div></div><div class="tray-empty"><b></b><i></i><i></i></div></aside>';
  // The most printed cards: the title with its Add all button, then the ranked grid.
  if (feature === 'top-proxies')
  {
    return `<div class="app-shell" data-game="${themeOf(game)}">${
      siteHeader(language, game)
    }<main><div class="workspace"><section class="catalog" aria-busy="true">${views}<section class="top-proxies"><div class="top-proxies-heading"><h2>${
      escape(title)
    }</h2>${skeletonButton}</div><ol class="card-grid top-grid" aria-hidden="true">${skeletonTopCards()}</ol></section></section>${tray}</div></main></div>`;
  }
  return `<div class="app-shell" data-game="${themeOf(game)}">${
    siteHeader(language, game)
  }<main><div class="workspace"><section class="catalog" aria-busy="true">${views}${
    upcoming && !feature
      ? `<section class="upcoming-sets is-skel" aria-hidden="true">${skeletonUpcoming(upcoming)}</section>`
      : ''
  }<div class="expansion-switcher"><nav class="expansion-tabs" aria-hidden="true">${skeletonTabs}</nav></div><div class="catalog-controls is-skel" aria-hidden="true">${skeletonControls}</div><div class="catalog-loading"><div class="set-caption is-skel" aria-hidden="true">${skeletonCaption}</div><div class="card-grid" aria-hidden="true">${skeletonCards()}</div></div></section>${tray}</div></main></div>`;
};
// Before the stylesheet arrives (and in development, where styles come with the scripts) the shell holds its shape.
const homeShellStyle =
  'body{margin:0;background:#f4f2ed;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif}.shell-bar{height:64px;display:flex;align-items:center;gap:22px;padding:0 4%;background:#24232a;box-sizing:border-box}.shell-bar .brand{display:flex;align-items:center;gap:0;color:#fffaf0;font-weight:800;font-size:20px;text-decoration:none;flex:none}.shell-bar .brand span{color:#f3cc63}.shell-bar .brand-icon{width:28px;height:28px;margin-right:9px}.shell-bar .header-game-nav{flex:1;display:flex;justify-content:center;gap:4px;min-width:0}.shell-bar .header-game-tab,.shell-bar .header-more-trigger{display:flex;align-items:center;gap:7px;box-sizing:border-box;height:40px;padding:5px 9px;border:0;background:none;color:#d9d5cd;font:700 .78rem system-ui,sans-serif;text-decoration:none}.shell-bar .header-more-chevron{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6}.shell-bar .game-mark{box-sizing:border-box;width:28px;height:28px;border-radius:6px;background:#fffefa;flex:none}.shell-bar .top-actions{display:flex;gap:16px;flex:none;align-items:center}.shell-bar .language-select{position:relative}.shell-bar .language-code,.shell-bar .sr-only{display:none}.shell-bar select{width:117px;height:32px;border-radius:6px;border:1px solid #4a4952;background:#2e2d35;color:#fffaf0;font:600 .8rem system-ui,sans-serif;padding:0 8px}.shell-bar .account-button{height:32px;border:0;border-radius:6px;background:#f3cc63;color:#302d38;font:700 .8rem system-ui,sans-serif;padding:0 10px}.shell-main{padding:26px 4% 56px;box-sizing:border-box}.rb-loading{max-width:1240px;margin:0 auto;padding:6px 0 10px;min-height:calc(100vh - 152px);box-sizing:border-box}.rb-loading .rb-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;align-items:center;padding-bottom:20px}.rb-loading h1{font-size:clamp(1.7rem,2.7vw,2.35rem);font-weight:800;letter-spacing:-.03em;line-height:1.05;color:#29272d;margin:0}.shell-paste{display:flex;justify-content:flex-end;align-items:center;width:343px;max-width:100%;height:53px;box-sizing:border-box;padding:4px;border:1px solid #d4ccbf;border-radius:9px;background:#fffefa}.shell-paste b{width:118px;height:43px;border-radius:6px;background:#24232a}.rb-loading .rb-controls{display:flex;justify-content:space-between;align-items:center;height:59px;box-sizing:border-box;border-top:1px solid #e3ded5}.shell-chip{width:93px;height:32px;border-radius:7px;background:#24232a}.shell-sheet{width:150px;height:34px;border-radius:7px;border:1px solid #d4ccbf;box-sizing:border-box;background:#fffefa}.rb-loading .rb-cols{display:grid;grid-template-columns:132px 112px 170px minmax(0,1fr) 178px 150px;column-gap:20px;align-items:center;height:35px;box-sizing:border-box;border-top:1px solid #e3ded5;font-size:.68rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#857e77}.rb-loading .rb-rows{list-style:none;margin:0;padding:0;border-top:1px solid #e3ded5}.rb-skel{display:grid;grid-template-columns:132px 112px 170px minmax(0,1fr);align-items:center;column-gap:20px;height:76px;box-sizing:border-box;border-bottom:1px solid #e3ded5}.rb-skel i{display:block;height:14px;border-radius:4px;background:#e7e2d8}.rb-skel i:first-child{width:62px;height:30px}.rb-skel i:nth-child(2){width:70px}.rb-skel i:nth-child(3){width:110px}.rb-skel i:nth-child(4){width:min(260px,70%);height:18px}@media (max-width:1100px){.rb-loading .rb-cols{grid-template-columns:118px 96px 150px minmax(0,1fr) 150px}.rb-loading .rb-cols span:last-child{display:none}}@media (max-width:760px){.shell-bar{height:60px;padding:0 10px}.shell-bar .header-game-tab{display:none}.shell-main{padding:20px 20px 40px}.rb-loading .rb-head{grid-template-columns:1fr;gap:16px}.shell-paste{width:100%}.rb-loading .rb-cols{display:none}.rb-skel{grid-template-columns:74px minmax(0,1fr);height:77px}.rb-skel i:nth-child(2),.rb-skel i:nth-child(3){display:none}}';

// A page kept by the browser from before a deploy (Back and Forward reuse it without asking) names scripts and styles
// that deploy replaced: when one of the site's files fails to load, the page reloads once and gets the current ones.
// The app clears the mark once it runs (src/main.tsx).
const staleReload =
  "addEventListener('error',function(e){var t=e.target,u=t&&(t.src||t.href)||'';if(u.indexOf('/assets/')<0)return;try{if(sessionStorage.getItem('sr-stale'))return;sessionStorage.setItem('sr-stale','1')}catch(_){return}location.reload()},true)";

// Every selector of the shell's own styles wrapped in :where(), so they count for nothing once the site's stylesheet
// is there: they hold the shape before it arrives and never fight it afterwards.
const weakSelectors = (css: string) =>
  css.replace(
    /(^|[{}])([^{}@]+)\{/g,
    (_, before: string, selectors: string) =>
      before + selectors.split(',').map(selector => `:where(${selector.trim()})`).join(',') + '{',
  );

// The app lists up to four sets still to come with at least 20 cards revealed (server/app.ts, upcoming).
const upcomingShapes = (sets: SeoSet[]) =>
{
  const today = new Date().toISOString().slice(0, 10);
  return Math.min(4, sets.filter(item => item.releaseDate && item.releaseDate > today && item.cardCount >= 20).length);
};

export function renderSeoPage(path: string, options: SeoPageOptions)
{
  const { origin, affiliate } = options;
  const route = parseSeoPath(path);
  const language = route.language ?? 'en';
  const set = route.game && route.set ? options.findSet(route.game, route.set) : undefined;
  const copy = route.game && set
    ? seoSetCopy(language, route.game, set)
    : route.game && route.feature
    ? seoFeatureCopy(language, route.game, route.feature)
    : seoPageCopy(
      language,
      route.game,
      route.game
        ? gameSetsInfo(
          options.gameSets(route.game).map(item => ({
            name: item.name,
            releaseDate: item.releaseDate,
            revealed: item.cardCount,
          })),
        )
        : undefined,
    );
  const pathIn = (code: SeoLanguage) =>
    route.game && route.feature ? `/${code}/${route.game}/${route.feature}/` : seoPath(code, route.game, set?.slug);
  const canonical = origin + path;
  const gameLabel = seoGames.find(game => game.slug === route.game)?.label ?? '';
  // Expansion pages only exist in the languages the set is printed in; hreflang lists exactly those.
  const alternates = seoLanguages
    .filter(code => !set || set.cards[code]?.length)
    .map(code => `<link rel="alternate" hreflang="${code}" href="${origin + pathIn(code)}"/>`)
    .join('\n  ');
  const gameLinks = seoGames.map(game => `<a href="${seoPath(language, game.slug)}">${escape(game.label)}</a>`).join(
    '',
  );
  const featureLinks = route.game && !set
    ? (Object.keys(seoFeatures) as SeoFeature[])
      .filter(feature => seoFeatures[feature](route.game!))
      .map(feature =>
        `<a href="/${language}/${route.game}/${feature}/">${
          escape(feature === 'tokens' ? featureLabels[language].tokensLink : featureLabels[language].topLink)
        }</a>`
      )
      .join('')
    : '';
  const setLinks = route.game && !set
    ? options
      .gameSets(route.game)
      .filter(item => item.cards[language]?.length)
      .map(item => `<a href="${seoPath(language, route.game, item.slug)}">${escape(item.name)}</a>`)
      .join('')
    : '';
  const cardList = set && route.game
    ? `<ul class="seo-cards">${
      (set.cards[language] ?? [])
        .map((name, index) =>
        {
          const slug = set.cardSlugs?.[index];
          return `<li>${
            slug ? `<a href="${cardPath(language, route.game!, set.slug, slug)}">${escape(name)}</a>` : escape(name)
          }</li>`;
        })
        .join('')
    }</ul><p><a href="${seoPath(language, route.game)}">${escape(gameLabel)}</a></p>`
    : '';
  // Expansion pages link searches for the set's sealed products, game pages for the game's (partner links).
  const shopBlock = (label: string, links: ShopLink[]) =>
    `<div class="seo-shops"><p>${escape(label)}</p><div class="shop-buttons">${
      links
        .map(link =>
          `<a class="shop-button" href="${escape(link.url)}" target="_blank" rel="${
            shopRel(link)
          }">${link.shop}<span>${externalIcon}</span></a>`
        )
        .join('')
    }</div></div>`;
  const sealed = set && route.game
    ? shopBlock(
      shopCopy[language].sealed(set.name),
      sealedShops(language, { game: gameLabel, set: set.name }, affiliate),
    )
    : route.game && !route.feature
    ? shopBlock(shopCopy[language].game(gameLabel), gameShops(language, gameLabel, affiliate))
    : '';
  const faqs = copy
    .faq
    .map(item => `<details><summary>${escape(item.question)}</summary><p>${escape(item.answer)}</p></details>`)
    .join('');
  const faqSchema = copy.faq.map(item => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  }));
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'SleeveReady',
      url: canonical,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web',
      description: copy.description,
    },
    ...(faqSchema.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqSchema }] : []),
    ...(route.game
      ? [{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'SleeveReady', item: origin + seoPath(language) },
          { '@type': 'ListItem', position: 2, name: gameLabel, item: origin + seoPath(language, route.game) },
          ...(set || route.feature
            ? [{ '@type': 'ListItem', position: 3, name: set ? set.name : copy.h1, item: canonical }]
            : []),
        ],
      }]
      : []),
  ];
  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="UTF-8"/>
  <script>${staleReload}</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="description" content="${escape(copy.description)}"/>
  <meta name="robots" content="index,follow"/>
  ${
    route.game
      ? ''
      : '<meta name="impact-site-verification" value="cfead948-2f80-42e7-b4b0-bcc86e17dd36"/><meta name="impact-site-verification" value="d1d01521-d81e-4137-8b01-a5b3eecbf23f"/>'
  }
  <meta name="theme-color" content="#24232a"/>
  <link rel="canonical" href="${canonical}"/>
  ${alternates}
  <link rel="alternate" hreflang="x-default" href="${origin + pathIn('en')}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="SleeveReady"/>
  <meta property="og:title" content="${escape(copy.title)}"/>
  <meta property="og:description" content="${escape(copy.description)}"/>
  <meta property="og:url" content="${canonical}"/>
  <meta property="og:image" content="${origin}/og-image.png"/>
  <meta property="og:image:alt" content="SleeveReady printable card sheet builder"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${escape(copy.title)}"/>
  <meta name="twitter:description" content="${escape(copy.description)}"/>
  <meta name="twitter:image" content="${origin}/og-image.png"/>
  <title>${escape(copy.title)}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
  <link rel="manifest" href="/site.webmanifest"/>
  ${options.head ?? ''}
  <script type="application/ld+json">${JSON.stringify(schemas).replace(/</g, '\\u003c')}</script>
  ${route.game ? '' : `<style>${weakSelectors(homeShellStyle)}</style>`}
  <style>.seo-fallback{max-width:1080px;margin:0 auto;padding:42px 24px;font:16px/1.55 system-ui,sans-serif;color:#2d2a30}.seo-fallback h1{font-size:2rem;line-height:1.15}.seo-fallback nav,.seo-fallback ul{display:flex;flex-wrap:wrap;gap:10px 18px}.seo-fallback details{padding:12px 0;border-top:1px solid #ddd}.seo-fallback a{color:#7b3f1f}</style>
</head>
<body><div id="root">${
  route.game
    ? catalogShell(language, route.game, route.feature, upcomingShapes(options.gameSets(route.game)), copy.h1)
    : homeShell(language)
}<main class="seo-fallback">${route.game ? `<h1>${escape(copy.h1)}</h1>` : `<h2>${escape(copy.h1)}</h2>`}<p>${
  escape(copy.intro)
}</p><ul>${copy.facts.map(fact => `<li>${escape(fact)}</li>`).join('')}</ul>${cardList}${sealed}${
  featureLinks ? `<nav>${featureLinks}</nav>` : ''
}${setLinks ? `<nav>${setLinks}</nav>` : ''}<nav aria-label="${escape(seoUi[language].games)}">${gameLinks}</nav>${
  faqs ? `<section><h2>${escape(seoUi[language].faq)}</h2>${faqs}</section>` : ''
}</main></div>${options.script}</body>
</html>\n`;
}
