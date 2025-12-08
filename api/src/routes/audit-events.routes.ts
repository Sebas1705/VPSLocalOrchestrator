/**
 * Audit Logging Routes
 * 
 * Endpoints for accessing and managing audit logs
 * 
 * @module routes/audit.routes
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  getAuditLogger,
  initializeAuditLogger,
  AuditEventType,
  AuditSeverity,
} from '../infrastructure/audit/index.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getLogger } from '../config/index.js';

const logger = getLogger('audit-routes');
const router = Router();

// Initialize audit logger
initializeAuditLogger();
const auditLogger = getAuditLogger();

/**
 * GET /api/audit/events
 * Get audit events with filtering
 */
router.get('/events', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      type,
      severity,
      actor,
      resource,
      startTime,
      endTime,
      limit,
      offset,
    } = req.query;

    const query: any = {
      limit: limit ? parseInt(limit as string) : 100,
      offset: offset ? parseInt(offset as string) : 0,
    };

    if (type) query.type = type as AuditEventType;
    if (severity) query.severity = severity as AuditSeverity;
    if (actor) query.actor = actor as string;
    if (resource) query.resource = resource as string;
    if (startTime) query.startTime = parseInt(startTime as string);
    if (endTime) query.endTime = parseInt(endTime as string);

    const result = await auditLogger.query(query);

    res.json({
      events: result.events,
      total: result.total,
      limit: limit ? parseInt(limit as string) : 100,
      offset: offset ? parseInt(offset as string) : 0,
    });
  } catch (error) {
    logger.error('Failed to query audit events', error as Error);
    res.status(500).json({ error: 'Failed to query audit events' });
  }
});

/**
 * GET /api/audit/events/:id
 * Get specific audit event
 */
router.get('/events/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id?: string };

    if (!id) {
      res.status(400).json({ error: 'Event ID required' });
      return;
    }

    const event = await auditLogger.getEvent(id);

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json(event);
  } catch (error) {
    logger.error('Failed to get audit event', error as Error);
    res.status(500).json({ error: 'Failed to get audit event' });
  }
});

/**
 * GET /api/audit/types
 * Get available event types
 */
router.get('/types', requireAuth, (req: Request, res: Response) => {
  try {
    const types = Object.values(AuditEventType);

    res.json({
      count: types.length,
      types,
    });
  } catch (error) {
    logger.error('Failed to get event types', error as Error);
    res.status(500).json({ error: 'Failed to get event types' });
  }
});

/**
 * GET /api/audit/statistics
 * Get audit statistics
 */
router.get('/statistics', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await auditLogger.getStatistics();

    res.json(stats);
  } catch (error) {
    logger.error('Failed to get audit statistics', error as Error);
    res.status(500).json({ error: 'Failed to get audit statistics' });
  }
});

/**
 * GET /api/audit/critical
 * Get critical events
 */
router.get('/critical', requireAuth, async (req: Request, res: Response) => {
  try {
    const { hours = '24' } = req.query;
    const h = parseInt(hours as string) || 24;

    const events = await auditLogger.getCriticalEvents(h);

    res.json({
      count: events.length,
      hours: h,
      events,
    });
  } catch (error) {
    logger.error('Failed to get critical events', error as Error);
    res.status(500).json({ error: 'Failed to get critical events' });
  }
});

/**
 * GET /api/audit/export
 * Export audit log
 */
router.get('/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      type,
      severity,
      startTime,
      endTime,
      format = 'json',
    } = req.query;

    const exportQuery: any = {
      limit: 10000,
    };

    if (type) exportQuery.type = type as AuditEventType;
    if (severity) exportQuery.severity = severity as AuditSeverity;
    if (startTime) exportQuery.startTime = parseInt(startTime as string);
    if (endTime) exportQuery.endTime = parseInt(endTime as string);

    const events = await auditLogger.export(exportQuery);

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'id',
        'timestamp',
        'type',
        'severity',
        'actor',
        'action',
        'status',
      ];
      const rows = events.map((e) => [
        e.id,
        new Date(e.timestamp).toISOString(),
        e.type,
        e.severity,
        e.actor.id,
        e.action,
        e.status,
      ]);

      const csv =
        [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(','))
          .join('\n');

      res.type('text/csv');
      res.attachment(`audit-export-${Date.now()}.csv`);
      res.send(csv);
    } else {
      // JSON (default)
      res.type('application/json');
      res.attachment(`audit-export-${Date.now()}.json`);
      res.json(events);
    }
  } catch (error) {
    logger.error('Failed to export audit log', error as Error);
    res.status(500).json({ error: 'Failed to export audit log' });
  }
});

/**
 * POST /api/audit/cleanup
 * Cleanup old events (requires auth)
 */
router.post(
  '/cleanup',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { daysToKeep = 90 } = req.body as { daysToKeep?: number };

      const removed = await auditLogger.clearOldEvents(daysToKeep);

      res.json({
        message: 'Old audit events cleared',
        removed,
        daysToKeep,
      });
    } catch (error) {
      logger.error('Failed to cleanup audit events', error as Error);
      res.status(500).json({ error: 'Failed to cleanup audit events' });
    }
  }
);

export default router;
