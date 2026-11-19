import jpegJs from 'jpeg-js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { inflateSync } from 'node:zlib';
import type { CatalogCard } from '../shared/model.ts';
import { type ImageSource, sheetPdf } from '../src/lib/printPdf.ts';
import { backSlot, cardRects, defaultSettings, pageLayout, type PrintSettings } from '../src/lib/printSettings.ts';

// The PDF is checked as a file: page sizes, which images are embedded, and where each card is drawn, in points
// (1 mm = 72 / 25.4 pt), read back from the decompressed page streams.
const PT = 72 / 25.4;
const close = (actual: number, expected: number, label: string) =>
  assert.ok(Math.abs(actual - expected) < 0.05, `${label}: ${actual} instead of ${expected}`);

function jpegData(width: number, height: number, shade: number)
{
  const data = Buffer.alloc(width * height * 4, shade);
  return 'data:image/jpeg;base64,' + Buffer.from(jpegJs.encode({ data, width, height }, 80).data).toString('base64');
}

const card = (id: number, image: string | null = `https://img.example/${id}.png`): CatalogCard => ({
  id,
  gameId: 1,
  categoryId: 1,
  expansionId: 1,
  name: `Card ${id}`,
  version: null,
  imageUrl: image,
  imageUrls: image ? [image] : [],
});

// Each distinct image URL gets its own JPEG; a URL listed in `missing` fails to load, as a broken source would.
function images(missing: string[] = []): ImageSource & { loads: string[] }
{
  const loads: string[] = [];
  return {
    loads,
    card: async item =>
    {
      const url = item.imageUrls?.[0] ?? item.imageUrl ?? '';
      loads.push(url);
      return missing.includes(url) || !url ? null : jpegData(63, 88, 40 + loads.length);
    },
    back: async () => jpegData(63, 88, 200),
  };
}

