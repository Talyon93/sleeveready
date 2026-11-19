import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReleaseDates, withReleaseDates } from '../server/releases.ts';
test('release dates skip counts, missing dates and invalid days without inheriting dates', () =>
{
  const block = (name: string, content: string) => `<b class="h6 text-tertiary">${name}</b>${content}</div>`;
  const date = (s: string) => `<b class="h6 mt-2 d-block">${s}</b>`;
  const map = parseReleaseDates(
    block('New &amp; Old', date('24 items') + date('30 April 2027')) + block('Missing', date('4 items'))
      + block('Origins', date('31 October 2025')) + block('Invalid', date('31 February 2025')),
  );
  const result = withReleaseDates([
    { id: 1, gameId: 1, name: 'Origins', code: null },
    { id: 99, gameId: 1, name: 'Missing', code: null },
    { id: 2, gameId: 1, name: 'New & Old', code: null },
  ], map);
  assert.deepEqual(result.map(x => x.id), [2, 1, 99]);
  assert.equal(result[0].releaseDate, '2027-04-30');
  assert.equal(result[2].releaseDate, null);
  assert.equal(map.has('invalid'), false);
});
