import type { TrayItem } from '../../shared/model';

// Keys and readers for what the app keeps in this browser's localStorage.
export const BACK_KEY = 'sleeveready.back.v1';
export const KEEP_PROMPT_KEY = 'sleeveready.keepPrompt';

// The saved sheet, dropping anything malformed or over the limits (100 copies per card, 900 in all).
export function loadTray(key: string): TrayItem[]
{
  try
  {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(data)) return [];
    let total = 0;
    const ids = new Set<number>();
    return data.filter((x): x is TrayItem =>
    {
      if (
        !x || typeof x !== 'object' || !x.card || typeof x.card.name !== 'string' || !Number.isInteger(x.card.id)
        || !Number.isInteger(x.quantity) || x.quantity < 1 || x.quantity > 100 || ids.has(x.card.id)
        || total + x.quantity > 900
      ) return false;
      total += x.quantity;
      ids.add(x.card.id);
      return true;
    });
  }
  catch
  {
    return [];
  }
}
