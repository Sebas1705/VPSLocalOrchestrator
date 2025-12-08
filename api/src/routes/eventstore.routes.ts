import { Router } from 'express';
import type { Request, Response } from 'express';
import { getEventStore } from '../infrastructure/eventstore/index.js';
import { LoggerFactory } from '../infrastructure/logging/index.js';

const router = Router();
const logger = LoggerFactory.getInstance().getLogger();

/**
 * Event Store Routes - v7.2.0
 * 
 * REST API for event sourcing and aggregate stream management
 */

// ============================================================================
// AGGREGATE STREAM MANAGEMENT
// ============================================================================

/**
 * GET /api/eventstore/aggregates
 * Get all aggregate IDs, optionally filtered by type
 */
router.get('/aggregates', (req: Request, res: Response) => {
  const eventStore = getEventStore();
  const aggregateType = req.query.type as string | undefined;

  const aggregateIds = eventStore.getAllAggregateIds(aggregateType);

  res.json({
    total: aggregateIds.length,
    aggregateType: aggregateType || 'all',
    aggregates: aggregateIds.map(id => ({
      id,
      stream: `/api/eventstore/aggregates/${id}`
    }))
  });
});

/**
 * GET /api/eventstore/aggregates/:aggregateId
 * Get aggregate stream metadata and stats
 */
router.get('/aggregates/:aggregateId', (req: Request, res: Response) => {
  const eventStore = getEventStore();
  const aggregateId = req.params.aggregateId || '';
  const stream = eventStore.getAggregateStream(aggregateId);

  if (!stream) {
    return res.status(404).json({ error: 'Aggregate not found' });
  }

  res.json({
    aggregateId: stream.aggregateId,
    aggregateType: stream.aggregateType,
    status: stream.status,
    version: stream.version,
    eventCount: stream.eventCount,
    lastEventAt: stream.lastEventAt.toISOString(),
    snapshot: (stream as any).snapshotAt
      ? {
          at: (stream as any).snapshotAt.toISOString(),
          version: (stream as any).snapshotVersion
        }
      : null,
    links: {
      events: `/api/eventstore/aggregates/${stream.aggregateId}/events`,
      snapshots: `/api/eventstore/aggregates/${stream.aggregateId}/snapshots`,
      replay: `/api/eventstore/aggregates/${stream.aggregateId}/replay`
    }
  });
});

// ============================================================================
// EVENT STREAM OPERATIONS
// ============================================================================

/**
 * GET /api/eventstore/aggregates/:aggregateId/events
 * Get events for an aggregate with filtering and replay options
 */
router.get('/aggregates/:aggregateId/events', (req: Request, res: Response) => {
  const eventStore = getEventStore();
  const aggregateId = req.params.aggregateId || '';

  const fromVersion = req.query.fromVersion ? parseInt(req.query.fromVersion as string) : undefined;
  const toVersion = req.query.toVersion ? parseInt(req.query.toVersion as string) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const fromTimestamp = req.query.from ? new Date(req.query.from as string) : undefined;
  const toTimestamp = req.query.to ? new Date(req.query.to as string) : undefined;

  // Validate timestamps
  if ((fromTimestamp && isNaN(fromTimestamp.getTime())) || (toTimestamp && isNaN(toTimestamp.getTime()))) {
    return res.status(400).json({ error: 'Invalid timestamp format' });
  }

  const replayOptions: any = { limit };
  if (fromVersion !== undefined) replayOptions.fromVersion = fromVersion;
  if (toVersion !== undefined) replayOptions.toVersion = toVersion;
  if (fromTimestamp) replayOptions.fromTimestamp = fromTimestamp;
  if (toTimestamp) replayOptions.toTimestamp = toTimestamp;

  const events = eventStore.getAggregateEvents(aggregateId, replayOptions);

  res.json({
    aggregateId: req.params.aggregateId,
    total: events.length,
    limit,
    events: events.map(evt => ({
      id: evt.id,
      eventType: evt.eventType,
      version: evt.eventVersion,
      timestamp: evt.timestamp.toISOString(),
      sequenceNumber: evt.sequenceNumber,
      correlationId: evt.correlationId,
      causationId: evt.causationId
    }))
  });
});

/**
 * GET /api/eventstore/aggregates/:aggregateId/events/:eventId
 * Get specific event details
 */
