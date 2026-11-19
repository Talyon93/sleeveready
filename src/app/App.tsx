// The whole single-page app: catalogue, print sheet, print preview, account and card pages.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type {
  CardDetails,
  CardGame,
  CardExpansion,
  CardInfo,
  CardMarket,
  CatalogCard,
  TrayItem,
  Envelope,
  Status,
} from '../../shared/model';
import { paginateTray } from '../../shared/model';
import { api } from '../lib/api';
import { catalogCopy, dataSources } from '../lib/catalogCopy';
import { CardImage } from '../components/CardImage';
import { CardPage, CardPageSkeleton } from '../components/CardPage';
import { GlobalSearch } from '../components/GlobalSearch';
import { accessoryShops, externalIcon, sealedShops, shopCopy, shopRel } from '../../shared/affiliate';
import { accessoryCopy } from '../lib/accessoryCopy';
import { favoritesCopy } from '../lib/favoritesCopy';
import { affiliate } from '../lib/affiliate';
import { Quantity } from '../components/Quantity';
import { accountsEnabled, authPending, loadSupabase } from '../lib/supabase';
import { listDecks, removeDeck, saveDeck, type SavedDeck } from '../lib/decks';
import {
  forgetLocalSheet,
  listPrints,
  localPrints,
  rememberPrint,
  removePrint,
  sheetKey,
  uploadLocalPrints,
  uploadPrint,
  type PrintMethod,
  type PrintRecord,
} from '../lib/printHistory';
import { printHistoryCopy } from '../lib/printHistoryCopy';
import { PrintHistory } from '../components/PrintHistory';
import { TrayLanguage, trayLanguageMissing } from '../components/TrayLanguage';
import { MiniSheet } from '../components/MiniSheet';
import { AdSlot } from '../components/AdSlot';
import { initialLanguage, translate, type Language } from '../lib/i18n';
import { setIconGlyph } from '../lib/setIcons';
import {
  backSlot,
  cardGuideShapes,
  cutSvg,
  defaultSettings,
  loadPresets,
  loadPrintSettings,
  markRects,
  pageGuideLines,
  pageLayout,
  savePresets,
  savePrintSettings,
  type PrintPreset,
  type PrintSettings,
} from '../lib/printSettings';
import { PrintPanel } from '../components/PrintPanel';
import { layoutCopy } from '../lib/layoutCopy';
import { historyCopy } from '../lib/historyCopy';
import { downloadBlob, pagePng } from '../lib/printExport';
import { cutterCopy } from '../lib/cutterCopy';
import { printCopy } from '../lib/printCopy';
import { importCopy, importExamples, importTools } from '../lib/importCopy';
import { upcomingCopy } from '../lib/upcomingCopy';
import { mobileCopy } from '../lib/mobileCopy';
import { shareCopy } from '../lib/shareCopy';
import { SharedArrival } from '../components/SharedArrival';
import { releasedSince, revealedSince, sinceLastVisit, type LastVisit } from '../lib/sinceLastVisit';
import { decodeSharedList, encodeSharedList } from '../../shared/shareList';

import { gameIcon, gameTheme, magicGame, pokemonGame, primaryGames } from './games';
import { errorText, localeFor, releaseLabel } from './format';
import { embeddedCardInfo, serverHead, shellUpcoming } from './pageData';
import { BACK_KEY, KEEP_PROMPT_KEY, loadTray } from './storage';
import { GameTab } from '../components/GameTab';
import { withAd } from '../components/AdSlot';
import { AccountDialog } from '../components/AccountDialog';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { useSheetHistory } from '../hooks/useSheetHistory';
import { useTabSlots, useVisibleGameCount } from '../hooks/useLayoutFit';

type ImportResponse = { items: TrayItem[]; unresolved: string[]; pending?: string[]; scanFrom?: number | null };
import {
  artistPath,
  cardLabels,
  cardPath,
  cardSlugs,
  expansionSlug,
  featureLabels,
  gameMatchesSeoSlug,
  gameSetsInfo,
  isSeoLanguage,
  parseSeoPath,
  seoCardCopy,
  seoFeatureCopy,
  seoFeatures,
  seoGames,
  seoPageCopy,
  seoPath,
  seoSetCopy,
  seoSlugForGame,
  seoUi,
  type SeoFeature,
  type SeoLanguage,
} from '../../shared/seo';
import {
  skeletonCaption,
  skeletonCards,
  skeletonControls,
  skeletonTabs,
  skeletonTopCards,
  skeletonUpcoming,
} from '../../shared/catalog-shell';
import { recordPrints, topPrints, type TopCard } from '../lib/printStats';
import { ReleaseBoard } from '../components/ReleaseBoard';
import { printHashes, printPanelCopy } from '../lib/printPanelCopy';
import { knownGames } from '../lib/knownGames';
import { recordPrintHit, recordStep, whenPerson } from '../lib/analytics';

