// In-memory cache per function instance. When full it drops the least recently used entry, so the expansion lists
// every page needs stay while one-off entries (a card's printings, rulings) come and go.
export class Cache
{
  private values = new Map<string, { value: unknown; expires: number; updatedAt: string }>();
  private pending = new Map<string, Promise<{ data: unknown; updatedAt: string }>>();
  // The build that writes the card pages keeps far more (CACHE_MAX_ENTRIES): whole expansions at a time.
  constructor(private now = Date.now, private maxEntries = Number(process.env.CACHE_MAX_ENTRIES) || 400)
  {}
  // Stores a value loaded some other way (a whole expansion in one request, for the card pages the build writes).
  set<T>(key: string, ttl: number, value: T)
  {
    if (this.values.size >= this.maxEntries && !this.values.has(key))
    {
      this.values.delete(this.values.keys().next().value!);
    }
    this.values.set(key, { value, expires: this.now() + ttl, updatedAt: new Date(this.now()).toISOString() });
  }
  async get<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<{ data: T; updatedAt: string }>
  {
    const hit = this.values.get(key);
    if (hit && hit.expires > this.now())
    {
      this.values.delete(key);
      this.values.set(key, hit);
      return { data: hit.value as T, updatedAt: hit.updatedAt };
    }
    const inflight = this.pending.get(key);
    if (inflight) return inflight as Promise<{ data: T; updatedAt: string }>;
    const task = loader()
      .then(data =>
      {
        const updatedAt = new Date(this.now()).toISOString();
        if (this.values.size >= this.maxEntries) this.values.delete(this.values.keys().next().value!);
        this.values.set(key, { value: data, expires: this.now() + ttl, updatedAt });
        return { data, updatedAt };
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, task);
    return task;
  }
}
export class Queue
{
  private tail: Promise<unknown> = Promise.resolve();
  private next = 0;
  private count = 0;
  constructor(private gap = 1050)
  {}
  run<T>(fn: () => Promise<T>): Promise<T>
  {
    if (this.count >= 100) return Promise.reject(new Error('Queue full. Try again shortly.'));
    this.count++;
    const task = this.tail.then(async () =>
    {
      await new Promise(r => setTimeout(r, Math.max(0, this.next - Date.now())));
      try
      {
        return await fn();
      }
      finally
      {
        this.next = Date.now() + this.gap;
      }
    });
    this.tail = task
      .catch(() =>
      {})
      .finally(() =>
      {
        this.count--;
      });
    return task;
  }
}
