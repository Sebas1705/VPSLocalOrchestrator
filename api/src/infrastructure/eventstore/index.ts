import type { ILogger } from '../logging/index.js';
import { LoggerFactory } from '../logging/index.js';

/**
 * Event Store Infrastructure - v7.2.0
 * 
 * Implements event sourcing patterns with:
 * - Immutable event log storage
 * - Event stream snapshots for performance
 * - Aggregate root replay capability
 * - Consistency guarantees with version tracking
 */

// ============================================================================
// DOMAIN TYPES
// ============================================================================

export enum AggregateStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

export interface StoredEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventVersion: number;
  timestamp: Date;
  sequenceNumber: number;
  payload: any;
  metadata?: Record<string, any>;
  causationId?: string;
  correlationId?: string;
}

export interface EventSnapshot {
  aggregateId: string;
  aggregateType: string;
  sequenceNumber: number;
  timestamp: Date;
  state: any;
  version: number;
}

export interface AggregateStream {
  aggregateId: string;
  aggregateType: string;
  status: AggregateStatus;
  version: number;
  eventCount: number;
  lastEventAt: Date;
  snapshotAt?: Date;
  snapshotVersion?: number;
}

export interface ReplayOptions {
  fromVersion?: number;
  toVersion?: number;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  limit?: number;
}

export interface EventStoreStats {
  totalEvents: number;
  totalSnapshots: number;
  totalAggregates: number;
  eventsByType: Record<string, number>;
  snapshotsByAggregate: number;
  oldestEvent: Date | null;
  newestEvent: Date | null;
  averageEventsPerAggregate: number;
}

export interface ConsistencyResult {
  isConsistent: boolean;
  issues: string[];
  duplicateEvents: number;
  orphanedSnapshots: number;
  versionGaps: string[];
}

// ============================================================================
// EVENT STORE CLASS
// ============================================================================

export class EventStore {
  private events: Map<string, StoredEvent[]> = new Map(); // aggregateId -> events
  private snapshots: Map<string, EventSnapshot[]> = new Map(); // aggregateId -> snapshots
  private eventsByType: Map<string, StoredEvent[]> = new Map();
  private logger: ILogger;
  private eventSequence = 0;
  private snapshotThreshold = 10; // Create snapshot after N events

  constructor(snapshotThreshold: number = 10) {
    this.logger = LoggerFactory.getInstance().getLogger();
    this.snapshotThreshold = snapshotThreshold;
  }

  /**
   * Append event to aggregate stream
   */
  appendEvent(
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    payload: any,
    options?: {
      expectedVersion?: number;
      metadata?: Record<string, any>;
      causationId?: string;
      correlationId?: string;
    }
  ): StoredEvent {
    // Verify concurrency control
    const stream = this.events.get(aggregateId) || [];
    const currentVersion = stream.length;

    if (options?.expectedVersion !== undefined && options.expectedVersion !== currentVersion) {
      throw new Error(
        `Concurrency violation: expected version ${options.expectedVersion}, but current is ${currentVersion}`
      );
    }

    const event: StoredEvent = {
      id: `evt-${Date.now()}-${Math.random()}`,
      aggregateId,
      aggregateType,
      eventType,
      eventVersion: currentVersion + 1,
      timestamp: new Date(),
      sequenceNumber: ++this.eventSequence,
      payload
    };

    // Add optional properties only if they exist
    if (options?.metadata) (event as any).metadata = options.metadata;
    if (options?.causationId) (event as any).causationId = options.causationId;
    if (options?.correlationId) (event as any).correlationId = options.correlationId;

    // Store in aggregate stream
    if (!this.events.has(aggregateId)) {
      this.events.set(aggregateId, []);
    }
    this.events.get(aggregateId)!.push(event);

    // Index by type
    if (!this.eventsByType.has(eventType)) {
      this.eventsByType.set(eventType, []);
    }
    this.eventsByType.get(eventType)!.push(event);

    this.logger.debug(`Event stored: ${event.id} for aggregate ${aggregateId}`);

    // Check snapshot threshold
    if (stream.length % this.snapshotThreshold === 0) {
      this.logger.debug(`Snapshot threshold reached for aggregate ${aggregateId}`);
    }

    return event;
  }

