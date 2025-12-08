/**
 * Metrics Middleware
 * 
 * Automatically collects HTTP request metrics:
 * - Request count by method, path, status
 * - Request duration histogram
 * - Active requests gauge
 * 
 * @module middleware/metrics
 */

import type { Request, Response, NextFunction } from 'express';
import { getMetricsRegistry } from '../infrastructure/metrics/index.js';
import { getLogger } from '../config/index.js';

const logger = getLogger('metrics-middleware');
const registry = getMetricsRegistry();

// Initialize HTTP metrics
const httpRequestsTotal = registry.getCounter(
  'http_requests_total',
  'Total number of HTTP requests'
);

const httpRequestDuration = registry.getHistogram(
  'http_request_duration_seconds',
  'HTTP request duration in seconds',
  [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
);

const httpRequestsInFlight = registry.getGauge(
  'http_requests_in_flight',
  'Current number of HTTP requests being processed'
);

const httpRequestSizeBytes = registry.getHistogram(
  'http_request_size_bytes',
  'HTTP request size in bytes',
  [100, 1000, 10000, 100000, 1000000, 10000000]
);

const httpResponseSizeBytes = registry.getHistogram(
  'http_response_size_bytes',
  'HTTP response size in bytes',
  [100, 1000, 10000, 100000, 1000000, 10000000]
);

// Error metrics
const httpErrorsTotal = registry.getCounter(
  'http_errors_total',
  'Total number of HTTP errors (4xx, 5xx)'
);

/**
 * Metrics collection middleware
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  // Increment in-flight requests
  httpRequestsInFlight.inc();

  // Track request size
  const requestSize = parseInt(req.headers['content-length'] || '0', 10);
  if (requestSize > 0) {
    httpRequestSizeBytes.observe(requestSize);
  }

  // Intercept res.send to capture metrics
  const originalSend = res.send;
  const originalJson = res.json;

  let responseSent = false;

  const captureMetrics = () => {
    if (responseSent) return;
    responseSent = true;

    const duration = (Date.now() - startTime) / 1000; // Convert to seconds

    // Get normalized path (remove IDs and dynamic segments)
    const normalizedPath = normalizePath(req.path);

    // Record metrics with labels
    const labels = {
      method: req.method,
      path: normalizedPath,
      status: res.statusCode.toString(),
    };

    // Increment request counter
    const requestCounter = registry.getCounter(
      'http_requests_total',
      'Total number of HTTP requests',
      labels
    );
    requestCounter.inc();

    // Record duration
    const durationHistogram = registry.getHistogram(
      'http_request_duration_seconds',
      'HTTP request duration in seconds',
      [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      labels
    );
    durationHistogram.observe(duration);

    // Track response size
    const responseSize = parseInt(res.getHeader('content-length') as string || '0', 10);
    if (responseSize > 0) {
      httpResponseSizeBytes.observe(responseSize);
    }

    // Track errors
    if (res.statusCode >= 400) {
      const errorLabels = {
        method: req.method,
        path: normalizedPath,
        status: res.statusCode.toString(),
        type: res.statusCode >= 500 ? 'server_error' : 'client_error',
      };

      const errorCounter = registry.getCounter(
        'http_errors_total',
        'Total number of HTTP errors',
        errorLabels
      );
      errorCounter.inc();
    }

    // Decrement in-flight requests
    httpRequestsInFlight.dec();

    // Log metrics
    logger.debug('HTTP metrics recorded', {
      method: req.method,
      path: normalizedPath,
      status: res.statusCode,
      duration: `${duration.toFixed(3)}s`,
      requestSize,
      responseSize,
    });
  };

  res.send = function (data?: any): Response {
    captureMetrics();
    return originalSend.call(this, data);
  };

  res.json = function (data?: any): Response {
    captureMetrics();
    return originalJson.call(this, data);
  };

  // Handle response finish
  res.on('finish', () => {
    captureMetrics();
  });

  // Handle errors
  res.on('close', () => {
    if (!responseSent) {
      httpRequestsInFlight.dec();
    }
  });

  next();
}

/**
 * Normalize path by removing IDs and dynamic segments
 */
function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUIDs
    .replace(/\/\d+/g, '/:id') // Numeric IDs
    .replace(/\/[0-9a-f]{24}/g, '/:id') // MongoDB ObjectIDs
    .replace(/\/[0-9a-f]{32}/g, '/:traceId') // Trace IDs
    .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:token'); // Long tokens
}

/**
 * Endpoint to expose metrics in Prometheus format
 */
export function metricsEndpoint(req: Request, res: Response): void {
  try {
    const format = req.query.format as string || 'prometheus';

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.send(registry.exportJSON());
    } else {
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.send(registry.exportPrometheus());
    }
  } catch (error) {
    logger.error('Failed to export metrics', error as Error);
    res.status(500).json({ error: 'Failed to export metrics' });
  }
}
