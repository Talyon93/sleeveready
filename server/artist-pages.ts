// Illustrator pages (/it/pokemon/illustratori/mousho/): every card a source credits to one artist, newest expansion
// first, each linked to its card page. Server-rendered and cached like card pages; they need no app, so they load
// only its stylesheet. The URL slug maps back to the exact name through the source's list of illustrators.
import { legalFooterHtml } from '../shared/legal.ts';
import {
  artistCopy,
  artistPath,
  artistProfileCopy,
  artistSlug,
  cardPath,
  expansionSlug,
  illustratorSegment,
  seoGames,
  seoLanguages,
  seoPath,
  seoSlugForGame,
  type SeoGameSlug,
  type SeoLanguage,
} from '../shared/seo.ts';
import { artistStats, wikidataProfile } from './artist-profile.ts';
import { releaseKey, releaseSlug } from './releases.ts';
import releases from './data/releases.json' with { type: 'json' };
import { safeImageUrl, thumbnailUrl } from '../shared/images.ts';
import type { NativeCatalog } from './native-source.ts';
import { linkPrintings } from './printings.ts';
import { appStyles, escape, gameTheme } from './card-pages.ts';

export type ArtistPageRequest = { language: SeoLanguage; game: SeoGameSlug; artist: string };
export type ArtistPage = { status: 200; html: string } | { status: 404 };
const LIMIT = 240;
// An illustrator with a handful of cards makes a thin page: it stays for visitors but out of search engines.
const MIN_INDEXED = 5;

// Other games this artist has cards in, checked against each source's own list and cards.
async function otherGames(catalogs: NativeCatalog[], current: NativeCatalog, slug: string)
{
  const games = await Promise.all(
    catalogs.filter(item => item !== current && item.illustrators && item.byIllustrator).map(async item =>
    {
      try
      {
        const name = (await item.illustrators!()).find(entry => artistSlug(entry) === slug);
        const game = seoSlugForGame(item.game.name + ' ' + item.game.displayName);
        return name && game && (await linkPrintings(item, await item.byIllustrator!(name))).length
          ? [{ game, name }]
          : [];
      }
      catch
      {
        return [];
      }
    }),
  );
  return games.flat();
}

