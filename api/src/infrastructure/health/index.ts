/**
 * Health Checks Infrastructure
 * 
 * Implements Kubernetes-style health probes:
 * - Liveness: Is the application running?
 * - Readiness: Can the application serve traffic?
 * - Startup: Has the application started successfully?
 * 
 * @module infrastructure/health
 */

import { getLogger } from '../../config/index.js';

const logger = getLogger('health-checks');

/**
 * Health check status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: number;
  duration: number;
  message?: string;
  details?: Record<string, any>;
}

/**
 * Health check function
 */
export type HealthCheckFunction = () => Promise<HealthCheckResult>;

/**
 * Health check registration
 */
export interface HealthCheck {
  name: string;
  check: HealthCheckFunction;
  critical: boolean; // If true, failure makes entire probe fail
  timeout: number; // Max execution time in ms
}

/**
 * Health Checker - manages health probes
 */
export class HealthChecker {
  private livenessChecks: Map<string, HealthCheck> = new Map();
  private readinessChecks: Map<string, HealthCheck> = new Map();
  private startupChecks: Map<string, HealthCheck> = new Map();
  private startupCompleted = false;

  /**
   * Register liveness check
   * Liveness checks verify the application is running and not deadlocked
   */
  registerLivenessCheck(
    name: string,
    check: HealthCheckFunction,
    critical = true,
    timeout = 5000
  ): void {
    this.livenessChecks.set(name, { name, check, critical, timeout });
    logger.info('Registered liveness check', { name, critical, timeout });
  }

  /**
   * Register readiness check
   * Readiness checks verify the application can serve traffic
   */
  registerReadinessCheck(
    name: string,
    check: HealthCheckFunction,
    critical = true,
    timeout = 5000
  ): void {
    this.readinessChecks.set(name, { name, check, critical, timeout });
    logger.info('Registered readiness check', { name, critical, timeout });
  }

  /**
   * Register startup check
   * Startup checks verify the application has started successfully
   */
  registerStartupCheck(
    name: string,
    check: HealthCheckFunction,
    critical = true,
    timeout = 30000 // Longer timeout for startup
  ): void {
    this.startupChecks.set(name, { name, check, critical, timeout });
    logger.info('Registered startup check', { name, critical, timeout });
  }

  /**
   * Execute liveness probe
   */
  async checkLiveness(): Promise<{
    status: HealthStatus;
    checks: Record<string, HealthCheckResult>;
  }> {
    return this.executeChecks(this.livenessChecks, 'liveness');
  }

  /**
   * Execute readiness probe
   */
  async checkReadiness(): Promise<{
    status: HealthStatus;
    checks: Record<string, HealthCheckResult>;
  }> {
    // If startup not completed, not ready
    if (!this.startupCompleted) {
      return {
        status: HealthStatus.UNHEALTHY,
        checks: {
          startup: {
            status: HealthStatus.UNHEALTHY,
            timestamp: Date.now(),
            duration: 0,
            message: 'Startup not completed',
          },
        },
      };
    }

    return this.executeChecks(this.readinessChecks, 'readiness');
  }

  /**
   * Execute startup probe
   */
  async checkStartup(): Promise<{
    status: HealthStatus;
    checks: Record<string, HealthCheckResult>;
  }> {
    if (this.startupCompleted) {
      return {
        status: HealthStatus.HEALTHY,
        checks: {},
      };
    }

    const result = await this.executeChecks(this.startupChecks, 'startup');

    // If all startup checks pass, mark as completed
    if (result.status === HealthStatus.HEALTHY) {
      this.startupCompleted = true;
      logger.info('Startup checks completed successfully');
    }

    return result;
  }

