import { accountsEnabled, loadSupabase } from './supabase';

// Anonymous daily counters for /dev/stats/ (see supabase/migrations/20261004000000_site_stats.sql).
// Nothing identifies the visitor: only the page, the referring site, the time zone, whether the screen is touch-first
// and the steps of the visit. The browser keeps one date, the first visit, to tell returning visitors from new ones.
// Failures never affect the site.
type Kind = 'view' | 'print' | 'shop' | 'step';
export type Step =
  | 'add'
  | 'preview'
  | 'printed'
  | 'import'
  | 'import-link'
  | 'share'
  | 'save-prompt'
  | 'save-prompt-click'
  | 'reprint'
  | 'shared-open'
  | 'shared-print'
  | 'shared-add';
const shopHost = /(^|\.)(amazon\.[a-z.]+|ebay\.[a-z.]+|tcgplayer\.com|cardtrader\.com|cardmarket\.com)$/;
// Crawlers that drive a real Chrome on a server still give themselves away: no graphics card (WebGL drawn in software
// by SwiftShader or llvmpipe), a zero-size screen, or no languages. Checked once per page load.
function softwareGraphics()
{
  try
  {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    return /swiftshader|llvmpipe|softpipe|software|mesa offscreen/i.test(renderer);
  }
  catch
  {
    return false;
  }
}
let headless: boolean | undefined;
const headlessBrowser = () =>
  headless ??= softwareGraphics() || !screen.width || !screen.height || !navigator.languages?.length;
const automated = () =>
  navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse|preview|Claude\//i.test(navigator.userAgent)
  || headlessBrowser();
// Only the public site counts: no local development, no Netlify preview or alias addresses.
const countedHost = () => !/^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.netlify\.app$/.test(location.hostname);
// The site's own people opt their browsers out: opening /dev/stats/, or any page with ?nostats=1 (?nostats=0 undoes it).
const OPT_OUT = 'sleeveready.noStats';
export function statsOptedOut()
{
  try
  {
    return localStorage.getItem(OPT_OUT) === '1';
  }
  catch
  {
    return false;
  }
}
// Shared with the print ranking: the site's own browsers, bots and development never count.
export const countsVisitor = () => !automated() && countedHost() && !statsOptedOut();
export function setStatsOptOut(excluded: boolean)
{
  try
  {
    if (excluded) localStorage.setItem(OPT_OUT, '1');
    else localStorage.removeItem(OPT_OUT);
  }
  catch
  {
    /* Storage unavailable: nothing to remember. */
  }
}
const cleanPath = (path: string) =>
{
  const value = path.toLowerCase().replace(/\/{2,}/g, '/').slice(0, 160);
  return /^\/[a-z0-9/_-]*$/.test(value) ? value : '/other';
};
const zone = (() =>
{
  try
  {
    return (Intl.DateTimeFormat().resolvedOptions().timeZone ?? '').replace(/[^A-Za-z0-9/_+-]/g, '').slice(0, 40);
  }
  catch
  {
    return '';
  }
})();
const device = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches ? 'mobile' : 'desktop';
const externalReferrer = () =>
{
  try
  {
    const url = new URL(document.referrer);
    return url.host === location.host ? '' : url.hostname.replace(/^www\./, '').toLowerCase().slice(0, 80);
  }
  catch
  {
    return '';
  }
};

