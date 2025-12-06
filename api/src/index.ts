import express, { type Application, type Request, type Response } from 'express';
import { localhostOnly, requestLogger, errorHandler } from './middleware/security.js';
import commandRoutes from './routes/command.routes.js';
import resourceRoutes from './routes/resources.routes.js';
import privilegedRoutes from './routes/privileged.routes.js';
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
app.use('/api/privileged', privilegedRoutes);

// Ruta por defecto
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'VPS Local Orchestrator API',
    version: '1.0.0',
    description: 'API para orquestar recursos y ejecutar comandos localmente',
    endpoints: {
      health: 'GET /health',
      executeCommand: 'POST /api/command/execute',
      batchCommands: 'POST /api/command/batch',
      systemResources: 'GET /api/resources',
      processes: 'GET /api/resources/processes',
      killProcess: 'DELETE /api/resources/process/:pid',
      privilegedExecute: 'POST /api/privileged/execute (requires token)',
      privilegedBatch: 'POST /api/privileged/batch (requires token)',
      privilegedService: 'POST /api/privileged/service (requires token)',
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
  logger.info(`   - Privileged endpoints: ${config.security.enablePrivilegedEndpoints ? '✅ Enabled' : '❌ Disabled'}`);
  logger.info(`   - Sudo commands: ${config.security.allowSudoCommands ? '✅ Allowed' : '❌ Not allowed'}`);
  logger.info(`   - Log level: ${config.api.logLevel.toUpperCase()}`);
  logger.info('='.repeat(50));
  logger.info('\n📋 Available endpoints:');
  logger.info(`  - GET  ${HOST}:${PORT}/health`);
  logger.info(`  - POST ${HOST}:${PORT}/api/command/execute`);
  logger.info(`  - POST ${HOST}:${PORT}/api/command/batch`);
  logger.info(`  - GET  ${HOST}:${PORT}/api/resources`);
  logger.info(`  - GET  ${HOST}:${PORT}/api/resources/processes`);
  logger.info(`  - DEL  ${HOST}:${PORT}/api/resources/process/:pid`);
  
  if (config.security.enablePrivilegedEndpoints) {
    logger.info('\n🔐 Privileged endpoints (require token):');
    logger.info(`  - POST ${HOST}:${PORT}/api/privileged/execute`);
    logger.info(`  - POST ${HOST}:${PORT}/api/privileged/batch`);
    logger.info(`  - POST ${HOST}:${PORT}/api/privileged/service`);
  }
  
  logger.info('='.repeat(50));
});

export default app;
