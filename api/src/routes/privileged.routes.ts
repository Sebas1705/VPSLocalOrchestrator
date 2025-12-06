import express, { type Request, type Response, type Router } from 'express';
import { executeCommand } from '../services/commandExecutor.js';
import { isValidToken, extractToken } from '../middleware/auth.js';

const router: Router = express.Router();

/**
 * POST /api/privileged/execute
 * Ejecuta un comando privilegiado (requiere token)
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const token = extractToken(req.headers.authorization);
    
    if (!isValidToken(token)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Valid API token required for privileged operations',
      });
    }

    const { command, timeout, cwd, env } = req.body;

    if (!command || typeof command !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Command is required and must be a string',
      });
    }

    console.log(`[PRIVILEGED] Executing: ${command}`);

    const result = await executeCommand(command, {
      timeout: timeout || 30000,
      cwd,
      env,
    });

    res.json({
      success: result.exitCode === 0,
      result: {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration: result.duration,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/privileged/batch
 * Ejecuta múltiples comandos privilegiados secuencialmente
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const token = extractToken(req.headers.authorization);
    
    if (!isValidToken(token)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Valid API token required for privileged operations',
      });
    }

    const { commands } = req.body;

    if (!Array.isArray(commands) || commands.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Commands must be a non-empty array',
      });
    }

    console.log(`[PRIVILEGED] Executing batch: ${commands.length} commands`);

    const results = [];

    for (const cmd of commands) {
      if (typeof cmd === 'string') {
        const result = await executeCommand(cmd);
        results.push({
          command: cmd,
          ...result,
        });
      } else if (typeof cmd === 'object' && cmd.command) {
        const result = await executeCommand(cmd.command, {
          timeout: cmd.timeout,
          cwd: cmd.cwd,
          env: cmd.env,
        });
        results.push({
          command: cmd.command,
          ...result,
        });
      }
    }

    res.json({
      success: true,
      results,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/privileged/service
 * Gestiona servicios systemd (start, stop, restart, status)
 */
router.post('/service', async (req: Request, res: Response) => {
  try {
    const token = extractToken(req.headers.authorization);
    
    if (!isValidToken(token)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Valid API token required for privileged operations',
      });
    }

    const { service, action } = req.body;

    if (!service || !action) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Service name and action are required',
      });
    }

    const validActions = ['start', 'stop', 'restart', 'status', 'enable', 'disable'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Action must be one of: ${validActions.join(', ')}`,
      });
    }

    const command = `sudo systemctl ${action} ${service}`;
    console.log(`[PRIVILEGED] Service operation: ${command}`);

    const result = await executeCommand(command, { timeout: 30000 });

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
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
