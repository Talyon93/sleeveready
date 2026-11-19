import type { NextFunction, Request, Response } from 'express';

type Bucket = { startedAt: number; count: number };
type Handler = (req: Request, res: Response, next: NextFunction) => void;

// Behind Cloudflare every request reaches Netlify from a Cloudflare address: the visitor's own is in CF-Connecting-IP.
export const clientAddress = (req: Request) =>
  String(req.get('cf-connecting-ip') ?? '') || req.ip || req.socket.remoteAddress || 'unknown';

const tooMany: Handler = (_req, res) =>
{
  res.status(429).json({ error: 'Too many requests. Try again in a moment.' });
};

/**
 * Fixed-window limit per client address, kept in memory.
 *
 * Trade-off: each serverless instance keeps its own counts and loses them on a cold start, so this bounds a single
 * client hammering one warm instance, not a distributed attack (Cloudflare's rules sit in front for that). It costs
 * nothing and needs no store; a shared limiter (Redis, Netlify Blobs) would be the next step if traffic grows.
 * `overLimit` lets a route degrade instead of failing, e.g. serve the page without its custom preview.
 */
export function rateLimit(limit: number, windowMs: number, overLimit: Handler = tooMany)
{
  const buckets = new Map<string, Bucket>();
  let lastSweep = Date.now();
  return (req: Request, res: Response, next: NextFunction) =>
  {
    const now = Date.now();
    // Drop expired windows now and then so a long-lived instance does not keep every address it has seen.
    if (now - lastSweep > windowMs)
    {
      for (const [key, bucket] of buckets) if (now - bucket.startedAt >= windowMs) buckets.delete(key);
      lastSweep = now;
    }
    const key = clientAddress(req);
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs)
    {
      buckets.set(key, { startedAt: now, count: 1 });
      next();
      return;
    }
    if (bucket.count >= limit)
    {
      res.setHeader('Retry-After', Math.ceil((windowMs - (now - bucket.startedAt)) / 1000));
      overLimit(req, res, next);
      return;
    }
    bucket.count++;
    next();
  };
}
