import express, { type Application, type Request, type Response } from 'express';
import { localhostOnly, requestLogger, errorHandler } from './middleware/security.js';
import { errorHandlingMiddleware, notFoundHandler } from './middleware/errorHandlingMiddleware.js';
import { tracingMiddleware } from './middleware/tracing.js';
import { metricsMiddleware, metricsEndpoint } from './middleware/metrics.js';
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
import healthRoutes from './routes/health.routes.js';
import { getConfig, initializeLogger, getLogger } from './config/index.js';
import { initializeMappers } from './application/mappers/index.js';
import { createContainer } from './infrastructure/container.js';
import { initializeTracer } from './infrastructure/tracing/index.js';
import { initializeMetrics } from './infrastructure/metrics/index.js';
import { initializeHealthChecker } from './infrastructure/health/index.js';
import type { ICommandRepository, IResourceRepository, IServiceRepository } from './domain/ports/repository.interfaces.js';

const config = getConfig();
const logger = initializeLogger(config);

// Initialize observability infrastructure early
initializeTracer();
initializeMetrics();
initializeHealthChecker();

// Initialize mappers early
initializeMappers();

// Initialize DI container and resolve repositories
const container = createContainer();
const commandRepository = container.get<ICommandRepository>('commandRepository');
const resourceRepository = container.get<IResourceRepository>('resourceRepository');
const serviceRepository = container.get<IServiceRepository>('serviceRepository');

const app: Application = express();
const PORT = config.api.port;
const HOST = config.api.host;

// Middleware global
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(tracingMiddleware);
app.use(metricsMiddleware);
app.use(requestLogger);
app.use(localhostOnly);

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

// Health check routes (Kubernetes-style probes)
app.use('/health', healthRoutes);

// Rutas principales (con inyección de dependencias)
app.use('/api/command', createCommandRoutes(commandRepository));
app.use('/api/resources', createResourceRoutes(resourceRepository));
app.use('/api/services', createServiceRoutes(serviceRepository));
app.use('/api/logs', auditRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/secrets', secretsRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/docker', dockerRoutes);
app.use('/api/databases', databaseRoutes);
app.use('/api/loadbalancer', loadBalancerRoutes);
app.use('/api/analytics', analyticsRoutes);

// Ruta por defecto
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'VPS Local Orchestrator API',
    version: '5.4.0',
    description: 'API para orquestar recursos y ejecutar comandos localmente - v5.4.0 Health Checks',
    endpoints: {
      health: 'GET /health',
      healthLiveness: 'GET /health/live',
      healthReadiness: 'GET /health/ready',
      healthStartup: 'GET /health/startup',
      metrics: 'GET /metrics',
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

// Iniciar servidor
app.listen(PORT, HOST, () => {
  logger.info('='.repeat(50));
  logger.info('🚀 VPS Local Orchestrator API');
  logger.info('='.repeat(50));
  logger.info(`📍 Server running at: http://${HOST}:${PORT}`);
  logger.info(`🔒 Access restricted to: localhost only`);
  logger.info(`⏰ Started at: ${new Date().toISOString()}`);
  logger.info('='.repeat(50));
  logger.info('\n🔑 API Configuration loaded:');
  logger.info(`   - API Token: ${config.security.apiToken.substring(0, 10)}...`);
  logger.info(`   - Sudo commands: ${config.security.allowSudoCommands ? '✅ Allowed' : '❌ Not allowed'}`);
  logger.info(`   - Log level: ${config.api.logLevel.toUpperCase()}`);
  logger.info('='.repeat(50));
  logger.info('\n📋 Available endpoints:');
  logger.info(`  - GET  ${HOST}:${PORT}/health`);
  logger.info(`  - POST ${HOST}:${PORT}/api/command/execute`);
  logger.info(`  - POST ${HOST}:${PORT}/api/command/batch`);
  logger.info(`  - GET  ${HOST}:${PORT}/api/resources`);
  logger.info(`  - GET  ${HOST}:${PORT}/api/resources/processes`);
  logger.info(`  - GET  ${HOST}:${PORT}/api/resources/network`);
  logger.info(`  - DEL  ${HOST}:${PORT}/api/resources/process/:pid`);
  logger.info(`  - POST ${HOST}:${PORT}/api/command/service`);
  
  logger.info('='.repeat(50));
});

export default app;
