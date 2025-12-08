/**
 * Distributed Tracing Middleware
 * 
 * Extracts/generates trace IDs from request headers
 * Attaches trace context to request object for downstream use
 * Injects trace headers into response headers
 * 
 * @module middleware/tracing
 */

import type { Request, Response, NextFunction } from 'express';
import {
  getTracer,
  type SpanContext,
  SpanKind,
  TraceIdGenerator,
  W3CTraceContextPropagator,
} from '../infrastructure/tracing/index.js';
import { getLogger } from '../config/index.js';

const logger = getLogger('tracing-middleware');
const tracer = getTracer();
const propagator = new W3CTraceContextPropagator();

/**
 * Extend Express Request with tracing properties
 */
declare global {
  namespace Express {
    interface Request {
      spanContext?: SpanContext;
      span?: any; // Span interface
    }
  }
}

/**
 * Tracing middleware
 */
export function tracingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestStart = Date.now();

  // Extract trace context from request headers
  let spanContext = tracer.extractContext(
    req.headers as Record<string, string | undefined>
  );

  // Create new trace if not present
  if (!spanContext) {
    const traceId = TraceIdGenerator.generate();
    const spanId = TraceIdGenerator.generateSpanId();

    spanContext = {
      traceId,
      spanId,
      traceFlags: '01', // Trace is sampled
    };

    logger.info('Starting new trace', {
      traceId,
      spanId,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.info('Continuing trace', {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      parentSpanId: spanContext.parentSpanId,
      path: req.path,
      method: req.method,
    });
  }

  // Attach span context to request
  req.spanContext = spanContext;

  // Create span for this request
  const span = tracer.startSpan(
    `${req.method} ${req.path}`,
    spanContext,
    SpanKind.SERVER
  );
  req.span = span;

  // Add request attributes to span
  span.setAttribute('http.method', req.method);
  span.setAttribute('http.url', req.originalUrl);
  span.setAttribute('http.target', req.path);
  span.setAttribute('http.host', req.hostname);
  span.setAttribute('http.client_ip', req.ip);

  if (req.headers['user-agent']) {
    span.setAttribute('http.user_agent', req.headers['user-agent']);
  }

  // Set trace context in logger for all subsequent logs in this request
  logger.setTraceContext(spanContext.traceId, spanContext.spanId);

  // Inject trace context into response headers
  const responseHeaders: Record<string, string> = {};
  propagator.injectContext(spanContext, responseHeaders);
  Object.entries(responseHeaders).forEach(([key, value]) => {
    res.set(key, value);
  });

  // Intercept res.send to capture response details
  const originalSend = res.send;
  res.send = function (data?: any): Response {
    // Add response status to span
    span.setAttribute('http.status_code', res.statusCode);

    // End span
    const duration = Date.now() - requestStart;
    span.setAttribute('http.duration_ms', duration);

    if (res.statusCode >= 400) {
      span.setStatus(
        'ERROR',
        `HTTP ${res.statusCode}`
      );
    } else {
      span.setStatus('OK');
    }

    span.end();

    // Log response
    logger.info('Request completed', {
      statusCode: res.statusCode,
      duration,
      path: req.path,
      method: req.method,
    });

    // Call original send
    return originalSend.call(this, data);
  };

  next();
}
