/**
 * Cache Management Infrastructure
 * 
 * Abstraction for distributed caching
 * Supports in-memory fallback and Redis backend
 * Used for rate-limit state, auth tokens, and session data
 * 
 * @module infrastructure/cache
 */

import { EventEmitter } from 'events';
import { getLogger } from '../../config/index.js';

const logger = getLogger('cache');

/**
 * Cache entry with TTL
 */
export interface CacheEntry<T = any> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

/**
 * Cache options
 */
export interface CacheOptions {
  ttl?: number; // TTL in milliseconds
  updateTtl?: boolean; // Extend TTL on access
}

/**
 * Cache interface for pluggable backends
 */
export interface ICache {
  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  getMultiple<T = any>(keys: string[]): Promise<Map<string, T>>;
  setMultiple<T = any>(entries: Map<string, T>, options?: CacheOptions): Promise<void>;
  deleteMultiple(keys: string[]): Promise<void>;
  incrementCounter(key: string, delta?: number): Promise<number>;
  decrementCounter(key: string, delta?: number): Promise<number>;
}

/**
 * In-Memory Cache Implementation
 * 
 * Simple in-memory cache with TTL support
 * Used as default and fallback backend
 */
export class InMemoryCache extends EventEmitter implements ICache {
  private cache: Map<string, CacheEntry> = new Map();
  private cleanupTimer: NodeJS.Timeout | undefined;
  private defaultTtl: number;

  constructor(defaultTtl: number = 3600000) {
    super();
    this.defaultTtl = defaultTtl;
    this.startCleanupTimer();

    logger.info('In-memory cache initialized', { defaultTtl });
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    this.emit('cache:hit', { key });
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<void> {
    const ttl = options?.ttl ?? this.defaultTtl;
    const expiresAt = Date.now() + ttl;

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    });

    this.emit('cache:set', { key, ttl });
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.emit('cache:delete', { key });
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.emit('cache:clear', { size });

    logger.info('Cache cleared', { size });
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get multiple values
   */
  async getMultiple<T = any>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        result.set(key, value);
      }
    }

    return result;
  }

  /**
   * Set multiple values
   */
  async setMultiple<T = any>(
    entries: Map<string, T>,
    options?: CacheOptions
  ): Promise<void> {
    for (const [key, value] of entries.entries()) {
      await this.set(key, value, options);
    }
  }

  /**
   * Delete multiple entries
   */
  async deleteMultiple(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.delete(key);
    }
  }

  /**
   * Increment counter
   */
  async incrementCounter(key: string, delta: number = 1): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const newValue = current + delta;
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Decrement counter
   */
  async decrementCounter(key: string, delta: number = 1): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const newValue = Math.max(0, current - delta);
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; memory: number } {
    return {
      size: this.cache.size,
      memory: JSON.stringify(Array.from(this.cache.values())).length,
    };
  }

  /**
   * Start background cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const before = this.cache.size;
      const now = Date.now();

      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt < now) {
          this.cache.delete(key);
        }
      }

      const after = this.cache.size;
      if (before !== after) {
        logger.debug('Cache cleanup', { removed: before - after });
      }
    }, 60000); // Run every minute

    this.cleanupTimer.unref();
  }

  /**
   * Shutdown cache
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.cache.clear();
    logger.info('Cache shutdown');
  }
}

/**
 * Global cache instance
 */
let globalCache: ICache | null = null;

/**
 * Initialize cache system
 */
export function initializeCache(cache?: ICache): ICache {
  if (!globalCache) {
    globalCache = cache ?? new InMemoryCache();
  }
  return globalCache;
}

/**
 * Get cache instance
 */
export function getCache(): ICache {
  if (!globalCache) {
    return initializeCache();
  }
  return globalCache;
}

/**
 * Cache decorator for async functions
 */
export function cached(
  keyPrefix: string,
  options?: CacheOptions
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]): Promise<any> {
      const cache = getCache();
      const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`;

      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Call original method
      const result = await originalMethod.apply(this, args);

      // Cache result
      await cache.set(cacheKey, result, options);

      return result;
    };

    return descriptor;
  };
}
