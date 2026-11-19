import type { User } from '@supabase/supabase-js';
import type { RefObject } from 'react';
import { legalCopy, legalHref } from '../../shared/legal';
import type { CardGame, Status } from '../../shared/model';
import { gameIcon } from '../app/games';
import type { SavedDeck } from '../lib/decks';
import { favoritesCopy } from '../lib/favoritesCopy';
import { type Language, translate } from '../lib/i18n';
import type { PrintRecord } from '../lib/printHistory';
import { printHistoryCopy } from '../lib/printHistoryCopy';
import { accountsEnabled } from '../lib/supabase';
import { PrintHistory } from './PrintHistory';

type Props = {
  dialogRef: RefObject<HTMLDialogElement | null>;
  theme: string;
  language: Language;
  mode: Status['mode'];
  user: User | null;
  onClose: () => void;
  /** Signing in: Google, or a link sent by email. */
  auth: {
    email: string;
    setEmail: (email: string) => void;
    busy: boolean;
    message: string;
    sendMagicLink: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
  };
  /** The prints of this device, or of the account once signed in. */
  prints: { records: PrintRecord[]; onReprint: (record: PrintRecord) => void; onRemove: (record: PrintRecord) => void };
  /** Favourite games, first in the header (signed in only). */
  favorites: { games: CardGame[]; selected: number[]; busy: boolean; error: string; toggle: (id: number) => void };
  /** Lists saved to the account. */
  lists: {
    decks: SavedDeck[];
    busy: boolean;
    refresh: () => void;
    load: (deck: SavedDeck) => void;
    remove: (deck: SavedDeck) => void;
  };
};

// The account dialog: sign in (or the setup note when accounts are off), then favourite games, prints and saved lists.
export function AccountDialog(
  { dialogRef, theme, language, mode, user, onClose, auth, prints, favorites, lists }: Props,
)
{
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const phc = printHistoryCopy[language];
  const history = (
    <PrintHistory
      records={prints.records}
      language={language}
      mode={mode}
      onReprint={prints.onReprint}
      onRemove={prints.onRemove}
    />
  );
  return (
    <dialog ref={dialogRef} data-game={theme} onCancel={onClose} onClose={onClose} className="account-dialog">
      <div className="dialog-top">
        <div>
          <p className="section-kicker">{t('accountKicker')}</p>
          <h2>{user ? t('myLists') : t('saveLists')}</h2>
        </div>
        <button className="close" aria-label={t('closeAccount')} onClick={onClose}>×</button>
      </div>
      {!accountsEnabled
        ? (
          <div className="empty">
            <h3>{t('accountSetup')}</h3>
            <p>{t('accountSetupBody')}</p>
          </div>
        )
        : !user
        ? (
          <>
            <form
              className="auth-form"
              onSubmit={e =>
              {
                e.preventDefault();
                void auth.sendMagicLink();
              }}
            >
              <p>{t('authIntro')}</p>
              <button
                className="google-auth-button"
                type="button"
                disabled={auth.busy}
                onClick={() => void auth.signInWithGoogle()}
              >
                <img src="/google-g.svg" alt="" />
                {auth.busy ? t('connecting') : t('continueGoogle')}
              </button>
              <div className="auth-divider">
                <span>{t('or')}</span>
              </div>
              <label>
                Email<input
                  required
                  type="email"
                  autoComplete="email"
                  value={auth.email}
                  onChange={e => auth.setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <button className="primary" disabled={auth.busy}>{auth.busy ? t('sending') : t('sendEmailLink')}</button>
              {auth.message && <p role="status">{auth.message}</p>}
              <p className="auth-legal">
                {legalCopy[language].accountNote}{' '}
                <a href={legalHref('privacy', language)} target="_blank" rel="noreferrer">{t('privacy')}</a>
              </p>
            </form>
            {prints.records.length > 0 && (
              <section className="print-history-section">
                <h3>{phc.title}</h3>
                <p>{phc.onDevice}</p>
                {history}
              </section>
            )}
          </>
        )
        : (
          <div className="saved-decks">
            <p className="signed-in">
              {t('signedInAs')} <strong>{user.email}</strong>
            </p>
            <section className="favorite-games" aria-labelledby="favorite-games-title">
              <h3 id="favorite-games-title">{favoritesCopy[language].title}</h3>
              <p>{favoritesCopy[language].hint}</p>
              <div className="favorite-games-list">
                {favorites.games.map(item =>
                {
                  const position = favorites.selected.indexOf(item.id);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      aria-pressed={position >= 0}
                      disabled={favorites.busy || (position < 0 && favorites.selected.length >= 5)}
                      onClick={() => favorites.toggle(item.id)}
                    >
                      {position >= 0 && <b>{position + 1}</b>}
                      <span className={'game-mark ' + gameIcon(item.name)} aria-hidden="true" />
                      {item.displayName}
                    </button>
                  );
                })}
              </div>
              {favorites.busy && <small role="status">{favoritesCopy[language].saving}</small>}
              {favorites.error && <small role="alert">{favorites.error}</small>}
            </section>
            <section className="print-history-section">
              <h3>{phc.title}</h3>
              {history}
            </section>
            <button className="secondary" disabled={lists.busy} onClick={lists.refresh}>
              {t('refreshLists')}
            </button>
            {lists.busy ? <p role="status">{t('loadingLists')}</p> : lists.decks.length === 0
              ? (
                <div className="empty">
                  <p>
                    {t('noSavedLists')}
                    <br />
                    {t('prepareAndSave')}
                  </p>
                </div>
              )
              : (
                <ul>
                  {lists.decks.map(deck => (
                    <li key={deck.id}>
                      <div>
                        <strong>{deck.name}</strong>
                        <small>
                          {deck.gameName ?? t('gameNotSpecified')} ·{' '}
                          {deck.items.reduce((sum, item) => sum + item.quantity, 0)} {t('copies')}
                        </small>
                      </div>
                      <div>
                        <button onClick={() => lists.load(deck)}>{t('load')}</button>
                        <button className="danger-link" onClick={() => lists.remove(deck)}>{t('delete')}</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            <button className="text-button" onClick={() => void auth.signOut()}>{t('signOut')}</button>
          </div>
        )}
    </dialog>
  );
}
