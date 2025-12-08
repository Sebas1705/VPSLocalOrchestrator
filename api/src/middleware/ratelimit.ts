/**
 * Rate Limiting Middleware
 * 
 * Applies rate limits per API token
 * Tracks concurrent requests
 * Adds rate limit headers to responses
 * 
 * @module middleware/ratelimit
 */

import type { Request, Response, NextFunction } from 'express';
import { getRateLimiter } from '../infrastructure/ratelimit/index.js';
import { extractToken } from './auth.js';
import { getLogger } from '../config/index.js';

const logger = getLogger('ratelimit-middleware');
const rateLimiter = getRateLimiter();

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract token from request
  const authHeader = req.headers.authorization;
  const token = extractToken(authHeader);

  // If no token, skip rate limiting (will be handled by auth middleware)
  if (!token) {
    return next();
  }

  // Check rate limit
  rateLimiter
    .checkLimit(token)
    .then((result) => {
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', rateLimiter.getConfig(token).maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

      if (!result.allowed) {
        // Rate limit exceeded
        if (result.retryAfter !== undefined) {
          res.setHeader('Retry-After', result.retryAfter);
        }

        logger.warn('Rate limit exceeded', {
          token: token.substring(0, 10) + '...',
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

      // Increment concurrent counter
      rateLimiter.incrementConcurrent(token);

      // Decrement on response finish
      res.on('finish', () => {
        rateLimiter.decrementConcurrent(token);
      });

      res.on('close', () => {
        rateLimiter.decrementConcurrent(token);
      });

      logger.debug('Rate limit checked', {
        token: token.substring(0, 10) + '...',
        remaining: result.remaining,
        path: req.path,
      });

      next();
    })
    .catch((error) => {
      logger.error('Rate limit check failed', error as Error);
      // On error, allow request but log
      next();
    });
}

/**
 * Get rate limit stats for current token
 */
export function getRateLimitStats(req: Request): ReturnType<typeof rateLimiter.getStats> | null {
  const authHeader = req.headers.authorization;
  const token = extractToken(authHeader);
  if (!token) return null;
  return rateLimiter.getStats(token);
}
