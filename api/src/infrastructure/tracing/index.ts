/**
 * Distributed Tracing Infrastructure
 * 
 * Supports trace ID propagation, span context, and distributed request tracking
 * Compatible with W3C Trace Context specification
 * 
 * @module infrastructure/tracing
 */

import { randomBytes } from 'crypto';

/**
 * Span kind enumeration
 */
export enum SpanKind {
  INTERNAL = 'INTERNAL',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  PRODUCER = 'PRODUCER',
  CONSUMER = 'CONSUMER',
}

/**
 * Span context
 */
export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: string;
  traceState?: string;
}

/**
 * Span event
 */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, any>;
}

/**
 * Span
 */
export interface Span {
  context: SpanContext;
  kind: SpanKind;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, any>;
  events: SpanEvent[];
  status: {
    code: 'UNSET' | 'OK' | 'ERROR';
    message?: string;
  };
  addEvent(name: string, attributes?: Record<string, any>): void;
  setAttribute(key: string, value: any): void;
  setStatus(code: 'OK' | 'ERROR', message?: string): void;
  end(): void;
}

/**
 * Trace context propagator (W3C Trace Context)
 */
export class W3CTraceContextPropagator {
  private readonly TRACE_CONTEXT_HEADER = 'traceparent';
  private readonly TRACE_STATE_HEADER = 'tracestate';

  /**
   * Extract trace context from headers
   */
  extractContext(headers: Record<string, string | undefined>): SpanContext | null {
    const traceparent = headers[this.TRACE_CONTEXT_HEADER];
    if (!traceparent) return null;

    const parts = traceparent.split('-');
    if (parts.length !== 4) return null;

    const [version, traceId, parentSpanId, traceFlags] = parts;
    if (version !== '00') return null; // Only support version 00

    // Build context object properly to handle optional properties
    const context: SpanContext = {
      traceId: traceId || '',
      spanId: this.generateSpanId(),
      traceFlags: traceFlags || '01',
    };

    // Only add optional properties if they have values
    if (parentSpanId) {
      context.parentSpanId = parentSpanId;
    }

    const traceState = headers[this.TRACE_STATE_HEADER];
    if (traceState) {
      context.traceState = traceState;
    }

    return context;
  }

  /**
   * Inject trace context into headers
   */
  injectContext(context: SpanContext, headers: Record<string, string>): void {
    headers[this.TRACE_CONTEXT_HEADER] = `00-${context.traceId}-${context.spanId}-${context.traceFlags}`;
    if (context.traceState) {
      headers[this.TRACE_STATE_HEADER] = context.traceState;
    }
  }

  private generateSpanId(): string {
    return randomBytes(8).toString('hex');
  }
}

/**
 * Trace ID generator
 */
export class TraceIdGenerator {
  /**
   * Generate new trace ID
   */
  static generate(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate new span ID
   */
  static generateSpanId(): string {
    return randomBytes(8).toString('hex');
  }

  /**
   * Validate trace ID format
   */
  static isValidTraceId(traceId: string): boolean {
    return /^[0-9a-f]{32}$/.test(traceId) && traceId !== '00000000000000000000000000000000';
  }

  /**
   * Validate span ID format
   */
  static isValidSpanId(spanId: string): boolean {
    return /^[0-9a-f]{16}$/.test(spanId) && spanId !== '0000000000000000';
  }
}

/**
 * Tracer - creates and manages spans
 */
export class Tracer {
  private propagator = new W3CTraceContextPropagator();
  private activeSpans: Map<string, Span> = new Map();

  /**
   * Start new span from context
   */
  startSpan(
    name: string,
    parentContext?: SpanContext,
    kind: SpanKind = SpanKind.INTERNAL
  ): Span {
    const traceId = parentContext?.traceId || TraceIdGenerator.generate();
    const spanId = TraceIdGenerator.generateSpanId();
    const parentSpanId = parentContext?.spanId;

    // Build context object properly to handle optional properties
    const context: SpanContext = {
      traceId,
      spanId,
      traceFlags: parentContext?.traceFlags || '01',
    };

    // Only add optional property if it has value
    if (parentSpanId !== undefined) {
      context.parentSpanId = parentSpanId;
    }

    const span: Span = {
      context,
      kind,
      name,
      startTime: Date.now(),
      attributes: {},
      events: [],
      status: { code: 'UNSET' },
      addEvent: (eventName: string, attributes?: Record<string, any>) => {
        span.events.push({
          name: eventName,
          timestamp: Date.now(),
          ...(attributes && { attributes }),
        });
      },
      setAttribute: (key: string, value: any) => {
        span.attributes[key] = value;
      },
      setStatus: (code: 'OK' | 'ERROR', message?: string) => {
        span.status = { code, ...(message && { message }) };
      },
      end: () => {
        span.endTime = Date.now();
        this.activeSpans.delete(spanId);
      },
    };

    this.activeSpans.set(spanId, span);
    return span;
  }

  /**
   * Get active span
   */
  getActiveSpan(spanId: string): Span | undefined {
    return this.activeSpans.get(spanId);
  }

  /**
   * Extract context from headers
   */
  extractContext(headers: Record<string, string | undefined>): SpanContext | null {
    return this.propagator.extractContext(headers);
  }

  /**
   * Inject context into headers
   */
  injectContext(context: SpanContext, headers: Record<string, string>): void {
    this.propagator.injectContext(context, headers);
  }
}

/**
 * Global tracer instance
 */
let globalTracer: Tracer | null = null;

/**
 * Initialize global tracer
 */
export function initializeTracer(): Tracer {
  if (!globalTracer) {
    globalTracer = new Tracer();
  }
  return globalTracer;
}

/**
 * Get global tracer instance
 */
export function getTracer(): Tracer {
  if (!globalTracer) {
    return initializeTracer();
  }
  return globalTracer;
}
