import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { getSystemResources, getProcessList, killProcess, setProcessPriority } from '../services/resourceMonitor.js';
import { getNetworkStats } from '../services/networkMonitor.js';
import { sendValidatedResponse, sendErrorResponse, validateQuery } from '../application/validation-middleware.js';
import { SystemResourcesResponseSchema } from '../application/validation-schemas.js';

const router: Router = express.Router();

/**
 * GET /api/resources
 * Obtiene los recursos del sistema
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const resources = await getSystemResources();
    res.json({
      success: true,
      data: resources,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    sendErrorResponse(res, 'RESOURCE_FETCH_ERROR', error.message, 500);
  }
});

/**
 * GET /api/resources/processes
 * Obtiene lista de procesos
 */
router.get('/processes', validateQuery(z.object({ limit: z.coerce.number().int().positive().optional().default(10) })), async (req: Request, res: Response) => {
  try {
    const limit = (req as any).validatedQuery?.limit || 10;
    const processes = await getProcessList(limit);
    
    res.json({
      success: true,
      data: processes,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    sendErrorResponse(res, 'PROCESS_LIST_ERROR', error.message, 500);
  }
});

/**
 * GET /api/resources/network
 * Obtiene estadísticas de red
 */
router.get('/network', async (req: Request, res: Response) => {
  try {
    const networkStats = await getNetworkStats();
    res.json({
      success: true,
      data: networkStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    sendErrorResponse(res, 'NETWORK_STATS_ERROR', error.message, 500);
  }
});

/**
 * DELETE /api/resources/process/:pid
 * Mata un proceso por PID
 */
router.delete('/process/:pid', async (req: Request, res: Response) => {
  try {
    const pid = parseInt(req.params.pid ?? '');
    const signal = (req.query.signal as string) || 'TERM';

    if (isNaN(pid)) {
      return sendErrorResponse(res, 'INVALID_PID', 'Invalid PID', 400);
    }

    const success = await killProcess(pid, signal);
    
    res.json({
      success,
      message: success ? `Process ${pid} killed successfully` : `Failed to kill process ${pid}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    sendErrorResponse(res, 'PROCESS_KILL_ERROR', error.message, 500, { pid: req.params.pid });
  }
});

/**
 * POST /api/resources/process/:pid/priority
 * Cambia la prioridad (nice value) de un proceso
 */
router.post('/process/:pid/priority', async (req: Request, res: Response) => {
  try {
    const pid = parseInt(req.params.pid ?? '');
    const { priority } = req.body;

    if (isNaN(pid)) {
      return sendErrorResponse(res, 'INVALID_PID', 'Invalid PID', 400);
    }

    if (typeof priority !== 'number' || isNaN(priority)) {
      return sendErrorResponse(res, 'INVALID_PRIORITY', 'Priority must be a number between -20 and 19', 400);
    }

    const result = await setProcessPriority(pid, priority);

    if (result.success) {
      res.json({
        ...result,
        timestamp: new Date().toISOString(),
      });
    } else {
      sendErrorResponse(res, 'PROCESS_PRIORITY_ERROR', 'Failed to set process priority', 400);
    }
  } catch (error: any) {
    sendErrorResponse(res, 'PROCESS_PRIORITY_ERROR', error.message, 500, { pid: req.params.pid, priority: req.body.priority });
  }
});

export default router;
