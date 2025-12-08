/**
 * Health Check Routes
 * 
 * Kubernetes-style health probe endpoints:
 * - GET /health/live - Liveness probe
 * - GET /health/ready - Readiness probe
 * - GET /health/startup - Startup probe
 * - GET /health - Overall health status
 * 
 * @module routes/health
 */

import { Router, type Request, type Response } from 'express';
import { getHealthChecker, HealthStatus } from '../infrastructure/health/index.js';
import { getLogger } from '../config/index.js';

const router = Router();
const logger = getLogger('health-routes');
const healthChecker = getHealthChecker();

/**
 * Overall health status (combines all probes)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const [liveness, readiness, startup] = await Promise.all([
      healthChecker.checkLiveness(),
      healthChecker.checkReadiness(),
      healthChecker.checkStartup(),
    ]);

    // Determine overall status
    let overallStatus = HealthStatus.HEALTHY;
    if (
      liveness.status === HealthStatus.UNHEALTHY ||
      readiness.status === HealthStatus.UNHEALTHY
    ) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (
      liveness.status === HealthStatus.DEGRADED ||
      readiness.status === HealthStatus.DEGRADED
    ) {
      overallStatus = HealthStatus.DEGRADED;
    }

    const httpStatus = overallStatus === HealthStatus.UNHEALTHY ? 503 : 200;

    res.status(httpStatus).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      probes: {
        liveness,
        readiness,
        startup,
      },
      system: {
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
      },
    });
  } catch (error) {
    logger.error('Health check failed', error as Error);
    res.status(503).json({
      status: HealthStatus.UNHEALTHY,
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * Liveness probe
 * Returns 200 if application is alive, 503 if dead/deadlocked
 */
router.get('/live', async (req: Request, res: Response) => {
  try {
    const result = await healthChecker.checkLiveness();
    const httpStatus = result.status === HealthStatus.UNHEALTHY ? 503 : 200;

    res.status(httpStatus).json({
      status: result.status,
      timestamp: new Date().toISOString(),
      checks: result.checks,
    });
  } catch (error) {
    logger.error('Liveness probe failed', error as Error);
    res.status(503).json({
      status: HealthStatus.UNHEALTHY,
      timestamp: new Date().toISOString(),
      error: 'Liveness probe failed',
    });
  }
});

/**
 * Readiness probe
 * Returns 200 if application is ready to serve traffic, 503 if not ready
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const result = await healthChecker.checkReadiness();
    const httpStatus = result.status === HealthStatus.UNHEALTHY ? 503 : 200;

    res.status(httpStatus).json({
      status: result.status,
      timestamp: new Date().toISOString(),
      checks: result.checks,
    });
  } catch (error) {
    logger.error('Readiness probe failed', error as Error);
    res.status(503).json({
      status: HealthStatus.UNHEALTHY,
      timestamp: new Date().toISOString(),
      error: 'Readiness probe failed',
    });
  }
});

/**
 * Startup probe
 * Returns 200 if application has started, 503 if still starting
 */
router.get('/startup', async (req: Request, res: Response) => {
  try {
    const result = await healthChecker.checkStartup();
    const httpStatus = result.status === HealthStatus.UNHEALTHY ? 503 : 200;

    res.status(httpStatus).json({
      status: result.status,
      timestamp: new Date().toISOString(),
      completed: healthChecker.isStartupCompleted(),
      checks: result.checks,
    });
  } catch (error) {
    logger.error('Startup probe failed', error as Error);
    res.status(503).json({
      status: HealthStatus.UNHEALTHY,
      timestamp: new Date().toISOString(),
      error: 'Startup probe failed',
    });
  }
});

export default router;
