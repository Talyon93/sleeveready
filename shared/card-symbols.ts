// Symbols in card text, drawn as each game prints them: Magic's braced mana and tap symbols ("{T}: Add {C}{C}.") as
// Scryfall's images, Riftbound's ":rb_might:" glyphs as Riot's, One Piece's bracketed timings ("[On Play]") as tags.
// Images keep the written symbol as alt, so the text reads and copies the same. Unknown symbols stay as text.
import type { SeoGameSlug } from './seo.ts';

export type TextPart = { text: string } | { symbol: string; url: string } | { tag: string };

export function symbolUrl(symbol: string)
{
  const inner = symbol.slice(1, -1).toUpperCase().replace(/\//g, '');
  return /^[0-9A-Z½∞]{1,5}$/.test(inner)
    ? `https://svgs.scryfall.io/card-symbols/${encodeURIComponent(inner)}.svg`
    : null;
}
const riftboundGlyph = (token: string) =>
{
  const name = /^:rb_([a-z0-9_]{1,30}):$/.exec(token)?.[1];
  return name
    ? `https://assetcdn.rgpub.io/public/live/riot-shared/player-experiences/riot-glyphs/rb/latest/${name}.svg`
    : null;
};

const patterns: Partial<Record<SeoGameSlug, RegExp>> = {
  'magic-the-gathering': /\{[^{}]{1,6}\}/g,
  riftbound: /:rb_[a-z0-9_]{1,30}:/g,
  'one-piece': /\[[^[\]]{2,40}\]/g,
};
export const hasSymbols = (game: SeoGameSlug | null | undefined) => Boolean(game && patterns[game]);

export function textParts(text: string, game: SeoGameSlug = 'magic-the-gathering'): TextPart[]
{
  const pattern = patterns[game];
  if (!pattern) return [{ text }];
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern))
  {
    const index = match.index;
    let part: TextPart | null = null;
    if (game === 'one-piece') part = { tag: match[0].slice(1, -1) };
    else
    {
      const url = game === 'riftbound' ? riftboundGlyph(match[0]) : symbolUrl(match[0]);
      if (url) part = { symbol: match[0], url };
    }
    if (!part) continue;
    if (index > last) parts.push({ text: text.slice(last, index) });
    parts.push(part);
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// Server pages: the same parts as HTML, text escaped by the caller's escape function.
export const symbolsHtml = (
  text: string,
  escape: (value: string) => string,
  game: SeoGameSlug = 'magic-the-gathering',
) =>
  textParts(text, game)
    .map(part =>
      'symbol' in part
        ? `<img class="cp-symbol" src="${part.url}" alt="${escape(part.symbol)}" title="${
          escape(part.symbol)
        }" loading="lazy"/>`
        : 'tag' in part
        ? `<span class="cp-tag">${escape(part.tag)}</span>`
        : escape(part.text)
    )
    .join('');
