/**
 * Structured Logging Infrastructure
 * 
 * Provides structured JSON logging with configurable outputs.
 * Supports multiple log levels and context metadata.
 * 
 * @module infrastructure/logging
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log level hierarchy for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  traceId?: string;
  spanId?: string;
  duration?: number;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger interface - contract for all logger implementations
 */
export interface ILogger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, error?: Error | string, context?: Record<string, any>): void;
  setLevel(level: LogLevel): void;
  setTraceContext(traceId: string, spanId?: string): void;
}

/**
 * Console Logger - outputs structured JSON to stdout/stderr
 */
export class ConsoleLogger implements ILogger {
  private minLevel: LogLevel = LogLevel.INFO;
  private traceId?: string;
  private spanId?: string;

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error | string, context?: Record<string, any>): void {
    const errorObj = typeof error === 'string' ? { message: error } : error;
    this.log(LogLevel.ERROR, message, context, errorObj);
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  setTraceContext(traceId: string, spanId?: string): void {
    this.traceId = traceId;
    if (spanId !== undefined) {
      this.spanId = spanId;
    }
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error | { message: string }
  ): void {
    // Check log level filter
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
      ...(this.traceId && { traceId: this.traceId }),
      ...(this.spanId && { spanId: this.spanId }),
    };

    if (error) {
      const errorCode = (error as any).code || 'UNKNOWN_ERROR';
      const errorMessage = error.message;
      const errorStack = error instanceof Error && error.stack ? error.stack : undefined;
      
      entry.error = {
        code: errorCode,
        message: errorMessage,
        ...(errorStack && { stack: errorStack }),
      };
    }

    // Output to appropriate stream
    const output = JSON.stringify(entry);
    if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }
}

/**
 * File Logger - writes structured JSON to rotating log files
 */
export class FileLogger implements ILogger {
  private minLevel: LogLevel = LogLevel.INFO;
  private traceId?: string;
  private spanId?: string;
  private logDir: string;
  private maxFileSize: number; // bytes
  private maxFiles: number;
  private currentFile: string;

  constructor(
    logDir: string = './logs',
    maxFileSize: number = 10 * 1024 * 1024, // 10MB default
    maxFiles: number = 5,
    minLevel: LogLevel = LogLevel.INFO
  ) {
    this.logDir = logDir;
    this.maxFileSize = maxFileSize;
    this.maxFiles = maxFiles;
    this.minLevel = minLevel;
    this.currentFile = path.join(logDir, 'app.log');

    // Create log directory if not exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error | string, context?: Record<string, any>): void {
    const errorObj = typeof error === 'string' ? { message: error } : error;
    this.log(LogLevel.ERROR, message, context, errorObj);
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  setTraceContext(traceId: string, spanId?: string): void {
    this.traceId = traceId;
    if (spanId !== undefined) {
      this.spanId = spanId;
    }
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error | { message: string }
  ): void {
    // Check log level filter
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
      ...(this.traceId && { traceId: this.traceId }),
      ...(this.spanId && { spanId: this.spanId }),
    };

    if (error) {
      const errorCode = (error as any).code || 'UNKNOWN_ERROR';
      const errorMessage = error.message;
      const errorStack = error instanceof Error && error.stack ? error.stack : undefined;
      
      entry.error = {
        code: errorCode,
        message: errorMessage,
        ...(errorStack && { stack: errorStack }),
      };
    }

    try {
      this.writeToFile(JSON.stringify(entry));
    } catch (err) {
      // Fallback to console on write error
      console.error('Failed to write to log file:', err);
    }
  }

  private writeToFile(logLine: string): void {
    try {
      // Check if rotation needed
      if (fs.existsSync(this.currentFile)) {
        const stats = fs.statSync(this.currentFile);
        if (stats.size > this.maxFileSize) {
          this.rotateFiles();
        }
      }

      // Append log entry
      fs.appendFileSync(this.currentFile, logLine + '\n', 'utf8');
    } catch (err) {
      // Fallback to console on write error
      console.error('Failed to write to log file:', err);
    }
  }

  private rotateFiles(): void {
    try {
      // Delete oldest file if max files reached
      for (let i = this.maxFiles - 1; i > 0; i--) {
        const oldFile = path.join(this.logDir, `app.${i}.log`);
        const newFile = path.join(this.logDir, `app.${i + 1}.log`);

        if (fs.existsSync(oldFile)) {
          if (i + 1 <= this.maxFiles) {
            fs.renameSync(oldFile, newFile);
          } else {
            fs.unlinkSync(oldFile);
          }
        }
      }

      // Rotate current file
      if (fs.existsSync(this.currentFile)) {
        fs.renameSync(this.currentFile, path.join(this.logDir, 'app.1.log'));
      }
    } catch (err) {
      console.error('Failed to rotate log files:', err);
    }
  }
}

/**
 * Composite Logger - sends logs to multiple outputs
 */
export class CompositeLogger implements ILogger {
  private loggers: ILogger[] = [];

  add(logger: ILogger): this {
    this.loggers.push(logger);
    return this;
  }

  debug(message: string, context?: Record<string, any>): void {
    this.loggers.forEach(logger => logger.debug(message, context));
  }

  info(message: string, context?: Record<string, any>): void {
    this.loggers.forEach(logger => logger.info(message, context));
  }

  warn(message: string, context?: Record<string, any>): void {
    this.loggers.forEach(logger => logger.warn(message, context));
  }

  error(message: string, error?: Error | string, context?: Record<string, any>): void {
    this.loggers.forEach(logger => logger.error(message, error, context));
  }

  setLevel(level: LogLevel): void {
    this.loggers.forEach(logger => logger.setLevel(level));
  }

  setTraceContext(traceId: string, spanId?: string): void {
    this.loggers.forEach(logger => logger.setTraceContext(traceId, spanId));
  }
}

/**
 * Logger Factory - creates and manages logger instances
 */
export class LoggerFactory {
  private static instance: LoggerFactory;
  private defaultLogger: ILogger;
  private loggers: Map<string, ILogger> = new Map();

  private constructor(defaultLogger: ILogger) {
    this.defaultLogger = defaultLogger;
  }

  /**
   * Initialize factory with default logger configuration
   */
  static initialize(defaultLogger?: ILogger): LoggerFactory {
    if (!LoggerFactory.instance) {
      const logger = defaultLogger || new ConsoleLogger(LogLevel.INFO);
      LoggerFactory.instance = new LoggerFactory(logger);
    }
    return LoggerFactory.instance;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): LoggerFactory {
    if (!LoggerFactory.instance) {
      return LoggerFactory.initialize();
    }
    return LoggerFactory.instance;
  }

  /**
   * Get logger by name or default
   */
  getLogger(name?: string): ILogger {
    if (!name) return this.defaultLogger;
    if (!this.loggers.has(name)) {
      this.loggers.set(name, this.defaultLogger);
    }
    return this.loggers.get(name)!;
  }

  /**
   * Register custom logger
   */
  registerLogger(name: string, logger: ILogger): void {
    this.loggers.set(name, logger);
  }

  /**
   * Set default logger
   */
  setDefaultLogger(logger: ILogger): void {
    this.defaultLogger = logger;
  }
}
