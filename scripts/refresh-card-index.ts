// Fills or refreshes the card index by hand, without the 20-second budget of the scheduled function.
// Local folder by default (.cache/card-index, what `npm run dev` reads); with NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN
// set, the site's Netlify Blobs store, to seed production in one go instead of waiting for the scheduled runs.
// Optional: CARD_INDEX_GAMES=pokemon,magic-the-gathering limits the games; CARD_INDEX_MINUTES caps the run.
import { buildCatalogs } from '../server/catalogs.ts';
import { blobIndexStore, fileIndexStore, gameSlugOf, refreshCardIndex } from '../server/card-index.ts';

const siteID = process.env.NETLIFY_SITE_ID?.trim();
const token = process.env.NETLIFY_AUTH_TOKEN?.trim();
const store = siteID && token
  ? blobIndexStore({ siteID, token })
  : fileIndexStore(process.env.CARD_INDEX_DIR ?? '.cache/card-index');
const games = (process.env.CARD_INDEX_GAMES ?? '').split(',').map(game => game.trim()).filter(Boolean);
const catalogs = buildCatalogs().catalogs.filter(catalog => !games.length || games.includes(gameSlugOf(catalog) ?? ''));
const minutes = Number(process.env.CARD_INDEX_MINUTES ?? 240);
console.log(
  `Indexing ${catalogs.length} games into ${
    siteID && token ? 'Netlify Blobs' : 'the local folder'
  } for up to ${minutes} minutes…`,
);
// Runs in slices so progress is saved as it goes and an interruption loses one slice at most.
const end = Date.now() + minutes * 60_000;
let total = 0;
while (Date.now() < end)
{
  const result = await refreshCardIndex(catalogs, store, {
    budgetMs: Math.min(120_000, end - Date.now()),
    log: line => console.warn(line),
  });
  total += result.indexed;
  console.log(`+${result.indexed} expansions (${result.failed} failed), ${result.remaining} waiting.`);
  if (result.stopped === 'done') break;
}
console.log(`Done: ${total} expansions indexed.`);