export async function renderArtistPage(
  request: ArtistPageRequest,
  catalogs: NativeCatalog[],
  origin: string,
  development: boolean,
  lookup: typeof wikidataProfile = wikidataProfile,
): Promise<ArtistPage>
{
  const catalog = catalogs.find(item => seoSlugForGame(item.game.name + ' ' + item.game.displayName) === request.game);
  if (!catalog?.illustrators || !catalog.byIllustrator) return { status: 404 };
  const artist = (await catalog.illustrators()).find(name => artistSlug(name) === request.artist);
  if (!artist) return { status: 404 };
  const printings = await linkPrintings(catalog, await catalog.byIllustrator(artist));
  const total = printings.length;
  const cards = printings.slice(0, LIMIT);
  if (!cards.length) return { status: 404 };
  const copy = artistCopy[request.language];
  const gameLabel = seoGames.find(item => item.slug === request.game)!.label;
  const profileCopy = artistProfileCopy[request.language];
  const [sets, wiki, elsewhere] = await Promise.all([
    catalog.sets().then(result => result.data),
    lookup(artist),
    otherGames(catalogs, catalog, request.artist),
  ]);
  // Sources without release dates (TCGdex's set list) fall back on the release calendar the catalogue already keeps.
  const calendar = (releases as Record<string, { dates?: Record<string, string> }>)[
    releaseSlug(catalog.game.name + ' ' + catalog.game.displayName) ?? ''
  ]
    ?.dates ?? {};
  const stats = artistStats(
    cards,
    new Map(sets.map(set => [expansionSlug(set), set.releaseDate ?? calendar[releaseKey(set.name)] ?? null])),
  );
  const country = wiki?.country[request.language] ?? null;
  const wikipedia = wiki ? wiki.wikipedia[request.language] ?? wiki.wikipedia.en ?? null : null;
  const external = (href: string, label: string) =>
    `<a href="${escape(href)}" rel="nofollow noopener">${escape(label)}</a>`;
  const profile: [string, string][] = [
    ...(stats.firstYear
      ? [
        [
          profileCopy.years,
          stats.firstYear === stats.lastYear ? String(stats.firstYear) : `${stats.firstYear}–${stats.lastYear}`,
        ] as [string, string],
      ]
      : []),
    [profileCopy.sets, String(stats.sets)],
    ...(stats.topSet
      ? [
        [profileCopy.topSetLabel, escape(profileCopy.topSet(stats.topSet.name, stats.topSet.count))] as [
          string,
          string,
        ],
      ]
      : []),
    ...(stats.colours.length
      ? [
        [profileCopy.colors, stats.colours.map(colour => profileCopy.colorNames[colour]).join(', ')] as [
          string,
          string,
        ],
      ]
      : []),
    ...(stats.type ? [[profileCopy.type, profileCopy.typeNames[stats.type]] as [string, string]] : []),
    ...(stats.rares ? [[profileCopy.rares, String(stats.rares)] as [string, string]] : []),
    ...(country ? [[profileCopy.country, escape(country)] as [string, string]] : []),
    ...(wiki?.website
      ? [
        [profileCopy.website, external(wiki.website, new URL(wiki.website).hostname.replace(/^www\./, ''))] as [
          string,
          string,
        ],
      ]
      : []),
    ...(wikipedia
      ? [
        [
          profileCopy.wikipedia,
          external(
            wikipedia,
            decodeURIComponent(new URL(wikipedia).pathname.split('/').pop() ?? artist).replace(/_/g, ' '),
          ),
        ] as [string, string],
      ]
      : []),
    ...(elsewhere.length
      ? [
        [
          profileCopy.alsoIn,
          elsewhere
            .map(item =>
              `<a href="${artistPath(request.language, item.game, item.name)}">${
                escape(seoGames.find(game => game.slug === item.game)!.label)
              }</a>`
            )
            .join(', '),
        ] as [string, string],
      ]
      : []),
  ];
  const usedWikidata = Boolean(country || wiki?.website || wikipedia);
  const profileHtml = `<dl class="cp-record artist-profile" aria-label="${escape(profileCopy.heading)}">${
    profile.map(([term, value]) => `<div><dt>${escape(term)}</dt><dd>${value}</dd></div>`).join('')
  }</dl>${
    usedWikidata && wiki
      ? `<p class="artist-source">${escape(profileCopy.source)} ${
        external(`https://www.wikidata.org/wiki/${wiki.id}`, wiki.id)
      }</p>`
      : ''
  }`;
  const intro = copy.intro({
    artist,
    game: gameLabel,
    count: total,
    newest: cards[0].setName,
    oldest: cards.at(-1)!.setName,
  });
  const title = copy.title(artist, gameLabel, total);
  const path = artistPath(request.language, request.game, artist);
  const canonical = origin + path;
  const imageFor = (item: typeof cards[number]) =>
    [...(item.card.imageUrls ?? []), item.card.imageUrl].map(safeImageUrl).find((url): url is string => Boolean(url));
  const cover = imageFor(cards[0]);
  const alternates = seoLanguages
    .map(language =>
      `<link rel="alternate" hreflang="${language}" href="${origin + artistPath(language, request.game, artist)}"/>`
    )
    .join('\n  ');
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'SleeveReady', item: origin + seoPath(request.language) },
          { '@type': 'ListItem', position: 2, name: gameLabel, item: origin + seoPath(request.language, request.game) },
          { '@type': 'ListItem', position: 3, name: artist, item: canonical },
        ],
      },
      {
        '@type': 'CollectionPage',
        name: title,
        url: canonical,
        inLanguage: request.language,
        numberOfItems: cards.length,
        about: {
          '@type': 'Person',
          name: artist,
          ...(wiki?.country.en ? { nationality: { '@type': 'Country', name: wiki.country.en } } : {}),
          ...(wiki?.website ? { url: wiki.website } : {}),
          ...(wiki
            ? {
              sameAs: [
                `https://www.wikidata.org/wiki/${wiki.id}`,
                ...Object.values(wiki.wikipedia),
                ...(wiki.website ? [wiki.website] : []),
              ],
            }
            : {}),
        },
      },
    ],
  };
  const tiles = cards
    .map(item =>
    {
      const full = imageFor(item);
      const src = full ? thumbnailUrl(full) ?? full : full;
      return `<li><a class="cp-tile" href="${
        cardPath(request.language, request.game, item.set, item.slug)
      }"><span class="cp-tile-art">${
        src
          ? `<img src="${escape(src)}" alt="${escape(item.card.name)}" loading="lazy" referrerpolicy="no-referrer"/>`
          : ''
      }</span><span class="cp-tile-name">${escape(item.card.name)}</span><span class="cp-num">${
        escape([item.setName, item.card.collectorNumber].filter(Boolean).join(' · '))
      }</span></a></li>`;
    })
    .join('');
  const html = `<!doctype html>
<html lang="${request.language}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(intro)}"/>
  <meta name="robots" content="${total >= MIN_INDEXED ? 'index,follow' : 'noindex,follow'}"/>
  <meta name="theme-color" content="#24232a"/>
  <link rel="canonical" href="${canonical}"/>
  ${alternates}
  <link rel="alternate" hreflang="x-default" href="${origin + artistPath('en', request.game, artist)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="SleeveReady"/>
  <meta property="og:title" content="${escape(title)}"/>
  <meta property="og:description" content="${escape(intro)}"/>
  <meta property="og:url" content="${canonical}"/>
  <meta property="og:image" content="${escape(cover ? new URL(cover, origin).href : origin + '/og-image.png')}"/>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
  ${appStyles(development)}
  <script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</head>
<body><div class="app-shell" data-game="${
  gameTheme(catalog.game.name)
}"><header class="topbar"><a class="brand" href="${
  seoPath(request.language)
}" aria-label="SleeveReady"><img class="brand-icon" src="/favicon.svg" alt=""/>Sleeve<span>Ready</span></a></header><main><div class="card-workspace"><article class="artist-page" aria-labelledby="artist-title"><header class="cp-top"><nav class="cp-trail" aria-label="Breadcrumb"><a href="${
  seoPath(request.language)
}">SleeveReady</a><span aria-hidden="true">/</span><a href="${seoPath(request.language, request.game)}">${
  escape(gameLabel)
}</a><span aria-hidden="true">/</span><span>${
  escape(copy.crumb)
}</span><span aria-hidden="true">/</span><span aria-current="page">${
  escape(artist)
}</span></nav></header><h1 id="artist-title">${escape(artist)}</h1><p class="artist-intro">${
  escape(intro)
}</p>${profileHtml}<section class="cp-related artist-cards" aria-labelledby="artist-title"><ul>${tiles}</ul></section></article></div></main>${
  legalFooterHtml(request.language)
}</div></body>
</html>\n`;
  return { status: 200, html };
}
export const isIllustratorSegment = (language: SeoLanguage, segment: string) =>
  illustratorSegment[language] === segment;