type Draw = { width: number; height: number; x: number; y: number; name: string };
async function readPdf(blob: Blob)
{
  const text = Buffer.from(await blob.arrayBuffer()).toString('latin1');
  const pages = [...text.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map(m => [Number(m[1]), Number(m[2])]);
  const imageCount = [...text.matchAll(/\/Subtype \/Image/g)].length;
  // Page content streams, in page order: the Flate streams that draw (contain " cm" or " re").
  const streams: string[] = [];
  for (const match of text.matchAll(/<<([^>]*?)\/Filter \/FlateDecode([^>]*?)>>\s*stream\r?\n/g))
  {
    const start = match.index! + match[0].length;
    const end = text.indexOf('endstream', start);
    try
    {
      streams.push(inflateSync(Buffer.from(text.slice(start, end), 'latin1')).toString('latin1'));
    }
    catch
    {
      // Image data that is not deflated by jsPDF.
    }
  }
  const content = streams.filter(stream => / cm\b| re\b/.test(stream));
  const draws = content.map(stream =>
    [...stream.matchAll(/([\d.]+) 0 0 ([\d.]+) ([\d.-]+) ([\d.-]+) cm\s*\/(\S+) Do/g)].map((m): Draw => ({
      width: Number(m[1]),
      height: Number(m[2]),
      x: Number(m[3]),
      y: Number(m[4]),
      name: m[5],
    }))
  );
  return { pages, imageCount, content, draws };
}

const a4: PrintSettings = { ...defaultSettings(['it-IT']), paper: 'a4', orientation: 'portrait', cardSize: 'standard' };
const pagesOf = (cards: CatalogCard[], perPage: number) =>
  Array.from({ length: Math.ceil(cards.length / perPage) }, (_, i) => cards.slice(i * perPage, (i + 1) * perPage));

async function render(
  settings: PrintSettings,
  cards: CatalogCard[],
  options: { backImage?: string; source?: ImageSource } = {},
)
{
  const layout = pageLayout(settings);
  const progress: string[] = [];
  const blob = await sheetPdf({
    pages: pagesOf(cards, layout.perPage),
    layout,
    settings,
    backImage: options.backImage ?? null,
    missing: 'image missing',
    label: 'Test sheet',
    onPage: (page, pages) => progress.push(`${page}/${pages}`),
    images: options.source ?? images(),
  });
  return { layout, progress, pdf: await readPdf(blob) };
}

test('A4: nine cards per page at 63 × 88 mm, in the slots of the layout, with the right page count', async () =>
{
  const cards = Array.from({ length: 10 }, (_, i) => card(i + 1));
  const { layout, progress, pdf } = await render(a4, cards);
  assert.equal(layout.perPage, 9);
  assert.equal(pdf.pages.length, 2);
  for (const [width, height] of pdf.pages)
  {
    close(width, 210 * PT, 'A4 width');
    close(height, 297 * PT, 'A4 height');
  }
  assert.deepEqual(pdf.draws.map(page => page.length), [9, 1]);
  const rects = cardRects(layout);
  pdf.draws[0].forEach((draw, slot) =>
  {
    close(draw.width, 63 * PT, 'card width');
    close(draw.height, 88 * PT, 'card height');
    close(draw.x, rects[slot].x * PT, `slot ${slot} x`);
    // PDF y grows upwards from the bottom edge.
    close(draw.y, (297 - rects[slot].y - 88) * PT, `slot ${slot} y`);
  });
  assert.deepEqual(progress, ['1/2', '2/2']);
});

test('US Letter pages are 8.5 × 11 in', async () =>
{
  const { pdf } = await render({ ...a4, paper: 'letter' }, [card(1)]);
  close(pdf.pages[0][0], 612, 'Letter width');
  close(pdf.pages[0][1], 792, 'Letter height');
});

test('copies of one card embed its image once', async () =>
{
  const source = images();
  const cards = Array.from({ length: 9 }, () => card(7));
  const { pdf } = await render(a4, cards, { source });
  assert.equal(pdf.draws[0].length, 9);
  assert.equal(new Set(pdf.draws[0].map(draw => draw.name)).size, 1);
  assert.equal(pdf.imageCount, 1);
  assert.equal(source.loads.length, 1);
});

test('bleed draws each card a second time, larger by the bleed on every side', async () =>
{
  const { layout, pdf } = await render({ ...a4, bleed: 1 }, [card(1)]);
  assert.equal(layout.bleedSize, 1);
  const [bleedDraw, cardDraw] = pdf.draws[0];
  close(bleedDraw.width, 65 * PT, 'bleed width');
  close(bleedDraw.height, 90 * PT, 'bleed height');
  close(cardDraw.width, 63 * PT, 'card width');
  close(bleedDraw.x, cardDraw.x - PT, 'bleed offset');
});

test('a card whose image fails gets a placeholder with its name instead of an image', async () =>
{
  const source = images(['https://img.example/2.png']);
  const { pdf } = await render(a4, [card(1), card(2)], { source });
  assert.equal(pdf.draws[0].length, 1);
  assert.match(pdf.content[0], /\(Card 2\) Tj/);
  assert.match(pdf.content[0], /\(image missing\) Tj/);
});

test('card backs add one back page after each front page, each back behind its card', async () =>
{
  const settings = { ...a4, flip: 'long' as const };
  const cards = Array.from({ length: 3 }, (_, i) => card(i + 1));
  const { layout, pdf } = await render(settings, cards, { backImage: 'back.png' });
  assert.equal(pdf.pages.length, 2);
  const [front, back] = pdf.draws;
  assert.equal(back.length, 3);
  const rects = cardRects(layout);
  back.forEach((draw, slot) =>
  {
    const behind = rects[backSlot(slot, layout, 'long')];
    close(draw.x, (behind.x + settings.backX) * PT, `back ${slot} x`);
  });
  // Mirrored on a long-edge flip: the first card's back sits in the last column of its row.
  assert.notEqual(Math.round(back[0].x), Math.round(front[0].x));
});
