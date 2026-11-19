// Card page as a dossier: the card stays put on the left, a tabbed file holds text, data and versions, and the print
// bar at the foot of the column carries the printed language next to the copies. server/card-pages.ts renders the same markup.
import React, { useEffect, useRef, useState } from 'react';
import type { CardExpansion, CardInfo, CatalogCard } from '../../shared/model';
import {
  artistCopy,
  cardDetailLabels,
  cardFaq,
  cardFaqLabels,
  cardGameRows,
  cardLabels,
  cardSummary,
  rarityName,
  type SeoGameSlug,
  type SeoLanguage,
} from '../../shared/seo';
import {
  cardExtrasCopy,
  formatDay,
  latestPriceDay,
  shopTiles,
  shownPrices,
  type ShopTile,
} from '../../shared/card-extras';
import { deckMeta, deckSites, deckSitesCopy } from '../../shared/deck-sites';
import { hasSymbols, textParts } from '../../shared/card-symbols';
import type { Language } from '../lib/i18n';
import { CardImage } from './CardImage';
import { externalIcon, sealedShops, shopCopy, shopRel, singleCardShops } from '../../shared/affiliate';
import { affiliate } from '../lib/affiliate';

type Props = {
  gameSlug: SeoGameSlug | null;
  card: CatalogCard;
  cards: CatalogCard[];
  slugs: Map<number, string>;
  expansion: CardExpansion;
  gameLabel: string;
  seoLanguage: SeoLanguage;
  language: Language;
  mode: string;
  printLanguages: string[];
  printLanguage: string;
  onPrintLanguage: (code: string) => void;
  languageName: (code: string) => string;
  quantity: number;
  onAdd: (copies: number) => void;
  sheetCopies: number;
  sheetPages: number;
  onPreview: () => void;
  homeHref: string;
  gameHref: string;
  setHref: string;
  cardHref: (slug: string) => string;
  onOpenCard: (card: CatalogCard) => void;
  onOpenSet: () => void;
  // Versions, game data and names from the server (null while loading); versions in currentSet open in place.
  info: CardInfo | null;
  currentSet: string;
  versionHref: (item: CardInfo['versions'][number]) => string;
  // Games whose source has card text show the Text tab while it loads, so the tab row does not shift.
  hasCardText: boolean;
  // The illustrator's page on this site (full navigation: it is server-rendered).
  artistHref: (name: string) => string;
};
type Tab = 'text' | 'data' | 'formats' | 'rulings' | 'versions';

const Chevron = ({ direction }: { direction: 'left' | 'right' }) => (
  <svg className="cp-chevron" viewBox="0 0 16 16" aria-hidden="true">
    <path d={direction === 'left' ? 'M10 3 5 8l5 5' : 'm6 3 5 5-5 5'} />
  </svg>
);
const COPY_OPTIONS = [1, 2, 3, 4];

