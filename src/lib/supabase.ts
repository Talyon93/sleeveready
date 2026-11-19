import type { SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const url = env?.VITE_SUPABASE_URL?.trim();
const key = env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

/** False keeps the public catalogue usable until the owner enables accounts. */
export const accountsEnabled = Boolean(url && key);

// The client (about 140 KB) loads only when something needs it: a stored session, a sign-in, a counted visit.
// Crawlers that run scripts never touch any of those, so they never download it.
let client: Promise<SupabaseClient | null> | undefined;
export function loadSupabase(): Promise<SupabaseClient | null>
{
  return client ??= url && key
    ? import('@supabase/supabase-js').then(
      ({ createClient }) =>
        createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }),
      () =>
      {
        client = undefined;
        return null;
      },
    )
    : Promise.resolve(null);
}

/** A session saved on this device, or a sign-in coming back in the address (magic link, Google). */
export function authPending()
{
  if (!accountsEnabled || typeof window === 'undefined') return false;
  if (/[#&?](access_token|refresh_token|error_description)=|[?&]code=/.test(location.hash + location.search))
  {
    return true;
  }
  try
  {
    for (let index = 0; index < localStorage.length; index++)
    {
      const name = localStorage.key(index) ?? '';
      if (name.startsWith('sb-') && name.endsWith('-auth-token')) return true;
    }
  }
  catch
  {
    /* Storage unavailable: no saved session. */
  }
  return false;
}

/** Public reads without the client: one REST call with the publishable key. */
export async function publicSelect<T>(table: string, query: string): Promise<T[] | null>
{
  if (!url || !key) return null;
  try
  {
    const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return response.ok ? await response.json() as T[] : null;
  }
  catch
  {
    return null;
  }
}
