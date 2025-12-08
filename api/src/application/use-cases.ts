/**
 * Application Layer Use-Cases
 *
 * Orchestrate domain logic + infrastructure adapters.
 * Independent of HTTP/transport; can be tested in isolation.
 */

import { Command, CommandExecution } from '../domain/command/entities.js';
import type { CommandExecutionError } from '../domain/command/errors.js';
import type { ICommandExecutionRepository } from '../infrastructure/ports.js';

/**
 * ExecuteCommand Use-Case
 *
 * Steps:
 * 1. Validate command (domain)
 * 2. Create execution entity
 * 3. Execute via adapter
 * 4. Persist result
 * 5. Return outcome
 */
export class ExecuteCommandUseCase {
  constructor(
    private readonly repository: ICommandExecutionRepository,
    private readonly executor: (cmd: string, timeout: number) => Promise<{
      exitCode: number;
      stdout: string;
      stderr: string;
    }>
  ) {}

  async execute(command: Command, userId: string): Promise<CommandExecution | CommandExecutionError> {
    try {
      // Create execution entity
      const execution = new CommandExecution(
        `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        command,
        userId
      );

      // Start execution
      execution.start();

      // Execute command via adapter
      const result = await this.executor(command.value, command.timeout);

      // Complete execution
      execution.complete(result.exitCode, result.stdout, result.stderr);

      // Persist
      await this.repository.save(execution);

      return execution;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return err as CommandExecutionError;
    }
  }
}

/**
 * GetExecutionHistory Use-Case
 */
export class GetExecutionHistoryUseCase {
  constructor(private readonly repository: ICommandExecutionRepository) {}

  async execute(limit: number = 10): Promise<CommandExecution[]> {
    return this.repository.findLatest(limit);
  }
}
