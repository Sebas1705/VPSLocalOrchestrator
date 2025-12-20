import 'dotenv/config';
import { ConsoleLogger, LogLevel, LoggerFactory, type ILogger } from '../infrastructure/logging/index.js';

export interface Config {
  api: {
    port: number;
    host: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  security: {
    apiToken: string;
    enablePrivilegedEndpoints: boolean;
    allowSudoCommands: boolean;
    sudoPassword: string;
    secretKey: string;
  };
  commands: {
    maxTimeout: number;
    allowedScriptPaths: string[];
  };
  notifications: {
    alertEmail?: string | undefined;
    webhookLogUrl?: string | undefined;
  };
}

/**
 * Validar que las variables de entorno requeridas estén presentes
 */
function validateEnv(): void {
  const required = ['API_TOKEN', 'PORT', 'SECRET_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Variables de entorno requeridas no encontradas:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nCopia .env.example a .env y configura los valores:');
    console.error('   cp api/.env.example api/.env');
    process.exit(1);
  }
}

/**
 * Cargar y validar configuración
 */
export function getConfig(): Config {
  validateEnv();

  const config: Config = {
    api: {
      port: parseInt(process.env.PORT || '3000', 10),
      host: process.env.API_HOST || '127.0.0.1', // Permitir sobrescribir con API_HOST (para Docker)
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
    },
    security: {
      apiToken: process.env.API_TOKEN || '',
      enablePrivilegedEndpoints: process.env.ENABLE_PRIVILEGED_ENDPOINTS !== 'false',
      allowSudoCommands: process.env.ALLOW_SUDO_COMMANDS !== 'false',
      sudoPassword: process.env.SUDO_PASSWORD || '',
      secretKey: process.env.SECRET_KEY || '',
    },
    commands: {
      maxTimeout: parseInt(process.env.MAX_COMMAND_TIMEOUT || '300000', 10),
      allowedScriptPaths: (process.env.ALLOWED_SCRIPT_PATHS || '/scripts')
        .split(',')
        .map(p => p.trim()),
    },
    notifications: {
      alertEmail: process.env.ALERT_EMAIL || undefined,
      webhookLogUrl: process.env.WEBHOOK_LOG_URL || undefined,
    },
  };

  const keyBuffer = Buffer.from(config.security.secretKey, 'base64');
  if (keyBuffer.length !== 32) {
    console.error('❌ SECRET_KEY must be a base64-encoded 32-byte key for AES-256-GCM');
    process.exit(1);
  }

  return config;
}

/**
 * Create and initialize logger based on configuration
 */
export function initializeLogger(config: Config): ILogger {
  const logLevelMap: Record<string, LogLevel> = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
  };

  const logger = new ConsoleLogger(logLevelMap[config.api.logLevel] || LogLevel.INFO);
  LoggerFactory.initialize(logger);
  return logger;
}

/**
 * Get logger instance from factory
 */
export function getLogger(name?: string): ILogger {
  return LoggerFactory.getInstance().getLogger(name);
}
