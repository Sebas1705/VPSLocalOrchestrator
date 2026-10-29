/**
 * Child Process Command Executor Adapter
 *
 * Concrete implementation of ICommandExecutor using Node.js child_process.
 * All side-effects (spawning processes) are isolated here.
 *
 * Programs are started with execFile and an explicit argv, never through a
 * shell. Bare program names are resolved in the trusted directories from the
 * command policy (COMMAND_SEARCH_PATH), not via PATH.
 */

import { execFile } from 'child_process';
import path from 'path';
import type { ICommandExecutor, CommandExecutionOptions, CommandExecutionResult } from '../ports/os-adapters.js';
import { getCommandPolicyConfig, resolveExecutable } from '../../services/commandPolicy.js';

export class ChildProcessCommandExecutor implements ICommandExecutor {
  async execute(
    file: string,
    args: readonly string[] = [],
    options: CommandExecutionOptions = {}
  ): Promise<CommandExecutionResult> {
    const startTime = Date.now();
    const timeout = options.timeout || 30000;
    const maxBuffer = options.maxBuffer || 10 * 1024 * 1024; // 10MB default
    const program = path.isAbsolute(file)
      ? file
      : resolveExecutable(file, getCommandPolicyConfig().searchPath) ?? file;

    return new Promise((resolve) => {
      execFile(
        program,
        [...args],
        {
          timeout,
          cwd: options.cwd,
          env: { ...process.env, ...options.env },
          maxBuffer,
          shell: false,
          windowsHide: true,
        },
        (error: any, stdout: string | Buffer, stderr: string | Buffer) => {
          if (!error) {
            resolve({
              stdout: String(stdout ?? '').trim(),
              stderr: String(stderr ?? '').trim(),
              exitCode: 0,
              duration: Date.now() - startTime,
            });
            return;
          }
          resolve({
            stdout: String(error.stdout ?? stdout ?? '').trim(),
            stderr: String(error.stderr || stderr || '').trim() || error.message || 'Unknown error',
            exitCode: typeof error.code === 'number' ? error.code : error.code === 'ENOENT' ? 127 : 1,
            duration: Date.now() - startTime,
          });
        }
      );
    });
  }
}
