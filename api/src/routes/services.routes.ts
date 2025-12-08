import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { getServiceHealth, listActiveServices } from '../services/healthMonitor.js';
import { sendValidatedResponse, sendErrorResponse, validateQuery } from '../application/validation-middleware.js';
import { ServiceStatusResponseSchema } from '../application/validation-schemas.js';

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
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    sendErrorResponse(res, 'SERVICE_LIST_ERROR', error.message, 500);
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
      return sendErrorResponse(res, 'SERVICE_NAME_REQUIRED', 'Service name is required', 400);
    }

    const health = await getServiceHealth(serviceName);

    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    sendErrorResponse(res, 'SERVICE_HEALTH_ERROR', error.message, 500, { serviceName: req.params.name });
  }
});

export default router;