  /**
   * Execute set of health checks
   */
  private async executeChecks(
    checks: Map<string, HealthCheck>,
    probeName: string
  ): Promise<{
    status: HealthStatus;
    checks: Record<string, HealthCheckResult>;
  }> {
    const results: Record<string, HealthCheckResult> = {};
    let overallStatus = HealthStatus.HEALTHY;
    let criticalFailed = false;
    let nonCriticalFailed = false;

    const checkPromises = Array.from(checks.values()).map(async (healthCheck) => {
      const startTime = Date.now();

      try {
        // Execute check with timeout
        const result = await this.executeWithTimeout(
          healthCheck.check(),
          healthCheck.timeout
        );

        results[healthCheck.name] = result;

        // Track failures
        if (result.status === HealthStatus.UNHEALTHY) {
          if (healthCheck.critical) {
            criticalFailed = true;
          } else {
            nonCriticalFailed = true;
          }
        }

        logger.debug(`Health check ${healthCheck.name} completed`, {
          probe: probeName,
          status: result.status,
          duration: result.duration,
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorResult: HealthCheckResult = {
          status: HealthStatus.UNHEALTHY,
          timestamp: Date.now(),
          duration,
          message: error instanceof Error ? error.message : 'Unknown error',
        };

        results[healthCheck.name] = errorResult;

        if (healthCheck.critical) {
          criticalFailed = true;
        } else {
          nonCriticalFailed = true;
        }

        logger.error(`Health check ${healthCheck.name} failed`, error as Error, {
          probe: probeName,
          duration,
        });
      }
    });

    await Promise.all(checkPromises);

    // Determine overall status
    if (criticalFailed) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (nonCriticalFailed) {
      overallStatus = HealthStatus.DEGRADED;
    }

    return { status: overallStatus, checks: results };
  }

  /**
   * Execute promise with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Reset startup state (useful for testing)
   */
  resetStartup(): void {
    this.startupCompleted = false;
  }

  /**
   * Get startup completion status
   */
  isStartupCompleted(): boolean {
    return this.startupCompleted;
  }
}

/**
 * Built-in health checks
 */
export class BuiltInHealthChecks {
  /**
   * Process uptime check
   */
  static processUptime(minUptimeSeconds = 0): HealthCheckFunction {
    return async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      const uptime = process.uptime();

      const status =
        uptime >= minUptimeSeconds ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;

      return {
        status,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        message: `Process uptime: ${uptime.toFixed(2)}s`,
        details: {
          uptime,
          minRequired: minUptimeSeconds,
        },
      };
    };
  }

  /**
   * Memory usage check
   */
  static memoryUsage(maxHeapUsedMB = 500): HealthCheckFunction {
    return async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

      const status =
        heapUsedMB <= maxHeapUsedMB ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;

      return {
        status,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        message: `Heap usage: ${heapUsedMB.toFixed(2)}MB / ${maxHeapUsedMB}MB`,
        details: {
          heapUsedMB: parseFloat(heapUsedMB.toFixed(2)),
          maxHeapUsedMB,
          rss: memoryUsage.rss / 1024 / 1024,
          external: memoryUsage.external / 1024 / 1024,
        },
      };
    };
  }

  /**
   * Event loop lag check
   */
  static eventLoopLag(maxLagMs = 100): HealthCheckFunction {
    return async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();

      // Measure event loop lag by scheduling immediate
      const lag = await new Promise<number>((resolve) => {
        const checkStart = Date.now();
        setImmediate(() => {
          resolve(Date.now() - checkStart);
        });
      });

      const status = lag <= maxLagMs ? HealthStatus.HEALTHY : HealthStatus.DEGRADED;

      return {
        status,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        message: `Event loop lag: ${lag}ms`,
        details: {
          lagMs: lag,
          maxLagMs,
        },
      };
    };
  }

  /**
   * Disk space check
   */
  static diskSpace(path = '/', minFreeGB = 1): HealthCheckFunction {
    return async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();

      try {
        // Use child_process to check disk space
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const { stdout } = await execAsync(`df -BG ${path} | tail -1 | awk '{print $4}'`);
        const freeGB = parseInt(stdout.trim().replace('G', ''), 10);

        const status = freeGB >= minFreeGB ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;

        return {
          status,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          message: `Free disk space: ${freeGB}GB`,
          details: {
            path,
            freeGB,
            minFreeGB,
          },
        };
      } catch (error) {
        return {
          status: HealthStatus.UNHEALTHY,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          message: 'Failed to check disk space',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    };
  }
}

/**
 * Global health checker instance
 */
let globalHealthChecker: HealthChecker | null = null;

/**
 * Initialize global health checker
 */
export function initializeHealthChecker(): HealthChecker {
  if (!globalHealthChecker) {
    globalHealthChecker = new HealthChecker();

    // Register built-in checks
    globalHealthChecker.registerLivenessCheck(
      'process-uptime',
      BuiltInHealthChecks.processUptime(1),
      true,
      1000
    );

    globalHealthChecker.registerReadinessCheck(
      'memory-usage',
      BuiltInHealthChecks.memoryUsage(500),
      false,
      2000
    );

    globalHealthChecker.registerReadinessCheck(
      'event-loop-lag',
      BuiltInHealthChecks.eventLoopLag(100),
      false,
      2000
    );

    globalHealthChecker.registerStartupCheck(
      'initial-uptime',
      BuiltInHealthChecks.processUptime(0),
      true,
      1000
    );

    logger.info('Health checker initialized with built-in checks');
  }

  return globalHealthChecker;
}

/**
 * Get global health checker instance
 */
export function getHealthChecker(): HealthChecker {
  if (!globalHealthChecker) {
    return initializeHealthChecker();
  }
  return globalHealthChecker;
}
