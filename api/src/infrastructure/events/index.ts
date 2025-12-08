import { EventEmitter } from 'events';
import type { ILogger } from '../logging/index.js';
import { LoggerFactory } from '../logging/index.js';

/**
 * Event Bus Infrastructure - v7.1.0
 * 
 * Provides pub/sub event distribution across application layers
 * with support for async handlers, event history, and middleware
 */

// ============================================================================
// EVENT TYPE DEFINITIONS
// ============================================================================

export enum EventCategory {
  DOMAIN = 'domain',        // Business domain events
  SYSTEM = 'system',        // System-level events
  INTEGRATION = 'integration', // External integrations
  AUDIT = 'audit',          // Audit trail events
  METRICS = 'metrics'       // Metrics and monitoring
}

export enum DomainEventType {
  // Command events
  COMMAND_RECEIVED = 'command.received',
  COMMAND_STARTED = 'command.started',
  COMMAND_COMPLETED = 'command.completed',
  COMMAND_FAILED = 'command.failed',
  
  // Resource events
  RESOURCE_CREATED = 'resource.created',
  RESOURCE_UPDATED = 'resource.updated',
  RESOURCE_DELETED = 'resource.deleted',
  RESOURCE_ACCESSED = 'resource.accessed',
  
  // Job events
  JOB_QUEUED = 'job.queued',
  JOB_STARTED = 'job.started',
  JOB_PROGRESSED = 'job.progressed',
  JOB_COMPLETED = 'job.completed',
  JOB_FAILED = 'job.failed',
  JOB_CANCELLED = 'job.cancelled',
  
  // System events
  SERVICE_STARTED = 'service.started',
  SERVICE_STOPPED = 'service.stopped',
  SERVICE_HEALTH_CHANGED = 'service.health.changed',
  CONFIG_CHANGED = 'config.changed'
}

export interface IEventHandler<T = any> {
  (payload: T): Promise<void>;
}

export interface EventBusSubscription {
  id: string;
  eventType: string;
  handler: IEventHandler;
  once: boolean;
  priority: number;
  createdAt: Date;
}

export interface PublishedEvent {
  id: string;
  type: string;
  category: EventCategory;
  timestamp: Date;
  payload: any;
  source: string;
  traceId?: string;
  correlationId?: string;
  causationId?: string;
}

export interface EventBusStats {
  totalSubscriptions: number;
  subscriptionsByType: Record<string, number>;
  publishedEventsCount: number;
  failedHandlers: number;
  averageHandlerTime: number;
  handlersByType: Record<string, number>;
  activeSubscriptions: EventBusSubscription[];
}

// ============================================================================
// EVENT BUS CLASS
// ============================================================================

export class EventBus extends EventEmitter {
  private subscriptions: Map<string, EventBusSubscription[]> = new Map();
  private eventHistory: PublishedEvent[] = [];
  private maxHistorySize: number;
  private logger: ILogger;
  private stats = {
    totalPublished: 0,
    failedHandlers: 0,
    totalHandlerTime: 0,
    handlerCount: 0,
    handlerErrors: new Map<string, number>()
  };
  private subscriptionCounter = 0;
  private eventCounter = 0;

  constructor(maxHistorySize: number = 10000) {
    super();
    this.maxHistorySize = maxHistorySize;
    this.logger = LoggerFactory.getInstance().getLogger();
    this.setMaxListeners(1000);
  }

  /**
   * Subscribe to events with optional priority
   */
  subscribe<T = any>(
    eventType: string,
    handler: IEventHandler<T>,
    priority: number = 0
  ): string {
    const subscription: EventBusSubscription = {
      id: `sub-${++this.subscriptionCounter}`,
      eventType,
      handler,
      once: false,
      priority,
      createdAt: new Date()
    };

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }

    const handlers = this.subscriptions.get(eventType)!;
    handlers.push(subscription);

    // Sort by priority (higher priority first)
    handlers.sort((a, b) => b.priority - a.priority);

    this.logger.debug(`Event subscription created: ${subscription.id} for ${eventType}`);
    this.emit('subscription:created', subscription);

