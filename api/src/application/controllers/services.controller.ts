/**
 * Service Controller Implementation
 *
 * Handles HTTP requests for service management.
 * Delegates to application layer use-cases.
 */

import type { Request, Response } from 'express';
import type { IServiceController } from './controller.interfaces.js';
import { sendErrorResponse } from '../validation-middleware.js';
import { getServiceHealth, listActiveServices } from '../../services/healthMonitor.js';
import { ServiceNormalizer } from '../mappers/services.mappers.js';

export class ServiceController implements IServiceController {
  async listServices(req: Request, res: Response): Promise<void> {
    try {
      const services = await listActiveServices();
      res.json({
        success: true,
        data: services.map((s) => ServiceNormalizer.normalizeStatus(s)),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      sendErrorResponse(res, 'SERVICE_LIST_ERROR', error.message, 500);
    }
  }

  async getServiceHealth(req: Request, res: Response): Promise<void> {
    try {
      const serviceName = req.params.name ?? '';

      if (!serviceName) {
        sendErrorResponse(res, 'SERVICE_NAME_REQUIRED', 'Service name is required', 400);
        return;
      }

      const health = await getServiceHealth(serviceName);
      const normalized = ServiceNormalizer.normalizeStatus(health);

      res.json({
        success: normalized.status === 'active',
        data: normalized,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      sendErrorResponse(res, 'SERVICE_HEALTH_ERROR', error.message, 500);
    }
  }
}
