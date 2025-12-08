/**
 * Child Process Command Executor Adapter
 *
 * Concrete implementation of ICommandExecutor using Node.js child_process.
 * All side-effects (spawning processes) are isolated here.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { ICommandExecutor, CommandExecutionOptions, CommandExecutionResult } from '../ports/os-adapters.js';

const execPromise = promisify(exec);

export class ChildProcessCommandExecutor implements ICommandExecutor {
  async execute(
    command: string,
    options: CommandExecutionOptions = {}
  ): Promise<CommandExecutionResult> {
    const startTime = Date.now();
    const timeout = options.timeout || 30000;
    const maxBuffer = options.maxBuffer || 10 * 1024 * 1024; // 10MB default

    try {
      const { stdout, stderr } = await execPromise(command, {
        timeout,
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        maxBuffer,
      });

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || error.message || 'Unknown error',
        exitCode: error.code || 1,
        duration: Date.now() - startTime,
      };
    }
  }
}
