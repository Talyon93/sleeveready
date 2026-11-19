import { normaliseCardName, normaliseNumber, type DeckEntry } from '../shared/decklist.ts';
import type { CatalogCard } from '../shared/model.ts';
import type { NativeCatalog } from './native-source.ts';
import type { GameIndex } from './card-index.ts';

export type ImportedItem = { card: CatalogCard; quantity: number };
// pending: lines still being searched when the time budget ran out; resend them with scanFrom to continue.
export type ImportResult = {
  items: ImportedItem[];
  unresolved: string[];
  pending?: string[];
  scanFrom?: number | null;
};

const MAX_TOTAL = 900;
const pitchColours = ['red', 'yellow', 'blue'];
const normaliseCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');
const baseCardId = (value: string) => value.replace(/_P\d+$/i, '');
const cardNames = (card: CatalogCard) =>
{
  const names = [normaliseCardName(card.name), ...card.name.split(' // ').map(normaliseCardName)];
  return [...names, ...names.map(name => name.replace(/^basic /, ''))];
};
// Pokémon TCG Live exports basic energy as "Basic {R} Energy SVE 2"; SVE has no images on TCGdex,
// so these lines look for any printing of "Fire Energy" instead.
const energyTypes: Record<string, string> = {
  G: 'Grass',
  R: 'Fire',
  W: 'Water',
  L: 'Lightning',
  P: 'Psychic',
  F: 'Fighting',
  D: 'Darkness',
  M: 'Metal',
};
export function basicEnergy(entry: DeckEntry): DeckEntry
{
  const symbol = /^basic\s*\{([GRWLPFDM])\}\s*energy$/i.exec(entry.name ?? '')?.[1]?.toUpperCase();
  const named = /^basic\s+(grass|fire|water|lightning|psychic|fighting|darkness|metal)\s+energy$/i
    .exec(entry.name ?? '')
    ?.[1];
  const type = symbol ? energyTypes[symbol] : named ? named[0].toUpperCase() + named.slice(1).toLowerCase() : null;
  return type ? { ...entry, name: `${type} Energy`, setCode: null, number: null, cardId: null } : entry;
}
// "Command and Conquer (red)": the trailing colour selects the Flesh and Blood pitch, it is not part of the name.
function nameParts(name: string)
{
  const colour = /\s*\((red|yellow|blue)\)\s*$/i.exec(name)?.[1]?.toLowerCase() ?? null;
  return { name: normaliseCardName(colour ? name.replace(/\s*\([^)]*\)\s*$/, '') : name), colour };
}
// Printed ids carry a set prefix ("BT1-010"); sets may cover a range ("BT01-03") or use a dash ("BT-26", "OP-13").
export function codeCoversPrefix(code: string, prefix: string)
{
  const letters = (value: string) => /^[A-Z]+/.exec(value.toUpperCase())?.[0] ?? '';
  const wanted = Number(/\d+/.exec(prefix)?.[0] ?? NaN);
  if (!letters(code) || letters(code) !== letters(prefix)) return false;
  const numbers = [...code.matchAll(/\d+/g)].map(match => Number(match[0]));
  if (!numbers.length) return false;
  if (Number.isNaN(wanted)) return !/\d/.test(prefix);
  return numbers.length === 2 && numbers[0] < numbers[1]
    ? wanted >= numbers[0] && wanted <= numbers[1]
    : numbers.includes(wanted);
}

// The same printing in another language's list: same collector number, then same version, then same position
// among the printings sharing that number (some games translate the version, e.g. Lorcana subtitles).
export function samePrinting(english: CatalogCard[], localised: CatalogCard[], card: CatalogCard)
{
  const sameNumber = localised.filter(item => item.collectorNumber === card.collectorNumber);
  const position = english.filter(item => item.collectorNumber === card.collectorNumber).indexOf(card);
  return sameNumber.find(item => item.version === card.version) ?? sameNumber[Math.max(0, position)];
}

