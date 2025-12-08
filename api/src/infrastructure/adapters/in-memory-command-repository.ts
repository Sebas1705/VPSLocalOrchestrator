/**
 * In-Memory Command Execution Repository Adapter
 *
 * Simple implementation for testing and development.
 * Can be replaced with database adapter in production.
 */

import type { CommandExecution } from '../../domain/command/entities.js';
import type { ICommandExecutionRepository } from '../ports.js';

export class InMemoryCommandExecutionRepository implements ICommandExecutionRepository {
  private executions = new Map<string, CommandExecution>();

  async save(execution: CommandExecution): Promise<void> {
    this.executions.set(execution.id, execution);
  }

  async findById(id: string): Promise<CommandExecution | null> {
    return this.executions.get(id) ?? null;
  }

  async findLatest(limit: number): Promise<CommandExecution[]> {
    return Array.from(this.executions.values()).slice(-limit);
  }

  clear(): void {
    this.executions.clear();
  }
}