export function CardPage(props: Props)
{
  const { cards, slugs, expansion, seoLanguage, language, mode } = props;
  // The page reads in its own language; only the image follows the printed language chosen in the print bar.
  const printed = props.card;
  const card = props.info?.card ?? printed;
  const labels = cardLabels[seoLanguage];
  const detailLabels = cardDetailLabels[seoLanguage];
  const index = cards.indexOf(printed);
  const previous = index > 0 ? cards[index - 1] : undefined;
  const next = index >= 0 && index < cards.length - 1 ? cards[index + 1] : undefined;
  const loading = props.info === null;
  const details = props.info?.details ?? null;
  const names = props.info?.names ?? [];
  // Until the server answers, the loaded set already gives the versions with this number or this name.
  const token = (item: CatalogCard) => item.rarity === 'Token' || item.rarity === 'Emblem';
  const versions = (props.info?.versions
    ?? cards
      .filter(item =>
        item !== printed && token(item) === token(card)
        && ((item.collectorNumber && item.collectorNumber === card.collectorNumber)
          || item.name.toLowerCase() === card.name.toLowerCase())
      )
      .map(item => ({
        card: item,
        set: props.currentSet,
        setName: expansion.name,
        setCode: expansion.code,
        slug: slugs.get(item.id) ?? '',
      })))
    .map(item => ({
      ...item,
      card: item.set === props.currentSet
        ? cards.find(local => slugs.get(local.id) === item.slug) ?? item.card
        : item.card,
    }));
  const inSet = new Set(versions.filter(item => item.set === props.currentSet).map(item => item.card));
  const neighbours = cards
    .slice(Math.max(0, index - 6), index + 7)
    .filter(item => item !== printed && !inSet.has(item))
    .slice(0, 12);
  const languages = props.printLanguages.length ? props.printLanguages : [printed.language ?? 'en'];
  const gameRows = details ? cardGameRows(seoLanguage, details) : [];
  // Price guide, decks on other sites, cards printed with this one and rulings (as in server/card-pages.ts).
  const englishName = props.info?.englishName ?? (printed.language === 'en' ? printed.name : card.name);
  const magic = props.gameSlug === 'magic-the-gathering';
  const extras = cardExtrasCopy[seoLanguage];
  const prices = shownPrices(details?.prices ?? []);
  const rulings = details?.rulings ?? [];
  const formats = details?.formats ?? [];
  const together = props.info?.printedWith ?? [];
  const sites = props.gameSlug && props.info
    ? [
      ...deckSites(props.gameSlug, { englishName: props.info.englishName, number: card.collectorNumber ?? null }),
      ...(details?.deckLinks ?? []),
    ]
    : [];
  const deckCopy = deckSitesCopy[seoLanguage];
  const listed = props.info?.decks ?? [];
  const faqLabels = cardFaqLabels(seoLanguage);
  const shopLabels = shopCopy[seoLanguage];
  const illustrated = props.info?.illustrated ?? [];
  const faq = cardFaq(seoLanguage, {
    name: card.name,
    set: expansion.name,
    languages: languages.map(props.languageName),
    otherSets: versions.filter(item => item.set !== props.currentSet).map(item => item.setName),
    illustrator: details?.illustrator,
    legal: details?.legal,
  });
  // The catalogue list has no rarity for some sources (Pokémon); the card's own data does.
  const rarity = rarityName(seoLanguage, card.rarity ?? details?.rarity ?? null);
  // The print bar is sticky at bottom:-1px, so it is stuck exactly when it is not fully visible.
  const printBar = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() =>
  {
    const element = printBar.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(entry.intersectionRatio < 1 && entry.boundingClientRect.top > 0),
      { threshold: [1] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const summary = cardSummary(seoLanguage, {
    name: card.name,
    set: expansion.name,
    number: card.collectorNumber ?? null,
    kind: details?.kind,
    hp: details?.hp,
    illustrator: details?.illustrator,
    otherSets: versions.filter(item => item.set !== props.currentSet).map(item => item.setName),
  });
  const hasText = Boolean(details?.blocks.length) || (loading && props.hasCardText);
  const tabs: { id: Tab; label: string; count?: number }[] = [
    ...(hasText ? [{ id: 'text' as const, label: detailLabels.tabs.text }] : []),
    { id: 'data', label: detailLabels.tabs.data },
    ...(formats.length ? [{ id: 'formats' as const, label: extras.formats }] : []),
    ...(rulings.length ? [{ id: 'rulings' as const, label: extras.rulings, count: rulings.length }] : []),
    ...(versions.length
      ? [{ id: 'versions' as const, label: detailLabels.tabs.versions, count: versions.length }]
      : []),
  ];
  const [chosen, setChosen] = useState<Tab | null>(null);
  const tab = tabs.find(item => item.id === chosen)?.id ?? tabs[0].id;
  // Signature: a version tile under the pointer or focus takes the card slot until it leaves.
  // A language switch shows the card skeleton until the new printing's image has loaded: the card object of the click
  // tells when the new list arrived, the image src tells whether there is a new image to wait for.
  const art = useRef<HTMLDivElement>(null);
  const [switching, setSwitching] = useState<{ card: CatalogCard; src: string } | null>(null);
  const arrived = Boolean(switching) && printed !== switching?.card;
  useEffect(() =>
  {
    if (!switching || !arrived) return;
    const image = art.current?.querySelector('img');
    if (!image || image.src === switching.src || (image.complete && image.naturalWidth > 0)) setSwitching(null);
  }, [switching, arrived, printed]);
  // The app goes back to the previous language when the card is missing from the chosen one.
  useEffect(() =>
  {
    if (switching && !arrived && props.printLanguage === switching.card.language) setSwitching(null);
  }, [switching, arrived, props.printLanguage]);
  useEffect(() =>
  {
    if (!switching) return;
    const timer = setTimeout(() => setSwitching(null), 15000);
    return () => clearTimeout(timer);
  }, [switching]);
  const switchLanguage = (code: string) =>
  {
    if (code === props.printLanguage) return;
    setSwitching({ card: printed, src: art.current?.querySelector('img')?.src ?? '' });
    props.onPrintLanguage(code);
  };
  const [preview, setPreview] = useState<CardInfo['versions'][number] | null>(null);
  const shown = preview ? versions.find(item => item.set === preview.set && item.slug === preview.slug) ?? null : null;
  const link = (
    item: CatalogCard,
    className: string,
    content: React.ReactNode,
    extra?: React.AnchorHTMLAttributes<HTMLAnchorElement>,
  ) =>
  {
    const slug = slugs.get(item.id);
    return slug
      ? (
        <a
          className={className}
          href={props.cardHref(slug)}
          {...extra}
          onClick={event =>
          {
            event.preventDefault();
            setPreview(null);
            props.onOpenCard(item);
          }}
        >
          {content}
        </a>
      )
      : null;
  };
  const openSet = (event: React.MouseEvent) =>
  {
    event.preventDefault();
    props.onOpenSet();
  };
  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>) =>
  {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const edge = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (!step && edge < 0) return;
    event.preventDefault();
    const position = edge >= 0 ? edge : (tabs.findIndex(item => item.id === tab) + step + tabs.length) % tabs.length;
    setChosen(tabs[position].id);
    (event.currentTarget.parentElement?.children[position] as HTMLElement | undefined)?.focus();
  };
  const record: [string, React.ReactNode][] = [
    [labels.set, <a key="set" href={props.setHref} onClick={openSet}>{expansion.name}</a>],
    ...(card.collectorNumber
      ? [[labels.number, <span key="n" className="cp-num">{card.collectorNumber}</span>] as [string, React.ReactNode]]
      : []),
    ...(details?.kind ? [[detailLabels.kind, details.kind] as [string, React.ReactNode]] : []),
    ...(rarity ? [[labels.rarity, rarity] as [string, React.ReactNode]] : []),
    ...(card.version ? [[labels.version, card.version] as [string, React.ReactNode]] : []),
    ...(details?.illustrator ? [[detailLabels.illustrator, details.illustrator] as [string, React.ReactNode]] : []),
    ...gameRows,
    ...(names.length
      ? [[
        detailLabels.names,
        <span key="names" className="cp-names">
          {names.map(item => (
            <span key={item.language}>
              <span lang={item.language}>{item.name}</span>{' '}
              <span className="cp-lang">{props.languageName(item.language)}</span>
            </span>
          ))}
        </span>,
      ] as [string, React.ReactNode]]
      : []),
    [labels.shownIn, props.languageName(printed.language ?? 'en')],
  ];
  const meta = [card.collectorNumber, rarity].filter(Boolean);
  return (
    <article className="card-page" aria-labelledby="card-title">
      <header className="cp-top">
        <nav className="cp-trail" aria-label={labels.breadcrumb}>
          <a href={props.homeHref}>SleeveReady</a>
          <span aria-hidden="true">/</span>
          <a href={props.gameHref}>{props.gameLabel}</a>
          <span aria-hidden="true">/</span>
          <a href={props.setHref} onClick={openSet}>{expansion.name}</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{card.name}</span>
        </nav>
        <nav className="cp-steps" aria-label={labels.more(expansion.name)}>
          {previous && link(
            previous,
            'cp-step',
            <>
              <Chevron direction="left" />
              <span className="cp-num">{previous.collectorNumber}</span>
              <span className="cp-step-name">{previous.name}</span>
            </>,
            { rel: 'prev', 'aria-label': `${labels.previous}: ${previous.name}` },
          )}
          {next && link(
            next,
            'cp-step',
            <>
              <span className="cp-step-name">{next.name}</span>
              <span className="cp-num">{next.collectorNumber}</span>
              <Chevron direction="right" />
            </>,
            { rel: 'next', 'aria-label': `${labels.next}: ${next.name}` },
          )}
        </nav>
      </header>
      <div className="cp-main">
        <figure className={'cp-figure' + (shown ? ' is-previewing' : '')}>
          <div
            className={'cp-art' + (switching ? ' is-switching' : '')}
            ref={art}
            aria-busy={Boolean(switching)}
            onLoadCapture={() =>
            {
              if (arrived)
              {
                setSwitching(null);
              }
            }}
            onErrorCapture={() =>
            {
              if (arrived) setSwitching(null);
            }}
          >
            {shown
              ? <CardImage key={'preview-' + shown.card.id} language={language} card={shown.card} mode={mode} />
              : <CardImage key={printed.id} language={language} card={printed} mode={mode} eager />}
          </div>
          {shown && (
            <p className="cp-preview-note" aria-live="polite">
              {detailLabels.previewing} · {[shown.setName, shown.card.collectorNumber].filter(Boolean).join(' · ')}
            </p>
          )}
        </figure>
        <div className="cp-body">
          <h1 id="card-title">{card.name}</h1>
          <p className="cp-meta">
            <a href={props.setHref} onClick={openSet}>{expansion.name}</a>
            {meta.map(item => (
              <React.Fragment key={item}>
                <span aria-hidden="true"> · </span>
                <span className="cp-num">{item}</span>
              </React.Fragment>
            ))}
            {magic && details?.cost && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="cp-cost">
                  <Rich text={details.cost} game={props.gameSlug} />
                </span>
              </>
            )}
          </p>
          <p className="cp-summary">{summary}</p>
          <div className="cp-dossier">
            <div className="cp-tabs" role="tablist" aria-label={card.name}>
              {tabs.map(item => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={'cp-tab-' + item.id}
                  aria-controls={'cp-panel-' + item.id}
                  aria-selected={item.id === tab}
                  tabIndex={item.id === tab ? 0 : -1}
                  onClick={() => setChosen(item.id)}
                  onKeyDown={onTabKey}
                >
                  {item.label}
                  {item.count !== undefined && <span className="cp-count">{item.count}</span>}
                </button>
              ))}
            </div>
            {hasText && (
              <section
                className="cp-panel"
                role="tabpanel"
                id="cp-panel-text"
                aria-labelledby="cp-tab-text"
                hidden={tab !== 'text'}
                aria-busy={loading}
              >
                {details
                  ? details.blocks.map((block, row) => (
                    <div className="cp-block" key={row}>
                      {(block.title || block.meta) && (
                        <p className="cp-block-head">
                          {block.title && <strong>{block.title}</strong>}
                          {block.meta && (
                            <span>
                              <Rich text={block.meta} game={props.gameSlug} />
                            </span>
                          )}
                        </p>
                      )}
                      {block.text?.split('\n').filter(line => line.trim()).map((line, part) => (
                        <p key={part}>
                          <Rich text={line} game={props.gameSlug} />
                        </p>
                      ))}
                    </div>
                  ))
                  : (
                    <div className="cp-block cp-block-loading" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
              </section>
            )}
            <section
              className="cp-panel"
              role="tabpanel"
              id="cp-panel-data"
              aria-labelledby="cp-tab-data"
              hidden={tab !== 'data'}
            >
              <dl className="cp-record">
                {record.map(([term, value]) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            {formats.length > 0 && (
              <section
                className="cp-panel"
                role="tabpanel"
                id="cp-panel-formats"
                aria-labelledby="cp-tab-formats"
                hidden={tab !== 'formats'}
              >
                <ul className="cp-formats">
                  {formats.map(item => (
                    <li key={item.format} className={'is-' + item.status}>
                      <span>{item.format}</span>
                      <strong>{extras.status[item.status]}</strong>
                    </li>
                  ))}
                </ul>
                <p className="cp-panel-note">{extras.formatsNote}</p>
              </section>
            )}
            {rulings.length > 0 && (
              <section
                className="cp-panel"
                role="tabpanel"
                id="cp-panel-rulings"
                aria-labelledby="cp-tab-rulings"
                hidden={tab !== 'rulings'}
              >
                <ul className="cp-rulings">
                  {rulings.map(item => (
                    <li key={item.date + item.text.slice(0, 40)}>
                      <time dateTime={item.date}>{formatDay(seoLanguage, item.date, 'short')}</time>
                      <p>{item.text}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {versions.length > 0 && (
              <section
                className="cp-panel"
                role="tabpanel"
                id="cp-panel-versions"
                aria-labelledby="cp-tab-versions"
                hidden={tab !== 'versions'}
              >
                <ul className="cp-versions" onMouseLeave={() => setPreview(null)}>
                  {versions.map(item =>
                  {
                    const content = (
                      <>
                        <span className="cp-tile-art">
                          <CardImage language={language} card={item.card} mode={mode} thumb />
                        </span>
                        <span className="cp-tile-name">{item.setName}</span>
                        <span className="cp-num">
                          {[item.card.collectorNumber, item.card.version].filter(Boolean).join(' · ')}
                        </span>
                      </>
                    );
                    const hover = {
                      onMouseEnter: () => setPreview(item),
                      onFocus: () => setPreview(item),
                      onBlur: () => setPreview(null),
                    };
                    const local = item.set === props.currentSet
                      ? cards.find(entry => slugs.get(entry.id) === item.slug)
                      : undefined;
                    return (
                      <li key={item.set + '/' + item.slug}>
                        <a
                          className="cp-tile"
                          href={item.set === props.currentSet ? props.cardHref(item.slug) : props.versionHref(item)}
                          {...hover}
                          onClick={local
                            ? event =>
                            {
                              event.preventDefault();
                              setPreview(null);
                              props.onOpenCard(local);
                            }
                            : undefined}
                        >
                          {content}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
          <section className="cp-print" aria-label={labels.printTitle} ref={printBar} data-stuck={stuck || undefined}>
            {languages.length > 1 && (
              <div className="cp-languages">
                <span id="cp-languages-title">{detailLabels.printLanguage}</span>
                <div role="radiogroup" aria-labelledby="cp-languages-title">
                  {languages.map(code => (
                    <button
                      key={code}
                      type="button"
                      role="radio"
                      aria-checked={code === props.printLanguage}
                      onClick={() => switchLanguage(code)}
                    >
                      {props.languageName(code)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <AddCopies labels={labels} onAdd={props.onAdd} disabled={Boolean(switching)} />
            <p className="cp-print-status" role="status">
              {props.quantity > 0 ? <strong>{labels.inSheet(props.quantity)}</strong> : <span>{labels.printNote}</span>}
              {props.sheetCopies > 0 && (
                <>
                  <span className="cp-print-sheet">{labels.sheet(props.sheetCopies, props.sheetPages)}</span>
                  <button type="button" className="cp-preview" onClick={props.onPreview}>{labels.preview}</button>
                </>
              )}
            </p>
          </section>
          <section className="cp-shops" aria-labelledby="cp-shops-title">
            <h2 id="cp-shops-title">{shopLabels.title}</h2>
            <ShopTiles
              tiles={shopTiles(
                seoLanguage,
                prices,
                singleCardShops(seoLanguage, {
                  name: englishName,
                  set: expansion.name,
                  number: card.collectorNumber ?? null,
                }, affiliate),
              )}
              foil={extras.foil}
            />
            {prices.length > 0 && (
              <p className="cp-shops-note">
                {extras.priceNote(formatDay(seoLanguage, latestPriceDay(prices), 'short'))}
              </p>
            )}
            <p className="cp-sealed">
              {shopLabels.sealed(expansion.name)}:{' '}
              {sealedShops(seoLanguage, { game: props.gameLabel, set: expansion.name }, affiliate).map((
                link,
                index,
              ) => (
                <React.Fragment key={link.shop}>
                  {index > 0 && <span aria-hidden="true"> · </span>}
                  <a href={link.url} target="_blank" rel={shopRel(link)}>
                    {link.shop}
                    <span dangerouslySetInnerHTML={{ __html: externalIcon }} />
                  </a>
                </React.Fragment>
              ))}
            </p>
          </section>
        </div>
      </div>
      {together.length > 0 && (
        <section className="cp-related" aria-labelledby="cp-together-title">
          <div className="cp-related-head">
            <h2 id="cp-together-title">{extras.printedWith}</h2>
          </div>
          <p className="cp-related-note">{extras.printedWithNote}</p>
          <ul>
            {together.map(item =>
            {
              const local = item.set === props.currentSet
                ? cards.find(entry => slugs.get(entry.id) === item.slug)
                : undefined;
              return (
                <li key={item.set + '/' + item.slug}>
                  <a
                    className="cp-tile"
                    href={item.set === props.currentSet ? props.cardHref(item.slug) : props.versionHref(item)}
                    onClick={local
                      ? event =>
                      {
                        event.preventDefault();
                        props.onOpenCard(local);
                      }
                      : undefined}
                  >
                    <span className="cp-tile-art">
                      <CardImage language={language} card={item.card} mode={mode} thumb />
                    </span>
                    <span className="cp-tile-name">{item.card.name}</span>
                    <span className="cp-num">{extras.together(item.together)}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {(listed.length > 0 || sites.length > 0) && (
        <section className="cp-decks" aria-labelledby="cp-decks-title">
          <div className="cp-related-head">
            <h2 id="cp-decks-title">{deckCopy.title}</h2>
            {listed.length > 0 && <span className="cp-decks-source">{deckCopy.source}</span>}
          </div>
          {listed.length > 0 && (
            <ul className="cp-deck-list">
              {listed.map(deck => (
                <li key={deck.url}>
                  <a className="cp-deck" href={deck.url} target="_blank" rel="noopener">
                    <span className="cp-deck-art">
                      {deck.image && <img src={deck.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                    </span>
                    <span className="cp-deck-name">{deck.name}</span>
                    <span className="cp-deck-meta">{deckMeta(seoLanguage, deck)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {sites.length > 0 && (
            <p className="cp-decks-more">
              {listed.length ? deckCopy.more : deckCopy.hint}{' '}
              {sites.map((site, index) => (
                <React.Fragment key={site.site}>
                  {index > 0 && ' · '}
                  <a href={site.url} target="_blank" rel="noopener">
                    {site.site}
                    <span dangerouslySetInnerHTML={{ __html: externalIcon }} />
                  </a>
                </React.Fragment>
              ))}
            </p>
          )}
        </section>
      )}
      {details?.illustrator && illustrated.length > 0 && (
        <section className="cp-related" aria-labelledby="cp-artist-title">
          <div className="cp-related-head">
            <h2 id="cp-artist-title">{faqLabels.illustrated(details.illustrator)}</h2>
            <a className="cp-all" href={props.artistHref(details.illustrator)}>
              {artistCopy[seoLanguage].seeAll(details.illustrator)}
            </a>
          </div>
          <ul>
            {illustrated.map(item =>
            {
              const local = item.set === props.currentSet
                ? cards.find(entry => slugs.get(entry.id) === item.slug)
                : undefined;
              return (
                <li key={item.set + '/' + item.slug}>
                  <a
                    className="cp-tile"
                    href={item.set === props.currentSet ? props.cardHref(item.slug) : props.versionHref(item)}
                    onClick={local
                      ? event =>
                      {
                        event.preventDefault();
                        props.onOpenCard(local);
                      }
                      : undefined}
                  >
                    <span className="cp-tile-art">
                      <CardImage language={language} card={item.card} mode={mode} thumb />
                    </span>
                    <span className="cp-tile-name">{item.card.name}</span>
                    <span className="cp-num">
                      {[item.setName, item.card.collectorNumber].filter(Boolean).join(' · ')}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section className="cp-faq" aria-labelledby="cp-faq-title">
        <h2 id="cp-faq-title">{faqLabels.title(card.name)}</h2>
        <div className="cp-faq-list">
          {faq.map(item => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
      {neighbours.length > 0 && (
        <section className="cp-related" aria-labelledby="cp-neighbours-title">
          <div className="cp-related-head">
            <h2 id="cp-neighbours-title">{labels.more(expansion.name)}</h2>
            <a className="cp-all" href={props.setHref} onClick={openSet}>{labels.back(expansion.name)}</a>
          </div>
          <ul>
            {neighbours.map(item => (
              <li key={item.id}>
                {link(
                  item,
                  'cp-tile',
                  <>
                    <span className="cp-tile-art">
                      <CardImage language={language} card={item} mode={mode} thumb />
                    </span>
                    <span className="cp-tile-name">{item.name}</span>
                    {item.collectorNumber && <span className="cp-num">{item.collectorNumber}</span>}
                  </>,
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

// Symbols in card text per game (shared/card-symbols.ts), same as server/card-pages.ts.
export function Rich({ text, game }: { text: string; game: SeoGameSlug | null })
{
  if (!game || !hasSymbols(game)) return <>{text}</>;
  return (
    <>
      {textParts(text, game).map((part, index) =>
        'symbol' in part
          ? (
            <img
              key={index}
              className="cp-symbol"
              src={part.url}
              alt={part.symbol}
              title={part.symbol}
              loading="lazy"
            />
          )
          : 'tag' in part
          ? <span key={index} className="cp-tag">{part.tag}</span>
          : <React.Fragment key={index}>{part.text}</React.Fragment>
      )}
    </>
  );
}

// Single-card shops: each a tile with its price when a source gives one (same markup as server/card-pages.ts).
export function ShopTiles({ tiles, foil }: { tiles: ShopTile[]; foil: string })
{
  return (
    <ul className="cp-shop-tiles">
      {tiles.map(tile => (
        <li key={tile.shop}>
          <a
            className={'cp-shop-tile' + (tile.priced ? ' is-priced' : '')}
            href={tile.url}
            target="_blank"
            rel={tile.rel}
          >
            <span className="cp-shop-name">
              {tile.shop}
              <span dangerouslySetInnerHTML={{ __html: externalIcon }} />
            </span>
            <strong>{tile.value}</strong>
            {tile.foil && <em>{foil}</em>}
          </a>
        </li>
      ))}
    </ul>
  );
}

function AddCopies(
  { labels, onAdd, disabled }: {
    labels: (typeof cardLabels)[SeoLanguage];
    onAdd: (copies: number) => void;
    disabled: boolean;
  },
)
{
  const [copies, setCopies] = useState(1);
  return (
    <form
      className="cp-add"
      onSubmit={event =>
      {
        event.preventDefault();
        onAdd(copies);
      }}
    >
      <fieldset>
        <legend className="cp-visually-hidden">{labels.copies}</legend>
        {COPY_OPTIONS.map(count => (
          <label key={count}>
            <input
              type="radio"
              name="copies"
              value={count}
              checked={count === copies}
              onChange={() => setCopies(count)}
              aria-label={`${labels.copies}: ${count}`}
            />
            <span>{count}</span>
          </label>
        ))}
      </fieldset>
      <button className="primary cp-add-button" type="submit" disabled={disabled} aria-label={labels.addCopies(copies)}>
        <span className="cp-add-long">{labels.addCopies(copies)}</span>
        <span className="cp-add-short" aria-hidden="true">{labels.addShort(copies)}</span>
      </button>
    </form>
  );
}

export function CardPageSkeleton({ label }: { label: string })
{
  return (
    <div className="card-page card-page-loading" role="status" aria-live="polite">
      <div className="cp-main">
        <div className="cp-art cp-placeholder" />
        <div className="cp-body">
          <p>{label}</p>
        </div>
      </div>
    </div>
  );
}
