// language: a line may ask for its own print language ("1x Sol Ring lang:fr", "language:de", "l:ja").
export type DeckEntry = {
  line: string;
  quantity: number;
  name: string | null;
  setCode: string | null;
  number: string | null;
  cardId: string | null;
  language?: string | null;
};

export const DECKLIST_MAX_LINES = 250;
export const DECKLIST_MAX_COPIES = 100;

// Section headers and counters used by Arena, Moxfield, PTCGL, Limitless, YDK and friends.
const sectionHeader =
  /^(?:deck|main\s*deck|mainboard|main|sideboard|side|maybeboard|commander|companion|leader|leaders|champions?|base|bases|battlefields?|legend|runes?|egg\s*deck|digi-?egg|don!?!?|tokens?|extra(?:\s*deck)?|pok[eé]mon|trainers?|energy|characters?|events?|stages?|units?|upgrades?|spells?|sites?|avatar|atlas|spellbook|total\s*cards|(?:arena|deck)\s*cards)\b[^a-z0-9]*(?:\d+\s*)?$/i;
// Deck metadata in Fabrary-style exports ("Name: …", "Format: Blitz"); "Hero: Nuu, Alluring Desire" is a card, once.
const metadata = /^(?:name|format|deck\s*name|author|created|description)\s*:/i;
const singleCard = /^(?:hero|legend|leader|champion)\s*:\s*(.+)$/i;
// Card identifiers printed on the card itself: OP01-001, BT1-010, GD01-001, FB01-001, EX13-001_P1, SOR_005…
const cardIdPattern = /^([A-Z]{1,5}\d{0,3}[A-Z]?)[-_](\d{1,4}[A-Z]?)(?:_P\d+)?$/i;
// …and the ones with a slash: Union Arena (UE01BT/JJK-1-001), Cardfight!! Vanguard (DZ-BT15/022EN).
const slashedIdPattern = /^(?=[^/]*\d)([A-Z0-9-]{2,10})\/(?=[^/]*\d)([A-Z0-9-]{2,14})(?:_P\d+)?$/i;

export function normaliseCardName(value: string)
{
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
export function normaliseNumber(value: string)
{
  const match = /^0*(\d+)(.*)$/.exec(value.trim());
  return match ? `${match[1]}${match[2].toLowerCase()}` : value.trim().toLowerCase();
}

export function parseDecklistLine(raw: string): DeckEntry | null
{
  const written = raw.trim().replace(/\s+/g, ' ');
  // A trailing language clause applies to this line only; the rest of the line parses as usual.
  const clause = /\s+(?:lang|language|l):([a-z]{2,3}(?:-[a-z]{2,4})?)$/i.exec(written);
  const language = clause ? clause[1].toLowerCase() : null;
  const line = clause ? written.slice(0, clause.index).trim() : written;
  const parsed = parseLine(line);
  return parsed && language
    ? { ...parsed, line: written, language }
    : parsed && clause
    ? { ...parsed, line: written }
    : parsed;
}
function parseLine(line: string): DeckEntry | null
{
  if (!line || /^(?:#|\/\/|!)/.test(line) || sectionHeader.test(line) || metadata.test(line)) return null;
  const single = singleCard.exec(line);
  if (single) return { line, quantity: 1, name: single[1].trim(), setCode: null, number: null, cardId: null };
  let quantity = 1;
  let rest = line;
  const leading = /^(\d{1,3})\s*[xX×]?\s+(.+)$/.exec(line) ?? /^(\d{1,3})[xX×](\S.*)$/.exec(line)
    ?? /^\((\d{1,3})\)\s*(.+)$/.exec(line);
  const trailing = /^(.+?)\s+[xX×]\s*(\d{1,3})$/.exec(line);
  if (leading)
  {
    quantity = Number(leading[1]);
    rest = leading[2];
  }
  else if (trailing)
  {
    quantity = Number(trailing[2]);
    rest = trailing[1];
  }
  if (quantity < 1) return null;
  quantity = Math.min(quantity, DECKLIST_MAX_COPIES);
  rest = rest.replace(/^\|\s*/, '').replace(/\s+\*[A-Z]+\*$/, '').replace(/\s+\[[^\]]*\]$/, '').trim();
  const entry: DeckEntry = { line, quantity, name: null, setCode: null, number: null, cardId: null };
  const cardId = cardIdPattern.exec(rest);
  if (cardId)
  {
    entry.cardId = rest.toUpperCase();
    entry.setCode = cardId[1].toUpperCase();
    entry.number = cardId[2];
    return entry;
  }
  const slashed = slashedIdPattern.exec(rest);
  if (slashed)
  {
    entry.cardId = rest.toUpperCase();
    entry.setCode = slashed[1].toUpperCase();
    entry.number = slashed[2];
    return entry;
  }
  // "Name (SET) 123" (Arena, Moxfield; Lorcana sets are single digits, Yu-Gi-Oh! numbers are printed codes like BETB-EN095)
  // or "Name SET 123" (Pokémon TCG Live).
  // Set codes are upper case in every export; "(red)" in Flesh and Blood lists is part of the card name.
  const arena = /^(.+?)\s+\(([A-Z0-9-]{1,8})\)\s+([A-Za-z0-9★-]{1,12})$/.exec(rest)
    ?? /^(.+?)\s+\(([A-Z0-9-]{2,8})\)$/.exec(rest);
  if (arena)
  {
    entry.name = arena[1].trim();
    entry.setCode = arena[2].toUpperCase();
    entry.number = arena[3] ?? null;
    return entry;
  }
  const live = /^(.+?)\s+([A-Z][A-Z0-9]{1,4}(?:-[A-Z0-9]{1,4})?)\s+(\d{1,4}[a-z]?)$/.exec(rest);
  if (live)
  {
    entry.name = live[1].trim();
    entry.setCode = live[2];
    entry.number = live[3];
    return entry;
  }
  entry.name = rest.replace(/\s*\|\s*/g, ', ');
  return entry.name ? entry : null;
}

export function parseDecklist(text: string): DeckEntry[]
{
  const entries: DeckEntry[] = [];
  for (const raw of text.split(/\r?\n/).slice(0, DECKLIST_MAX_LINES))
  {
    const entry = parseDecklistLine(raw);
    if (entry) entries.push(entry);
  }
  return entries;
}
