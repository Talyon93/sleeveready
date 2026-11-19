import { ApiRequestError } from '../lib/api';
import { catalogCopy, errorCopy } from '../lib/catalogCopy';
import type { Language } from '../lib/i18n';

export const localeFor = (
  language: Language,
) => ({
  en: 'en-GB',
  it: 'it-IT',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  pt: 'pt-PT',
  nl: 'nl-NL',
  pl: 'pl-PL',
}[language]);
export const releaseLabel = (s: string, language: Language) =>
  new Date(s + 'T12:00:00Z').toLocaleDateString(localeFor(language));
// Catalogue errors are shown by status in the page language; other errors (Supabase sign-in) keep their own message.
export const errorText = (e: unknown, language: Language) =>
{
  const copy = catalogCopy[language];
  const errors = errorCopy[language];
  if (e instanceof ApiRequestError)
  {
    return e.status === 400
      ? errors.invalidRequest
      : e.status === 404
      ? errors.notFound
      : e.status === 429
      ? errors.rateLimited
      : copy.temporarilyUnavailable;
  }
  if (e instanceof TypeError) return copy.temporarilyUnavailable;
  return e instanceof Error && e.message ? e.message : copy.requestFailed;
};
