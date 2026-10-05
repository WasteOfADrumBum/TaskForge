import { createHash } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { MemoryStore, rateLimit } from 'express-rate-limit';

const MINUTE = 60_000;
type TimingOptions = {
  loginAccountWindowMs?: number;
  registerAccountWindowMs?: number;
  loginCapacityWindowMs?: number;
  registerCapacityWindowMs?: number;
};

// Render's exact forwarded-header trust boundary is not established. Account keys
// never use IP/proxy headers, and the first limiter bounds rotating-account traffic.
const accountKey = (req: Request): string => {
  const body: unknown = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'invalid-account';
  const email = (body as Record<string, unknown>).email;
  if (typeof email !== 'string') return 'invalid-account';
  const normalized = email.trim().toLowerCase();
  if (
    normalized.length > 254 ||
    [...normalized].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    return 'invalid-account';
  }
  return createHash('sha256').update(normalized).digest('hex');
};

// Each factory owns independent stores: no cross-endpoint counters or test bypass.
// MemoryStore resets at restart and is not shared across service instances.
export const createAuthRateLimiters = (timings: TimingOptions = {}) => {
  const stores: MemoryStore[] = [];
  const make = (
    identifier: string,
    windowMs: number,
    limit: number,
    keyGenerator: (req: Request) => string,
    skipSuccessfulRequests = false,
  ): RequestHandler => {
    const store = new MemoryStore();
    stores.push(store);
    return rateLimit({
      identifier,
      windowMs,
      limit,
      store,
      keyGenerator,
      skipSuccessfulRequests,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (req, res) => {
        const info = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit;
        const resetTime = info?.resetTime?.getTime() ?? Date.now() + windowMs;
        const retrySeconds = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
        res.set('Retry-After', String(retrySeconds));
        res.set('Cache-Control', 'no-store');
        res.status(429).json({
          message: `Too many authentication attempts. Try again in ${retrySeconds} seconds.`,
        });
      },
    });
  };

  return {
    login: [
      make('login-capacity', timings.loginCapacityWindowMs ?? MINUTE, 120, () => 'capacity'),
      make('login-account', timings.loginAccountWindowMs ?? 15 * MINUTE, 10, accountKey, true),
    ],
    register: [
      make(
        'register-capacity',
        timings.registerCapacityWindowMs ?? 15 * MINUTE,
        20,
        () => 'capacity',
      ),
      make('register-account', timings.registerAccountWindowMs ?? 60 * MINUTE, 5, accountKey),
    ],
    shutdown: () => stores.forEach((store) => store.shutdown()),
  };
};
