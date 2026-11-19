import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { errorLanguage, errorPage, errorStatus, notFoundPage } from '../shared/error-page.ts';

test('public/404.html is the current error page (run scripts/write-404.ts after changing it)', () =>
{
  const file = readFileSync(new URL('../public/404.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(file, notFoundPage());
});

test('error pages follow the address language and load no inline style', () =>
{
  const page = errorPage('card', errorLanguage('it'));
  assert.match(page, /<html lang="it">/);
  assert.match(page, /<h1>Carta non trovata<\/h1>/);
  assert.match(page, /href="\/it\/pokemon\/"/);
  assert.match(page, /<p class="error-code">404<\/p>/);
  assert.doesNotMatch(page, /<style|style=/);
  assert.match(errorPage('unavailable', 'fr'), /<p class="error-code">503<\/p>[\s\S]*Temporairement indisponible/);
  assert.equal(errorStatus('unavailable'), 503);
});

test('unknown or tricky first segments fall back to English', () =>
{
  for (const segment of ['xx', '', undefined, 'constructor', '__proto__', 'toString'])
  {
    assert.equal(errorLanguage(segment), 'en');
  }
});
