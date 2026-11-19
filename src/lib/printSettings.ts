export type Paper = 'a4' | 'letter' | 'legal' | 'a3' | 'custom';
export type Orientation = 'portrait' | 'landscape';
// Card size: standard TCG (63 × 88 mm), the smaller Japanese size Yu-Gi-Oh! uses (59 × 86 mm), any custom size, or
// automatic (the small size when every card on the sheet is Yu-Gi-Oh!).
export type CardSize = 'auto' | 'standard' | 'small' | 'custom';
// Cut guides on each card: corner ticks or the full outline; page guides: short marks in the margins at every card
// edge, or lines across the whole page.
export type CardGuides = 'none' | 'corners' | 'full';
export type PageGuides = 'none' | 'margins' | 'full';
export type GuidePlacement = 'inside' | 'center' | 'outside';
// Print-and-cut machines: Silhouette reads printed registration marks (3 or 4); Cricut's Print Then Cut takes a PNG
// of the cards (Design Space adds its own marks); Brother ScanNCut scans the sheet and only needs gaps between cards.
export type Marks = 'none' | 'silhouette' | 'cricut' | 'brother';
// Duplex printing: the sheet turns over its long or its short edge, which decides how the backs are mirrored.
export type Flip = 'long' | 'short';
export type PrintSettings = {
  paper: Paper;
  paperWidth: number;
  paperHeight: number;
  orientation: Orientation;
  cardSize: CardSize;
  cardWidth: number;
  cardHeight: number;
  spacingX: number;
  spacingY: number;
  bleed: number;
  margin: number;
  columns: number;
  rows: number;
  offsetX: number;
  offsetY: number;
  cardGuides: CardGuides;
  pageGuides: PageGuides;
  guideDashed: boolean;
  guideRounded: boolean;
  guideColor: string;
  guideWidth: number;
  guidePlacement: GuidePlacement;
  guideLength: number;
  marks: Marks;
  markPoints: 3 | 4;
  markInset: number;
  markLength: number;
  markThickness: number;
  rounded: boolean;
  backs: boolean;
  flip: Flip;
  backX: number;
  backY: number;
};

export const papers: Record<Exclude<Paper, 'custom'>, { label: string; width: number; height: number }> = {
  a4: { label: 'A4', width: 210, height: 297 },
  letter: { label: 'Letter', width: 215.9, height: 279.4 },
  legal: { label: 'Legal', width: 215.9, height: 355.6 },
  a3: { label: 'A3', width: 297, height: 420 },
};
export const cardSizes = { standard: { width: 63, height: 88 }, small: { width: 59, height: 86 } } as const;
// Kept for the fixed-size helpers (standard cards).
export const CARD_WIDTH = 63;
export const CARD_HEIGHT = 88;
// Cut lines follow the card's rounded corners (about 3 mm on most games) unless square corners are chosen.
export const CORNER_RADIUS = 3;
// Bleed extends the artwork past the cut line, up to 3 mm; it lives inside the spacing between cards.
export const MAX_BLEED = 3;
// Most home printers cannot print the outer 3–4 mm: the default margin keeps the grid clear of it.
export const DEFAULT_MARGIN = 4;
export const MAX_MARGIN = 40;
export const SPACING_STEP = 0.5;
export const MAX_SPACING = 12;
export const MAX_OFFSET = 10;
// Silhouette marks: a 5 mm square top left and corner marks at the other corners, set in from the edges. Length,
// thickness and inset must match Silhouette Studio (Page Setup › Registration Marks); these defaults follow its
// common settings (0.35 in, 0.039 in, 0.394 in). Cards stay inside the inset and keep 3 mm clear of every mark.
export const MARK = { square: 5, clearance: 3 };
export const DEFAULT_MARK = { inset: 10, length: 8.9, thickness: 1 };
// Cricut's Print Then Cut area (6.75 × 9.25 in) and the gap its software needs to cut each card on its own;
// ScanNCut also needs a gap to see each card as a separate shape.
export const CRICUT_AREA = { width: 171.45, height: 234.95 };
export const CUTTER_GAP = 3;
// Duplex printers rarely line the back up exactly: the backs move by up to ±5 mm to compensate.
export const MAX_BACK_OFFSET = 5;

