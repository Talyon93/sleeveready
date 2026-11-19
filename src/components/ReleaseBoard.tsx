import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardExpansion, CardGame, CardInfo, CatalogCard, Envelope } from '../../shared/model';
import { cardExtrasCopy, shopTiles, shownPrices } from '../../shared/card-extras';
import { externalIcon, sealedShops, shopCopy, shopRel, singleCardShops } from '../../shared/affiliate';
import { affiliate } from '../lib/affiliate';
import {
  cardDetailLabels,
  cardGameRows,
  cardPath,
  cardSlugs,
  expansionSlug,
  rarityName,
  seoPath,
  seoSlugForGame,
  type SeoGameSlug,
  type SeoLanguage,
} from '../../shared/seo';
import { api } from '../lib/api';
import { homeCopy } from '../lib/homeCopy';
import type { Language } from '../lib/i18n';
import { AdSlot } from './AdSlot';
import { CardImage } from './CardImage';
import { Rich, ShopTiles } from './CardPage';

// The home page: the next sets of every game with their revealed cards, and the latest releases, as one board.
// Built from the same per-game answers the game pages use (kept by the CDN), so the home adds no server work; the
// cards of a row load only when it scrolls into view.
// Games with nothing new in the window still show their latest set, dated or not, at the end of the board.
type Row = {
  game: CardGame;
  icon: string;
  slug: SeoGameSlug;
  set: CardExpansion;
  date: string | null;
  revealed: number | null;
  kind: 'upcoming' | 'recent' | 'latest';
};
type Props = {
  games: CardGame[];
  language: Language;
  seoLanguage: SeoLanguage;
  locale: string;
  mode: string;
  sheetCount: number;
  iconFor: (name: string) => string;
  onAdd: (cards: CatalogCard[]) => void;
  onOpenSheet: () => void;
  onPaste: (text: string) => void;
};

const shortNames: Record<string, string> = {
  magic: 'Magic',
  pokemon: 'Pokémon',
  lorcana: 'Lorcana',
  'one-piece': 'One Piece',
  riftbound: 'Riftbound',
  yugioh: 'Yu-Gi-Oh!',
  'star-wars': 'Star Wars',
  fab: 'Flesh and Blood',
  'dragon-ball': 'Dragon Ball',
  vanguard: 'Vanguard',
  digimon: 'Digimon',
  sorcery: 'Sorcery',
  gundam: 'Gundam',
  'union-arena': 'Union Arena',
  palworld: 'Palworld',
  cyberpunk: 'Cyberpunk',
};
// Event promos, sleeve bundles and the like are not releases anyone waits for.
const minorSet =
  /promo|prerelease|sleeve|play network|magicfest|stardates|art series|minigame|alchemy|front cards|tokens?$/i;
const RECENT_DAYS = 60;
const dayMs = 864e5;
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);
const daysFrom = (date: string, today: string) =>
  Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / dayMs);

const plusIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M8 3v10M3 8h10" />
  </svg>
);
const arrowIcon = (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);
const listIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M6 5h9M6 9h9M6 13h6M3 5h.01M3 9h.01M3 13h.01" />
  </svg>
);
const sheetIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <rect x="3" y="1.5" width="10" height="13" rx="1" />
    <path d="M6.3 1.5v13M9.7 1.5v13M3 5.8h10M3 10.2h10" />
  </svg>
);

