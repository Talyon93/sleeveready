// Runs after every successful deploy: empties Cloudflare's cache, so cached pages never point at the scripts of an
// older build. Does nothing until CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN (a token with Cache Purge only) are set.
export default async () =>
{
  const zone = process.env.CLOUDFLARE_ZONE_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!zone || !token)
  {
    console.log('Cloudflare purge: not configured.');
    return new Response('skipped');
  }
  try
  {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone)}/purge_cache`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ purge_everything: true }),
      signal: AbortSignal.timeout(8000),
    });
    console.log(`Cloudflare purge: ${response.status}`);
    return new Response(response.ok ? 'purged' : 'failed');
  }
  catch (error)
  {
    console.error('Cloudflare purge failed:', error instanceof Error ? error.message : error);
    return new Response('failed');
  }
};