router.get('/aggregates/:aggregateId/events/:eventId', (req: Request, res: Response) => {
  const eventStore = getEventStore();
  const aggregateId = req.params.aggregateId || '';
  const events = eventStore.getAggregateEvents(aggregateId);
  const event = events.find(e => e.id === req.params.eventId);

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  res.json({
    id: event.id,
    aggregateId: event.aggregateId,
    aggregateType: event.aggregateType,
    eventType: event.eventType,
    version: event.eventVersion,
    timestamp: event.timestamp.toISOString(),
    sequenceNumber: event.sequenceNumber,
    payload: event.payload,
    metadata: event.metadata,
    correlationId: event.correlationId,
    causationId: event.causationId
  });
});

/**
 * POST /api/eventstore/aggregates/:aggregateId/events
 * Append event to aggregate (requires auth)
 */
router.post('/aggregates/:aggregateId/events', (req: Request, res: Response) => {
  const eventStore = getEventStore();
  const aggregateId = req.params.aggregateId || '';
  const { eventType, payload, metadata, expectedVersion } = req.body;

  if (!eventType) {
    return res.status(400).json({ error: 'eventType is required' });
  }

  try {
    const appendOptions: any = { correlationId: (req as any).correlationId };
    if (metadata) appendOptions.metadata = metadata;
    if (expectedVersion !== undefined) appendOptions.expectedVersion = expectedVersion;
    
    const event = eventStore.appendEvent(aggregateId, 'unknown', eventType, payload || {}, appendOptions);

    logger.info(`Event appended: ${event.id}`);
    res.status(201).json({
      eventId: event.id,
      version: event.eventVersion,
      sequenceNumber: event.sequenceNumber,
      timestamp: event.timestamp.toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('Concurrency violation')) {
      return res.status(409).json({ error: message });
    }
    logger.error('Error appending event:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to append event' });
  }
});

// ============================================================================
// SNAPSHOT MANAGEMENT
// ============================================================================

/**
 * GET /api/eventstore/aggregates/:aggregateId/snapshots
 * Get snapshots for an aggregate
 */
router.get('/aggregates/:aggregateId/snapshots', (req: Request, res: Response) => {
  const eventStore = getEventStore();
  const aggregateId = req.params.aggregateId || '';
  const snapshot = eventStore.getLatestSnapshot(aggregateId);

  if (!snapshot) {
    return res.json({
      aggregateId: aggregateId,
      snapshot: null,
      message: 'No snapshots available'
    });
  }

  res.json({
    aggregateId: req.params.aggregateId,
    snapshot: {
      version: snapshot.version,
      timestamp: snapshot.timestamp.toISOString(),
      sequenceNumber: snapshot.sequenceNumber,
      stateHash: hashObject(snapshot.state)
    }
  });
});

/**
 * POST /api/eventstore/aggregates/:aggregateId/snapshots
 * Create snapshot for aggregate (requires auth)
 */
