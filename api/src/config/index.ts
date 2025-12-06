import 'dotenv/config';

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
  };
  commands: {
    maxTimeout: number;
    allowedScriptPaths: string[];
  };
  notifications: {
    alertEmail?: string;
    webhookLogUrl?: string;
  };
}

/**
 * Validar que las variables de entorno requeridas estén presentes
 */
function validateEnv(): void {
  const required = ['API_TOKEN', 'PORT'];
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
      host: '127.0.0.1', // Solo localhost por seguridad
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
    },
    security: {
      apiToken: process.env.API_TOKEN || '',
      enablePrivilegedEndpoints: process.env.ENABLE_PRIVILEGED_ENDPOINTS !== 'false',
      allowSudoCommands: process.env.ALLOW_SUDO_COMMANDS !== 'false',
      sudoPassword: process.env.SUDO_PASSWORD || '',
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

  return config;
}

/**
 * Logger configurable
 */
export class Logger {
  private logLevel: string;

  constructor(level: string = 'info') {
    this.logLevel = level;
  }

  private getLevelNumber(level: string): number {
    const levels: { [key: string]: number } = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] || 1;
  }

  debug(message: string, data?: any) {
    if (this.getLevelNumber('debug') >= this.getLevelNumber(this.logLevel)) {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  }

  info(message: string, data?: any) {
    if (this.getLevelNumber('info') >= this.getLevelNumber(this.logLevel)) {
      console.log(`[INFO] ${message}`, data || '');
    }
  }

  warn(message: string, data?: any) {
    if (this.getLevelNumber('warn') >= this.getLevelNumber(this.logLevel)) {
      console.warn(`[WARN] ${message}`, data || '');
    }
  }

  error(message: string, data?: any) {
    if (this.getLevelNumber('error') >= this.getLevelNumber(this.logLevel)) {
      console.error(`[ERROR] ${message}`, data || '');
    }
  }
}
