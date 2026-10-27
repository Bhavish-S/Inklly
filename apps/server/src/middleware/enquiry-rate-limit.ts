import { NextFunction, Request, Response } from 'express';

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

export function createEnquiryRateLimit(limit = Number(process.env.PUBLIC_ENQUIRY_LIMIT_PER_WINDOW) || 5, windowMs = Number(process.env.PUBLIC_ENQUIRY_WINDOW_MS) || 10 * 60 * 1000) {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const safeWindowMs = Math.max(60_000, Math.min(60 * 60 * 1000, Math.floor(windowMs)));

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + safeWindowMs };
      buckets.set(key, bucket);
    }
    if (bucket.count >= safeLimit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      res.status(429).json({ error: 'Too many enquiries were submitted. Please wait and try again.' });
      return;
    }
    bucket.count += 1;

    // Bound stale keys on long-lived service instances.
    if (buckets.size > 2_000) {
      for (const [address, entry] of buckets) if (entry.resetAt <= now) buckets.delete(address);
    }
    next();
  };
}

export function resetEnquiryRateLimitForTests(): void {
  buckets.clear();
}
