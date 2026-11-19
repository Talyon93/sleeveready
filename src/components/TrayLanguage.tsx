import { useState } from 'react';
import type { CatalogCard, Envelope } from '../../shared/model';
import { api } from '../lib/api';
import type { Language } from '../lib/i18n';

// The language of a card on the sheet, as a small select: the set's languages load when it is opened, and choosing
// one swaps in the same printing (same number and version) from that language's card list.
type Props = {
  card: CatalogCard;
  printLanguages: readonly string[];
  label: string;
  languageName: (code: string) => string;
  onSwitch: (card: CatalogCard) => void;
  onFail: () => void;
};
export const trayLanguageMissing: Record<Language, string> = {
  en: 'This card is not available in that language.',
  it: 'Questa carta non è disponibile in quella lingua.',
  de: 'Diese Karte gibt es in dieser Sprache nicht.',
  fr: 'Cette carte n’existe pas dans cette langue.',
  es: 'Esta carta no está disponible en ese idioma.',
  pt: 'Esta carta não está disponível nesse idioma.',
  nl: 'Deze kaart is niet beschikbaar in die taal.',
  pl: 'Ta karta nie jest dostępna w tym języku.',
};
const setLanguages = new Map<number, Promise<string[]>>();

export function sameCardIn(list: CatalogCard[], card: CatalogCard)
{
  const sameNumber = list.filter(item => item.collectorNumber === card.collectorNumber);
  return sameNumber.find(item => item.version === card.version) ?? sameNumber.find(item => item.name === card.name)
    ?? sameNumber[0];
}

export function TrayLanguage({ card, printLanguages, label, languageName, onSwitch, onFail }: Props)
{
  const current = card.language ?? 'en';
  const [options, setOptions] = useState<string[]>([current]);
  const [busy, setBusy] = useState(false);
  const expansionId = card.expansionId;
  function load()
  {
    if (!expansionId || options.length > 1) return;
    let request = setLanguages.get(expansionId);
    if (!request)
    {
      request = api<Envelope<string[]>>('languages?expansionId=' + expansionId).then(result => result.data, () => []);
      setLanguages.set(expansionId, request);
    }
    void request.then(codes =>
    {
      const available = codes.filter(code => printLanguages.includes(code));
      setOptions([...new Set([current, ...available])]);
    });
  }
  async function choose(code: string)
  {
    if (code === current || !expansionId) return;
    setBusy(true);
    try
    {
      const list =
        (await api<Envelope<CatalogCard[]>>(`cards?expansionId=${expansionId}&language=${encodeURIComponent(code)}`))
          .data;
      const match = sameCardIn(list, card);
      if (match) onSwitch(match);
      else onFail();
    }
    catch
    {
      onFail();
    }
    finally
    {
      setBusy(false);
    }
  }
  return (
    <select
      className="tray-language"
      aria-label={label}
      value={current}
      disabled={busy}
      onFocus={load}
      onPointerDown={load}
      onChange={event => void choose(event.target.value)}
    >
      {options.map(code => (
        <option key={code} value={code}>
          {code.toUpperCase()}
          {code === current ? '' : ' · ' + languageName(code)}
        </option>
      ))}
    </select>
  );
}
