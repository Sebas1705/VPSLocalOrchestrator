/**
 * Circuit Breaker Infrastructure
 * 
 * Implements circuit breaker pattern for resilience
 * States: CLOSED (normal), OPEN (failing), HALF_OPEN (testing recovery)
 * Back-pressure mechanisms for system overload protection
 * 
 * @module infrastructure/circuitbreaker
 */

import { EventEmitter } from 'events';
import { getLogger } from '../../config/index.js';

const logger = getLogger('circuit-breaker');

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation
  OPEN = 'OPEN',           // Failures detected, rejecting requests
  HALF_OPEN = 'HALF_OPEN', // Testing if system recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures to open circuit
  successThreshold: number;    // Number of successes to close circuit (from HALF_OPEN)
  timeout: number;             // Time to wait before attempting recovery (ms)
  monitoringPeriod: number;    // Rolling window for failure rate (ms)
  volumeThreshold: number;     // Minimum requests before evaluating failure rate
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  totalRequests: number;
  rejectedRequests: number;
  lastFailureTime?: number | undefined;
  lastSuccessTime?: number | undefined;
  nextAttemptTime?: number | undefined;
}

/**
 * Circuit Breaker
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number[] = [];
  private successes: number[] = [];
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private totalRequests = 0;
  private rejectedRequests = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttemptTime?: number;
  private halfOpenAttempts = 0;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig
  ) {
    super();
    logger.info('Circuit breaker created', {
      name,
      failureThreshold: config.failureThreshold,
      timeout: config.timeout,
    });
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();

      // Check if timeout has elapsed
      if (this.nextAttemptTime && now < this.nextAttemptTime) {
        this.rejectedRequests++;
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        (error as any).circuitState = this.state;
        (error as any).nextAttemptTime = this.nextAttemptTime;
        throw error;
      }

      // Transition to HALF_OPEN
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    // Execute function
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    const now = Date.now();
    this.lastSuccessTime = now;
    this.successes.push(now);
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses++;

    // Clean old successes
    this.cleanOldMetrics();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;

      // Check if enough successes to close circuit
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.halfOpenAttempts = 0;
      }
    }

    this.emit('success', {
      name: this.name,
      state: this.state,
      consecutiveSuccesses: this.consecutiveSuccesses,
    });
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    const now = Date.now();
    this.lastFailureTime = now;
    this.failures.push(now);
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures++;

    // Clean old failures
    this.cleanOldMetrics();

    // Check if should open circuit
    if (this.state === CircuitState.CLOSED) {
      const failureRate = this.getFailureRate();
      const totalInPeriod = this.failures.length + this.successes.length;

      if (
        totalInPeriod >= this.config.volumeThreshold &&
        this.consecutiveFailures >= this.config.failureThreshold
      ) {
        this.transitionTo(CircuitState.OPEN);
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Immediately open on failure in HALF_OPEN
      this.transitionTo(CircuitState.OPEN);
      this.halfOpenAttempts = 0;
    }

    this.emit('failure', {
      name: this.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
    });
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.nextAttemptTime = Date.now() + this.config.timeout;

      logger.warn('Circuit breaker opened', {
        name: this.name,
        consecutiveFailures: this.consecutiveFailures,
        nextAttemptTime: new Date(this.nextAttemptTime).toISOString(),
      });
    } else if (newState === CircuitState.CLOSED) {
      if (this.nextAttemptTime !== undefined) {
        delete (this as any).nextAttemptTime;
      }
      this.consecutiveFailures = 0;

      logger.info('Circuit breaker closed', {
        name: this.name,
        consecutiveSuccesses: this.consecutiveSuccesses,
      });
    } else if (newState === CircuitState.HALF_OPEN) {
      logger.info('Circuit breaker half-open, testing recovery', {
        name: this.name,
      });
    }

    this.emit('stateChange', {
      name: this.name,
      oldState,
      newState,
      timestamp: Date.now(),
    });
  }

  /**
   * Get failure rate in monitoring period
   */
  private getFailureRate(): number {
    const total = this.failures.length + this.successes.length;
    if (total === 0) return 0;
    return this.failures.length / total;
  }

  /**
   * Clean old metrics outside monitoring period
   */
  private cleanOldMetrics(): void {
    const now = Date.now();
    const cutoff = now - this.config.monitoringPeriod;

    this.failures = this.failures.filter((t) => t > cutoff);
    this.successes = this.successes.filter((t) => t > cutoff);
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    this.cleanOldMetrics();

    const stats: CircuitBreakerStats = {
      state: this.state,
      failures: this.failures.length,
      successes: this.successes.length,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      totalRequests: this.totalRequests,
      rejectedRequests: this.rejectedRequests,
    };

    if (this.lastFailureTime !== undefined) {
      stats.lastFailureTime = this.lastFailureTime;
    }
    if (this.lastSuccessTime !== undefined) {
      stats.lastSuccessTime = this.lastSuccessTime;
    }
    if (this.nextAttemptTime !== undefined) {
      stats.nextAttemptTime = this.nextAttemptTime;
    }

    return stats;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.successes = [];
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    if (this.lastFailureTime !== undefined) {
      delete (this as any).lastFailureTime;
    }
    if (this.lastSuccessTime !== undefined) {
      delete (this as any).lastSuccessTime;
    }
    if (this.nextAttemptTime !== undefined) {
      delete (this as any).nextAttemptTime;
    }
    this.halfOpenAttempts = 0;

    logger.info('Circuit breaker reset', { name: this.name });
    this.emit('reset', { name: this.name });
  }

  /**
   * Force state change (for testing/admin)
   */
  forceState(state: CircuitState): void {
    this.transitionTo(state);
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }
}

