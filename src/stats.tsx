import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { seoGames } from '../shared/seo';
import { accountsEnabled, loadSupabase } from './lib/supabase';
import { setStatsOptOut, statsOptedOut } from './lib/analytics';
import './stats.css';

// Private dashboard for the anonymous counters written by src/lib/analytics.ts. Readable only by users listed
// in public.stats_admins (enforced by the site_report function in Supabase, not by this page).
type Daily = { day: string; visits: number | null; views: number | null; prints: number | null; shop: number | null };
type Report = {
  since: string;
  daily: Daily[];
  games: { game: string; views: number; visits: number; prints: number; shop: number }[];
  sets: { game: string; expansion: string; views: number }[];
  pages: { path: string; views: number; visits: number }[];
  languages: { lang: string; views: number }[];
  referrers: { referrer: string; visits: number }[];
  zones: { zone: string; visits: number }[];
  devices: { device: string; visits: number }[];
  shops: { target: string; clicks: number }[];
  steps?: { step: string; count: number }[];
};

const ranges = [7, 30, 90] as const;
const number = new Intl.NumberFormat('it-IT');
const gameLabel = (slug: string) => slug === '' ? 'Home' : seoGames.find(game => game.slug === slug)?.label ?? slug;
const languageLabel: Record<string, string> = {
  en: 'Inglese',
  it: 'Italiano',
  de: 'Tedesco',
  fr: 'Francese',
  es: 'Spagnolo',
  '': 'Altro',
};
// Time zones only hint at the country; the common ones are named, the rest stay as the zone.
const usZone =
  /^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+|Menominee)$|^Pacific\/Honolulu$/;
const zoneCountry: Record<string, string> = {
  'Europe/Rome': 'Italia',
  'Europe/London': 'Regno Unito',
  'Europe/Dublin': 'Irlanda',
  'Europe/Berlin': 'Germania',
  'Europe/Paris': 'Francia',
  'Europe/Madrid': 'Spagna',
  'Europe/Amsterdam': 'Paesi Bassi',
  'Europe/Brussels': 'Belgio',
  'Europe/Zurich': 'Svizzera',
  'Europe/Vienna': 'Austria',
  'Europe/Warsaw': 'Polonia',
  'Europe/Lisbon': 'Portogallo',
  'Europe/Stockholm': 'Svezia',
  'America/Toronto': 'Canada',
  'America/Vancouver': 'Canada',
  'America/Edmonton': 'Canada',
  'America/Winnipeg': 'Canada',
  'America/Halifax': 'Canada',
  'America/Mexico_City': 'Messico',
  'America/Sao_Paulo': 'Brasile',
  'America/Argentina/Buenos_Aires': 'Argentina',
  'Asia/Tokyo': 'Giappone',
  'Asia/Seoul': 'Corea del Sud',
  'Asia/Shanghai': 'Cina',
  'Asia/Singapore': 'Singapore',
  'Asia/Manila': 'Filippine',
  'Asia/Bangkok': 'Thailandia',
  'Asia/Jakarta': 'Indonesia',
};
const countryOf = (zone: string) =>
  !zone
    ? 'Sconosciuto'
    : usZone.test(zone)
    ? 'Stati Uniti'
    : zone.startsWith('Australia/')
    ? 'Australia'
    : zoneCountry[zone] ?? zone;
const sum = (values: (number | null)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0);

// Each affiliate store's own report page (one Amazon programme per country, one eBay network for every site).
// Shops without a programme get none: their clicks are what to show them when asking for a partnership.
const shopReports: Record<string, string> = {
  'amazon.it': 'https://programma-affiliazione.amazon.it/home/reports',
  'amazon.com': 'https://affiliate-program.amazon.com/home/reports',
  'amazon.co.uk': 'https://affiliate-program.amazon.co.uk/home/reports',
  'amazon.de': 'https://partnernet.amazon.de/home/reports',
  'amazon.fr': 'https://partenaires.amazon.fr/home/reports',
  'amazon.es': 'https://afiliados.amazon.es/home/reports',
};
const shopReport = (host: string) =>
  shopReports[host] ?? (/(^|\.)ebay\./.test(host) ? 'https://partnernetwork.ebay.com/' : undefined);