export function ReleaseBoard(
  { games, language, seoLanguage, locale, mode, sheetCount, iconFor, onAdd, onOpenSheet, onPaste }: Props,
)
{
  const copy = homeCopy[language];
  const [rows, setRows] = useState<Row[]>();
  const [failed, setFailed] = useState(false);
  const [cards, setCards] = useState<Record<number, CatalogCard[]>>({});
  const requested = useRef(new Set<number>());
  const [zoom, setZoom] = useState<{ row: Row; index: number } | null>(null);
  const zoomDialog = useRef<HTMLDialogElement>(null);
  useEffect(() =>
  {
    const dialog = zoomDialog.current;
    if (!dialog) return;
    if (zoom && !dialog.open) dialog.showModal();
    else if (!zoom && dialog.open) dialog.close();
  }, [zoom]);
  const [filter, setFilter] = useState(0);
  const [shown, setShown] = useState(10);
  const [open, setOpen] = useState<number>();
  const [paste, setPaste] = useState('');
  const today = isoDay(Date.now());
  const gameKey = games.map(game => game.id).join();
  useEffect(() =>
  {
    const listed = games.flatMap(game =>
    {
      const slug = seoSlugForGame(game.name + ' ' + game.displayName);
      return slug ? [{ game, slug }] : [];
    });
    if (listed.length < 2) return;
    const controller = new AbortController();
    const since = isoDay(Date.now() - RECENT_DAYS * dayMs);
    void Promise
      .all(
        listed
          .map(async ({ game, slug }) =>
          {
            const [sets, upcoming] = await Promise.all([
              api<Envelope<CardExpansion[]>>('expansions?gameId=' + game.id, controller.signal),
              api<Envelope<{ id: number; revealed: number }[]>>('upcoming?gameId=' + game.id, controller.signal).catch(
                () => ({ data: [] }),
              ),
            ]);
            const icon = iconFor(game.name);
            const row = (set: CardExpansion, kind: Row['kind'], revealed: number | null = null): Row => ({
              game,
              icon,
              slug,
              set,
              date: set.releaseDate ?? null,
              revealed,
              kind,
            });
            const dated = sets.data.filter(set => set.releaseDate);
            const next = upcoming.data.flatMap(item =>
            {
              const set = dated.find(entry => entry.id === item.id);
              return set ? [row(set, 'upcoming', item.revealed)] : [];
            });
            // Sets due in the next 60 days join even before 20 cards are revealed (the game's own upcoming row waits for those).
            const until = isoDay(Date.now() + RECENT_DAYS * dayMs);
            const soon = dated
              .filter(set =>
                set.releaseDate! > today && set.releaseDate! <= until && !minorSet.test(set.name)
                && !next.some(item => item.set.id === set.id)
              )
              .map(set => row(set, 'upcoming'));
            next.push(...soon);
            const recent = dated
              .filter(set => set.releaseDate! <= today && set.releaseDate! >= since && !minorSet.test(set.name))
              .sort((a, b) => b.releaseDate!.localeCompare(a.releaseDate!))
              .slice(0, 3)
              .map(set => row(set, 'recent'));
            if (next.length || recent.length)
            {
              return [...next, ...recent];
            }
            // The catalogue lists a game's sets newest first; the newest released (or undated) real set stands for the game.
            const latest = sets.data.find(set =>
              (!set.releaseDate || set.releaseDate <= today) && !minorSet.test(set.name)
            );
            return latest ? [row(latest, 'latest')] : [];
          })
          .map(task => task.catch(() => [] as Row[])),
      )
      .then(lists =>
      {
        if (controller.signal.aborted) return;
        const all = lists.flat();
        setRows(all);
        setFailed(!all.length);
      });
    return () => controller.abort();
    // The game list arrives once from the server; the board follows it.
  }, [gameKey]);

  const visible = useMemo(() =>
  {
    const list = (rows ?? []).filter(row => !filter || row.game.id === filter);
    const byDate = (a: Row, b: Row) => (b.date ?? '').localeCompare(a.date ?? '');
    const upcoming = list.filter(row => row.kind === 'upcoming').sort(byDate);
    const released = list.filter(row => row.kind === 'recent').sort(byDate);
    const others = list.filter(row => row.kind === 'latest').sort((a, b) =>
      byDate(a, b) || a.game.displayName.localeCompare(b.game.displayName)
    );
    return { upcoming, released: released.slice(0, shown), more: released.length > shown, others };
  }, [rows, filter, shown]);
  const boardGames = useMemo(() => [...new Map((rows ?? []).map(row => [row.game.id, row])).values()], [rows]);

  const cardLanguage = (game: CardGame) => game.printLanguages?.includes(seoLanguage) ? seoLanguage : 'en';
  function loadCards(row: Row)
  {
    if (requested.current.has(row.set.id)) return;
    requested.current.add(row.set.id);
    api<Envelope<CatalogCard[]>>(`cards?expansionId=${row.set.id}&language=${cardLanguage(row.game)}`).then(
      result => setCards(old => ({ ...old, [row.set.id]: result.data })),
      () => setCards(old => ({ ...old, [row.set.id]: [] })),
    );
  }
  // Rows fetch their cards as they come near the screen, so a long board costs only what is looked at.
  const observer = useRef<IntersectionObserver | null>(null);
  const rowsById = useRef(new Map<number, Row>());
  useEffect(() =>
  {
    if (typeof IntersectionObserver === 'undefined') return;
    observer.current = new IntersectionObserver(entries =>
    {
      for (const entry of entries)
      {
        if (entry.isIntersecting)
        {
          const row = rowsById.current.get(Number((entry.target as HTMLElement).dataset.set));
          if (row) loadCards(row);
          observer.current?.unobserve(entry.target);
        }
      }
    }, { rootMargin: '300px 0px' });
    return () => observer.current?.disconnect();
  }, []);
  const watch = (row: Row) => (element: HTMLElement | null) =>
  {
    rowsById.current.set(row.set.id, row);
    if (!element) return;
    if (observer.current) observer.current.observe(element);
    else loadCards(row);
  };

  // The board opens on the upcoming set with the most cards revealed, the one most visitors came for.
  useEffect(() =>
  {
    if (open === undefined && visible.upcoming.length)
    {
      const first = [...visible.upcoming].sort((a, b) => (b.revealed ?? 0) - (a.revealed ?? 0))[0];
      if (first?.revealed)
      {
        setOpen(first.set.id);
        loadCards(first);
      }
    }
  }, [visible.upcoming.length]);

  const chip = useRef<HTMLButtonElement>(null);
  const [bump, setBump] = useState(false);
  // A picked card flies into the sheet counter, which ticks up as it lands.
  function pick(card: CatalogCard, image: HTMLElement | null)
  {
    onAdd([card]);
    const target = chip.current;
    if (!image || !target || matchMedia('(prefers-reduced-motion: reduce)').matches)
    {
      setBump(true);
      setTimeout(() => setBump(false), 220);
      return;
    }
    const from = image.getBoundingClientRect(), to = target.getBoundingClientRect();
    const flyer = image.cloneNode(true) as HTMLElement;
    flyer.className = 'rb-flyer';
    Object.assign(flyer.style, {
      left: from.left + 'px',
      top: from.top + 'px',
      width: from.width + 'px',
      height: from.height + 'px',
    });
    document.body.append(flyer);
    flyer
      .animate([
        { transform: 'none', opacity: 1 },
        {
          transform: `translate(${to.right - 28 - from.left}px,${to.top + 4 - from.top}px) scale(${22 / from.width})`,
          opacity: .4,
        },
      ], { duration: 560, easing: 'cubic-bezier(.16,1,.3,1)' })
      .finished
      .finally(() =>
      {
        flyer.remove();
        setBump(true);
        setTimeout(() => setBump(false), 220);
      });
  }

  const date = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Date(value + 'T12:00:00Z').toLocaleDateString(locale, { ...options, timeZone: 'UTC' });
  // Sealed products of a set (partner links): a preorder before it is out, the boxes and packs after.
  const sealed = (row: Row) => (
    <p className="rb-sealed">
      <span>{row.kind === 'upcoming' ? copy.preorder : shopCopy[seoLanguage].sealedShort}</span>
      {sealedShops(seoLanguage, { game: row.game.displayName, set: row.set.name }, affiliate).map(link => (
        <a key={link.shop} href={link.url} target="_blank" rel={shopRel(link)}>
          {link.shop}
          <span dangerouslySetInnerHTML={{ __html: externalIcon }} />
        </a>
      ))}
    </p>
  );
  const renderRow = (row: Row) =>
  {
    const list = cards[row.set.id];
    const expanded = open === row.set.id;
    const days = row.date ? daysFrom(row.date, today) : null;
    const up = row.kind === 'upcoming';
    // A released set whose source has no card images yet (TCGdex lists a new Pokémon set before its scans) has no page and
    // nothing to add: the row says the images are coming instead of linking a missing page.
    const imageless = !up && list?.length === 0;
    const when = days === null ? copy.undated : copy.when(days);
    const long = row.date ? date(row.date, { day: 'numeric', month: 'long' }) : '';
    const href = seoPath(seoLanguage, row.slug, expansionSlug(row.set));
    const name = shortNames[row.icon]
      ?? row.game.displayName.replace(/ (Card Game|Official Card Game|Trading Card Game)$/i, '');
    const toggle = () =>
    {
      setOpen(expanded ? undefined : row.set.id);
      loadCards(row);
    };
    return (
      <li key={row.set.id} className={'rb-item' + (up ? ' is-up' : '')}>
        <div
          className="rb-row"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          data-set={row.set.id}
          ref={watch(row)}
          onClick={toggle}
          onKeyDown={event =>
          {
            if (event.key === 'Enter' || event.key === ' ')
            {
              event.preventDefault();
              toggle();
            }
          }}
        >
          {row.date
            ? (
              <span className="rb-date">
                <b>{date(row.date, { day: '2-digit' })}</b>
                <span>
                  {date(row.date, { month: 'short' })}
                  <br />
                  {date(row.date, { weekday: 'short' })}
                </span>
              </span>
            )
            : (
              <span className="rb-date is-undated">
                <b>–</b>
              </span>
            )}
          <span className="rb-when">
            {row.kind === 'latest' && row.date ? date(row.date, { month: 'short', year: 'numeric' }) : when}
          </span>
          <span className="rb-game" data-when={'· ' + when}>
            <span className={'game-mark ' + row.icon} aria-hidden="true" />
            {name}
          </span>
          <span className="rb-set">
            <b>{row.set.name}</b>
            {row.set.code && <small>{row.set.code.toUpperCase()}</small>}
          </span>
          <span className="rb-count">
            {up
              ? (
                <>
                  {copy.revealed(row.revealed)}
                  <span>{copy.printableNow}</span>
                </>
              )
              : (
                <>
                  {row.kind === 'latest' ? copy.latest : copy.outNow}
                  <span>{imageless ? copy.imagesComing : copy.printable}</span>
                </>
              )}
          </span>
          <span className="rb-fan" aria-hidden="true">
            {list?.slice(0, 3).map(card => (
              <span key={card.id}>
                <CardImage card={card} mode={mode} thumb />
              </span>
            ))}
          </span>
        </div>
        <div className={'rb-open' + (expanded ? ' is-open' : '')}>
          <div>
            {expanded && (
              <div className="rb-open-inner">
                <div className="rb-strip">
                  {list === undefined
                    ? <div className="loader" role="status" />
                    : list.slice(0, 24).map((card, index) => (
                      <div className="rb-card" key={card.id}>
                        <button
                          type="button"
                          className="rb-card-open"
                          aria-label={`${copy.details}: ${card.name}`}
                          onClick={() => setZoom({ row, index })}
                        >
                          <CardImage card={card} mode={mode} thumb />
                        </button>
                        <button
                          type="button"
                          className="rb-plus"
                          aria-label={copy.addCard(card.name)}
                          onClick={event => pick(card, event.currentTarget.parentElement?.querySelector('img') ?? null)}
                        >
                          {plusIcon}
                        </button>
                      </div>
                    ))}
                </div>
                <div className="rb-side">
                  <p>
                    {up
                      ? copy.upcomingNote(row.revealed, long)
                      : row.date
                      ? (imageless ? copy.imagesNote : copy.releasedNote)(long)
                      : ''}
                  </p>
                  {!imageless && (
                    <>
                      <button
                        className="primary"
                        type="button"
                        disabled={!list?.length}
                        onClick={() => list && onAdd(list)}
                      >
                        {up ? copy.addRevealed : copy.addSet}
                        {arrowIcon}
                      </button>
                      <a href={href}>{copy.open(row.set.name)}</a>
                    </>
                  )}
                  {sealed(row)}
                </div>
              </div>
            )}
          </div>
        </div>
      </li>
    );
  };

  // The card the visitor opened from a row, larger, with its page and the cards beside it (arrow keys too).
  const zoomList = zoom ? (cards[zoom.row.set.id] ?? []).slice(0, 24) : [];
  const zoomed = zoom && zoomList[zoom.index]
    ? {
      card: zoomList[zoom.index],
      count: zoomList.length,
      href: (() =>
      {
        const slug = cardSlugs(cards[zoom.row.set.id] ?? []).get(zoomList[zoom.index].id);
        return slug ? cardPath(seoLanguage, zoom.row.slug, expansionSlug(zoom.row.set), slug) : null;
      })(),
    }
    : null;
  // Its text and game data, the same answer the card page uses (kept a day by the CDN), loaded once per card.
  const [infos, setInfos] = useState<Record<string, CardInfo | null>>({});
  const zoomSlug = zoom && zoomList[zoom.index]
    ? cardSlugs(cards[zoom.row.set.id] ?? []).get(zoomList[zoom.index].id)
    : undefined;
  const infoKey = zoom && zoomSlug ? `${zoom.row.set.id}/${zoomSlug}/${zoomList[zoom.index].language ?? 'en'}` : '';
  useEffect(() =>
  {
    if (!infoKey || infoKey in infos) return;
    const [expansionId, slug, cardLanguage] = infoKey.split('/');
    api<Envelope<CardInfo>>(
      `card-info?expansionId=${expansionId}&card=${encodeURIComponent(slug)}&language=${
        encodeURIComponent(cardLanguage)
      }`,
    )
      .then(
        result => setInfos(old => ({ ...old, [infoKey]: result.data })),
        () => setInfos(old => ({ ...old, [infoKey]: null })),
      );
  }, [infoKey]);
  const step = (delta: number) =>
  {
    if (zoom && zoomList.length)
    {
      setZoom({ row: zoom.row, index: (zoom.index + delta + zoomList.length) % zoomList.length });
    }
  };
  return (
    <section className={'release-board' + (rows === undefined ? ' rb-loading' : '')} aria-labelledby="rb-title">
      <AdSlot kind="strip" language={language} />
      <AdSlot kind="rail" side="left" place="home" language={language} />
      <AdSlot kind="rail" side="right" place="home" language={language} />
      <div className="rb-head">
        <div>
          <h1 id="rb-title">{copy.title}</h1>
          <p>{copy.lead}</p>
        </div>
        <form
          className="rb-paste"
          onSubmit={event =>
          {
            event.preventDefault();
            onPaste(paste);
          }}
        >
          {listIcon}
          <input
            aria-label={copy.paste}
            placeholder={copy.paste}
            value={paste}
            onChange={event => setPaste(event.target.value)}
          />
          <button type="submit">{copy.build}{arrowIcon}</button>
        </form>
      </div>
      <div className="rb-controls">
        <div className="rb-filter" role="group" aria-label={copy.columns.game}>
          <button type="button" className="all" aria-pressed={!filter} onClick={() => setFilter(0)}>
            {copy.allGames}
          </button>
          {boardGames.map(row => (
            <button
              key={row.game.id}
              type="button"
              aria-pressed={filter === row.game.id}
              onClick={() => setFilter(filter === row.game.id ? 0 : row.game.id)}
            >
              <span className={'game-mark ' + row.icon} aria-hidden="true" />
              {shortNames[row.icon] ?? row.game.displayName}
            </button>
          ))}
        </div>
        <button
          ref={chip}
          type="button"
          className={'rb-sheet' + (bump ? ' bump' : '')}
          onClick={onOpenSheet}
          disabled={!sheetCount}
        >
          {sheetIcon}
          {copy.sheet}
          <span>{sheetCount}</span>
        </button>
      </div>
      <div className="rb-cols" aria-hidden="true">
        <span>{copy.columns.date}</span>
        <span>{copy.columns.when}</span>
        <span>{copy.columns.game}</span>
        <span>{copy.columns.set}</span>
        <span>{copy.columns.cards}</span>
        <span />
      </div>
      {rows === undefined
        ? (
          <ul className="rb-rows" role="status" aria-label={copy.loading}>
            {Array.from({ length: 10 }, (_, index) => (
              <li key={index} className="rb-skel">
                <i />
                <i />
                <i />
                <i />
              </li>
            ))}
          </ul>
        )
        : failed
        ? <p className="rb-empty">{copy.unavailable}</p>
        : (
          <ul className="rb-rows">
            {visible.upcoming.map(renderRow)}
            <li className="rb-today">{copy.today(date(today, { weekday: 'long', day: 'numeric', month: 'long' }))}</li>
            {visible.released.map(renderRow)}
          </ul>
        )}
      {visible.more && (
        <div className="rb-more">
          <button type="button" className="secondary" onClick={() => setShown(count => count + 10)}>
            {copy.earlier}
          </button>
        </div>
      )}
      <dialog
        ref={zoomDialog}
        className="rb-zoom"
        aria-label={copy.details}
        onClose={() => setZoom(null)}
        onClick={event =>
        {
          if (event.target === event.currentTarget)
          {
            setZoom(null);
          }
        }}
        onKeyDown={event =>
        {
          if (event.key === 'ArrowRight') step(1);
          if (event.key === 'ArrowLeft') step(-1);
        }}
      >
        {zoomed && (
          <div className="rb-zoom-body">
            <div className="rb-zoom-art">
              <CardImage card={zoomed.card} mode={mode} eager language={language} />
            </div>
            <div className="rb-zoom-info">
              <p className="rb-zoom-set">
                <span className={'game-mark ' + zoom!.row.icon} aria-hidden="true" />
                {[
                  zoom!.row.set.name,
                  zoomed.card.collectorNumber ? '#' + zoomed.card.collectorNumber : null,
                  rarityName(seoLanguage, zoomed.card.rarity ?? null),
                  zoomed.card.language?.toUpperCase(),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <h2>{zoomed.card.name}</h2>
              {(() =>
              {
                const info = infos[infoKey];
                if (info === undefined)
                {
                  return (
                    <div className="rb-zoom-loading" role="status">
                      <div className="loader" />
                    </div>
                  );
                }
                const details = info?.details;
                if (!details) return null;
                const labels = cardDetailLabels[seoLanguage];
                const extras = cardExtrasCopy[seoLanguage];
                const rows = cardGameRows(seoLanguage, details).filter(([label]) => label !== labels.cost);
                return (
                  <div className="rb-zoom-details">
                    {(details.kind || details.cost) && (
                      <p className="rb-zoom-kind">
                        {details.kind}
                        {details.cost && (
                          <span>
                            <Rich text={details.cost} game={zoom!.row.slug} />
                          </span>
                        )}
                      </p>
                    )}
                    {details.blocks.length > 0 && (
                      <div className="rb-zoom-text">
                        {details.blocks.map((block, index) => (
                          <p key={index}>
                            {block.title && (
                              <b>
                                {block.title}
                                {block.meta && (
                                  <span>
                                    {' '}
                                    · <Rich text={block.meta} game={zoom!.row.slug} />
                                  </span>
                                )}
                              </b>
                            )}
                            {block.text && <Rich text={block.text} game={zoom!.row.slug} />}
                          </p>
                        ))}
                      </div>
                    )}
                    {(rows.length > 0 || details.illustrator) && (
                      <dl className="rb-zoom-data">
                        {rows.map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>
                              <Rich text={value} game={zoom!.row.slug} />
                            </dd>
                          </div>
                        ))}
                        {details.illustrator && (
                          <div>
                            <dt>{labels.illustrator}</dt>
                            <dd>{details.illustrator}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                    <div className="rb-zoom-shops">
                      <p>{copy.buy}</p>
                      <ShopTiles
                        tiles={shopTiles(
                          seoLanguage,
                          shownPrices(details.prices ?? []),
                          singleCardShops(seoLanguage, {
                            name: info?.englishName || zoomed.card.name,
                            set: zoom!.row.set.name,
                            number: zoomed.card.collectorNumber ?? null,
                          }, affiliate),
                        )}
                        foil={extras.foil}
                      />
                    </div>
                  </div>
                );
              })()}
              {zoom!.row.kind === 'upcoming' && sealed(zoom!.row)}
              <div className="rb-zoom-actions">
                <button
                  className="primary"
                  type="button"
                  onClick={() =>
                  {
                    onAdd([zoomed.card]);
                    setBump(true);
                    setTimeout(() => setBump(false), 220);
                  }}
                >
                  {copy.add}
                  {plusIcon}
                </button>
                {zoomed.href && <a href={zoomed.href}>{copy.details}{arrowIcon}</a>}
              </div>
              <div className="rb-zoom-nav">
                <button type="button" aria-label={copy.previous} onClick={() => step(-1)}>
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M13 8H3M7 4 3 8l4 4" />
                  </svg>
                </button>
                <span>{zoom!.index + 1} / {zoomed.count}</span>
                <button type="button" aria-label={copy.next} onClick={() => step(1)}>{arrowIcon}</button>
              </div>
            </div>
            <button type="button" className="rb-zoom-close" aria-label={copy.close} onClick={() => setZoom(null)}>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="m4 4 8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        )}
      </dialog>
      {visible.others.length > 0 && (
        <ul className="rb-rows rb-others" aria-label={copy.others}>
          <li className="rb-today rb-section">{copy.others}</li>
          {visible.others.map(renderRow)}
        </ul>
      )}
    </section>
  );
}
