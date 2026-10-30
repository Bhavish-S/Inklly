import { createHmac } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { DatabaseService } from '@inklly/db';

export interface EnquiryRateLimitOptions {
  limit?: number;
  windowMs?: number;
  key?: string;
  now?: () => number;
}

/**
 * Applies a shared fixed-window IP limit to public enquiries. Only an HMAC of
 * the source address is persisted, and the atomic upsert is shared by API
 * processes using the same database.
 */
export function createEnquiryRateLimit(db: DatabaseService, options: EnquiryRateLimitOptions = {}) {
  const configuredLimit = options.limit ?? Number(process.env.PUBLIC_ENQUIRY_LIMIT_PER_WINDOW);
  const configuredWindow = options.windowMs ?? Number(process.env.PUBLIC_ENQUIRY_WINDOW_MS);
  const limit = Number.isFinite(configuredLimit) ? Math.max(1, Math.min(50, Math.floor(configuredLimit))) : 5;
  const windowMs = Number.isFinite(configuredWindow) ? Math.max(60_000, Math.min(60 * 60 * 1000, Math.floor(configuredWindow))) : 10 * 60 * 1000;
  const key = options.key || process.env.JWT_SECRET || 'inklly-development-enquiry-rate-limit';
  const nowFn = options.now || Date.now;
  let operations = 0;

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = nowFn();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const expiresAt = windowStart + windowMs;
    const address = req.ip || req.socket.remoteAddress || 'unknown';
    const clientKey = createHmac('sha256', key).update(address).digest('hex');
    try {
      const row = db.queryOne<{ request_count: number | string }>(
        `INSERT INTO public_upload_rate_limits (bucket_key, window_start_ms, request_count, expires_at_ms)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(bucket_key, window_start_ms) DO UPDATE SET
           request_count = public_upload_rate_limits.request_count + 1,
           expires_at_ms = excluded.expires_at_ms
         RETURNING request_count`,
        [`e:${clientKey}`, windowStart, expiresAt]
      );
      if (!row) throw new Error('Enquiry rate-limit counter did not return a value.');
      operations += 1;
      if (operations % 128 === 0) db.execute(`DELETE FROM public_upload_rate_limits WHERE expires_at_ms <= ?`, [now]);
      if (Number(row.request_count) > limit) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((expiresAt - now) / 1000))));
        res.status(429).json({ error: 'Too many enquiries were submitted. Please wait and try again.' });
        return;
      }
      next();
    } catch {
      // Do not accept enquiry payloads when the shared anti-abuse counter is
      // unavailable; process-local fallback would diverge across instances.
      res.status(503).json({ error: 'Enquiry submission is temporarily unavailable. Please retry shortly.' });
    }
  };
}
