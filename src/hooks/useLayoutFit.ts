import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardGame } from '../../shared/model';
import { PHONE_GAME_COUNT, primaryGames } from '../app/games';

/**
 * How many games fit as tabs in the header beside the brand and the account actions; the rest go under "Other".
 * Phones show the first PHONE_GAME_COUNT as icons. Re-measured when the bar resizes or its contents change.
 * The static header (shared/seo-page.ts, fitScript) applies the same rule before the app loads.
 */
// `user` and `language` change the room the account button and the language menu take.
export function useVisibleGameCount(games: CardGame[], user: unknown, language: string)
{
  const [count, setCount] = useState(5);
  useEffect(() =>
  {
    const topbar = document.querySelector<HTMLElement>('.topbar');
    if (!topbar) return;
    const fit = () =>
    {
      if (window.innerWidth <= 760)
      {
        setCount(PHONE_GAME_COUNT);
        return;
      }
      const brand = topbar.querySelector<HTMLElement>('.brand');
      const actions = topbar.querySelector<HTMLElement>('.top-actions');
      const style = getComputedStyle(topbar);
      const available = topbar.clientWidth - (brand?.offsetWidth ?? 0) - (actions?.offsetWidth ?? 0)
        - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - parseFloat(style.columnGap || style.gap) * 2
        - 120;
      const ordered = [
        ...primaryGames
          .map(item =>
          {
            const match = games.find(game => item.pattern.test(game.name + ' ' + game.displayName));
            return match ? { game: match, label: item.label } : null;
          })
          .filter((item): item is { game: CardGame; label: string } => Boolean(item)),
        ...games.filter(game => !primaryGames.some(item => item.pattern.test(game.name + ' ' + game.displayName))).map(
          game => ({ game, label: game.displayName }),
        ),
      ];
      const context = document.createElement('canvas').getContext('2d');
      if (context) context.font = '700 12px system-ui';
      const widths = ordered.map(item =>
        Math.ceil(context?.measureText(item.label).width ?? item.label.length * 7) + 54
      );
      const total = widths.reduce((sum, width) => sum + width + 3, 0);
      if (total <= available)
      {
        setCount(ordered.length);
        return;
      }
      let used = 70;
      let fitting = 0;
      for (const width of widths)
      {
        if (used + width + 3 > available) break;
        used += width + 3;
        fitting++;
      }
      setCount(Math.max(1, fitting));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(topbar);
    return () => observer.disconnect();
  }, [games, user, language]);
  return count;
}

/**
 * Expansion tabs stay on one line: as many as fit at a readable width (2–4), the rest under "more". Phones scroll,
 * so they keep four. Returns the count and a ref callback for the tabs' container.
 */
export function useTabSlots()
{
  const [slots, setSlots] = useState(4);
  const observer = useRef<ResizeObserver | null>(null);
  const measure = useCallback((element: HTMLDivElement | null) =>
  {
    observer.current?.disconnect();
    if (!element || typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(([entry]) =>
    {
      const width = entry.contentRect.width;
      setSlots(matchMedia('(max-width:760px)').matches ? 4 : Math.max(2, Math.min(4, Math.floor((width - 136) / 162))));
    });
    observer.current.observe(element);
  }, []);
  return { slots, measure };
}
