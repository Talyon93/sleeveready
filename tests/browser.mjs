import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { demoGames, demoExpansions, demoCards } from '../server/demo.ts';
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge', headless: true });
await mkdir('test-results', { recursive: true });
// Italian browser: Italian interface, A4 by default.
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'it-IT' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const mm = value => value * 96 / 25.4;
try
{
  // Deterministic UI tests always use demo fixtures, even when the server has a token.
  const importRequests = [];
  await page.route('**/api/catalog/**', async route =>
  {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data = [];
    if (path.endsWith('/status'))
    {
      await route.fulfill({
        json: { mode: 'demo', connected: false, tokenPresent: false, cartEnabled: false, development: false },
      });
      return;
    }
    if (path.endsWith('/import'))
    {
      const body = route.request().postDataJSON();
      importRequests.push(body);
      await route.fulfill({
        json: {
          mode: 'demo',
          updatedAt: new Date().toISOString(),
          data: {
            items: [{ card: demoCards(1)[2], quantity: 3 }],
            unresolved: ['1 Missing card'],
            pending: [],
            scanFrom: null,
          },
        },
      });
      return;
    }
    if (path.endsWith('/games')) data = demoGames;
    if (path.endsWith('/expansions'))
    {
      data = demoExpansions.filter(e => e.gameId === Number(url.searchParams.get('gameId')));
    }
    if (path.endsWith('/languages')) data = ['en', 'it'];
    if (path.endsWith('/cards')) data = demoCards(Number(url.searchParams.get('expansionId')));
    if (path.endsWith('/search')) data = { query: url.searchParams.get('q'), total: 0, results: [] };
    await route.fulfill({ json: { data, mode: 'demo', updatedAt: new Date().toISOString() } });
  });
  await page.goto(base + '/it/');
  // The only expansion of each demo game opens on its own.
  await page.locator('.catalog-card').first().waitFor();
  assert.equal(await page.locator('.catalog-card').count(), 12);
  await page.getByRole('searchbox', { name: 'Cerca una carta in questa espansione…' }).fill('Aurora');
  assert.equal(await page.locator('.catalog-card').count(), 1);
  for (let i = 0; i < 10; i++)
  {
    await page.getByRole('button', { name: 'Aggiungi una copia di Aurora Guardian', exact: true }).click();
  }
  assert.equal(await page.locator('.tray-count').innerText(), '10');
  await page.reload();
  await page.locator('.tray-count').filter({ hasText: '10' }).waitFor();
  for (const [index, name] of ['Pokémon', 'One Piece', 'Lorcana', 'Riftbound', 'Magic'].entries())
  {
    // Header game tabs are links to the game pages (buttons only for games without one).
    await page.locator('.header-game-tab').filter({ has: page.getByText(name, { exact: true }) }).click();
    await page.locator('.set-caption').filter({ hasText: demoExpansions[[1, 2, 3, 4, 0][index]].name }).waitFor();
    assert.equal(await page.locator('.catalog-card').count(), 12);
  }
  // Decklist import: the request carries the game and card language, the result joins the sheet.
  await page.getByRole('button', { name: 'Importa lista' }).click();
  await page.getByRole('textbox', { name: 'Importa una lista Magic: The Gathering' }).fill(
    '3 Ember Scout\n1 Missing card',
  );
  await page.getByRole('button', { name: 'Aggiungi al foglio' }).click();
  await page.locator('.import-result').filter({ hasText: 'Aggiunte 3 copie di 1 carta.' }).waitFor();
  assert.match(await page.locator('.import-result').innerText(), /1 Missing card/);
  assert.equal(importRequests[0].gameId, 1);
  assert.equal(importRequests[0].language, 'en', 'demo games declare no print languages, so English is requested');
  await page.getByRole('button', { name: 'Chiudi importazione' }).click();
  assert.equal(await page.locator('.tray-count').innerText(), '13');
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Anteprima e stampa' }).click();
  await page.locator('.print-dialog[open]').waitFor();
  assert.equal(await page.locator('.print-page').count(), 2);
  assert.equal(await page.locator('.print-card').count(), 13);
  const size = await page.locator('.print-card').first().boundingBox();
  assert.ok(size);
  assert.ok(Math.abs(size.width - mm(63)) < 1);
  assert.ok(Math.abs(size.height - mm(88)) < 1);
  const a4 = await page.locator('.print-page').first().boundingBox();
  assert.ok(Math.abs(a4.width - mm(210)) < 1 && Math.abs(a4.height - mm(297)) < 1, 'A4 is the Italian default');
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: 'test-results/a4-demo.pdf', preferCSSPageSize: true, printBackground: true });
  await page.screenshot({ path: 'test-results/a4.png', fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  const pdf = (await readFile('test-results/a4-demo.pdf')).toString('latin1');
  assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, 2, 'PDF must contain two actual pages');
  // US Letter, spacing and bleed: the card stays 63 × 88 mm inside a 65 × 90 mm bleed area.
  const dialog = page.locator('.print-dialog');
  await dialog.getByLabel('Carta', { exact: true }).selectOption('letter');
  await dialog.getByLabel('Spazio tra le carte', { exact: true }).fill('2');
  await dialog.getByLabel('Abbondanza (bleed)', { exact: true }).fill('1');
  const letter = await page.locator('.print-page').first().boundingBox();
  assert.ok(Math.abs(letter.width - mm(215.9)) < 1 && Math.abs(letter.height - mm(279.4)) < 1, 'Letter page size');
  const bleed = await page.locator('.print-bleed').first().boundingBox();
  const card = await page.locator('.print-card').first().boundingBox();
  assert.ok(Math.abs(bleed.width - mm(65)) < 1 && Math.abs(bleed.height - mm(90)) < 1, '1 mm bleed on each side');
  assert.ok(Math.abs(card.width - mm(63)) < 1 && Math.abs(card.x - bleed.x - mm(1)) < 1, 'card centred in the bleed');
  await dialog.getByLabel('Abbondanza (bleed)', { exact: true }).fill('0');
  await dialog.getByLabel('Spazio tra le carte', { exact: true }).fill('0');
  await dialog.getByLabel('Carta', { exact: true }).selectOption('a4');
  await page.getByRole('button', { name: 'Chiudi anteprima' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile overflow');
  await page.setViewportSize({ width: 1440, height: 1100 });
  // A live-mode fixture exercises image fallback: the first URL fails, the next one is used.
  await page.unroute('**/api/catalog/**');
  await page.route('**/api/catalog/**', async route =>
  {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data;
    const fixture = {
      id: 7001,
      gameId: 1,
      categoryId: 1,
      expansionId: 700,
      name: 'Fixture card',
      version: 'Test',
      language: 'it',
      collectorNumber: '001',
      imageUrl: 'https://images.example.test/missing.png',
      imageUrls: ['https://images.example.test/missing.png', 'https://images.example.test/card.png'],
    };
    if (path.endsWith('/status'))
    {
      data = { mode: 'live', connected: true, tokenPresent: true, cartEnabled: false, development: false };
    }
    else if (path.endsWith('/games'))
    {
      data = { data: [{ id: 1, name: 'Magic', displayName: 'Magic: The Gathering', printLanguages: ['en', 'it'] }] };
    }
    else if (path.endsWith('/expansions'))
    {
      data = { data: [{ id: 700, gameId: 1, name: 'Fixture set', code: 'TST', releaseDate: '2026-01-01' }] };
    }
    else if (path.endsWith('/languages')) data = { data: ['en', 'it'] };
    else data = { data: [fixture] };
    await route.fulfill({ json: { updatedAt: new Date().toISOString(), mode: 'live', ...data } });
  });
  await page.route(
    'https://images.example.test/card.png',
    route =>
      route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=',
          'base64',
        ),
      }),
  );
  await page.route('https://images.example.test/missing.png', route => route.fulfill({ status: 404 }));
  await page.reload();
  await page.locator('.catalog-card').first().waitFor();
  assert.equal(await page.locator('.tray-count').innerText(), '0', 'live and demo sheets are stored separately');
  await page.waitForFunction(() =>
    document.querySelector('.catalog-card img')?.getAttribute('src') === 'https://images.example.test/card.png'
  );
  await page.getByRole('button', { name: 'Aggiungi una copia di Fixture card' }).click();
  assert.equal(await page.locator('.tray-count').innerText(), '1');
  assert.deepEqual(errors, []);
  console.log(
    'Browser OK: 5 giochi demo, ricerca, 10 copie persistenti, import lista, 2 pagine A4 e PDF, Letter con bleed 1 mm, 63×88 mm, mobile senza overflow, fallback immagini, zero errori JS.',
  );
}
catch (e)
{
  await page.screenshot({ path: 'test-results/failure.png', fullPage: true });
  console.error((await page.locator('body').innerText()).slice(0, 1500));
  throw e;
}
finally
{
  await browser.close();
}
