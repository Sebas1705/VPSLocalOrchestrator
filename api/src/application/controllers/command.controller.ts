/**
 * Command Controller Implementation
 *
 * Handles HTTP requests for command execution.
 * Throws domain errors for proper error handling middleware integration.
 */

import type { Request, Response } from 'express';
import type { ICommandController } from './controller.interfaces.js';
import type { ICommandRepository } from '../../domain/ports/repository.interfaces.js';
import { CommandExecutionError } from '../../domain/errors/index.js';
import { sendValidatedResponse } from '../validation-middleware.js';
import { CommandResultResponseSchema } from '../validation-schemas.js';
import { executeCommand } from '../../services/commandExecutor.js';
import { CommandResultResponseMapper } from '../mappers/command.mappers.js';
import { Command, CommandExecution } from '../../domain/command/entities.js';

export class CommandController implements ICommandController {
  private resultMapper = new CommandResultResponseMapper();
  private commandRepository: ICommandRepository;

  constructor(commandRepository: ICommandRepository) {
    this.commandRepository = commandRepository;
  }

  async executeCommand(req: Request, res: Response): Promise<void> {
    const { command, timeout, cwd, env } = (req as any).validatedBody;
    
    if (!command || command.trim().length === 0) {
      throw CommandExecutionError.invalidSyntax(command, 'Command cannot be empty');
    }

    const result = await executeCommand(command, {
      timeout: timeout || 30000,
      cwd,
      env,
    });

    // Check for execution failures
    if (result.exitCode !== 0 && result.stderr.includes('Permission denied')) {
      throw CommandExecutionError.denied(command, 'Permission denied - check sudo configuration');
    }

    // Create Command entity and CommandExecution record
    const cmdEntity = Command.create(command, timeout || 30000, cwd || '/tmp');
    const execution = new CommandExecution('generated', cmdEntity, 'api-user');
    execution.complete(result.exitCode, result.stdout, result.stderr);

    // Persist execution record in repository
    await this.commandRepository.create(execution);

    const response = this.resultMapper.mapTo(result);
    sendValidatedResponse(res, CommandResultResponseSchema, response);
  }

  async executeBatch(req: Request, res: Response): Promise<void> {
    const { commands } = (req as any).validatedBody;
    
    if (!Array.isArray(commands) || commands.length === 0) {
      throw CommandExecutionError.invalidSyntax('batch', 'Commands array cannot be empty');
    }

    const results = [];

    for (const cmd of commands) {
      if (typeof cmd === 'string') {
        if (!cmd.trim()) {
          throw CommandExecutionError.invalidSyntax(cmd, 'Individual commands cannot be empty');
        }

        const result = await executeCommand(cmd);
        
        // Persist each batch execution
        const cmdEntity = Command.create(cmd, 30000, '/tmp');
        const execution = new CommandExecution('generated', cmdEntity, 'api-user');
        execution.complete(result.exitCode, result.stdout, result.stderr);
        
        await this.commandRepository.create(execution);
        results.push({ command: cmd, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr });
      } else if (typeof cmd === 'object' && cmd.command) {
        if (!cmd.command.trim()) {
          throw CommandExecutionError.invalidSyntax(cmd.command, 'Command cannot be empty');
        }

        const result = await executeCommand(cmd.command, {
          timeout: cmd.timeout,
          cwd: cmd.cwd,
          env: cmd.env,
        });
        
        const cmdEntity = Command.create(cmd.command, cmd.timeout || 30000, cmd.cwd || '/tmp');
        const execution = new CommandExecution('generated', cmdEntity, 'api-user');
        execution.complete(result.exitCode, result.stdout, result.stderr);
        
        await this.commandRepository.create(execution);
        results.push({ command: cmd.command, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr });
      }
    }

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  }

  async manageService(req: Request, res: Response): Promise<void> {
    const { service, action } = (req as any).validatedBody;
    
    if (!service || service.trim().length === 0) {
      throw CommandExecutionError.invalidSyntax(service, 'Service name cannot be empty');
    }

    if (!['start', 'stop', 'restart', 'status', 'enable', 'disable'].includes(action)) {
      throw CommandExecutionError.invalidSyntax(action, 'Invalid service action');
    }

    // Read-only operations don't need sudo
    const readOnlyActions = ['status'];
    const needsSudo = !readOnlyActions.includes(action);
    
    const command = needsSudo 
      ? `sudo -n systemctl ${action} ${service}`
      : `systemctl ${action} ${service}`;
    
    const result = await executeCommand(command, { timeout: 30000 });

    // Only check sudo errors for operations that need sudo
    if (needsSudo && result.exitCode !== 0 && /sudo:|permission/i.test(result.stderr)) {
      throw CommandExecutionError.denied(command, 'Sudo not permitted or password required');
    }

    res.json({
      success: result.exitCode === 0,
      service,
        action,
        result: {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          duration: result.duration,
        },
        timestamp: new Date().toISOString(),
      });
  }
}
