import { RequestHandler } from 'express';

/**
 * Bounds the number of public upload bodies being parsed and inspected in this
 * Node process. Mount before express.json() so rejected requests do not first
 * allocate their decoded request body.
 */
export function createUploadConcurrencyGuard(maxConcurrent = 2, capacityCode = 'UPLOAD_CAPACITY'): RequestHandler {
  const limit = Math.max(1, Math.min(8, Math.floor(maxConcurrent) || 2));
  let inFlight = 0;

  return (_req, res, next) => {
    if (inFlight >= limit) {
      res.setHeader('Retry-After', '2');
      res.status(429).json({
        code: capacityCode,
        error: 'Uploads are busy. Retry in a moment.',
      });
      return;
    }

    inFlight += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      inFlight = Math.max(0, inFlight - 1);
      res.off('finish', release);
      res.off('close', release);
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  };
}

export function createPublicUploadConcurrencyGuard(maxConcurrent = 2): RequestHandler {
  return createUploadConcurrencyGuard(maxConcurrent, 'PUBLIC_UPLOAD_CAPACITY');
}
