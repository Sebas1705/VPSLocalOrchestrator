import express, { type Request, type Response, type Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  registerWebhook,
  listWebhooks,
  getWebhook,
  deleteWebhook,
  updateWebhook,
  testWebhook,
} from '../services/webhookManager.js';

const router: Router = express.Router();

// Todos los endpoints requieren autenticación
router.use(requireAuth);

/**
 * GET /api/webhooks
 * Lista todos los webhooks registrados
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const webhooks = await listWebhooks();

    res.json({
      success: true,
      count: webhooks.length,
      data: webhooks,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/webhooks
 * Registra un nuevo webhook
 *
 * Body:
 * {
 *   "url": "https://example.com/webhook",
 *   "events": ["command_execute", "service_status"],
 *   "secret": "optional-secret-for-signature"
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { url, events, secret } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'url is required',
      });
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'events array is required and must have at least one event',
      });
    }

    const webhook = await registerWebhook(url, events, secret);

    res.status(201).json({
      success: true,
      data: webhook,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/webhooks/:id
 * Obtiene un webhook específico
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const webhook = await getWebhook(id);

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found',
      });
    }

    res.json({
      success: true,
      data: webhook,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PATCH /api/webhooks/:id
 * Actualiza un webhook (activa/desactiva o cambia eventos)
 *
 * Body:
 * {
 *   "active": true,
 *   "events": ["command_execute"]
 * }
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { active, events } = req.body;

    const updates: Record<string, any> = {};
    if (active !== undefined) updates.active = active;
    if (events !== undefined) updates.events = events;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one field to update is required',
      });
    }

    const webhook = await updateWebhook(id, updates);

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found',
      });
    }

    res.json({
      success: true,
      data: webhook,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/webhooks/:id
 * Elimina un webhook
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deleted = await deleteWebhook(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found',
      });
    }

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/webhooks/:id/test
 * Envía un evento de prueba al webhook
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await testWebhook(id);

    res.json({
      success: true,
      message: 'Test webhook sent successfully',
    });
  } catch (error: any) {
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