// Merge repeated lines and apply the print-sheet limits (100 copies per card, 900 in total).
export function mergeImported(items: ImportedItem[]): ImportedItem[]
{
  const merged = new Map<number, ImportedItem>();
  let total = 0;
  for (const item of items)
  {
    const existing = merged.get(item.card.id);
    const current = existing?.quantity ?? 0;
    const quantity = Math.min(100 - current, item.quantity, MAX_TOTAL - total);
    if (quantity <= 0) continue;
    total += quantity;
    merged.set(item.card.id, { card: existing?.card ?? item.card, quantity: current + quantity });
  }
  return [...merged.values()];
}

function pick(cards: CatalogCard[], entry: DeckEntry, useNumber: boolean)
{
  const wanted = entry.name ? nameParts(entry.name) : null;
  const candidates = cards.filter(card =>
  {
    if (entry.cardId)
    {
      return card.collectorNumber != null
        && [baseCardId(entry.cardId), entry.cardId].map(normaliseCode).includes(normaliseCode(card.collectorNumber));
    }
    if (useNumber && entry.number)
    {
      return card.collectorNumber != null && normaliseNumber(card.collectorNumber) === normaliseNumber(entry.number);
    }
    return wanted != null && cardNames(card).includes(wanted.name);
  });
  // A parallel written out ("…-009_p1") is that printing, where the game numbers parallels apart (Union Arena).
  const exact = entry.cardId && entry.cardId !== baseCardId(entry.cardId)
    ? candidates.filter(card => normaliseCode(card.collectorNumber ?? '') === normaliseCode(entry.cardId!))
    : [];
  if (exact.length) return exact[0];
  let named = wanted ? candidates.filter(card => cardNames(card).includes(wanted.name)) : [];
  // "Sol Ring (CMM) 400" where 400 is another card: the name wins, within the same set, before trusting the number.
  if (!named.length && wanted && useNumber && entry.number)
  {
    named = cards.filter(card => cardNames(card).includes(wanted.name));
  }
  let pool = named.length ? named : candidates;
  if (wanted?.colour)
  {
    const coloured = pool.filter(card => card.version?.toLowerCase().includes(wanted.colour!));
    if (coloured.length) pool = coloured;
  }
  // Prefer the regular printing over parallels, backs and alternate products.
  return pool.find(card =>
    !card.version || card.version === 'Front' || pitchColours.includes(card.version.toLowerCase())
  ) ?? pool[0];
}

