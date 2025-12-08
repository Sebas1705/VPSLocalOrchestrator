/**
 * Command Controller Implementation
 *
 * Handles HTTP requests for command execution.
 * Delegates to application layer use-cases.
 */

import type { Request, Response } from 'express';
import type { ICommandController } from './controller.interfaces.js';
import { sendValidatedResponse, sendErrorResponse } from '../validation-middleware.js';
import { CommandResultResponseSchema } from '../validation-schemas.js';
import { executeCommand } from '../../services/commandExecutor.js';
import { CommandResultResponseMapper } from '../mappers/command.mappers.js';

export class CommandController implements ICommandController {
  private resultMapper = new CommandResultResponseMapper();

  async executeCommand(req: Request, res: Response): Promise<void> {
    try {
      const { command, timeout, cwd, env } = (req as any).validatedBody;
      
      const result = await executeCommand(command, {
        timeout: timeout || 30000,
        cwd,
        env,
      });

      const response = this.resultMapper.mapTo(result);
      sendValidatedResponse(res, CommandResultResponseSchema, response);
    } catch (error: any) {
      sendErrorResponse(res, 'COMMAND_EXECUTION_ERROR', error.message, 500);
    }
  }

  async executeBatch(req: Request, res: Response): Promise<void> {
    try {
      const { commands } = (req as any).validatedBody;
      const results = [];

      for (const cmd of commands) {
        if (typeof cmd === 'string') {
          const result = await executeCommand(cmd);
          results.push({ command: cmd, ...result });
        } else if (typeof cmd === 'object' && cmd.command) {
          const result = await executeCommand(cmd.command, {
            timeout: cmd.timeout,
            cwd: cmd.cwd,
            env: cmd.env,
          });
          results.push({ command: cmd.command, ...result });
        }
      }

      res.json({
        success: true,
        results,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      sendErrorResponse(res, 'BATCH_EXECUTION_ERROR', error.message, 500);
    }
  }

  async manageService(req: Request, res: Response): Promise<void> {
    try {
      const { service, action } = (req as any).validatedBody;
      const command = `sudo -n systemctl ${action} ${service}`;

      const result = await executeCommand(command, { timeout: 30000 });

      if (result.exitCode !== 0 && /sudo:|permission/i.test(result.stderr)) {
        sendErrorResponse(
          res,
          'SUDO_PERMISSION_DENIED',
          'Sudo not permitted or password required. Configure sudoers for passwordless access.',
          403,
          { service, action, stderr: result.stderr }
        );
        return;
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
    } catch (error: any) {
      sendErrorResponse(res, 'SERVICE_OPERATION_ERROR', error.message, 500);
    }
  }
}
