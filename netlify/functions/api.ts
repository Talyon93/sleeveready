import serverless from 'serverless-http';
import { connectLambda } from '@netlify/blobs';
import { createApp } from '../../server/app.ts';
import { registerSitePages } from '../../server/site-pages.ts';

// PUBLIC_APP_ORIGIN may list several origins (comma separated); the first is canonical. Netlify's primary URL is always
// accepted too, so adding or switching a custom domain never locks the site out before the variable is updated.
const appOrigins = [
  ...new Set(
    [...(process.env.PUBLIC_APP_ORIGIN ?? '').split(','), process.env.URL ?? '']
      .map(origin => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  ),
];
const siteOrigin = appOrigins[0];
if (!siteOrigin) throw new Error('Netlify site origin is unavailable.');

const app = createApp({
  token: process.env.CARDTRADER_API_TOKEN?.trim(),
  development: false,
  appOrigins,
  supabaseUrl: process.env.VITE_SUPABASE_URL?.trim(),
});
registerSitePages(app, {
  siteOrigin,
  privacyController: process.env.PUBLIC_PRIVACY_CONTROLLER,
  privacyEmail: process.env.PUBLIC_PRIVACY_CONTACT_EMAIL,
});

// Images, PDFs and fonts must go back to Netlify base64-encoded: by default serverless-http only treats compressed
// responses as binary, and sent the proxied card images as text, corrupting every byte above 0x7f.
const serve = serverless(app, { binary: ['image/*', 'application/pdf', 'application/octet-stream', 'font/*'] });
// Lambda-style functions get their Netlify Blobs context (the card index) from each invocation's event.
export const handler = async (
  event: Parameters<typeof serve>[0] & { blobs?: string },
  context: Parameters<typeof serve>[1],
) =>
{
  if (event.blobs) connectLambda(event as Parameters<typeof connectLambda>[0]);
  return serve(event, context);
};