// Resolves a decklist against any native catalogue using only sets() and cards(): set code + number,
// printed card ids (OP01-001, BT1-010…) and, as a last resort, card names scanned from the newest sets.
export async function importDecklist(
  catalog: NativeCatalog,
  parsed: DeckEntry[],
  language: string,
  options: { budgetMs?: number; scanFrom?: number; index?: GameIndex | null; tokens?: boolean } = {},
): Promise<ImportResult>
{
  if (catalog.importCards) return catalog.importCards(parsed, language, { tokens: options.tokens });
  const entries = parsed.map(basicEnergy);
  const deadline = Date.now() + (options.budgetMs ?? 7000);
  const sets = (await catalog.sets()).data;
  const english = new Map<number, CatalogCard[]>();
  const load = async (expansionId: number) =>
  {
    let cards = english.get(expansionId);
    if (!cards)
    {
      try
      {
        cards = (await catalog.cards(expansionId, 'en')).data;
      }
      catch
      {
        cards = [];
      }
      english.set(expansionId, cards);
    }
    return cards;
  };
  const resolved = new Map<DeckEntry, CatalogCard>();
  for (const entry of entries)
  {
    if (!entry.setCode) continue;
    const direct = entry.cardId ? null : await catalog.expansionForCode?.(entry.setCode);
    const candidates = direct
      ? [direct]
      : sets
        .filter(set =>
          set.code && (entry.cardId
            ? codeCoversPrefix(set.code, entry.setCode!)
            : normaliseCode(set.code) === normaliseCode(entry.setCode!))
        )
        .map(set => set.id);
    for (const expansionId of candidates)
    {
      if (Date.now() > deadline) break;
      const card = pick(await load(expansionId), entry, true);
      if (card)
      {
        resolved.set(entry, card);
        break;
      }
    }
  }
  if (catalog.locateByName)
  {
    for (const entry of entries)
    {
      if (resolved.has(entry) || !entry.name || Date.now() > deadline) continue;
      let locations: number[] = [];
      try
      {
        locations = await catalog.locateByName(entry.name.replace(/\s*\((?:red|yellow|blue)\)\s*$/i, ''));
      }
      catch
      {
        /* Fall back to scanning. */
      }
      for (const expansionId of locations)
      {
        const card = pick(await load(expansionId), entry, false);
        if (card)
        {
          resolved.set(entry, card);
          break;
        }
      }
    }
  }
  // The card index (names and numbers of every indexed set) points at the sets holding a card, so most lines skip the scan.
  if (options.index?.sets.length)
  {
    const position = new Map(sets.map((set, at) => [set.id, at]));
    const bySetKey = new Map(sets.map(set => [`${set.name}|${set.code ?? ''}`, set.id]));
    const byName = new Map<string, number[]>();
    const byNumber = new Map<string, number[]>();
    const add = (map: Map<string, number[]>, key: string, id: number) =>
    {
      const ids = map.get(key);
      if (!ids) map.set(key, [id]);
      else if (!ids.includes(id)) ids.push(id);
    };
    for (const indexed of options.index.sets)
    {
      const id = position.has(indexed.id) ? indexed.id : bySetKey.get(`${indexed.name}|${indexed.code ?? ''}`);
      if (id == null) continue;
      for (const [, name, number] of indexed.cards)
      {
        for (const key of cardNames({ name } as CatalogCard)) add(byName, key, id);
        if (number) add(byNumber, normaliseCode(baseCardId(number)), id);
      }
    }
    for (const entry of entries)
    {
      if (resolved.has(entry) || Date.now() > deadline) continue;
      const ids = entry.cardId
        ? byNumber.get(normaliseCode(baseCardId(entry.cardId)))
        : entry.name
        ? byName.get(nameParts(entry.name).name)
        : undefined;
      for (
        const expansionId of [...ids ?? []].sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0)).slice(0, 8)
      )
      {
        if (Date.now() > deadline) break;
        const card = pick(await load(expansionId), entry, false);
        if (card)
        {
          resolved.set(entry, card);
          break;
        }
      }
    }
  }
  // Remaining lines: printed ids and names, scanned newest set first within the time budget.
  // A line naming an exact printing ("Name SET 123") that was not found is not worth a full name scan.
  const scannable = (entry: DeckEntry) =>
    !resolved.has(entry) && (Boolean(entry.cardId) || Boolean(entry.name && !(entry.setCode && entry.number)));
  let next: number | null = null;
  for (let index = options.scanFrom ?? 0; index < sets.length; index++)
  {
    const pending = entries.filter(scannable);
    if (!pending.length) break;
    if (Date.now() > deadline)
    {
      next = index;
      break;
    }
    const cards = await load(sets[index].id);
    for (const entry of pending)
    {
      const card = pick(cards, entry, false);
      if (card) resolved.set(entry, card);
    }
  }
  // Swap each English match for the same printing in the requested language when the set has it.
  // Match by collector number and position: some games translate the version (Lorcana subtitles).
  const localised = new Map<string, CatalogCard[]>();
  const printLanguage = catalog.game.printLanguages?.includes(language) ? language : 'en';
  const items: ImportedItem[] = [];
  const unresolved: string[] = [];
  const pending: string[] = [];
  for (const entry of entries)
  {
    const card = resolved.get(entry);
    if (!card)
    {
      (next != null && scannable(entry) ? pending : unresolved).push(entry.line);
      continue;
    }
    // A line's own language ("lang:fr") wins over the list's, when the game prints in it.
    const lineLanguage = entry.language && catalog.game.printLanguages?.includes(entry.language)
      ? entry.language
      : printLanguage;
    let chosen = card;
    if (lineLanguage !== 'en' && card.expansionId != null)
    {
      const key = `${card.expansionId}:${lineLanguage}`;
      let cards = localised.get(key);
      if (!cards)
      {
        try
        {
          cards = (await catalog.cards(card.expansionId, lineLanguage)).data;
        }
        catch
        {
          cards = [];
        }
        localised.set(key, cards);
      }
      chosen = samePrinting(english.get(card.expansionId) ?? [], cards, card) ?? card;
    }
    items.push({ card: chosen, quantity: entry.quantity });
  }
  return { items: mergeImported(items), unresolved, pending, scanFrom: pending.length ? next : null };
}
