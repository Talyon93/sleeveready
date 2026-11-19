import type { ReactNode } from 'react';
import { isSeoLanguage, seoPath } from '../../shared/seo';
import { catalogCopy } from '../lib/catalogCopy';
import { languages, type Language, translate } from '../lib/i18n';

// The dark top bar: the brand (home), the game tabs passed as children, the language menu and the account button.
export function SiteHeader(
  { language, accountLabel, onLanguage, onAccount, children }: {
    language: Language;
    /** The signed-in user's name, or null for the "Account" label. */
    accountLabel: string | null;
    onLanguage: (language: Language) => void;
    onAccount: () => void;
    children: ReactNode;
  },
)
{
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  return (
    <header className="topbar">
      <a
        className="brand"
        href={seoPath(isSeoLanguage(language) ? language : 'en')}
        aria-label={catalogCopy[language].home}
      >
        <img className="brand-icon" src="/favicon.svg" alt="" />Sleeve<span>Ready</span>
      </a>
      {children}
      <div className="top-actions">
        <label className="language-select">
          <span className="sr-only">{t('language')}</span>
          <span className="language-code" aria-hidden="true">{language.toUpperCase()}</span>
          <select
            aria-label={t('language')}
            value={language}
            onChange={event => onLanguage(event.target.value as Language)}
          >
            {languages.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
          </select>
        </label>
        <button className="account-button" onClick={onAccount}>
          {accountLabel ?? t('account')}
        </button>
      </div>
    </header>
  );
}
