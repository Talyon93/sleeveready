import { chromium } from '@playwright/test';
import { CardTrader } from '../server/cardtrader.ts';
const c = new CardTrader(process.env.CARDTRADER_API_TOKEN);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
try
{
  const games = (await c.games()).data;
  const sets = (await c.expansions()).data;
  for (const game of games)
  {
    const set = sets.find(e => e.gameId === game.id);
    const catalog = (await c.cards(set.id)).data;
    const raw = await c.request('/blueprints/export', { expansion_id: String(set.id) });
    const card = raw.find(c => c.id === catalog[0].id);
    const sources = { preview: card.image_url, show: card.image?.show?.url, original: card.image?.url };
    const sizes = {};
    for (const [kind, path] of Object.entries(sources))
    {
      if (!path) continue;
      const url = new URL(path, 'https://cardtrader.com').href;
      sizes[kind] = await page.evaluate(url =>
        new Promise(resolve =>
        {
          const img = new Image();
          const timer = setTimeout(() => resolve({ error: 'timeout' }), 15000);
          img.onload = () =>
          {
            clearTimeout(timer);
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
          };
          img.onerror = () =>
          {
            clearTimeout(timer);
            resolve({ error: 'load' });
          };
          img.src = url;
        }), url);
    }
    console.log(JSON.stringify({ game: game.displayName, card: card.name, sources, sizes }));
  }
}
finally
{
  await browser.close();
}
