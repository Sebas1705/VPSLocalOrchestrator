import express, { type Application, type Request, type Response, type Router } from 'express';
import { errorHandlingMiddleware, notFoundHandler } from './middleware/errorHandlingMiddleware.js';
import { metricsEndpoint } from './middleware/metrics.js';
import { rateLimitMiddleware } from './middleware/ratelimit.js';
import { authGate } from './middleware/authGate.js';
import { createCommandRoutes } from './routes/command.routes.js';
import { createResourceRoutes } from './routes/resources.routes.js';
import { createServiceRoutes } from './routes/services.routes.js';
import auditRoutes from './routes/audit.routes.js';
import fileRoutes from './routes/file.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import secretsRoutes from './routes/secrets.routes.js';
import backupRoutes from './routes/backup.routes.js';
import workflowRoutes from './routes/workflow.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import dockerRoutes from './routes/docker.routes.js';
import databaseRoutes from './routes/database.routes.js';
import loadBalancerRoutes from './routes/loadbalancer.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import jobsRoutes from './routes/jobs.routes.js';
import ratelimitsRoutes from './routes/ratelimits.routes.js';
import circuitbreakerRoutes from './routes/circuitbreaker.routes.js';
import openapiRoutes from './routes/openapi.routes.js';
import migrationRoutes from './routes/migration.routes.js';
import auditEventsRoutes from './routes/audit-events.routes.js';
import eventsRoutes from './routes/events.routes.js';
import eventstoreRoutes from './routes/eventstore.routes.js';
import eventprocessorRoutes from './routes/eventprocessor.routes.js';
import encryptionRoutes from './routes/encryption.routes.js';
import rbacRoutes from './routes/rbac.routes.js';
import threatRoutes from './routes/threat.routes.js';
import type { ICommandRepository, IResourceRepository, IServiceRepository } from './domain/ports/repository.interfaces.js';

export interface AppDependencies {
  commandRepository: ICommandRepository;
  resourceRepository: IResourceRepository;
  serviceRepository: IServiceRepository;
}

export interface AppOptions {
  /** Tests that send hundreds of requests turn this off; production never does. */
  rateLimit?: boolean;
}

/** A router and where it is mounted, kept in one list so tests can enumerate them. */
export interface ApiMount {
  path: string;
  router: Router;
}

function buildApiMounts({ commandRepository, resourceRepository, serviceRepository }: AppDependencies): ApiMount[] {
  return [
    { path: '/api/command', router: createCommandRoutes(commandRepository) },
    { path: '/api/resources', router: createResourceRoutes(resourceRepository) },
    { path: '/api/services', router: createServiceRoutes(serviceRepository) },
    { path: '/api/logs', router: auditRoutes },
    { path: '/api/files', router: fileRoutes },
    { path: '/api/webhooks', router: webhookRoutes },
    { path: '/api/secrets', router: secretsRoutes },
    { path: '/api/backups', router: backupRoutes },
    { path: '/api/workflows', router: workflowRoutes },
    { path: '/api/metrics', router: metricsRoutes },
    { path: '/api/docker', router: dockerRoutes },
    { path: '/api/databases', router: databaseRoutes },
    { path: '/api/loadbalancer', router: loadBalancerRoutes },
    { path: '/api/analytics', router: analyticsRoutes },
    { path: '/api/jobs', router: jobsRoutes },
    { path: '/api/ratelimits', router: ratelimitsRoutes },
    { path: '/api/circuitbreakers', router: circuitbreakerRoutes },
    { path: '/api', router: openapiRoutes },
    { path: '/api', router: migrationRoutes },
    { path: '/api/audit', router: auditEventsRoutes },
    { path: '/api/events', router: eventsRoutes },
    { path: '/api/eventstore', router: eventstoreRoutes },
    { path: '/api/processor', router: eventprocessorRoutes },
    { path: '/api/encryption', router: encryptionRoutes },
    { path: '/api/rbac', router: rbacRoutes },
    { path: '/api/threat', router: threatRoutes },
  ];
}

/**
 * Build the Express application. Does not listen and starts nothing: index.ts
 * owns process start-up, so tests exercise the exact middleware order and route
 * table that production uses.
 *
 * Order matters: the rate limiter runs first so failed logins are throttled,
 * and the auth gate runs before body parsing so an unauthenticated caller
 * cannot make the server buffer a 10 MB body.
 */