  /**
   * Append multiple events atomically
   */
  appendEvents(
    aggregateId: string,
    aggregateType: string,
    events: Array<{
      eventType: string;
      payload: any;
      metadata?: Record<string, any>;
    }>,
    expectedVersion?: number
  ): StoredEvent[] {
    const results: StoredEvent[] = [];
    let version = expectedVersion ?? (this.events.get(aggregateId)?.length || 0);

    for (const event of events) {
      const appendOptions: any = { expectedVersion: version };
      if (event.metadata) appendOptions.metadata = event.metadata;
      
      const stored = this.appendEvent(aggregateId, aggregateType, event.eventType, event.payload, appendOptions);
      results.push(stored);
      version++;
    }

    return results;
  }

  /**
   * Get all events for an aggregate
   */
  getAggregateEvents(aggregateId: string, options?: ReplayOptions): StoredEvent[] {
    const stream = this.events.get(aggregateId) || [];
    let filtered = [...stream];

    // Apply filters
    if (options?.fromVersion !== undefined) {
      filtered = filtered.filter(e => e.eventVersion >= options.fromVersion!);
    }
    if (options?.toVersion !== undefined) {
      filtered = filtered.filter(e => e.eventVersion <= options.toVersion!);
    }
    if (options?.fromTimestamp) {
      filtered = filtered.filter(e => e.timestamp >= options.fromTimestamp!);
    }
    if (options?.toTimestamp) {
      filtered = filtered.filter(e => e.timestamp <= options.toTimestamp!);
    }

    // Apply limit
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Create snapshot of aggregate at current version
   */
  createSnapshot(aggregateId: string, state: any): EventSnapshot {
    const stream = this.events.get(aggregateId) || [];
    const snapshot: EventSnapshot = {
      aggregateId,
      aggregateType: stream[0]?.aggregateType || 'unknown',
      sequenceNumber: stream.length,
      timestamp: new Date(),
      state: JSON.parse(JSON.stringify(state)), // Deep copy
      version: stream.length
    };

    if (!this.snapshots.has(aggregateId)) {
      this.snapshots.set(aggregateId, []);
    }
    this.snapshots.get(aggregateId)!.push(snapshot);

    this.logger.info(`Snapshot created for aggregate ${aggregateId} at version ${snapshot.version}`);
    return snapshot;
  }

  /**
   * Get latest snapshot for aggregate
   */
  getLatestSnapshot(aggregateId: string): EventSnapshot | undefined {
    const snapshots = this.snapshots.get(aggregateId) || [];
    return snapshots[snapshots.length - 1];
  }

  /**
   * Replay aggregate from events
   */
  replayAggregate<T = any>(
    aggregateId: string,
    reducer: (state: T, event: StoredEvent) => T,
    initialState: T
  ): T {
    const snapshot = this.getLatestSnapshot(aggregateId);
    let state = initialState;
    let startVersion = 1;

    // Start from snapshot if available
    if (snapshot) {
      state = JSON.parse(JSON.stringify(snapshot.state));
      startVersion = snapshot.version + 1;
    }

    const events = this.getAggregateEvents(aggregateId, {
      fromVersion: startVersion
    });

    for (const event of events) {
      state = reducer(state, event);
    }

    return state;
  }

  /**
   * Get aggregate stream metadata
   */
  getAggregateStream(aggregateId: string): AggregateStream | undefined {
    const events = this.events.get(aggregateId);
    if (!events || events.length === 0) {
      return undefined;
    }

    const firstEvent = events[0]!;
    const lastEvent = events[events.length - 1]!;
    const snapshot = this.getLatestSnapshot(aggregateId);
    
    const stream: AggregateStream = {
      aggregateId,
      aggregateType: firstEvent.aggregateType,
      status: AggregateStatus.ACTIVE,
      version: events.length,
      eventCount: events.length,
      lastEventAt: lastEvent.timestamp
    };

    if (snapshot) {
      (stream as any).snapshotAt = snapshot.timestamp;
      (stream as any).snapshotVersion = snapshot.version;
    }

    return stream;
  }

  /**
   * Get all aggregate IDs
   */
  getAllAggregateIds(aggregateType?: string): string[] {
    if (!aggregateType) {
      return Array.from(this.events.keys());
    }

    return Array.from(this.events.entries())
      .filter(([, events]) => events[0]?.aggregateType === aggregateType)
      .map(([id]) => id);
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: string, limit?: number): StoredEvent[] {
    const events = this.eventsByType.get(eventType) || [];
    return limit ? events.slice(-limit) : events;
  }

  /**
   * Delete aggregate (soft delete - marks as deleted)
   */
  deleteAggregate(aggregateId: string, reason: string): StoredEvent {
    return this.appendEvent(aggregateId, 'unknown', 'aggregate.deleted', {
      reason,
      deletedAt: new Date()
    });
  }

  /**
   * Check event store consistency
   */
  checkConsistency(): ConsistencyResult {
    const issues: string[] = [];
    let duplicateCount = 0;
    let orphanedSnapshots = 0;
    const versionGaps: string[] = [];

    // Check for duplicate event IDs
    const eventIds = new Set<string>();
    for (const stream of this.events.values()) {
      for (const event of stream) {
        if (eventIds.has(event.id)) {
          duplicateCount++;
          issues.push(`Duplicate event ID: ${event.id}`);
        }
        eventIds.add(event.id);
      }
    }

    // Check for version gaps
    for (const [aggregateId, stream] of this.events.entries()) {
      for (let i = 0; i < stream.length; i++) {
        const streamEvent = stream[i];
        if (streamEvent && streamEvent.eventVersion !== i + 1) {
          versionGaps.push(`Aggregate ${aggregateId}: expected version ${i + 1}, got ${streamEvent.eventVersion}`);
          issues.push(`Version gap in ${aggregateId}`);
        }
      }

      // Check for orphaned snapshots
      const snapshots = this.snapshots.get(aggregateId) || [];
      for (const snapshot of snapshots) {
        if (snapshot.version > stream.length) {
          orphanedSnapshots++;
          issues.push(`Orphaned snapshot for ${aggregateId} at version ${snapshot.version}`);
        }
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues,
      duplicateEvents: duplicateCount,
      orphanedSnapshots,
      versionGaps
    };
  }

  /**
   * Get event store statistics
   */
  getStats(): EventStoreStats {
    const dates = Array.from(this.events.values())
      .flat()
      .map(e => e.timestamp);

    let totalEvents = 0;
    for (const stream of this.events.values()) {
      totalEvents += stream.length;
    }

    let totalSnapshots = 0;
    for (const snapshotList of this.snapshots.values()) {
      totalSnapshots += snapshotList.length;
    }

    const eventsByType: Record<string, number> = {};
    for (const [type, events] of this.eventsByType.entries()) {
      eventsByType[type] = events.length;
    }

    return {
      totalEvents,
      totalSnapshots,
      totalAggregates: this.events.size,
      eventsByType,
      snapshotsByAggregate: this.snapshots.size,
      oldestEvent: dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null,
      newestEvent: dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null,
      averageEventsPerAggregate: this.events.size > 0 ? totalEvents / this.events.size : 0
    };
  }

  /**
   * Export events for backup
   */
  exportEvents(aggregateType?: string): StoredEvent[] {
    if (!aggregateType) {
      return Array.from(this.events.values()).flat();
    }

    return Array.from(this.events.values())
      .flat()
      .filter(e => e.aggregateType === aggregateType);
  }

  /**
   * Clear all data (testing only)
   */
  clear(): void {
    this.events.clear();
    this.snapshots.clear();
    this.eventsByType.clear();
    this.eventSequence = 0;
    this.logger.info('Event store cleared');
  }
}

// ============================================================================
// GLOBAL SINGLETON
// ============================================================================

let eventStore: EventStore | undefined;

export function initializeEventStore(snapshotThreshold: number = 10): EventStore {
  if (eventStore) {
    return eventStore;
  }

  eventStore = new EventStore(snapshotThreshold);
  const logger = LoggerFactory.getInstance().getLogger();
  logger.info(`Event Store initialized with snapshot threshold: ${snapshotThreshold}`);

  return eventStore;
}

export function getEventStore(): EventStore {
  if (!eventStore) {
    return initializeEventStore();
  }
  return eventStore;
}
