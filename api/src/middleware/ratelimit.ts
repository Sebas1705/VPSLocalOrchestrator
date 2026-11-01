/**
 * Rate Limiting Middleware
 *
 * Requests with the valid API token share a bucket keyed by that token, sized
 * by RATE_LIMIT_TIER (default "standard"; "unlimited" effectively disables it).
 * Everything else is keyed by client address with the small "free" tier, so
 * guessing the token is throttled no matter how many different values are sent.
 * Keying on the presented value instead would give every guess a fresh bucket.
 *
 * Behind a reverse proxy all unauthenticated clients share the proxy's address
 * (trust proxy is off, so X-Forwarded-For cannot be used to dodge the limit).
 *
 * @module middleware/ratelimit
 */

import type { Request, Response, NextFunction } from 'express';
import { getRateLimiter, RateLimitTiers, type RateLimitConfig } from '../infrastructure/ratelimit/index.js';
import { extractToken, isValidToken } from './auth.js';
import { getLogger } from '../config/index.js';
import { secretFingerprint } from '../infrastructure/logging/redact.js';

const logger = getLogger('ratelimit-middleware');

function authenticatedTier(): RateLimitConfig {
  const tier = process.env.RATE_LIMIT_TIER;
  if (tier && Object.hasOwn(RateLimitTiers, tier)) {
    return RateLimitTiers[tier as keyof typeof RateLimitTiers];
  }
  return RateLimitTiers.standard;
}

/** Liveness probes run on a schedule and must not be turned away. */
function isExempt(req: Request): boolean {
  return (req.method === 'GET' || req.method === 'HEAD') && req.path === '/health';
}

async function applyRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rateLimiter = getRateLimiter();
  const token = extractToken(req.headers.authorization);
  const authenticated = token !== undefined && isValidToken(token);
  const key = authenticated ? token : `ip:${req.ip ?? req.socket.remoteAddress ?? 'unknown'}`;
  const fallback = authenticated ? authenticatedTier() : RateLimitTiers.free;

  let result;
  try {
    result = await rateLimiter.checkLimit(key, fallback);
  } catch (error) {
    logger.error('Rate limit check failed', error as Error);
    next();
    return;
  }

  res.setHeader('X-RateLimit-Limit', rateLimiter.getConfig(key, fallback).maxRequests);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

  if (!result.allowed) {
    if (result.retryAfter !== undefined) {
      res.setHeader('Retry-After', result.retryAfter);
    }

    logger.warn('Rate limit exceeded', {
      client: authenticated ? secretFingerprint(key) : key,
      path: req.path,
      method: req.method,
      retryAfter: result.retryAfter,
    });

    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: result.retryAfter,
      resetAt: new Date(result.resetAt).toISOString(),
    });
    return;
  }

  rateLimiter.incrementConcurrent(key);

  // 'finish' and 'close' both fire on a normal response: release only once.
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      rateLimiter.decrementConcurrent(key);
    }
  };
  res.on('finish', release);
  res.on('close', release);

  next();
}

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isExempt(req)) {
    next();
    return;
  }
  void applyRateLimit(req, res, next);
}

/**
 * Get rate limit stats for current token
 */
export function getRateLimitStats(req: Request): ReturnType<ReturnType<typeof getRateLimiter>['getStats']> | null {
  const token = extractToken(req.headers.authorization);
  if (!token) return null;
  return getRateLimiter().getStats(token);
}
