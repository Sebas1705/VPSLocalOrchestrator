import { createApp } from './app.js';
import { getConfig, initializeLogger, getLogger } from './config/index.js';
import { initializeMappers } from './application/mappers/index.js';
import { createContainer } from './infrastructure/container.js';
import { initializeTracer } from './infrastructure/tracing/index.js';
import { initializeMetrics } from './infrastructure/metrics/index.js';
import { initializeHealthChecker } from './infrastructure/health/index.js';
import { initializeJobQueue, getJobQueue } from './infrastructure/queue/index.js';
import { initializeRateLimiter } from './infrastructure/ratelimit/index.js';
import { initializeCircuitBreakers, initializeBackPressure } from './infrastructure/circuitbreaker/index.js';
import { processCommandJob, processBatchCommandJob } from './services/commandJobProcessor.js';
import { setCommandAuditSink } from './services/commandExecutor.js';
import { getCommandPolicyConfig } from './services/commandPolicy.js';
import { logAction } from './services/auditLogger.js';
import { initializeCache } from './infrastructure/cache/index.js';
import { initializeDistributedRateLimiter } from './infrastructure/ratelimit/distributed.js';
import { initializeOpenAPI } from './infrastructure/schema/openapi.js';
import { initializeSchemaMigrations } from './infrastructure/schema/migration.js';
import { initializeAuditLogger } from './infrastructure/audit/index.js';
import { initializeEventBus, eventBusMiddleware } from './infrastructure/events/index.js';
import { initializeEventStore } from './infrastructure/eventstore/index.js';
import { initializeEventProcessor } from './infrastructure/eventprocessor/index.js';
import { initializeEncryption } from './infrastructure/encryption/index.js';
import { initializeRBAC } from './infrastructure/rbac/index.js';
import { initializeThreatDetector } from './infrastructure/security/threat.js';
import type { ICommandRepository, IResourceRepository, IServiceRepository } from './domain/ports/repository.interfaces.js';
import { secretFingerprint } from './infrastructure/logging/redact.js';

const config = getConfig();
const logger = initializeLogger(config);

// Initialize observability infrastructure early
initializeTracer();
initializeMetrics();
initializeHealthChecker();
initializeRateLimiter();

// Initialize resilience infrastructure
initializeCircuitBreakers();
initializeBackPressure(100, 50); // max 100 queued, 50 concurrent

// Initialize distributed cache for horizontal scaling
initializeCache();
initializeDistributedRateLimiter();

// Initialize OpenAPI schema generation
initializeOpenAPI('VPS Local Orchestrator API', '6.2.0');

// Initialize schema migration system
initializeSchemaMigrations('6.3.0', 'header');

// Initialize audit logging
initializeAuditLogger();

// Initialize event bus
initializeEventBus(10000);

// Initialize event store
initializeEventStore(10);

// Initialize event processor
initializeEventProcessor();

// Initialize encryption service
const masterKey = process.env.ENCRYPTION_MASTER_KEY;
initializeEncryption(masterKey);

// Initialize RBAC
initializeRBAC();

// Initialize threat detector
initializeThreatDetector();

// Initialize job queue
const jobQueue = initializeJobQueue({
  maxConcurrency: 5,
  defaultTimeout: 300000, // 5 minutes
  defaultMaxAttempts: 3,
});

// Denied command attempts (allowlist, argument rules, metacharacters, sudo) go
// to the file-based audit log, queryable through /api/logs. Arguments are never
// recorded: a denied command line can carry a secret.
setCommandAuditSink((event) =>
  logAction(
    'command.denied',
    { executable: event.executable, argCount: event.argCount, source: event.source, statusCode: event.statusCode },
    'failure',
    event.reason
  )
);

// Register job processors
jobQueue.registerProcessor('command', processCommandJob);
jobQueue.registerProcessor('batch-command', processBatchCommandJob);

// Initialize mappers early
initializeMappers();

// Initialize DI container and resolve repositories
const container = createContainer();
const commandRepository = await container.get<ICommandRepository>('commandRepository');
const resourceRepository = await container.get<IResourceRepository>('resourceRepository');
const serviceRepository = await container.get<IServiceRepository>('serviceRepository');

const app = createApp({ commandRepository, resourceRepository, serviceRepository });
const PORT = config.api.port;
const HOST = config.api.host;
const isLoopback = HOST === '127.0.0.1' || HOST === '::1' || HOST === 'localhost';

// Iniciar servidor
app.listen(PORT, HOST, () => {
  logger.info('='.repeat(50));
  logger.info('🚀 VPS Local Orchestrator API');
  logger.info('='.repeat(50));
  logger.info(`📍 Server running at: http://${HOST}:${PORT}`);
  if (isLoopback) {
    logger.info('🔒 Listening on loopback only');
  } else {
    logger.warn(`⚠️  Listening on ${HOST}: reachable from other hosts. Only the bearer token and the rate limiter stand in the way.`);
  }
  logger.info(`⏰ Started at: ${new Date().toISOString()}`);
  logger.info('='.repeat(50));
  logger.info('\n🔑 API Configuration loaded:');
  logger.info(`   - API Token: configured (${secretFingerprint(config.security.apiToken)})`);
  logger.info(`   - Sudo commands: ${config.security.allowSudoCommands ? '✅ Allowed' : '❌ Not allowed'}`);
  logger.info(`   - Command allowlist: ${[...getCommandPolicyConfig().allowlist].join(', ') || '(empty: all commands denied)'}`);
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
