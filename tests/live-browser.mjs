import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, locale: 'it-IT' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await mkdir('test-results', { recursive: true });
// Real native sources, read only: one game per source family, each opened from an expansion page that the
// snapshot says exists in that language, so the cards must arrive printed in it.
const snapshot = JSON.parse(await readFile(new URL('../shared/data/seo-sets.json', import.meta.url), 'utf8'));
const samples = [
  ['magic-the-gathering', 'it'],
  ['pokemon', 'it'],
  ['one-piece', 'fr'],
  ['disney-lorcana', 'de'],
  ['star-wars-unlimited', 'es'],
  ['flesh-and-blood', 'en'],
  ['digimon', 'en'],
  ['sorcery', 'en'],
]
  .map(([game, language]) =>
  {
    const set = snapshot.games[game]?.find(item => item.cards[language]?.length);
    assert.ok(set, `no ${language} expansion page for ${game}`);
    return { path: `/${language}/${game}/${set.slug}/`, language: language.toUpperCase() };
  });
try
{
  const games = await (await page.request.get(base + '/api/catalog/games')).json();
  assert.equal(games.data.length, 16);
  for (const sample of samples)
  {
    await page.goto(base + sample.path);
    await expect(page.locator('.catalog-card').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.catalog-card .card-language').first()).toHaveText(sample.language);
    await expect
      .poll(() => page.locator('.catalog-card img').first().evaluate(img => img.complete && img.naturalWidth > 0), {
        timeout: 30000,
      })
      .toBe(true);
    assert.ok(
      await page.locator('.catalog-card img').first().evaluate(img => img.naturalWidth > 180),
      'Full-size artwork, not a thumbnail',
    );
    await page.locator('.catalog-card').first().getByRole('button').first().click();
    console.log('Browser live OK:', sample.path, '/', await page.locator('.set-caption').innerText());
  }
  assert.equal(await page.locator('.tray-count').innerText(), String(samples.length));
  // A card page: server-rendered head, then the app opens the same card with a single H1.
  const lorcana = snapshot.games['disney-lorcana'].find(set => set.cards.de?.length && set.cardSlugs?.length);
  const cardUrl = `/de/disney-lorcana/${lorcana.slug}/${lorcana.cardSlugs[0]}/`;
  const served = await (await page.request.get(base + cardUrl)).text();
  assert.match(served, /<link rel="canonical" href="[^"]+\/de\/disney-lorcana\//);
  assert.match(served, /hreflang="de"/);
  await page.goto(base + cardUrl);
  await expect(page.locator('.card-page h1')).toBeVisible({ timeout: 30000 });
  assert.equal(await page.locator('h1').count(), 1);
  console.log('Pagina carta OK:', cardUrl, '/', await page.locator('.card-page h1').innerText());
  // A real decklist imports in the page's card language.
  await page.goto(base + '/it/pokemon/');
  await expect(page.locator('.catalog-card').first()).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Importa lista' }).click();
  await page.getByRole('textbox', { name: 'Importa una lista Pokémon' }).fill('3 Charizard ex OBF 125\n4 Iono PAL 185');
  await page.getByRole('button', { name: 'Aggiungi al foglio' }).click();
  await expect(page.locator('.import-result')).toContainText('Aggiunte 7 copie di 2 carte.', { timeout: 60000 });
  await page.getByRole('button', { name: 'Chiudi importazione' }).click();
  await page.screenshot({ path: 'test-results/live-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Anteprima e stampa' }).click();
  await expect(page.locator('.print-dialog[open]')).toBeVisible();
  const count = samples.length + 7; // one copy per sample plus 3 + 4 imported copiesassert.equal(await page.locator('.print-card').count(),count);
  await expect
    .poll(
      () =>
        page.locator('.print-card img').evaluateAll(
          (images, expected) =>
            images.length === expected && images.every(img => img.complete && img.naturalWidth > 180),
          count,
        ),
      { timeout: 60000 },
    )
    .toBe(true);
  console.log('Risoluzioni:', await page.locator('.image-quality').allTextContents());
  await page.pdf({ path: 'test-results/a4-live.pdf', preferCSSPageSize: true, printBackground: true });
  assert.deepEqual(errors, []);
  console.log(
    'Browser live OK: 8 giochi da pagine espansione, lingue IT/FR/DE/ES, import Pokémon in italiano, PDF A4.',
  );
}
finally
{
  await browser.close();
}
