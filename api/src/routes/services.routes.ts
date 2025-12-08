import express, { type Router } from 'express';
import { ServiceController } from '../application/controllers/services.controller.js';
import type { IServiceRepository } from '../domain/ports/repository.interfaces.js';

const router: Router = express.Router();

/**
 * Create route handlers with repository dependency injection
 */
export function createServiceRoutes(serviceRepository: IServiceRepository) {
  const controller = new ServiceController(serviceRepository);

  /**
   * GET /api/services
   * Lista servicios activos del sistema
   */
  router.get('/', (req, res) => controller.listServices(req, res));

  /**
   * GET /api/services/:name/health
   * Obtiene el estado de salud de un servicio
   */
  router.get('/:name/health', (req, res) => controller.getServiceHealth(req, res));

  return router;
}

export default router;
