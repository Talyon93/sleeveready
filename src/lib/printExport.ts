import type { CatalogCard } from '../../shared/model';
import { CORNER_RADIUS, type PageLayout } from './printSettings';

// Cricut's Print Then Cut works from an image: each page's cards on a transparent background, 300 dpi, rounded
// like the real cards, with gaps between them so Design Space cuts every card on its own.
const DPI = 300;
const px = (mm: number) => Math.round(mm / 25.4 * DPI);

// Card images from other sites can only be drawn on a canvas when served from this site: on the live site they go
// through Netlify's image CDN (hosts listed in netlify.toml); during development they are tried directly.
export function exportUrl(source: string)
{
  if (source.startsWith('/') || source.startsWith('data:') || source.startsWith('blob:')) return source;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/.test(location.hostname);
  return local ? source : `/.netlify/images?url=${encodeURIComponent(source)}&w=1100&fm=png`;
}
export function loadImage(source: string)
{
  return new Promise<HTMLImageElement>((resolve, reject) =>
  {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image'));
    image.src = exportUrl(source);
  });
}
export async function firstImage(card: CatalogCard)
{
  for (const source of [...(card.imageUrls ?? []), card.imageUrl].filter((value): value is string => Boolean(value)))
  {
    try
    {
      return await loadImage(source);
    }
    catch
    {
      /* Try the next source. */
    }
  }
  return null;
}

export type PagePng = { blob: Blob; widthMm: number; heightMm: number };
export async function pagePng(cards: CatalogCard[], layout: PageLayout, missing: string): Promise<PagePng>
{
  const gapX = layout.spacingX;
  const gapY = layout.spacingY;
  const widthMm = layout.columns * layout.cardWidth + (layout.columns - 1) * gapX;
  const heightMm = layout.rows * layout.cardHeight + (layout.rows - 1) * gapY;
  const canvas = document.createElement('canvas');
  canvas.width = px(widthMm);
  canvas.height = px(heightMm);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  const radius = layout.rounded ? px(CORNER_RADIUS) : 0;
  const width = px(layout.cardWidth);
  const height = px(layout.cardHeight);
  const images = await Promise.all(cards.map(firstImage));
  cards.forEach((card, index) =>
  {
    const x = px((index % layout.columns) * (layout.cardWidth + gapX));
    const y = px(Math.floor(index / layout.columns) * (layout.cardHeight + gapY));
    const image = images[index];
    context.save();
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.clip();
    if (image)
    {
      // Landscape artwork (Sorcery sites, battlefields) is turned to fill the portrait card, as on the printed sheet.
      if (image.naturalWidth > image.naturalHeight)
      {
        context.translate(x + width / 2, y + height / 2);
        context.rotate(Math.PI / 2);
        context.drawImage(image, -height / 2, -width / 2, height, width);
      }
      else context.drawImage(image, x, y, width, height);
    }
    else
    {
      // An image that cannot be drawn becomes a labelled white card, so the cut still has its shape.
      context.fillStyle = '#ffffff';
      context.fillRect(x, y, width, height);
      context.fillStyle = '#222222';
      context.font = `${px(4)}px sans-serif`;
      context.textAlign = 'center';
      context.fillText(card.name.slice(0, 28), x + width / 2, y + height / 2);
      context.font = `${px(2.6)}px sans-serif`;
      context.fillText(missing, x + width / 2, y + height / 2 + px(6));
    }
    context.restore();
  });
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('png');
  return { blob, widthMm, heightMm };
}

export function downloadBlob(blob: Blob, name: string)
{
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
