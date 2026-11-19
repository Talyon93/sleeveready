import type { User } from '@supabase/supabase-js';
import type { TrayItem } from '../../shared/model';
import { loadSupabase } from './supabase';

export type SavedDeck = {
  id: string;
  name: string;
  gameId: number | null;
  gameName: string | null;
  items: TrayItem[];
  updatedAt: string;
};
type DeckRow = {
  id: string;
  name: string;
  game_id: number | null;
  game_name: string | null;
  items: TrayItem[];
  updated_at: string;
};
const toDeck = (row: DeckRow): SavedDeck => ({
  id: row.id,
  name: row.name,
  gameId: row.game_id,
  gameName: row.game_name,
  items: Array.isArray(row.items) ? row.items : [],
  updatedAt: row.updated_at,
});
const client = async () =>
{
  const supabase = await loadSupabase();
  if (!supabase) throw new Error('Account non configurati.');
  return supabase;
};

export async function listDecks(): Promise<SavedDeck[]>
{
  const { data, error } = await (await client())
    .from('decks')
    .select('id,name,game_id,game_name,items,updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as DeckRow[]).map(toDeck);
}
export async function saveDeck(
  user: User,
  input: { id?: string; name: string; gameId: number | null; gameName: string | null; items: TrayItem[] },
): Promise<SavedDeck>
{
  const row = {
    user_id: user.id,
    name: input.name.trim().slice(0, 80),
    game_id: input.gameId,
    game_name: input.gameName,
    items: input.items,
  };
  if (!row.name) throw new Error('Inserisci un nome per la lista.');
  const query = input.id
    ? (await client())
      .from('decks')
      .update(row)
      .eq('id', input.id)
      .select('id,name,game_id,game_name,items,updated_at')
      .single()
    : (await client()).from('decks').insert(row).select('id,name,game_id,game_name,items,updated_at').single();
  const { data, error } = await query;
  if (error) throw error;
  return toDeck(data as DeckRow);
}
export async function removeDeck(id: string)
{
  const { error } = await (await client()).from('decks').delete().eq('id', id);
  if (error) throw error;
}
