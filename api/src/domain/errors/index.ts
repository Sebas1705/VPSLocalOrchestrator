/**
 * Domain-Specific Error Classes
 * 
 * Define custom errors that represent domain-level failures.
 * Each error maps to specific HTTP status codes for proper client responses.
 * 
 * @module domain/errors
 */

/**
 * Base domain error class
 * All domain errors extend this to provide consistent error handling
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Command Execution Error
 * Thrown when command execution fails (syntax error, timeout, permission denied)
 * HTTP Status: 400 (Bad Request) or 403 (Forbidden)
 */
export class CommandExecutionError extends DomainError {
  constructor(
    message: string,
    statusCode: number = 400,
    context?: Record<string, any>
  ) {
    super('COMMAND_EXECUTION_ERROR', message, statusCode, context);
  }

  static timeout(command: string, timeoutMs: number): CommandExecutionError {
    return new CommandExecutionError(
      `Command timed out after ${timeoutMs}ms`,
      408, // Request Timeout
      { command, timeoutMs }
    );
  }

  static denied(command: string, reason: string): CommandExecutionError {
    return new CommandExecutionError(
      `Command execution denied: ${reason}`,
      403, // Forbidden
      { command, reason }
    );
  }

  static invalidSyntax(command: string, error: string): CommandExecutionError {
    return new CommandExecutionError(
      `Invalid command syntax: ${error}`,
      400,
      { command, error }
    );
  }
}

/**
 * Resource Access Error
 * Thrown when unable to access or manipulate system resources
 * HTTP Status: 400 (Bad Request), 404 (Not Found), or 409 (Conflict)
 */
export class ResourceAccessError extends DomainError {
  constructor(
    message: string,
    statusCode: number = 400,
    context?: Record<string, any>
  ) {
    super('RESOURCE_ACCESS_ERROR', message, statusCode, context);
  }

  static notFound(resource: string, id: string): ResourceAccessError {
    return new ResourceAccessError(
      `${resource} with ID ${id} not found`,
      404,
      { resource, id }
    );
  }

  static invalid(resource: string, field: string, value: any): ResourceAccessError {
    return new ResourceAccessError(
      `Invalid ${resource}: ${field} = ${value}`,
      400,
      { resource, field, value }
    );
  }

  static conflict(resource: string, reason: string): ResourceAccessError {
    return new ResourceAccessError(
      `${resource} conflict: ${reason}`,
      409,
      { resource, reason }
    );
  }

  static permissionDenied(resource: string, operation: string): ResourceAccessError {
    return new ResourceAccessError(
      `Permission denied for ${operation} on ${resource}`,
      403,
      { resource, operation }
    );
  }
}

/**
 * Service Management Error
 * Thrown when unable to manage services (start, stop, restart, status)
 * HTTP Status: 400 (Bad Request), 404 (Not Found), or 503 (Service Unavailable)
 */
export class ServiceManagementError extends DomainError {
  constructor(
    message: string,
    statusCode: number = 500,
    context?: Record<string, any>
  ) {
    super('SERVICE_MANAGEMENT_ERROR', message, statusCode, context);
  }

  static notFound(serviceName: string): ServiceManagementError {
    return new ServiceManagementError(
      `Service '${serviceName}' not found`,
      404,
      { serviceName }
    );
  }

  static unavailable(serviceName: string, reason: string): ServiceManagementError {
    return new ServiceManagementError(
      `Service '${serviceName}' unavailable: ${reason}`,
      503, // Service Unavailable
      { serviceName, reason }
    );
  }

  static operationFailed(serviceName: string, operation: string, error: string): ServiceManagementError {
    return new ServiceManagementError(
      `Failed to ${operation} service '${serviceName}': ${error}`,
      500,
      { serviceName, operation, error }
    );
  }

  static invalidAction(action: string): ServiceManagementError {
    return new ServiceManagementError(
      `Invalid service action: '${action}'`,
      400,
      { action, validActions: ['start', 'stop', 'restart', 'status', 'enable', 'disable'] }
    );
  }
}

/**
 * Validation Error
 * Thrown when request validation fails
 * HTTP Status: 400 (Bad Request)
 */
export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: any
  ) {
    super('VALIDATION_ERROR', message, 400, { field, value });
  }

  static missingRequired(field: string): ValidationError {
    return new ValidationError(`Required field missing: ${field}`, field);
  }

  static invalidType(field: string, expected: string, got: string): ValidationError {
    return new ValidationError(
      `Invalid type for ${field}: expected ${expected}, got ${got}`,
      field,
      got
    );
  }

  static outOfRange(field: string, value: any, min?: number, max?: number): ValidationError {
    const range = min !== undefined && max !== undefined 
      ? `${min}-${max}` 
      : (min !== undefined ? `>= ${min}` : `<= ${max}`);
    return new ValidationError(
      `Field ${field} out of range (${range}): ${value}`,
      field,
      value
    );
  }
}

/**
 * Type guard to check if error is a DomainError
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Map domain errors to HTTP status codes
 */
export const errorStatusMap: Record<string, number> = {
  COMMAND_EXECUTION_ERROR: 400,
  RESOURCE_ACCESS_ERROR: 400,
  SERVICE_MANAGEMENT_ERROR: 500,
  VALIDATION_ERROR: 400,
};