const step = (value: number, max: number, min = 0, unit = SPACING_STEP) =>
  Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(Math.round(value / unit) * unit * 1000) / 1000))
    : min;
export const clampSpacing = (value: number) => step(value, MAX_SPACING);
export const clampBleed = (value: number) => step(value, MAX_BLEED);
export const clampMargin = (value: number) => step(value, MAX_MARGIN);
export const clampInset = (value: number) => step(value, 25, 3);
export const clampMarkLength = (value: number) => step(value, 30, 3, 0.1);
export const clampMarkThickness = (value: number) => step(value, 3, 0.2, 0.1);
export const clampOffset = (value: number) =>
  Number.isFinite(value) ? Math.min(MAX_OFFSET, Math.max(-MAX_OFFSET, Math.round(value * 10) / 10)) : 0;
export const clampBackOffset = (value: number) =>
  Number.isFinite(value) ? Math.min(MAX_BACK_OFFSET, Math.max(-MAX_BACK_OFFSET, Math.round(value * 10) / 10)) : 0;
export const clampCardDimension = (value: number, fallback: number) =>
  Number.isFinite(value) && value >= 20 && value <= 200 ? Math.round(value * 10) / 10 : fallback;
export const clampPaperDimension = (value: number, fallback: number) =>
  Number.isFinite(value) && value >= 80 && value <= 600 ? Math.round(value * 10) / 10 : fallback;
export const clampGrid = (value: number) => Number.isFinite(value) ? Math.min(12, Math.max(0, Math.round(value))) : 0;
export const clampGuideWidth = (value: number) => step(value, 1, 0.05, 0.05);
export const clampGuideLength = (value: number) => step(value, 20, 1, 0.5);
const hexColor = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;

// How the cards get cut decides most of the layout: the panel asks that first and sets the guides, gaps and marks
// to match. The method is read back from the settings, so saved settings and older ones need no extra field.
export type CutMethod = 'scissors' | 'trimmer' | 'cricut' | 'silhouette' | 'brother';
export const cutMethods: CutMethod[] = ['scissors', 'trimmer', 'cricut', 'silhouette', 'brother'];
export const cutMethodOf = (settings: PrintSettings): CutMethod =>
  settings.marks !== 'none'
    ? settings.marks
    : settings.pageGuides !== 'none' && settings.cardGuides === 'none'
    ? 'trimmer'
    : 'scissors';
export function withCutMethod(settings: PrintSettings, method: CutMethod): PrintSettings
{
  // Scissors follow an outline on every card; a trimmer cuts straight across the sheet, between cards set edge to edge.
  // Coming back from a machine, the cards return edge to edge without bleed, as on a fresh sheet.
  if (method === 'scissors')
  {
    return { ...settings, marks: 'none', cardGuides: 'full', pageGuides: 'none', spacingX: 0, spacingY: 0, bleed: 0 };
  }
  if (method === 'trimmer')
  {
    return {
      ...settings,
      marks: 'none',
      cardGuides: 'none',
      pageGuides: 'margins',
      spacingX: 0,
      spacingY: 0,
      bleed: 0,
    };
  }
  // Silhouette cuts around each card from its marks: a millimetre of bleed hides a slightly offset cut.
  if (method === 'silhouette')
  {
    return {
      ...settings,
      marks: 'silhouette',
      bleed: Math.max(settings.bleed, 1),
      spacingX: Math.max(settings.spacingX, 2),
      spacingY: Math.max(settings.spacingY, 2),
    };
  }
  return { ...settings, marks: method };
}

