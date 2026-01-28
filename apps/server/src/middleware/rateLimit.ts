import { Elysia } from 'elysia';
import { redisHelpers } from '../config/redis';
import { env } from '../config/env';
import { AppError } from './errorHandler';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

function getClientIP(request: Request, headers: Record<string, string | null>): string {
  // Check various headers for the real IP
  const forwardedFor = headers['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }

  // Fallback to a default
  return '127.0.0.1';
}

export function createRateLimiter(config: RateLimitConfig) {
  return new Elysia({ name: `rate-limiter-${config.keyPrefix || 'default'}` })
    .derive(({ request, headers }) => {
      return {
        clientIP: getClientIP(request, headers as Record<string, string | null>),
      };
    })
    .onBeforeHandle(async ({ clientIP, set }) => {
      const key = `ratelimit:${config.keyPrefix || 'api'}:${clientIP}`;
      const windowSec = Math.ceil(config.windowMs / 1000);

      const allowed = await redisHelpers.checkRateLimit(key, config.maxRequests, windowSec);

      if (!allowed) {
        set.headers = {
          'Retry-After': String(windowSec),
          'X-RateLimit-Limit': String(config.maxRequests),
          'X-RateLimit-Remaining': '0',
        };
        throw AppError.tooManyRequests();
      }
    });
}

// Default rate limiter for general API requests
export const rateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  keyPrefix: 'api',
});

// Stricter rate limiter for auth endpoints
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  keyPrefix: 'auth',
});

// Rate limiter for uploads
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,
  keyPrefix: 'upload',
});

// Rate limiter for room creation
export const roomCreateRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 20,
  keyPrefix: 'room-create',
});