// Crawlers driving a real Chrome load a page and leave without touching it: nothing is sent until a person moves
// the mouse, touches, scrolls with the wheel or presses a key. Hits before that wait in the queue.
const humanEvents = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'keydown'] as const;
let human = false;
const waiting: (() => void)[] = [];
let watching = false;
function watchForPerson()
{
  if (watching) return;
  watching = true;
  const confirm = () =>
  {
    if (human) return;
    human = true;
    for (const name of humanEvents) window.removeEventListener(name, confirm, true);
    for (const run of waiting.splice(0)) run();
    for (const task of personTasks.splice(0)) task();
  };
  for (const name of humanEvents) window.addEventListener(name, confirm, { capture: true, passive: true });
}
// Work worth doing only for people (outside calls that cost money): runs after the first human gesture, never for
// automated browsers. Usable before or after analytics starts.
const personTasks: (() => void)[] = [];
export function whenPerson(task: () => void)
{
  if (typeof window === 'undefined' || automated()) return;
  if (human)
  {
    task();
    return;
  }
  personTasks.push(task);
  watchForPerson();
}
function send(
  kind: Kind,
  { target = '', referrer = '', entry = false }: { target?: string; referrer?: string; entry?: boolean } = {},
)
{
  if (!accountsEnabled || !countsVisitor()) return;
  const path = cleanPath(location.pathname);
  const run = () =>
    void loadSupabase()
      .then(client => client?.rpc('record_hit', { kind, path, target, referrer, zone, device, entry }))
      .then(() => undefined, () => undefined);
  if (human) run();
  else waiting.push(run);
}

// The method (browser print dialog, PDF or Cricut PNG download) goes in the target, so the report can tell them apart.
export const recordPrintHit = (method: 'browser' | 'pdf' | 'png' = 'browser') =>
{
  send('print', { target: method });
  recordStep('printed');
};
// Each step counts once per page load, so the dashboard reads them against the visits (visit → card → preview → print).
const stepsDone = new Set<string>();
export function recordStep(step: Step | 'return' | 'new')
{
  if (stepsDone.has(step)) return;
  stepsDone.add(step);
  send('step', { target: step });
}

// First visit date (YYYY-MM-DD, nothing else), kept 13 months: a landing on a later day is a returning visitor.
const SEEN = 'sleeveready.firstVisit';
function returning()
{
  const today = new Date().toISOString().slice(0, 10);
  try
  {
    const first = localStorage.getItem(SEEN);
    const age = first && /^\d{4}-\d{2}-\d{2}$/.test(first) ? Date.now() - Date.parse(first) : NaN;
    if (Number.isFinite(age) && age >= 0 && age < 396 * 864e5) return first! < today;
    localStorage.setItem(SEEN, today);
  }
  catch
  {
    /* Storage unavailable: counted as new. */
  }
  return false;
}

let started = false;
/** Counts the landing page as a visit, then every in-app navigation as a page view, and clicks on shop links. */
export function startAnalytics()
{
  if (started || typeof window === 'undefined') return;
  started = true;
  watchForPerson();
  const flag = new URLSearchParams(location.search).get('nostats');
  if (flag === '1' || flag === '0') setStatsOptOut(flag === '1');
  const referrer = externalReferrer();
  // A landing from another site (or typed in) is a visit; full reloads between our own pages are only views.
  const entry = !document.referrer || referrer !== '';
  let lastPath = location.pathname;
  send('view', { referrer, entry });
  if (entry && countsVisitor()) recordStep(returning() ? 'return' : 'new');
  let timer: number | undefined;
  const changed = () =>
  {
    window.clearTimeout(timer);
    timer = window.setTimeout(() =>
    {
      if (location.pathname !== lastPath)
      {
        lastPath = location.pathname;
        send('view');
      }
    }, 400);
  };
  for (const method of ['pushState', 'replaceState'] as const)
  {
    const original = history[method].bind(history);
    history[method] = (...args: Parameters<History['pushState']>) =>
    {
      original(...args);
      changed();
    };
  }
  window.addEventListener('popstate', changed);
  const onClick = (event: MouseEvent) =>
  {
    if (event.type === 'auxclick' && event.button !== 1) return;
    const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!link) return;
    try
    {
      const host = new URL(link.href).hostname.toLowerCase();
      if (shopHost.test(host)) send('shop', { target: host.replace(/^www\./, '').slice(0, 80) });
    }
    catch
    {
      /* Not a URL. */
    }
  };
  document.addEventListener('click', onClick, true);
  document.addEventListener('auxclick', onClick, true);
}
