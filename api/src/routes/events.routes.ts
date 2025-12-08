import { Router } from 'express';
import type { Request, Response } from 'express';
import { getEventBus, EventCategory, DomainEventType } from '../infrastructure/events/index.js';
import { LoggerFactory } from '../infrastructure/logging/index.js';

const router = Router();
const logger = LoggerFactory.getInstance().getLogger();

/**
 * Event Bus Routes - v7.1.0
 * 
 * REST API for event bus management and subscription handling
 */

// ============================================================================
// EVENT SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * GET /api/events/subscriptions
 * Get all active subscriptions, optionally filtered by event type
 */
router.get('/subscriptions', (req: Request, res: Response) => {
  const eventBus = getEventBus();
  const eventType = req.query.type as string | undefined;

  const subscriptions = eventBus.getSubscriptions(eventType);

  const formattedSubscriptions = subscriptions.map(sub => ({
    id: sub.id,
    eventType: sub.eventType,
    priority: sub.priority,
    isOnce: sub.once,
    createdAt: sub.createdAt.toISOString()
  }));

  res.json({
    total: formattedSubscriptions.length,
    subscriptions: formattedSubscriptions,
    ...(eventType && { filteredByType: eventType })
  });
});

/**
 * GET /api/events/subscriptions/:subscriptionId
 * Get specific subscription details
 */
router.get('/subscriptions/:subscriptionId', (req: Request, res: Response) => {
  const eventBus = getEventBus();
  const subscriptions = eventBus.getSubscriptions();
  const subscription = subscriptions.find(s => s.id === req.params.subscriptionId);

  if (!subscription) {
    return res.status(404).json({ error: 'Subscription not found' });
  }

  res.json({
    id: subscription.id,
    eventType: subscription.eventType,
    priority: subscription.priority,
    isOnce: subscription.once,
    createdAt: subscription.createdAt.toISOString()
  });
});

/**
 * DELETE /api/events/subscriptions/:subscriptionId
 * Unsubscribe from event type (requires auth)
 */
router.delete('/subscriptions/:subscriptionId', (req: Request, res: Response) => {
  const eventBus = getEventBus();
  const subscriptionId = req.params.subscriptionId || '';
  const success = eventBus.unsubscribe(subscriptionId);

  if (!success) {
    return res.status(404).json({ error: 'Subscription not found' });
  }

  logger.info(`Subscription removed: ${req.params.subscriptionId}`);
  res.json({
    message: 'Subscription removed successfully',
    subscriptionId: req.params.subscriptionId
  });
});

// ============================================================================
// EVENT PUBLISHING AND HISTORY
// ============================================================================

/**
 * POST /api/events/publish
 * Publish event to subscribers (requires auth)
 */
router.post('/publish', async (req: Request, res: Response) => {
  const { eventType, payload, category, source } = req.body;

  if (!eventType) {
    return res.status(400).json({ error: 'eventType is required' });
  }

  const eventBus = getEventBus();

  try {
    const correlationId = req.get('x-correlation-id') || `corr-${Date.now()}`;
    
    await eventBus.publish(eventType, payload || {}, {
      category: (category as EventCategory) || EventCategory.DOMAIN,
      source: source || 'api-publish',
      correlationId,
      traceId: (req as any).traceId
    });

    logger.info(`Event published via API: ${eventType}`);
    
    res.status(202).json({
      message: 'Event published successfully',
      eventType,
      correlationId
    });
  } catch (error) {
    logger.error('Error publishing event:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to publish event' });
  }
});

/**
 * GET /api/events/history
 * Get event history with optional filtering
 */