    return subscription.id;
  }

  /**
   * Subscribe to event once
   */
  subscribeOnce<T = any>(
    eventType: string,
    handler: IEventHandler<T>,
    priority: number = 0
  ): string {
    const wrappedHandler: IEventHandler = async (payload: T) => {
      try {
        await handler(payload);
      } finally {
        this.unsubscribe(subscription.id);
      }
    };

    const subscription: EventBusSubscription = {
      id: `sub-${++this.subscriptionCounter}`,
      eventType,
      handler: wrappedHandler,
      once: true,
      priority,
      createdAt: new Date()
    };

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }

    this.subscriptions.get(eventType)!.push(subscription);
    this.logger.debug(`One-time event subscription created: ${subscription.id} for ${eventType}`);
    this.emit('subscription:created', subscription);

    return subscription.id;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const handlers of this.subscriptions.values()) {
      const index = handlers.findIndex(h => h.id === subscriptionId);
      if (index !== -1) {
        handlers.splice(index, 1);
        this.logger.debug(`Event subscription removed: ${subscriptionId}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Publish event to subscribers
   */
  async publish<T = any>(
    eventType: string,
    payload: T,
    options: {
      category?: EventCategory;
      source?: string;
      traceId?: string;
      correlationId?: string;
      causationId?: string;
    } = {}
  ): Promise<void> {
    const event: PublishedEvent = {
      id: `evt-${++this.eventCounter}`,
      type: eventType,
      category: options.category || EventCategory.DOMAIN,
      timestamp: new Date(),
      payload,
      source: options.source || 'unknown'
    };

    // Add optional properties only if they exist
    if (options.traceId) (event as any).traceId = options.traceId;
    if (options.correlationId) (event as any).correlationId = options.correlationId;
    if (options.causationId) (event as any).causationId = options.causationId;

    this.stats.totalPublished++;
    this.addToHistory(event);

    const handlers = this.subscriptions.get(eventType) || [];
    if (handlers.length === 0) {
      this.logger.debug(`Event published with no subscribers: ${eventType}`);
      return;
    }

    this.logger.debug(`Publishing event: ${eventType} to ${handlers.length} subscriber(s)`);

    const results = await Promise.allSettled(
      handlers.map(async (subscription) => {
        const startTime = performance.now();
        try {
          await subscription.handler(payload);
          const duration = performance.now() - startTime;
          this.stats.totalHandlerTime += duration;
          this.stats.handlerCount++;
        } catch (error) {
          this.stats.failedHandlers++;
          const errorCount = (this.stats.handlerErrors.get(eventType) || 0) + 1;
          this.stats.handlerErrors.set(eventType, errorCount);
          this.logger.error(`Event handler failed for ${eventType}:`, error instanceof Error ? error : new Error(String(error)));
          this.emit('handler:error', { eventType, subscriptionId: subscription.id, error });
        }
      })
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      this.logger.warn(`${failed} handler(s) failed for event: ${eventType}`);
    }
  }

  /**
   * Publish and wait for all handlers (blocking)
   */
  async publishAndWait<T = any>(
    eventType: string,
    payload: T,
    options?: {
      category?: EventCategory;
      source?: string;
      traceId?: string;
      correlationId?: string;
      causationId?: string;
      timeoutMs?: number;
    }
  ): Promise<{ succeeded: number; failed: number }> {
    const timeoutMs = options?.timeoutMs || 30000;

    const publishPromise = this.publish(eventType, payload, options);
    await Promise.race([
      publishPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Event publishing timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);

    const handlers = this.subscriptions.get(eventType) || [];
    return {
      succeeded: Math.max(0, handlers.length - this.stats.failedHandlers),
      failed: this.stats.failedHandlers
    };
  }

  /**
   * Get all subscriptions for an event type
   */
  getSubscriptions(eventType?: string): EventBusSubscription[] {
    if (eventType) {
      return this.subscriptions.get(eventType) || [];
    }
    const all: EventBusSubscription[] = [];
    for (const handlers of this.subscriptions.values()) {
      all.push(...handlers);
    }
    return all;
  }

  /**
   * Add event to history with rotation
   */
  private addToHistory(event: PublishedEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Get event history
   */
  getHistory(filter?: {
    eventType?: string;
    category?: EventCategory;
    since?: Date;
    limit?: number;
  }): PublishedEvent[] {
    let result = [...this.eventHistory];

    if (filter?.eventType) {
      result = result.filter(e => e.type === filter.eventType);
    }
    if (filter?.category) {
      result = result.filter(e => e.category === filter.category);
    }
    if (filter?.since !== undefined) {
      result = result.filter(e => e.timestamp >= filter.since!);
    }

    result = result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /**
   * Get event bus statistics
   */
  getStats(): EventBusStats {
    const subscriptionsByType: Record<string, number> = {};
    const handlersByType: Record<string, number> = {};

    for (const [eventType, handlers] of this.subscriptions.entries()) {
      subscriptionsByType[eventType] = handlers.length;
      handlersByType[eventType] = handlers.filter(h => !h.once).length;
    }

    return {
      totalSubscriptions: Array.from(this.subscriptions.values()).reduce(
        (sum, handlers) => sum + handlers.length,
        0
      ),
      subscriptionsByType,
      publishedEventsCount: this.stats.totalPublished,
      failedHandlers: this.stats.failedHandlers,
      averageHandlerTime:
        this.stats.handlerCount > 0
          ? this.stats.totalHandlerTime / this.stats.handlerCount
          : 0,
      handlersByType,
      activeSubscriptions: this.getSubscriptions()
    };
  }

  /**
   * Clear all subscriptions and history
   */
  clear(): void {
    this.subscriptions.clear();
    this.eventHistory = [];
    this.stats = {
      totalPublished: 0,
      failedHandlers: 0,
      totalHandlerTime: 0,
      handlerCount: 0,
      handlerErrors: new Map()
    };
    this.subscriptionCounter = 0;
    this.eventCounter = 0;
    this.logger.info('Event bus cleared');
  }

  /**
   * Reset stats while keeping subscriptions
   */
  resetStats(): void {
    this.stats = {
      totalPublished: 0,
      failedHandlers: 0,
      totalHandlerTime: 0,
      handlerCount: 0,
      handlerErrors: new Map()
    };
  }
}

// ============================================================================
// GLOBAL SINGLETON
// ============================================================================

let eventBus: EventBus | undefined;

export function initializeEventBus(maxHistorySize: number = 10000): EventBus {
  if (eventBus) {
    return eventBus;
  }

  eventBus = new EventBus(maxHistorySize);
  const logger = LoggerFactory.getInstance().getLogger();
  logger.info('Event Bus initialized');

  // Subscribe to internal events for monitoring
  eventBus.on('subscription:created', (subscription: EventBusSubscription) => {
    logger.debug(`Subscription created: ${subscription.id}`);
  });

  eventBus.on('handler:error', ({ eventType, subscriptionId, error }: any) => {
    logger.error(`Handler error - Event: ${eventType}, Subscription: ${subscriptionId}`, error instanceof Error ? error : new Error(String(error)));
  });

  return eventBus;
}

export function getEventBus(): EventBus {
  if (!eventBus) {
    return initializeEventBus();
  }
  return eventBus;
}

/**
 * Middleware for event bus integration with Express
 */
export function eventBusMiddleware() {
  const bus = getEventBus();
  
  return (req: any, res: any, next: any) => {
    // Attach event bus to request context
    req.eventBus = bus;
    
    // Generate correlation ID if not present
    const correlationId = req.get('x-correlation-id') || `corr-${Date.now()}-${Math.random()}`;
    req.correlationId = correlationId;
    
    // Capture event emissions for this request
    const originalPublish = bus.publish.bind(bus);
    req.publishEvent = async (eventType: string, payload: any, options?: any) => {
      return originalPublish(eventType, payload, {
        ...options,
        correlationId,
        traceId: req.traceId,
        source: 'http-request'
      });
    };

    next();
  };
}

/**
 * Decorator for publishing events after handler success
 */
export function publishEvent(
  eventType: string,
  category: EventCategory = EventCategory.DOMAIN,
  payloadMapper?: (result: any, req?: any) => any
) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      const bus = getEventBus();
      const payload = payloadMapper ? payloadMapper(result, args[0]) : result;
      
      await bus.publish(eventType, payload, {
        category,
        source: `handler:${propertyKey}`
      });

      return result;
    };

    return descriptor;
  };
}
