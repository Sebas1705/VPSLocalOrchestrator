/**
 * Command Job Processor
 * 
 * Processes long-running command execution jobs
 * Integrates with existing command execution service
 * 
 * @module services/commandJobProcessor
 */

import type { Job } from '../infrastructure/queue/index.js';
import { executeCommand } from './commandExecutor.js';
import { getLogger } from '../config/index.js';

const logger = getLogger('command-job-processor');

/**
 * Command job payload
 */
export interface CommandJobPayload {
  command: string;
  workingDir?: string;
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * Command job result
 */
export interface CommandJobResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  success: boolean;
}

/**
 * Process command execution job
 */
export async function processCommandJob(
  job: Job<CommandJobPayload>
): Promise<CommandJobResult> {
  const { command, workingDir, env, timeout } = job.payload;

  logger.info('Processing command job', {
    jobId: job.id,
    command: command.substring(0, 50),
    workingDir,
  });

  const startTime = Date.now();

  try {
    const options: { cwd?: string; env?: Record<string, string>; timeout?: number } = {};
    
    if (workingDir !== undefined) {
      options.cwd = workingDir;
    }
    
    if (env !== undefined) {
      options.env = { ...process.env, ...env } as Record<string, string>;
    }
    
    if (timeout !== undefined) {
      options.timeout = timeout;
    }

    const result = await executeCommand(command, options);

    const duration = Date.now() - startTime;
    const success = result.exitCode === 0;

    logger.info('Command job completed', {
      jobId: job.id,
      exitCode: result.exitCode,
      duration,
      success,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      duration,
      success,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Command job failed', error as Error, {
      jobId: job.id,
      duration,
    });

    throw error;
  }
}

/**
 * Batch command job payload
 */
export interface BatchCommandJobPayload {
  commands: Array<{
    command: string;
    workingDir?: string;
    env?: Record<string, string>;
  }>;
  stopOnError?: boolean;
}

/**
 * Batch command job result
 */
export interface BatchCommandJobResult {
  results: CommandJobResult[];
  totalDuration: number;
  successCount: number;
  failureCount: number;
}

/**
 * Process batch command execution job
 */
export async function processBatchCommandJob(
  job: Job<BatchCommandJobPayload>
): Promise<BatchCommandJobResult> {
  const { commands, stopOnError = true } = job.payload;

  logger.info('Processing batch command job', {
    jobId: job.id,
    commandCount: commands.length,
    stopOnError,
  });

  const startTime = Date.now();
  const results: CommandJobResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (!cmd) continue;

    try {
      const cmdStartTime = Date.now();
      
      const options: { cwd?: string; env?: Record<string, string> } = {};
      
      if (cmd.workingDir !== undefined) {
        options.cwd = cmd.workingDir;
      }
      
      if (cmd.env !== undefined) {
        options.env = { ...process.env, ...cmd.env } as Record<string, string>;
      }

      const result = await executeCommand(cmd.command, options);
      const duration = Date.now() - cmdStartTime;

      const cmdResult: CommandJobResult = {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration,
        success: result.exitCode === 0,
      };

      results.push(cmdResult);

      if (cmdResult.success) {
        successCount++;
      } else {
        failureCount++;

        if (stopOnError) {
          logger.warn('Batch job stopped due to command failure', {
            jobId: job.id,
            commandIndex: i,
            exitCode: result.exitCode,
          });
          break;
        }
      }
    } catch (error) {
      failureCount++;

      const cmdResult: CommandJobResult = {
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: -1,
        duration: 0,
        success: false,
      };

      results.push(cmdResult);

      if (stopOnError) {
        logger.error('Batch job stopped due to command error', error as Error, {
          jobId: job.id,
          commandIndex: i,
        });
        break;
      }
    }
  }

  const totalDuration = Date.now() - startTime;

  logger.info('Batch command job completed', {
    jobId: job.id,
    totalCommands: commands.length,
    executed: results.length,
    successCount,
    failureCount,
    totalDuration,
  });

  return {
    results,
    totalDuration,
    successCount,
    failureCount,
  };
}