// Regions that use US Letter as their default paper size.
const letterRegions = new Set([
  'US',
  'CA',
  'MX',
  'PH',
  'CL',
  'CO',
  'VE',
  'PR',
  'GT',
  'CR',
  'PA',
  'DO',
  'SV',
  'NI',
  'HN',
  'BO',
]);
export function defaultPaper(locales: readonly string[]): Paper
{
  for (const locale of locales)
  {
    try
    {
      const region = new Intl.Locale(locale).maximize().region;
      if (region) return letterRegions.has(region) ? 'letter' : 'a4';
    }
    catch
    {
      /* Ignore malformed locale tags. */
    }
  }
  return 'a4';
}

const storageKey = 'sleeveready.print.v1';
export const defaultSettings = (locales: readonly string[]): PrintSettings => ({
  paper: defaultPaper(locales),
  paperWidth: 210,
  paperHeight: 297,
  orientation: 'portrait',
  cardSize: 'auto',
  cardWidth: 63,
  cardHeight: 88,
  spacingX: 0,
  spacingY: 0,
  bleed: 0,
  margin: DEFAULT_MARGIN,
  columns: 0,
  rows: 0,
  offsetX: 0,
  offsetY: 0,
  cardGuides: 'full',
  pageGuides: 'none',
  guideDashed: true,
  guideRounded: false,
  guideColor: '#555555',
  guideWidth: 0.15,
  guidePlacement: 'center',
  guideLength: 6,
  marks: 'none',
  markPoints: 3,
  markInset: DEFAULT_MARK.inset,
  markLength: DEFAULT_MARK.length,
  markThickness: DEFAULT_MARK.thickness,
  rounded: true,
  backs: false,
  flip: 'long',
  backX: 0,
  backY: 0,
});
// Saved settings from earlier versions keep their meaning: bleed on/off was 1 mm, one spacing for both directions,
// guides 'outline' (dashed card outline) or 'corners' (crop marks in the margins).
type Saved = Partial<Record<keyof PrintSettings, unknown>> & { spacing?: unknown; guides?: unknown };
export function normalizeSettings(value: Saved, fallback: PrintSettings): PrintSettings
{
  const num = (item: unknown, otherwise: number) =>
    typeof item === 'number' && Number.isFinite(item)
      ? item
      : typeof item === 'string' && item.trim() && Number.isFinite(Number(item))
      ? Number(item)
      : otherwise;
  const pick = <T extends string>(item: unknown, options: readonly T[], otherwise: T) =>
    (options as readonly unknown[]).includes(item) ? item as T : otherwise;
  const bleed = clampBleed(value.bleed === true ? 1 : num(value.bleed, 0));
  const legacySpacing = num(value.spacing, 0);
  const legacyGuides = value.guides;
  return {
    paper: pick(value.paper, ['a4', 'letter', 'legal', 'a3', 'custom'] as const, fallback.paper),
    paperWidth: clampPaperDimension(num(value.paperWidth, 210), 210),
    paperHeight: clampPaperDimension(num(value.paperHeight, 297), 297),
    orientation: pick(value.orientation, ['portrait', 'landscape'] as const, 'portrait'),
    cardSize: pick(value.cardSize, ['auto', 'standard', 'small', 'custom'] as const, 'auto'),
    cardWidth: clampCardDimension(num(value.cardWidth, 63), 63),
    cardHeight: clampCardDimension(num(value.cardHeight, 88), 88),
    spacingX: Math.max(clampSpacing(num(value.spacingX, legacySpacing)), bleed * 2),
    spacingY: Math.max(clampSpacing(num(value.spacingY, legacySpacing)), bleed * 2),
    bleed,
    margin: clampMargin(num(value.margin, DEFAULT_MARGIN)),
    columns: clampGrid(num(value.columns, 0)),
    rows: clampGrid(num(value.rows, 0)),
    offsetX: clampOffset(num(value.offsetX, 0)),
    offsetY: clampOffset(num(value.offsetY, 0)),
    cardGuides: pick(
      value.cardGuides,
      ['none', 'corners', 'full'] as const,
      legacyGuides === 'corners' || legacyGuides === 'none' ? 'none' : fallback.cardGuides,
    ),
    pageGuides: pick(
      value.pageGuides,
      ['none', 'margins', 'full'] as const,
      legacyGuides === 'corners' ? 'margins' : fallback.pageGuides,
    ),
    guideDashed: value.guideDashed !== false,
    guideRounded: value.guideRounded === true,
    guideColor: hexColor(value.guideColor, fallback.guideColor),
    guideWidth: clampGuideWidth(num(value.guideWidth, fallback.guideWidth)),
    guidePlacement: pick(value.guidePlacement, ['inside', 'center', 'outside'] as const, 'center'),
    guideLength: clampGuideLength(num(value.guideLength, fallback.guideLength)),
    marks: pick(value.marks, ['none', 'silhouette', 'cricut', 'brother'] as const, 'none'),
    markPoints: value.markPoints === 4 ? 4 : 3,
    markInset: clampInset(num(value.markInset, DEFAULT_MARK.inset)),
    markLength: clampMarkLength(num(value.markLength, DEFAULT_MARK.length)),
    markThickness: clampMarkThickness(num(value.markThickness, DEFAULT_MARK.thickness)),
    rounded: value.rounded !== false,
    backs: value.backs === true,
    flip: pick(value.flip, ['long', 'short'] as const, 'long'),
    backX: clampBackOffset(num(value.backX, 0)),
    backY: clampBackOffset(num(value.backY, 0)),
  };
}
export function loadPrintSettings(locales: readonly string[]): PrintSettings
{
  const fallback = defaultSettings(locales);
  try
  {
    const data: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    return data && typeof data === 'object' ? normalizeSettings(data as Saved, fallback) : fallback;
  }
  catch
  {
    return fallback;
  }
}
export function savePrintSettings(settings: PrintSettings)
{
  try
  {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }
  catch
  {
    /* The preview still works without persistence. */
  }
}

