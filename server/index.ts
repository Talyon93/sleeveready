import path from 'node:path';
import express from 'express';
import { createApp } from './app.ts';
import { registerSitePages } from './site-pages.ts';
const production = process.argv.includes('--production');
// Comma separated origins are accepted; the first is canonical.
const configuredOrigins = (process.env.PUBLIC_APP_ORIGIN ?? '')
  .split(',')
  .map(origin => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const configuredOrigin = configuredOrigins[0];
const privacyController = process.env.PUBLIC_PRIVACY_CONTROLLER?.trim();
const privacyEmail = process.env.PUBLIC_PRIVACY_CONTACT_EMAIL?.trim();
if (production && !configuredOrigin) throw new Error('PUBLIC_APP_ORIGIN è obbligatorio in produzione.');
if (production && (!privacyController || !privacyEmail))
{
  throw new Error('PUBLIC_PRIVACY_CONTROLLER e PUBLIC_PRIVACY_CONTACT_EMAIL sono obbligatori in produzione.');
}
const app = createApp({
  token: process.env.CARDTRADER_API_TOKEN?.trim(),
  development: !production,
  appOrigins: configuredOrigins.length ? configuredOrigins : undefined,
  supabaseUrl: process.env.VITE_SUPABASE_URL,
});
const siteOrigin = configuredOrigin ?? 'http://127.0.0.1:' + String(process.env.PORT ?? 3000);
registerSitePages(app, { siteOrigin, privacyController, privacyEmail });
if (production)
{
  app.get('/', (_req, res) => res.redirect(301, '/en/'));
  app.use(express.static(path.resolve('dist')));
  app.get('/{*path}', (_req, res) => res.status(404).sendFile(path.resolve('dist/404.html')));
}
else
{
  const { createServer } = await import('vite');
  const vite = await createServer({ configLoader: 'runner', server: { middlewareMode: true }, appType: 'mpa' });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT ?? 3000);
app.listen(
  port,
  production ? '0.0.0.0' : '127.0.0.1',
  () =>
    console.log(
      `SleeveReady: ${configuredOrigin ?? `http://127.0.0.1:${port}`} (${production ? 'production' : 'development'})`,
    ),
);
