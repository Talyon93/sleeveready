import { useEffect, useState } from 'react';
import type { CatalogCard } from '../../shared/model';
import { translate, type Language } from '../lib/i18n';

export function Quantity(
  { card, quantity, change, language }: {
    card: CatalogCard;
    quantity: number;
    change: (c: CatalogCard, n: number) => void;
    language: Language;
  },
)
{
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(quantity));
  useEffect(() => setDraft(String(quantity)), [quantity]);
  const apply = () =>
  {
    const next = Number(draft);
    if (Number.isInteger(next) && next >= 1 && next <= 100) change(card, next - quantity);
    else setDraft(String(quantity));
    setEditing(false);
  };
  return (
    <div className="quantity-editor">
      {editing
        ? (
          <form
            className="quantity-edit"
            onSubmit={event =>
            {
              event.preventDefault();
              apply();
            }}
          >
            <span aria-hidden="true">×</span>
            <input
              autoFocus
              aria-label={translate(language, 'copiesOf') + ' ' + card.name}
              type="number"
              inputMode="numeric"
              min="1"
              max="100"
              value={draft}
              onFocus={event => event.currentTarget.select()}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event =>
              {
                if (event.key === 'Escape')
                {
                  setDraft(String(quantity));
                  setEditing(false);
                }
              }}
            />
            <button type="submit" aria-label="OK">✓</button>
          </form>
        )
        : (
          <button
            className="quantity-summary"
            type="button"
            aria-label={translate(language, 'copiesOf') + ' ' + card.name}
            onClick={() => setEditing(true)}
          >
            <span aria-hidden="true">×</span>
            {quantity}
          </button>
        )}
      <button
        className="remove-quantity"
        type="button"
        aria-label={translate(language, 'removeFromSheet') + ' ' + card.name}
        onClick={() => change(card, -quantity)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 4.5h9M6 4.5V3h4v1.5m-5.5 0 .5 9h6l.5-9M7 7v4m2-4v4" />
        </svg>
      </button>
    </div>
  );
}
