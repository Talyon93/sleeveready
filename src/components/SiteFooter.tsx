import { legalCopy, legalHref } from '../../shared/legal';
import { isSeoLanguage, seoGames, seoPath, seoUi } from '../../shared/seo';
import { catalogCopy } from '../lib/catalogCopy';
import { type Language, translate } from '../lib/i18n';

// Every game's page on one quiet line, the card data source of the current game, legal links and the affiliate note.
export function SiteFooter(
  { language, source }: { language: Language; source: { label: string; url: string } | undefined },
)
{
  const seoLanguage = isSeoLanguage(language) ? language : 'en';
  return (
    <footer>
      <nav className="footer-games" aria-label={seoUi[seoLanguage].games}>
        {seoGames.map(item => <a key={item.slug} href={seoPath(seoLanguage, item.slug)}>{item.label}</a>)}
      </nav>
      <span>SleeveReady</span>
      <span>{legalCopy[language].unofficial}</span>
      {source && (
        <a href={source.url} target="_blank" rel="noreferrer">{catalogCopy[language].cardData}: {source.label} ↗</a>
      )}
      <a href={legalHref('privacy', language)}>{translate(language, 'privacy')}</a>
      <a href={legalHref('terms', language)}>{translate(language, 'terms')}</a>
      <p className="footer-affiliate">{legalCopy[language].affiliate}</p>
    </footer>
  );
}
