// The median of the five cheapest "Buy It Now" listings on the eBay site of the page language, from eBay's Browse API (application token,
// keys in EBAY_CLIENT_ID and EBAY_CLIENT_SECRET). Only listings whose title names the card count; graded cards, lots
// and proxies are left out, so the price is a starting point for one raw copy.
import type { CardPrice } from '../shared/model.ts';
import type { SeoLanguage } from '../shared/seo.ts';
import { Cache } from './cache.ts';
import { lowMedian } from '../shared/card-extras.ts';

const marketplace: Record<SeoLanguage, { id: string; currency: CardPrice['currency'] }> = {
  en: { id: 'EBAY_US', currency: 'USD' },
  it: { id: 'EBAY_IT', currency: 'EUR' },
  de: { id: 'EBAY_DE', currency: 'EUR' },
  fr: { id: 'EBAY_FR', currency: 'EUR' },
  es: { id: 'EBAY_ES', currency: 'EUR' },
};
const excluded =
  /\b(psa|bgs|cgc|beckett|graded|gradata|grade|lot|lotto|lote|bundle|playset|proxy|proxies|custom|orica|replica|empty|vuota)\b|\d+\s*x\b|\bx\s*\d+/i;
const words = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

let token: { value: string; expires: number } | null = null;
const searches = new Cache(Date.now, 500);

async function applicationToken(id: string, secret: string)
{
  if (token && token.expires > Date.now()) return token.value;
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error('eBay token ' + response.status);
  const body = await response.json() as { access_token: string; expires_in: number };
  token = { value: body.access_token, expires: Date.now() + Math.max(60, body.expires_in - 120) * 1000 };
  return token.value;
}

export function ebayConfigured()
{
  return Boolean(process.env.EBAY_CLIENT_ID?.trim() && process.env.EBAY_CLIENT_SECRET?.trim());
}

// Same words as the eBay button's search (name and set), so the price matches what the button opens.
export async function ebayPrice(language: SeoLanguage, card: { name: string; set: string }): Promise<CardPrice | null>
{
  const id = process.env.EBAY_CLIENT_ID?.trim();
  const secret = process.env.EBAY_CLIENT_SECRET?.trim();
  if (!id || !secret) return null;
  const site = marketplace[language];
  const query = `${card.name.split(' // ')[0]} ${card.set}`;
  const result = await searches.get(`${site.id}:${query.toLowerCase()}`, 21_600_000, async () =>
  {
    const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
    url.searchParams.set('q', query);
    url.searchParams.set('filter', `buyingOptions:{FIXED_PRICE},priceCurrency:${site.currency}`);
    url.searchParams.set('sort', 'price');
    url.searchParams.set('limit', '50');
    const response = await fetch(url, {
      headers: { Authorization: 'Bearer ' + await applicationToken(id, secret), 'X-EBAY-C-MARKETPLACE-ID': site.id },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error('eBay search ' + response.status);
    return (await response.json() as {
      itemSummaries?: { title?: string; price?: { value?: string; currency?: string } }[];
    })
      .itemSummaries ?? [];
  });
  const name = words(card.name.split(' // ')[0]).split(' ');
  const prices = result
    .data
    .filter(item =>
    {
      const title = words(item.title ?? '');
      return name.every(word => ` ${title} `.includes(` ${word} `)) && !excluded.test(item.title ?? '')
        && item.price?.currency === site.currency;
    })
    .map(item => Number(item.price?.value))
    .filter(value => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const amount = lowMedian(prices);
  return amount !== null
    ? {
      market: 'eBay',
      currency: site.currency,
      amount: Math.round(amount * 100) / 100,
      foil: false,
      updated: new Date().toISOString().slice(0, 10),
      from: true,
    }
    : null;
}
