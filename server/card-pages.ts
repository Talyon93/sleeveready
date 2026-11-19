// Server-rendered card pages (/it/pokemon/sv09/125/): one per card of every expansion, in English and in each
// page language the set is printed in. The CDN caches them; the app then loads on top with the same card open.
import { legalFooterHtml } from '../shared/legal.ts';
import { cardPagesIndexed } from '../shared/games.ts';
import {
  artistCopy,
  artistPath,
  cardDetailLabels,
  cardFaq,
  cardFaqLabels,
  cardGameRows,
  cardProxyLine,
  cardSummary,
  rarityName,
  cardLabels,
  cardPath,
  cardSlugs,
  expansionSlug,
  seoCardCopy,
  seoGames,
  seoLanguages,
  seoPath,
  seoSlugForGame,
  type SeoGameSlug,
  type SeoLanguage,
} from '../shared/seo.ts';
import { safeImageUrl, thumbnailUrl } from '../shared/images.ts';
import { affiliateConfig, externalIcon, sealedShops, shopCopy, shopRel, singleCardShops } from '../shared/affiliate.ts';
import type { CardPrinting, CatalogCard } from '../shared/model.ts';
import type { NativeCatalog } from './native-source.ts';
import { samePrinting } from './deck-import.ts';
import { cardInfo } from './card-info.ts';
import { hasSymbols, symbolsHtml } from '../shared/card-symbols.ts';
import { cardExtrasCopy, formatDay, latestPriceDay, shopTiles, shownPrices } from '../shared/card-extras.ts';
import { deckMeta, deckSites, deckSitesCopy } from '../shared/deck-sites.ts';

export const escape = (value: string) =>
  value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
// In development Vite serves the source; production builds write /app.css and /app-loader.js with stable names.
export const appScript = (development: boolean) =>
  development
    ? '<script type="module" src="/src/main.tsx"></script>'
    : '<script type="module" src="/app-loader.js"></script>';
// In development the stylesheets come with the scripts: the site's and the catalogue's loading shapes are linked so the
// first paint already has them, like /app.css (the whole bundle) in production.
export const appStyles = (development: boolean) =>
  development
    ? '<link rel="stylesheet" href="/src/style.css"/><link rel="stylesheet" href="/src/catalog-shell.css"/>'
    : '<link rel="stylesheet" href="/app.css"/>';
// Same accent themes as the app shell (data-game), so the first paint already wears the game's colour.
export const gameTheme = (name: string) =>
  /magic/i.test(name)
    ? 'magic'
    : /pok[eé]mon/i.test(name)
    ? 'pokemon'
    : /one\s*piece/i.test(name)
    ? 'one-piece'
    : /lorcana/i.test(name)
    ? 'lorcana'
    : 'riftbound';
const chevron = (direction: 'left' | 'right') =>
  `<svg class="cp-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="${
    direction === 'left' ? 'M10 3 5 8l5 5' : 'm6 3 5 5-5 5'
  }"/></svg>`;

export type CardPageRequest = { language: SeoLanguage; game: SeoGameSlug; set: string; card: string };
export type CardPage = { status: 200; html: string } | { status: 302; location: string } | { status: 404 };