// Named snapshots of the settings, kept on this device.
const presetsKey = 'sleeveready.printPresets.v1';
export type PrintPreset = { name: string; settings: PrintSettings };
export function loadPresets(fallback: PrintSettings): PrintPreset[]
{
  try
  {
    const data: unknown = JSON.parse(localStorage.getItem(presetsKey) ?? '[]');
    return Array.isArray(data)
      ? data
        .filter(item => item && typeof item.name === 'string' && item.settings && typeof item.settings === 'object')
        .slice(0, 20)
        .map(item => ({ name: String(item.name).slice(0, 40), settings: normalizeSettings(item.settings, fallback) }))
      : [];
  }
  catch
  {
    return [];
  }
}
export function savePresets(presets: PrintPreset[])
{
  try
  {
    localStorage.setItem(presetsKey, JSON.stringify(presets.slice(0, 20)));
  }
  catch
  {
    /* Presets are a convenience. */
  }
}

// The card size for a sheet: the setting, with 'auto' choosing the small size when every card is Yu-Gi-Oh!.
export function cardDimensions(settings: Pick<PrintSettings, 'cardSize' | 'cardWidth' | 'cardHeight'>, allSmall = false)
{
  if (settings.cardSize === 'custom')
  {
    return { width: clampCardDimension(settings.cardWidth, 63), height: clampCardDimension(settings.cardHeight, 88) };
  }
  return settings.cardSize === 'small' || (settings.cardSize === 'auto' && allSmall)
    ? { ...cardSizes.small }
    : { ...cardSizes.standard };
}
export function paperSize(settings: Pick<PrintSettings, 'paper' | 'paperWidth' | 'paperHeight'>)
{
  if (settings.paper === 'custom')
  {
    const width = clampPaperDimension(settings.paperWidth, 210);
    const height = clampPaperDimension(settings.paperHeight, 297);
    return { label: `${width} × ${height} mm`, width, height };
  }
  return papers[settings.paper];
}

