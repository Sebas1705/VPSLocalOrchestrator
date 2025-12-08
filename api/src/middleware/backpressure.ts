/**
 * Back-pressure Middleware
 * 
 * Implements back-pressure mechanisms to prevent system overload
 * Sheds load when system is under stress
 * 
 * @module middleware/backpressure
 */

import type { Request, Response, NextFunction } from 'express';
import { getBackPressureManager } from '../infrastructure/circuitbreaker/index.js';
import { getMetricsRegistry } from '../infrastructure/metrics/index.js';
import { getLogger } from '../config/index.js';

const logger = getLogger('backpressure-middleware');

/**
 * Request priority mapping
 */
const PRIORITY_PATHS = new Map<RegExp, number>([
  [/^\/health/, 10],           // Health checks highest priority
  [/^\/api\/privileged/, 8],   // Privileged commands high priority
  [/^\/api\/command/, 5],      // Regular commands normal priority
  [/^\/api\/jobs/, 5],         // Job management normal priority
  [/^\/api\/resources/, 3],    // Resource monitoring lower priority
]);

/**
 * Get request priority
 */
function getRequestPriority(req: Request): number {
  for (const [pattern, priority] of PRIORITY_PATHS.entries()) {
    if (pattern.test(req.path)) {
      return priority;
    }
  }
  return 1; // Default low priority
}

/**
 * Back-pressure middleware
 */
export function backPressureMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const backPressure = getBackPressureManager();
  const metrics = getMetricsRegistry();
  
  const priority = getRequestPriority(req);

  // Track shed requests
  const shedCounter = metrics.getCounter(
    'http_requests_shed_total',
    'Total requests shed due to back-pressure'
  );

  // Check if system is overloaded
  if (backPressure.isOverloaded()) {
    // Shed low priority requests during overload
    if (priority < 5) {
      logger.warn('Shedding request due to system overload', {
        path: req.path,
        method: req.method,
        priority,
      });

      shedCounter.inc();

      res.status(503).json({
        error: 'Service temporarily unavailable due to high load',
        retryAfter: 30,
        priority,
      });
      return;
    }

    logger.warn('System overloaded, accepting high priority request', {
      path: req.path,
      priority,
    });
  }

  // Try to acquire slot
  backPressure
    .acquire(priority)
    .then((requestId) => {
      // Store request ID for cleanup
      (req as any).backpressureId = requestId;

      // Release slot when response finishes
      res.on('finish', () => {
        backPressure.release();
      });

      next();
    })
    .catch((error: Error) => {
      logger.error('Failed to acquire back-pressure slot', error, {
        path: req.path,
        priority,
      });

      shedCounter.inc();

      res.status(503).json({
        error: 'Service temporarily unavailable',
        message: error.message,
        retryAfter: 60,
      });
    });
}

/**
 * Circuit breaker integration middleware
 * 
 * Wraps route handlers with circuit breaker protection
 */
export function withCircuitBreaker(name: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      const { getCircuitBreakerRegistry } = await import(
        '../infrastructure/circuitbreaker/index.js'
      );
      const registry = getCircuitBreakerRegistry();
      const breaker = registry.getBreaker(name);

      try {
        await breaker.execute(() => originalMethod.call(this, req, res, next));
      } catch (error) {
        if ((error as any).circuitState === 'OPEN') {
          logger.warn('Circuit breaker open, rejecting request', {
            breaker: name,
            nextAttempt: new Date((error as any).nextAttemptTime).toISOString(),
          });

          res.status(503).json({
            error: 'Service temporarily unavailable',
            message: 'Circuit breaker is open',
            retryAfter: Math.ceil(
              ((error as any).nextAttemptTime - Date.now()) / 1000
            ),
          });
          return;
        }

        next(error);
      }
    };

    return descriptor;
  };
}
