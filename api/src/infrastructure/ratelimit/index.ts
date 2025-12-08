/**
 * Rate Limiting Infrastructure
 * 
 * Token bucket algorithm for rate limiting per API token
 * Sliding window for request tracking
 * Concurrency control per token
 * 
 * @module infrastructure/ratelimit
 */

import { getLogger } from '../../config/index.js';

const logger = getLogger('rate-limiter');

/**
 * Rate limit window
 */
export interface RateLimitWindow {
  tokens: number;
  lastRefill: number;
  requests: number[];
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxTokens: number; // Maximum tokens in bucket
  refillRate: number; // Tokens per second
  windowSize: number; // Time window in ms
  maxRequests: number; // Max requests per window
  maxConcurrent: number; // Max concurrent requests
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Default rate limit configs by tier
 */
export const RateLimitTiers = {
  free: {
    maxTokens: 10,
    refillRate: 1, // 1 token per second
    windowSize: 60000, // 1 minute
    maxRequests: 60, // 60 req/min
    maxConcurrent: 2,
  },
  standard: {
    maxTokens: 50,
    refillRate: 5,
    windowSize: 60000,
    maxRequests: 300,
    maxConcurrent: 10,
  },
  premium: {
    maxTokens: 200,
    refillRate: 20,
    windowSize: 60000,
    maxRequests: 1200,
    maxConcurrent: 50,
  },
  unlimited: {
    maxTokens: 10000,
    refillRate: 1000,
    windowSize: 60000,
    maxRequests: 100000,
    maxConcurrent: 1000,
  },
};

/**
 * Rate Limiter - Token bucket + sliding window
 */
export class RateLimiter {
  private windows: Map<string, RateLimitWindow> = new Map();
  private concurrent: Map<string, number> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    // Start cleanup timer (every 5 minutes)
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 300000);

    logger.info('Rate limiter initialized');
  }

  /**
   * Set rate limit config for token
   */
  setConfig(token: string, config: RateLimitConfig): void {
    this.configs.set(token, config);
    logger.info('Rate limit config set', {
      token: token.substring(0, 10) + '...',
      maxRequests: config.maxRequests,
      maxConcurrent: config.maxConcurrent,
    });
  }

  /**
   * Get rate limit config for token
   */
  getConfig(token: string): RateLimitConfig {
    return this.configs.get(token) || RateLimitTiers.standard;
  }

  /**
   * Check if request is allowed (token bucket algorithm)
   */
  async checkLimit(token: string): Promise<RateLimitResult> {
    const config = this.getConfig(token);
    const now = Date.now();

    // Get or create window
    let window = this.windows.get(token);
    if (!window) {
      window = {
        tokens: config.maxTokens,
        lastRefill: now,
        requests: [],
      };
      this.windows.set(token, window);
    }

    // Refill tokens based on time elapsed
    const elapsed = (now - window.lastRefill) / 1000;
    const tokensToAdd = Math.floor(elapsed * config.refillRate);
    if (tokensToAdd > 0) {
      window.tokens = Math.min(config.maxTokens, window.tokens + tokensToAdd);
      window.lastRefill = now;
    }

    // Clean old requests from sliding window
    const windowStart = now - config.windowSize;
    window.requests = window.requests.filter((t) => t > windowStart);

    // Check sliding window limit
    if (window.requests.length >= config.maxRequests) {
      const oldestRequest = window.requests[0] || now;
      const retryAfter = Math.ceil((oldestRequest + config.windowSize - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestRequest + config.windowSize,
        retryAfter,
      };
    }

    // Check token bucket
    if (window.tokens < 1) {
      const nextRefill = window.lastRefill + 1000 / config.refillRate;
      const retryAfter = Math.ceil((nextRefill - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt: nextRefill,
        retryAfter,
      };
    }

    // Check concurrent requests limit
    const currentConcurrent = this.concurrent.get(token) || 0;
    if (currentConcurrent >= config.maxConcurrent) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + 1000,
        retryAfter: 1,
      };
    }

    // Allow request
    window.tokens -= 1;
    window.requests.push(now);

    const remaining = Math.min(
      window.tokens,
      config.maxRequests - window.requests.length
    );

    return {
      allowed: true,
      remaining,
      resetAt: now + config.windowSize,
    };
  }

  /**
   * Increment concurrent request count
   */
  incrementConcurrent(token: string): void {
    const current = this.concurrent.get(token) || 0;
    this.concurrent.set(token, current + 1);
  }

  /**
   * Decrement concurrent request count
   */
  decrementConcurrent(token: string): void {
    const current = this.concurrent.get(token) || 0;
    if (current > 0) {
      this.concurrent.set(token, current - 1);
    }
  }

  /**
   * Get current concurrent count
   */
  getConcurrentCount(token: string): number {
    return this.concurrent.get(token) || 0;
  }

  /**
   * Get rate limit stats for token
   */
  getStats(token: string): {
    tokensRemaining: number;
    requestsInWindow: number;
    concurrent: number;
    config: RateLimitConfig;
  } {
    const config = this.getConfig(token);
    const window = this.windows.get(token);
    const now = Date.now();

    if (!window) {
      return {
        tokensRemaining: config.maxTokens,
        requestsInWindow: 0,
        concurrent: 0,
        config,
      };
    }

    // Clean old requests
    const windowStart = now - config.windowSize;
    window.requests = window.requests.filter((t) => t > windowStart);

    return {
      tokensRemaining: Math.floor(window.tokens),
      requestsInWindow: window.requests.length,
      concurrent: this.concurrent.get(token) || 0,
      config,
    };
  }

  /**
   * Reset rate limit for token
   */
  reset(token: string): void {
    this.windows.delete(token);
    this.concurrent.delete(token);
    logger.info('Rate limit reset', { token: token.substring(0, 10) + '...' });
  }

  /**
   * Cleanup old windows
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [token, window] of this.windows.entries()) {
      const config = this.getConfig(token);
      const windowStart = now - config.windowSize;

      // Clean old requests
      window.requests = window.requests.filter((t) => t > windowStart);

      // Remove window if no recent activity
      if (window.requests.length === 0 && now - window.lastRefill > config.windowSize) {
        this.windows.delete(token);
        cleaned++;
      }
    }

    // Clean concurrent counters with no activity
    for (const [token, count] of this.concurrent.entries()) {
      if (count === 0 && !this.windows.has(token)) {
        this.concurrent.delete(token);
      }
    }

    if (cleaned > 0) {
      logger.debug('Cleaned up rate limit windows', { count: cleaned });
    }
  }

  /**
   * Stop cleanup timer
   */
  stop(): void {
    if (this.cleanupTimer !== undefined) {
      clearInterval(this.cleanupTimer);
      delete (this as any).cleanupTimer;
      logger.info('Rate limiter stopped');
    }
  }

  /**
   * Get all token stats
   */
  getAllStats(): Array<{
    token: string;
    stats: ReturnType<RateLimiter['getStats']>;
  }> {
    const allTokens = new Set([
      ...this.windows.keys(),
      ...this.concurrent.keys(),
      ...this.configs.keys(),
    ]);

    return Array.from(allTokens).map((token) => ({
      token: token.substring(0, 10) + '...',
      stats: this.getStats(token),
    }));
  }
}

/**
 * Global rate limiter instance
 */
let globalRateLimiter: RateLimiter | null = null;

/**
 * Initialize global rate limiter
 */
export function initializeRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter();
  }
  return globalRateLimiter;
}

/**
 * Get global rate limiter instance
 */
export function getRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    return initializeRateLimiter();
  }
  return globalRateLimiter;
}
