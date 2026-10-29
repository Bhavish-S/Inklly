import { createHmac } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { DatabaseService } from '@inklly/db';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PublicUploadRateLimitOptions {
  perMinute?: number;
  perDay?: number;
  key?: string;
  now?: () => number;
}

function boundedLimit(value: number | undefined, fallback: number, max: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(max, Math.floor(value!))) : fallback;
}

/**
 * Applies shared, database-backed IP limits before large upload bodies are parsed.
 * Atomic upserts make the counter consistent across multiple API processes.
 */
export function createPublicUploadRateLimit(db: DatabaseService, options: PublicUploadRateLimitOptions = {}) {
  const perMinute = boundedLimit(options.perMinute ?? Number(process.env.PUBLIC_UPLOADS_PER_MINUTE), 30, 120);
  const perDay = boundedLimit(options.perDay ?? Number(process.env.PUBLIC_UPLOADS_PER_DAY), 1_000, 10_000);
  const key = options.key || process.env.JWT_SECRET || 'inklly-development-upload-rate-limit';
  const nowFn = options.now || Date.now;
  let operations = 0;

  const increment = (bucketKey: string, windowStart: number, expiresAt: number): number => {
    const row = db.queryOne<{ request_count: number | string }>(
      `INSERT INTO public_upload_rate_limits (bucket_key, window_start_ms, request_count, expires_at_ms)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(bucket_key, window_start_ms) DO UPDATE SET
         request_count = public_upload_rate_limits.request_count + 1,
         expires_at_ms = excluded.expires_at_ms
       RETURNING request_count`,
      [bucketKey, windowStart, expiresAt]
    );
    if (!row) throw new Error('Upload rate-limit counter did not return a value.');
    return Number(row.request_count);
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    const address = req.ip || req.socket.remoteAddress || 'unknown';
    const now = nowFn();
    const minuteStart = Math.floor(now / MINUTE_MS) * MINUTE_MS;
    const dayStart = Math.floor(now / DAY_MS) * DAY_MS;
    const clientKey = createHmac('sha256', key).update(address).digest('hex');
    try {
      const minuteCount = increment(`m:${clientKey}`, minuteStart, minuteStart + MINUTE_MS);
      if (minuteCount > perMinute) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((minuteStart + MINUTE_MS - now) / 1000))));
        res.status(429).json({
          code: 'PUBLIC_UPLOAD_RATE_LIMIT',
          error: 'Upload limit reached. Please wait before uploading another document.',
        });
        return;
      }

      const dayCount = increment(`d:${clientKey}`, dayStart, dayStart + DAY_MS);
      operations += 1;
      if (operations % 128 === 0) db.execute(`DELETE FROM public_upload_rate_limits WHERE expires_at_ms <= ?`, [now]);

      if (dayCount > perDay) {
        const retryMs = dayStart + DAY_MS - now;
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryMs / 1000))));
        res.status(429).json({
          code: 'PUBLIC_UPLOAD_RATE_LIMIT',
          error: 'Upload limit reached. Please wait before uploading another document.',
        });
        return;
      }
      next();
    } catch {
      // If the shared limiter cannot account for a request, fail closed before
      // accepting a potentially large public upload body.
      res.status(503).json({
        code: 'PUBLIC_UPLOAD_RATE_LIMIT_UNAVAILABLE',
        error: 'Uploads are temporarily unavailable. Please retry shortly.',
      });
    }
  };
}
