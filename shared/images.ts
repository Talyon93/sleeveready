// A lighter version of a card image for grids and lists, where the source offers one; the card page and the print
// sheet keep the full image. Proxied images (One Piece, Cyberpunk) are resized by Netlify's image CDN, which only
// exists on the deployed site. Returns null when there is no lighter version.
export function thumbnailUrl(url: string, netlifyImages = false): string | null
{
  if (/^https:\/\/cards\.scryfall\.io\/large\//.test(url)) return url.replace('/large/', '/normal/');
  if (/^https:\/\/legendstory-production-s3-public\.s3\.amazonaws\.com\/media\/cards\/large\//.test(url))
  {
    return url.replace('/cards/large/', '/cards/normal/');
  }
  if (/^https:\/\/cmsassets\.rgpub\.io\/sanity\/images\//.test(url))
  {
    const u = new URL(url);
    u.searchParams.set('w', '480');
    u.searchParams.set('fm', 'webp');
    return u.href;
  }
  if (netlifyImages && /^\/api\/catalog\/(?:one-piece|cyberpunk)-image\//.test(url))
  {
    return `/.netlify/images?url=${encodeURIComponent(url)}&w=360&fm=webp&q=78`;
  }
  return null;
}

export function safeImageUrl(value: unknown): string | null
{
  if (typeof value !== 'string') return null;
  if (/^\/api\/catalog\/one-piece-image\/(?:en|fr|th)\/[A-Za-z0-9!_-]{1,60}\.(?:png|webp)(?:\?v=\d{1,3})?$/.test(value))
  {
    return value;
  }
  if (/^\/api\/catalog\/gundam-image\/[A-Za-z0-9_-]{1,40}\.webp(?:\?v=\d{1,8})?$/.test(value)) return value;
  if (/^\/api\/catalog\/cyberpunk-image\/[A-Za-z0-9-]{1,80}\/[0-9a-f-]{36}\.webp(?:\?v=\d{1,3})?$/.test(value))
  {
    return value;
  }
  try
  {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.includes(':') || /^[\d.]+$/.test(h))
    {
      return null;
    }
    return u.href;
  }
  catch
  {
    return null;
  }
}

// Use URLs actually supplied by CardTrader; never invent filename variants.
export function cardTraderImageUrl(value: unknown): string | null
{
  if (typeof value !== 'string') return null;
  if (value.startsWith('/uploads/')) return safeImageUrl(new URL(value, 'https://cardtrader.com').href);
  return safeImageUrl(value);
}
export function imageResolution(width: number, height: number)
{
  return { width, height, dpi: Math.floor(Math.min(width / (63 / 25.4), height / (88 / 25.4))) };
}
