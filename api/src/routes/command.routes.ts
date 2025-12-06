import express from 'express';
import type { Request, Response } from 'express';
import { executeCommand } from '../services/commandExecutor.js';
import { validateCommandBody } from '../middleware/security.js';
import { requireAuth } from '../middleware/requireAuth.js';
const router = express.Router();

/**
 * POST /api/command/execute
 * Ejecuta un comando del sistema (requiere autenticación)
 */
router.post('/execute', requireAuth, validateCommandBody, async (req: Request, res: Response) => {
  console.log('[handler /execute] Handler ejecutado');
  try {
    const { command, timeout, cwd, env } = req.body;
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
 * POST /api/command/batch
 * Ejecuta múltiples comandos secuencialmente (requiere autenticación)
 */
router.post('/batch', requireAuth, async (req: Request, res: Response) => {
  try {
    const { commands } = req.body;
    if (!Array.isArray(commands) || commands.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Commands must be a non-empty array',
      });
    }
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
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
