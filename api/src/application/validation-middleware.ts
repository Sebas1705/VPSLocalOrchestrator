/**
 * Validation Middleware
 *
 * Express middleware for automatic request/response validation.
 * Catches validation errors early and returns structured error responses.
 */

import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';
import { ErrorResponseSchema } from './validation-schemas.js';

/**
 * Validate request body against a Zod schema.
 * Returns 400 if validation fails.
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: result.error.flatten(),
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Attach validated data to request
    (req as any).validatedBody = result.data;
    next();
  };
}

/**
 * Validate request query parameters against a Zod schema.
 * Returns 400 if validation fails.
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query validation failed',
          details: result.error.flatten(),
        },
        timestamp: new Date().toISOString(),
      });
    }

    (req as any).validatedQuery = result.data;
    next();
  };
}

/**
 * Type-safe response sender.
 * Ensures response matches expected schema before sending.
 */
export function sendValidatedResponse<T>(
  res: Response,
  schema: z.ZodSchema<T>,
  data: T,
  statusCode: number = 200
) {
  const result = schema.safeParse(data);

  if (!result.success) {
    // Log validation error on server side
    console.error('Response validation failed:', result.error);

    // Return generic error to client (don't leak internals)
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
      timestamp: new Date().toISOString(),
    });
  }

  res.status(statusCode).json(result.data);
}

/**
 * Error response formatter.
 * Standardizes all error responses.
 */
export function sendErrorResponse(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 500,
  details?: Record<string, unknown>
) {
  const errorData = {
    error: {
      code,
      message,
      ...(details && { details }),
    },
    timestamp: new Date().toISOString(),
  };

  // Validate against error schema
  const validation = ErrorResponseSchema.safeParse(errorData);

  if (!validation.success) {
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to format error response',
      },
      timestamp: new Date().toISOString(),
    });
  }

  res.status(statusCode).json(validation.data);
}