function Bars({ rows }: { rows: { label: string; value: number; note?: string; href?: string }[] })
{
  const max = Math.max(1, ...rows.map(row => row.value));
  if (!rows.length) return <p className="st-empty">Ancora nessun dato.</p>;
  return (
    <ol className="st-bars">
      {rows.map(row => (
        <li key={row.label}>
          {row.href
            ? (
              <a className="st-bar-label" title={row.label} href={row.href} target="_blank" rel="noreferrer">
                {row.label} ↗
              </a>
            )
            : <span className="st-bar-label" title={row.label}>{row.label}</span>}
          <span className="st-bar-track">
            <span className="st-bar" style={{ width: `${Math.max(row.value / max * 100, 1.5)}%` }} />
          </span>
          <span className="st-bar-value">{number.format(row.value)}{row.note && <small>{row.note}</small>}</span>
        </li>
      ))}
    </ol>
  );
}

// From landing to print: each step is counted once per page load, so each bar reads as a share of the visits.
// Steps started on 7 October 2026; earlier visits in the range lower the shares.
function Funnel({ visits, steps }: { visits: number; steps: Map<string, number> })
{
  const rows = [
    { label: 'Visite', value: visits },
    { label: 'Aggiunto carte', value: steps.get('add') ?? 0 },
    { label: 'Aperto l’anteprima', value: steps.get('preview') ?? 0 },
    { label: 'Stampato', value: steps.get('printed') ?? 0 },
  ];
  const percent = (value: number) => visits ? `${number.format(Math.round(value / visits * 1000) / 10)}%` : '–';
  return (
    <Bars
      rows={rows.map((row, index) => ({
        label: row.label,
        value: row.value,
        note: index ? ` · ${percent(row.value)}` : undefined,
      }))}
    />
  );
}

// The daily chart shows the metric picked in the cards above it.
type Metric = 'visits' | 'views' | 'prints' | 'shop';
const metricLabels: Record<Metric, { plural: string; title: string }> = {
  visits: { plural: 'visite', title: 'Visite al giorno' },
  views: { plural: 'pagine', title: 'Pagine viste al giorno' },
  prints: { plural: 'stampe', title: 'Stampe al giorno' },
  shop: { plural: 'click negozi', title: 'Click ai negozi al giorno' },
};

function DailyChart({ daily, since, metric }: { daily: Daily[]; since: string; metric: Metric })
{
  // Every day of the range gets a slot, so quiet days show as gaps rather than disappearing.
  const byDay = new Map(daily.map(row => [row.day, row]));
  const days: string[] = [];
  for (const day = new Date(since + 'T00:00:00Z'); day <= new Date(); day.setUTCDate(day.getUTCDate() + 1))
  {
    days.push(day.toISOString().slice(0, 10));
  }
  const valueOf = (day: string) => Number(byDay.get(day)?.[metric] ?? 0);
  const max = Math.max(1, ...days.map(valueOf));
  const [hover, setHover] = useState<string>();
  const shown = hover ?? days[days.length - 1];
  const row = byDay.get(shown);
  const dayLabel = (day: string) =>
    new Date(day + 'T00:00:00Z').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <figure className="st-daily">
      <figcaption>
        <strong>{dayLabel(shown)}</strong>
        <span>{number.format(row?.visits ?? 0)} visite</span>
        <span>{number.format(row?.views ?? 0)} pagine</span>
        <span>{number.format(row?.prints ?? 0)} stampe</span>
        <span>{number.format(row?.shop ?? 0)} click negozi</span>
      </figcaption>
      <div
        className={'st-columns is-' + metric}
        onMouseLeave={() => setHover(undefined)}
        role="img"
        aria-label={metricLabels[metric].title}
      >
        {days.map(day =>
        {
          const value = valueOf(day);
          return (
            <button
              type="button"
              key={day}
              className={day === shown ? 'is-active' : ''}
              onMouseEnter={() => setHover(day)}
              onFocus={() => setHover(day)}
              aria-label={`${dayLabel(day)}: ${value} ${metricLabels[metric].plural}`}
            >
              <span style={{ height: `${value / max * 100}%` }} />
            </button>
          );
        })}
      </div>
      <div className="st-axis">
        <span>{dayLabel(days[0])}</span>
        <span>{number.format(max)} max</span>
        <span>{dayLabel(days[days.length - 1])}</span>
      </div>
    </figure>
  );
}

