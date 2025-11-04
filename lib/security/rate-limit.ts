/**
 * Simple in-memory rate limiter
 * For production, consider using Redis-based rate limiting with @upstash/ratelimit
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export async function rateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 }
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetTime < now) {
    // Create new entry
    const resetTime = now + config.windowMs;
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime,
    });
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: resetTime,
    };
  }

  // Increment count
  entry.count++;

  if (entry.count > config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    reset: entry.resetTime,
  };
}

// Different rate limit configs for different endpoints
export const RATE_LIMIT_CONFIGS = {
  createPayment: { maxRequests: 5, windowMs: 60000 }, // 5 requests per minute
  voucherUse: { maxRequests: 3, windowMs: 60000 }, // 3 requests per minute
  testEmail: { maxRequests: 2, windowMs: 60000 }, // 2 requests per minute
  cleanupExpired: { maxRequests: 10, windowMs: 60000 }, // 10 requests per minute
  default: { maxRequests: 20, windowMs: 60000 }, // 20 requests per minute
};