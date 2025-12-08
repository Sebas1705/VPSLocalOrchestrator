/**
 * Application Error Handler
 * 
 * Centralized error mapping and handling logic.
 * Converts domain errors to HTTP responses with consistent format.
 * 
 * @module application/errors/errorHandler
 */

import type { Response } from 'express';
import { isDomainError, DomainError, CommandExecutionError, ResourceAccessError, ServiceManagementError, ValidationError } from '../../domain/errors/index.js';

/**
 * Standard error response format
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    context?: Record<string, any>;
  };
  timestamp: string;
}

/**
 * Application error handler service
 * Provides methods for consistent error mapping and response generation
 */
export class ApplicationErrorHandler {
  /**
   * Map domain error to HTTP status code
   */
  static mapToHttpStatus(error: unknown): number {
    if (isDomainError(error)) {
      return error.statusCode;
    }

    // Default mappings for common error types
    if (error instanceof TypeError) return 400;
    if (error instanceof RangeError) return 400;
    if (error instanceof SyntaxError) return 400;

    // Default to 500 for unknown errors
    return 500;
  }

  /**
   * Create standardized error response
   */
  static createErrorResponse(error: unknown): ErrorResponse {
    if (isDomainError(error)) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          ...(error.context && { context: error.context }),
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Handle standard Error objects
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
        statusCode: 500,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Send error response to client
   */
  static sendErrorResponse(res: Response, error: unknown, statusCode?: number): void {
    const errorResponse = this.createErrorResponse(error);
    const code = statusCode || this.mapToHttpStatus(error);

    res.status(code).json(errorResponse);
  }

  /**
   * Log error for debugging/monitoring
   */
  static logError(error: unknown, context?: Record<string, any>): void {
    if (isDomainError(error)) {
      console.error(`[${error.code}] ${error.message}`, {
        statusCode: error.statusCode,
        context: { ...error.context, ...context },
      });
    } else {
      console.error('[INTERNAL_ERROR]', error, context);
    }
  }

  /**
   * Create error recovery recommendation
   */
  static getRecoveryStrategy(error: unknown): string {
    if (error instanceof CommandExecutionError) {
      return 'Check command syntax and ensure required tools are installed';
    }
    if (error instanceof ResourceAccessError) {
      return 'Verify resource exists and permissions are correct';
    }
    if (error instanceof ServiceManagementError) {
      return 'Verify service exists and is properly configured';
    }
    if (error instanceof ValidationError) {
      return 'Fix validation errors and retry request';
    }
    return 'Contact administrator for assistance';
  }
}

/**
 * Error context for tracking error sources
 */
export interface ErrorContext {
  operation: string;
  resource?: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Error recovery strategy
 */
export enum ErrorRecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  GRACEFUL_DEGRADATION = 'graceful_degradation',
  FAIL_FAST = 'fail_fast',
}

/**
 * Map error types to recovery strategies
 */
export const errorRecoveryMap: Record<string, ErrorRecoveryStrategy> = {
  'COMMAND_EXECUTION_ERROR': ErrorRecoveryStrategy.FAIL_FAST,
  'RESOURCE_ACCESS_ERROR': ErrorRecoveryStrategy.GRACEFUL_DEGRADATION,
  'SERVICE_MANAGEMENT_ERROR': ErrorRecoveryStrategy.RETRY,
  'VALIDATION_ERROR': ErrorRecoveryStrategy.FAIL_FAST,
};
