// Name search across every expansion of the selected game, shown under the catalogue search while the visitor types.
// Each result is a card name with the expansions that print it; a printing opens that card's page.
import { useEffect, useState } from 'react';
import type { Envelope } from '../../shared/model';
import { cardPath, type SeoGameSlug, type SeoLanguage } from '../../shared/seo';
import { api } from '../lib/api';

type Printing = { set: string; setName: string; slug: string; number: string | null; count: number };
type SearchData = { query: string; total: number; results: { name: string; printings: Printing[]; more: number }[] };
export type GlobalSearchLabels = {
  title: string;
  searching: string;
  none: string;
  error: string;
  more: (count: number) => string;
};
type Props = {
  game: SeoGameSlug | undefined;
  seoLanguage: SeoLanguage;
  query: string;
  labels: GlobalSearchLabels;
  currentSet: string | null;
  openInCurrentSet: (slug: string) => boolean;
};
const COLLAPSED = 5;

export function GlobalSearch({ game, seoLanguage, query, labels, currentSet, openInCurrentSet }: Props)
{
  const trimmed = query.trim();
  const key = game && trimmed.length >= 2 ? `${game}|${trimmed.toLowerCase()}` : '';
  const [state, setState] = useState<{ key: string; data: SearchData | null }>({ key: '', data: null });
  const [expanded, setExpanded] = useState<string>('');
  // Waits for a pause in typing, and drops the answer to a query the visitor already changed.
  useEffect(() =>
  {
    if (!key || !game) return;
    const controller = new AbortController();
    const timer = setTimeout(() =>
    {
      api<Envelope<SearchData>>(
        `search?game=${encodeURIComponent(game)}&q=${encodeURIComponent(trimmed)}`,
        controller.signal,
      )
        .then(result => setState({ key, data: Array.isArray(result.data?.results) ? result.data : null }))
        .catch(() =>
        {
          if (!controller.signal.aborted) setState({ key, data: null });
        });
    }, 250);
    return () =>
    {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, game, trimmed]);
  if (!key || !game) return null;
  const ready = state.key === key;
  const data = ready ? state.data : null;
  const open = expanded === key;
  const results = data ? (open ? data.results : data.results.slice(0, COLLAPSED)) : [];
  return (
    <section className="global-search" aria-labelledby="global-search-title" aria-busy={!ready}>
      <h3 id="global-search-title">{labels.title}</h3>
      {!ready
        ? <p className="global-search-status" role="status">{labels.searching}</p>
        : !data
        ? <p className="global-search-status" role="status">{labels.error}</p>
        : !data.total
        ? <p className="global-search-status" role="status">{labels.none}</p>
        : (
          <ul>
            {results.map(result => (
              <li key={result.name}>
                <span className="global-search-name">{result.name}</span>
                <span className="global-search-printings">
                  {result.printings.map(printing => (
                    <a
                      key={printing.set + '/' + printing.slug}
                      href={cardPath(seoLanguage, game, printing.set, printing.slug)}
                      onClick={event =>
                      {
                        if (printing.set === currentSet && openInCurrentSet(printing.slug)) event.preventDefault();
                      }}
                    >
                      {printing.setName}
                      {printing.number && <span className="cp-num"> · {printing.number}</span>}
                      {printing.count > 1 && <span className="cp-num"> +{printing.count - 1}</span>}
                    </a>
                  ))}
                  {result.more > 0 && <span className="global-search-extra">+{result.more}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      {data && data.results.length > COLLAPSED && !open && (
        <button type="button" className="global-search-expand" onClick={() => setExpanded(key)}>
          {labels.more(data.total)}
        </button>
      )}
    </section>
  );
}
