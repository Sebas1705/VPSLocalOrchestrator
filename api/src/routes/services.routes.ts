import express, { type Router } from 'express';
import { ServiceController } from '../application/controllers/services.controller.js';

const router: Router = express.Router();
const controller = new ServiceController();

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

export default router;
