import express, { type Request, type Response, type Router } from 'express';
import { getServiceHealth, listActiveServices } from '../services/healthMonitor.js';

const router: Router = express.Router();

/**
 * GET /api/services
 * Lista servicios activos del sistema
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const services = await listActiveServices();
    res.json({
      success: true,
      data: services,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/services/:name/health
 * Obtiene el estado de salud de un servicio
 */
router.get('/:name/health', async (req: Request, res: Response) => {
  try {
    const serviceName = req.params.name ?? '';

    if (!serviceName) {
      return res.status(400).json({
        success: false,
        error: 'Service name is required',
      });
    }

    const health = await getServiceHealth(serviceName);

    res.json({
      success: true,
      data: health,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