// allNames: the build writes the names in every language (its expansions are in memory already); the function keeps
// to what is cheap, and the app adds them for visitors.
export async function renderCardPage(
  request: CardPageRequest,
  catalogs: NativeCatalog[],
  origin: string,
  development: boolean,
  { allNames = false }: { allNames?: boolean } = {},
): Promise<CardPage>
{
  const catalog = catalogs.find(item => seoSlugForGame(item.game.name + ' ' + item.game.displayName) === request.game);
  if (!catalog) return { status: 404 };
  const expansion = (await catalog.sets()).data.find(set => expansionSlug(set) === request.set);
  if (!expansion) return { status: 404 };
  const english = (await catalog.cards(expansion.id, 'en')).data;
  const slugs = cardSlugs(english);
  const target = english.find(card => slugs.get(card.id) === request.card);
  if (!target) return { status: 404 };
  const printed = (catalog.game.printLanguages?.length ?? 0) > 1
    ? (await catalog.languages(expansion.id)).data
    : ['en'];
  const pageLanguages = seoLanguages.filter(language => language === 'en' || printed.includes(language));
  // Links from other expansions' pages keep the visitor's language; a set not printed in it opens in English.
  if (!pageLanguages.includes(request.language))
  {
    return { status: 302, location: cardPath('en', request.game, request.set, request.card) };
  }
  const localisedList = request.language === 'en'
    ? english
    : (await catalog.cards(expansion.id, request.language)).data;
  const local = (card: CatalogCard) =>
    request.language === 'en' ? card : samePrinting(english, localisedList, card) ?? card;
  const card = local(target);
  const labels = cardLabels[request.language];
  const gameLabel = seoGames.find(item => item.slug === request.game)!.label;
  const copy = seoCardCopy(request.language, request.game, {
    name: card.name,
    setName: expansion.name,
    setCode: expansion.code,
    number: card.collectorNumber ?? null,
    rarity: card.rarity ?? null,
    languages: printed,
  });
  const otherSets = (versionsFor: { set: string; setName: string }[]) =>
    versionsFor.filter(item => item.set !== request.set).map(item => item.setName);
  const path = cardPath(request.language, request.game, request.set, request.card);
  const canonical = origin + path;
  const image = [...(card.imageUrls ?? []), card.imageUrl].map(safeImageUrl).find((url): url is string => Boolean(url));
  const absoluteImage = image ? new URL(image, origin).href : origin + '/og-image.png';
  // Same neighbourhood as the app's card page: alternative versions, then nearby cards of the set.
  const index = english.indexOf(target);
  const previous = index > 0 ? english[index - 1] : undefined;
  const next = index < english.length - 1 ? english[index + 1] : undefined;
  const info = await cardInfo(catalog, expansion, english, target, card, { allNames });
  const versions = info.versions;
  const details = info.details;
  const detailLabels = cardDetailLabels[request.language];
  const inSet = new Set(versions.map(item => item.card));
  const related = english
    .slice(Math.max(0, index - 6), index + 7)
    .filter(item => item !== target && !inSet.has(item))
    .slice(0, 12);
  const hrefFor = (item: CatalogCard) => cardPath(request.language, request.game, request.set, slugs.get(item.id)!);
  const setHref = seoPath(request.language, request.game, request.set);
  // Tiles use the source's lighter image where it has one; the card itself keeps the full image.
  const imageFor = (item: CatalogCard) =>
  {
    const url = [...(item.imageUrls ?? []), item.imageUrl].map(safeImageUrl).find((value): value is string =>
      Boolean(value)
    );
    return url ? thumbnailUrl(url) ?? url : undefined;
  };
  const tile = (item: CatalogCard, label: string) =>
  {
    const shown = local(item);
    const src = imageFor(shown);
    return `<li><a class="cp-tile" href="${hrefFor(item)}"><span class="cp-tile-art">${
      src ? `<img src="${escape(src)}" alt="${escape(shown.name)}" loading="lazy" referrerpolicy="no-referrer"/>` : ''
    }</span><span class="cp-tile-name">${escape(label)}</span>${
      shown.collectorNumber ? `<span class="cp-num">${escape(shown.collectorNumber)}</span>` : ''
    }</a></li>`;
  };
  // Versions in this expansion show in the page language; other expansions show their English printing.
  const version = (item: CardPrinting) =>
  {
    const shown = item.set === request.set ? local(item.card) : item.card;
    const src = imageFor(shown);
    return `<li><a class="cp-tile" href="${
      cardPath(request.language, request.game, item.set, item.slug)
    }"><span class="cp-tile-art">${
      src ? `<img src="${escape(src)}" alt="${escape(shown.name)}" loading="lazy" referrerpolicy="no-referrer"/>` : ''
    }</span><span class="cp-tile-name">${escape(item.setName)}</span><span class="cp-num">${
      escape([shown.collectorNumber, shown.version].filter(Boolean).join(' · '))
    }</span></a></li>`;
  };
  const alternates = pageLanguages
    .map(language =>
      `<link rel="alternate" hreflang="${language}" href="${
        origin + cardPath(language, request.game, request.set, request.card)
      }"/>`
    )
    .join('\n  ');
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'SleeveReady', item: origin + seoPath(request.language) },
      { '@type': 'ListItem', position: 2, name: gameLabel, item: origin + seoPath(request.language, request.game) },
      {
        '@type': 'ListItem',
        position: 3,
        name: expansion.name,
        item: origin + seoPath(request.language, request.game, request.set),
      },
      { '@type': 'ListItem', position: 4, name: card.name, item: canonical },
    ],
  };
  const languageNames = new Intl.DisplayNames([request.language], { type: 'language' });
  const summary = cardSummary(request.language, {
    name: card.name,
    set: expansion.name,
    number: card.collectorNumber ?? null,
    kind: details?.kind,
    hp: details?.hp,
    illustrator: details?.illustrator,
    otherSets: otherSets(versions),
  });
  // The description is the card itself (what it is, the start of its text), then the proxy: unique for every card.
  const firstText = details
    ?.blocks
    .map(block =>
      [block.title, block.text].filter(Boolean).join(': ').trim().replace(/\s*\n+\s*/g, ' · ').replace(/\s+/g, ' ')
    )
    .find(Boolean) ?? '';
  const excerpt = firstText.length > 110 ? firstText.slice(0, 110).replace(/\s+\S*$/, '') + '…' : firstText;
  const description = [summary, excerpt ? `“${excerpt}”` : '', cardProxyLine[request.language]].filter(Boolean).join(
    ' ',
  );
  const gameRows = details ? cardGameRows(request.language, details) : [];
  const rarity = rarityName(request.language, card.rarity ?? details?.rarity ?? null);
  // Same dossier as src/components/CardPage.tsx: the printed languages stay under the card, every tab panel is in the
  // HTML with the first one open, and the app takes the tabs over once it loads.
  const record: [string, string][] = [
    [labels.set, `<a href="${setHref}">${escape(expansion.name)}</a>`],
    ...(card.collectorNumber
      ? [[labels.number, `<span class="cp-num">${escape(card.collectorNumber)}</span>`] as [string, string]]
      : []),
    ...(details?.kind ? [[detailLabels.kind, escape(details.kind)] as [string, string]] : []),
    ...(rarity ? [[labels.rarity, escape(rarity)] as [string, string]] : []),
    ...(card.version ? [[labels.version, escape(card.version)] as [string, string]] : []),
    ...(details?.illustrator ? [[detailLabels.illustrator, escape(details.illustrator)] as [string, string]] : []),
    ...gameRows.map(([term, value]) => [term, escape(value)] as [string, string]),
    ...(info.names.length
      ? [
        [
          detailLabels.names,
          `<span class="cp-names">${
            info
              .names
              .map(item =>
                `<span><span lang="${item.language}">${escape(item.name)}</span> <span class="cp-lang">${
                  escape(languageNames.of(item.language) ?? item.language)
                }</span></span>`
              )
              .join('')
          }</span>`,
        ] as [string, string],
      ]
      : []),
    [labels.shownIn, escape(languageNames.of(card.language ?? request.language) ?? card.language ?? request.language)],
  ];
  // Magic's braced symbols ({T}, {2}{W}) as symbol images; one paragraph per line of rules text.
  const magic = request.game === 'magic-the-gathering';
  const rich = (text: string) => hasSymbols(request.game) ? symbolsHtml(text, escape, request.game) : escape(text);
  const textPanel = details?.blocks.length
    ? details
      .blocks
      .map(block =>
        `<div class="cp-block">${
          block.title || block.meta
            ? `<p class="cp-block-head">${block.title ? `<strong>${escape(block.title)}</strong>` : ''}${
              block.meta ? `<span>${rich(block.meta)}</span>` : ''
            }</p>`
            : ''
        }${
          block.text
            ? block.text.split('\n').filter(line => line.trim()).map(line => `<p>${rich(line)}</p>`).join('')
            : ''
        }</div>`
      )
      .join('')
    : '';
  // Printed languages link to this card's page in that language where one exists.
  const chips = printed.length > 1
    ? `<div class="cp-languages"><span>${escape(detailLabels.printLanguage)}</span><div>${
      printed
        .map(code =>
        {
          const name = escape(languageNames.of(code) ?? code);
          return code === card.language
            ? `<span class="cp-chip is-current">${name}</span>`
            : (pageLanguages as string[]).includes(code)
            ? `<a href="${
              cardPath(code as SeoLanguage, request.game, request.set, request.card)
            }" hreflang="${code}">${name}</a>`
            : `<span class="cp-chip">${name}</span>`;
        })
        .join('')
    }</div></div>`
    : '';
  const extras = cardExtrasCopy[request.language];
  const prices = shownPrices(details?.prices ?? []);
  const rulings = details?.rulings ?? [];
  const panels: { id: string; label: string; count?: number; html: string }[] = [
    ...(textPanel ? [{ id: 'text', label: detailLabels.tabs.text, html: textPanel }] : []),
    {
      id: 'data',
      label: detailLabels.tabs.data,
      html: `<dl class="cp-record">${
        record.map(([term, value]) => `<div><dt>${escape(term)}</dt><dd>${value}</dd></div>`).join('')
      }</dl>`,
    },
    ...((details?.formats ?? []).length
      ? [{
        id: 'formats',
        label: extras.formats,
        html: `<ul class="cp-formats">${
          details!.formats!
            .map(item =>
              `<li class="is-${item.status}"><span>${escape(item.format)}</span><strong>${
                escape(extras.status[item.status])
              }</strong></li>`
            )
            .join('')
        }</ul><p class="cp-panel-note">${escape(extras.formatsNote)}</p>`,
      }]
      : []),
    ...(rulings.length
      ? [{
        id: 'rulings',
        label: extras.rulings,
        count: rulings.length,
        html: `<ul class="cp-rulings">${
          rulings
            .map(item =>
              `<li><time datetime="${escape(item.date)}">${
                escape(formatDay(request.language, item.date, 'short'))
              }</time><p>${escape(item.text)}</p></li>`
            )
            .join('')
        }</ul>`,
      }]
      : []),
    ...(versions.length
      ? [{
        id: 'versions',
        label: detailLabels.tabs.versions,
        count: versions.length,
        html: `<ul class="cp-versions">${versions.map(version).join('')}</ul>`,
      }]
      : []),
  ];
  const tabsHtml = `<div class="cp-tabs" role="tablist" aria-label="${escape(card.name)}">${
    panels
      .map((panel, position) =>
        `<button type="button" role="tab" id="cp-tab-${panel.id}" aria-controls="cp-panel-${panel.id}" aria-selected="${
          position === 0
        }" tabindex="${position === 0 ? 0 : -1}">${escape(panel.label)}${
          panel.count === undefined ? '' : `<span class="cp-count">${panel.count}</span>`
        }</button>`
      )
      .join('')
  }</div>${
    panels
      .map((panel, position) =>
        `<section class="cp-panel" role="tabpanel" id="cp-panel-${panel.id}" aria-labelledby="cp-tab-${panel.id}"${
          position === 0 ? '' : ' hidden'
        }>${panel.html}</section>`
      )
      .join('')
  }`;
  const step = (item: CatalogCard | undefined, direction: 'prev' | 'next') =>
  {
    if (!item) return '';
    const shown = local(item);
    const number = shown.collectorNumber ? `<span class="cp-num">${escape(shown.collectorNumber)}</span>` : '';
    const name = `<span class="cp-step-name">${escape(shown.name)}</span>`;
    return `<a class="cp-step" rel="${direction}" href="${hrefFor(item)}" aria-label="${
      escape((direction === 'prev' ? labels.previous : labels.next) + ': ' + shown.name)
    }">${direction === 'prev' ? chevron('left') + number + name : name + number + chevron('right')}</a>`;
  };
  const meta = [card.collectorNumber, rarity]
    .filter((item): item is string => Boolean(item))
    .map(item => `<span aria-hidden="true"> · </span><span class="cp-num">${escape(item)}</span>`)
    .join('')
    + (magic && details?.cost
      ? `<span aria-hidden="true"> · </span><span class="cp-cost">${rich(details.cost)}</span>`
      : '');
  const print = `<section class="cp-print" aria-label="${
    escape(labels.printTitle)
  }">${chips}<form class="cp-add"><fieldset><legend class="cp-visually-hidden">${escape(labels.copies)}</legend>${
    [1, 2, 3, 4]
      .map(count =>
        `<label><input type="radio" name="copies" value="${count}"${count === 1 ? ' checked' : ''} aria-label="${
          escape(labels.copies)
        }: ${count}"/><span>${count}</span></label>`
      )
      .join('')
  }</fieldset><button class="primary cp-add-button" type="submit" aria-label="${
    escape(labels.addCopies(1))
  }"><span class="cp-add-long">${escape(labels.addCopies(1))}</span><span class="cp-add-short" aria-hidden="true">${
    escape(labels.addShort(1))
  }</span></button></form><p class="cp-print-status"><span>${escape(labels.printNote)}</span></p></section>`;
  const faqLabels = cardFaqLabels(request.language);
  const faq = cardFaq(request.language, {
    name: card.name,
    set: expansion.name,
    languages: printed.map(code => languageNames.of(code) ?? code),
    otherSets: otherSets(versions),
    illustrator: details?.illustrator,
    legal: details?.legal,
  });
  const faqHtml = `<section class="cp-faq" aria-labelledby="cp-faq-title"><h2 id="cp-faq-title">${
    escape(faqLabels.title(card.name))
  }</h2><div class="cp-faq-list">${
    faq.map(item => `<details><summary>${escape(item.question)}</summary><p>${escape(item.answer)}</p></details>`).join(
      '',
    )
  }</div></section>`;
  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
  const artist = details?.illustrator && info.illustrated.length
    ? `<section class="cp-related" aria-labelledby="cp-artist-title"><div class="cp-related-head"><h2 id="cp-artist-title">${
      escape(faqLabels.illustrated(details.illustrator))
    }</h2><a class="cp-all" href="${artistPath(request.language, request.game, details.illustrator)}">${
      escape(artistCopy[request.language].seeAll(details.illustrator))
    }</a></div><ul>${
      info
        .illustrated
        .map(item =>
        {
          const src = imageFor(item.card);
          return `<li><a class="cp-tile" href="${
            cardPath(request.language, request.game, item.set, item.slug)
          }"><span class="cp-tile-art">${
            src
              ? `<img src="${escape(src)}" alt="${
                escape(item.card.name)
              }" loading="lazy" referrerpolicy="no-referrer"/>`
              : ''
          }</span><span class="cp-tile-name">${escape(item.card.name)}</span><span class="cp-num">${
            escape([item.setName, item.card.collectorNumber].filter(Boolean).join(' · '))
          }</span></a></li>`;
        })
        .join('')
    }</ul></section>`
    : '';
  const shopLabels = shopCopy[request.language];
  const affiliate = affiliateConfig(process.env);
  // Price guide, decks on other sites, cards printed with this one and rulings: same sections as src/components/CardPage.tsx.
  // Each single-card shop is a tile with its price when a source gives one; sealed products are one line of links.
  const tiles = shopTiles(
    request.language,
    prices,
    singleCardShops(
      request.language,
      { name: target.name, set: expansion.name, number: card.collectorNumber ?? null },
      affiliate,
    ),
  );
  const tilesHtml = `<ul class="cp-shop-tiles">${
    tiles
      .map(tile =>
        `<li><a class="cp-shop-tile${tile.priced ? ' is-priced' : ''}" href="${
          escape(tile.url)
        }" target="_blank" rel="${tile.rel}"><span class="cp-shop-name">${
          escape(tile.shop)
        }${externalIcon}</span><strong>${escape(tile.value)}</strong>${
          tile.foil ? `<em>${escape(extras.foil)}</em>` : ''
        }</a></li>`
      )
      .join('')
  }</ul>${
    prices.length
      ? `<p class="cp-shops-note">${
        escape(extras.priceNote(formatDay(request.language, latestPriceDay(prices), 'short')))
      }</p>`
      : ''
  }`;
  const sealedHtml = `<p class="cp-sealed">${escape(shopLabels.sealed(expansion.name))}: ${
    sealedShops(request.language, { game: gameLabel, set: expansion.name }, affiliate)
      .map(link =>
        `<a href="${escape(link.url)}" target="_blank" rel="${shopRel(link)}">${escape(link.shop)}${externalIcon}</a>`
      )
      .join('<span aria-hidden="true"> · </span>')
  }</p>`;
  const sites = [
    ...deckSites(request.game, { englishName: target.name, number: card.collectorNumber ?? null }),
    ...(details?.deckLinks ?? []),
  ];
  const deckCopy = deckSitesCopy[request.language];
  // Public decks with the card (Archidekt, Magic) as tiles; links to the other deck sites below them.
  const listed = info.decks ?? [];
  const siteLinks = sites
    .map(site =>
      `<a href="${escape(site.url)}" target="_blank" rel="noopener">${
        escape(site.site)
      }<span>${externalIcon}</span></a>`
    )
    .join(' · ');
  const decksHtml = listed.length || sites.length
    ? `<section class="cp-decks" aria-labelledby="cp-decks-title"><div class="cp-related-head"><h2 id="cp-decks-title">${
      escape(deckCopy.title)
    }</h2>${listed.length ? `<span class="cp-decks-source">${escape(deckCopy.source)}</span>` : ''}</div>${
      listed.length
        ? `<ul class="cp-deck-list">${
          listed
            .map(deck =>
              `<li><a class="cp-deck" href="${
                escape(deck.url)
              }" target="_blank" rel="noopener"><span class="cp-deck-art">${
                deck.image
                  ? `<img src="${escape(deck.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>`
                  : ''
              }</span><span class="cp-deck-name">${escape(deck.name)}</span><span class="cp-deck-meta">${
                escape(deckMeta(request.language, deck))
              }</span></a></li>`
            )
            .join('')
        }</ul>`
        : ''
    }${
      sites.length
        ? `<p class="cp-decks-more">${escape(listed.length ? deckCopy.more : deckCopy.hint)} ${siteLinks}</p>`
        : ''
    }</section>`
    : '';
  const together = info.printedWith ?? [];
  const printedWithHtml = together.length
    ? `<section class="cp-related" aria-labelledby="cp-together-title"><div class="cp-related-head"><h2 id="cp-together-title">${
      escape(extras.printedWith)
    }</h2></div><p class="cp-related-note">${escape(extras.printedWithNote)}</p><ul>${
      together
        .map(item =>
        {
          const src = imageFor(item.card);
          return `<li><a class="cp-tile" href="${
            cardPath(request.language, request.game, item.set, item.slug)
          }"><span class="cp-tile-art">${
            src
              ? `<img src="${escape(src)}" alt="${
                escape(item.card.name)
              }" loading="lazy" referrerpolicy="no-referrer"/>`
              : ''
          }</span><span class="cp-tile-name">${escape(item.card.name)}</span><span class="cp-num">${
            escape(extras.together(item.together))
          }</span></a></li>`;
        })
        .join('')
    }</ul></section>`
    : '';
  const shops = `<section class="cp-shops" aria-labelledby="cp-shops-title"><h2 id="cp-shops-title">${
    escape(shopLabels.title)
  }</h2>${tilesHtml}${sealedHtml}</section>`;
  const neighbours = related.length
    ? `<section class="cp-related" aria-labelledby="cp-neighbours-title"><div class="cp-related-head"><h2 id="cp-neighbours-title">${
      escape(labels.more(expansion.name))
    }</h2><a class="cp-all" href="${setHref}">${escape(labels.back(expansion.name))}</a></div><ul>${
      related.map(item => tile(item, local(item).name)).join('')
    }</ul></section>`
    : '';
  const page =
    `<article class="card-page" aria-labelledby="card-title"><header class="cp-top"><nav class="cp-trail" aria-label="${
      escape(labels.breadcrumb)
    }"><a href="${seoPath(request.language)}">SleeveReady</a><span aria-hidden="true">/</span><a href="${
      seoPath(request.language, request.game)
    }">${escape(gameLabel)}</a><span aria-hidden="true">/</span><a href="${setHref}">${
      escape(expansion.name)
    }</a><span aria-hidden="true">/</span><span aria-current="page">${
      escape(card.name)
    }</span></nav><nav class="cp-steps" aria-label="${escape(labels.more(expansion.name))}">${step(previous, 'prev')}${
      step(next, 'next')
    }</nav></header><div class="cp-main"><figure class="cp-figure"><div class="cp-art">${
      image
        ? `<img src="${escape(image)}" alt="${escape(card.name)}" referrerpolicy="no-referrer" fetchpriority="high"/>`
        : ''
    }</div></figure><div class="cp-body"><h1 id="card-title">${
      escape(card.name)
    }</h1><p class="cp-meta"><a href="${setHref}">${escape(expansion.name)}</a>${meta}</p><p class="cp-summary">${
      escape(summary)
    }</p><div class="cp-dossier">${tabsHtml}</div>${print}${shops}</div></div>${printedWithHtml}${decksHtml}${artist}${faqHtml}${neighbours}</article>`;
  const html = `<!doctype html>
<html lang="${request.language}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="description" content="${escape(description)}"/>
  <meta name="robots" content="${cardPagesIndexed(request.game) ? 'index,follow' : 'noindex,follow'}"/>
  <meta name="theme-color" content="#24232a"/>
  <link rel="canonical" href="${canonical}"/>
  ${alternates}
  <link rel="alternate" hreflang="x-default" href="${
    origin + cardPath('en', request.game, request.set, request.card)
  }"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="SleeveReady"/>
  <meta property="og:title" content="${escape(copy.title)}"/>
  <meta property="og:description" content="${escape(description)}"/>
  <meta property="og:url" content="${canonical}"/>
  <meta property="og:image" content="${escape(absoluteImage)}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <title>${escape(copy.title)}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
  <link rel="manifest" href="/site.webmanifest"/>
  ${appStyles(development)}
  <script type="application/ld+json">${JSON.stringify(breadcrumb).replace(/</g, '\\u003c')}</script>
  <script type="application/ld+json">${JSON.stringify(faqData).replace(/</g, '\\u003c')}</script>
  <script type="application/json" id="card-info-data">${
    JSON.stringify({ key: `${expansion.id}/${request.card}/${request.language}`, data: info }).replace(/</g, '\\u003c')
  }</script>
</head>
<body><div id="root"><div class="app-shell" data-game="${
  gameTheme(catalog.game.name)
}"><header class="topbar"><a class="brand" href="${
  seoPath(request.language)
}" aria-label="SleeveReady"><img class="brand-icon" src="/favicon.svg" alt=""/>Sleeve<span>Ready</span></a></header><main><div class="card-workspace">${page}</div></main>${
  legalFooterHtml(request.language)
}</div></div>${appScript(development)}</body>
</html>\n`;
  return { status: 200, html };
}