// As many card slots as fit inside the margins (3 × 3 on A4 portrait, 4 × 2 landscape), or the columns and rows chosen
// (never more than fit), centred on the page and then moved by the offset. With registration marks the cards stay
// inside the marks' inset and keep clear of the marks themselves.
export function pageLayout(settings: PrintSettings, allSmall = false)
{
  const paper = paperSize(settings);
  const landscape = settings.orientation === 'landscape';
  const portraitWidth = Math.min(paper.width, paper.height);
  const portraitHeight = Math.max(paper.width, paper.height);
  const width = landscape ? portraitHeight : portraitWidth;
  const height = landscape ? portraitWidth : portraitHeight;
  const card = cardDimensions(settings, allSmall);
  const marks = settings.marks;
  const cutter = marks === 'cricut' || marks === 'brother';
  // Cricut cuts around the PNG's opaque pixels, so bleed would move the cut: no bleed, and a gap for both cutters.
  const bleedSize = marks === 'cricut' ? 0 : clampBleed(settings.bleed);
  const gap = (value: number) => Math.max(clampSpacing(value), bleedSize * 2, cutter ? CUTTER_GAP : 0);
  const spacingX = gap(settings.spacingX);
  const spacingY = gap(settings.spacingY);
  const markInset = clampInset(settings.markInset);
  const markLength = clampMarkLength(settings.markLength);
  const markThickness = clampMarkThickness(settings.markThickness);
  const slotWidth = card.width + spacingX;
  const slotHeight = card.height + spacingY;
  const offsetX = clampOffset(settings.offsetX);
  const offsetY = clampOffset(settings.offsetY);
  const build = (margin: number) =>
  {
    // Slots carry half the spacing on each side, so the outer half-gaps may reach into the margin.
    // Cricut: only as many cards as fit its Print Then Cut area (gaps between cards, none outside).
    const fitColumns = Math.max(
      1,
      Math.floor(((marks === 'cricut' ? CRICUT_AREA.width : width - 2 * margin) + spacingX) / slotWidth),
    );
    const fitRows = Math.max(
      1,
      Math.floor(((marks === 'cricut' ? CRICUT_AREA.height : height - 2 * margin) + spacingY) / slotHeight),
    );
    const columns = settings.columns > 0 ? Math.min(settings.columns, fitColumns) : fitColumns;
    const rows = settings.rows > 0 ? Math.min(settings.rows, fitRows) : fitRows;
    return {
      paper,
      orientation: settings.orientation,
      width,
      height,
      cardWidth: card.width,
      cardHeight: card.height,
      spacingX,
      spacingY,
      slotWidth,
      slotHeight,
      columns,
      rows,
      perPage: columns * rows,
      padX: (width - columns * slotWidth) / 2 + offsetX,
      padY: (height - rows * slotHeight) / 2 + offsetY,
      bleed: bleedSize > 0,
      bleedSize,
      margin,
      marks,
      markPoints: settings.markPoints,
      markInset,
      markLength,
      markThickness,
      rounded: settings.rounded,
    };
  };
  let layout = build(
    Math.max(clampMargin(settings.margin), marks === 'silhouette' ? markInset + markThickness + MARK.clearance : 0),
  );
  // Grow the margin until no card (with its bleed) comes within the clearance of a mark.
  while (marks === 'silhouette' && layout.margin < MAX_MARGIN && touchesMarks(layout))
  {
    layout = build(layout.margin + SPACING_STEP);
  }
  return layout;
}
export type PageLayout = ReturnType<typeof pageLayout>;
type Grid = Pick<
  PageLayout,
  | 'padX'
  | 'padY'
  | 'slotWidth'
  | 'slotHeight'
  | 'columns'
  | 'rows'
  | 'spacingX'
  | 'spacingY'
  | 'cardWidth'
  | 'cardHeight'
>;
function touchesMarks(layout: Grid & MarkLayout & { bleedSize: number })
{
  const reach = MARK.clearance + layout.bleedSize;
  return markRects(layout).some(mark =>
    cardRects(layout).some(card =>
      card.x - reach < mark.x + mark.width && card.x + layout.cardWidth + reach > mark.x
      && card.y - reach < mark.y + mark.height && card.y + layout.cardHeight + reach > mark.y
    )
  );
}

