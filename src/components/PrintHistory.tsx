import type { Language } from '../lib/i18n';
import { sheetKey, type PrintRecord } from '../lib/printHistory';
import { printHistoryCopy } from '../lib/printHistoryCopy';
import { CardImage } from './CardImage';

type Props = {
  records: PrintRecord[];
  language: Language;
  mode: 'demo' | 'live';
  limit?: number;
  onReprint: (record: PrintRecord) => void;
  onRemove?: (record: PrintRecord) => void;
  onMore?: () => void;
};
const locales: Record<Language, string> = {
  en: 'en-GB',
  it: 'it-IT',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  pt: 'pt-PT',
  nl: 'nl-NL',
  pl: 'pl-PL',
};

/** The same sheet printed twice is one entry, at its latest date. */
export const distinctPrints = (records: PrintRecord[]) =>
{
  const seen = new Set<string>();
  return [...records].sort((a, b) => b.printedAt.localeCompare(a.printedAt)).filter(record =>
  {
    const key = sheetKey(record.items);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function PrintHistory({ records, language, mode, limit, onReprint, onRemove, onMore }: Props)
{
  const copy = printHistoryCopy[language];
  const all = distinctPrints(records);
  const shown = limit ? all.slice(0, limit) : all;
  const date = new Intl.DateTimeFormat(locales[language], { day: 'numeric', month: 'short' });
  if (!shown.length) return <p className="print-history-empty">{copy.empty}</p>;
  return (
    <div className="print-history">
      <ul>
        {shown.map(record =>
        {
          const copies = record.items.reduce((sum, item) => sum + item.quantity, 0);
          return (
            <li key={record.id}>
              <div className="print-history-fan" aria-hidden="true">
                {record.items.slice(0, 3).map((item, index) => (
                  <span key={index}>
                    <CardImage language={language} card={item.card} mode={mode} thumb />
                  </span>
                ))}
              </div>
              <div className="print-history-body">
                <strong>{record.gameName ?? record.items[0].card.name}</strong>
                <small>
                  {date.format(new Date(record.printedAt))} · {copy.copies(copies)} · {copy.methods[record.method]}
                </small>
              </div>
              <div className="print-history-actions">
                <button type="button" className="secondary" onClick={() => onReprint(record)}>{copy.reprint}</button>
                {onRemove && (
                  <button type="button" className="danger-link" onClick={() => onRemove(record)}>{copy.remove}</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {onMore && all.length > shown.length && (
        <button type="button" className="text-button" onClick={onMore}>{copy.more(all.length)}</button>
      )}
    </div>
  );
}