export function App()
{
  const initialRoute = useRef(parseSeoPath(location.pathname)).current;
  // The home (/en/, /it/…) shows the release board of every game until a game is chosen.
  const [home, setHome] = useState(!initialRoute.game);
  // Expansion pages (/it/pokemon/sv09/) open that set; the first manual change of game or set returns to the game URL.
  const routeSet = useRef(initialRoute.set);
  const [routeCard, setRouteCard] = useState(initialRoute.card);
  const [routeFeature, setRouteFeature] = useState(initialRoute.feature);
  const [topCards, setTopCards] = useState<TopCard[] | null>();
  const startWithMagic = !initialRoute.game || initialRoute.game === 'magic-the-gathering';
  const startWithPokemon = initialRoute.game === 'pokemon';
  const seededGames = knownGames;
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const cc = catalogCopy[language];
  const [status, setStatus] = useState<Status>();
  const [games, setGames] = useState<CardGame[]>(seededGames);
  const [gameId, setGameId] = useState(startWithPokemon ? pokemonGame.id : startWithMagic ? magicGame.id : 0);
  const [gamePickerOpen, setGamePickerOpen] = useState(false);
  const [gameQuery, setGameQuery] = useState('');
  const [expansions, setExpansions] = useState<CardExpansion[]>([]);
  const [expansionId, setExpansionId] = useState(0);
  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [unavailableExpansions, setUnavailableExpansions] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'set' | 'number-asc' | 'number-desc' | 'name-asc' | 'name-desc'>('set');
  const [rarityFilter, setRarityFilter] = useState('');
  const [printLanguage, setPrintLanguage] = useState<string>(language);
  const [availablePrintLanguages, setAvailablePrintLanguages] = useState<string[]>([]);
  const [languagesForExpansionId, setLanguagesForExpansionId] = useState(0);
  const [inTrayOnly, setInTrayOnly] = useState(false);
  const [expansionQuery, setExpansionQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerNotice, setPickerNotice] = useState('');
  const [limit, setLimit] = useState(48);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => catalogCopy[initialLanguage()].connecting);
  const [reload, setReload] = useState(0);
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [storageKey, setStorageKey] = useState('');
  const [preview, setPreview] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ page: number; pages: number } | null>(null);
  const [presets, setPresets] = useState<PrintPreset[]>(() =>
    loadPresets(defaultSettings(navigator.languages?.length ? navigator.languages : [navigator.language]))
  );
  const [exportingPage, setExportingPage] = useState<number | null>(null);
  const [backImage, setBackImage] = useState<string | null>(() =>
  {
    try
    {
      return localStorage.getItem(BACK_KEY);
    }
    catch
    {
      return null;
    }
  });
  const [printSettings, setPrintSettings] = useState<PrintSettings>(() =>
    loadPrintSettings(navigator.languages?.length ? navigator.languages : [navigator.language])
  );
  const [printing, setPrinting] = useState(false);
  const [refreshingImages, setRefreshingImages] = useState(false);
  const [imageMessage, setImageMessage] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string>();
  const [decksBusy, setDecksBusy] = useState(false);
  const [deckMessage, setDeckMessage] = useState('');
  const [prints, setPrints] = useState<PrintRecord[]>(() => localPrints());
  const [justPrinted, setJustPrinted] = useState(false);
  const [keepPrompt, setKeepPrompt] = useState(false);
  const reprinting = useRef(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importTokens, setImportTokens] = useState(false);
  const [importText, setImportText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importResult, setImportResult] = useState<{ cards: number; copies: number; unresolved: string[] }>();
  // Shared lists: ?list=… adds those cards to the sheet once the saved sheet is loaded; Share builds such a link.
  const [shareMessage, setShareMessage] = useState('');
  const [justShared, setJustShared] = useState(false);
  const sharedLoaded = useRef(false);
  // The cards of the link wait in the arrival dialog (SharedArrival) until the visitor prints them or adds them to the sheet.
  const [shared, setShared] = useState<{ items: TrayItem[]; missing: number } | null>(null);
  function takeShared(print: boolean)
  {
    if (!shared) return;
    const sc = shareCopy[language];
    const copies = shared.items.reduce((sum, item) => sum + item.quantity, 0);
    if (print)
    {
      recordStep('shared-print');
      reprinting.current = true;
      if (tray.length) setTray([]);
    }
    else
    {
      recordStep('shared-add');
      setShareMessage(sc.loaded(copies));
    }
    addImported(shared.items);
    setShared(null);
  }
  useEffect(() =>
  {
    if (!storageKey || sharedLoaded.current) return;
    sharedLoaded.current = true;
    const url = new URL(location.href);
    const entries = decodeSharedList(url.searchParams.get('list'));
    if (!url.searchParams.has('list')) return;
    url.searchParams.delete('list');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    if (!entries.length) return;
    const sc = shareCopy[language];
    const groups = [...new Set(entries.map(entry => entry.expansionId + '|' + entry.language))];
    void Promise
      .all(groups.map(async key =>
      {
        const [expansionId, lang] = key.split('|');
        try
        {
          return (await api<Envelope<CatalogCard[]>>(
            `cards?expansionId=${expansionId}&language=${encodeURIComponent(lang)}`,
          ))
            .data;
        }
        catch
        {
          return [];
        }
      }))
      .then(lists =>
      {
        const cards = new Map(lists.flat().map(card => [card.id, card]));
        const items = entries.flatMap(entry =>
        {
          const card = cards.get(entry.cardId);
          return card ? [{ card, quantity: entry.quantity }] : [];
        });
        const missing = entries.length - items.length;
        if (items.length)
        {
          setShared({ items, missing });
          recordStep('shared-open');
        }
        else if (missing) setShareMessage(sc.missing(missing));
      });
    // Runs once, when the saved sheet is ready.
  }, [storageKey]);
  const sheetHistory = useSheetHistory(tray, setTray);
  const visibleGameCount = useVisibleGameCount(games, user, language);
  const { slots: tabSlots, measure: measureTabs } = useTabSlots();
  async function shareList()
  {
    const sc = shareCopy[language];
    setShareMessage('');
    const url = new URL(location.origin + location.pathname);
    url.searchParams.set(
      'list',
      encodeSharedList(
        tray.filter(item => item.card.expansionId != null).map(item => ({
          expansionId: item.card.expansionId!,
          cardId: item.card.id,
          quantity: item.quantity,
          language: item.card.language ?? 'en',
        })),
      ),
    );
    // The link's preview picture is drawn now, while the link is being pasted: chat apps give up on a picture that takes
    // seconds to draw, and once drawn the CDN keeps it.
    new Image().src = '/api/catalog/share-image?list=' + encodeURIComponent(url.searchParams.get('list') ?? '');
    // Copied: the button says so for a moment.
    const done = () =>
    {
      setJustShared(true);
      setTimeout(() => setJustShared(false), 2400);
    };
    try
    {
      if (navigator.share && matchMedia('(pointer:coarse)').matches)
      {
        await navigator.share({ title: 'SleeveReady', url: url.href });
        recordStep('share');
        return;
      }
      await navigator.clipboard.writeText(url.href);
      setShareMessage('');
      done();
      recordStep('share');
    }
    catch (error)
    {
      if ((error as Error)?.name !== 'AbortError') setShareMessage(sc.failed);
    }
  }
  // Favourite games (signed-in users), kept in the account profile: first in the header, and a home visit opens the first.
  const favoriteGames = useMemo(() =>
  {
    const value: unknown = user?.user_metadata?.favorite_games;
    return Array.isArray(value) ? value.filter((id): id is number => Number.isSafeInteger(id)).slice(0, 5) : [];
  }, [user]);
  const [favoritesBusy, setFavoritesBusy] = useState(false);
  const [favoritesError, setFavoritesError] = useState('');
  async function toggleFavorite(id: number)
  {
    if (favoritesBusy) return;
    const supabase = await loadSupabase();
    if (!supabase) return;
    const next = favoriteGames.includes(id)
      ? favoriteGames.filter(item => item !== id)
      : [...favoriteGames, id].slice(0, 5);
    setFavoritesBusy(true);
    setFavoritesError('');
    try
    {
      const { data, error } = await supabase.auth.updateUser({ data: { favorite_games: next } });
      if (error) throw error;
      if (data.user) setUser(data.user);
    }
    catch
    {
      setFavoritesError(favoritesCopy[language].failed);
    }
    finally
    {
      setFavoritesBusy(false);
    }
  }
  const openedFavorite = useRef(false);
  useEffect(() =>
  {
    // The game list starts with one seeded game and fills in from the server: wait until the favourite is in it.
    if (openedFavorite.current || !favoriteGames.length) return;
    const first = games.find(game => game.id === favoriteGames[0]);
    if (!first) return;
    openedFavorite.current = true;
    if (initialRoute.game || routeSet.current) return;
    if (first.id !== gameId) chooseGame(first.id);
    // Once, when the favourites and the game list are both known.
  }, [favoriteGames, games]);
  // Phones: filters fold away behind a button beside the search.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Upcoming expansions of the current game with revealed cards (preview seasons), from the server.
  const [upcoming, setUpcoming] = useState<{ id: number; revealed: number }[]>([]);
  const [upcomingReady, setUpcomingReady] = useState(false);
  const [upcomingShapes, setUpcomingShapes] = useState(shellUpcoming);
  useEffect(() =>
  {
    setUpcoming([]);
    if (!gameId || !status) return;
    if (status.mode !== 'live')
    {
      setUpcomingReady(true);
      return;
    }
    setUpcomingReady(false);
    const controller = new AbortController();
    api<Envelope<{ id: number; revealed: number }[]>>('upcoming?gameId=' + gameId, controller.signal).then(r =>
    {
      setUpcoming(r.data);
      setUpcomingReady(true);
    }, () =>
    {
      if (!controller.signal.aborted) setUpcomingReady(true);
    });
    return () => controller.abort();
  }, [gameId, status]);
  useEffect(() =>
  {
    if (upcomingReady && expansions.length) setUpcomingShapes(0);
  }, [upcomingReady, expansions]);
  // A returning visitor sees what is new in this game since the last visit: new sets are marked on their tab, and the coming
  // sets count the cards revealed since then. Read once the game's sets and coming sets are both in.
  const [lastVisit, setLastVisit] = useState<{ gameId: number; visit: LastVisit | null }>();
  useEffect(() =>
  {
    if (
      !upcomingReady || !gameId || !expansions.length || expansions[0].gameId !== gameId || lastVisit?.gameId === gameId
    ) return;
    setLastVisit({ gameId, visit: sinceLastVisit(gameId, new Date().toISOString().slice(0, 10), upcoming) });
  }, [upcomingReady, expansions, gameId]);
  const visit = lastVisit?.gameId === gameId ? lastVisit.visit : null;
  // Print preview: measured resolution per card, and the game text of cards printed as text proxies.
  const [printDpi, setPrintDpi] = useState<Record<number, number>>({});
  const [proxyText, setProxyText] = useState<Record<number, CardDetails | null>>({});
  const textRequested = useRef(new Set<number>());
  const noteResolution = useCallback(
    (cardId: number, dpi: number) => setPrintDpi(old => old[cardId] === dpi ? old : { ...old, [cardId]: dpi }),
    [],
  );
  const needText = useCallback((card: CatalogCard) =>
  {
    if (textRequested.current.has(card.id)) return;
    textRequested.current.add(card.id);
    const done = (details: CardDetails | null) => setProxyText(old => ({ ...old, [card.id]: details }));
    if (card.expansionId == null)
    {
      done(null);
      return;
    }
    api<Envelope<CardDetails | null>>(
      `card-text?expansionId=${card.expansionId}&cardId=${card.id}&language=${
        encodeURIComponent(card.language ?? 'en')
      }`,
    )
      .then(result => done(result.data && Array.isArray(result.data.blocks) ? result.data : null), () => done(null));
  }, []);
  const printDialog = useRef<HTMLDialogElement>(null);
  const accountDialog = useRef<HTMLDialogElement>(null);
  const importDialog = useRef<HTMLDialogElement>(null);
  useEffect(() =>
  {
    const controller = new AbortController();
    setLoading(cc.connecting);
    setError('');
    (async () =>
    {
      try
      {
        const [s, g] = await Promise.all([
          api<Status>('status', controller.signal),
          api<Envelope<CardGame[]>>('games', controller.signal),
        ]);
        setStatus(s);
        const key = 'sleeveready.tray.v1.' + s.mode;
        const storedTray = loadTray(key);
        sheetHistory.skipNext();
        setTray(storedTray);
        setStorageKey(key);
        setGames(g.data);
        const route = parseSeoPath(location.pathname);
        const routeGame = route.game
          ? g.data.find(game => gameMatchesSeoSlug(route.game!, game.name + ' ' + game.displayName))
          : undefined;
        setGameId(routeGame?.id ?? g.data[0]?.id ?? 0);
        if (!g.data.length) setLoading(cc.noGames);
      }
      catch (e)
      {
        if (!controller.signal.aborted)
        {
          setError(errorText(e, language));
          setLoading('');
        }
      }
    })();
    return () => controller.abort();
  }, [reload]);
  useEffect(() =>
  {
    if (!storageKey) return;
    try
    {
      localStorage.setItem(storageKey, JSON.stringify(tray));
    }
    catch
    {
      setError(cc.storageUnavailable);
    }
  }, [tray, storageKey]);
  useEffect(() =>
  {
    if (!gameId) return;
    const controller = new AbortController();
    setExpansions([]);
    setExpansionId(0);
    setCards([]);
    setExpansionQuery('');
    setPickerNotice('');
    setUnavailableExpansions(new Set());
    setLoading(cc.loadingExpansions);
    setError('');
    api<Envelope<CardExpansion[]>>('expansions?gameId=' + gameId, controller.signal)
      .then(r =>
      {
        setExpansions(r.data);
        const today = new Date().toISOString().slice(0, 10);
        const latestReleased = r.data.find(set =>
          set.releaseDate && set.releaseDate <= today && (routeFeature !== 'tokens' || set.hasTokens)
        );
        const nearestFuture = [...r.data]
          .filter(set => set.releaseDate && set.releaseDate > today)
          .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))[0];
        const currentGame = games.find(item => item.id === gameId);
        const routeGameMatches = Boolean(
          routeSet.current && initialRoute.game && currentGame
            && gameMatchesSeoSlug(initialRoute.game, currentGame.name + ' ' + currentGame.displayName),
        );
        const routeExpansion = routeGameMatches
          ? r.data.find(set => expansionSlug(set) === routeSet.current)
          : undefined;
        if (routeSet.current && currentGame && !routeExpansion) leaveSetPage(currentGame);
        const initialSet = routeExpansion ?? latestReleased ?? nearestFuture ?? r.data[0];
        autoPicked.current = routeExpansion ? 0 : initialSet?.id ?? 0;
        if (initialSet)
        {
          setExpansionId(initialSet.id);
          setExpansionQuery('');
        }
        else setLoading('');
      })
      .catch(e =>
      {
        if (!controller.signal.aborted)
        {
          setError(errorText(e, language));
          setLoading('');
        }
      });
    return () => controller.abort();
  }, [gameId, reload]);
  useEffect(() =>
  {
    setAvailablePrintLanguages([]);
    setLanguagesForExpansionId(0);
  }, [expansionId, gameId, reload]);
  useEffect(() =>
  {
    if (!expansionId) return;
    const controller = new AbortController();
    const selectedGame = games.find(item => item.id === gameId);
    const providerLanguages = selectedGame?.printLanguages ?? [];
    const hasNativeLanguages = providerLanguages.length > 0;
    const requestedLanguage = providerLanguages.includes(printLanguage)
      ? printLanguage
      : (providerLanguages.includes(language) ? language : 'en');
    // Switching the printed language keeps the set on screen (and the open card page): the cards, and so the images, change when they arrive.
    const sameSet = cardsLoadedFor.current === expansionId;
    cardsLoadedFor.current = expansionId;
    if (!sameSet)
    {
      setCards([]);
      setLoading(cc.loadingCards);
      setQuery('');
      setSort('set');
      setRarityFilter('');
      setInTrayOnly(false);
      setLimit(48);
    }
    setError('');
    const languageParam = hasNativeLanguages ? '&language=' + encodeURIComponent(requestedLanguage) : '';
    api<Envelope<CatalogCard[]>>('cards?expansionId=' + expansionId + languageParam, controller.signal)
      .then(r =>
      {
        if (!r.data.length)
        {
          // The set a game opens on by default (its newest released one) can be listed before its card images exist (TCGdex
          // lists a new Pokémon set days before its scans): the game opens on the next released set instead of an empty picker.
          const today = new Date().toISOString().slice(0, 10);
          const fallback = autoPicked.current === expansionId
            ? expansions.find(set =>
              set.id !== expansionId && !unavailableExpansions.has(set.id) && set.releaseDate
              && set.releaseDate <= today && (routeFeature !== 'tokens' || set.hasTokens)
            )
            : undefined;
          setUnavailableExpansions(old => new Set([...old, expansionId]));
          if (fallback)
          {
            autoPicked.current = fallback.id;
            setExpansionId(fallback.id);
            return;
          }
          setExpansionId(0);
          setCards([]);
          setExpansionQuery('');
          setPickerNotice(cc.hiddenExpansion);
          setPickerOpen(true);
          setLoading('');
          return;
        }
        // On an open card page, a language whose list lacks this card keeps the page and goes back to the previous language.
        if (sameSet && routeCard && cards.length)
        {
          const slugs = cardSlugs(r.data);
          if (!r.data.some(card => slugs.get(card.id) === routeCard))
          {
            const previous = cards[0].language;
            if (previous && previous !== printLanguage) setPrintLanguage(previous);
            setLoading('');
            return;
          }
        }
        setCards(r.data);
        const resolvedLanguage = r.data[0].language;
        if (hasNativeLanguages && resolvedLanguage)
        {
          setAvailablePrintLanguages(old => old.length ? old : [resolvedLanguage]);
          if (resolvedLanguage !== printLanguage) setPrintLanguage(resolvedLanguage);
        }
        setLoading('');
      })
      .catch(e =>
      {
        if (!controller.signal.aborted)
        {
          setError(errorText(e, language));
          setLoading('');
        }
      });
    return () => controller.abort();
  }, [expansionId, reload, printLanguage, gameId, games]);
  useEffect(() =>
  {
    if (!expansionId || !cards.length || languagesForExpansionId === expansionId) return;
    const selectedGame = games.find(item => item.id === gameId);
    if (!selectedGame?.printLanguages?.length) return;
    const controller = new AbortController();
    api<Envelope<string[]>>('languages?expansionId=' + expansionId, controller.signal)
      .then(result =>
      {
        const available = result.data.filter(code => selectedGame.printLanguages!.includes(code));
        setAvailablePrintLanguages(available.length ? available : [printLanguage]);
        setLanguagesForExpansionId(expansionId);
      })
      .catch(() =>
      {
        if (!controller.signal.aborted) setLanguagesForExpansionId(0);
      });
    return () => controller.abort();
  }, [expansionId, cards, gameId, games, printLanguage]);
  useEffect(() =>
  {
    if (preview) printDialog.current?.showModal();
    else printDialog.current?.close();
  }, [preview]);
  function closePreview()
  {
    setJustPrinted(false);
    if (history.state?.sleeveReadyPrint)
    {
      history.back();
      return;
    }
    setPreview(false);
    if (printHashes.has(location.hash.slice(1)))
    {
      history.replaceState(history.state, '', location.pathname + location.search);
    }
  }
  // Back and forward between a card and its set stay in the app, and so do opening and closing the print page (its own
  // history entry); other history entries reload the page. One listener, so whether the print page was open is read
  // before closing it.
  const previewShown = useRef(false);
  useEffect(() =>
  {
    previewShown.current = preview;
  }, [preview]);
  useEffect(() =>
  {
    const onPop = () =>
    {
      const toPrint = printHashes.has(location.hash.slice(1));
      const fromPrint = previewShown.current;
      if (!toPrint) setPreview(false);
      if (toPrint || fromPrint) return;
      const route = parseSeoPath(location.pathname);
      if (route.set && route.set === routeSet.current) setRouteCard(route.card);
      else location.reload();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // A reload or a shared address on the print page opens it again once the saved sheet is back.
  const reopenedPrint = useRef(false);
  useEffect(() =>
  {
    if (!storageKey || reopenedPrint.current) return;
    reopenedPrint.current = true;
    if (printHashes.has(location.hash.slice(1)) && tray.length) void openPreview();
  }, [storageKey]);
  useEffect(() => savePrintSettings(printSettings), [printSettings]);
  const cardSlugMap = useMemo(() => cardSlugs(cards), [cards]);
  const cardsLoadedFor = useRef(0);
  // The set the game page opened on by itself (not one from the address or picked by the visitor).
  const autoPicked = useRef(0);
  // The ranking for the "most printed" page of the current game.
  useEffect(() =>
  {
    if (routeFeature !== 'top-proxies' || !gameId) return;
    let active = true;
    setTopCards(undefined);
    topPrints(gameId).then(result =>
    {
      if (active) setTopCards(result);
    });
    return () =>
    {
      active = false;
    };
  }, [routeFeature, gameId]);
  useEffect(() =>
  {
    if (importOpen) importDialog.current?.showModal();
    else importDialog.current?.close();
  }, [importOpen]);
  const [authWanted, setAuthWanted] = useState(authPending);
  useEffect(() =>
  {
    // The account client loads only with a saved session or a sign-in in the address, or once the account dialog opens.
    if (!accountsEnabled || !authWanted) return;
    let live = true;
    let subscription: { unsubscribe(): void } | undefined;
    void loadSupabase().then(supabase =>
    {
      if (!supabase || !live) return;
      supabase
        .auth
        .getUser()
        .then(({ data }) =>
        {
          if (live) setUser(data.user);
        })
        .catch(() => setAuthMessage(cc.sessionError));
      subscription =
        supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null)).data.subscription;
    });
    return () =>
    {
      live = false;
      subscription?.unsubscribe();
    };
  }, [authWanted]);
  useEffect(() =>
  {
    if (accountOpen)
    {
      setAuthWanted(true);
      accountDialog.current?.showModal();
    }
    else accountDialog.current?.close();
  }, [accountOpen]);
  useEffect(() =>
  {
    if (user) void refreshDecks();
    else
    {
      setSavedDecks([]);
      setActiveDeckId(undefined);
    }
  }, [user]);
  // The history of prints: this device's for everyone; with an account, the account's, once this device's have joined it.
  useEffect(() =>
  {
    if (!user)
    {
      setPrints(localPrints());
      return;
    }
    let live = true;
    void uploadLocalPrints(user)
      .catch(() => undefined)
      .then(() => listPrints())
      .then(remote =>
      {
        if (live) setPrints([...remote, ...localPrints().filter(item => !item.synced)]);
      })
      .catch(() =>
      {
        if (live) setPrints(localPrints());
      });
    return () =>
    {
      live = false;
    };
  }, [user]);
  // A reprint loads the sheet first, then opens the print page on it.
  useEffect(() =>
  {
    if (reprinting.current)
    {
      reprinting.current = false;
      void openPreview();
    }
  }, [tray]);
  // Another language of a card on the sheet: the same printing takes its place, joining its copies if already there.
  function switchCardLanguage(from: CatalogCard, to: CatalogCard)
  {
    if (to.id === from.id) return;
    setTray(old =>
    {
      const existing = old.find(item => item.card.id === to.id);
      const moved = old.find(item => item.card.id === from.id);
      if (!moved) return old;
      if (existing)
      {
        return old.filter(item => item.card.id !== from.id).map(item =>
          item.card.id === to.id ? { ...item, quantity: Math.min(100, item.quantity + moved.quantity) } : item
        );
      }
      return old.map(item => item.card.id === from.id ? { ...item, card: to } : item);
    });
  }
  // A card added from the catalogue flies to its slot in the small sheet (or to the sheet bar on phones), where the
  // slot pops in as it lands. Skipped when the sheet is out of sight or motion is reduced.
  function flyToSheet(button: HTMLElement)
  {
    const image = button.querySelector('img');
    if (!image || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = [...document.querySelectorAll<HTMLElement>('.mini-slot.is-next,.mini-page,.mobile-sheet-bar')].find(
      element =>
      {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.bottom > 0 && box.top < innerHeight;
      },
    );
    if (!target) return;
    const from = image.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const flyer = image.cloneNode(true) as HTMLElement;
    flyer.className = 'sheet-flyer';
    flyer.removeAttribute('loading');
    Object.assign(flyer.style, {
      left: from.left + 'px',
      top: from.top + 'px',
      width: from.width + 'px',
      height: from.height + 'px',
    });
    document.body.append(flyer);
    const scale = Math.min(to.width / from.width, to.height / from.height);
    const dx = to.left + (to.width - from.width * scale) / 2 - from.left;
    const dy = to.top + (to.height - from.height * scale) / 2 - from.top;
    flyer
      .animate([
        { transform: 'none', opacity: 1 },
        {
          transform: `translate(${dx * .55}px,${dy * .55 - 60}px) scale(${(1 + scale) / 2}) rotate(-6deg)`,
          opacity: 1,
          offset: .55,
        },
        { transform: `translate(${dx}px,${dy}px) scale(${scale})`, opacity: .9 },
      ], { duration: 520, easing: 'cubic-bezier(.3,.7,.2,1)' })
      .finished
      .finally(() => flyer.remove());
  }
  function change(card: CatalogCard, n: number)
  {
    if (n > 0) recordStep('add');
    setTray(old =>
    {
      const total = old.reduce((s, i) => s + i.quantity, 0);
      if (n > 0 && total >= 900)
      {
        setError(cc.sheetLimit);
        return old;
      }
      const found = old.find(i => i.card.id === card.id);
      if (!found) return n > 0 ? [...old, { card, quantity: 1 }] : old;
      return old
        .map(i => i.card.id === card.id ? { card, quantity: Math.max(0, Math.min(100, i.quantity + n)) } : i)
        .filter(i => i.quantity > 0);
    });
  }
  // A game's page on this site, when it has one (demo games do not).
  function gameHref(item: CardGame)
  {
    const slug = seoSlugForGame(item.name + ' ' + item.displayName);
    return slug ? seoPath(seoLanguage, slug) : null;
  }
  function chooseGame(nextId: number)
  {
    setHome(false);
    routeSet.current = undefined;
    setRouteCard(undefined);
    setRouteFeature(undefined);
    setTopCards(undefined);
    setGameId(nextId);
    setGamePickerOpen(false);
    const next = games.find(item => item.id === nextId);
    const slug = seoSlugForGame((next?.name ?? '') + ' ' + (next?.displayName ?? ''));
    if (isSeoLanguage(language)) history.replaceState(null, '', seoPath(language, slug));
  }
  function leaveSetPage(current: CardGame | undefined)
  {
    if (!routeSet.current) return;
    routeSet.current = undefined;
    setRouteCard(undefined);
    if (isSeoLanguage(language))
    {
      history.replaceState(
        null,
        '',
        seoPath(language, seoSlugForGame((current?.name ?? '') + ' ' + (current?.displayName ?? ''))),
      );
    }
  }
  // Card details open in place: the URL becomes the card page, the back button returns to the list.
  function openCard(card: CatalogCard)
  {
    if (!isSeoLanguage(language) || !seoGameSlug || !expansion) return;
    const slug = cardSlugMap.get(card.id);
    if (!slug) return;
    routeSet.current = expansionSlug(expansion);
    setRouteCard(slug);
    history.pushState(null, '', cardPath(language, seoGameSlug, routeSet.current, slug));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function closeCard()
  {
    if (!isSeoLanguage(language) || !seoGameSlug || !routeSet.current) return;
    setRouteCard(undefined);
    history.pushState(null, '', seoPath(language, seoGameSlug, routeSet.current));
  }
  function chooseExpansion(id: number)
  {
    setExpansionId(id);
    if (routeSet.current && id !== expansionId) leaveSetPage(game);
  }
  function switchLanguage(next: Language)
  {
    if (isSeoLanguage(next))
    {
      const selected = home ? undefined : games.find(item => item.id === gameId);
      const slug = seoSlugForGame((selected?.name ?? '') + ' ' + (selected?.displayName ?? ''));
      location.assign(seoPath(next, slug));
      return;
    }
    setLanguage(next);
  }
  // Imported lists join the current sheet with the same limits as manual additions: 100 copies per card, 900 in total.
  function addImported(items: TrayItem[])
  {
    if (items.length) recordStep('add');
    setTray(old =>
    {
      const next = [...old];
      let total = next.reduce((sum, item) => sum + item.quantity, 0);
      for (const item of items)
      {
        const index = next.findIndex(existing => existing.card.id === item.card.id);
        const current = index < 0 ? 0 : next[index].quantity;
        const quantity = Math.min(100 - current, item.quantity, 900 - total);
        if (quantity <= 0) continue;
        total += quantity;
        if (index < 0) next.push({ card: item.card, quantity });
        else next[index] = { card: item.card, quantity: current + quantity };
      }
      return next;
    });
  }
  async function runImport()
  {
    if (!game || !importText.trim()) return;
    const ic = importCopy[language];
    const cardLanguage = game.printLanguages?.includes(printLanguage) ? printLanguage : 'en';
    setImportBusy(true);
    setImportStatus(ic.searching);
    setImportResult(undefined);
    const items: TrayItem[] = [];
    const unresolved: string[] = [];
    let body: { gameId: number; language: string; list: string; scanFrom?: number; tokens?: boolean } = {
      gameId: game.id,
      language: cardLanguage,
      list: importText,
      ...(importTokens && /magic/i.test(game.name) ? { tokens: true } : {}),
    };
    try
    {
      // The server answers within a time budget; lines still being searched come back as pending with the next set to scan.
      for (let round = 0; round < 5; round++)
      {
        const result = await api<Envelope<ImportResponse>>('import', undefined, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        items.push(...result.data.items);
        unresolved.push(...result.data.unresolved);
        const pending = result.data.pending ?? [];
        if (!pending.length || result.data.scanFrom == null) break;
        if (round === 4)
        {
          unresolved.push(...pending);
          break;
        }
        setImportStatus(ic.searchingOlder);
        body = { ...body, list: pending.join('\n'), scanFrom: result.data.scanFrom };
      }
      recordStep(/^\s*(https?:\/\/|www\.)\S+\s*$/i.test(importText) ? 'import-link' : 'import');
      addImported(items);
      setImportResult({ cards: items.length, copies: items.reduce((sum, item) => sum + item.quantity, 0), unresolved });
      setImportStatus('');
      if (items.length) setImportText(unresolved.join('\n'));
    }
    catch (e)
    {
      setImportStatus(errorText(e, language));
    }
    finally
    {
      setImportBusy(false);
    }
  }
  function move(index: number, delta: number)
  {
    setTray(old =>
    {
      const copy = [...old];
      [copy[index], copy[index + delta]] = [copy[index + delta], copy[index]];
      return copy;
    });
  }
  async function refreshDecks()
  {
    if (!user) return;
    setDecksBusy(true);
    try
    {
      setSavedDecks(await listDecks());
    }
    catch (e)
    {
      setDeckMessage(errorText(e, language));
    }
    finally
    {
      setDecksBusy(false);
    }
  }
  async function sendMagicLink()
  {
    const supabase = await loadSupabase();
    if (!supabase) return;
    setAuthBusy(true);
    setAuthMessage('');
    try
    {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setAuthMessage(t('emailReady'));
    }
    catch (e)
    {
      setAuthMessage(errorText(e, language));
    }
    finally
    {
      setAuthBusy(false);
    }
  }
  async function signInWithGoogle()
  {
    const supabase = await loadSupabase();
    if (!supabase) return;
    setAuthBusy(true);
    setAuthMessage('');
    try
    {
      const redirectTo = window.location.origin + window.location.pathname + window.location.search;
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) throw error;
    }
    catch (e)
    {
      setAuthMessage(errorText(e, language));
      setAuthBusy(false);
    }
  }
  async function signOut()
  {
    const supabase = await loadSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setAccountOpen(false);
  }
  async function persistDeck()
  {
    if (!user)
    {
      setAccountOpen(true);
      setAuthMessage(t('signInToSave'));
      return;
    }
    setDecksBusy(true);
    setDeckMessage('');
    try
    {
      const saved = await saveDeck(user, {
        id: activeDeckId,
        name: `${game?.displayName ?? t('defaultList')} · ${new Date().toLocaleDateString(localeFor(language))}`,
        gameId: game?.id ?? null,
        gameName: game?.displayName ?? null,
        items: tray,
      });
      setActiveDeckId(saved.id);
      setSavedDecks(old => [saved, ...old.filter(deck => deck.id !== saved.id)]);
      setDeckMessage(t('listSaved'));
    }
    catch (e)
    {
      setDeckMessage(errorText(e, language));
    }
    finally
    {
      setDecksBusy(false);
    }
  }
  function loadDeck(deck: SavedDeck)
  {
    setTray(deck.items);
    setActiveDeckId(deck.id);
    setDeckMessage(`${t('loaded')}: ${deck.name}.`);
    setAccountOpen(false);
  }
  async function deleteDeck(deck: SavedDeck)
  {
    if (!window.confirm(`${t('deleteListConfirm')} “${deck.name}”?`)) return;
    setDecksBusy(true);
    try
    {
      await removeDeck(deck.id);
      setSavedDecks(old => old.filter(item => item.id !== deck.id));
      if (activeDeckId === deck.id) setActiveDeckId(undefined);
    }
    catch (e)
    {
      setDeckMessage(errorText(e, language));
    }
    finally
    {
      setDecksBusy(false);
    }
  }
  // The print preview is a page of its own: it gets an address (#print, #stampa…) so the browser's Back returns to the cards.
  async function openPreview()
  {
    setPreview(true);
    setImageMessage('');
    recordStep('preview');
    if (!printHashes.has(location.hash.slice(1)))
    {
      history.pushState(
        { sleeveReadyPrint: true },
        '',
        location.pathname + location.search + '#' + printPanelCopy[language].hash,
      );
    }
    const sets = [
      ...new Set(
        tray.filter(i => !i.card.imageUrls).map(i => i.card.expansionId).filter((id): id is number => id !== null),
      ),
    ];
    if (mode !== 'live' || !sets.length) return;
    setRefreshingImages(true);
    try
    {
      for (const id of sets)
      {
        const result = await api<Envelope<CatalogCard[]>>('cards?expansionId=' + id);
        sheetHistory.skipNext();
        setTray(old => old.map(i => ({ ...i, card: result.data.find(c => c.id === i.card.id) ?? i.card })));
      }
    }
    catch (e)
    {
      setImageMessage(cc.refreshFailed(errorText(e, language)));
    }
    finally
    {
      setRefreshingImages(false);
    }
  }
  async function print()
  {
    setPrinting(true);
    setImageMessage('');
    try
    {
      const deadline = Date.now() + 20000;
      // Recheck after error handlers switch to a fallback source; do not print a pending image.
      while (true)
      {
        await new Promise(r => setTimeout(r, 100));
        const images = Array.from(document.querySelectorAll<HTMLImageElement>('.print-pages img'));
        if (images.every(img => img.complete && img.naturalWidth > 0)) break;
        if (Date.now() > deadline)
        {
          setImageMessage(printCopy[language].notReady);
          return;
        }
      }
      window.print();
      void recordPrints(tray);
      recordPrintHit();
      notePrint('browser');
    }
    finally
    {
      setPrinting(false);
    }
  }
  // Yu-Gi-Oh! cards are smaller (59 × 86 mm): automatic card size uses it when every card on the sheet is Yu-Gi-Oh!
  // (or, with an empty sheet, when Yu-Gi-Oh! is the game being browsed).
  const smallGames = new Set(
    games.filter(item => /yu-?gi-?oh/i.test(item.name + ' ' + item.displayName)).map(item => item.id),
  );
  const allSmall = tray.length ? tray.every(item => smallGames.has(item.card.gameId)) : smallGames.has(gameId ?? -1);
  const layout = pageLayout(printSettings, allSmall);
  const pc = printCopy[language];
  const kc = cutterCopy[language];
  const lc = layoutCopy[language];
  const hc = historyCopy[language];
  const phc = printHistoryCopy[language];
  const total = tray.reduce((s, i) => s + i.quantity, 0);
  const pages = paginateTray(tray, layout.perPage);
  const lowDpi = tray.filter(item => (printDpi[item.card.id] ?? 300) < 300).length;
  const textProxies = tray.filter(item => item.card.id in proxyText).length;
  const mode = status?.mode ?? 'demo';
  const pageStyle = {
    width: `${layout.width}mm`,
    height: `${layout.height}mm`,
    padding: `${layout.padY}mm ${layout.padX}mm`,
    '--slot-w': `${layout.slotWidth}mm`,
    '--slot-h': `${layout.slotHeight}mm`,
    '--card-w': `${layout.cardWidth}mm`,
    '--card-h': `${layout.cardHeight}mm`,
    '--pad-x': `${layout.padX}mm`,
    '--columns': String(layout.columns),
  } as React.CSSProperties;
  const bleedInset = `${layout.spacingY / 2 - layout.bleedSize}mm ${layout.spacingX / 2 - layout.bleedSize}mm`;
  // Guides and registration marks drawn in page millimetres over the sheet (the PDF draws the same shapes).
  const pageLines = pageGuideLines(layout, printSettings.pageGuides);
  const marks = markRects(layout);
  const guideStroke = {
    stroke: printSettings.guideColor,
    strokeWidth: printSettings.guideWidth,
    strokeDasharray: printSettings.guideDashed
      ? `${Math.max(0.6, printSettings.guideWidth * 4)} ${Math.max(0.5, printSettings.guideWidth * 3)}`
      : undefined,
    fill: 'none',
  };
  const pageMarks = (count: number) =>
  {
    const guideShapes = cardGuideShapes(layout, printSettings, count);
    return marks.length || guideShapes.rects.length || guideShapes.lines.length || pageLines.length
      ? (
        <svg className="print-marks" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
          {pageLines.map((line, index) => <line key={'p' + index} {...line} {...guideStroke} />)}
          {guideShapes.rects.map((rect, index) => (
            <rect
              key={'r' + index}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={rect.radius}
              {...guideStroke}
            />
          ))}
          {guideShapes.lines.map((line, index) => <line key={'l' + index} {...line} {...guideStroke} />)}
          {marks.map((rect, index) => (
            <rect key={'m' + index} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="#000" />
          ))}
        </svg>
      )
      : null;
  };
  // Saved settings on this device.
  function savePreset(name: string)
  {
    const next = [{ name, settings: printSettings }, ...presets.filter(item => item.name !== name)].slice(0, 20);
    setPresets(next);
    savePresets(next);
  }
  function deletePreset(name: string)
  {
    const next = presets.filter(item => item.name !== name);
    setPresets(next);
    savePresets(next);
  }
  // Direct PDF: the same pages and positions as the print preview, drawn at exact size.
  // A downloaded PDF or PNG is a print too, counted once per sheet content (several PNG pages are one print).
  const exportCounted = useRef('');
  function countExport(method: 'pdf' | 'png')
  {
    const key = tray.map(item => `${item.card.id}x${item.quantity}`).join();
    if (exportCounted.current === key) return;
    exportCounted.current = key;
    void recordPrints(tray);
    recordPrintHit(method);
    notePrint(method);
  }
  // Every print joins "Your prints". Signed out, the line under the download offers an account to keep them there, asked
  // again a month after a "Not now".
  function notePrint(method: PrintMethod)
  {
    const sheetGame = games.find(item => item.id === tray[0]?.card.gameId) ?? game;
    const { records, record } = rememberPrint({
      gameId: sheetGame?.id ?? null,
      gameName: sheetGame?.displayName ?? null,
      method,
      copies: total,
      items: tray,
      settings: printSettings,
    });
    if (user)
    {
      setPrints(old => [record, ...old]);
      void uploadPrint(user, record).catch(() => undefined);
    }
    else setPrints(records);
    setJustPrinted(true);
    let quiet = false;
    try
    {
      quiet = Date.now() - Number(localStorage.getItem(KEEP_PROMPT_KEY) ?? 0) < 30 * 86_400_000;
    }
    catch
    {
      /* Storage unavailable: ask. */
    }
    const ask = !user && accountsEnabled && !quiet;
    setKeepPrompt(ask);
    if (ask) recordStep('save-prompt');
  }
  function dismissKeepPrompt()
  {
    setKeepPrompt(false);
    try
    {
      localStorage.setItem(KEEP_PROMPT_KEY, String(Date.now()));
    }
    catch
    {
      /* Storage unavailable. */
    }
  }
  function reprint(record: PrintRecord)
  {
    if (!storageKey) return;
    reprinting.current = true;
    recordStep('reprint');
    setPrintSettings(old => ({ ...old, ...record.settings }));
    setTray(record.items);
    setAccountOpen(false);
  }
  async function forgetPrint(record: PrintRecord)
  {
    const key = sheetKey(record.items);
    const same = prints.filter(item => sheetKey(item.items) === key);
    setPrints(old => old.filter(item => sheetKey(item.items) !== key));
    forgetLocalSheet(key);
    if (user)
    {
      await Promise.all(same.filter(item => item.synced).map(item => removePrint(item.id).catch(() => undefined)));
    }
  }
  async function downloadPdf()
  {
    setPdfProgress({ page: 0, pages: pages.length });
    try
    {
      const { sheetPdf } = await import('../lib/printPdf');
      const blob = await sheetPdf({
        pages,
        layout,
        settings: printSettings,
        backImage: printSettings.backs ? backImage : null,
        missing: kc.missing,
        label: pc.pageLabel,
        onPage: (page, count) => setPdfProgress({ page, pages: count }),
      });
      downloadBlob(
        blob,
        `sleeveready-${layout.paper.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${pages.length}p.pdf`,
      );
      countExport('pdf');
    }
    catch
    {
      setImageMessage(lc.pdfFailed);
    }
    finally
    {
      setPdfProgress(null);
    }
  }
  function downloadCutFile()
  {
    downloadBlob(
      new Blob([cutSvg(layout)], { type: 'image/svg+xml' }),
      `sleeveready-cut-${layout.paper.label.toLowerCase()}-${layout.orientation}-${layout.columns}x${layout.rows}.svg`,
    );
  }
  const mmLabel = (value: number) =>
    new Intl.NumberFormat(localeFor(language), { maximumFractionDigits: 1 }).format(value);
  // Cricut: one transparent PNG per page, drawn from the card images.
  async function downloadPng(index: number)
  {
    setExportingPage(index);
    try
    {
      const png = await pagePng(pages[index], layout, kc.missing);
      downloadBlob(png.blob, `sleeveready-cricut-${index + 1}.png`);
      countExport('png');
    }
    catch
    {
      setImageMessage(kc.exportFailed);
    }
    finally
    {
      setExportingPage(null);
    }
  }
  // Card backs: the image the visitor picks, kept on this device (as a data URL when it fits in storage).
  async function chooseBack(file: File)
  {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8_000_000) return;
    const url = await new Promise<string>((resolve, reject) =>
    {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    setBackImage(url);
    try
    {
      localStorage.setItem(BACK_KEY, url);
    }
    catch
    {
      /* Too large for storage: kept for this visit only. */
    }
  }
  const backsOn = printSettings.backs && Boolean(backImage);
  // After each page of fronts, its backs: each in the slot behind its card, moved by the duplex correction.
  function backPage(page: CatalogCard[], index: number)
  {
    const filled = new Set(page.map((_, slot) => backSlot(slot, layout, printSettings.flip)));
    return (
      <section className="print-page is-back" style={pageStyle} aria-label={`${kc.backPage} ${index + 1}`}>
        <div
          className="print-grid"
          style={{ transform: `translate(${printSettings.backX}mm,${printSettings.backY}mm)` }}
        >
          {Array.from({ length: layout.perPage }, (_, slot) => (
            <div className="print-slot" key={slot}>
              {filled.has(slot) && (
                <>
                  {layout.bleed && (
                    <div className="print-bleed" aria-hidden="true" style={{ inset: bleedInset }}>
                      <img src={backImage!} alt="" />
                    </div>
                  )}
                  <div className="print-card print-back">
                    <img src={backImage!} alt="" />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <small className="page-label">{kc.backPage} · {index + 1}/{pages.length}</small>
      </section>
    );
  }
  const trayIds = new Set(tray.map(item => item.card.id));
  const cardCollator = new Intl.Collator(localeFor(language), { numeric: true, sensitivity: 'base' });
  const rarities = [...new Set(cards.map(card => card.rarity).filter((value): value is string => Boolean(value)))].sort(
    cardCollator.compare,
  );
  const languageNames = new Intl.DisplayNames([localeFor(language)], { type: 'language' });
  const cardLanguageName = (code: string) => languageNames.of(code) ?? code.toUpperCase();
  const compareCardNumbers = (a: CatalogCard, b: CatalogCard, direction: 1 | -1) =>
  {
    const left = a.collectorNumber?.trim();
    const right = b.collectorNumber?.trim();
    if (!left) return right ? 1 : 0;
    if (!right) return -1;
    const leftNumber = left.match(/^0*(\d+)(.*)$/);
    const rightNumber = right.match(/^0*(\d+)(.*)$/);
    if (leftNumber && rightNumber)
    {
      const numeric = Number(leftNumber[1]) - Number(rightNumber[1]);
      return numeric ? numeric * direction : cardCollator.compare(leftNumber[2], rightNumber[2]) * direction;
    }
    if (leftNumber || rightNumber) return leftNumber ? -1 : 1;
    return cardCollator.compare(left, right) * direction;
  };
  const filtered = cards
    .filter(card =>
    {
      const searchable = [card.name, card.version, card.collectorNumber, card.rarity, card.language]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();
      return searchable.includes(query.toLocaleLowerCase()) && (!rarityFilter || card.rarity === rarityFilter)
        && (!inTrayOnly || trayIds.has(card.id))
        && (routeFeature !== 'tokens' || card.rarity === 'Token' || card.rarity === 'Emblem');
    })
    .sort((a, b) =>
      sort === 'name-asc'
        ? cardCollator.compare(a.name, b.name)
        : sort === 'name-desc'
        ? cardCollator.compare(b.name, a.name)
        : sort === 'number-asc'
        ? compareCardNumbers(a, b, 1)
        : sort === 'number-desc'
        ? compareCardNumbers(a, b, -1)
        : 0
    );
  const filtersActive = Boolean(query || rarityFilter || inTrayOnly || sort !== 'set');
  const expansion = expansions.find(e => e.id === expansionId);
  const game = games.find(g => g.id === gameId);
  const multilingualGame = (game?.printLanguages?.length ?? 0) > 1;
  const seoLanguage: SeoLanguage = isSeoLanguage(language) ? language : 'en';
  const selectedSeoSlug = seoSlugForGame((game?.name ?? '') + ' ' + (game?.displayName ?? ''));
  const seoGameSlug = selectedSeoSlug ?? (games.length ? undefined : initialRoute.game);
  const onSetPage = Boolean(
    routeSet.current && seoGameSlug && expansion && expansionSlug(expansion) === routeSet.current,
  );
  const spotlight = onSetPage && routeCard ? cards.find(card => cardSlugMap.get(card.id) === routeCard) : undefined;
  // Card page extras come from the server: versions in other expansions, game data of the shown printing, names in other languages.
  const [printings, setPrintings] = useState<{ key: string; data: CardInfo } | null>(null);
  const printingsKey = spotlight && expansion && routeCard ? expansion.id + '/' + routeCard + '/' + seoLanguage : '';
  useEffect(() =>
  {
    if (!printingsKey) return;
    // The server-rendered card page carries its card data: the app uses it instead of asking again.
    if (embeddedCardInfo?.key === printingsKey)
    {
      setPrintings({ key: printingsKey, data: embeddedCardInfo.data });
      return;
    }
    const [expansionPart, cardPart, languagePart] = printingsKey.split('/');
    const controller = new AbortController();
    api<Envelope<CardInfo>>(
      'card-info?expansionId=' + expansionPart + '&card=' + encodeURIComponent(cardPart) + '&language='
        + encodeURIComponent(languagePart),
      controller.signal,
    )
      .then(r => setPrintings({ key: printingsKey, data: r.data }))
      .catch(() =>
      {/* the page keeps the versions found in the loaded set */});
    return () => controller.abort();
  }, [printingsKey]);
  // Prices, decks, cards printed together and the illustrator's other cards: outside calls, so asked for only once a
  // person interacts with the page (never by crawlers), and merged into the card's own data.
  const [market, setMarket] = useState<{ key: string; data: CardMarket } | null>(null);
  useEffect(() =>
  {
    if (!printingsKey || printings?.key !== printingsKey) return;
    let cancelled = false;
    const key = printingsKey;
    const [expansionPart, cardPart, languagePart] = key.split('/');
    const illustrator = printings.data.details?.illustrator;
    const hasTcgplayer = printings.data.details?.prices?.some(price => price.market === 'TCGplayer');
    whenPerson(() =>
    {
      if (cancelled) return;
      api<Envelope<CardMarket | null>>(
        'card-market?expansionId=' + expansionPart + '&card=' + encodeURIComponent(cardPart) + '&language='
          + encodeURIComponent(languagePart) + (illustrator ? '&illustrator=' + encodeURIComponent(illustrator) : '')
          + (hasTcgplayer ? '&tcgplayer=1' : ''),
      )
        .then(r =>
        {
          if (!cancelled && r.data) setMarket({ key, data: r.data });
        })
        .catch(() =>
        {/* the page works without them */});
    });
    return () =>
    {
      cancelled = true;
    };
  }, [printingsKey, printings]);
  const cardPageInfo = useMemo(() =>
  {
    if (printings?.key !== printingsKey) return null;
    const info = printings.data;
    if (market?.key !== printingsKey) return info;
    const extra = market.data;
    const details = info.details ?? (extra.prices.length ? { blocks: [] } : null);
    return {
      ...info,
      versions: extra.versions && extra.versions.length > info.versions.length ? extra.versions : info.versions,
      details: details
        ? {
          ...details,
          prices: [...(details.prices ?? []), ...extra.prices],
          rulings: extra.rulings?.length ? extra.rulings : details.rulings,
        }
        : null,
      illustrated: extra.illustrated,
      printedWith: extra.printedWith,
      decks: extra.decks,
    };
  }, [printings, market, printingsKey]);
  // Until the routed card or set has loaded, the server-rendered title and meta stay in place.
  const seoPending = Boolean((routeCard && !spotlight) || (routeSet.current && !cards.length));
  // A card route stays a card view while its set loads; if the card is not in the set, the catalogue takes over.
  const cardView = Boolean(routeCard && routeSet.current && (spotlight || (!error && (loading || !cards.length))));
  const activeSeo = spotlight && seoGameSlug && expansion && routeSet.current && routeCard
    ? {
      copy: seoCardCopy(seoLanguage, seoGameSlug, {
        name: spotlight.name,
        setName: expansion.name,
        setCode: expansion.code,
        number: spotlight.collectorNumber ?? null,
        rarity: spotlight.rarity ?? null,
        languages: availablePrintLanguages.length ? availablePrintLanguages : ['en'],
      }),
      path: cardPath(seoLanguage, seoGameSlug, routeSet.current, routeCard),
    }
    : routeFeature && seoGameSlug
    ? {
      copy: seoFeatureCopy(seoLanguage, seoGameSlug, routeFeature),
      path: `/${seoLanguage}/${seoGameSlug}/${routeFeature}/`,
    }
    : onSetPage && seoGameSlug && expansion
    ? {
      copy: seoSetCopy(seoLanguage, seoGameSlug, {
        name: expansion.name,
        code: expansion.code,
        releaseDate: expansion.releaseDate ?? null,
        cardCount: cards.length,
        languages: availablePrintLanguages.length ? availablePrintLanguages : ['en'],
      }),
      path: seoPath(seoLanguage, seoGameSlug, routeSet.current),
    }
    : {
      copy: seoPageCopy(
        seoLanguage,
        home ? undefined : seoGameSlug,
        !home && expansions.length && expansions[0].gameId === gameId
          ? gameSetsInfo(
            expansions.map(set => ({
              name: set.name,
              releaseDate: set.releaseDate,
              revealed: upcoming.find(item => item.id === set.id)?.revealed,
            })),
          )
          : undefined,
      ),
      path: seoPath(seoLanguage, home ? undefined : seoGameSlug),
    };
  const pageSeo = activeSeo.copy;
  useEffect(() =>
  {
    document.documentElement.lang = language;
    localStorage.setItem('sleeveready.language', language);
    const route = parseSeoPath(location.pathname);
    if (!route.language)
    {
      const url = new URL(location.href);
      url.searchParams.set('lang', language);
      history.replaceState(null, '', url);
    }
    if (seoPending) return;
    if (isSeoLanguage(language))
    {
      // The page the server rendered keeps its own description (built from the card itself); later routes get the app's.
      const copy = activeSeo.path === serverHead.path
        ? { ...activeSeo.copy, description: serverHead.description || activeSeo.copy.description }
        : activeSeo.copy;
      document.title = copy.title;
      document.querySelector('meta[name="description"]')?.setAttribute('content', copy.description);
      const origin = location.origin;
      document.querySelector('link[rel="canonical"]')?.setAttribute('href', origin + activeSeo.path);
      document.querySelector('meta[property="og:title"]')?.setAttribute('content', copy.title);
      document.querySelector('meta[property="og:description"]')?.setAttribute('content', copy.description);
      document.querySelector('meta[property="og:url"]')?.setAttribute('content', origin + activeSeo.path);
    }
    else
    {
      document.title = 'SleeveReady — ' + t('catalogDeckPrint');
      document.querySelector('meta[name="description"]')?.setAttribute('content', t('intro'));
    }
  }, [language, activeSeo.copy.title, activeSeo.copy.description, activeSeo.path, seoPending]);
  const ac = accessoryCopy[language];
  const accessories = accessoryShops(seoLanguage, game?.displayName ?? '', affiliate);
  const accessoryRel = (sponsored: boolean) => sponsored ? 'sponsored noopener' : 'noopener';
  const footerSource = dataSources.find(source =>
    source.pattern.test((game?.name ?? '') + ' ' + (game?.displayName ?? ''))
  );
  const gameIconName = gameIcon(game?.name ?? '');
  const expansionGlyph = (code: string | null | undefined) => setIconGlyph(gameIconName, code);
  const featuredGames = primaryGames
    .map(item =>
    {
      const match = games.find(game => item.pattern.test(game.name + ' ' + game.displayName));
      return match ? { game: match, label: item.label } : null;
    })
    .filter((item): item is { game: CardGame; label: string } => Boolean(item));
  const featuredIds = new Set(featuredGames.map(item => item.game.id));
  const defaultNavItems = [
    ...featuredGames,
    ...games.filter(item => !featuredIds.has(item.id)).map(game => ({ game, label: game.displayName })),
  ];
  const gameNavItems = favoriteGames.length
    ? [
      ...favoriteGames.flatMap(id => defaultNavItems.filter(item => item.game.id === id)),
      ...defaultNavItems.filter(item => !favoriteGames.includes(item.game.id)),
    ]
    : defaultNavItems;
  const visibleGames = gameNavItems.slice(0, visibleGameCount);
  const overflowGames = gameNavItems.slice(visibleGameCount);
  const overflowIds = new Set(overflowGames.map(item => item.game.id));
  const matchingGames = overflowGames.filter(item =>
    item.label.toLocaleLowerCase().includes(gameQuery.toLocaleLowerCase())
  );
  const otherActive = !home && game && overflowIds.has(game.id) ? game : null;
  const availableExpansions = expansions.filter(e =>
    !unavailableExpansions.has(e.id) && (routeFeature !== 'tokens' || e.hasTokens)
  );
  const uc = upcomingCopy[language];
  const todayIso = new Date().toISOString().slice(0, 10);
  const releasedExpansions = availableExpansions.filter(set => !set.releaseDate || set.releaseDate <= todayIso);
  const upcomingSets = upcoming.flatMap(item =>
  {
    const set = availableExpansions.find(entry => entry.id === item.id);
    return set?.releaseDate ? [{ set, releaseDate: set.releaseDate, revealed: item.revealed }] : [];
  });
  const recentExpansions = (releasedExpansions.length ? releasedExpansions : availableExpansions).slice(0, tabSlots);
  const remainingExpansions = availableExpansions.filter(set => !recentExpansions.includes(set)); // A set opened from the coming-soon cards is highlighted there: the 'more' button keeps its short label.
  const expansionInMore = expansion && remainingExpansions.some(set => set.id === expansion.id)
      && !upcomingSets.some(item => item.set.id === expansion.id)
    ? expansion
    : null;
  const matchingExpansions = remainingExpansions.filter(e =>
    (e.name + ' ' + e.code).toLowerCase().includes(expansionQuery.toLowerCase())
  );
  const gameSelector = (
    <nav className="header-game-nav" aria-label={cc.gamesLabel}>
      {visibleGames.map(item => (
        <GameTab
          key={item.game.id}
          label={item.label}
          icon={gameIcon(item.game.name)}
          active={!home && item.game.id === gameId}
          href={gameHref(item.game)}
          onChoose={() => chooseGame(item.game.id)}
        />
      ))}
      {overflowGames.length > 0 && (
        <div className="game-switcher header-more">
          <button
            className={'header-more-trigger ' + (otherActive ? 'active' : '')}
            type="button"
            aria-label={otherActive ? cc.otherGamesSelected(otherActive.displayName) : cc.otherGames}
            aria-haspopup="listbox"
            aria-expanded={gamePickerOpen}
            aria-controls="game-results"
            onClick={() =>
            {
              setGameQuery('');
              setGamePickerOpen(open => !open);
            }}
          >
            {otherActive && <span className={'game-mark ' + gameIcon(otherActive.name)} aria-hidden="true" />}
            <strong>{otherActive?.displayName ?? cc.more}</strong>
            <svg className="header-more-chevron" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4 6 4 4 4-4" />
            </svg>
          </button>
          {gamePickerOpen && (
            <div className="game-panel" id="game-results">
              <input
                autoFocus
                aria-label={cc.findGame}
                autoComplete="off"
                placeholder={cc.findGame}
                value={gameQuery}
                onKeyDown={event =>
                {
                  if (event.key === 'Escape')
                  {
                    setGamePickerOpen(false);
                  }
                }}
                onChange={event => setGameQuery(event.target.value)}
              />
              <div className="game-results" role="listbox" aria-label={cc.otherGames}>
                {matchingGames.map(item => (
                  <button
                    key={item.game.id}
                    role="option"
                    aria-selected={item.game.id === gameId}
                    onClick={() =>
                    {
                      chooseGame(item.game.id);
                      setGameQuery('');
                    }}
                  >
                    <span className={'game-mark ' + gameIcon(item.game.name)} aria-hidden="true" />
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
  return (
    <>
      <div className="app-shell" data-game={gameTheme(game?.name ?? 'Magic')}>
        <SiteHeader
          language={language}
          accountLabel={user ? user.email?.split('@')[0] ?? null : null}
          onLanguage={switchLanguage}
          onAccount={() => setAccountOpen(true)}
        >
          {gameSelector}
        </SiteHeader>
        <main>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setReload(x => x + 1)}>{cc.tryAgain}</button>
            </div>
          )}
          {home
            ? (
              <ReleaseBoard
                games={games}
                language={language}
                seoLanguage={seoLanguage}
                locale={localeFor(language)}
                mode={mode}
                sheetCount={total}
                iconFor={gameIcon}
                onAdd={cards => addImported(cards.map(card => ({ card, quantity: 1 })))}
                onOpenSheet={() => void openPreview()}
                onPaste={text =>
                {
                  setImportText(text);
                  setImportResult(undefined);
                  setImportStatus('');
                  setImportOpen(true);
                }}
              />
            )
            : cardView
            ? (
              <div className="card-workspace">
                {spotlight && expansion && seoGameSlug && routeSet.current
                  ? (
                    <CardPage
                      gameSlug={seoGameSlug ?? null}
                      card={spotlight}
                      cards={cards}
                      slugs={cardSlugMap}
                      expansion={expansion}
                      gameLabel={seoGames.find(item => item.slug === seoGameSlug)?.label ?? game?.displayName ?? ''}
                      seoLanguage={seoLanguage}
                      language={language}
                      mode={mode}
                      printLanguages={availablePrintLanguages}
                      printLanguage={printLanguage}
                      onPrintLanguage={code =>
                      {
                        setPrintLanguage(code);
                        setLimit(48);
                      }}
                      languageName={cardLanguageName}
                      quantity={tray.find(item => item.card.id === spotlight.id)?.quantity ?? 0}
                      onAdd={copies => addImported([{ card: spotlight, quantity: copies }])}
                      sheetCopies={total}
                      sheetPages={pages.length}
                      onPreview={() => void openPreview()}
                      homeHref={seoPath(seoLanguage)}
                      gameHref={seoPath(seoLanguage, seoGameSlug)}
                      setHref={seoPath(seoLanguage, seoGameSlug, routeSet.current)}
                      cardHref={slug => cardPath(seoLanguage, seoGameSlug, routeSet.current!, slug)}
                      onOpenCard={openCard}
                      onOpenSet={closeCard}
                      info={cardPageInfo}
                      currentSet={routeSet.current}
                      versionHref={item => cardPath(seoLanguage, seoGameSlug, item.set, item.slug)}
                      hasCardText={Boolean(game?.hasCardText)}
                      artistHref={name => artistPath(seoLanguage, seoGameSlug, name)}
                    />
                  )
                  : <CardPageSkeleton label={cardLabels[seoLanguage].loading} />}
              </div>
            )
            : (
              <div className="workspace">
                <section id="catalog" className="catalog" aria-label={cc.catalogueLabel}>
                  <AdSlot kind="rail" side="left" place="catalog" language={language} />
                  {seoGameSlug && (
                    <nav className="game-views" aria-label={game?.displayName ?? ''}>
                      <a href={seoPath(seoLanguage, seoGameSlug)} aria-current={!routeFeature ? 'page' : undefined}>
                        {featureLabels[seoLanguage].catalogLink}
                      </a>
                      {(Object.keys(seoFeatures) as SeoFeature[])
                        .filter(feature => seoFeatures[feature](seoGameSlug))
                        .map(feature => (
                          <a
                            key={feature}
                            href={`/${seoLanguage}/${seoGameSlug}/${feature}/`}
                            aria-current={routeFeature === feature ? 'page' : undefined}
                          >
                            {feature === 'tokens'
                              ? featureLabels[seoLanguage].tokensLink
                              : featureLabels[seoLanguage].topLink}
                          </a>
                        ))}
                    </nav>
                  )}
                  {routeFeature === 'top-proxies' && (
                    <section className="top-proxies" aria-labelledby="top-title">
                      <div className="top-proxies-heading">
                        <h2 id="top-title">{pageSeo.h1}</h2>
                        {topCards === undefined && <span className="skel-button" aria-hidden="true" />}
                        {!!topCards?.length && (
                          <button
                            className="primary"
                            type="button"
                            onClick={() => addImported(topCards.map(item => ({ card: item.card, quantity: 1 })))}
                          >
                            {featureLabels[seoLanguage].addAll}
                          </button>
                        )}
                      </div>
                      {topCards === undefined
                        ? (
                          <ol
                            className="card-grid top-grid"
                            role="status"
                            aria-busy="true"
                            dangerouslySetInnerHTML={{ __html: skeletonTopCards() }}
                          />
                        )
                        : topCards === null
                        ? <p>{featureLabels[seoLanguage].unavailable}</p>
                        : !topCards.length
                        ? <p>{featureLabels[seoLanguage].empty}</p>
                        : (
                          <ol className="card-grid top-grid">
                            {withAd(
                              topCards.map((item, index) => (
                                <li className="catalog-card" key={item.card.id}>
                                  <button
                                    className="card-pick"
                                    type="button"
                                    aria-label={`${t('addCopy')} ${item.card.name}`}
                                    onClick={event =>
                                    {
                                      flyToSheet(event.currentTarget);
                                      change(item.card, 1);
                                    }}
                                  >
                                    <div className="card-art">
                                      <CardImage language={language} card={item.card} mode={mode} thumb />
                                      <span className="top-rank">{index + 1}</span>
                                    </div>
                                    <div className="card-heading">
                                      <h3>{item.card.name}</h3>
                                      <span className="card-identifiers">
                                        <span className="card-number">
                                          {featureLabels[seoLanguage].printed(item.prints)}
                                        </span>
                                      </span>
                                    </div>
                                  </button>
                                </li>
                              )),
                              language,
                              'li',
                            )}
                          </ol>
                        )}
                    </section>
                  )}
                  {!routeFeature && !upcomingSets.length && upcomingShapes > 0 && (
                    <section
                      className="upcoming-sets is-skel"
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{ __html: skeletonUpcoming(upcomingShapes) }}
                    />
                  )}
                  {!routeFeature && upcomingSets.length > 0 && (
                    <section className="upcoming-sets" aria-label={uc.title}>
                      {upcomingSets.map(({ set, releaseDate, revealed }) =>
                      {
                        const glyph = expansionGlyph(set.code);
                        const active = set.id === expansionId;
                        return (
                          <a
                            className={'upcoming-set' + (active ? ' is-active' : '')}
                            aria-current={active ? 'true' : undefined}
                            key={set.id}
                            href={seoGameSlug ? seoPath(seoLanguage, seoGameSlug, expansionSlug(set)) : '#'}
                            title={`${set.name} · ${
                              uc.releases(
                                new Date(releaseDate + 'T12:00:00Z').toLocaleDateString(localeFor(language), {
                                  day: 'numeric',
                                  month: 'long',
                                }),
                              )
                            } · ${uc.revealed(revealed)}`}
                            onClick={event =>
                            {
                              if (
                                event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
                              ) return;
                              event.preventDefault();
                              chooseExpansion(set.id);
                              setPickerOpen(false);
                            }}
                          >
                            {glyph
                              ? <span className={'set-symbol ' + gameIconName} aria-hidden="true">{glyph}</span>
                              : <span className="upcoming-mark" aria-hidden="true">★</span>}
                            <span className="upcoming-copy">
                              <span className="upcoming-kicker">
                                {active ? uc.viewing : uc.title}
                                {(() =>
                                {
                                  const fresh = revealedSince(visit, set.id, revealed);
                                  return fresh > 0 && <b className="upcoming-fresh">{uc.freshReveals(fresh)}</b>;
                                })()}
                              </span>
                              <strong>{set.name}</strong>
                              <span className="upcoming-meta">
                                {new Date(releaseDate + 'T12:00:00Z').toLocaleDateString(localeFor(language), {
                                  day: 'numeric',
                                  month: 'short',
                                })} · {uc.revealed(revealed)}
                              </span>
                            </span>
                            <span className="upcoming-go" aria-hidden="true">{active ? '✓' : '→'}</span>
                          </a>
                        );
                      })}
                    </section>
                  )}
                  <div className="expansion-switcher" ref={measureTabs}>
                    {!expansions.length && loading
                      ? (
                        <nav
                          className="expansion-tabs"
                          aria-hidden="true"
                          dangerouslySetInnerHTML={{ __html: skeletonTabs }}
                        />
                      )
                      : (
                        <nav className="expansion-tabs" aria-label={t('officialSet')}>
                          {recentExpansions.map(set =>
                          {
                            const glyph = expansionGlyph(set.code);
                            const coming = Boolean(set.releaseDate && set.releaseDate > todayIso);
                            const fresh = releasedSince(visit, set.releaseDate, todayIso);
                            return (
                              <button
                                className={'expansion-tab ' + (!glyph ? 'no-symbol ' : '')
                                  + (coming ? 'is-upcoming ' : '') + (fresh ? 'is-fresh ' : '')
                                  + (set.id === expansionId ? 'active' : '')}
                                type="button"
                                aria-pressed={set.id === expansionId}
                                title={set.releaseDate ? releaseLabel(set.releaseDate, language) : undefined}
                                key={set.id}
                                onClick={() =>
                                {
                                  chooseExpansion(set.id);
                                  setPickerOpen(false);
                                }}
                              >
                                {glyph && (
                                  <span className={'set-symbol ' + gameIconName} aria-hidden="true">{glyph}</span>
                                )}
                                <span className="expansion-tab-copy">
                                  <strong>{set.name}</strong>
                                  {coming
                                    ? (
                                      <small className="expansion-tab-coming">
                                        {uc.badge} · {new Date(set.releaseDate + 'T12:00:00Z').toLocaleDateString(
                                          localeFor(language),
                                          { day: 'numeric', month: 'short' },
                                        )}
                                      </small>
                                    )
                                    : fresh
                                    ? (
                                      <small className="expansion-tab-fresh">
                                        <b>{uc.fresh}</b>
                                        {set.code ? ' · ' + set.code : ''}
                                      </small>
                                    )
                                    : set.code && <small>{set.code}</small>}
                                </span>
                              </button>
                            );
                          })}
                          {remainingExpansions.length > 0 && (
                            <div className="expansion-more">
                              <button
                                className={'expansion-more-trigger ' + (expansionInMore ? 'active' : '')}
                                type="button"
                                aria-label={expansionInMore
                                  ? cc.otherExpansionsSelected(expansionInMore.name)
                                  : cc.otherExpansions(remainingExpansions.length)}
                                aria-haspopup="listbox"
                                aria-expanded={pickerOpen}
                                aria-controls="expansion-results"
                                onClick={() =>
                                {
                                  setExpansionQuery('');
                                  setPickerNotice('');
                                  setPickerOpen(open => !open);
                                }}
                              >
                                <strong>
                                  {expansionInMore?.name ?? cc.otherExpansions(remainingExpansions.length)}
                                </strong>
                                <svg className="expansion-more-chevron" viewBox="0 0 16 16" aria-hidden="true">
                                  <path d="m4 6 4 4 4-4" />
                                </svg>
                              </button>
                              {pickerOpen && (
                                <div id="expansion-results" className="expansion-panel">
                                  <input
                                    autoFocus
                                    aria-label={t('findExpansion')}
                                    autoComplete="off"
                                    placeholder={t('findExpansion')}
                                    value={expansionQuery}
                                    onKeyDown={event =>
                                    {
                                      if (event.key === 'Escape') setPickerOpen(false);
                                    }}
                                    onChange={e => setExpansionQuery(e.target.value)}
                                  />
                                  <p className="expansion-count" aria-live="polite">
                                    {cc.expansionCount(matchingExpansions.length, remainingExpansions.length)}
                                  </p>
                                  {matchingExpansions.length > 0
                                    ? (
                                      <div className="expansion-results" role="listbox" aria-label={cc.expansionsLabel}>
                                        {matchingExpansions.map(set =>
                                        {
                                          const glyph = expansionGlyph(set.code);
                                          return (
                                            <button
                                              role="option"
                                              aria-selected={set.id === expansionId}
                                              key={set.id}
                                              onClick={() =>
                                              {
                                                chooseExpansion(set.id);
                                                setExpansionQuery('');
                                                setPickerNotice('');
                                                setPickerOpen(false);
                                              }}
                                            >
                                              <span className="expansion-option-name">
                                                {glyph && (
                                                  <span className={'set-symbol ' + gameIconName} aria-hidden="true">
                                                    {glyph}
                                                  </span>
                                                )}
                                                <span>{set.name}</span>
                                              </span>
                                              <small>
                                                {set.releaseDate
                                                  ? releaseLabel(set.releaseDate, language) + (set.code ? ' · ' : '')
                                                  : ''}
                                                {set.code ?? ''}
                                              </small>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )
                                    : <p className="picker-empty">{cc.noOtherExpansions}</p>}
                                </div>
                              )}
                            </div>
                          )}
                        </nav>
                      )}
                    {pickerNotice && <p className="picker-notice" role="status">{pickerNotice}</p>}
                  </div>
                  {!expansionId && loading && (
                    <div
                      className="catalog-controls is-skel"
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{ __html: skeletonControls }}
                    />
                  )}
                  {expansionId > 0 && (
                    <div className="catalog-controls">
                      <div className="catalog-search">
                        <input
                          aria-label={t('searchCards')}
                          type="search"
                          placeholder={cc.searchPlaceholder}
                          value={query}
                          onChange={e =>
                          {
                            setQuery(e.target.value);
                            setLimit(48);
                          }}
                        />
                        <span aria-live="polite">{cc.count(filtered.length, cards.length)}</span>
                        <button
                          type="button"
                          className="filters-toggle"
                          aria-expanded={filtersOpen}
                          aria-controls="catalog-filters"
                          onClick={() => setFiltersOpen(open => !open)}
                        >
                          {mobileCopy[language].filters}
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="m4 6 4 4 4-4" />
                          </svg>
                        </button>
                      </div>
                      <div
                        id="catalog-filters"
                        className={'filter-row ' + (multilingualGame ? 'with-language ' : '')
                          + (filtersOpen ? 'is-open' : '')}
                      >
                        <label>
                          <span>{cc.sort}</span>
                          <select
                            aria-label={cc.sort}
                            value={sort}
                            onChange={event =>
                            {
                              setSort(event.target.value as typeof sort);
                              setLimit(48);
                            }}
                          >
                            <option value="set">{cc.setOrder}</option>
                            <option value="number-asc">{cc.numberAsc}</option>
                            <option value="number-desc">{cc.numberDesc}</option>
                            <option value="name-asc">{cc.nameAsc}</option>
                            <option value="name-desc">{cc.nameDesc}</option>
                          </select>
                        </label>
                        <label>
                          <span>{cc.rarity}</span>
                          <select
                            aria-label={cc.rarity}
                            value={rarityFilter}
                            onChange={event =>
                            {
                              setRarityFilter(event.target.value);
                              setLimit(48);
                            }}
                          >
                            <option value="">{cc.allRarities}</option>
                            {rarities.map(rarity => <option key={rarity} value={rarity}>{rarity}</option>)}
                          </select>
                        </label>
                        {multilingualGame && (
                          <label>
                            <span>{cc.cardLanguage}</span>
                            <select
                              aria-label={cc.cardLanguage}
                              value={printLanguage}
                              disabled={!availablePrintLanguages.length}
                              onChange={event =>
                              {
                                setPrintLanguage(event.target.value);
                                setLimit(48);
                              }}
                            >
                              {(availablePrintLanguages.length ? availablePrintLanguages : [printLanguage]).map(
                                code => <option key={code} value={code}>{cardLanguageName(code)}</option>,
                              )}
                            </select>
                          </label>
                        )}
                        <label className="in-sheet-filter">
                          <input
                            type="checkbox"
                            checked={inTrayOnly}
                            onChange={event =>
                            {
                              setInTrayOnly(event.target.checked);
                              setLimit(48);
                            }}
                          />
                          <span>{cc.inPrintSheet}</span>
                        </label>
                        {filtersActive && (
                          <button
                            className="reset-filters"
                            type="button"
                            onClick={() =>
                            {
                              setQuery('');
                              setSort('set');
                              setRarityFilter('');
                              setInTrayOnly(false);
                              setLimit(48);
                            }}
                          >
                            {cc.reset}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {expansionId > 0 && (
                    <GlobalSearch
                      game={seoGameSlug}
                      seoLanguage={seoLanguage}
                      query={query}
                      labels={cc.globalSearch}
                      currentSet={expansion ? expansionSlug(expansion) : null}
                      openInCurrentSet={slug =>
                      {
                        const card = cards.find(item => cardSlugMap.get(item.id) === slug);
                        if (!card) return false;
                        openCard(card);
                        return true;
                      }}
                    />
                  )}
                  {loading
                    ? (
                      <div className="catalog-loading" role="status" aria-label={loading}>
                        <div
                          className="set-caption is-skel"
                          aria-hidden="true"
                          dangerouslySetInnerHTML={{ __html: skeletonCaption }}
                        />
                        <div
                          className="card-grid"
                          aria-hidden="true"
                          dangerouslySetInnerHTML={{ __html: skeletonCards() }}
                        />
                      </div>
                    )
                    : !expansionId
                    ? (
                      <div className="empty">
                        <span className="empty-symbol">▤</span>
                        <h3>{error ? cc.catalogueUnavailable : cc.openExpansion}</h3>
                        <p>{error ? cc.providerDown : expansions.length ? cc.chooseSet : cc.noExpansions}</p>
                      </div>
                    )
                    : filtered.length === 0
                    ? (
                      <div className="empty">
                        <h3>{cc.noCardsMatch}</h3>
                        <p>{filtersActive ? cc.changeFilters : cc.noSingles}</p>
                        {filtersActive && (
                          <button
                            className="secondary"
                            onClick={() =>
                            {
                              setQuery('');
                              setSort('set');
                              setRarityFilter('');
                              setInTrayOnly(false);
                            }}
                          >
                            {cc.resetFilters}
                          </button>
                        )}
                      </div>
                    )
                    : (
                      <>
                        {expansion?.releaseDate && expansion.releaseDate > todayIso && (
                          <p className="spoiler-banner">
                            <strong>{uc.spoiler}</strong>
                            <span>
                              {uc.releases(
                                new Date(expansion.releaseDate + 'T12:00:00Z').toLocaleDateString(localeFor(language), {
                                  day: 'numeric',
                                  month: 'long',
                                }),
                              )}
                            </span>
                            <span>{uc.revealed(cards.length)}</span>
                          </p>
                        )}
                        <div className="set-caption">
                          <span className="set-caption-name">{expansion?.name}</span>
                          {expansion && seoGameSlug && (
                            <div className="set-shops">
                              <span>{shopCopy[seoLanguage].sealedShort}</span>
                              {sealedShops(seoLanguage, {
                                game: seoGames.find(item => item.slug === seoGameSlug)?.label ?? '',
                                set: expansion.name,
                              }, affiliate)
                                .map((link, index) => (
                                  <a
                                    key={link.shop}
                                    className={'set-shop-button' + (index === 0 ? ' is-primary' : '')}
                                    href={link.url}
                                    target="_blank"
                                    rel={shopRel(link)}
                                  >
                                    {link.shop}
                                    <span dangerouslySetInnerHTML={{ __html: externalIcon }} />
                                  </a>
                                ))}
                            </div>
                          )}
                        </div>
                        <div className="card-grid">
                          {withAd(
                            filtered.slice(0, limit).map(card =>
                            {
                              const quantity = tray.find(i => i.card.id === card.id)?.quantity ?? 0;
                              const details =
                                isSeoLanguage(language) && seoGameSlug && expansion && cardSlugMap.has(card.id)
                                  ? cardPath(language, seoGameSlug, expansionSlug(expansion), cardSlugMap.get(card.id)!)
                                  : null;
                              const detailsLabel = cardLabels[seoLanguage].details;
                              const openDetails = (event: React.MouseEvent) =>
                              {
                                event.preventDefault();
                                openCard(card);
                              };
                              return (
                                <article className={'catalog-card ' + (quantity ? 'is-selected' : '')} key={card.id}>
                                  <div className="card-frame">
                                    <button
                                      className="card-pick"
                                      type="button"
                                      aria-label={`${t('addCopy')} ${card.name}`}
                                      onClick={event =>
                                      {
                                        flyToSheet(event.currentTarget);
                                        change(card, 1);
                                      }}
                                    >
                                      <div className="card-art">
                                        <CardImage language={language} card={card} mode={mode} thumb />
                                        {quantity > 0 && (
                                          <span className="copy-badge">
                                            <span className="copy-badge-count">{quantity}</span>
                                            <span className="copy-badge-label"> {t('inPrintSheet')}</span>
                                          </span>
                                        )}
                                        <span className="card-add-hint" aria-hidden="true">
                                          <svg viewBox="0 0 16 16">
                                            <path d="M8 3v10M3 8h10" />
                                          </svg>
                                          {cc.addHint}
                                        </span>
                                      </div>
                                    </button>
                                    {details && (
                                      <a
                                        className="card-open"
                                        href={details}
                                        aria-label={`${detailsLabel}: ${card.name}`}
                                        title={detailsLabel}
                                        onClick={openDetails}
                                      >
                                        <svg viewBox="0 0 16 16" aria-hidden="true">
                                          <path d="M9.5 2.5h4v4M13.5 2.5 8 8M7 3.5H3.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9" />
                                        </svg>
                                      </a>
                                    )}
                                  </div>
                                  <div className="card-heading">
                                    <h3>
                                      {details ? <a href={details} onClick={openDetails}>{card.name}</a> : card.name}
                                    </h3>
                                    <span className="card-identifiers">
                                      {card.language && (
                                        <span className="card-language">{card.language.toUpperCase()}</span>
                                      )}
                                      {card.collectorNumber && (
                                        <span className="card-number">#{card.collectorNumber}</span>
                                      )}
                                    </span>
                                  </div>
                                  {quantity > 0 && (
                                    <button
                                      className="card-remove"
                                      type="button"
                                      aria-label={`${t('removeFromSheet')} ${card.name}`}
                                      onClick={() => change(card, -quantity)}
                                    >
                                      <span aria-hidden="true">×</span> {t('removeFromSheet')}
                                    </button>
                                  )}
                                </article>
                              );
                            }),
                            language,
                          )}
                        </div>
                        {filtered.length > limit && (
                          <button className="load-more" onClick={() => setLimit(n => n + 48)}>
                            {cc.showMore(filtered.length - limit)}
                          </button>
                        )}
                      </>
                    )}
                </section>
                <aside className="tray">
                  <div className="tray-heading">
                    <div>
                      <span className="tray-kicker">{layout.paper.label} · {layout.columns} × {layout.rows}</span>
                      <h2>{t('printSheet')}</h2>
                    </div>
                    <span className="tray-count">{total}</span>
                  </div>
                  <div className="tray-summary">
                    <MiniSheet
                      pages={pages}
                      perPage={layout.perPage}
                      columns={layout.columns}
                      paperRatio={layout.width / layout.height}
                      language={language}
                      mode={mode}
                    >
                      <p className="tray-meta">
                        {total} {t('copies')} · {pages.length} {pages.length === 1 ? t('page') : t('pages')}{' '}
                        {layout.paper.label}
                      </p>
                    </MiniSheet>
                  </div>
                  {!tray.length
                    ? (
                      <div className="tray-empty">
                        <h3>{cc.noCardsSelected}</h3>
                        <p>
                          {cc.clickToAdd}
                          <br />
                          {cc.savedOnDevice}
                        </p>
                        {storageKey && prints.length > 0 && (
                          <section className="tray-prints">
                            <h3>{phc.title}</h3>
                            <PrintHistory
                              records={prints}
                              language={language}
                              mode={mode}
                              limit={3}
                              onReprint={reprint}
                              onMore={() => setAccountOpen(true)}
                            />
                          </section>
                        )}
                      </div>
                    )
                    : (
                      <div className="tray-list">
                        {tray.map((i, index) => (
                          <div className="tray-item" key={i.card.id}>
                            <div className="tray-thumb">
                              <CardImage language={language} card={i.card} mode={mode} thumb />
                            </div>
                            <div className="tray-item-body">
                              <strong className="tray-name">{i.card.name}</strong>
                              {(i.card.collectorNumber || i.card.rarity || i.card.language) && (
                                <small className="tray-card-meta">
                                  {(() =>
                                  {
                                    const codes = games.find(item => item.id === i.card.gameId)?.printLanguages ?? [];
                                    return i.card.language && i.card.expansionId && codes.length > 1
                                      ? (
                                        <TrayLanguage
                                          card={i.card}
                                          printLanguages={codes}
                                          label={`${cc.cardLanguage}: ${i.card.name}`}
                                          languageName={cardLanguageName}
                                          onSwitch={next => switchCardLanguage(i.card, next)}
                                          onFail={() => setError(trayLanguageMissing[language])}
                                        />
                                      )
                                      : i.card.language?.toUpperCase();
                                  })()}
                                  {i.card.language && (i.card.collectorNumber || i.card.rarity) ? ' · ' : ''}
                                  {i.card.collectorNumber ? '#' + i.card.collectorNumber : ''}
                                  {i.card.collectorNumber && i.card.rarity ? ' · ' : ''}
                                  {i.card.rarity ?? ''}
                                </small>
                              )}
                              <Quantity card={i.card} quantity={i.quantity} change={change} language={language} />
                            </div>
                            <div className="order-buttons">
                              <button
                                aria-label={cc.moveUp(i.card.name)}
                                disabled={index === 0}
                                onClick={() => move(index, -1)}
                              >
                                ↑
                              </button>
                              <button
                                aria-label={cc.moveDown(i.card.name)}
                                disabled={index === tray.length - 1}
                                onClick={() => move(index, 1)}
                              >
                                ↓
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  <div className="tray-footer">
                    <button
                      className="import-list-button"
                      type="button"
                      disabled={!game}
                      onClick={() =>
                      {
                        setImportResult(undefined);
                        setImportStatus('');
                        setImportOpen(true);
                      }}
                    >
                      {importCopy[language].open}
                    </button>
                    <div className="save-deck">
                      <button className="save-list-button" disabled={!total || decksBusy} onClick={persistDeck}>
                        {activeDeckId ? t('updateSavedList') : t('saveAccount')}
                      </button>
                      {deckMessage && <small role="status">{deckMessage}</small>}
                    </div>
                    <button
                      type="button"
                      className={'share-list-button' + (justShared ? ' is-done' : '')}
                      disabled={!total}
                      onClick={() => void shareList()}
                    >
                      {justShared
                        ? (
                          <>
                            <svg viewBox="0 0 16 16" aria-hidden="true">
                              <path d="m3.5 8.5 3 3 6-7" />
                            </svg>
                            {shareCopy[language].done}
                          </>
                        )
                        : shareCopy[language].share}
                    </button>
                    {shareMessage && <small className="share-message" role="status">{shareMessage}</small>}
                    <button className="primary preview-button" disabled={!total} onClick={openPreview}>
                      {t('previewPrint')} <span>→</span>
                    </button>
                    <p className="print-hint">{t('cardsPerPage')}</p>
                    {total > 0 && (
                      <a
                        className="tray-accessory"
                        href={accessories[0].url}
                        target="_blank"
                        rel={accessoryRel(accessories[0].sponsored)}
                      >
                        <svg className="tray-accessory-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="8" y="3" width="12" height="16" rx="2" />
                          <path d="M16 19v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2" />
                        </svg>
                        <span>{ac.line(total)}</span>
                        <small>Amazon ↗</small>
                      </a>
                    )}
                    {(sheetHistory.canUndo || sheetHistory.canRedo) && (
                      <span className="tray-history">
                        <button
                          type="button"
                          className="text-button"
                          disabled={!sheetHistory.canUndo}
                          onClick={sheetHistory.undo}
                          title="Ctrl+Z"
                        >
                          ↶ {hc.undo}
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          disabled={!sheetHistory.canRedo}
                          onClick={sheetHistory.redo}
                          title="Ctrl+Shift+Z"
                        >
                          ↷ {hc.redo}
                        </button>
                      </span>
                    )}
                    {!!tray.length && (
                      <button
                        className="text-button clear"
                        onClick={() =>
                        {
                          if (window.confirm(t('clearSheet') + '?')) setTray([]);
                        }}
                      >
                        {t('clearSheet')}
                      </button>
                    )}
                    <AdSlot kind="sheet" language={language} />
                  </div>
                </aside>
              </div>
            )}
          {isSeoLanguage(language) && !seoPending && (
            <section className={'seo-guide' + (cardView ? ' is-card' : '')} aria-labelledby="seo-page-title">
              <div className="seo-guide-intro">
                {spotlight
                  ? (
                    <h2 id="seo-page-title">
                      {seoSetCopy(seoLanguage, seoGameSlug!, {
                        name: expansion!.name,
                        code: expansion!.code,
                        releaseDate: expansion!.releaseDate ?? null,
                        cardCount: cards.length,
                        languages: availablePrintLanguages.length ? availablePrintLanguages : ['en'],
                      })
                        .h1}
                    </h2>
                  )
                  : home
                  ? <h2 id="seo-page-title">{pageSeo.h1}</h2>
                  : <h1 id="seo-page-title">{pageSeo.h1}</h1>}
                <p>{pageSeo.intro}</p>
                <ul>{pageSeo.facts.map(fact => <li key={fact}>{fact}</li>)}</ul>
              </div>
              {pageSeo.faq.length > 0 && (
                <div className="seo-faq">
                  <h2>{seoUi[seoLanguage].faq}</h2>
                  {pageSeo.faq.map(item => (
                    <details key={item.question}>
                      <summary>{item.question}</summary>
                      <p>{item.answer}</p>
                    </details>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
        {total > 0 && !home && (
          <div className="mobile-sheet-bar">
            <span>{mobileCopy[language].summary(total, pages.length)}</span>
            <button
              type="button"
              className="secondary"
              onClick={() => document.querySelector('.tray')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              {mobileCopy[language].sheet}
            </button>
            <button type="button" className="primary" onClick={openPreview}>{mobileCopy[language].print}</button>
          </div>
        )}
        <SiteFooter language={language} source={footerSource} />
      </div>
      <AccountDialog
        dialogRef={accountDialog}
        theme={gameTheme(game?.name ?? 'Magic')}
        language={language}
        mode={mode}
        user={user}
        onClose={() => setAccountOpen(false)}
        auth={{ email, setEmail, busy: authBusy, message: authMessage, sendMagicLink, signInWithGoogle, signOut }}
        prints={{ records: prints, onReprint: reprint, onRemove: record => void forgetPrint(record) }}
        favorites={{
          games,
          selected: favoriteGames,
          busy: favoritesBusy,
          error: favoritesError,
          toggle: id => void toggleFavorite(id),
        }}
        lists={{
          decks: savedDecks,
          busy: decksBusy,
          refresh: () => void refreshDecks(),
          load: loadDeck,
          remove: deck => void deleteDeck(deck),
        }}
      />
      {shared && (() =>
      {
        const sharedGame = games.find(item => item.id === shared.items[0].card.gameId);
        return (
          <SharedArrival
            items={shared.items}
            missing={shared.missing}
            sheetCopies={total}
            gameName={sharedGame?.displayName ?? ''}
            theme={gameTheme(sharedGame?.name ?? game?.name ?? 'Magic')}
            language={language}
            mode={mode}
            onPrint={() => takeShared(true)}
            onAdd={() => takeShared(false)}
            onClose={() => setShared(null)}
          />
        );
      })()}
      <dialog
        ref={importDialog}
        data-game={gameTheme(game?.name ?? 'Magic')}
        onCancel={() => setImportOpen(false)}
        onClose={() => setImportOpen(false)}
        className="account-dialog import-dialog"
      >
        <div className="dialog-top">
          <div>
            <h2>{importCopy[language].title(game?.displayName ?? '')}</h2>
          </div>
          <button className="close" aria-label={importCopy[language].close} onClick={() => setImportOpen(false)}>
            ×
          </button>
        </div>
        <form
          className="import-form"
          onSubmit={e =>
          {
            e.preventDefault();
            void runImport();
          }}
        >
          <p>
            {importCopy[language].intro(importTools(game?.name ?? ''))}
            {/magic/i.test(game?.name ?? '') && <> {importCopy[language].link}</>}
          </p>
          {(game?.printLanguages?.length ?? 0) > 1 && game?.printLanguages?.includes(printLanguage)
            && printLanguage !== 'en' && (
            <p className="import-note">
              {importCopy[language].languageNote(
                cardLanguageName(game?.printLanguages?.includes(printLanguage) ? printLanguage : 'en'),
              )}
            </p>
          )}
          <textarea
            aria-label={importCopy[language].title(game?.displayName ?? '')}
            rows={10}
            spellCheck={false}
            value={importText}
            placeholder={importExamples((game?.name ?? '') + ' ' + (game?.displayName ?? ''))}
            onChange={e => setImportText(e.target.value)}
            disabled={importBusy}
          />
          <small className="import-note">{hc.lineLanguage}</small>
          {/magic/i.test(game?.name ?? '') && (
            <label className="print-toggle import-tokens">
              <input
                type="checkbox"
                checked={importTokens}
                onChange={e => setImportTokens(e.target.checked)}
                disabled={importBusy}
              />
              <span>
                {hc.tokens}
                <small>{hc.tokensHint}</small>
              </span>
            </label>
          )}
          <button className="primary" disabled={importBusy || !importText.trim()}>
            {importBusy ? importStatus : importCopy[language].submit}
          </button>
          {!importBusy && importStatus && <p role="alert">{importStatus}</p>}
          {importResult && (
            <div className="import-result" role="status">
              {importResult.cards > 0
                ? <p>{importCopy[language].added(importResult.cards, importResult.copies)}</p>
                : <p>{importCopy[language].nothing}</p>}
              {importResult.unresolved.length > 0 && (
                <>
                  <p>{importCopy[language].notFound(importResult.unresolved.length)}</p>
                  <ul>{importResult.unresolved.slice(0, 20).map(line => <li key={line}>{line}</li>)}</ul>
                </>
              )}
            </div>
          )}
        </form>
      </dialog>
      <dialog
        ref={printDialog}
        data-game={gameTheme(game?.name ?? 'Magic')}
        onCancel={event =>
        {
          event.preventDefault();
          closePreview();
        }}
        onClose={() => setPreview(false)}
        className="print-dialog"
      >
        {preview && <style>{`@page{size:${layout.width}mm ${layout.height}mm;margin:0}`}</style>}
        <header className="print-bar">
          <button type="button" className="print-back" onClick={closePreview}>
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
            {printPanelCopy[language].back}
          </button>
          <div className="print-bar-title">
            <h2>{pc.preview(layout.paper.label)}</h2>
            <p>{pc.summary(total, pages.length)}</p>
          </div>
        </header>
        <div className="print-layout">
          <aside className="print-panel">
            <PrintPanel
              settings={printSettings}
              update={setPrintSettings}
              layout={layout}
              language={language}
              pc={pc}
              kc={kc}
              lc={lc}
              pages={pages.length}
              exportingPage={exportingPage}
              onPng={index => void downloadPng(index)}
              onCutFile={downloadCutFile}
              mm={mmLabel}
              backImage={backImage}
              onChooseBack={file => void chooseBack(file)}
              presets={presets}
              onSavePreset={savePreset}
              onApplyPreset={preset => setPrintSettings(preset.settings)}
              onDeletePreset={deletePreset}
            />
            {(lowDpi > 0 || textProxies > 0 || refreshingImages || imageMessage) && (
              <section className="print-notes">
                {refreshingImages && <p role="status">{pc.refreshing}</p>}
                {imageMessage && <p role="alert" className="is-alert">{imageMessage}</p>}
                {lowDpi > 0 && (
                  <p>
                    <span className="image-dot limited" aria-hidden="true" />
                    {pc.lowQuality(lowDpi)}
                  </p>
                )}
                {textProxies > 0 && <p>{pc.textProxies(textProxies)}</p>}
              </section>
            )}
            <details className="print-advanced print-browser">
              <summary>{printPanelCopy[language].browserPrint}</summary>
              <ol className="print-steps">
                {pc.steps(layout.paper.label, layout.orientation === 'landscape' ? kc.landscape : kc.portrait).map(
                  step => <li key={step}>{step}</li>,
                )}
              </ol>
            </details>
            {total > 0 && (
              <section className="print-accessories">
                <p className="print-accessories-kicker">{ac.kicker}</p>
                <h3>{ac.title(total)}</h3>
                <p>{ac.body}</p>
                <div className="print-accessories-links">
                  {accessories.map(link => (
                    <a key={link.item} href={link.url} target="_blank" rel={accessoryRel(link.sponsored)}>
                      <span>{ac.items[link.item]}{link.item === 'boosters' && game ? ` ${game.displayName}` : ''}</span>
                      <small>Amazon ↗</small>
                    </a>
                  ))}
                </div>
              </section>
            )}
            <div className="print-action">
              <button
                type="button"
                className="primary"
                disabled={pdfProgress !== null || refreshingImages || !total}
                onClick={() => void downloadPdf()}
              >
                {pdfProgress ? lc.pdfProgress(pdfProgress.page, pdfProgress.pages) : lc.pdf}
              </button>
              <small className="print-hint">{lc.pdfHint}</small>
              <button
                type="button"
                className="secondary print-pdf"
                disabled={printing || refreshingImages}
                onClick={print}
              >
                {printing ? pc.preparing : pc.print}
              </button>
              <button
                type="button"
                className={'text-button print-share' + (justShared ? ' is-done' : '')}
                disabled={!total}
                onClick={() => void shareList()}
              >
                {justShared
                  ? (
                    <>
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="m3.5 8.5 3 3 6-7" />
                      </svg>
                      {shareCopy[language].done}
                    </>
                  )
                  : (
                    <>
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M8 10V2.5M5 5.5l3-3 3 3M3 9v4.5h10V9" />
                      </svg>
                      {shareCopy[language].share}
                    </>
                  )}
              </button>
              {preview && shareMessage && <small className="share-message" role="status">{shareMessage}</small>}
              {justPrinted && (
                <div className="print-saved" role="status">
                  <p>
                    <b>{phc.saved}</b>
                    {keepPrompt && <> {phc.keep}</>}
                  </p>
                  {keepPrompt && (
                    <div className="print-saved-actions">
                      <button
                        type="button"
                        className="primary"
                        onClick={() =>
                        {
                          recordStep('save-prompt-click');
                          setAccountOpen(true);
                        }}
                      >
                        {phc.keepAction}
                      </button>
                      <button type="button" className="text-button" onClick={dismissKeepPrompt}>{phc.dismiss}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
          <div className="print-pages">
            {pages.map((page, p) => (
              <React.Fragment key={p}>
                <section
                  className={'print-page' + (layout.orientation === 'landscape' ? ' is-landscape' : '')}
                  style={pageStyle}
                  aria-label={pc.page + ' ' + (p + 1)}
                >
                  {pageMarks(page.length)}
                  <div className="print-grid">
                    {page.map((card, i) => (
                      <div className="print-slot" key={i}>
                        {layout.bleed && (
                          <div className="print-bleed" aria-hidden="true" style={{ inset: bleedInset }}>
                            <CardImage language={language} card={card} mode={mode} eager />
                          </div>
                        )}
                        <div className="print-card">
                          <CardImage
                            language={language}
                            card={card}
                            mode={mode}
                            eager
                            print={{
                              onResolution: dpi => noteResolution(card.id, dpi),
                              onMissing: preview && mode !== 'demo' ? () => needText(card) : undefined,
                              details: mode === 'demo' ? null : proxyText[card.id],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <small className="page-label">{pc.pageLabel} · {p + 1}/{pages.length}</small>
                </section>
                {backsOn && backPage(page, p)}
              </React.Fragment>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
