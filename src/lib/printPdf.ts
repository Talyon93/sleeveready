import { jsPDF } from 'jspdf';
import type { CatalogCard } from '../../shared/model';
import { firstImage, loadImage } from './printExport';
import {
  backSlot,
  cardGuideShapes,
  cardRects,
  markRects,
  pageGuideLines,
  type PageLayout,
  type PrintSettings,
} from './printSettings';

// The print sheet as a PDF at exact size: no print dialog scaling to get wrong. Same pages, positions, bleed, guides,
// registration marks and backs as the preview; every distinct image is embedded once, however many copies use it.
// Where the JPEG data comes from: the browser loads and encodes the real images; tests pass their own.
export type ImageSource = {
  card: (card: CatalogCard) => Promise<string | null>;
  back: (source: string) => Promise<string>;
};
type Options = {
  pages: CatalogCard[][];
  layout: PageLayout;
  settings: PrintSettings;
  backImage: string | null;
  missing: string;
  label: string;
  onPage: (page: number, pages: number) => void;
  images?: ImageSource;
};

// Images go in as JPEG (smaller files); landscape artwork is turned to fill the portrait card, as on the sheet.
function jpeg(image: HTMLImageElement)
{
  const turn = image.naturalWidth > image.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = turn ? image.naturalHeight : image.naturalWidth;
  canvas.height = turn ? image.naturalWidth : image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (turn)
  {
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(Math.PI / 2);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  }
  else context.drawImage(image, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

const browserImages: ImageSource = {
  card: async card =>
  {
    const image = await firstImage(card);
    return image ? jpeg(image) : null;
  },
  back: async source => jpeg(await loadImage(source)),
};

export async function sheetPdf(
  { pages, layout, settings, backImage, missing, label, onPage, images = browserImages }: Options,
): Promise<Blob>
{
  const orientation = layout.width > layout.height ? 'landscape' : 'portrait';
  const doc = new jsPDF({ unit: 'mm', format: [layout.width, layout.height], orientation, compress: true });
  const rects = cardRects(layout);
  const bleed = layout.bleedSize;
  const encoded = new Map<string, string | null>();
  const imageFor = async (card: CatalogCard) =>
  {
    const key = card.imageUrls?.[0] ?? card.imageUrl ?? `missing:${card.id}`;
    if (!encoded.has(key))
    {
      encoded.set(key, await images.card(card));
    }
    return { key, data: encoded.get(key) ?? null };
  };
  const place = (data: string, alias: string, x: number, y: number) =>
  {
    if (bleed > 0)
    {
      doc.addImage(
        data,
        'JPEG',
        x - bleed,
        y - bleed,
        layout.cardWidth + 2 * bleed,
        layout.cardHeight + 2 * bleed,
        alias,
        'FAST',
      );
    }
    doc.addImage(data, 'JPEG', x, y, layout.cardWidth, layout.cardHeight, alias, 'FAST');
  };
  const back = backImage ? await images.back(backImage) : null;
  // The line in the left margin, as on the sheet: read bottom to top, centred on the page, where the margin has room.
  const margin = Math.min(...rects.map(rect => rect.x)) - bleed;
  const drawLabel = (text: string) =>
  {
    if (margin < 4) return;
    doc.setFontSize(7);
    doc.setTextColor('#777777');
    doc.text(text, margin / 2 + 0.9, (layout.height + doc.getTextWidth(text)) / 2, { angle: 90 });
  };
  const lines = pageGuideLines(layout, settings.pageGuides);
  const marks = markRects(layout);
  const drawGuides = (count: number) =>
  {
    const guides = cardGuideShapes(layout, settings, count);
    if (!guides.rects.length && !guides.lines.length && !lines.length) return;
    doc.setDrawColor(settings.guideColor);
    doc.setLineWidth(settings.guideWidth);
    doc.setLineDashPattern(
      settings.guideDashed ? [Math.max(0.6, settings.guideWidth * 4), Math.max(0.5, settings.guideWidth * 3)] : [],
      0,
    );
    for (const line of lines) doc.line(line.x1, line.y1, line.x2, line.y2);
    for (const rect of guides.rects)
    {
      if (rect.radius > 0)
      {
        doc.roundedRect(rect.x, rect.y, rect.width, rect.height, rect.radius, rect.radius, 'S');
      }
      else doc.rect(rect.x, rect.y, rect.width, rect.height, 'S');
    }
    for (const line of guides.lines) doc.line(line.x1, line.y1, line.x2, line.y2);
    doc.setLineDashPattern([], 0);
  };
  for (let index = 0; index < pages.length; index++)
  {
    if (index > 0) doc.addPage([layout.width, layout.height], orientation);
    const page = pages[index];
    for (let slot = 0; slot < page.length; slot++)
    {
      const rect = rects[slot];
      const { key, data } = await imageFor(page[slot]);
      if (data) place(data, key, rect.x, rect.y);
      else
      {
        doc.setFillColor('#ffffff');
        doc.setDrawColor('#999999');
        doc.setLineWidth(0.2);
        doc.rect(rect.x, rect.y, layout.cardWidth, layout.cardHeight, 'FD');
        doc.setFontSize(10);
        doc.setTextColor('#222222');
        doc.text(page[slot].name.slice(0, 30), rect.x + layout.cardWidth / 2, rect.y + layout.cardHeight / 2, {
          align: 'center',
        });
        doc.setFontSize(7);
        doc.text(missing, rect.x + layout.cardWidth / 2, rect.y + layout.cardHeight / 2 + 5, { align: 'center' });
      }
    }
    drawGuides(page.length);
    drawLabel(`${label} · ${index + 1}/${pages.length}`);
    doc.setFillColor('#000000');
    for (const mark of marks) doc.rect(mark.x, mark.y, mark.width, mark.height, 'F');
    // The backs of this page: each behind its card, moved by the duplex correction.
    if (back)
    {
      doc.addPage([layout.width, layout.height], orientation);
      for (let slot = 0; slot < page.length; slot++)
      {
        const rect = rects[backSlot(slot, layout, settings.flip)];
        place(back, 'card-back', rect.x + settings.backX, rect.y + settings.backY);
      }
    }
    onPage(index + 1, pages.length);
  }
  return doc.output('blob');
}
