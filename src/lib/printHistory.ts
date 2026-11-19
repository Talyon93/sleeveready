import type { User } from '@supabase/supabase-js';
import type { TrayItem } from '../../shared/model';
import type { PrintSettings } from './printSettings';
import { loadSupabase } from './supabase';

// Every print (browser, PDF or PNG): the cards, the settings and when. The latest ones stay on this device for
// everyone; with an account they are uploaded at sign-in and kept there, so they follow the visitor to other devices.
export type PrintMethod = 'browser' | 'pdf' | 'png';
export type PrintRecord = {
  id: string;
  printedAt: string;
  gameId: number | null;
  gameName: string | null;
  method: PrintMethod;
  copies: number;
  items: TrayItem[];
  settings: PrintSettings;
  synced?: boolean;
};
type PrintRow = {
  id: string;
  printed_at: string;
  game_id: number | null;
  game_name: string | null;
  method: PrintMethod;
  copies: number;
  items: TrayItem[];
  settings: PrintSettings;
};

const KEY = 'sleeveready.prints';
const LOCAL_LIMIT = 12;
const columns = 'id,printed_at,game_id,game_name,method,copies,items,settings';
const toRecord = (row: PrintRow): PrintRecord => ({
  id: row.id,
  printedAt: row.printed_at,
  gameId: row.game_id,
  gameName: row.game_name,
  method: row.method,
  copies: row.copies,
  items: Array.isArray(row.items) ? row.items : [],
  settings: row.settings,
  synced: true,
});
const toRow = (user: User, record: PrintRecord) => ({
  user_id: user.id,
  printed_at: record.printedAt,
  game_id: record.gameId,
  game_name: record.gameName?.slice(0, 80) ?? null,
  method: record.method,
  copies: Math.min(2000, Math.max(1, record.copies)),
  items: record.items,
  settings: record.settings,
});

/** The same cards in the same quantities: printing a sheet again moves it to the top instead of adding a copy. */
export const sheetKey = (items: TrayItem[]) => items.map(item => `${item.card.id}x${item.quantity}`).join();

export function localPrints(): PrintRecord[]
{
  try
  {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter(item => item && Array.isArray(item.items) && item.items.length) : [];
  }
  catch
  {
    return [];
  }
}
function storeLocal(records: PrintRecord[])
{
  // A long history of large sheets can outgrow storage: drop the oldest until it fits.
  for (let kept = Math.min(records.length, LOCAL_LIMIT); kept > 0; kept--)
  {
    try
    {
      localStorage.setItem(KEY, JSON.stringify(records.slice(0, kept)));
      return;
    }
    catch
    {
      /* Too large: try with fewer. */
    }
  }
}

/** Notes a print on this device and returns the history with it on top. */
export function rememberPrint(
  input: Omit<PrintRecord, 'id' | 'printedAt' | 'synced'>,
): { records: PrintRecord[]; record: PrintRecord }
{
  const key = sheetKey(input.items);
  const record: PrintRecord = { ...input, id: crypto.randomUUID(), printedAt: new Date().toISOString() };
  const records = [record, ...localPrints().filter(item => sheetKey(item.items) !== key)];
  storeLocal(records);
  return { records: records.slice(0, LOCAL_LIMIT), record };
}
/** Removes a sheet from this device's history, every time it was printed. */
export function forgetLocalSheet(key: string)
{
  const records = localPrints().filter(item => sheetKey(item.items) !== key);
  storeLocal(records);
  if (!records.length)
  {
    try
    {
      localStorage.removeItem(KEY);
    }
    catch
    {
      /* Storage unavailable. */
    }
  }
  return records;
}
function markSynced(ids: Set<string>)
{
  storeLocal(localPrints().map(item => ids.has(item.id) ? { ...item, synced: true } : item));
}

const client = async () =>
{
  const supabase = await loadSupabase();
  if (!supabase) throw new Error('Account non configurati.');
  return supabase;
};

export async function listPrints(): Promise<PrintRecord[]>
{
  const { data, error } = await (await client())
    .from('print_history')
    .select(columns)
    .order('printed_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data as PrintRow[]).map(toRecord);
}
/** Saves one print to the account; on failure it stays on the device, unsynced, and goes up at the next sign-in. */
export async function uploadPrint(user: User, record: PrintRecord)
{
  const { error } = await (await client()).from('print_history').insert(toRow(user, record));
  if (!error) markSynced(new Set([record.id]));
}
/** At sign-in: the prints made on this device before (or while signed out) join the account. */
export async function uploadLocalPrints(user: User)
{
  const pending = localPrints().filter(item => !item.synced);
  if (!pending.length) return;
  const { error } = await (await client()).from('print_history').insert(pending.map(item => toRow(user, item)));
  if (!error) markSynced(new Set(pending.map(item => item.id)));
}
export async function removePrint(id: string)
{
  const { error } = await (await client()).from('print_history').delete().eq('id', id);
  if (error) throw error;
}