router.get('/history', (req: Request, res: Response) => {
  const eventBus = getEventBus();
  
  const eventType = req.query.type as string | undefined;
  const category = req.query.category as EventCategory | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const since = req.query.since ? new Date(req.query.since as string) : undefined;

  // Validate since date
  if (since && isNaN(since.getTime())) {
    return res.status(400).json({ error: 'Invalid "since" date format' });
  }

  const historyFilter: any = { limit };
  if (eventType) historyFilter.eventType = eventType;
  if (category) historyFilter.category = category;
  if (since) historyFilter.since = since;

  const events = eventBus.getHistory(historyFilter);

  res.json({
    total: events.length,
    limit,
    ...(eventType && { filteredByType: eventType }),
    ...(category && { filteredByCategory: category }),
    events: events.map(evt => ({
      id: evt.id,
      type: evt.type,
      category: evt.category,
      timestamp: evt.timestamp.toISOString(),
      source: evt.source,
      correlationId: evt.correlationId,
      causationId: evt.causationId,
      payloadSummary: typeof evt.payload === 'string'
        ? evt.payload.substring(0, 100)
        : JSON.stringify(evt.payload).substring(0, 100)
    }))
  });
});

/**
 * GET /api/events/history/:eventId
 * Get specific event from history
 */
router.get('/history/:eventId', (req: Request, res: Response) => {
  const eventBus = getEventBus();
  const history = eventBus.getHistory({ limit: 10000 });
  const event = history.find(e => e.id === req.params.eventId);

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  res.json({
    id: event.id,
    type: event.type,
    category: event.category,
    timestamp: event.timestamp.toISOString(),
    source: event.source,
    traceId: event.traceId,
    correlationId: event.correlationId,
    causationId: event.causationId,
    payload: event.payload
  });
});

// ============================================================================
// STATISTICS AND MONITORING
// ============================================================================

/**
 * GET /api/events/stats
 * Get event bus statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  const eventBus = getEventBus();
  const stats = eventBus.getStats();

  res.json({
    summary: {
      totalSubscriptions: stats.totalSubscriptions,
      publishedEvents: stats.publishedEventsCount,
      failedHandlers: stats.failedHandlers,
      averageHandlerTime: Math.round(stats.averageHandlerTime * 100) / 100
    },
    subscriptionsByType: stats.subscriptionsByType,
    handlersByType: stats.handlersByType,
    topEventTypes: Object.entries(stats.subscriptionsByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([eventType, count]) => ({ eventType, subscriptions: count }))
  });
});

/**
 * POST /api/events/stats/reset
 * Reset statistics (requires auth)
 */
router.post('/stats/reset', (req: Request, res: Response) => {
  const eventBus = getEventBus();
  eventBus.resetStats();

  logger.info('Event bus statistics reset');
  res.json({ message: 'Statistics reset successfully' });
});

// ============================================================================
// EVENT DOMAIN LISTING
// ============================================================================

/**
 * GET /api/events/domains
 * Get list of available event domains
 */
router.get('/domains', (req: Request, res: Response) => {
  const domainEvents = Object.entries(DomainEventType).map(([key, value]) => ({
    name: key,
    value,
    category: categorizeEvent(value as string)
  }));

  const grouped: Record<string, any[]> = {};
  for (const event of domainEvents) {
    if (!grouped[event.category]) {
      grouped[event.category] = [];
    }
    const category = grouped[event.category];
    if (category) {
      category.push({
        name: event.name,
        value: event.value
      });
    }
  }

  res.json({
    total: domainEvents.length,
    categories: Object.keys(grouped),
    eventsByCategory: grouped,
    allEvents: domainEvents
  });
});

function categorizeEvent(eventValue: string): string {
  if (eventValue.startsWith('command.')) return 'command';
  if (eventValue.startsWith('resource.')) return 'resource';
  if (eventValue.startsWith('job.')) return 'job';
  if (eventValue.startsWith('service.')) return 'service';
  if (eventValue.startsWith('config.')) return 'config';
  return 'other';
}

/**
 * GET /api/events/domains/:category
 * Get events for specific category
 */
router.get('/domains/:category', (req: Request, res: Response) => {
  const { category } = req.params;
  
  const domainEvents = Object.entries(DomainEventType)
    .filter(([, value]) => {
      const eventCategory = categorizeEvent(value as string);
      return eventCategory === category;
    })
    .map(([key, value]) => ({
      name: key,
      value
    }));

  if (domainEvents.length === 0) {
    return res.status(404).json({ error: `No events found for category: ${category}` });
  }

  res.json({
    category,
    total: domainEvents.length,
    events: domainEvents
  });
});

export default router;
