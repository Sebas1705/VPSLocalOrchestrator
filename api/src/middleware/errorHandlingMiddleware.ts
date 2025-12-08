/**
 * Error Handling Middleware
 * 
 * Express middleware to catch and handle errors globally.
 * Integrates with ApplicationErrorHandler for consistent response format.
 * 
 * @module middleware/errorHandlingMiddleware
 */

import type { Request, Response, NextFunction } from 'express';
import { isDomainError } from '../domain/errors/index.js';
import { ApplicationErrorHandler } from '../application/errors/errorHandler.js';

/**
 * Async error wrapper - wraps controller methods to catch async errors
 * Usage: router.get('/', errorWrapper(controller.method))
 */
export const errorWrapper = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Main error handling middleware
 * Must be registered as the last middleware in Express app
 */
export const errorHandlingMiddleware = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error with context
  ApplicationErrorHandler.logError(error, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  // If response already sent, skip
  if (res.headersSent) {
    return next(error);
  }

  // Send error response
  ApplicationErrorHandler.sendErrorResponse(res, error);
};

/**
 * 404 Not Found handler
 * Should be registered before error handling middleware
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.path}`,
      statusCode: 404,
    },
    timestamp: new Date().toISOString(),
  });
};
