import express, { type Request, type Response, type Router } from 'express';
import { getLogs, searchLogs } from '../services/auditLogger.js';

const router: Router = express.Router();

/**
 * GET /api/logs
 * Obtiene los logs de auditoría (últimos N registros)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const logs = await getLogs(limit);

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/logs/search
 * Busca logs de auditoría por criterios
 *
 * Body:
 * {
 *   "action": "command_execute",
 *   "status": "success",
 *   "startDate": "2025-12-05T00:00:00Z",
 *   "endDate": "2025-12-07T23:59:59Z",
 *   "limit": 50
 * }
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const query = {
      action: req.body.action,
      status: req.body.status,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      limit: req.body.limit ?? 100,
    };

    // Validar que startDate < endDate si ambos se especifican
    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate).getTime();
      const end = new Date(query.endDate).getTime();
      if (start > end) {
        return res.status(400).json({
          success: false,
          error: 'startDate must be before endDate',
        });
      }
    }

    const logs = await searchLogs(query);

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
