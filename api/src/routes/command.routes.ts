import express from 'express';
import { z } from 'zod';
import { CommandController } from '../application/controllers/command.controller.js';
import { validateCommandBody } from '../middleware/security.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../application/validation-middleware.js';
import { ExecuteCommandRequestSchema, BatchCommandRequestSchema } from '../application/validation-schemas.js';

const router = express.Router();
const controller = new CommandController();

/**
 * POST /api/command/execute
 * Ejecuta un comando del sistema (requiere autenticación)
 */
router.post(
  '/execute',
  requireAuth,
  validateCommandBody,
  validateBody(ExecuteCommandRequestSchema),
  (req, res) => controller.executeCommand(req, res)
);

/**
 * POST /api/command/batch
 * Ejecuta múltiples comandos secuencialmente (requiere autenticación)
 */
router.post(
  '/batch',
  requireAuth,
  validateBody(BatchCommandRequestSchema),
  (req, res) => controller.executeBatch(req, res)
);

/**
 * POST /api/command/service
 * Gestiona servicios systemd (start, stop, restart, status, enable, disable)
 * Requiere autenticación
 */
router.post(
  '/service',
  requireAuth,
  validateBody(z.object({ service: z.string(), action: z.enum(['start', 'stop', 'restart', 'status', 'enable', 'disable']) })),
  (req, res) => controller.manageService(req, res)
);

export default router;
