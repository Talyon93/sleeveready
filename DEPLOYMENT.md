# Deploying SleeveReady

## Supabase

1. Create a Supabase project, enable Email and Google sign-in, and add the local and public URLs to the redirect allow list. In Google Cloud, use the Supabase callback URL shown in Authentication → Providers → Google as the authorized redirect URI.
2. Run every file in `supabase/migrations/` in order, in the SQL Editor or with `supabase db push`.
3. To open the private stats page (`/dev/stats/`), add your user id to `public.stats_admins`.

## Netlify

The repository includes `netlify.toml` and a serverless Express adapter. Connect the repository and keep the detected settings: build command `npm run build`, publish directory `dist`, functions directory `netlify/functions`.

Set these variables before the first deploy:

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | for accounts | Public values, used in the browser |
| `PUBLIC_APP_ORIGIN` | after a custom domain | Defaults to Netlify's `URL` |
| `PUBLIC_PRIVACY_CONTROLLER`, `PUBLIC_PRIVACY_CONTACT_EMAIL` | yes | Shown on the privacy page |
| `CARDTRADER_API_TOKEN` | no | Server only; enables CardTrader price lookups |
| `UPSTREAM_BUDGET_MS` | no | Time budget per upstream call inside functions (default 9000) |
| `VITE_AMAZON_TAG_*`, `VITE_EBAY_CAMPAIGN_ID`, `VITE_TCGPLAYER_PARTNER` | no | Affiliate ids; without them, shop links are plain searches |
| `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN` | no | Lets `deploy-succeeded` purge the Cloudflare cache |

After deployment, add the final domain to Supabase Auth URL Configuration and to Google OAuth Authorized JavaScript origins.

## Cloudflare

Put the domain behind Cloudflare (proxied DNS). The `*.netlify.app` address redirects to the real domain, so crawlers cannot bypass the edge.

## Self-hosting

`npm run build`, then `npm start`: one Node process serves the site and the API on `PORT`. A `Dockerfile` is included.
