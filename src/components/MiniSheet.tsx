import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CatalogCard } from '../../shared/model';
import type { Language } from '../lib/i18n';
import { CardImage } from './CardImage';

// The sheet in small: the page being filled, slot by slot as the printed layout places the cards, and a dot per page.
// The slot a card has just taken pops in (after the card flying from the catalogue lands in it), and a page that
// fills up says so for a moment before the next one starts.
type Props = {
  pages: CatalogCard[][];
  perPage: number;
  columns: number;
  paperRatio: number;
  language: Language;
  mode: 'demo' | 'live';
  children?: ReactNode;
};
const copy: Record<Language, { full: (page: number) => string }> = {
  en: { full: n => `Page ${n} full` },
  it: { full: n => `Pagina ${n} completa` },
  de: { full: n => `Seite ${n} voll` },
  fr: { full: n => `Page ${n} complète` },
  es: { full: n => `Página ${n} completa` },
  pt: { full: n => `Página ${n} completa` },
  nl: { full: n => `Pagina ${n} vol` },
  pl: { full: n => `Strona ${n} pełna` },
};

export function MiniSheet({ pages, perPage, columns, paperRatio, language, mode, children }: Props)
{
  const text = copy[language];
  const total = pages.reduce((sum, page) => sum + page.length, 0);
  const current = Math.max(0, pages.length - 1);
  const page = pages[current] ?? [];
  const previous = useRef(total);
  const [fresh, setFresh] = useState(-1);
  const [done, setDone] = useState(0);
  useEffect(() =>
  {
    const grew = total === previous.current + 1;
    previous.current = total;
    if (!grew)
    {
      setFresh(-1);
      return;
    }
    setFresh(page.length - 1);
    if (page.length === perPage)
    {
      setDone(pages.length);
      const timer = setTimeout(() => setDone(0), 1900);
      return () => clearTimeout(timer);
    }
  }, [total]);
  return (
    <div className={'mini-sheet' + (done ? ' is-done' : '')}>
      <div
        className="mini-page"
        style={{
          gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`,
          gridTemplateRows: `repeat(${Math.max(1, Math.ceil(perPage / columns))},minmax(0,1fr))`,
          aspectRatio: String(paperRatio),
        }}
        aria-hidden="true"
      >
        {Array.from({ length: perPage }, (_, index) =>
        {
          const card = page[index];
          return (
            <span
              key={index}
              className={'mini-slot' + (card ? ' is-filled' : '') + (index === fresh ? ' is-new' : '')
                + (!card && index === page.length ? ' is-next' : '')}
            >
              {card && <CardImage language={language} card={card} mode={mode} thumb />}
            </span>
          );
        })}
      </div>
      <div className="mini-sheet-copy">
        {children}
        <span className="mini-sheet-page" aria-live="polite">{done ? <b>{text.full(done)}</b> : null}</span>
        <span className="mini-sheet-dots" aria-hidden="true">
          {pages.length > 1
            && pages.slice(-8).map((_, index, shown) => (
              <i key={index} className={index === shown.length - 1 ? 'is-current' : ''} />
            ))}
        </span>
      </div>
    </div>
  );
}
