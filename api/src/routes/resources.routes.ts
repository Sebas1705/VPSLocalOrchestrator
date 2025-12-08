import express, { type Router } from 'express';
import { z } from 'zod';
import { ResourceController } from '../application/controllers/resources.controller.js';
import { validateQuery } from '../application/validation-middleware.js';

const router: Router = express.Router();
const controller = new ResourceController();

/**
 * GET /api/resources
 * Obtiene los recursos del sistema
 */
router.get('/', (req, res) => controller.getResources(req, res));

/**
 * GET /api/resources/processes
 * Obtiene lista de procesos
 */
router.get(
  '/processes',
  validateQuery(z.object({ limit: z.coerce.number().int().positive().optional().default(10) })),
  (req, res) => controller.getProcesses(req, res)
);

/**
 * GET /api/resources/network
 * Obtiene estadísticas de red
 */
router.get('/network', (req, res) => controller.getNetwork(req, res));

/**
 * DELETE /api/resources/process/:pid
 * Mata un proceso por PID
 */
router.delete('/process/:pid', (req, res) => controller.killProcess(req, res));

/**
 * POST /api/resources/process/:pid/priority
 * Cambia la prioridad (nice value) de un proceso
 */
router.post('/process/:pid/priority', (req, res) => controller.setPriority(req, res));

export default router;
