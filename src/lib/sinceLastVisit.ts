// What changed in a game since the visitor last opened it: the sets released since then, and the cards revealed since
// then in the coming sets. The device keeps, per game, only the day of the visit and the revealed counts. Each tab keeps
// the visit it started from, so the marks stay through reloads and set changes until the tab is closed.
export type LastVisit = { date: string; revealed: Record<string, number> };
const KEY = 'sleeveready.seen.v1';
const BASE = 'sleeveready.seenBase.v1';
type Store = Record<string, LastVisit | null>;
function read(storage: Storage, key: string): Store
{
  try
  {
    const value = JSON.parse(storage.getItem(key) ?? '{}');
    return value && typeof value === 'object' ? value : {};
  }
  catch
  {
    return {};
  }
}
function write(storage: Storage, key: string, value: Store)
{
  try
  {
    storage.setItem(key, JSON.stringify(value));
  }
  catch
  {
    /* private mode: nothing to remember */
  }
}
const valid = (value: unknown): value is LastVisit =>
  Boolean(
    value && typeof value === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String((value as LastVisit).date))
      && (value as LastVisit).revealed && typeof (value as LastVisit).revealed === 'object',
  );

// Returns the last visit before this tab (null on a first visit) and records this one.
export function sinceLastVisit(
  gameId: number,
  today: string,
  upcoming: { id: number; revealed: number }[],
): LastVisit | null
{
  if (typeof localStorage === 'undefined') return null;
  const id = String(gameId);
  const bases = read(sessionStorage, BASE);
  const saved = read(localStorage, KEY);
  const base = id in bases ? bases[id] : (valid(saved[id]) ? saved[id] : null);
  if (!(id in bases))
  {
    bases[id] = base;
    write(sessionStorage, BASE, bases);
  }
  saved[id] = { date: today, revealed: Object.fromEntries(upcoming.map(item => [String(item.id), item.revealed])) };
  write(localStorage, KEY, saved);
  return valid(base) ? base : null;
}
export const releasedSince = (visit: LastVisit | null, releaseDate: string | null | undefined, today: string) =>
  Boolean(visit && releaseDate && releaseDate > visit.date && releaseDate <= today);
export const revealedSince = (visit: LastVisit | null, id: number, revealed: number) =>
  visit ? Math.max(0, revealed - (visit.revealed[String(id)] ?? 0)) : 0;
