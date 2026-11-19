// A print sheet in a link: each entry is expansion id, card id (base 36), copies and print language, e.g.
// "2ocb9xa.k3x1q2.4.en", entries joined by "_". Nothing else travels; the cards are looked up again on opening.
export type SharedEntry = { expansionId: number; cardId: number; quantity: number; language: string };

const ENTRY = /^([0-9a-z]{1,12})\.([0-9a-z]{1,12})\.(\d{1,3})\.([a-z]{2,3}(?:-[a-z]{2,4})?)$/;
export const SHARE_MAX_ENTRIES = 250;

export function encodeSharedList(entries: SharedEntry[])
{
  return entries
    .slice(0, SHARE_MAX_ENTRIES)
    .map(entry =>
      `${entry.expansionId.toString(36)}.${entry.cardId.toString(36)}.${
        Math.min(100, Math.max(1, Math.round(entry.quantity)))
      }.${entry.language.toLowerCase()}`
    )
    .join('_');
}

export function decodeSharedList(value: string | null | undefined): SharedEntry[]
{
  if (!value || value.length > 12_000) return [];
  const entries: SharedEntry[] = [];
  for (const part of value.split('_').slice(0, SHARE_MAX_ENTRIES))
  {
    const match = ENTRY.exec(part);
    if (!match) continue;
    const expansionId = parseInt(match[1], 36);
    const cardId = parseInt(match[2], 36);
    const quantity = Number(match[3]);
    if (
      !Number.isSafeInteger(expansionId) || !Number.isSafeInteger(cardId) || expansionId <= 0 || cardId <= 0
      || quantity < 1 || quantity > 100
    ) continue;
    entries.push({ expansionId, cardId, quantity, language: match[4] });
  }
  return entries;
}
