// Server messages are written for logs; the client shows a translated message chosen from the status.
export class ApiRequestError extends Error
{
  constructor(message: string, readonly status: number)
  {
    super(message);
    this.name = 'ApiRequestError';
  }
}
export async function api<T>(path: string, signal?: AbortSignal, init?: RequestInit): Promise<T>
{
  const r = await fetch('/api/catalog/' + path, { ...init, signal });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiRequestError(data.error ?? 'Request failed.', r.status);
  return data;
}
