/**
 * Audit Logging Infrastructure
 * 
 * Records all significant API operations for compliance and forensics
 * Immutable event stream with structured data
 * Enables compliance, debugging, and security analysis
 * 
 * @module infrastructure/audit
 */

import { EventEmitter } from 'events';
import { getLogger } from '../../config/index.js';
import { getCache, type ICache } from '../cache/index.js';

const logger = getLogger('audit');

/**
 * Audit event types
 */
export enum AuditEventType {
  // Authentication
  AUTH_LOGIN = 'auth.login',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_TOKEN_CREATED = 'auth.token_created',
  AUTH_TOKEN_REVOKED = 'auth.token_revoked',

  // Commands
  COMMAND_EXECUTED = 'command.executed',
  COMMAND_FAILED = 'command.failed',
  PRIVILEGED_COMMAND = 'privileged.command',

  // Resources
  RESOURCE_ACCESSED = 'resource.accessed',
  RESOURCE_MODIFIED = 'resource.modified',

  // Configuration
  CONFIG_CHANGED = 'config.changed',
  CONFIG_ACCESSED = 'config.accessed',

  // Security
  SECURITY_VIOLATION = 'security.violation',
  RATE_LIMIT_EXCEEDED = 'rate_limit.exceeded',

  // Jobs
  JOB_CREATED = 'job.created',
  JOB_COMPLETED = 'job.completed',
  JOB_FAILED = 'job.failed',
  JOB_CANCELLED = 'job.cancelled',

  // System
  SYSTEM_STARTED = 'system.started',
  SYSTEM_STOPPED = 'system.stopped',
  ERROR_OCCURRED = 'error.occurred',
}

/**
 * Audit severity levels
 */
export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/**
 * Audit event
 */
export interface AuditEvent {
  id: string;
  timestamp: number;
  type: AuditEventType;
  severity: AuditSeverity;
  actor: {
    type: 'user' | 'system' | 'api-token';
    id: string;
    name?: string;
  };
  action: string;
  resource?: {
    type: string;
    id: string;
  };
  changes?: Record<string, { from: any; to: any }>;
  status: 'success' | 'failure';
  statusCode?: number;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Audit Query Options
 */
export interface AuditQueryOptions {
  type?: AuditEventType;
  severity?: AuditSeverity;
  actor?: string;
  resource?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}

/**
 * Audit Logger
 */
export class AuditLogger extends EventEmitter {
  private events: AuditEvent[] = [];
  private eventIdCounter = 0;
  private cache: ICache;

  constructor(cache?: ICache) {
    super();
    this.cache = cache ?? getCache();
    logger.info('Audit logger initialized');
  }

  /**
   * Log audit event
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<AuditEvent> {
    const id = `audit_${++this.eventIdCounter}_${Date.now()}`;
    const timestamp = Date.now();

    const auditEvent: AuditEvent = {
      ...event,
      id,
      timestamp,
    };

    // Store in memory
    this.events.push(auditEvent);

    // Store in cache for distributed access
    const cacheKey = `audit:event:${id}`;
    await this.cache.set(cacheKey, auditEvent, { ttl: 31536000000 }); // 1 year

    // Add to audit index
    const indexKey = `audit:index:${auditEvent.type}`;
    const index = (await this.cache.get<string[]>(indexKey)) ?? [];
    index.push(id);
    await this.cache.set(indexKey, index, { ttl: 31536000000 });

    this.emit('audit:event', auditEvent);

    logger.debug('Audit event logged', {
      id,
      type: auditEvent.type,
      actor: auditEvent.actor.id,
      status: auditEvent.status,
    });

    return auditEvent;
  }

  /**
   * Get event by ID
   */
  async getEvent(id: string): Promise<AuditEvent | null> {
    // Try memory first
    const memoryEvent = this.events.find((e) => e.id === id);
    if (memoryEvent) {
      return memoryEvent;
    }

    // Try cache
    return this.cache.get<AuditEvent>(`audit:event:${id}`);
  }

  /**
   * Query events
   */
  async query(options: AuditQueryOptions): Promise<{
    events: AuditEvent[];
    total: number;
  }> {
    let results = [...this.events];

    // Filter by type
    if (options.type) {
      results = results.filter((e) => e.type === options.type);
    }

    // Filter by severity
    if (options.severity) {
      results = results.filter((e) => e.severity === options.severity);
    }

    // Filter by actor
    if (options.actor) {
      results = results.filter((e) => e.actor.id === options.actor);
    }

    // Filter by resource
    if (options.resource) {
      results = results.filter((e) => e.resource?.id === options.resource);
    }

    // Filter by time range
    if (options.startTime) {
      results = results.filter((e) => e.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      results = results.filter((e) => e.timestamp <= options.endTime!);
    }

    // Sort by timestamp (newest first)
    results = results.sort((a, b) => b.timestamp - a.timestamp);

    const total = results.length;

    // Pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;

    results = results.slice(offset, offset + limit);

    return { events: results, total };
  }

  /**
   * Get events by type
   */
  async getEventsByType(type: AuditEventType): Promise<AuditEvent[]> {
    const result = await this.query({ type });
    return result.events;
  }

  /**
   * Get events by actor
   */
  async getEventsByActor(actorId: string): Promise<AuditEvent[]> {
    const result = await this.query({ actor: actorId });
    return result.events;
  }

  /**
   * Get critical events
   */
  async getCriticalEvents(hours: number = 24): Promise<AuditEvent[]> {
    const startTime = Date.now() - hours * 60 * 60 * 1000;
    const result = await this.query({
      severity: AuditSeverity.CRITICAL,
      startTime,
    });
    return result.events;
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    successRate: number;
  }> {
    const stats = {
      totalEvents: this.events.length,
      eventsByType: {} as Record<string, number>,
      eventsBySeverity: {} as Record<string, number>,
      successRate: 0,
    };

    let successCount = 0;

    for (const event of this.events) {
      // Count by type
      stats.eventsByType[event.type] =
        (stats.eventsByType[event.type] ?? 0) + 1;

      // Count by severity
      stats.eventsBySeverity[event.severity] =
        (stats.eventsBySeverity[event.severity] ?? 0) + 1;

      // Count successes
      if (event.status === 'success') {
        successCount++;
      }
    }

    stats.successRate =
      this.events.length > 0
        ? Math.round((successCount / this.events.length) * 100)
        : 0;

    return stats;
  }

  /**
   * Export audit log as JSON
   */
  async export(options?: AuditQueryOptions): Promise<AuditEvent[]> {
    const result = await this.query(options ?? {});
    return result.events;
  }

  /**
   * Clear old events (retention policy)
   */
  async clearOldEvents(daysToKeep: number = 90): Promise<number> {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    const initialLength = this.events.length;

    this.events = this.events.filter((e) => e.timestamp > cutoffTime);

    const removed = initialLength - this.events.length;

    logger.info('Old audit events cleared', {
      daysToKeep,
      removed,
    });

    return removed;
  }
}

/**
 * Global audit logger instance
 */
let globalAuditLogger: AuditLogger | null = null;

/**
 * Initialize audit logger
 */
export function initializeAuditLogger(cache?: ICache): AuditLogger {
  if (!globalAuditLogger) {
    globalAuditLogger = new AuditLogger(cache);
  }
  return globalAuditLogger;
}

/**
 * Get audit logger
 */
export function getAuditLogger(): AuditLogger {
  if (!globalAuditLogger) {
    return initializeAuditLogger();
  }
  return globalAuditLogger;
}