export function createApp(dependencies: AppDependencies, { rateLimit = true }: AppOptions = {}): Application {
  const app: Application = express();
  const mounts = buildApiMounts(dependencies);
  app.locals.apiMounts = mounts;

  if (rateLimit) {
    app.use(rateLimitMiddleware);
  }
  app.use(authGate);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Still off: the tracing, HTTP metrics, back-pressure, event-bus and request
  // logging middlewares were disabled while chasing a hang and have not been
  // re-verified. `localhostOnly` is not used either: the listen address is the
  // control, and a container sees the Docker gateway, never loopback.

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Metrics endpoint (Prometheus compatible)
  app.get('/metrics', metricsEndpoint);

  for (const { path, router } of mounts) {
    app.use(path, router);
  }

  // Ruta por defecto
  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'VPS Local Orchestrator API',
      version: '1.2.0',
      description: 'API para orquestar recursos y ejecutar comandos localmente - v1.2.0 Minor Release',
      endpoints: {
        health: 'GET /health',
        healthLiveness: 'GET /health/live',
        healthReadiness: 'GET /health/ready',
        healthStartup: 'GET /health/startup',
        metrics: 'GET /metrics',
        jobsCreate: 'POST /api/jobs',
        jobsList: 'GET /api/jobs',
        jobsGet: 'GET /api/jobs/:id',
        jobsCancel: 'DELETE /api/jobs/:id',
        jobsRetry: 'POST /api/jobs/:id/retry',
        jobsStats: 'GET /api/jobs/stats/summary',
        jobsClear: 'DELETE /api/jobs/completed/clear',
        rateLimitStats: 'GET /api/ratelimits/stats',
        rateLimitAll: 'GET /api/ratelimits/all',
        rateLimitConfig: 'POST /api/ratelimits/config',
        rateLimitReset: 'DELETE /api/ratelimits/reset',
        rateLimitTiers: 'GET /api/ratelimits/tiers',
        circuitBreakers: 'GET /api/circuitbreakers',
        circuitBreakerGet: 'GET /api/circuitbreakers/:name',
        circuitBreakerReset: 'POST /api/circuitbreakers/:name/reset',
        circuitBreakerState: 'POST /api/circuitbreakers/:name/state',
        circuitBreakerResetAll: 'POST /api/circuitbreakers/actions/reset-all',
        backpressureStatus: 'GET /api/backpressure/status',
        executeCommand: 'POST /api/command/execute',
        batchCommands: 'POST /api/command/batch',
        serviceManagement: 'POST /api/command/service',
        systemResources: 'GET /api/resources',
        processes: 'GET /api/resources/processes',
        networkStats: 'GET /api/resources/network',
        processPriority: 'POST /api/resources/process/:pid/priority',
        killProcess: 'DELETE /api/resources/process/:pid',
        services: 'GET /api/services',
        serviceHealth: 'GET /api/services/:name/health',
        auditLogs: 'GET /api/logs',
        searchLogs: 'POST /api/logs/search',
        fileRead: 'GET /api/files?path=<path>',
        fileWrite: 'POST /api/files',
        fileDelete: 'DELETE /api/files?path=<path>',
        mkdir: 'POST /api/files/mkdir',
        rmdir: 'DELETE /api/files/rmdir?path=<path>',
        webhooksList: 'GET /api/webhooks',
        webhooksRegister: 'POST /api/webhooks',
        webhooksDelete: 'DELETE /api/webhooks/:id',
        webhooksTest: 'POST /api/webhooks/:id/test',
        secretsList: 'GET /api/secrets',
        secretsCreate: 'POST /api/secrets',
        secretsGet: 'GET /api/secrets/:id',
        secretsUpdate: 'PATCH /api/secrets/:id',
        secretsDelete: 'DELETE /api/secrets/:id',
        backupsList: 'GET /api/backups',
        backupsCreate: 'POST /api/backups',
        backupsGet: 'GET /api/backups/:name',
        backupsDelete: 'DELETE /api/backups/:name',
        backupsRestore: 'POST /api/backups/:name/restore',
        workflowsList: 'GET /api/workflows',
        workflowsCreate: 'POST /api/workflows',
        workflowsGet: 'GET /api/workflows/:id',
        workflowsUpdate: 'PATCH /api/workflows/:id',
        workflowsDelete: 'DELETE /api/workflows/:id',
        workflowsRun: 'POST /api/workflows/:id/run',
        workflowsHistory: 'GET /api/workflows/:id/history',
        metricsCreate: 'POST /api/metrics/custom',
        metricsList: 'GET /api/metrics',
        dockerContainers: 'GET /api/docker/containers',
        dockerImages: 'GET /api/docker/images',
        dockerStart: 'POST /api/docker/containers/:id/start',
        dockerStop: 'POST /api/docker/containers/:id/stop',
        databaseStatus: 'GET /api/databases/status',
        databaseBackup: 'POST /api/databases/backup',
        lbList: 'GET /api/loadbalancer/backends',
        lbCreate: 'POST /api/loadbalancer/backends',
        lbDrain: 'POST /api/loadbalancer/backends/:id/drain',
        lbEnable: 'POST /api/loadbalancer/backends/:id/enable',
        lbDelete: 'DELETE /api/loadbalancer/backends/:id',
        analyticsSnapshot: 'GET /api/analytics/snapshot',
        analyticsAggregate: 'GET /api/analytics/aggregate',
        analyticsTrend: 'GET /api/analytics/trend',
      },
    });
  });

  // Manejador de rutas no encontradas (debe estar antes del error handler)
  app.use(notFoundHandler);

  // Middleware de manejo de errores (DEBE SER EL ÚLTIMO)
  app.use(errorHandlingMiddleware);

  return app;
}
