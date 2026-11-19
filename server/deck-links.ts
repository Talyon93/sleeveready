// A deck link pasted in the import box (Moxfield, Archidekt) becomes the same text an export would give:
// "1 Sol Ring (CMM) 400" per card, main deck, commanders and sideboard, no maybeboard or tokens.
// Moxfield answers only approved clients: the user agent they assign goes in MOXFIELD_USER_AGENT.
const userAgent = (source: DeckLink['source']) =>
  (source === 'moxfield' ? process.env.MOXFIELD_USER_AGENT?.trim() : null)
  || 'SleeveReady/1.0 (+https://sleeveready.com)';
type Line = { quantity: number; name: string; set?: string | null; number?: string | null };
export type DeckLink = { source: 'moxfield' | 'archidekt'; id: string };

export function deckLinkOf(text: string): DeckLink | null
{
  const value = text.trim();
  if (/\s/.test(value)) return null;
  const moxfield = /^(?:https?:\/\/)?(?:www\.)?moxfield\.com\/decks\/([A-Za-z0-9_-]{6,40})\/?(?:[?#].*)?$/i.exec(value);
  if (moxfield) return { source: 'moxfield', id: moxfield[1] };
  const archidekt = /^(?:https?:\/\/)?(?:www\.)?archidekt\.com\/decks\/(\d{1,10})(?:\/[^?#]*)?(?:[?#].*)?$/i.exec(
    value,
  );
  if (archidekt) return { source: 'archidekt', id: archidekt[1] };
  return null;
}

const lineText = (line: Line) =>
  [
    `${line.quantity} ${line.name}`,
    line.set ? `(${line.set.toUpperCase()})` : null,
    line.set && line.number ? line.number : null,
  ]
    .filter(Boolean)
    .join(' ');

type MoxfieldBoard = {
  cards?: Record<string, { quantity?: number; card?: { name?: string; set?: string; cn?: string } }>;
};
export function moxfieldLines(deck: { boards?: Record<string, MoxfieldBoard> }): Line[]
{
  return ['commanders', 'companions', 'mainboard', 'sideboard']
    .flatMap(board => Object.values(deck.boards?.[board]?.cards ?? {}))
    .filter(entry => entry.card?.name && (entry.quantity ?? 0) > 0)
    .map(entry => ({
      quantity: entry.quantity!,
      name: entry.card!.name!,
      set: entry.card!.set,
      number: entry.card!.cn,
    }));
}
type ArchidektDeck = {
  categories?: { name: string; includedInDeck: boolean }[];
  cards?: {
    quantity?: number;
    categories?: string[] | null;
    card?: { collectorNumber?: string; edition?: { editioncode?: string }; oracleCard?: { name?: string } };
  }[];
};
export function archidektLines(deck: ArchidektDeck): Line[]
{
  const excluded = new Set(
    (deck.categories ?? []).filter(category => !category.includedInDeck).map(category => category.name),
  );
  return (deck.cards ?? [])
    .filter(entry =>
      entry.card?.oracleCard?.name && (entry.quantity ?? 0) > 0
      && !(entry.categories ?? []).some(name => excluded.has(name))
    )
    .map(entry => ({
      quantity: entry.quantity!,
      name: entry.card!.oracleCard!.name!,
      set: entry.card!.edition?.editioncode,
      number: entry.card!.collectorNumber,
    }));
}

export class DeckLinkError extends Error
{
  constructor(public status: number, message: string)
  {
    super(message);
  }
}
export async function fetchDeckLink(link: DeckLink): Promise<string>
{
  const url = link.source === 'moxfield'
    ? `https://api2.moxfield.com/v3/decks/all/${link.id}`
    : `https://archidekt.com/api/decks/${link.id}/`;
  let response: Response;
  try
  {
    response = await fetch(url, {
      headers: { 'User-Agent': userAgent(link.source), Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
  }
  catch
  {
    throw new DeckLinkError(502, 'The deck site is not answering: try again, or paste the exported list.');
  }
  if (response.status === 404 || response.status === 401)
  {
    throw new DeckLinkError(404, 'Deck not found or private: make it public, or paste the exported list.');
  }
  if (!response.ok)
  {
    throw new DeckLinkError(
      502,
      link.source === 'moxfield'
        ? 'Moxfield does not let us read the deck: on Moxfield open Export → Copy for MTGO and paste the list here.'
        : 'We cannot read the deck from this link: paste the exported list.',
    );
  }
  const deck = await response.json();
  const lines = link.source === 'moxfield' ? moxfieldLines(deck) : archidektLines(deck);
  if (!lines.length) throw new DeckLinkError(400, 'The deck is empty.');
  return lines.map(lineText).join('\n');
}
