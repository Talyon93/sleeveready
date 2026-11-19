import type { CardInfo } from '../../shared/model';

// What the loaded page already holds, read once when the app starts, before React replaces the static markup.
// What the server put in the head of the page that was loaded (card pages describe the card from its text).
export const serverHead = {
  path: location.pathname,
  description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
};
// Card data a server-rendered card page embeds (same answer as /api/catalog/card-info), read once.
export const embeddedCardInfo = (() =>
{
  try
  {
    const element = document.getElementById('card-info-data');
    const value = element ? JSON.parse(element.textContent ?? 'null') : null;
    return value && typeof value.key === 'string' && value.data ? value as { key: string; data: CardInfo } : null;
  }
  catch
  {
    return null;
  }
})();
// Upcoming sets the static page drew as shapes: the app keeps as many until the real ones arrive.
export const shellUpcoming = document.querySelectorAll('#root .upcoming-sets.is-skel > .upcoming-set').length;