router.post('/aggregates/:aggregateId/snapshots', (req: Request, res: Response) => {
  const eventStore = getEventStore();
  const aggregateId = req.params.aggregateId || '';
  const { state } = req.body;

  if (!state || typeof state !== 'object') {
    return res.status(400).json({ error: 'Valid state object is required' });
  }

  try {
    const snapshot = eventStore.createSnapshot(aggregateId, state);
    logger.info(`Snapshot created for aggregate ${aggregateId} at version ${snapshot.version}`);

    res.status(201).json({
      aggregateId: snapshot.aggregateId,
      version: snapshot.version,
      timestamp: snapshot.timestamp.toISOString(),
      sequenceNumber: snapshot.sequenceNumber
    });
  } catch (error) {
    logger.error('Error creating snapshot:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

// ============================================================================
// REPLAY AND RECONSTRUCTION
// ============================================================================

/**
 * POST /api/eventstore/aggregates/:aggregateId/replay
 * Replay aggregate from events and return reconstructed state
 */
router.post('/aggregates/:aggregateId/replay', (req: Request, res: Response) => {
  const eventStore = getEventStore();
  const aggregateId = req.params.aggregateId || '';
  const { fromVersion, toVersion } = req.body;

  try {
    const replayFilterOptions: any = {};
    if (fromVersion !== undefined) replayFilterOptions.fromVersion = fromVersion;
    if (toVersion !== undefined) replayFilterOptions.toVersion = toVersion;

    const events = eventStore.getAggregateEvents(aggregateId, replayFilterOptions);

    // Simple state reconstruction: aggregate payload
    const lastEvent = events.length > 0 ? events[events.length - 1] : undefined;
    const reconstructedState = {
      aggregateId: aggregateId,
      version: lastEvent ? lastEvent.eventVersion : 0,
      lastEventAt: lastEvent ? lastEvent.timestamp : null,
      eventCount: events.length,
      events: events.map(e => ({
        type: e.eventType,
        version: e.eventVersion,
        timestamp: e.timestamp.toISOString()
      }))
    };

    res.json({
      aggregateId: aggregateId,
      reconstruction: reconstructedState,
      fromVersion,
      toVersion
    });
  } catch (error) {
    logger.error('Error replaying aggregate:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to replay aggregate' });
  }
});

// ============================================================================
// EVENT TYPE QUERIES
// ============================================================================

/**
 * GET /api/eventstore/events/by-type/:eventType
 * Get events by type
 */
router.get('/events/by-type/:eventType', (req: Request, res: Response) => {
  const eventStore = getEventStore();
  const eventType = req.params.eventType || '';
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

  const events = eventStore.getEventsByType(eventType, limit);

  res.json({
    eventType: eventType,
    total: events.length,
    limit,
    events: events.map(evt => ({
      id: evt.id,
      aggregateId: evt.aggregateId,
      aggregateType: evt.aggregateType,
      version: evt.eventVersion,
      timestamp: evt.timestamp.toISOString(),
      sequenceNumber: evt.sequenceNumber
    }))
  });
});

// ============================================================================
// CONSISTENCY AND DIAGNOSTICS
// ============================================================================

/**
 * GET /api/eventstore/consistency
 * Check event store consistency
 */
router.get('/consistency', (req: Request, res: Response) => {
  const eventStore = getEventStore();
  const result = eventStore.checkConsistency();

  const statusCode = result.isConsistent ? 200 : 503;
  res.status(statusCode).json({
    isConsistent: result.isConsistent,
    summary: {
      duplicateEvents: result.duplicateEvents,
      orphanedSnapshots: result.orphanedSnapshots,
      versionGaps: result.versionGaps.length
    },
    issues: result.issues.slice(0, 20),
    totalIssues: result.issues.length
  });
});

/**
 * GET /api/eventstore/stats
 * Get event store statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  const eventStore = getEventStore();
  const stats = eventStore.getStats();

  res.json({
    summary: {
      totalEvents: stats.totalEvents,
      totalSnapshots: stats.totalSnapshots,
      totalAggregates: stats.totalAggregates,
      averageEventsPerAggregate: Math.round(stats.averageEventsPerAggregate * 100) / 100
    },
    eventsByType: stats.eventsByType,
    timeline: {
      oldest: stats.oldestEvent?.toISOString() || null,
      newest: stats.newestEvent?.toISOString() || null,
      span: stats.oldestEvent && stats.newestEvent
        ? `${Math.round((stats.newestEvent.getTime() - stats.oldestEvent.getTime()) / 1000 / 3600)} hours`
        : null
    },
    topEventTypes: Object.entries(stats.eventsByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }))
  });
});

/**
 * POST /api/eventstore/export
 * Export events (requires auth)
 */
router.post('/export', (req: Request, res: Response) => {
  const eventStore = getEventStore();
  const { aggregateType, format } = req.body;

  try {
    const events = eventStore.exportEvents(aggregateType as string | undefined);

    const exportFormat = format === 'csv' ? 'csv' : 'json';
    if (exportFormat === 'csv') {
      const csv = eventsToCsv(events);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="events.csv"');
      res.send(csv);
    } else {
      res.json({
        exportedAt: new Date().toISOString(),
        format: 'json',
        count: events.length,
        aggregateType,
        events: events.map(e => ({
          id: e.id,
          aggregateId: e.aggregateId,
          aggregateType: e.aggregateType,
          eventType: e.eventType,
          version: e.eventVersion,
          timestamp: e.timestamp.toISOString(),
          payload: e.payload
        }))
      });
    }
  } catch (error) {
    logger.error('Error exporting events:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to export events' });
  }
});

// ============================================================================
// UTILITIES
// ============================================================================

function hashObject(obj: any): string {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function eventsToCsv(events: any[]): string {
  const headers = ['ID', 'AggregateID', 'AggregateType', 'EventType', 'Version', 'Timestamp'];
  const rows = events.map(e => [
    e.id,
    e.aggregateId,
    e.aggregateType,
    e.eventType,
    e.eventVersion,
    e.timestamp.toISOString()
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}

export default router;
