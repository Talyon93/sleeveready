import type { CatalogCard, TrayItem } from '../../shared/model';
import { loadSupabase, publicSelect } from './supabase';
import { countsVisitor } from './analytics';

export type TopCard = { card: CatalogCard; prints: number };
// Only what is needed to show and re-add the card; no user, device or sheet information is sent.
const snapshot = (card: CatalogCard): CatalogCard => ({
  id: card.id,
  gameId: card.gameId,
  categoryId: card.categoryId,
  expansionId: card.expansionId,
  name: card.name,
  version: card.version,
  collectorNumber: card.collectorNumber ?? null,
  rarity: card.rarity ?? null,
  language: card.language ?? null,
  imageUrl: card.imageUrl,
  imageUrls: card.imageUrls?.slice(0, 3),
});

// One print per distinct card per game, recorded in the background; failures never affect printing.
export async function recordPrints(items: TrayItem[])
{
  if (!countsVisitor()) return;
  const supabase = await loadSupabase();
  if (!supabase) return;
  const byGame = new Map<number, CatalogCard[]>();
  for (const { card } of items)
  {
    const list = byGame.get(card.gameId) ?? [];
    if (!list.some(item => item.id === card.id)) list.push(snapshot(card));
    byGame.set(card.gameId, list);
  }
  for (const [game, cards] of byGame)
  {
    for (let offset = 0; offset < cards.length; offset += 60)
    {
      try
      {
        await supabase.rpc('record_prints', { game, cards: cards.slice(offset, offset + 60) });
      }
      catch
      {
        /* The ranking is best effort. */
      }
    }
    // Which cards share a sheet, for "often printed with" (the function ignores sheets of over 100 cards: whole sets).
    if (cards.length > 1 && cards.length <= 100)
    {
      try
      {
        await supabase.rpc('record_pairs', { game, cards: cards.map(card => card.id) });
      }
      catch
      {
        /* Best effort too. */
      }
    }
  }
}

export async function topPrints(gameId: number, limit = 48): Promise<TopCard[] | null>
{
  // A plain REST read, so the ranking page does not load the client.
  const data = await publicSelect<{ card: CatalogCard; prints: number }>(
    'print_counts',
    `select=card,prints&game_id=eq.${gameId}&order=prints.desc&limit=${limit}`,
  );
  if (!data) return null;
  return data.filter(row => row.card && typeof row.card.name === 'string');
}