// Card rectangles on the page (cut lines), in mm from the top-left corner.
export function cardRects(layout: Grid)
{
  const rects: { x: number; y: number }[] = [];
  for (let row = 0; row < layout.rows; row++)
  {
    for (let column = 0; column < layout.columns; column++)
    {
      rects.push({
        x: layout.padX + column * layout.slotWidth + layout.spacingX / 2,
        y: layout.padY + row * layout.slotHeight + layout.spacingY / 2,
      });
    }
  }
  return rects;
}
// Silhouette marks as filled rectangles in mm: the square top left, corner marks top right and bottom left, and with
// four points a corner mark bottom right too.
type MarkLayout = {
  marks: Marks;
  markPoints: 3 | 4;
  markInset: number;
  markLength: number;
  markThickness: number;
  width: number;
  height: number;
};
export function markRects(layout: MarkLayout)
{
  if (layout.marks !== 'silhouette') return [];
  const length = layout.markLength;
  const thickness = layout.markThickness;
  const inset = layout.markInset;
  const right = layout.width - inset;
  const bottom = layout.height - inset;
  const rects = [
    { x: inset, y: inset, width: MARK.square, height: MARK.square },
    { x: right - length, y: inset, width: length, height: thickness },
    { x: right - thickness, y: inset, width: thickness, height: length },
    { x: inset, y: bottom - length, width: thickness, height: length },
    { x: inset, y: bottom - thickness, width: length, height: thickness },
  ];
  if (layout.markPoints === 4)
  {
    rects.push(
      { x: right - length, y: bottom - thickness, width: length, height: thickness },
      { x: right - thickness, y: bottom - length, width: thickness, height: length },
    );
  }
  return rects;
}

export type GuideLine = { x1: number; y1: number; x2: number; y2: number };
export type GuideStyle = Pick<
  PrintSettings,
  | 'cardGuides'
  | 'pageGuides'
  | 'guideDashed'
  | 'guideRounded'
  | 'guideColor'
  | 'guideWidth'
  | 'guidePlacement'
  | 'guideLength'
>;
// Card guides as drawing commands in page mm: full outlines (rectangles, optionally rounded) or corner ticks along
// each edge. Placement moves the stroke inside the card, onto the cut line, or out into the bleed.
export function cardGuideShapes(layout: Grid, style: GuideStyle, count = Infinity)
{
  if (style.cardGuides === 'none')
  {
    return {
      rects: [] as { x: number; y: number; width: number; height: number; radius: number }[],
      lines: [] as GuideLine[],
    };
  }
  const shift = style.guidePlacement === 'inside'
    ? style.guideWidth / 2
    : style.guidePlacement === 'outside'
    ? -style.guideWidth / 2
    : 0;
  const radius = style.guideRounded ? Math.max(0, CORNER_RADIUS - shift) : 0;
  // Only the slots that hold a card get a guide (a half-filled last page has empty slots).
  const boxes = cardRects(layout).slice(0, count).map(rect => ({
    x: rect.x + shift,
    y: rect.y + shift,
    width: layout.cardWidth - 2 * shift,
    height: layout.cardHeight - 2 * shift,
  }));
  if (style.cardGuides === 'full') return { rects: boxes.map(box => ({ ...box, radius })), lines: [] };
  const length = Math.min(style.guideLength, layout.cardWidth / 2, layout.cardHeight / 2);
  const lines = boxes.flatMap(box =>
  {
    const right = box.x + box.width;
    const bottom = box.y + box.height;
    return [
      { x1: box.x, y1: box.y, x2: box.x + length, y2: box.y },
      { x1: box.x, y1: box.y, x2: box.x, y2: box.y + length },
      { x1: right, y1: box.y, x2: right - length, y2: box.y },
      { x1: right, y1: box.y, x2: right, y2: box.y + length },
      { x1: box.x, y1: bottom, x2: box.x + length, y2: bottom },
      { x1: box.x, y1: bottom, x2: box.x, y2: bottom - length },
      { x1: right, y1: bottom, x2: right - length, y2: bottom },
      { x1: right, y1: bottom, x2: right, y2: bottom - length },
    ];
  });
  return { rects: [], lines };
}
// Page guides: short marks in the margins lined up with every card edge, or lines across the whole page.
export function pageGuideLines(layout: Grid & { width: number; height: number }, mode: PageGuides): GuideLine[]
{
  if (mode === 'none') return [];
  const rects = cardRects(layout);
  const round = (value: number) => Math.round(value * 100) / 100;
  const xs = [...new Set(rects.flatMap(rect => [rect.x, rect.x + layout.cardWidth]).map(round))];
  const ys = [...new Set(rects.flatMap(rect => [rect.y, rect.y + layout.cardHeight]).map(round))];
  if (mode === 'full')
  {
    return [
      ...xs.map(x => ({ x1: x, y1: 0, x2: x, y2: layout.height })),
      ...ys.map(y => ({ x1: 0, y1: y, x2: layout.width, y2: y })),
    ];
  }
  const top = Math.min(...rects.map(rect => rect.y)) - layout.spacingY / 2;
  const bottom = Math.max(...rects.map(rect => rect.y + layout.cardHeight)) + layout.spacingY / 2;
  const left = Math.min(...rects.map(rect => rect.x)) - layout.spacingX / 2;
  const right = Math.max(...rects.map(rect => rect.x + layout.cardWidth)) + layout.spacingX / 2;
  const reach = (space: number) => Math.min(5, Math.max(0, space - 1));
  return [
    ...xs.flatMap(
      x => [
        { x1: x, y1: top - reach(top), x2: x, y2: top - 0.5 },
        { x1: x, y1: bottom + 0.5, x2: x, y2: bottom + reach(layout.height - bottom) },
      ],
    ),
    ...ys.flatMap(
      y => [
        { x1: left - reach(left), y1: y, x2: left - 0.5, y2: y },
        { x1: right + 0.5, y1: y, x2: right + reach(layout.width - right), y2: y },
      ],
    ),
  ]
    .filter(line => Math.hypot(line.x2 - line.x1, line.y2 - line.y1) >= 1);
}
// Kept for callers that only want the margin marks.
export const cropLines = (layout: PageLayout) => pageGuideLines(layout, 'margins');