/**
 * Circuit Breaker Registry
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create circuit breaker
   */
  getBreaker(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000, // 1 minute
        monitoringPeriod: 60000,
        volumeThreshold: 10,
        ...config,
      };

      const breaker = new CircuitBreaker(name, defaultConfig);
      this.breakers.set(name, breaker);
    }

    return this.breakers.get(name)!;
  }

  /**
   * Get all breakers
   */
  getAllBreakers(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  /**
   * Get all stats
   */
  getAllStats(): Array<{ name: string; stats: CircuitBreakerStats }> {
    return Array.from(this.breakers.entries()).map(([name, breaker]) => ({
      name,
      stats: breaker.getStats(),
    }));
  }

  /**
   * Reset all breakers
   */
  resetAll(): void {
    this.breakers.forEach((breaker) => breaker.reset());
    logger.info('All circuit breakers reset');
  }
}

/**
 * Back-pressure Manager
 */
export class BackPressureManager {
  private requestQueue: Array<{
    id: string;
    timestamp: number;
    priority: number;
  }> = [];

  private activeRequests = 0;

  constructor(
    private readonly maxQueueSize: number = 100,
    private readonly maxActiveRequests: number = 50
  ) {
    logger.info('Back-pressure manager initialized', {
      maxQueueSize,
      maxActiveRequests,
    });
  }

  /**
   * Check if system is overloaded
   */
  isOverloaded(): boolean {
    return (
      this.activeRequests >= this.maxActiveRequests ||
      this.requestQueue.length >= this.maxQueueSize
    );
  }

  /**
   * Acquire slot for request
   */
  async acquire(priority: number = 5): Promise<string> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Check if can process immediately
    if (this.activeRequests < this.maxActiveRequests) {
      this.activeRequests++;
      return requestId;
    }

    // Check if queue is full
    if (this.requestQueue.length >= this.maxQueueSize) {
      throw new Error('System overloaded: queue is full');
    }

    // Add to queue
    this.requestQueue.push({
      id: requestId,
      timestamp: Date.now(),
      priority,
    });

    // Sort by priority (higher first), then by timestamp
    this.requestQueue.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });

    // Wait for slot with timeout
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timeout = 30000; // 30 seconds timeout
      
      const checkInterval = setInterval(() => {
        const index = this.requestQueue.findIndex((r) => r.id === requestId);
        
        // Check timeout
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          // Remove from queue
          const queueIndex = this.requestQueue.findIndex((r) => r.id === requestId);
          if (queueIndex !== -1) {
            this.requestQueue.splice(queueIndex, 1);
          }
          reject(new Error('Request timeout: waited too long in queue'));
          return;
        }
        
        if (index === -1) {
          clearInterval(checkInterval);
          return;
        }

        if (this.activeRequests < this.maxActiveRequests) {
          this.requestQueue.splice(index, 1);
          this.activeRequests++;
          clearInterval(checkInterval);
          resolve(requestId);
        }
      }, 100);
    });
  }

  /**
   * Release slot
   */
  release(): void {
    if (this.activeRequests > 0) {
      this.activeRequests--;
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeRequests: number;
    queuedRequests: number;
    isOverloaded: boolean;
  } {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      isOverloaded: this.isOverloaded(),
    };
  }
}

/**
 * Global instances
 */
let globalRegistry: CircuitBreakerRegistry | null = null;
let globalBackPressure: BackPressureManager | null = null;

/**
 * Initialize circuit breaker registry
 */
export function initializeCircuitBreakers(): CircuitBreakerRegistry {
  if (!globalRegistry) {
    globalRegistry = new CircuitBreakerRegistry();
  }
  return globalRegistry;
}

/**
 * Get circuit breaker registry
 */
export function getCircuitBreakerRegistry(): CircuitBreakerRegistry {
  if (!globalRegistry) {
    return initializeCircuitBreakers();
  }
  return globalRegistry;
}

/**
 * Initialize back-pressure manager
 */
export function initializeBackPressure(
  maxQueueSize?: number,
  maxActiveRequests?: number
): BackPressureManager {
  if (!globalBackPressure) {
    globalBackPressure = new BackPressureManager(maxQueueSize, maxActiveRequests);
  }
  return globalBackPressure;
}

/**
 * Get back-pressure manager
 */
export function getBackPressureManager(): BackPressureManager {
  if (!globalBackPressure) {
    return initializeBackPressure();
  }
  return globalBackPressure;
}
