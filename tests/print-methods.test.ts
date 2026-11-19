import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CRICUT_AREA,
  CUTTER_GAP,
  MARK,
  cropLines,
  cutMethodOf,
  cutMethods,
  cutSvg,
  defaultSettings,
  markRects,
  pageLayout,
  withCutMethod,
  type CutMethod,
} from '../src/lib/printSettings.ts';

// The cutting methods of the print panel: each one must read back as itself and give the layout its tool needs.
const start = defaultSettings(['it-IT']);

test('cut methods: the defaults are the scissors settings', () =>
{
  assert.equal(cutMethodOf(start), 'scissors');
});

test('cut methods: every choice reads back unchanged, whichever method you start from', () =>
{
  for (const from of cutMethods)
  {
    for (const to of cutMethods)
    {
      const settings = withCutMethod(withCutMethod(start, from), to);
      assert.equal(cutMethodOf(settings), to, `${from} → ${to}`);
    }
  }
});

const layoutFor = (method: CutMethod, from: CutMethod = 'scissors') =>
  pageLayout(withCutMethod(withCutMethod(start, from), method));

test('scissors: outline on every card, cards side by side, 3 × 3 on A4, also when coming back from Silhouette', () =>
{
  for (const from of cutMethods)
  {
    const settings = withCutMethod(withCutMethod(start, from), 'scissors');
    const layout = pageLayout(settings);
    assert.equal(settings.cardGuides, 'full');
    assert.equal(settings.pageGuides, 'none');
    assert.equal(layout.marks, 'none');
    assert.equal(layout.spacingX, 0, from);
    assert.equal(layout.bleedSize, 0, from);
    assert.equal(layout.perPage, 9, from);
  }
});

test('paper trimmer: marks at the sheet edges and no gap between cards', () =>
{
  const settings = withCutMethod(start, 'trimmer');
  const layout = pageLayout(settings);
  assert.equal(settings.cardGuides, 'none');
  assert.equal(settings.pageGuides, 'margins');
  assert.equal(layout.spacingX, 0);
  assert.equal(layout.spacingY, 0);
  assert.equal(layout.bleedSize, 0);
  assert.equal(layout.perPage, 9);
  assert.ok(cropLines(layout).length > 0);
});

test('Cricut: cards inside the Print Then Cut area, 3 mm apart and without bleed', () =>
{
  const layout = layoutFor('cricut', 'silhouette');
  assert.equal(layout.marks, 'cricut');
  assert.equal(layout.bleedSize, 0);
  assert.ok(layout.spacingX >= CUTTER_GAP && layout.spacingY >= CUTTER_GAP);
  assert.ok(layout.columns * layout.cardWidth + (layout.columns - 1) * layout.spacingX <= CRICUT_AREA.width);
  assert.ok(layout.rows * layout.cardHeight + (layout.rows - 1) * layout.spacingY <= CRICUT_AREA.height);
  assert.deepEqual([layout.columns, layout.rows], [2, 2]);
});

test('Silhouette: registration marks away from the cards, 1 mm bleed and a cut file', () =>
{
  const layout = layoutFor('silhouette');
  assert.equal(layout.marks, 'silhouette');
  assert.equal(layout.bleedSize, 1);
  assert.ok(layout.spacingX >= 2);
  // The 5 mm square plus two corner marks, each drawn as two bars.
  const marks = markRects(layout);
  assert.equal(marks.length, 5);
  assert.ok(layout.margin >= layout.markInset + layout.markThickness + MARK.clearance);
  assert.match(cutSvg(layout), /<svg/);
});

test('ScanNCut: 3 mm between cards so the scanner sees them apart', () =>
{
  const layout = layoutFor('brother');
  assert.equal(layout.marks, 'brother');
  assert.ok(layout.spacingX >= CUTTER_GAP && layout.spacingY >= CUTTER_GAP);
  assert.ok(layout.perPage >= 4);
  assert.deepEqual(markRects(layout), []);
});
