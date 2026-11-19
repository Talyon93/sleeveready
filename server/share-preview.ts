// A shared list's link preview: the page a list link opens (?list=…) gets its own og:image, a fan of the list's first
// cards drawn here as a PNG, so the link shows the cards wherever it is pasted (WhatsApp, Discord, Telegram…).
// Both answers depend only on the address, so the CDN keeps them; each list is drawn about once.
import { readFile } from 'node:fs/promises';
import jpeg from 'jpeg-js';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { createRequire } from 'node:module';
import type { Express, Request } from 'express';
import type { CatalogCard } from '../shared/model.ts';
import { decodeSharedList, type SharedEntry } from '../shared/shareList.ts';
import { safeImageUrl, thumbnailUrl } from '../shared/images.ts';
import { isSeoLanguage, type SeoLanguage } from '../shared/seo.ts';
import { rateLimit } from './rate-limit.ts';

type Catalog = { cards: (expansionId: number, language: string) => Promise<{ data: CatalogCard[] }> };
type Options = { catalogFor: (expansionId: number) => Catalog | undefined; origin?: string };

// A list can name up to 250 cards across as many sets; the picture needs five, so at most MAX_SETS card lists are
// loaded per picture, whatever the list holds.
const WIDTH = 1200, HEIGHT = 630, FAN = 5, MAX_SETS = 6;
const CARD_W = 290, CARD_H = Math.round(CARD_W * 88 / 63);
const userAgent = 'SleeveReady/1.0 (+https://sleeveready.com)';

