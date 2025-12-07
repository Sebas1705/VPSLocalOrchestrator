import express, { type Application, type Request, type Response } from 'express';
import { localhostOnly, requestLogger, errorHandler } from './middleware/security.js';
import commandRoutes from './routes/command.routes.js';
import resourceRoutes from './routes/resources.routes.js';
import servicesRoutes from './routes/services.routes.js';
import auditRoutes from './routes/audit.routes.js';
import fileRoutes from './routes/file.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import secretsRoutes from './routes/secrets.routes.js';
import backupRoutes from './routes/backup.routes.js';
import { getConfig, Logger } from './config/index.js';

const config = getConfig();
const logger = new Logger(config.api.logLevel);

const app: Application = express();
const PORT = config.api.port;
const HOST = config.api.host;

// Middleware global
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
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

// Rutas principales
app.use('/api/command', commandRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/logs', auditRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/secrets', secretsRoutes);
app.use('/api/backups', backupRoutes);

// Ruta por defecto
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'VPS Local Orchestrator API',
    version: '2.0.0',
    description: 'API para orquestar recursos y ejecutar comandos localmente',
    endpoints: {
      health: 'GET /health',
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
    },
  });
});

// Manejador de rutas no encontradas
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

// Middleware de manejo de errores
app.use(errorHandler);

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