// The cut file for print-and-cut software: card outlines (red, hairline) and the registration marks (black), at the
// exact positions they print on every page, in millimetres.
export function cutSvg(layout: PageLayout)
{
  const radius = layout.rounded ? CORNER_RADIUS : 0;
  const mm = (value: number) => Math.round(value * 1000) / 1000;
  const cards = cardRects(layout)
    .map(rect =>
      `<rect x="${mm(rect.x)}" y="${mm(rect.y)}" width="${mm(layout.cardWidth)}" height="${
        mm(layout.cardHeight)
      }" rx="${radius}" ry="${radius}"/>`
    )
    .join('');
  const marks = markRects(layout)
    .map(rect => `<rect x="${mm(rect.x)}" y="${mm(rect.y)}" width="${mm(rect.width)}" height="${mm(rect.height)}"/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${
    mm(layout.width)
  }mm" height="${mm(layout.height)}mm" viewBox="0 0 ${mm(layout.width)} ${
    mm(layout.height)
  }">\n<title>SleeveReady cut lines · ${layout.paper.label} ${layout.orientation} · ${layout.columns} × ${layout.rows}</title>\n<g id="cut-lines" fill="none" stroke="#ff0000" stroke-width="0.1">${cards}</g>\n${
    marks ? `<g id="registration-marks" fill="#000000">${marks}</g>\n` : ''
  }</svg>\n`;
}

// Where each back goes on the back of a sheet: the same slot seen through the paper. Turning over the long edge of a
// portrait page (or the short edge of a landscape one) swaps columns; the other way swaps rows.
export function backSlot(index: number, layout: { columns: number; rows: number; orientation: Orientation }, flip: Flip)
{
  const row = Math.floor(index / layout.columns);
  const column = index % layout.columns;
  const swapColumns = (layout.orientation === 'portrait') === (flip === 'long');
  return swapColumns
    ? row * layout.columns + (layout.columns - 1 - column)
    : (layout.rows - 1 - row) * layout.columns + column;
}
