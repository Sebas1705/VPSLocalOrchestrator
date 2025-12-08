import express from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { executeCommand } from '../services/commandExecutor.js';
import { validateCommandBody } from '../middleware/security.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody, sendValidatedResponse, sendErrorResponse } from '../application/validation-middleware.js';
import { ExecuteCommandRequestSchema, BatchCommandRequestSchema, CommandResultResponseSchema } from '../application/validation-schemas.js';
const router = express.Router();

/**
 * POST /api/command/execute
 * Ejecuta un comando del sistema (requiere autenticación)
 */
router.post('/execute', requireAuth, validateCommandBody, validateBody(ExecuteCommandRequestSchema), async (req: Request, res: Response) => {
  console.log('[handler /execute] Handler ejecutado');
  try {
    const { command, timeout, cwd, env } = (req as any).validatedBody;
    const result = await executeCommand(command, {
      timeout: timeout || 30000,
      cwd,
      env,
    });
    const response = {
      success: result.exitCode === 0,
      result: {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration: result.duration,
      },
      timestamp: new Date().toISOString(),
    };
    sendValidatedResponse(res, CommandResultResponseSchema, response);
  } catch (error: any) {
    sendErrorResponse(res, 'COMMAND_EXECUTION_ERROR', error.message, 500, { command: req.body.command });
  }
});

/**
 * POST /api/command/batch
 * Ejecuta múltiples comandos secuencialmente (requiere autenticación)
 */
router.post('/batch', requireAuth, validateBody(BatchCommandRequestSchema), async (req: Request, res: Response) => {
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
});

/**
 * POST /api/command/service
 * Gestiona servicios systemd (start, stop, restart, status, enable, disable)
 * Requiere autenticación
 */
router.post('/service', requireAuth, validateBody(z.object({ service: z.string(), action: z.enum(['start', 'stop', 'restart', 'status', 'enable', 'disable']) })), async (req: Request, res: Response) => {
  try {
    const { service, action } = (req as any).validatedBody;

    const command = `sudo -n systemctl ${action} ${service}`; // -n evita prompt interactivo
    console.log(`[command] Service operation: ${command}`);

    const result = await executeCommand(command, { timeout: 30000 });

    // Si sudo falla por falta de permisos o requiere password, retorna 403
    if (result.exitCode !== 0 && /sudo:|permission/i.test(result.stderr)) {
      return sendErrorResponse(
        res,
        'SUDO_PERMISSION_DENIED',
        'Sudo not permitted or password required. Configure sudoers for passwordless access.',
        403,
        { service, action, stderr: result.stderr }
      );
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
    sendErrorResponse(res, 'SERVICE_OPERATION_ERROR', error.message, 500, { service: req.body.service, action: req.body.action });
  }
});

export default router;
