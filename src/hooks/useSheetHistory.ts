import { useEffect, useRef, useState } from 'react';
import type { TrayItem } from '../../shared/model';

/**
 * Undo / redo for the print sheet: each change keeps the previous sheet (up to 50). Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y
 * work outside text fields. Changes that are not the visitor's (restoring the saved sheet, refreshing card images)
 * call `skipNext()` first so they do not become undo steps.
 */
export function useSheetHistory(tray: TrayItem[], setTray: (items: TrayItem[]) => void)
{
  const state = useRef<{ undo: TrayItem[][]; redo: TrayItem[][]; last: TrayItem[] | null; skip: boolean }>({
    undo: [],
    redo: [],
    last: null,
    skip: true,
  });
  // The stacks live in a ref; this counter re-renders the buttons when they change.
  const [, setTick] = useState(0);
  const changed = () => setTick(value => value + 1);

  useEffect(() =>
  {
    const history = state.current;
    if (history.skip)
    {
      history.skip = false;
      history.last = tray;
      return;
    }
    if (history.last && history.last !== tray)
    {
      history.undo.push(history.last);
      if (history.undo.length > 50) history.undo.shift();
      history.redo = [];
      changed();
    }
    history.last = tray;
  }, [tray]);

  function undo()
  {
    const history = state.current;
    const previous = history.undo.pop();
    if (!previous) return;
    history.redo.push(tray);
    history.skip = true;
    setTray(previous);
    changed();
  }
  function redo()
  {
    const history = state.current;
    const next = history.redo.pop();
    if (!next) return;
    history.undo.push(tray);
    history.skip = true;
    setTray(next);
    changed();
  }

  useEffect(() =>
  {
    const onKey = (event: KeyboardEvent) =>
    {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey)
      {
        event.preventDefault();
        undo();
      }
      else if ((key === 'z' && event.shiftKey) || key === 'y')
      {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return {
    undo,
    redo,
    canUndo: state.current.undo.length > 0,
    canRedo: state.current.redo.length > 0,
    /** The next sheet change is not the visitor's: keep it out of the history. */
    skipNext: () =>
    {
      state.current.skip = true;
    },
  };
}
