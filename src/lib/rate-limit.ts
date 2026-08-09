/**
 * In-memory, per-key rate limiting for public POST endpoints. State lives in
 * function memory, so it resets on a cold start and isn't shared across
 * concurrent instances — acceptable for a low-traffic site with no existing
 * shared store; it still stops the common case of one bad actor hammering an
 * endpoint from a single connection.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodic sweep so `buckets` doesn't grow unbounded on a long-lived warm
// function instance.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return { allowed, retryAfterSeconds: allowed ? 0 : Math.ceil((bucket.resetAt - now) / 1000) };
}