function Dashboard({ session, preset }: { session?: Session; preset?: Report })
{
  const [days, setDays] = useState<number>(30);
  const [metric, setMetric] = useState<Metric>('visits');
  const [report, setReport] = useState<Report | undefined>(preset);
  const [error, setError] = useState('');
  useEffect(() =>
  {
    if (preset) return;
    let live = true;
    setError('');
    void loadSupabase().then(supabase => supabase!.rpc('site_report', { days })).then(({ data, error }) =>
    {
      if (!live) return;
      if (error) setError(error.code === '42501' ? 'denied' : error.message);
      else setReport(data as Report);
    });
    return () =>
    {
      live = false;
    };
  }, [days, preset]);
  if (error === 'denied')
  {
    return (
      <section className="st-panel st-note">
        <h2>Accesso non abilitato</h2>
        <p>Questo account non è tra gli amministratori delle statistiche. Nel SQL Editor di Supabase esegui:</p>
        <pre>insert into public.stats_admins (user_id) values ('{session?.user.id}');</pre>
        <p>poi ricarica la pagina.</p>
      </section>
    );
  }
  if (error)
  {
    return (
      <section className="st-panel st-note">
        <h2>Errore</h2>
        <p>{error}</p>
        <p>
          Se la funzione non esiste, applica <code>supabase/migrations/20261004000000_site_stats.sql</code>.
        </p>
      </section>
    );
  }
  if (!report) return <p className="st-empty">Carico…</p>;

  const countries = new Map<string, number>();
  for (const row of report.zones)
  {
    countries.set(countryOf(row.zone), (countries.get(countryOf(row.zone)) ?? 0) + row.visits);
  }
  const totals = [
    {
      metric: 'visits' as Metric,
      label: 'Visite',
      value: sum(report.daily.map(row => row.visits)),
      hint: 'arrivi da fuori o diretti',
    },
    {
      metric: 'views' as Metric,
      label: 'Pagine viste',
      value: sum(report.daily.map(row => row.views)),
      hint: 'anche navigazione interna',
    },
    {
      metric: 'prints' as Metric,
      label: 'Stampe',
      value: sum(report.daily.map(row => row.prints)),
      hint: 'fogli mandati in stampa',
    },
    {
      metric: 'shop' as Metric,
      label: 'Click negozi',
      value: sum(report.daily.map(row => row.shop)),
      hint: 'Amazon, eBay, TCGplayer…',
    },
  ];
  const steps = new Map((report.steps ?? []).map(row => [row.step, Number(row.count)]));
  const comers = (steps.get('return') ?? 0) + (steps.get('new') ?? 0);
  return (
    <>
      <div className="st-range" role="group" aria-label="Periodo">
        {ranges.map(range => (
          <button type="button" key={range} aria-pressed={days === range} onClick={() => setDays(range)}>
            {range} giorni
          </button>
        ))}
      </div>
      <section className="st-kpis" aria-label="Grafico da mostrare">
        {totals.map(item => (
          <button
            type="button"
            key={item.label}
            aria-pressed={metric === item.metric}
            onClick={() => setMetric(item.metric)}
          >
            <span>{item.label}</span>
            <strong>{number.format(item.value)}</strong>
            <small>{item.hint}</small>
          </button>
        ))}
      </section>
      <section className="st-panel st-wide">
        <h2>{metricLabels[metric].title}</h2>
        <DailyChart daily={report.daily} since={report.since} metric={metric} />
      </section>
      <section className="st-panel">
        <h2>
          Dalla visita alla stampa <small>(una volta per visita)</small>
        </h2>
        <Funnel visits={comers || sum(report.daily.map(row => row.visits))} steps={steps} />
      </section>
      <section className="st-panel">
        <h2>
          Ritorni e strumenti <small>(di ritorno: tornati un altro giorno)</small>
        </h2>
        <Bars
          rows={comers
            ? [
              {
                label: 'Di ritorno',
                value: steps.get('return') ?? 0,
                note: ` · ${Math.round((steps.get('return') ?? 0) / comers * 100)}%`,
              },
              { label: 'Nuovi', value: steps.get('new') ?? 0 },
              { label: 'Liste importate', value: steps.get('import') ?? 0 },
              { label: 'Importate da link', value: steps.get('import-link') ?? 0 },
              { label: 'Liste condivise', value: steps.get('share') ?? 0 },
              { label: 'Link condivisi aperti', value: steps.get('shared-open') ?? 0 },
              { label: '… stampati subito', value: steps.get('shared-print') ?? 0 },
              { label: '… aggiunti al foglio', value: steps.get('shared-add') ?? 0 },
            ]
            : []}
        />
      </section>
      <section className="st-panel st-wide">
        <h2>Giochi</h2>
        <table className="st-table">
          <thead>
            <tr>
              <th>Gioco</th>
              <th>Pagine</th>
              <th>Visite</th>
              <th>Stampe</th>
              <th>Click negozi</th>
            </tr>
          </thead>
          <tbody>
            {report.games.map(row => (
              <tr key={row.game}>
                <td>{gameLabel(row.game)}</td>
                <td>{number.format(row.views)}</td>
                <td>{number.format(row.visits)}</td>
                <td>{number.format(row.prints)}</td>
                <td>{number.format(row.shop)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!report.games.length && <p className="st-empty">Ancora nessun dato.</p>}
      </section>
      <section className="st-panel">
        <h2>Espansioni più viste</h2>
        <Bars
          rows={report.sets.map(row => ({ label: `${gameLabel(row.game)} · ${row.expansion}`, value: row.views }))}
        />
      </section>
      <section className="st-panel">
        <h2>Da dove arrivano</h2>
        <Bars
          rows={report.referrers.map(row => ({
            label: row.referrer || 'Diretto / nessun referrer',
            value: row.visits,
          }))}
        />
      </section>
      <section className="st-panel">
        <h2>
          Paesi <small>(stima dal fuso orario)</small>
        </h2>
        <Bars rows={[...countries].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} />
      </section>
      <section className="st-panel">
        <h2>Lingua delle pagine</h2>
        <Bars rows={report.languages.map(row => ({ label: languageLabel[row.lang] ?? row.lang, value: row.views }))} />
      </section>
      <section className="st-panel">
        <h2>Dispositivi</h2>
        <Bars
          rows={report.devices.map(row => ({
            label: row.device === 'mobile' ? 'Mobile / touch' : row.device === 'desktop' ? 'Desktop' : 'Altro',
            value: row.visits,
          }))}
        />
      </section>
      <section className="st-panel">
        <h2>
          Click per negozio <small>(link: report del programma)</small>
        </h2>
        <Bars
          rows={report.shops.map(row =>
          {
            const href = shopReport(row.target);
            return { label: row.target, value: row.clicks, href, note: href ? undefined : ' · nessuna affiliazione' };
          })}
        />
      </section>
      <section className="st-panel st-wide">
        <h2>Pagine più viste</h2>
        <Bars
          rows={report.pages.map(row => ({
            label: row.path,
            value: row.views,
            note: row.visits ? ` · ${number.format(row.visits)} ingressi` : undefined,
          }))}
        />
      </section>
    </>
  );
}

// Local preview with made-up numbers: /dev/stats/?demo (development server only).
const demo = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV
  && new URLSearchParams(location.search).has('demo');
function demoReport(): Report
{
  const since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const daily = Array.from({ length: 30 }, (_, index) =>
  {
    const day = new Date(Date.parse(since) + index * 864e5).toISOString().slice(0, 10);
    const visits = Math.round(20 + index * 3 + Math.sin(index) * 12);
    return { day, visits, views: visits * 4, prints: Math.round(visits / 5), shop: Math.round(visits / 9) };
  });
  return {
    since,
    daily,
    games: [
      { game: 'pokemon', views: 1840, visits: 420, prints: 96, shop: 31 },
      { game: 'magic-the-gathering', views: 1220, visits: 300, prints: 71, shop: 22 },
      { game: 'one-piece', views: 640, visits: 150, prints: 40, shop: 9 },
      { game: '', views: 520, visits: 380, prints: 0, shop: 0 },
      { game: 'disney-lorcana', views: 310, visits: 70, prints: 18, shop: 4 },
    ],
    sets: [
      { game: 'pokemon', expansion: 'sv09', views: 610 },
      { game: 'magic-the-gathering', expansion: 'eoe', views: 420 },
      { game: 'one-piece', expansion: 'op-13', views: 300 },
    ],
    pages: [
      { path: '/en/', views: 420, visits: 300 },
      { path: '/en/pokemon/sv09/', views: 380, visits: 120 },
      { path: '/it/pokemon/sv09/125/', views: 44, visits: 30 },
    ],
    languages: [{ lang: 'en', views: 2600 }, { lang: 'it', views: 900 }, { lang: 'de', views: 300 }],
    referrers: [
      { referrer: '', visits: 520 },
      { referrer: 'google.com', visits: 410 },
      { referrer: 'reddit.com', visits: 80 },
    ],
    zones: [
      { zone: 'America/New_York', visits: 300 },
      { zone: 'America/Los_Angeles', visits: 180 },
      { zone: 'Europe/Rome', visits: 160 },
      { zone: 'Europe/London', visits: 90 },
      { zone: 'Asia/Tokyo', visits: 20 },
    ],
    devices: [{ device: 'mobile', visits: 610 }, { device: 'desktop', visits: 400 }],
    shops: [
      { target: 'amazon.com', clicks: 30 },
      { target: 'ebay.com', clicks: 21 },
      { target: 'tcgplayer.com', clicks: 12 },
    ],
    steps: [
      { step: 'new', count: 820 },
      { step: 'return', count: 190 },
      { step: 'add', count: 430 },
      { step: 'preview', count: 260 },
      { step: 'printed', count: 180 },
      { step: 'import', count: 70 },
      { step: 'import-link', count: 25 },
      { step: 'share', count: 12 },
      { step: 'shared-open', count: 9 },
      { step: 'shared-print', count: 4 },
      { step: 'shared-add', count: 3 },
    ],
  };
}

// Whoever opens this page runs the site: their browser stops counting in visits, clicks and the print ranking.
function DeviceExclusion()
{
  const [excluded, setExcluded] = useState(() =>
  {
    setStatsOptOut(true);
    return statsOptedOut();
  });
  const toggle = () =>
  {
    setStatsOptOut(!excluded);
    setExcluded(statsOptedOut());
  };
  return (
    <p className="st-device">
      {excluded
        ? 'Questo dispositivo è escluso dalle statistiche.'
        : 'Questo dispositivo viene contato nelle statistiche.'}{' '}
      <button type="button" className="st-link" onClick={toggle}>{excluded ? 'Contalo di nuovo' : 'Escludilo'}</button>
    </p>
  );
}

function Stats()
{
  const [session, setSession] = useState<Session | null>();
  useEffect(() =>
  {
    if (!accountsEnabled) return;
    let live = true;
    let subscription: { unsubscribe(): void } | undefined;
    void loadSupabase().then(supabase =>
    {
      if (!supabase || !live) return;
      void supabase.auth.getSession().then(({ data }) => setSession(data.session));
      subscription = supabase.auth.onAuthStateChange((_event, next) => setSession(next)).data.subscription;
    });
    return () =>
    {
      live = false;
      subscription?.unsubscribe();
    };
  }, []);
  const signIn = () =>
    void loadSupabase().then(supabase =>
      supabase!.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname },
      })
    );
  return (
    <main className="st-page">
      <header className="st-head">
        <div>
          <a href="/en/" className="st-brand">SleeveReady</a>
          <h1>Statistiche</h1>
        </div>
        {session && (
          <button
            type="button"
            className="st-link"
            onClick={() => void loadSupabase().then(supabase => supabase!.auth.signOut())}
          >
            Esci
          </button>
        )}
      </header>
      <DeviceExclusion />
      {demo
        ? <Dashboard preset={demoReport()} />
        : !accountsEnabled
        ? <p className="st-empty">Supabase non è configurato (VITE_SUPABASE_URL).</p>
        : session === undefined
        ? <p className="st-empty">Carico…</p>
        : !session
        ? (
          <section className="st-panel st-note">
            <h2>Accedi</h2>
            <p>Le statistiche sono visibili solo agli amministratori.</p>
            <button type="button" className="st-button" onClick={signIn}>Accedi con Google</button>
          </section>
        )
        : <Dashboard session={session} />}
      <footer className="st-foot">
        Contatori anonimi giornalieri, senza cookie né dati personali. Le visite escludono la navigazione interna; i bot
        noti sono esclusi.
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Stats />
  </React.StrictMode>,
);
