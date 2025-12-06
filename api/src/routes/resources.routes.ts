import express, { type Request, type Response, type Router } from 'express';
import { getSystemResources, getProcessList, killProcess } from '../services/resourceMonitor.js';

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
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/resources/processes
 * Obtiene lista de procesos
 */
router.get('/processes', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const processes = await getProcessList(limit);
    
    res.json({
      success: true,
      data: processes,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/resources/process/:pid
 * Mata un proceso por PID
 */
router.delete('/process/:pid', async (req: Request, res: Response) => {
  try {
    const pid = parseInt(req.params.pid);
    const signal = (req.query.signal as string) || 'TERM';

    if (isNaN(pid)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid PID',
      });
    }

    const success = await killProcess(pid, signal);
    
    res.json({
      success,
      message: success ? `Process ${pid} killed successfully` : `Failed to kill process ${pid}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
