import { useEffect, useRef } from 'react';
import type { Language } from '../lib/i18n';
import type { CatalogCard } from '../../shared/model';
import { shareCopy } from '../lib/shareCopy';
import { CardImage } from './CardImage';

// What someone who opens a shared link sees first: the cards they were sent, one line on what the site does, and the
// two things they came to do. With an empty sheet the cards can go straight to print; with a sheet already started,
// they join it, or replace it for this print only (Undo brings the sheet back). One row of thumbnails, the last one
// counting the rest.
type Item = { card: CatalogCard; quantity: number };
type Props = {
  items: Item[];
  missing: number;
  sheetCopies: number;
  gameName: string;
  theme: string;
  language: Language;
  mode: string;
  onPrint: () => void;
  onAdd: () => void;
  onClose: () => void;
};

export function SharedArrival(
  { items, missing, sheetCopies, gameName, theme, language, mode, onPrint, onAdd, onClose }: Props,
)
{
  const dialog = useRef<HTMLDialogElement>(null);
  const sc = shareCopy[language];
  useEffect(() =>
  {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  const copies = items.reduce((sum, item) => sum + item.quantity, 0);
  const room = matchMedia('(max-width:520px)').matches ? 4 : 6;
  const shown = items.slice(0, items.length > room ? room - 1 : room);
  const more = items.length - shown.length;
  const started = sheetCopies > 0;
  return (
    <dialog
      ref={dialog}
      data-game={theme}
      className="account-dialog shared-arrival"
      aria-labelledby="shared-arrival-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="dialog-top">
        <div>
          <span className="shared-kicker">{sc.kicker(gameName)}</span>
          <h2 id="shared-arrival-title">{sc.title(copies)}</h2>
        </div>
        <button className="close" aria-label={sc.close} onClick={onClose}>×</button>
      </div>
      <ul className="shared-cards">
        {shown.map(item => (
          <li key={item.card.id}>
            <div className="shared-thumb">
              <CardImage language={language} card={item.card} mode={mode} thumb eager />
            </div>
            {item.quantity > 1 && <span className="copy-badge">×{item.quantity}</span>}
          </li>
        ))}
        {more > 0 && <li className="shared-more">+{more}</li>}
      </ul>
      <p className="shared-lead">{sc.lead}</p>
      {missing > 0 && <p className="shared-note">{sc.missing(missing)}</p>}
      {started && <p className="shared-note">{sc.sheetStarted(sheetCopies)}</p>}
      <div className="shared-actions">
        {started
          ? (
            <>
              <button type="button" className="primary" onClick={onAdd}>{sc.add}</button>
              <button type="button" className="secondary" onClick={onPrint}>{sc.printOnly}</button>
            </>
          )
          : (
            <>
              <button type="button" className="primary" onClick={onPrint}>
                {sc.print} <span>→</span>
              </button>
              <button type="button" className="secondary" onClick={onAdd}>{sc.add}</button>
            </>
          )}
      </div>
    </dialog>
  );
}
