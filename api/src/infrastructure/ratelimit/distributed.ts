/**
 * Distributed Rate Limiter
 * 
 * Stateless rate limiting using shared cache
 * Enables horizontal scaling with distributed state
 * 
 * @module infrastructure/ratelimit/distributed
 */

import { getCache, type ICache } from '../cache/index.js';
import { getLogger } from '../../config/index.js';
import type { RateLimitConfig, RateLimitResult } from './index.js';
import { RateLimitTiers } from './index.js';

const logger = getLogger('distributed-ratelimit');

/**
 * Distributed Rate Limiter State
 */
export interface DistributedRateLimitState {
  tokens: number;
  lastRefill: number;
  concurrent: number;
  requests: number[];
}

/**
 * Distributed Rate Limiter
 * 
 * Stores state in cache for horizontal scaling
 * Multiple instances can serve requests with consistent limits
 */
export class DistributedRateLimiter {
  constructor(
    private cache: ICache = getCache(),
    private defaultTier: string = 'standard'
  ) {
    logger.info('Distributed rate limiter initialized', { defaultTier });
  }

  /**
   * Get rate limit config for token
   */
  private async getConfig(token: string): Promise<RateLimitConfig> {
    const cached = await this.cache.get<RateLimitConfig>(
      `ratelimit:config:${token}`
    );

    if (cached) {
      return cached;
    }

    // Use default tier
    const tier = this.defaultTier as keyof typeof RateLimitTiers;
    const config = RateLimitTiers[tier] || RateLimitTiers.standard;

    return config;
  }

  /**
   * Get current state from cache
   */
  private async getState(token: string): Promise<DistributedRateLimitState> {
    const cached = await this.cache.get<DistributedRateLimitState>(
      `ratelimit:state:${token}`
    );

    if (cached) {
      return cached;
    }

    // Initialize new state
    const config = await this.getConfig(token);
    return {
      tokens: config.maxTokens,
      lastRefill: Date.now(),
      concurrent: 0,
      requests: [],
    };
  }

  /**
   * Save state to cache
   */
  private async saveState(
    token: string,
    state: DistributedRateLimitState
  ): Promise<void> {
    const ttl = 3600000; // 1 hour
    await this.cache.set(`ratelimit:state:${token}`, state, { ttl });
  }

  /**
   * Check rate limit
   */
  async checkLimit(token: string): Promise<RateLimitResult> {
    const config = await this.getConfig(token);
    let state = await this.getState(token);

    const now = Date.now();

    // Refill tokens based on elapsed time
    const secondsElapsed = (now - state.lastRefill) / 1000;
    const tokensToAdd = Math.min(
      config.maxTokens - state.tokens,
      secondsElapsed * config.refillRate
    );

    state.tokens = Math.min(config.maxTokens, state.tokens + tokensToAdd);
    state.lastRefill = now;

    // Clean old requests (sliding window)
    state.requests = state.requests.filter(
      (t) => t > now - config.windowSize
    );

    const windowRequests = state.requests.length;

    // Check token bucket
    const hasTokens = state.tokens >= 1;

    // Check sliding window
    const withinWindow = windowRequests < config.maxRequests;

    // Check concurrency
    const withinConcurrency = state.concurrent < config.maxConcurrent;

    const allowed = hasTokens && withinWindow && withinConcurrency;

    if (allowed) {
      state.tokens--;
      state.concurrent++;
      state.requests.push(now);
      await this.saveState(token, state);

      const resetAt = state.lastRefill + (config.windowSize * 1000);
      const remaining = Math.floor(
        state.tokens + state.concurrent <= config.maxConcurrent
          ? state.tokens
          : 0
      );

      return {
        allowed: true,
        remaining,
        resetAt,
      };
    }

    // Calculate retry-after
    let retryAfter = 1;
    if (!hasTokens) {
      retryAfter = Math.ceil((1 - state.tokens) / config.refillRate);
    } else if (!withinWindow) {
      const oldestRequest = state.requests[0];
      if (oldestRequest !== undefined) {
        retryAfter = Math.ceil(
          (config.windowSize - (now - oldestRequest)) / 1000
        );
      }
    } else if (!withinConcurrency) {
      retryAfter = 5; // Suggest retry after 5 seconds
    }

    const resetAt = state.lastRefill + config.windowSize;

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter,
    };
  }

  /**
   * Release concurrent slot
   */
  async releaseSlot(token: string): Promise<void> {
    const state = await this.getState(token);

    if (state.concurrent > 0) {
      state.concurrent--;
      await this.saveState(token, state);
    }
  }

  /**
   * Set config for token
   */
  async setConfig(token: string, config: RateLimitConfig): Promise<void> {
    const ttl = 86400000; // 24 hours
    await this.cache.set(`ratelimit:config:${token}`, config, { ttl });

    logger.info('Rate limit config set for token', { token });
  }

  /**
   * Reset rate limit for token
   */
  async reset(token: string): Promise<void> {
    await this.cache.delete(`ratelimit:state:${token}`);
    logger.info('Rate limit reset for token', { token });
  }

  /**
   * Reset all rate limits
   */
  async resetAll(): Promise<void> {
    await this.cache.clear();
    logger.info('All rate limits reset');
  }
}

/**
 * Global distributed rate limiter instance
 */
let globalDistributedLimiter: DistributedRateLimiter | null = null;

/**
 * Initialize distributed rate limiter
 */
export function initializeDistributedRateLimiter(
  cache?: ICache
): DistributedRateLimiter {
  if (!globalDistributedLimiter) {
    globalDistributedLimiter = new DistributedRateLimiter(cache);
  }
  return globalDistributedLimiter;
}

/**
 * Get distributed rate limiter
 */
export function getDistributedRateLimiter(): DistributedRateLimiter {
  if (!globalDistributedLimiter) {
    return initializeDistributedRateLimiter();
  }
  return globalDistributedLimiter;
}