// The renderer's WebAssembly file sits in its package (kept outside the function bundle, netlify.toml), found from the
// running file: the bundle on Netlify (CommonJS, where import.meta.url is empty) or this module in development.
let ready: Promise<void> | undefined;
function resvgReady()
{
  return ready ??= (async () =>
  {
    const require = createRequire(typeof __filename === 'string' ? __filename : import.meta.url);
    await initWasm(await readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
  })()
    .catch(error =>
    {
      ready = undefined;
      throw error;
    });
}

const titles: Record<SeoLanguage, (copies: number) => string> = {
  en: n => `${n} ${n === 1 ? 'card' : 'cards'} ready to print`,
  it: n => `${n} ${n === 1 ? 'carta pronta' : 'carte pronte'} da stampare`,
  de: n => `${n} ${n === 1 ? 'Karte' : 'Karten'} zum Drucken`,
  fr: n => `${n} ${n === 1 ? 'carte prête' : 'cartes prêtes'} à imprimer`,
  es: n => `${n} ${n === 1 ? 'carta lista' : 'cartas listas'} para imprimir`,
};
const escape = (value: string) =>
  value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
const listOf = (req: Request) =>
{
  const value = req.query.list;
  return typeof value === 'string' ? value : Array.isArray(value) && typeof value[0] === 'string' ? value[0] : '';
};

// The first cards of the list, each looked up in its set and language like the app does when the link opens.
async function firstCards(entries: SharedEntry[], options: Options)
{
  const lists = new Map<string, Promise<CatalogCard[]>>();
  const cards: CatalogCard[] = [];
  for (const entry of entries)
  {
    if (cards.length >= FAN * 2) break;
    const catalog = options.catalogFor(entry.expansionId);
    if (!catalog) continue;
    const key = entry.expansionId + '|' + entry.language;
    if (!lists.has(key))
    {
      if (lists.size >= MAX_SETS) continue;
      lists.set(key, catalog.cards(entry.expansionId, entry.language).then(result => result.data, () => []));
    }
    const card = (await lists.get(key)!).find(item => item.id === entry.cardId);
    if (card && !cards.some(item => item.id === card.id)) cards.push(card);
  }
  return cards;
}

// Width and height from a PNG or JPEG header, to turn landscape cards (Sorcery sites, Star Wars bases) upright.
function imageSize(bytes: Buffer): { width: number; height: number } | null
{
  if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47)
  {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  for (let offset = 2; offset + 9 < bytes.length;)
  {
    if (bytes[offset] !== 0xff)
    {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
    {
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  return null;
}

// The renderer reads JPEG and PNG only. On the site, each card goes through Netlify's image CDN as a small JPEG (it
// converts the WebP of Gundam, Cyberpunk or Riftbound thumbnails, and every card host is allowed in netlify.toml);
// in development, or if that fails, the image is taken from its source, asked as JPEG where the source can do it.
async function imageData(card: CatalogCard, origin: string)
{
  const source = [...(card.imageUrls ?? []), card.imageUrl].map(safeImageUrl).find((url): url is string =>
    url !== null
  );
  if (!source) return null;
  const direct = new URL((thumbnailUrl(source) ?? source).replace('fm=webp', 'fm=jpg'), origin).href;
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(origin);
  const tries = [
    ...(local ? [] : [`${origin}/.netlify/images?url=${encodeURIComponent(source)}&w=440&fm=jpg&q=82`]),
    direct,
  ];
  for (const url of tries)
  {
    try
    {
      const response = await fetch(url, {
        headers: { 'User-Agent': userAgent, Accept: 'image/jpeg,image/png;q=0.9' },
        signal: AbortSignal.timeout(6000),
      });
      const type = response.headers.get('content-type')?.split(';')[0] ?? '';
      if (!response.ok || !/^image\/(png|jpeg)$/.test(type)) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 3_000_000) continue;
      const size = imageSize(bytes);
      return {
        href: `data:${type};base64,${bytes.toString('base64')}`,
        landscape: Boolean(size && size.width > size.height),
      };
    }
    catch
    {
      /* Try the next source. */
    }
  }
  return null;
}

// The site's picture when a list has no card the renderer can draw: sent as is, since a redirect would carry the list on.
async function fallbackImage(origin: string)
{
  const response = await fetch(`${origin}/og-image.png`, { signal: AbortSignal.timeout(6000) });
  return Buffer.from(await response.arrayBuffer());
}

// The site's mark (public/favicon.svg), bottom left: shapes only, so no font is needed.
const logo =
  '<g transform="translate(44 534) scale(1.05)"><rect width="64" height="64" rx="14" fill="#24232a" stroke="#4a4952"/><rect x="16" y="7" width="32" height="46" rx="4.5" fill="#fffaf0"/><path fill="none" stroke="#24232a" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" transform="translate(32 24.5) scale(0.78) translate(-34 -32)" d="M32 25.5c-1.1-1.6-3-2.5-5.1-2.5-3.1 0-5.2 1.6-5.2 4 0 2.4 1.8 3.4 5.2 4.1 3.2.7 5.2 1.8 5.2 4.3 0 2.5-2.3 4.3-5.6 4.3-2.5 0-4.7-1-5.9-2.8M37 41V23h4.6c3.1 0 5 1.8 5 4.6s-1.9 4.6-5 4.6H37M41.8 32.2 46.8 41"/><path d="M12.5 40h39v11a6 6 0 0 1-6 6h-27a6 6 0 0 1-6-6Z" fill="#f3cc63"/></g>';
type Picture = { href: string; landscape: boolean };
export function fanSvg(images: Picture[])
{
  const count = images.length;
  const step = count > 1 ? Math.min(170, 520 / (count - 1)) : 0;
  const spread = count > 1 ? 7 : 0;
  const cards = images
    .map(({ href, landscape }, index) =>
    {
      const offset = index - (count - 1) / 2;
      const x = WIDTH / 2 + offset * step - CARD_W / 2;
      const y = (HEIGHT - CARD_H) / 2 + Math.abs(offset) * 14 + 8;
      return `<g transform="rotate(${offset * spread} ${x + CARD_W / 2} ${
        y + CARD_H
      })"><rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="14" fill="#000" filter="url(#shadow)"/>${
        landscape
          ? `<g clip-path="url(#card${index})"><image href="${href}" x="${x + CARD_W / 2 - CARD_H / 2}" y="${
            y + CARD_H / 2 - CARD_W / 2
          }" width="${CARD_H}" height="${CARD_W}" preserveAspectRatio="xMidYMid slice" transform="rotate(90 ${
            x + CARD_W / 2
          } ${y + CARD_H / 2})"/></g>`
          : `<image href="${href}" x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" preserveAspectRatio="xMidYMid slice" clip-path="url(#card${index})"/>`
      }</g>`;
    })
    .join('');
  const clips = images
    .map((_, index) =>
    {
      const offset = index - (count - 1) / 2;
      const x = WIDTH / 2 + offset * step - CARD_W / 2;
      const y = (HEIGHT - CARD_H) / 2 + Math.abs(offset) * 14 + 8;
      return `<clipPath id="card${index}"><rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="14"/></clipPath>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><defs><radialGradient id="glow" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#3a3742"/><stop offset="1" stop-color="#1d1c22"/></radialGradient><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity=".55"/></filter>${clips}</defs><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>${cards}${logo}</svg>`;
}

export function registerSharePreview(app: Express, options: Options)
{
  // Each new list misses the CDN and costs a render, so both answers are limited per visitor. Over the limit the
  // picture answers 429 and the page is served as usual, without the list's own preview.
  const imageLimit = rateLimit(20, 60_000);
  const pageLimit = rateLimit(60, 60_000, (_req, res, next) =>
  {
    res.removeHeader('Retry-After');
    next('skip');
  });
  // The picture: up to five cards fanned on the site's dark ground.
  app.get('/api/catalog/share-image', imageLimit, async (req, res, next) =>
  {
    try
    {
      const origin = options.origin ?? `${req.protocol}://${req.get('host')}`;
      const entries = decodeSharedList(listOf(req));
      if (!entries.length)
      {
        res.set('Cache-Control', 'public, max-age=3600').type('image/png').send(await fallbackImage(origin));
        return;
      }
      const cards = await firstCards(entries, options);
      const images = (await Promise.all(cards.map(card => imageData(card, origin))))
        .filter((item): item is Picture => item !== null)
        .slice(0, FAN);
      if (!images.length)
      {
        res
          .set('Cache-Control', 'public, max-age=3600')
          .set('Netlify-CDN-Cache-Control', 'public, durable, s-maxage=86400')
          .set('Netlify-Vary', 'query=list')
          .type('image/png')
          .send(await fallbackImage(origin));
        return;
      }
      await resvgReady();
      // A JPEG: a PNG of card art weighs about a megabyte, and WhatsApp drops previews much over 300 KB.
      const picture = new Resvg(fanSvg(images), { fitTo: { mode: 'width', value: WIDTH }, background: '#1d1c22' })
        .render();
      const encoded = jpeg.encode(
        { data: Buffer.from(picture.pixels), width: picture.width, height: picture.height },
        82,
      );
      res
        .set('Cache-Control', 'public, max-age=86400')
        .set('Netlify-CDN-Cache-Control', 'public, durable, s-maxage=31536000')
        .set('Netlify-Vary', 'query=list')
        .type('image/jpeg')
        .send(encoded.data);
    }
    catch (error)
    {
      next(error);
    }
  });
  // The page: the same page as without the list (fetched from the site), with the list's title and picture in its
  // link-preview tags and kept out of search results (its canonical address stays the page's own).
  app.get(/^\/(?!api\/)[^.]*$/, async (req, res, next) =>
  {
    const list = listOf(req);
    const entries = decodeSharedList(list);
    if (!entries.length)
    {
      next();
      return;
    }
    let allowed = false;
    pageLimit(req, res, (skip?: unknown) =>
    {
      allowed = skip === undefined;
    });
    if (!allowed)
    {
      next();
      return;
    }
    try
    {
      const origin = options.origin ?? `${req.protocol}://${req.get('host')}`;
      const page = await fetch(new URL(req.path, origin), {
        headers: { Accept: 'text/html' },
        signal: AbortSignal.timeout(8000),
      });
      if (!page.ok)
      {
        next();
        return;
      }
      const language = req.path.split('/')[1] ?? '';
      const title =
        titles[isSeoLanguage(language) ? language : 'en'](entries.reduce((sum, entry) => sum + entry.quantity, 0))
        + ' · SleeveReady';
      const image = `${origin}/api/catalog/share-image?list=${encodeURIComponent(list)}`;
      const html = (await page.text())
        .replace(
          /<meta property="og:image" content="[^"]*"\/?>/,
          `<meta property="og:image" content="${escape(image)}"/>`,
        )
        .replace(
          /<meta name="twitter:image" content="[^"]*"\/?>/,
          `<meta name="twitter:image" content="${escape(image)}"/>`,
        )
        .replace(
          /<meta property="og:title" content="[^"]*"\/?>/,
          `<meta property="og:title" content="${escape(title)}"/>`,
        )
        .replace(
          /<meta name="twitter:title" content="[^"]*"\/?>/,
          `<meta name="twitter:title" content="${escape(title)}"/>`,
        )
        .replace(
          /<meta property="og:image:alt" content="[^"]*"\/?>/,
          `<meta property="og:image:alt" content="${escape(title)}"/>`,
        )
        .replace(/<meta name="robots" content="[^"]*"\/?>/, '<meta name="robots" content="noindex"/>');
      res
        .set('Cache-Control', 'public, max-age=300')
        .set('Netlify-CDN-Cache-Control', 'public, durable, s-maxage=86400')
        .set('Netlify-Vary', 'query=list')
        .type('text/html')
        .send(html);
    }
    catch (error)
    {
      next(error);
    }
  });
}
