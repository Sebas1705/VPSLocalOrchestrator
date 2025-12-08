/**
 * Repository Interfaces (Ports)
 *
 * Define contracts for data access, independent of storage implementation.
 * Implementations (adapters) sit in /infrastructure/adapters/.
 */

import type { CommandExecution } from '../domain/command/entities.js';
import type { Service } from '../domain/services/entities.js';

/**
 * CommandExecutionRepository: Contract for persisting command executions.
 */
export interface ICommandExecutionRepository {
  save(execution: CommandExecution): Promise<void>;
  findById(id: string): Promise<CommandExecution | null>;
  findLatest(limit: number): Promise<CommandExecution[]>;
}

/**
 * ServiceRepository: Contract for service state management.
 */
export interface IServiceRepository {
  findByName(name: string): Promise<Service | null>;
  findAll(): Promise<Service[]>;
  save(service: Service): Promise<void>;
}

/**
 * ConfigRepository: Contract for configuration access.
 */
export interface IConfigRepository {
  get(key: string): string | undefined;
  getAll(): Record<string, string>;
}

/**
 * Logger: Contract for logging.
 */
export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}
