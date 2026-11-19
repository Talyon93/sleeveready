/*
THESIS: SleeveReady feels like the table before game night, not a generic catalogue.
OWN-WORLD: charcoal playmat, cream card stock, game-colour tape and playful stamped labels.
STORY: choose a game, find a card, build a sheet, then print it for play.
FIRST VIEWPORT: the action statement sits above the binder tabs; the catalog and Print Tray are visible together.
FORM: established binder world, extended as an editorial playmat rather than a dashboard.
*/

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { startAnalytics } from './lib/analytics';
import './style.css';
import './home.css';
import './catalog-shell.css';
import './mini-sheet.css';
import './ads.css';
import './shared-arrival.css';
import './print-panel.css';

startAnalytics();
// The app runs: a later stale page may reload once again (shared/seo-page.ts, staleReload).
try
{
  sessionStorage.removeItem('sr-stale');
}
catch
{
  /* Storage unavailable. */
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
